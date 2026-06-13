#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${1:-deploy/frontend-upload.local.env}"
FRONTEND_DIR="${FRONTEND_DIR:-frontend}"

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "Config file not found: $CONFIG_PATH" >&2
  echo "Copy deploy/frontend-upload.env.example to deploy/frontend-upload.local.env and fill in your server info." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$CONFIG_PATH"
set +a

: "${DEPLOY_HOST:?DEPLOY_HOST is required}"
: "${DEPLOY_USER:?DEPLOY_USER is required}"
: "${DEPLOY_PASSWORD:?DEPLOY_PASSWORD is required}"

DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_TARGET="${DEPLOY_TARGET:-/var/www/shoptest/}"
RSYNC_OPTIONS="${RSYNC_OPTIONS:--av --delete}"
SSH_EXTRA_OPTIONS="${SSH_EXTRA_OPTIONS:--o StrictHostKeyChecking=accept-new}"
REMOTE_POST_DEPLOY_COMMAND="${REMOTE_POST_DEPLOY_COMMAND:-find '$DEPLOY_TARGET' -type d -exec chmod 0755 {} + && find '$DEPLOY_TARGET' -type f -exec chmod 0644 {} +}"

if [[ "$DEPLOY_HOST" == "your.server.public.ip" ]]; then
  echo "DEPLOY_HOST still uses the example value. Edit $CONFIG_PATH first." >&2
  exit 1
fi

for command_name in npm rsync sshpass; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$command_name was not found. Install it before running this script." >&2
    exit 1
  fi
done

(
  cd "$FRONTEND_DIR"
  npm ci
  npm run build
)

SOURCE_PATH="${FRONTEND_DIR%/}/build/"
DESTINATION="${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_TARGET}"
SSH_COMMAND="ssh -p ${DEPLOY_PORT} ${SSH_EXTRA_OPTIONS}"

echo "Uploading static frontend to ${DESTINATION}"
SSHPASS="$DEPLOY_PASSWORD" sshpass -e rsync ${RSYNC_OPTIONS} -e "$SSH_COMMAND" "$SOURCE_PATH" "$DESTINATION"
echo "Fixing static frontend permissions on ${DEPLOY_HOST}"
SSHPASS="$DEPLOY_PASSWORD" sshpass -e ssh -p "$DEPLOY_PORT" $SSH_EXTRA_OPTIONS "$DEPLOY_USER@$DEPLOY_HOST" "$REMOTE_POST_DEPLOY_COMMAND"
echo "Static frontend deployed successfully."
