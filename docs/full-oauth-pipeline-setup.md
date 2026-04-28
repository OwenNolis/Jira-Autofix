# Full OAuth Pipeline Setup Guide

This documents the complete pipeline using OAuth credentials via a Gravitee gateway to:
1. Poll Jira for issues matching a JQL filter
2. Create GitHub issues from them
3. Trigger an AI fix workflow (GitHub Copilot)
4. Create a PR with the AI-generated code changes
5. Close the Jira issue when the PR is merged

No Jira automation rules or webhooks are needed — everything is driven by GitHub Actions calling the Jira API through the gateway.

---

## Architecture

```
GitHub Actions (jira-poll.yml)
  → OAuth token from Gravitee gateway
  → Jira search API (fetch issues by JQL)
  → Create GitHub issues
  → Transition Jira issue to "In Progress"
  → Dispatch ai-fix-from-issue.yml

ai-fix-from-issue.yml
  → GitHub Copilot CLI (AI generates code changes)
  → Build verification (npm run build)
  → Create PR with "Fixes #N" and "<!-- jira-key: JIRAFIX-XX -->"

close-on-merge.yml (on PR merge)
  → OAuth token from Gravitee gateway
  → Jira transitions API → issue set to "Closed/Done"
  → Comment on PR confirming closure
```

---

## Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions → Secrets**:

| Secret Name | Description |
|-------------|-------------|
| `GATEWAY_CLIENT_ID` | OAuth client ID for the Gravitee gateway |
| `GATEWAY_CLIENT_SECRET` | OAuth client secret for the Gravitee gateway |
| `COPILOT_PAT` | GitHub Personal Access Token with Copilot access (for the AI fix step) |

---

## Required GitHub Variables

Go to **Settings → Secrets and variables → Actions → Variables**:

| Variable Name | Description | Example |
|---------------|-------------|---------|
| `JIRA_DOMAIN` | Your Jira instance domain | `mycompany.atlassian.net` |
| `JIRA_PROJECT_KEY` | Jira project key | `JIRAFIX` |
| `JIRA_JQL_FILTER` | JQL query to select issues to sync | `project=JIRAFIX AND labels = needs-code-change AND status != Done ORDER BY created DESC` |
| `SDLC_INTERNSHIP_TOKEN_ENDPOINT` | OAuth token endpoint URL on the gateway | `https://gateway.example.com/oauth/token` |
| `SDLC_INTERNSHIP_JIRA_SEARCH_ENDPOINT` | Jira search API URL via gateway | `https://gateway.example.com/jira/rest/api/2/search` |
| `SDLC_INTERNSHIP_JIRA_BASE_ENDPOINT` | Jira base API URL via gateway | `https://gateway.example.com/jira/rest/api/2` |

---

## Workflow Files

### 1. `jira-poll.yml` — Polls Jira and creates GitHub issues

```yaml
name: Jira → GitHub Issues

on:
  workflow_dispatch:
    inputs:
      jql_override:
        description: 'Custom JQL filter (leave empty to use JIRA_JQL_FILTER variable)'
        required: false
        default: ''

env:
  JIRA_DOMAIN: ${{ vars.JIRA_DOMAIN }}
  JIRA_PROJECT_KEY: ${{ vars.JIRA_PROJECT_KEY }}
  JIRA_JQL: ${{ inputs.jql_override || vars.JIRA_JQL_FILTER }}
  TOKEN_ENDPOINT: ${{ vars.SDLC_INTERNSHIP_TOKEN_ENDPOINT }}
  JIRA_GATEWAY_SEARCH: ${{ vars.SDLC_INTERNSHIP_JIRA_SEARCH_ENDPOINT }}
  JIRA_GATEWAY_BASE: ${{ vars.SDLC_INTERNSHIP_JIRA_BASE_ENDPOINT }}

jobs:
  sync:
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

      - name: Fetch OAuth access token
        id: oauth
        env:
          CLIENT_ID: ${{ secrets.GATEWAY_CLIENT_ID }}
          CLIENT_SECRET: ${{ secrets.GATEWAY_CLIENT_SECRET }}
        run: |
          BASIC_AUTH=$(echo -n "$CLIENT_ID:$CLIENT_SECRET" | base64)

          RESPONSE=$(curl --fail --silent --show-error \
            --request POST \
            --url "$TOKEN_ENDPOINT" \
            --header "Content-Type: application/x-www-form-urlencoded" \
            --header "Authorization: Basic $BASIC_AUTH" \
            --data "grant_type=client_credentials")

          ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.access_token')

          if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
            echo "::error::Failed to obtain OAuth access token from gateway"
            exit 1
          fi

          echo "::add-mask::$ACCESS_TOKEN"
          echo "token=$ACCESS_TOKEN" >> "$GITHUB_OUTPUT"
          echo "OAuth token obtained successfully"

      - name: Fetch Jira issues
        id: fetch
        env:
          GATEWAY_TOKEN: ${{ steps.oauth.outputs.token }}
        run: |
          JIRA_DOMAIN="${JIRA_DOMAIN%/}"
          JQL="${JIRA_JQL:-project=${JIRA_PROJECT_KEY} AND status != Done AND labels = needs-code-change ORDER BY created DESC}"
          echo "JQL: $JQL"

          ENCODED=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$JQL")

          curl --fail --silent --show-error \
            --header "Authorization: Bearer $GATEWAY_TOKEN" \
            --header "Accept: application/json" \
            "${JIRA_GATEWAY_SEARCH}?jql=${ENCODED}&maxResults=25&fields=summary,description,status,labels,issuetype,priority,created" \
            -o /tmp/jira_issues.json

          TOTAL=$(jq '(.total // (.issues | length))' /tmp/jira_issues.json)
          echo "Found $TOTAL Jira issues"
          echo "total=$TOTAL" >> $GITHUB_OUTPUT

      - name: Create GitHub issues for new Jira issues
        if: steps.fetch.outputs.total != '0'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GATEWAY_TOKEN: ${{ steps.oauth.outputs.token }}
        run: |
          # (ADF-to-Markdown converter, issue body builder, and issue loop)
          # See the full jira-poll.yml in .github/workflows/ for complete implementation
```

