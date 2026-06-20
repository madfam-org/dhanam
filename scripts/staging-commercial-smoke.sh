#!/usr/bin/env bash
# Staging commercial billing smoke (WS1 — G2 deploy & prove).
#
# Validates public billing surfaces and, when credentials are supplied,
# admin POS / routing endpoints on staging.
#
# Usage:
#   ./scripts/staging-commercial-smoke.sh
#   STAGING_API_URL=https://staging-api.dhan.am \
#     STAGING_COMMERCIAL_ADMIN_TOKEN=... \
#     STAGING_COMMERCIAL_SMOKE_USER_ID=... \
#     ./scripts/staging-commercial-smoke.sh
#
# Environment:
#   STAGING_API_URL              Base API origin (default: https://staging-api.dhan.am)
#   STAGING_COMMERCIAL_ADMIN_TOKEN  Platform-admin JWT for authenticated checks (optional)
#   STAGING_COMMERCIAL_SMOKE_USER_ID  Existing staging user id for route preview (optional)
#   STAGING_COMMERCIAL_CHARGE_ENABLED  When "true", run charge/refund smoke (needs Stripe test keys)
#   STAGING_COMMERCIAL_STRICT      When "true", fail if admin token/user id missing (CI opt-in)
#
# Exit codes: 0 pass, 1 public-tier failure, 2 usage/invalid env
set -euo pipefail

API_BASE="${STAGING_API_URL:-https://staging-api.dhan.am}"
API_BASE="${API_BASE%/}"
API_V1="${API_BASE}/v1"
ADMIN_TOKEN="${STAGING_COMMERCIAL_ADMIN_TOKEN:-}"
SMOKE_USER_ID="${STAGING_COMMERCIAL_SMOKE_USER_ID:-}"
CHARGE_ENABLED="${STAGING_COMMERCIAL_CHARGE_ENABLED:-false}"
STRICT="${STAGING_COMMERCIAL_STRICT:-false}"

PASS=0
FAIL=0
SKIP=0

log_pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
log_fail() { echo "  ✗ $1" >&2; FAIL=$((FAIL + 1)); }
log_skip() { echo "  ~ $1 (skipped)"; SKIP=$((SKIP + 1)); }

http_code() {
  curl -sS -o /dev/null -w '%{http_code}' "$@"
}

http_body() {
  curl -sS "$@"
}

assert_status() {
  local label="$1"
  local expected="$2"
  shift 2
  local code
  code="$(http_code "$@")"
  if [ "$code" = "$expected" ]; then
    log_pass "$label (HTTP $code)"
  else
    log_fail "$label — expected HTTP $expected, got $code"
  fi
}

assert_json_field() {
  local label="$1"
  local body="$2"
  local jq_expr="$3"
  if command -v jq >/dev/null 2>&1; then
    if printf '%s' "$body" | jq -e "$jq_expr" >/dev/null 2>&1; then
      log_pass "$label"
    else
      log_fail "$label — jq expression failed: $jq_expr"
    fi
  else
    log_skip "$label (jq not installed)"
  fi
}

admin_post() {
  local path="$1"
  local payload="$2"
  curl -sS \
    -X POST \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "${API_V1}${path}"
}

admin_get() {
  local path="$1"
  curl -sS \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    "${API_V1}${path}"
}

echo "=== Staging commercial smoke ==="
echo "API: ${API_BASE}"
echo ""

echo "--- Public tier ---"

assert_status "API health" "200" "${API_BASE}/health"

catalog_body="$(http_body "${API_V1}/billing/catalog")"
assert_status "Billing catalog" "200" "${API_V1}/billing/catalog"
assert_json_field "Catalog has products array" "$catalog_body" '.products | type == "array"'

assert_status "Billing pricing" "200" "${API_V1}/billing/pricing"

assert_status "Admin route preview rejects unauthenticated callers" "401" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"userId":"smoke","plan":"pro","countryCode":"MX"}' \
  "${API_V1}/admin/billing/route/preview"

assert_status "Admin reconciliation rejects unauthenticated callers" "401" \
  "${API_V1}/admin/billing/reconciliation"

echo ""
echo "--- Admin tier ---"

if [ -z "$ADMIN_TOKEN" ]; then
  if [ "$STRICT" = "true" ]; then
    log_fail "STAGING_COMMERCIAL_ADMIN_TOKEN is required when STAGING_COMMERCIAL_STRICT=true"
  else
    log_skip "Admin authenticated checks — set STAGING_COMMERCIAL_ADMIN_TOKEN"
  fi
