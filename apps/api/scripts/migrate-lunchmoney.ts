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

import { PrismaClient, RecurringStatus } from '../generated/prisma';

import { IdMap } from '../src/modules/migration/lunchmoney/id-map';
import { LunchMoneyClient } from '../src/modules/migration/lunchmoney/lunchmoney-client';
import {
  mapCurrency,
  mapAssetToAccount,
  mapPlaidAccountToAccount,
  mapCryptoToAccount,
  mapRecurringItem,
  decodeHtmlEntities,
} from '../src/modules/migration/lunchmoney/lunchmoney-mapper';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const DRY_RUN = process.env.DRY_RUN === 'true';
const START_DATE = process.env.START_DATE || '2024-01-01';
const TODAY = new Date().toISOString().slice(0, 10);

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
  const client = new LunchMoneyClient(token);
  const idMap = new IdMap();

  // Identify current LM budget profile
  const me = await client.getMe();
  const budgetName = process.env.LUNCHMONEY_BUDGET_LABEL || decodeHtmlEntities(me.budget_name);
  const lmAccountId = me.account_id;

  console.log('========================================');
  console.log('  LunchMoney → Dhanam Migration');
  console.log(`  Target user: ${targetEmail}`);
  console.log(`  LM budget: "${budgetName}" (account_id=${lmAccountId})`);
  console.log(`  Date range: ${START_DATE} → ${TODAY}`);
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log('========================================\n');

  // Step 0: Find target user and space
  log('INIT', `Looking up user ${targetEmail}...`);
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

  const spaceId = userSpace.spaceId;
  log('INIT', `Found space "${userSpace.space.name}" (${spaceId})`);

  // Step 1: Categories
  log('CATEGORIES', 'Fetching categories from LunchMoney...');
  const lmCategories = await client.getCategories();
  log('CATEGORIES', `Found ${lmCategories.length} categories`);

  // Find or create budget by LM origin metadata
  // 1. Try matching by LM metadata
  let budget = await prisma.budget.findFirst({
    where: {
      spaceId,
      metadata: { path: ['lunchMoneyAccountId'], equals: lmAccountId },
    },
  });

  // 2. Legacy fixup: rename "Monthly Budget" from first migration run
  if (!budget) {
    budget = await prisma.budget.findFirst({
      where: { spaceId, name: 'Monthly Budget' },
    });
    if (budget && !DRY_RUN) {
      budget = await prisma.budget.update({
        where: { id: budget.id },
        data: {
          name: budgetName,
          metadata: {
            lunchMoneyBudgetName: budgetName,
            lunchMoneyAccountId: lmAccountId,
            migratedAt: new Date().toISOString(),
          },
        },
      });
      log('INIT', `Renamed legacy "Monthly Budget" → "${budgetName}"`);
    }
  }

  // 3. Try matching by name
  if (!budget) {
    budget = await prisma.budget.findFirst({
      where: { spaceId, name: budgetName },
    });
  }

  // 4. Create new budget for this LM profile
  if (!budget && !DRY_RUN) {
    budget = await prisma.budget.create({
      data: {
        space: { connect: { id: spaceId } },
        name: budgetName,
        period: 'monthly',
        startDate: new Date(
          `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
        ),
        metadata: {
          lunchMoneyBudgetName: budgetName,
          lunchMoneyAccountId: lmAccountId,
          migratedAt: new Date().toISOString(),
        },
      },
    });
    log('INIT', `Created budget "${budgetName}"`);
  }

  // Build group name map: groupId → clean group name
  const groupNameMap = new Map<number, string>();
  for (const lmCat of lmCategories) {
    if (lmCat.is_group) {
      // Strip "[A] " prefix used by LunchMoney for archived groups
      const cleanName = lmCat.name.replace(/^\[A\]\s*/, '');
      groupNameMap.set(lmCat.id, cleanName);
    }
  }

  // Detect duplicate child names across groups (need "GroupName / ChildName" fallback)
  const childNameCounts = new Map<string, number>();
  for (const lmCat of lmCategories) {
    if (!lmCat.is_group) {
      childNameCounts.set(lmCat.name, (childNameCounts.get(lmCat.name) || 0) + 1);
    }
  }

  for (const lmCat of lmCategories) {
    if (lmCat.is_group) continue; // Skip group headers, handle children

    const groupName = lmCat.group_id ? groupNameMap.get(lmCat.group_id) || null : null;

    // Use "GroupName / ChildName" only when the child name is duplicated across groups
    const isDuplicate = (childNameCounts.get(lmCat.name) || 0) > 1;
    const name = isDuplicate && groupName ? `${groupName} / ${lmCat.name}` : lmCat.name;

    if (!DRY_RUN && budget) {
      const existing = await prisma.category.findFirst({
        where: { budgetId: budget.id, name },
      });

      if (existing) {
        idMap.set('category', lmCat.id, existing.id);
        log('CATEGORIES', `  Exists: ${name} → ${existing.id}`);
      } else {
        const created = await prisma.category.create({
          data: {
            budget: { connect: { id: budget.id } },
            name,
            budgetedAmount: 0,
            description: lmCat.description,
            isIncome: lmCat.is_income,
            excludeFromBudget: lmCat.exclude_from_budget,
            excludeFromTotals: lmCat.exclude_from_totals,
            groupName: groupName,
            sortOrder: lmCat.order ?? 0,
          },
        });
        idMap.set('category', lmCat.id, created.id);
        log(
          'CATEGORIES',
          `  Created: ${name} (group=${groupName || 'none'}, income=${lmCat.is_income}, excludeBudget=${lmCat.exclude_from_budget}, excludeTotals=${lmCat.exclude_from_totals}) → ${created.id}`
        );
      }
    } else {
      log(
        'CATEGORIES',
        `  Would create: ${name} (group=${groupName || 'none'}, income=${lmCat.is_income}, excludeTotals=${lmCat.exclude_from_totals})`
      );
    }
  }

  // Step 2: Tags
  log('TAGS', 'Fetching tags from LunchMoney...');
  const lmTags = await client.getTags();
  log('TAGS', `Found ${lmTags.length} tags`);

  for (const lmTag of lmTags) {
    if (!DRY_RUN) {
      const existing = await prisma.tag.findUnique({
        where: { spaceId_name: { spaceId, name: lmTag.name } },
      });

      if (existing) {
        idMap.set('tag', lmTag.id, existing.id);
        log('TAGS', `  Exists: ${lmTag.name} → ${existing.id}`);
      } else {
        const created = await prisma.tag.create({
          data: {
            space: { connect: { id: spaceId } },
            name: lmTag.name,
            description: lmTag.description,
          },
        });
        idMap.set('tag', lmTag.id, created.id);
        log('TAGS', `  Created: ${lmTag.name} → ${created.id}`);
      }
    } else {
      log('TAGS', `  Would create: ${lmTag.name}`);
    }
  }

  // Step 3: Accounts (assets + plaid_accounts + crypto)
  log('ACCOUNTS', 'Fetching accounts from LunchMoney...');
  const [lmAssets, lmPlaidAccounts, lmCrypto] = await Promise.all([
    client.getAssets(),
    client.getPlaidAccounts(),
    client.getCrypto(),
  ]);
  log(
    'ACCOUNTS',
    `Found ${lmAssets.length} assets, ${lmPlaidAccounts.length} plaid, ${lmCrypto.length} crypto`
  );

  const allAccountMappings = [
    ...lmAssets.map((a) => ({ lmId: a.id, type: 'asset' as const, data: mapAssetToAccount(a) })),
    ...lmPlaidAccounts.map((p) => ({
      lmId: p.id,
      type: 'plaid' as const,
      data: mapPlaidAccountToAccount(p),
    })),
    ...lmCrypto.map((c) => ({
      lmId: `${c.id}-${c.currency}`,
      type: 'crypto' as const,
      data: mapCryptoToAccount(c),
    })),
  ];

  for (const mapping of allAccountMappings) {
    if (!DRY_RUN) {
      const existing = await prisma.account.findFirst({
        where: { spaceId, providerAccountId: mapping.data.providerAccountId },
      });

      if (existing) {
        idMap.set(`account_${mapping.type}`, mapping.lmId, existing.id);
        log('ACCOUNTS', `  Exists: ${mapping.data.name} → ${existing.id}`);
      } else {
        const { providerAccountId, institutionName, metadata, ...accountFields } = mapping.data;
        const created = await prisma.account.create({
          data: {
            space: { connect: { id: spaceId } },
            providerAccountId,
            ...accountFields,
            metadata: { ...(metadata as any), institutionName } as any,
          },
        });
        idMap.set(`account_${mapping.type}`, mapping.lmId, created.id);
        log('ACCOUNTS', `  Created: ${mapping.data.name} → ${created.id}`);
      }
    } else {
      log('ACCOUNTS', `  Would create: ${mapping.data.name} (${mapping.type})`);
    }
  }

  // Step 4: Transactions
  log('TRANSACTIONS', `Fetching transactions from ${START_DATE} to ${TODAY}...`);
  const lmTransactions = await client.getAllTransactions(START_DATE, TODAY);
  log('TRANSACTIONS', `Found ${lmTransactions.length} transactions`);

  let txCreated = 0;
  let txSkipped = 0;

  for (const lmTx of lmTransactions) {
    // Skip group transactions (they're parent aggregates)
    if (lmTx.is_group) {
      txSkipped++;
      continue;
    }

    // Resolve account ID
    let accountId: string | undefined;
    if (lmTx.asset_id) {
      accountId = idMap.get('account_asset', lmTx.asset_id);
    } else if (lmTx.plaid_account_id) {
      accountId = idMap.get('account_plaid', lmTx.plaid_account_id);
    }

    if (!accountId) {
      log(
        'TRANSACTIONS',
        `  SKIP: No account mapping for tx ${lmTx.id} (asset=${lmTx.asset_id}, plaid=${lmTx.plaid_account_id})`
      );
      txSkipped++;
      continue;
    }

    const categoryId = lmTx.category_id ? idMap.get('category', lmTx.category_id) : undefined;
    const providerTransactionId = `lm-${lmTx.id}`;

    if (!DRY_RUN) {
      // Check for existing transaction
      const existing = await prisma.transaction.findFirst({
        where: { accountId, providerTransactionId },
      });

      if (existing) {
        txSkipped++;
        continue;
      }

      const txData: any = {
        account: { connect: { id: accountId } },
        providerTransactionId,
        amount: parseFloat(lmTx.amount),
        currency: mapCurrency(lmTx.currency),
        description: lmTx.payee || lmTx.original_name || 'Unknown',
        merchant: lmTx.payee || null,
        ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
        date: new Date(lmTx.date + 'T12:00:00Z'),
        pending: lmTx.is_pending,
        reviewed: lmTx.status === 'cleared',
        reviewedAt: lmTx.status === 'cleared' ? new Date() : null,
        metadata: {
          lunchMoneyId: lmTx.id,
          originalName: lmTx.original_name,
          notes: lmTx.notes,
        },
      };

      const created = await prisma.transaction.create({ data: txData });

      // Create tag associations
      if (lmTx.tags && lmTx.tags.length > 0) {
        for (const t of lmTx.tags) {
          const tagId = idMap.get('tag', t.id);
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
        }
      }

      txCreated++;
    } else {
      log(
        'TRANSACTIONS',
        `  Would create: ${lmTx.payee} | ${lmTx.amount} ${lmTx.currency} | ${lmTx.date}`
      );
      txCreated++;
    }
  }

  log('TRANSACTIONS', `Created: ${txCreated}, Skipped: ${txSkipped}`);

  // Step 5: Auto-generate rules from transaction patterns (scoped to this budget's categories)
  log('RULES', 'Generating rules from transaction patterns...');
  if (!DRY_RUN) {
    const currentBudgetCategoryIds = Array.from(idMap.getAll('category').values());

    const patterns = await prisma.transaction.groupBy({
      by: ['merchant', 'categoryId'],
      where: {
        account: { spaceId },
        merchant: { not: null },
        categoryId: { in: currentBudgetCategoryIds },
      },
      _count: { id: true },
      having: { id: { _count: { gte: 3 } } },
    });

    let rulesCreated = 0;
    for (const pattern of patterns) {
      if (!pattern.merchant || !pattern.categoryId) continue;

      const ruleName = `Auto: [${budgetName}] ${pattern.merchant}`;
      const existing = await prisma.transactionRule.findFirst({
        where: {
          spaceId,
          name: ruleName,
        },
      });

      if (!existing) {
        await prisma.transactionRule.create({
          data: {
            space: { connect: { id: spaceId } },
            name: ruleName,
            conditions: {
              field: 'merchant',
              operator: 'equals',
              value: pattern.merchant,
            },
            category: { connect: { id: pattern.categoryId } },
            priority: 0,
            enabled: true,
          },
        });
        rulesCreated++;
      }
    }
    log('RULES', `Created ${rulesCreated} rules from ${patterns.length} patterns`);
  }

  // Step 6: Recurring Items
  log('RECURRING', 'Fetching recurring items from LunchMoney...');
  const lmRecurring = (await client.getRecurringItems()) || [];
  log('RECURRING', `Found ${lmRecurring.length} recurring items`);

  for (const item of lmRecurring) {
    if (item.type === 'dismissed') continue;

    const mapped = mapRecurringItem(item);

    if (!DRY_RUN) {
      const existing = await prisma.recurringTransaction.findFirst({
        where: {
          spaceId,
          merchantName: mapped.merchantName,
          frequency: mapped.frequency,
        },
      });

      if (existing) {
        log('RECURRING', `  Exists: ${mapped.merchantName}`);
      } else {
        const categoryId = item.category_id ? idMap.get('category', item.category_id) : undefined;

        await prisma.recurringTransaction.create({
          data: {
            spaceId,
            merchantName: mapped.merchantName,
            expectedAmount: mapped.expectedAmount,
            currency: mapped.currency,
            frequency: mapped.frequency,
            status: item.type === 'cleared' ? RecurringStatus.confirmed : RecurringStatus.detected,
            categoryId: categoryId || null,
            notes: mapped.notes || null,
            metadata: mapped.metadata as any,
            lastOccurrence: item.billing_date ? new Date(item.billing_date) : null,
          },
        });
        log('RECURRING', `  Created: ${mapped.merchantName}`);
      }
    } else {
      log('RECURRING', `  Would create: ${mapped.merchantName} (${mapped.frequency})`);
    }
  }

  // Step 7: Budget amounts
  log('BUDGETS', 'Fetching budget data from LunchMoney...');
  try {
    const lmBudgets = await client.getBudgets(START_DATE, TODAY);
    log('BUDGETS', `Found ${lmBudgets.length} budget entries`);

    if (!DRY_RUN && budget) {
      for (const lmBudget of lmBudgets) {
        if (lmBudget.is_group || lmBudget.is_income) continue;

        const categoryId = idMap.get('category', lmBudget.category_id);
        if (!categoryId) continue;

        // Get the most recent budget amount
        const months = Object.values(lmBudget.data);
        const latest = months[months.length - 1];
        if (latest?.budget_amount && latest.budget_amount > 0) {
          await prisma.category.update({
            where: { id: categoryId },
            data: { budgetedAmount: latest.budget_amount },
          });
          log('BUDGETS', `  Updated: ${lmBudget.category_name} → ${latest.budget_amount}`);
        }
      }
    }
  } catch (err) {
    log('BUDGETS', `Warning: Budget fetch failed: ${err}`);
  }

  // Step 8: Validation summary
  console.log('\n========================================');
  console.log('  Migration Summary');
  console.log('========================================');
  console.log(`  ID Mappings: ${JSON.stringify(idMap.summary(), null, 2)}`);

  if (!DRY_RUN) {
    const counts = await Promise.all([
      prisma.account.count({ where: { spaceId } }),
      prisma.transaction.count({ where: { account: { spaceId } } }),
      prisma.category.count({ where: { budget: { spaceId } } }),
      prisma.tag.count({ where: { spaceId } }),
      prisma.transactionRule.count({ where: { spaceId } }),
      prisma.recurringTransaction.count({ where: { spaceId } }),
    ]);

    console.log('\n  Dhanam entity counts:');
    console.log(`    Accounts:     ${counts[0]}`);
    console.log(`    Transactions: ${counts[1]}`);
    console.log(`    Categories:   ${counts[2]}`);
    console.log(`    Tags:         ${counts[3]}`);
    console.log(`    Rules:        ${counts[4]}`);
    console.log(`    Recurring:    ${counts[5]}`);
  }

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
