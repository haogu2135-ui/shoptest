#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${SHOPTEST_PROJECT_DIR:-/home/guhao/shoptest}"
ROOT_ISSUE_DIR="${SHOPTEST_ROOT_ISSUE_DIR:-/root/shoptest}"
STATE_DIR="${SHOPTEST_BUG_STATE_DIR:-${ROOT_ISSUE_DIR}/bug-maintenance-state}"
ISSUE_FILE="${ROOT_ISSUE_DIR}/FRONTEND_SUBMITTED_BUGS_ISSUES.md"
HISTORY_FILE="${ROOT_ISSUE_DIR}/BUG_SCAN_HISTORY_ISSUES.md"
QUEUE_TSV="${STATE_DIR}/latest-submitted-bugs.tsv"
PROMPT_FILE="${STATE_DIR}/scheduled-codex-prompt.md"
LOCK_FILE="${STATE_DIR}/bug-maintenance.lock"
SCAN_LIMIT="${SHOPTEST_BUG_SCAN_LIMIT:-20}"
SCAN_INTERVAL_MINUTES="${SHOPTEST_BUG_SCAN_INTERVAL_MINUTES:-30}"
AUTOFIX="${SHOPTEST_BUG_AUTOFIX:-true}"
CODEX_TIMEOUT="${SHOPTEST_BUG_CODEX_TIMEOUT:-25m}"
CODEX_BIN="${SHOPTEST_CODEX_BIN:-$(command -v codex || true)}"
RESTART_THRESHOLD="${SHOPTEST_RESTART_FIXED_THRESHOLD:-20}"
CODEX_PERMISSION_ARGS=(
  -s danger-full-access
  -a never
  -c sandbox_mode=\"danger-full-access\"
  -c approval_policy=\"never\"
  -c shell_environment_policy.inherit=all
)

if [[ -n "$CODEX_BIN" ]]; then
  export PATH="$(dirname "$CODEX_BIN"):${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"
fi

fail() {
  echo "bug-maintenance-cycle: $*" >&2
  exit 1
}

db() {
  "${PROJECT_DIR}/scripts/shoptest-db-query.sh" "$@"
}

is_enabled() {
  case "${1,,}" in
    true|1|yes|y|on) return 0 ;;
    *) return 1 ;;
  esac
}

sql_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\'/\\\'}"
  printf "%s" "$value"
}

[[ -d "$PROJECT_DIR" ]] || fail "project directory not found: $PROJECT_DIR"
[[ -x "${PROJECT_DIR}/scripts/shoptest-db-query.sh" ]] || fail "db helper is not executable"

mkdir -p "$ROOT_ISSUE_DIR" "$STATE_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another bug maintenance cycle is running; skipping."
  exit 0
fi

now_iso="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
now_human="$(date -u +"%Y-%m-%d %H:%M UTC")"
if [[ ! -f "${STATE_DIR}/last_restart_epoch" ]]; then
  date -u +%s > "${STATE_DIR}/last_restart_epoch"
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "${STATE_DIR}/last_restart_at"
fi

summary_tsv="${STATE_DIR}/bug-summary.tsv"
db --batch --raw --skip-column-names -e "
SELECT status, COUNT(*)
FROM admin_bug_reports
GROUP BY status
ORDER BY status;
" > "$summary_tsv"

db --batch --raw --skip-column-names -e "
SELECT
  id,
  status,
  severity,
  priority,
  module,
  REPLACE(REPLACE(COALESCE(title, ''), CHAR(13), ' '), CHAR(10), ' ') AS title,
  LEFT(REPLACE(REPLACE(COALESCE(description, ''), CHAR(13), ' '), CHAR(10), ' '), 700) AS description_preview,
  COALESCE(NULLIF(LEFT(REPLACE(REPLACE(COALESCE(page_url, ''), CHAR(13), ' '), CHAR(10), ' '), 240), ''), 'n/a') AS page_url,
  COALESCE(NULLIF(LEFT(REPLACE(REPLACE(COALESCE(reproduction_steps, ''), CHAR(13), ' '), CHAR(10), ' '), 500), ''), 'n/a') AS reproduction_steps,
  COALESCE(NULLIF(LEFT(REPLACE(REPLACE(COALESCE(expected_result, ''), CHAR(13), ' '), CHAR(10), ' '), 300), ''), 'n/a') AS expected_result,
  COALESCE(NULLIF(LEFT(REPLACE(REPLACE(COALESCE(actual_result, ''), CHAR(13), ' '), CHAR(10), ' '), 300), ''), 'n/a') AS actual_result,
  COALESCE(NULLIF(reporter_name, ''), 'unknown') AS reporter_name,
  DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
  DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
FROM admin_bug_reports
WHERE status IN ('OPEN', 'REGRESSION_FAILED')
   OR (status = 'FIXING' AND (last_scanned_at IS NULL OR last_scanned_at <= DATE_SUB(NOW(), INTERVAL ${SCAN_INTERVAL_MINUTES} MINUTE)))
