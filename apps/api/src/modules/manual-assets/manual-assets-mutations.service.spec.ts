import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Decimal } from '@db';

import { PrismaService } from '../../core/prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';

import { CreateManualAssetDto, UpdateManualAssetDto } from './dto';
import { ManualAssetsService } from './manual-assets.service';

describe('ManualAssetsService - Mutations', () => {
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

  describe('create', () => {
    const spaceId = 'space-1';
    const userId = 'user-1';

    it('should create a new asset', async () => {
      const dto: CreateManualAssetDto = {
        name: 'Collectible Art',
        type: 'art',
        description: 'Modern art piece',
        currentValue: 25000,
        currency: 'USD',
        acquisitionDate: '2021-06-15',
        acquisitionCost: 20000,
        metadata: { artist: 'Unknown', year: 2020 },
        notes: 'Purchased at auction',
      };

      const mockAsset = {
        id: 'asset-new',
        spaceId,
        name: dto.name,
        type: dto.type,
        description: dto.description,
        currentValue: new Decimal(dto.currentValue),
        currency: dto.currency,
        acquisitionDate: new Date(dto.acquisitionDate),
        acquisitionCost: new Decimal(dto.acquisitionCost!),
        metadata: dto.metadata,
        documents: null,
        notes: dto.notes,
        createdAt: new Date('2023-07-01'),
        updatedAt: new Date('2023-07-01'),
        valuationHistory: [],
      };

      const mockValuation = {
        id: 'val-initial',
        assetId: 'asset-new',
        date: new Date(),
        value: new Decimal(dto.currentValue),
        currency: dto.currency,
        source: 'Initial Entry',
        notes: null,
        createdAt: new Date('2023-07-01'),
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.create.mockResolvedValue(mockAsset as any);
      mockPrisma.manualAssetValuation.create.mockResolvedValue(mockValuation as any);

      const result = await service.create(spaceId, userId, dto);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(userId, spaceId, 'member');
      expect(prismaService.manualAsset.create).toHaveBeenCalledWith({
        data: {
          spaceId,
          name: dto.name,
          type: dto.type,
          description: dto.description,
          currentValue: dto.currentValue,
          currency: dto.currency,
          acquisitionDate: new Date(dto.acquisitionDate),
          acquisitionCost: dto.acquisitionCost,
          metadata: dto.metadata,
          notes: dto.notes,
        },
        include: {
          valuationHistory: true,
        },
      });
      expect(prismaService.manualAssetValuation.create).toHaveBeenCalledWith({
        data: {
          assetId: 'asset-new',
          date: expect.any(Date),
          value: dto.currentValue,
          currency: dto.currency,
          source: 'Initial Entry',
        },
      });
      expect(result.name).toBe(dto.name);
      expect(result.currentValue).toBe(25000);
    });

    it('should create initial valuation entry', async () => {
      const dto: CreateManualAssetDto = {
        name: 'Vehicle',
        type: 'vehicle',
        currentValue: 30000,
        currency: 'USD',
      };

      const mockAsset = {
        id: 'asset-new',
        spaceId,
        name: dto.name,
        type: dto.type,
        description: null,
        currentValue: new Decimal(dto.currentValue),
        currency: dto.currency,
        acquisitionDate: null,
        acquisitionCost: null,
        metadata: null,
        documents: null,
        notes: null,
        createdAt: new Date('2023-07-01'),
        updatedAt: new Date('2023-07-01'),
        valuationHistory: [],
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.create.mockResolvedValue(mockAsset as any);
      mockPrisma.manualAssetValuation.create.mockResolvedValue({} as any);

      await service.create(spaceId, userId, dto);

      expect(prismaService.manualAssetValuation.create).toHaveBeenCalledTimes(1);
      expect(prismaService.manualAssetValuation.create).toHaveBeenCalledWith({
        data: {
          assetId: 'asset-new',
          date: expect.any(Date),
          value: dto.currentValue,
          currency: dto.currency,
          source: 'Initial Entry',
        },
      });
    });

    it('should require member role', async () => {
      const dto: CreateManualAssetDto = {
        name: 'Asset',
        type: 'other',
        currentValue: 10000,
        currency: 'USD',
      };

      mockSpacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Insufficient permissions')
      );

      await expect(service.create(spaceId, userId, dto)).rejects.toThrow(ForbiddenException);
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(userId, spaceId, 'member');
      expect(prismaService.manualAsset.create).not.toHaveBeenCalled();
    });

    it('should handle optional fields correctly', async () => {
      const dto: CreateManualAssetDto = {
        name: 'Minimal Asset',
        type: 'other',
        currentValue: 5000,
        currency: 'MXN',
      };

      const mockAsset = {
        id: 'asset-minimal',
        spaceId,
        name: dto.name,
        type: dto.type,
        description: null,
        currentValue: new Decimal(dto.currentValue),
        currency: dto.currency,
        acquisitionDate: null,
        acquisitionCost: null,
        metadata: null,
        documents: null,
        notes: null,
        createdAt: new Date('2023-07-01'),
        updatedAt: new Date('2023-07-01'),
        valuationHistory: [],
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.create.mockResolvedValue(mockAsset as any);
      mockPrisma.manualAssetValuation.create.mockResolvedValue({} as any);

      const result = await service.create(spaceId, userId, dto);

      expect(result.description).toBeNull();
      expect(result.acquisitionDate).toBeNull();
      expect(result.acquisitionCost).toBeNull();
      expect(result.metadata).toBeNull();
      expect(result.notes).toBeNull();
    });
  });

  describe('update', () => {
    const spaceId = 'space-1';
    const userId = 'user-1';
    const assetId = 'asset-1';

    it('should update an asset', async () => {
      const dto: UpdateManualAssetDto = {
        name: 'Updated Asset Name',
        currentValue: 600000,
        notes: 'Value increased',
      };

      const existingAsset = {
        id: assetId,
        spaceId,
        name: 'Old Name',
        type: 'real_estate',
        description: 'Description',
        currentValue: new Decimal(500000),
        currency: 'USD',
        acquisitionDate: new Date('2020-01-01'),
        acquisitionCost: new Decimal(400000),
        metadata: {},
        documents: null,
        notes: 'Old notes',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-06-01'),
      };

      const updatedAsset = {
        ...existingAsset,
        name: dto.name,
        currentValue: new Decimal(dto.currentValue!),
        notes: dto.notes,
        updatedAt: new Date('2023-07-01'),
        valuationHistory: [],
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findFirst.mockResolvedValue(existingAsset as any);
      mockPrisma.manualAsset.update.mockResolvedValue(updatedAsset as any);

      const result = await service.update(spaceId, userId, assetId, dto);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(userId, spaceId, 'member');
      expect(prismaService.manualAsset.findFirst).toHaveBeenCalledWith({
        where: { id: assetId, spaceId },
      });
      expect(prismaService.manualAsset.update).toHaveBeenCalledWith({
        where: { id: assetId },
        data: {
          name: dto.name,
          currentValue: dto.currentValue,
          notes: dto.notes,
        },
        include: {
          valuationHistory: {
            orderBy: { date: 'desc' },
            take: 5,
          },
        },
      });
      expect(result.name).toBe('Updated Asset Name');
      expect(result.currentValue).toBe(600000);
      expect(result.notes).toBe('Value increased');
    });

    it('should allow partial updates', async () => {
      const dto: UpdateManualAssetDto = {
        notes: 'Just updating notes',
      };

      const existingAsset = {
        id: assetId,
        spaceId,
        name: 'Asset',
        type: 'vehicle',
        description: 'Description',
        currentValue: new Decimal(30000),
        currency: 'USD',
        acquisitionDate: null,
        acquisitionCost: null,
        metadata: null,
        documents: null,
        notes: null,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-06-01'),
      };

      const updatedAsset = {
        ...existingAsset,
        notes: dto.notes,
        updatedAt: new Date('2023-07-01'),
        valuationHistory: [],
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findFirst.mockResolvedValue(existingAsset as any);
      mockPrisma.manualAsset.update.mockResolvedValue(updatedAsset as any);

      const result = await service.update(spaceId, userId, assetId, dto);

      expect(prismaService.manualAsset.update).toHaveBeenCalledWith({
        where: { id: assetId },
        data: {
          notes: dto.notes,
        },
        include: {
          valuationHistory: {
            orderBy: { date: 'desc' },
            take: 5,
          },
        },
      });
      expect(result.notes).toBe('Just updating notes');
    });

    it('should throw NotFoundException if asset not found', async () => {
      const dto: UpdateManualAssetDto = {
        name: 'Updated',
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findFirst.mockResolvedValue(null);

      await expect(service.update(spaceId, userId, assetId, dto)).rejects.toThrow(
        NotFoundException
      );
      await expect(service.update(spaceId, userId, assetId, dto)).rejects.toThrow(
        'Manual asset not found'
      );
      expect(prismaService.manualAsset.update).not.toHaveBeenCalled();
    });

    it('should require member role', async () => {
      const dto: UpdateManualAssetDto = {
        name: 'Updated',
      };

      mockSpacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Insufficient permissions')
      );

      await expect(service.update(spaceId, userId, assetId, dto)).rejects.toThrow(
        ForbiddenException
      );
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(userId, spaceId, 'member');
      expect(prismaService.manualAsset.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const spaceId = 'space-1';
    const userId = 'user-1';
    const assetId = 'asset-1';

    it('should delete an asset', async () => {
      const mockAsset = {
        id: assetId,
        spaceId,
        name: 'Asset to Delete',
        type: 'other',
        description: null,
        currentValue: new Decimal(10000),
        currency: 'USD',
        acquisitionDate: null,
        acquisitionCost: null,
        metadata: null,
        documents: null,
        notes: null,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-06-01'),
      };

      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findFirst.mockResolvedValue(mockAsset as any);
      mockPrisma.manualAsset.delete.mockResolvedValue(mockAsset as any);

      await service.remove(spaceId, userId, assetId);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(userId, spaceId, 'admin');
      expect(prismaService.manualAsset.findFirst).toHaveBeenCalledWith({
        where: { id: assetId, spaceId },
      });
      expect(prismaService.manualAsset.delete).toHaveBeenCalledWith({
        where: { id: assetId },
      });
    });

    it('should throw NotFoundException if asset not found', async () => {
      mockSpacesService.verifyUserAccess.mockResolvedValue(undefined);
      mockPrisma.manualAsset.findFirst.mockResolvedValue(null);

      await expect(service.remove(spaceId, userId, assetId)).rejects.toThrow(NotFoundException);
      await expect(service.remove(spaceId, userId, assetId)).rejects.toThrow(
        'Manual asset not found'
      );
      expect(prismaService.manualAsset.delete).not.toHaveBeenCalled();
    });

    it('should require admin role', async () => {
      mockSpacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Insufficient permissions')
      );

      await expect(service.remove(spaceId, userId, assetId)).rejects.toThrow(ForbiddenException);
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(userId, spaceId, 'admin');
      expect(prismaService.manualAsset.findFirst).not.toHaveBeenCalled();
    });
  });
});
