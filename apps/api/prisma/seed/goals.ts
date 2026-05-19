import { PrismaClient, Currency, GoalActivityAction } from '../../generated/prisma';
import { subDays } from 'date-fns';
import { SeedContext } from './helpers';

export async function seedGoals(prisma: PrismaClient, ctx: SeedContext) {
  console.log('\n🎯 Creating probabilistic goals with Monte Carlo simulations...');

  // --- Guest Goals ---
  const guestCheckingAccount = await prisma.account.findFirst({
    where: { spaceId: ctx.guestSpace.id, type: 'checking' },
  });
  const guestSavingsAccount = await prisma.account.findFirst({
    where: { spaceId: ctx.guestSpace.id, type: 'savings' },
  });

  if (guestCheckingAccount && guestSavingsAccount) {
    await Promise.all([
      // Goal 1: Retirement Fund
      prisma.goal.create({
        data: {
          spaceId: ctx.guestSpace.id,
          name: 'Retirement Fund',
          description: 'Build retirement nest egg for comfortable retirement at 65',
          type: 'retirement',
          targetAmount: 1000000,
          currency: Currency.MXN,
          targetDate: new Date('2045-12-31'),
          priority: 1,
          status: 'active',
          monthlyContribution: 5000,
          expectedReturn: 0.07,
          volatility: 0.15,
          currentProbability: 87.5,
          confidenceLow: 850000,
          confidenceHigh: 1250000,
          currentProgress: 15.2,
          projectedCompletion: new Date('2044-06-30'),
          lastSimulationAt: new Date(),
          probabilityHistory: [
            { date: subDays(new Date(), 90).toISOString(), probability: 82.1 },
            { date: subDays(new Date(), 60).toISOString(), probability: 84.3 },
            { date: subDays(new Date(), 30).toISOString(), probability: 86.0 },
            { date: new Date().toISOString(), probability: 87.5 },
          ],
          allocations: {
            create: [
              { accountId: guestSavingsAccount.id, percentage: 70 },
              { accountId: guestCheckingAccount.id, percentage: 30 },
            ],
          },
        },
      }),
      // Goal 2: Emergency Fund
      prisma.goal.create({
        data: {
          spaceId: ctx.guestSpace.id,
          name: 'Emergency Fund',
          description: '6 months of living expenses for financial security',
          type: 'emergency_fund',
          targetAmount: 90000,
          currency: Currency.MXN,
          targetDate: new Date('2025-12-31'),
          priority: 1,
          status: 'active',
          monthlyContribution: 3000,
          expectedReturn: 0.03,
          volatility: 0.02,
          currentProbability: 95.2,
          confidenceLow: 88000,
          confidenceHigh: 98000,
          currentProgress: 55.6,
          projectedCompletion: new Date('2025-08-15'),
          lastSimulationAt: new Date(),
          probabilityHistory: [
            { date: subDays(new Date(), 90).toISOString(), probability: 88.5 },
            { date: subDays(new Date(), 60).toISOString(), probability: 91.2 },
            { date: subDays(new Date(), 30).toISOString(), probability: 93.4 },
            { date: new Date().toISOString(), probability: 95.2 },
          ],
          allocations: {
            create: [{ accountId: guestSavingsAccount.id, percentage: 100 }],
          },
        },
      }),
      // Goal 3: House Down Payment
      prisma.goal.create({
        data: {
          spaceId: ctx.guestSpace.id,
          name: 'House Down Payment',
          description: '20% down payment for first home purchase',
          type: 'house_purchase',
          targetAmount: 300000,
          currency: Currency.MXN,
          targetDate: new Date('2027-06-30'),
          priority: 2,
          status: 'active',
          monthlyContribution: 4000,
          expectedReturn: 0.05,
          volatility: 0.1,
          currentProbability: 58.3,
          confidenceLow: 220000,
          confidenceHigh: 340000,
          currentProgress: 16.7,
          projectedCompletion: new Date('2028-03-15'),
          lastSimulationAt: new Date(),
          probabilityHistory: [
            { date: subDays(new Date(), 90).toISOString(), probability: 62.4 },
            { date: subDays(new Date(), 60).toISOString(), probability: 60.1 },
            { date: subDays(new Date(), 30).toISOString(), probability: 59.2 },
            { date: new Date().toISOString(), probability: 58.3 },
          ],
          allocations: {
            create: [
              { accountId: guestCheckingAccount.id, percentage: 60 },
              { accountId: guestSavingsAccount.id, percentage: 40 },
            ],
          },
        },
      }),
    ]);
  }

  // --- Maria's Goals ---
  const mariaCheckingAccount = await prisma.account.findFirst({
    where: { spaceId: ctx.mariaSpace.id, type: 'checking' },
  });
  const mariaSavingsAccount = await prisma.account.findFirst({
    where: { spaceId: ctx.mariaSpace.id, type: 'savings' },
  });

  if (mariaCheckingAccount && mariaSavingsAccount) {
    await Promise.all([
      prisma.goal.create({
        data: {
          spaceId: ctx.mariaSpace.id,
          name: "Children's Education Fund",
          description: 'University education fund for both children',
          type: 'education',
          targetAmount: 500000,
          currency: Currency.MXN,
          targetDate: new Date('2030-08-31'),
          priority: 1,
          status: 'active',
          monthlyContribution: 6000,
          expectedReturn: 0.06,
          volatility: 0.12,
          currentProbability: 73.8,
          confidenceLow: 420000,
          confidenceHigh: 580000,
          currentProgress: 24.0,
          projectedCompletion: new Date('2030-06-30'),
          lastSimulationAt: new Date(),
          probabilityHistory: [
            { date: subDays(new Date(), 90).toISOString(), probability: 71.2 },
            { date: subDays(new Date(), 60).toISOString(), probability: 72.5 },
            { date: subDays(new Date(), 30).toISOString(), probability: 73.1 },
            { date: new Date().toISOString(), probability: 73.8 },
          ],
          allocations: {
            create: [
              { accountId: mariaSavingsAccount.id, percentage: 80 },
              { accountId: mariaCheckingAccount.id, percentage: 20 },
            ],
          },
        },
      }),
      prisma.goal.create({
        data: {
          spaceId: ctx.mariaSpace.id,
          name: 'Family Trip to Europe',
          description: '15-day vacation across Europe for the whole family',
          type: 'travel',
          targetAmount: 120000,
          currency: Currency.MXN,
          targetDate: new Date('2025-07-15'),
          priority: 3,
          status: 'active',
          monthlyContribution: 5000,
          expectedReturn: 0.02,
          volatility: 0.01,
          currentProbability: 92.4,
          confidenceLow: 118000,
          confidenceHigh: 127000,
          currentProgress: 62.5,
          projectedCompletion: new Date('2025-06-01'),
          lastSimulationAt: new Date(),
          probabilityHistory: [
            { date: subDays(new Date(), 90).toISOString(), probability: 85.3 },
            { date: subDays(new Date(), 60).toISOString(), probability: 88.7 },
            { date: subDays(new Date(), 30).toISOString(), probability: 90.5 },
            { date: new Date().toISOString(), probability: 92.4 },
          ],
          allocations: {
            create: [{ accountId: mariaSavingsAccount.id, percentage: 100 }],
          },
        },
      }),
    ]);
  }

  // --- Carlos: Business Expansion Goal ---
  const carlosInvestmentAccount = await prisma.account.findFirst({
    where: { spaceId: ctx.carlosPersonal.id, type: 'investment' },
  });

  if (carlosInvestmentAccount) {
    await prisma.goal.create({
      data: {
        spaceId: ctx.carlosPersonal.id,
        name: 'Second Restaurant Location',
        description: 'Capital for opening second Tacos El Patrón location',
        type: 'business',
        targetAmount: 1500000,
        currency: Currency.MXN,
        targetDate: new Date('2026-03-31'),
        priority: 1,
        status: 'active',
        monthlyContribution: 25000,
        expectedReturn: 0.08,
        volatility: 0.18,
        currentProbability: 65.7,
        confidenceLow: 1100000,
        confidenceHigh: 1650000,
        currentProgress: 30.0,
        projectedCompletion: new Date('2026-05-15'),
        lastSimulationAt: new Date(),
        probabilityHistory: [
          { date: subDays(new Date(), 90).toISOString(), probability: 61.2 },
          { date: subDays(new Date(), 60).toISOString(), probability: 63.4 },
          { date: subDays(new Date(), 30).toISOString(), probability: 64.5 },
          { date: new Date().toISOString(), probability: 65.7 },
        ],
        allocations: {
          create: [{ accountId: carlosInvestmentAccount.id, percentage: 100 }],
        },
      },
    });
  }

  // --- Goal Collaboration ---
  console.log('\n🤝 Creating goal collaboration data...');

  const mariaEducationGoal = await prisma.goal.findFirst({
    where: { spaceId: ctx.mariaSpace.id, name: "Children's Education Fund" },
  });
  const guestRetirementGoal = await prisma.goal.findFirst({
    where: { spaceId: ctx.guestSpace.id, name: 'Retirement Fund' },
  });

  if (mariaEducationGoal) {
    await prisma.goal.update({
      where: { id: mariaEducationGoal.id },
      data: {
        createdBy: ctx.mariaUser.id,
        isShared: true,
        sharedWithMessage:
          "Let's track our children's education fund together! Feel free to view progress and suggest adjustments.",
      },
    });

    const educationShare = await prisma.goalShare.create({
      data: {
        goalId: mariaEducationGoal.id,
        sharedWith: ctx.guestUser.id,
        role: 'viewer',
        invitedBy: ctx.mariaUser.id,
        status: 'accepted',
        message:
          "Let's track our children's education fund together! Feel free to view progress and suggest adjustments.",
        acceptedAt: subDays(new Date(), 5),
        createdAt: subDays(new Date(), 7),
      },
    });

    await prisma.goalActivity.createMany({
      data: [
        {
          goalId: mariaEducationGoal.id,
          userId: ctx.mariaUser.id,
          action: GoalActivityAction.created,
          metadata: { initialAmount: 500000, targetDate: '2032-08-31' },
          createdAt: subDays(new Date(), 120),
        },
        {
          goalId: mariaEducationGoal.id,
          userId: ctx.mariaUser.id,
          action: GoalActivityAction.shared,
          metadata: { sharedWith: 'guest@dhanam.demo', role: 'viewer' },
          createdAt: subDays(new Date(), 7),
        },
        {
          goalId: mariaEducationGoal.id,
          userId: ctx.guestUser.id,
          action: GoalActivityAction.share_accepted,
          metadata: { shareId: educationShare.id },
          createdAt: subDays(new Date(), 5),
        },
        {
          goalId: mariaEducationGoal.id,
          userId: ctx.mariaUser.id,
          action: GoalActivityAction.contribution_added,
          metadata: { amount: 6500, account: 'BBVA Savings' },
          createdAt: subDays(new Date(), 3),
        },
        {
          goalId: mariaEducationGoal.id,
          userId: ctx.mariaUser.id,
          action: GoalActivityAction.probability_improved,
          metadata: { oldProbability: 89.2, newProbability: 91.5 },
          createdAt: subDays(new Date(), 1),
        },
      ],
    });

    console.log(`  ✓ Maria shared Education Fund with Guest (viewer role)`);
  }

  if (guestRetirementGoal) {
    await prisma.goal.update({
      where: { id: guestRetirementGoal.id },
      data: { createdBy: ctx.guestUser.id },
    });

    await prisma.goalActivity.createMany({
      data: [
        {
          goalId: guestRetirementGoal.id,
          userId: ctx.guestUser.id,
          action: GoalActivityAction.created,
          metadata: { initialAmount: 1000000, targetDate: '2045-12-31' },
          createdAt: subDays(new Date(), 180),
        },
        {
          goalId: guestRetirementGoal.id,
          userId: ctx.guestUser.id,
          action: GoalActivityAction.updated,
          metadata: { field: 'monthlyContribution', oldValue: 4000, newValue: 5000 },
          createdAt: subDays(new Date(), 60),
        },
        {
          goalId: guestRetirementGoal.id,
          userId: ctx.guestUser.id,
          action: GoalActivityAction.milestone_reached,
          metadata: { milestone: '15% Complete' },
          createdAt: subDays(new Date(), 30),
        },
        {
          goalId: guestRetirementGoal.id,
          userId: ctx.guestUser.id,
          action: GoalActivityAction.probability_improved,
          metadata: { oldProbability: 84.3, newProbability: 87.5 },
          createdAt: subDays(new Date(), 2),
        },
      ],
    });

    console.log(`  ✓ Created activity history for Guest's Retirement Fund`);
  }
}
