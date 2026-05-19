import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'argon2';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/core/prisma/prisma.service';

describe('Financial Providers Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let spaceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);

    await app.init();

    // Clean database and setup test user
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: 'providers@example.com',
        passwordHash: await hash('ProvidersPass123!'),
        name: 'Providers Test User',
      },
    });

    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'providers@example.com',
      password: 'ProvidersPass123!',
    });

    accessToken = loginResponse.body.accessToken;

    // Create test space
    const spaceResponse = await request(app.getHttpServer())
      .post('/spaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Provider Test Space',
        type: 'personal',
        currency: 'USD',
        timezone: 'UTC',
      });

    spaceId = spaceResponse.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Manual Account Management', () => {
    let accountId: string;

    it('should create manual account', async () => {
      const response = await request(app.getHttpServer())
        .post(`/spaces/${spaceId}/accounts`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Chase Checking',
          type: 'checking',
          currency: 'USD',
          balance: 5000,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Chase Checking');
      expect(response.body.provider).toBe('manual');
      accountId = response.body.id;
    });

    it('should list accounts for space', async () => {
      const response = await request(app.getHttpServer())
        .get(`/spaces/${spaceId}/accounts`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(accountId);
    });

    it('should update account', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/spaces/${spaceId}/accounts/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Chase Checking Updated',
          balance: 5500,
        })
        .expect(200);

      expect(response.body.name).toBe('Chase Checking Updated');
      expect(response.body.balance).toBe(5500);
    });
  });

  describe('Provider Connection Endpoints', () => {
    it('should get Plaid link token', async () => {
      const response = await request(app.getHttpServer())
        .get(`/spaces/${spaceId}/accounts/connect/plaid/link-token`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('linkToken');
      expect(response.body).toHaveProperty('expiration');
    });

    it('should handle provider connection mock responses', async () => {
      const response = await request(app.getHttpServer())
        .post(`/spaces/${spaceId}/accounts/connect`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          provider: 'belvo',
        })
        .expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toContain('belvo');
    });
  });

  describe('Transaction Management', () => {
    let transactionId: string;

    it('should create manual transaction', async () => {
      // First get account ID
      const accountsResponse = await request(app.getHttpServer())
        .get(`/spaces/${spaceId}/accounts`)
        .set('Authorization', `Bearer ${accessToken}`);

      const accountId = accountsResponse.body[0].id;

      const response = await request(app.getHttpServer())
        .post(`/spaces/${spaceId}/transactions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accountId,
          amount: -25.5,
          currency: 'USD',
          description: 'Coffee Shop',
          merchant: 'Local Cafe',
          date: '2024-01-15',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.amount).toBe(-25.5);
      expect(response.body.description).toBe('Coffee Shop');
      transactionId = response.body.id;
    });

    it('should list transactions for space', async () => {
      const response = await request(app.getHttpServer())
        .get(`/spaces/${spaceId}/transactions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body.transactions)).toBe(true);
      expect(response.body.transactions).toHaveLength(1);
      expect(response.body.transactions[0].id).toBe(transactionId);
    });

    it('should categorize transaction', async () => {
      // First create a budget and category
      const budgetResponse = await request(app.getHttpServer())
        .post(`/spaces/${spaceId}/budgets`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Budget',
          period: 'monthly',
          currency: 'USD',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        });

      const categoryResponse = await request(app.getHttpServer())
        .post(`/spaces/${spaceId}/budgets/${budgetResponse.body.id}/categories`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Dining',
          type: 'expense',
          limit: 300,
          period: 'monthly',
        });

      const categoryId = categoryResponse.body.id;

      // Update transaction with category
      const response = await request(app.getHttpServer())
        .patch(`/spaces/${spaceId}/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          categoryId,
        })
        .expect(200);

      expect(response.body.categoryId).toBe(categoryId);
    });
  });
});
