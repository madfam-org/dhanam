#!/usr/bin/env tsx
/**
 * Preflight: confirm MADFAM CSV import will attach to existing prod data.
 *
 * Usage (prod — values from Vault, never committed):
 *   cd apps/api
 *   MADFAM_IMPORT_ENV_FILE=./madfam-import.local.env \
 *   pnpm tsx scripts/verify-madfam-import-compat.ts
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../generated/prisma';

import { loadMadfamCsvRoutingConfig } from '../src/modules/migration/madfam-csv/madfam-csv-config';
import { verifyMadfamImportCompat } from '../src/modules/migration/madfam-csv/madfam-import-compat';

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

  const targetEmail = process.env.TARGET_USER_EMAIL?.trim();
  if (!targetEmail) {
    console.error('ERROR: TARGET_USER_EMAIL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const routingConfig = loadMadfamCsvRoutingConfig();
    const report = await verifyMadfamImportCompat(prisma, targetEmail, routingConfig);

    console.log('MADFAM import compatibility report');
    console.log('================================');
    console.log(`Target user: ${report.targetEmail}`);
    console.log(`User id:     ${report.userId ?? '(not found)'}`);
    console.log(`Business RFC configured: ${routingConfig.businessRfc ? 'yes' : 'no'}`);
    console.log(`Partner account suffix:  ${routingConfig.accountSuffixes.partner}`);
    console.log('');

    if (report.spaces.length) {
      console.log('Discovered spaces:');
      for (const space of report.spaces) {
        console.log(
          `  ${space.role.padEnd(8)} "${space.name}"  accounts=${space.accountCount}  id=${space.spaceId}`
        );
      }
      console.log('');
    }

    if (report.sampleProviderAccountIds.length) {
      console.log('Sample providerAccountIds:');
      for (const id of report.sampleProviderAccountIds) {
        console.log(`  ${id}`);
      }
      console.log('');
    }

    if (report.issues.length) {
      console.log('Notes:');
      for (const issue of report.issues) {
        console.log(`  - ${issue}`);
      }
      console.log('');
    }

    if (report.ok) {
      console.log('Result: OK — safe to run import-madfam-csv.ts');
      process.exit(0);
    }

    console.error('Result: FAILED — fix issues before import');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
