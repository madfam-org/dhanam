import { PrismaService } from '../../../../core/prisma/prisma.service';
import { PricingEngineService } from '../pricing-engine.service';

function makePrismaMock() {
  return {
    pricingRegion: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

describe('PricingEngineService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: PricingEngineService;

  beforeEach(() => {
    prisma = makePrismaMock();
    prisma.pricingRegion.findFirst.mockResolvedValue(null);
    prisma.pricingRegion.findUnique.mockResolvedValue(null);
    service = new PricingEngineService(prisma as unknown as PrismaService);
  });

  it('falls back to the static LATAM region when pricing-region seed data is absent', async () => {
    await expect(service.getRegionForCountry('MX')).resolves.toBe(3);
    await expect(service.getRegionForCountry('BR')).resolves.toBe(3);
  });

  it('keeps Mexico promo prices and MXN currency with static fallback regions', async () => {
    const pricing = await service.getPricingForCountry('MX');

    expect(pricing.region).toBe(3);
    expect(pricing.regionName).toBe('latam');
    expect(pricing.currency).toBe('MXN');
    expect(pricing.tiers.map((tier) => tier.promoPrice)).toEqual([31, 32, 33]);
  });

  it('uses seeded database regions when they exist', async () => {
    prisma.pricingRegion.findFirst.mockResolvedValue({ name: 'tier2' });

    await expect(service.getRegionForCountry('MX')).resolves.toBe(2);
  });
});
