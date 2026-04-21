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

# Two-step process:
#   Step 1 — Planning: AI reads the issue and file tree, identifies
#             which files to change and outlines a plan.
#   Step 2 — Implementation: AI receives the plan + targeted file
#             contents and produces the actual code changes.

set -euo pipefail

ISSUE_NUMBER="${1:?Usage: ai-issue-fix.sh <issue_number>}"
AI_PROVIDER="${AI_PROVIDER:-github}"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# ── Helper: call AI API ────────────────────────────────────────
# Usage: call_ai <prompt_file> <response_file>
# Returns the HTTP status code.
call_ai() {
  local prompt_file="$1"
  local response_file="$2"

  if [ "${AI_PROVIDER}" = "gemini" ]; then
    local req
    req=$(jq -n --rawfile text "$prompt_file" '{
      contents: [{ parts: [{ text: $text }] }],
      generationConfig: { temperature: 0.15, maxOutputTokens: 8192 }
    }')
    curl -sS -o "$response_file" -w "%{http_code}" \
      -H "Content-Type: application/json" \
      -H "x-goog-api-key: ${GEMINI_API_KEY}" \
      "https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent" \
      -d "$req" || echo "000"
  else
    local prompt_text req
    prompt_text=$(cat "$prompt_file")
    req=$(jq -n --arg p "$prompt_text" '{
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert software engineer. Return only valid JSON as instructed." },
        { role: "user", content: $p }
      ],
      temperature: 0.15,
      max_tokens: 8192
    }')
    curl -sS -o "$response_file" -w "%{http_code}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      "https://models.inference.ai.azure.com/chat/completions" \
      -d "$req" || echo "000"
  fi
}

# ── Helper: extract text from AI response ─────────────────────
extract_text() {
  local response_file="$1"
  if [ "${AI_PROVIDER}" = "gemini" ]; then
    jq -r '.candidates[0].content.parts[0].text // ""' "$response_file"
  else
    jq -r '.choices[0].message.content // ""' "$response_file"
  fi
}

# ── Helper: handle non-200 API responses ──────────────────────
check_http() {
  local code="$1" label="$2" response_file="$3"
  if [ "$code" = "429" ]; then
    log_warning "${label} rate limited (429) — no changes will be made"
    exit 0
  fi
  if [ "$code" != "200" ]; then
    log_error "${label} API call failed (HTTP ${code})"
    cat "$response_file" >&2
    exit 1
  fi
}

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

# Always include key structural files for context
STRUCTURAL_FILES=""
for f in package.json tsconfig.json public/index.html; do
  [ -f "$f" ] && STRUCTURAL_FILES="${STRUCTURAL_FILES}
### ${f}
\`\`\`
$(cat "$f")
\`\`\`
"
done

# ── 3. STEP 1 — Planning ───────────────────────────────────────
log_info "Step 1/2 — Planning which files to change..."

cat > /tmp/ai_plan_prompt.txt << PROMPT
You are an expert software engineer. A GitHub issue describes a required code change.
Your job right now is NOT to write code — only to plan.

## Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}

${ISSUE_BODY}

## Repository File Tree
\`\`\`
${FILE_TREE}
\`\`\`

## Structural Files
${STRUCTURAL_FILES}

## Instructions

Think step by step about what needs to change to resolve this issue.

Return ONLY a valid JSON object — no markdown, no text outside the JSON:
{
  "understanding": "One paragraph: what is this issue asking for?",
  "files_to_read": ["list of file paths from the tree that are relevant and need to be read"],
  "plan": "Step-by-step plan of exactly what to change and why"
}
PROMPT

HTTP_CODE=$(call_ai /tmp/ai_plan_prompt.txt /tmp/ai_plan_response.json)
log_info "Planning API status: ${HTTP_CODE}"
check_http "$HTTP_CODE" "${AI_PROVIDER}" /tmp/ai_plan_response.json

PLAN_TEXT=$(extract_text /tmp/ai_plan_response.json)

# Parse the plan to get targeted file list and plan text
read -r TARGETED_FILE_LIST PLAN_SUMMARY <<< "$(echo "$PLAN_TEXT" | python3 << 'PYEOF'
import json, sys, re

raw = sys.stdin.read().strip()
clean = re.sub(r'^```(?:json)?\s*\n?', '', raw)
clean = re.sub(r'\n?```\s*$', '', clean.strip())

