#!/usr/bin/env bash
# Atomic commercial frontend build for ShopMX.
# Builds into a staging directory, then rsyncs into the live `build/` tree so
# Docker bind mounts (which track inodes) keep serving without a container restart.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAGING="${SHOPTEST_BUILD_STAGING:-build.next}"
LIVE="${SHOPTEST_BUILD_LIVE:-build}"

export GENERATE_SOURCEMAP="${GENERATE_SOURCEMAP:-false}"
# Pre-existing eslint unused-var noise must not block commercial ship builds.
export DISABLE_ESLINT_PLUGIN="${DISABLE_ESLINT_PLUGIN:-true}"
unset CI || true

echo "[safe-commercial-build] building into ${STAGING}"
rm -rf "$STAGING"
BUILD_PATH="$STAGING" npm run build

if [[ ! -f "$STAGING/index.html" || ! -d "$STAGING/static" ]]; then
  echo "[safe-commercial-build] staging build incomplete" >&2
  exit 1
fi

# Preserve public downloads if generate-mobile-version already ran into public/
if [[ -d public/downloads && ! -d "$STAGING/downloads" ]]; then
  cp -a public/downloads "$STAGING/downloads"
fi

mkdir -p "$LIVE"
echo "[safe-commercial-build] syncing ${STAGING}/ -> ${LIVE}/ (inode-preserving for bind mounts)"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "${STAGING}/" "${LIVE}/"
else
  # Fallback: replace contents without replacing the LIVE directory inode.
  find "$LIVE" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a "${STAGING}/." "$LIVE/"
fi
rm -rf "$STAGING"

echo "[safe-commercial-build] ready: ${LIVE}"
ls -la "$LIVE/static/js/main"* 2>/dev/null | head -3 || true
