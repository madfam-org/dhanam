import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';

import { SplitTransactionDto, UpdateSplitDto } from './dto/split-transaction.dto';
import { TransactionSplitsService } from './transaction-splits.service';

describe('TransactionSplitsService', () => {
  let service: TransactionSplitsService;
  let prisma: jest.Mocked<PrismaService>;
  let logger: jest.Mocked<LoggerService>;

  const mockSpace = {
    id: 'space-123',
    name: 'Family Space',
    type: 'personal',
  };

  const mockAccount = {
    id: 'account-123',
    spaceId: mockSpace.id,
    name: 'Joint Checking',
    type: 'checking',
  };

  const mockTransaction = {
    id: 'txn-123',
    accountId: mockAccount.id,
    amount: -100,
    currency: 'USD',
    description: 'Grocery shopping',
    date: new Date('2025-01-15'),
    isSplit: false,
    account: mockAccount,
  };

  const mockUser1 = {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
  };

  const mockUser2 = {
    id: 'user-2',
    name: 'Bob',
    email: 'bob@example.com',
  };

  beforeEach(async () => {
    const mockPrisma = {
      transaction: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      transactionSplit: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((operations) => Promise.all(operations)),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionSplitsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<TransactionSplitsService>(TransactionSplitsService);
    prisma = module.get(PrismaService);
    logger = module.get(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('splitTransaction', () => {
    const splitDto: SplitTransactionDto = {
      splits: [
        { userId: 'user-1', amount: 60, percentage: 60, note: 'Alice share' },
        { userId: 'user-2', amount: 40, percentage: 40, note: 'Bob share' },
      ],
    };

    it('should split a transaction between two users', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.transactionSplit.deleteMany.mockResolvedValue({ count: 0 });

      const createdSplits = [
        { ...splitDto.splits[0], transactionId: 'txn-123', user: mockUser1 },
        { ...splitDto.splits[1], transactionId: 'txn-123', user: mockUser2 },
      ];

      (prisma.$transaction as jest.Mock).mockResolvedValue(createdSplits);
      prisma.transaction.update.mockResolvedValue({ ...mockTransaction, isSplit: true } as any);

      const result = await service.splitTransaction(
        mockSpace.id,
        mockTransaction.id,
        mockUser1.id,
        splitDto
      );

      expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockTransaction.id,
          account: { spaceId: mockSpace.id },
        },
        include: { account: true },
      });

      expect(prisma.transactionSplit.deleteMany).toHaveBeenCalledWith({
        where: { transactionId: mockTransaction.id },
      });

      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: mockTransaction.id },
        data: { isSplit: true },
      });

      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(60);
      expect(result[1].amount).toBe(40);
      expect(logger.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if transaction does not exist', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        service.splitTransaction(mockSpace.id, 'wrong-id', mockUser1.id, splitDto)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if split amounts do not match transaction total', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);

      const invalidSplitDto: SplitTransactionDto = {
        splits: [
          { userId: 'user-1', amount: 30, percentage: 30 },
          { userId: 'user-2', amount: 40, percentage: 40 },
        ],
      };

      await expect(
        service.splitTransaction(mockSpace.id, mockTransaction.id, mockUser1.id, invalidSplitDto)
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow 0.01 tolerance for floating point precision', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.transactionSplit.deleteMany.mockResolvedValue({ count: 0 });
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);
      prisma.transaction.update.mockResolvedValue({ ...mockTransaction, isSplit: true } as any);

      // 60 + 40.009 = 100.009, within 0.01 tolerance
      const almostValidDto: SplitTransactionDto = {
        splits: [
          { userId: 'user-1', amount: 60, percentage: 60 },
          { userId: 'user-2', amount: 40.009, percentage: 40.009 },
        ],
      };

      await service.splitTransaction(
        mockSpace.id,
        mockTransaction.id,
        mockUser1.id,
        almostValidDto
      );

      expect(prisma.transaction.update).toHaveBeenCalled();
    });

    it('should handle 50/50 split', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.transactionSplit.deleteMany.mockResolvedValue({ count: 0 });
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);
      prisma.transaction.update.mockResolvedValue({ ...mockTransaction, isSplit: true } as any);

      const evenSplitDto: SplitTransactionDto = {
        splits: [
          { userId: 'user-1', amount: 50, percentage: 50 },
          { userId: 'user-2', amount: 50, percentage: 50 },
        ],
      };

      await service.splitTransaction(mockSpace.id, mockTransaction.id, mockUser1.id, evenSplitDto);

      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: mockTransaction.id },
        data: { isSplit: true },
      });
    });

    it('should handle uneven splits (e.g., 70/30)', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.transactionSplit.deleteMany.mockResolvedValue({ count: 0 });
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);
      prisma.transaction.update.mockResolvedValue({ ...mockTransaction, isSplit: true } as any);

      const unevenSplitDto: SplitTransactionDto = {
        splits: [
          { userId: 'user-1', amount: 70, percentage: 70 },
          { userId: 'user-2', amount: 30, percentage: 30 },
        ],
      };

      await service.splitTransaction(
        mockSpace.id,
        mockTransaction.id,
        mockUser1.id,
        unevenSplitDto
      );

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should handle splits among 3+ users', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.transactionSplit.deleteMany.mockResolvedValue({ count: 0 });
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);
      prisma.transaction.update.mockResolvedValue({ ...mockTransaction, isSplit: true } as any);

      const multiUserSplitDto: SplitTransactionDto = {
        splits: [
          { userId: 'user-1', amount: 40, percentage: 40 },
          { userId: 'user-2', amount: 35, percentage: 35 },
          { userId: 'user-3', amount: 25, percentage: 25 },
        ],
      };

      await service.splitTransaction(
        mockSpace.id,
        mockTransaction.id,
        mockUser1.id,
        multiUserSplitDto
      );

      const calls = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      expect(calls).toHaveLength(3);
    });

    it('should delete existing splits before creating new ones', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.transactionSplit.deleteMany.mockResolvedValue({ count: 2 }); // Had 2 existing splits
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);
      prisma.transaction.update.mockResolvedValue({ ...mockTransaction, isSplit: true } as any);

      await service.splitTransaction(mockSpace.id, mockTransaction.id, mockUser1.id, splitDto);

      // Verify deleteMany was called before $transaction by checking invocation order
      const deleteManyCallOrder = (prisma.transactionSplit.deleteMany as jest.Mock).mock
        .invocationCallOrder[0];
      const transactionCallOrder = (prisma.$transaction as jest.Mock).mock.invocationCallOrder[0];
      expect(deleteManyCallOrder).toBeLessThan(transactionCallOrder);
    });
  });

  describe('getTransactionSplits', () => {
    it('should return all splits for a transaction', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);

      const splits = [
        { userId: 'user-1', amount: 60, percentage: 60, user: mockUser1, transactionId: 'txn-123' },
        { userId: 'user-2', amount: 40, percentage: 40, user: mockUser2, transactionId: 'txn-123' },
      ];

      prisma.transactionSplit.findMany.mockResolvedValue(splits as any);

      const result = await service.getTransactionSplits(mockSpace.id, mockTransaction.id);

      expect(prisma.transactionSplit.findMany).toHaveBeenCalledWith({
        where: { transactionId: mockTransaction.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { amount: 'desc' },
      });

      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(60);
      expect(result[1].amount).toBe(40);
    });

    it('should throw NotFoundException if transaction does not exist', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(service.getTransactionSplits(mockSpace.id, 'wrong-id')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should return empty array if no splits exist', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.transactionSplit.findMany.mockResolvedValue([]);

      const result = await service.getTransactionSplits(mockSpace.id, mockTransaction.id);

      expect(result).toEqual([]);
    });

    it('should order splits by amount descending', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.transactionSplit.findMany.mockResolvedValue([] as any);

      await service.getTransactionSplits(mockSpace.id, mockTransaction.id);

      expect(prisma.transactionSplit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { amount: 'desc' },
        })
      );
    });
  });

  describe('updateSplit', () => {
    const updateDto: UpdateSplitDto = {
      amount: 65,
      percentage: 65,
      note: 'Updated share',
    };

    const existingSplit = {
      transactionId: 'txn-123',
      userId: 'user-1',
      amount: 60,
      percentage: 60,
      note: 'Old share',
    };

    it('should update an existing split', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.transactionSplit.findUnique.mockResolvedValue(existingSplit as any);
      prisma.transactionSplit.update.mockResolvedValue({
        ...existingSplit,
        ...updateDto,
        user: mockUser1,
      } as any);

      const result = await service.updateSplit(
        mockSpace.id,
        mockTransaction.id,
        mockUser1.id,
        mockUser1.id,
        updateDto
      );

      expect(prisma.transactionSplit.update).toHaveBeenCalledWith({
        where: {
          transactionId_userId: {
            transactionId: mockTransaction.id,
            userId: mockUser1.id,
          },
        },
        data: {
          amount: updateDto.amount,
          percentage: updateDto.percentage,
          note: updateDto.note,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      expect(result.amount).toBe(65);
      expect(logger.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if transaction does not exist', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSplit(mockSpace.id, 'wrong-id', mockUser1.id, mockUser1.id, updateDto)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if split does not exist', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.transactionSplit.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSplit(mockSpace.id, mockTransaction.id, 'wrong-user', mockUser1.id, updateDto)
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow partial updates', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.transactionSplit.findUnique.mockResolvedValue(existingSplit as any);
      prisma.transactionSplit.update.mockResolvedValue({
        ...existingSplit,
        note: 'Updated note only',
        user: mockUser1,
      } as any);

      const partialDto: UpdateSplitDto = {
        note: 'Updated note only',
      };

      await service.updateSplit(
        mockSpace.id,
        mockTransaction.id,
        mockUser1.id,
        mockUser1.id,
        partialDto
      );

      expect(prisma.transactionSplit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            amount: undefined,
            percentage: undefined,
            note: 'Updated note only',
          },
        })
      );
    });
  });

  describe('removeSplit', () => {
    it('should remove all splits and mark transaction as not split', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.transactionSplit.deleteMany.mockResolvedValue({ count: 2 });
      prisma.transaction.update.mockResolvedValue({ ...mockTransaction, isSplit: false } as any);

      await service.removeSplit(mockSpace.id, mockTransaction.id, mockUser1.id);

      expect(prisma.transactionSplit.deleteMany).toHaveBeenCalledWith({
        where: { transactionId: mockTransaction.id },
      });

      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: mockTransaction.id },
        data: { isSplit: false },
      });

      expect(logger.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if transaction does not exist', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(service.removeSplit(mockSpace.id, 'wrong-id', mockUser1.id)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should succeed even if no splits existed', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.transactionSplit.deleteMany.mockResolvedValue({ count: 0 });
      prisma.transaction.update.mockResolvedValue({ ...mockTransaction, isSplit: false } as any);

      await service.removeSplit(mockSpace.id, mockTransaction.id, mockUser1.id);

      expect(prisma.transaction.update).toHaveBeenCalled();
    });
  });

  describe('getUserSplitTransactions', () => {
    it('should return all split transactions for a user', async () => {
      const userSplits = [
        {
          userId: 'user-1',
          amount: 60,
          percentage: 60,
          transactionId: 'txn-123',
          user: mockUser1,
          transaction: {
            id: 'txn-123',
            amount: -100,
            description: 'Groceries',
            date: new Date('2025-01-15'),
            account: { id: 'acc-1', name: 'Joint Checking', type: 'checking' },
            category: { id: 'cat-1', name: 'Food', icon: '🍔', color: '#ff0000' },
          },
        },
        {
          userId: 'user-1',
          amount: 30,
          percentage: 30,
          transactionId: 'txn-124',
          user: mockUser1,
          transaction: {
            id: 'txn-124',
            amount: -50,
            description: 'Dinner',
            date: new Date('2025-01-14'),
            account: { id: 'acc-1', name: 'Joint Checking', type: 'checking' },
            category: { id: 'cat-1', name: 'Food', icon: '🍔', color: '#ff0000' },
          },
        },
      ];

      prisma.transactionSplit.findMany.mockResolvedValue(userSplits as any);

      const result = await service.getUserSplitTransactions(mockSpace.id, mockUser1.id);

      expect(prisma.transactionSplit.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser1.id,
          transaction: {
            account: { spaceId: mockSpace.id },
          },
        },
        include: {
          transaction: {
            include: {
              account: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                },
              },
              category: {
                select: {
                  id: true,
                  name: true,
                  icon: true,
                  color: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          transaction: {
            date: 'desc',
          },
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(60);
    });

    it('should return empty array if user has no split transactions', async () => {
      prisma.transactionSplit.findMany.mockResolvedValue([]);

      const result = await service.getUserSplitTransactions(mockSpace.id, mockUser1.id);

      expect(result).toEqual([]);
    });

    it('should order results by transaction date descending', async () => {
      prisma.transactionSplit.findMany.mockResolvedValue([] as any);

      await service.getUserSplitTransactions(mockSpace.id, mockUser1.id);

      expect(prisma.transactionSplit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            transaction: {
              date: 'desc',
            },
          },
        })
      );
    });

    it('should only return splits for the specified space', async () => {
      prisma.transactionSplit.findMany.mockResolvedValue([] as any);

      await service.getUserSplitTransactions(mockSpace.id, mockUser1.id);

      expect(prisma.transactionSplit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            transaction: {
              account: { spaceId: mockSpace.id },
            },
          }),
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle decimal amounts correctly', async () => {
      const decimalTransaction = {
        ...mockTransaction,
        amount: -123.45,
      };

      prisma.transaction.findFirst.mockResolvedValue(decimalTransaction as any);
      prisma.transactionSplit.deleteMany.mockResolvedValue({ count: 0 });
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);
      prisma.transaction.update.mockResolvedValue({ ...decimalTransaction, isSplit: true } as any);

      const decimalSplitDto: SplitTransactionDto = {
        splits: [
          { userId: 'user-1', amount: 61.73, percentage: 50 },
          { userId: 'user-2', amount: 61.72, percentage: 50 },
        ],
      };

      await service.splitTransaction(
        mockSpace.id,
        decimalTransaction.id,
        mockUser1.id,
        decimalSplitDto
      );

      expect(prisma.transaction.update).toHaveBeenCalled();
    });

    it('should handle very small split amounts', async () => {
      const smallTransaction = {
        ...mockTransaction,
        amount: -1,
      };

      prisma.transaction.findFirst.mockResolvedValue(smallTransaction as any);
      prisma.transactionSplit.deleteMany.mockResolvedValue({ count: 0 });
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);
      prisma.transaction.update.mockResolvedValue({ ...smallTransaction, isSplit: true } as any);

      const smallSplitDto: SplitTransactionDto = {
        splits: [
          { userId: 'user-1', amount: 0.5, percentage: 50 },
          { userId: 'user-2', amount: 0.5, percentage: 50 },
        ],
      };

      await service.splitTransaction(
        mockSpace.id,
        smallTransaction.id,
        mockUser1.id,
        smallSplitDto
      );

      expect(prisma.transaction.update).toHaveBeenCalled();
    });

    it('should handle splits with notes', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction as any);
      prisma.transactionSplit.deleteMany.mockResolvedValue({ count: 0 });
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);
      prisma.transaction.update.mockResolvedValue({ ...mockTransaction, isSplit: true } as any);

      const splitWithNotesDto: SplitTransactionDto = {
        splits: [
          { userId: 'user-1', amount: 60, percentage: 60, note: 'Alice paid more' },
          { userId: 'user-2', amount: 40, percentage: 40, note: 'Bob owes Alice' },
        ],
      };

      await service.splitTransaction(
        mockSpace.id,
        mockTransaction.id,
        mockUser1.id,
        splitWithNotesDto
      );

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
