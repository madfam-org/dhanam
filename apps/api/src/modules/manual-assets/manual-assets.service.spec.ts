import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Decimal } from '@db';

import { PrismaService } from '../../core/prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';

import { ManualAssetsService } from './manual-assets.service';

describe('ManualAssetsService', () => {
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

  describe('findAll', () => {
    const spaceId = 'space-1';
    const userId = 'user-1';

    it('should return all assets for a space', async () => {
      const mockAssets = [
        {
          id: 'asset-1',
          spaceId,
          name: 'Beach House',
          type: 'real_estate',
          description: 'Vacation home in Tulum',
          currentValue: new Decimal(500000),
          currency: 'USD',
          acquisitionDate: new Date('2020-01-15'),
          acquisitionCost: new Decimal(400000),
          metadata: { address: '123 Beach Rd', sqft: 2500 },
          documents: null,
          notes: 'Great investment',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-06-01'),
          valuationHistory: [
            {
              id: 'val-1',
              assetId: 'asset-1',
              date: new Date('2023-06-01'),
              value: new Decimal(500000),
              currency: 'USD',
              source: 'Appraisal',
              notes: null,
              createdAt: new Date('2023-06-01'),
            },
          ],
        },
        {
          id: 'asset-2',
          spaceId,
          name: 'Tesla Model 3',
          type: 'vehicle',
          description: null,
          currentValue: new Decimal(35000),
          currency: 'USD',
          acquisitionDate: new Date('2022-03-01'),
          acquisitionCost: new Decimal(45000),
          metadata: { vin: 'ABC123', year: 2022 },
          documents: null,
          notes: null,
          createdAt: new Date('2023-02-01'),
          updatedAt: new Date('2023-06-01'),
          valuationHistory: [],
        },
      ];

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findMany.mockResolvedValue(mockAssets as any);

      const result = await service.findAll(spaceId, userId);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(userId, spaceId, 'viewer');
      expect(prismaService.manualAsset.findMany).toHaveBeenCalledWith({
        where: { spaceId },
        include: {
          valuationHistory: {
            orderBy: { date: 'desc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Beach House');
      expect(result[0].currentValue).toBe(500000);
      expect(result[0].valuationHistory).toHaveLength(1);
      expect(result[1].name).toBe('Tesla Model 3');
      expect(result[1].currentValue).toBe(35000);
    });

    it('should throw ForbiddenException if user lacks access', async () => {
      mockSpacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Insufficient permissions')
      );

      await expect(service.findAll(spaceId, userId)).rejects.toThrow(ForbiddenException);
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(userId, spaceId, 'viewer');
      expect(prismaService.manualAsset.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array if no assets exist', async () => {
      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findMany.mockResolvedValue([]);

      const result = await service.findAll(spaceId, userId);

      expect(result).toEqual([]);
    });

    it('should include latest 5 valuations in history', async () => {
      const valuations = Array.from({ length: 7 }, (_, i) => ({
        id: `val-${i}`,
        assetId: 'asset-1',
        date: new Date(`2023-0${i + 1}-01`),
        value: new Decimal(500000 + i * 1000),
        currency: 'USD',
        source: `Valuation ${i}`,
        notes: null,
        createdAt: new Date(`2023-0${i + 1}-01`),
      }));

      const mockAsset = {
        id: 'asset-1',
        spaceId,
        name: 'Property',
        type: 'real_estate',
        description: null,
        currentValue: new Decimal(507000),
        currency: 'USD',
        acquisitionDate: null,
        acquisitionCost: null,
        metadata: null,
        documents: null,
        notes: null,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-07-01'),
        valuationHistory: valuations.slice(0, 5),
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findMany.mockResolvedValue([mockAsset] as any);

      const result = await service.findAll(spaceId, userId);

      expect(result[0].valuationHistory).toHaveLength(5);
    });
  });

  describe('findOne', () => {
    const spaceId = 'space-1';
    const userId = 'user-1';
    const assetId = 'asset-1';

    it('should return a single asset', async () => {
      const mockAsset = {
        id: assetId,
        spaceId,
        name: 'Domain Portfolio',
        type: 'domain',
        description: 'Premium .com domains',
        currentValue: new Decimal(150000),
        currency: 'USD',
        acquisitionDate: new Date('2019-05-10'),
        acquisitionCost: new Decimal(100000),
        metadata: { domains: ['example.com', 'test.com'] },
        documents: null,
        notes: 'Valuable domains',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-06-01'),
        valuationHistory: [
          {
            id: 'val-1',
            assetId,
            date: new Date('2023-06-01'),
            value: new Decimal(150000),
            currency: 'USD',
            source: 'Market Analysis',
            notes: 'Based on recent sales',
            createdAt: new Date('2023-06-01'),
          },
        ],
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findFirst.mockResolvedValue(mockAsset as any);

      const result = await service.findOne(spaceId, userId, assetId);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(userId, spaceId, 'viewer');
      expect(prismaService.manualAsset.findFirst).toHaveBeenCalledWith({
        where: { id: assetId, spaceId },
        include: {
          valuationHistory: {
            orderBy: { date: 'desc' },
          },
        },
      });
      expect(result.id).toBe(assetId);
      expect(result.name).toBe('Domain Portfolio');
      expect(result.currentValue).toBe(150000);
      expect(result.valuationHistory).toHaveLength(1);
    });

    it('should throw NotFoundException if asset not found', async () => {
      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findFirst.mockResolvedValue(null);

      await expect(service.findOne(spaceId, userId, assetId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(spaceId, userId, assetId)).rejects.toThrow(
        'Manual asset not found'
      );
    });

    it('should throw ForbiddenException if user lacks access', async () => {
      mockSpacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Insufficient permissions')
      );

      await expect(service.findOne(spaceId, userId, assetId)).rejects.toThrow(ForbiddenException);
      expect(prismaService.manualAsset.findFirst).not.toHaveBeenCalled();
    });

    it('should include all valuations (not limited to 5)', async () => {
      const valuations = Array.from({ length: 10 }, (_, i) => ({
        id: `val-${i}`,
        assetId,
        date: new Date(`2023-${String(i + 1).padStart(2, '0')}-01`),
        value: new Decimal(500000 + i * 1000),
        currency: 'USD',
        source: `Source ${i}`,
        notes: null,
        createdAt: new Date(`2023-${String(i + 1).padStart(2, '0')}-01`),
      }));

      const mockAsset = {
        id: assetId,
        spaceId,
        name: 'Property',
        type: 'real_estate',
        description: null,
        currentValue: new Decimal(509000),
        currency: 'USD',
        acquisitionDate: null,
        acquisitionCost: null,
        metadata: null,
        documents: null,
        notes: null,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-10-01'),
        valuationHistory: valuations,
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findFirst.mockResolvedValue(mockAsset as any);

      const result = await service.findOne(spaceId, userId, assetId);

      expect(result.valuationHistory).toHaveLength(10);
    });
  });

  describe('update', () => {
    const spaceId = 'space-1';
    const userId = 'user-1';
    const assetId = 'asset-1';

    const baseAsset = {
      id: assetId,
      spaceId,
      name: 'Original Name',
      type: 'real_estate',
      description: 'Original description',
      currentValue: new Decimal(100000),
      currency: 'USD',
      acquisitionDate: new Date('2020-01-01'),
      acquisitionCost: new Decimal(90000),
      metadata: { key: 'value' },
      documents: null,
      notes: 'Original notes',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-06-01'),
      valuationHistory: [],
    };

    beforeEach(() => {
      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findFirst.mockResolvedValue(baseAsset as any);
    });

    it('should update description field (line 123 branch)', async () => {
      const updateDto = { description: 'New description' };
      mockPrisma.manualAsset.update.mockResolvedValue({ ...baseAsset, ...updateDto } as any);

      const result = await service.update(spaceId, userId, assetId, updateDto);

      expect(mockPrisma.manualAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: 'New description' }),
        })
      );
      expect(result.description).toBe('New description');
    });

    it('should update currentValue field (line 124 branch)', async () => {
      const updateDto = { currentValue: 200000 };
      mockPrisma.manualAsset.update.mockResolvedValue({
        ...baseAsset,
        currentValue: new Decimal(200000),
      } as any);

      const result = await service.update(spaceId, userId, assetId, updateDto);

      expect(mockPrisma.manualAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentValue: 200000 }),
        })
      );
      expect(result.currentValue).toBe(200000);
    });

    it('should update currency field (line 125 branch)', async () => {
      const updateDto = { currency: 'MXN' };
      mockPrisma.manualAsset.update.mockResolvedValue({ ...baseAsset, currency: 'MXN' } as any);

      const result = await service.update(spaceId, userId, assetId, updateDto);

      expect(mockPrisma.manualAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'MXN' }),
        })
      );
      expect(result.currency).toBe('MXN');
    });

    it('should update acquisitionDate field (line 126 branch)', async () => {
      const updateDto = { acquisitionDate: '2022-06-15' };
      mockPrisma.manualAsset.update.mockResolvedValue({
        ...baseAsset,
        acquisitionDate: new Date('2022-06-15'),
      } as any);

      const result = await service.update(spaceId, userId, assetId, updateDto);

      expect(mockPrisma.manualAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ acquisitionDate: new Date('2022-06-15') }),
        })
      );
    });

    it('should update acquisitionCost field (line 127 branch)', async () => {
      const updateDto = { acquisitionCost: 85000 };
      mockPrisma.manualAsset.update.mockResolvedValue({
        ...baseAsset,
        acquisitionCost: new Decimal(85000),
      } as any);

      const result = await service.update(spaceId, userId, assetId, updateDto);

      expect(mockPrisma.manualAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ acquisitionCost: 85000 }),
        })
      );
    });

    it('should update metadata field (line 128 branch)', async () => {
      const updateDto = { metadata: { newKey: 'newValue' } };
      mockPrisma.manualAsset.update.mockResolvedValue({
        ...baseAsset,
        metadata: { newKey: 'newValue' },
      } as any);

      const result = await service.update(spaceId, userId, assetId, updateDto);

      expect(mockPrisma.manualAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ metadata: { newKey: 'newValue' } }),
        })
      );
    });

    it('should update notes field', async () => {
      const updateDto = { notes: 'Updated notes' };
      mockPrisma.manualAsset.update.mockResolvedValue({
        ...baseAsset,
        notes: 'Updated notes',
      } as any);

      const result = await service.update(spaceId, userId, assetId, updateDto);

      expect(mockPrisma.manualAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notes: 'Updated notes' }),
        })
      );
    });

    it('should throw NotFoundException if asset not found', async () => {
      mockPrisma.manualAsset.findFirst.mockResolvedValue(null);

      await expect(service.update(spaceId, userId, assetId, { name: 'New Name' })).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
