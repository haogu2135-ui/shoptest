#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${SHOPTEST_PROJECT_DIR:-/home/guhao/shoptest}"
FRONTEND_DIR="${PROJECT_DIR}/frontend"
BACKEND_JAR_SOURCE="${PROJECT_DIR}/target/shop-0.0.1-SNAPSHOT.jar"
BACKEND_JAR_TARGET="${SHOPTEST_BACKEND_JAR:-/opt/shoptest/shop.jar}"
FRONTEND_TARGET="${SHOPTEST_FRONTEND_TARGET:-/var/www/shoptest}"
STATE_DIR="${SHOPTEST_BUG_STATE_DIR:-/root/shoptest/bug-maintenance-state}"
FRONTEND_LOCAL_UNIT="${SHOPTEST_FRONTEND_LOCAL_UNIT:-shoptest-frontend-local.service}"
LOCK_FILE="${SHOPTEST_RUNTIME_BUILD_LOCK:-/run/shoptest-runtime-build.lock}"
FRONTEND_BUILD_OUTPUT=""

fail() {
  echo "restart-shoptest-runtime: $*" >&2
  exit 1
}

resolve_node_bin() {
  local candidate major
  if [[ -n "${SHOPTEST_NODE_BIN:-}" && -x "${SHOPTEST_NODE_BIN:-}" ]]; then
    echo "$SHOPTEST_NODE_BIN"
    return 0
  fi
  for candidate in \
    /root/.nvm/versions/node/v20.20.2/bin/node \
    /root/.nvm/versions/node/*/bin/node \
    /usr/local/bin/node \
    /usr/bin/node; do
    [[ -x "$candidate" ]] || continue
    major="$("$candidate" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)"
    if [[ "$major" =~ ^[0-9]+$ && "$major" -ge 20 ]]; then
      echo "$candidate"
      return 0
    fi
  done
  command -v node || true
}

wait_for_curl() {
  local label="$1"
  shift
  local attempts="${SHOPTEST_HEALTH_ATTEMPTS:-45}"
  local delay_seconds="${SHOPTEST_HEALTH_DELAY_SECONDS:-2}"
  local attempt

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl "$@" >/dev/null 2>&1; then
      echo "Health check passed: ${label}"
      return 0
    fi
    sleep "$delay_seconds"
  done

  echo "restart-shoptest-runtime: health check failed after ${attempts} attempts: ${label}" >&2
  curl "$@" || true
  return 1
}

apply_static_permissions() {
  local target="$1"
  [[ -d "$target" ]] || return 0
  find "$target" -type d -exec chmod 0755 {} +
  find "$target" -type f -exec chmod 0644 {} +
}

[[ -d "$PROJECT_DIR" ]] || fail "project directory not found: $PROJECT_DIR"
[[ -d "$FRONTEND_DIR" ]] || fail "frontend directory not found: $FRONTEND_DIR"
NODE_BIN="$(resolve_node_bin)"
[[ -n "$NODE_BIN" && -x "$NODE_BIN" ]] || fail "node binary not found"
export SHOPTEST_NODE_BIN="$NODE_BIN"
export PATH="$(dirname "$NODE_BIN"):/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export npm_config_cache="${SHOPTEST_NPM_CACHE:-${PROJECT_DIR}/.npm-cache}"

exec 9>"$LOCK_FILE"
flock -n 9 || fail "another ShopTest runtime build is already running"

mkdir -p "$STATE_DIR" "${PROJECT_DIR}/logs" "$npm_config_cache"
cleanup() {
  if [[ -n "$FRONTEND_BUILD_OUTPUT" && -d "$FRONTEND_BUILD_OUTPUT" ]]; then
    rm -rf "$FRONTEND_BUILD_OUTPUT"
  fi
}
trap cleanup EXIT

(
  cd "$PROJECT_DIR"
  ./mvnw -B -DskipTests package
)

"${PROJECT_DIR}/scripts/build-shoptest-apk.sh"

FRONTEND_BUILD_OUTPUT="$(mktemp -d "${PROJECT_DIR}/target/frontend-build.XXXXXX")"
(
  cd "$FRONTEND_DIR"
  BUILD_PATH="$FRONTEND_BUILD_OUTPUT" npm run build
)
[[ -f "${FRONTEND_BUILD_OUTPUT}/index.html" ]] || fail "frontend build did not produce index.html"
[[ -f "${FRONTEND_BUILD_OUTPUT}/asset-manifest.json" ]] || fail "frontend build did not produce asset-manifest.json"
[[ -d "${FRONTEND_BUILD_OUTPUT}/static" ]] || fail "frontend build did not produce static assets"

if [[ -f "$BACKEND_JAR_TARGET" ]]; then
  cp -a "$BACKEND_JAR_TARGET" "${BACKEND_JAR_TARGET}.previous-$(date -u +%Y%m%d%H%M%S)"
fi

install -m 0644 "$BACKEND_JAR_SOURCE" "$BACKEND_JAR_TARGET"
mkdir -p "${FRONTEND_DIR}/build" "$FRONTEND_TARGET"
rsync -a --delete --chmod=D755,F644 "${FRONTEND_BUILD_OUTPUT}/" "${FRONTEND_DIR}/build/"
rsync -a --delete --chmod=D755,F644 "${FRONTEND_BUILD_OUTPUT}/" "${FRONTEND_TARGET}/"
apply_static_permissions "${FRONTEND_DIR}/build"
apply_static_permissions "$FRONTEND_TARGET"

systemctl restart shoptest-backend
nginx -t
systemctl reload nginx

systemctl stop "$FRONTEND_LOCAL_UNIT" >/dev/null 2>&1 || true
systemctl reset-failed "$FRONTEND_LOCAL_UNIT" >/dev/null 2>&1 || true
systemd-run \
  --unit="${FRONTEND_LOCAL_UNIT%.service}" \
  --description='ShopTest local frontend static server' \
  --working-directory="$FRONTEND_DIR" \
  --setenv="PATH=$(dirname "$NODE_BIN"):/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
  "$NODE_BIN" scripts/serve-build.js >/dev/null

wait_for_curl "public nginx healthz" -k -fsS -o /dev/null -H 'Host: pet.686888666.xyz' https://127.0.0.1/healthz
wait_for_curl "public nginx SPA" -k -fsS -o /dev/null -H 'Host: pet.686888666.xyz' https://127.0.0.1/
wait_for_curl "public nginx API app config" -k -fsS -o /dev/null -H 'Host: pet.686888666.xyz' https://127.0.0.1/api/app/config
wait_for_curl "backend app config" -fsS -o /dev/null http://127.0.0.1:8081/app/config
wait_for_curl "local frontend server" -fsS -o /dev/null http://127.0.0.1:4187/

date -u +%s > "${STATE_DIR}/last_restart_epoch"
date -u +"%Y-%m-%dT%H:%M:%SZ" > "${STATE_DIR}/last_restart_at"
echo "ShopTest runtime restarted successfully at $(cat "${STATE_DIR}/last_restart_at")"
