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
BACKEND_RUNTIME_ENV_FILE="${BACKEND_RUNTIME_ENV_FILE:-/etc/shoptest/backend.env}"
BACKEND_SERVICE_USER="${BACKEND_SERVICE_USER:-shoptest}"
BACKEND_SERVICE_GROUP="${BACKEND_SERVICE_GROUP:-$BACKEND_SERVICE_USER}"
BACKEND_JAVA_BIN="${BACKEND_JAVA_BIN:-/usr/bin/java}"
BACKEND_JAVA_OPTS="${BACKEND_JAVA_OPTS:--Xms128m -Xmx512m -XX:MaxMetaspaceSize=192m -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -Dfile.encoding=UTF-8}"
BACKEND_REGISTER_SERVICE="${BACKEND_REGISTER_SERVICE:-true}"
BACKEND_ENABLE_SERVICE="${BACKEND_ENABLE_SERVICE:-true}"
BACKEND_HEALTHCHECK_RETRIES="${BACKEND_HEALTHCHECK_RETRIES:-10}"
BACKEND_HEALTHCHECK_INTERVAL_SECONDS="${BACKEND_HEALTHCHECK_INTERVAL_SECONDS:-3}"
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
ACTIVATE_SCRIPT_SOURCE="${PROJECT_DIR%/}/scripts/backend-remote-activate.sh"
if [[ ! -f "$ACTIVATE_SCRIPT_SOURCE" ]]; then
  echo "Backend activation script not found: $ACTIVATE_SCRIPT_SOURCE" >&2
  exit 1
fi

REMOTE="${BACKEND_DEPLOY_USER}@${BACKEND_DEPLOY_HOST}"
SSH_ARGS=(-p "$BACKEND_DEPLOY_PORT" "${SSH_EXTRA_ARG_ARRAY[@]}")
SSH_COMMAND="ssh -p ${BACKEND_DEPLOY_PORT} ${SSH_EXTRA_OPTIONS}"

REMOTE_TEMP_Q=$(shell_quote "$BACKEND_REMOTE_TEMP_DIR")
TARGET_DIR_Q=$(shell_quote "$BACKEND_DEPLOY_TARGET_DIR")
REMOTE_JAR_Q=$(shell_quote "$BACKEND_JAR_NAME")
SERVICE_Q=$(shell_quote "$BACKEND_DEPLOY_SERVICE")
OWNER_Q=$(shell_quote "$BACKEND_DEPLOY_OWNER")
HEALTHCHECK_Q=$(shell_quote "$BACKEND_HEALTHCHECK_URL")
RUNTIME_ENV_FILE_Q=$(shell_quote "$BACKEND_RUNTIME_ENV_FILE")
SERVICE_USER_Q=$(shell_quote "$BACKEND_SERVICE_USER")
SERVICE_GROUP_Q=$(shell_quote "$BACKEND_SERVICE_GROUP")
JAVA_BIN_Q=$(shell_quote "$BACKEND_JAVA_BIN")
JAVA_OPTS_Q=$(shell_quote "$BACKEND_JAVA_OPTS")
REGISTER_SERVICE_Q=$(shell_quote "$BACKEND_REGISTER_SERVICE")
ENABLE_SERVICE_Q=$(shell_quote "$BACKEND_ENABLE_SERVICE")
HEALTHCHECK_RETRIES_Q=$(shell_quote "$BACKEND_HEALTHCHECK_RETRIES")
HEALTHCHECK_INTERVAL_Q=$(shell_quote "$BACKEND_HEALTHCHECK_INTERVAL_SECONDS")
ACTIVATE_SCRIPT_Q=$(shell_quote "$BACKEND_REMOTE_TEMP_DIR/backend-remote-activate.sh")

echo "Preparing backend server upload directory on ${REMOTE}"
SSHPASS="$BACKEND_DEPLOY_PASSWORD" sshpass -e ssh "${SSH_ARGS[@]}" "$REMOTE" "mkdir -p ${REMOTE_TEMP_Q}"

echo "Uploading backend jar to ${REMOTE}:${BACKEND_REMOTE_TEMP_DIR}/${BACKEND_JAR_NAME}.next"
SSHPASS="$BACKEND_DEPLOY_PASSWORD" sshpass -e rsync "${RSYNC_ARG_ARRAY[@]}" \
  -e "$SSH_COMMAND" \
  "$JAR_SOURCE" "${REMOTE}:${BACKEND_REMOTE_TEMP_DIR}/${BACKEND_JAR_NAME}.next"

echo "Uploading backend service activation script"
SSHPASS="$BACKEND_DEPLOY_PASSWORD" sshpass -e rsync "${RSYNC_ARG_ARRAY[@]}" \
  -e "$SSH_COMMAND" \
  "$ACTIVATE_SCRIPT_SOURCE" "${REMOTE}:${BACKEND_REMOTE_TEMP_DIR}/backend-remote-activate.sh"

REMOTE_COMMAND="TARGET_DIR=${TARGET_DIR_Q} TEMP_DIR=${REMOTE_TEMP_Q} JAR_NAME=${REMOTE_JAR_Q} SERVICE_NAME=${SERVICE_Q} OWNER=${OWNER_Q} HEALTHCHECK_URL=${HEALTHCHECK_Q} RUNTIME_ENV_FILE=${RUNTIME_ENV_FILE_Q} SERVICE_USER=${SERVICE_USER_Q} SERVICE_GROUP=${SERVICE_GROUP_Q} JAVA_BIN=${JAVA_BIN_Q} JAVA_OPTS=${JAVA_OPTS_Q} REGISTER_SERVICE=${REGISTER_SERVICE_Q} ENABLE_SERVICE=${ENABLE_SERVICE_Q} HEALTHCHECK_RETRIES=${HEALTHCHECK_RETRIES_Q} HEALTHCHECK_INTERVAL_SECONDS=${HEALTHCHECK_INTERVAL_Q} bash ${ACTIVATE_SCRIPT_Q}"

echo "Activating backend service ${BACKEND_DEPLOY_SERVICE}"
SSHPASS="$BACKEND_DEPLOY_PASSWORD" sshpass -e ssh "${SSH_ARGS[@]}" "$REMOTE" "$REMOTE_COMMAND"
echo "Backend deployed successfully."
