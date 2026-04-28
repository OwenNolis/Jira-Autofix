# Webhook-Based Jira AI Fix Pipeline — Setup Guide

This is the current implementation. It uses a **push-based** approach: Jira pushes data to GitHub via an automation webhook when the `ai-fix` label is added. No Jira polling or Jira API credentials are needed on the GitHub side for the trigger.

---

## How It Works — Full Flow

```
1. Developer adds "ai-fix" label to a Jira issue
        ↓
2. Jira Automation Rule fires:
   • POSTs issue data to GitHub repository_dispatch API
   • Transitions Jira issue → "In Progress"
        ↓
3. jira-label-trigger.yml (GitHub Actions):
   • Creates a GitHub issue with Jira metadata
   • Dispatches ai-fix-from-issue.yml
        ↓
4. ai-fix-from-issue.yml (GitHub Actions):
   • Reads the GitHub issue title and body
   • Sends all source files + package.json to GitHub Copilot CLI
   • Copilot generates code changes (JSON format)
   • Changes are applied to the repository files
   • npm run build is run to verify the fix compiles
   • A PR is created: "Refs#JIRAFIX-XX - Title (Closes #N)"
   • A comment is posted on the GitHub issue with the PR link
        ↓
5. Developer reviews and merges the PR
        ↓
6. close-on-merge.yml (GitHub Actions):  ← requires gateway OAuth credentials
   • Extracts the Jira key from the PR body
   • Gets OAuth token from Gravitee gateway
   • Calls Jira transitions API to set issue → "Closed"
   • Posts a confirmation comment on the PR
```

---

## Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Description | Required for |
|--------|-------------|--------------|
| `COPILOT_PAT` | GitHub Personal Access Token with Copilot access | AI fix step |
| `GATEWAY_CLIENT_ID` | Gravitee gateway OAuth client ID | Closing Jira issue on merge |
| `GATEWAY_CLIENT_SECRET` | Gravitee gateway OAuth client secret | Closing Jira issue on merge |

> `GITHUB_TOKEN` is provided automatically by GitHub Actions — no setup needed.

---

## Required GitHub Variables

Go to **Settings → Secrets and variables → Actions → Variables**:

| Variable | Description | Required for |
|----------|-------------|--------------|
| `JIRA_DOMAIN` | Your Jira domain, e.g. `mycompany.atlassian.net` | PR/issue links |
| `SDLC_INTERNSHIP_TOKEN_ENDPOINT` | OAuth token endpoint URL on the Gravitee gateway | Closing Jira issue on merge |
| `SDLC_INTERNSHIP_JIRA_BASE_ENDPOINT` | Jira base REST API URL via gateway, e.g. `https://gateway.example.com/jira/rest/api/2` | Closing Jira issue on merge |

> The trigger and AI fix steps work **without** the gateway variables. Only the close-on-merge step needs them.

---

## Jira Automation Rule Setup

This is configured entirely inside Jira. No Jira API credentials are needed on the GitHub side.

### Rule 1 — "Jira AI Fix Rule" (Trigger + In Progress)

**Purpose:** When the `ai-fix` label is added, notify GitHub and set the issue to In Progress.

1. Go to your Jira project → **Project settings → Automation → Create rule**
2. **Trigger:** `When: Field value changes` → select field **Labels**
3. **Condition:** `If: Labels contains` → value: `ai-fix`
4. **Action 1:** `Then: Send web request`
   - **URL:** `https://api.github.com/repos/{your-org}/{your-repo}/dispatches`
   - **Method:** `POST`
   - **Headers:**
     ```
     Content-Type: application/json
     Accept: application/vnd.github+json
     Authorization: Bearer YOUR_GITHUB_PAT
     ```
   - **Body:**
     ```json
     {
       "event_type": "jira-ai-fix",
       "client_payload": {
         "issue_key": "{{issue.key}}",
         "summary": "{{issue.summary}}",
         "description": "{{issue.description.or(\"No description provided.\")}}",
         "priority": "{{issue.priority.name}}",
         "issue_type": "{{issue.issueType.name}}",
         "status": "{{issue.status.name}}"
       }
     }
     ```
     > **Important:** If the issue summary contains double quotes or special characters, the JSON will break. Keep summaries free of quotes, or simplify the body to just `"issue_key": "{{issue.key}}"` and remove the other fields (the GitHub issue will then just link to Jira for context).
