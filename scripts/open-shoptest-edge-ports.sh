#!/usr/bin/env bash
# Audit or apply the minimum host firewall rules required by the public edge.
set -euo pipefail

mode="check"
scope="cloudflare"
persist=0
comment_prefix="shoptest-edge"
rules_dir="${SHOPTEST_IPTABLES_RULES_DIR:-/etc/iptables}"
restore_v4="${SHOPTEST_IPTABLES_RESTORE_V4:-iptables-restore}"
restore_v6="${SHOPTEST_IPTABLES_RESTORE_V6:-ip6tables-restore}"

cloudflare_ipv4=(
  173.245.48.0/20
  103.21.244.0/22
  103.22.200.0/22
  103.31.4.0/22
  141.101.64.0/18
  108.162.192.0/18
  190.93.240.0/20
  188.114.96.0/20
  197.234.240.0/22
  198.41.128.0/17
  162.158.0.0/15
  104.16.0.0/13
  104.24.0.0/14
  172.64.0.0/13
  131.0.72.0/22
)

cloudflare_ipv6=(
  2400:cb00::/32
  2606:4700::/32
  2803:f800::/32
  2405:b500::/32
  2405:8100::/32
  2a06:98c0::/29
  2c0f:f248::/32
)

usage() {
  cat <<'EOF'
Usage: scripts/open-shoptest-edge-ports.sh [--check | --apply] [--scope cloudflare|anywhere] [--persist]

Defaults to a read-only check with Cloudflare-only ingress expected.

  --check             Report live rule coverage without changing the host (default).
  --apply             Add missing live rules. Requires root.
  --scope cloudflare  Allow TCP 80/443 only from published Cloudflare ranges (default).
  --scope anywhere    Allow TCP 80/443 from any IPv4/IPv6 source.
  --persist           With --apply, atomically add equivalent rules to
                      /etc/iptables/rules.v4 and rules.v6 when applicable.
EOF
}

while (( $# > 0 )); do
  case "$1" in
    --check)
      mode="check"
      ;;
    --apply)
      mode="apply"
      ;;
    --scope)
      shift
      if (( $# == 0 )); then
        echo "ERROR: --scope requires cloudflare or anywhere" >&2
        exit 64
      fi
      scope="$1"
      ;;
    --scope=*)
      scope="${1#*=}"
      ;;
    --persist)
      persist=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage >&2
      exit 64
      ;;
  esac
  shift
done

if [[ "$scope" != "cloudflare" && "$scope" != "anywhere" ]]; then
  echo "ERROR: invalid scope: $scope" >&2
  exit 64
fi
if (( persist == 1 )) && [[ "$mode" != "apply" ]]; then
  echo "ERROR: --persist requires --apply" >&2
  exit 64
fi
if [[ "$mode" == "apply" && "$(/usr/bin/id -u)" != "0" ]]; then
  echo "ERROR: --apply requires root" >&2
  exit 77
fi
if ! command -v iptables >/dev/null 2>&1; then
  echo "ERROR: iptables is required" >&2
  exit 69
fi

has_global_ipv6() {
  command -v ip >/dev/null 2>&1 && ip -6 address show scope global 2>/dev/null | grep -q 'inet6 '
}

rule_present() {
  local command_name="$1"
  local source_cidr="$2"
  local port="$3"
  local rule_comment="$4"
  local args=(-C INPUT -p tcp)
  if [[ "$source_cidr" != "anywhere" ]]; then
    args+=(-s "$source_cidr")
  fi
  args+=(--dport "$port" -m conntrack --ctstate NEW -m comment --comment "$rule_comment" -j ACCEPT)
  "$command_name" "${args[@]}" >/dev/null 2>&1
}

broad_allow_present() {
  local command_name="$1"
  local port="$2"
  "$command_name" -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT >/dev/null 2>&1 \
    || "$command_name" -C INPUT -p tcp --dport "$port" -m conntrack --ctstate NEW -j ACCEPT >/dev/null 2>&1
}

