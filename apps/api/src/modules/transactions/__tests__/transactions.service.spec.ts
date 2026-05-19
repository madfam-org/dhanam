import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { TestDataFactory } from '../../../../test/helpers/test-data-factory';
import { TestDatabase } from '../../../../test/helpers/test-database';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { SpacesService } from '../../spaces/spaces.service';
import { CreateTransactionDto, UpdateTransactionDto, TransactionsFilterDto } from '../dto';
import { TransactionsService } from '../transactions.service';

// Skip integration tests when no test database is available
const describeOrSkip = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeOrSkip('TransactionsService (Integration)', () => {
  let service: TransactionsService;
  let prisma: PrismaService;
  let factory: TestDataFactory;
  let module: TestingModule;

  beforeAll(async () => {
    await TestDatabase.setup();
    prisma = TestDatabase.getClient();
    factory = new TestDataFactory(prisma);

    module = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: SpacesService,
          useValue: {
            verifyUserAccess: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  afterEach(async () => {
    await TestDatabase.cleanup();
  });

  afterAll(async () => {
    await TestDatabase.teardown();
    await module.close();
  });

  describe('findAll', () => {
    it('should return paginated transactions with filters', async () => {
      // Arrange
      const { user, space, account } = await factory.createFullSetup();
      const transaction1 = await factory.createTransaction(account.id, {
        amount: -100,
        date: new Date('2025-01-15'),
      });
      const transaction2 = await factory.createTransaction(account.id, {
        amount: -200,
        date: new Date('2025-01-20'),
      });

      const filter: TransactionsFilterDto = {
        page: 1,
        limit: 10,
      };

      // Act
      const result = await service.findAll(space.id, user.id, filter);

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.data[0].id).toBe(transaction2.id); // Most recent first
      expect(result.data[1].id).toBe(transaction1.id);
    });

    it('should filter by date range', async () => {
      // Arrange
      const { user, space, account } = await factory.createFullSetup();
      await factory.createTransaction(account.id, {
        date: new Date('2025-01-10'),
        description: 'Before range',
      });
      const inRange = await factory.createTransaction(account.id, {
        date: new Date('2025-01-15'),
        description: 'In range',
      });
      await factory.createTransaction(account.id, {
        date: new Date('2025-01-25'),
        description: 'After range',
      });

      const filter: TransactionsFilterDto = {
        startDate: new Date('2025-01-12'),
        endDate: new Date('2025-01-20'),
      };

      // Act
      const result = await service.findAll(space.id, user.id, filter);

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].description).toBe('In range');
    });

    it('should filter by amount range', async () => {
      // Arrange
      const { user, space, account } = await factory.createFullSetup();
      await factory.createTransaction(account.id, { amount: -50 });
      const inRange = await factory.createTransaction(account.id, { amount: -150 });
      await factory.createTransaction(account.id, { amount: -250 });

      const filter: TransactionsFilterDto = {
        minAmount: -200,
        maxAmount: -100,
      };

      // Act
      const result = await service.findAll(space.id, user.id, filter);

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].amount.toNumber()).toBe(-150);
    });

    it('should filter by account ID', async () => {
      // Arrange
      const { user, space } = await factory.createFullSetup();
      const account1 = await factory.createAccount(space.id, { name: 'Account 1' });
      const account2 = await factory.createAccount(space.id, { name: 'Account 2' });
      await factory.createTransaction(account1.id);
      const txn2 = await factory.createTransaction(account2.id);

      const filter: TransactionsFilterDto = {
        accountId: account2.id,
      };

      // Act
      const result = await service.findAll(space.id, user.id, filter);

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].accountId).toBe(account2.id);
    });

    it('should handle pagination correctly', async () => {
      // Arrange
      const { user, space, account } = await factory.createFullSetup();
      // Create 25 transactions
      for (let i = 0; i < 25; i++) {
        await factory.createTransaction(account.id, {
          date: new Date(`2025-01-${String(i + 1).padStart(2, '0')}`),
        });
      }

      const filter: TransactionsFilterDto = {
        page: 2,
        limit: 10,
      };

      // Act
      const result = await service.findAll(space.id, user.id, filter);

      // Assert
      expect(result.data).toHaveLength(10);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
    });
  });

  describe('findOne', () => {
    it('should return a single transaction', async () => {
      // Arrange
      const { user, space, account, transaction } = await factory.createFullSetup();

      // Act
      const result = await service.findOne(space.id, user.id, transaction.id);

      // Assert
      expect(result.id).toBe(transaction.id);
      expect(result.account).toBeDefined();
      expect(result.category).toBeDefined();
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      // Arrange
      const { user, space } = await factory.createFullSetup();

      // Act & Assert
      await expect(service.findOne(space.id, user.id, 'non-existent-id')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException when transaction belongs to different space', async () => {
      // Arrange
      const { user: user1, space: space1, account: account1 } = await factory.createFullSetup();
      const { user: user2, space: space2 } = await factory.createFullSetup();
      const transaction = await factory.createTransaction(account1.id);

      // Act & Assert
      await expect(service.findOne(space2.id, user2.id, transaction.id)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('create', () => {
    it('should create a transaction and update account balance', async () => {
      // Arrange
      const { user, space, account } = await factory.createFullSetup();
      const initialBalance = account.balance.toNumber();

      const dto: CreateTransactionDto = {
        accountId: account.id,
        amount: -100.5,
        date: new Date(),
        description: 'Test expense',
        merchant: 'Test Merchant',
      };

      // Act
      const result = await service.create(space.id, user.id, dto);

      // Assert
      expect(result.amount.toNumber()).toBe(-100.5);
      expect(result.description).toBe('Test expense');
      expect(result.currency).toBe(account.currency);

      // Verify balance updated
      const updatedAccount = await prisma.account.findUnique({
        where: { id: account.id },
      });
      expect(updatedAccount!.balance.toNumber()).toBe(initialBalance - 100.5);
    });

    it('should handle decimal precision correctly', async () => {
      // Arrange
      const { user, space, account } = await factory.createFullSetup();

      const dto: CreateTransactionDto = {
        accountId: account.id,
        amount: -123.456789,
        date: new Date(),
        description: 'Precision test',
      };

      // Act
      const result = await service.create(space.id, user.id, dto);

      // Assert
      // Decimal should preserve precision
      expect(result.amount.toNumber()).toBe(-123.456789);
    });

    it('should throw ForbiddenException when account does not belong to space', async () => {
      // Arrange
      const { user: user1, space: space1 } = await factory.createFullSetup();
      const { account: account2 } = await factory.createFullSetup();

      const dto: CreateTransactionDto = {
        accountId: account2.id,
        amount: -100,
        date: new Date(),
        description: 'Test',
      };

      // Act & Assert
      await expect(service.create(space1.id, user1.id, dto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when category does not belong to space', async () => {
      // Arrange
      const { user: user1, space: space1, account: account1 } = await factory.createFullSetup();
      const { category: category2 } = await factory.createFullSetup();

      const dto: CreateTransactionDto = {
        accountId: account1.id,
        amount: -100,
        date: new Date(),
        description: 'Test',
        categoryId: category2.id,
      };

      // Act & Assert
      await expect(service.create(space1.id, user1.id, dto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update transaction and adjust account balance', async () => {
      // Arrange
      const { user, space, account, transaction } = await factory.createFullSetup();
      const initialBalance = account.balance.toNumber();
      const oldAmount = transaction.amount.toNumber();
      const newAmount = -150.75;

      const dto: UpdateTransactionDto = {
        amount: newAmount,
        description: 'Updated description',
      };

      // Act
      const result = await service.update(space.id, user.id, transaction.id, dto);

      // Assert
      expect(result.amount.toNumber()).toBe(newAmount);
      expect(result.description).toBe('Updated description');

      // Verify balance adjusted by difference
      const updatedAccount = await prisma.account.findUnique({
        where: { id: account.id },
      });
      const expectedBalance = initialBalance + (newAmount - oldAmount);
      expect(updatedAccount!.balance.toNumber()).toBeCloseTo(expectedBalance, 2);
    });

    it('should update description without affecting balance', async () => {
      // Arrange
      const { user, space, account, transaction } = await factory.createFullSetup();
      const initialBalance = account.balance.toNumber();

      const dto: UpdateTransactionDto = {
        description: 'New description only',
      };

      // Act
      await service.update(space.id, user.id, transaction.id, dto);

      // Assert
      const updatedAccount = await prisma.account.findUnique({
        where: { id: account.id },
      });
      expect(updatedAccount!.balance.toNumber()).toBe(initialBalance);
    });

    it('should throw ForbiddenException when category does not belong to space', async () => {
      // Arrange
      const { user, space, transaction } = await factory.createFullSetup();
      const { category: otherCategory } = await factory.createFullSetup();

      const dto: UpdateTransactionDto = {
        categoryId: otherCategory.id,
      };

      // Act & Assert
      await expect(service.update(space.id, user.id, transaction.id, dto)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('remove', () => {
    it('should delete transaction and update account balance', async () => {
      // Arrange
      const { user, space, account, transaction } = await factory.createFullSetup();
      const initialBalance = account.balance.toNumber();
      const transactionAmount = transaction.amount.toNumber();

      // Act
      await service.remove(space.id, user.id, transaction.id);

      // Assert
      // Verify transaction deleted
      const deletedTransaction = await prisma.transaction.findUnique({
        where: { id: transaction.id },
      });
      expect(deletedTransaction).toBeNull();

      // Verify balance restored
      const updatedAccount = await prisma.account.findUnique({
        where: { id: account.id },
      });
      expect(updatedAccount!.balance.toNumber()).toBeCloseTo(initialBalance - transactionAmount, 2);
    });
  });

  describe('bulkCategorize', () => {
    it('should categorize multiple transactions', async () => {
      // Arrange
      const { user, space, account, budget } = await factory.createFullSetup();
      const category = await factory.createCategory(budget.id, { name: 'Food' });
      const txn1 = await factory.createTransaction(account.id);
      const txn2 = await factory.createTransaction(account.id);
      const txn3 = await factory.createTransaction(account.id);

      // Act
      const result = await service.bulkCategorize(
        space.id,
        user.id,
        [txn1.id, txn2.id, txn3.id],
        category.id
      );

      // Assert
      expect(result).toHaveLength(3);
      expect(result.every((txn) => txn.categoryId === category.id)).toBe(true);
    });

    it('should complete in under 2 seconds for 100+ transactions', async () => {
      // Arrange
      const { user, space, account, budget } = await factory.createFullSetup();
      const category = await factory.createCategory(budget.id);

      // Create 150 transactions
      const transactionIds: string[] = [];
      for (let i = 0; i < 150; i++) {
        const txn = await factory.createTransaction(account.id);
        transactionIds.push(txn.id);
      }

      // Act
      const startTime = Date.now();
      await service.bulkCategorize(space.id, user.id, transactionIds, category.id);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(2000); // < 2s requirement
    }, 10000); // Allow extra time for test setup

    it('should throw ForbiddenException when category does not belong to space', async () => {
      // Arrange
      const { user, space, account } = await factory.createFullSetup();
      const { category: otherCategory } = await factory.createFullSetup();
      const txn = await factory.createTransaction(account.id);

      // Act & Assert
      await expect(
        service.bulkCategorize(space.id, user.id, [txn.id], otherCategory.id)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when some transactions do not belong to space', async () => {
      // Arrange
      const {
        user: user1,
        space: space1,
        account: account1,
        category: category1,
      } = await factory.createFullSetup();
      const { account: account2 } = await factory.createFullSetup();

      const txn1 = await factory.createTransaction(account1.id);
      const txn2 = await factory.createTransaction(account2.id);

      // Act & Assert
      await expect(
        service.bulkCategorize(space1.id, user1.id, [txn1.id, txn2.id], category1.id)
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
