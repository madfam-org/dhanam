import { PrismaClient, SpaceType } from '../../generated/prisma';
import { subDays } from 'date-fns';
import {
  SeedContext,
  randomAmount,
  randomDate,
  transactionTemplates,
  cryptoESGData,
} from './helpers';
import { seedAuditLogs } from './transactions/audit-logs';
import { seedDefiTransactions } from './transactions/defi-transactions';

export async function seedTransactions(prisma: PrismaClient, ctx: SeedContext) {
  // 1. BATCH TRANSACTIONS
  console.log('\n💰 Generating transactions...');

  const spaceEntries = [
    ctx.guestSpace,
    ctx.mariaSpace,
    ctx.carlosPersonal,
    ctx.carlosBusiness,
    ctx.enterpriseSpace,
    ctx.diegoSpace,
  ];

  for (const space of spaceEntries) {
    const accounts = await prisma.account.findMany({ where: { spaceId: space.id } });
    const categories = await prisma.category.findMany({ where: { budget: { spaceId: space.id } } });
    const checkingAccount = accounts.find((a) => a.type === 'checking');
    if (!checkingAccount) continue;

    const endDate = new Date();
    const startDate = subDays(endDate, 180);
    const templates =
      space.type === SpaceType.business
        ? transactionTemplates.expenses.business
        : transactionTemplates.expenses.personal;

    // Build expense transactions in-memory
    const expenseTxns = Array.from({ length: 320 }, () => {
      const template = templates[Math.floor(Math.random() * templates.length)];
      const category = categories.find((c) => c.name.includes(template.category.split(' ')[0]));
      return {
        accountId: checkingAccount.id,
        categoryId: category?.id ?? null,
        amount: -randomAmount(template.range[0], template.range[1]),
        currency: checkingAccount.currency,
        description: template.name,
        merchant: template.name,
        date: randomDate(startDate, endDate),
        pending: false,
      };
    });

    // Build income transactions in-memory
    const incomeTxns = Array.from({ length: 20 }, () => {
      const template =
        transactionTemplates.income[Math.floor(Math.random() * transactionTemplates.income.length)];
      return {
        accountId: checkingAccount.id,
        amount: randomAmount(template.range[0], template.range[1]),
        currency: checkingAccount.currency,
        description: template.name,
        merchant: template.name,
        date: randomDate(startDate, endDate),
        pending: false,
      };
    });

    await prisma.transaction.createMany({ data: [...expenseTxns, ...incomeTxns] });
  }

  // 2. ESG SCORES (batch per account)
  console.log('\n🌱 Generating ESG scores...');

  const allCryptoAccounts = await prisma.account.findMany({ where: { type: 'crypto' } });

  for (const account of allCryptoAccounts) {
    const esgRows = cryptoESGData.map((c) => ({
      accountId: account.id,
      assetSymbol: c.symbol,
      environmentalScore: c.env,
      socialScore: c.social,
      governanceScore: c.gov,
      calculatedAt: new Date(),
    }));

    await prisma.eSGScore.createMany({ data: esgRows });
  }
  console.log(`  ✓ Created ESG scores for ${allCryptoAccounts.length} crypto accounts`);

  // 3. ASSET VALUATIONS (batch per space)
  console.log('\n📊 Generating asset valuation history...');

  for (const space of spaceEntries) {
    const accounts = await prisma.account.findMany({ where: { spaceId: space.id } });
    const valuationRows: Array<{
      accountId: string;
      date: Date;
      value: number;
      currency: (typeof accounts)[0]['currency'];
    }> = [];

    for (const account of accounts) {
      for (let i = 60; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const variation = (Math.random() - 0.5) * 0.02;
        valuationRows.push({
          accountId: account.id,
          date,
          value: Number(account.balance) * (1 + variation),
          currency: account.currency,
        });
      }
    }

    await prisma.assetValuation.createMany({ data: valuationRows });
  }

  // 4. CATEGORIZATION RULES
  console.log('\n📋 Creating categorization rules...');

  const ruleDefinitions = [
    { keyword: 'oxxo', category: 'Groceries', spaceId: ctx.guestSpace.id },
    { keyword: 'soriana', category: 'Groceries', spaceId: ctx.guestSpace.id },
    { keyword: 'uber', category: 'Transportation', spaceId: ctx.guestSpace.id },
    { keyword: 'pemex', category: 'Transportation', spaceId: ctx.guestSpace.id },
    { keyword: 'netflix', category: 'Entertainment', spaceId: ctx.guestSpace.id },
    { keyword: 'spotify', category: 'Entertainment', spaceId: ctx.guestSpace.id },
    { keyword: 'starbucks', category: 'Food & Dining', spaceId: ctx.guestSpace.id },
    { keyword: 'restaurant', category: 'Food & Dining', spaceId: ctx.guestSpace.id },
    { keyword: 'cfe', category: 'Utilities', spaceId: ctx.guestSpace.id },
    { keyword: 'telmex', category: 'Utilities', spaceId: ctx.guestSpace.id },
    { keyword: 'amazon', category: 'Shopping', spaceId: ctx.guestSpace.id },
    { keyword: 'liverpool', category: 'Shopping', spaceId: ctx.guestSpace.id },
    { keyword: 'oxxo', category: 'Groceries', spaceId: ctx.mariaSpace.id },
    { keyword: 'uber', category: 'Transportation', spaceId: ctx.mariaSpace.id },
    { keyword: 'netflix', category: 'Entertainment', spaceId: ctx.mariaSpace.id },
    { keyword: 'spotify', category: 'Entertainment', spaceId: ctx.mariaSpace.id },
    { keyword: 'starbucks', category: 'Food & Dining', spaceId: ctx.mariaSpace.id },
    { keyword: 'payroll', category: 'Payroll', spaceId: ctx.carlosBusiness.id },
    { keyword: 'rent', category: 'Rent', spaceId: ctx.carlosBusiness.id },
    { keyword: 'aws', category: 'Infrastructure', spaceId: ctx.enterpriseSpace.id },
    { keyword: 'google', category: 'Marketing', spaceId: ctx.enterpriseSpace.id },
  ];

  // Resolve categories and batch-create rules
  const ruleRows: Array<{
    spaceId: string;
    name: string;
    conditions: { type: string; value: string };
    categoryId: string;
    enabled: boolean;
  }> = [];

  for (const rule of ruleDefinitions) {
    const category = await prisma.category.findFirst({
      where: { name: rule.category, budget: { spaceId: rule.spaceId } },
    });
    if (category) {
      ruleRows.push({
        spaceId: rule.spaceId,
        name: `Auto-categorize ${rule.keyword}`,
        conditions: { type: 'keyword', value: rule.keyword },
        categoryId: category.id,
        enabled: true,
      });
    }
  }
  await prisma.transactionRule.createMany({ data: ruleRows });

  await seedAuditLogs(prisma, ctx);
  await seedDefiTransactions(prisma, ctx);
}
