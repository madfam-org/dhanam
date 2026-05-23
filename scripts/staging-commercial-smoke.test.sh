#!/usr/bin/env bash
# Validates scripts/staging-commercial-smoke.sh syntax and optional live probes.
# Optional: RUN_STAGING_COMMERCIAL_SMOKE_LIVE=true ./scripts/staging-commercial-smoke.test.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/staging-commercial-smoke.sh"

bash -n "$SCRIPT"

if [ "${RUN_STAGING_COMMERCIAL_SMOKE_LIVE:-false}" = "true" ]; then
  STAGING_COMMERCIAL_STRICT=false "$SCRIPT"

  set +e
  STAGING_COMMERCIAL_STRICT=true \
    STAGING_COMMERCIAL_ADMIN_TOKEN= \
    STAGING_COMMERCIAL_SMOKE_USER_ID= \
    "$SCRIPT" >/dev/null 2>&1
  strict_code=$?
  set -e

  if [ "$strict_code" -ne 1 ]; then
    echo "expected exit code 1 when STRICT=true without admin credentials, got $strict_code" >&2
    exit 1
  fi
else
  echo "~ skipped live staging API probe (set RUN_STAGING_COMMERCIAL_SMOKE_LIVE=true to enable)"
fi

echo "staging-commercial-smoke.test.sh: OK"
