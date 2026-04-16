# Jira → Kubernetes → GitHub Issues → AI Fix → PR Pipeline

## Architecture

```
Jira Issue (open, label: "needs-code-change")
        │
        ▼ every 10 min (K8s CronJob or GitHub Actions schedule)
[jira-poll.yml] — polls Jira REST API, creates GitHub Issue
        │  embeds Jira key in issue body (e.g. PROJ-123)
        ▼
GitHub Issue (body: "Jira: PROJ-123 — UI change needed: ...")
        │
        ▼ label "ai-fix" added / comment "!fix"
[ai-fix-from-issue.yml] — reads issue body, calls Gemini, applies fixes
        │
        ▼
PR created (title links GitHub issue + Jira key)
        │
        ▼ PR merged
[close-on-merge.yml] — closes GitHub Issue + Jira issue via PROJ-123 key
```

## Directory Structure

```
your-new-repo/
├── .github/
│   ├── scripts/
│   │   └── ai-issue-fix.sh          ← Gemini analysis + file changes
│   └── workflows/
│       ├── jira-poll.yml            ← Jira → GitHub Issues (every 10 min)
│       ├── ai-fix-from-issue.yml    ← GitHub Issue → Gemini → PR
│       └── close-on-merge.yml      ← PR merged → close GitHub + Jira
└── k8s/
    ├── jira-poller-cronjob.yaml     ← (optional) K8s orchestrator
    └── github-credentials-secret.yaml
```

---

## Step 1 — Create the GitHub repository

Create a new repository on GitHub. Initialize it with whatever source code it will contain (frontend, backend, etc.). Make sure the default branch is `main`.

---

## Step 2 — Configure secrets and variables

Go to **Settings → Secrets and variables → Actions**.

### Secrets (encrypted)

| Name | Value |
|---|---|
| `JIRA_EMAIL` | The service account email used to authenticate with Jira |
| `JIRA_API_TOKEN` | Jira API token (generate at id.atlassian.com) |
| `GEMINI_API_KEY` | Your Google Gemini API key |

### Variables (plain text)

| Name | Example value |
|---|---|
| `JIRA_DOMAIN` | `yourorg.atlassian.net` |
| `JIRA_PROJECT_KEY` | `PROJ` |
| `JIRA_JQL_FILTER` | `project=PROJ AND status != Done AND labels = needs-code-change ORDER BY created DESC` |
| `GEMINI_MODEL` | `gemini-2.5-flash` |

---

## Step 3 — Create the two permanent GitHub labels

These labels are expected by the workflows. Create them once via **Issues → Labels → New label**:

| Label | Color | Purpose |
|---|---|---|
| `from-jira` | `#0052CC` | Marks issues auto-created from Jira |
| `ai-fix` | `#E11D48` | Triggers the AI fix workflow |

The per-issue `jira:PROJ-123` labels are created automatically by the poll workflow.

---

## Step 4 — Create `.github/scripts/ai-issue-fix.sh`

This script is the core AI engine. It fetches the issue, builds context from the repo, calls Gemini, and writes the file changes to disk.

