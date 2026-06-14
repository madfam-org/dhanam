import { subDays } from 'date-fns';

import { Currency, ManualAssetType, Prisma } from '@db';

import { PrismaService } from '../../prisma/prisma.service';

import { DemoContext } from './types';

interface AssetDef {
  spaceId: string;
  name: string;
  type: ManualAssetType;
  description: string;
  currentValue: number;
  currency: Currency;
  acquisitionDate: Date;
  acquisitionCost: number;
  metadata?: Prisma.InputJsonValue;
}

export class AssetsBuilder {
  constructor(private prisma: PrismaService) {}

  async build(ctx: DemoContext): Promise<void> {
    const assets = this.getAssetsForPersona(ctx);
    if (assets.length === 0) return;

    for (const def of assets) {
      const asset = await this.prisma.manualAsset.create({
        data: {
          spaceId: def.spaceId,
          name: def.name,
          type: def.type,
          description: def.description,
          currentValue: def.currentValue,
          currency: def.currency,
          acquisitionDate: def.acquisitionDate,
          acquisitionCost: def.acquisitionCost,
          metadata: def.metadata ?? Prisma.JsonNull,
        },
      });

      // 9 weekly valuation snapshots
      const valuations: Prisma.ManualAssetValuationCreateManyInput[] = [];
      let val = def.acquisitionCost;
      const step = (def.currentValue - def.acquisitionCost) / 9;
      for (let w = 8; w >= 0; w--) {
        val += step + (Math.random() - 0.5) * step * 0.3;
        valuations.push({
          assetId: asset.id,
          date: subDays(new Date(), w * 7),
          value: Math.round(val * 100) / 100,
          currency: def.currency,
          source: 'Demo Valuation',
        });
      }
      await this.prisma.manualAssetValuation.createMany({ data: valuations });

      // Add PE cash flows for Patricia's Sequoia fund
      if (def.type === 'private_equity' && ctx.personaKey === 'patricia') {
        await this.prisma.privateEquityCashFlow.createMany({
          data: [
            {
              assetId: asset.id,
              type: 'capital_call',
              amount: -50000,
              currency: Currency.USD,
              date: new Date('2021-01-15'),
              description: 'Initial capital call',
              notes: 'Fund XIV — first call',
            },
            {
              assetId: asset.id,
              type: 'management_fee',
              amount: -1000,
              currency: Currency.USD,
              date: new Date('2021-06-30'),
              description: 'Q2 2021 management fee',
            },
            {
              assetId: asset.id,
              type: 'management_fee',
              amount: -1000,
              currency: Currency.USD,
              date: new Date('2021-12-31'),
              description: 'Q4 2021 management fee',
            },
            {
              assetId: asset.id,
              type: 'management_fee',
              amount: -1000,
              currency: Currency.USD,
              date: new Date('2022-06-30'),
              description: 'Q2 2022 management fee',
            },
            {
              assetId: asset.id,
              type: 'management_fee',
              amount: -1000,
              currency: Currency.USD,
              date: new Date('2022-12-31'),
              description: 'Q4 2022 management fee',
            },
            {
              assetId: asset.id,
              type: 'distribution',
              amount: 8500,
              currency: Currency.USD,
              date: new Date('2024-06-15'),
              description: 'Portfolio company exit — partial distribution',
              notes: 'Stripe secondary sale proceeds',
            },
            {
              assetId: asset.id,
              type: 'distribution',
              amount: 12000,
              currency: Currency.USD,
              date: new Date('2025-01-15'),
              description: 'Annual distribution',
              notes: 'Fund performance distribution',
            },
          ],
        });
      }
    }
  }

