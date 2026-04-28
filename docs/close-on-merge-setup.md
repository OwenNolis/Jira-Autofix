# Close Jira Issue on PR Merge — Setup Guide

When a PR is merged in GitHub, this feature automatically transitions the linked Jira issue to **Closed**. It requires OAuth credentials to authenticate GitHub → Jira API calls via the Gravitee gateway.

---

## How It Works

```
PR merged → close-on-merge.yml → OAuth token → Jira transitions API → Issue closed
```

1. A PR is merged that contains `Fixes #N` in its body
2. `close-on-merge.yml` extracts the Jira issue key from the PR body or the `jira:JIRAFIX-XX` label on the linked GitHub issue
3. It fetches an OAuth token from the Gravitee gateway
4. It calls the Jira transitions API to move the issue to **Closed/Done**
5. It posts a confirmation comment on the PR

---

## Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions → Secrets** and add:

| Secret Name | Value |
|-------------|-------|
| `GATEWAY_CLIENT_ID` | Your Gravitee gateway OAuth client ID |
| `GATEWAY_CLIENT_SECRET` | Your Gravitee gateway OAuth client secret |

---

## Required GitHub Variables

Go to **Settings → Secrets and variables → Actions → Variables** and add:

| Variable Name | Value |
|---------------|-------|
| `SDLC_INTERNSHIP_TOKEN_ENDPOINT` | OAuth token endpoint URL (e.g. `https://gateway.example.com/oauth/token`) |
| `SDLC_INTERNSHIP_JIRA_BASE_ENDPOINT` | Jira base API URL via gateway (e.g. `https://gateway.example.com/jira/rest/api/2`) |
| `JIRA_DOMAIN` | Your Jira domain (e.g. `mycompany.atlassian.net`) |

> `JIRA_DOMAIN` is likely already set if the rest of the pipeline is working.

---

## Workflow File

Replace the current `close-on-merge.yml` with the following:

```yaml
# When a PR is merged, extract the Jira key from the PR body and close the Jira issue.
# The GitHub issue is closed automatically by GitHub because of Fixes #N in the PR body.

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
            echo "jq not found, installing..."
            sudo apt-get install -y -qq jq
          fi
          jq --version

      - name: Extract Jira key from PR body
        id: find_key
        env:
          PR_BODY: ${{ github.event.pull_request.body }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Primary: look for hidden comment embedded by ai-fix-from-issue.yml
          JIRA_KEY=$(printf '%s' "$PR_BODY" \
            | grep -oP '(?<=<!-- jira-key: )[A-Z]+-[0-9]+(?= -->)' \
            | head -1 || true)

          # Fallback: extract GitHub issue number from "Fixes #N" and look up
          # the jira:JIRAFIX-XX label on that issue
          if [ -z "$JIRA_KEY" ]; then
            GH_ISSUE=$(printf '%s' "$PR_BODY" \
              | grep -oP '(?i)(?:fixes|closes|resolves)\s+#\K[0-9]+' \
              | head -1 || true)

            if [ -n "$GH_ISSUE" ]; then
              echo "No jira-key comment found — checking labels on issue #${GH_ISSUE}"
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
            echo "No Jira key found in PR body or issue labels — nothing to close"
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
            echo "::error::Failed to obtain OAuth access token from gateway"
            exit 1
          fi

          echo "::add-mask::$ACCESS_TOKEN"
          echo "token=$ACCESS_TOKEN" >> "$GITHUB_OUTPUT"
          echo "OAuth token obtained successfully"

      - name: Close Jira issue
        if: steps.find_key.outputs.jira_key != ''
        env:
          GATEWAY_TOKEN:     ${{ steps.oauth.outputs.token }}
          JIRA_GATEWAY_BASE: ${{ vars.SDLC_INTERNSHIP_JIRA_BASE_ENDPOINT }}
          ISSUE_KEY:         ${{ steps.find_key.outputs.jira_key }}
        run: |
          echo "Closing Jira issue: $ISSUE_KEY"

          TRANSITIONS=$(curl -s \
            --header "Authorization: Bearer $GATEWAY_TOKEN" \
            --header "Accept: application/json" \
            "${JIRA_GATEWAY_BASE}/issue/${ISSUE_KEY}/transitions")

          TRANSITION_ID=$(echo "$TRANSITIONS" | jq -r '
            .transitions[] |
            select(.name == "Done" or .name == "Closed" or .name == "Resolve Issue") |
            .id' | head -1)

          if [ -z "$TRANSITION_ID" ]; then
            echo "❌ No closing transition found for $ISSUE_KEY"
            echo "Available transitions: $(echo "$TRANSITIONS" | jq -r '.transitions[].name')"
            exit 0
          fi

          HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
            --header "Authorization: Bearer $GATEWAY_TOKEN" \
            --header "Content-Type: application/json" \
            "${JIRA_GATEWAY_BASE}/issue/${ISSUE_KEY}/transitions" \
            -d "{\"transition\": {\"id\": \"${TRANSITION_ID}\"}}")

          if [ "$HTTP" = "204" ]; then
            echo "✅ Jira issue $ISSUE_KEY closed (HTTP 204)"
          else
            echo "⚠️ Unexpected HTTP ${HTTP} when closing $ISSUE_KEY"
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

1. Add `GATEWAY_CLIENT_ID` and `GATEWAY_CLIENT_SECRET` as **repository secrets**
2. Add `SDLC_INTERNSHIP_TOKEN_ENDPOINT` and `SDLC_INTERNSHIP_JIRA_BASE_ENDPOINT` as **repository variables**
3. Replace `.github/workflows/close-on-merge.yml` with the workflow above
4. Merge a PR that has a `jira:JIRAFIX-XX` label or a `<!-- jira-key: JIRAFIX-XX -->` comment in its body
5. Check the Actions tab — the "Close Jira Issue on PR Merge" workflow should run and transition the issue

---

## Verification

After merging a PR, check:
- GitHub Actions: the `close-jira` job should show green with "✅ Jira issue JIRAFIX-XX closed (HTTP 204)"
- Jira: the issue should be in **Closed** status
- PR: a comment should appear saying "✅ Jira issue [JIRAFIX-XX] has been closed automatically"
