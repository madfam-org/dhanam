import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Prisma } from '@db';

import { PrismaService } from '../../core/prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';

import { CreateTransactionDto, UpdateTransactionDto, TransactionsFilterDto } from './dto';
import { TransactionsService } from './transactions.service';

// Helper to create Decimal-like mock
const createDecimal = (value: number) => ({
  toNumber: () => value,
  toString: () => value.toString(),
});

describe('TransactionsService', () => {
  let service: TransactionsService;
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

  const mockAccount = {
    id: 'account-123',
    spaceId: mockSpace.id,
    name: 'Checking Account',
    type: 'checking',
    currency: 'USD',
    balance: createDecimal(1000),
  };

  const mockCategory = {
    id: 'category-123',
    budgetId: 'budget-123',
    name: 'Groceries',
  };

  const mockTag1 = { id: 'tag-1', name: 'essential', spaceId: mockSpace.id };
  const mockTag2 = { id: 'tag-2', name: 'personal', spaceId: mockSpace.id };

  const mockTransaction = {
    id: 'txn-123',
    accountId: mockAccount.id,
    amount: createDecimal(-50),
    currency: 'USD',
    date: new Date('2025-06-15'),
    description: 'Grocery shopping',
    merchant: 'Walmart',
    categoryId: mockCategory.id,
    reviewed: false,
    reviewedAt: null,
    excludeFromTotals: false,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    account: mockAccount,
    category: mockCategory,
    tags: [],
  };

  const mockTransactionWithTags = {
    ...mockTransaction,
    tags: [
      { tagId: mockTag1.id, transactionId: mockTransaction.id, tag: mockTag1 },
      { tagId: mockTag2.id, transactionId: mockTransaction.id, tag: mockTag2 },
    ],
  };

  beforeEach(async () => {
    const mockPrisma = {
      transaction: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn(),
      },
      transactionTag: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      account: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      category: {
        findFirst: jest.fn(),
      },
    };

    const mockSpacesService = {
      verifyUserAccess: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SpacesService, useValue: mockSpacesService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get(PrismaService);
    spacesService = module.get(SpacesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('should return paginated transactions for a space', async () => {
      const transactions = [mockTransaction];
      prisma.transaction.findMany.mockResolvedValue(transactions as any);
      prisma.transaction.count.mockResolvedValue(1);

      const filter: TransactionsFilterDto = {};
      const result = await service.findAll(mockSpace.id, mockUser.id, filter);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'viewer'
      );
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { account: { spaceId: mockSpace.id } },
          orderBy: { date: 'desc' },
          skip: 0,
          take: 20,
          include: {
            account: true,
            category: true,
            tags: { include: { tag: true } },
          },
        })
      );
      expect(result).toEqual({ data: transactions, total: 1, page: 1, limit: 20 });
    });

    it('should apply pagination parameters', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const filter: TransactionsFilterDto = { page: 3, limit: 10 };
      const result = await service.findAll(mockSpace.id, mockUser.id, filter);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
    });

    it('should apply accountId filter', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const filter: TransactionsFilterDto = { accountId: 'account-456' };
      await service.findAll(mockSpace.id, mockUser.id, filter);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ accountId: 'account-456' }),
        })
      );
    });

    it('should apply categoryId filter', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const filter: TransactionsFilterDto = { categoryId: 'category-456' };
      await service.findAll(mockSpace.id, mockUser.id, filter);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: 'category-456' }),
        })
      );
    });

    it('should apply startDate filter', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const startDate = new Date('2025-01-01');
      const filter: TransactionsFilterDto = { startDate };
      await service.findAll(mockSpace.id, mockUser.id, filter);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: { gte: startDate },
          }),
        })
      );
    });

    it('should apply endDate filter', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const endDate = new Date('2025-01-31');
      const filter: TransactionsFilterDto = { endDate };
      await service.findAll(mockSpace.id, mockUser.id, filter);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: { lte: endDate },
          }),
        })
      );
    });

    it('should apply minAmount filter', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const filter: TransactionsFilterDto = { minAmount: 10 };
      await service.findAll(mockSpace.id, mockUser.id, filter);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            amount: { gte: 10 },
          }),
        })
      );
    });

    it('should apply maxAmount filter', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const filter: TransactionsFilterDto = { maxAmount: 500 };
      await service.findAll(mockSpace.id, mockUser.id, filter);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            amount: { lte: 500 },
          }),
        })
      );
    });

    it('should apply merchant filter with case-insensitive match', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const filter: TransactionsFilterDto = { merchant: 'walmart' };
      await service.findAll(mockSpace.id, mockUser.id, filter);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            merchant: { contains: 'walmart', mode: 'insensitive' },
          }),
        })
      );
    });

    it('should apply reviewed filter', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const filter: TransactionsFilterDto = { reviewed: false };
      await service.findAll(mockSpace.id, mockUser.id, filter);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ reviewed: false }),
        })
      );
    });

    it('should apply reviewed=true filter', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const filter: TransactionsFilterDto = { reviewed: true };
      await service.findAll(mockSpace.id, mockUser.id, filter);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ reviewed: true }),
        })
      );
    });

    it('should apply tagIds filter', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const filter: TransactionsFilterDto = { tagIds: ['tag-1', 'tag-2'] };
      await service.findAll(mockSpace.id, mockUser.id, filter);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tags: { some: { tagId: { in: ['tag-1', 'tag-2'] } } },
          }),
        })
      );
    });

    it('should not apply tagIds filter for empty array', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const filter: TransactionsFilterDto = { tagIds: [] };
      await service.findAll(mockSpace.id, mockUser.id, filter);

      const calledWith = prisma.transaction.findMany.mock.calls[0][0] as any;
      expect(calledWith.where.tags).toBeUndefined();
    });

    it('should apply search filter across description and merchant', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const filter: TransactionsFilterDto = { search: 'groceries' };
      await service.findAll(mockSpace.id, mockUser.id, filter);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { description: { contains: 'groceries', mode: 'insensitive' } },
              { merchant: { contains: 'groceries', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });

    it('should apply custom sort order', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const filter: TransactionsFilterDto = { sortBy: 'amount', sortOrder: 'asc' };
      await service.findAll(mockSpace.id, mockUser.id, filter);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { amount: 'asc' },
        })
      );
    });

    it('should throw ForbiddenException if user lacks access', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(new ForbiddenException('No access'));

      await expect(service.findAll(mockSpace.id, mockUser.id, {})).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should return empty data array when no transactions exist', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const result = await service.findAll(mockSpace.id, mockUser.id, {});

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    it('should return a single transaction by ID', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransactionWithTags as any);

      const result = await service.findOne(mockSpace.id, mockUser.id, mockTransaction.id);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'viewer'
      );
      expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockTransaction.id,
          account: { spaceId: mockSpace.id },
        },
        include: {
          account: true,
          category: true,
          tags: { include: { tag: true } },
        },
      });
      expect(result).toEqual(mockTransactionWithTags);
    });

    it('should throw NotFoundException if transaction not found', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockSpace.id, mockUser.id, 'nonexistent-id')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException if user lacks access', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(new ForbiddenException('No access'));

      await expect(service.findOne(mockSpace.id, mockUser.id, mockTransaction.id)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should include tags with nested tag objects', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransactionWithTags as any);

      const result = await service.findOne(mockSpace.id, mockUser.id, mockTransaction.id);

      expect(result.tags).toHaveLength(2);
      expect(result.tags[0].tag).toEqual(mockTag1);
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    const createDto: CreateTransactionDto = {
      accountId: 'account-123',
      amount: -75.5,
      date: new Date('2025-06-20'),
      description: 'Dinner at restaurant',
      merchant: 'Olive Garden',
      categoryId: 'category-123',
    };

    it('should create a transaction and update account balance', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.category.findFirst.mockResolvedValue(mockCategory as any);
      prisma.transaction.create.mockResolvedValue({
        ...mockTransaction,
        ...createDto,
        id: 'new-txn-123',
        amount: createDecimal(createDto.amount),
      } as any);
      prisma.account.update.mockResolvedValue(mockAccount as any);

      const result = await service.create(mockSpace.id, mockUser.id, createDto);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'member'
      );
      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { id: createDto.accountId, spaceId: mockSpace.id },
      });
      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { id: createDto.categoryId, budget: { spaceId: mockSpace.id } },
      });
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: createDto.accountId,
          amount: createDto.amount,
          currency: mockAccount.currency,
          date: createDto.date,
          description: createDto.description,
          merchant: createDto.merchant,
          categoryId: createDto.categoryId,
          reviewed: false,
          reviewedAt: null,
        }),
        include: {
          account: true,
          category: true,
          tags: { include: { tag: true } },
        },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: createDto.accountId },
        data: { balance: { increment: createDto.amount } },
      });
      expect(result).toBeDefined();
    });

    it('should create transaction with tagIds', async () => {
      const dtoWithTags: CreateTransactionDto = {
        ...createDto,
        tagIds: ['tag-1', 'tag-2'],
      };

      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.category.findFirst.mockResolvedValue(mockCategory as any);
      prisma.transaction.create.mockResolvedValue(mockTransactionWithTags as any);
      prisma.account.update.mockResolvedValue(mockAccount as any);

      await service.create(mockSpace.id, mockUser.id, dtoWithTags);

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tags: {
            createMany: {
              data: [{ tagId: 'tag-1' }, { tagId: 'tag-2' }],
              skipDuplicates: true,
            },
          },
        }),
        include: expect.any(Object),
      });
    });

    it('should not include tags block when tagIds is empty', async () => {
      const dtoNoTags: CreateTransactionDto = {
        ...createDto,
        tagIds: [],
      };

      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.category.findFirst.mockResolvedValue(mockCategory as any);
      prisma.transaction.create.mockResolvedValue(mockTransaction as any);
      prisma.account.update.mockResolvedValue(mockAccount as any);

      await service.create(mockSpace.id, mockUser.id, dtoNoTags);

      const createCall = prisma.transaction.create.mock.calls[0][0] as any;
      expect(createCall.data.tags).toBeUndefined();
    });

    it('should create transaction with reviewed=true and set reviewedAt', async () => {
      const dtoReviewed: CreateTransactionDto = {
        ...createDto,
        reviewed: true,
      };

      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.category.findFirst.mockResolvedValue(mockCategory as any);
      prisma.transaction.create.mockResolvedValue({
        ...mockTransaction,
        reviewed: true,
        reviewedAt: new Date(),
      } as any);
      prisma.account.update.mockResolvedValue(mockAccount as any);

      await service.create(mockSpace.id, mockUser.id, dtoReviewed);

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reviewed: true,
          reviewedAt: expect.any(Date),
        }),
        include: expect.any(Object),
      });
    });

    it('should default reviewed to false when not provided', async () => {
      const dtoNoReview: CreateTransactionDto = {
        accountId: 'account-123',
        amount: -10,
        date: new Date(),
        description: 'Test',
      };

      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.transaction.create.mockResolvedValue(mockTransaction as any);
      prisma.account.update.mockResolvedValue(mockAccount as any);

      await service.create(mockSpace.id, mockUser.id, dtoNoReview);

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reviewed: false,
          reviewedAt: null,
        }),
        include: expect.any(Object),
      });
    });

    it('should create transaction without category', async () => {
      const dtoNoCategory: CreateTransactionDto = {
        accountId: 'account-123',
        amount: -25,
        date: new Date(),
        description: 'Uncategorized expense',
      };

      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.transaction.create.mockResolvedValue(mockTransaction as any);
      prisma.account.update.mockResolvedValue(mockAccount as any);

      await service.create(mockSpace.id, mockUser.id, dtoNoCategory);

      expect(prisma.category.findFirst).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if account does not belong to space', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.create(mockSpace.id, mockUser.id, createDto)).rejects.toThrow(
        ForbiddenException
      );
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if category does not belong to space', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.create(mockSpace.id, mockUser.id, createDto)).rejects.toThrow(
        ForbiddenException
      );
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user lacks member role', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Requires member role')
      );

      await expect(service.create(mockSpace.id, mockUser.id, createDto)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should pass metadata as InputJsonValue', async () => {
      const dtoWithMetadata: CreateTransactionDto = {
        ...createDto,
        metadata: { source: 'manual', notes: 'important' },
      };

      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.category.findFirst.mockResolvedValue(mockCategory as any);
      prisma.transaction.create.mockResolvedValue(mockTransaction as any);
      prisma.account.update.mockResolvedValue(mockAccount as any);

      await service.create(mockSpace.id, mockUser.id, dtoWithMetadata);

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { source: 'manual', notes: 'important' },
        }),
        include: expect.any(Object),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    const updateDto: UpdateTransactionDto = {
      description: 'Updated description',
      amount: -100,
    };

    beforeEach(() => {
      // findOne is called internally by update; mock findFirst for that
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
    });

    it('should update a transaction', async () => {
      prisma.transaction.update.mockResolvedValue({
        ...mockTransaction,
        description: 'Updated description',
        amount: createDecimal(-100),
      } as any);
      prisma.account.update.mockResolvedValue(mockAccount as any);

      const result = await service.update(mockSpace.id, mockUser.id, mockTransaction.id, updateDto);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'member'
      );
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: mockTransaction.id },
        data: expect.objectContaining({
          description: 'Updated description',
          amount: -100,
        }),
        include: {
          account: true,
          category: true,
          tags: { include: { tag: true } },
        },
      });
      expect(result).toBeDefined();
    });

    it('should update account balance when amount changes', async () => {
      // existing amount is -50, new amount is -100, difference is -50
      prisma.transaction.update.mockResolvedValue({
        ...mockTransaction,
        amount: createDecimal(-100),
      } as any);
      prisma.account.update.mockResolvedValue(mockAccount as any);

      await service.update(mockSpace.id, mockUser.id, mockTransaction.id, { amount: -100 });

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
        data: { balance: { increment: -50 } },
      });
    });

    it('should not update account balance when amount is unchanged', async () => {
      prisma.transaction.update.mockResolvedValue(mockTransaction as any);

      await service.update(mockSpace.id, mockUser.id, mockTransaction.id, {
        amount: -50,
      });

      // amount is same as existing (-50), so no account.update for balance
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it('should replace tags when tagIds is provided', async () => {
      prisma.transactionTag.deleteMany.mockResolvedValue({ count: 1 });
      prisma.transactionTag.createMany.mockResolvedValue({ count: 2 });
      prisma.transaction.update.mockResolvedValue(mockTransactionWithTags as any);

      await service.update(mockSpace.id, mockUser.id, mockTransaction.id, {
        tagIds: ['tag-1', 'tag-2'],
      });

      expect(prisma.transactionTag.deleteMany).toHaveBeenCalledWith({
        where: { transactionId: mockTransaction.id },
      });
      expect(prisma.transactionTag.createMany).toHaveBeenCalledWith({
        data: [
          { transactionId: mockTransaction.id, tagId: 'tag-1' },
          { transactionId: mockTransaction.id, tagId: 'tag-2' },
        ],
        skipDuplicates: true,
      });
    });

    it('should clear all tags when tagIds is empty array', async () => {
      prisma.transactionTag.deleteMany.mockResolvedValue({ count: 2 });
      prisma.transaction.update.mockResolvedValue({
        ...mockTransaction,
        tags: [],
      } as any);

      await service.update(mockSpace.id, mockUser.id, mockTransaction.id, {
        tagIds: [],
      });

      expect(prisma.transactionTag.deleteMany).toHaveBeenCalledWith({
        where: { transactionId: mockTransaction.id },
      });
      expect(prisma.transactionTag.createMany).not.toHaveBeenCalled();
    });

    it('should not touch tags when tagIds is undefined', async () => {
      prisma.transaction.update.mockResolvedValue(mockTransaction as any);

      await service.update(mockSpace.id, mockUser.id, mockTransaction.id, {
        description: 'No tag change',
      });

      expect(prisma.transactionTag.deleteMany).not.toHaveBeenCalled();
      expect(prisma.transactionTag.createMany).not.toHaveBeenCalled();
    });

    it('should update reviewed status and set reviewedAt', async () => {
      prisma.transaction.update.mockResolvedValue({
        ...mockTransaction,
        reviewed: true,
        reviewedAt: new Date(),
      } as any);

      await service.update(mockSpace.id, mockUser.id, mockTransaction.id, {
        reviewed: true,
      });

      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: mockTransaction.id },
        data: expect.objectContaining({
          reviewed: true,
          reviewedAt: expect.any(Date),
        }),
        include: expect.any(Object),
      });
    });

    it('should clear reviewedAt when reviewed is set to false', async () => {
      prisma.transaction.findFirst.mockResolvedValue({
        ...mockTransaction,
        reviewed: true,
        reviewedAt: new Date(),
      } as any);
      prisma.transaction.update.mockResolvedValue({
        ...mockTransaction,
        reviewed: false,
        reviewedAt: null,
      } as any);

      await service.update(mockSpace.id, mockUser.id, mockTransaction.id, {
        reviewed: false,
      });

      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: mockTransaction.id },
        data: expect.objectContaining({
          reviewed: false,
          reviewedAt: null,
        }),
        include: expect.any(Object),
      });
    });

    it('should throw ForbiddenException if category does not belong to space', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(mockSpace.id, mockUser.id, mockTransaction.id, {
          categoryId: 'wrong-category',
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if transaction not found', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        service.update(mockSpace.id, mockUser.id, 'nonexistent', updateDto)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user lacks member role', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Requires member role')
      );

      await expect(
        service.update(mockSpace.id, mockUser.id, mockTransaction.id, updateDto)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------
  describe('remove', () => {
    it('should delete a transaction and update account balance', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.account.update.mockResolvedValue(mockAccount as any);
      prisma.transaction.delete.mockResolvedValue(mockTransaction as any);

      await service.remove(mockSpace.id, mockUser.id, mockTransaction.id);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'member'
      );
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: mockTransaction.accountId },
        data: { balance: { decrement: mockTransaction.amount } },
      });
      expect(prisma.transaction.delete).toHaveBeenCalledWith({
        where: { id: mockTransaction.id },
      });
    });

    it('should throw NotFoundException if transaction not found', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(service.remove(mockSpace.id, mockUser.id, 'nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException if user lacks member role', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Requires member role')
      );

      await expect(service.remove(mockSpace.id, mockUser.id, mockTransaction.id)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  // ---------------------------------------------------------------------------
  // bulkCategorize
  // ---------------------------------------------------------------------------
  describe('bulkCategorize', () => {
    const transactionIds = ['txn-1', 'txn-2', 'txn-3'];
    const categoryId = 'category-123';

    it('should bulk categorize transactions', async () => {
      prisma.category.findFirst.mockResolvedValue(mockCategory as any);
      prisma.transaction.count.mockResolvedValue(3);
      prisma.transaction.updateMany.mockResolvedValue({ count: 3 });
      prisma.transaction.findMany.mockResolvedValue(
        transactionIds.map((id) => ({ ...mockTransaction, id, categoryId })) as any
      );

      const result = await service.bulkCategorize(
        mockSpace.id,
        mockUser.id,
        transactionIds,
        categoryId
      );

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'member'
      );
      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { id: categoryId, budget: { spaceId: mockSpace.id } },
      });
      expect(prisma.transaction.count).toHaveBeenCalledWith({
        where: { id: { in: transactionIds }, account: { spaceId: mockSpace.id } },
      });
      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { id: { in: transactionIds } },
        data: { categoryId },
      });
      expect(result).toHaveLength(3);
    });

    it('should throw ForbiddenException if category does not belong to space', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.bulkCategorize(mockSpace.id, mockUser.id, transactionIds, categoryId)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if some transactions do not belong to space', async () => {
      prisma.category.findFirst.mockResolvedValue(mockCategory as any);
      prisma.transaction.count.mockResolvedValue(2); // Only 2 of 3 found

      await expect(
        service.bulkCategorize(mockSpace.id, mockUser.id, transactionIds, categoryId)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should include tags in returned transactions', async () => {
      prisma.category.findFirst.mockResolvedValue(mockCategory as any);
      prisma.transaction.count.mockResolvedValue(1);
      prisma.transaction.updateMany.mockResolvedValue({ count: 1 });
      prisma.transaction.findMany.mockResolvedValue([mockTransactionWithTags] as any);

      await service.bulkCategorize(mockSpace.id, mockUser.id, ['txn-123'], categoryId);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['txn-123'] } },
        include: {
          account: true,
          category: true,
          tags: { include: { tag: true } },
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // bulkReview
  // ---------------------------------------------------------------------------
  describe('bulkReview', () => {
    const transactionIds = ['txn-1', 'txn-2'];

    it('should bulk mark transactions as reviewed', async () => {
      prisma.transaction.count.mockResolvedValue(2);
      prisma.transaction.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkReview(mockSpace.id, mockUser.id, transactionIds, true);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'member'
      );
      expect(prisma.transaction.count).toHaveBeenCalledWith({
        where: { id: { in: transactionIds }, account: { spaceId: mockSpace.id } },
      });
      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { id: { in: transactionIds } },
        data: {
          reviewed: true,
          reviewedAt: expect.any(Date),
        },
      });
      expect(result).toEqual({ updated: 2 });
    });

    it('should bulk mark transactions as unreviewed', async () => {
      prisma.transaction.count.mockResolvedValue(2);
      prisma.transaction.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkReview(mockSpace.id, mockUser.id, transactionIds, false);

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { id: { in: transactionIds } },
        data: {
          reviewed: false,
          reviewedAt: null,
        },
      });
      expect(result).toEqual({ updated: 2 });
    });

    it('should throw ForbiddenException if some transactions do not belong to space', async () => {
      prisma.transaction.count.mockResolvedValue(1); // Only 1 of 2 found

      await expect(
        service.bulkReview(mockSpace.id, mockUser.id, transactionIds, true)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user lacks member role', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Requires member role')
      );

      await expect(
        service.bulkReview(mockSpace.id, mockUser.id, transactionIds, true)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return zero updated when all transactions already match', async () => {
      prisma.transaction.count.mockResolvedValue(2);
      prisma.transaction.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.bulkReview(mockSpace.id, mockUser.id, transactionIds, true);

      expect(result).toEqual({ updated: 0 });
    });
  });

  // ---------------------------------------------------------------------------
  // getUnreviewedCount
  // ---------------------------------------------------------------------------
  describe('getUnreviewedCount', () => {
    it('should return count of unreviewed transactions', async () => {
      prisma.transaction.count.mockResolvedValue(42);

      const result = await service.getUnreviewedCount(mockSpace.id, mockUser.id);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'viewer'
      );
      expect(prisma.transaction.count).toHaveBeenCalledWith({
        where: {
          account: { spaceId: mockSpace.id },
          reviewed: false,
        },
      });
      expect(result).toBe(42);
    });

    it('should return zero when all transactions are reviewed', async () => {
      prisma.transaction.count.mockResolvedValue(0);

      const result = await service.getUnreviewedCount(mockSpace.id, mockUser.id);

      expect(result).toBe(0);
    });

    it('should throw ForbiddenException if user lacks access', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(new ForbiddenException('No access'));

      await expect(service.getUnreviewedCount(mockSpace.id, mockUser.id)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getMerchants
  // ---------------------------------------------------------------------------
  describe('getMerchants', () => {
    it('should return aggregated merchant list', async () => {
      const groupByResults = [
        {
          merchant: 'Walmart',
          _count: { id: 15 },
          _min: { date: new Date('2024-01-01') },
          _max: { date: new Date('2025-06-15') },
        },
        {
          merchant: 'Target',
          _count: { id: 8 },
          _min: { date: new Date('2024-03-01') },
          _max: { date: new Date('2025-05-20') },
        },
      ];

      prisma.transaction.groupBy.mockResolvedValue(groupByResults as any);

      const result = await service.getMerchants(mockSpace.id, mockUser.id);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'viewer'
      );
      expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
        by: ['merchant'],
        where: {
          account: { spaceId: mockSpace.id },
          merchant: { not: null },
        },
        _count: { id: true },
        _min: { date: true },
        _max: { date: true },
        orderBy: { _count: { id: 'desc' } },
      });
      expect(result).toEqual([
        {
          merchant: 'Walmart',
          count: 15,
          firstDate: new Date('2024-01-01'),
          lastDate: new Date('2025-06-15'),
        },
        {
          merchant: 'Target',
          count: 8,
          firstDate: new Date('2024-03-01'),
          lastDate: new Date('2025-05-20'),
        },
      ]);
    });

    it('should filter out null merchants from results', async () => {
      const groupByResults = [
        {
          merchant: 'Walmart',
          _count: { id: 5 },
          _min: { date: new Date() },
          _max: { date: new Date() },
        },
        {
          merchant: null,
          _count: { id: 3 },
          _min: { date: new Date() },
          _max: { date: new Date() },
        },
      ];

      prisma.transaction.groupBy.mockResolvedValue(groupByResults as any);

      const result = await service.getMerchants(mockSpace.id, mockUser.id);

      expect(result).toHaveLength(1);
      expect(result[0].merchant).toBe('Walmart');
    });

    it('should return empty array when no merchants exist', async () => {
      prisma.transaction.groupBy.mockResolvedValue([] as any);

      const result = await service.getMerchants(mockSpace.id, mockUser.id);

      expect(result).toEqual([]);
    });

    it('should throw ForbiddenException if user lacks access', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(new ForbiddenException('No access'));

      await expect(service.getMerchants(mockSpace.id, mockUser.id)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should order merchants by transaction count descending', async () => {
      prisma.transaction.groupBy.mockResolvedValue([] as any);

      await service.getMerchants(mockSpace.id, mockUser.id);

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { _count: { id: 'desc' } },
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // renameMerchant
  // ---------------------------------------------------------------------------
  describe('renameMerchant', () => {
    it('should rename merchant across all matching transactions', async () => {
      prisma.transaction.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.renameMerchant(mockSpace.id, mockUser.id, 'Wal-Mart', 'Walmart');

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'member'
      );
      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          account: { spaceId: mockSpace.id },
          merchant: 'Wal-Mart',
        },
        data: { merchant: 'Walmart' },
      });
      expect(result).toEqual({ updated: 5 });
    });

    it('should return zero updated when no matching merchants found', async () => {
      prisma.transaction.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.renameMerchant(
        mockSpace.id,
        mockUser.id,
        'NonExistent',
        'NewName'
      );

      expect(result).toEqual({ updated: 0 });
    });

    it('should throw ForbiddenException if user lacks member role', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Requires member role')
      );

      await expect(service.renameMerchant(mockSpace.id, mockUser.id, 'old', 'new')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  // ---------------------------------------------------------------------------
  // mergeMerchants
  // ---------------------------------------------------------------------------
  describe('mergeMerchants', () => {
    it('should merge multiple merchant names into a single target', async () => {
      prisma.transaction.updateMany.mockResolvedValue({ count: 12 });

      const result = await service.mergeMerchants(
        mockSpace.id,
        mockUser.id,
        ['Wal-Mart', 'WalMart', 'WALMART'],
        'Walmart'
      );

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith(
        mockUser.id,
        mockSpace.id,
        'member'
      );
      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          account: { spaceId: mockSpace.id },
          merchant: { in: ['Wal-Mart', 'WalMart', 'WALMART'] },
        },
        data: { merchant: 'Walmart' },
      });
      expect(result).toEqual({ updated: 12 });
    });

    it('should return zero updated when no matching merchants found', async () => {
      prisma.transaction.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.mergeMerchants(
        mockSpace.id,
        mockUser.id,
        ['NonExistent1', 'NonExistent2'],
        'Target'
      );

      expect(result).toEqual({ updated: 0 });
    });

    it('should handle single source name', async () => {
      prisma.transaction.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.mergeMerchants(
        mockSpace.id,
        mockUser.id,
        ['OldName'],
        'NewName'
      );

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          account: { spaceId: mockSpace.id },
          merchant: { in: ['OldName'] },
        },
        data: { merchant: 'NewName' },
      });
      expect(result).toEqual({ updated: 3 });
    });

    it('should throw ForbiddenException if user lacks member role', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(
        new ForbiddenException('Requires member role')
      );

      await expect(
        service.mergeMerchants(mockSpace.id, mockUser.id, ['old'], 'new')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle findAll with all filters combined', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const filter: TransactionsFilterDto = {
        accountId: 'account-123',
        categoryId: 'category-123',
        tagIds: ['tag-1'],
        reviewed: false,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        minAmount: 10,
        maxAmount: 1000,
        merchant: 'Store',
        search: 'food',
        sortBy: 'amount',
        sortOrder: 'asc',
        page: 2,
        limit: 50,
      };

      await service.findAll(mockSpace.id, mockUser.id, filter);

      const calledWith = prisma.transaction.findMany.mock.calls[0][0] as any;
      expect(calledWith.where).toMatchObject({
        account: { spaceId: mockSpace.id },
        accountId: 'account-123',
        categoryId: 'category-123',
        reviewed: false,
      });
      expect(calledWith.where.tags).toEqual({
        some: { tagId: { in: ['tag-1'] } },
      });
      expect(calledWith.orderBy).toEqual({ amount: 'asc' });
      expect(calledWith.skip).toBe(50);
      expect(calledWith.take).toBe(50);
    });

    it('should handle create with all optional fields provided', async () => {
      const fullDto: CreateTransactionDto = {
        accountId: 'account-123',
        amount: -99.99,
        date: new Date('2025-06-20'),
        description: 'Full transaction',
        merchant: 'Test Store',
        categoryId: 'category-123',
        tagIds: ['tag-1', 'tag-2'],
        reviewed: true,
        metadata: { key: 'value' },
      };

      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.category.findFirst.mockResolvedValue(mockCategory as any);
      prisma.transaction.create.mockResolvedValue(mockTransactionWithTags as any);
      prisma.account.update.mockResolvedValue(mockAccount as any);

      const result = await service.create(mockSpace.id, mockUser.id, fullDto);

      expect(result).toBeDefined();
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: fullDto.accountId,
          amount: fullDto.amount,
          currency: 'USD',
          date: fullDto.date,
          description: fullDto.description,
          merchant: fullDto.merchant,
          categoryId: fullDto.categoryId,
          reviewed: true,
          reviewedAt: expect.any(Date),
          metadata: { key: 'value' },
          tags: {
            createMany: {
              data: [{ tagId: 'tag-1' }, { tagId: 'tag-2' }],
              skipDuplicates: true,
            },
          },
        }),
        include: expect.any(Object),
      });
    });

    it('should handle update with both tag changes and amount changes', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.account.update.mockResolvedValue(mockAccount as any);
      prisma.transactionTag.deleteMany.mockResolvedValue({ count: 0 });
      prisma.transactionTag.createMany.mockResolvedValue({ count: 1 });
      prisma.transaction.update.mockResolvedValue({
        ...mockTransaction,
        amount: createDecimal(-200),
        tags: [{ tagId: 'tag-1', transactionId: mockTransaction.id, tag: mockTag1 }],
      } as any);

      await service.update(mockSpace.id, mockUser.id, mockTransaction.id, {
        amount: -200,
        tagIds: ['tag-1'],
      });

      // Balance update: difference = -200 - (-50) = -150
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
        data: { balance: { increment: -150 } },
      });
      expect(prisma.transactionTag.deleteMany).toHaveBeenCalled();
      expect(prisma.transactionTag.createMany).toHaveBeenCalled();
      expect(prisma.transaction.update).toHaveBeenCalled();
    });

    it('should handle bulkReview with a single transaction ID', async () => {
      prisma.transaction.count.mockResolvedValue(1);
      prisma.transaction.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.bulkReview(mockSpace.id, mockUser.id, ['txn-single'], true);

      expect(result).toEqual({ updated: 1 });
    });

    it('should handle mergeMerchants with empty source array', async () => {
      prisma.transaction.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.mergeMerchants(mockSpace.id, mockUser.id, [], 'Target');

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          account: { spaceId: mockSpace.id },
          merchant: { in: [] },
        },
        data: { merchant: 'Target' },
      });
      expect(result).toEqual({ updated: 0 });
    });

    it('should handle getMerchants with null date ranges', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        {
          merchant: 'Store',
          _count: { id: 1 },
          _min: { date: null },
          _max: { date: null },
        },
      ] as any);

      const result = await service.getMerchants(mockSpace.id, mockUser.id);

      expect(result).toEqual([
        {
          merchant: 'Store',
          count: 1,
          firstDate: null,
          lastDate: null,
        },
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // budgetId filter
  // ---------------------------------------------------------------------------
  describe('findAll with budgetId filter', () => {
    it('should filter transactions by budget via category relation', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const filter: TransactionsFilterDto = { budgetId: 'budget-456' };
      await service.findAll(mockSpace.id, mockUser.id, filter);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { budgetId: 'budget-456' },
          }),
        })
      );
    });

    it('should not include category budget filter when budgetId is not provided', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const filter: TransactionsFilterDto = {};
      await service.findAll(mockSpace.id, mockUser.id, filter);

      const calledWith = prisma.transaction.findMany.mock.calls[0][0] as any;
      expect(calledWith.where.category).toBeUndefined();
    });
  });
});
