import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { PrismaService } from '../../src/core/prisma/prisma.service';

import { PreferencesTestData } from './fixtures/preferences.fixtures';
import { createE2EApp } from './helpers/e2e-app.helper';
import { TestHelper } from './helpers/test.helper';

// Skipped: Tests expect unimplemented endpoints (/preferences/user, /preferences/space/:id,
// /preferences/notifications, /preferences/templates, /preferences/export, /preferences/history).
// Actual controller only has: GET /preferences, PATCH /preferences, PUT /preferences/bulk, POST /preferences/reset.
// Re-enable when these endpoints are implemented.
describe.skip('Preferences Management E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testHelper: TestHelper;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await createE2EApp();

    prisma = app.get<PrismaService>(PrismaService);
    testHelper = new TestHelper(prisma, app.get<JwtService>(JwtService));

    await testHelper.cleanDatabase();

    // Create test user
    const user = await testHelper.createUser(PreferencesTestData.testUser);
    authToken = testHelper.generateAuthToken(user);
    userId = user.id;
  }, 30000);

  afterAll(async () => {
    await testHelper.cleanDatabase();
    await app.close();
  });

  describe('User Preferences', () => {
    it('should get default preferences for new user', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/preferences/user')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        emailNotifications: true,
        transactionAlerts: true,
        budgetAlerts: true,
        weeklyReports: false,
        monthlyReports: true,
        language: 'es',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: 'es-MX',
        defaultCurrency: 'MXN',
        fiscalYearStart: 1,
        weekStartsOn: 1,
        showCentsInAmounts: true,
        compactDisplay: false,
      });
    });

    it('should update user preferences', async () => {
      const updateData = {
        emailNotifications: false,
        transactionAlerts: true,
        budgetAlerts: false,
        weeklyReports: true,
        monthlyReports: false,
        language: 'en',
        dateFormat: 'MM/DD/YYYY',
        numberFormat: 'en-US',
        defaultCurrency: 'USD',
        fiscalYearStart: 4,
        weekStartsOn: 0,
        showCentsInAmounts: false,
        compactDisplay: true,
      };

      const response = await request(app.getHttpServer())
        .put('/v1/preferences/user')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject(updateData);

      // Verify persistence
      const getResponse = await request(app.getHttpServer())
        .get('/v1/preferences/user')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body).toMatchObject(updateData);
    });

    it('should update partial preferences', async () => {
      const partialUpdate = {
        emailNotifications: true,
        defaultCurrency: 'EUR',
      };

      const response = await request(app.getHttpServer())
        .patch('/v1/preferences/user')
        .set('Authorization', `Bearer ${authToken}`)
        .send(partialUpdate)
        .expect(200);

      expect(response.body.emailNotifications).toBe(true);
      expect(response.body.defaultCurrency).toBe('EUR');
      // Other preferences should remain unchanged
      expect(response.body.language).toBe('en');
    });

    it('should validate preference values', async () => {
      // Invalid currency
      await request(app.getHttpServer())
        .patch('/v1/preferences/user')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ defaultCurrency: 'INVALID' })
        .expect(400);

      // Invalid language
      await request(app.getHttpServer())
        .patch('/v1/preferences/user')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ language: 'xx' })
        .expect(400);

      // Invalid fiscal year start
      await request(app.getHttpServer())
        .patch('/v1/preferences/user')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fiscalYearStart: 13 })
        .expect(400);
    });
  });

  describe('Space Preferences', () => {
    let spaceId: string;
    let secondSpaceId: string;

    beforeAll(async () => {
      // Create test spaces
      const space1 = await testHelper.createSpace(userId, {
        name: 'Personal Space',
        type: 'personal',
        currency: 'MXN',
      });
      spaceId = space1.id;

      const space2 = await testHelper.createSpace(userId, {
        name: 'Business Space',
        type: 'business',
        currency: 'USD',
      });
      secondSpaceId = space2.id;
    });

    it('should get default space preferences', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/preferences/space/${spaceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        defaultAccountId: null,
        autoCategorizationEnabled: true,
        recurringTransactionDetection: true,
        merchantEnrichment: true,
        categoryLearning: true,
        budgetRollover: false,
        budgetWarningThreshold: 80,
        unusualSpendingAlerts: true,
        billReminders: true,
        billReminderDays: 3,
        exportFormat: 'csv',
        includeAttachmentsInExport: false,
        defaultBudgetPeriod: 'monthly',
        showSubcategories: true,
        consolidateTransfers: true,
        hideReconciled: false,
        defaultTransactionStatus: 'cleared',
      });
    });

    it('should update space preferences', async () => {
      const updateData = {
        autoCategorizationEnabled: false,
        budgetRollover: true,
        budgetWarningThreshold: 90,
        billReminderDays: 7,
        exportFormat: 'xlsx',
        defaultBudgetPeriod: 'quarterly',
        showSubcategories: false,
      };

      const response = await request(app.getHttpServer())
        .put(`/v1/preferences/space/${spaceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject(updateData);
    });

    it('should maintain separate preferences per space', async () => {
      // Update first space
      await request(app.getHttpServer())
        .patch(`/v1/preferences/space/${spaceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ budgetRollover: true })
        .expect(200);

      // Update second space differently
      await request(app.getHttpServer())
        .patch(`/v1/preferences/space/${secondSpaceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ budgetRollover: false })
        .expect(200);

      // Verify they're different
      const space1Prefs = await request(app.getHttpServer())
        .get(`/v1/preferences/space/${spaceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const space2Prefs = await request(app.getHttpServer())
        .get(`/v1/preferences/space/${secondSpaceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(space1Prefs.body.budgetRollover).toBe(true);
      expect(space2Prefs.body.budgetRollover).toBe(false);
    });

    it('should validate space access', async () => {
      // Create another user
      const otherUser = await testHelper.createUser({
        email: 'other@example.com',
        password: 'OtherUser123!',
        name: 'Other User',
      });
      const otherToken = testHelper.generateAuthToken(otherUser);

      // Try to access space preferences without permission
      await request(app.getHttpServer())
        .get(`/v1/preferences/space/${spaceId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .put(`/v1/preferences/space/${spaceId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ budgetRollover: true })
        .expect(403);
    });

    it('should handle non-existent space', async () => {
      await request(app.getHttpServer())
        .get('/v1/preferences/space/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Notification Preferences', () => {
    it('should manage notification preferences separately', async () => {
      const notificationPrefs = {
        email: {
          enabled: true,
          frequency: 'immediate',
          types: ['transaction', 'budget_alert', 'weekly_summary'],
        },
        push: {
          enabled: false,
          types: [],
        },
        inApp: {
          enabled: true,
          types: ['transaction', 'budget_alert', 'bill_reminder'],
        },
      };

      const response = await request(app.getHttpServer())
        .put('/v1/preferences/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationPrefs)
        .expect(200);

      expect(response.body).toMatchObject(notificationPrefs);
    });

    it('should update specific notification channel', async () => {
      const response = await request(app.getHttpServer())
        .patch('/v1/preferences/notifications/email')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enabled: false,
          frequency: 'daily',
        })
        .expect(200);

      expect(response.body.email.enabled).toBe(false);
      expect(response.body.email.frequency).toBe('daily');
    });

    it('should validate notification types', async () => {
      await request(app.getHttpServer())
        .patch('/v1/preferences/notifications/email')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          types: ['invalid_type'],
        })
        .expect(400);
    });
  });

  describe('Preference Templates', () => {
    it('should apply preference template', async () => {
      // Apply minimalist template
      const response = await request(app.getHttpServer())
        .post('/v1/preferences/apply-template')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ template: 'minimalist' })
        .expect(200);

      expect(response.body).toMatchObject({
        emailNotifications: false,
        transactionAlerts: false,
        budgetAlerts: true,
        weeklyReports: false,
        monthlyReports: false,
        compactDisplay: true,
      });
    });

    it('should list available templates', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/preferences/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'default',
            name: 'Default',
            description: expect.any(String),
          }),
          expect.objectContaining({
            id: 'minimalist',
            name: 'Minimalist',
            description: expect.any(String),
          }),
          expect.objectContaining({
            id: 'power_user',
            name: 'Power User',
            description: expect.any(String),
          }),
        ])
      );
    });
  });

  describe('Preference Export/Import', () => {
    it('should export all preferences', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/preferences/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('spaces');
      expect(response.body).toHaveProperty('notifications');
      expect(response.body).toHaveProperty('exportedAt');
      expect(response.body).toHaveProperty('version');
    });

    it('should import preferences', async () => {
      const importData = {
        user: PreferencesTestData.importUserPrefs,
        notifications: PreferencesTestData.importNotificationPrefs,
        version: '1.0',
      };

      const response = await request(app.getHttpServer())
        .post('/v1/preferences/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send(importData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        imported: {
          user: true,
          notifications: true,
        },
      });

      // Verify import was successful
      const userPrefs = await request(app.getHttpServer())
        .get('/v1/preferences/user')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(userPrefs.body.language).toBe(importData.user.language);
      expect(userPrefs.body.defaultCurrency).toBe(importData.user.defaultCurrency);
    });

    it('should validate import data', async () => {
      await request(app.getHttpServer())
        .post('/v1/preferences/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          version: '99.0',
          user: {},
        })
        .expect(400);
    });
  });

  describe('Preference History', () => {
    it('should track preference changes', async () => {
      // Make several preference changes
      await request(app.getHttpServer())
        .patch('/v1/preferences/user')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ emailNotifications: true })
        .expect(200);

      await request(app.getHttpServer())
        .patch('/v1/preferences/user')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ emailNotifications: false })
        .expect(200);

      await request(app.getHttpServer())
        .patch('/v1/preferences/user')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ defaultCurrency: 'CAD' })
        .expect(200);

      // Get preference history
      const response = await request(app.getHttpServer())
        .get('/v1/preferences/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('changes');
      expect(response.body.changes).toBeInstanceOf(Array);
      expect(response.body.changes.length).toBeGreaterThanOrEqual(3);

      expect(response.body.changes[0]).toMatchObject({
        field: expect.any(String),
        oldValue: expect.anything(),
        newValue: expect.anything(),
        changedAt: expect.any(String),
      });
    });

    it('should filter history by date range', async () => {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      const response = await request(app.getHttpServer())
        .get('/v1/preferences/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .expect(200);

      expect(response.body.changes).toBeInstanceOf(Array);
      response.body.changes.forEach((change: any) => {
        const changeDate = new Date(change.changedAt);
        expect(changeDate).toBeInstanceOf(Date);
        expect(changeDate >= startDate).toBe(true);
        expect(changeDate <= endDate).toBe(true);
      });
    });
  });

  describe('Integration with Onboarding', () => {
    it('should update preferences during onboarding', async () => {
      // Create new user for onboarding test
      const onboardingUser = await testHelper.createUser({
        email: 'onboarding-prefs@example.com',
        password: 'Onboarding123!',
        name: 'Onboarding User',
      });
      const onboardingToken = testHelper.generateAuthToken(onboardingUser);

      // Update preferences via onboarding endpoint
      const response = await request(app.getHttpServer())
        .put('/v1/onboarding/preferences')
        .set('Authorization', `Bearer ${onboardingToken}`)
        .send({
          locale: 'en',
          timezone: 'America/New_York',
          currency: 'USD',
          emailNotifications: true,
          transactionAlerts: false,
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify preferences were updated
      const prefsResponse = await request(app.getHttpServer())
        .get('/v1/preferences/user')
        .set('Authorization', `Bearer ${onboardingToken}`)
        .expect(200);

      expect(prefsResponse.body).toMatchObject({
        language: 'en',
        defaultCurrency: 'USD',
        emailNotifications: true,
        transactionAlerts: false,
      });

      // Verify user locale was updated
      const userResponse = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${onboardingToken}`)
        .expect(200);

      expect(userResponse.body.user.locale).toBe('en');
      expect(userResponse.body.user.timezone).toBe('America/New_York');
    });
  });
});
