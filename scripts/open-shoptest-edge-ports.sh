#!/usr/bin/env bash
# Ensure HTTP/HTTPS origin edge can accept Cloudflare/origin health probes.
set -euo pipefail
if command -v iptables >/dev/null 2>&1; then
  if ! iptables -C INPUT -p tcp --dport 80 -m state --state NEW -j ACCEPT 2>/dev/null; then
    iptables -I INPUT 5 -p tcp --dport 80 -m state --state NEW -j ACCEPT
  fi
  if ! iptables -C INPUT -p tcp --dport 443 -m state --state NEW -j ACCEPT 2>/dev/null; then
    iptables -I INPUT 6 -p tcp --dport 443 -m state --state NEW -j ACCEPT
  fi
fi
echo "ShopTest edge ports 80/443 ensured open (host iptables)"
echo "NOTE: OCI Security List/NSG must also allow 80/443 from the internet/Cloudflare."
if command -v ss >/dev/null 2>&1; then
  ss -ltn | awk 'NR==1 || /:80 |:443 /' || true
fi
