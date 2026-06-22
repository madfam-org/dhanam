/**
 * LunchMoney → Dhanam Data Migration Script
 *
 * Migrates personal financial data from LunchMoney to Dhanam.
 * Idempotent: safe to re-run (uses providerAccountId/providerTransactionId + skipDuplicates).
 *
 * Required env:
 *   LUNCHMONEY_API_TOKEN  - LunchMoney API access token
 *   TARGET_USER_EMAIL     - Dhanam user email (required)
 *   DATABASE_URL          - Postgres connection string
 *
 * Optional env:
 *   DRY_RUN=true          - Log actions without writing to DB
 *   START_DATE            - Transaction start date (default: 2024-01-01)
 *
 * Usage:
 *   cd apps/api && LUNCHMONEY_API_TOKEN=xxx pnpm tsx scripts/migrate-lunchmoney.ts
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../generated/prisma';

import { LunchMoneyImportRunner } from '../src/modules/migration/lunchmoney/lunchmoney-import.runner';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const DRY_RUN = process.env.DRY_RUN === 'true';
const START_DATE = process.env.START_DATE || '2024-01-01';

function log(phase: string, message: string) {
  const prefix = DRY_RUN ? '[DRY RUN] ' : '';
  console.log(`${prefix}[${phase}] ${message}`);
}

async function main() {
  const token = process.env.LUNCHMONEY_API_TOKEN;
  if (!token) {
    console.error('ERROR: LUNCHMONEY_API_TOKEN is required');
    process.exit(1);
  }

  const targetEmail = process.env.TARGET_USER_EMAIL?.trim();
  if (!targetEmail) {
    console.error('ERROR: TARGET_USER_EMAIL is required');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (!user) {
    console.error(`ERROR: User ${targetEmail} not found in Dhanam`);
    process.exit(1);
  }

  const targetSpaceId = process.env.TARGET_SPACE_ID;
  const userSpace = targetSpaceId
    ? await prisma.userSpace.findFirst({
        where: { userId: user.id, spaceId: targetSpaceId },
        include: { space: true },
      })
    : await prisma.userSpace.findFirst({
        where: { userId: user.id },
        include: { space: true },
        orderBy: { createdAt: 'asc' },
      });

  if (!userSpace) {
    console.error(
      `ERROR: No space found for user ${targetEmail}${targetSpaceId ? ` with space ID ${targetSpaceId}` : ''}`
    );
    process.exit(1);
  }

  const runner = new LunchMoneyImportRunner(prisma);
  const preflight = await runner.preflight(token, START_DATE);

  console.log('========================================');
  console.log('  LunchMoney → Dhanam Migration');
  console.log(`  Target user: ${targetEmail}`);
  console.log(
    `  LM budget: "${preflight.budgetName}" (account_id=${preflight.lunchMoneyAccountId})`
  );
  console.log(`  Date range: ${START_DATE} → ${preflight.dateRange.endDate}`);
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log('========================================\n');

  log('INIT', `Space "${userSpace.space.name}" (${userSpace.spaceId})`);

  const result = await runner.run({
    spaceId: userSpace.spaceId,
    apiToken: token,
    startDate: START_DATE,
    dryRun: DRY_RUN,
    budgetLabel: process.env.LUNCHMONEY_BUDGET_LABEL,
    onLog: log,
  });

  console.log('\n========================================');
  console.log('  Migration Summary');
  console.log('========================================');
  console.log(JSON.stringify(result, null, 2));
  console.log('\n  Migration complete!');
  console.log('========================================\n');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
