# Jira-Autofix
Automated pipeline that syncs Jira issues to GitHub, uses Gemini AI to generate code fixes, opens a pull request with the solution, and closes both the GitHub issue and the original Jira ticket on merge.

---

## How it works

```
Jira Issue (label: needs-code-change)
        │
        ▼  every 10 minutes
[jira-poll.yml]
  Polls Jira via REST API → creates a GitHub Issue with the Jira key embedded
        │
        ▼  label "ai-fix" added  OR  comment "!fix"
[ai-fix-from-issue.yml]
  Reads the issue → builds repo context → calls Gemini AI → applies code changes
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

### 2. Variables

In the same page under **Variables**:

| Variable | Example |
|----------|---------|
| `JIRA_DOMAIN` | `yourorg.atlassian.net` |
| `JIRA_PROJECT_KEY` | `PROJ` |
| `JIRA_JQL_FILTER` | `project=PROJ AND status != Done AND labels = needs-code-change ORDER BY created DESC` |
| `GEMINI_MODEL` | `gemini-2.5-flash` |

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
