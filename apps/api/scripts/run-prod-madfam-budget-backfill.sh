#!/usr/bin/env bash
# Backfill madfam-csv-import budget metadata on production via API pod.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/madfam-import.local.env"
NAMESPACE="${DHANAM_NAMESPACE:-dhanam}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Run: bash scripts/bootstrap-madfam-prod-env.sh" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a && source "${ENV_FILE}" && set +a

if [[ -z "${TARGET_USER_EMAIL:-}" ]]; then
  echo "ERROR: TARGET_USER_EMAIL missing from ${ENV_FILE}" >&2
  exit 1
fi

for var in MADFAM_BUSINESS_RFC MADFAM_SPACE_NAME_BUSINESS MADFAM_SPACE_NAME_PARTNER MADFAM_SPACE_NAME_PERSONAL; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: ${var} missing from ${ENV_FILE}" >&2
    exit 1
  fi
done

DRY_RUN="${DRY_RUN:-false}"
echo "Running prod budget metadata backfill (DRY_RUN=${DRY_RUN}) for ${TARGET_USER_EMAIL}..."

kubectl exec -i -n "${NAMESPACE}" deploy/dhanam-api -- env \
  TARGET_USER_EMAIL="${TARGET_USER_EMAIL}" \
  MADFAM_BUSINESS_RFC="${MADFAM_BUSINESS_RFC}" \
  MADFAM_SPACE_NAME_BUSINESS="${MADFAM_SPACE_NAME_BUSINESS}" \
  MADFAM_SPACE_NAME_PARTNER="${MADFAM_SPACE_NAME_PARTNER}" \
  MADFAM_SPACE_NAME_PERSONAL="${MADFAM_SPACE_NAME_PERSONAL}" \
  DRY_RUN="${DRY_RUN}" \
  PLATFORM_CONFIG_SOURCE="${PLATFORM_CONFIG_SOURCE:-}" \
  node - <<'NODE'
const { Pool } = require('pg');

const PARTNER_SUFFIXES = ['-afac', '-partner'];
const ORIGIN = 'madfam-csv-import';
const DRY_RUN = process.env.DRY_RUN === 'true';

function inferRole(id) {
  if (!id.startsWith('madfam-csv-')) return null;
  if (id.endsWith('-personal') || id.includes('-personal')) return 'personal';
  if (PARTNER_SUFFIXES.some((s) => id.endsWith(s))) return 'partner';
  return 'business';
}

function budgetName(spaceName) {
  return `${spaceName} — Presupuesto`;
}

function hasMeta(metadata) {
  if (!metadata || typeof metadata !== 'object') return false;
  return metadata.origin === ORIGIN && typeof metadata.spaceRole === 'string';
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const email = process.env.TARGET_USER_EMAIL;

  const user = (await pool.query('SELECT id FROM users WHERE email=$1', [email])).rows[0];
  if (!user) {
    console.error('FAIL: user not found');
    process.exit(1);
  }

  const accts = (await pool.query(
    `SELECT a.provider_account_id, s.id AS space_id, s.name, s.type
     FROM accounts a JOIN spaces s ON s.id=a.space_id
     JOIN user_spaces us ON us.space_id=s.id
     WHERE us.user_id=$1 AND a.provider_account_id LIKE 'madfam-csv-%'`,
    [user.id]
  )).rows;

  const roleMap = new Map();
  for (const a of accts) {
    const role = inferRole(a.provider_account_id);
    if (!role) continue;
    roleMap.set(role, a);
  }

  const envRoles = {
    business: process.env.MADFAM_SPACE_NAME_BUSINESS,
    partner: process.env.MADFAM_SPACE_NAME_PARTNER,
    personal: process.env.MADFAM_SPACE_NAME_PERSONAL,
  };

  for (const [role, name] of Object.entries(envRoles)) {
    if (roleMap.has(role)) continue;
    const row = (await pool.query(
      `SELECT s.id, s.name FROM spaces s JOIN user_spaces us ON us.space_id=s.id
       WHERE us.user_id=$1 AND s.name=$2 LIMIT 1`,
      [user.id, name]
    )).rows[0];
    if (row) roleMap.set(role, { space_id: row.id, name: row.name });
  }

  let updated = 0;
  let skipped = 0;

  for (const role of ['business', 'partner', 'personal']) {
    const space = roleMap.get(role);
    if (!space) {
      console.error(`FAIL: missing space for role ${role}`);
      process.exit(1);
    }

    let budget = (await pool.query(
      `SELECT id, metadata, name FROM budgets WHERE space_id=$1
       AND metadata->>'origin'=$2 LIMIT 1`,
      [space.space_id, ORIGIN]
    )).rows[0];

    if (!budget) {
      budget = (await pool.query(
        `SELECT id, metadata, name FROM budgets WHERE space_id=$1 AND name=$2 LIMIT 1`,
        [space.space_id, budgetName(space.name)]
      )).rows[0];
    }

    if (!budget) {
      budget = (await pool.query(
        `SELECT id, metadata, name FROM budgets WHERE space_id=$1 ORDER BY created_at ASC LIMIT 1`,
        [space.space_id]
      )).rows[0];
    }

    if (!budget) {
      console.log(`  ${role}: no budget — skipped`);
      skipped++;
      continue;
    }

    if (hasMeta(budget.metadata)) {
      console.log(`  ${role}: budget ${budget.id} — already tagged`);
      skipped++;
      continue;
    }

    const meta = budget.metadata && typeof budget.metadata === 'object' ? budget.metadata : {};
    const next = {
      ...meta,
      origin: ORIGIN,
      spaceRole: role,
      metadataBackfilledAt: new Date().toISOString(),
    };

    if (!DRY_RUN) {
      await pool.query('UPDATE budgets SET metadata=$1, updated_at=NOW() WHERE id=$2', [
        JSON.stringify(next),
        budget.id,
      ]);
    }

    console.log(`  ${role}: budget ${budget.id} — ${DRY_RUN ? 'would update' : 'updated'}`);
    updated++;
  }

  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Done: updated=${updated}, skipped=${skipped}`);
  await pool.end();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
NODE