5. **Action 2:** `And: Transition the work item to` → **In Progress**
6. **Save and enable the rule**

**GitHub PAT requirements for the Authorization header:**
- Go to **GitHub → Settings → Developer settings → Personal access tokens**
- Create a token with scopes: `repo` (full) — this allows triggering `repository_dispatch`

---

### Rule 2 — "Jira AI Fix Close Rule" (Close on merge) — Optional without gateway credentials

**Purpose:** Close the Jira issue when called by the `close-on-merge.yml` workflow.

> **Note:** This rule is only needed if you are NOT using the gateway OAuth approach in `close-on-merge.yml`. With gateway credentials, the workflow calls the Jira API directly and this rule is not needed. See the [close-on-merge setup guide](./close-on-merge-setup.md) for the full OAuth implementation.

---

## Workflow Files

### 1. `.github/workflows/jira-label-trigger.yml`

Receives the Jira webhook, creates a GitHub issue, and dispatches the AI fix.

```yaml
# Triggered by a Jira automation webhook (via Gravitee gateway) when an
# issue gets the "ai-fix" label. Creates a GitHub issue and dispatches
# the AI fix workflow — no Jira polling or API credentials needed.

name: Jira Label Trigger

on:
  repository_dispatch:
    types: [jira-ai-fix]

jobs:
  handle:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      contents: read
      actions: write

    steps:
      - name: Check dependencies
        run: |
          if ! command -v jq &>/dev/null; then
            echo "jq not found, installing..."
            sudo apt-get install -y -qq jq
          fi
          jq --version

      - name: Create GitHub issue from Jira payload
        id: create_issue
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          JIRA_DOMAIN:  ${{ vars.JIRA_DOMAIN }}
          ISSUE_KEY:    ${{ github.event.client_payload.issue_key }}
          SUMMARY:      ${{ github.event.client_payload.summary }}
          DESCRIPTION:  ${{ github.event.client_payload.description }}
          PRIORITY:     ${{ github.event.client_payload.priority }}
          ISSUE_TYPE:   ${{ github.event.client_payload.issue_type }}
          STATUS:       ${{ github.event.client_payload.status }}
        run: |
          echo "Received Jira issue: $ISSUE_KEY — $SUMMARY"

          # Skip if a GitHub issue already exists for this Jira key
          EXISTING=$(curl -s \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/${{ github.repository }}/issues?labels=jira:${ISSUE_KEY}&state=all" \
            | jq 'length')

          if [ "$EXISTING" -gt 0 ]; then
            echo "⏭️  GitHub issue already exists for $ISSUE_KEY — skipping"
            echo "gh_number=" >> $GITHUB_OUTPUT
            exit 0
          fi

          # Ensure the per-issue label exists
          curl -s -X POST \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/${{ github.repository }}/labels" \
            -d "{\"name\":\"jira:${ISSUE_KEY}\",\"color\":\"0052CC\",\"description\":\"Linked to Jira ${ISSUE_KEY}\"}" \
            > /dev/null 2>&1 || true

          export ISSUE_URL="https://${JIRA_DOMAIN}/browse/${ISSUE_KEY}"

          export BODY=$(python3 -c "
          import os
          key      = os.environ['ISSUE_KEY']
          url      = os.environ.get('ISSUE_URL', '')
          itype    = os.environ.get('ISSUE_TYPE', 'Task')
          priority = os.environ.get('PRIORITY', 'Medium')
          status   = os.environ.get('STATUS', 'To Do')
          desc     = os.environ.get('DESCRIPTION', 'No description provided.')
          print(
              '<!-- jira-key: ' + key + ' -->\n'
              '## Jira: [' + key + '](' + url + ')\n\n'
              '| Field | Value |\n'
              '|-------|-------|\n'
              '| **Type** | ' + itype + ' |\n'
              '| **Priority** | ' + priority + ' |\n'
              '| **Status** | ' + status + ' |\n\n'
              '## Description\n\n' + desc + '\n\n'
              '---\n'
              '*Auto-created from Jira ai-fix label. The AI fix workflow has been triggered automatically.*'
          )
          ")

          PAYLOAD=$(python3 -c "
          import json, os
          print(json.dumps({
              'title': '[' + os.environ['ISSUE_KEY'] + '] ' + os.environ['SUMMARY'],
              'body': os.environ['BODY'],
              'labels': ['jira:' + os.environ['ISSUE_KEY'], 'from-jira', 'ai-fix']
          }))")

          RESPONSE=$(echo "$PAYLOAD" | curl -s -X POST \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/${{ github.repository }}/issues" \
            -d @-)

          GH_NUMBER=$(echo "$RESPONSE" | jq -r '.number // empty')
          GH_URL=$(echo "$RESPONSE"    | jq -r '.html_url // empty')

          if [ -n "$GH_NUMBER" ]; then
            echo "✅ Created GitHub issue #${GH_NUMBER}: ${GH_URL}"
            echo "gh_number=$GH_NUMBER" >> $GITHUB_OUTPUT
          else
            echo "❌ Failed to create GitHub issue"
            echo "$RESPONSE" | head -c 400
            exit 1
          fi

      - name: Dispatch AI fix workflow
        if: steps.create_issue.outputs.gh_number != ''
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          curl -s -X POST \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/${{ github.repository }}/actions/workflows/ai-fix-from-issue.yml/dispatches" \
            -d "{\"ref\": \"main\", \"inputs\": {\"issue_number\": \"${{ steps.create_issue.outputs.gh_number }}\"}}"
          echo "🤖 AI fix dispatched for issue #${{ steps.create_issue.outputs.gh_number }}"
```

