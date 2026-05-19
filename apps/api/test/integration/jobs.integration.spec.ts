import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'argon2';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/core/prisma/prisma.service';
import { QueueService } from '../../src/modules/jobs/queue.service';

describe('Jobs System Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let queueService: QueueService;
  let accessToken: string;
  let spaceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    queueService = app.get<QueueService>(QueueService);

    await app.init();

    // Clean database and setup test user
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: 'jobs@example.com',
        passwordHash: await hash('JobsPass123!'),
        name: 'Jobs Test User',
      },
    });

    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'jobs@example.com',
      password: 'JobsPass123!',
    });

    accessToken = loginResponse.body.accessToken;

    // Create test space
    const spaceResponse = await request(app.getHttpServer())
      .post('/spaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Jobs Test Space',
        type: 'personal',
        currency: 'USD',
        timezone: 'UTC',
      });

    spaceId = spaceResponse.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Job Queue Management', () => {
    it('should trigger transaction categorization job', async () => {
      const response = await request(app.getHttpServer())
        .post(`/jobs/categorize`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          spaceId,
          transactionIds: [],
        })
        .expect(200);

      expect(response.body).toHaveProperty('jobId');
      expect(response.body.message).toContain('Categorization job');
    });

    it('should trigger ESG update job', async () => {
      const response = await request(app.getHttpServer())
        .post(`/jobs/esg-update`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          symbols: ['BTC', 'ETH'],
          forceRefresh: false,
        })
        .expect(200);

      expect(response.body).toHaveProperty('jobId');
      expect(response.body.message).toContain('ESG update job');
    });

    it('should trigger valuation snapshot job', async () => {
      const response = await request(app.getHttpServer())
        .post(`/jobs/valuation-snapshot`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          spaceId,
          date: new Date().toISOString(),
        })
        .expect(200);

      expect(response.body).toHaveProperty('jobId');
      expect(response.body.message).toContain('Valuation snapshot job');
    });
  });

  describe('Job Status and Monitoring', () => {
    it('should get job statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/jobs/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('queues');
      expect(Array.isArray(response.body.queues)).toBe(true);
    });

    it('should get queue health', async () => {
      const response = await request(app.getHttpServer())
        .get('/jobs/health')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('queues');
    });
  });

  describe('Manual Job Triggers', () => {
    it('should manually trigger user sync', async () => {
      // This would typically require a provider connection,
      // but we can test the endpoint exists and handles missing connections gracefully
      const response = await request(app.getHttpServer())
        .post('/jobs/manual/user-sync')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          provider: 'belvo',
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should manually trigger space sync', async () => {
      const response = await request(app.getHttpServer())
        .post('/jobs/manual/space-sync')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          spaceId,
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });
});