```bash
#!/bin/bash
# ──────────────────────────────────────────────────────────────
# ai-issue-fix.sh — AI-powered code fix from a GitHub issue
#
# Usage: ai-issue-fix.sh <github_issue_number>
#
# Required env vars:
#   GEMINI_API_KEY, GITHUB_TOKEN, GITHUB_REPOSITORY
# Optional:
#   GEMINI_MODEL  (default: gemini-2.5-flash)
# ──────────────────────────────────────────────────────────────

set -euo pipefail

ISSUE_NUMBER="${1:?Usage: ai-issue-fix.sh <issue_number>}"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# ── 1. Fetch GitHub issue ──────────────────────────────────────
log_info "Fetching GitHub issue #${ISSUE_NUMBER}..."

ISSUE_JSON=$(curl -s \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${ISSUE_NUMBER}")

ISSUE_TITLE=$(echo "$ISSUE_JSON" | jq -r '.title // "Untitled Issue"')
ISSUE_BODY=$(echo  "$ISSUE_JSON" | jq -r '.body  // "No description."')
JIRA_KEY=$(echo "$ISSUE_BODY" | grep -oP '(?<=<!-- jira-key: )[A-Z]+-[0-9]+(?= -->)' 2>/dev/null || true)

log_info "Title:    $ISSUE_TITLE"
log_info "Jira key: ${JIRA_KEY:-none}"

# ── 2. Build file tree ─────────────────────────────────────────
log_info "Scanning repository..."

FILE_TREE=$(git ls-files 2>/dev/null \
  | grep -E '\.(ts|tsx|js|jsx|java|py|go|cs|vue|html|css|scss|yaml|yml|json|xml|properties|gradle)$' \
  | sort | head -200)

# ── 3. Collect relevant file contents (keyword scoring) ────────
log_info "Selecting relevant files..."

KEYWORDS=$(echo "${ISSUE_TITLE} ${ISSUE_BODY}" \
  | tr '[:upper:]' '[:lower:]' \
  | grep -oE '[a-zA-Z]{4,}' \
  | sort | uniq -c | sort -rn \
  | head -15 | awk '{print $2}')

CONTEXT_FILES=""
TOTAL_CHARS=0
MAX_CHARS=70000

while IFS= read -r file; do
  [ -f "$file" ] || continue
  [ "$TOTAL_CHARS" -ge "$MAX_CHARS" ] && break

  SCORE=0
  for kw in $KEYWORDS; do
    echo "$file" | grep -qi "$kw" 2>/dev/null       && SCORE=$((SCORE + 2))
    grep -qi "$kw" "$file"         2>/dev/null       && SCORE=$((SCORE + 1))
  done
  FILE_CHARS=$(wc -c < "$file" 2>/dev/null || echo 0)
  [ "$FILE_CHARS" -lt 2000 ] && SCORE=$((SCORE + 1))   # boost small files

  if [ "$SCORE" -gt 0 ]; then
    SNIPPET=$(head -c 3000 "$file")
    CONTEXT_FILES="${CONTEXT_FILES}
### ${file}
\`\`\`
${SNIPPET}
\`\`\`
"
    TOTAL_CHARS=$((TOTAL_CHARS + ${#SNIPPET}))
  fi
done <<< "$FILE_TREE"

# Fallback: include smallest files if no keyword hits
if [ -z "$CONTEXT_FILES" ]; then
  log_warning "No keyword matches — falling back to smallest files"
  while IFS= read -r file; do
    [ -f "$file" ] || continue
    [ "$TOTAL_CHARS" -ge "$MAX_CHARS" ] && break
    FILE_CHARS=$(wc -c < "$file" 2>/dev/null || echo 0)
    if [ "$FILE_CHARS" -lt 3000 ]; then
      CONTENT=$(cat "$file")
      CONTEXT_FILES="${CONTEXT_FILES}
### ${file}
\`\`\`
${CONTENT}
\`\`\`
"
      TOTAL_CHARS=$((TOTAL_CHARS + FILE_CHARS))
    fi
  done <<< "$FILE_TREE"
fi

FILE_COUNT=$(echo "$CONTEXT_FILES" | grep -c '^###' || echo 0)
log_info "Context: ~${TOTAL_CHARS} chars across ${FILE_COUNT} files"

# ── 4. Build Gemini prompt ─────────────────────────────────────
cat > /tmp/gemini_prompt.txt << PROMPT
You are an expert software engineer. A GitHub issue describes a required code change. Implement it.

## Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}

${ISSUE_BODY}

## Repository File Tree
\`\`\`
${FILE_TREE}
\`\`\`

## Relevant File Contents

${CONTEXT_FILES}

## Instructions

Implement the code changes described in the issue above.

Rules:
1. Return ONLY a valid JSON object — no markdown, no text outside the JSON.
2. Include the COMPLETE file content for every modified/created file.
3. Follow the existing code style, naming conventions, and project structure.
4. Only change files necessary to fulfill the issue. Do not refactor unrelated code.
5. action must be one of: "modify", "create". Do not delete files unless the issue explicitly asks.

Return this exact structure:
{
  "analysis": "One paragraph explaining what you changed and why",
  "changes": [
    {
      "file": "relative/path/to/file.ext",
      "action": "modify",
      "content": "complete file content after your changes"
    }
  ]
}
PROMPT

# ── 5. Call Gemini API ─────────────────────────────────────────
log_info "Calling Gemini (model: ${GEMINI_MODEL})..."

REQUEST_JSON=$(jq -n --rawfile text /tmp/gemini_prompt.txt '{
  contents: [{ parts: [{ text: $text }] }],
  generationConfig: {
    temperature: 0.15,
    maxOutputTokens: 8192
  }
}')

HTTP_CODE=$(curl -sS \
  -o /tmp/gemini_response.json \
  -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: ${GEMINI_API_KEY}" \
  "https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent" \
  -d "$REQUEST_JSON" || echo "000")

log_info "Gemini HTTP status: ${HTTP_CODE}"

if [ "$HTTP_CODE" = "429" ]; then
  log_warning "Gemini quota exceeded (429) — no changes will be made"
  exit 0
fi

if [ "$HTTP_CODE" != "200" ]; then
  log_error "Gemini API call failed (HTTP ${HTTP_CODE})"
  cat /tmp/gemini_response.json >&2
  exit 1
fi

# ── 6. Parse response and apply file changes ───────────────────
log_info "Parsing Gemini response..."

python3 << 'PYEOF'
import json, sys, os, re

with open('/tmp/gemini_response.json') as f:
    resp = json.load(f)

candidates = resp.get('candidates') or []
if not candidates:
    print("[ERROR] No candidates in Gemini response", file=sys.stderr)
    sys.exit(1)

raw_text = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '')

if not raw_text:
    print("[ERROR] Empty text in Gemini response", file=sys.stderr)
    sys.exit(1)

# Strip markdown code fences if Gemini wrapped the JSON
clean = re.sub(r'^```(?:json)?\s*\n?', '', raw_text.strip())
clean = re.sub(r'\n?```\s*$', '', clean.strip())

