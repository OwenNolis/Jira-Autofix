# Jira-Autofix Documentation

## Overview

This repository provides a suite of GitHub Actions workflows that automate the software development lifecycle (SDLC) by connecting Jira, GitHub, and AI models. The system can automatically pick up Jira issues, generate AI-powered code fixes, create pull requests, and close tickets — all without leaving GitHub.

There are two distinct pipeline tracks:

- **Jira → AI Fix pipeline** — Ingests Jira issues and automatically generates code changes
- **Document generation pipeline** — Converts PDFs to Functional Analyses, then to Technical Analyses, then to PDFs again, with optional feature validation at any point

These two tracks are independent of each other and can be used separately.

---

## Table of Contents

1. [Jira → AI Fix Pipeline](#1-jira--ai-fix-pipeline)
   - [Jira Poll](#11-jira-poll)
   - [Jira Label Trigger](#12-jira-label-trigger)
   - [AI Fix from Issue](#13-ai-fix-from-issue)
   - [AI Fix from Issue (Enterprise)](#14-ai-fix-from-issue-enterprise)
   - [Build on Demand](#15-build-on-demand)
   - [Close Jira Issue on Merge](#16-close-jira-issue-on-merge)
2. [Document Generation Pipeline](#2-document-generation-pipeline)
   - [PDF to FA](#21-pdf-to-fa)
   - [FA to TA](#22-fa-to-ta)
   - [TA to PDF](#23-ta-to-pdf)
3. [Feature Validation](#3-feature-validation)
   - [Feature Validation (Copilot)](#31-feature-validation-copilot)
   - [Feature Validation (Enterprise)](#32-feature-validation-enterprise)
4. [Required Secrets and Variables](#4-required-secrets-and-variables)

---

## 1. Jira → AI Fix Pipeline

This is the main automation pipeline. It starts at Jira and ends with a merged PR that automatically closes both the GitHub issue and the Jira ticket.

```
Jira Issue
    │
    ├─ (label trigger) ──→ Jira Label Trigger ──→ AI Fix from Issue ──→ PR ──→ Close Jira
    │
    └─ (manual poll)   ──→ Jira Poll ──────────→ AI Fix from Issue ──→ PR ──→ Close Jira
```

---

### 1.1 Jira Poll

**File:** `.github/workflows/jira-poll.yml`
**Trigger:** Manual (`workflow_dispatch`) with optional custom JQL filter

Fetches Jira issues matching a JQL filter (e.g. issues with label `needs-code-change`) via an API gateway, creates corresponding GitHub issues, transitions the Jira issues to "In Progress", and dispatches the AI Fix workflow for each one.

**How it works:**
1. Authenticates with the Jira API gateway using OAuth2 client credentials
2. Fetches up to 25 Jira issues matching the configured JQL filter
3. For each issue, checks if a GitHub issue already exists (skips duplicates)
4. Creates a GitHub issue with the Jira details, labels it `from-jira` and `jira:<KEY>`
5. Transitions the Jira issue to "In Progress"
6. Dispatches `ai-fix-from-issue.yml` for the newly created GitHub issue

**How to use:**
Go to **Actions → Jira → GitHub Issues → Run workflow**. Optionally provide a custom JQL filter, or leave blank to use the configured default (`JIRA_JQL_FILTER` variable).

**Required variables:** `JIRA_DOMAIN`, `JIRA_PROJECT_KEY`, `JIRA_JQL_FILTER`, `SDLC_INTERNSHIP_TOKEN_ENDPOINT`, `SDLC_INTERNSHIP_JIRA_SEARCH_ENDPOINT`, `SDLC_INTERNSHIP_JIRA_BASE_ENDPOINT`
**Required secrets:** `GATEWAY_CLIENT_ID`, `GATEWAY_CLIENT_SECRET`, `GITHUB_TOKEN`

---

### 1.2 Jira Label Trigger

**File:** `.github/workflows/jira-label-trigger.yml`
**Trigger:** `repository_dispatch` event of type `jira-ai-fix` (sent by a Jira automation webhook)

An alternative entry point to the pipeline. Instead of polling, Jira pushes a webhook when an issue gets the `ai-fix` label. The workflow creates a GitHub issue and immediately dispatches the AI fix.

**How it works:**
1. Receives a webhook payload from Jira containing the issue key, summary, description, priority, type, and status
2. Validates the issue key format
3. Checks for an existing GitHub issue with that Jira key (skips duplicates)
4. Creates a GitHub issue labelled `from-jira`, `ai-fix`, and `jira:<KEY>`
5. Dispatches `ai-fix-from-issue.yml` for the new issue

**How to use:**
Configure a Jira automation rule: when a label `ai-fix` is added, send a webhook to `https://api.github.com/repos/<owner>/<repo>/dispatches` with event type `jira-ai-fix` and the issue fields in the payload. Requires `REPO_PAT` secret with `workflow` scope.

---

### 1.3 AI Fix from Issue

**File:** `.github/workflows/ai-fix-from-issue.yml`
**Trigger:** Issue opened, `ai-fix` label added, `/fix-ai` comment on an issue, or `workflow_dispatch`

The core AI automation. Given a GitHub issue, it reads the issue description, sends the full codebase to the Copilot CLI (using `gpt-4.1`), applies the AI-generated file changes, verifies the build compiles, and opens a PR.

**How it works:**
1. Fetches the issue title and body
2. Builds a prompt containing the issue description, a file tree, and the contents of up to 30 source files + all `package.json` files
3. Runs the Copilot CLI and parses the JSON response containing file paths and new file contents
4. Writes the AI-generated files to the repository
5. Runs `npm install` and `npm run build` to verify the changes compile
6. If the build passes: creates a branch `feature/<JIRA_KEY>`, commits, pushes, and opens a PR
7. If the build fails: posts a comment on the issue explaining the error
8. Comments on the issue with the PR link once created

**Commands:**
| Trigger | Description |
|---------|-------------|
| Label issue with `ai-fix` | Automatically starts the fix |
| Comment `/fix-ai` on an issue | Manually triggers the fix |
| `workflow_dispatch` with issue number | Run directly from GitHub Actions UI |

**Required secrets:** `COPILOT_PAT_TEST`, `GITHUB_TOKEN`

---

### 1.4 AI Fix from Issue (Enterprise)

**File:** `.github/workflows/ai-fix-from-issue-enterprise.yml`
**Trigger:** `ai-fix` label added, `/fix-ai` comment on an issue, or `workflow_dispatch`

The enterprise version of the AI fix workflow. Uses the Copilot CLI with the `claude-sonnet-4-6` model and includes more robust JSON extraction from the AI output. Designed for repos with GitHub Copilot Enterprise access.

**Differences from standard version:**
- Uses `claude-sonnet-4-6` model via Copilot CLI
- More robust output parsing (awk/sed-based JSON extraction with fallback)
- Derives the commit scope automatically from the changed file paths
- Uses `COPILOT_PAT` secret instead of `COPILOT_PAT_TEST`

**Commands:**
| Trigger | Description |
|---------|-------------|
| Label issue with `ai-fix` | Automatically starts the fix |
| Comment `/fix-ai` on an issue | Manually triggers the fix |
| `workflow_dispatch` with issue number | Run directly from GitHub Actions UI |

**Required secrets:** `COPILOT_PAT`, `GITHUB_TOKEN`

---

### 1.5 Build on Demand

**File:** `.github/workflows/build-on-demand.yml`
**Trigger:** `/build` comment on a PR

Lets you manually re-run the build check on any PR by posting a comment. Useful for verifying that AI-generated changes still compile after manual edits.

**How it works:**
1. Checks out the PR branch
2. Finds the directory containing `package.json`
3. Runs `npm install` and `npm run build`
4. Posts the result (success, failure, or no `package.json` found) as a comment on the PR

**Command:**
```
/build
```
Post this as a comment on any PR to trigger a fresh build check.

---

### 1.6 Close Jira Issue on Merge

**File:** `.github/workflows/close-on-merge.yml`
**Trigger:** PR closed (merged)
**Status:** Currently disabled (`if: false`)

When a PR is merged, extracts the Jira key from the PR body (embedded as `<!-- jira-key: KEY -->`) and calls a Jira automation webhook to close the corresponding Jira issue. The linked GitHub issue is closed automatically by GitHub via the `Fixes #N` reference in the commit.

**How to enable:**
Remove the `if: false` condition from the job and add the `JIRA_DONE_WEBHOOK` secret pointing to your Jira automation incoming webhook URL.

**Required secrets:** `JIRA_DONE_WEBHOOK`, `GITHUB_TOKEN`
**Required variables:** `JIRA_DOMAIN`

---

## 2. Document Generation Pipeline

This is an independent pipeline for generating structured analysis documents from a PDF specification. Each step feeds into the next, but any step can also be run in isolation by re-attaching a file.

```
PDF (design/spec document)
    │
    └──→  /pdf-to-fa  ──→  FA (.md)
                                │
                                └──→  /fa-to-ta  ──→  TA (.md)
                                                           │
                                                           └──→  /ta-to-pdf  ──→  PDF
```

All three commands are triggered by PR comments. The workflow reacts with 👍, processes the file, and posts the result back as a PR comment. The full output (including embedded images) is always uploaded as a GitHub Actions artifact.

---

### 2.1 PDF to FA

**File:** `.github/workflows/ai-pdf-to-fa.yml`
**Trigger:** PR comment starting with `/pdf-to-fa`

Converts a PDF design or specification document into a structured Functional Analysis (FA) markdown document in Dutch. Runs the `pdf_to_fa.py` agent via GitHub Models.

**How to use:**
1. Open a PR comment
2. Type the command followed by the feature ID
3. Drag and drop the PDF file into the same comment
4. Submit — GitHub automatically converts the file to a link

```
/pdf-to-fa feature-012-my-feature
[document.pdf](https://github.com/user-attachments/assets/...)
```

**Output:**
- FA posted as a PR comment (base64 images replaced with `[image - see artifact]`)
- Full `.md` file with embedded images uploaded as a GitHub Actions artifact
- Artifact is retained for 30 days

**Next step:** Download the artifact `.md` file and use `/fa-to-ta` to generate a Technical Analysis.

**Required secrets:** `COPILOT_PAT_ARNE`, `GITHUB_TOKEN`
**Required variables:** `CLAUDE_MODEL`

---

### 2.2 FA to TA

**File:** `.github/workflows/ai-fa-to-ta.yml`
**Trigger:** PR comment starting with `/fa-to-ta`

Converts a Functional Analysis markdown file into a Technical Analysis (TA) markdown document. Runs the `fa_to_ta.py` agent using Claude Sonnet via GitHub Models.

**How to use:**
1. Download the FA `.md` file from the artifact of the previous step (or use your own FA)
2. Open a PR comment
3. Type the command followed by the feature ID
4. Drag and drop the FA `.md` file into the same comment
5. Submit

```
/fa-to-ta feature-012-my-feature
[feature-012-my-feature.md](https://github.com/user-attachments/assets/...)
```

**Output:**
- TA posted as a PR comment (base64 images replaced with `[image - see artifact]`)
- Full `.md` file uploaded as a GitHub Actions artifact
- Artifact retained for 30 days

**Next step:** Download the artifact `.md` file and use `/ta-to-pdf` to render a final PDF, or `/validate-feature-<id>` to validate the implementation.

**Required secrets:** `GITHUB_TOKEN`
**Required variables:** `CLAUDE_MODEL`

---

### 2.3 TA to PDF

**File:** `.github/workflows/ai-ta-to-pdf.yml`
**Trigger:** PR comment starting with `/ta-to-pdf`

Converts a Technical Analysis markdown file into a formatted PDF using Chrome headless rendering via `ta_to_pdf.py`.

**How to use:**
1. Download the TA `.md` file from the artifact of the previous step (or use your own TA)
2. Open a PR comment
3. Type the command followed by the feature ID
4. Drag and drop the TA `.md` file into the same comment
5. Submit

```
/ta-to-pdf feature-012-my-feature
[feature-012-my-feature.md](https://github.com/user-attachments/assets/...)
```

**Output:**
- PR comment with a link to the Actions run to download the PDF artifact
- PDF uploaded as a GitHub Actions artifact
- Artifact retained for 30 days

**Required secrets:** `GITHUB_TOKEN`

---

## 3. Feature Validation

Feature validation checks whether the code in a PR (or the full codebase) correctly implements the requirements described in a Functional Analysis and Technical Analysis. It is a standalone feature — it does not depend on either of the other pipelines, but it works best after the document generation pipeline has produced FA and TA files.

There are two versions: a standard version using GitHub Models directly, and an enterprise version for repos with access to a paid Copilot account.

---

### 3.1 Feature Validation (Copilot)

**File:** `.github/workflows/feature-validation.yml`
**Trigger:** PR comment starting with `/validate-feature-`

Validates the PR against FA and TA documents stored in `docs/functional-analysis/` and `docs/technical-analysis/`, or attached directly to the comment. Uses Claude Sonnet via the GitHub Models API.

**How to use:**

```
/validate-feature-012
```
Validates changed files only against FA and TA from the `docs/` folder.

```
/validate-feature-012 --full
```
Validates the full codebase.

```
/validate-feature-012
[fa.md](https://github.com/user-attachments/assets/...)
[ta.md](https://github.com/user-attachments/assets/...)
```
Attach FA and TA files directly instead of using the `docs/` folder. FA must be the first attachment, TA the second.

**Output:** A structured markdown validation report posted as a PR comment with sections for Requirements, Business Rules, Acceptance Criteria, NFRs, API Contracts, Domain Model, Backend Design, Frontend Design, a summary table, and a PASS / PARTIAL / FAIL verdict.

**Required secrets:** `GITHUB_TOKEN`
**Required variables:** `CLAUDE_MODEL`

---

### 3.2 Feature Validation (Enterprise)

**File:** `.github/workflows/feature-validation-enterprise.yml`
**Trigger:** PR comment starting with `/validate-feature-`

The enterprise version of feature validation. Uses the GitHub Models API with `gpt-4o` authenticated via a paid Copilot PAT (`COPILOT_PAT_ARNE`) to allow access beyond the free-tier 8000-token limit.

**Modes:**

| Command | Mode | Code context sent |
|---------|------|-------------------|
| `/validate-feature-011-preworkout-website` | Changed files | Full contents of changed PR files (capped at 12KB) |
| `/validate-feature-011-preworkout-website --full` | Full codebase | Repository file tree (`git ls-files`) — model infers coverage from file names |

**Note on `--full` mode:** Due to the 8000-token input limit on GitHub Models, file contents cannot be sent for a full codebase scan. Instead, a filtered file tree is sent and the model infers what is implemented from file and folder names (e.g. `CartContext.tsx` implies cart state management exists). For deep code analysis, use `--changed` mode on a feature PR.

**How to use:**

```
/validate-feature-011-preworkout-website --full
[fa.md](https://github.com/user-attachments/assets/...)
[ta.md](https://github.com/user-attachments/assets/...)
```

Attach FA first, TA second. Or omit attachments to use the files from `docs/functional-analysis/` and `docs/technical-analysis/`.

**Output:** Same structured validation report as the standard version.

**Required secrets:** `COPILOT_PAT_ARNE`, `GITHUB_TOKEN`

---

## 4. Required Secrets and Variables

### Secrets

| Secret | Used by | Description |
|--------|---------|-------------|
| `GITHUB_TOKEN` | All workflows | Auto-provided by GitHub Actions |
| `COPILOT_PAT` | ai-fix-enterprise | GitHub PAT with Copilot access for the enterprise fix workflow |
| `COPILOT_PAT_ARNE` | ai-pdf-to-fa, feature-validation-enterprise | Paid Copilot PAT for higher-tier model access |
| `COPILOT_PAT_TEST` | ai-fix-from-issue | GitHub PAT with Copilot access for the standard fix workflow |
| `REPO_PAT` | jira-label-trigger | PAT with `workflow` scope to dispatch other workflows |
| `GATEWAY_CLIENT_ID` | jira-poll | OAuth2 client ID for the Jira API gateway |
| `GATEWAY_CLIENT_SECRET` | jira-poll | OAuth2 client secret for the Jira API gateway |
| `JIRA_DONE_WEBHOOK` | close-on-merge | Jira automation incoming webhook URL to close issues |

### Repository Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `CLAUDE_MODEL` | ai-pdf-to-fa, ai-fa-to-ta, feature-validation | Model name override (e.g. `claude-sonnet-4-5`) |
| `JIRA_DOMAIN` | jira-poll, jira-label-trigger, close-on-merge | Your Jira domain (e.g. `mycompany.atlassian.net`) |
| `JIRA_PROJECT_KEY` | jira-poll | Jira project key (e.g. `JIRAFIX`) |
| `JIRA_JQL_FILTER` | jira-poll | Default JQL query for fetching issues |
| `SDLC_INTERNSHIP_TOKEN_ENDPOINT` | jira-poll | OAuth2 token endpoint URL for the Jira gateway |
| `SDLC_INTERNSHIP_JIRA_SEARCH_ENDPOINT` | jira-poll | Jira search endpoint URL via gateway |
| `SDLC_INTERNSHIP_JIRA_BASE_ENDPOINT` | jira-poll | Jira base endpoint URL via gateway |
| `JIRA_DONE_WEBHOOK` | close-on-merge | Can also be set as a variable instead of secret |
