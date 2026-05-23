/**
 * MADFAM CSV → Dhanam Import Script
 *
 * Imports business CSV transactions into Dhanam spaces.
 * Idempotent: safe to re-run (uses providerAccountId/providerTransactionId).
 *
 * Required env:
 *   CSV_PATH              - Path to the madfam-transactions.csv file
 *   DATABASE_URL          - Postgres connection string
 *   TARGET_USER_EMAIL       - Dhanam operator account (prod: Janua admin email from Vault)
 *   MADFAM_BUSINESS_RFC     - Business tax ID for routing (required; never commit)
 *
 * Space names (optional if prod already has madfam-csv import — auto-discovered):
 *   MADFAM_SPACE_NAME_BUSINESS / _PARTNER / _PERSONAL
 *
 * Optional env:
 *   MADFAM_IMPORT_ENV_FILE    - Path to operator .env (gitignored) with prod values
 *   MADFAM_ACCOUNT_SUFFIX_PARTNER - Default `-afac` for prod idempotency
 *   MADFAM_ACCOUNT_SUFFIX_PERSONAL - Default `-personal`
 *   MADFAM_SPACE_KEY_BUSINESS / _PARTNER / _PERSONAL - Internal map keys only
 *   MADFAM_SKIP_COMPAT_CHECK=true - Skip preflight (not recommended for prod)
 *   DRY_RUN=true              - Log actions without writing to DB
 *
 * Usage:
 *   cd apps/api && CSV_PATH=../../data/madfam-transactions.csv pnpm tsx scripts/import-madfam-csv.ts
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../generated/prisma';

import {
  parseCsv,
  routeToSpace,
  mapAccount,
  mapAmount,
  mapDate,
  parseGroupAndCategory,
  isIncomeGroup,
  spaceKeyForRole,
} from '../src/modules/migration/madfam-csv/madfam-csv-mapper';
import {
  requireMadfamCsvRoutingConfig,
  type SpaceRole,
} from '../src/modules/migration/madfam-csv/madfam-csv-config';
import {
  discoverMadfamImportSpaces,
  MADFAM_CSV_IMPORT_ORIGIN,
  verifyMadfamImportCompat,
} from '../src/modules/migration/madfam-csv/madfam-import-compat';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Default to DRY_RUN in production unless explicitly disabled
const isProduction = process.env.NODE_ENV === 'production';
const DRY_RUN = process.env.DRY_RUN ? process.env.DRY_RUN === 'true' : isProduction;

function log(phase: string, message: string) {
  const prefix = DRY_RUN ? '[DRY RUN] ' : '';
  console.log(`${prefix}[${phase}] ${message}`);
}

// ---------------------------------------------------------------------------
// Space definitions
// ---------------------------------------------------------------------------

interface SpaceDef {
  role: SpaceRole;
  key: string;
  name: string;
  type: 'personal' | 'business';
  /** When set, reuse this space id (prod discovery) instead of creating by name. */
  existingSpaceId?: string;
}

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

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function loadSpaceDefsFromEnv(
  routingConfig: ReturnType<typeof requireMadfamCsvRoutingConfig>
): SpaceDef[] | null {
  const businessName = optionalEnv('MADFAM_SPACE_NAME_BUSINESS');
  const partnerName = optionalEnv('MADFAM_SPACE_NAME_PARTNER');
  const personalName = optionalEnv('MADFAM_SPACE_NAME_PERSONAL');

  if (!businessName && !partnerName && !personalName) {
    return null;
  }

  if (!businessName || !partnerName || !personalName) {
    throw new Error(
      'Set all of MADFAM_SPACE_NAME_BUSINESS, MADFAM_SPACE_NAME_PARTNER, and MADFAM_SPACE_NAME_PERSONAL, ' +
        'or omit all three to auto-discover from existing madfam-csv import data.'
    );
  }

  return [
    {
      role: 'business',
      key: routingConfig.spaceKeys.business,
      name: businessName,
      type: 'business',
    },
    {
      role: 'partner',
      key: routingConfig.spaceKeys.partner,
      name: partnerName,
      type: 'business',
    },
    {
      role: 'personal',
      key: routingConfig.spaceKeys.personal,
      name: personalName,
      type: 'personal',
    },
  ];
}

