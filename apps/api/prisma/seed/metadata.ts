import { PrismaClient, Currency } from '../../generated/prisma';
import { subDays, subMonths, addDays } from 'date-fns';
import { SeedContext } from './helpers';

export async function seedMetadata(prisma: PrismaClient, ctx: SeedContext) {
  // 1. EXCHANGE RATES (batch)
  console.log('\n💱 Creating exchange rates...');

  const baseRates = { MXN_USD: 17.15, MXN_EUR: 18.85, USD_EUR: 1.1 };
  const exchangeRateRows: Array<{
    fromCurrency: Currency;
    toCurrency: Currency;
    rate: number;
    date: Date;
    source: string;
  }> = [];

  for (let i = 60; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const fluctuation = () => 1 + (Math.random() - 0.5) * 0.01;

    exchangeRateRows.push(
      {
        fromCurrency: Currency.MXN,
        toCurrency: Currency.USD,
        rate: 1 / (baseRates.MXN_USD * fluctuation()),
        date,
        source: 'banxico',
      },
      {
        fromCurrency: Currency.USD,
        toCurrency: Currency.MXN,
        rate: baseRates.MXN_USD * fluctuation(),
        date,
        source: 'banxico',
      },
      {
        fromCurrency: Currency.MXN,
        toCurrency: Currency.EUR,
        rate: 1 / (baseRates.MXN_EUR * fluctuation()),
        date,
        source: 'ecb',
      },
      {
        fromCurrency: Currency.EUR,
        toCurrency: Currency.MXN,
        rate: baseRates.MXN_EUR * fluctuation(),
        date,
        source: 'ecb',
      },
      {
        fromCurrency: Currency.USD,
        toCurrency: Currency.EUR,
        rate: 1 / (baseRates.USD_EUR * fluctuation()),
        date,
        source: 'ecb',
      },
      {
        fromCurrency: Currency.EUR,
        toCurrency: Currency.USD,
        rate: baseRates.USD_EUR * fluctuation(),
        date,
        source: 'ecb',
      }
    );
  }

  await prisma.exchangeRate.createMany({ data: exchangeRateRows });
  console.log('  ✓ Created 366 exchange rates (61 days × 6 pairs)');

  // 2. INCOME EVENTS & ZERO-BASED BUDGETING (Maria)
  console.log('\n💵 Creating income events and zero-based budgeting...');

  const mariaCategories = await prisma.category.findMany({
    where: { budget: { spaceId: ctx.mariaSpace.id } },
  });

  for (let month = 2; month >= 0; month--) {
    const salaryDate = subMonths(new Date(), month);
    const freelanceDate = addDays(salaryDate, 15);

    const salaryEvent = await prisma.incomeEvent.create({
      data: {
        spaceId: ctx.mariaSpace.id,
        amount: 42000,
        currency: Currency.MXN,
        source: 'paycheck',
        description: 'Biweekly salary - TechStartup',
        receivedAt: salaryDate,
        isAllocated: true,
      },
    });

    const freelanceEvent = await prisma.incomeEvent.create({
      data: {
        spaceId: ctx.mariaSpace.id,
        amount: 12000,
        currency: Currency.MXN,
        source: 'freelance',
        description: 'Freelance web design project',
        receivedAt: freelanceDate,
        isAllocated: true,
      },
    });

    // Salary allocations
    const salaryAllocations = [
      { name: 'Rent', amount: 15000 },
      { name: 'Groceries', amount: 6000 },
      { name: 'Transportation', amount: 3000 },
      { name: 'Entertainment', amount: 3000 },
      { name: 'Savings', amount: 8000 },
      { name: 'Utilities', amount: 2500 },
      { name: 'Food & Dining', amount: 4500 },
    ];

    const salaryAllocRows: Array<{ incomeEventId: string; categoryId: string; amount: number }> =
      [];
    for (const alloc of salaryAllocations) {
      const cat = mariaCategories.find((c) => c.name === alloc.name);
      if (cat) {
        salaryAllocRows.push({
          incomeEventId: salaryEvent.id,
          categoryId: cat.id,
          amount: alloc.amount,
        });
      }
    }
    await prisma.incomeAllocation.createMany({ data: salaryAllocRows });

    // Freelance allocations
    const freelanceAllocations = [
      { name: 'Savings', amount: 7000 },
      { name: 'Entertainment', amount: 2000 },
      { name: 'Food & Dining', amount: 3000 },
    ];

    const freelanceAllocRows: Array<{ incomeEventId: string; categoryId: string; amount: number }> =
      [];
    for (const alloc of freelanceAllocations) {
      const cat = mariaCategories.find((c) => c.name === alloc.name);
      if (cat) {
        freelanceAllocRows.push({
          incomeEventId: freelanceEvent.id,
          categoryId: cat.id,
          amount: alloc.amount,
        });
      }
    }
    await prisma.incomeAllocation.createMany({ data: freelanceAllocRows });
  }

  // Carlos Business space zero-based budgeting
  console.log('\n💵 Creating Carlos & Patricia income events...');

  const carlosCategories = await prisma.category.findMany({
    where: { budget: { spaceId: ctx.carlosBusiness.id } },
  });

  for (let month = 2; month >= 0; month--) {
    const consultingDate = subMonths(new Date(), month);
    const revenueDate = addDays(consultingDate, 10);

    const consultingEvent = await prisma.incomeEvent.create({
      data: {
        spaceId: ctx.carlosBusiness.id,
        amount: 65000,
        currency: Currency.MXN,
        source: 'consulting',
        description: 'IT consulting retainer - monthly',
        receivedAt: consultingDate,
        isAllocated: true,
      },
    });

    const revenueEvent = await prisma.incomeEvent.create({
      data: {
        spaceId: ctx.carlosBusiness.id,
        amount: 120000,
        currency: Currency.MXN,
        source: 'business_revenue',
        description: 'Tacos El Patrón - monthly revenue',
        receivedAt: revenueDate,
        isAllocated: true,
      },
    });

    const consultingAllocs = [
      { name: 'Office Rent', amount: 35000 },
      { name: 'Inventory', amount: 15000 },
      { name: 'Savings', amount: 15000 },
    ];
    const consultingRows: Array<{ incomeEventId: string; categoryId: string; amount: number }> = [];
    for (const alloc of consultingAllocs) {
      const cat = carlosCategories.find((c) => c.name === alloc.name);
      if (cat)
        consultingRows.push({
          incomeEventId: consultingEvent.id,
          categoryId: cat.id,
          amount: alloc.amount,
        });
    }
    if (consultingRows.length) await prisma.incomeAllocation.createMany({ data: consultingRows });

    const revenueAllocs = [
      { name: 'Inventory', amount: 40000 },
      { name: 'Payroll', amount: 50000 },
      { name: 'Savings', amount: 30000 },
    ];
    const revenueRows: Array<{ incomeEventId: string; categoryId: string; amount: number }> = [];
    for (const alloc of revenueAllocs) {
      const cat = carlosCategories.find((c) => c.name === alloc.name);
      if (cat)
        revenueRows.push({
          incomeEventId: revenueEvent.id,
          categoryId: cat.id,
          amount: alloc.amount,
        });
    }
    if (revenueRows.length) await prisma.incomeAllocation.createMany({ data: revenueRows });
  }

  // Patricia enterprise space zero-based budgeting
  const patriciaCategories = await prisma.category.findMany({
    where: { budget: { spaceId: ctx.enterpriseSpace.id } },
  });

  for (let month = 2; month >= 0; month--) {
    const salaryDate = subMonths(new Date(), month);
    const bonusDate = month === 0 ? addDays(salaryDate, 20) : null;

    const salaryEvent = await prisma.incomeEvent.create({
      data: {
        spaceId: ctx.enterpriseSpace.id,
        amount: 180000,
        currency: Currency.MXN,
        source: 'salary',
        description: 'Monthly salary - VP Engineering',
        receivedAt: salaryDate,
        isAllocated: true,
      },
    });

    const salaryAllocs = [
      { name: 'Rent', amount: 45000 },
      { name: 'Savings', amount: 60000 },
      { name: 'Groceries', amount: 20000 },
      { name: 'R&D', amount: 25000 },
      { name: 'Entertainment', amount: 15000 },
      { name: 'Utilities', amount: 15000 },
    ];
    const salaryRows: Array<{ incomeEventId: string; categoryId: string; amount: number }> = [];
    for (const alloc of salaryAllocs) {
      const cat = patriciaCategories.find((c) => c.name === alloc.name);
      if (cat)
        salaryRows.push({
          incomeEventId: salaryEvent.id,
          categoryId: cat.id,
          amount: alloc.amount,
        });
    }
    if (salaryRows.length) await prisma.incomeAllocation.createMany({ data: salaryRows });

    // Bonus for current month only
    if (bonusDate) {
      const bonusEvent = await prisma.incomeEvent.create({
        data: {
          spaceId: ctx.enterpriseSpace.id,
          amount: 500000,
          currency: Currency.MXN,
          source: 'bonus',
          description: 'Annual performance bonus + RSU vesting',
          receivedAt: bonusDate,
          isAllocated: true,
        },
      });

      const bonusAllocs = [
        { name: 'Savings', amount: 350000 },
        { name: 'Entertainment', amount: 50000 },
        { name: 'R&D', amount: 100000 },
      ];
      const bonusRows: Array<{ incomeEventId: string; categoryId: string; amount: number }> = [];
      for (const alloc of bonusAllocs) {
        const cat = patriciaCategories.find((c) => c.name === alloc.name);
        if (cat)
          bonusRows.push({
            incomeEventId: bonusEvent.id,
            categoryId: cat.id,
            amount: alloc.amount,
          });
      }
      if (bonusRows.length) await prisma.incomeAllocation.createMany({ data: bonusRows });
    }
  }

  console.log('  ✓ Created Carlos business income events (consulting + revenue × 3 months)');
  console.log('  ✓ Created Patricia enterprise income events (salary × 3 + bonus)');

  // Category goals
  const categoryGoalData = [
    {
      name: 'Rent',
      goalType: 'monthly_spending' as const,
      targetAmount: 15000,
      monthlyFunding: 15000,
    },
    {
      name: 'Savings',
      goalType: 'target_balance' as const,
      targetAmount: 200000,
      monthlyFunding: 15000,
      targetDate: new Date('2026-12-31'),
    },
    {
      name: 'Groceries',
      goalType: 'monthly_spending' as const,
      targetAmount: 6000,
      monthlyFunding: 6000,
    },
    {
      name: 'Entertainment',
      goalType: 'percentage_income' as const,
      percentageTarget: 10,
      monthlyFunding: 5000,
    },
  ];

  const catGoalRows: Array<{
    categoryId: string;
    goalType: 'monthly_spending' | 'target_balance' | 'percentage_income';
    targetAmount?: number | null;
    targetDate?: Date | null;
    monthlyFunding?: number | null;
    percentageTarget?: number | null;
  }> = [];

  for (const cg of categoryGoalData) {
    const cat = mariaCategories.find((c) => c.name === cg.name);
    if (cat) {
      catGoalRows.push({
        categoryId: cat.id,
        goalType: cg.goalType,
        targetAmount: cg.targetAmount ?? null,
        targetDate: (cg as any).targetDate ?? null,
        monthlyFunding: cg.monthlyFunding ?? null,
        percentageTarget: (cg as any).percentageTarget ?? null,
      });
    }
  }
  await prisma.categoryGoal.createMany({ data: catGoalRows });

  console.log('  ✓ Created 6 income events with 30 allocations');
  console.log('  ✓ Created 4 category goals');

  // 3. BILLING EVENTS (batch)
  console.log('\n💳 Creating billing events...');

  await prisma.billingEvent.createMany({
    data: [
      {
        userId: ctx.adminUser.id,
        type: 'subscription_created',
        amount: 9.99,
        currency: Currency.USD,
        status: 'succeeded',
        createdAt: subDays(new Date(), 180),
      },
      {
        userId: ctx.adminUser.id,
        type: 'subscription_renewed',
        amount: 9.99,
        currency: Currency.USD,
        status: 'succeeded',
        createdAt: subDays(new Date(), 30),
      },
      {
        userId: ctx.mariaUser.id,
        type: 'payment_failed',
        amount: 9.99,
        currency: Currency.USD,
        status: 'failed',
        metadata: { reason: 'card_declined', retryAt: addDays(new Date(), 3).toISOString() },
        createdAt: subDays(new Date(), 5),
      },
    ],
  });

  console.log('  ✓ Created 3 billing events');

  // 4. USAGE METRICS (batch)
  console.log('\n📊 Creating usage metrics...');

  const activeUsers = [ctx.mariaUser, ctx.carlosUser, ctx.adminUser, ctx.diegoUser];
  const metricTypes = [
    'esg_calculation',
    'monte_carlo_simulation',
    'goal_probability',
    'scenario_analysis',
    'api_request',
  ] as const;

  const metricRows: Array<{
    userId: string;
    metricType: (typeof metricTypes)[number];
    count: number;
    date: Date;
  }> = [];
  for (const user of activeUsers) {
    for (const metricType of metricTypes) {
      metricRows.push({
        userId: user.id,
        metricType,
        count: Math.floor(Math.random() * 50) + 1,
        date: new Date(),
      });
    }
  }
  await prisma.usageMetric.createMany({ data: metricRows });

  console.log('  ✓ Created 20 usage metrics');

  // 5. NOTIFICATIONS (batch)
  console.log('\n🔔 Creating notifications...');

  await prisma.userNotification.createMany({
    data: [
      {
        userId: ctx.mariaUser.id,
        type: 'budget_alert',
        title: 'Budget Alert: Entertainment',
        message: 'You have used 85% of your Entertainment budget this month.',
        createdAt: subDays(new Date(), 2),
      },
      {
        userId: ctx.mariaUser.id,
        type: 'sync_complete',
        title: 'Account Sync Complete',
        message: 'All 4 accounts synced successfully.',
        read: true,
        readAt: subDays(new Date(), 1),
        createdAt: subDays(new Date(), 1),
      },
      {
        userId: ctx.carlosUser.id,
        type: 'budget_alert',
        title: 'Budget Alert: Inventory',
        message: 'Business inventory budget is 92% spent with 10 days remaining.',
        createdAt: subDays(new Date(), 3),
      },
      {
        userId: ctx.carlosUser.id,
        type: 'security_alert',
        title: 'New Login Detected',
        message:
          'A new login was detected from Chrome on macOS. If this was not you, please change your password.',
        createdAt: subDays(new Date(), 7),
      },
      {
        userId: ctx.adminUser.id,
        type: 'subscription_renewal',
        title: 'Subscription Renewal',
        message: 'Your premium subscription will renew in 5 days ($9.99/month).',
        createdAt: subDays(new Date(), 5),
      },
      {
        userId: ctx.adminUser.id,
        type: 'sync_complete',
        title: 'Enterprise Sync Complete',
        message: 'All enterprise accounts have been synced. 3 new transactions detected.',
        read: true,
        readAt: new Date(),
        createdAt: new Date(),
      },
      {
        userId: ctx.diegoUser.id,
        type: 'budget_alert',
        title: 'Budget Alert: Crypto Investments',
        message: 'Your crypto investment allocation for this month has been fully used.',
        createdAt: subDays(new Date(), 1),
      },
      {
        userId: ctx.diegoUser.id,
        type: 'security_alert',
        title: 'TOTP Reminder',
        message: 'Enable two-factor authentication for enhanced account security.',
        createdAt: subDays(new Date(), 14),
      },
      {
        userId: ctx.diegoUser.id,
        type: 'defi_alert',
        title: 'DeFi Yield Change',
        message: 'Your Aave ETH supply APY dropped from 3.8% to 3.2%. Consider rebalancing.',
        createdAt: subDays(new Date(), 3),
      },
      {
        userId: ctx.diegoUser.id,
        type: 'esg_update',
        title: 'ESG Score Update',
        message: 'Ethereum ESG score improved to 85/100 after Shanghai upgrade analysis.',
        createdAt: subDays(new Date(), 6),
      },
      {
        userId: ctx.diegoUser.id,
        type: 'staking_reward',
        title: 'SAND Staking Reward',
        message:
          'Your SAND staking earned 127.5 SAND this month (8.5% APY). Total staked: 15,000 SAND.',
        createdAt: subDays(new Date(), 1),
      },
      {
        userId: ctx.diegoUser.id,
        type: 'floor_price_alert',
        title: 'Sandbox LAND Floor Price Change',
        message:
          'Sandbox LAND floor price changed: $1,200 → $1,450 (+20.8%). Your portfolio of 5 parcels is now valued at $7,800.',
        createdAt: subDays(new Date(), 2),
      },
      {
        userId: ctx.diegoUser.id,
        type: 'governance_vote',
        title: 'New Sandbox DAO Proposal',
        message:
          'New Sandbox DAO proposal: SIP-42 "Creator Fund Allocation Q1 2026" — Vote closes in 3 days. Your voting power: 15,000 SAND.',
        createdAt: new Date(),
      },
      {
        userId: ctx.diegoUser.id,
        type: 'nft_price_alert',
        title: 'BAYC Floor Price Drop',
        message:
          'BAYC floor dropped below $20K — your #7291 currently valued at $18,500. Consider reviewing your position.',
        createdAt: subDays(new Date(), 4),
      },
      {
        userId: ctx.guestUser.id,
        type: 'life_beat',
        title: 'Life Beat Check-In',
        message:
          'Your monthly Life Beat check-in is due. Confirm your status to maintain estate plan access controls.',
        createdAt: subDays(new Date(), 1),
      },
      {
        userId: ctx.mariaUser.id,
        type: 'executor_access',
        title: 'Executor Access Notification',
        message:
          "You have been designated as primary executor for Guest User's estate plan. Review your responsibilities.",
        createdAt: subDays(new Date(), 10),
      },
      {
        userId: ctx.mariaUser.id,
        type: 'goal_milestone',
        title: 'Goal Milestone Reached',
        message: 'Congratulations! Your Family Trip to Europe goal is now 62.5% funded.',
        createdAt: subDays(new Date(), 4),
      },
      {
        userId: ctx.carlosUser.id,
        type: 'exchange_rate',
        title: 'Exchange Rate Alert',
        message: 'MXN/USD rate moved above 17.50. Your USD holdings are now worth more in pesos.',
        createdAt: subDays(new Date(), 2),
      },
      {
        userId: ctx.carlosUser.id,
        type: 'subscription_renewal',
        title: 'Subscription Renewal Warning',
        message: 'Adobe Creative Cloud ($55/mo) renews in 3 days. Annual plan saves $24/yr.',
        createdAt: subDays(new Date(), 1),
      },
      {
        userId: ctx.diegoUser.id,
        type: 'staking_reward',
        title: 'AXS Staking Unlock',
        message:
          'Your 200 AXS staking unlock is scheduled in 14 days. Current APY: 42%. Consider restaking.',
        createdAt: subDays(new Date(), 1),
      },
      {
        userId: ctx.diegoUser.id,
        type: 'staking_reward',
        title: 'ILV Revenue Distribution',
        message: 'Illuvium Q1 revenue distribution: 1.2 sILV earned from 30 ILV staked (18% APY).',
        createdAt: subDays(new Date(), 3),
      },
      {
        userId: ctx.diegoUser.id,
        type: 'staking_reward',
        title: 'Gala Node Payout',
        message: 'Monthly Gala Node rewards: 7,500 GALA ($150). Node uptime: 99.8%.',
        createdAt: subDays(new Date(), 2),
      },
      {
        userId: ctx.diegoUser.id,
        type: 'nft_price_alert',
        title: 'IMX Marketplace Sale',
        message:
          'Your Gods Unchained Genesis Card sold for 900 IMX ($450) on Immutable Marketplace.',
        createdAt: subDays(new Date(), 5),
      },
      // Patricia additional
      {
        userId: ctx.adminUser.id,
        type: 'budget_alert',
        title: 'Budget Alert: R&D',
        message: 'R&D spending at 78% with 3 months remaining in annual budget.',
        createdAt: subDays(new Date(), 3),
      },
      {
        userId: ctx.adminUser.id,
        type: 'sync_complete',
        title: 'Chase Sync Complete',
        message: 'Chase Business Checking synced — 12 new transactions detected.',
        read: true,
        readAt: subDays(new Date(), 1),
        createdAt: subDays(new Date(), 1),
      },
      {
        userId: ctx.adminUser.id,
        type: 'goal_milestone',
        title: 'Portfolio Milestone',
        message: 'Your total portfolio has exceeded $5M. Review asset allocation recommendations.',
        createdAt: subDays(new Date(), 7),
      },
      {
        userId: ctx.adminUser.id,
        type: 'security_alert',
        title: 'New Device Login',
        message: 'New login from iPad Pro in CDMX. Verify this was you.',
        createdAt: subDays(new Date(), 2),
      },
      // Guest additional
      {
        userId: ctx.guestUser.id,
        type: 'budget_alert',
        title: 'Budget Alert: Rent',
        message: 'Rent category at 95% of monthly budget — $600 remaining.',
        createdAt: subDays(new Date(), 1),
      },
      {
        userId: ctx.guestUser.id,
        type: 'exchange_rate',
        title: 'Exchange Rate Alert',
        message:
          'MXN/USD moved from 17.15 to 17.85 (+4.1%) this week. Your USD assets gained value.',
        createdAt: subDays(new Date(), 2),
      },
      // Maria additional
      {
        userId: ctx.mariaUser.id,
        type: 'subscription_renewal',
        title: 'Netflix Renewal',
        message: 'Netflix ($199 MXN/mo) renews tomorrow. Manage subscriptions to review.',
        createdAt: subDays(new Date(), 1),
      },
      {
        userId: ctx.mariaUser.id,
        type: 'budget_alert',
        title: 'Budget Alert: Groceries',
        message: 'Groceries spending at 90% ($5,400 of $6,000) with 8 days remaining.',
        createdAt: subDays(new Date(), 3),
      },
      // Carlos additional
      {
        userId: ctx.carlosUser.id,
        type: 'goal_milestone',
        title: 'Restaurant Fund 50%',
        message: 'Your "Second Restaurant Location" fund has reached 50% ($750K of $1.5M).',
        createdAt: subDays(new Date(), 5),
      },
      {
        userId: ctx.carlosUser.id,
        type: 'sync_complete',
        title: 'Business Accounts Synced',
        message: 'All 3 Tacos El Patrón business accounts synced. 28 new transactions.',
        read: true,
        readAt: subDays(new Date(), 1),
        createdAt: subDays(new Date(), 1),
      },
      // Diego DeFi/L2 alerts
      {
        userId: ctx.diegoUser.id,
        type: 'defi_alert',
        title: 'Arbitrum GMX Position',
        message: 'Your GMX ETH/USD perp is up +$180 (+7.2%). Consider taking partial profit.',
        createdAt: subDays(new Date(), 1),
      },
      {
        userId: ctx.diegoUser.id,
        type: 'defi_alert',
        title: 'Aerodrome LP Yield',
        message: 'Aerodrome ETH/USDC LP on Base earning 12.5% APY — above your 10% target.',
        createdAt: subDays(new Date(), 2),
      },
      {
        userId: ctx.diegoUser.id,
        type: 'defi_alert',
        title: 'Radiant Lending Rate',
        message:
          'Radiant USDC lending rate on Arbitrum dropped to 5.8% from 7.2%. Review position.',
        createdAt: subDays(new Date(), 4),
      },
      // Diego bridge/cross-chain
      {
        userId: ctx.diegoUser.id,
        type: 'defi_alert',
        title: 'Bridge Complete',
        message: 'ETH → Arbitrum bridge complete. 0.5 ETH arrived on Arbitrum.',
        read: true,
        readAt: subDays(new Date(), 6),
        createdAt: subDays(new Date(), 6),
      },
      {
        userId: ctx.diegoUser.id,
        type: 'defi_alert',
        title: 'YGG Guild Update',
        message: 'YGG scholarship program Q1 earnings: $420. Guild rank improved to Silver.',
        createdAt: subDays(new Date(), 8),
      },
      // Patricia report
      {
        userId: ctx.adminUser.id,
        type: 'sync_complete',
        title: 'Monthly Report Ready',
        message:
          'Your January 2026 financial report is ready. View net worth trends and spending analysis.',
        createdAt: subDays(new Date(), 1),
      },
    ],
  });

  console.log('  ✓ Created 39 notifications');

  // 6. SAVED REPORTS
  console.log('\n📄 Creating saved reports...');

  await prisma.savedReport.createMany({
    data: [
      {
        spaceId: ctx.guestSpace.id,
        name: 'Monthly Spending Summary',
        type: 'monthly_spending',
        schedule: '0 9 1 * *',
        format: 'pdf',
        filters: { dateRange: 'last_month', categories: 'all' },
        lastRunAt: subDays(new Date(), 7),
      },
      {
        spaceId: ctx.mariaSpace.id,
        name: 'Zero-Based Budget Report',
        type: 'monthly_spending',
        schedule: '0 9 1 * *',
        format: 'pdf',
        filters: { dateRange: 'last_month', includeAllocations: true },
      },
      {
        spaceId: ctx.enterpriseSpace.id,
        name: 'Quarterly Net Worth',
        type: 'quarterly_net_worth',
        schedule: '0 9 1 */3 *',
        format: 'pdf',
        filters: { dateRange: 'last_quarter', includeAssets: true },
      },
      {
        spaceId: ctx.carlosBusiness.id,
        name: 'Annual Tax Summary',
        type: 'annual_tax',
        schedule: '0 9 15 1 *',
        format: 'csv',
        filters: { dateRange: 'last_year', categories: 'all', includeDeductions: true },
      },
    ],
  });

  console.log('  ✓ Created 4 saved reports');

  // 7. CASHFLOW FORECASTS
  console.log('\n📈 Creating cashflow forecasts...');

  const forecastStart = new Date();
  forecastStart.setHours(0, 0, 0, 0);

  function generateWeeks(
    weeklyIncome: number,
    weeklyExpenses: number,
    startBalance: number,
    variance: number
  ) {
    const weeks = [];
    let balance = startBalance;
    for (let w = 0; w < 8; w++) {
      const weekStart = addDays(forecastStart, w * 7);
      const inc = weeklyIncome * (1 + (Math.random() - 0.5) * variance);
      const exp = weeklyExpenses * (1 + (Math.random() - 0.5) * variance);
      const net = inc - exp;
      balance += net;
      weeks.push({
        weekStart: weekStart.toISOString(),
        income: Math.round(inc),
        expenses: Math.round(exp),
        net: Math.round(net),
        balance: Math.round(balance),
      });
    }
    return weeks;
  }

  await prisma.cashflowForecast.createMany({
    data: [
      {
        spaceId: ctx.guestSpace.id,
        startDate: forecastStart,
        endDate: addDays(forecastStart, 56),
        weeks: generateWeeks(11250, 9500, 85000, 0.1),
        confidence: 0.85,
      },
      {
        spaceId: ctx.mariaSpace.id,
        startDate: forecastStart,
        endDate: addDays(forecastStart, 56),
        weeks: generateWeeks(10500, 10000, 42000, 0.12),
        confidence: 0.82,
      },
      {
        spaceId: ctx.carlosBusiness.id,
        startDate: forecastStart,
        endDate: addDays(forecastStart, 56),
        weeks: generateWeeks(46250, 38000, 320000, 0.18),
        confidence: 0.78,
      },
    ],
  });

  console.log('  ✓ Created 3 cashflow forecasts (8-week projections)');
}
