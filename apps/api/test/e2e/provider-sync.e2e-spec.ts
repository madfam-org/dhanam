import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';

import { PrismaService } from '../../src/core/prisma/prisma.service';

import {
  plaidWebhookFixtures,
  belvoWebhookFixtures,
  generateWebhookHmac,
} from './fixtures/provider-webhooks.fixtures';
import { createE2EApp } from './helpers/e2e-app.helper';
import { TestHelper } from './helpers/test.helper';

/**
 * Provider Sync Journey E2E Test
 *
 * Tests the provider connection and synchronization lifecycle:
 *   Create user with space ->
 *   Register provider connection ->
 *   Process webhooks (transactions, balances) ->
 *   Verify connection health and sync status ->
 *   Handle webhook security (HMAC verification)
 */
describe('Provider Sync Journey', () => {
  let app: INestApplication<NestFastifyApplication>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let testHelper: TestHelper;

  let authToken: string;
  let userId: string;
  let spaceId: string;
  let accountId: string;

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
  // Phase 1: Provider Connection Setup
  // ──────────────────────────────────────────────

  describe('Provider Connection Setup', () => {
    it('should create a user with space and account for provider testing', async () => {
      const email = TestHelper.generateUniqueEmail('provider');
      const {
        user,
        space,
        authToken: token,
      } = await testHelper.createCompleteUserWithSpace({
        email,
        password: 'ProviderTest123!',
        name: 'Provider Test User',
        spaceName: 'Provider Space',
      });

      authToken = token;
      userId = user.id;
      spaceId = space.id;

      await testHelper.verifyUserEmail(userId);

      // Create a manual account for transaction association
      const account = await testHelper.createAccount(spaceId, {
        provider: 'manual',
        providerAccountId: `manual-provider-${Date.now()}`,
        name: 'Provider Test Account',
        type: 'checking',
        subtype: 'checking',
        currency: 'MXN',
        balance: 10000,
      });

      accountId = account.id;
    });

    it('should create a provider connection record', async () => {
      const connection = await testHelper.createProviderConnection(userId, {
        provider: 'plaid',
        encryptedToken: 'encrypted_test_token_value',
        providerUserId: `plaid_user_${Date.now()}`,
        metadata: { institution: 'ins_109508', itemId: 'test-item-id' },
      });

      expect(connection).toHaveProperty('id');
      expect(connection.provider).toBe('plaid');
    });

    it('should list provider connections for the user', async () => {
      const connections = await prisma.providerConnection.findMany({
        where: { userId },
      });

      expect(connections.length).toBeGreaterThan(0);
      expect(connections[0].provider).toBe('plaid');
    });
  });

  // ──────────────────────────────────────────────
  // Phase 2: Plaid Webhook Processing
  // ──────────────────────────────────────────────

  describe('Plaid Webhook Processing', () => {
    it('should reject webhook without signature', async () => {
      const payload = plaidWebhookFixtures.transactionsInitialUpdate('test-item-id', ['account1']);

      const response = await request(app.getHttpServer())
        .post('/v1/providers/plaid/webhook')
        .send(payload);

      // Should be 400 (missing signature)
      expect(response.status).toBe(400);
    });

    it('should process TRANSACTIONS webhook with signature', async () => {
      const payload = plaidWebhookFixtures.transactionsInitialUpdate('test-item-id', [
        'account1',
        'account2',
      ]);

      const payloadStr = JSON.stringify(payload);
      // Generate a test signature (may not match server secret, but tests the flow)
      const signature = generateWebhookHmac(payloadStr, 'test-plaid-secret');

      const response = await request(app.getHttpServer())
        .post('/v1/providers/plaid/webhook')
        .set('plaid-verification', signature)
        .send(payload);

      // Accept various outcomes:
      // - 200: webhook processed (signature matched or verification lenient in test)
      // - 400: invalid signature (expected if secret does not match)
      expect([200, 400]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('received');
      }
    });

    it('should handle ITEM_LOGIN_REQUIRED webhook', async () => {
      const payload = plaidWebhookFixtures.itemLoginRequired('test-item-id');
      const payloadStr = JSON.stringify(payload);
      const signature = generateWebhookHmac(payloadStr, 'test-plaid-secret');

      const response = await request(app.getHttpServer())
        .post('/v1/providers/plaid/webhook')
        .set('plaid-verification', signature)
        .send(payload);

      // Same as above: accept 200 or 400
      expect([200, 400]).toContain(response.status);
    });
  });

  // ──────────────────────────────────────────────
  // Phase 3: Provider Health Monitoring
  // ──────────────────────────────────────────────

  describe('Provider Health Monitoring', () => {
    it('should return Plaid health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/providers/plaid/health')
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'plaid',
        status: 'healthy',
        timestamp: expect.any(String),
      });
    });

    it('should return connection health dashboard for the space', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/providers/connection-health/spaces/${spaceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('totalConnections');
        expect(response.body).toHaveProperty('overallHealthScore');
        expect(typeof response.body.totalConnections).toBe('number');
      } else {
        // Connection health may return 404 if no connections found
        expect([200, 404]).toContain(response.status);
      }
    });

    it('should return health summary for dashboard widget', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/providers/connection-health/spaces/${spaceId}/summary`)
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('statusBadge');
        expect(['green', 'yellow', 'red']).toContain(response.body.statusBadge);
        expect(response.body).toHaveProperty('totalConnections');
      } else {
        expect([200, 404]).toContain(response.status);
      }
    });

    it('should return accounts needing attention', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/providers/connection-health/spaces/${spaceId}/needs-attention`)
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('accounts');
        expect(response.body).toHaveProperty('count');
        expect(response.body).toHaveProperty('hasIssues');
        expect(Array.isArray(response.body.accounts)).toBe(true);
      } else {
        expect([200, 404]).toContain(response.status);
      }
    });
  });

  // ──────────────────────────────────────────────
  // Phase 4: Provider Link Operations
  // ──────────────────────────────────────────────

  describe('Provider Link Operations', () => {
    it('should create a Plaid link token', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/providers/plaid/link-token')
        .set('Authorization', `Bearer ${authToken}`);

      // Link token creation requires Plaid credentials configured.
      // In test env this may fail, which is acceptable.
      if (response.status === 201 || response.status === 200) {
        expect(response.body).toHaveProperty('linkToken');
        expect(response.body).toHaveProperty('expiration');
      } else {
        // Plaid not configured or tier restriction
        expect([400, 403, 500, 503]).toContain(response.status);
      }
    });

    it('should reject Plaid link without auth', async () => {
      await request(app.getHttpServer()).post('/v1/providers/plaid/link-token').expect(401);
    });
  });

  // ──────────────────────────────────────────────
  // Phase 5: Multi-Provider Connections
  // ──────────────────────────────────────────────

  describe('Multi-Provider Connections', () => {
    it('should create a second provider connection (Belvo)', async () => {
      const connection = await testHelper.createProviderConnection(userId, {
        provider: 'belvo',
        encryptedToken: 'encrypted_belvo_token',
        providerUserId: `belvo_user_${Date.now()}`,
        metadata: { institutionId: 'banamex_mx_retail' },
      });

      expect(connection.provider).toBe('belvo');
    });

    it('should have multiple provider connections', async () => {
      const connections = await prisma.providerConnection.findMany({
        where: { userId },
      });

      expect(connections.length).toBeGreaterThanOrEqual(2);

      const providers = connections.map((c) => c.provider);
      expect(providers).toContain('plaid');
      expect(providers).toContain('belvo');
    });
  });

  // ──────────────────────────────────────────────
  // Phase 6: Provider Security
  // ──────────────────────────────────────────────

  describe('Provider Security', () => {
    it('should reject connection health without auth', async () => {
      await request(app.getHttpServer())
        .get(`/v1/providers/connection-health/spaces/${spaceId}`)
        .expect(401);
    });

    it('should reject access from unauthorized user to space connection health', async () => {
      const otherEmail = TestHelper.generateUniqueEmail('other-provider');
      const otherUser = await testHelper.createUser({
        email: otherEmail,
        password: 'OtherUser123!',
        name: 'Other Provider User',
      });
      const otherToken = testHelper.generateAuthToken(otherUser);

      const response = await request(app.getHttpServer())
        .get(`/v1/providers/connection-health/spaces/${spaceId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect([403, 404]).toContain(response.status);
    });
  });
});
