import {
  PrismaClient,
  Currency,
  SimulationType,
  OrderType,
  OrderStatus,
  OrderPriority,
  ExecutionProvider,
  AdvancedOrderType,
  RecurrencePattern,
} from '../../generated/prisma';
import { subDays, addDays } from 'date-fns';
import { SeedContext } from './helpers';
import { seedCategoryCorrections } from './advanced/category-corrections';

export async function seedAdvanced(prisma: PrismaClient, ctx: SeedContext) {
  // 1. SIMULATIONS
  console.log('\n🎲 Creating Monte Carlo simulations...');

  const guestGoal = await prisma.goal.findFirst({
    where: { spaceId: ctx.guestSpace.id, name: 'Retirement Fund' },
  });
  const mariaGoal = await prisma.goal.findFirst({
    where: { spaceId: ctx.mariaSpace.id, name: "Children's Education Fund" },
  });
  const carlosGoal = await prisma.goal.findFirst({
    where: { spaceId: ctx.carlosPersonal.id, name: 'Second Restaurant Location' },
  });

  await prisma.simulation.createMany({
    data: [
      {
        userId: ctx.guestUser.id,
        spaceId: ctx.guestSpace.id,
        goalId: guestGoal?.id ?? null,
        type: SimulationType.retirement,
        config: {
          iterations: 10000,
          horizon_years: 20,
          monthly_contribution: 5000,
          expected_return: 0.07,
          volatility: 0.15,
          inflation: 0.04,
        },
        result: {
          median: 1050000,
          p10: 720000,
          p25: 850000,
          p75: 1280000,
          p90: 1520000,
          probability_of_success: 87.5,
          optimal_contribution: 5500,
        },
        status: 'completed',
        executionTimeMs: 2340,
      },
      {
        userId: ctx.mariaUser.id,
        spaceId: ctx.mariaSpace.id,
        goalId: mariaGoal?.id ?? null,
        type: SimulationType.goal_probability,
        config: {
          iterations: 10000,
          target: 500000,
          horizon_years: 6,
          monthly_contribution: 6000,
          expected_return: 0.06,
          volatility: 0.12,
        },
        result: {
          median: 480000,
          p10: 380000,
          p25: 420000,
          p75: 540000,
          p90: 610000,
          probability_of_success: 73.8,
          shortfall_amount: 20000,
        },
        status: 'completed',
        executionTimeMs: 1890,
      },
      {
        userId: ctx.carlosUser.id,
        spaceId: ctx.carlosPersonal.id,
        goalId: carlosGoal?.id ?? null,
        type: SimulationType.scenario_analysis,
        config: {
          scenarios: ['bull', 'base', 'bear'],
          horizon_years: 2,
          monthly_contribution: 25000,
          current_savings: 450000,
        },
        result: {
          bull: { final: 1680000, probability: 0.25 },
          base: { final: 1420000, probability: 0.5 },
          bear: { final: 1100000, probability: 0.25 },
          weighted_probability: 65.7,
        },
        status: 'completed',
        executionTimeMs: 3120,
      },
      {
        userId: ctx.diegoUser.id,
        spaceId: ctx.diegoSpace.id,
        type: SimulationType.scenario_analysis,
        config: {
          label: 'Metaverse Earnings Projection',
          scenarios: ['bull', 'base', 'bear'],
          horizon_years: 3,
          income_streams: {
            land_rental: { monthly: 300, growth_rate: 0.1, volatility: 0.35 },
            staking_rewards: { monthly: 127.5, apy: 0.085, volatility: 0.2 },
            p2e_earnings: { monthly: 200, growth_rate: 0.15, volatility: 0.5 },
            creator_revenue: { monthly: 320, growth_rate: 0.2, volatility: 0.4 },
          },
          land_appreciation: { annual_rate: 0.12, volatility: 0.45 },
        },
        result: {
          bull: { total_income_3y: 68400, land_value: 15600, probability: 0.2 },
          base: { total_income_3y: 42000, land_value: 9800, probability: 0.55 },
          bear: { total_income_3y: 18000, land_value: 4200, probability: 0.25 },
          weighted_monthly_income: 1167,
        },
        status: 'completed',
        executionTimeMs: 2890,
      },
      {
        userId: ctx.adminUser.id,
        spaceId: ctx.enterpriseSpace.id,
        type: SimulationType.safe_withdrawal,
        config: {
          portfolio_value: 5000000,
          annual_spending: 200000,
          horizon_years: 30,
          expected_return: 0.06,
          volatility: 0.14,
          inflation: 0.03,
        },
        result: {
          safe_withdrawal_rate: 3.8,
          success_probability: 94.2,
          median_ending_balance: 6200000,
          worst_case_depletion_year: 26,
        },
        status: 'completed',
        executionTimeMs: 4560,
      },
      {
        userId: ctx.diegoUser.id,
        spaceId: ctx.diegoSpace.id,
        type: SimulationType.scenario_analysis,
        config: {
          label: 'Multi-Platform P2E Income Projection',
          scenarios: ['bull', 'base', 'bear'],
          horizon_years: 3,
          platforms: {
            sandbox: { monthly: 503, growth: 0.12, volatility: 0.35 },
            axie: { monthly: 284, growth: 0.08, volatility: 0.45 },
            illuvium: { monthly: 180, growth: 0.15, volatility: 0.4 },
            gala: { monthly: 190, growth: 0.1, volatility: 0.5 },
            star_atlas: { monthly: 29, growth: 0.2, volatility: 0.55 },
          },
        },
        result: {
          bull: { total_income_3y: 128000, portfolio_value: 52000, probability: 0.2 },
          base: { total_income_3y: 85000, portfolio_value: 38000, probability: 0.55 },
          bear: { total_income_3y: 32000, portfolio_value: 18000, probability: 0.25 },
          weighted_monthly_income: 2361,
        },
        status: 'completed',
        executionTimeMs: 3450,
      },
      {
        userId: ctx.diegoUser.id,
        spaceId: ctx.diegoSpace.id,
        type: SimulationType.scenario_analysis,
        config: {
          label: 'Cross-Chain Portfolio Risk',
          scenarios: ['chain_hack', 'market_crash', 'regulatory'],
          chains: ['ethereum', 'polygon', 'ronin', 'solana', 'galachain', 'immutable-zkevm'],
          total_value: 35750,
          correlation_matrix: 'high-correlation gaming tokens',
        },
        result: {
          chain_hack: { max_loss: 8200, affected_chains: ['ronin'], probability: 0.05 },
          market_crash: { max_loss: 21450, drawdown_pct: 60, probability: 0.15 },
          regulatory: { max_loss: 14300, affected_pct: 40, probability: 0.1 },
          risk_score: 72,
          diversification_score: 68,
        },
        status: 'completed',
        executionTimeMs: 4120,
      },
    ],
  });

  console.log('  ✓ Created 6 simulations');

  // 2. ACCOUNT SHARING PERMISSIONS (Yours/Mine/Ours)
  console.log('\n🔐 Creating account sharing permissions...');

  const guestChecking = await prisma.account.findFirst({
    where: { spaceId: ctx.guestSpace.id, type: 'checking' },
  });
  const guestSavings = await prisma.account.findFirst({
    where: { spaceId: ctx.guestSpace.id, type: 'savings' },
  });
  const mariaChecking = await prisma.account.findFirst({
    where: { spaceId: ctx.mariaSpace.id, type: 'checking' },
  });
  const carlosBusinessMain = await prisma.account.findFirst({
    where: { spaceId: ctx.carlosBusiness.id, type: 'checking' },
  });

  const sharingRows: Array<{
    accountId: string;
    sharedWithId: string;
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }> = [];

  if (guestChecking)
    sharingRows.push({
      accountId: guestChecking.id,
      sharedWithId: ctx.mariaUser.id,
      canView: true,
      canEdit: false,
      canDelete: false,
    });
  if (guestSavings)
    sharingRows.push({
      accountId: guestSavings.id,
      sharedWithId: ctx.mariaUser.id,
      canView: true,
      canEdit: true,
      canDelete: false,
    });
  if (mariaChecking)
    sharingRows.push({
      accountId: mariaChecking.id,
      sharedWithId: ctx.guestUser.id,
      canView: true,
      canEdit: false,
      canDelete: false,
    });
  if (carlosBusinessMain)
    sharingRows.push({
      accountId: carlosBusinessMain.id,
      sharedWithId: ctx.adminUser.id,
      canView: true,
      canEdit: false,
      canDelete: false,
    });

  if (sharingRows.length > 0) {
    await prisma.accountSharingPermission.createMany({ data: sharingRows });
  }

  console.log(`  ✓ Created ${sharingRows.length} account sharing permissions`);

  // 3. TRANSACTION ORDERS (Diego's crypto orders)
  console.log('\n📋 Creating transaction orders...');

  const diegoBitso = await prisma.account.findFirst({
    where: { spaceId: ctx.diegoSpace.id, providerAccountId: 'diego-bitso' },
  });

  if (diegoBitso) {
    const orders = await Promise.all([
      prisma.transactionOrder.create({
        data: {
          spaceId: ctx.diegoSpace.id,
          userId: ctx.diegoUser.id,
          accountId: diegoBitso.id,
          idempotencyKey: 'diego-stop-loss-btc-001',
          type: OrderType.sell,
          status: OrderStatus.pending_trigger,
          priority: OrderPriority.high,
          amount: 0.5,
          currency: Currency.USD,
          assetSymbol: 'BTC',
          targetPrice: 55000,
          provider: ExecutionProvider.bitso,
          advancedType: AdvancedOrderType.stop_loss,
          stopPrice: 55000,
          notes: 'Stop-loss on BTC if price drops below $55K',
          submittedAt: subDays(new Date(), 5),
        },
      }),
      prisma.transactionOrder.create({
        data: {
          spaceId: ctx.diegoSpace.id,
          userId: ctx.diegoUser.id,
          accountId: diegoBitso.id,
          idempotencyKey: 'diego-trailing-stop-eth-001',
          type: OrderType.sell,
          status: OrderStatus.pending_trigger,
          priority: OrderPriority.normal,
          amount: 2.0,
          currency: Currency.USD,
          assetSymbol: 'ETH',
          provider: ExecutionProvider.bitso,
          advancedType: AdvancedOrderType.trailing_stop,
          trailingPercent: 8.0,
          highestPrice: 3200,
          notes: 'Trailing stop on ETH - 8% below peak',
          submittedAt: subDays(new Date(), 3),
        },
      }),
      prisma.transactionOrder.create({
        data: {
          spaceId: ctx.diegoSpace.id,
          userId: ctx.diegoUser.id,
          accountId: diegoBitso.id,
          idempotencyKey: 'diego-limit-buy-sol-001',
          type: OrderType.buy,
          status: OrderStatus.pending_trigger,
          priority: OrderPriority.normal,
          amount: 50,
          currency: Currency.USD,
          assetSymbol: 'SOL',
          targetPrice: 85,
          provider: ExecutionProvider.bitso,
          notes: 'Buy SOL at $85 target',
          submittedAt: subDays(new Date(), 7),
        },
      }),
      prisma.transactionOrder.create({
        data: {
          spaceId: ctx.diegoSpace.id,
          userId: ctx.diegoUser.id,
          accountId: diegoBitso.id,
          idempotencyKey: 'diego-oco-sand-001',
          type: OrderType.sell,
          status: OrderStatus.pending_trigger,
          priority: OrderPriority.normal,
          amount: 5000,
          currency: Currency.USD,
          assetSymbol: 'SAND',
          provider: ExecutionProvider.bitso,
          advancedType: AdvancedOrderType.oco,
          stopPrice: 0.3,
          takeProfitPrice: 0.85,
          notes: 'OCO on SAND: take profit at $0.85, stop loss at $0.30',
          submittedAt: subDays(new Date(), 2),
        },
      }),
      prisma.transactionOrder.create({
        data: {
          spaceId: ctx.diegoSpace.id,
          userId: ctx.diegoUser.id,
          accountId: diegoBitso.id,
          idempotencyKey: 'diego-dca-btc-weekly-001',
          type: OrderType.buy,
          status: OrderStatus.completed,
          priority: OrderPriority.normal,
          amount: 1000,
          currency: Currency.MXN,
          assetSymbol: 'BTC',
          provider: ExecutionProvider.bitso,
          recurrence: RecurrencePattern.weekly,
          recurrenceDay: 1,
          executionCount: 8,
          maxExecutions: 52,
          executedAmount: 1000,
          executedPrice: 62500,
          fees: 15,
          feeCurrency: Currency.MXN,
          notes: 'Weekly DCA into BTC - every Monday',
          submittedAt: subDays(new Date(), 60),
          executedAt: subDays(new Date(), 1),
          completedAt: subDays(new Date(), 1),
        },
      }),
      prisma.transactionOrder.create({
        data: {
          spaceId: ctx.diegoSpace.id,
          userId: ctx.diegoUser.id,
          accountId: diegoBitso.id,
          idempotencyKey: 'diego-recurring-sand-monthly-001',
          type: OrderType.buy,
          status: OrderStatus.completed,
          priority: OrderPriority.low,
          amount: 500,
          currency: Currency.MXN,
          assetSymbol: 'SAND',
          provider: ExecutionProvider.bitso,
          recurrence: RecurrencePattern.monthly,
          recurrenceDay: 15,
          executionCount: 3,
          maxExecutions: 12,
          executedAmount: 500,
          executedPrice: 0.45,
          fees: 8,
          feeCurrency: Currency.MXN,
          notes: 'Monthly SAND accumulation - 15th of each month',
          submittedAt: subDays(new Date(), 90),
          executedAt: subDays(new Date(), 15),
          completedAt: subDays(new Date(), 15),
        },
      }),
    ]);

    console.log(`  ✓ Created ${orders.length} transaction orders`);

    // 4. ORDER EXECUTIONS (for completed orders)
    console.log('\n⚡ Creating order executions...');

    const completedOrders = orders.filter((o) => o.status === OrderStatus.completed);
    const executionRows = completedOrders.flatMap((order) => [
      {
        orderId: order.id,
        attemptNumber: 1,
        status: OrderStatus.completed,
        provider: ExecutionProvider.bitso,
        providerOrderId: `bitso-${order.idempotencyKey}-exec`,
        executedAmount: order.executedAmount,
        executedPrice: order.executedPrice,
        fees: order.fees,
        feeCurrency: order.feeCurrency,
        startedAt: subDays(new Date(), 1),
        completedAt: subDays(new Date(), 1),
        duration: Math.floor(Math.random() * 3000) + 500,
      },
    ]);

    // Add a failed attempt before a success for the DCA order
    executionRows.push({
      orderId: orders[4].id, // DCA BTC order
      attemptNumber: 1,
      status: OrderStatus.failed,
      provider: ExecutionProvider.bitso,
      providerOrderId: null,
      executedAmount: null,
      executedPrice: null,
      fees: null,
      feeCurrency: null,
      startedAt: subDays(new Date(), 8),
      completedAt: subDays(new Date(), 8),
      duration: 30000,
    });

    // Successful retry
    executionRows.push({
      orderId: orders[4].id,
      attemptNumber: 2,
      status: OrderStatus.completed,
      provider: ExecutionProvider.bitso,
      providerOrderId: `bitso-retry-${orders[4].idempotencyKey}`,
      executedAmount: orders[4].executedAmount,
      executedPrice: orders[4].executedPrice,
      fees: orders[4].fees,
      feeCurrency: orders[4].feeCurrency,
      startedAt: subDays(new Date(), 8),
      completedAt: subDays(new Date(), 8),
      duration: 1200,
    });

    await prisma.orderExecution.createMany({ data: executionRows });
    console.log(`  ✓ Created ${executionRows.length} order executions`);
  }

  // 5. EXECUTOR ASSIGNMENTS (Life Beat)
  console.log('\n🛡️ Creating executor assignments...');

  await prisma.executorAssignment.createMany({
    data: [
      {
        userId: ctx.guestUser.id,
        executorEmail: 'maria@dhanam.demo',
        executorName: 'Maria González',
        executorUserId: ctx.mariaUser.id,
        relationship: 'spouse',
        priority: 1,
        verified: true,
        verifiedAt: subDays(new Date(), 85),
        accessGranted: false,
      },
      {
        userId: ctx.guestUser.id,
        executorEmail: 'carlos@dhanam.demo',
        executorName: 'Carlos Mendoza',
        executorUserId: ctx.carlosUser.id,
        relationship: 'child',
        priority: 2,
        verified: true,
        verifiedAt: subDays(new Date(), 80),
        accessGranted: false,
      },
    ],
  });

  console.log('  ✓ Created 2 executor assignments');

  await seedCategoryCorrections(prisma, ctx);

  // 7. INACTIVITY ALERTS (Life Beat escalation demo)
  console.log('\n⏰ Creating inactivity alerts...');

  await prisma.inactivityAlert.createMany({
    data: [
      {
        userId: ctx.guestUser.id,
        alertLevel: 30,
        sentAt: subDays(new Date(), 35),
        channel: 'email',
        responded: true,
        respondedAt: subDays(new Date(), 34),
      },
      {
        userId: ctx.guestUser.id,
        alertLevel: 60,
        sentAt: subDays(new Date(), 5),
        channel: 'email',
        responded: false,
      },
      {
        userId: ctx.guestUser.id,
        alertLevel: 90,
        sentAt: new Date(),
        channel: 'sms',
        responded: false,
      },
    ],
  });

  console.log('  ✓ Created 3 inactivity alerts (30/60/90 day escalation)');

  // 8. ORDER LIMITS (Diego's crypto rate limits)
  console.log('\n🚦 Creating order limits...');

  await prisma.orderLimit.createMany({
    data: [
      {
        userId: ctx.diegoUser.id,
        spaceId: ctx.diegoSpace.id,
        limitType: 'daily',
        orderType: OrderType.buy,
        maxAmount: 5000,
        currency: Currency.USD,
        usedAmount: 1200,
        resetAt: addDays(new Date(), 1),
        notes: 'Daily buy limit for crypto purchases',
        enforced: true,
      },
      {
        userId: ctx.diegoUser.id,
        spaceId: ctx.diegoSpace.id,
        limitType: 'daily',
        orderType: OrderType.sell,
        maxAmount: 10000,
        currency: Currency.USD,
        usedAmount: 0,
        resetAt: addDays(new Date(), 1),
        notes: 'Daily sell limit for crypto sales',
        enforced: true,
      },
      {
        userId: ctx.diegoUser.id,
        spaceId: null,
        limitType: 'monthly',
        orderType: null,
        maxAmount: 50000,
        currency: Currency.USD,
        usedAmount: 8500,
        resetAt: addDays(new Date(), 15),
        notes: 'Global monthly trading limit across all spaces',
        enforced: true,
      },
    ],
  });

  console.log('  ✓ Created 3 order limits (daily buy/sell + monthly total)');
}
