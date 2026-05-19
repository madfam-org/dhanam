import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../core/prisma/prisma.service';
import { RedisService } from '../../core/redis/redis.service';

import { ArtsyAdapter } from './adapters/artsy.adapter';
import { HagertyAdapter } from './adapters/hagerty.adapter';
import { KicksDbAdapter } from './adapters/kicksdb.adapter';
import { PcgsAdapter } from './adapters/pcgs.adapter';
import { PsaAdapter } from './adapters/psa.adapter';
import { WatchChartsAdapter } from './adapters/watchcharts.adapter';
import { WineSearcherAdapter } from './adapters/wine-searcher.adapter';
import { CollectiblesValuationService } from './collectibles-valuation.service';
import type { CatalogItem, ValuationResult } from './interfaces/collectible-provider.interface';

describe('CollectiblesValuationService', () => {
  let service: CollectiblesValuationService;

  const mockPrisma = {
    manualAsset: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    manualAssetValuation: {
      upsert: jest.fn(),
    },
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const makeMockAdapter = (provider: string, category: string, available = false) => ({
    provider,
    category,
    supportedCurrencies: ['USD'],
    isAvailable: jest.fn().mockReturnValue(available),
    search: jest.fn(),
    getValuation: jest.fn(),
    healthCheck: jest.fn(),
  });

  const mockArtsy = makeMockAdapter('artsy', 'art');
  const mockWatchCharts = makeMockAdapter('watchcharts', 'watch');
  const mockWineSearcher = makeMockAdapter('wine-searcher', 'wine');
  const mockPcgs = makeMockAdapter('pcgs', 'coin');
  const mockPsa = makeMockAdapter('psa', 'trading_card');
  const mockHagerty = makeMockAdapter('hagerty', 'classic_car');
  const mockKicksDb = makeMockAdapter('kicksdb', 'sneaker', true);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectiblesValuationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: ArtsyAdapter, useValue: mockArtsy },
        { provide: WatchChartsAdapter, useValue: mockWatchCharts },
        { provide: WineSearcherAdapter, useValue: mockWineSearcher },
        { provide: PcgsAdapter, useValue: mockPcgs },
        { provide: PsaAdapter, useValue: mockPsa },
        { provide: HagertyAdapter, useValue: mockHagerty },
        { provide: KicksDbAdapter, useValue: mockKicksDb },
      ],
    }).compile();

    service = module.get(CollectiblesValuationService);
    jest.clearAllMocks();
  });

  describe('search', () => {
    const mockResults: CatalogItem[] = [
      {
        externalId: 'CW2288-111',
        provider: 'kicksdb',
        category: 'sneaker',
        name: 'Air Jordan 1 Chicago',
        currency: 'USD',
        currentMarketValue: 320,
      },
    ];

    it('should delegate to the correct adapter by category', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockKicksDb.search.mockResolvedValue(mockResults);

      const result = await service.search('sneaker', 'jordan', 10);

      expect(mockKicksDb.search).toHaveBeenCalledWith('jordan', 10);
      expect(result).toEqual(mockResults);
    });

    it('should return cached results on cache hit', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockResults));

      const result = await service.search('sneaker', 'jordan', 10);

      expect(result).toEqual(mockResults);
      expect(mockKicksDb.search).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown category', async () => {
      await expect(service.search('unknown_category' as any, 'query', 10)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getValuation', () => {
    it('should delegate to the correct adapter', async () => {
      const mockVal: ValuationResult = {
        externalId: 'CW2288-111',
        provider: 'kicksdb',
        marketValue: 320,
        currency: 'USD',
        source: 'kicksdb',
        fetchedAt: new Date(),
      };
      mockKicksDb.getValuation.mockResolvedValue(mockVal);

      const result = await service.getValuation('sneaker', 'CW2288-111');

      expect(mockKicksDb.getValuation).toHaveBeenCalledWith('CW2288-111');
      expect(result).toEqual(mockVal);
    });
  });

  describe('linkAsset', () => {
    const spaceId = 'space-1';
    const assetId = 'asset-1';

    it('should update metadata with collectible info and refresh', async () => {
      mockPrisma.manualAsset.findFirst.mockResolvedValue({
        id: assetId,
        spaceId,
        metadata: {},
        currentValue: 100,
        currency: 'USD',
      });
      mockPrisma.manualAsset.update.mockResolvedValue({});
      // refreshAsset will call findFirst again
      mockPrisma.manualAsset.findFirst.mockResolvedValueOnce({
        id: assetId,
        spaceId,
        metadata: {},
      });
      mockKicksDb.getValuation.mockResolvedValue(null);

      await service.linkAsset(spaceId, assetId, 'CW2288-111', 'kicksdb', 'sneaker');

      expect(mockPrisma.manualAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: assetId },
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              collectible: expect.objectContaining({
                category: 'sneaker',
                provider: 'kicksdb',
                externalId: 'CW2288-111',
                valuationEnabled: true,
              }),
            }),
          }),
        })
      );
    });

    it('should throw NotFoundException when asset does not exist', async () => {
      mockPrisma.manualAsset.findFirst.mockResolvedValue(null);

      await expect(
        service.linkAsset(spaceId, assetId, 'CW2288-111', 'kicksdb', 'sneaker')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unlinkAsset', () => {
    const spaceId = 'space-1';
    const assetId = 'asset-1';

    it('should remove collectible metadata from asset', async () => {
      mockPrisma.manualAsset.findFirst.mockResolvedValue({
        id: assetId,
        spaceId,
        metadata: {
          collectible: {
            category: 'sneaker',
            provider: 'kicksdb',
            externalId: 'X',
            valuationEnabled: true,
          },
          otherField: 'keep',
        },
      });
      mockPrisma.manualAsset.update.mockResolvedValue({});

      await service.unlinkAsset(spaceId, assetId);

      expect(mockPrisma.manualAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: assetId },
          data: expect.objectContaining({
            metadata: expect.objectContaining({ otherField: 'keep' }),
          }),
        })
      );
      // Ensure collectible key is removed
      const callData = mockPrisma.manualAsset.update.mock.calls[0][0].data.metadata;
      expect(callData).not.toHaveProperty('collectible');
    });

    it('should throw NotFoundException when asset does not exist', async () => {
      mockPrisma.manualAsset.findFirst.mockResolvedValue(null);

      await expect(service.unlinkAsset(spaceId, assetId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('refreshAsset', () => {
    const spaceId = 'space-1';
    const assetId = 'asset-1';

    it('should fetch valuation and update currentValue', async () => {
      mockPrisma.manualAsset.findFirst.mockResolvedValue({
        id: assetId,
        spaceId,
        currentValue: 300,
        currency: 'USD',
        metadata: {
          collectible: {
            category: 'sneaker',
            provider: 'kicksdb',
            externalId: 'CW2288-111',
            valuationEnabled: true,
          },
        },
      });
      mockKicksDb.getValuation.mockResolvedValue({
        externalId: 'CW2288-111',
        provider: 'kicksdb',
        marketValue: 350,
        currency: 'USD',
        source: 'kicksdb',
        fetchedAt: new Date(),
      });
      mockPrisma.manualAsset.update.mockResolvedValue({});
      mockPrisma.manualAssetValuation.upsert.mockResolvedValue({});

      const result = await service.refreshAsset(spaceId, assetId);

      expect(result).toEqual({
        success: true,
        previousValue: 300,
        newValue: 350,
      });
      expect(mockPrisma.manualAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentValue: 350 }),
        })
      );
    });

    it('should return error when asset is not linked', async () => {
      mockPrisma.manualAsset.findFirst.mockResolvedValue({
        id: assetId,
        spaceId,
        metadata: {},
      });

      const result = await service.refreshAsset(spaceId, assetId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not linked');
    });

    it('should return error when provider returns null', async () => {
      mockPrisma.manualAsset.findFirst.mockResolvedValue({
        id: assetId,
        spaceId,
        currentValue: 300,
        currency: 'USD',
        metadata: {
          collectible: {
            category: 'sneaker',
            provider: 'kicksdb',
            externalId: 'CW2288-111',
            valuationEnabled: true,
          },
        },
      });
      mockKicksDb.getValuation.mockResolvedValue(null);

      const result = await service.refreshAsset(spaceId, assetId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valuation data');
    });

    it('should handle adapter errors gracefully', async () => {
      mockPrisma.manualAsset.findFirst.mockResolvedValue({
        id: assetId,
        spaceId,
        currentValue: 300,
        currency: 'USD',
        metadata: {
          collectible: {
            category: 'sneaker',
            provider: 'kicksdb',
            externalId: 'CW2288-111',
            valuationEnabled: true,
          },
        },
      });
      mockKicksDb.getValuation.mockRejectedValue(new Error('API timeout'));

      const result = await service.refreshAsset(spaceId, assetId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API timeout');
    });
  });

  describe('getAllLinkedAssets', () => {
    it('should filter to only assets with collectible.valuationEnabled', async () => {
      mockPrisma.manualAsset.findMany.mockResolvedValue([
        {
          id: 'a1',
          spaceId: 's1',
          metadata: { collectible: { valuationEnabled: true, externalId: 'X' } },
        },
        { id: 'a2', spaceId: 's1', metadata: {} },
        {
          id: 'a3',
          spaceId: 's2',
          metadata: { collectible: { valuationEnabled: false, externalId: 'Y' } },
        },
        { id: 'a4', spaceId: 's2', metadata: null },
      ]);

      const result = await service.getAllLinkedAssets();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a1');
    });
  });

  describe('getAvailableCategories', () => {
    it('should return all adapters with correct availability', () => {
      const result = service.getAvailableCategories();

      expect(result.length).toBeGreaterThanOrEqual(7);

      const kicksdb = result.find((c) => c.provider === 'kicksdb');
      expect(kicksdb).toBeDefined();
      expect(kicksdb!.available).toBe(true);
      expect(kicksdb!.comingSoon).toBe(false);

      const artsy = result.find((c) => c.provider === 'artsy');
      expect(artsy).toBeDefined();
      expect(artsy!.available).toBe(false);
      expect(artsy!.comingSoon).toBe(true);
    });
  });
});
