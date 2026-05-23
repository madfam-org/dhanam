/**
 * Backfill madfam-csv-import budget metadata on operator prod spaces.
 *
 * Required env:
 *   DATABASE_URL
 *   TARGET_USER_EMAIL
 *   MADFAM_BUSINESS_RFC
 *   MADFAM_SPACE_NAME_BUSINESS / _PARTNER / _PERSONAL (when personal has no csv accounts)
 *
 * Optional:
 *   MADFAM_IMPORT_ENV_FILE
 *   PLATFORM_CONFIG_SOURCE=db
 *   DRY_RUN=true
 *
 * Usage:
 *   cd apps/api && pnpm tsx scripts/backfill-madfam-budget-metadata.ts
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../generated/prisma';

import { requireMadfamCsvRoutingConfig } from '../src/modules/migration/madfam-csv/madfam-csv-config';
import { backfillMadfamBudgetMetadata } from '../src/modules/migration/madfam-csv/madfam-import-compat';
import { hydrateMadfamImportEnvFromPlatformConfig } from '../src/modules/migration/madfam-csv/madfam-platform-config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.env.DRY_RUN === 'true';

function loadOptionalOperatorEnvFile(): void {
  const envFile = process.env.MADFAM_IMPORT_ENV_FILE?.trim();
  if (!envFile) return;
  const resolved = path.resolve(envFile);
  if (!fs.existsSync(resolved)) {
    throw new Error(`MADFAM_IMPORT_ENV_FILE not found: ${resolved}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config({ path: resolved, override: true });
}

async function main() {
  loadOptionalOperatorEnvFile();
  await hydrateMadfamImportEnvFromPlatformConfig(prisma);

  const targetEmail = process.env.TARGET_USER_EMAIL?.trim();
  if (!targetEmail) {
    console.error('ERROR: TARGET_USER_EMAIL is required');
    process.exit(1);
  }

  requireMadfamCsvRoutingConfig();

  const user = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (!user) {
    console.error(`ERROR: user not found: ${targetEmail}`);
    process.exit(1);
  }

  const prefix = DRY_RUN ? '[DRY RUN] ' : '';
  console.log(`${prefix}Backfilling MADFAM budget metadata for ${targetEmail}...`);

  const result = await backfillMadfamBudgetMetadata(prisma, user.id, undefined, DRY_RUN);

  for (const detail of result.details) {
    console.log(`  ${detail.role}: budget ${detail.budgetId} → ${detail.action}`);
  }

  console.log(`${prefix}Done: updated=${result.updated}, skipped=${result.skipped}`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