try:
    data = json.loads(clean)
except Exception:
    match = re.search(r'\{[\s\S]+\}', clean)
    data = json.loads(match.group()) if match else {}

files = data.get('files_to_read', [])
plan  = data.get('plan', '')
understanding = data.get('understanding', '')

# Write plan to file for later use
with open('/tmp/ai_plan.txt', 'w') as f:
    f.write(f"Understanding:\n{understanding}\n\nPlan:\n{plan}")

# Print file list (space-separated) and summary on one line for bash read
file_list = ' '.join(files)
print(file_list + '\t' + plan.replace('\n', ' ')[:200])
PYEOF
)"

log_info "Plan written to /tmp/ai_plan.txt"
log_info "Files identified by planner: ${TARGETED_FILE_LIST:-none}"

# ── 4. Gather targeted file contents ──────────────────────────
log_info "Collecting targeted file contents..."

CONTEXT_FILES=""
TOTAL_CHARS=0
MAX_CHARS=70000

# Files identified by the planner
for file in $TARGETED_FILE_LIST; do
  [ -f "$file" ] || continue
  [ "$TOTAL_CHARS" -ge "$MAX_CHARS" ] && break
  SNIPPET=$(head -c 4000 "$file")
  CONTEXT_FILES="${CONTEXT_FILES}
### ${file}
\`\`\`
${SNIPPET}
\`\`\`
"
  TOTAL_CHARS=$((TOTAL_CHARS + ${#SNIPPET}))
done

# Keyword-scored fallback for any remaining budget
KEYWORDS=$(echo "${ISSUE_TITLE} ${ISSUE_BODY}" \
  | tr '[:upper:]' '[:lower:]' \
  | grep -oE '[a-zA-Z]{4,}' \
  | sort | uniq -c | sort -rn \
  | head -15 | awk '{print $2}')

while IFS= read -r file; do
  [ -f "$file" ] || continue
  [ "$TOTAL_CHARS" -ge "$MAX_CHARS" ] && break
  # Skip files already included
  echo "$CONTEXT_FILES" | grep -q "### ${file}" && continue

  SCORE=0
  for kw in $KEYWORDS; do
    echo "$file" | grep -qi "$kw" 2>/dev/null && SCORE=$((SCORE + 2))
    grep -qi "$kw" "$file"         2>/dev/null && SCORE=$((SCORE + 1))
  done

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

FILE_COUNT=$(echo "$CONTEXT_FILES" | grep -c '^###' || echo 0)
log_info "Context: ~${TOTAL_CHARS} chars across ${FILE_COUNT} files"

# ── 5. STEP 2 — Implementation ────────────────────────────────
log_info "Step 2/2 — Implementing the plan..."

PLAN_CONTENT=$(cat /tmp/ai_plan.txt 2>/dev/null || echo "No plan available")

cat > /tmp/ai_prompt.txt << PROMPT
You are an expert software engineer. Implement the plan below exactly.

## Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}

${ISSUE_BODY}

## Plan (from analysis step)

${PLAN_CONTENT}

## Structural Files
${STRUCTURAL_FILES}

## Relevant File Contents

${CONTEXT_FILES}

## Instructions

Implement the code changes described in the plan above.

Rules:
1. Return ONLY a valid JSON object — no markdown, no text outside the JSON.
2. Include the COMPLETE file content for every modified/created file.
3. Follow the existing code style, naming conventions, and project structure.
4. Only change files necessary to fulfill the issue. Do not refactor unrelated code.
5. action must be one of: "modify", "create". Do not delete files unless the issue explicitly asks.
6. Make sure your changes are consistent across all files — if a component is renamed, update all imports too.

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

HTTP_CODE=$(call_ai /tmp/ai_prompt.txt /tmp/ai_response.json)
log_info "Implementation API status: ${HTTP_CODE}"
check_http "$HTTP_CODE" "${AI_PROVIDER}" /tmp/ai_response.json

# ── 6. Parse response and apply file changes ───────────────────
log_info "Parsing AI response and applying changes..."

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

# Strip markdown code fences
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
