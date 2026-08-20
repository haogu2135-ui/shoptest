#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
script_path="${repo_root}/scripts/open-shoptest-edge-ports.sh"
test_dir="$(mktemp -d)"
trap 'rm -rf -- "$test_dir"' EXIT
fake_bin="${test_dir}/bin"
command_log="${test_dir}/commands.log"
rule_state="${test_dir}/rules.state"
rules_dir="${test_dir}/iptables"
mkdir -p "$fake_bin"
mkdir -p "$rules_dir"
: > "$rule_state"

cat > "${rules_dir}/rules.v4" <<'EOF'
*filter
:INPUT ACCEPT [0:0]
:FORWARD ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]
-A INPUT -j REJECT --reject-with icmp-host-prohibited
COMMIT
EOF

cat > "${fake_bin}/iptables" <<'EOF'
#!/usr/bin/env bash
printf 'iptables' >> "$SHOPTEST_FIREWALL_TEST_LOG"
printf ' %q' "$@" >> "$SHOPTEST_FIREWALL_TEST_LOG"
printf '\n' >> "$SHOPTEST_FIREWALL_TEST_LOG"
case "${1:-}" in
  -C)
    key="${*:3}"
    grep -Fqx -- "$key" "$SHOPTEST_FIREWALL_TEST_STATE"
    ;;
  -I)
    key="${*:4}"
    printf '%s\n' "$key" >> "$SHOPTEST_FIREWALL_TEST_STATE"
    ;;
  -A)
    key="${*:3}"
    printf '%s\n' "$key" >> "$SHOPTEST_FIREWALL_TEST_STATE"
    ;;
  -S)
    echo '-P INPUT ACCEPT'
    echo '-A INPUT -j REJECT --reject-with icmp-host-prohibited'
    ;;
  -L)
    cat <<'RULES'
Chain INPUT (policy ACCEPT)
num  target     prot opt source               destination
5    REJECT     all  --  0.0.0.0/0            0.0.0.0/0
RULES
    ;;
esac
EOF

cat > "${fake_bin}/ip" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

cat > "${fake_bin}/ss" <<'EOF'
#!/usr/bin/env bash
echo 'State Recv-Q Send-Q Local Address:Port Peer Address:Port'
EOF

cat > "${fake_bin}/iptables-restore" <<'EOF'
#!/usr/bin/env bash
cat >/dev/null
EOF

chmod +x "${fake_bin}/iptables" "${fake_bin}/ip" "${fake_bin}/ss" "${fake_bin}/iptables-restore"
export SHOPTEST_FIREWALL_TEST_LOG="$command_log"
export SHOPTEST_FIREWALL_TEST_STATE="$rule_state"
export SHOPTEST_IPTABLES_RULES_DIR="$rules_dir"

if PATH="${fake_bin}:${PATH}" "$script_path" >/dev/null 2>&1; then
  echo 'FAIL: default read-only audit should fail when edge rules are missing' >&2
  exit 1
fi
if grep -Eq '^iptables -(I|A|D|R|F|X) ' "$command_log"; then
  echo 'FAIL: default invocation mutated iptables' >&2
  exit 1
fi

if [[ "$(/usr/bin/id -u)" == "0" ]]; then
  : > "$command_log"
  PATH="${fake_bin}:${PATH}" "$script_path" --apply --scope cloudflare --persist >/dev/null
  inserted="$(grep -Ec '^iptables -I INPUT ' "$command_log")"
  if [[ "$inserted" != "30" ]]; then
    echo "FAIL: expected 30 Cloudflare IPv4 accept inserts, got ${inserted}" >&2
    exit 1
  fi
  if grep -E '^iptables -I INPUT ' "$command_log" | grep -Ev -- '--comment shoptest-edge-cloudflare' >/dev/null; then
    echo 'FAIL: applied rule missing ownership comment' >&2
    exit 1
  fi
  persisted="$(grep -c -- '--comment "shoptest-edge-cloudflare"' "${rules_dir}/rules.v4")"
  if [[ "$persisted" != "30" ]]; then
    echo "FAIL: expected 30 persisted Cloudflare IPv4 rules, got ${persisted}" >&2
    exit 1
  fi
  if [[ ! -f "${rules_dir}/rules.v4.shoptest-backup" ]]; then
    echo 'FAIL: persistent rules backup missing' >&2
    exit 1
  fi
  if [[ -x /usr/sbin/iptables-restore ]]; then
    /usr/sbin/iptables-restore --test < "${rules_dir}/rules.v4"
  fi
fi

echo 'PASS open-shoptest-edge-ports defaults read-only and applies Cloudflare-scoped IPv4 rules explicitly'
