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

# Import following — follow imports from planner-identified files
# up to 2 levels deep, capped at 20 additional files
log_info "Following imports from planner-identified files..."

IMPORT_FILE_LIST=$(SEED_FILES="$TARGETED_FILE_LIST" python3 << 'PYEOF'
import re, os, sys

EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss']
MAX_DEPTH  = 2
MAX_FILES  = 20

def resolve_import(base_file, import_path):
    """Resolve a relative import to an actual file path."""
    # Ignore node_modules and non-relative imports
    if not import_path.startswith('.'):
        return None
    base_dir  = os.path.dirname(base_file)
    candidate = os.path.normpath(os.path.join(base_dir, import_path))
    # Exact match (e.g. .css files)
    if os.path.isfile(candidate):
        return candidate
    # Try adding extensions
    for ext in EXTENSIONS:
        if os.path.isfile(candidate + ext):
            return candidate + ext
    # Try index files (e.g. import from './Button' → Button/index.tsx)
    for ext in EXTENSIONS:
        index = os.path.join(candidate, 'index' + ext)
        if os.path.isfile(index):
            return index
    return None

def get_imports(file_path):
    """Extract relative import paths from a file."""
    try:
        content = open(file_path, encoding='utf-8', errors='ignore').read()
    except Exception:
        return []
    patterns = [
        r'import\s+.*?\s+from\s+[\'"]([^\'"]+)[\'"]',
        r'import\s+[\'"]([^\'"]+)[\'"]',
        r'require\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)',
    ]
    paths = []
    for pat in patterns:
        paths.extend(re.findall(pat, content))
    return paths

seed_files = os.environ.get('SEED_FILES', '').split()
visited    = set(seed_files)
queue      = [(f, 0) for f in seed_files if os.path.isfile(f)]
found      = []

while queue and len(found) < MAX_FILES:
    file_path, depth = queue.pop(0)
    if depth >= MAX_DEPTH:
        continue
    for imp in get_imports(file_path):
        resolved = resolve_import(file_path, imp)
        if resolved and resolved not in visited:
            visited.add(resolved)
            found.append(resolved)
            queue.append((resolved, depth + 1))
            if len(found) >= MAX_FILES:
                break

print('\n'.join(found))
PYEOF
)

IMPORT_COUNT=0
for file in $IMPORT_FILE_LIST; do
  [ -f "$file" ] || continue
  [ "$TOTAL_CHARS" -ge "$MAX_CHARS" ] && break
  # Skip files already included
  echo "$CONTEXT_FILES" | grep -q "### ${file}" && continue
  SNIPPET=$(head -c 3000 "$file")
  CONTEXT_FILES="${CONTEXT_FILES}
