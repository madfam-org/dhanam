#!/usr/bin/env bash
# Pre-flight checks for dhanam__essentials first live purchase (G0–G5).
#
# Read-only against the target API + optional cluster kubectl checks.
# Does NOT initiate checkout or flip FEATURE_STRIPE_MXN_LIVE.
#
# Usage:
#   ./scripts/essentials-purchase-preflight.sh
#   DHANAM_API=https://api.dhan.am ./scripts/essentials-purchase-preflight.sh
#   KUBECONFIG=~/.kube/config-hetzner ./scripts/essentials-purchase-preflight.sh
#
# Optional authenticated smoke (creates checkout URL only — does not pay):
#   DHANAM_TOKEN='…' ./scripts/essentials-purchase-preflight.sh
set -euo pipefail

API="${DHANAM_API:-https://api.dhan.am}"
API="${API%/}"
API_V1="${API}/v1"
PLAN="${PLAN:-essentials}"
PRODUCT="${PRODUCT:-dhanam}"
COUNTRY="${COUNTRY:-MX}"

PASS=0
FAIL=0
WARN=0

log_pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
log_fail() { echo "  ✗ $1" >&2; FAIL=$((FAIL + 1)); }
log_warn() { echo "  ! $1"; WARN=$((WARN + 1)); }

json_get() {
  local body="$1"
  local key="$2"
  BODY="$body" KEY="$key" python3 << 'PY'
import json, os
body = os.environ.get("BODY", "")
key = os.environ.get("KEY", "")
try:
    d = json.loads(body)
    root = d.get("data", d)
    if key == "essentials_price":
        t = next(x for x in root.get("tiers", []) if x.get("id") == "essentials")
        print(t.get("monthlyPrice", ""))
    elif key == "essentials_currency":
        t = next(x for x in root.get("tiers", []) if x.get("id") == "essentials")
        print(t.get("currency", ""))
    elif key == "route_provider":
        print(root.get("provider", ""))
    elif key == "route_currency":
        print(root.get("currency", ""))
    elif key == "route_resolvable":
        print(str(root.get("priceIdResolvable", "")).lower())
    elif key == "api_error":
        err = d.get("error") or root.get("error")
        print(err.get("message", "") if isinstance(err, dict) else "")
    elif key == "checkout_url":
        print(root.get("checkoutUrl", d.get("checkoutUrl", "")))
    elif key == "checkout_provider":
        print(root.get("provider", d.get("provider", "")))
except Exception:
    pass
PY
}

echo "=== dhanam__essentials purchase preflight ==="
echo "API: ${API}"
echo "SKU: ${PRODUCT}__${PLAN} country=${COUNTRY}"
echo ""

echo "--- Public API ---"

health_code="$(curl -sS -o /dev/null -w '%{http_code}' "${API}/health/full" || echo 000)"
if [ "$health_code" = "200" ]; then
  log_pass "API /health/full HTTP 200"
else
  log_fail "/health/full HTTP ${health_code}"
fi

pricing_body="$(curl -sS "${API_V1}/billing/pricing?country=${COUNTRY}" 2>/dev/null || true)"
if [ -n "$pricing_body" ]; then
  mx_price="$(json_get "$pricing_body" essentials_price)"
  mx_cur="$(json_get "$pricing_body" essentials_currency)"
  if [ "$mx_price" = "79" ] && [ "$mx_cur" = "MXN" ]; then
    log_pass "Public pricing: Essentials MXN 79/mo"
  else
    log_fail "Public pricing mismatch (got ${mx_price} ${mx_cur}, want 79 MXN)"
  fi
else
  log_fail "Could not parse /billing/pricing response"
fi

route_body="$(curl -sS "${API_V1}/billing/checkout/route-recommendation?country=${COUNTRY}&plan=${PLAN}&product=${PRODUCT}" 2>/dev/null || true)"
if [ -n "$route_body" ]; then
  api_err="$(json_get "$route_body" api_error)"
  if [ -n "$api_err" ]; then
    log_fail "Route preview error: ${api_err}"
  else
  provider="$(json_get "$route_body" route_provider)"
  currency="$(json_get "$route_body" route_currency)"
  resolvable="$(json_get "$route_body" route_resolvable)"
  route_amount="$(BODY="$route_body" KEY=route_amount python3 << 'PY'