has_terminal_input_block() {
  local command_name="$1"
  local policy
  policy="$("$command_name" -S INPUT 2>/dev/null | awk '$1 == "-P" && $2 == "INPUT" { print $3; exit }')"
  [[ "$policy" == "DROP" ]] \
    || "$command_name" -S INPUT 2>/dev/null | grep -Eq '^-A INPUT -j (REJECT|DROP)( |$)' \
    || "$command_name" -C INPUT -p tcp -m multiport --dports 80,443 \
      -m conntrack --ctstate NEW -m comment --comment "${comment_prefix}-non-cloudflare" \
      -j REJECT --reject-with tcp-reset >/dev/null 2>&1
}

insert_accept_rule() {
  local command_name="$1"
  local source_cidr="$2"
  local port="$3"
  local rule_comment="$4"
  local terminal_line
  local action=(-A INPUT)
  terminal_line="$("$command_name" -L INPUT --line-numbers -n 2>/dev/null \
    | awk '$2 == "REJECT" || $2 == "DROP" { print $1; exit }')"
  if [[ -n "$terminal_line" ]]; then
    action=(-I INPUT "$terminal_line")
  fi
  local args=("${action[@]}" -p tcp)
  if [[ "$source_cidr" != "anywhere" ]]; then
    args+=(-s "$source_cidr")
  fi
  args+=(--dport "$port" -m conntrack --ctstate NEW -m comment --comment "$rule_comment" -j ACCEPT)
  "$command_name" "${args[@]}"
}

ensure_edge_reject() {
  local command_name="$1"
  if has_terminal_input_block "$command_name"; then
    return
  fi
  "$command_name" -A INPUT -p tcp -m multiport --dports 80,443 \
    -m conntrack --ctstate NEW -m comment --comment "${comment_prefix}-non-cloudflare" \
    -j REJECT --reject-with tcp-reset
}

sources_for_scope() {
  local family="$1"
  if [[ "$scope" == "anywhere" ]]; then
    echo "anywhere"
  elif [[ "$family" == "4" ]]; then
    printf '%s\n' "${cloudflare_ipv4[@]}"
  else
    printf '%s\n' "${cloudflare_ipv6[@]}"
  fi
}

audit_family() {
  local family="$1"
  local command_name="$2"
  local missing=0
  local expected=0
  local source_cidr
  local port
  local rule_comment="${comment_prefix}-${scope}"
  while IFS= read -r source_cidr; do
    for port in 80 443; do
      expected=$((expected + 1))
      if ! rule_present "$command_name" "$source_cidr" "$port" "$rule_comment"; then
        missing=$((missing + 1))
        if [[ "$mode" == "apply" ]]; then
          insert_accept_rule "$command_name" "$source_cidr" "$port" "$rule_comment"
        fi
      fi
    done
  done < <(sources_for_scope "$family")

  if [[ "$scope" == "cloudflare" ]] && ! has_terminal_input_block "$command_name"; then
    if [[ "$mode" == "apply" ]]; then
      ensure_edge_reject "$command_name"
    else
      echo "WARN: IPv${family} has no terminal INPUT/edge block for non-Cloudflare 80/443 traffic" >&2
      missing=$((missing + 1))
    fi
  fi
  echo "IPv${family} edge rules: expected=${expected} missing_before_action=${missing} scope=${scope} mode=${mode}"
  (( missing == 0 ))
}

persistent_rule_line() {
  local source_cidr="$1"
  local port="$2"
  local rule_comment="$3"
  if [[ "$source_cidr" == "anywhere" ]]; then
    printf '%s' "-A INPUT -p tcp -m tcp --dport ${port} -m conntrack --ctstate NEW -m comment --comment \"${rule_comment}\" -j ACCEPT"
  else
    printf '%s' "-A INPUT -s ${source_cidr} -p tcp -m tcp --dport ${port} -m conntrack --ctstate NEW -m comment --comment \"${rule_comment}\" -j ACCEPT"
  fi
}

