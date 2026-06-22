import { PrismaService } from '../../../../core/prisma/prisma.service';
import { ProductCatalogService } from '../product-catalog.service';
import { PricingEngineService } from '../pricing-engine.service';

function makePrismaMock() {
  return {
    pricingRegion: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

function makeCatalogMock() {
  return {
    getProductBySlug: jest.fn().mockResolvedValue({
      slug: 'dhanam',
      name: 'Dhanam',
      description: 'AI-powered wealth tracking and personal finance for LATAM',
      category: 'finance',
      iconUrl: null,
      websiteUrl: 'https://app.dhan.am',
      tiers: [
        {
          tierSlug: 'essentials',
          dhanamTier: 'essentials',
          displayName: 'Essentials',
          description: null,
          metadata: null,
          prices: {
            USD: { monthly: 499, yearly: 4790 },
            MXN: { monthly: 7900, yearly: 75900 },
          },
          features: ['AI transaction categorization'],
        },
        {
          tierSlug: 'pro',
          dhanamTier: 'pro',
          displayName: 'Pro',
          description: null,
          metadata: null,
          prices: {
            USD: { monthly: 1499, yearly: 14388 },
            MXN: { monthly: 29900, yearly: 286800 },
          },
          features: ['Unlimited provider connections'],
        },
        {
          tierSlug: 'premium',
          dhanamTier: 'premium',
          displayName: 'Premium',
          description: null,
          metadata: null,
          prices: {
            USD: { monthly: 2999, yearly: 28788 },
            MXN: { monthly: 59900, yearly: 575200 },
          },
          features: ['Advanced analytics'],
        },
      ],
      creditCosts: [],
    }),
  };
}

describe('PricingEngineService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let catalog: ReturnType<typeof makeCatalogMock>;
  let service: PricingEngineService;

  beforeEach(() => {
    prisma = makePrismaMock();
    catalog = makeCatalogMock();
    prisma.pricingRegion.findFirst.mockResolvedValue(null);
    prisma.pricingRegion.findUnique.mockResolvedValue(null);
    service = new PricingEngineService(
      prisma as unknown as PrismaService,
      catalog as unknown as ProductCatalogService
    );
  });

  it('falls back to the static LATAM region when pricing-region seed data is absent', async () => {
    await expect(service.getRegionForCountry('MX')).resolves.toBe(3);
    await expect(service.getRegionForCountry('BR')).resolves.toBe(3);
  });

  it('uses Dhanam catalog MXN prices for Mexico instead of static promo constants', async () => {
    const pricing = await service.getPricingForCountry('MX');

    expect(pricing.region).toBe(3);
    expect(pricing.regionName).toBe('latam');
    expect(pricing.currency).toBe('MXN');
    expect(pricing.tiers.map((tier) => tier.monthlyPrice)).toEqual([92, 347, 695]);
    expect(pricing.tiers.map((tier) => tier.monthlyPriceNet)).toEqual([79, 299, 599]);
    expect(pricing.tiers.map((tier) => tier.monthlyPriceGross)).toEqual([92, 347, 695]);
    expect(pricing.tiers.map((tier) => tier.priceDisplayMode)).toEqual([
      'iva_inclusive_ceil',
      'iva_inclusive_ceil',
      'iva_inclusive_ceil',
    ]);
    expect(pricing.tiers.map((tier) => tier.promoPrice)).toEqual([null, null, null]);
    expect(pricing.tiers[1].features).toEqual(['Unlimited provider connections']);
  });

  it('falls back to USD catalog prices when no local catalog currency exists', async () => {
    const pricing = await service.getPricingForCountry('BR');

    expect(pricing.region).toBe(3);
    expect(pricing.currency).toBe('USD');
    expect(pricing.tiers.map((tier) => tier.monthlyPrice)).toEqual([4.99, 14.99, 29.99]);
  });

  it('uses seeded database regions when they exist', async () => {
    prisma.pricingRegion.findFirst.mockResolvedValue({ name: 'tier2' });

    await expect(service.getRegionForCountry('MX')).resolves.toBe(2);
  });
});