---

### 2. `.github/workflows/ai-fix-from-issue.yml`

Reads the GitHub issue, runs Copilot, applies changes, verifies the build, and creates a PR.

> The full file is already in `.github/workflows/ai-fix-from-issue.yml`. Key behaviour:
> - Triggered by `workflow_dispatch` with `issue_number` input (called by `jira-label-trigger.yml`)
> - Also triggers on `issues: [opened, labeled]` and `issue_comment` starting with `!fix`
> - Sends all `.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.scss` files + all `package.json` files to Copilot
> - Copilot must respond with JSON: `{"files": [{"path": "...", "content": "..."}]}`
> - Runs `npm run build` — if it fails, posts a build error comment and does NOT create a PR
> - PR title format: `Refs#JIRAFIX-XX - Issue Title (Closes #N)`
> - PR body contains `<!-- jira-key: JIRAFIX-XX -->` so `close-on-merge.yml` can find it

**Required secret for this workflow:**

| Secret | Description |
|--------|-------------|
| `COPILOT_PAT` | GitHub PAT with Copilot access. Create at GitHub → Settings → Developer settings → Personal access tokens. Required scopes: `repo`, `copilot` |

---

### 3. `.github/workflows/close-on-merge.yml`

When a PR is merged, transitions the linked Jira issue to Closed.

> **Requires gateway OAuth credentials.** See [close-on-merge-setup.md](./close-on-merge-setup.md) for full implementation details and the complete workflow file.

Current state of this workflow uses the Jira automation incoming webhook approach, which does not work with `api-private.atlassian.com` without OAuth. Replace it with the OAuth implementation from `close-on-merge-setup.md` once credentials are available.

---

## Step-by-Step Usage Guide

### First-time setup

1. **Add secrets** to your GitHub repo (Settings → Secrets and variables → Actions → Secrets):
   - `COPILOT_PAT` — GitHub PAT for Copilot CLI
   - `GATEWAY_CLIENT_ID` — for closing Jira on merge
   - `GATEWAY_CLIENT_SECRET` — for closing Jira on merge

2. **Add variables** (Settings → Secrets and variables → Actions → Variables):
   - `JIRA_DOMAIN` — e.g. `mycompany.atlassian.net`
   - `SDLC_INTERNSHIP_TOKEN_ENDPOINT` — OAuth token URL
   - `SDLC_INTERNSHIP_JIRA_BASE_ENDPOINT` — Jira REST API URL via gateway

3. **Copy the 3 workflow files** into `.github/workflows/`:
   - `jira-label-trigger.yml`
   - `ai-fix-from-issue.yml`
   - `close-on-merge.yml`

