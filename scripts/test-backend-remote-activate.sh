#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

export TARGET_DIR="$WORK_DIR/target"
export TEMP_DIR="$WORK_DIR/temp"
export RUNTIME_ENV_FILE="$WORK_DIR/backend.env"
export SERVICE_NAME="shoptest-backend-test"
export HEALTHCHECK_RETRIES=1
export HEALTHCHECK_INTERVAL_SECONDS=0
export MOCK_SYSTEMCTL_LOG="$WORK_DIR/systemctl.log"

# shellcheck disable=SC1091
source "$PROJECT_DIR/scripts/backend-remote-activate.sh"

mkdir -p "$WORK_DIR/bin"
cat >"$WORK_DIR/bin/systemctl" <<'FAKE_SYSTEMCTL'
#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "${MOCK_SYSTEMCTL_LOG}"
case "${1:-}" in
  is-active)
    if [[ -f "${MOCK_SERVICE_ACTIVE:-}" ]]; then
      exit 0
    fi
    exit 3
    ;;
  stop)
    rm -f "${MOCK_SERVICE_ACTIVE:-/nonexistent}"
    ;;
  start)
    : > "${MOCK_SERVICE_ACTIVE:-/tmp/mock-service-active}"
    ;;
  restart)
    : > "${MOCK_SERVICE_ACTIVE:-/tmp/mock-service-active}"
    ;;
  enable)
    ;;
  daemon-reload)
    ;;
  *)
    ;;
esac
FAKE_SYSTEMCTL
chmod +x "$WORK_DIR/bin/systemctl"
export MOCK_SERVICE_ACTIVE="$WORK_DIR/service.active"
export PATH="$WORK_DIR/bin:$PATH"

assert_contains() {
  local needle="$1"
  local haystack="$2"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "Expected output to contain: $needle" >&2
    echo "Actual output: $haystack" >&2
    exit 1
  fi
}

assert_not_contains() {
  local needle="$1"
  local haystack="$2"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "Expected output to not contain: $needle" >&2
    echo "Actual output: $haystack" >&2
    exit 1
  fi
}

