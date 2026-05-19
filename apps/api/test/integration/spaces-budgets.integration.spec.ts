import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'argon2';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/core/prisma/prisma.service';

describe('Spaces and Budgets Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;
  let spaceId: string;
  let budgetId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);

    await app.init();

    // Clean database
    await prisma.transaction.deleteMany();
    await prisma.category.deleteMany();
    await prisma.budget.deleteMany();
    await prisma.account.deleteMany();
    await prisma.userSpace.deleteMany();
    await prisma.space.deleteMany();
    await prisma.user.deleteMany();

    // Create test user and login
    const user = await prisma.user.create({
      data: {
        email: 'spaces@example.com',
        passwordHash: await hash('SpacesPass123!'),
        name: 'Spaces Test User',
      },
    });
    userId = user.id;

    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'spaces@example.com',
      password: 'SpacesPass123!',
    });

    accessToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Spaces Workflow', () => {
    it('should create a new space', async () => {
      const response = await request(app.getHttpServer())
        .post('/spaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Personal Budget',
          type: 'personal',
          currency: 'USD',
          timezone: 'America/New_York',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Personal Budget');
      expect(response.body.type).toBe('personal');
      expect(response.body.currency).toBe('USD');
      spaceId = response.body.id;
    });

    it('should list user spaces', async () => {
      const response = await request(app.getHttpServer())
        .get('/spaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(spaceId);
    });

    it('should get specific space', async () => {
      const response = await request(app.getHttpServer())
        .get(`/spaces/${spaceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(spaceId);
      expect(response.body.name).toBe('Personal Budget');
    });
  });

  describe('Budgets Workflow', () => {
    it('should create a budget for the space', async () => {
      const response = await request(app.getHttpServer())
        .post(`/spaces/${spaceId}/budgets`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Monthly Budget',
          period: 'monthly',
          currency: 'USD',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Monthly Budget');
      expect(response.body.period).toBe('monthly');
      budgetId = response.body.id;
    });

    it('should list budgets for space', async () => {
      const response = await request(app.getHttpServer())
        .get(`/spaces/${spaceId}/budgets`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(budgetId);
    });

    it('should get specific budget', async () => {
      const response = await request(app.getHttpServer())
        .get(`/spaces/${spaceId}/budgets/${budgetId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(budgetId);
      expect(response.body.name).toBe('Monthly Budget');
    });
  });

  describe('Categories Workflow', () => {
    let categoryId: string;

    it('should create budget categories', async () => {
      const response = await request(app.getHttpServer())
        .post(`/spaces/${spaceId}/budgets/${budgetId}/categories`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Groceries',
          type: 'expense',
          limit: 500,
          period: 'monthly',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Groceries');
      expect(response.body.type).toBe('expense');
      expect(response.body.limit).toBe(500);
      categoryId = response.body.id;
    });

    it('should list budget categories', async () => {
      const response = await request(app.getHttpServer())
        .get(`/spaces/${spaceId}/budgets/${budgetId}/categories`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(categoryId);
    });

    it('should update category', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/spaces/${spaceId}/budgets/${budgetId}/categories/${categoryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Food & Groceries',
          limit: 600,
        })
        .expect(200);

      expect(response.body.name).toBe('Food & Groceries');
      expect(response.body.limit).toBe(600);
    });
  });

  describe('Budget Analytics', () => {
    it('should get budget overview', async () => {
      const response = await request(app.getHttpServer())
        .get(`/spaces/${spaceId}/budgets/${budgetId}/overview`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalBudget');
      expect(response.body).toHaveProperty('totalSpent');
      expect(response.body).toHaveProperty('categories');
      expect(Array.isArray(response.body.categories)).toBe(true);
    });

    it('should get budget insights', async () => {
      const response = await request(app.getHttpServer())
        .get(`/spaces/${spaceId}/budgets/${budgetId}/insights`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('insights');
      expect(Array.isArray(response.body.insights)).toBe(true);
    });
  });
});