  private getAssetsForPersona(ctx: DemoContext): AssetDef[] {
    const personal = ctx.spaces.find((s) => s.type === 'personal');
    const business = ctx.spaces.find((s) => s.type === 'business');
    const pId = personal?.id ?? ctx.spaces[0]?.id;
    if (!pId) return [];

    switch (ctx.personaKey) {
      case 'guest':
        return []; // Lightweight preview

      case 'maria':
        return [
          {
            spaceId: pId,
            name: 'Nike Air Force 1 Low',
            type: 'collectible',
            description: 'Limited edition Travis Scott AF1 (deadstock)',
            currentValue: 4500,
            currency: Currency.MXN,
            acquisitionDate: new Date('2024-06-15'),
            acquisitionCost: 3200,
            metadata: {
              category: 'sneakers',
              manufacturer: 'Nike',
              year: 2024,
              condition: 'deadstock',
            },
          },
        ];

      case 'carlos':
        return [
          {
            spaceId: pId,
            name: 'Condo in Guadalajara',
            type: 'real_estate',
            description: '3BR/2BA condo in Providencia, Guadalajara',
            currentValue: 4200000,
            currency: Currency.MXN,
            acquisitionDate: new Date('2019-03-01'),
            acquisitionCost: 3100000,
            metadata: {
              address: 'Av. Providencia 1234',
              city: 'Guadalajara',
              state: 'Jalisco',
              sqft: 1400,
              bedrooms: 3,
              bathrooms: 2,
            },
          },
          {
            spaceId: pId,
            name: 'Tesla Model 3',
            type: 'vehicle',
            description: '2023 Tesla Model 3 Long Range',
            currentValue: 620000,
            currency: Currency.MXN,
            acquisitionDate: new Date('2023-08-15'),
            acquisitionCost: 780000,
            metadata: { make: 'Tesla', model: 'Model 3 Long Range', year: 2023, mileage: 28000 },
          },
          {
            spaceId: pId,
            name: 'Rolex Submariner',
            type: 'collectible',
            description: 'Rolex Submariner Date ref. 126610LN',
            currentValue: 8500,
            currency: Currency.USD,
            acquisitionDate: new Date('2022-01-10'),
            acquisitionCost: 9500,
            metadata: {
              category: 'watches',
              manufacturer: 'Rolex',
              year: 2021,
              condition: 'excellent',
            },
          },
          {
            spaceId: pId,
            name: 'Wine Collection',
            type: 'collectible',
            description: '42 bottles — Mexican and international wines',
            currentValue: 45000,
            currency: Currency.MXN,
            acquisitionDate: new Date('2020-06-01'),
            acquisitionCost: 28000,
            metadata: { category: 'wine', bottles: 42, region: 'Baja California / Bordeaux' },
          },
        ];

      case 'patricia': {
        const sId = business?.id ?? pId;
        return [
          {
            spaceId: sId,
            name: 'Polanco Penthouse',
            type: 'real_estate',
            description: 'Luxury penthouse in Polanco, CDMX',
            currentValue: 450000,
            currency: Currency.USD,
            acquisitionDate: new Date('2018-05-01'),
            acquisitionCost: 320000,
            metadata: {
              address: 'Campos Eliseos 204 PH',
              city: 'CDMX',
              sqft: 3200,
              bedrooms: 4,
              bathrooms: 3,
            },
          },
          {
            spaceId: sId,
            name: 'Sequoia Capital Fund XIV',
            type: 'private_equity',
            description: 'LP stake in Sequoia Capital Growth Fund',
            currentValue: 50000,
            currency: Currency.USD,
            acquisitionDate: new Date('2021-01-15'),
            acquisitionCost: 50000,
            metadata: {
              companyName: 'Sequoia Capital',
              investmentDate: '2021-01-15',
              ownershipPercentage: 0.001,
            },
          },
          {
            spaceId: sId,
            name: 'Frida Kahlo Lithograph',
            type: 'art',
            description: 'Signed lithograph "Autorretrato con collar de espinas" 1940 edition',
            currentValue: 180000,
            currency: Currency.MXN,
            acquisitionDate: new Date('2020-11-20'),
            acquisitionCost: 120000,
            metadata: {
              artist: 'Frida Kahlo',
              year: 1940,
              medium: 'lithograph',
              authenticated: true,
            },
          },
          {
            spaceId: sId,
            name: 'Tiffany Diamond Collection',
            type: 'jewelry',
            description: 'Tiffany & Co. diamond necklace and earring set',
            currentValue: 25000,
            currency: Currency.USD,
            acquisitionDate: new Date('2019-12-25'),
            acquisitionCost: 22000,
            metadata: { brand: 'Tiffany & Co.', material: 'platinum, diamond', carats: 3.5 },
          },
        ];
      }

      case 'diego':
        return [
          {
            spaceId: pId,
            name: 'Sandbox LAND x3',
            type: 'collectible',
            description: '3 adjacent LAND parcels in The Sandbox metaverse',
            currentValue: 7200,
            currency: Currency.USD,
            acquisitionDate: new Date('2023-02-01'),
            acquisitionCost: 12000,
            metadata: {
              category: 'virtual_land',
              platform: 'The Sandbox',
              parcels: 3,
              coordinates: '(-12,5), (-11,5), (-12,6)',
            },
          },
          {
            spaceId: pId,
            name: 'Bored Ape #4821',
            type: 'collectible',
            description: 'BAYC NFT #4821 — gold fur, laser eyes',
            currentValue: 18500,
            currency: Currency.USD,
            acquisitionDate: new Date('2022-08-10'),
            acquisitionCost: 42000,
            metadata: {
              category: 'nft',
              collection: 'BAYC',
              tokenId: 4821,
              traits: { fur: 'gold', eyes: 'laser' },
            },
          },
          {
            spaceId: pId,
            name: 'ENS Domain: diego.eth',
            type: 'domain',
            description: '5-letter .eth ENS domain',
            currentValue: 3200,
            currency: Currency.USD,
            acquisitionDate: new Date('2022-03-15'),
            acquisitionCost: 800,
            metadata: { domain: 'diego.eth', registrar: 'ENS', expiryDate: '2027-03-15' },
          },
          {
            spaceId: pId,
            name: 'PSA 10 Charizard 1st Edition',
            type: 'collectible',
            description: 'PSA 10 Base Set 1st Edition Charizard Holo',
            currentValue: 350000,
            currency: Currency.USD,
            acquisitionDate: new Date('2021-04-20'),
            acquisitionCost: 280000,
            metadata: {
              category: 'trading_cards',
              grader: 'PSA',
              grade: 10,
              set: 'Base Set 1st Edition',
              year: 1999,
            },
          },
        ];

      default:
        return [];
    }
  }
}
