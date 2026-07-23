#!/usr/bin/env bash
# Diagnose Cloudflare 521/522/525/526 vs healthy ShopMX origin edge.
# Confirms whether the outage is CF origin config vs host/app downtime.
set -euo pipefail

DOMAIN="${SHOPTEST_PRODUCTION_HOST:-pet.686888666.xyz}"
ORIGIN_IP="${SHOPTEST_ORIGIN_PUBLIC_IP:-161.153.37.250}"
# Always probe the public CDN hostname — do not reuse SHOPTEST_PRODUCTION_BASE
# (often https://127.0.0.1 for origin-edge TLS-insecure CWV).
PUBLIC_URL="${SHOPTEST_PUBLIC_CDN_BASE:-https://${DOMAIN}}"

echo "== ShopMX Cloudflare origin diagnosis =="
echo "domain=${DOMAIN}"
echo "origin_ip=${ORIGIN_IP}"
echo "public_url=${PUBLIC_URL}"
echo

echo "-- public CDN --"
# Prefer HTTP/1.1 + IPv4 so Cloudflare error pages (522/521/526) surface instead of silent timeouts.
public_headers="$(curl -4 --http1.1 -sS -m 25 -D /tmp/shopmx-cf-home.hdr -o /tmp/shopmx-cf-home.body -w '%{http_code}' "${PUBLIC_URL}/" || true)"
public_code="${public_headers}"
public_location="$(awk 'BEGIN{IGNORECASE=1} /^Location:/ {sub(/\r$/,""); sub(/^Location:[[:space:]]*/,""); print; exit}' /tmp/shopmx-cf-home.hdr 2>/dev/null || true)"
echo "public_home_http_code=${public_code:-000}"
if [[ -n "${public_location}" ]]; then
  echo "public_home_location=${public_location}"
fi
if [[ -s /tmp/shopmx-cf-home.body ]]; then
  echo "public_home_body_preview=$(head -c 80 /tmp/shopmx-cf-home.body | tr '\n' ' ')"
fi
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

echo "-- external multiprobe note --"
# Port openness from third-party checkers is optional; host-local curl to ORIGIN_IP is authoritative here.
# When origin_http/https=200 but public CDN fails, CF origin IP/SSL/Auth Pulls is the ship-bar fix (not app code).
if [[ "${http_code:-0}" == "200" || "${https_code:-0}" == "200" ]]; then
  echo "origin_direct=healthy (ShopMX edge responds on ${ORIGIN_IP})"
else
  echo "origin_direct=unhealthy"
fi
# Detect wrong-product bodies if public somehow returns 200 to a foreign stack.
if [[ "${public_code:-0}" == "200" && -s /tmp/shopmx-cf-home.body ]]; then
  if ! rg -qi 'ShopMX|shop-frontend|main\.[a-f0-9]+\.js|pet essentials|lang="es-MX"' /tmp/shopmx-cf-home.body; then
    body_hint="$(head -c 120 /tmp/shopmx-cf-home.body | tr '\n' ' ')"
    echo "public_body_not_shopmx=1 preview=${body_hint}"
    public_code="200-wrong-origin"
  else
    echo "public_body_shopmx=1"
  fi
fi
echo

echo "-- host listeners / iptables --"
ss -ltn 2>/dev/null | awk 'NR==1 || /:80 |:443 /' || true
if command -v iptables >/dev/null 2>&1; then
  iptables -S INPUT 2>/dev/null | rg 'dport (80|443)|REJECT|DROP' || true
fi
echo

if [[ "${http_code:-0}" == "200" || "${https_code:-0}" == "200" ]]; then
  if [[ "${public_code:-0}" != "200" ]]; then
    case "${public_code:-000}" in
      522)
        cat <<MSG