result = None
try:
    result = json.loads(clean)
except json.JSONDecodeError:
    match = re.search(r'\{[\s\S]+\}', clean)
    if match:
        try:
            result = json.loads(match.group())
        except Exception as e:
            print(f"[ERROR] Could not parse JSON from Gemini response: {e}", file=sys.stderr)
            print(f"First 500 chars: {raw_text[:500]}", file=sys.stderr)
            sys.exit(1)
    else:
        print("[ERROR] No JSON object found in Gemini response", file=sys.stderr)
        print(f"First 500 chars: {raw_text[:500]}", file=sys.stderr)
        sys.exit(1)

analysis = result.get('analysis', 'AI-generated code changes')
changes  = result.get('changes', [])

print(f"[INFO] Analysis: {analysis}")
print(f"[INFO] Changes: {len(changes)} file(s)")

# Save analysis for the PR description step
with open('/tmp/ai_analysis.txt', 'w') as f:
    f.write(analysis)

if not changes:
    print("[WARNING] Gemini returned no file changes")
    sys.exit(0)

applied = 0
for change in changes:
    path    = (change.get('file') or '').strip()
    action  = change.get('action', 'modify')
    content = change.get('content', '')

    if not path:
        continue

    # Block path traversal
    if '..' in path or path.startswith('/') or path.startswith('~'):
        print(f"[WARNING] Blocked unsafe path: {path}", file=sys.stderr)
        continue

    if action == 'delete':
        if os.path.exists(path):
            os.remove(path)
            print(f"[SUCCESS] Deleted: {path}")
        continue

    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

    verb = 'Created' if action == 'create' else 'Modified'
    print(f"[SUCCESS] {verb}: {path}")
    applied += 1

print(f"[SUCCESS] Applied {applied} file change(s)")
PYEOF
```

Make it executable after creating it:
```bash
chmod +x .github/scripts/ai-issue-fix.sh
```

---

## Step 5 — Create `.github/workflows/jira-poll.yml`

Runs every 10 minutes. Fetches Jira issues matching your JQL filter and creates a GitHub issue for each one that hasn't been tracked yet.

```yaml
name: Jira → GitHub Issues

on:
  schedule:
    - cron: '*/10 * * * *'
  workflow_dispatch:
    inputs:
      jql_override:
        description: 'Custom JQL filter (leave empty to use JIRA_JQL_FILTER variable)'
        required: false
        default: ''

