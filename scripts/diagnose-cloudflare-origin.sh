#!/usr/bin/env bash
# Diagnose Cloudflare 522 vs healthy ShopMX origin edge.
# Confirms whether the outage is CF origin config vs host/app downtime.
set -euo pipefail

DOMAIN="${SHOPTEST_PRODUCTION_HOST:-pet.686888666.xyz}"
ORIGIN_IP="${SHOPTEST_ORIGIN_PUBLIC_IP:-161.153.37.250}"
PUBLIC_URL="${SHOPTEST_PRODUCTION_BASE:-https://${DOMAIN}}"

echo "== ShopMX Cloudflare origin diagnosis =="
echo "domain=${DOMAIN}"
echo "origin_ip=${ORIGIN_IP}"
echo "public_url=${PUBLIC_URL}"
echo

echo "-- public CDN --"
public_code="$(curl -sS -m 12 -o /tmp/shopmx-cf-home.body -w '%{http_code}' "${PUBLIC_URL}/" || true)"
echo "public_home_http_code=${public_code:-000}"
if curl -sS -m 8 -o /tmp/shopmx-cf-trace.txt -w "cdn_cgi_trace=%{http_code}\n" "https://${DOMAIN}/cdn-cgi/trace" >/tmp/shopmx-cf-trace.code 2>/dev/null; then
  cat /tmp/shopmx-cf-trace.code
  head -5 /tmp/shopmx-cf-trace.txt || true
else
  echo "cdn_cgi_trace=failed"
fi
echo

echo "-- origin IP direct (Host: ${DOMAIN}) --"
http_code="$(curl -sS -m 8 -H "Host: ${DOMAIN}" -o /dev/null -w '%{http_code}' "http://${ORIGIN_IP}/" || true)"
https_code="$(curl -sS -m 8 -k -H "Host: ${DOMAIN}" -o /dev/null -w '%{http_code}' "https://${ORIGIN_IP}/" || true)"
echo "origin_http=${http_code:-000}"
echo "origin_https=${https_code:-000}"
echo

echo "-- host listeners / iptables --"
ss -ltn 2>/dev/null | awk 'NR==1 || /:80 |:443 /' || true
if command -v iptables >/dev/null 2>&1; then
  iptables -S INPUT 2>/dev/null | rg 'dport (80|443)|REJECT|DROP' || true
fi
echo

if [[ "${http_code:-0}" == "200" || "${https_code:-0}" == "200" ]]; then
  if [[ "${public_code:-0}" != "200" ]]; then
    cat <<MSG
RESULT: Origin is healthy on ${ORIGIN_IP}, but Cloudflare public URL is not.
ACTION:
  1) Cloudflare DNS A for ${DOMAIN} origin IP must be ${ORIGIN_IP} (proxied orange cloud).
  2) SSL/TLS mode: Flexible (HTTP origin) or Full (HTTPS origin self-signed) / Full Strict (real cert).
  3) Disable Authenticated Origin Pulls unless origin is configured for them.
  4) Confirm no Cloudflare Spectrum/Workers route overrides the origin.
  5) After fix: SHOPTEST_REQUIRE_PRODUCTION=1 npm --prefix frontend run test:commercial-production-readiness
MSG
    exit 2
  fi
  echo "RESULT: Public CDN and origin both healthy."
  exit 0
fi

cat <<MSG
RESULT: Origin IP ${ORIGIN_IP} is not serving ${DOMAIN} on 80/443 from this host path.
ACTION:
  1) scripts/open-shoptest-edge-ports.sh
  2) Ensure nginx edge container is up (deploy/docker-compose.frontend-edge.host.yml)
  3) Open OCI Security List / NSG ingress TCP 80 and 443 from 0.0.0.0/0 (or Cloudflare IP ranges)
  4) Temporary public probes: scripts/start-commercial-public-tunnel.sh
MSG
exit 3
