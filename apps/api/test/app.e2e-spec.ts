import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { PrismaService } from '../src/core/prisma/prisma.service';

import { createE2EApp } from './e2e/helpers/e2e-app.helper';
import { TestHelper } from './e2e/helpers/test.helper';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let testHelper: TestHelper;
  let authToken: string;

  beforeAll(async () => {
    try {
      app = await createE2EApp();

      const prisma = app.get<PrismaService>(PrismaService);
      const jwtService = app.get<JwtService>(JwtService);
      testHelper = new TestHelper(prisma, jwtService);

      await testHelper.cleanDatabase();

      // Create test user via helper (bypasses HIBP check)
      // Use 'essentials' tier to allow creating a second space via HTTP
      const { authToken: token } = await testHelper.createCompleteUserWithSpace({
        email: 'test@example.com',
        password: 'E2eT3st-Str0ng-Pwd!9182',
        name: 'Test User',
        subscriptionTier: 'essentials',
      });

      authToken = token;
    } catch (error) {
      console.error('E2E beforeAll failed:', error);
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    await testHelper.cleanDatabase();
    await app.close();
  });

  it('/v1/monitoring/health (GET)', () => {
    return request(app.getHttpServer()).get('/v1/monitoring/health').expect(200);
  });

  describe('/auth', () => {
    it('/auth/register (POST)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'E2eT3st-Str0ng-Pwd!9182',
          name: 'New User',
          locale: 'en',
          timezone: 'UTC',
        })
        .expect(201);

      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('expiresIn');
      // refreshToken is only in httpOnly cookie, not in body
    });

    it('/auth/login (POST)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'E2eT3st-Str0ng-Pwd!9182',
        })
        .expect(200);

      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('expiresIn');
      // refreshToken is only in httpOnly cookie, not in body
    });

    it('/auth/me (GET)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
    });
  });

  describe('/spaces', () => {
    let spaceId: string;

    it('/spaces (POST)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Space 2',
          type: 'personal',
          currency: 'USD',
          timezone: 'UTC',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Space 2');
      spaceId = response.body.id;
    });

    it('/spaces (GET)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/spaces')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('/spaces/:id (GET)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(spaceId);
      expect(response.body.name).toBe('Test Space 2');
    });
  });
});