env:
  JIRA_DOMAIN:      ${{ vars.JIRA_DOMAIN }}
  JIRA_PROJECT_KEY: ${{ vars.JIRA_PROJECT_KEY }}
  JIRA_JQL:         ${{ inputs.jql_override || vars.JIRA_JQL_FILTER }}

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      contents: read

    steps:
      - name: Install dependencies
        run: sudo apt-get update -qq && sudo apt-get install -y -qq jq

      - name: Fetch Jira issues
        id: fetch
        env:
          JIRA_EMAIL:     ${{ secrets.JIRA_EMAIL }}
          JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
        run: |
          JQL="${JIRA_JQL:-project=${JIRA_PROJECT_KEY} AND status != Done AND labels = needs-code-change ORDER BY created DESC}"
          echo "JQL: $JQL"

          ENCODED=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$JQL")

          curl -s \
            -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
            -H "Accept: application/json" \
            "https://${JIRA_DOMAIN}/rest/api/3/search?jql=${ENCODED}&maxResults=25&fields=summary,description,status,labels,issuetype,priority,created" \
            > /tmp/jira_issues.json

          TOTAL=$(jq '.total // 0' /tmp/jira_issues.json)
          echo "Found $TOTAL Jira issues"
          echo "total=$TOTAL" >> $GITHUB_OUTPUT

      - name: Create GitHub issues for new Jira issues
        if: steps.fetch.outputs.total != '0'
        env:
          GITHUB_TOKEN:   ${{ secrets.GITHUB_TOKEN }}
          JIRA_EMAIL:     ${{ secrets.JIRA_EMAIL }}
          JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
        run: |
          jq -c '.issues[]' /tmp/jira_issues.json | while IFS= read -r issue; do
            ISSUE_KEY=$(echo "$issue" | jq -r '.key')
            SUMMARY=$(echo "$issue"   | jq -r '.fields.summary')
            STATUS=$(echo "$issue"    | jq -r '.fields.status.name')
            PRIORITY=$(echo "$issue"  | jq -r '.fields.priority.name // "Medium"')
            ISSUE_TYPE=$(echo "$issue"| jq -r '.fields.issuetype.name // "Task"')
            ISSUE_URL="https://${JIRA_DOMAIN}/browse/${ISSUE_KEY}"

            echo "--- Processing $ISSUE_KEY: $SUMMARY"

            # Skip if a GitHub issue already exists for this Jira key (open OR closed)
            EXISTING=$(curl -s \
              -H "Authorization: Bearer $GITHUB_TOKEN" \
              -H "Accept: application/vnd.github+json" \
              "https://api.github.com/repos/${{ github.repository }}/issues?labels=jira:${ISSUE_KEY}&state=all" \
              | jq 'length')

            if [ "$EXISTING" -gt 0 ]; then
              echo "⏭️  GitHub issue already exists for $ISSUE_KEY — skipping"
              continue
            fi

            # Convert Jira ADF description to Markdown
            DESCRIPTION=$(echo "$issue" | python3 - << 'PYEOF'
import json, sys

def convert(node):
    if not isinstance(node, dict): return ''
    t       = node.get('type', '')
    content = node.get('content', [])
    text    = node.get('text', '')
    attrs   = node.get('attrs', {})
    marks   = node.get('marks', [])
    result  = text
    for m in marks:
        mt = m.get('type', '')
        if   mt == 'strong': result = f'**{result}**'
        elif mt == 'em':     result = f'*{result}*'
        elif mt == 'code':   result = f'`{result}`'
        elif mt == 'link':
            href = m.get('attrs', {}).get('href', '')
            result = f'[{result}]({href})'
    children = ''.join(convert(c) for c in content)
    if   t == 'doc':                     return children
    elif t == 'paragraph':               return children + '\n'
    elif t == 'text':                    return result
    elif t == 'heading':
        lvl = attrs.get('level', 1)
        return '#' * lvl + ' ' + children + '\n'
    elif t in ('bulletList', 'orderedList'): return children
    elif t == 'listItem':                return '- ' + children
    elif t == 'codeBlock':
        lang = attrs.get('language', '')
        return f'```{lang}\n{children}```\n'
    elif t == 'hardBreak':               return '\n'
    else:                                return children

data = json.load(sys.stdin)
desc = data.get('fields', {}).get('description')
if isinstance(desc, dict):
    print(convert(desc)[:3000])
elif isinstance(desc, str):
    print(desc[:3000])
else:
    print('No description provided.')
PYEOF
)

            # Ensure the per-issue label exists (422 if already present — that is OK)
            curl -s -X POST \
              -H "Authorization: Bearer $GITHUB_TOKEN" \
              -H "Accept: application/vnd.github+json" \
              "https://api.github.com/repos/${{ github.repository }}/labels" \
              -d "{\"name\":\"jira:${ISSUE_KEY}\",\"color\":\"0052CC\",\"description\":\"Linked to Jira ${ISSUE_KEY}\"}" \
              > /dev/null 2>&1 || true

            # Build issue body
            BODY=$(python3 - << PYEOF
import os
print(f"""<!-- jira-key: {os.environ['ISSUE_KEY']} -->
## Jira: [{os.environ['ISSUE_KEY']}]({os.environ['ISSUE_URL']})

| Field | Value |
|-------|-------|
| **Type** | {os.environ['ISSUE_TYPE']} |
| **Priority** | {os.environ['PRIORITY']} |
| **Status** | {os.environ['STATUS']} |

## Description

{os.environ['DESCRIPTION']}

---
*Auto-created from Jira. Add label `ai-fix` or comment `!fix` to trigger AI-powered code changes.*""")
PYEOF
)

            # Build JSON payload
            PAYLOAD=$(python3 -c "
import json, os
print(json.dumps({
    'title':  '[' + os.environ['ISSUE_KEY'] + '] ' + os.environ['SUMMARY'],
    'body':   os.environ['BODY'],
    'labels': ['jira:' + os.environ['ISSUE_KEY'], 'from-jira']
}))
" ISSUE_KEY="$ISSUE_KEY" SUMMARY="$SUMMARY" BODY="$BODY")

            # Create GitHub issue
            RESPONSE=$(echo "$PAYLOAD" | curl -s -X POST \
              -H "Authorization: Bearer $GITHUB_TOKEN" \
              -H "Accept: application/vnd.github+json" \
              "https://api.github.com/repos/${{ github.repository }}/issues" \
              -d @-)

            GH_NUMBER=$(echo "$RESPONSE" | jq -r '.number // empty')
            GH_URL=$(echo "$RESPONSE"    | jq -r '.html_url // empty')

            if [ -n "$GH_NUMBER" ]; then
              echo "✅ Created GitHub issue #${GH_NUMBER} for ${ISSUE_KEY}: ${GH_URL}"
            else
              echo "❌ Failed to create GitHub issue for $ISSUE_KEY"
              echo "Response: $(echo "$RESPONSE" | head -c 400)"
            fi
          done
```

---

## Step 6 — Create `.github/workflows/ai-fix-from-issue.yml`

Triggered when a GitHub issue gets the `ai-fix` label, or when someone comments `!fix` on an issue. Runs `ai-issue-fix.sh`, then opens a PR.

```yaml
name: AI Fix from GitHub Issue

on:
  issues:
    types: [labeled]
  issue_comment:
    types: [created]

concurrency:
  group: ai-fix-issue-${{ github.event.issue.number }}
  cancel-in-progress: true

jobs:
  ai-fix:
    runs-on: ubuntu-latest

    # Run when:
    #   • An issue was labeled with "ai-fix", OR
    #   • A comment starts with "!fix" on a real issue (not a PR)
    if: >
      (github.event_name == 'issues' && github.event.label.name == 'ai-fix') ||
      (github.event_name == 'issue_comment' &&
       startsWith(github.event.comment.body, '!fix') &&
       github.event.issue.pull_request == '')

    permissions:
      contents: write
      issues: write
      pull-requests: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - name: Install dependencies
        run: sudo apt-get update -qq && sudo apt-get install -y -qq jq

      - name: Make scripts executable
        run: chmod +x .github/scripts/ai-issue-fix.sh

      - name: Acknowledge trigger (add 👀 reaction)
        if: github.event_name == 'issue_comment'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          curl -s -X POST \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/${{ github.repository }}/issues/comments/${{ github.event.comment.id }}/reactions" \
            -d '{"content":"eyes"}' > /dev/null

      - name: Run AI fix analysis
        id: ai_fix
        env:
          GITHUB_TOKEN:      ${{ secrets.GITHUB_TOKEN }}
          GEMINI_API_KEY:    ${{ secrets.GEMINI_API_KEY }}
          GEMINI_MODEL:      ${{ vars.GEMINI_MODEL }}
          GITHUB_REPOSITORY: ${{ github.repository }}
        run: |
          .github/scripts/ai-issue-fix.sh "${{ github.event.issue.number }}"

      - name: Check for changes
        id: check_changes
        run: |
          if git diff --quiet && git diff --staged --quiet; then
            echo "has_changes=false" >> $GITHUB_OUTPUT
            echo "No file changes produced"
          else
            echo "has_changes=true" >> $GITHUB_OUTPUT
            git diff --name-only
          fi

      - name: Create pull request with AI fixes
        if: steps.check_changes.outputs.has_changes == 'true'
        id: create_pr
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          git config --global user.name  "AI Issue Fixer"
          git config --global user.email "ai-fixer@github.com"

          ISSUE_NUMBER="${{ github.event.issue.number }}"
          ISSUE_TITLE="${{ github.event.issue.title }}"

          # Read the Jira key from the issue body
          ISSUE_BODY=$(curl -s \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/${{ github.repository }}/issues/${ISSUE_NUMBER}" \
            | jq -r '.body // ""')
          JIRA_KEY=$(echo "$ISSUE_BODY" | grep -oP '(?<=<!-- jira-key: )[A-Z]+-[0-9]+(?= -->)' || true)

          # Create a timestamped branch
          TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
          BRANCH="ai-fix/issue-${ISSUE_NUMBER}-${TIMESTAMP}"
          git checkout -b "$BRANCH"

          git add -A

          # Commit — include "Fixes #N" so GitHub auto-closes the issue on merge
          ANALYSIS=$(cat /tmp/ai_analysis.txt 2>/dev/null || echo "AI-generated code changes")
          COMMIT_BODY="Fixes #${ISSUE_NUMBER}"
          [ -n "$JIRA_KEY" ] && COMMIT_BODY="${COMMIT_BODY}
Jira: ${JIRA_KEY}"

          git commit -m "fix: AI-generated fix for issue #${ISSUE_NUMBER}

${ANALYSIS}

${COMMIT_BODY}"

          git push origin "$BRANCH"

          # Build PR title
          if [ -n "$JIRA_KEY" ]; then
            PR_TITLE="[${JIRA_KEY}] ${ISSUE_TITLE} (Closes #${ISSUE_NUMBER})"
          else
            PR_TITLE="[AI Fix] ${ISSUE_TITLE} (Closes #${ISSUE_NUMBER})"
          fi

          # Build PR body — embed the Jira key so close-on-merge.yml can find it
          PR_BODY=$(python3 - << PYEOF
import json, os, subprocess

issue_num = os.environ['ISSUE_NUMBER']
jira_key  = os.environ.get('JIRA_KEY', '')
analysis  = open('/tmp/ai_analysis.txt').read() \
            if os.path.exists('/tmp/ai_analysis.txt') else 'AI-generated fix'

changed = subprocess.run(
    ['git', 'diff', '--name-only', 'HEAD~1'],
    capture_output=True, text=True
).stdout.strip().split('\n')

lines = [
    '## 🤖 AI-Generated Fix',
    '',
    f'This PR resolves GitHub issue #{issue_num} using Gemini AI analysis.',
    '',
    '### Analysis',
    analysis,
    '',
    '### Changed Files',
]
for f in changed:
    if f: lines.append(f'- \`{f}\`')

lines += [
    '',
    '---',
    f'Fixes #{issue_num}',
]
if jira_key:
    lines.append(f'<!-- jira-key: {jira_key} -->')

print('\n'.join(lines))
PYEOF
)

          PR_BODY_JSON=$(echo "$PR_BODY" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))")
          PR_TITLE_JSON=$(echo "$PR_TITLE" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read().strip()))")

          PR_RESPONSE=$(curl -s -X POST \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/${{ github.repository }}/pulls" \
            -d "{\"title\": ${PR_TITLE_JSON}, \"body\": ${PR_BODY_JSON}, \"head\": \"${BRANCH}\", \"base\": \"main\"}")

          PR_NUMBER=$(echo "$PR_RESPONSE" | jq -r '.number // empty')
          PR_URL=$(echo "$PR_RESPONSE"    | jq -r '.html_url // empty')

          echo "pr_number=$PR_NUMBER" >> $GITHUB_OUTPUT
          echo "pr_url=$PR_URL"       >> $GITHUB_OUTPUT
          echo "✅ PR #${PR_NUMBER} created: $PR_URL"

      - name: Comment on issue with PR link
        if: steps.create_pr.outputs.pr_number != ''
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          ANALYSIS=$(cat /tmp/ai_analysis.txt 2>/dev/null || echo "See PR for details.")
          COMMENT="🤖 **AI Fix Generated**

**Analysis:** ${ANALYSIS}

**Pull Request:** ${{ steps.create_pr.outputs.pr_url }}

Once merged, this GitHub issue and the linked Jira issue will be automatically closed."

          COMMENT_JSON=$(echo "$COMMENT" | python3 -c "import json,sys; print(json.dumps({'body': sys.stdin.read()}))")

          curl -s -X POST \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/${{ github.repository }}/issues/${{ github.event.issue.number }}/comments" \
            -d "$COMMENT_JSON"

      - name: Comment when no changes were produced
        if: steps.check_changes.outputs.has_changes == 'false'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          curl -s -X POST \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/${{ github.repository }}/issues/${{ github.event.issue.number }}/comments" \
            -d '{"body":"🤖 **AI Analysis Complete** — No code changes were identified for this issue. Provide more detail or use `!fix <extra context>` to give the AI more guidance."}'
```

---

## Step 7 — Create `.github/workflows/close-on-merge.yml`

When a PR is merged, extract the Jira key from the PR body and close the Jira issue. The GitHub issue is closed automatically by GitHub because of `Fixes #N` in the PR body.

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
      pull-requests: read

    steps:
      - name: Install jq
        run: sudo apt-get update -qq && sudo apt-get install -y -qq jq

      - name: Extract Jira key from PR body
        id: find_key
        run: |
          PR_BODY='${{ github.event.pull_request.body }}'

          JIRA_KEY=$(printf '%s' "$PR_BODY" \
            | grep -oP '(?<=<!-- jira-key: )[A-Z]+-[0-9]+(?= -->)' \
            | head -1 || true)

          if [ -n "$JIRA_KEY" ]; then
            echo "Found Jira key: $JIRA_KEY"
            echo "jira_key=$JIRA_KEY" >> $GITHUB_OUTPUT
          else
            echo "No Jira key found in PR body — nothing to close"
            echo "jira_key=" >> $GITHUB_OUTPUT
          fi

      - name: Close Jira issue
        if: steps.find_key.outputs.jira_key != ''
        env:
          JIRA_EMAIL:     ${{ secrets.JIRA_EMAIL }}
          JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
          JIRA_DOMAIN:    ${{ vars.JIRA_DOMAIN }}
          ISSUE_KEY:      ${{ steps.find_key.outputs.jira_key }}
        run: |
          echo "Closing Jira issue: $ISSUE_KEY"

          TRANSITIONS=$(curl -s \
            "https://${JIRA_DOMAIN}/rest/api/3/issue/${ISSUE_KEY}/transitions" \
            -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}")

          TRANSITION_ID=$(echo "$TRANSITIONS" | jq -r '
            .transitions[] |
            select(.name == "Done" or .name == "Closed" or .name == "Resolve Issue") |
            .id' | head -1)

          if [ -z "$TRANSITION_ID" ]; then
            echo "❌ No closing transition found for $ISSUE_KEY"
            echo "Available transitions: $(echo "$TRANSITIONS" | jq -r '.transitions[].name')"
            exit 0   # Don't fail the workflow — this is a Jira config issue
          fi

          HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
            "https://${JIRA_DOMAIN}/rest/api/3/issue/${ISSUE_KEY}/transitions" \
            -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
            -H "Content-Type: application/json" \
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

## Step 8 — (Optional) Kubernetes CronJob

Use this instead of the GitHub Actions schedule if you want Kubernetes to be the orchestrator. The CronJob triggers `jira-poll.yml` via `workflow_dispatch` every 10 minutes.

### `k8s/github-credentials-secret.yaml`

Fill in your values, then apply with `kubectl apply -f k8s/github-credentials-secret.yaml`.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: github-credentials
  namespace: automation   # change to your namespace
type: Opaque
stringData:
  pat: "ghp_YOUR_GITHUB_PERSONAL_ACCESS_TOKEN"   # needs repo + workflow scopes
  repository: "your-org/your-repo-name"
```

### `k8s/jira-poller-cronjob.yaml`

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: jira-github-poller
  namespace: automation
spec:
  schedule: "*/10 * * * *"
  concurrencyPolicy: Forbid              # skip run if previous one is still going
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: poller
              image: curlimages/curl:latest
              command:
                - /bin/sh
                - -c
                - |
                  echo "Triggering jira-poll workflow for ${GITHUB_REPOSITORY}..."
                  HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
                    -H "Accept: application/vnd.github+json" \
                    -H "Authorization: Bearer ${GITHUB_PAT}" \
                    -H "X-GitHub-Api-Version: 2022-11-28" \
                    "https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/jira-poll.yml/dispatches" \
                    -d '{"ref":"main"}')
                  echo "GitHub API response: HTTP ${HTTP}"
                  [ "$HTTP" = "204" ] && echo "✅ Triggered" || echo "❌ Failed (HTTP ${HTTP})"
              env:
                - name: GITHUB_PAT
                  valueFrom:
                    secretKeyRef:
                      name: github-credentials
                      key: pat
                - name: GITHUB_REPOSITORY
                  valueFrom:
                    secretKeyRef:
                      name: github-credentials
                      key: repository
```

Deploy:
```bash
kubectl create namespace automation
kubectl apply -f k8s/github-credentials-secret.yaml
kubectl apply -f k8s/jira-poller-cronjob.yaml

# Verify
kubectl get cronjob -n automation
kubectl create job --from=cronjob/jira-github-poller manual-test-1 -n automation
kubectl logs -n automation job/manual-test-1
```

---

## Step 9 — End-to-end test

Follow this sequence to verify the full pipeline manually:

**1. Test Jira → GitHub issue creation**

Go to Actions → "Jira → GitHub Issues" → Run workflow (manually).

Check that a GitHub issue appears with:
- Title: `[PROJ-123] Your Jira summary`
- Labels: `jira:PROJ-123` and `from-jira`
- Body: the hidden comment `<!-- jira-key: PROJ-123 -->`

**2. Test AI fix trigger**

On the newly created GitHub issue, either:
- Add the `ai-fix` label, or
- Post a comment with exactly `!fix`

The `ai-fix-from-issue.yml` workflow will start. Check the Actions tab. When it finishes you should see:
- A new branch `ai-fix/issue-N-TIMESTAMP`
- A PR opened with `Fixes #N` and `<!-- jira-key: PROJ-123 -->` in the body
- A comment on the issue with the PR link

**3. Test close-on-merge**

Merge the PR. The `close-on-merge.yml` workflow runs and:
- Closes the Jira issue (transitions to Done/Closed)
- Posts a confirmation comment on the PR
- The GitHub issue is auto-closed by GitHub because of `Fixes #N`

---

## Notes and caveats

- **Jira transition name**: If your Jira project uses a different transition name than `Done`/`Closed`/`Resolve Issue`, add it to the `select(.name == ...)` filter in `close-on-merge.yml`.
- **Default branch**: All workflows use `main` as the base branch. Change it if your repo uses a different default.
- **GitHub Actions schedule jitter**: GitHub's cron scheduler has ~1 min jitter and doesn't guarantee exact 10-minute intervals. Use the Kubernetes CronJob for stricter timing.
- **Gemini context limit**: The script caps context at ~70,000 chars. For very large repos, tune `MAX_CHARS` and `head -200` in the file tree scan.
- **GitHub PAT for K8s**: The PAT needs `repo` and `workflow` scopes to trigger `workflow_dispatch`.

## What was reused from AI-SDLC

| Source file | Reused in |
|---|---|
| `dependabot-jira.yml` close job | `close-on-merge.yml` — exact same Jira transitions API pattern |
| `dependabot-jira.yml` ADF builder (Python block) | `jira-poll.yml` — ADF → Markdown converter |
| `ai-code-fixes.yml` Gemini API call pattern | `ai-issue-fix.sh` — same `curl` + `jq -n` structure |
| `ai-code-fixes.yml` PR creation block | `ai-fix-from-issue.yml` — branch, commit, push, PR API call |
| `dependabot-automation.yml` `REQUEST_JSON` builder | `ai-issue-fix.sh` — `jq -n --rawfile` pattern |
| `ai-fix-utils.sh` keyword scoring + file context | `ai-issue-fix.sh` — relevance scoring loop |


That's the complete guide. Here's a quick checklist of what to do in order:

1. Create repo on GitHub
2. Add 5 secrets + 4 variables in repo settings
3. Create ai-fix and from-jira labels manually once
4. Create .github/scripts/ai-issue-fix.sh (chmod +x it)
5. Create the 3 workflow files
6. (Optional) Apply K8s manifests with kubectl
7. Run jira-poll.yml manually to test issue creation, then trigger !fix

The only thing you'll likely need to adjust is the Jira transition name in close-on-merge.yml — if your Jira project uses a different name than Done/Closed/Resolve Issue, add it to the select(.name == ...) filter.