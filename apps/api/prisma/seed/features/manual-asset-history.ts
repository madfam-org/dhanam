import { PrismaClient, Currency, type ManualAsset } from '../../../generated/prisma';
import { subDays } from 'date-fns';

export async function seedManualAssetHistory(
  prisma: PrismaClient,
  patriciaPE: ManualAsset,
  allManualAssets: ManualAsset[]
) {
  // Batch valuation history for all manual assets
  const valuationRows: Array<{
    assetId: string;
    date: Date;
    value: number;
    currency: Currency;
    source: string;
  }> = [];

  for (const asset of allManualAssets) {
    for (let week = 8; week >= 0; week--) {
      const date = subDays(new Date(), week * 7);
      const variation = (Math.random() - 0.5) * 0.04;
      valuationRows.push({
        assetId: asset.id,
        date,
        value: Number(asset.currentValue) * (1 + variation),
        currency: asset.currency,
        source: asset.type === 'real_estate' ? 'zillow_api' : 'Manual Entry',
      });
    }
  }
  await prisma.manualAssetValuation.createMany({ data: valuationRows });

  // PE Cash Flows (batch)
  await prisma.privateEquityCashFlow.createMany({
    data: [
      {
        assetId: patriciaPE.id,
        type: 'capital_call',
        amount: -15000,
        currency: Currency.USD,
        date: new Date('2021-09-15'),
        description: 'Initial capital call',
      },
      {
        assetId: patriciaPE.id,
        type: 'capital_call',
        amount: -20000,
        currency: Currency.USD,
        date: new Date('2022-03-01'),
        description: 'Second capital call',
      },
      {
        assetId: patriciaPE.id,
        type: 'capital_call',
        amount: -15000,
        currency: Currency.USD,
        date: new Date('2022-09-01'),
        description: 'Final capital call',
      },
      {
        assetId: patriciaPE.id,
        type: 'management_fee',
        amount: -1000,
        currency: Currency.USD,
        date: new Date('2023-01-15'),
        description: '2023 management fee',
      },
      {
        assetId: patriciaPE.id,
        type: 'distribution',
        amount: 8000,
        currency: Currency.USD,
        date: new Date('2023-06-30'),
        description: 'Q2 2023 distribution',
      },
      {
        assetId: patriciaPE.id,
        type: 'management_fee',
        amount: -1000,
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: '2024 management fee',
      },
      {
        assetId: patriciaPE.id,
        type: 'distribution',
        amount: 12000,
        currency: Currency.USD,
        date: new Date('2024-06-30'),
        description: 'Q2 2024 distribution',
      },
      {
        assetId: patriciaPE.id,
        type: 'distribution',
        amount: 5000,
        currency: Currency.USD,
        date: new Date('2024-12-31'),
        description: 'Q4 2024 distribution',
      },
    ],
  });

  console.log('  ✓ Created 23 manual assets with valuation history');
  console.log('  ✓ Created 8 PE cash flows for Sequoia fund');
}
