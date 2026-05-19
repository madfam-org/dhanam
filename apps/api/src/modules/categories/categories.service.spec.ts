import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../core/prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';

import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

// Helper to create Decimal-like mock
const createDecimal = (value: number) => ({
  toNumber: () => value,
  toString: () => value.toString(),
});

describe('CategoriesService', () => {
  let service: CategoriesService;
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

  const mockBudget = {
    id: 'budget-123',
    spaceId: 'space-123',
    name: 'Monthly Budget',
    period: 'monthly',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-01-31'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCategory = {
    id: 'category-123',
    budgetId: 'budget-123',
    name: 'Groceries',
    budgetedAmount: createDecimal(500),
    isIncome: false,
    excludeFromBudget: false,
    excludeFromTotals: false,
    groupName: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      category: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      budget: {
        findFirst: jest.fn(),
      },
      transaction: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const mockSpacesService = {
      verifyUserAccess: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SpacesService, useValue: mockSpacesService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get(PrismaService);
    spacesService = module.get(SpacesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all categories for a space', async () => {
      const categories = [
        {
          ...mockCategory,
          budget: mockBudget,
          _count: { transactions: 5 },
        },
      ];

      prisma.category.findMany.mockResolvedValue(categories as any);

      const result = await service.findAll(mockSpace.id, mockUser.id);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'viewer'
      );
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { budget: { spaceId: mockSpace.id } },
        include: {
          budget: true,
          _count: { select: { transactions: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: 0,
        take: 50,
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Groceries');
      expect(typeof result[0].budgetedAmount).toBe('number');
    });

    it('should throw ForbiddenException if user lacks access', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(new ForbiddenException('No access'));

      await expect(service.findAll(mockSpace.id, mockUser.id)).rejects.toThrow(ForbiddenException);
    });

    it('should return empty array if no categories exist', async () => {
      prisma.category.findMany.mockResolvedValue([]);

      const result = await service.findAll(mockSpace.id, mockUser.id);

      expect(result).toEqual([]);
    });
  });

  describe('findByBudget', () => {
    it('should return categories for a specific budget', async () => {
      prisma.budget.findFirst.mockResolvedValue(mockBudget as any);
      prisma.category.findMany.mockResolvedValue([
        { ...mockCategory, _count: { transactions: 3 } },
      ] as any);

      const result = await service.findByBudget(mockSpace.id, mockUser.id, mockBudget.id);

      expect(prisma.budget.findFirst).toHaveBeenCalledWith({
        where: { id: mockBudget.id, spaceId: mockSpace.id },
      });
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { budgetId: mockBudget.id },
        include: { _count: { select: { transactions: true } } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      expect(result).toHaveLength(1);
    });

    it('should throw ForbiddenException if budget does not belong to space', async () => {
      prisma.budget.findFirst.mockResolvedValue(null);

      await expect(
        service.findByBudget(mockSpace.id, mockUser.id, 'wrong-budget-id')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('should return a single category by ID', async () => {
      prisma.category.findFirst.mockResolvedValue({
        ...mockCategory,
        budget: mockBudget,
        _count: { transactions: 10 },
      } as any);

      const result = await service.findOne(mockSpace.id, mockUser.id, mockCategory.id);

      expect(spacesService.verifyUserAccess).toHaveBeenCalled();
      expect(result.name).toBe('Groceries');
      expect(result.budgetedAmount).toBe(500);
    });

    it('should throw NotFoundException if category not found', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockSpace.id, mockUser.id, 'wrong-id')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('create', () => {
    const createDto: CreateCategoryDto = {
      budgetId: 'budget-123',
      name: 'Entertainment',
      budgetedAmount: 300,
    };

    it('should create a new category', async () => {
      prisma.budget.findFirst.mockResolvedValue(mockBudget as any);
      prisma.category.create.mockResolvedValue({
        ...mockCategory,
        name: createDto.name,
        budgetedAmount: createDecimal(createDto.budgetedAmount),
        id: 'new-category-123',
        budget: mockBudget,
        _count: { transactions: 0 },
      } as any);

      const result = await service.create(mockSpace.id, mockUser.id, createDto);

      expect(prisma.budget.findFirst).toHaveBeenCalledWith({
        where: { id: createDto.budgetId, spaceId: mockSpace.id },
      });
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          budgetId: createDto.budgetId,
          name: createDto.name,
          budgetedAmount: createDto.budgetedAmount,
        }),
        include: {
          budget: true,
          _count: { select: { transactions: true } },
        },
      });
      expect(result.name).toBe('Entertainment');
    });

    it('should throw ForbiddenException if budget does not belong to space', async () => {
      prisma.budget.findFirst.mockResolvedValue(null);

      await expect(service.create(mockSpace.id, mockUser.id, createDto)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should require editor role to create category', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Requires editor role')
      );

      await expect(service.create(mockSpace.id, mockUser.id, createDto)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateCategoryDto = {
      name: 'Updated Groceries',
      budgetedAmount: 600,
    };

    it('should update a category', async () => {
      prisma.category.findFirst.mockResolvedValue({
        ...mockCategory,
        budget: mockBudget,
        _count: { transactions: 5 },
      } as any);
      prisma.category.update.mockResolvedValue({
        ...mockCategory,
        name: updateDto.name,
        budgetedAmount: createDecimal(updateDto.budgetedAmount!),
        budget: mockBudget,
        _count: { transactions: 5 },
      } as any);

      const result = await service.update(mockSpace.id, mockUser.id, mockCategory.id, updateDto);

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: mockCategory.id },
        data: expect.objectContaining({
          name: updateDto.name,
          budgetedAmount: updateDto.budgetedAmount,
        }),
        include: {
          budget: true,
          _count: { select: { transactions: true } },
        },
      });
      expect(result.name).toBe('Updated Groceries');
      expect(result.budgetedAmount).toBe(600);
    });

    it('should throw NotFoundException if category not found', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(mockSpace.id, mockUser.id, 'wrong-id', updateDto)
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow partial updates', async () => {
      prisma.category.findFirst.mockResolvedValue({
        ...mockCategory,
        budget: mockBudget,
        _count: { transactions: 5 },
      } as any);
      prisma.category.update.mockResolvedValue({
        ...mockCategory,
        budgetedAmount: createDecimal(700),
        budget: mockBudget,
        _count: { transactions: 5 },
      } as any);

      const partialDto = { budgetedAmount: 700 };
      const result = await service.update(mockSpace.id, mockUser.id, mockCategory.id, partialDto);

      expect(result.budgetedAmount).toBe(700);
    });
  });

  describe('delete', () => {
    it('should delete a category', async () => {
      prisma.category.findFirst.mockResolvedValue({
        ...mockCategory,
        budget: mockBudget,
        _count: { transactions: 2 },
      } as any);
      (prisma as any).transaction.updateMany.mockResolvedValue({ count: 2 });
      prisma.category.delete.mockResolvedValue(mockCategory as any);

      await service.remove(mockSpace.id, mockUser.id, mockCategory.id);

      expect((prisma as any).transaction.updateMany).toHaveBeenCalledWith({
        where: { categoryId: mockCategory.id },
        data: { categoryId: null },
      });
      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: mockCategory.id },
      });
    });

    it('should throw NotFoundException if category not found', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.remove(mockSpace.id, mockUser.id, 'wrong-id')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should require editor role to delete category', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Requires editor role')
      );

      await expect(service.remove(mockSpace.id, mockUser.id, mockCategory.id)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('edge cases', () => {
    it('should handle decimal amounts correctly', async () => {
      const categoryWithDecimal = {
        ...mockCategory,
        budgetedAmount: createDecimal(123.45),
        budget: mockBudget,
        _count: { transactions: 0 },
      };

      prisma.category.findFirst.mockResolvedValue(categoryWithDecimal as any);

      const result = await service.findOne(mockSpace.id, mockUser.id, mockCategory.id);

      expect(result.budgetedAmount).toBe(123.45);
    });

    it('should handle categories with no transactions', async () => {
      prisma.category.findMany.mockResolvedValue([
        {
          ...mockCategory,
          budget: mockBudget,
          _count: { transactions: 0 },
        },
      ] as any);

      const result = await service.findAll(mockSpace.id, mockUser.id);

      expect(result[0]._count.transactions).toBe(0);
    });

    it('should handle date serialization correctly', async () => {
      const now = new Date();
      prisma.category.findFirst.mockResolvedValue({
        ...mockCategory,
        createdAt: now,
        updatedAt: now,
        budget: { ...mockBudget, startDate: now, endDate: null },
        _count: { transactions: 0 },
      } as any);

      const result = await service.findOne(mockSpace.id, mockUser.id, mockCategory.id);

      expect(typeof result.createdAt).toBe('string');
      expect(typeof result.updatedAt).toBe('string');
    });
  });
});