> The full implementation is already in `.github/workflows/jira-poll.yml`.

---

### 2. `ai-fix-from-issue.yml` — AI generates and commits the fix

Already in `.github/workflows/ai-fix-from-issue.yml`. No changes needed.

Key steps it performs:
- Reads the GitHub issue title and body
- Builds a detailed prompt with all source files and `package.json`
- Runs GitHub Copilot CLI to generate code changes
- Applies the JSON output to the repository files
- Runs `npm run build` to verify the fix compiles
- Creates a PR with `Fixes #N` and `<!-- jira-key: JIRAFIX-XX -->` in the body

---

### 3. `close-on-merge.yml` — Closes the Jira issue when PR is merged

```yaml
name: Close Jira Issue on PR Merge

on:
  pull_request:
    types: [closed]

jobs:
  close-jira:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    permissions:
      issues: write
      pull-requests: write

    steps:
      - name: Check dependencies
        run: |
          if ! command -v jq &>/dev/null; then
            sudo apt-get install -y -qq jq
          fi
          jq --version

      - name: Extract Jira key from PR body
        id: find_key
        env:
          PR_BODY: ${{ github.event.pull_request.body }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          JIRA_KEY=$(printf '%s' "$PR_BODY" \
            | grep -oP '(?<=<!-- jira-key: )[A-Z]+-[0-9]+(?= -->)' \
            | head -1 || true)

          if [ -z "$JIRA_KEY" ]; then
            GH_ISSUE=$(printf '%s' "$PR_BODY" \
              | grep -oP '(?i)(?:fixes|closes|resolves)\s+#\K[0-9]+' \
              | head -1 || true)

            if [ -n "$GH_ISSUE" ]; then
              JIRA_KEY=$(curl -s \
                -H "Authorization: Bearer $GITHUB_TOKEN" \
                -H "Accept: application/vnd.github+json" \
                "https://api.github.com/repos/${{ github.repository }}/issues/${GH_ISSUE}/labels" \
                | jq -r '.[].name | select(startswith("jira:")) | ltrimstr("jira:")' \
                | head -1 || true)
            fi
          fi

          if [ -n "$JIRA_KEY" ]; then
            echo "Found Jira key: $JIRA_KEY"
            echo "jira_key=$JIRA_KEY" >> $GITHUB_OUTPUT
          else
            echo "No Jira key found — nothing to close"
            echo "jira_key=" >> $GITHUB_OUTPUT
          fi

      - name: Fetch OAuth access token
        if: steps.find_key.outputs.jira_key != ''
        id: oauth
        env:
          CLIENT_ID:      ${{ secrets.GATEWAY_CLIENT_ID }}
          CLIENT_SECRET:  ${{ secrets.GATEWAY_CLIENT_SECRET }}
          TOKEN_ENDPOINT: ${{ vars.SDLC_INTERNSHIP_TOKEN_ENDPOINT }}
        run: |
          BASIC_AUTH=$(echo -n "$CLIENT_ID:$CLIENT_SECRET" | base64)

          RESPONSE=$(curl --fail --silent --show-error \
            --request POST \
            --url "$TOKEN_ENDPOINT" \
            --header "Content-Type: application/x-www-form-urlencoded" \
            --header "Authorization: Basic $BASIC_AUTH" \
            --data "grant_type=client_credentials")

          ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.access_token')

          if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
            echo "::error::Failed to obtain OAuth access token"
            exit 1
          fi

          echo "::add-mask::$ACCESS_TOKEN"
          echo "token=$ACCESS_TOKEN" >> "$GITHUB_OUTPUT"

      - name: Close Jira issue
        if: steps.find_key.outputs.jira_key != ''
        env:
          GATEWAY_TOKEN:     ${{ steps.oauth.outputs.token }}
          JIRA_GATEWAY_BASE: ${{ vars.SDLC_INTERNSHIP_JIRA_BASE_ENDPOINT }}
          ISSUE_KEY:         ${{ steps.find_key.outputs.jira_key }}
        run: |
          TRANSITIONS=$(curl -s \
            --header "Authorization: Bearer $GATEWAY_TOKEN" \
            --header "Accept: application/json" \
            "${JIRA_GATEWAY_BASE}/issue/${ISSUE_KEY}/transitions")

          TRANSITION_ID=$(echo "$TRANSITIONS" | jq -r '
            .transitions[] |
            select(.name == "Done" or .name == "Closed" or .name == "Resolve Issue") |
            .id' | head -1)

          if [ -z "$TRANSITION_ID" ]; then
            echo "❌ No closing transition found. Available: $(echo "$TRANSITIONS" | jq -r '.transitions[].name')"
            exit 0
          fi

          HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
            --header "Authorization: Bearer $GATEWAY_TOKEN" \
            --header "Content-Type: application/json" \
            "${JIRA_GATEWAY_BASE}/issue/${ISSUE_KEY}/transitions" \
            -d "{\"transition\": {\"id\": \"${TRANSITION_ID}\"}}")

          if [ "$HTTP" = "204" ]; then
            echo "✅ Jira issue $ISSUE_KEY closed"
          else
            echo "⚠️ Unexpected HTTP ${HTTP}"
          fi

      - name: Comment on PR with closure confirmation
        if: steps.find_key.outputs.jira_key != ''
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          JIRA_DOMAIN:  ${{ vars.JIRA_DOMAIN }}
        run: |
          KEY="${{ steps.find_key.outputs.jira_key }}"
          URL="https://${JIRA_DOMAIN}/browse/${KEY}"
          curl -s -X POST \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/${{ github.repository }}/issues/${{ github.event.pull_request.number }}/comments" \
            -d "{\"body\": \"✅ Jira issue [${KEY}](${URL}) has been closed automatically.\"}"
```

