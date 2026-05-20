import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';

import { PrismaService } from '../../src/core/prisma/prisma.service';

import { createE2EApp } from './helpers/e2e-app.helper';
import { TestHelper } from './helpers/test.helper';

/**
 * Admin Operations Journey E2E Test
 *
 * Tests administrative operations:
 *   Admin access control (guard enforcement) ->
 *   User management (list, view) ->
 *   Audit log retrieval ->
 *   GDPR compliance (export, delete) ->
 *   Security boundary enforcement
 *
 * Note: AdminGuard checks the platform-admin boundary. Space owner/admin roles
 * do not grant access to global operations.
 */
describe('Admin Operations Journey', () => {
  let app: INestApplication<NestFastifyApplication>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let testHelper: TestHelper;

  let adminToken: string;
  let adminUserId: string;
  let regularToken: string;
  let regularUserId: string;
  let targetUserId: string;

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
  // Phase 1: Admin Access Control
  // ──────────────────────────────────────────────

  describe('Admin Access Control', () => {
    it('should create a platform admin user with a space', async () => {
      const adminEmail = TestHelper.generateUniqueEmail('admin');

      const { user, space, authToken } = await testHelper.createCompleteUserWithSpace({
        email: adminEmail,
        password: 'AdminSecure123!',
        name: 'Admin User',
        isAdmin: true,
      });

      await testHelper.verifyUserEmail(user.id);

      adminUserId = user.id;
      adminToken = authToken;

      expect(adminUserId).toBeTruthy();
      expect(adminToken).toBeTruthy();
      expect(user.isAdmin).toBe(true);
      expect(space.id).toBeTruthy();
    });

    it('should allow admin to access GET /admin/users', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should create a regular user without a space', async () => {
      const regularEmail = TestHelper.generateUniqueEmail('regular');
      const user = await testHelper.createUser({
        email: regularEmail,
        password: 'RegularUser123!',
        name: 'Regular User',
      });

      regularUserId = user.id;
      regularToken = testHelper.generateAuthToken(user);
    });

    it('should block regular user from GET /admin/users', async () => {
      await request(app.getHttpServer())
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });
  });

  // ──────────────────────────────────────────────
  // Phase 2: User Management
  // ──────────────────────────────────────────────

  describe('User Management', () => {
    beforeAll(async () => {
      // Create a target user for management operations
      const targetEmail = TestHelper.generateUniqueEmail('target');
      const targetUser = await testHelper.createUser({
        email: targetEmail,
        password: 'TargetUser123!',
        name: 'Target User',
      });
      targetUserId = targetUser.id;
    });

    it('should list users with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Pagination metadata
      if (response.body.total !== undefined) {
        expect(response.body.total).toBeGreaterThanOrEqual(response.body.data.length);
      }
    });

    it('should get specific user details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(targetUserId);
      expect(response.body.name).toBe('Target User');
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .get(`/v1/admin/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // ──────────────────────────────────────────────
  // Phase 3: System Stats and Audit Logs
  // ──────────────────────────────────────────────

  describe('System Stats and Audit Logs', () => {
    it('should return system stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should list audit logs', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter audit logs by page', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/audit-logs?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });
  });

  // ──────────────────────────────────────────────
  // Phase 4: GDPR Compliance (Admin GDPR endpoints)
  // ──────────────────────────────────────────────

  describe('GDPR Compliance', () => {
    let gdprTargetUserId: string;

    beforeAll(async () => {
      const gdprEmail = TestHelper.generateUniqueEmail('gdpr-target');
      const gdprUser = await testHelper.createUser({
        email: gdprEmail,
        password: 'GDPRTarget123!',
        name: 'GDPR Target User',
      });
      gdprTargetUserId = gdprUser.id;
    });

    it('should export user data via admin GDPR endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/admin/gdpr/export/${gdprTargetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Accept 200 or 202 for async export
      expect([200, 202]).toContain(response.status);
      expect(response.body).toBeDefined();
    });

    it('should queue user deletion via admin GDPR endpoint', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/admin/gdpr/delete/${gdprTargetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 201, 202]).toContain(response.status);
      expect(response.body).toBeDefined();
    });

    it('should verify user is deactivated or scheduled for deletion', async () => {
      const user = await prisma.user.findUnique({
        where: { id: gdprTargetUserId },
      });

      // User should either be gone or marked inactive/deleted
      if (user) {
        // Still exists but may be soft-deleted
        expect(user.isActive === false || user.deletedAt !== null).toBe(true);
      }
      // If user is null, hard deletion already occurred
    });
  });

  // ──────────────────────────────────────────────
  // Phase 5: Admin System Operations
  // ──────────────────────────────────────────────

  describe('Admin System Operations', () => {
    it('should return system health', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should return feature flags list', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return onboarding funnel analytics', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/analytics/onboarding-funnel')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────
  // Phase 6: Admin Endpoint Security
  // ──────────────────────────────────────────────

  describe('Admin Endpoint Security', () => {
    const adminEndpoints = [
      { method: 'get' as const, url: '/v1/admin/users' },
      { method: 'get' as const, url: '/v1/admin/stats' },
      { method: 'get' as const, url: '/v1/admin/audit-logs' },
      { method: 'get' as const, url: '/v1/admin/health' },
      { method: 'get' as const, url: '/v1/admin/feature-flags' },
    ];

    it('should return 403 for all admin endpoints with regular user', async () => {
      for (const endpoint of adminEndpoints) {
        const response = await request(app.getHttpServer())
          [endpoint.method](endpoint.url)
          .set('Authorization', `Bearer ${regularToken}`);

        expect(response.status).toBe(403);
      }
    });

    it('should return 401 for all admin endpoints without auth', async () => {
      for (const endpoint of adminEndpoints) {
        const response = await request(app.getHttpServer())[endpoint.method](endpoint.url);

        expect(response.status).toBe(401);
      }
    });
  });
});