### ${file} (via import)
\`\`\`
${SNIPPET}
\`\`\`
"
  TOTAL_CHARS=$((TOTAL_CHARS + ${#SNIPPET}))
  IMPORT_COUNT=$((IMPORT_COUNT + 1))
done
log_info "Import following added ${IMPORT_COUNT} file(s)"

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
7. CRITICAL: Preserve ALL existing code that is unrelated to the issue. Do not remove, rewrite, or clean up existing CSS rules, functions, comments, or styles — even if you think they could be improved. Only ADD or MODIFY what the issue specifically requires.

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

# ── Helper: parse AI response JSON and apply file changes ──────
# Usage: apply_ai_response <response_file>
apply_ai_response() {
  local response_file="$1"
  AI_PROVIDER_ENV="${AI_PROVIDER}" RESPONSE_FILE="$response_file" python3 << 'PYEOF'
import json, sys, os, re

provider      = os.environ.get("AI_PROVIDER_ENV", "github")
response_file = os.environ.get("RESPONSE_FILE", "/tmp/ai_response.json")

with open(response_file) as f:
    resp = json.load(f)

if provider == "gemini":
    candidates = resp.get('candidates') or []
    if not candidates:
        print("[ERROR] No candidates in Gemini response", file=sys.stderr)
        sys.exit(1)
    raw_text = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '')
else:
    choices = resp.get('choices') or []
    if not choices:
        print("[ERROR] No choices in GitHub Models response", file=sys.stderr)
        sys.exit(1)
    raw_text = choices[0].get('message', {}).get('content', '')

if not raw_text:
    print("[ERROR] Empty response from AI", file=sys.stderr)
    sys.exit(1)

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
}

# ── 6. Parse response and apply file changes ───────────────────
log_info "Parsing AI response and applying changes..."
apply_ai_response /tmp/ai_response.json

# ── 7. Self-healing error loop ─────────────────────────────────
MAX_HEAL_ITERATIONS=2
HEAL_ITERATION=0

# Find TypeScript project root (frontend/ or repo root)
TSC_DIR=""
if [ -f "frontend/tsconfig.json" ]; then
  TSC_DIR="frontend"
elif [ -f "tsconfig.json" ]; then
  TSC_DIR="."
fi

while [ "$HEAL_ITERATION" -lt "$MAX_HEAL_ITERATIONS" ]; do
  ERRORS=""

  if [ -n "$TSC_DIR" ]; then
    log_info "Running type check in ${TSC_DIR}..."

    # Always run npm install to pick up any new packages the AI added
    log_info "Installing dependencies in ${TSC_DIR}..."
    (cd "$TSC_DIR" && npm install --silent 2>/dev/null) || true

    TSC_OUT=$((cd "$TSC_DIR" && npx tsc --noEmit 2>&1) || true)
    if [ -n "$TSC_OUT" ]; then
      log_warning "TypeScript errors found"
      ERRORS="TypeScript errors:\n${TSC_OUT}"
    fi
  fi

  # No errors — we're done
  if [ -z "$ERRORS" ]; then
    log_success "No errors found — fix is clean"
    break
  fi

  HEAL_ITERATION=$((HEAL_ITERATION + 1))
  log_warning "Healing pass ${HEAL_ITERATION}/${MAX_HEAL_ITERATIONS}..."

  # Collect current content of all changed files
  CHANGED_FILES=$(git diff --name-only 2>/dev/null || true)
  CHANGED_CONTENTS=""
  for f in $CHANGED_FILES; do
    [ -f "$f" ] || continue
    CHANGED_CONTENTS="${CHANGED_CONTENTS}
### ${f}
\`\`\`
$(cat "$f")
\`\`\`
"
  done

  printf '%s' "You are an expert software engineer. A previous AI fix introduced errors.
Fix only what is needed to resolve the errors below — do not change the intended behaviour.

## Original Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}

## Errors to fix
$(printf '%b' "$ERRORS")

## Current state of changed files
${CHANGED_CONTENTS}

Rules:
1. Return ONLY a valid JSON object — no markdown, no text outside the JSON.
2. Include the COMPLETE file content for every file you modify.
3. Do not revert the original fix — only correct the errors.

Return this exact structure:
{
  \"analysis\": \"What errors you found and how you fixed them\",
  \"changes\": [
    {
      \"file\": \"relative/path/to/file.ext\",
      \"action\": \"modify\",
      \"content\": \"complete corrected file content\"
    }
  ]
}" > /tmp/ai_heal_prompt.txt

  HTTP_CODE=$(call_ai /tmp/ai_heal_prompt.txt /tmp/ai_heal_response.json)
  log_info "Healing API status: ${HTTP_CODE}"
  check_http "$HTTP_CODE" "${AI_PROVIDER}" /tmp/ai_heal_response.json

  apply_ai_response /tmp/ai_heal_response.json

  if [ "$HEAL_ITERATION" -ge "$MAX_HEAL_ITERATIONS" ]; then
    log_warning "Max healing iterations (${MAX_HEAL_ITERATIONS}) reached — some errors may remain"
  fi
done

# ── 8. Requirements validation pass ───────────────────────────
log_info "Step 3/3 — Validating implementation against requirements..."

# Collect current state of all changed files
CHANGED_FILES=$(git diff --name-only 2>/dev/null || true)
CHANGED_CONTENTS=""
for f in $CHANGED_FILES; do
  [ -f "$f" ] || continue
  CHANGED_CONTENTS="${CHANGED_CONTENTS}
### ${f}
\`\`\`
$(cat "$f")
\`\`\`
"
done

if [ -z "$CHANGED_CONTENTS" ]; then
  log_info "No changed files to validate — skipping"
else
  printf '%s' "You are an expert software engineer doing a final review.
An AI implemented a fix for a GitHub issue. Your job is to check whether
every requirement in the issue is actually satisfied by the implementation.

## Original Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}

${ISSUE_BODY}

## Current Implementation (all changed files)
${CHANGED_CONTENTS}

## Your task

Go through each requirement in the issue one by one and check if it is
fully implemented in the code above.

Return ONLY a valid JSON object:
{
  \"satisfied\": true or false,
  \"gaps\": [\"list of requirements that are missing or incorrectly implemented\"],
  \"analysis\": \"Summary of what is correct and what is missing\",
  \"changes\": []
}

If all requirements are satisfied, return satisfied: true and an empty changes array.
If there are gaps, return satisfied: false and include the fixes in changes:
{
  \"satisfied\": false,
  \"gaps\": [\"missing redirect to home after login\"],
  \"analysis\": \"The login sets isAuthenticated but never navigates to home\",
  \"changes\": [
    {
      \"file\": \"relative/path/to/file.ext\",
      \"action\": \"modify\",
      \"content\": \"complete corrected file content\"
    }
  ]
}" > /tmp/ai_validate_prompt.txt

  HTTP_CODE=$(call_ai /tmp/ai_validate_prompt.txt /tmp/ai_validate_response.json)
  log_info "Validation API status: ${HTTP_CODE}"
  check_http "$HTTP_CODE" "${AI_PROVIDER}" /tmp/ai_validate_response.json

  # Parse validation response — write to file first to avoid pipe+heredoc conflict
  extract_text /tmp/ai_validate_response.json > /tmp/ai_validation_text.txt

  SATISFIED=$(AI_PROVIDER_ENV="${AI_PROVIDER}" python3 << 'PYEOF'
import json, sys, re, os

with open('/tmp/ai_validation_text.txt') as f:
    raw = f.read().strip()

clean = re.sub(r'^```(?:json)?\s*\n?', '', raw)
clean = re.sub(r'\n?```\s*$', '', clean.strip())