---

## Implementation Steps

1. Add the 3 secrets (`GATEWAY_CLIENT_ID`, `GATEWAY_CLIENT_SECRET`, `COPILOT_PAT`)
2. Add the 6 variables (`JIRA_DOMAIN`, `JIRA_PROJECT_KEY`, `JIRA_JQL_FILTER`, `SDLC_INTERNSHIP_TOKEN_ENDPOINT`, `SDLC_INTERNSHIP_JIRA_SEARCH_ENDPOINT`, `SDLC_INTERNSHIP_JIRA_BASE_ENDPOINT`)
3. Place all 3 workflow files in `.github/workflows/`
4. Go to **Actions → Jira → GitHub Issues → Run workflow** to trigger the first sync
5. Review the created GitHub issues — they will automatically have the AI fix workflow dispatched
6. When the AI fix PR is merged, the Jira issue transitions to **Closed** automatically

---

## Verification

| Step | What to check |
|------|---------------|
| OAuth token | `jira-poll.yml` step "Fetch OAuth access token" shows "OAuth token obtained successfully" |
| Jira issues fetched | Step "Fetch Jira issues" shows "Found N Jira issues" |
| GitHub issue created | A new GitHub issue appears with `from-jira` and `jira:JIRAFIX-XX` labels |
| Jira transitioned | Jira issue moves to "In Progress" |
| AI fix triggered | "AI Fix from GitHub Issue" workflow appears in Actions tab |
| PR created | PR titled `Refs#JIRAFIX-XX - ... (Closes #N)` appears |
| Jira closed | After merging the PR, Jira issue moves to "Closed/Done" |
| PR comment | PR gets a comment "✅ Jira issue [JIRAFIX-XX] has been closed automatically" |
