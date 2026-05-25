#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${TARGET_DIR:-/opt/shoptest}"
TEMP_DIR="${TEMP_DIR:-/tmp/shoptest-backend-deploy}"
JAR_NAME="${JAR_NAME:-shop.jar}"
SERVICE_NAME="${SERVICE_NAME:-shoptest-backend}"
OWNER="${OWNER:-}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"
RUNTIME_ENV_FILE="${RUNTIME_ENV_FILE:-/etc/shoptest/backend.env}"
SERVICE_USER="${SERVICE_USER:-shoptest}"
SERVICE_GROUP="${SERVICE_GROUP:-$SERVICE_USER}"
JAVA_BIN="${JAVA_BIN:-/usr/bin/java}"
JAVA_OPTS="${JAVA_OPTS:--Xms128m -Xmx512m -XX:MaxMetaspaceSize=192m -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -Dfile.encoding=UTF-8}"
REGISTER_SERVICE="${REGISTER_SERVICE:-true}"
ENABLE_SERVICE="${ENABLE_SERVICE:-true}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-10}"
HEALTHCHECK_INTERVAL_SECONDS="${HEALTHCHECK_INTERVAL_SECONDS:-3}"

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=()
else
  SUDO=(sudo -n)
fi

fail() {
  echo "backend activation failed: $*" >&2
  exit 1
}

service_unit_path() {
  printf "/etc/systemd/system/%s.service" "$SERVICE_NAME"
}

require_safe_name() {
  local label="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[A-Za-z0-9][A-Za-z0-9_.@-]*$ ]]; then
    fail "$label contains unsafe characters: $value"
  fi
}

require_no_newline() {
  local label="$1"
  local value="$2"
  if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    fail "$label must not contain newlines"
  fi
}

