import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { ProductCatalogService } from '../services/product-catalog.service';

describe('ProductCatalogService', () => {
  let service: ProductCatalogService;
  const originalCatalogSource = process.env.DHANAM_PUBLIC_CATALOG_SOURCE;
  let prisma: {
    product: { findMany: jest.Mock; findUnique: jest.Mock; upsert: jest.Mock; update: jest.Mock };
    productTier: { upsert: jest.Mock };
    productPrice: { upsert: jest.Mock };
    productFeature: { upsert: jest.Mock };
    productCreditCost: { findMany: jest.Mock; findFirst: jest.Mock; upsert: jest.Mock };
  };

  const mockProduct = {
    id: 'prod-1',
    slug: 'karafiel',
    name: 'Karafiel',
    description: 'Combat Accounting',
    category: 'compliance',
    active: true,
    sortOrder: 2,
    iconUrl: null,
    websiteUrl: 'https://karafiel.mx',
    stripeProductId: 'prod_stripe_123',
    metadata: null,
    tiers: [
      {
        tierSlug: 'contador',
        dhanamTier: 'essentials',
        displayName: 'Contador',
        description: null,
        metadata: { rfc_limit: 10 },
        sortOrder: 0,
      },
      {
        tierSlug: 'firma',
        dhanamTier: 'premium',
        displayName: 'Firma',
        description: null,
        metadata: { rfc_limit: 9999 },
        sortOrder: 1,
      },
    ],
    prices: [
      {
        id: 'price-1',
        tierSlug: 'contador',
        dhanamTier: 'essentials',
        currency: 'MXN',
        interval: 'monthly',
        amountCents: 129900,
        status: 'active',
        stripePriceId: 'price_stripe_456',
        displayName: 'Contador',
        description: null,
        metadata: { rfc_limit: 10 },
      },
      {
        id: 'price-2',
        tierSlug: 'contador',
        dhanamTier: 'essentials',
        currency: 'MXN',
        interval: 'yearly',
        amountCents: 99900,
        status: 'active',
        stripePriceId: 'price_stripe_789',
        displayName: 'Contador',
        description: null,
        metadata: { rfc_limit: 10 },
      },
    ],
    features: [
      {
        tierSlug: 'contador',
        feature: 'cfdi_download',
        label: 'Descarga masiva CFDI',
        sortOrder: 0,
      },
      { tierSlug: 'contador', feature: 'annex24', label: 'Contabilidad electronica', sortOrder: 1 },
    ],
    creditCosts: [
      { operation: 'cfdi_stamp', credits: 1, label: 'CFDI Stamp' },
      { operation: 'filing', credits: 5, label: 'Filing' },
    ],
  };

  beforeEach(async () => {
    process.env.DHANAM_PUBLIC_CATALOG_SOURCE = 'db';
    prisma = {
      product: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      productTier: { upsert: jest.fn() },
      productPrice: { upsert: jest.fn() },
      productFeature: { upsert: jest.fn() },
      productCreditCost: { findMany: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductCatalogService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ProductCatalogService);
  });

  afterAll(() => {
    if (originalCatalogSource === undefined) {
      delete process.env.DHANAM_PUBLIC_CATALOG_SOURCE;
    } else {
      process.env.DHANAM_PUBLIC_CATALOG_SOURCE = originalCatalogSource;
    }
  });

  describe('getFullCatalog', () => {
    it('should return all active products with tiers, prices, features, and credit costs', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);

      const catalog = await service.getFullCatalog();

      expect(catalog).toHaveLength(1);
      expect(catalog[0].slug).toBe('karafiel');
      expect(catalog[0].name).toBe('Karafiel');
      expect(catalog[0].tiers).toHaveLength(2); // priced tier + custom tier without prices
      expect(catalog[0].tiers[0].tierSlug).toBe('contador');
      expect(catalog[0].tiers[0].prices['MXN'].monthly).toBe(129900);
      expect(catalog[0].tiers[0].prices['MXN'].yearly).toBe(99900);
      expect(catalog[0].tiers[0].features).toHaveLength(2);
      expect(catalog[0].tiers[1]).toMatchObject({
        tierSlug: 'firma',
        displayName: 'Firma',
        prices: {},
      });
      expect(catalog[0].creditCosts).toHaveLength(2);
      expect(catalog[0].creditCosts[0]).toEqual({
        operation: 'cfdi_stamp',
        credits: 1,
        label: 'CFDI Stamp',
      });
    });

    it('should cache results for 5 minutes', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);

      await service.getFullCatalog();
      await service.getFullCatalog();

      expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
    });

    it('should serve catalog.yaml when file source is enabled', async () => {
      process.env.DHANAM_PUBLIC_CATALOG_SOURCE = 'file';

      const catalog = await service.getFullCatalog();

      expect(catalog).toHaveLength(27);
      expect(catalog.find((product) => product.slug === 'enclii')).toBeDefined();
      expect(catalog.find((product) => product.slug === 'voxa')).toBeDefined();
      expect(catalog.find((product) => product.slug === 'dhanam')?.tiers).toHaveLength(3);
      expect(catalog.find((product) => product.slug === 'primavera3d')).toBeUndefined();
      expect(catalog.find((product) => product.slug === 'sim4d')).toBeUndefined();
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('should expose only current Janua tiers from catalog.yaml', async () => {
      process.env.DHANAM_PUBLIC_CATALOG_SOURCE = 'file';

      const catalog = await service.getFullCatalog();
      const janua = catalog.find((product) => product.slug === 'janua');

      expect(janua?.tiers.map((tier) => tier.tierSlug)).toEqual(['open_source']);
      expect(janua?.tiers[0].features).toEqual([
        'Self-hosted OAuth2/OIDC provider',
        'RS256 JWT/JWKS support',
        'SAML, MFA, passkeys, and RBAC primitives',
        'SDKs and migration tooling',
      ]);
      expect(janua?.tiers[0].metadata).toMatchObject({
        launch_scope: 'current',
      });
    });
  });

  describe('getProductBySlug', () => {
    it('should return a single product', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      const product = await service.getProductBySlug('karafiel');

      expect(product.slug).toBe('karafiel');
      expect(product.websiteUrl).toBe('https://karafiel.mx');
    });

    it('should throw NotFoundException for unknown slug', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.getProductBySlug('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return a single product from catalog.yaml when file source is enabled', async () => {
      process.env.DHANAM_PUBLIC_CATALOG_SOURCE = 'file';

      const product = await service.getProductBySlug('enclii');

      expect(product.slug).toBe('enclii');
      expect(product.tiers.length).toBeGreaterThan(0);
      expect(prisma.product.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getCreditCosts', () => {
    it('should return credit costs for a product', async () => {
      prisma.productCreditCost.findMany.mockResolvedValue([
        { operation: 'cfdi_stamp', credits: 1, label: 'CFDI Stamp' },
        { operation: 'filing', credits: 5, label: 'Filing' },
      ]);

      const costs = await service.getCreditCosts('karafiel');

      expect(costs).toHaveLength(2);
      expect(costs[0]).toEqual({ operation: 'cfdi_stamp', credits: 1, label: 'CFDI Stamp' });
      expect(costs[1]).toEqual({ operation: 'filing', credits: 5, label: 'Filing' });
    });

    it('should return credit costs from catalog.yaml when file source is enabled', async () => {
      process.env.DHANAM_PUBLIC_CATALOG_SOURCE = 'file';

      const costs = await service.getCreditCosts('dhanam');

      expect(costs.find((cost) => cost.operation === 'api_request')?.credits).toBe(1);
      expect(prisma.productCreditCost.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getCreditCostForOperation', () => {
    it('should return the credit cost for a specific operation', async () => {
      prisma.productCreditCost.findFirst.mockResolvedValue({ credits: 5 });

      const cost = await service.getCreditCostForOperation('karafiel', 'filing');

      expect(cost).toBe(5);
    });

    it('should return null for unknown operation', async () => {
      prisma.productCreditCost.findFirst.mockResolvedValue(null);

      const cost = await service.getCreditCostForOperation('karafiel', 'unknown');

      expect(cost).toBeNull();
    });
  });

  describe('upsertProduct', () => {
    it('should upsert and invalidate cache', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.product.upsert.mockResolvedValue({ id: 'prod-1', slug: 'karafiel' });

      // Warm cache
      await service.getFullCatalog();
      expect(prisma.product.findMany).toHaveBeenCalledTimes(1);

      // Upsert should invalidate cache
      await service.upsertProduct({ slug: 'karafiel', name: 'Karafiel Updated' });

      // Next call should hit DB again
      await service.getFullCatalog();
      expect(prisma.product.findMany).toHaveBeenCalledTimes(2);
    });
  });
});
