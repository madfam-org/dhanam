import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../core/prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';

import { CreateTagDto, UpdateTagDto } from './dto';
import { TagsService } from './tags.service';

describe('TagsService', () => {
  let service: TagsService;
  let prisma: jest.Mocked<PrismaService>;
  let spacesService: jest.Mocked<SpacesService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockSpace = {
    id: 'space-123',
    name: 'Test Space',
    type: 'personal',
  };

  const mockTag = {
    id: 'tag-123',
    spaceId: 'space-123',
    name: 'Vacation',
    description: 'Travel expenses',
    color: '#ef4444',
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      tag: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      transaction: {
        count: jest.fn(),
      },
      transactionTag: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const mockSpacesService = {
      verifyUserAccess: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SpacesService, useValue: mockSpacesService },
      ],
    }).compile();

    service = module.get<TagsService>(TagsService);
    prisma = module.get(PrismaService);
    spacesService = module.get(SpacesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all tags for a space with transaction counts', async () => {
      const tags = [
        { ...mockTag, _count: { transactions: 5 } },
        {
          ...mockTag,
          id: 'tag-456',
          name: 'Business',
          _count: { transactions: 12 },
        },
      ];

      prisma.tag.findMany.mockResolvedValue(tags as any);

      const result = await service.findAll(mockSpace.id, mockUser.id);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'viewer'
      );
      expect(prisma.tag.findMany).toHaveBeenCalledWith({
        where: { spaceId: mockSpace.id },
        include: {
          _count: { select: { transactions: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Vacation');
      expect(result[1].name).toBe('Business');
    });

    it('should verify viewer access before querying', async () => {
      prisma.tag.findMany.mockResolvedValue([]);

      await service.findAll(mockSpace.id, mockUser.id);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'viewer'
      );
    });

    it('should throw ForbiddenException if user lacks access', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(new ForbiddenException('No access'));

      await expect(service.findAll(mockSpace.id, mockUser.id)).rejects.toThrow(ForbiddenException);

      expect(prisma.tag.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array if no tags exist', async () => {
      prisma.tag.findMany.mockResolvedValue([]);

      const result = await service.findAll(mockSpace.id, mockUser.id);

      expect(result).toEqual([]);
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a single tag by ID', async () => {
      prisma.tag.findFirst.mockResolvedValue({
        ...mockTag,
        _count: { transactions: 10 },
      } as any);

      const result = await service.findOne(mockSpace.id, mockUser.id, mockTag.id);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'viewer'
      );
      expect(prisma.tag.findFirst).toHaveBeenCalledWith({
        where: { id: mockTag.id, spaceId: mockSpace.id },
        include: {
          _count: { select: { transactions: true } },
        },
      });
      expect(result.name).toBe('Vacation');
      expect(result._count.transactions).toBe(10);
    });

    it('should throw NotFoundException if tag not found', async () => {
      prisma.tag.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockSpace.id, mockUser.id, 'nonexistent-id')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException with correct message', async () => {
      prisma.tag.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockSpace.id, mockUser.id, 'wrong-id')).rejects.toThrow(
        'Tag not found'
      );
    });

    it('should throw ForbiddenException if user lacks viewer access', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(new ForbiddenException('No access'));

      await expect(service.findOne(mockSpace.id, mockUser.id, mockTag.id)).rejects.toThrow(
        ForbiddenException
      );

      expect(prisma.tag.findFirst).not.toHaveBeenCalled();
    });

    it('should scope query to the given space', async () => {
      prisma.tag.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockSpace.id, mockUser.id, mockTag.id)).rejects.toThrow(
        NotFoundException
      );

      expect(prisma.tag.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockTag.id, spaceId: mockSpace.id },
        })
      );
    });
  });

  // ─── create ─────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto: CreateTagDto = {
      name: 'Urgent',
      description: 'Time-sensitive items',
      color: '#f59e0b',
      sortOrder: 1,
    };

    it('should create a new tag', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);
      prisma.tag.create.mockResolvedValue({
        ...mockTag,
        id: 'new-tag-123',
        name: createDto.name,
        description: createDto.description,
        color: createDto.color,
        sortOrder: createDto.sortOrder,
        _count: { transactions: 0 },
      } as any);

      const result = await service.create(mockSpace.id, mockUser.id, createDto);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'member'
      );
      expect(prisma.tag.findUnique).toHaveBeenCalledWith({
        where: { spaceId_name: { spaceId: mockSpace.id, name: createDto.name } },
      });
      expect(prisma.tag.create).toHaveBeenCalledWith({
        data: {
          spaceId: mockSpace.id,
          name: createDto.name,
          description: createDto.description,
          color: createDto.color,
          sortOrder: createDto.sortOrder,
        },
        include: {
          _count: { select: { transactions: true } },
        },
      });
      expect(result.name).toBe('Urgent');
    });

    it('should throw ConflictException if tag name already exists', async () => {
      prisma.tag.findUnique.mockResolvedValue(mockTag as any);

      await expect(service.create(mockSpace.id, mockUser.id, createDto)).rejects.toThrow(
        ConflictException
      );
    });

    it('should throw ConflictException with descriptive message', async () => {
      prisma.tag.findUnique.mockResolvedValue(mockTag as any);

      await expect(service.create(mockSpace.id, mockUser.id, createDto)).rejects.toThrow(
        `Tag "${createDto.name}" already exists in this space`
      );
    });

    it('should require member role to create a tag', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Requires member role')
      );

      await expect(service.create(mockSpace.id, mockUser.id, createDto)).rejects.toThrow(
        ForbiddenException
      );

      expect(prisma.tag.findUnique).not.toHaveBeenCalled();
      expect(prisma.tag.create).not.toHaveBeenCalled();
    });

    it('should default sortOrder to 0 when not provided', async () => {
      const dtoWithoutSortOrder: CreateTagDto = {
        name: 'Minimal',
      };

      prisma.tag.findUnique.mockResolvedValue(null);
      prisma.tag.create.mockResolvedValue({
        ...mockTag,
        name: 'Minimal',
        description: undefined,
        color: undefined,
        sortOrder: 0,
        _count: { transactions: 0 },
      } as any);

      await service.create(mockSpace.id, mockUser.id, dtoWithoutSortOrder);

      expect(prisma.tag.create).toHaveBeenCalledWith({
        data: {
          spaceId: mockSpace.id,
          name: 'Minimal',
          description: undefined,
          color: undefined,
          sortOrder: 0,
        },
        include: {
          _count: { select: { transactions: true } },
        },
      });
    });

    it('should create a tag with only required fields', async () => {
      const minimalDto: CreateTagDto = { name: 'Simple' };

      prisma.tag.findUnique.mockResolvedValue(null);
      prisma.tag.create.mockResolvedValue({
        ...mockTag,
        name: 'Simple',
        description: undefined,
        color: undefined,
        sortOrder: 0,
        _count: { transactions: 0 },
      } as any);

      const result = await service.create(mockSpace.id, mockUser.id, minimalDto);

      expect(result.name).toBe('Simple');
    });
  });

  // ─── update ─────────────────────────────────────────────────────────

  describe('update', () => {
    const updateDto: UpdateTagDto = {
      name: 'Updated Vacation',
      color: '#22c55e',
    };

    it('should update a tag', async () => {
      // findOne call inside update
      prisma.tag.findFirst.mockResolvedValue({
        ...mockTag,
        _count: { transactions: 5 },
      } as any);
      // Name uniqueness check
      prisma.tag.findFirst.mockResolvedValueOnce({
        ...mockTag,
        _count: { transactions: 5 },
      } as any);
      prisma.tag.findFirst.mockResolvedValueOnce(null); // no duplicate name

      prisma.tag.update.mockResolvedValue({
        ...mockTag,
        name: updateDto.name,
        color: updateDto.color,
        _count: { transactions: 5 },
      } as any);

      const result = await service.update(mockSpace.id, mockUser.id, mockTag.id, updateDto);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'member'
      );
      expect(prisma.tag.update).toHaveBeenCalledWith({
        where: { id: mockTag.id },
        data: {
          name: updateDto.name,
          color: updateDto.color,
        },
        include: {
          _count: { select: { transactions: true } },
        },
      });
      expect(result.name).toBe('Updated Vacation');
      expect(result.color).toBe('#22c55e');
    });

    it('should throw NotFoundException if tag not found', async () => {
      prisma.tag.findFirst.mockResolvedValue(null);

      await expect(
        service.update(mockSpace.id, mockUser.id, 'wrong-id', updateDto)
      ).rejects.toThrow(NotFoundException);

      expect(prisma.tag.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if new name already exists', async () => {
      // findOne succeeds
      prisma.tag.findFirst.mockResolvedValueOnce({
        ...mockTag,
        _count: { transactions: 5 },
      } as any);
      // Duplicate name check finds existing tag
      prisma.tag.findFirst.mockResolvedValueOnce({
        ...mockTag,
        id: 'other-tag-456',
        name: 'Updated Vacation',
      } as any);

      await expect(
        service.update(mockSpace.id, mockUser.id, mockTag.id, updateDto)
      ).rejects.toThrow(ConflictException);

      expect(prisma.tag.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException with descriptive message on name conflict', async () => {
      prisma.tag.findFirst.mockResolvedValueOnce({
        ...mockTag,
        _count: { transactions: 5 },
      } as any);
      prisma.tag.findFirst.mockResolvedValueOnce({
        ...mockTag,
        id: 'other-tag-456',
        name: 'Updated Vacation',
      } as any);

      await expect(
        service.update(mockSpace.id, mockUser.id, mockTag.id, updateDto)
      ).rejects.toThrow(`Tag "${updateDto.name}" already exists in this space`);
    });

    it('should allow partial updates (no name change)', async () => {
      const partialDto: UpdateTagDto = { color: '#3b82f6' };

      prisma.tag.findFirst.mockResolvedValue({
        ...mockTag,
        _count: { transactions: 5 },
      } as any);
      prisma.tag.update.mockResolvedValue({
        ...mockTag,
        color: '#3b82f6',
        _count: { transactions: 5 },
      } as any);

      const result = await service.update(mockSpace.id, mockUser.id, mockTag.id, partialDto);

      // No name uniqueness check when name is not provided
      expect(prisma.tag.findFirst).toHaveBeenCalledTimes(1); // only findOne
      expect(result.color).toBe('#3b82f6');
    });

    it('should skip name uniqueness check when name is not in DTO', async () => {
      const noNameDto: UpdateTagDto = { description: 'Updated desc', sortOrder: 5 };

      prisma.tag.findFirst.mockResolvedValue({
        ...mockTag,
        _count: { transactions: 0 },
      } as any);
      prisma.tag.update.mockResolvedValue({
        ...mockTag,
        description: 'Updated desc',
        sortOrder: 5,
        _count: { transactions: 0 },
      } as any);

      await service.update(mockSpace.id, mockUser.id, mockTag.id, noNameDto);

      // findFirst called once for findOne, never for name uniqueness
      expect(prisma.tag.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should require member role to update', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Requires member role')
      );

      await expect(
        service.update(mockSpace.id, mockUser.id, mockTag.id, updateDto)
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.tag.update).not.toHaveBeenCalled();
    });

    it('should only include defined fields in the update data', async () => {
      const sparseDto: UpdateTagDto = { sortOrder: 3 };

      prisma.tag.findFirst.mockResolvedValue({
        ...mockTag,
        _count: { transactions: 0 },
      } as any);
      prisma.tag.update.mockResolvedValue({
        ...mockTag,
        sortOrder: 3,
        _count: { transactions: 0 },
      } as any);

      await service.update(mockSpace.id, mockUser.id, mockTag.id, sparseDto);

      expect(prisma.tag.update).toHaveBeenCalledWith({
        where: { id: mockTag.id },
        data: { sortOrder: 3 },
        include: {
          _count: { select: { transactions: true } },
        },
      });
    });

    it('should exclude the current tag from the name uniqueness check', async () => {
      const nameDto: UpdateTagDto = { name: 'Renamed' };

      prisma.tag.findFirst.mockResolvedValueOnce({
        ...mockTag,
        _count: { transactions: 0 },
      } as any);
      prisma.tag.findFirst.mockResolvedValueOnce(null);
      prisma.tag.update.mockResolvedValue({
        ...mockTag,
        name: 'Renamed',
        _count: { transactions: 0 },
      } as any);

      await service.update(mockSpace.id, mockUser.id, mockTag.id, nameDto);

      // Second findFirst call is the name uniqueness check
      expect(prisma.tag.findFirst).toHaveBeenCalledWith({
        where: { spaceId: mockSpace.id, name: 'Renamed', id: { not: mockTag.id } },
      });
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete a tag', async () => {
      prisma.tag.findFirst.mockResolvedValue({
        ...mockTag,
        _count: { transactions: 2 },
      } as any);
      prisma.tag.delete.mockResolvedValue(mockTag as any);

      await service.remove(mockSpace.id, mockUser.id, mockTag.id);

      expect(prisma.tag.delete).toHaveBeenCalledWith({
        where: { id: mockTag.id },
      });
    });

    it('should require admin role to delete a tag', async () => {
      await service.remove(mockSpace.id, mockUser.id, mockTag.id).catch(() => {});

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'admin'
      );
    });

    it('should throw ForbiddenException if user lacks admin role', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Requires admin role')
      );

      await expect(service.remove(mockSpace.id, mockUser.id, mockTag.id)).rejects.toThrow(
        ForbiddenException
      );

      expect(prisma.tag.findFirst).not.toHaveBeenCalled();
      expect(prisma.tag.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if tag not found', async () => {
      prisma.tag.findFirst.mockResolvedValue(null);

      await expect(service.remove(mockSpace.id, mockUser.id, 'nonexistent-id')).rejects.toThrow(
        NotFoundException
      );

      expect(prisma.tag.delete).not.toHaveBeenCalled();
    });

    it('should call findOne to verify tag exists before deleting', async () => {
      prisma.tag.findFirst.mockResolvedValue({
        ...mockTag,
        _count: { transactions: 0 },
      } as any);
      prisma.tag.delete.mockResolvedValue(mockTag as any);

      await service.remove(mockSpace.id, mockUser.id, mockTag.id);

      expect(prisma.tag.findFirst).toHaveBeenCalledWith({
        where: { id: mockTag.id, spaceId: mockSpace.id },
        include: {
          _count: { select: { transactions: true } },
        },
      });
    });
  });

  // ─── bulkAssign ─────────────────────────────────────────────────────

  describe('bulkAssign', () => {
    const transactionIds = ['tx-1', 'tx-2', 'tx-3'];
    const tagIds = ['tag-123', 'tag-456'];

    it('should assign tags to transactions', async () => {
      (prisma as any).transaction.count.mockResolvedValue(3);
      prisma.tag.count.mockResolvedValue(2);
      (prisma as any).transactionTag.createMany.mockResolvedValue({ count: 6 });

      const result = await service.bulkAssign(mockSpace.id, mockUser.id, transactionIds, tagIds);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'member'
      );
      expect(result).toEqual({ assigned: 6 });
    });

    it('should verify all transactions belong to the space', async () => {
      (prisma as any).transaction.count.mockResolvedValue(3);
      prisma.tag.count.mockResolvedValue(2);
      (prisma as any).transactionTag.createMany.mockResolvedValue({ count: 6 });

      await service.bulkAssign(mockSpace.id, mockUser.id, transactionIds, tagIds);

      expect((prisma as any).transaction.count).toHaveBeenCalledWith({
        where: { id: { in: transactionIds }, account: { spaceId: mockSpace.id } },
      });
    });

    it('should verify all tags belong to the space', async () => {
      (prisma as any).transaction.count.mockResolvedValue(3);
      prisma.tag.count.mockResolvedValue(2);
      (prisma as any).transactionTag.createMany.mockResolvedValue({ count: 6 });

      await service.bulkAssign(mockSpace.id, mockUser.id, transactionIds, tagIds);

      expect(prisma.tag.count).toHaveBeenCalledWith({
        where: { id: { in: tagIds }, spaceId: mockSpace.id },
      });
    });

    it('should throw NotFoundException if some transactions not found in space', async () => {
      (prisma as any).transaction.count.mockResolvedValue(2); // only 2 of 3 found

      await expect(
        service.bulkAssign(mockSpace.id, mockUser.id, transactionIds, tagIds)
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.bulkAssign(mockSpace.id, mockUser.id, transactionIds, tagIds)
      ).rejects.toThrow('Some transactions not found in this space');
    });

    it('should throw NotFoundException if some tags not found in space', async () => {
      (prisma as any).transaction.count.mockResolvedValue(3);
      prisma.tag.count.mockResolvedValue(1); // only 1 of 2 found

      await expect(
        service.bulkAssign(mockSpace.id, mockUser.id, transactionIds, tagIds)
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.bulkAssign(mockSpace.id, mockUser.id, transactionIds, tagIds)
      ).rejects.toThrow('Some tags not found in this space');
    });

    it('should create correct cartesian product of transaction-tag pairs', async () => {
      (prisma as any).transaction.count.mockResolvedValue(3);
      prisma.tag.count.mockResolvedValue(2);
      (prisma as any).transactionTag.createMany.mockResolvedValue({ count: 6 });

      await service.bulkAssign(mockSpace.id, mockUser.id, transactionIds, tagIds);

      expect((prisma as any).transactionTag.createMany).toHaveBeenCalledWith({
        data: [
          { transactionId: 'tx-1', tagId: 'tag-123' },
          { transactionId: 'tx-1', tagId: 'tag-456' },
          { transactionId: 'tx-2', tagId: 'tag-123' },
          { transactionId: 'tx-2', tagId: 'tag-456' },
          { transactionId: 'tx-3', tagId: 'tag-123' },
          { transactionId: 'tx-3', tagId: 'tag-456' },
        ],
        skipDuplicates: true,
      });
    });

    it('should skip duplicates when assigning', async () => {
      (prisma as any).transaction.count.mockResolvedValue(3);
      prisma.tag.count.mockResolvedValue(2);
      (prisma as any).transactionTag.createMany.mockResolvedValue({ count: 6 });

      await service.bulkAssign(mockSpace.id, mockUser.id, transactionIds, tagIds);

      expect((prisma as any).transactionTag.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true })
      );
    });

    it('should require member role to bulk assign', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Requires member role')
      );

      await expect(
        service.bulkAssign(mockSpace.id, mockUser.id, transactionIds, tagIds)
      ).rejects.toThrow(ForbiddenException);

      expect((prisma as any).transaction.count).not.toHaveBeenCalled();
    });

    it('should handle single transaction and single tag', async () => {
      (prisma as any).transaction.count.mockResolvedValue(1);
      prisma.tag.count.mockResolvedValue(1);
      (prisma as any).transactionTag.createMany.mockResolvedValue({ count: 1 });

      const result = await service.bulkAssign(mockSpace.id, mockUser.id, ['tx-1'], ['tag-123']);

      expect(result).toEqual({ assigned: 1 });
      expect((prisma as any).transactionTag.createMany).toHaveBeenCalledWith({
        data: [{ transactionId: 'tx-1', tagId: 'tag-123' }],
        skipDuplicates: true,
      });
    });
  });

  // ─── bulkRemove ─────────────────────────────────────────────────────

  describe('bulkRemove', () => {
    const transactionIds = ['tx-1', 'tx-2'];
    const tagIds = ['tag-123', 'tag-456'];

    it('should remove tags from transactions', async () => {
      (prisma as any).transactionTag.deleteMany.mockResolvedValue({ count: 4 });

      const result = await service.bulkRemove(mockSpace.id, mockUser.id, transactionIds, tagIds);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'member'
      );
      expect(result).toEqual({ removed: 4 });
    });

    it('should scope deletion to tags belonging to the space', async () => {
      (prisma as any).transactionTag.deleteMany.mockResolvedValue({ count: 2 });

      await service.bulkRemove(mockSpace.id, mockUser.id, transactionIds, tagIds);

      expect((prisma as any).transactionTag.deleteMany).toHaveBeenCalledWith({
        where: {
          transactionId: { in: transactionIds },
          tagId: { in: tagIds },
          tag: { spaceId: mockSpace.id },
        },
      });
    });

    it('should require member role to bulk remove', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Requires member role')
      );

      await expect(
        service.bulkRemove(mockSpace.id, mockUser.id, transactionIds, tagIds)
      ).rejects.toThrow(ForbiddenException);

      expect((prisma as any).transactionTag.deleteMany).not.toHaveBeenCalled();
    });

    it('should return zero count when no matching tag-transaction pairs exist', async () => {
      (prisma as any).transactionTag.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.bulkRemove(mockSpace.id, mockUser.id, transactionIds, tagIds);

      expect(result).toEqual({ removed: 0 });
    });

    it('should handle single transaction and single tag', async () => {
      (prisma as any).transactionTag.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.bulkRemove(mockSpace.id, mockUser.id, ['tx-1'], ['tag-123']);

      expect(result).toEqual({ removed: 1 });
      expect((prisma as any).transactionTag.deleteMany).toHaveBeenCalledWith({
        where: {
          transactionId: { in: ['tx-1'] },
          tagId: { in: ['tag-123'] },
          tag: { spaceId: mockSpace.id },
        },
      });
    });
  });

  // ─── access control (cross-method) ─────────────────────────────────

  describe('access control', () => {
    it('findAll requires viewer role', async () => {
      prisma.tag.findMany.mockResolvedValue([]);
      await service.findAll(mockSpace.id, mockUser.id);
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'viewer'
      );
    });

    it('findOne requires viewer role', async () => {
      prisma.tag.findFirst.mockResolvedValue({
        ...mockTag,
        _count: { transactions: 0 },
      } as any);
      await service.findOne(mockSpace.id, mockUser.id, mockTag.id);
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'viewer'
      );
    });

    it('create requires member role', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);
      prisma.tag.create.mockResolvedValue({
        ...mockTag,
        _count: { transactions: 0 },
      } as any);
      await service.create(mockSpace.id, mockUser.id, { name: 'Test' });
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'member'
      );
    });

    it('update requires member role', async () => {
      prisma.tag.findFirst.mockResolvedValue({
        ...mockTag,
        _count: { transactions: 0 },
      } as any);
      prisma.tag.update.mockResolvedValue({
        ...mockTag,
        _count: { transactions: 0 },
      } as any);
      await service.update(mockSpace.id, mockUser.id, mockTag.id, {
        color: '#000',
      });
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'member'
      );
    });

    it('remove requires admin role', async () => {
      prisma.tag.findFirst.mockResolvedValue({
        ...mockTag,
        _count: { transactions: 0 },
      } as any);
      prisma.tag.delete.mockResolvedValue(mockTag as any);
      await service.remove(mockSpace.id, mockUser.id, mockTag.id);
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'admin'
      );
    });

    it('bulkAssign requires member role', async () => {
      (prisma as any).transaction.count.mockResolvedValue(1);
      prisma.tag.count.mockResolvedValue(1);
      (prisma as any).transactionTag.createMany.mockResolvedValue({ count: 1 });
      await service.bulkAssign(mockSpace.id, mockUser.id, ['tx-1'], ['tag-1']);
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'member'
      );
    });

    it('bulkRemove requires member role', async () => {
      (prisma as any).transactionTag.deleteMany.mockResolvedValue({ count: 0 });
      await service.bulkRemove(mockSpace.id, mockUser.id, ['tx-1'], ['tag-1']);
      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'member'
      );
    });
  });

  // ─── edge cases ─────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle tags with zero transaction count', async () => {
      prisma.tag.findMany.mockResolvedValue([{ ...mockTag, _count: { transactions: 0 } }] as any);

      const result = await service.findAll(mockSpace.id, mockUser.id);

      expect(result[0]._count.transactions).toBe(0);
    });

    it('should handle tag with no optional fields', async () => {
      const minimalTag = {
        id: 'tag-minimal',
        spaceId: mockSpace.id,
        name: 'Basic',
        description: null,
        color: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { transactions: 0 },
      };

      prisma.tag.findFirst.mockResolvedValue(minimalTag as any);

      const result = await service.findOne(mockSpace.id, mockUser.id, 'tag-minimal');

      expect(result.description).toBeNull();
      expect(result.color).toBeNull();
      expect(result.sortOrder).toBe(0);
    });

    it('should handle update with all fields undefined (no-op data)', async () => {
      const emptyDto: UpdateTagDto = {};

      prisma.tag.findFirst.mockResolvedValue({
        ...mockTag,
        _count: { transactions: 0 },
      } as any);
      prisma.tag.update.mockResolvedValue({
        ...mockTag,
        _count: { transactions: 0 },
      } as any);

      await service.update(mockSpace.id, mockUser.id, mockTag.id, emptyDto);

      // Name is falsy/undefined so no uniqueness check
      expect(prisma.tag.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.tag.update).toHaveBeenCalledWith({
        where: { id: mockTag.id },
        data: {},
        include: {
          _count: { select: { transactions: true } },
        },
      });
    });

    it('should handle bulkAssign with empty arrays gracefully', async () => {
      (prisma as any).transaction.count.mockResolvedValue(0);
      prisma.tag.count.mockResolvedValue(0);
      (prisma as any).transactionTag.createMany.mockResolvedValue({ count: 0 });

      const result = await service.bulkAssign(mockSpace.id, mockUser.id, [], []);

      expect(result).toEqual({ assigned: 0 });
    });

    it('should handle bulkRemove when no rows match', async () => {
      (prisma as any).transactionTag.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.bulkRemove(
        mockSpace.id,
        mockUser.id,
        ['tx-nonexistent'],
        ['tag-nonexistent']
      );

      expect(result).toEqual({ removed: 0 });
    });
  });
});
