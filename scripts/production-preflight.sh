#!/usr/bin/env bash
set -euo pipefail

include_staging=false

for arg in "$@"; do
  case "$arg" in
    --include-staging)
      include_staging=true
      ;;
    -h | --help)
      cat <<'USAGE'
Usage: scripts/production-preflight.sh [--include-staging]

Runs DNS and HTTP smoke checks for Dhanam public endpoints. Staging checks are
optional because staging is currently gated on ArgoCD registration, staging
Vault/ESO values, and namespace-aware Enclii tunnel routes.
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

check_dns() {
  local host="$1"
  if ! dig +short "$host" | grep -q .; then
    echo "DNS FAIL  $host"
    return 1
  fi
  echo "DNS OK    $host"
}

check_http() {
  local url="$1"
  local expected="${2:-200}"
  local status

  status="$(curl -L -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url")"
  if [[ "$status" != "$expected" ]]; then
    echo "HTTP FAIL $url expected=$expected actual=$status"
    return 1
  fi
  echo "HTTP OK   $url status=$status"
}

check_redirect() {
  local url="$1"
  local expected_location="$2"
  local location

  location="$(curl -sSI --max-time 20 "$url" | awk 'BEGIN{IGNORECASE=1} /^location:/ {sub(/\r$/, "", $2); print $2; exit}')"
  if [[ "$location" != "$expected_location" ]]; then
    echo "REDIR FAIL $url expected=$expected_location actual=${location:-<none>}"
    return 1
  fi
  echo "REDIR OK   $url -> $location"
}

check_prod_public_surface() {
  local url="$1"
  local html
  local csp

  html="$(curl -LsS --max-time 20 "$url" || true)"
  if [[ -z "$html" ]]; then
    echo "SURFACE FAIL $url empty response body"
    return 1
  fi

  if echo "$html" | grep -q 'staging\.dhan\.am'; then
    echo "SURFACE FAIL $url HTML references staging.dhan.am"
    return 1
  fi

  csp="$(curl -sSI --max-time 20 "$url" | awk 'BEGIN{IGNORECASE=1} /^content-security-policy:/ {sub(/^content-security-policy:[[:space:]]*/i, ""); sub(/\r$/, ""); print; exit}')"
  if [[ -n "$csp" && "$csp" == *staging-api.dhan.am* ]]; then
    echo "SURFACE FAIL $url CSP connect-src still allows staging-api.dhan.am"
    return 1
  fi

  echo "SURFACE OK $url"
}

prod_hosts=(dhan.am www.dhan.am app.dhan.am admin.dhan.am api.dhan.am)
for host in "${prod_hosts[@]}"; do
  check_dns "$host"
done

check_http "https://api.dhan.am/v1/monitoring/health/live"
check_http "https://app.dhan.am/api/health"
check_http "https://admin.dhan.am/api/health"
check_http "https://dhan.am/"
check_redirect "https://www.dhan.am/" "https://dhan.am/"
check_prod_public_surface "https://dhan.am/es"
check_prod_public_surface "https://app.dhan.am/login"

if [[ "$include_staging" == true ]]; then
  staging_hosts=(staging.dhan.am staging-api.dhan.am staging-admin.dhan.am)
  for host in "${staging_hosts[@]}"; do
    check_dns "$host"
  done

  check_http "https://staging-api.dhan.am/health"
  check_http "https://staging.dhan.am/api/health"
  check_http "https://staging-admin.dhan.am/api/health"
fi
