#!/usr/bin/env bash
# Issue/renew Let's Encrypt cert for ShopMX origin via HTTP-01 webroot.
# Prerequisites:
#   - edge nginx serves /.well-known/acme-challenge/ from deploy/certbot/www
#   - public DNS (or CF Full with origin reachable on :80) can complete HTTP-01
#   - while Cloudflare returns 522, issuance will fail — fix CF origin first
set -euo pipefail

DOMAIN="${SHOPTEST_PRODUCTION_HOST:-pet.686888666.xyz}"
EMAIL="${LETSENCRYPT_EMAIL:-admin@${DOMAIN}}"
WEBROOT="${CERTBOT_WEBROOT:-/home/guhao/shoptest/deploy/certbot/www}"
LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"
ORIGIN_IP="${SHOPTEST_ORIGIN_PUBLIC_IP:-161.153.37.250}"

mkdir -p "${WEBROOT}/.well-known/acme-challenge"
echo "le-webroot-ready" > "${WEBROOT}/.well-known/acme-challenge/health"

echo "== ShopMX LE webroot preflight =="
echo "domain=${DOMAIN}"
echo "webroot=${WEBROOT}"
echo "origin_ip=${ORIGIN_IP}"

local_code="$(curl -sS -m 5 -o /tmp/le-acme-local.body -w '%{http_code}' -H "Host: ${DOMAIN}" "http://127.0.0.1/.well-known/acme-challenge/health" || true)"
origin_code="$(curl -sS -m 8 -o /dev/null -w '%{http_code}' -H "Host: ${DOMAIN}" "http://${ORIGIN_IP}/.well-known/acme-challenge/health" || true)"
public_code="$(curl -4 --http1.1 -sS -m 15 -o /dev/null -w '%{http_code}' "http://${DOMAIN}/.well-known/acme-challenge/health" || true)"
echo "local_acme_http=${local_code:-000} body=$(tr -d '\n' </tmp/le-acme-local.body 2>/dev/null || true)"
echo "origin_acme_http=${origin_code:-000}"
echo "public_acme_http=${public_code:-000}"

if [[ "${local_code:-0}" != "200" ]]; then
  echo "FAIL: local edge does not serve ACME webroot. Recreate shoptest-frontend with certbot volume:"
  echo "  cd deploy && docker compose -f docker-compose.frontend-edge.yml -f docker-compose.frontend-edge.host.yml --env-file frontend-edge.env up -d --force-recreate"
  exit 1
fi

if [[ "${public_code:-0}" != "200" ]]; then
  cat <<MSG
WARN: public HTTP-01 path is not reachable (code=${public_code:-000}).
Cloudflare 522/timeouts will block LE HTTP-01 until origin is reachable from CF.
Fix DNS A (proxied) → ${ORIGIN_IP}, SSL Full, then re-run this script.
Continuing only if SHOPTEST_LE_FORCE=1 is set.
MSG
  if [[ "${SHOPTEST_LE_FORCE:-0}" != "1" ]]; then
    exit 2
  fi
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "FAIL: certbot not installed"
  exit 1
fi

certbot certonly \
  --webroot -w "${WEBROOT}" \
  -d "${DOMAIN}" \
  --email "${EMAIL}" \
  --agree-tos \
  --non-interactive \
  --keep-until-expiring \
  ${SHOPTEST_LE_EXTRA_ARGS:-}

if [[ ! -f "${LIVE_DIR}/fullchain.pem" || ! -f "${LIVE_DIR}/privkey.pem" ]]; then
  echo "FAIL: certbot finished but live certs missing under ${LIVE_DIR}"
  exit 1
fi

echo "OK: certificates at ${LIVE_DIR}"
echo "Next: point frontend-edge.env SSL_CERTIFICATE_HOST_PATH to fullchain.pem and key, recreate edge, set CF SSL to Full Strict."
