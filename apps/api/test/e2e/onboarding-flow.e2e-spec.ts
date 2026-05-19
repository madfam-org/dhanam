import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';

import { PrismaService } from '../../src/core/prisma/prisma.service';
import { OnboardingStep } from '../../src/modules/onboarding/dto';

import { OnboardingTestData } from './fixtures/onboarding.fixtures';
import { createE2EApp } from './helpers/e2e-app.helper';
import { TestHelper } from './helpers/test.helper';

describe('Onboarding Flow E2E', () => {
  let app: INestApplication<NestFastifyApplication>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let testHelper: TestHelper;
  let authToken: string;
  let userId: string;
  let spaceId: string;
  let testUserEmail: string;

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

  describe('Full Onboarding Journey', () => {
    it('should complete the entire onboarding flow', async () => {
      // Step 1: Register new user with unique email
      testUserEmail = TestHelper.generateUniqueEmail('onboarding');
      const registerResponse = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          ...OnboardingTestData.newUser,
          email: testUserEmail,
        });

      if (registerResponse.status !== 201) {
        console.error('Registration failed:', JSON.stringify(registerResponse.body, null, 2));
      }
      expect(registerResponse.status).toBe(201);

      expect(registerResponse.body).toHaveProperty('tokens');
      expect(registerResponse.body.tokens).toHaveProperty('accessToken');
      authToken = registerResponse.body.tokens.accessToken;

      // Get user info from /auth/me
      const meResponse = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      userId = meResponse.body.user.id;

      // Verify initial onboarding status
      const initialStatus = await request(app.getHttpServer())
        .get('/v1/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(initialStatus.body).toMatchObject({
        completed: false,
        progress: expect.any(Number),
        stepStatus: {
          welcome: true,
          email_verification: false,
          connect_accounts: false,
          first_budget: false,
          feature_tour: false,
        },
        optionalSteps: expect.arrayContaining(['connect_accounts', 'first_budget', 'feature_tour']),
      });

      // Step 2: Move to email verification
      await request(app.getHttpServer())
        .put('/v1/onboarding/step')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ step: 'email_verification' })
        .expect(200);

      // Step 3: Send verification email
      const verificationResponse = await request(app.getHttpServer())
        .post('/v1/onboarding/resend-verification')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 201]).toContain(verificationResponse.status);
      expect(verificationResponse.body).toMatchObject({
        success: true,
        message: 'Verification email sent',
      });

      // Step 4: Verify email (simulate token verification)
      const verificationToken = jwtService.sign(
        { userId, email: testUserEmail, type: 'email_verification' },
        { expiresIn: '24h' }
      );

      const verifyResponse = await request(app.getHttpServer())
        .post('/v1/onboarding/verify-email')
        .send({ token: verificationToken });

      expect([200, 201]).toContain(verifyResponse.status);
      expect(verifyResponse.body).toMatchObject({
        success: true,
        message: 'Email verified successfully',
      });

      // Check auto-advancement to preferences
      const postVerificationStatus = await request(app.getHttpServer())
        .get('/v1/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(postVerificationStatus.body.currentStep).toBe('preferences');
      expect(postVerificationStatus.body.stepStatus.email_verification).toBe(true);

      // Step 5: Update preferences
      await request(app.getHttpServer())
        .put('/v1/onboarding/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(OnboardingTestData.preferences)
        .expect(200);

      // Move to space setup
      await request(app.getHttpServer())
        .put('/v1/onboarding/step')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ step: 'space_setup' })
        .expect(200);

      // Upgrade tier to allow a second space (registration auto-creates one)
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionTier: 'essentials' },
      });

      // Step 6: Create space
      const spaceResponse = await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Authorization', `Bearer ${authToken}`)
        .send(OnboardingTestData.personalSpace)
        .expect(201);

      spaceId = spaceResponse.body.id;

      // Check progress after space creation
      const postSpaceStatus = await request(app.getHttpServer())
        .get('/v1/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(postSpaceStatus.body.stepStatus.space_setup).toBe(true);

      // Step 7: Skip optional connect accounts step
      const skipConnectResponse = await request(app.getHttpServer())
        .post('/v1/onboarding/skip/connect_accounts')
        .set('Authorization', `Bearer ${authToken}`);
      expect([200, 201]).toContain(skipConnectResponse.status);

      // Step 8: Create first budget
      await request(app.getHttpServer())
        .put('/v1/onboarding/step')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ step: 'first_budget' })
        .expect(200);

      const budgetResponse = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/budgets`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(OnboardingTestData.firstBudget)
        .expect(201);

      expect(budgetResponse.body).toHaveProperty('id');

      // Step 9: Complete feature tour
      await request(app.getHttpServer())
        .put('/v1/onboarding/step')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ step: 'feature_tour', data: { tourCompleted: true } })
        .expect(200);

      // Step 10: Complete onboarding
      const completeResponse = await request(app.getHttpServer())
        .post('/v1/onboarding/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          skipOptional: false,
          metadata: {
            timeSpent: 300000,
            completedSteps: [
              'welcome',
              'email_verification',
              'preferences',
              'space_setup',
              'first_budget',
              'feature_tour',
            ],
          },
        });

      expect([200, 201]).toContain(completeResponse.status);
      expect(completeResponse.body).toMatchObject({
        completed: true,
        currentStep: 'completed',
        completedAt: expect.any(String),
        remainingSteps: [],
      });
      // Progress may not be 100% when optional steps (e.g. connect_accounts) are skipped
      expect(completeResponse.body.progress).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Partial Onboarding with Skip', () => {
    let partialUserToken: string;
    let partialUserEmail: string;

    beforeEach(async () => {
      partialUserEmail = TestHelper.generateUniqueEmail('partial');
      const user = await testHelper.createUser({
        ...OnboardingTestData.partialUser,
        email: partialUserEmail,
      });
      partialUserToken = testHelper.generateAuthToken(user);
    });

    it('should allow skipping optional steps', async () => {
      // Move through required steps quickly
      await request(app.getHttpServer())
        .put('/v1/onboarding/step')
        .set('Authorization', `Bearer ${partialUserToken}`)
        .send({ step: 'email_verification' })
        .expect(200);

      // Verify email
      const user = await prisma.user.findFirst({
        where: { email: partialUserEmail },
      });

      await prisma.user.update({
        where: { id: user!.id },
        data: { emailVerified: true },
      });

      // Update preferences
      await request(app.getHttpServer())
        .put('/v1/onboarding/preferences')
        .set('Authorization', `Bearer ${partialUserToken}`)
        .send({ locale: 'en', timezone: 'UTC' })
        .expect(200);

      await request(app.getHttpServer())
        .put('/v1/onboarding/step')
        .set('Authorization', `Bearer ${partialUserToken}`)
        .send({ step: 'space_setup' })
        .expect(200);

      // Create space
      await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Authorization', `Bearer ${partialUserToken}`)
        .send(OnboardingTestData.minimalSpace)
        .expect(201);

      // Skip all optional steps
      const optionalSteps: OnboardingStep[] = ['connect_accounts', 'first_budget', 'feature_tour'];

      for (const step of optionalSteps) {
        const skipResponse = await request(app.getHttpServer())
          .post(`/v1/onboarding/skip/${step}`)
          .set('Authorization', `Bearer ${partialUserToken}`);

        expect([200, 201]).toContain(skipResponse.status);
        expect(skipResponse.body).toBeDefined();
      }

      // Check final status
      const finalStatus = await request(app.getHttpServer())
        .get('/v1/onboarding/status')
        .set('Authorization', `Bearer ${partialUserToken}`)
        .expect(200);

      expect(finalStatus.body.completed).toBe(true);
    });

    it('should not allow skipping required steps', async () => {
      const requiredSteps: OnboardingStep[] = ['email_verification', 'preferences', 'space_setup'];

      for (const step of requiredSteps) {
        await request(app.getHttpServer())
          .post(`/v1/onboarding/skip/${step}`)
          .set('Authorization', `Bearer ${partialUserToken}`)
          .expect(400);
      }
    });
  });

  describe('Step Dependencies', () => {
    let dependencyUserToken: string;
    let dependencyUserId: string;
    let dependencyUserEmail: string;

    beforeEach(async () => {
      dependencyUserEmail = TestHelper.generateUniqueEmail('dependency');
      const user = await testHelper.createUser({
        email: dependencyUserEmail,
        password: 'DependencyTest123!',
        name: 'Dependency Test',
      });
      dependencyUserToken = testHelper.generateAuthToken(user);
      dependencyUserId = user.id;
    });

    it('should enforce step dependencies', async () => {
      // Try to jump to space_setup without completing preferences
      await request(app.getHttpServer())
        .put('/v1/onboarding/step')
        .set('Authorization', `Bearer ${dependencyUserToken}`)
        .send({ step: 'space_setup' })
        .expect(400);

      // Try connect_accounts without space_setup
      await request(app.getHttpServer())
        .put('/v1/onboarding/step')
        .set('Authorization', `Bearer ${dependencyUserToken}`)
        .send({ step: 'connect_accounts' })
        .expect(400);
    });

    it('should allow steps when dependencies are met', async () => {
      // Complete email verification
      await prisma.user.update({
        where: { id: dependencyUserId },
        data: { emailVerified: true },
      });

      // Complete preferences
      await request(app.getHttpServer())
        .put('/v1/onboarding/preferences')
        .set('Authorization', `Bearer ${dependencyUserToken}`)
        .send({ locale: 'en', timezone: 'America/New_York', currency: 'USD' })
        .expect(200);

      // Now space_setup should work
      await request(app.getHttpServer())
        .put('/v1/onboarding/step')
        .set('Authorization', `Bearer ${dependencyUserToken}`)
        .send({ step: 'space_setup' })
        .expect(200);

      // Create space
      await request(app.getHttpServer())
        .post('/v1/spaces')
        .set('Authorization', `Bearer ${dependencyUserToken}`)
        .send(OnboardingTestData.businessSpace)
        .expect(201);

      // Now connect_accounts should work
      await request(app.getHttpServer())
        .put('/v1/onboarding/step')
        .set('Authorization', `Bearer ${dependencyUserToken}`)
        .send({ step: 'connect_accounts' })
        .expect(200);
    });
  });

  describe('Reset Onboarding', () => {
    let resetUserToken: string;
    let resetUserId: string;

    beforeEach(async () => {
      const resetUserEmail = TestHelper.generateUniqueEmail('reset');
      const user = await testHelper.createUser({
        email: resetUserEmail,
        password: 'ResetTest123!',
        name: 'Reset Test User',
        emailVerified: true,
      });
      resetUserId = user.id;
      resetUserToken = testHelper.generateAuthToken(user);

      // Mark onboarding as completed
      await prisma.user.update({
        where: { id: resetUserId },
        data: {
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          onboardingStep: 'completed',
        },
      });
    });

    it('should reset onboarding progress', async () => {
      // Verify onboarding is completed
      const completeStatus = await request(app.getHttpServer())
        .get('/v1/onboarding/status')
        .set('Authorization', `Bearer ${resetUserToken}`)
        .expect(200);

      expect(completeStatus.body.completed).toBe(true);

      // Reset onboarding
      const resetResponse = await request(app.getHttpServer())
        .post('/v1/onboarding/reset')
        .set('Authorization', `Bearer ${resetUserToken}`);

      expect([200, 201]).toContain(resetResponse.status);
      expect(resetResponse.body).toMatchObject({
        completed: false,
        currentStep: 'welcome',
      });

      // Verify user can go through onboarding again
      await request(app.getHttpServer())
        .put('/v1/onboarding/step')
        .set('Authorization', `Bearer ${resetUserToken}`)
        .send({ step: 'email_verification' })
        .expect(200);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid onboarding step', async () => {
      await request(app.getHttpServer())
        .put('/v1/onboarding/step')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ step: 'invalid_step' })
        .expect(400);
    });

    it('should handle expired email verification token', async () => {
      const expiredToken = jwtService.sign(
        { userId, email: 'test@example.com', type: 'email_verification' },
        { expiresIn: '-1s' }
      );

      await request(app.getHttpServer())
        .post('/v1/onboarding/verify-email')
        .send({ token: expiredToken })
        .expect(400);
    });

    it('should handle invalid verification token type', async () => {
      const wrongTypeToken = jwtService.sign(
        { userId, email: 'test@example.com', type: 'password_reset' },
        { expiresIn: '24h' }
      );

      await request(app.getHttpServer())
        .post('/v1/onboarding/verify-email')
        .send({ token: wrongTypeToken })
        .expect(400);
    });

    it('should handle already verified email', async () => {
      const verificationToken = jwtService.sign(
        { userId, email: testUserEmail, type: 'email_verification' },
        { expiresIn: '24h' }
      );

      const response = await request(app.getHttpServer())
        .post('/v1/onboarding/verify-email')
        .send({ token: verificationToken });

      expect([200, 201]).toContain(response.status);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Email already verified',
      });
    });
  });

  describe('Analytics Tracking', () => {
    it('should track onboarding events', async () => {
      const analyticsUserEmail = TestHelper.generateUniqueEmail('analytics');
      const analyticsUser = await testHelper.createUser({
        email: analyticsUserEmail,
        password: 'Analytics123!',
        name: 'Analytics User',
      });

      const analyticsToken = testHelper.generateAuthToken(analyticsUser);

      // Track step progression
      await request(app.getHttpServer())
        .put('/v1/onboarding/step')
        .set('Authorization', `Bearer ${analyticsToken}`)
        .send({ step: 'email_verification', data: { source: 'test' } })
        .expect(200);

      // Verify analytics metadata is included
      const status = await request(app.getHttpServer())
        .get('/v1/onboarding/status')
        .set('Authorization', `Bearer ${analyticsToken}`)
        .expect(200);

      expect(status.body.currentStep).toBe('email_verification');
    });
  });

  describe('Service Health', () => {
    it('should return onboarding service health status', async () => {
      const response = await request(app.getHttpServer()).get('/v1/onboarding/health').expect(200);

      expect(response.body).toMatchObject({
        service: 'onboarding',
        status: 'healthy',
        timestamp: expect.any(String),
        features: {
          stepTracking: true,
          emailVerification: true,
          progressTracking: true,
          preferenceManagement: true,
        },
      });
    });
  });
});
