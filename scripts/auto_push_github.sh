#!/usr/bin/env bash
# Auto-commit dirty workspace and push to origin every N hours (via cron).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_DIR/logs"
LOG_FILE="$LOG_DIR/auto_push_github.log"
LOCK_FILE="$LOG_DIR/auto_push_github.lock"
REMOTE="${AUTO_PUSH_REMOTE:-origin}"
BRANCH="${AUTO_PUSH_BRANCH:-main}"
MAX_LOG_BYTES=1048576

mkdir -p "$LOG_DIR"
cd "$REPO_DIR"

log() {
  local ts
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "[$ts] $*" | tee -a "$LOG_FILE"
}

# Rotate log if too large
if [[ -f "$LOG_FILE" ]] && [[ "$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)" -gt "$MAX_LOG_BYTES" ]]; then
  mv -f "$LOG_FILE" "${LOG_FILE}.1"
fi

# Prevent concurrent runs
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "skip: another auto_push is running"
  exit 0
fi

log "start repo=$REPO_DIR remote=$REMOTE branch=$BRANCH"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "error: not a git repository"
  exit 1
fi

# Ensure identity exists
if [[ -z "$(git config user.name || true)" ]]; then
  git config user.name "haogu2135-ui"
fi
if [[ -z "$(git config user.email || true)" ]]; then
  git config user.email "haogu2135-ui@users.noreply.github.com"
fi

# Detect current branch; fall back to main
current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)"
if [[ "$current_branch" == "HEAD" ]]; then
  current_branch="$BRANCH"
fi

# Stage all tracked+untracked except ignored
git add -A

if git diff --cached --quiet; then
  log "no local changes to commit"
else
  # Safety: refuse if staged files look like secrets
  if git diff --cached --name-only | rg -i '(^|/)\.env$|\.pem$|id_rsa|credentials\.json|secret|api[_-]?key' >/dev/null 2>&1; then
    log "error: refusing to commit potential secret files:"
    git diff --cached --name-only | rg -i '(^|/)\.env$|\.pem$|id_rsa|credentials\.json|secret|api[_-]?key' | tee -a "$LOG_FILE" || true
    git reset >/dev/null
    exit 1
  fi

  msg="chore: auto snapshot $(date -u '+%Y-%m-%d %H:%M UTC')"
  git commit -m "$msg" --no-gpg-sign
  log "committed: $msg"
fi

# Push if remote exists
if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  log "error: remote '$REMOTE' not configured"
  exit 1
fi

# Ensure branch name for first push
if ! git show-ref --verify --quiet "refs/heads/$current_branch"; then
  git branch -M "$BRANCH"
  current_branch="$BRANCH"
fi

set +e
push_out="$(git push -u "$REMOTE" "$current_branch" 2>&1)"
push_code=$?
set -e
echo "$push_out" | tee -a "$LOG_FILE"
if [[ $push_code -ne 0 ]]; then
  log "push failed (exit $push_code). Configure GitHub auth (PAT/SSH) if needed."
  exit $push_code
fi

log "push ok -> $REMOTE/$current_branch"
exit 0
