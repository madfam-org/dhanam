import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';

import { PrismaService } from '../../src/core/prisma/prisma.service';

import { createE2EApp } from './helpers/e2e-app.helper';
import { TestHelper } from './helpers/test.helper';

/**
 * Admin POS billing E2E — routing preview, timeline, reconciliation, and access control.
 */
describe('Admin POS Billing Journey', () => {
  let app: INestApplication<NestFastifyApplication>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let testHelper: TestHelper;

  let adminToken: string;
  let targetUserId: string;
  let regularToken: string;

  beforeAll(async () => {
    app = await createE2EApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    testHelper = new TestHelper(prisma, jwtService);
    await testHelper.cleanDatabase();
  }, 30000);

  afterAll(async () => {
    await testHelper.cleanDatabase();
    await app.close();
  });

  beforeAll(async () => {
    const admin = await testHelper.createCompleteUserWithSpace({
      email: TestHelper.generateUniqueEmail('pos-admin'),
      password: 'AdminSecure123!',
      name: 'POS Admin',
      isAdmin: true,
    });
    await testHelper.verifyUserEmail(admin.user.id);
    adminToken = admin.authToken;

    const mxUser = await testHelper.createUser({
      email: TestHelper.generateUniqueEmail('pos-mx'),
      password: 'PosUser123!',
      name: 'MX POS User',
    });
    await prisma.user.update({
      where: { id: mxUser.id },
      data: { countryCode: 'MX' },
    });
    targetUserId = mxUser.id;

    const regular = await testHelper.createUser({
      email: TestHelper.generateUniqueEmail('pos-regular'),
      password: 'RegularUser123!',
      name: 'Regular User',
    });
    regularToken = testHelper.generateAuthToken(regular);
  });

  describe('Access control', () => {
    it('blocks non-admin from route preview', async () => {
      await request(app.getHttpServer())
        .post('/v1/admin/billing/route/preview')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ userId: targetUserId, plan: 'pro', countryCode: 'MX' })
        .expect(403);
    });
  });

  describe('Route preview', () => {
    it('returns MX hybrid routing preview for Mexican users', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/admin/billing/route/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: targetUserId,
          plan: 'pro',
          product: 'dhanam',
          countryCode: 'MX',
        })
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });

      expect(response.body.provider).toBeDefined();
      expect(response.body.countryCode).toBe('MX');
      expect(response.body.catalogPlanId).toBe('dhanam_pro');
      expect(typeof response.body.unifiedRoutingEnabled).toBe('boolean');
    });

    it('returns US routing preview', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/admin/billing/route/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: targetUserId,
          plan: 'pro',
          product: 'dhanam',
          countryCode: 'US',
        })
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });

      expect(['paddle', 'legacy_stripe']).toContain(response.body.provider);
      expect(response.body.countryCode).toBe('US');
    });
  });

  describe('Route fee schedule', () => {
    it('returns bundled fee schedule for admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/billing/route/fee-schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.version).toBeDefined();
      expect(['file', 'platform_config']).toContain(response.body.source);
      expect(Array.isArray(response.body.entries)).toBe(true);
      expect(response.body.entries.length).toBeGreaterThan(0);
    });

    it('blocks non-admin from fee schedule endpoints', async () => {
      await request(app.getHttpServer())
        .get('/v1/admin/billing/route/fee-schedule')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    it('upserts and clears platform fee schedule override', async () => {
      const getBundled = await request(app.getHttpServer())
        .get('/v1/admin/billing/route/fee-schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const overrideEntries = getBundled.body.entries.slice(0, 2);

      await request(app.getHttpServer())
        .put('/v1/admin/billing/route/fee-schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          version: 'e2e-fee-schedule',
          entries: overrideEntries,
        })
        .expect(200);

      const overridden = await request(app.getHttpServer())
        .get('/v1/admin/billing/route/fee-schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(overridden.body.source).toBe('platform_config');
      expect(overridden.body.version).toBe('e2e-fee-schedule');
      expect(overridden.body.entries).toHaveLength(2);

      await request(app.getHttpServer())
        .delete('/v1/admin/billing/route/fee-schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const reverted = await request(app.getHttpServer())
        .get('/v1/admin/billing/route/fee-schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(reverted.body.source).toBe('file');
      expect(reverted.body.entries.length).toBeGreaterThan(2);
    });
  });

  describe('Route override', () => {
    it('stores and applies checkout route override', async () => {
      const setResponse = await request(app.getHttpServer())
        .post('/v1/admin/billing/route/override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: targetUserId,
          product: 'dhanam',
          provider: 'paddle',
          reason: 'e2e override drill',
          ttlHours: 1,
        })
        .expect(201);

      expect(setResponse.body.provider).toBe('paddle');

      const preview = await request(app.getHttpServer())
        .post('/v1/admin/billing/route/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: targetUserId,
          plan: 'pro',
          product: 'dhanam',
          countryCode: 'MX',
        })
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });

      expect(preview.body.provider).toBe('paddle');
      expect(preview.body.routeReason).toBe('operator_stored_override');

      await request(app.getHttpServer())
        .post('/v1/admin/billing/route/override/clear')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: targetUserId, product: 'dhanam', reason: 'e2e cleanup' })
        .expect(201);
    });
  });

  describe('Timeline and reconciliation', () => {
    it('returns empty timeline for unknown correlation id', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/billing/pos/timeline/corr-unknown-e2e')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it('returns CFDI uuid on timeline entries when Karafiel correlation exists', async () => {
      const correlationId = `corr-cfdi-e2e-${Date.now()}`;
      await prisma.billingEvent.create({
        data: {
          userId: targetUserId,
          type: 'payment_succeeded',
          status: 'succeeded',
          amount: 199,
          currency: 'MXN',
          metadata: {
            correlationId,
            paymentIntentId: 'pi_cfdi_e2e',
            cfdiUuid: '11111111-2222-3333-4444-555555555555',
          },
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/v1/admin/billing/pos/timeline/${correlationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].cfdiUuid).toBe('11111111-2222-3333-4444-555555555555');
    });

    it('returns reconciliation summary for admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/billing/reconciliation')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('flaggedCount');
      expect(Array.isArray(response.body.recentMismatches)).toBe(true);
    });
  });
});
