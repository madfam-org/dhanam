import { RecurringStatus, type PrismaClient } from '@db';

import { IdMap } from './id-map';
import { LunchMoneyClient } from './lunchmoney-client';
import type {
  LunchMoneyImportResult,
  LunchMoneyImportRunOptions,
  LunchMoneyPreflightResult,
} from './lunchmoney-import.types';
import {
  mapCurrency,
  mapAssetToAccount,
  mapPlaidAccountToAccount,
  mapCryptoToAccount,
  mapRecurringItem,
  decodeHtmlEntities,
} from './lunchmoney-mapper';

const DEFAULT_START_DATE = '2024-01-01';

export const LUNCHMONEY_IMPORT_LIMITATIONS = [
  'Linked bank accounts import as manual snapshots — reconnect via Belvo or Plaid after import.',
  'Split and grouped parent transactions are skipped.',
  'Real estate, vehicle, and loan assets map to generic account types.',
  'Budget amounts reflect the latest month only.',
] as const;

export class LunchMoneyImportRunner {
  constructor(private readonly prisma: PrismaClient) {}

  async preflight(
    apiToken: string,
    startDate = DEFAULT_START_DATE
  ): Promise<LunchMoneyPreflightResult> {
    const client = new LunchMoneyClient(apiToken);
    const endDate = new Date().toISOString().slice(0, 10);
    const me = await client.getMe();

    const [lmCategories, lmTags, lmAssets, lmPlaidAccounts, lmCrypto, lmTransactions, lmRecurring] =
      await Promise.all([
        client.getCategories(),
        client.getTags(),
        client.getAssets(),
        client.getPlaidAccounts(),
        client.getCrypto(),
        client.getAllTransactions(startDate, endDate),
        client.getRecurringItems(),
      ]);

    const childCategories = lmCategories.filter((c) => !c.is_group);
    const groupParents = lmTransactions.filter((t) => t.is_group);

    return {
      budgetName: decodeHtmlEntities(me.budget_name),
      lunchMoneyAccountId: me.account_id,
      primaryCurrency: me.primary_currency,
      dateRange: { startDate, endDate },
      counts: {
        categories: childCategories.length,
        tags: lmTags.length,
        accounts: lmAssets.length + lmPlaidAccounts.length + lmCrypto.length,
        plaidAccounts: lmPlaidAccounts.length,
        manualAssets: lmAssets.length,
        cryptoAccounts: lmCrypto.length,
        transactions: lmTransactions.length - groupParents.length,
        groupTransactionsSkipped: groupParents.length,
        recurringItems: (lmRecurring ?? []).filter((i) => i.type !== 'dismissed').length,
      },
      limitations: [...LUNCHMONEY_IMPORT_LIMITATIONS],
    };
  }