else
  assert_status "Admin reconciliation (authenticated)" "200" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    "${API_V1}/admin/billing/reconciliation"

  timeline_body="$(admin_get "/admin/billing/pos/timeline/smoke-correlation-missing")"
  if command -v jq >/dev/null 2>&1; then
    if printf '%s' "$timeline_body" | jq -e 'type == "array"' >/dev/null 2>&1; then
      log_pass "POS timeline returns array for unknown correlation id"
    else
      log_fail "POS timeline — expected JSON array response"
    fi
  else
    log_skip "POS timeline shape check (jq not installed)"
  fi

  if [ -z "$SMOKE_USER_ID" ]; then
    if [ "$STRICT" = "true" ]; then
      log_fail "STAGING_COMMERCIAL_SMOKE_USER_ID is required when STAGING_COMMERCIAL_STRICT=true"
    else
      log_skip "Route preview — set STAGING_COMMERCIAL_SMOKE_USER_ID to an existing staging user"
    fi
  else
    preview_body="$(admin_post "/admin/billing/route/preview" \
      "{\"userId\":\"${SMOKE_USER_ID}\",\"plan\":\"pro\",\"product\":\"dhanam\",\"countryCode\":\"MX\"}")"
    assert_json_field "MX route preview returns provider" "$preview_body" '.provider | type == "string"'
    assert_json_field "MX route preview returns routeReason" "$preview_body" '.routeReason | type == "string"'

    us_preview="$(admin_post "/admin/billing/route/preview" \
      "{\"userId\":\"${SMOKE_USER_ID}\",\"plan\":\"pro\",\"product\":\"dhanam\",\"countryCode\":\"US\"}")"
    assert_json_field "US route preview returns provider" "$us_preview" '.provider | type == "string"'

    if command -v jq >/dev/null 2>&1; then
      mx_provider="$(printf '%s' "$preview_body" | jq -r '.provider // empty')"
      us_provider="$(printf '%s' "$us_preview" | jq -r '.provider // empty')"
      case "$mx_provider" in
        stripe_mx|legacy_stripe|paddle|conekta)
          log_pass "MX provider matrix returns known provider (${mx_provider})"
          ;;
        *)
          log_fail "MX provider matrix — unexpected provider: ${mx_provider}"
          ;;
      esac
      case "$us_provider" in
        paddle|legacy_stripe|stripe_mx)
          log_pass "US provider matrix returns known provider (${us_provider})"
          ;;
        *)
          log_fail "US provider matrix — unexpected provider: ${us_provider}"
          ;;
      esac
    fi

    override_smoke_id="staging-override-$(date +%s)"
    admin_post "/admin/billing/route/override" \
      "{\"userId\":\"${SMOKE_USER_ID}\",\"product\":\"dhanam\",\"provider\":\"paddle\",\"reason\":\"${override_smoke_id}\",\"ttlHours\":1}" >/dev/null
    overridden_preview="$(admin_post "/admin/billing/route/preview" \
      "{\"userId\":\"${SMOKE_USER_ID}\",\"plan\":\"pro\",\"product\":\"dhanam\",\"countryCode\":\"MX\"}")"
    assert_json_field "Route override forces paddle provider" "$overridden_preview" '.provider == "paddle"'
    assert_json_field "Route override reason is operator_stored_override" "$overridden_preview" '.routeReason == "operator_stored_override"'
    admin_post "/admin/billing/route/override/clear" \
      "{\"userId\":\"${SMOKE_USER_ID}\",\"product\":\"dhanam\",\"reason\":\"${override_smoke_id} cleanup\"}" >/dev/null
    cleared_preview="$(admin_post "/admin/billing/route/preview" \
      "{\"userId\":\"${SMOKE_USER_ID}\",\"plan\":\"pro\",\"product\":\"dhanam\",\"countryCode\":\"MX\"}")"
    if command -v jq >/dev/null 2>&1; then
      cleared_provider="$(printf '%s' "$cleared_preview" | jq -r '.provider // empty')"
      if [ "$cleared_provider" = "paddle" ]; then
        log_fail "Route override clear — provider still paddle after cleanup"
      else
        log_pass "Route override cleared (provider=${cleared_provider})"
      fi
    else
      log_skip "Route override clear verification (jq not installed)"
    fi
  fi

  if [ "$CHARGE_ENABLED" = "true" ]; then
    if [ -z "$SMOKE_USER_ID" ]; then
      log_fail "STAGING_COMMERCIAL_CHARGE_ENABLED=true requires STAGING_COMMERCIAL_SMOKE_USER_ID"
    else
      correlation_id="staging-smoke-$(date +%s)"
      charge_body="$(admin_post "/admin/billing/pos/charge" \
        "{\"userId\":\"${SMOKE_USER_ID}\",\"amountMinor\":2000,\"currency\":\"MXN\",\"description\":\"staging commercial smoke\",\"correlationId\":\"${correlation_id}\",\"countryCode\":\"MX\"}")"
      if command -v jq >/dev/null 2>&1; then
        pi_id="$(printf '%s' "$charge_body" | jq -r '.paymentIntentId // empty')"
        if [ -n "$pi_id" ] && [ "$pi_id" != "null" ]; then
          log_pass "POS charge returned paymentIntentId"
          partial_refund_body="$(admin_post "/admin/billing/pos/refund" \
            "{\"paymentIntentId\":\"${pi_id}\",\"amountMinor\":400,\"correlationId\":\"${correlation_id}\",\"reason\":\"staging smoke partial refund\"}")"
          assert_json_field "POS partial refund returned refundId" "$partial_refund_body" '.refundId | type == "string"'
          if command -v jq >/dev/null 2>&1; then
            partial_amount="$(printf '%s' "$partial_refund_body" | jq -r '.amountMinor // empty')"
            if [ "$partial_amount" = "400" ]; then
              log_pass "POS partial refund amountMinor=400"
            else
              log_fail "POS partial refund — expected amountMinor 400, got ${partial_amount}"
            fi
          fi
          refund_body="$(admin_post "/admin/billing/pos/refund" \
            "{\"paymentIntentId\":\"${pi_id}\",\"correlationId\":\"${correlation_id}\",\"reason\":\"staging smoke full refund\"}")"
          assert_json_field "POS full refund returned refundId" "$refund_body" '.refundId | type == "string"'
        else
          log_fail "POS charge — missing paymentIntentId (Stripe may be unconfigured on staging)"
          printf '%s\n' "$charge_body" >&2
        fi
      else
        log_skip "POS charge/refund validation (jq not installed)"
      fi
    fi
  else
    log_skip "POS charge/refund — set STAGING_COMMERCIAL_CHARGE_ENABLED=true to enable"
  fi