persist_family() {
  local family="$1"
  local rules_file="$2"
  local restore_command="$3"
  local additions=""
  local source_cidr
  local port
  local line
  local rule_comment="${comment_prefix}-${scope}"

  if [[ ! -f "$rules_file" ]]; then
    echo "ERROR: persistent rules file missing: $rules_file" >&2
    return 1
  fi
  while IFS= read -r source_cidr; do
    for port in 80 443; do
      line="$(persistent_rule_line "$source_cidr" "$port" "$rule_comment")"
      if ! grep -Fqx -- "$line" "$rules_file"; then
        additions+="${line}"$'\n'
      fi
    done
  done < <(sources_for_scope "$family")

  if [[ "$scope" == "cloudflare" ]] \
    && ! grep -Eq '^:INPUT (DROP|REJECT) ' "$rules_file" \
    && ! grep -Eq '^-A INPUT -j (REJECT|DROP)( |$)' "$rules_file" \
    && ! grep -Fq -- "--comment \"${comment_prefix}-non-cloudflare\"" "$rules_file"; then
    additions+="-A INPUT -p tcp -m multiport --dports 80,443 -m conntrack --ctstate NEW -m comment --comment \"${comment_prefix}-non-cloudflare\" -j REJECT --reject-with tcp-reset"$'\n'
  fi

  if [[ -z "$additions" ]]; then
    echo "Persistent IPv${family} edge rules already present in ${rules_file}"
    return
  fi

  local candidate
  local mode_bits
  candidate="$(mktemp "${rules_file}.shoptest.XXXXXX")"
  mode_bits="$(stat -c '%a' "$rules_file")"
  awk -v additions="$additions" '
    BEGIN { inserted = 0 }
    !inserted && /^-A INPUT -j (REJECT|DROP)( |$)/ { printf "%s", additions; inserted = 1 }
    !inserted && /^COMMIT$/ { printf "%s", additions; inserted = 1 }
    { print }
    END { if (!inserted) printf "%s", additions }
  ' "$rules_file" > "$candidate"
  if ! "$restore_command" --test < "$candidate"; then
    rm -f -- "$candidate"
    echo "ERROR: generated persistent IPv${family} rules failed validation" >&2
    return 1
  fi
  cp -p -- "$rules_file" "${rules_file}.shoptest-backup"
  install -o root -g root -m "$mode_bits" -- "$candidate" "$rules_file"
  rm -f -- "$candidate"
  echo "Persisted IPv${family} edge rules to ${rules_file} (backup: ${rules_file}.shoptest-backup)"
}

if [[ "$scope" == "cloudflare" ]]; then
  for port in 80 443; do
    if broad_allow_present iptables "$port"; then
      echo "ERROR: existing broad IPv4 allow for TCP ${port} conflicts with Cloudflare-only scope; remove it explicitly before applying restricted rules" >&2
      exit 78
    fi
  done
fi

audit_failed=0
audit_family 4 iptables || audit_failed=1

ipv6_active=0
if has_global_ipv6; then
  ipv6_active=1
  if ! command -v ip6tables >/dev/null 2>&1; then
    echo "ERROR: global IPv6 is active but ip6tables is unavailable" >&2
    exit 69
  fi
  if [[ "$scope" == "cloudflare" ]]; then
    for port in 80 443; do
      if broad_allow_present ip6tables "$port"; then
        echo "ERROR: existing broad IPv6 allow for TCP ${port} conflicts with Cloudflare-only scope" >&2
        exit 78
      fi
    done
  fi
  audit_family 6 ip6tables || audit_failed=1
else
  echo "IPv6 edge rules: skipped (no global IPv6 address)"
fi

if [[ "$mode" == "apply" ]]; then
  audit_failed=0
  audit_family 4 iptables || audit_failed=1
  if (( ipv6_active == 1 )); then
    audit_family 6 ip6tables || audit_failed=1
  fi
fi

if (( persist == 1 )); then
  persist_family 4 "${rules_dir}/rules.v4" "$restore_v4"
  if (( ipv6_active == 1 )); then
    persist_family 6 "${rules_dir}/rules.v6" "$restore_v6"
  fi
fi

ss -ltn 2>/dev/null | awk 'NR==1 || /:80 |:443 /' || true
echo "NOTE: OCI Security List/NSG must independently allow TCP 80/443 from the same source scope."

if (( audit_failed == 1 )); then
  if [[ "$mode" == "check" ]]; then
    echo "RESULT: edge firewall rules are not ready; rerun with --apply and optionally --persist after production authorization" >&2
  else
    echo "ERROR: edge firewall rules remain incomplete after apply" >&2
  fi
  exit 1
fi

echo "RESULT: edge firewall rules ready (scope=${scope}, persistent=${persist})"
