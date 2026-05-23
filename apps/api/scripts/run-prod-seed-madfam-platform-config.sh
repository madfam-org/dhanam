#!/usr/bin/env bash
# Seed madfam.import.* platform_config rows from madfam-import.local.env via API pod.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/madfam-import.local.env"
NAMESPACE="${DHANAM_NAMESPACE:-dhanam}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Run: TARGET_USER_EMAIL=<vault> bash scripts/bootstrap-madfam-prod-env.sh" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a && source "${ENV_FILE}" && set +a

if [[ -z "${SEED_ACTOR_USER_ID:-}" ]]; then
  echo "Resolving platform admin user id from TARGET_USER_EMAIL..."
  SEED_ACTOR_USER_ID="$(kubectl exec -n "${NAMESPACE}" deploy/dhanam-api -- env TARGET_USER_EMAIL="${TARGET_USER_EMAIL}" node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\"SELECT id FROM users WHERE email=\$1 AND is_admin=true LIMIT 1\", [process.env.TARGET_USER_EMAIL || ''])
  .then(r => { console.log(r.rows[0]?.id || ''); return pool.end(); })
  .catch(e => { console.error(e.message); process.exit(1); });
" 2>/dev/null | tail -1)"
fi

if [[ -z "${SEED_ACTOR_USER_ID}" ]]; then
  echo "ERROR: set SEED_ACTOR_USER_ID or ensure TARGET_USER_EMAIL is a platform admin" >&2
  exit 1
fi

DRY_RUN="${DRY_RUN:-false}"
echo "Seeding platform_config from ${ENV_FILE} (DRY_RUN=${DRY_RUN})..."

kubectl exec -i -n "${NAMESPACE}" deploy/dhanam-api -- env \
  TARGET_USER_EMAIL="${TARGET_USER_EMAIL}" \
  MADFAM_BUSINESS_RFC="${MADFAM_BUSINESS_RFC:-}" \
  MADFAM_SPACE_NAME_BUSINESS="${MADFAM_SPACE_NAME_BUSINESS:-}" \
  MADFAM_SPACE_NAME_PARTNER="${MADFAM_SPACE_NAME_PARTNER:-}" \
  MADFAM_SPACE_NAME_PERSONAL="${MADFAM_SPACE_NAME_PERSONAL:-}" \
  MADFAM_ACCOUNT_SUFFIX_PARTNER="${MADFAM_ACCOUNT_SUFFIX_PARTNER:-}" \
  MADFAM_ACCOUNT_SUFFIX_PERSONAL="${MADFAM_ACCOUNT_SUFFIX_PERSONAL:-}" \
  SEED_ACTOR_USER_ID="${SEED_ACTOR_USER_ID}" \
  DRY_RUN="${DRY_RUN}" \
  node - <<'NODE'
const { Pool } = require('pg');

const KEYS = {
  businessRfc: 'madfam.import.business_rfc',
  spaceBusiness: 'madfam.import.space_name.business',
  spacePartner: 'madfam.import.space_name.partner',
  spacePersonal: 'madfam.import.space_name.personal',
  suffixPartner: 'madfam.import.account_suffix.partner',
  suffixPersonal: 'madfam.import.account_suffix.personal',
};

const ENV_MAP = {
  [KEYS.businessRfc]: 'MADFAM_BUSINESS_RFC',
  [KEYS.spaceBusiness]: 'MADFAM_SPACE_NAME_BUSINESS',
  [KEYS.spacePartner]: 'MADFAM_SPACE_NAME_PARTNER',
  [KEYS.spacePersonal]: 'MADFAM_SPACE_NAME_PERSONAL',
  [KEYS.suffixPartner]: 'MADFAM_ACCOUNT_SUFFIX_PARTNER',
  [KEYS.suffixPersonal]: 'MADFAM_ACCOUNT_SUFFIX_PERSONAL',
};

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const actorId = process.env.SEED_ACTOR_USER_ID;
  const dryRun = process.env.DRY_RUN === 'true';

  const admin = (await pool.query('SELECT id FROM users WHERE id=$1 AND is_admin=true', [actorId])).rows[0];
  if (!admin) {
    console.error('FAIL: SEED_ACTOR_USER_ID is not a platform admin');
    process.exit(1);
  }

  let upserted = 0;
  let skipped = 0;

  for (const [key, envVar] of Object.entries(ENV_MAP)) {
    const value = (process.env[envVar] || '').trim();
    if (!value) {
      console.log(`  skip ${key} (${envVar} unset)`);
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`  would upsert ${key}`);
      upserted++;
      continue;
    }
    await pool.query(
      `INSERT INTO platform_config (id, key, scope, scope_id, value, updated_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, 'platform', '', to_jsonb($2::text), $3, NOW(), NOW())
       ON CONFLICT (key, scope, scope_id)
       DO UPDATE SET value = to_jsonb($2::text), updated_by = $3, updated_at = NOW()`,
      [key, value, actorId]
    );
    console.log(`  upserted ${key}`);
    upserted++;
  }

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Done: upserted=${upserted}, skipped=${skipped}`);
  await pool.end();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
NODE
