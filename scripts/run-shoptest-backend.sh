#!/usr/bin/env bash
set -euo pipefail

RUNTIME_ENV_FILE="${SHOPTEST_BACKEND_ENV_FILE:-/etc/shoptest/backend.env}"
BACKEND_JAR="${SHOPTEST_BACKEND_JAR:-/home/guhao/shoptest/target/shop-0.0.1-SNAPSHOT.jar}"

if [[ ! -r "$RUNTIME_ENV_FILE" ]]; then
  echo "Backend environment file is not readable: $RUNTIME_ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$BACKEND_JAR" ]]; then
  echo "Backend JAR not found: $BACKEND_JAR" >&2
  exit 1
fi

set -a
while IFS= read -r line; do
  case "$line" in
    ''|'#'*) continue ;;
    *=*) export "$line" ;;
  esac
done < "$RUNTIME_ENV_FILE"
set +a

export CORS_ALLOWED_ORIGIN_PATTERNS="${CORS_ALLOWED_ORIGIN_PATTERNS:-https://petsanything.com}"
export WEBSOCKET_ALLOWED_ORIGIN_PATTERNS="${WEBSOCKET_ALLOWED_ORIGIN_PATTERNS:-https://petsanything.com}"
export STOREFRONT_BASE_URL="${STOREFRONT_BASE_URL:-https://petsanything.com}"
export PAYMENT_CHECKOUT_BASE_URL="${PAYMENT_CHECKOUT_BASE_URL:-https://petsanything.com/payment}"
export NACOS_DISCOVERY_ENABLED="${NACOS_DISCOVERY_ENABLED:-false}"
export NACOS_REGISTER_ENABLED="${NACOS_REGISTER_ENABLED:-false}"

exec /usr/bin/java \
  -Xms128m \
  -Xmx512m \
  -XX:MaxMetaspaceSize=192m \
  -XX:+UseG1GC \
  -XX:+ExitOnOutOfMemoryError \
  -Dfile.encoding=UTF-8 \
  -jar "$BACKEND_JAR"
