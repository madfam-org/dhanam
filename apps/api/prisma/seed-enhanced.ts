import { PrismaClient } from '../generated/prisma';
import { seedUsers } from './seed/users';
import { seedTransactions } from './seed/transactions';
import { seedGoals } from './seed/goals';
import { seedHousehold } from './seed/household';
import { seedFeatures } from './seed/features';
import { seedMetadata } from './seed/metadata';
import { seedConnections } from './seed/connections';
import { seedAdvanced } from './seed/advanced';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting enhanced database seeding...');
  console.log('─────────────────────────────────────────');

  // 1. Foundation: users, spaces, accounts, budgets
  const ctx = await seedUsers(prisma);

  // 2. Transactions, ESG scores, valuations, rules, audit logs
  await seedTransactions(prisma, ctx);

  // 3. Goals, Monte Carlo data, collaboration, activities
  await seedGoals(prisma, ctx);

  // 4. Household, estate planning, will, beneficiaries
  await seedHousehold(prisma, ctx);

  // 5. Manual assets, PE cash flows, recurring, subscriptions, splits
  await seedFeatures(prisma, ctx);

  // 6. Exchange rates, income events, billing, usage, notifications
  await seedMetadata(prisma, ctx);

  // 7. Provider connections, health status, institution mappings
  await seedConnections(prisma, ctx);

  // 8. Simulations, sharing, orders, executors, corrections
  await seedAdvanced(prisma, ctx);

  console.log('\n✅ Enhanced seeding completed!');
  console.log('─────────────────────────────────────────');
  console.log('\n📊 Summary:');
  console.log('  - 1 Guest user (instant demo access)');
  console.log('  - 1 Individual user (Maria) with zero-based budgeting');
  console.log('  - 1 Small business owner (Carlos) with manual assets + collectibles');
  console.log(
    '  - 1 Enterprise admin (Patricia) with PE fund, real estate, insurance, 529, annuity'
  );
  console.log('  - 1 Web3/Metaverse user (Diego) with DeFi, DAO, L2, BTC, Decentraland, YGG');
  console.log('  - 1 Platform admin');
  console.log('  - 6 Spaces with budgets');
  console.log('  - 34 Connected accounts (incl. BTC, Decentraland, YGG, Arbitrum, Base)');
  console.log(
    '  - 23 Manual assets (real estate, insurance, 529, annuity, wine, classic car, PCGS coin, PSA card)'
  );
  console.log('  - 8 PE cash flows');
  console.log('  - 16 Recurring transactions');
  console.log('  - 10 Subscriptions');
  console.log('  - 6 Split transactions (12 splits)');
  console.log('  - 366 Exchange rates (61 days)');
  console.log('  - 6 Income events with 30 allocations');
  console.log('  - 4 Category goals');
  console.log('  - 3 Billing events');
  console.log('  - 20 Usage metrics');
  console.log('  - 39 Notifications (DeFi, ESG, Life Beat, executor, gaming, L2, budgets)');
  console.log('  - 26 ESG tokens for all crypto accounts');
  console.log('  - 2,000+ Transactions (incl. DeFi, L2, bridge, royalty, governance)');
  console.log('  - 1,500+ Asset valuations');
  console.log('  - 6 Connections + 12 attempts + 4 health statuses');
  console.log('  - 8 Institution-provider mappings');
  console.log('  - 7 Simulations (Monte Carlo, scenario, safe withdrawal, metaverse, P2E, risk)');
  console.log('  - 4 Account sharing permissions (Yours/Mine/Ours)');
  console.log('  - 6 Transaction orders + 4 executions');
  console.log('  - 2 Executor assignments (Life Beat)');
  console.log('  - 20+ Category corrections (AI feedback loop, all users)');
  console.log('  - 50+ Audit logs (all personas + admin operations)');
  console.log('  - Trust ownership (Patricia Vanguard)');
  console.log('  - Token vesting metadata (Diego UNI)');
  console.log('  - 4 Saved reports (monthly, quarterly, annual)');
  console.log('  - 3 Cashflow forecasts (8-week projections)');
  console.log('  - Household, estate planning, goals, rules');
  console.log('\n🎉 Demo environment ready!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
