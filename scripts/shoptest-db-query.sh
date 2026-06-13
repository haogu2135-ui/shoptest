#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${SHOPTEST_BACKEND_ENV:-/etc/shoptest/backend.env}"

fail() {
  echo "shoptest-db-query: $*" >&2
  exit 1
}

env_value() {
  local key="$1"
  awk -v key="$key" '
    index($0, key "=") == 1 {
      sub(/^[^=]*=/, "")
      print
      exit
    }
  ' "$ENV_FILE"
}

strip_quotes() {
  local value="$1"
  if [[ ( "$value" == \"*\" && "$value" == *\" ) || ( "$value" == \'*\' && "$value" == *\' ) ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf "%s" "$value"
}

[[ -f "$ENV_FILE" ]] || fail "env file not found: $ENV_FILE"
command -v mysql >/dev/null 2>&1 || fail "mysql client not found"

DB_URL="$(strip_quotes "$(env_value DB_URL)")"
DB_USERNAME="$(strip_quotes "$(env_value DB_USERNAME)")"
DB_PASSWORD="$(strip_quotes "$(env_value DB_PASSWORD)")"

[[ -n "$DB_URL" ]] || fail "DB_URL is empty"
[[ -n "$DB_USERNAME" ]] || fail "DB_USERNAME is empty"
[[ -n "$DB_PASSWORD" ]] || fail "DB_PASSWORD is empty"
[[ "$DB_URL" == jdbc:mysql://* ]] || fail "only jdbc:mysql URLs are supported"

url_without_scheme="${DB_URL#jdbc:mysql://}"
hostport="${url_without_scheme%%/*}"
database_and_query="${url_without_scheme#*/}"
database="${database_and_query%%\?*}"
host="${hostport%%:*}"
port="3306"
if [[ "$hostport" == *:* ]]; then
  port="${hostport##*:}"
fi

[[ -n "$host" ]] || fail "DB host is empty"
[[ -n "$database" ]] || fail "DB name is empty"

MYSQL_PWD="$DB_PASSWORD" mysql \
  --protocol=TCP \
  -h "$host" \
  -P "$port" \
  -u "$DB_USERNAME" \
  --default-character-set=utf8mb4 \
  "$database" "$@"
