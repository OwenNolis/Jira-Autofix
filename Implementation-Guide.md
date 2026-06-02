# Implementation Guide — Jira-Autofix Features

> This guide explains the three main features of this repository, how they work, and how to set them up in a new organisation or repository from scratch.

---

## Table of Contents

1. [Feature 1 — Jira Autofix](#1-jira-autofix)
2. [Feature 2 — PR Validation](#2-pr-validation)
3. [Feature 3 — Document Generation](#3-document-generation)
4. [Transfer to a New Repository](#4-transfer-to-a-new-repository)
5. [GitHub Secrets Reference](#5-github-secrets-reference)
6. [GitHub Variables Reference](#6-github-variables-reference)
7. [GitHub PAT Requirements](#7-github-pat-requirements)
8. [Jira Automation Setup](#8-jira-automation-setup)

---

## 1. Jira Autofix

### What it is

Jira Autofix is a fully automated pipeline that bridges Jira and GitHub. When a Jira issue is flagged for an AI fix, the system creates a GitHub issue, sends the codebase to an AI agent (GitHub Copilot CLI with `gpt-4.1`), applies the generated code changes, verifies the build, and opens a pull request — all without human involvement. When the PR is merged, the GitHub issue closes automatically, and optionally the Jira ticket too.

### How it works — full flow

```
Jira issue gets label "ai-fix"
        │
        ▼
[Option A] Jira Automation Webhook ──→ jira-label-trigger.yml
[Option B] Manual Jira Poll        ──→ jira-poll.yml
        │
        ▼
GitHub issue created (labels: from-jira, ai-fix, jira:<KEY>)
        │
        ▼
ai-fix-from-issue-enterprise.yml
  ├─ Reads issue title and body
  ├─ Builds agent prompt with full instructions
  ├─ Runs Copilot CLI (gpt-4.1, --no-ask-user)
  ├─ Agent reads codebase, writes changes, runs npm run build
  └─ If build passes: creates branch feature/<JIRA-KEY>, commits, pushes
        │
        ▼
PR created automatically
  ├─ PR body contains <!-- jira-key: KEY --> for close-on-merge
  └─ Issue gets a comment with the PR link
        │
        ▼
Developer reviews and merges PR
        │
        ▼
GitHub closes the issue automatically (via "Fixes #N" in commit)
[Optional] close-on-merge.yml closes the Jira ticket via webhook
```

### Workflow files involved

| File | Trigger | Purpose |
|------|---------|---------|
| `jira-label-trigger.yml` | `repository_dispatch` (Jira webhook) | Creates GitHub issue from Jira payload, dispatches AI fix |
| `jira-poll.yml` | Manual (`workflow_dispatch`) | Fetches up to 25 Jira issues via OAuth gateway, creates GitHub issues |
| `ai-fix-from-issue-enterprise.yml` | Label `ai-fix`, comment `/fix-ai`, or `workflow_dispatch` | Core AI agent — reads issue, writes code, creates PR |
| `close-on-merge.yml` | PR closed (disabled by default) | Closes Jira ticket via automation webhook after merge |
| `build-on-demand.yml` | PR comment `/build` | Re-runs `npm install && npm run build` on demand |

### How to trigger

**Option A — Automatic (Jira webhook, recommended):**
When a Jira issue gets the label `ai-fix`, Jira sends a webhook to GitHub, which creates a GitHub issue and immediately starts the AI fix. No manual steps needed.

**Option B — Manual (Jira Poll):**
Go to **Actions → Jira → GitHub Issues → Run workflow**. Optionally enter a custom JQL filter. The workflow fetches matching Jira issues and processes each one.

**Option C — Direct on a GitHub issue:**
Add the label `ai-fix` to any GitHub issue, or comment `/fix-ai` on the issue.

**Option D — Direct from Actions UI:**
Go to **Actions → AI Fix from GitHub Issue (Enterprise) → Run workflow** and enter the issue number.

### What the AI agent does

The Copilot CLI agent receives a detailed prompt telling it to:
- Find all projects in the repository (`package.json` files)
- Understand the existing code style and patterns
- Implement only what the issue asks, without touching unrelated code
- Never overwrite existing files with stubs
- Never modify `App.tsx`, routing files, or entry points unless explicitly required
- Run `npm install && npm run build` to verify the fix compiles
- Fix all TypeScript errors before finishing

### Enabling Jira ticket auto-close

The `close-on-merge.yml` workflow is disabled by default (`if: false`). To enable it:
1. Open `.github/workflows/close-on-merge.yml`
2. Remove the line `if: false` from the `close-jira` job
3. Add the `JIRA_DONE_WEBHOOK` secret (see Section 5)

---

## 2. PR Validation

### What it is

Feature Validation is an on-demand AI code review triggered by a PR comment. The AI reads the Functional Analysis (FA) and Technical Analysis (TA) documents and compares them to the actual code in the PR. It produces a structured report with a PASS / PARTIAL / FAIL verdict, covering requirements, business rules, acceptance criteria, NFRs, API contracts, domain model, and backend/frontend design.

There are two versions:
- **Standard** (`feature-validation.yml`) — uses `GITHUB_TOKEN`, free tier, lower token limit
- **Enterprise** (`feature-validation-enterprise.yml`) — uses a paid Copilot PAT with `gpt-4o`, higher token limit, recommended

### How it works

```
Developer posts PR comment: /validate-feature-012
        │
        ▼
Workflow triggered (feature-validation-enterprise.yml)
  ├─ Parses feature ID and mode (--changed or --full)
  ├─ Reacts with 👍 to confirm receipt
  ├─ Resolves FA and TA (from comment attachment or docs/ folder)
  ├─ Collects code context:
  │    --changed: full content of changed files in the PR
  │    --full: repository file tree (git ls-files) for broad coverage
  ├─ Builds prompt combining FA + TA + code context
  ├─ Calls GitHub Models API (gpt-4o)
  └─ Posts structured validation report as PR comment
```

### How to use

**Basic — validates only the changed files in the PR:**
```
/validate-feature-012
```

**Full — sends the entire file tree for a broader coverage check:**
```
/validate-feature-012 --full
```

**With attachments — use your own FA and TA files instead of docs/ folder (FA first, TA second):**
```
/validate-feature-012
[fa.md](https://github.com/user-attachments/assets/...)
[ta.md](https://github.com/user-attachments/assets/...)
```

> FA must always be the first attachment, TA the second.

**If FA and TA are stored in the repository**, no attachment is needed. The workflow looks for:
- `docs/functional-analysis/feature-012*.md`
- `docs/technical-analysis/feature-012*.md`

### Report structure

The generated report always contains:
- **FA Validation** — per REQ-xxx, BR-xxx, AC-xxx, NFR-xxx: ✅ / ⚠️ / ❌
- **TA Validation** — API contracts, domain model, backend design, frontend design
- **Summary table** — counts per category
- **Verdict** — PASS / PARTIAL / FAIL with a one-sentence conclusion

### Workflow files involved

| File | Trigger | Purpose |
|------|---------|---------|
| `feature-validation.yml` | PR comment `/validate-feature-` | Standard version (free tier, `GITHUB_TOKEN`) |
| `feature-validation-enterprise.yml` | PR comment `/validate-feature-` | Enterprise version (paid PAT, `gpt-4o`) |

Both workflows can run alongside each other — if both files are present they will both trigger and produce two reports.

---

## 3. Document Generation

### What it is

The Document Generation pipeline converts a PDF specification (such as a design brief or assignment) into a structured Functional Analysis (FA), then into a Technical Analysis (TA), then renders the TA back to PDF. Each step is independent and triggered by a PR comment. The AI uses Claude Sonnet via the GitHub Models API.

### Pipeline overview

```
PDF (design or specification document)
        │
        ▼ /pdf-to-fa feature-012-my-feature
Functional Analysis (FA.md)
  - Requirements, business rules, acceptance criteria
  - Domain model, API notes, UX notes
  - Embedded diagrams (base64 in artifact)
        │
        ▼ /fa-to-ta feature-012-my-feature
Technical Analysis (TA.md + TA.ta.json)
  - Architecture decisions, API contracts
  - Database schema, backend/frontend design
        │
        ▼ /ta-to-pdf feature-012-my-feature
Technical Analysis (TA.pdf)
  - Formatted PDF rendered via Chrome headless
```

### Step 1 — PDF to FA

**Trigger:** PR comment `/pdf-to-fa <feature-id>` with a PDF attachment

```
/pdf-to-fa feature-012-my-feature
[document.pdf](https://github.com/user-attachments/assets/...)
```

How it works:
- Renders each PDF page to PNG using PyMuPDF
- Sends each page (base64-encoded) to Claude Sonnet on GitHub Models
- Generates a structured FA markdown document in Dutch
- Posts the FA as a PR comment (images replaced by `[image - see artifact]`)
- Uploads the full FA (with images) as a GitHub Actions artifact (30-day retention)

**Script:** `ai/agent/langgraph/pdf_to_fa.py`

### Step 2 — FA to TA

**Trigger:** PR comment `/fa-to-ta <feature-id>` with the FA `.md` file attached

```
/fa-to-ta feature-012-my-feature
[feature-012-my-feature.md](https://github.com/user-attachments/assets/...)
```

How it works:
- Reads the FA markdown
- Uses LangGraph to orchestrate multiple AI steps (analyse → draft per section → validate against JSON schema)
- Generates a full TA in markdown and a machine-readable `.ta.json`
- Posts the TA as a PR comment and uploads both files as an artifact

**Script:** `ai/agent/langgraph/fa_to_ta.py`

### Step 3 — TA to PDF

**Trigger:** PR comment `/ta-to-pdf <feature-id>` with the TA `.md` file attached

```
/ta-to-pdf feature-012-my-feature
[feature-012-my-feature.md](https://github.com/user-attachments/assets/...)
```

How it works:
- Converts the TA markdown to HTML with embedded CSS
- Renders the HTML to PDF using Chrome headless (fallback: weasyprint)
- Uploads the PDF as an artifact
- Posts a PR comment with a link to download it

**Script:** `ai/agent/langgraph/ta_to_pdf.py`

### Workflow files involved

| File | Trigger | Purpose |
|------|---------|---------|
| `ai-pdf-to-fa.yml` | PR comment `/pdf-to-fa` | PDF → FA using Claude Sonnet |
| `ai-fa-to-ta.yml` | PR comment `/fa-to-ta` | FA → TA using LangGraph + Claude Sonnet |
| `ai-ta-to-pdf.yml` | PR comment `/ta-to-pdf` | TA → PDF using Chrome headless |

---

## 4. Transfer to a New Repository

### Files to copy

Copy these files from the source repository to the new repository:

**GitHub Actions workflows** (all go in `.github/workflows/`):
```
ai-fix-from-issue-enterprise.yml   ← core AI fix
ai-fix-from-issue.yml              ← standard AI fix (optional)
jira-label-trigger.yml             ← Jira webhook receiver
jira-poll.yml                      ← manual Jira poll (needs gateway)
close-on-merge.yml                 ← auto-close Jira (optional, disabled by default)
build-on-demand.yml                ← /build on PR comment (optional)
feature-validation.yml             ← PR validation standard (optional)
feature-validation-enterprise.yml  ← PR validation enterprise (recommended)
ai-pdf-to-fa.yml                   ← document generation step 1
ai-fa-to-ta.yml                    ← document generation step 2
ai-ta-to-pdf.yml                   ← document generation step 3
```

**Python agents** (for Document Generation only):
```
ai/agent/langgraph/pdf_to_fa.py
ai/agent/langgraph/fa_to_ta.py
ai/agent/langgraph/ta_to_pdf.py
ai/agent/langgraph/requirements.txt
ai/agent/langgraph/templates/        ← all skeleton templates
```

### GitHub Actions permissions

Go to **Settings → Actions → General → Workflow permissions** and set:
- **Read and write permissions**
- Tick **Allow GitHub Actions to create and approve pull requests**

### GitHub Labels

Create these labels in **Issues → Labels → New label**:

| Label | Colour | Purpose |
|-------|--------|---------|
| `ai-fix` | `#0075ca` | Triggers the AI fix workflow |
| `from-jira` | `#0052CC` | Marks issues imported from Jira |

---

## 5. GitHub Secrets Reference

Go to **Settings → Secrets and variables → Actions → Secrets**.

| Secret | Required for | Description |
|--------|-------------|-------------|
| `COPILOT_PAT` | `ai-fix-from-issue-enterprise.yml` | GitHub PAT for the enterprise AI fix. Must belong to an account with an active **Copilot Business or Enterprise** licence. Scopes: `repo`, `workflow`, `models:read` (classic PAT). |
| `COPILOT_PAT_TEST` | `ai-fix-from-issue.yml` | GitHub PAT for the standard AI fix. Same scopes, can be a free-tier Copilot account. |
| `COPILOT_PAT_ARNE` | `ai-pdf-to-fa.yml`, `feature-validation-enterprise.yml` | GitHub PAT for document generation and enterprise validation. Must have access to GitHub Models API. Scopes: `repo`, `models:read`. |
| `REPO_PAT` | `jira-label-trigger.yml` | GitHub PAT used to dispatch other workflows via `repository_dispatch`. Scope: `workflow`. |
| `GATEWAY_CLIENT_ID` | `jira-poll.yml` | OAuth2 client ID for the Gravitee API Gateway used to authenticate Jira API calls. |
| `GATEWAY_CLIENT_SECRET` | `jira-poll.yml` | OAuth2 client secret for the Gravitee API Gateway. |
| `JIRA_DONE_WEBHOOK` | `close-on-merge.yml` | Jira automation incoming webhook URL. Used to close Jira tickets when a PR is merged. Only needed if close-on-merge is enabled. |
| `GITHUB_TOKEN` | All workflows | Auto-provided by GitHub Actions. No action required. |

> **Note on PAT naming:** In the current repository, `COPILOT_PAT_ARNE` references a specific team member's account. When transferring to a new organisation, rename this secret to something organisation-neutral (e.g. `COPILOT_PAT_MODELS`) and update the reference in the workflow YAML files accordingly.

---

## 6. GitHub Variables Reference

Go to **Settings → Secrets and variables → Actions → Variables**.

| Variable | Required for | Example | Description |
|----------|-------------|---------|-------------|
| `CLAUDE_MODEL` | `ai-pdf-to-fa.yml`, `ai-fa-to-ta.yml`, `feature-validation.yml` | `claude-sonnet-4-5` | Model name passed to the GitHub Models API. Set to the latest available Claude Sonnet. |
| `JIRA_DOMAIN` | `jira-poll.yml`, `jira-label-trigger.yml`, `close-on-merge.yml` | `mycompany.atlassian.net` | Your Jira Cloud domain without `https://`. |
| `JIRA_PROJECT_KEY` | `jira-poll.yml` | `JIRAFIX` | The Jira project key to fetch issues from. |
| `JIRA_JQL_FILTER` | `jira-poll.yml` | `project=JIRAFIX AND labels=needs-code-change` | Default JQL query used when no custom filter is provided on manual trigger. |
| `SDLC_INTERNSHIP_TOKEN_ENDPOINT` | `jira-poll.yml` | `https://gateway.example.com/oauth/token` | OAuth2 token endpoint URL on the Gravitee API Gateway. |
| `SDLC_INTERNSHIP_JIRA_SEARCH_ENDPOINT` | `jira-poll.yml` | `https://gateway.example.com/jira/api/2/search` | Jira issue search endpoint via the gateway. |
| `SDLC_INTERNSHIP_JIRA_BASE_ENDPOINT` | `jira-poll.yml` | `https://gateway.example.com/jira/api/2` | Jira base API endpoint via the gateway (used for transitions). |

---

## 7. GitHub PAT Requirements

A Personal Access Token (PAT) is linked to a specific GitHub account. The account must have the correct licences and permissions.

### `COPILOT_PAT` — Enterprise AI fix

| Property | Value |
|----------|-------|
| Account requirement | Active **GitHub Copilot Business** or **Copilot Enterprise** licence |
| Token type | Classic PAT |
| Scopes | `repo`, `workflow`, `models:read` |
| Used by | `ai-fix-from-issue-enterprise.yml` |

How to create:
1. Log in as the account with the Copilot licence
2. Go to **Settings → Developer settings → Personal access tokens → Tokens (classic)**
3. Click **Generate new token (classic)**
4. Select scopes: `repo`, `workflow`
5. Copy the token and save it as the `COPILOT_PAT` secret

### `REPO_PAT` — Workflow dispatch

| Property | Value |
|----------|-------|
| Account requirement | Write access to the repository |
| Token type | Classic PAT or Fine-grained PAT |
| Scopes | `workflow` (classic) or `Actions: write` (fine-grained) |
| Used by | `jira-label-trigger.yml` |

This PAT is needed because `GITHUB_TOKEN` cannot dispatch `workflow_dispatch` events. It calls the GitHub API to start the AI fix workflow after a GitHub issue is created.

### `COPILOT_PAT_ARNE` — Document generation and enterprise validation

| Property | Value |
|----------|-------|
| Account requirement | Active Copilot licence with access to GitHub Models API |
| Token type | Classic PAT |
| Scopes | `repo`, `models:read` |
| Used by | `ai-pdf-to-fa.yml`, `feature-validation-enterprise.yml` |

This token authenticates API calls to `models.inference.ai.azure.com` (the GitHub Models endpoint). A paid Copilot plan provides a higher token quota than the free tier.

### `COPILOT_PAT_TEST` — Standard AI fix

| Property | Value |
|----------|-------|
| Account requirement | Any GitHub Copilot licence (free tier is sufficient) |
| Token type | Classic PAT |
| Scopes | `repo`, `workflow` |
| Used by | `ai-fix-from-issue.yml` |

---

## 8. Jira Automation Setup

This is required for Feature 1 (Jira Autofix) when using the webhook trigger instead of the manual poll.

### Create a Jira Automation Rule

1. Go to your Jira project → **Project Settings → Automation → Create rule**
2. Set the trigger: **Field value changed** → Field: **Labels**
3. Add a condition: Label **contains** `ai-fix`
4. Add an action: **Send web request**

### Web request configuration

```
URL:     https://api.github.com/repos/<owner>/<repo>/dispatches
Method:  POST
Headers:
  Authorization: Bearer <REPO_PAT>
  Accept: application/vnd.github+json
  Content-Type: application/json

Body (raw JSON):
{
  "event_type": "jira-ai-fix",
  "client_payload": {
    "issue_key": "{{issue.key}}",
    "summary": "{{issue.summary}}",
    "description": "{{issue.description}}",
    "priority": "{{issue.priority.name}}",
    "issue_type": "{{issue.issueType.name}}",
    "status": "{{issue.status.name}}"
  }
}
```

Replace `<owner>`, `<repo>`, and `<REPO_PAT>` with your values.

The `REPO_PAT` used here is the same token saved as the `REPO_PAT` GitHub secret. It must have the `workflow` scope to trigger `repository_dispatch` events.

### To enable automatic Jira ticket closing on merge

Create a second Jira Automation Rule:
1. Trigger: **Incoming webhook**
2. Copy the generated webhook URL
3. Save it as the `JIRA_DONE_WEBHOOK` secret in GitHub
4. Enable `close-on-merge.yml` by removing `if: false` from the job

---

## Quick-start checklist

Use this checklist when setting up in a new repository:

- [ ] Copy all required workflow files to `.github/workflows/`
- [ ] Copy Python agent files to `ai/agent/langgraph/` (Document Generation only)
- [ ] Set Actions permissions: Read/write + Allow PR creation
- [ ] Create labels: `ai-fix`, `from-jira`
- [ ] Add secret `COPILOT_PAT` (account with Copilot Business licence)
- [ ] Add secret `REPO_PAT` (account with `workflow` scope)
- [ ] Add secret `COPILOT_PAT_ARNE` / rename to your own PAT (document generation + enterprise validation)
- [ ] Add variable `JIRA_DOMAIN` (e.g. `mycompany.atlassian.net`)
- [ ] Add variable `CLAUDE_MODEL` (e.g. `claude-sonnet-4-5`)
- [ ] Add variable `JIRA_PROJECT_KEY` (e.g. `PROJ`)
- [ ] Add variable `JIRA_JQL_FILTER` (for Jira Poll)
- [ ] Add gateway variables (`SDLC_INTERNSHIP_*`) (Jira Poll only, if using gateway)
- [ ] Add secret `GATEWAY_CLIENT_ID` + `GATEWAY_CLIENT_SECRET` (Jira Poll only)
- [ ] Create Jira Automation Rule (webhook trigger, see Section 8)
- [ ] Add secret `JIRA_DONE_WEBHOOK` + enable `close-on-merge.yml` (optional)
- [ ] Test: add `ai-fix` label to a GitHub issue and verify the workflow starts
- [ ] Test: post `/pdf-to-fa test-feature-001` with a PDF on any PR
- [ ] Test: post `/validate-feature-001` with FA and TA attachments on any PR