ORDER BY
  CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
  CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
  updated_at ASC,
  id ASC
LIMIT ${SCAN_LIMIT};
" > "$QUEUE_TSV"

recent_fixed_tsv="${STATE_DIR}/recent-fixed-submitted-bugs.tsv"
db --batch --raw --skip-column-names -e "
SELECT
  id,
  status,
  severity,
  priority,
  module,
  REPLACE(REPLACE(COALESCE(title, ''), CHAR(13), ' '), CHAR(10), ' ') AS title,
  DATE_FORMAT(fixed_at, '%Y-%m-%d %H:%i:%s') AS fixed_at,
  COALESCE(NULLIF(LEFT(REPLACE(REPLACE(COALESCE(fix_summary, scan_note, ''), CHAR(13), ' '), CHAR(10), ' '), 500), ''), 'n/a') AS fix_summary
FROM admin_bug_reports
WHERE status IN ('FIXED_PENDING_REGRESSION', 'REGRESSION_PASSED', 'NON_ISSUE')
  AND COALESCE(fixed_at, updated_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY COALESCE(fixed_at, updated_at) DESC, id DESC
LIMIT 20;
" > "$recent_fixed_tsv"

actionable_count="$(wc -l < "$QUEUE_TSV" | tr -d ' ')"
recent_fixed_count="$(wc -l < "$recent_fixed_tsv" | tr -d ' ')"
tmp_issue="${ISSUE_FILE}.tmp"
{
  printf '# Frontend Submitted Bug Scan Issues\n\n'
  printf 'Last scan: %s\n\n' "$now_human"
  printf 'Source table: `admin_bug_reports`\n\n'
  printf 'Scan cadence: every %s minutes via `shoptest-bug-maintenance.timer`.\n\n' "$SCAN_INTERVAL_MINUTES"
  printf '## Current Status Summary\n\n'
  printf '| Status | Count |\n|---|---:|\n'
  while IFS=$'\t' read -r status count; do
    [[ -n "${status:-}" ]] || continue
    printf '| `%s` | %s |\n' "$status" "$count"
  done < "$summary_tsv"
  printf '\n## Actionable Queue\n\n'
  if [[ "$actionable_count" -eq 0 ]]; then
    printf 'No submitted BUG rows are currently due for scan.\n'
  else
    printf '| ID | Status | Severity | Priority | Module | Title | Page | Reporter | Updated |\n'
    printf '|---:|---|---|---|---|---|---|---|---|\n'
    while IFS=$'\t' read -r id status severity priority module title description page_url steps expected actual reporter created updated; do
      printf '| %s | `%s` | `%s` | `%s` | `%s` | %s | %s | %s | %s |\n' \
        "$id" "$status" "$severity" "$priority" "$module" \
        "${title//|/ }" "${page_url//|/ }" "${reporter//|/ }" "$updated"
    done < "$QUEUE_TSV"
    printf '\n## Details For Fix Agent\n\n'
    while IFS=$'\t' read -r id status severity priority module title description page_url steps expected actual reporter created updated; do
      printf '### BUG-%s: %s\n\n' "$id" "$title"
      printf -- '- Status: `%s`; severity: `%s`; priority: `%s`; module: `%s`\n' "$status" "$severity" "$priority" "$module"
      printf -- '- Reporter: %s; created: %s; updated: %s\n' "${reporter:-unknown}" "$created" "$updated"
      printf -- '- Page: %s\n' "${page_url:-n/a}"
      printf -- '- Description: %s\n' "${description:-n/a}"
      printf -- '- Reproduction: %s\n' "${steps:-n/a}"
      printf -- '- Expected: %s\n' "${expected:-n/a}"
      printf -- '- Actual: %s\n\n' "${actual:-n/a}"
    done < "$QUEUE_TSV"
  fi
  printf '\n## Recently Fixed Or Classified\n\n'
  if [[ "$recent_fixed_count" -eq 0 ]]; then
    printf 'No submitted BUG rows were fixed or classified in the last 7 days.\n'
  else
    printf '| ID | Status | Severity | Priority | Module | Title | Fixed At | Summary |\n'
    printf '|---:|---|---|---|---|---|---|---|\n'
    while IFS=$'\t' read -r id status severity priority module title fixed_at fix_summary; do
      printf '| %s | `%s` | `%s` | `%s` | `%s` | %s | %s | %s |\n' \
        "$id" "$status" "$severity" "$priority" "$module" \
        "${title//|/ }" "${fixed_at:-n/a}" "${fix_summary//|/ }"
    done < "$recent_fixed_tsv"
  fi
} > "$tmp_issue"
mv "$tmp_issue" "$ISSUE_FILE"

{
  printf '\n## Scheduled Scan %s\n\n' "$now_human"
  printf -- '- Actionable submitted bugs: %s\n' "$actionable_count"
  printf -- '- Current queue snapshot: `%s`\n' "$ISSUE_FILE"
} >> "$HISTORY_FILE"

if [[ "$actionable_count" -gt 0 ]]; then
  ids="$(cut -f1 "$QUEUE_TSV" | awk '/^[0-9]+$/ {print}' | paste -sd, -)"
  if [[ -n "$ids" ]]; then
    db -e "
UPDATE admin_bug_reports
SET last_scanned_at = NOW(),
    assigned_to = COALESCE(NULLIF(assigned_to, ''), 'CODEX')
WHERE id IN (${ids});
"
  fi
fi

if [[ "$actionable_count" -gt 0 && -n "$CODEX_BIN" && -x "$CODEX_BIN" ]] && is_enabled "$AUTOFIX"; then
  cat > "$PROMPT_FILE" <<PROMPT
You are running the scheduled ShopTest bug maintenance cycle.

Repository: ${PROJECT_DIR}
Submitted BUG queue: ${ISSUE_FILE}
Issue files: ${ROOT_ISSUE_DIR}/*_ISSUES.md

User requirements:
- Scan submitted BUG rows every ${SCAN_INTERVAL_MINUTES} minutes.
- Fix actionable bugs.
- If a row is not a real bug, record the reason in the issue files and mark it NON_ISSUE.
- Codex runs with permissions all/full access. Execute necessary tests, verification, and operational commands; do not stop because of sandbox or approval assumptions.
- Do not commit or push code.
- Match verification scope to the bug risk. Prefer targeted checks, but run broader tests when they are necessary to prove the fix.
- Keep changes scoped to the reported bug and commercial-readiness defects directly related to it.

Required maintenance behavior:
- Read ${ISSUE_FILE} first.
- For each bug you actually fix, update the corresponding admin_bug_reports row with:
  status = 'FIXED_PENDING_REGRESSION',
  fixed_at = NOW(),
  fixed_by = 'CODEX_SCHEDULED',
  fix_summary = a concise summary of the source/runtime change.
- For non-issues, update status = 'NON_ISSUE' and put the reason in scan_note.
- Update the relevant ${ROOT_ISSUE_DIR}/*_ISSUES.md files with the fix, non-issue reason, or remaining blocker.
- If you fix enough bugs that the count since last restart reaches ${RESTART_THRESHOLD}, run ${PROJECT_DIR}/scripts/restart-shoptest-runtime.sh.

Use ${PROJECT_DIR}/scripts/shoptest-db-query.sh for database reads/writes; it reads production DB credentials safely from /etc/shoptest/backend.env.
PROMPT

  timeout "$CODEX_TIMEOUT" "$CODEX_BIN" \
    "${CODEX_PERMISSION_ARGS[@]}" \
    exec \
    -C "$PROJECT_DIR" \
    --dangerously-bypass-approvals-and-sandbox \
    -o "${STATE_DIR}/last-codex-response.md" \
    < "$PROMPT_FILE" \
    >> "${STATE_DIR}/last-codex-run.log" 2>&1 || {
      code=$?
      printf -- '- Codex scheduled fix run exited with code %s at %s.\n' "$code" "$now_iso" >> "$HISTORY_FILE"
    }
elif [[ "$actionable_count" -gt 0 ]]; then
  printf -- '- Autofix skipped at %s; CODEX_BIN=%s AUTOFIX=%s.\n' "$now_iso" "${CODEX_BIN:-missing}" "$AUTOFIX" >> "$HISTORY_FILE"
fi

last_restart_epoch="$(cat "${STATE_DIR}/last_restart_epoch")"
fixed_since_restart="$(db --batch --raw --skip-column-names -e "
SELECT COUNT(*)
FROM admin_bug_reports
WHERE fixed_at IS NOT NULL
  AND fixed_at >= FROM_UNIXTIME(${last_restart_epoch});
" | tr -d '[:space:]')"
fixed_since_restart="${fixed_since_restart:-0}"
printf '%s\n' "$fixed_since_restart" > "${STATE_DIR}/fixed_since_restart.count"

if [[ "$fixed_since_restart" =~ ^[0-9]+$ && "$fixed_since_restart" -ge "$RESTART_THRESHOLD" ]]; then
  "${PROJECT_DIR}/scripts/restart-shoptest-runtime.sh" >> "${STATE_DIR}/restart-after-20.log" 2>&1
  printf -- '- Runtime restarted after %s fixed bugs at %s.\n' "$fixed_since_restart" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$HISTORY_FILE"
else
  printf -- '- Fixed bugs since last restart: %s / %s.\n' "$fixed_since_restart" "$RESTART_THRESHOLD" >> "$HISTORY_FILE"
fi

echo "Bug maintenance cycle completed: actionable=${actionable_count}, fixed_since_restart=${fixed_since_restart}"
