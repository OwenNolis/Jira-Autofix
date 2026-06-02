# Jira-Autofix
Automated pipeline that syncs Jira issues to GitHub, uses Gemini AI / Copilot CLI to generate code fixes, opens a pull request with the solution, and closes both the GitHub issue and the original Jira ticket on merge.

This repository contains three independent but complementary features:

| Feature | What it does |
| --- | --- |
| [Jira Autofix](#jira-autofix) | Picks up Jira issues and generates AI code fixes automatically |
| [PR Validation](#pr-validation) | Checks whether a PR correctly implements a Functional and Technical Analysis |
| [LangGraph Agent — Document Generation](#langgraph-agent--document-generation) | Converts PDF specs to Functional Analyses, then to Technical Analyses, then to PDF |

---

## Jira Autofix

### Overview

Jira Autofix connects Jira to GitHub and closes the loop automatically. The moment a Jira issue is flagged, the system creates a mirrored GitHub issue, fires an AI agent that reads the entire codebase and implements the required change, opens a pull request, and closes both the GitHub issue and the Jira ticket once the PR is merged.

The AI agent (GitHub Copilot CLI with `gpt-4.1`) does not just generate a text suggestion — it actually writes the file changes to the repository, verifies that the build still compiles, and fixes any TypeScript errors it introduced before creating the PR. The agent receives a detailed prompt that enforces coding rules: it must follow existing patterns, never overwrite an existing file with a stub, never touch routing files unless explicitly asked, and wire up any new page or component so it is reachable from the UI.

Two entry points exist for bringing a Jira issue into the pipeline:

- **Webhook trigger** — Jira fires a webhook the moment the `ai-fix` label is added to an issue. The workflow receives the payload, creates a GitHub issue, and immediately dispatches the AI fix. This is real-time and requires no polling.
- **Manual poll** — A manually triggered workflow fetches up to 25 Jira issues matching a JQL filter (e.g. all open issues with label `needs-code-change`), creates a GitHub issue for each one, and queues an AI fix for every new issue found.

Both paths converge at the same AI fix workflow. The system also prevents duplicates: before creating a GitHub issue it checks whether one already exists for that Jira key (by looking for the label `jira:<KEY>`).

The Jira key is embedded as a hidden HTML comment in every GitHub issue and PR body (`<!-- jira-key: PROJ-123 -->`). This is how the close-on-merge workflow tracks which Jira ticket to close without needing any external database or state file.

### How it works

```
Jira Issue (label: needs-code-change)
        │
        ▼  every 10 minutes
[jira-poll.yml]
  Polls Jira via REST API → creates a GitHub Issue with the Jira key embedded
        │
        ▼  label "ai-fix" added  OR  comment "!fix"
[ai-fix-from-issue.yml]
  Reads the issue → builds repo context → calls Gemini AI or Copilot CLI → applies code changes
        │
        ▼
  Pull Request opened  (branch: ai-fix/issue-N-TIMESTAMP)
        │
        ▼  PR merged
[close-on-merge.yml]
  Closes the GitHub Issue (via "Fixes #N") + closes the Jira issue automatically
```

---

## Prerequisites

- A Jira project with API access
- A Google Gemini API key
- A Personal Access Token (PAT) for Copilot CLI
- (Optional) A Kubernetes cluster if you want K8s to act as the orchestrator instead of the GitHub Actions scheduler

---

## Setup

### 1. Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Description |
|--------|-------------|
| `JIRA_EMAIL` | Service account email for Jira authentication |
| `JIRA_API_TOKEN` | Jira API token |
| `GEMINI_API_KEY` | Google Gemini API key |
| `COPILOT_PAT`    | Copilot Personal Access Token |

### 2. Variables

In the same page under **Variables**:

| Variable | Example |
|----------|---------|
| `JIRA_DOMAIN` | `yourorg.atlassian.net` |
| `JIRA_PROJECT_KEY` | `PROJ` |
| `JIRA_JQL_FILTER` | `project=PROJ AND status != Done AND labels = needs-code-change ORDER BY created DESC` |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `AI_PROVIDER` | `gituhb` |

### 3. Labels

Create these two labels once in **Issues → Labels**:

| Label | Color | Purpose |
|-------|-------|---------|
| `from-jira` | `#0052CC` | Applied to every issue auto-created from Jira |
| `ai-fix` | `#E11D48` | Triggers the AI fix workflow |

> Per-issue labels like `jira:PROJ-123` are created automatically by the poll workflow.

### 4. Jira label

On the Jira issues you want synced, add the label `needs-code-change` (or update `JIRA_JQL_FILTER` to match your own criteria).

---

## Triggering a fix

Once a GitHub issue has been created from Jira, you can trigger the AI fix in two ways:

- **Label** — add the `ai-fix` label to the issue
- **Comment** — post a comment containing `!fix`

The workflow will acknowledge the trigger with a 👀 reaction, run the Gemini analysis, apply code changes, and open a pull request. It will then comment on the issue with a link to the PR.

---

## File structure

```
.
├── .github/
│   ├── scripts/
│   │   └── ai-issue-fix.sh          # Gemini AI engine: reads issue → writes file changes
│   └── workflows/
│       ├── jira-poll.yml            # Polls Jira every 10 min → creates GitHub issues
│       ├── ai-fix-from-issue.yml    # Issue trigger → AI fix → PR
│       └── close-on-merge.yml      # PR merged → close GitHub issue + Jira issue
└── k8s/
    ├── jira-poller-cronjob.yaml     # (Optional) K8s CronJob to trigger jira-poll.yml
    └── github-credentials-secret.yaml  # K8s secret — never commit with real values
```

---

## Kubernetes orchestration (optional)

If you prefer Kubernetes to act as the orchestrator instead of the GitHub Actions schedule, the K8s CronJob in `k8s/` triggers `jira-poll.yml` via `workflow_dispatch` every 10 minutes.

```bash
kubectl create namespace automation
kubectl apply -f k8s/github-credentials-secret.yaml
kubectl apply -f k8s/jira-poller-cronjob.yaml
```

The secret requires a GitHub Personal Access Token with `repo` and `workflow` scopes. See `k8s/github-credentials-secret.yaml` for the format — **fill in your values and never commit the file**.

To test the CronJob manually:
```bash
kubectl create job --from=cronjob/jira-github-poller manual-test -n automation
kubectl logs -n automation job/manual-test
```

---

## How Jira issues are tracked

Each Jira issue is given a dedicated GitHub label (`jira:PROJ-123`) when its GitHub issue is created. The Jira key is also embedded as a hidden HTML comment in the issue and PR bodies:

```
<!-- jira-key: PROJ-123 -->
```

This is how `close-on-merge.yml` finds the Jira key when a PR is merged, without needing any external state or database.

---

## Notes

- **Jira transition name** — `close-on-merge.yml` looks for transitions named `Done`, `Closed`, or `Resolve Issue`. If your Jira project uses a different name, add it to the `select(.name == ...)` filter in the workflow.
- **Default branch** — all workflows target `main`. Update the `base` field in `ai-fix-from-issue.yml` if your repo uses a different default branch.
- **Schedule jitter** — GitHub's cron scheduler has roughly 1 minute of jitter and does not guarantee exact 10-minute intervals. Use the Kubernetes CronJob for stricter timing.
- **Large repos** — the AI script caps context at ~70,000 characters. For very large repos, tune `MAX_CHARS` in `ai-issue-fix.sh`.

---

## PR Validation

### What PR Validation does

PR Validation is an on-demand AI code review that checks whether the code in a pull request actually implements what was specified. It reads a Functional Analysis (FA) and a Technical Analysis (TA) document, compares them against the changed files in the PR, and produces a structured compliance report with a PASS / PARTIAL / FAIL verdict.

The report is not a general code quality review — it is a targeted compliance check. For every numbered requirement (REQ-xxx), business rule (BR-xxx), acceptance criterion (AC-xxx), and non-functional requirement (NFR-xxx) found in the FA, the AI determines whether it is fully implemented, partially implemented, or missing in the PR code. It does the same for the technical contracts defined in the TA: API endpoints, domain entities, database constraints, backend layer structure, and frontend component layout.

There are two versions of the workflow. The standard version uses `GITHUB_TOKEN` and is limited to the free GitHub Models tier. The enterprise version authenticates with a paid Copilot PAT, which gives access to `gpt-4o` and a significantly larger token budget — this allows it to analyse bigger documents and more changed files without truncation.

Two analysis modes exist:

- **`--changed` (default)** — sends the full content of every file modified in the PR to the model. This gives precise, line-level feedback and is the right choice for a focused feature PR.
- **`--full`** — instead of file contents, sends the complete repository file tree (`git ls-files`). The model infers what is implemented from file and folder names rather than reading actual code. This is useful for a broad coverage check of the entire codebase when the token budget would not allow sending all files.

The FA and TA documents are either attached directly to the PR comment, or resolved automatically from a `docs/` folder in the repository (`docs/functional-analysis/feature-<id>*.md` and `docs/technical-analysis/feature-<id>*.md`). Attachments take priority over the folder.

### Validation flow

```
Developer posts PR comment: /validate-feature-012
        │
        ▼
Workflow triggered
  ├─ Resolves FA and TA (from attachment or docs/ folder)
  ├─ Collects code context:
  │    --changed → full content of changed PR files
  │    --full    → repository file tree only
  ├─ Builds a structured validation prompt
  ├─ Calls GitHub Models API (gpt-4o / Claude Sonnet)
  └─ Posts compliance report as PR comment
```

### Report structure

Every validation report contains the same sections regardless of mode:

| Section | Source | What is checked |
| --- | --- | --- |
| Requirements | FA | Per REQ-xxx: implemented / partial / missing |
| Business Rules | FA | Per BR-xxx: enforced / partial / missing |
| Acceptance Criteria | FA | Per AC-xxx: covered / partial / not covered |
| Non-Functional Requirements | FA | Per NFR-xxx: addressed / partial / missing |
| API Contracts | TA | Endpoint paths, HTTP methods, request/response structure, status codes |
| Domain Model & Database | TA | Entities, fields, relations, constraints |
| Backend Design | TA | Controller / service / repository layer structure |
| Frontend Design | TA | Components and routes (when applicable to the PR) |
| Summary table | FA + TA | Counts per category: OK / Partial / Missing |
| Verdict | FA + TA + code | **PASS** / **PARTIAL** / **FAIL** with a one-sentence conclusion |

### Workflow files

| File | Description |
| --- | --- |
| `feature-validation.yml` | Standard version — free tier, Claude Sonnet via `GITHUB_TOKEN` |
| `feature-validation-enterprise.yml` | Enterprise version — `gpt-4o` via paid Copilot PAT, higher token limit |

---

## LangGraph Agent — Document Generation

### What it does

The Document Generation pipeline converts a raw PDF specification — such as a design brief, assignment document, or requirements PDF — into a fully structured Functional Analysis, then into a Technical Analysis, and optionally renders the final TA back to PDF. Each conversion step is a separate AI agent triggered by a PR comment, and each step feeds directly into the next.

The pipeline is built on [LangGraph](https://github.com/langchain-ai/langgraph), a framework for orchestrating multi-step AI workflows as directed graphs. Each agent runs as a sequence of nodes: one to analyse the input, one to draft each section, and one to validate the output against a JSON schema before saving. This structured approach means the output is always in a predictable format that downstream tools (like the PR Validation feature) can consume.

All three steps run inside GitHub Actions and communicate through PR comments and artifact uploads. The user does not need to install anything locally — they drag a file into a comment and the runner handles the rest.

### The three steps

**Step 1 — PDF to FA (`/pdf-to-fa`)**

The agent (`pdf_to_fa.py`) renders each page of the PDF to a PNG image using PyMuPDF, then sends every page individually to Claude Sonnet on the GitHub Models API. The model analyses the page visually and textually and generates a structured Functional Analysis in Markdown. Diagrams and UI sketches found in the PDF are extracted and embedded inline as base64 images in the artifact. The FA is posted as a PR comment (with images replaced by placeholder text, since GitHub comments do not render base64 data URIs) and uploaded as a full artifact with images intact.

**Step 2 — FA to TA (`/fa-to-ta`)**

The agent (`fa_to_ta.py`) reads the FA markdown and converts it into a Technical Analysis. LangGraph orchestrates the conversion as a multi-node graph: the first node analyses the FA and identifies all domain concepts, the subsequent nodes draft each TA section (architecture, API contracts, domain model, backend design, frontend design), and a final node validates the entire output against a JSON schema. If validation fails, the agent retries the failing section automatically. The output is two files: a human-readable `.md` TA and a machine-readable `.ta.json` that captures all structured data in a predictable format.

**Step 3 — TA to PDF (`/ta-to-pdf`)**

The agent (`ta_to_pdf.py`) converts the TA markdown to HTML with embedded CSS styling, then renders it to PDF using Chrome headless. If Chrome is not available on the runner, it falls back to weasyprint. The result is uploaded as an artifact and a download link is posted to the PR comment.

### Pipeline overview

```
PDF (design document or assignment)
        │
        ▼  /pdf-to-fa feature-012
[ai-pdf-to-fa.yml]  →  pdf_to_fa.py
  Renders PDF pages → sends each page to Claude Sonnet → generates FA.md
        │
        ▼  /fa-to-ta feature-012
[ai-fa-to-ta.yml]  →  fa_to_ta.py (LangGraph)
  Reads FA → multi-step AI draft per TA section → validates against schema
  → generates TA.md + TA.ta.json
        │
        ▼  /ta-to-pdf feature-012
[ai-ta-to-pdf.yml]  →  ta_to_pdf.py
  Renders TA.md → HTML + CSS → Chrome headless → TA.pdf
```

### Key design decisions

- **Page-by-page PDF processing** — sending the entire PDF as one prompt exceeds the model's token limit. Instead, each page is a separate API call and the results are merged into a single FA document.
- **LangGraph for multi-step generation** — a single LLM call cannot reliably produce a complete TA in one shot. LangGraph splits the work into smaller nodes, each with a focused task, making the output more consistent and easier to validate.
- **JSON schema validation** — the FA-to-TA agent validates its own output against a schema before saving. This ensures the TA always contains the expected sections and can be consumed reliably by the PR Validation feature.
- **Artifact + PR comment** — results are always available in two forms: a PR comment for immediate visibility, and a GitHub Actions artifact (retained 30 days) for download. The artifact contains the full file including base64-embedded images that cannot be shown in a comment.

### Workflow files and scripts

| File | Description |
| --- | --- |
| `ai-pdf-to-fa.yml` | Workflow for step 1 — PDF to FA |
| `ai-fa-to-ta.yml` | Workflow for step 2 — FA to TA |
| `ai-ta-to-pdf.yml` | Workflow for step 3 — TA to PDF |
| `ai/agent/langgraph/pdf_to_fa.py` | Python agent — renders PDF pages and calls Claude Sonnet |
| `ai/agent/langgraph/fa_to_ta.py` | Python agent — LangGraph multi-node FA→TA conversion |
| `ai/agent/langgraph/ta_to_pdf.py` | Python script — markdown to PDF via Chrome headless |
| `ai/agent/langgraph/templates/` | TA and FA skeleton templates used as structure guides |
| `ai/agent/langgraph/requirements.txt` | Python dependencies installed automatically by the runner |