RESULT: Origin is healthy on ${ORIGIN_IP}, but Cloudflare returns 522 (connection timed out to origin).
NOTE: Host iptables accepts NEW 80/443 and origin serves ShopMX on bare IP. When public port checks also show 80/443 open, prefer CF dashboard origin misconfig over OCI Security List.
ACTION:
  1) Cloudflare DNS A for ${DOMAIN} must point to ${ORIGIN_IP} (proxied / orange cloud). Wrong/stale origin IP is the most common 522 cause when origin direct is healthy.
  2) SSL/TLS mode: Full (self-signed origin cert present) — avoid Full Strict until a publicly trusted origin cert is installed; Flexible only if origin HTTP is intended.
  3) Disable Authenticated Origin Pulls unless origin mTLS is configured.
  4) Confirm no Cloudflare Workers/Spectrum/Load Balancer pool points at a dead/foreign origin (e.g. rapid4cloud).
  5) Optional: re-check OCI NSG only if external multiprobes show 80/443 closed to the public internet.
  6) After fix: SHOPTEST_REQUIRE_PRODUCTION=1 npm --prefix frontend run test:commercial-production-readiness
MSG
        ;;
      521)
        cat <<MSG
RESULT: Origin is healthy on ${ORIGIN_IP} (host + external multiprobe), but Cloudflare returns 521 (web server is down from CF path).
ACTION:
  1) Cloudflare DNS A for ${DOMAIN} (proxied/orange) must point to origin ${ORIGIN_IP}. Wrong/stale origin IP is the most common 521 cause when bare-IP HTTP/HTTPS already return 200 from the public internet.
  2) SSL/TLS mode: Full (self-signed origin cert) — not Full Strict until a trusted origin cert is installed; Flexible only if CF should speak HTTP to origin :80.
  3) Disable Authenticated Origin Pulls unless origin mTLS is configured.
  4) Confirm no Cloudflare Load Balancer / Spectrum / Worker route targets a dead origin.
  5) Host already listens 0.0.0.0:80/443 with default_server; bare-IP Host/no-Host both serve the storefront.
  6) After CF fix: SHOPTEST_REQUIRE_PRODUCTION=1 SHOPTEST_PRODUCTION_BASE=https://${DOMAIN} npm --prefix frontend run test:commercial-production-readiness
MSG
        ;;
      526|525)
        cat <<MSG
RESULT: Origin is healthy, but Cloudflare SSL handshake to origin failed (${public_code}).
ACTION: Set SSL/TLS mode to Full (not Full Strict) for the ShopMX self-signed origin cert, or install a trusted origin cert.
MSG
        ;;
      301|302|307|308)
        cat <<MSG
RESULT: Origin ShopMX is healthy on ${ORIGIN_IP}, but public CDN returns ${public_code} (not the storefront).
LOCATION: ${public_location:-none}
ACTION:
  1) Cloudflare is reaching a *different* origin than ShopMX (e.g. rapid4cloud/controller). DNS A for ${DOMAIN} (proxied) must be ${ORIGIN_IP} only.
  2) Remove CNAME/LB/Worker/Page Rule that rewrites ${DOMAIN} to a foreign host.
  3) SSL/TLS: Full (self-signed origin cert on ${ORIGIN_IP}).
  4) After fix, public home must be HTTP 200 with ShopMX HTML (not a redirect to another product).
  5) Verify: curl -4 --http1.1 -D- -o /dev/null https://${DOMAIN}/ | head
MSG
        ;;
      000|*)
        cat <<MSG
RESULT: Origin is healthy on ${ORIGIN_IP}, but Cloudflare public URL is not (http_code=${public_code:-000}).
ACTION:
  1) Cloudflare DNS A for ${DOMAIN} origin IP must be ${ORIGIN_IP} (proxied orange cloud).
  2) SSL/TLS mode: Flexible (HTTP origin) or Full (HTTPS origin self-signed) / Full Strict (real cert).
  3) Disable Authenticated Origin Pulls unless origin is configured for them.
  4) Confirm no Cloudflare Spectrum/Workers route overrides the origin.
  5) After fix: SHOPTEST_REQUIRE_PRODUCTION=1 npm --prefix frontend run test:commercial-production-readiness
MSG
        ;;
    esac
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