import json, os
try:
    d = json.loads(os.environ.get("BODY", ""))
    root = d.get("data", d)
    print(root.get("amountMinor", ""))
except Exception:
    pass
PY
)"
  if [ "$provider" = "stripe_mx" ] && [ "$currency" = "MXN" ] && [ "$resolvable" = "true" ]; then
    log_pass "Checkout route: stripe_mx / MXN / priceIdResolvable"
  else
    log_fail "Route preview unexpected (provider=${provider} currency=${currency} resolvable=${resolvable})"
  fi
  if [ "$PLAN" = "essentials" ] && [ "$route_amount" = "7900" ]; then
    log_pass "Route amountMinor matches Essentials catalog (7900 centavos)"
  elif [ "$PLAN" = "essentials" ] && [ -n "$route_amount" ]; then
    log_fail "Route amountMinor mismatch for essentials (got ${route_amount}, want 7900)"
  fi
  fi
else
  log_fail "Empty route-recommendation response"
fi

echo ""
echo "--- Cluster (optional) ---"

if command -v kubectl >/dev/null 2>&1 && kubectl -n dhanam get deploy dhanam-api >/dev/null 2>&1; then
  live_flag="$(kubectl -n dhanam get deploy dhanam-api -o jsonpath='{.spec.template.spec.containers[?(@.name=="api")].env[?(@.name=="FEATURE_STRIPE_MXN_LIVE")].value}' 2>/dev/null || true)"
  if [ "$live_flag" = "true" ]; then
    log_pass "FEATURE_STRIPE_MXN_LIVE=true (live CFDI relay enabled)"
  else
    log_warn "FEATURE_STRIPE_MXN_LIVE=${live_flag:-unset} — flip after staging proof, before live card"
  fi

  for secret_check in DHANAM_WEBHOOK_SECRET STRIPE_MX_SECRET_KEY STRIPE_MX_WEBHOOK_SECRET; do
    if kubectl -n dhanam exec deploy/dhanam-api -c api -- printenv "$secret_check" 2>/dev/null | grep -q .; then
      log_pass "${secret_check} mounted on dhanam-api"
    else
      log_fail "${secret_check} missing on dhanam-api pod"
    fi
  done

  pwurls="$(kubectl -n dhanam exec deploy/dhanam-api -c api -- printenv PRODUCT_WEBHOOK_URLS 2>/dev/null || true)"
  if printf '%s' "$pwurls" | grep -q 'karafiel:'; then
    log_pass "PRODUCT_WEBHOOK_URLS includes Karafiel CFDI target"
  else
    log_fail "PRODUCT_WEBHOOK_URLS missing karafiel entry"
  fi
else
  log_warn "kubectl/dhanam-api unavailable — skipping cluster checks"
fi

echo ""
echo "--- Downstream reachability ---"

for url in "https://api.karafiel.mx/health" "https://crm.madfam.io"; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null || echo 000)"
  if [ "$code" != "000" ]; then
    log_pass "${url} reachable (HTTP ${code})"
  else
    log_fail "${url} unreachable"
  fi
done

echo ""
echo "--- Authenticated checkout (optional) ---"

if [ -n "${DHANAM_TOKEN:-}" ]; then
  upgrade_body="$(curl -sS -X POST \
    -H "Authorization: Bearer ${DHANAM_TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "{\"plan\":\"${PLAN}\",\"product\":\"${PRODUCT}\",\"countryCode\":\"${COUNTRY}\"}" \
    "${API_V1}/billing/upgrade" 2>/dev/null || true)"
  url="$(json_get "$upgrade_body" checkout_url)"
  provider="$(json_get "$upgrade_body" checkout_provider)"
  if [ -n "$url" ] && printf '%s' "$url" | grep -q 'checkout.stripe.com'; then
    log_pass "POST /billing/upgrade returned Stripe checkout (provider=${provider})"
    echo "      checkout URL ready (pay manually when live flag is on)"
  elif [ -n "$upgrade_body" ]; then
    log_fail "Upgrade response missing Stripe checkout URL — $(printf '%s' "$upgrade_body" | head -c 200)"
  else
    log_fail "POST /billing/upgrade returned empty response"
  fi
else
  log_warn "Set DHANAM_TOKEN to verify authenticated checkout URL generation"
fi

echo ""
echo "=== Summary: ${PASS} passed, ${FAIL} failed, ${WARN} warnings ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
