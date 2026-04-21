#!/bin/bash
# ──────────────────────────────────────────────────────────────
# ai-issue-fix.sh — AI-powered code fix from a GitHub issue
#
# Usage: ai-issue-fix.sh <github_issue_number>
#
# Required env vars:
#   GITHUB_TOKEN, GITHUB_REPOSITORY
# Optional:
#   AI_PROVIDER   (default: github — options: github, gemini)
#   GEMINI_API_KEY, GEMINI_MODEL  (required when AI_PROVIDER=gemini)
# ──────────────────────────────────────────────────────────────

# This script is the core AI engine. It fetches the issue, builds context from the repo, calls the AI provider and writes the file changes to disk.

set -euo pipefail

ISSUE_NUMBER="${1:?Usage: ai-issue-fix.sh <issue_number>}"
AI_PROVIDER="${AI_PROVIDER:-github}"
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

# ── 4. Build AI prompt ────────────────────────────────────────
cat > /tmp/ai_prompt.txt << PROMPT
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

# ── 5. Call AI API ────────────────────────────────────────────
if [ "${AI_PROVIDER}" = "gemini" ]; then
  log_info "Calling Gemini (model: ${GEMINI_MODEL})..."

  REQUEST_JSON=$(jq -n --rawfile text /tmp/ai_prompt.txt '{
    contents: [{ parts: [{ text: $text }] }],
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 8192
    }
  }')

  HTTP_CODE=$(curl -sS \
    -o /tmp/ai_response.json \
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
    cat /tmp/ai_response.json >&2
    exit 1
  fi

else
  log_info "Calling GitHub Models (gpt-4o-mini)..."

  PROMPT_TEXT=$(cat /tmp/ai_prompt.txt)
  REQUEST_JSON=$(jq -n --arg prompt "$PROMPT_TEXT" '{
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert software engineer. Return only valid JSON as instructed." },
      { role: "user", content: $prompt }
    ],
    temperature: 0.15,
    max_tokens: 8192
  }')

  HTTP_CODE=$(curl -sS \
    -o /tmp/ai_response.json \
    -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    "https://models.inference.ai.azure.com/chat/completions" \
    -d "$REQUEST_JSON" || echo "000")

  log_info "GitHub Models HTTP status: ${HTTP_CODE}"

  if [ "$HTTP_CODE" = "429" ]; then
    log_warning "GitHub Models rate limited (429) — no changes will be made"
    exit 0
  fi

  if [ "$HTTP_CODE" != "200" ]; then
    log_error "GitHub Models API call failed (HTTP ${HTTP_CODE})"
    cat /tmp/ai_response.json >&2
    exit 1
  fi
fi

# ── 6. Parse response and apply file changes ───────────────────
log_info "Parsing AI response (provider: ${AI_PROVIDER})..."

AI_PROVIDER_ENV="${AI_PROVIDER}" python3 << 'PYEOF'
import json, sys, os, re

provider = os.environ.get("AI_PROVIDER_ENV", "github")

with open('/tmp/ai_response.json') as f:
    resp = json.load(f)

if provider == "gemini":
    candidates = resp.get('candidates') or []
    if not candidates:
        print("[ERROR] No candidates in Gemini response", file=sys.stderr)
        sys.exit(1)
    raw_text = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '')
    if not raw_text:
        print("[ERROR] Empty text in Gemini response", file=sys.stderr)
        sys.exit(1)
else:
    choices = resp.get('choices') or []
    if not choices:
        print("[ERROR] No choices in GitHub Models response", file=sys.stderr)
        sys.exit(1)
    raw_text = choices[0].get('message', {}).get('content', '')
    if not raw_text:
        print("[ERROR] Empty content in GitHub Models response", file=sys.stderr)
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
            print(f"[ERROR] Could not parse JSON from AI response: {e}", file=sys.stderr)
            print(f"First 500 chars: {raw_text[:500]}", file=sys.stderr)
            sys.exit(1)
    else:
        print("[ERROR] No JSON object found in AI response", file=sys.stderr)
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
    print("[WARNING] AI returned no file changes")
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