function spaceDefsFromDiscovery(
  discovered: Awaited<ReturnType<typeof discoverMadfamImportSpaces>>
): SpaceDef[] {
  if (!discovered) return [];
  return discovered.map((space) => ({
    role: space.role,
    key: space.key,
    name: space.name,
    type: space.type,
    existingSpaceId: space.spaceId,
  }));
}

const ACCOUNTING_TAGS = [
  'Préstamo de Socio (AFAC)',
  'Aportación de Capital',
  'Gasto Deducible (Negocio)',
  'Gasto No Deducible',
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadOptionalOperatorEnvFile();

  const csvPath = process.env.CSV_PATH;
  if (!csvPath) {
    console.error('ERROR: CSV_PATH is required');
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`ERROR: CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  const routingConfig = requireMadfamCsvRoutingConfig();

  const targetEmail = optionalEnv('TARGET_USER_EMAIL');
  if (!targetEmail) {
    console.error(
      'ERROR: TARGET_USER_EMAIL is required (production: Janua operator account email from Vault)'
    );
    process.exit(1);
  }

  if (process.env.MADFAM_SKIP_COMPAT_CHECK !== 'true') {
    const compat = await verifyMadfamImportCompat(prisma, targetEmail, routingConfig);
    if (!compat.ok) {
      console.error('ERROR: MADFAM import preflight failed:');
      for (const issue of compat.issues) {
        console.error(`  - ${issue}`);
      }
      console.error(
        '\nRun: pnpm --filter @dhanam/api tsx scripts/verify-madfam-import-compat.ts\n' +
          'Or set MADFAM_SKIP_COMPAT_CHECK=true only after reviewing warnings.'
      );
      process.exit(1);
    }
    if (compat.spaces.length > 0) {
      log('INIT', 'Preflight: existing madfam-csv spaces for operator account');
      for (const space of compat.spaces) {
        log('INIT', `  ${space.role}: "${space.name}" (${space.accountCount} import accounts)`);
      }
    }
  }

  let SPACE_DEFS = loadSpaceDefsFromEnv(routingConfig);

  console.log('========================================');
  console.log('  MADFAM CSV → Dhanam Import');
  console.log(`  Target user: ${targetEmail}`);
  console.log(`  CSV path: ${csvPath}`);
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log('========================================\n');

  // -----------------------------------------------------------------------
  // Phase 1: INIT — Parse CSV and look up user
  // -----------------------------------------------------------------------
  log('INIT', `Reading CSV from ${csvPath}...`);
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(csvContent);
  log('INIT', `Parsed ${rows.length} rows`);

  if (rows.length === 0) {
    console.error('ERROR: CSV contains no data rows');
    process.exit(1);
  }

  log('INIT', `Looking up user ${targetEmail}...`);
  const user = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (!user) {
    console.error(`ERROR: User ${targetEmail} not found in Dhanam`);
    process.exit(1);
  }
  log('INIT', `Found user ${user.id}`);

  if (!SPACE_DEFS) {
    const discovered = await discoverMadfamImportSpaces(prisma, user.id, routingConfig);
    SPACE_DEFS = spaceDefsFromDiscovery(discovered);
    if (SPACE_DEFS.length === 3) {
      log('INIT', 'Discovered space bindings from existing madfam-csv accounts (prod continuity)');
    } else {
      console.error(
        'ERROR: Could not resolve spaces. Set MADFAM_SPACE_NAME_* to match prod space names, ' +
          'or ensure the target user already has madfam-csv import accounts for business/partner/personal.'
      );
      const allUserSpaces = await prisma.userSpace.findMany({
        where: { userId: user.id },
        include: { space: true },
      });
      console.error('Existing spaces for this user:');
      for (const us of allUserSpaces) {
        console.error(`  - "${us.space.name}" (${us.space.id})`);
      }
      process.exit(1);
    }
  }

  // -----------------------------------------------------------------------
  // Phase 2: SPACES — Upsert 3 spaces
  // -----------------------------------------------------------------------
  const spaceIds: Record<string, string> = {};

  for (const spaceDef of SPACE_DEFS) {
    log('SPACES', `Processing space "${spaceDef.name}" (${spaceDef.type})...`);

    if (!DRY_RUN) {
      if (spaceDef.existingSpaceId) {
        spaceIds[spaceDef.key] = spaceDef.existingSpaceId;
        log(
          'SPACES',
          `  Reusing discovered space "${spaceDef.name}" → ${spaceDef.existingSpaceId}`
        );
        continue;
      }

      const allUserSpaces = await prisma.userSpace.findMany({
        where: { userId: user.id },
        include: { space: true },
      });

      const existingSpace = allUserSpaces.find((us) => us.space.name === spaceDef.name);

      if (existingSpace) {
        spaceIds[spaceDef.key] = existingSpace.spaceId;
        log('SPACES', `  Exists: "${spaceDef.name}" → ${existingSpace.spaceId}`);
      } else {
        const space = await prisma.space.create({
          data: {
            name: spaceDef.name,
            type: spaceDef.type,
            currency: 'MXN',
          },
        });

        await prisma.userSpace.create({
          data: {
            userId: user.id,
            spaceId: space.id,
            role: 'owner',
          },
        });

        spaceIds[spaceDef.key] = space.id;
        log('SPACES', `  Created: "${spaceDef.name}" → ${space.id}`);
      }
    } else {
      spaceIds[spaceDef.key] = `dry-run-${spaceDef.key}`;
      log('SPACES', `  Would create: "${spaceDef.name}"`);
    }
  }

  // -----------------------------------------------------------------------
  // Phase 3: BUDGETS — One per space
  // -----------------------------------------------------------------------
  const budgetIds: Record<string, string> = {};

  for (const spaceDef of SPACE_DEFS) {
    const spaceId = spaceIds[spaceDef.key];
    const budgetName = `${spaceDef.name} — Presupuesto`;
    log('BUDGETS', `Processing budget for "${spaceDef.name}"...`);

    if (!DRY_RUN) {
      // Check by origin metadata first
      let budget = await prisma.budget.findFirst({
        where: {
          spaceId,
          metadata: { path: ['origin'], equals: MADFAM_CSV_IMPORT_ORIGIN },
        },
      });

      // Fallback: check by name
      if (!budget) {
        budget = await prisma.budget.findFirst({
          where: { spaceId, name: budgetName },
        });
      }

      if (budget) {
        budgetIds[spaceDef.key] = budget.id;
        log('BUDGETS', `  Exists: "${budgetName}" → ${budget.id}`);
      } else {
        budget = await prisma.budget.create({
          data: {
            space: { connect: { id: spaceId } },
            name: budgetName,
            period: 'monthly',
            startDate: new Date('2024-12-01'),
            metadata: {
              origin: MADFAM_CSV_IMPORT_ORIGIN,
              spaceRole: spaceDef.role,
              importedAt: new Date().toISOString(),
            },
          },
        });
        budgetIds[spaceDef.key] = budget.id;
        log('BUDGETS', `  Created: "${budgetName}" → ${budget.id}`);
      }
    } else {
      budgetIds[spaceDef.key] = `dry-run-budget-${spaceDef.key}`;
      log('BUDGETS', `  Would create: "${budgetName}"`);
    }
  }

  // -----------------------------------------------------------------------
  // Phase 4: CATEGORIES — Extract unique (groupName, subcategory) from CSV
  // -----------------------------------------------------------------------
  log('CATEGORIES', 'Extracting unique categories from CSV...');

  const categorySet = new Set<string>();
  const categoryPairs: Array<{ groupName: string; categoryName: string; isIncome: boolean }> = [];

  for (const row of rows) {
    const { groupName, categoryName } = parseGroupAndCategory(
      row.Categoria_Estrategica,
      row.Subcategoria
    );
    const key = `${groupName}::${categoryName}`;
    if (!categorySet.has(key)) {
      categorySet.add(key);
      categoryPairs.push({ groupName, categoryName, isIncome: isIncomeGroup(groupName) });
    }
  }

  log('CATEGORIES', `Found ${categoryPairs.length} unique categories`);

  // Category lookup: spaceKey::groupName::categoryName → categoryId
  const categoryMap = new Map<string, string>();

  for (const spaceDef of SPACE_DEFS) {
    const budgetId = budgetIds[spaceDef.key];

    for (let i = 0; i < categoryPairs.length; i++) {
      const { groupName, categoryName, isIncome } = categoryPairs[i];
      const lookupKey = `${spaceDef.key}::${groupName}::${categoryName}`;

      if (!DRY_RUN) {
        const existing = await prisma.category.findFirst({
          where: { budgetId, name: categoryName, groupName },
        });

        if (existing) {
          categoryMap.set(lookupKey, existing.id);
          log('CATEGORIES', `  Exists [${spaceDef.key}]: ${groupName} / ${categoryName}`);
        } else {
          const created = await prisma.category.create({
            data: {
              budget: { connect: { id: budgetId } },
              name: categoryName,
              groupName,
              isIncome,
              budgetedAmount: 0,
              sortOrder: i,
            },
          });
          categoryMap.set(lookupKey, created.id);
          log(
            'CATEGORIES',
            `  Created [${spaceDef.key}]: ${groupName} / ${categoryName} (income=${isIncome}) → ${created.id}`
          );
        }
      } else {
        log('CATEGORIES', `  Would create [${spaceDef.key}]: ${groupName} / ${categoryName}`);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Phase 5: TAGS — 4 accounting classification tags per space
  // -----------------------------------------------------------------------
  log('TAGS', 'Creating accounting classification tags...');

  // Tag lookup: spaceKey::tagName → tagId
  const tagMap = new Map<string, string>();

  for (const spaceDef of SPACE_DEFS) {
    const spaceId = spaceIds[spaceDef.key];

    for (const tagName of ACCOUNTING_TAGS) {
      const lookupKey = `${spaceDef.key}::${tagName}`;

      if (!DRY_RUN) {
        const existing = await prisma.tag.findUnique({
          where: { spaceId_name: { spaceId, name: tagName } },
        });

        if (existing) {
          tagMap.set(lookupKey, existing.id);
          log('TAGS', `  Exists [${spaceDef.key}]: ${tagName}`);
        } else {
          const created = await prisma.tag.create({
            data: {
              space: { connect: { id: spaceId } },
              name: tagName,
            },
          });
          tagMap.set(lookupKey, created.id);
          log('TAGS', `  Created [${spaceDef.key}]: ${tagName} → ${created.id}`);
        }
      } else {
        log('TAGS', `  Would create [${spaceDef.key}]: ${tagName}`);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Phase 6 & 7: ACCOUNTS + TRANSACTIONS — Process rows
  // -----------------------------------------------------------------------
  log('TRANSACTIONS', `Processing ${rows.length} transactions...`);

  // Account lookup: providerAccountId → accountId
  const accountMap = new Map<string, string>();

  let txCreated = 0;
  let txSkipped = 0;
  let txWarnings = 0;
  let accountsCreated = 0;
  let accountsExisting = 0;

  for (const row of rows) {
    const txNum = row.No_Transaccion;

    // Compute signed amount
    const amount = mapAmount(row.Ingreso, row.Egreso);
    if (amount === null) {
      log('TRANSACTIONS', `  WARN: Skipping tx ${txNum} — both Ingreso and Egreso are 0/empty`);
      txWarnings++;
      continue;
    }

    // Route to space
    const spaceRole = routeToSpace(row.RFC, row.Clasificacion_Contable, routingConfig);
    const spaceKey = spaceKeyForRole(spaceRole, routingConfig);
    const spaceId = spaceIds[spaceKey];

    // Map account (lazy creation)
    let accountMapping;
    try {
      accountMapping = mapAccount(row.Cuenta_Origen, spaceRole, routingConfig);
    } catch (err: any) {
      log('TRANSACTIONS', `  WARN: Skipping tx ${txNum} — ${err.message}`);
      txWarnings++;
      continue;
    }

    const providerTransactionId = `madfam-csv-${txNum}`;

    // Lazy account creation
    if (!accountMap.has(accountMapping.providerAccountId)) {
      if (!DRY_RUN) {
        const existingAccount = await prisma.account.findFirst({
          where: { spaceId, providerAccountId: accountMapping.providerAccountId },
        });

        if (existingAccount) {
          accountMap.set(accountMapping.providerAccountId, existingAccount.id);
          accountsExisting++;
          log('ACCOUNTS', `  Exists: ${accountMapping.name} [${spaceKey}] → ${existingAccount.id}`);
        } else {
          const created = await prisma.account.create({
            data: {
              space: { connect: { id: spaceId } },
              provider: 'manual',
              providerAccountId: accountMapping.providerAccountId,
              name: accountMapping.name,
              type: accountMapping.type,
              currency: 'MXN',
              balance: 0,
              metadata: { source: 'madfam-csv' },
            },
          });
          accountMap.set(accountMapping.providerAccountId, created.id);
          accountsCreated++;
          log('ACCOUNTS', `  Created: ${accountMapping.name} [${spaceKey}] → ${created.id}`);
        }
      } else {
        accountMap.set(
          accountMapping.providerAccountId,
          `dry-run-${accountMapping.providerAccountId}`
        );
        log('ACCOUNTS', `  Would create: ${accountMapping.name} [${spaceKey}]`);
      }
    }

    const accountId = accountMap.get(accountMapping.providerAccountId)!;

    // Resolve category
    const { groupName, categoryName } = parseGroupAndCategory(
      row.Categoria_Estrategica,
      row.Subcategoria
    );
    const categoryLookup = `${spaceKey}::${groupName}::${categoryName}`;
    const categoryId = categoryMap.get(categoryLookup);

    // Resolve tag
    const tagLookup = `${spaceKey}::${row.Clasificacion_Contable.trim()}`;
    const tagId = tagMap.get(tagLookup);

    // Parse date
    let txDate: Date;
    try {
      txDate = mapDate(row.Fecha_Operacion);
    } catch (err: any) {
      log('TRANSACTIONS', `  WARN: Skipping tx ${txNum} — ${err.message}`);
      txWarnings++;
      continue;
    }

    if (!DRY_RUN) {
      // Idempotency check
      const existing = await prisma.transaction.findFirst({
        where: { accountId, providerTransactionId },
      });

      if (existing) {
        txSkipped++;
        continue;
      }

      const created = await prisma.transaction.create({
        data: {
          account: { connect: { id: accountId } },
          providerTransactionId,
          amount,
          currency: 'MXN',
          description: row.Nota_Items || row.Concepto_Original || 'Unknown',
          merchant: row.Concepto_Original || null,
          ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
          date: txDate,
          pending: false,
          reviewed: true,
          reviewedAt: new Date(),
          metadata: {
            source: 'madfam-csv',
            originalCurrency: row.Moneda_Origen || 'MXN',
            mesCorte: row.Mes_Corte || null,
            rfc: row.RFC,
            clasificacionContable: row.Clasificacion_Contable,
          },
        },
      });

      // Create tag association
      if (tagId) {
        await prisma.transactionTag
          .create({
            data: {
              transaction: { connect: { id: created.id } },
              tag: { connect: { id: tagId } },
            },
          })
          .catch(() => {}); // Skip duplicates
      }

      txCreated++;
    } else {
      log(
        'TRANSACTIONS',
        `  Would create: [${spaceKey}] ${row.Nota_Items} | ${amount} MXN | ${row.Fecha_Operacion} | ${groupName}/${categoryName}`
      );
      txCreated++;
    }
  }

  // -----------------------------------------------------------------------
  // Phase 8: SUMMARY
  // -----------------------------------------------------------------------
  console.log('\n========================================');
  console.log('  Import Summary');
  console.log('========================================');
  console.log(`  CSV rows:          ${rows.length}`);
  console.log(`  Spaces:            ${SPACE_DEFS.length}`);
  console.log(`  Budgets:           ${SPACE_DEFS.length}`);
  console.log(
    `  Category types:    ${categoryPairs.length} (x${SPACE_DEFS.length} spaces = ${categoryPairs.length * SPACE_DEFS.length})`
  );
  console.log(
    `  Tag types:         ${ACCOUNTING_TAGS.length} (x${SPACE_DEFS.length} spaces = ${ACCOUNTING_TAGS.length * SPACE_DEFS.length})`
  );
  console.log(`  Accounts created:  ${accountsCreated} (existing: ${accountsExisting})`);
  console.log(
    `  Transactions:      ${txCreated} created, ${txSkipped} skipped, ${txWarnings} warnings`
  );

  if (!DRY_RUN) {
    // Print DB counts per space
    console.log('\n  Database entity counts per space:');
    for (const spaceDef of SPACE_DEFS) {
      const spaceId = spaceIds[spaceDef.key];
      const [accounts, transactions, categories, tags] = await Promise.all([
        prisma.account.count({ where: { spaceId } }),
        prisma.transaction.count({ where: { account: { spaceId } } }),
        prisma.category.count({ where: { budget: { spaceId } } }),
        prisma.tag.count({ where: { spaceId } }),
      ]);
      console.log(`    ${spaceDef.name}:`);
      console.log(
        `      Accounts: ${accounts}, Transactions: ${transactions}, Categories: ${categories}, Tags: ${tags}`
      );
    }
  }

  console.log('\n  Import complete!');
  console.log('========================================\n');
}

main()
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