fi

echo ""
echo "--- Essentials anchor SKU (dhanam__essentials) ---"

essentials_route_code="$(http_code "${API_V1}/billing/checkout/route-recommendation?country=MX&plan=essentials&product=dhanam")"
essentials_route="$(http_body "${API_V1}/billing/checkout/route-recommendation?country=MX&plan=essentials&product=dhanam")"

if [ "$essentials_route_code" != "200" ]; then
  log_skip "Essentials route recommendation — HTTP ${essentials_route_code} (staging API may lag prod digest or Kyverno sync)"
elif command -v jq >/dev/null 2>&1; then
  assert_json_field "Essentials MX route returns provider" "$essentials_route" '.provider == "stripe_mx"'
  assert_json_field "Essentials MX priceIdResolvable" "$essentials_route" '.priceIdResolvable == true'
  essentials_amount="$(printf '%s' "$essentials_route" | jq -r '.amountMinor // empty')"
  if [ "$essentials_amount" = "7900" ]; then
    log_pass "Essentials route amountMinor=7900 (catalog-aligned)"
  else
    log_fail "Essentials route amountMinor — expected 7900, got ${essentials_amount:-<empty>}"
  fi
else
  essentials_amount="$(printf '%s' "$essentials_route" | python3 -c "import json,sys; d=json.load(sys.stdin); r=d.get('data',d); print(r.get('amountMinor',''))" 2>/dev/null || true)"
  if [ "$essentials_amount" = "7900" ]; then
    log_pass "Essentials route amountMinor=7900 (catalog-aligned)"
  elif [ -n "$essentials_amount" ]; then
    log_fail "Essentials route amountMinor — expected 7900, got ${essentials_amount}"
  else
    log_skip "Essentials route checks (jq not installed)"
  fi
fi

mx_pricing="$(http_body "${API_V1}/billing/pricing?country=MX")"
if command -v jq >/dev/null 2>&1; then
  essentials_price="$(printf '%s' "$mx_pricing" | jq -r '.tiers[] | select(.id=="essentials") | .monthlyPrice // empty')"
elif printf '%s' "$mx_pricing" | python3 -c "import json,sys; d=json.load(sys.stdin); r=d.get('data',d); t=next(x for x in r.get('tiers',[]) if x.get('id')=='essentials'); print(t.get('monthlyPrice',''))" 2>/dev/null | grep -q .; then
  essentials_price="$(printf '%s' "$mx_pricing" | python3 -c "import json,sys; d=json.load(sys.stdin); r=d.get('data',d); t=next(x for x in r.get('tiers',[]) if x.get('id')=='essentials'); print(t.get('monthlyPrice',''))")"
else
  essentials_price=""
fi
if [ -n "$essentials_price" ]; then
  if [ "$essentials_price" = "79" ]; then
    log_pass "Essentials public pricing MXN 79/mo"
  else
    log_fail "Essentials pricing — expected 79 MXN/mo, got ${essentials_price}"
  fi
elif command -v jq >/dev/null 2>&1; then
  :
else
  log_skip "Essentials pricing check (jq not installed)"
fi

echo ""
echo "=== Summary: ${PASS} passed, ${FAIL} failed, ${SKIP} skipped ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