  async run(options: LunchMoneyImportRunOptions): Promise<LunchMoneyImportResult> {
    const {
      spaceId,
      apiToken,
      startDate = DEFAULT_START_DATE,
      endDate = new Date().toISOString().slice(0, 10),
      dryRun = false,
      budgetLabel,
      onLog,
    } = options;

    const log = (phase: string, message: string) => onLog?.(phase, message);

    const client = new LunchMoneyClient(apiToken);
    const idMap = new IdMap();

    const me = await client.getMe();
    const budgetName = budgetLabel || decodeHtmlEntities(me.budget_name);
    const lmAccountId = me.account_id;

    log('INIT', `LM budget "${budgetName}" (account_id=${lmAccountId})`);

    const lmCategories = await client.getCategories();
    log('CATEGORIES', `Found ${lmCategories.length} categories`);

    let budget = await this.prisma.budget.findFirst({
      where: {
        spaceId,
        metadata: { path: ['lunchMoneyAccountId'], equals: lmAccountId },
      },
    });

    if (!budget) {
      budget = await this.prisma.budget.findFirst({
        where: { spaceId, name: 'Monthly Budget' },
      });
      if (budget && !dryRun) {
        budget = await this.prisma.budget.update({
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
      }
    }

    if (!budget) {
      budget = await this.prisma.budget.findFirst({
        where: { spaceId, name: budgetName },
      });
    }

    if (!budget && !dryRun) {
      budget = await this.prisma.budget.create({
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
    }

    const groupNameMap = new Map<number, string>();
    for (const lmCat of lmCategories) {
      if (lmCat.is_group) {
        groupNameMap.set(lmCat.id, lmCat.name.replace(/^\[A\]\s*/, ''));
      }
    }

    const childNameCounts = new Map<string, number>();
    for (const lmCat of lmCategories) {
      if (!lmCat.is_group) {
        childNameCounts.set(lmCat.name, (childNameCounts.get(lmCat.name) || 0) + 1);
      }
    }

    let categoriesCreated = 0;
    for (const lmCat of lmCategories) {
      if (lmCat.is_group) continue;

      const groupName = lmCat.group_id ? groupNameMap.get(lmCat.group_id) || null : null;
      const isDuplicate = (childNameCounts.get(lmCat.name) || 0) > 1;
      const name = isDuplicate && groupName ? `${groupName} / ${lmCat.name}` : lmCat.name;

      if (!dryRun && budget) {
        const existing = await this.prisma.category.findFirst({
          where: { budgetId: budget.id, name },
        });

        if (existing) {
          idMap.set('category', lmCat.id, existing.id);
        } else {
          const created = await this.prisma.category.create({
            data: {
              budget: { connect: { id: budget.id } },
              name,
              budgetedAmount: 0,
              description: lmCat.description,
              isIncome: lmCat.is_income,
              excludeFromBudget: lmCat.exclude_from_budget,
              excludeFromTotals: lmCat.exclude_from_totals,
              groupName,
              sortOrder: lmCat.order ?? 0,
            },
          });
          idMap.set('category', lmCat.id, created.id);
          categoriesCreated++;
        }
      } else {
        categoriesCreated++;
      }
    }

    const lmTags = await client.getTags();
    let tagsCreated = 0;
    for (const lmTag of lmTags) {
      if (!dryRun) {
        const existing = await this.prisma.tag.findUnique({
          where: { spaceId_name: { spaceId, name: lmTag.name } },
        });

        if (existing) {
          idMap.set('tag', lmTag.id, existing.id);
        } else {
          const created = await this.prisma.tag.create({
            data: {
              space: { connect: { id: spaceId } },
              name: lmTag.name,
              description: lmTag.description,
            },
          });
          idMap.set('tag', lmTag.id, created.id);
          tagsCreated++;
        }
      } else {
        tagsCreated++;
      }
    }

    const [lmAssets, lmPlaidAccounts, lmCrypto] = await Promise.all([
      client.getAssets(),
      client.getPlaidAccounts(),
      client.getCrypto(),
    ]);

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

    let accountsCreated = 0;
    for (const mapping of allAccountMappings) {
      if (!dryRun) {
        const existing = await this.prisma.account.findFirst({
          where: { spaceId, providerAccountId: mapping.data.providerAccountId },
        });

        if (existing) {
          idMap.set(`account_${mapping.type}`, mapping.lmId, existing.id);
        } else {
          const { providerAccountId, institutionName, metadata, ...accountFields } = mapping.data;
          const created = await this.prisma.account.create({
            data: {
              space: { connect: { id: spaceId } },
              providerAccountId,
              ...accountFields,
              metadata: { ...(metadata as Record<string, unknown>), institutionName } as object,
            },
          });
          idMap.set(`account_${mapping.type}`, mapping.lmId, created.id);
          accountsCreated++;
        }
      } else {
        accountsCreated++;
      }
    }

    const lmTransactions = await client.getAllTransactions(startDate, endDate);
    let txCreated = 0;
    let txSkipped = 0;

    for (const lmTx of lmTransactions) {
      if (lmTx.is_group) {
        txSkipped++;
        continue;
      }

      let accountId: string | undefined;
      if (lmTx.asset_id) {
        accountId = idMap.get('account_asset', lmTx.asset_id);
      } else if (lmTx.plaid_account_id) {
        accountId = idMap.get('account_plaid', lmTx.plaid_account_id);
      }

      if (!accountId) {
        txSkipped++;
        continue;
      }

      const categoryId = lmTx.category_id ? idMap.get('category', lmTx.category_id) : undefined;
      const providerTransactionId = `lm-${lmTx.id}`;

      if (!dryRun) {
        const existing = await this.prisma.transaction.findFirst({
          where: { accountId, providerTransactionId },
        });

        if (existing) {
          txSkipped++;
          continue;
        }

        const created = await this.prisma.transaction.create({
          data: {
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
          },
        });

        if (lmTx.tags && lmTx.tags.length > 0) {
          for (const t of lmTx.tags) {
            const tagId = idMap.get('tag', t.id);
            if (tagId) {
              await this.prisma.transactionTag
                .create({
                  data: {
                    transaction: { connect: { id: created.id } },
                    tag: { connect: { id: tagId } },
                  },
                })
                .catch(() => undefined);
            }
          }
        }

        txCreated++;
      } else {
        txCreated++;
      }
    }

    let rulesCreated = 0;
    if (!dryRun) {
      const currentBudgetCategoryIds = Array.from(idMap.getAll('category').values());
      const patterns = await this.prisma.transaction.groupBy({
        by: ['merchant', 'categoryId'],
        where: {
          account: { spaceId },
          merchant: { not: null },
          categoryId: { in: currentBudgetCategoryIds },
        },
        _count: { id: true },
        having: { id: { _count: { gte: 3 } } },
      });

      for (const pattern of patterns) {
        if (!pattern.merchant || !pattern.categoryId) continue;

        const ruleName = `Auto: [${budgetName}] ${pattern.merchant}`;
        const existing = await this.prisma.transactionRule.findFirst({
          where: { spaceId, name: ruleName },
        });

        if (!existing) {
          await this.prisma.transactionRule.create({
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
    }

    const lmRecurring = (await client.getRecurringItems()) || [];
    let recurringCreated = 0;
    for (const item of lmRecurring) {
      if (item.type === 'dismissed') continue;

      const mapped = mapRecurringItem(item);

      if (!dryRun) {
        const existing = await this.prisma.recurringTransaction.findFirst({
          where: {
            spaceId,
            merchantName: mapped.merchantName,
            frequency: mapped.frequency,
          },
        });

        if (!existing) {
          const categoryId = item.category_id ? idMap.get('category', item.category_id) : undefined;
          await this.prisma.recurringTransaction.create({
            data: {
              spaceId,
              merchantName: mapped.merchantName,
              expectedAmount: mapped.expectedAmount,
              currency: mapped.currency,
              frequency: mapped.frequency,
              status:
                item.type === 'cleared' ? RecurringStatus.confirmed : RecurringStatus.detected,
              categoryId: categoryId || null,
              notes: mapped.notes || null,
              metadata: mapped.metadata as object,
              lastOccurrence: item.billing_date ? new Date(item.billing_date) : null,
            },
          });
          recurringCreated++;
        }
      } else {
        recurringCreated++;
      }
    }

    if (!dryRun && budget) {
      try {
        const lmBudgets = await client.getBudgets(startDate, endDate);
        for (const lmBudget of lmBudgets) {
          if (lmBudget.is_group || lmBudget.is_income) continue;

          const categoryId = idMap.get('category', lmBudget.category_id);
          if (!categoryId) continue;

          const months = Object.values(lmBudget.data);
          const latest = months[months.length - 1];
          if (latest?.budget_amount && latest.budget_amount > 0) {
            await this.prisma.category.update({
              where: { id: categoryId },
              data: { budgetedAmount: latest.budget_amount },
            });
          }
        }
      } catch (err) {
        log('BUDGETS', `Warning: Budget fetch failed: ${String(err)}`);
      }
    }

    const result: LunchMoneyImportResult = {
      budgetName,
      lunchMoneyAccountId: lmAccountId,
      budgetId: budget?.id,
      dryRun,
      counts: {
        categories: categoriesCreated,
        tags: tagsCreated,
        accounts: accountsCreated,
        transactionsCreated: txCreated,
        transactionsSkipped: txSkipped,
        rulesCreated,
        recurringCreated,
      },
      idMapSummary: idMap.summary(),
    };

    if (!dryRun) {
      const counts = await Promise.all([
        this.prisma.account.count({ where: { spaceId } }),
        this.prisma.transaction.count({ where: { account: { spaceId } } }),
        this.prisma.category.count({ where: { budget: { spaceId } } }),
        this.prisma.tag.count({ where: { spaceId } }),
        this.prisma.transactionRule.count({ where: { spaceId } }),
        this.prisma.recurringTransaction.count({ where: { spaceId } }),
      ]);

      result.spaceTotals = {
        accounts: counts[0] ?? 0,
        transactions: counts[1] ?? 0,
        categories: counts[2] ?? 0,
        tags: counts[3] ?? 0,
        rules: counts[4] ?? 0,
        recurring: counts[5] ?? 0,
      };
    }

    return result;
  }
}
