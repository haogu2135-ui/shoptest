#!/usr/bin/env bash
# Temporary public commercial probe tunnel for ShopMX (trycloudflare.com).
# Does not replace pet.686888666.xyz Cloudflare DNS/origin configuration.
set -euo pipefail
TARGET="${SHOPTEST_TUNNEL_TARGET:-http://127.0.0.1:4187}"
LOG="${SHOPTEST_TUNNEL_LOG:-/tmp/cloudflared-quick.log}"
URL_FILE="${SHOPTEST_TUNNEL_URL_FILE:-/tmp/cloudflared-url.txt}"
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not installed" >&2
  exit 1
fi
if pgrep -f "cloudflared tunnel --url ${TARGET}" >/dev/null 2>&1; then
  echo "tunnel already running"
  if [[ -f "$URL_FILE" ]]; then cat "$URL_FILE"; fi
  exit 0
fi
nohup cloudflared tunnel --url "$TARGET" --no-autoupdate >"$LOG" 2>&1 &
for _ in $(seq 1 40); do
  if grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" >/dev/null 2>&1; then
    grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | tail -1 | tee "$URL_FILE"
    exit 0
  fi
  sleep 1
done
echo "tunnel URL not found; see $LOG" >&2
exit 1
