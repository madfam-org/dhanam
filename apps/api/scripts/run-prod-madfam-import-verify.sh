#!/usr/bin/env bash
# Run verify-madfam-import-compat against production via the API pod network.
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

for var in TARGET_USER_EMAIL MADFAM_BUSINESS_RFC MADFAM_SPACE_NAME_BUSINESS MADFAM_SPACE_NAME_PARTNER MADFAM_SPACE_NAME_PERSONAL; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: ${var} missing from ${ENV_FILE}" >&2
    exit 1
  fi
done

echo "Running prod import compat verify for ${TARGET_USER_EMAIL}..."

kubectl exec -i -n "${NAMESPACE}" deploy/dhanam-api -- env \
  TARGET_USER_EMAIL="${TARGET_USER_EMAIL}" \
  MADFAM_BUSINESS_RFC="${MADFAM_BUSINESS_RFC}" \
  MADFAM_SPACE_NAME_BUSINESS="${MADFAM_SPACE_NAME_BUSINESS}" \
  MADFAM_SPACE_NAME_PARTNER="${MADFAM_SPACE_NAME_PARTNER}" \
  MADFAM_SPACE_NAME_PERSONAL="${MADFAM_SPACE_NAME_PERSONAL}" \
  node - <<'NODE'
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PARTNER_SUFFIXES = ['-afac', '-partner'];

function inferRole(id) {
  if (!id.startsWith('madfam-csv-')) return null;
  if (id.endsWith('-personal')) return 'personal';
  if (PARTNER_SUFFIXES.some((s) => id.endsWith(s))) return 'partner';
  return 'business';
}

(async () => {
  const issues = [];
  const email = process.env.TARGET_USER_EMAIL;
  const businessRfc = process.env.MADFAM_BUSINESS_RFC;
  if (!businessRfc) issues.push('MADFAM_BUSINESS_RFC missing');

  const user = (await pool.query('SELECT id, email FROM users WHERE email=$1', [email])).rows[0];
  if (!user) {
    console.error('FAIL: user not found');
    process.exit(1);
  }

  const accts = (await pool.query(
    `SELECT a.provider_account_id, s.id AS space_id, s.name
     FROM accounts a JOIN spaces s ON s.id=a.space_id
     JOIN user_spaces us ON us.space_id=s.id
     WHERE us.user_id=$1 AND a.provider_account_id LIKE 'madfam-csv-%'`,
    [user.id]
  )).rows;

  const roleMap = new Map();
  for (const a of accts) {
    const role = inferRole(a.provider_account_id);
    if (!role) continue;
    if (roleMap.has(role) && roleMap.get(role).space_id !== a.space_id) {
      issues.push(`ambiguous role ${role}`);
    }
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
    if (row) roleMap.set(role, { space_id: row.id, name: row.name, provider_account_id: null });
    else issues.push(`space not found for ${role}: ${name}`);
  }

  const partnerSuffix = process.env.MADFAM_ACCOUNT_SUFFIX_PARTNER || '-afac';
  const hasAfac = accts.some((a) => a.provider_account_id.endsWith('-afac'));
  if (hasAfac && partnerSuffix !== '-afac') {
    issues.push(`partner suffix mismatch (want -afac, got ${partnerSuffix})`);
  }

  console.log('User:', user.email);
  console.log('Import accounts:', accts.length);
  for (const a of accts) console.log(' ', a.provider_account_id, '|', a.name);
  console.log('Resolved spaces:');
  for (const role of ['business', 'partner', 'personal']) {
    const s = roleMap.get(role);
    console.log(`  ${role}: ${s ? s.name : 'MISSING'}`);
  }
  console.log('Business RFC configured:', businessRfc ? 'yes' : 'no');
  console.log('Partner suffix default: -afac');

  if (issues.length) {
    console.error('FAIL:', issues.join('; '));
    process.exit(1);
  }
  console.log('Result: OK — prod import continuity verified');
  await pool.end();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
NODE