try:
    data = json.loads(clean)
except Exception:
    match = re.search(r'\{[\s\S]+\}', clean)
    data = json.loads(match.group()) if match else {}

satisfied = data.get('satisfied', True)
gaps      = data.get('gaps', [])
analysis  = data.get('analysis', '')

print(f"[INFO] Validation: {'PASSED' if satisfied else 'FAILED'}", file=sys.stderr)
if gaps:
    for gap in gaps:
        print(f"[WARNING] Gap: {gap}", file=sys.stderr)

# Save validation result for PR description
with open('/tmp/ai_validation.txt', 'w') as f:
    f.write(f"Validation: {'PASSED' if satisfied else 'FAILED'}\n")
    if gaps:
        f.write("Gaps found:\n")
        for g in gaps:
            f.write(f"- {g}\n")

# Write changes to file if any gaps need fixing
changes = data.get('changes', [])
if not satisfied and changes:
    with open('/tmp/ai_validate_changes.json', 'w') as f:
        json.dump({'analysis': analysis, 'changes': changes}, f)
    print("NEEDS_FIX")
else:
    print("OK")
PYEOF
  )

  if echo "$SATISFIED" | grep -q "NEEDS_FIX"; then
    log_warning "Requirements gaps found — applying fixes..."
    apply_ai_response /tmp/ai_validate_response.json
    log_success "Validation fixes applied"
  else
    log_success "All requirements satisfied — implementation is complete"
  fi
fi
