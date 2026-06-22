#!/usr/bin/env bash
# PM-1m: LunchMoney import staging smoke (sandbox token + Janua JWT).
#
# Requires FEATURE_LUNCHMONEY_IMPORT=true on staging API.
#
# Usage:
#   STAGING_API_URL=https://staging-api.dhan.am/v1 \
#   STAGING_JWT="<janua access token>" \
#   STAGING_SPACE_ID="<user space uuid>" \
#   LUNCHMONEY_API_TOKEN="<sandbox lm token>" \
#     ./scripts/pm1-lunchmoney-staging-smoke.sh
#
# Optional:
#   START_IMPORT=true  — enqueue async job and poll to terminal state
#   POLL_SECONDS=120   — max wait when START_IMPORT=true
set -euo pipefail

API="${STAGING_API_URL:-https://staging-api.dhan.am/v1}"
API="${API%/}"
JWT="${STAGING_JWT:-${STAGING_COMMERCIAL_ADMIN_TOKEN:-}}"
SPACE_ID="${STAGING_SPACE_ID:-}"
LM_TOKEN="${LUNCHMONEY_API_TOKEN:-}"
START_IMPORT="${START_IMPORT:-false}"
POLL_SECONDS="${POLL_SECONDS:-120}"

pass=0
fail=0
skip=0

log_pass() { echo "  ✓ $*"; pass=$((pass + 1)); }
log_fail() { echo "  ✗ $*"; fail=$((fail + 1)); }
log_skip() { echo "  ~ $*"; skip=$((skip + 1)); }

auth_header() {
  if [ -z "$JWT" ]; then
    echo ""
    return
  fi
  printf 'Authorization: Bearer %s' "$JWT"
}

require_env() {
  local name="$1"
  local val="$2"
  if [ -z "$val" ]; then
    log_fail "Missing ${name}"
    return 1
  fi
  return 0
}

echo "=== PM-1m LunchMoney staging smoke ==="
echo "API: ${API}"
echo ""

missing=0
require_env "STAGING_JWT (or STAGING_COMMERCIAL_ADMIN_TOKEN)" "$JWT" || missing=1
require_env "STAGING_SPACE_ID" "$SPACE_ID" || missing=1
require_env "LUNCHMONEY_API_TOKEN" "$LM_TOKEN" || missing=1
if [ "$missing" -ne 0 ]; then
  echo ""
  echo "=== Summary: ${pass} passed, ${fail} failed, ${skip} skipped ==="
  exit 1
fi

echo "--- Feature flag ---"
status_code="$(curl -sS -o /tmp/lm-status.json -w '%{http_code}' \
  -H "$(auth_header)" \
  "${API}/spaces/${SPACE_ID}/migration/status" || true)"
if [ "$status_code" != "200" ]; then
  log_fail "migration/status HTTP ${status_code}"
else
  if jq -e '.lunchMoney == true' /tmp/lm-status.json >/dev/null 2>&1; then
    log_pass "FEATURE_LUNCHMONEY_IMPORT enabled (lunchMoney=true)"
  else
    log_fail "lunchMoney flag false — flip FEATURE_LUNCHMONEY_IMPORT on staging API"
    jq . /tmp/lm-status.json 2>/dev/null || true
  fi
fi

echo ""
echo "--- Preflight (read-only) ---"
preflight_code="$(curl -sS -o /tmp/lm-preflight.json -w '%{http_code}' \
  -X POST \
  -H "$(auth_header)" \
  -H 'Content-Type: application/json' \
  -d "{\"apiToken\":\"${LM_TOKEN}\"}" \
  "${API}/spaces/${SPACE_ID}/migration/lunchmoney/preflight" || true)"
if [ "$preflight_code" != "200" ] && [ "$preflight_code" != "201" ]; then
  log_fail "preflight HTTP ${preflight_code}"
  cat /tmp/lm-preflight.json 2>/dev/null || true
else
  accounts="$(jq -r '.counts.accounts // .counts.plaidAccounts // 0' /tmp/lm-preflight.json 2>/dev/null || echo 0)"
  txns="$(jq -r '.counts.transactions // 0' /tmp/lm-preflight.json 2>/dev/null || echo 0)"
  log_pass "preflight OK (accounts=${accounts}, transactions=${txns})"
fi

if [ "$START_IMPORT" = "true" ]; then
  echo ""
  echo "--- Async import ---"
  start_code="$(curl -sS -o /tmp/lm-start.json -w '%{http_code}' \
    -X POST \
    -H "$(auth_header)" \
    -H 'Content-Type: application/json' \
    -d "{\"apiToken\":\"${LM_TOKEN}\"}" \
    "${API}/spaces/${SPACE_ID}/migration/lunchmoney/start" || true)"
  if [ "$start_code" != "200" ] && [ "$start_code" != "201" ] && [ "$start_code" != "202" ]; then
    log_fail "start import HTTP ${start_code}"
    cat /tmp/lm-start.json 2>/dev/null || true
  else
    job_id="$(jq -r '.jobId // .id // empty' /tmp/lm-start.json 2>/dev/null || true)"
    if [ -z "$job_id" ]; then
      log_fail "start import — missing jobId"
    else
      log_pass "import job enqueued (${job_id})"
      deadline=$((SECONDS + POLL_SECONDS))
      while [ "$SECONDS" -lt "$deadline" ]; do
        curl -sS -o /tmp/lm-job.json \
          -H "$(auth_header)" \
          "${API}/spaces/${SPACE_ID}/migration/jobs/${job_id}" || true
        state="$(jq -r '.status // empty' /tmp/lm-job.json 2>/dev/null || true)"
        case "$state" in
          completed|succeeded)
            log_pass "import job ${state}"
            break
            ;;
          failed|error)
            log_fail "import job ${state}"
            jq . /tmp/lm-job.json 2>/dev/null || true
            break
            ;;
          *)
            sleep 5
            ;;
        esac
      done
      if [ "$state" != "completed" ] && [ "$state" != "succeeded" ] && [ "$state" != "failed" ] && [ "$state" != "error" ]; then
        log_fail "import job did not finish within ${POLL_SECONDS}s (last status: ${state:-unknown})"
      fi
    fi
  fi
else
  log_skip "Async import — set START_IMPORT=true to enqueue"
fi

echo ""
echo "=== Summary: ${pass} passed, ${fail} failed, ${skip} skipped ==="
[ "$fail" -eq 0 ]
