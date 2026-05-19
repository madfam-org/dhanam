import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { PrismaService } from '../../src/core/prisma/prisma.service';

import { createE2EApp } from './helpers/e2e-app.helper';
import { TestHelper } from './helpers/test.helper';

describe('Transactions E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let testHelper: TestHelper;
  let authToken: string;
  let userId: string;
  let spaceId: string;
  let accountId: string;
  let transactionId: string;

  beforeAll(async () => {
    app = await createE2EApp();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    testHelper = new TestHelper(prisma, jwtService);

    await testHelper.cleanDatabase();
  }, 30000);

  afterAll(async () => {
    await testHelper.cleanDatabase();
    await app.close();
  });

  describe('Setup', () => {
    it('should create a user with space and account for testing', async () => {
      // Create user with space
      const {
        user,
        space,
        authToken: token,
      } = await testHelper.createCompleteUserWithSpace({
        email: 'transactions-test@example.com',
        password: 'SecurePass123!',
        name: 'Transaction Test User',
        spaceName: 'Test Personal Space',
      });

      authToken = token;
      userId = user.id;
      spaceId = space.id;

      // Verify user email to pass any verification checks
      await testHelper.verifyUserEmail(userId);

      // Create a test account
      const account = await testHelper.createAccount(spaceId, {
        provider: 'manual',
        providerAccountId: 'manual-checking-test',
        name: 'Test Checking Account',
        type: 'checking',
        subtype: 'checking',
        currency: 'MXN',
        balance: 10000,
      });

      accountId = account.id;

      expect(user).toBeDefined();
      expect(space).toBeDefined();
      expect(account).toBeDefined();
    });
  });

  describe('Transaction CRUD Operations', () => {
    describe('POST /v1/spaces/:spaceId/transactions', () => {
      it('should create a new transaction', async () => {
        const transactionData = {
          accountId,
          amount: -250.5,
          description: 'Groceries at Walmart',
          date: new Date().toISOString(),
          currency: 'MXN',
          type: 'expense',
          merchantName: 'Walmart',
        };

        const response = await request(app.getHttpServer())
          .post(`/v1/spaces/${spaceId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(transactionData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(Number(response.body.amount)).toBe(-250.5);
        expect(response.body.description).toBe('Groceries at Walmart');
        expect(response.body.accountId).toBe(accountId);

        transactionId = response.body.id;
      });

      it('should reject transaction without authentication', async () => {
        const transactionData = {
          accountId,
          amount: -100,
          description: 'Test transaction',
          date: new Date().toISOString(),
        };

        await request(app.getHttpServer())
          .post(`/v1/spaces/${spaceId}/transactions`)
          .send(transactionData)
          .expect(401);
      });

      it('should validate required fields', async () => {
        const invalidData = {
          // Missing accountId, amount, description
        };

        await request(app.getHttpServer())
          .post(`/v1/spaces/${spaceId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData)
          .expect(400);
      });

      it('should create an income transaction', async () => {
        const incomeData = {
          accountId,
          amount: 5000,
          description: 'Salary deposit',
          date: new Date().toISOString(),
          currency: 'MXN',
          type: 'income',
        };

        const response = await request(app.getHttpServer())
          .post(`/v1/spaces/${spaceId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(incomeData)
          .expect(201);

        expect(Number(response.body.amount)).toBe(5000);
        // expect(response.body.type).toBe('income');
      });
    });

    describe('GET /v1/spaces/:spaceId/transactions', () => {
      it('should list transactions for the user', async () => {
        const response = await request(app.getHttpServer())
          .get(`/v1/spaces/${spaceId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body.data || response.body)).toBe(true);
        const transactions = response.body.data || response.body;
        expect(transactions.length).toBeGreaterThan(0);
      });

      it('should filter transactions by account', async () => {
        const response = await request(app.getHttpServer())
          .get(`/v1/spaces/${spaceId}/transactions?accountId=${accountId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const transactions = response.body.data || response.body;
        transactions.forEach((tx: any) => {
          expect(tx.accountId).toBe(accountId);
        });
      });

      it('should filter transactions by date range', async () => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        const endDate = new Date();

        const response = await request(app.getHttpServer())
          .get(
            `/v1/spaces/${spaceId}/transactions?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
          )
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const transactions = response.body.data || response.body;
        transactions.forEach((tx: any) => {
          const txDate = new Date(tx.date);
          expect(txDate >= startDate).toBe(true);
          expect(txDate <= endDate).toBe(true);
        });
      });

      it('should paginate results', async () => {
        const response = await request(app.getHttpServer())
          .get(`/v1/spaces/${spaceId}/transactions?page=1&limit=1`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        if (response.body.data) {
          expect(response.body.data.length).toBeLessThanOrEqual(1);
          expect(response.body).toHaveProperty('total');
        }
      });
    });

    describe('GET /v1/spaces/:spaceId/transactions/:id', () => {
      it('should get a specific transaction', async () => {
        const response = await request(app.getHttpServer())
          .get(`/v1/spaces/${spaceId}/transactions/${transactionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.id).toBe(transactionId);
        expect(response.body).toHaveProperty('amount');
        expect(response.body).toHaveProperty('description');
      });

      it('should return 404 for non-existent transaction', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';

        await request(app.getHttpServer())
          .get(`/v1/spaces/${spaceId}/transactions/${fakeId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });

    describe('PATCH /v1/spaces/:spaceId/transactions/:id', () => {
      it('should update a transaction', async () => {
        const updateData = {
          description: 'Updated grocery purchase',
          amount: -275.0,
        };

        const response = await request(app.getHttpServer())
          .patch(`/v1/spaces/${spaceId}/transactions/${transactionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.description).toBe('Updated grocery purchase');
        expect(Number(response.body.amount)).toBe(-275.0);
      });

      it("should not allow updating another user's transaction", async () => {
        // Create another user
        const { authToken: otherToken } = await testHelper.createCompleteUserWithSpace({
          email: 'other-user@example.com',
          password: 'OtherPass123!',
          name: 'Other User',
        });

        await request(app.getHttpServer())
          .patch(`/v1/spaces/${spaceId}/transactions/${transactionId}`)
          .set('Authorization', `Bearer ${otherToken}`)
          .send({ description: 'Hacked!' })
          .expect((res) => {
            // Should be 403 or 404
            expect([403, 404]).toContain(res.status);
          });
      });
    });

    describe('DELETE /v1/spaces/:spaceId/transactions/:id', () => {
      let transactionToDelete: string;

      beforeAll(async () => {
        // Create a transaction to delete
        const tx = await testHelper.createMockTransaction(accountId, {
          amount: -50,
          description: 'Transaction to delete',
        });
        transactionToDelete = tx.id;
      });

      it('should delete a transaction', async () => {
        await request(app.getHttpServer())
          .delete(`/v1/spaces/${spaceId}/transactions/${transactionToDelete}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Verify it's deleted
        await request(app.getHttpServer())
          .get(`/v1/spaces/${spaceId}/transactions/${transactionToDelete}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });
  });

  describe('Transaction Categorization', () => {
    let categoryId: string;
    let budgetId: string;
    let uncategorizedTxId: string;

    beforeAll(async () => {
      // Create a budget and category
      const budget = await testHelper.createBudget(spaceId, {
        name: 'Monthly Budget',
        period: 'monthly',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
      });
      budgetId = budget.id;

      const category = await testHelper.createCategory(budgetId, {
        name: 'Food & Dining',
        budgetedAmount: 5000,
      });
      categoryId = category.id;

      // Create an uncategorized transaction
      const tx = await testHelper.createMockTransaction(accountId, {
        amount: -150,
        description: 'Restaurant dinner',
      });
      uncategorizedTxId = tx.id;
    });

    it('should categorize a transaction', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/transactions/${uncategorizedTxId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ categoryId })
        .expect(200);

      expect(response.body.categoryId).toBe(categoryId);
    });

    it('should uncategorize a transaction', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/transactions/${uncategorizedTxId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ categoryId: null })
        .expect(200);

      expect(response.body.categoryId).toBeNull();
    });
  });

  describe('Bulk Operations', () => {
    let bulkTransactionIds: string[] = [];

    beforeAll(async () => {
      // Create multiple transactions for bulk operations
      for (let i = 0; i < 5; i++) {
        const tx = await testHelper.createMockTransaction(accountId, {
          amount: -10 * (i + 1),
          description: `Bulk test transaction ${i + 1}`,
        });
        bulkTransactionIds.push(tx.id);
      }
    });

    it('should handle bulk categorization', async () => {
      const budget = await testHelper.createBudget(spaceId, {
        name: 'Bulk Test Budget',
        period: 'monthly',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
      });

      const category = await testHelper.createCategory(budget.id, {
        name: 'Bulk Test Category',
        budgetedAmount: 1000,
      });

      const response = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/transactions/bulk-categorize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionIds: bulkTransactionIds.slice(0, 3),
          categoryId: category.id,
        })
        .expect((res) => {
          // Accept 200 or 201
          expect([200, 201]).toContain(res.status);
        });

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
    });
  });

  describe('Transaction Search', () => {
    it('should search transactions by description', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/transactions?search=grocery`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const transactions = response.body.data || response.body;
      if (transactions.length > 0) {
        transactions.forEach((tx: any) => {
          expect(tx.description.toLowerCase()).toContain('grocery');
        });
      }
    });

    it('should search transactions by merchant', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/transactions?merchant=Walmart`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const transactions = response.body.data || response.body;
      if (transactions.length > 0) {
        transactions.forEach((tx: any) => {
          expect((tx.merchantName || tx.merchant || '').toLowerCase()).toContain('walmart');
        });
      }
    });
  });
});
