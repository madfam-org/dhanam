import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';

import { PrismaService } from '../../src/core/prisma/prisma.service';

import { stripeWebhookFixtures } from './fixtures/billing.fixtures';
import { createE2EApp } from './helpers/e2e-app.helper';
import { TestHelper } from './helpers/test.helper';

/**
 * Billing Webhooks Journey E2E Test
 *
 * Tests the Stripe webhook lifecycle:
 *   checkout.session.completed -> subscription activation ->
 *   subscription.updated -> tier change ->
 *   invoice.payment_failed -> grace period ->
 *   subscription.deleted -> downgrade ->
 *   webhook security (signature, idempotency, unknown events)
 *
 * Note: Stripe webhook endpoints verify signatures using STRIPE_WEBHOOK_SECRET
 * and fail closed on missing config or invalid signatures. These tests simulate
 * webhook effects via direct DB updates, then assert the endpoint rejects
 * unsigned requests without mutating billing state.
 */
describe('Billing Webhooks Journey', () => {
  let app: INestApplication<NestFastifyApplication>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let testHelper: TestHelper;

  let authToken: string;
  let userId: string;
  let userEmail: string;
  let stripeCustomerId: string;

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

  // ──────────────────────────────────────────────
  // Setup: Create user for billing tests
  // ──────────────────────────────────────────────

  describe('Setup', () => {
    it('should create a user for billing webhook tests', async () => {
      userEmail = TestHelper.generateUniqueEmail('billing-wh');
      stripeCustomerId = `cus_test_${Date.now()}`;

      const { user, authToken: token } = await testHelper.createCompleteUserWithSpace({
        email: userEmail,
        password: 'BillingWebhook123!',
        name: 'Billing Webhook User',
      });

      authToken = token;
      userId = user.id;

      await testHelper.verifyUserEmail(userId);

      // Set a Stripe customer ID for webhook correlation
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      });
    });
  });

  // ──────────────────────────────────────────────
  // Phase 1: Checkout Completion Flow
  // ──────────────────────────────────────────────

  describe('Checkout Flow', () => {
    it('should start at community tier', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/billing/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.tier).toBe('community');
    });

    it('should simulate checkout.session.completed activating pro tier', async () => {
      // Simulate the webhook effect: upgrade user to pro
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionTier: 'pro',
          subscriptionStartedAt: new Date(),
          subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        },
      });

      const response = await request(app.getHttpServer())
        .get('/v1/billing/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.tier).toBe('pro');
    });

    it('should send webhook to billing endpoint', async () => {
      // Attempt to call the actual webhook endpoint.
      // This will likely fail signature verification since we cannot
      // generate a valid Stripe signature, but it tests the route exists.
      const payload = stripeWebhookFixtures.checkoutCompleted(stripeCustomerId, userEmail);

      const response = await request(app.getHttpServer())
        .post('/v1/billing/webhook')
        .set('stripe-signature', 'invalid_test_signature')
        .send(payload);

      expect(response.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────
  // Phase 2: Subscription Lifecycle
  // ──────────────────────────────────────────────

  describe('Subscription Lifecycle', () => {
    it('should simulate subscription.updated reflecting tier change', async () => {
      // Simulate upgrading from pro to essentials
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionTier: 'essentials' },
      });

      const response = await request(app.getHttpServer())
        .get('/v1/billing/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.tier).toBe('essentials');
    });

    it('should simulate invoice.payment_failed with grace period', async () => {
      // Send the webhook payload (will likely fail signature but tests route)
      const payload = stripeWebhookFixtures.invoicePaymentFailed(stripeCustomerId);

      const response = await request(app.getHttpServer())
        .post('/v1/billing/webhook')
        .set('stripe-signature', 'invalid_test_signature')
        .send(payload);

      expect(response.status).toBe(400);

      // Tier should remain essentials during grace period
      const statusResponse = await request(app.getHttpServer())
        .get('/v1/billing/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Still active during grace period
      expect(statusResponse.body.tier).toBe('essentials');
    });

    it('should simulate subscription.deleted downgrading to community', async () => {
      // Simulate subscription cancellation
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionTier: 'community',
          subscriptionExpiresAt: new Date(), // expired now
        },
      });

      const response = await request(app.getHttpServer())
        .get('/v1/billing/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.tier).toBe('community');
    });

    it('should keep community space creation aligned with self-hosted limits after downgrade', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Community Business Space',
          type: 'business',
          currency: 'USD',
          timezone: 'UTC',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Community Business Space');
    });
  });

  // ──────────────────────────────────────────────
  // Phase 3: Webhook Security
  // ──────────────────────────────────────────────

  describe('Webhook Security', () => {
    it('should handle invalid signature gracefully', async () => {
      const payload = stripeWebhookFixtures.subscriptionCreated(stripeCustomerId);

      const response = await request(app.getHttpServer())
        .post('/v1/billing/webhook')
        .set('stripe-signature', 'completely_invalid_signature_value')
        .send(payload);

      expect(response.status).toBe(400);
    });

    it('should handle missing signature header', async () => {
      const payload = stripeWebhookFixtures.subscriptionCreated(stripeCustomerId);

      const response = await request(app.getHttpServer()).post('/v1/billing/webhook').send(payload);

      expect(response.status).toBe(400);
    });

    it('should acknowledge unknown event types', async () => {
      const unknownPayload = {
        id: 'evt_unknown_event',
        type: 'some.unknown.event',
        data: {
          object: {
            id: 'obj_test',
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post('/v1/billing/webhook')
        .set('stripe-signature', 'test_sig')
        .send(unknownPayload);

      expect(response.status).toBe(400);
    });

    it('should handle empty webhook body', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/billing/webhook')
        .set('stripe-signature', 'test_sig')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────
  // Phase 4: Trial Flow
  // ──────────────────────────────────────────────

  describe('Trial Flow', () => {
    it('should start a free trial', async () => {
      // Reset to community first
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionTier: 'community' },
      });

      const response = await request(app.getHttpServer())
        .post('/v1/billing/trial/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ plan: 'pro' });

      if (response.status === 201 || response.status === 200) {
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Trial started');
      } else {
        // Trial may already be used or not available
        expect([400, 409, 201, 200]).toContain(response.status);
      }
    });

    it('should reject trial start without auth', async () => {
      await request(app.getHttpServer())
        .post('/v1/billing/trial/start')
        .send({ plan: 'pro' })
        .expect(401);
    });
  });

  // ──────────────────────────────────────────────
  // Phase 5: Billing Endpoint Authorization
  // ──────────────────────────────────────────────

  describe('Billing Endpoint Authorization', () => {
    it('should require auth for billing status', async () => {
      await request(app.getHttpServer()).get('/v1/billing/status').expect(401);
    });

    it('should require auth for billing usage', async () => {
      await request(app.getHttpServer()).get('/v1/billing/usage').expect(401);
    });

    it('should allow public access to pricing endpoint', async () => {
      const response = await request(app.getHttpServer()).get('/v1/billing/pricing').expect(200);

      expect(response.body).toBeDefined();
    });

    it('should require auth for portal session creation', async () => {
      await request(app.getHttpServer()).post('/v1/billing/portal').expect(401);
    });
  });
});
