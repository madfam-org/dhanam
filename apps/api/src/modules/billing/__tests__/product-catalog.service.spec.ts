import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { ProductCatalogService } from '../services/product-catalog.service';

describe('ProductCatalogService', () => {
  let service: ProductCatalogService;
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