4. **Create the Jira automation rules** as described above (Rule 1 is required; Rule 2 is optional)

5. **Create a GitHub PAT** with `repo` scope and add it to the Jira automation rule's Authorization header

---

### Using the pipeline day-to-day

**Step 1 — Create a Jira issue**

Create a Jira issue in your project with a clear title and description. The description becomes the AI's context, so the more detail the better.

Example:
```
Title: Add a settings page to the navigation bar
Description:
  The app currently has no settings page. Add a new /settings route
  and a Settings link in the navigation bar. The page should be
  accessible only when logged in, matching the pattern of other pages.
```

**Step 2 — Add the `ai-fix` label**

In Jira, add the label `ai-fix` to the issue. This triggers the automation rule.

What happens automatically:
- Jira transitions the issue to **In Progress**
- Jira POSTs the issue data to your GitHub repo
- A GitHub issue is created with the Jira metadata and a link back to Jira
- The AI fix workflow is dispatched immediately

**Step 3 — Monitor the AI fix**

Go to your GitHub repo → **Actions** tab. You will see:
1. `Jira Label Trigger` — creates the GitHub issue (completes in ~10s)
2. `AI Fix from GitHub Issue` — runs Copilot and creates the PR (takes 2–15 minutes)

If the build fails, a comment is posted on the GitHub issue with the error. You can then add more detail to the Jira issue and remove/re-add the `ai-fix` label to retry.

**Step 4 — Review the PR**

A PR is created titled `Refs#JIRAFIX-XX - Issue Title (Closes #N)`. Review the AI-generated changes:
- Check that the code is correct and follows your conventions
- Run the app locally if needed
- Request changes or approve

**Step 5 — Merge the PR**

Merge the PR. GitHub automatically:
- Closes the linked GitHub issue (via `Fixes #N` in the PR body)

The `close-on-merge.yml` workflow then:
- Extracts the Jira key from the PR body
- Gets an OAuth token from the gateway
- Calls the Jira transitions API to move the issue to **Closed**
- Posts a confirmation comment on the PR

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Jira automation audit log shows HTTP 400 "Problems parsing JSON" | Issue summary or description contains double quotes | Remove quotes from the Jira issue summary, or simplify the webhook body to only send `issue_key` |
| `jira-label-trigger.yml` not triggered | Jira automation rule disabled or PAT expired | Check audit log in Jira automation, verify the PAT in the Authorization header is valid |
| GitHub issue created but AI fix not dispatched | `ai-fix-from-issue.yml` workflow is disabled | Go to Actions tab, find the workflow, click Enable |
| Copilot returns no file changes | Issue description is too vague | Add more detail to the Jira issue description before re-triggering |
| Build fails after AI fix | AI introduced a TypeScript or import error | Read the build error comment on the GitHub issue, fix manually or retry with more context |
| `close-on-merge.yml` fails with 401 | Gateway OAuth credentials not set | Add `GATEWAY_CLIENT_ID`, `GATEWAY_CLIENT_SECRET`, `SDLC_INTERNSHIP_TOKEN_ENDPOINT`, `SDLC_INTERNSHIP_JIRA_BASE_ENDPOINT` |
| Jira issue stays "In Progress" after merge | close-on-merge workflow not configured | Follow [close-on-merge-setup.md](./close-on-merge-setup.md) |

---

## Enterprise Adoption Checklist

For another team to use this pipeline in their own repo:

- [ ] Copy `.github/workflows/jira-label-trigger.yml`, `ai-fix-from-issue.yml`, `close-on-merge.yml` into their repo
- [ ] Add `COPILOT_PAT` secret
- [ ] Add `GATEWAY_CLIENT_ID`, `GATEWAY_CLIENT_SECRET` secrets
- [ ] Add `JIRA_DOMAIN`, `SDLC_INTERNSHIP_TOKEN_ENDPOINT`, `SDLC_INTERNSHIP_JIRA_BASE_ENDPOINT` variables
- [ ] Create Jira automation Rule 1 pointing the POST URL at their repo's dispatches endpoint
- [ ] Create a GitHub PAT and add it to the Jira automation rule Authorization header
- [ ] Test by adding `ai-fix` label to a Jira issue
