import { PrismaClient } from '../../generated/prisma';
import { SeedContext } from './helpers';
import { seedManualAssets } from './features/manual-assets';
import { seedRecurringTransactions } from './features/recurring-transactions';
import { seedSubscriptions } from './features/subscriptions';
import { seedTransactionSplits } from './features/transaction-splits';

export async function seedFeatures(prisma: PrismaClient, ctx: SeedContext) {
  await seedManualAssets(prisma, ctx);
  await seedRecurringTransactions(prisma, ctx);
  await seedSubscriptions(prisma, ctx);
  await seedTransactionSplits(prisma, ctx);
}
