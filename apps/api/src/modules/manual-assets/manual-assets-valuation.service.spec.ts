import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Decimal } from '@db';

import { PrismaService } from '../../core/prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';

import { AddValuationDto } from './dto';
import { ManualAssetsService } from './manual-assets.service';

describe('ManualAssetsService - Valuation', () => {
  let service: ManualAssetsService;
  let prismaService: jest.Mocked<PrismaService>;
  let spacesService: jest.Mocked<SpacesService>;

  const mockPrisma = {
    manualAsset: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    manualAssetValuation: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    space: {
      findUnique: jest.fn(),
    },
  };

  const mockSpacesService = {
    verifyUserAccess: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManualAssetsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: SpacesService,
          useValue: mockSpacesService,
        },
      ],
    }).compile();

    service = module.get<ManualAssetsService>(ManualAssetsService);
    prismaService = module.get(PrismaService);
    spacesService = module.get(SpacesService);

    jest.clearAllMocks();
  });

  describe('addValuation', () => {
    const spaceId = 'space-1';
    const userId = 'user-1';
    const assetId = 'asset-1';

    it('should add a valuation to an asset', async () => {
      const dto: AddValuationDto = {
        date: '2023-07-01',
        value: 550000,
        currency: 'USD',
        source: 'Professional Appraisal',
        notes: 'Market conditions improved',
      };

      const mockAsset = {
        id: assetId,
        spaceId,
      };

      const mockValuation = {
        id: 'val-new',
        assetId,
        date: new Date(dto.date),
        value: new Decimal(dto.value),
        currency: dto.currency,
        source: dto.source,
        notes: dto.notes,
        createdAt: new Date('2023-07-01'),
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findFirst.mockResolvedValue(mockAsset as any);
      mockPrisma.manualAssetValuation.create.mockResolvedValue(mockValuation as any);
      mockPrisma.manualAssetValuation.findFirst.mockResolvedValue(mockValuation as any);
      mockPrisma.manualAsset.update.mockResolvedValue({} as any);

      const result = await service.addValuation(spaceId, userId, assetId, dto);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(userId, spaceId, 'member');
      expect(prismaService.manualAsset.findFirst).toHaveBeenCalledWith({
        where: { id: assetId, spaceId },
      });
      expect(prismaService.manualAssetValuation.create).toHaveBeenCalledWith({
        data: {
          assetId,
          date: new Date(dto.date),
          value: dto.value,
          currency: dto.currency,
          source: dto.source,
          notes: dto.notes,
        },
      });
      expect(result.id).toBe('val-new');
      expect(result.value).toBe(550000);
      expect(result.source).toBe('Professional Appraisal');
    });

    it('should update currentValue if this is the latest valuation', async () => {
      const dto: AddValuationDto = {
        date: '2023-08-01',
        value: 600000,
        currency: 'USD',
        source: 'Market Update',
      };

      const mockAsset = {
        id: assetId,
        spaceId,
      };

      const mockValuation = {
        id: 'val-latest',
        assetId,
        date: new Date(dto.date),
        value: new Decimal(dto.value),
        currency: dto.currency,
        source: dto.source,
        notes: null,
        createdAt: new Date('2023-08-01'),
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findFirst.mockResolvedValue(mockAsset as any);
      mockPrisma.manualAssetValuation.create.mockResolvedValue(mockValuation as any);
      mockPrisma.manualAssetValuation.findFirst.mockResolvedValue(mockValuation as any);
      mockPrisma.manualAsset.update.mockResolvedValue({} as any);

      await service.addValuation(spaceId, userId, assetId, dto);

      expect(prismaService.manualAsset.update).toHaveBeenCalledWith({
        where: { id: assetId },
        data: { currentValue: dto.value },
      });
    });

    it('should not update currentValue if this is not the latest valuation', async () => {
      const dto: AddValuationDto = {
        date: '2023-05-01',
        value: 480000,
        currency: 'USD',
        source: 'Historical Data',
      };

      const mockAsset = {
        id: assetId,
        spaceId,
      };

      const createdValuation = {
        id: 'val-historical',
        assetId,
        date: new Date(dto.date),
        value: new Decimal(dto.value),
        currency: dto.currency,
        source: dto.source,
        notes: null,
        createdAt: new Date('2023-07-01'),
      };

      const latestValuation = {
        id: 'val-latest',
        assetId,
        date: new Date('2023-07-01'),
        value: new Decimal(550000),
        currency: 'USD',
        source: 'Latest',
        notes: null,
        createdAt: new Date('2023-07-01'),
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findFirst.mockResolvedValue(mockAsset as any);
      mockPrisma.manualAssetValuation.create.mockResolvedValue(createdValuation as any);
      mockPrisma.manualAssetValuation.findFirst.mockResolvedValue(latestValuation as any);

      await service.addValuation(spaceId, userId, assetId, dto);

      expect(prismaService.manualAsset.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if asset not found', async () => {
      const dto: AddValuationDto = {
        date: '2023-07-01',
        value: 100000,
        currency: 'USD',
        source: 'Test',
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findFirst.mockResolvedValue(null);

      await expect(service.addValuation(spaceId, userId, assetId, dto)).rejects.toThrow(
        NotFoundException
      );
      await expect(service.addValuation(spaceId, userId, assetId, dto)).rejects.toThrow(
        'Manual asset not found'
      );
      expect(prismaService.manualAssetValuation.create).not.toHaveBeenCalled();
    });

    it('should require member role', async () => {
      const dto: AddValuationDto = {
        date: '2023-07-01',
        value: 100000,
        currency: 'USD',
        source: 'Test',
      };

      mockSpacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Insufficient permissions')
      );

      await expect(service.addValuation(spaceId, userId, assetId, dto)).rejects.toThrow(
        ForbiddenException
      );
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(userId, spaceId, 'member');
      expect(prismaService.manualAsset.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    const spaceId = 'space-1';
    const userId = 'user-1';

    it('should return summary with totals', async () => {
      const mockAssets = [
        {
          id: 'asset-1',
          spaceId,
          name: 'House',
          type: 'real_estate',
          currentValue: new Decimal(500000),
          acquisitionCost: new Decimal(400000),
        },
        {
          id: 'asset-2',
          spaceId,
          name: 'Car',
          type: 'vehicle',
          currentValue: new Decimal(35000),
          acquisitionCost: new Decimal(45000),
        },
      ];

      const mockSpace = {
        id: spaceId,
        currency: 'USD',
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findMany.mockResolvedValue(mockAssets as any);
      mockPrisma.space.findUnique.mockResolvedValue(mockSpace as any);

      const result = await service.getSummary(spaceId, userId);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(userId, spaceId, 'viewer');
      expect(result.totalAssets).toBe(2);
      expect(result.totalValue).toBe(535000);
      expect(result.currency).toBe('USD');
      expect(result.unrealizedGain).toBe(90000);
    });

    it('should aggregate by asset type', async () => {
      const mockAssets = [
        {
          id: 'asset-1',
          spaceId,
          name: 'House 1',
          type: 'real_estate',
          currentValue: new Decimal(500000),
          acquisitionCost: new Decimal(400000),
        },
        {
          id: 'asset-2',
          spaceId,
          name: 'House 2',
          type: 'real_estate',
          currentValue: new Decimal(300000),
          acquisitionCost: new Decimal(250000),
        },
        {
          id: 'asset-3',
          spaceId,
          name: 'Car',
          type: 'vehicle',
          currentValue: new Decimal(35000),
          acquisitionCost: new Decimal(45000),
        },
        {
          id: 'asset-4',
          spaceId,
          name: 'Domain',
          type: 'domain',
          currentValue: new Decimal(150000),
          acquisitionCost: new Decimal(100000),
        },
      ];

      const mockSpace = {
        id: spaceId,
        currency: 'MXN',
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findMany.mockResolvedValue(mockAssets as any);
      mockPrisma.space.findUnique.mockResolvedValue(mockSpace as any);

      const result = await service.getSummary(spaceId, userId);

      expect(result.totalAssets).toBe(4);
      expect(result.totalValue).toBe(985000);
      expect(result.byType).toEqual({
        real_estate: {
          count: 2,
          value: 800000,
        },
        vehicle: {
          count: 1,
          value: 35000,
        },
        domain: {
          count: 1,
          value: 150000,
        },
      });
    });

    it('should calculate unrealized gain correctly', async () => {
      const mockAssets = [
        {
          id: 'asset-1',
          spaceId,
          name: 'Winner',
          type: 'collectible',
          currentValue: new Decimal(100000),
          acquisitionCost: new Decimal(50000),
        },
        {
          id: 'asset-2',
          spaceId,
          name: 'Loser',
          type: 'vehicle',
          currentValue: new Decimal(20000),
          acquisitionCost: new Decimal(40000),
        },
        {
          id: 'asset-3',
          spaceId,
          name: 'Unknown',
          type: 'art',
          currentValue: new Decimal(75000),
          acquisitionCost: null,
        },
      ];

      const mockSpace = {
        id: spaceId,
        currency: 'EUR',
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findMany.mockResolvedValue(mockAssets as any);
      mockPrisma.space.findUnique.mockResolvedValue(mockSpace as any);

      const result = await service.getSummary(spaceId, userId);

      expect(result.unrealizedGain).toBe(105000);
    });

    it('should handle empty asset list', async () => {
      const mockSpace = {
        id: spaceId,
        currency: 'USD',
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findMany.mockResolvedValue([]);
      mockPrisma.space.findUnique.mockResolvedValue(mockSpace as any);

      const result = await service.getSummary(spaceId, userId);

      expect(result.totalAssets).toBe(0);
      expect(result.totalValue).toBe(0);
      expect(result.byType).toEqual({});
      expect(result.unrealizedGain).toBe(0);
    });

    it('should default to USD if space has no currency', async () => {
      const mockSpace = {
        id: spaceId,
        currency: null,
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findMany.mockResolvedValue([]);
      mockPrisma.space.findUnique.mockResolvedValue(mockSpace as any);

      const result = await service.getSummary(spaceId, userId);

      expect(result.currency).toBe('USD');
    });
  });
});
