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

is_placeholder_mail_value() {
  local value="${1,,}"
  [[ -z "$value" \
    || "$value" == *"example.com"* \
    || "$value" == replace-* \
    || "$value" == *"replace-with"* \
    || "$value" == *"your-"* \
    || "$value" == "mail-app-password" \
    || "$value" == "another-app-password" ]]
}

is_placeholder_runtime_value() {
  local value="${1,,}"
  [[ -z "$value" \
    || "$value" == *"example.com"* \
    || "$value" == *"provider.example"* \
    || "$value" == replace-* \
    || "$value" == *"replace-with"* \
    || "$value" == *"your-"* \
    || "$value" == "test" \
    || "$value" == "demo" ]]
}

is_unsafe_production_origin() {
  local value="${1,,}"
  value="${value//[[:space:]]/}"
  [[ -z "$value" \
    || "$value" == "*" \
    || "$value" != https://* \
    || "$value" == http://* \
    || "$value" == *"localhost"* \
    || "$value" == *"127.0.0.1"* \
    || "$value" == *"0.0.0.0"* \
    || "$value" == *"10."* \
    || "$value" == *"10.*"* \
    || "$value" == *"172."* \
    || "$value" =~ 172\.(1[6-9]|2[0-9]|3[0-1])\. \
    || "$value" == *"192.168."* ]]
}