assert_order() {
  local first="$1"
  local second="$2"
  local file="$3"
  local first_line second_line
  first_line="$(grep -nF "$first" "$file" | head -n1 | cut -d: -f1 || true)"
  second_line="$(grep -nF "$second" "$file" | head -n1 | cut -d: -f1 || true)"
  if [[ -z "$first_line" || -z "$second_line" || "$first_line" -ge "$second_line" ]]; then
    echo "Expected '$first' to appear before '$second' in $file" >&2
    echo "--- systemctl log ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

write_valid_env() {
  cat >"$RUNTIME_ENV_FILE" <<'ENV'
APP_RUNTIME_MODE=production
JWT_SECRET=abcdefghijklmnopqrstuvwxyz1234567890
PAYMENT_CALLBACK_SECRET=abcdefghijklmnopqrstuvwxyz1234567890
ADMIN_BOOTSTRAP_TOKEN=
PAYMENT_SIMULATION_ENABLED=false
PAYMENT_SIMULATION_ALLOW_PRODUCTION=false
PAYMENT_CHECKOUT_BASE_URL=https://payments.shop.test/checkout
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CHECKOUT_SUCCESS_URL=
STRIPE_CHECKOUT_CANCEL_URL=
CONFIG_CENTER_APPLY_NACOS_ON_STARTUP=false
DB_URL=jdbc:mysql://db.internal.shop:3306/shop?sslMode=VERIFY_IDENTITY
DB_USERNAME=shop
DB_PASSWORD=production-db-password-123456
REDIS_HOST=redis.internal.shop
REDIS_PORT=6379
REDIS_PASSWORD=production-redis-password-123456
MAIL_CODE_PEPPER=abcdefghijklmnopqrstuvwxyz-mail-pepper
APP_MAIL_ACCOUNTS_0_HOST=smtp.mailhost.test
APP_MAIL_ACCOUNTS_0_PORT=465
APP_MAIL_ACCOUNTS_0_USERNAME=no-reply@shop.test
APP_MAIL_ACCOUNTS_0_PASSWORD=mail-password-123
APP_MAIL_ACCOUNTS_0_FROM=no-reply@shop.test
LOGISTICS_API_URL=https://logistics.shop.test/track
CORS_ALLOWED_ORIGIN_PATTERNS=https://shop.example.com
WEBSOCKET_ALLOWED_ORIGIN_PATTERNS=https://shop.example.com
SPRING_APPLICATION_NAME=shop-backend
SERVER_PORT=8081
NACOS_DISCOVERY_ENABLED=true
NACOS_REGISTER_ENABLED=true
NACOS_SERVER_ADDR=nacos.internal.shop:8848
NACOS_GROUP=DEFAULT_GROUP
NACOS_SERVICE_NAME=shop-backend
NACOS_DISCOVERY_PORT=8081
ENV
}

assert_fails_with() {
  local expected="$1"
  shift
  local output
  if output="$("$@" 2>&1)"; then
    echo "Expected command to fail: $*" >&2
    exit 1
  fi
  if [[ "$output" != *"$expected"* ]]; then
    echo "Expected failure to contain: $expected" >&2
    echo "Actual output: $output" >&2
    exit 1
  fi
}

write_fake_curl() {
  mkdir -p "$WORK_DIR/bin"
  cat >"$WORK_DIR/bin/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
printf '%s' "$FAKE_NACOS_RESPONSE"
FAKE_CURL
  chmod +x "$WORK_DIR/bin/curl"
  export PATH="$WORK_DIR/bin:$PATH"
}

write_valid_env
sed -i 's/DB_PASSWORD=production-db-password-123456/DB_PASSWORD=/' "$RUNTIME_ENV_FILE"
assert_fails_with "DB_PASSWORD must be configured" validate_runtime_env

write_valid_env
sed -i 's/DB_USERNAME=shop/DB_USERNAME=root/' "$RUNTIME_ENV_FILE"
assert_fails_with "DB_USERNAME must not be root in production" validate_runtime_env

write_valid_env
sed -i 's/REDIS_PASSWORD=production-redis-password-123456/REDIS_PASSWORD=/' "$RUNTIME_ENV_FILE"
assert_fails_with "REDIS_PASSWORD must be configured in production" validate_runtime_env

write_valid_env
sed -i 's/APP_MAIL_ACCOUNTS_0_HOST=smtp.mailhost.test/APP_MAIL_ACCOUNTS_0_HOST=smtp.example.com/' "$RUNTIME_ENV_FILE"
assert_fails_with "production SMTP account APP_MAIL_ACCOUNTS_0_* must be configured" validate_runtime_env

write_valid_env
sed -i 's/MAIL_CODE_PEPPER=abcdefghijklmnopqrstuvwxyz-mail-pepper/MAIL_CODE_PEPPER=replace-with-same-value-on-every-backend-instance/' "$RUNTIME_ENV_FILE"
assert_fails_with "MAIL_CODE_PEPPER must be a stable real value in production" validate_runtime_env

write_valid_env
sed -i 's#CORS_ALLOWED_ORIGIN_PATTERNS=https://shop.example.com#CORS_ALLOWED_ORIGIN_PATTERNS=http://shop.test:*#' "$RUNTIME_ENV_FILE"
assert_fails_with "CORS_ALLOWED_ORIGIN_PATTERNS must contain only deployed HTTPS public origins in production" validate_runtime_env

write_valid_env
sed -i 's#WEBSOCKET_ALLOWED_ORIGIN_PATTERNS=https://shop.example.com#WEBSOCKET_ALLOWED_ORIGIN_PATTERNS=*#' "$RUNTIME_ENV_FILE"
assert_fails_with "WEBSOCKET_ALLOWED_ORIGIN_PATTERNS must contain only deployed HTTPS public origins in production" validate_runtime_env

write_valid_env
sed -i 's#LOGISTICS_API_URL=https://logistics.shop.test/track#LOGISTICS_API_URL=https://provider.example/track#' "$RUNTIME_ENV_FILE"
assert_fails_with "LOGISTICS_API_URL must be a production HTTPS public provider URL" validate_runtime_env

write_valid_env
sed -i 's#LOGISTICS_API_URL=https://logistics.shop.test/track#LOGISTICS_API_URL=#' "$RUNTIME_ENV_FILE"
assert_fails_with "production logistics tracking must configure LOGISTICS_API_URL or KUAIDI100 credentials" validate_runtime_env

write_valid_env
sed -i 's#PAYMENT_CHECKOUT_BASE_URL=https://payments.shop.test/checkout#PAYMENT_CHECKOUT_BASE_URL=https://pay.example.local/checkout#' "$RUNTIME_ENV_FILE"
assert_fails_with "production payment checkout must configure PAYMENT_CHECKOUT_BASE_URL or complete live Stripe settings" validate_runtime_env

write_valid_env
sed -i 's#PAYMENT_CHECKOUT_BASE_URL=https://payments.shop.test/checkout#PAYMENT_CHECKOUT_BASE_URL=#' "$RUNTIME_ENV_FILE"
assert_fails_with "production payment checkout must configure PAYMENT_CHECKOUT_BASE_URL or complete live Stripe settings" validate_runtime_env

write_valid_env
sed -i 's#PAYMENT_CHECKOUT_BASE_URL=https://payments.shop.test/checkout#PAYMENT_CHECKOUT_BASE_URL=#' "$RUNTIME_ENV_FILE"
sed -i 's#STRIPE_SECRET_KEY=#STRIPE_SECRET_KEY=sk_live_123#' "$RUNTIME_ENV_FILE"
sed -i 's#STRIPE_WEBHOOK_SECRET=#STRIPE_WEBHOOK_SECRET=whsec_123#' "$RUNTIME_ENV_FILE"
sed -i 's#STRIPE_CHECKOUT_SUCCESS_URL=#STRIPE_CHECKOUT_SUCCESS_URL=https://shop.example.com/profile?payment=success#' "$RUNTIME_ENV_FILE"
sed -i 's#STRIPE_CHECKOUT_CANCEL_URL=#STRIPE_CHECKOUT_CANCEL_URL=https://shop.example.com/cart?payment=cancelled#' "$RUNTIME_ENV_FILE"
validate_runtime_env

write_valid_env
sed -i 's/ADMIN_BOOTSTRAP_TOKEN=/ADMIN_BOOTSTRAP_TOKEN=temporary-bootstrap-token/' "$RUNTIME_ENV_FILE"
assert_fails_with "ADMIN_BOOTSTRAP_TOKEN must be blank in production after admin bootstrap" validate_runtime_env

write_valid_env
sed -i 's/PAYMENT_SIMULATION_ENABLED=false/PAYMENT_SIMULATION_ENABLED=true/' "$RUNTIME_ENV_FILE"
assert_fails_with "payment simulation must stay disabled in production" validate_runtime_env

write_valid_env
sed -i 's/PAYMENT_SIMULATION_ALLOW_PRODUCTION=false/PAYMENT_SIMULATION_ALLOW_PRODUCTION=true/' "$RUNTIME_ENV_FILE"
assert_fails_with "payment simulation must stay disabled in production" validate_runtime_env

write_valid_env
write_fake_curl
export FAKE_NACOS_RESPONSE='{"name":"DEFAULT_GROUP@@shop-backend","hosts":[]}'
assert_fails_with "Nacos registration check failed" run_nacos_registration_check

export FAKE_NACOS_RESPONSE='{"name":"DEFAULT_GROUP@@shop-backend","hosts":[{"ip":"10.0.0.20","port":8081,"healthy":true}]}'
run_nacos_registration_check >/dev/null

write_valid_env
mkdir -p "$TARGET_DIR" "$TEMP_DIR"
printf 'previous-jar' > "$TARGET_DIR/shop.jar"
printf 'next-jar' > "$TEMP_DIR/shop.jar.next"
: > "$MOCK_SERVICE_ACTIVE"
: > "$MOCK_SYSTEMCTL_LOG"
activate_service
activate_log="$(cat "$MOCK_SYSTEMCTL_LOG")"
assert_contains "stop shoptest-backend-test" "$activate_log"
assert_contains "start shoptest-backend-test" "$activate_log"
assert_not_contains "restart shoptest-backend-test" "$activate_log"
assert_order "stop shoptest-backend-test" "start shoptest-backend-test" "$MOCK_SYSTEMCTL_LOG"

echo "backend remote activation tests passed"
