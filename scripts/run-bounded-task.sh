#!/usr/bin/env bash
# Run an interactive test in an isolated cgroup so it cannot strand children
# or consume the capacity reserved for the live shop services.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/run-bounded-task.sh [command [argument ...]]

Environment overrides:
  SHOPTEST_TASK_TIMEOUT   Maximum runtime (default: 8m)
  SHOPTEST_TASK_CPU       CPU quota (default: 75%)
  SHOPTEST_TASK_MEMORY    Hard memory limit (default: 1G)
EOF
}

if (( $# == 0 )); then
  usage >&2
  exit 64
fi

task_timeout="${SHOPTEST_TASK_TIMEOUT:-8m}"
task_cpu="${SHOPTEST_TASK_CPU:-75%}"
task_memory="${SHOPTEST_TASK_MEMORY:-1G}"

if command -v systemd-run >/dev/null 2>&1; then
  # A transient service keeps the command in its own cgroup and --wait preserves
  # the caller's synchronous contract, so later heavy tasks cannot overlap it.
  # systemd-run does not inherit shell-assigned variables unless they are
  # explicitly passed through. Preserve task-scoped overrides used by smoke
  # probes, such as SHOPTEST_UI_BASE and SHOPTEST_MOBILE_VIEWPORTS.
  systemd_env_args=()
  while IFS= read -r env_name; do
    systemd_env_args+=("--setenv=${env_name}=${!env_name}")
  done < <(compgen -v SHOPTEST_)
  exec systemd-run --quiet --collect --wait --pipe --same-dir \
    "${systemd_env_args[@]}" \
    --property="CPUQuota=${task_cpu}" \
    --property="MemoryHigh=768M" \
    --property="MemoryMax=${task_memory}" \
    --property="MemorySwapMax=0" \
    --property="TasksMax=128" \
    --property="RuntimeMaxSec=${task_timeout}" \
    --property="KillMode=control-group" \
    -- ionice -c 3 nice -n 10 "$@"
fi

# The production host has systemd. Retain a bounded fallback for local shells.
exec timeout --signal=TERM --kill-after=20s "${task_timeout}" \
  ionice -c 3 nice -n 10 "$@"
