#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${SHOPTEST_PROJECT_DIR:-/home/guhao/shoptest}"
LOG_DIR="${PROJECT_DIR}/logs"
mkdir -p "$LOG_DIR"

exec >> "${LOG_DIR}/hourly-release.log" 2>&1

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] hourly release start"
"${PROJECT_DIR}/scripts/restart-shoptest-runtime.sh"
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] hourly release complete"
