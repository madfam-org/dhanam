#!/usr/bin/env bash
# Bootstrap gitignored madfam-import.local.env from production (read-only).
# Requires kubectl access to the dhanam namespace. Never commit the output file.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/madfam-import.local.env"
NAMESPACE="${DHANAM_NAMESPACE:-dhanam}"

if [[ -z "${TARGET_USER_EMAIL:-}" ]]; then
  echo "ERROR: TARGET_USER_EMAIL is required (operator email from Vault — never hardcode in scripts)" >&2
  exit 1
fi
TARGET_EMAIL="${TARGET_USER_EMAIL}"

echo "Bootstrapping ${OUT} from namespace ${NAMESPACE}..."

DB_URL="$(kubectl get secret dhanam-secrets -n "${NAMESPACE}" -o jsonpath='{.data.DATABASE_URL}' | base64 -d)"
if [[ -z "${DB_URL}" ]]; then
  echo "ERROR: DATABASE_URL missing from dhanam-secrets" >&2
  exit 1
fi

PROBE_JSON="$(kubectl exec -n "${NAMESPACE}" deploy/dhanam-api -- sh -c "cd /app/apps/api && node -e \"
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const email = '${TARGET_EMAIL}';
  const user = (await pool.query('SELECT id FROM users WHERE email=\\\$1', [email])).rows[0];
  if (!user) { console.log(JSON.stringify({ error: 'user not found' })); process.exit(1); }
  const uid = user.id;
  const accts = (await pool.query(
    \\\"SELECT a.provider_account_id, s.name FROM accounts a JOIN spaces s ON s.id=a.space_id JOIN user_spaces us ON us.space_id=s.id WHERE us.user_id=\\\$1 AND a.provider_account_id LIKE 'madfam-csv-%' ORDER BY 1\\\",
    [uid]
  )).rows;
  const rfcs = (await pool.query(
    \\\"SELECT t.metadata->>'rfc' AS rfc, COUNT(*)::int AS cnt FROM transactions t JOIN accounts a ON a.id=t.account_id JOIN user_spaces us ON us.space_id=a.space_id WHERE us.user_id=\\\$1 AND t.metadata->>'source'='madfam-csv' AND t.metadata->>'rfc' IS NOT NULL GROUP BY 1 ORDER BY cnt DESC LIMIT 5\\\",
    [uid]
  )).rows;
  const spaces = (await pool.query(
    \\\"SELECT s.name, s.type FROM spaces s JOIN user_spaces us ON us.space_id=s.id WHERE us.user_id=\\\$1 ORDER BY s.name\\\",
    [uid]
  )).rows;
  const businessRfc = (await pool.query(
    \\\"SELECT t.metadata->>'rfc' AS rfc FROM transactions t JOIN accounts a ON a.id=t.account_id JOIN user_spaces us ON us.space_id=a.space_id WHERE us.user_id=\\\$1 AND a.provider_account_id='madfam-csv-bbva-empresarial' AND t.metadata->>'rfc' IS NOT NULL LIMIT 1\\\",
    [uid]
  )).rows[0]?.rfc || null;
  console.log(JSON.stringify({ accounts: accts, rfcs, spaces, businessRfc }));
  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
\"")"

if echo "${PROBE_JSON}" | grep -q '"error"'; then
  echo "ERROR: ${PROBE_JSON}" >&2
  exit 1
fi

BUSINESS_RFC="$(echo "${PROBE_JSON}" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).businessRfc||''")"
BUSINESS_SPACE="$(echo "${PROBE_JSON}" | node -pe "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); d.accounts.find(a=>a.provider_account_id==='madfam-csv-bbva-empresarial')?.name||''")"
PARTNER_SPACE="$(echo "${PROBE_JSON}" | node -pe "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); d.accounts.find(a=>a.provider_account_id.endsWith('-afac'))?.name||''")"
PERSONAL_SPACE="$(echo "${PROBE_JSON}" | node -pe "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); (d.spaces.find(s=>s.type==='personal'&&s.name!=\"admin's Personal\")||{}).name||''")"

{
  printf 'DATABASE_URL=%s\n' "${DB_URL}"
  printf 'TARGET_USER_EMAIL=%s\n' "${TARGET_EMAIL}"
  [[ -n "${BUSINESS_RFC}" ]] && printf 'MADFAM_BUSINESS_RFC=%s\n' "${BUSINESS_RFC}"
  [[ -n "${BUSINESS_SPACE}" ]] && printf 'MADFAM_SPACE_NAME_BUSINESS=%q\n' "${BUSINESS_SPACE}"
  [[ -n "${PARTNER_SPACE}" ]] && printf 'MADFAM_SPACE_NAME_PARTNER=%q\n' "${PARTNER_SPACE}"
  [[ -n "${PERSONAL_SPACE}" ]] && printf 'MADFAM_SPACE_NAME_PERSONAL=%q\n' "${PERSONAL_SPACE}"
} > "${OUT}"
chmod 600 "${OUT}"

echo "Wrote ${OUT}"
echo "  accounts: $(echo "${PROBE_JSON}" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).accounts.length')"
echo "  business space: ${BUSINESS_SPACE:-unknown}"
echo "  partner space: ${PARTNER_SPACE:-unknown}"
echo "  personal space: ${PERSONAL_SPACE:-unknown}"
echo "  business RFC: ${BUSINESS_RFC:+set}"
