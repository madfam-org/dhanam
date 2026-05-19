import { PrismaClient } from '../../../generated/prisma';
import { SeedContext } from '../helpers';
import { createManualAssetRecords } from './manual-asset-records';
import { seedManualAssetHistory } from './manual-asset-history';

export async function seedManualAssets(prisma: PrismaClient, ctx: SeedContext) {
  const { patriciaPE, allManualAssets } = await createManualAssetRecords(prisma, ctx);
  await seedManualAssetHistory(prisma, patriciaPE, allManualAssets);
}
