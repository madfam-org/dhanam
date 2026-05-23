/**
 * Seed madfam.import.* keys into platform_config from operator env file.
 *
 * Usage (after migration deploy):
 *   cd apps/api
 *   MADFAM_IMPORT_ENV_FILE=./madfam-import.local.env \
 *   SEED_ACTOR_USER_ID=<platform-admin-user-uuid> \
 *   pnpm tsx scripts/seed-madfam-platform-config.ts
 *
 * Dry run:
 *   DRY_RUN=true ... pnpm tsx scripts/seed-madfam-platform-config.ts
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient, PlatformConfigScope } from '../generated/prisma';

import {
  MADFAM_IMPORT_CONFIG_KEYS,
  MADFAM_IMPORT_ENV_MAP,
  type MadfamImportConfigKey,
} from '../src/modules/platform-config/platform-config.keys';

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

  const actorId = process.env.SEED_ACTOR_USER_ID?.trim();
  if (!actorId) {
    console.error('ERROR: SEED_ACTOR_USER_ID is required (platform admin user uuid for audit)');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { id: actorId } });
  if (!user?.isAdmin) {
    console.error('ERROR: SEED_ACTOR_USER_ID must reference a platform admin user');
    process.exit(1);
  }

  let upserted = 0;
  let skipped = 0;

  for (const [configKey, envVar] of Object.entries(MADFAM_IMPORT_ENV_MAP) as Array<
    [MadfamImportConfigKey, string]
  >) {
    const value = process.env[envVar]?.trim();
    if (!value) {
      console.log(`  skip ${configKey} (${envVar} unset)`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  would upsert ${configKey} from ${envVar}`);
      upserted++;
      continue;
    }

    await prisma.platformConfig.upsert({
      where: {
        key_scope_scopeId: {
          key: configKey,
          scope: PlatformConfigScope.platform,
          scopeId: '',
        },
      },
      create: {
        key: configKey,
        scope: PlatformConfigScope.platform,
        scopeId: '',
        value,
        updatedBy: actorId,
      },
      update: {
        value,
        updatedBy: actorId,
      },
    });
    console.log(`  upserted ${configKey}`);
    upserted++;
  }

  console.log(
    `${DRY_RUN ? '[DRY RUN] ' : ''}Done: upserted=${upserted}, skipped=${skipped} (keys: ${Object.keys(MADFAM_IMPORT_CONFIG_KEYS).length})`
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
