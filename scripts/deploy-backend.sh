#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${1:-deploy/backend-upload.local.env}"
PROJECT_DIR="${PROJECT_DIR:-.}"

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "Config file not found: $CONFIG_PATH" >&2
  echo "Copy deploy/backend-upload.env.example to deploy/backend-upload.local.env and fill in your backend server info." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$CONFIG_PATH"
set +a

: "${BACKEND_DEPLOY_HOST:?BACKEND_DEPLOY_HOST is required}"
: "${BACKEND_DEPLOY_USER:?BACKEND_DEPLOY_USER is required}"
: "${BACKEND_DEPLOY_PASSWORD:?BACKEND_DEPLOY_PASSWORD is required}"

BACKEND_DEPLOY_PORT="${BACKEND_DEPLOY_PORT:-22}"
BACKEND_DEPLOY_TARGET_DIR="${BACKEND_DEPLOY_TARGET_DIR:-/opt/shoptest}"
BACKEND_DEPLOY_SERVICE="${BACKEND_DEPLOY_SERVICE:-shoptest-backend}"
BACKEND_REMOTE_TEMP_DIR="${BACKEND_REMOTE_TEMP_DIR:-/tmp/shoptest-backend-deploy}"
BACKEND_JAR_NAME="${BACKEND_JAR_NAME:-shop.jar}"
BACKEND_DEPLOY_OWNER="${BACKEND_DEPLOY_OWNER:-}"
BACKEND_HEALTHCHECK_URL="${BACKEND_HEALTHCHECK_URL:-}"
MAVEN_ARGS="${MAVEN_ARGS:--DskipTests package}"
RSYNC_OPTIONS="${RSYNC_OPTIONS:--az --delay-updates}"
SSH_EXTRA_OPTIONS="${SSH_EXTRA_OPTIONS:--o StrictHostKeyChecking=accept-new}"

if [[ "$BACKEND_DEPLOY_HOST" == "your.backend.server.public.ip" ]]; then
  echo "BACKEND_DEPLOY_HOST still uses the example value. Edit $CONFIG_PATH first." >&2
  exit 1
fi

for command_name in rsync ssh sshpass; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$command_name was not found. Install it before running this script." >&2
    exit 1
  fi
done

if [[ -z "${MAVEN_COMMAND:-}" ]]; then
  if [[ -x "${PROJECT_DIR%/}/mvnw" ]]; then
    MAVEN_COMMAND="./mvnw"
  elif [[ -f "${PROJECT_DIR%/}/mvnw.cmd" ]]; then
    MAVEN_COMMAND="./mvnw.cmd"
  else
    MAVEN_COMMAND="mvn"
  fi
fi

shell_quote() {
  printf "'%s'" "$(printf "%s" "$1" | sed "s/'/'\\\\''/g")"
}

read -r -a MAVEN_ARG_ARRAY <<< "$MAVEN_ARGS"
read -r -a RSYNC_ARG_ARRAY <<< "$RSYNC_OPTIONS"
read -r -a SSH_EXTRA_ARG_ARRAY <<< "$SSH_EXTRA_OPTIONS"

(
  cd "$PROJECT_DIR"
  "$MAVEN_COMMAND" "${MAVEN_ARG_ARRAY[@]}"
)

JAR_SOURCE="${PROJECT_DIR%/}/target/shop-0.0.1-SNAPSHOT.jar"
if [[ ! -f "$JAR_SOURCE" ]]; then
  echo "Backend jar not found: $JAR_SOURCE" >&2
  exit 1
fi

REMOTE="${BACKEND_DEPLOY_USER}@${BACKEND_DEPLOY_HOST}"
SSH_ARGS=(-p "$BACKEND_DEPLOY_PORT" "${SSH_EXTRA_ARG_ARRAY[@]}")
SSH_COMMAND="ssh -p ${BACKEND_DEPLOY_PORT} ${SSH_EXTRA_OPTIONS}"

REMOTE_TEMP_Q=$(shell_quote "$BACKEND_REMOTE_TEMP_DIR")
REMOTE_JAR_Q=$(shell_quote "$BACKEND_JAR_NAME")
TARGET_DIR_Q=$(shell_quote "$BACKEND_DEPLOY_TARGET_DIR")
SERVICE_Q=$(shell_quote "$BACKEND_DEPLOY_SERVICE")
OWNER_Q=$(shell_quote "$BACKEND_DEPLOY_OWNER")
HEALTHCHECK_Q=$(shell_quote "$BACKEND_HEALTHCHECK_URL")

echo "Preparing backend server upload directory on ${REMOTE}"
SSHPASS="$BACKEND_DEPLOY_PASSWORD" sshpass -e ssh "${SSH_ARGS[@]}" "$REMOTE" "mkdir -p ${REMOTE_TEMP_Q}"

echo "Uploading backend jar to ${REMOTE}:${BACKEND_REMOTE_TEMP_DIR}/${BACKEND_JAR_NAME}.next"
SSHPASS="$BACKEND_DEPLOY_PASSWORD" sshpass -e rsync "${RSYNC_ARG_ARRAY[@]}" \
  -e "$SSH_COMMAND" \
  "$JAR_SOURCE" "${REMOTE}:${BACKEND_REMOTE_TEMP_DIR}/${BACKEND_JAR_NAME}.next"

REMOTE_SCRIPT=$(cat <<SCRIPT
set -euo pipefail
TARGET_DIR=${TARGET_DIR_Q}
TEMP_DIR=${REMOTE_TEMP_Q}
JAR_NAME=${REMOTE_JAR_Q}
SERVICE_NAME=${SERVICE_Q}
OWNER=${OWNER_Q}
HEALTHCHECK_URL=${HEALTHCHECK_Q}

if [ "\$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo -n"
fi

\$SUDO mkdir -p "\$TARGET_DIR"
\$SUDO mv "\$TEMP_DIR/\$JAR_NAME.next" "\$TARGET_DIR/\$JAR_NAME"
\$SUDO chmod 0644 "\$TARGET_DIR/\$JAR_NAME"
if [ -n "\$OWNER" ]; then
  \$SUDO chown "\$OWNER" "\$TARGET_DIR/\$JAR_NAME"
fi
\$SUDO systemctl daemon-reload
\$SUDO systemctl restart "\$SERVICE_NAME"
\$SUDO systemctl is-active --quiet "\$SERVICE_NAME"

if [ -n "\$HEALTHCHECK_URL" ]; then
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl was not found on the backend server; skipped health check."
    exit 0
  fi
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS "\$HEALTHCHECK_URL" >/dev/null; then
      echo "Backend health check passed."
      exit 0
    fi
    sleep 3
  done
  echo "Backend health check failed: \$HEALTHCHECK_URL" >&2
  exit 1
fi
SCRIPT
)

echo "Activating backend service ${BACKEND_DEPLOY_SERVICE}"
printf "%s\n" "$REMOTE_SCRIPT" | SSHPASS="$BACKEND_DEPLOY_PASSWORD" sshpass -e ssh "${SSH_ARGS[@]}" "$REMOTE" "bash -s"
echo "Backend deployed successfully."
