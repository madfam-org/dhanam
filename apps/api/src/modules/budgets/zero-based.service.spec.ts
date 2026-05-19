import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { createPrismaMock } from '../../../test/helpers/api-mock-factory';
import { PrismaService } from '../../core/prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';

import { ZeroBasedService } from './zero-based.service';

describe('ZeroBasedService', () => {
  let service: ZeroBasedService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let spacesServiceMock: jest.Mocked<Partial<SpacesService>>;

  const testSpaceId = 'space-123';
  const testUserId = 'user-456';
  const testCategoryId = 'cat-789';
  const testBudgetId = 'budget-101';

  // Mock Prisma Decimal-like number values
  const createDecimal = (value: number) => ({
    toNumber: () => value,
  });

  const mockCategory = {
    id: testCategoryId,
    name: 'Groceries',
    budgetedAmount: createDecimal(500),
    carryoverAmount: createDecimal(50),
    isIncome: false,
    excludeFromBudget: false,
    excludeFromTotals: false,
    groupName: null,
    sortOrder: 0,
    allocations: [],
    goal: null,
    budgetId: testBudgetId,
  };

  const mockBudget = {
    id: testBudgetId,
    spaceId: testSpaceId,
    startDate: new Date('2025-01-01'),
    endDate: null,
    categories: [mockCategory],
  };

  const mockIncomeEvent = {
    id: 'income-1',
    spaceId: testSpaceId,
    amount: createDecimal(3000),
    currency: 'USD',
    source: 'Salary',
    description: 'Monthly salary',
    receivedAt: new Date('2025-01-15'),
    isAllocated: false,
  };

  const mockSpace = {
    id: testSpaceId,
    currency: 'USD',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock = createPrismaMock();
    spacesServiceMock = {
      verifyUserAccess: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZeroBasedService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SpacesService, useValue: spacesServiceMock },
      ],
    }).compile();

    service = module.get<ZeroBasedService>(ZeroBasedService);
  });

  describe('getAllocationStatus', () => {
    beforeEach(() => {
      prismaMock.budget.findFirst.mockResolvedValue(mockBudget);
      prismaMock.incomeEvent.findMany.mockResolvedValue([mockIncomeEvent]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
    });

    it('should return allocation status for current month', async () => {
      const result = await service.getAllocationStatus(testUserId, testSpaceId);

      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'viewer'
      );
      expect(result.totalIncome).toBe(3000);
      expect(result.categories).toHaveLength(1);
    });

    it('should return allocation status for a specific month', async () => {
      await service.getAllocationStatus(testUserId, testSpaceId, '2025-01');

      expect(prismaMock.budget.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          spaceId: testSpaceId,
        }),
        include: expect.any(Object),
      });
    });

    it('should return empty status when no budget exists', async () => {
      prismaMock.budget.findFirst.mockResolvedValue(null);

      const result = await service.getAllocationStatus(testUserId, testSpaceId);

      expect(result.totalIncome).toBe(0);
      expect(result.totalAllocated).toBe(0);
      expect(result.categories).toEqual([]);
      expect(result.isFullyAllocated).toBe(true);
    });

    it('should calculate category spending from transactions', async () => {
      prismaMock.transaction.findMany.mockResolvedValue([
        { categoryId: testCategoryId, amount: createDecimal(-100) },
        { categoryId: testCategoryId, amount: createDecimal(-50) },
      ]);

      const result = await service.getAllocationStatus(testUserId, testSpaceId);

      expect(result.categories[0].spent).toBe(150);
    });

    it('should calculate available funds correctly', async () => {
      const categoryWithAllocation = {
        ...mockCategory,
        allocations: [{ amount: createDecimal(400) }],
      };

      prismaMock.budget.findFirst.mockResolvedValue({
        ...mockBudget,
        categories: [categoryWithAllocation],
      });

      prismaMock.transaction.findMany.mockResolvedValue([
        { categoryId: testCategoryId, amount: createDecimal(-100) },
      ]);

      const result = await service.getAllocationStatus(testUserId, testSpaceId);

      // available = allocated (400) + carryover (50) - spent (100) = 350
      expect(result.categories[0].available).toBe(350);
    });

    it('should mark overspent categories', async () => {
      prismaMock.transaction.findMany.mockResolvedValue([
        { categoryId: testCategoryId, amount: createDecimal(-600) },
      ]);

      const result = await service.getAllocationStatus(testUserId, testSpaceId);

      // available = 0 + 50 - 600 = -550
      expect(result.categories[0].isOverspent).toBe(true);
    });

    it('should calculate goal progress', async () => {
      const categoryWithGoal = {
        ...mockCategory,
        allocations: [{ amount: createDecimal(250) }],
        goal: {
          goalType: 'monthly_spending',
          targetAmount: createDecimal(500),
        },
      };

      prismaMock.budget.findFirst.mockResolvedValue({
        ...mockBudget,
        categories: [categoryWithGoal],
      });

      const result = await service.getAllocationStatus(testUserId, testSpaceId);

      expect(result.categories[0].goalProgress).toBe(50); // 250/500 = 50%
    });

    it('should calculate unallocated funds', async () => {
      const categoryWithAllocation = {
        ...mockCategory,
        allocations: [{ amount: createDecimal(2000) }],
      };

      prismaMock.budget.findFirst.mockResolvedValue({
        ...mockBudget,
        categories: [categoryWithAllocation],
      });

      const result = await service.getAllocationStatus(testUserId, testSpaceId);

      // unallocated = totalIncome (3000) - totalAllocated (2000) = 1000
      expect(result.unallocated).toBe(1000);
      expect(result.isFullyAllocated).toBe(false);
    });

    it('should mark as fully allocated when all funds assigned', async () => {
      const categoryWithFullAllocation = {
        ...mockCategory,
        allocations: [{ amount: createDecimal(3000) }],
      };

      prismaMock.budget.findFirst.mockResolvedValue({
        ...mockBudget,
        categories: [categoryWithFullAllocation],
      });

      const result = await service.getAllocationStatus(testUserId, testSpaceId);

      expect(result.isFullyAllocated).toBe(true);
    });
  });

  describe('createIncomeEvent', () => {
    beforeEach(() => {
      prismaMock.incomeEvent.create.mockResolvedValue({
        id: 'new-income',
        amount: createDecimal(5000),
      });
    });

    it('should create an income event', async () => {
      const result = await service.createIncomeEvent(testUserId, testSpaceId, {
        amount: 5000,
        currency: 'USD',
        source: 'Bonus',
        receivedAt: new Date('2025-01-20'),
      });

      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'member'
      );
      expect(result.id).toBe('new-income');
      expect(result.amount).toBe(5000);
    });

    it('should set isAllocated to false by default', async () => {
      await service.createIncomeEvent(testUserId, testSpaceId, {
        amount: 5000,
        currency: 'USD',
        source: 'Bonus',
        receivedAt: new Date('2025-01-20'),
      });

      expect(prismaMock.incomeEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isAllocated: false,
        }),
      });
    });

    it('should include description when provided', async () => {
      await service.createIncomeEvent(testUserId, testSpaceId, {
        amount: 5000,
        currency: 'USD',
        source: 'Bonus',
        description: 'Annual performance bonus',
        receivedAt: new Date('2025-01-20'),
      });

      expect(prismaMock.incomeEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: 'Annual performance bonus',
        }),
      });
    });
  });

  describe('allocateToCategory', () => {
    beforeEach(() => {
      prismaMock.category.findFirst.mockResolvedValue({
        ...mockCategory,
        budget: {
          ...mockBudget,
          space: mockSpace,
        },
      });
      prismaMock.incomeEvent.findFirst.mockResolvedValue(mockIncomeEvent);
      prismaMock.incomeAllocation.create.mockResolvedValue({});
      prismaMock.category.update.mockResolvedValue(mockCategory);

      // Mock for getAllocationStatus call
      prismaMock.budget.findFirst.mockResolvedValue(mockBudget);
      prismaMock.incomeEvent.findMany.mockResolvedValue([mockIncomeEvent]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
    });

    it('should allocate funds to a category', async () => {
      const result = await service.allocateToCategory(testUserId, testSpaceId, {
        categoryId: testCategoryId,
        amount: 500,
      });

      expect(result.success).toBe(true);
      expect(prismaMock.incomeAllocation.create).toHaveBeenCalled();
      expect(prismaMock.category.update).toHaveBeenCalledWith({
        where: { id: testCategoryId },
        data: { budgetedAmount: { increment: 500 } },
      });
    });

    it('should throw NotFoundException for non-existent category', async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.allocateToCategory(testUserId, testSpaceId, {
          categoryId: 'non-existent',
          amount: 500,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should use provided incomeEventId', async () => {
      await service.allocateToCategory(testUserId, testSpaceId, {
        incomeEventId: 'income-1',
        categoryId: testCategoryId,
        amount: 500,
      });

      expect(prismaMock.incomeAllocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          incomeEventId: 'income-1',
        }),
      });
    });

    it('should find unallocated income event if not provided', async () => {
      await service.allocateToCategory(testUserId, testSpaceId, {
        categoryId: testCategoryId,
        amount: 500,
      });

      expect(prismaMock.incomeEvent.findFirst).toHaveBeenCalledWith({
        where: {
          spaceId: testSpaceId,
          isAllocated: false,
        },
        orderBy: { receivedAt: 'desc' },
      });
    });

    it('should create manual income event if no unallocated event exists', async () => {
      prismaMock.incomeEvent.findFirst.mockResolvedValue(null);
      prismaMock.incomeEvent.create.mockResolvedValue({
        id: 'manual-income',
        amount: createDecimal(500),
      });

      await service.allocateToCategory(testUserId, testSpaceId, {
        categoryId: testCategoryId,
        amount: 500,
      });

      expect(prismaMock.incomeEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'manual_allocation',
          amount: 500,
        }),
      });
    });

    it('should include notes when provided', async () => {
      await service.allocateToCategory(testUserId, testSpaceId, {
        categoryId: testCategoryId,
        amount: 500,
        notes: 'Extra grocery budget',
      });

      expect(prismaMock.incomeAllocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          notes: 'Extra grocery budget',
        }),
      });
    });
  });

  describe('moveBetweenCategories', () => {
    const mockFromCategory = { ...mockCategory, id: 'from-cat' };
    const mockToCategory = { ...mockCategory, id: 'to-cat', name: 'Entertainment' };

    beforeEach(() => {
      prismaMock.category.findFirst
        .mockResolvedValueOnce(mockFromCategory)
        .mockResolvedValueOnce(mockToCategory);

      // Mock for getAllocationStatus
      prismaMock.budget.findFirst.mockResolvedValue({
        ...mockBudget,
        categories: [
          { ...mockFromCategory, allocations: [{ amount: createDecimal(500) }] },
          { ...mockToCategory, allocations: [] },
        ],
      });
      prismaMock.incomeEvent.findMany.mockResolvedValue([]);
      prismaMock.transaction.findMany.mockResolvedValue([]);

      // Handle both callback and array style transactions
      prismaMock.$transaction.mockImplementation((arg) => {
        if (typeof arg === 'function') {
          return arg(prismaMock);
        }
        return Promise.all(arg);
      });
    });

    it('should move funds between categories', async () => {
      const result = await service.moveBetweenCategories(testUserId, testSpaceId, {
        fromCategoryId: 'from-cat',
        toCategoryId: 'to-cat',
        amount: 100,
      });

      expect(result.success).toBe(true);
    });

    it('should throw BadRequestException for non-positive amount', async () => {
      await expect(
        service.moveBetweenCategories(testUserId, testSpaceId, {
          fromCategoryId: 'from-cat',
          toCategoryId: 'to-cat',
          amount: 0,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for negative amount', async () => {
      await expect(
        service.moveBetweenCategories(testUserId, testSpaceId, {
          fromCategoryId: 'from-cat',
          toCategoryId: 'to-cat',
          amount: -50,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when from category not found', async () => {
      prismaMock.category.findFirst
        .mockReset()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockToCategory);

      await expect(
        service.moveBetweenCategories(testUserId, testSpaceId, {
          fromCategoryId: 'non-existent',
          toCategoryId: 'to-cat',
          amount: 100,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when to category not found', async () => {
      prismaMock.category.findFirst
        .mockReset()
        .mockResolvedValueOnce(mockFromCategory)
        .mockResolvedValueOnce(null);

      await expect(
        service.moveBetweenCategories(testUserId, testSpaceId, {
          fromCategoryId: 'from-cat',
          toCategoryId: 'non-existent',
          amount: 100,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for insufficient funds', async () => {
      prismaMock.budget.findFirst.mockResolvedValue({
        ...mockBudget,
        categories: [
          {
            ...mockFromCategory,
            carryoverAmount: createDecimal(0),
            allocations: [{ amount: createDecimal(50) }],
          },
          { ...mockToCategory, allocations: [] },
        ],
      });

      await expect(
        service.moveBetweenCategories(testUserId, testSpaceId, {
          fromCategoryId: 'from-cat',
          toCategoryId: 'to-cat',
          amount: 100, // More than available (50)
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('autoAllocate', () => {
    beforeEach(() => {
      // Mock getAllocationStatus behavior
      prismaMock.budget.findFirst.mockResolvedValue({
        ...mockBudget,
        categories: [{ ...mockCategory, allocations: [] }],
      });
      prismaMock.incomeEvent.findMany.mockResolvedValue([
        { ...mockIncomeEvent, amount: createDecimal(1000) },
      ]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
    });

    it('should return empty allocations when no unallocated funds', async () => {
      prismaMock.budget.findFirst.mockResolvedValue({
        ...mockBudget,
        categories: [{ ...mockCategory, allocations: [{ amount: createDecimal(1000) }] }],
      });

      const result = await service.autoAllocate(testUserId, testSpaceId);

      expect(result.allocations).toEqual([]);
      expect(result.remainingUnallocated).toBe(0);
    });

    it('should allocate based on monthly_spending goals', async () => {
      prismaMock.category.findMany.mockResolvedValue([
        {
          ...mockCategory,
          goal: {
            goalType: 'monthly_spending',
            targetAmount: createDecimal(300),
          },
        },
      ]);

      // Mock for allocateToCategory
      prismaMock.category.findFirst.mockResolvedValue({
        ...mockCategory,
        budget: { ...mockBudget, space: mockSpace },
      });
      prismaMock.incomeEvent.findFirst.mockResolvedValue(mockIncomeEvent);
      prismaMock.incomeAllocation.create.mockResolvedValue({});
      prismaMock.category.update.mockResolvedValue(mockCategory);

      const result = await service.autoAllocate(testUserId, testSpaceId);

      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0].amount).toBe(300);
    });

    it('should allocate based on percentage_income goals', async () => {
      prismaMock.category.findMany.mockResolvedValue([
        {
          ...mockCategory,
          goal: {
            goalType: 'percentage_income',
            percentageTarget: createDecimal(10), // 10% of income
          },
        },
      ]);

      prismaMock.category.findFirst.mockResolvedValue({
        ...mockCategory,
        budget: { ...mockBudget, space: mockSpace },
      });
      prismaMock.incomeEvent.findFirst.mockResolvedValue(mockIncomeEvent);
      prismaMock.incomeAllocation.create.mockResolvedValue({});
      prismaMock.category.update.mockResolvedValue(mockCategory);

      const result = await service.autoAllocate(testUserId, testSpaceId);

      expect(result.allocations[0].amount).toBe(100); // 10% of 1000
    });

    it('should allocate based on weekly_spending goals', async () => {
      prismaMock.category.findMany.mockResolvedValue([
        {
          ...mockCategory,
          goal: {
            goalType: 'weekly_spending',
            targetAmount: createDecimal(100), // $100/week
          },
        },
      ]);

      prismaMock.category.findFirst.mockResolvedValue({
        ...mockCategory,
        budget: { ...mockBudget, space: mockSpace },
      });
      prismaMock.incomeEvent.findFirst.mockResolvedValue(mockIncomeEvent);
      prismaMock.incomeAllocation.create.mockResolvedValue({});
      prismaMock.category.update.mockResolvedValue(mockCategory);

      const result = await service.autoAllocate(testUserId, testSpaceId);

      expect(result.allocations[0].amount).toBe(400); // 100 * 4 weeks
    });

    it('should allocate based on target_balance goals with targetDate', async () => {
      // Set targetDate 2 months from now
      const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // ~2 months

      prismaMock.category.findMany.mockResolvedValue([
        {
          ...mockCategory,
          goal: {
            goalType: 'target_balance',
            targetAmount: createDecimal(1000),
            targetDate: futureDate,
          },
        },
      ]);

      prismaMock.category.findFirst.mockResolvedValue({
        ...mockCategory,
        budget: { ...mockBudget, space: mockSpace },
      });
      prismaMock.incomeEvent.findFirst.mockResolvedValue(mockIncomeEvent);
      prismaMock.incomeAllocation.create.mockResolvedValue({});
      prismaMock.category.update.mockResolvedValue(mockCategory);

      const result = await service.autoAllocate(testUserId, testSpaceId);

      // Should allocate ~500/month for 2 months to reach 1000
      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0].amount).toBeGreaterThan(0);
      expect(result.allocations[0].amount).toBeLessThanOrEqual(1000);
    });

    it('should skip target_balance goals without targetDate', async () => {
      prismaMock.category.findMany.mockResolvedValue([
        {
          ...mockCategory,
          goal: {
            goalType: 'target_balance',
            targetAmount: createDecimal(1000),
            targetDate: null, // No target date
          },
        },
      ]);

      const result = await service.autoAllocate(testUserId, testSpaceId);

      expect(result.allocations).toHaveLength(0);
    });

    it('should not exceed remaining unallocated funds', async () => {
      prismaMock.incomeEvent.findMany.mockResolvedValue([
        { ...mockIncomeEvent, amount: createDecimal(100) },
      ]);

      prismaMock.category.findMany.mockResolvedValue([
        {
          ...mockCategory,
          goal: {
            goalType: 'monthly_spending',
            targetAmount: createDecimal(500),
          },
        },
      ]);

      prismaMock.category.findFirst.mockResolvedValue({
        ...mockCategory,
        budget: { ...mockBudget, space: mockSpace },
      });
      prismaMock.incomeEvent.findFirst.mockResolvedValue(mockIncomeEvent);
      prismaMock.incomeAllocation.create.mockResolvedValue({});
      prismaMock.category.update.mockResolvedValue(mockCategory);

      const result = await service.autoAllocate(testUserId, testSpaceId);

      expect(result.allocations[0].amount).toBe(100); // Limited by available
    });
  });

  describe('rolloverMonth', () => {
    beforeEach(() => {
      prismaMock.budget.findFirst.mockResolvedValue({
        ...mockBudget,
        categories: [{ ...mockCategory, allocations: [{ amount: createDecimal(500) }] }],
      });
      prismaMock.incomeEvent.findMany.mockResolvedValue([mockIncomeEvent]);
      prismaMock.transaction.findMany.mockResolvedValue([
        { categoryId: testCategoryId, amount: createDecimal(-300) },
      ]);
      prismaMock.category.update.mockResolvedValue(mockCategory);
    });

    it('should require admin access', async () => {
      await service.rolloverMonth(testUserId, testSpaceId, '2025-01', '2025-02');

      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'admin'
      );
    });

    it('should rollover positive balances', async () => {
      const result = await service.rolloverMonth(testUserId, testSpaceId, '2025-01', '2025-02');

      // available = 500 + 50 - 300 = 250
      expect(result.categoriesRolledOver).toBe(1);
      expect(result.totalCarryover).toBe(250);
    });

    it('should update category carryover amounts', async () => {
      await service.rolloverMonth(testUserId, testSpaceId, '2025-01', '2025-02');

      expect(prismaMock.category.update).toHaveBeenCalledWith({
        where: { id: testCategoryId },
        data: { carryoverAmount: { increment: 250 } },
      });
    });

    it('should not rollover negative balances', async () => {
      prismaMock.transaction.findMany.mockResolvedValue([
        { categoryId: testCategoryId, amount: createDecimal(-600) },
      ]);

      const result = await service.rolloverMonth(testUserId, testSpaceId, '2025-01', '2025-02');

      expect(result.categoriesRolledOver).toBe(0);
      expect(result.totalCarryover).toBe(0);
    });

    it('should handle multiple categories', async () => {
      prismaMock.budget.findFirst.mockResolvedValue({
        ...mockBudget,
        categories: [
          { ...mockCategory, id: 'cat-1', allocations: [{ amount: createDecimal(300) }] },
          {
            ...mockCategory,
            id: 'cat-2',
            name: 'Entertainment',
            allocations: [{ amount: createDecimal(200) }],
          },
        ],
      });
      prismaMock.transaction.findMany.mockResolvedValue([
        { categoryId: 'cat-1', amount: createDecimal(-100) },
        { categoryId: 'cat-2', amount: createDecimal(-50) },
      ]);

      const result = await service.rolloverMonth(testUserId, testSpaceId, '2025-01', '2025-02');

      expect(result.categoriesRolledOver).toBe(2);
    });
  });

  describe('setCategoryGoal', () => {
    beforeEach(() => {
      prismaMock.category.findFirst.mockResolvedValue(mockCategory);
      prismaMock.categoryGoal.upsert.mockResolvedValue({});
    });

    it('should set a category goal', async () => {
      const result = await service.setCategoryGoal(testUserId, testSpaceId, testCategoryId, {
        goalType: 'monthly_spending',
        targetAmount: 500,
      });

      expect(result.success).toBe(true);
      expect(prismaMock.categoryGoal.upsert).toHaveBeenCalledWith({
        where: { categoryId: testCategoryId },
        create: expect.objectContaining({
          categoryId: testCategoryId,
          goalType: 'monthly_spending',
          targetAmount: 500,
        }),
        update: expect.objectContaining({
          goalType: 'monthly_spending',
          targetAmount: 500,
        }),
      });
    });

    it('should throw NotFoundException for non-existent category', async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.setCategoryGoal(testUserId, testSpaceId, 'non-existent', {
          goalType: 'monthly_spending',
          targetAmount: 500,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should support target_balance goal type', async () => {
      await service.setCategoryGoal(testUserId, testSpaceId, testCategoryId, {
        goalType: 'target_balance',
        targetAmount: 10000,
        targetDate: new Date('2025-12-31'),
      });

      expect(prismaMock.categoryGoal.upsert).toHaveBeenCalledWith({
        where: { categoryId: testCategoryId },
        create: expect.objectContaining({
          goalType: 'target_balance',
          targetDate: expect.any(Date),
        }),
        update: expect.objectContaining({
          goalType: 'target_balance',
        }),
      });
    });

    it('should support percentage_income goal type', async () => {
      await service.setCategoryGoal(testUserId, testSpaceId, testCategoryId, {
        goalType: 'percentage_income',
        percentageTarget: 20,
      });

      expect(prismaMock.categoryGoal.upsert).toHaveBeenCalledWith({
        where: { categoryId: testCategoryId },
        create: expect.objectContaining({
          goalType: 'percentage_income',
          percentageTarget: 20,
        }),
        update: expect.any(Object),
      });
    });

    it('should include notes when provided', async () => {
      await service.setCategoryGoal(testUserId, testSpaceId, testCategoryId, {
        goalType: 'monthly_spending',
        targetAmount: 500,
        notes: 'Keep grocery spending under control',
      });

      expect(prismaMock.categoryGoal.upsert).toHaveBeenCalledWith({
        where: { categoryId: testCategoryId },
        create: expect.objectContaining({
          notes: 'Keep grocery spending under control',
        }),
        update: expect.any(Object),
      });
    });
  });

  describe('getIncomeEvents', () => {
    beforeEach(() => {
      prismaMock.incomeEvent.findMany.mockResolvedValue([mockIncomeEvent]);
    });

    it('should return income events for a space', async () => {
      const result = await service.getIncomeEvents(testUserId, testSpaceId);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('Salary');
      expect(result[0].amount).toBe(3000);
    });

    it('should filter by start date', async () => {
      const startDate = new Date('2025-01-01');

      await service.getIncomeEvents(testUserId, testSpaceId, {
        startDate,
      });

      const callArgs = prismaMock.incomeEvent.findMany.mock.calls[0][0];
      expect(callArgs.where.spaceId).toBe(testSpaceId);
      expect(callArgs.where.receivedAt.gte).toEqual(startDate);
    });

    it('should filter by end date', async () => {
      const endDate = new Date('2025-01-31');

      await service.getIncomeEvents(testUserId, testSpaceId, {
        endDate,
      });

      const callArgs = prismaMock.incomeEvent.findMany.mock.calls[0][0];
      expect(callArgs.where.spaceId).toBe(testSpaceId);
      expect(callArgs.where.receivedAt.lte).toEqual(endDate);
    });

    it('should respect limit parameter', async () => {
      await service.getIncomeEvents(testUserId, testSpaceId, { limit: 10 });

      expect(prismaMock.incomeEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });

    it('should default to 50 results', async () => {
      await service.getIncomeEvents(testUserId, testSpaceId);

      expect(prismaMock.incomeEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });
  });

  describe('getCategoryGoals', () => {
    beforeEach(() => {
      prismaMock.category.findMany.mockResolvedValue([
        {
          ...mockCategory,
          goal: {
            goalType: 'monthly_spending',
            targetAmount: createDecimal(500),
            targetDate: null,
            monthlyFunding: null,
            percentageTarget: null,
          },
        },
      ]);

      // For getAllocationStatus
      prismaMock.budget.findFirst.mockResolvedValue({
        ...mockBudget,
        categories: [{ ...mockCategory, allocations: [{ amount: createDecimal(250) }] }],
      });
      prismaMock.incomeEvent.findMany.mockResolvedValue([]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
    });

    it('should return category goals with progress', async () => {
      const result = await service.getCategoryGoals(testUserId, testSpaceId);

      expect(result).toHaveLength(1);
      expect(result[0].categoryName).toBe('Groceries');
      expect(result[0].goalType).toBe('monthly_spending');
      expect(result[0].progress).toBe(50); // 250/500 = 50%
    });

    it('should cap progress at 100%', async () => {
      prismaMock.budget.findFirst.mockResolvedValue({
        ...mockBudget,
        categories: [{ ...mockCategory, allocations: [{ amount: createDecimal(750) }] }],
      });

      const result = await service.getCategoryGoals(testUserId, testSpaceId);

      expect(result[0].progress).toBe(100);
    });

    it('should return 0 progress when no target amount', async () => {
      prismaMock.category.findMany.mockResolvedValue([
        {
          ...mockCategory,
          goal: {
            goalType: 'monthly_spending',
            targetAmount: null,
            targetDate: null,
            monthlyFunding: null,
            percentageTarget: null,
          },
        },
      ]);

      const result = await service.getCategoryGoals(testUserId, testSpaceId);

      expect(result[0].progress).toBe(0);
    });
  });

  describe('access control', () => {
    beforeEach(() => {
      prismaMock.budget.findFirst.mockResolvedValue(mockBudget);
      prismaMock.incomeEvent.findMany.mockResolvedValue([]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.category.findMany.mockResolvedValue([]);
    });

    it('should require viewer access for getAllocationStatus', async () => {
      await service.getAllocationStatus(testUserId, testSpaceId);
      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'viewer'
      );
    });

    it('should require member access for createIncomeEvent', async () => {
      prismaMock.incomeEvent.create.mockResolvedValue({
        id: 'test',
        amount: createDecimal(1000),
      });

      await service.createIncomeEvent(testUserId, testSpaceId, {
        amount: 1000,
        currency: 'USD',
        source: 'Test',
        receivedAt: new Date(),
      });

      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'member'
      );
    });

    it('should require member access for allocateToCategory', async () => {
      prismaMock.category.findFirst.mockResolvedValue({
        ...mockCategory,
        budget: { ...mockBudget, space: mockSpace },
      });
      prismaMock.incomeEvent.findFirst.mockResolvedValue(mockIncomeEvent);
      prismaMock.incomeAllocation.create.mockResolvedValue({});
      prismaMock.category.update.mockResolvedValue(mockCategory);

      await service.allocateToCategory(testUserId, testSpaceId, {
        categoryId: testCategoryId,
        amount: 100,
      });

      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'member'
      );
    });

    it('should require admin access for rolloverMonth', async () => {
      await service.rolloverMonth(testUserId, testSpaceId, '2025-01', '2025-02');
      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'admin'
      );
    });

    it('should require viewer access for getIncomeEvents', async () => {
      await service.getIncomeEvents(testUserId, testSpaceId);
      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'viewer'
      );
    });

    it('should require viewer access for getCategoryGoals', async () => {
      await service.getCategoryGoals(testUserId, testSpaceId);
      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'viewer'
      );
    });
  });
});