validate_production_origins() {
  local label="$1"
  local raw="$2"
  local origin
  if [[ -z "$raw" ]]; then
    fail "$label must list deployed HTTPS origins in production"
  fi
  IFS=',' read -ra origins <<<"$raw"
  for origin in "${origins[@]}"; do
    if is_unsafe_production_origin "$origin"; then
      fail "$label must contain only deployed HTTPS public origins in production"
    fi
  done
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

optional_env_value() {
  local key="$1"
  local fallback="$2"
  if has_env_key "$key"; then
    strip_env_quotes "$(env_value "$key")"
  else
    printf "%s" "$fallback"
  fi
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
ADMIN_BOOTSTRAP_TOKEN=
PAYMENT_SIMULATION_ENABLED=false
PAYMENT_SIMULATION_ALLOW_PRODUCTION=false
PAYMENT_CHECKOUT_BASE_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CHECKOUT_SUCCESS_URL=
STRIPE_CHECKOUT_CANCEL_URL=
CONFIG_CENTER_APPLY_NACOS_ON_STARTUP=false
DB_URL=jdbc:mysql://db.internal.shop:3306/shop?useUnicode=true&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci&sslMode=VERIFY_IDENTITY&serverTimezone=UTC
DB_USERNAME=shop
DB_PASSWORD=replace-with-production-db-password
REDIS_HOST=redis.internal.shop
REDIS_PORT=6379
REDIS_PASSWORD=replace-with-production-redis-password
REDIS_DATABASE=0
MAIL_CODE_REDIS_ENABLED=true
MAIL_CODE_REDIS_KEY_PREFIX=shop:mail-code
MAIL_CODE_PEPPER=replace-with-same-value-on-every-backend-instance
MAIL_BRAND_NAME=ShopMX
APP_MAIL_ACCOUNTS_0_HOST=smtp.example.com
APP_MAIL_ACCOUNTS_0_PORT=465
APP_MAIL_ACCOUNTS_0_USERNAME=no-reply@example.com
APP_MAIL_ACCOUNTS_0_PASSWORD=replace-with-mail-app-password
APP_MAIL_ACCOUNTS_0_FROM=no-reply@example.com
APP_MAIL_ACCOUNTS_0_SSL=true
APP_MAIL_ACCOUNTS_0_STARTTLS=false
LOGISTICS_API_URL=
LOGISTICS_API_KEY=
KUAIDI100_ENABLED=false
KUAIDI100_CUSTOMER=
KUAIDI100_KEY=
CORS_ALLOWED_ORIGIN_PATTERNS=https://pet.686888666.xyz
WEBSOCKET_ALLOWED_ORIGIN_PATTERNS=https://pet.686888666.xyz
TRUSTED_PROXY_IPS=127.0.0.1,::1,0:0:0:0:0:0:0:1
JPA_SHOW_SQL=false
HIBERNATE_SQL_LOG_LEVEL=WARN
HIBERNATE_BINDER_LOG_LEVEL=WARN
MYBATIS_MAPPER_LOG_LEVEL=WARN
NACOS_DISCOVERY_ENABLED=true
NACOS_REGISTER_ENABLED=true
NACOS_SERVER_ADDR=nacos.internal.shop:8848
NACOS_NAMESPACE=
NACOS_GROUP=DEFAULT_GROUP
NACOS_CLUSTER_NAME=DEFAULT
NACOS_SERVICE_NAME=shop-backend
NACOS_DISCOVERY_IP=replace-with-backend-private-ip
NACOS_DISCOVERY_PORT=8081
NACOS_IP=replace-with-backend-private-ip
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
  for key in APP_RUNTIME_MODE JWT_SECRET PAYMENT_CALLBACK_SECRET DB_URL DB_USERNAME DB_PASSWORD REDIS_HOST REDIS_PORT REDIS_PASSWORD CORS_ALLOWED_ORIGIN_PATTERNS WEBSOCKET_ALLOWED_ORIGIN_PATTERNS; do
    if ! has_env_key "$key"; then
      missing+=("$key")
    fi
  done
  if (( ${#missing[@]} > 0 )); then
    fail "runtime env file is missing required keys: ${missing[*]}"
  fi

  local runtime_mode production_mode jwt_secret payment_secret admin_bootstrap_token payment_simulation_enabled payment_simulation_allow_production db_url db_username db_password redis_host redis_port redis_password cors_origin ws_origin mail_host mail_port mail_username mail_password mail_from mail_pepper logistics_api_url kuaidi100_enabled kuaidi100_customer kuaidi100_key payment_checkout_base_url stripe_secret_key stripe_webhook_secret stripe_success_url stripe_cancel_url
  runtime_mode="$(strip_env_quotes "$(env_value APP_RUNTIME_MODE)")"
  production_mode="false"
  if [[ "${runtime_mode,,}" == "production" || "${runtime_mode,,}" == "prod" ]]; then
    production_mode="true"
  fi
  jwt_secret="$(strip_env_quotes "$(env_value JWT_SECRET)")"
  payment_secret="$(strip_env_quotes "$(env_value PAYMENT_CALLBACK_SECRET)")"
  admin_bootstrap_token="$(optional_env_value ADMIN_BOOTSTRAP_TOKEN "")"
  payment_simulation_enabled="$(optional_env_value PAYMENT_SIMULATION_ENABLED false)"
  payment_simulation_allow_production="$(optional_env_value PAYMENT_SIMULATION_ALLOW_PRODUCTION false)"
  db_url="$(strip_env_quotes "$(env_value DB_URL)")"
  db_username="$(strip_env_quotes "$(env_value DB_USERNAME)")"
  db_password="$(strip_env_quotes "$(env_value DB_PASSWORD)")"
  redis_host="$(strip_env_quotes "$(env_value REDIS_HOST)")"
  redis_port="$(strip_env_quotes "$(env_value REDIS_PORT)")"
  redis_password="$(strip_env_quotes "$(env_value REDIS_PASSWORD)")"
  cors_origin="$(strip_env_quotes "$(env_value CORS_ALLOWED_ORIGIN_PATTERNS)")"
  ws_origin="$(strip_env_quotes "$(env_value WEBSOCKET_ALLOWED_ORIGIN_PATTERNS)")"
  mail_host="$(optional_env_value APP_MAIL_ACCOUNTS_0_HOST "")"
  mail_port="$(optional_env_value APP_MAIL_ACCOUNTS_0_PORT "")"
  mail_username="$(optional_env_value APP_MAIL_ACCOUNTS_0_USERNAME "")"
  mail_password="$(optional_env_value APP_MAIL_ACCOUNTS_0_PASSWORD "")"
  mail_from="$(optional_env_value APP_MAIL_ACCOUNTS_0_FROM "")"
  mail_pepper="$(optional_env_value MAIL_CODE_PEPPER "")"
  logistics_api_url="$(optional_env_value LOGISTICS_API_URL "")"
  kuaidi100_enabled="$(optional_env_value KUAIDI100_ENABLED false)"
  kuaidi100_customer="$(optional_env_value KUAIDI100_CUSTOMER "")"
  kuaidi100_key="$(optional_env_value KUAIDI100_KEY "")"
  payment_checkout_base_url="$(optional_env_value PAYMENT_CHECKOUT_BASE_URL "")"
  stripe_secret_key="$(optional_env_value STRIPE_SECRET_KEY "")"
  stripe_webhook_secret="$(optional_env_value STRIPE_WEBHOOK_SECRET "")"
  stripe_success_url="$(optional_env_value STRIPE_CHECKOUT_SUCCESS_URL "$(optional_env_value STRIPE_SUCCESS_URL "")")"
  stripe_cancel_url="$(optional_env_value STRIPE_CHECKOUT_CANCEL_URL "$(optional_env_value STRIPE_CANCEL_URL "")")"

  if [[ "$jwt_secret" == replace-* || ${#jwt_secret} -lt 32 ]]; then
    fail "JWT_SECRET must be a real value with at least 32 characters"
  fi
  if [[ "$payment_secret" == replace-* || "$payment_secret" == *replace-with* || "$payment_secret" == *your-* || ${#payment_secret} -lt 32 ]]; then
    fail "PAYMENT_CALLBACK_SECRET must be a real value with at least 32 characters"
  fi
  if is_enabled "$production_mode" && ( is_enabled "$payment_simulation_enabled" || is_enabled "$payment_simulation_allow_production" ); then
    fail "payment simulation must stay disabled in production"
  fi
  if is_enabled "$production_mode" && [[ -n "$admin_bootstrap_token" ]]; then
    fail "ADMIN_BOOTSTRAP_TOKEN must be blank in production after admin bootstrap"
  fi
  if [[ "$db_url" != jdbc:mysql://* || "$db_url" == *"example"* || "$db_url" == *"localhost"* || "$db_url" == *"127.0.0.1"* ]]; then
    fail "DB_URL must point to the real remote MySQL service, for example jdbc:mysql://db.internal.shop:3306/shop..."
  fi
  if is_enabled "$production_mode" && [[ "${db_url,,}" == *"usessl=false"* || "${db_url,,}" == *"sslmode=disabled"* || "${db_url,,}" == *"sslmode=disable"* || "${db_url,,}" == *"allowpublickeyretrieval=true"* ]]; then
    fail "DB_URL must not disable TLS or enable allowPublicKeyRetrieval in production"
  fi
  if [[ -z "$db_username" || "$db_username" == "replace-me" ]]; then
    fail "DB_USERNAME must be configured"
  fi
  if is_enabled "$production_mode" && [[ "${db_username,,}" == "root" ]]; then
    fail "DB_USERNAME must not be root in production; create a dedicated MySQL user such as shop"
  fi
  if [[ "$db_password" == replace-* || "$db_password" == *replace-with* || "$db_password" == *your-* || "$db_password" == "shop_password" || -z "$db_password" ]]; then
    fail "DB_PASSWORD must be configured"
  fi
  if [[ -z "$redis_host" || "$redis_host" == *"example"* || "$redis_host" == "localhost" || "$redis_host" == "127.0.0.1" ]]; then
    fail "REDIS_HOST must point to the real Redis service"
  fi
  if [[ ! "$redis_port" =~ ^[0-9]+$ ]]; then
    fail "REDIS_PORT must be numeric"
  fi
  if is_enabled "$production_mode" && [[ -z "$redis_password" || "$redis_password" == replace-* || "$redis_password" == *replace-with* || "$redis_password" == *your-* || "$redis_password" == "shop_redis_password" ]]; then
    fail "REDIS_PASSWORD must be configured in production"
  fi
  if [[ "$cors_origin" == *"your-domain.example"* || "$ws_origin" == *"your-domain.example"* ]]; then
    fail "CORS and websocket origins must be configured for the real frontend domain"
  fi
  if is_enabled "$production_mode"; then
    validate_production_origins "CORS_ALLOWED_ORIGIN_PATTERNS" "$cors_origin"
    validate_production_origins "WEBSOCKET_ALLOWED_ORIGIN_PATTERNS" "$ws_origin"
    if is_placeholder_mail_value "$mail_host" \
      || ! [[ "$mail_port" =~ ^[0-9]+$ ]] \
      || is_placeholder_mail_value "$mail_username" \
      || is_placeholder_mail_value "$mail_password" \
      || is_placeholder_mail_value "$mail_from"; then
      fail "production SMTP account APP_MAIL_ACCOUNTS_0_* must be configured with real non-placeholder values"
    fi
    if [[ -z "$mail_pepper" || "$mail_pepper" == replace-* || "$mail_pepper" == *"replace-with"* ]]; then
      fail "MAIL_CODE_PEPPER must be a stable real value in production"
    fi
    if [[ -n "$logistics_api_url" ]]; then
      if is_unsafe_production_origin "$logistics_api_url" || is_placeholder_runtime_value "$logistics_api_url"; then
        fail "LOGISTICS_API_URL must be a production HTTPS public provider URL"
      fi
    elif ! is_enabled "$kuaidi100_enabled" \
      || is_placeholder_runtime_value "$kuaidi100_customer" \
      || is_placeholder_runtime_value "$kuaidi100_key"; then
      fail "production logistics tracking must configure LOGISTICS_API_URL or KUAIDI100 credentials"
    fi
    local generic_payment_ready stripe_payment_ready
    generic_payment_ready="false"
    stripe_payment_ready="false"
    if [[ -n "$payment_checkout_base_url" ]] \
      && ! is_unsafe_production_origin "$payment_checkout_base_url" \
      && ! is_placeholder_runtime_value "$payment_checkout_base_url" \
      && [[ "${payment_checkout_base_url,,}" != *"pay.example.local"* ]]; then
      generic_payment_ready="true"
    fi
    if [[ "$stripe_secret_key" == sk_live_* \
      && "$stripe_webhook_secret" == whsec_* \
      && -n "$stripe_success_url" \
      && -n "$stripe_cancel_url" ]] \
      && ! is_unsafe_production_origin "$stripe_success_url" \
      && ! is_unsafe_production_origin "$stripe_cancel_url"; then
      stripe_payment_ready="true"
    fi
    if ! is_enabled "$generic_payment_ready" && ! is_enabled "$stripe_payment_ready"; then
      fail "production payment checkout must configure PAYMENT_CHECKOUT_BASE_URL or complete live Stripe settings"
    fi
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

nacos_registration_enabled() {
  local discovery_enabled register_enabled
  discovery_enabled="$(optional_env_value NACOS_DISCOVERY_ENABLED false)"
  register_enabled="$(optional_env_value NACOS_REGISTER_ENABLED "$discovery_enabled")"
  is_enabled "$discovery_enabled" || is_enabled "$register_enabled"
}

run_nacos_registration_check() {
  if ! nacos_registration_enabled; then
    return 0
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl was not found on the backend server; skipped Nacos registration check."
    return 0
  fi

  local server_addr service_name group_name namespace_id nacos_port response attempt
  server_addr="$(optional_env_value NACOS_SERVER_ADDR "")"
  service_name="$(optional_env_value NACOS_SERVICE_NAME "$(optional_env_value SPRING_APPLICATION_NAME shop-backend)")"
  group_name="$(optional_env_value NACOS_GROUP DEFAULT_GROUP)"
  namespace_id="$(optional_env_value NACOS_NAMESPACE "")"
  nacos_port="$(optional_env_value NACOS_DISCOVERY_PORT "$(optional_env_value NACOS_PORT "$(optional_env_value SERVER_PORT 8081)")")"

  for ((attempt = 1; attempt <= HEALTHCHECK_RETRIES; attempt++)); do
    local curl_args=(-fsS --max-time 8 -G "http://${server_addr}/nacos/v1/ns/instance/list"
      --data-urlencode "serviceName=${service_name}"
      --data-urlencode "groupName=${group_name}")
    if [[ -n "$namespace_id" ]]; then
      curl_args+=(--data-urlencode "namespaceId=${namespace_id}")
    fi
    if response="$(curl "${curl_args[@]}")"; then
      if [[ "$response" == *'"hosts":[{'* && ( -z "$nacos_port" || "$response" == *"\"port\":${nacos_port}"* ) ]]; then
        echo "Nacos registration check passed for ${service_name}:${nacos_port}."
        return 0
      fi
    fi
    if (( attempt < HEALTHCHECK_RETRIES )); then
      sleep "$HEALTHCHECK_INTERVAL_SECONDS"
    fi
  done

  echo "Nacos registration check failed for service ${service_name} at ${server_addr}." >&2
  if [[ -n "${response:-}" ]]; then
    echo "Last Nacos response: $response" >&2
  fi
  return 1
}

run_post_start_checks() {
  if [[ -n "$HEALTHCHECK_URL" ]]; then
    if ! command -v curl >/dev/null 2>&1; then
      echo "curl was not found on the backend server; skipped health check."
    elif ! run_healthcheck "Backend health check passed."; then
      echo "Backend health check failed: $HEALTHCHECK_URL" >&2
      return 1
    fi
  fi

  run_nacos_registration_check
}

stop_service_if_running() {
  if "${SUDO[@]}" systemctl is-active --quiet "$SERVICE_NAME"; then
    "${SUDO[@]}" systemctl stop "$SERVICE_NAME"
  fi
}

start_service() {
  "${SUDO[@]}" systemctl start "$SERVICE_NAME"
  "${SUDO[@]}" systemctl is-active --quiet "$SERVICE_NAME"
}

rollback_to_previous_jar() {
  local backup_path="$1"
  local jar_target="$2"

  echo "Rolling back to previous backend jar." >&2
  stop_service_if_running
  "${SUDO[@]}" mv "$backup_path" "$jar_target"
  "${SUDO[@]}" chmod 0644 "$jar_target"
  "${SUDO[@]}" chown "$SERVICE_USER:$SERVICE_GROUP" "$jar_target"
  start_service

  if run_post_start_checks; then
    echo "Rollback backend post-start checks passed."
    return
  fi

  echo "Rollback post-start checks failed." >&2
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

  "${SUDO[@]}" systemctl daemon-reload
  if is_enabled "$ENABLE_SERVICE"; then
    "${SUDO[@]}" systemctl enable "$SERVICE_NAME" >/dev/null
  fi
  stop_service_if_running

  "${SUDO[@]}" mv "$jar_next" "$jar_target"
  "${SUDO[@]}" chmod 0644 "$jar_target"
  "${SUDO[@]}" chown "$SERVICE_USER:$SERVICE_GROUP" "$jar_target"

  start_service

  if ! run_post_start_checks; then
    if [[ -n "$backup_path" && -f "$backup_path" ]]; then
      rollback_to_previous_jar "$backup_path" "$jar_target"
    fi
    exit 1
  fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  activate_service
  echo "Backend service $SERVICE_NAME activated."
fi