require_absolute_path() {
  local label="$1"
  local value="$2"
  require_no_newline "$label" "$value"
  if [[ "$value" != /* ]]; then
    fail "$label must be an absolute path: $value"
  fi
}

require_safe_path_name() {
  local label="$1"
  local value="$2"
  if [[ "$value" == *"/"* || "$value" == "." || "$value" == ".." || -z "$value" ]]; then
    fail "$label must be a file name, not a path: $value"
  fi
}

require_integer_at_least() {
  local label="$1"
  local value="$2"
  local minimum="$3"
  if [[ ! "$value" =~ ^[0-9]+$ || "$value" -lt "$minimum" ]]; then
    fail "$label must be an integer >= $minimum: $value"
  fi
}

is_enabled() {
  [[ "${1,,}" == "true" || "${1,,}" == "1" || "${1,,}" == "yes" ]]
}

has_env_key() {
  local key="$1"
  grep -Eq "^[[:space:]]*${key}=" "$RUNTIME_ENV_FILE"
}

env_value() {
  local key="$1"
  grep -E "^[[:space:]]*${key}=" "$RUNTIME_ENV_FILE" | tail -n 1 | cut -d= -f2-
}

strip_env_quotes() {
  local value="$1"
  if [[ ( "$value" == \"*\" && "$value" == *\" ) || ( "$value" == \'*\' && "$value" == *\' ) ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf "%s" "$value"
}

write_env_template_if_missing() {
  if [[ -f "$RUNTIME_ENV_FILE" ]]; then
    return
  fi

  local env_dir
  env_dir="$(dirname "$RUNTIME_ENV_FILE")"
  "${SUDO[@]}" mkdir -p "$env_dir"
  "${SUDO[@]}" tee "$RUNTIME_ENV_FILE" >/dev/null <<'ENV'
SERVER_ADDRESS=0.0.0.0
SERVER_PORT=8081
SPRING_APPLICATION_NAME=shop-backend
APP_RUNTIME_MODE=production
JWT_SECRET=replace-with-at-least-32-random-characters
PAYMENT_CALLBACK_SECRET=replace-with-at-least-32-random-characters
DB_URL=jdbc:mysql://127.0.0.1:3306/shop?useUnicode=true&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci&useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
DB_USERNAME=shop
DB_PASSWORD=replace-me
CORS_ALLOWED_ORIGIN_PATTERNS=https://your-domain.example
WEBSOCKET_ALLOWED_ORIGIN_PATTERNS=https://your-domain.example
JPA_SHOW_SQL=false
HIBERNATE_SQL_LOG_LEVEL=WARN
HIBERNATE_BINDER_LOG_LEVEL=WARN
MYBATIS_MAPPER_LOG_LEVEL=WARN
NACOS_DISCOVERY_ENABLED=false
NACOS_REGISTER_ENABLED=false
NACOS_SERVER_ADDR=
NACOS_NAMESPACE=
NACOS_GROUP=DEFAULT_GROUP
NACOS_CLUSTER_NAME=DEFAULT
NACOS_SERVICE_NAME=shop-backend
NACOS_DISCOVERY_IP=
NACOS_DISCOVERY_PORT=8081
NACOS_IP=
NACOS_PORT=8081
NACOS_USERNAME=
NACOS_PASSWORD=
NACOS_METADATA_REGION=default
NACOS_METADATA_ZONE=default
ENV
  "${SUDO[@]}" chmod 0640 "$RUNTIME_ENV_FILE"
  echo "Created runtime env template at $RUNTIME_ENV_FILE. Fill real secrets before restarting $SERVICE_NAME." >&2
}

validate_runtime_env() {
  if [[ ! -f "$RUNTIME_ENV_FILE" ]]; then
    fail "runtime env file not found: $RUNTIME_ENV_FILE"
  fi

  local missing=()
  for key in APP_RUNTIME_MODE JWT_SECRET PAYMENT_CALLBACK_SECRET DB_URL DB_USERNAME DB_PASSWORD CORS_ALLOWED_ORIGIN_PATTERNS WEBSOCKET_ALLOWED_ORIGIN_PATTERNS; do
    if ! has_env_key "$key"; then
      missing+=("$key")
    fi
  done
  if (( ${#missing[@]} > 0 )); then
    fail "runtime env file is missing required keys: ${missing[*]}"
  fi

  local jwt_secret payment_secret db_password cors_origin ws_origin
  jwt_secret="$(strip_env_quotes "$(env_value JWT_SECRET)")"
  payment_secret="$(strip_env_quotes "$(env_value PAYMENT_CALLBACK_SECRET)")"
  db_password="$(strip_env_quotes "$(env_value DB_PASSWORD)")"
  cors_origin="$(strip_env_quotes "$(env_value CORS_ALLOWED_ORIGIN_PATTERNS)")"
  ws_origin="$(strip_env_quotes "$(env_value WEBSOCKET_ALLOWED_ORIGIN_PATTERNS)")"

  if [[ "$jwt_secret" == replace-* || ${#jwt_secret} -lt 32 ]]; then
    fail "JWT_SECRET must be a real value with at least 32 characters"
  fi
  if [[ "$payment_secret" == replace-* || ${#payment_secret} -lt 32 ]]; then
    fail "PAYMENT_CALLBACK_SECRET must be a real value with at least 32 characters"
  fi
  if [[ "$db_password" == "replace-me" || -z "$db_password" ]]; then
    fail "DB_PASSWORD must be configured"
  fi
  if [[ "$cors_origin" == *"your-domain.example"* || "$ws_origin" == *"your-domain.example"* ]]; then
    fail "CORS and websocket origins must be configured for the real frontend domain"
  fi

  local nacos_enabled nacos_register_enabled nacos_server_addr nacos_service_name nacos_port
  nacos_enabled="false"
  nacos_register_enabled=""
  nacos_server_addr=""
  nacos_service_name=""
  nacos_port=""
  if has_env_key NACOS_DISCOVERY_ENABLED; then
    nacos_enabled="$(strip_env_quotes "$(env_value NACOS_DISCOVERY_ENABLED)")"
  fi
  if has_env_key NACOS_REGISTER_ENABLED; then
    nacos_register_enabled="$(strip_env_quotes "$(env_value NACOS_REGISTER_ENABLED)")"
  fi
  if has_env_key NACOS_SERVER_ADDR; then
    nacos_server_addr="$(strip_env_quotes "$(env_value NACOS_SERVER_ADDR)")"
  fi
  if has_env_key NACOS_SERVICE_NAME; then
    nacos_service_name="$(strip_env_quotes "$(env_value NACOS_SERVICE_NAME)")"
  fi
  if has_env_key NACOS_DISCOVERY_PORT; then
    nacos_port="$(strip_env_quotes "$(env_value NACOS_DISCOVERY_PORT)")"
  elif has_env_key NACOS_PORT; then
    nacos_port="$(strip_env_quotes "$(env_value NACOS_PORT)")"
  fi

  if is_enabled "$nacos_enabled" || is_enabled "$nacos_register_enabled"; then
    if [[ -z "$nacos_server_addr" || "$nacos_server_addr" == *"example"* ]]; then
      fail "NACOS_SERVER_ADDR is required when Nacos discovery/register is enabled"
    fi
    if [[ -z "$nacos_service_name" ]]; then
      fail "NACOS_SERVICE_NAME is required when Nacos discovery/register is enabled"
    fi
    if [[ -n "$nacos_port" && ! "$nacos_port" =~ ^[0-9]+$ ]]; then
      fail "NACOS_DISCOVERY_PORT/NACOS_PORT must be numeric when configured"
    fi
  fi
}

ensure_service_identity() {
  if getent group "$SERVICE_GROUP" >/dev/null 2>&1; then
    :
  else
    "${SUDO[@]}" groupadd --system "$SERVICE_GROUP"
  fi

  if id "$SERVICE_USER" >/dev/null 2>&1; then
    :
  else
    "${SUDO[@]}" useradd --system --home "$TARGET_DIR" --shell /usr/sbin/nologin --gid "$SERVICE_GROUP" "$SERVICE_USER"
  fi
}

install_systemd_unit() {
  local unit_path
  unit_path="$(service_unit_path)"

  local temp_unit
  temp_unit="$(mktemp)"
  cat >"$temp_unit" <<UNIT
[Unit]
Description=Shoptest Spring Boot API
After=network-online.target
Wants=network-online.target

[Service]
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$TARGET_DIR
EnvironmentFile=$RUNTIME_ENV_FILE
ExecStart=$JAVA_BIN $JAVA_OPTS -jar $TARGET_DIR/$JAR_NAME
Restart=always
RestartSec=5
SuccessExitStatus=143
LimitNOFILE=65535
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=$TARGET_DIR
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT

  "${SUDO[@]}" install -m 0644 "$temp_unit" "$unit_path"
  rm -f "$temp_unit"
}

run_healthcheck() {
  local success_message="$1"
  local attempt
  for ((attempt = 1; attempt <= HEALTHCHECK_RETRIES; attempt++)); do
    if curl -fsS "$HEALTHCHECK_URL" >/dev/null; then
      echo "$success_message"
      return 0
    fi
    if (( attempt < HEALTHCHECK_RETRIES )); then
      sleep "$HEALTHCHECK_INTERVAL_SECONDS"
    fi
  done
  return 1
}

rollback_to_previous_jar() {
  local backup_path="$1"
  local jar_target="$2"

  echo "Rolling back to previous backend jar." >&2
  "${SUDO[@]}" mv "$backup_path" "$jar_target"
  "${SUDO[@]}" chmod 0644 "$jar_target"
  "${SUDO[@]}" chown "$SERVICE_USER:$SERVICE_GROUP" "$jar_target"
  "${SUDO[@]}" systemctl restart "$SERVICE_NAME"
  "${SUDO[@]}" systemctl is-active --quiet "$SERVICE_NAME"

  if run_healthcheck "Rollback backend health check passed."; then
    return
  fi

  echo "Rollback health check failed: $HEALTHCHECK_URL" >&2
  exit 1
}

activate_service() {
  local jar_next="$TEMP_DIR/$JAR_NAME.next"
  local jar_target="$TARGET_DIR/$JAR_NAME"
  local backup_path=""

  [[ -f "$jar_next" ]] || fail "uploaded jar not found: $jar_next"
  require_safe_name "SERVICE_NAME" "$SERVICE_NAME"
  require_safe_path_name "JAR_NAME" "$JAR_NAME"
  require_absolute_path "TARGET_DIR" "$TARGET_DIR"
  require_absolute_path "TEMP_DIR" "$TEMP_DIR"
  require_absolute_path "RUNTIME_ENV_FILE" "$RUNTIME_ENV_FILE"
  require_absolute_path "JAVA_BIN" "$JAVA_BIN"
  require_no_newline "JAVA_OPTS" "$JAVA_OPTS"
  require_integer_at_least "HEALTHCHECK_RETRIES" "$HEALTHCHECK_RETRIES" 1
  require_integer_at_least "HEALTHCHECK_INTERVAL_SECONDS" "$HEALTHCHECK_INTERVAL_SECONDS" 0

  if [[ -n "$OWNER" ]]; then
    require_no_newline "OWNER" "$OWNER"
    SERVICE_USER="${OWNER%%:*}"
    SERVICE_GROUP="${OWNER#*:}"
    if [[ "$SERVICE_GROUP" == "$OWNER" ]]; then
      SERVICE_GROUP="$SERVICE_USER"
    fi
  fi
  require_safe_name "SERVICE_USER" "$SERVICE_USER"
  require_safe_name "SERVICE_GROUP" "$SERVICE_GROUP"

  ensure_service_identity
  "${SUDO[@]}" mkdir -p "$TARGET_DIR" "$TARGET_DIR/uploads" "$TEMP_DIR"
  "${SUDO[@]}" chown "$SERVICE_USER:$SERVICE_GROUP" "$TARGET_DIR" "$TARGET_DIR/uploads"

  if is_enabled "$REGISTER_SERVICE"; then
    install_systemd_unit
  fi

  write_env_template_if_missing
  validate_runtime_env

  if [[ -f "$jar_target" ]]; then
    backup_path="$TARGET_DIR/$JAR_NAME.previous"
    "${SUDO[@]}" cp -f "$jar_target" "$backup_path"
  fi

  "${SUDO[@]}" mv "$jar_next" "$jar_target"
  "${SUDO[@]}" chmod 0644 "$jar_target"
  "${SUDO[@]}" chown "$SERVICE_USER:$SERVICE_GROUP" "$jar_target"

  "${SUDO[@]}" systemctl daemon-reload
  if is_enabled "$ENABLE_SERVICE"; then
    "${SUDO[@]}" systemctl enable "$SERVICE_NAME" >/dev/null
  fi
  "${SUDO[@]}" systemctl restart "$SERVICE_NAME"
  "${SUDO[@]}" systemctl is-active --quiet "$SERVICE_NAME"

  if [[ -n "$HEALTHCHECK_URL" ]]; then
    if ! command -v curl >/dev/null 2>&1; then
      echo "curl was not found on the backend server; skipped health check."
      return
    fi

    if run_healthcheck "Backend health check passed."; then
      return
    fi

    echo "Backend health check failed: $HEALTHCHECK_URL" >&2
    if [[ -n "$backup_path" && -f "$backup_path" ]]; then
      rollback_to_previous_jar "$backup_path" "$jar_target"
    fi
    exit 1
  fi
}

activate_service
echo "Backend service $SERVICE_NAME activated."
