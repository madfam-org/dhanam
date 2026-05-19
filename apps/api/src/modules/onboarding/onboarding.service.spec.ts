import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { Currency } from '@db';

import { AuditService } from '../../core/audit/audit.service';
import { CryptoService } from '../../core/crypto/crypto.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PreferencesService } from '../preferences/preferences.service';

import {
  UpdateOnboardingStepDto,
  CompleteOnboardingDto,
  UpdatePreferencesDto,
  VerifyEmailDto,
  OnboardingStep,
} from './dto';
import { OnboardingAnalytics } from './onboarding.analytics';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let prisma: PrismaService;
  let configService: ConfigService;
  let jwtService: JwtService;
  let emailService: EmailService;
  let auditService: AuditService;
  let analytics: OnboardingAnalytics;
  let preferencesService: PreferencesService;

  const mockUserId = 'test-user-123';
  const mockEmail = 'test@example.com';
  const mockToken = 'test-jwt-token';

  const mockUser = {
    id: mockUserId,
    email: mockEmail,
    name: 'Test User',
    locale: 'es',
    timezone: 'America/Mexico_City',
    emailVerified: false,
    onboardingCompleted: false,
    onboardingStep: 'welcome',
    onboardingCompletedAt: null,
    userSpaces: [],
    providerConnections: [],
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    space: {
      update: jest.fn(),
    },
    auditLog: {
      count: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        JWT_SECRET: 'test-secret',
        WEB_URL: 'https://app.example.com',
      };
      return config[key];
    }),
  };

  const mockJwtService = {
    sign: jest.fn(() => mockToken),
    verify: jest.fn(),
  };

  const mockEmailService = {
    sendEmailVerification: jest.fn(),
    sendOnboardingComplete: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
    logEvent: jest.fn().mockResolvedValue(undefined),
  };

  const mockAnalytics = {
    trackStepCompleted: jest.fn(),
    trackOnboardingCompleted: jest.fn(),
    trackPreferencesUpdated: jest.fn(),
    trackEmailVerificationSent: jest.fn(),
    trackEmailVerificationCompleted: jest.fn(),
  };

  const mockPreferencesService = {
    updateUserPreferences: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CryptoService, useValue: {} },
        { provide: AuditService, useValue: mockAuditService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: OnboardingAnalytics, useValue: mockAnalytics },
        { provide: PreferencesService, useValue: mockPreferencesService },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
    prisma = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
    jwtService = module.get<JwtService>(JwtService);
    emailService = module.get<EmailService>(EmailService);
    auditService = module.get<AuditService>(AuditService);
    analytics = module.get<OnboardingAnalytics>(OnboardingAnalytics);
    preferencesService = module.get<PreferencesService>(PreferencesService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('getOnboardingStatus', () => {
    it('should return onboarding status for new user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        userSpaces: [],
        providerConnections: [],
      });

      const result = await service.getOnboardingStatus(mockUserId);

      expect(result).toMatchObject({
        completed: false,
        currentStep: 'welcome',
        completedAt: null,
        progress: expect.any(Number),
        stepStatus: {
          welcome: true,
          email_verification: false,
          preferences: false,
          space_setup: false,
          connect_accounts: false,
          first_budget: false,
          feature_tour: false,
        },
        remainingSteps: expect.arrayContaining([
          'email_verification',
          'preferences',
          'space_setup',
        ]),
        optionalSteps: expect.arrayContaining(['connect_accounts', 'first_budget', 'feature_tour']),
      });
    });

    it('should return correct status for partially completed onboarding', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        emailVerified: true,
        onboardingStep: 'preferences',
        userSpaces: [
          {
            space: {
              id: 'space-1',
              currency: 'MXN',
              accounts: [],
              budgets: [],
            },
          },
        ],
        providerConnections: [],
      });

      const result = await service.getOnboardingStatus(mockUserId);

      expect(result.stepStatus.email_verification).toBe(true);
      expect(result.stepStatus.space_setup).toBe(true);
      expect(result.progress).toBeGreaterThan(0);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getOnboardingStatus(mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should calculate 100% progress for completed onboarding', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        emailVerified: true,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        onboardingStep: 'completed',
        locale: 'en',
        timezone: 'UTC',
        userSpaces: [
          {
            space: {
              currency: 'USD',
              accounts: [{}],
              budgets: [{}],
            },
          },
        ],
        providerConnections: [{}],
      });

      const result = await service.getOnboardingStatus(mockUserId);

      expect(result.completed).toBe(true);
      expect(result.progress).toBe(100);
      expect(result.remainingSteps).toHaveLength(0);
    });
  });

  describe('updateOnboardingStep', () => {
    const validStepDto: UpdateOnboardingStepDto = {
      step: 'preferences' as OnboardingStep,
      data: { locale: 'en' },
    };

    it('should update onboarding step successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        emailVerified: true,
      });
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        onboardingStep: 'preferences',
      });

      const result = await service.updateOnboardingStep(mockUserId, validStepDto);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          onboardingStep: 'preferences',
          updatedAt: expect.any(Date),
        },
      });
      expect(mockAuditService.logEvent).toHaveBeenCalledWith({
        action: 'onboarding_step_updated',
        resource: 'user',
        resourceId: mockUserId,
        userId: mockUserId,
        metadata: {
          step: 'preferences',
          data: { locale: 'en' },
        },
      });
      expect(mockAnalytics.trackStepCompleted).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid step', async () => {
      const invalidStepDto = {
        step: 'invalid_step' as OnboardingStep,
      };

      await expect(service.updateOnboardingStep(mockUserId, invalidStepDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should enforce step dependencies', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
        userSpaces: [],
      });

      const dto: UpdateOnboardingStepDto = {
        step: 'connect_accounts' as OnboardingStep,
      };

      await expect(service.updateOnboardingStep(mockUserId, dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should auto-complete onboarding when reaching completed step', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
      });

      const dto: UpdateOnboardingStepDto = {
        step: 'completed' as OnboardingStep,
      };

      await service.updateOnboardingStep(mockUserId, dto);

      expect(mockPrismaService.user.update).toHaveBeenCalledTimes(2); // Once for step, once for completion
    });
  });

  describe('completeOnboarding', () => {
    it('should complete onboarding successfully', async () => {
      const completedAt = new Date();
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        onboardingCompleted: true,
        onboardingCompletedAt: completedAt,
        onboardingStep: 'completed',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        onboardingCompleted: true,
      });

      const dto: CompleteOnboardingDto = {
        skipOptional: true,
        metadata: { timeSpent: 300 },
      };

      const result = await service.completeOnboarding(mockUserId, dto);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          onboardingCompleted: true,
          onboardingCompletedAt: expect.any(Date),
          onboardingStep: 'completed',
          updatedAt: expect.any(Date),
        },
      });
      expect(mockEmailService.sendOnboardingComplete).toHaveBeenCalled();
      expect(mockAuditService.logEvent).toHaveBeenCalledWith({
        action: 'onboarding_completed',
        resource: 'user',
        resourceId: mockUserId,
        userId: mockUserId,
        metadata: expect.objectContaining({
          skipOptional: true,
          completedAt: expect.any(String),
          timeSpent: 300,
        }),
      });
      expect(mockAnalytics.trackOnboardingCompleted).toHaveBeenCalledWith(mockUserId, 300);
      expect(result.completed).toBe(true);
    });

    it('should handle email service errors gracefully', async () => {
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        onboardingCompleted: true,
      });
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockEmailService.sendOnboardingComplete.mockRejectedValue(new Error('Email service error'));

      const result = await service.completeOnboarding(mockUserId, {});

      // Should not throw, just log the error
      expect(result).toBeTruthy();
    });
  });

  describe('updatePreferences', () => {
    const preferencesDto: UpdatePreferencesDto = {
      locale: 'en',
      timezone: 'America/New_York',
      currency: Currency.USD,
      emailNotifications: true,
      transactionAlerts: true,
    };

    it('should update user preferences successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        userSpaces: [
          {
            space: {
              id: 'space-1',
              type: 'personal',
              currency: 'MXN',
            },
          },
        ],
      });
      mockPrismaService.user.update.mockResolvedValue(mockUser);
      mockPrismaService.space.update.mockResolvedValue({});
      mockPreferencesService.updateUserPreferences.mockResolvedValue({});

      const result = await service.updatePreferences(mockUserId, preferencesDto);

      expect(result.success).toBe(true);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          locale: 'en',
          timezone: 'America/New_York',
        },
      });
      expect(mockPrismaService.space.update).toHaveBeenCalledWith({
        where: { id: 'space-1' },
        data: { currency: Currency.USD },
      });
      expect(mockPreferencesService.updateUserPreferences).toHaveBeenCalled();
      expect(mockAnalytics.trackPreferencesUpdated).toHaveBeenCalled();
    });

    it('should handle user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.updatePreferences(mockUserId, preferencesDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should skip updates when no data provided', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.updatePreferences(mockUserId, {});

      expect(result.success).toBe(true);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('sendEmailVerification', () => {
    it('should send verification email successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.sendEmailVerification(mockUserId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Verification email sent');
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          userId: mockUserId,
          email: mockEmail,
          type: 'email_verification',
        },
        {
          secret: 'test-secret',
          expiresIn: '24h',
        }
      );
      expect(mockEmailService.sendEmailVerification).toHaveBeenCalledWith(mockUserId, {
        verificationToken: mockToken,
        verificationUrl: `https://app.example.com/verify-email?token=${mockToken}`,
      });
      expect(mockAuditService.logEvent).toHaveBeenCalled();
      expect(mockAnalytics.trackEmailVerificationSent).toHaveBeenCalled();
    });

    it('should return early if email already verified', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        emailVerified: true,
      });

      const result = await service.sendEmailVerification(mockUserId);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Email already verified');
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.sendEmailVerification(mockUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyEmail', () => {
    const verifyDto: VerifyEmailDto = {
      token: mockToken,
    };

    it('should verify email successfully', async () => {
      const payload = {
        userId: mockUserId,
        email: mockEmail,
        type: 'email_verification',
      };
      mockJwtService.verify.mockReturnValue(payload);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        emailVerified: true,
      });

      const result = await service.verifyEmail(verifyDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Email verified successfully');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          emailVerified: true,
          updatedAt: expect.any(Date),
        },
      });
      expect(mockAuditService.logEvent).toHaveBeenCalled();
      expect(mockAnalytics.trackEmailVerificationCompleted).toHaveBeenCalled();
    });

    it('should auto-advance onboarding step after verification', async () => {
      const payload = {
        userId: mockUserId,
        email: mockEmail,
        type: 'email_verification',
      };
      mockJwtService.verify.mockReturnValue(payload);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        onboardingStep: 'email_verification',
      });
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        emailVerified: true,
      });

      await service.verifyEmail(verifyDto);

      // Should call updateOnboardingStep internally
      expect(mockPrismaService.user.update).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException for invalid token type', async () => {
      mockJwtService.verify.mockReturnValue({
        userId: mockUserId,
        type: 'password_reset', // Wrong type
      });

      await expect(service.verifyEmail(verifyDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for email mismatch', async () => {
      mockJwtService.verify.mockReturnValue({
        userId: mockUserId,
        email: 'different@example.com',
        type: 'email_verification',
      });
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.verifyEmail(verifyDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle expired tokens', async () => {
      mockJwtService.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await expect(service.verifyEmail(verifyDto)).rejects.toThrow(BadRequestException);
    });

    it('should return early if email already verified', async () => {
      mockJwtService.verify.mockReturnValue({
        userId: mockUserId,
        email: mockEmail,
        type: 'email_verification',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        emailVerified: true,
      });

      const result = await service.verifyEmail(verifyDto);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Email already verified');
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('skipOnboardingStep', () => {
    it('should skip optional step successfully', async () => {
      // connect_accounts depends on space_setup, so mock user with userSpaces
      const userWithSpace = {
        ...mockUser,
        userSpaces: [{ space: { id: 'space-1', accounts: [], budgets: [] } }],
      };
      mockPrismaService.user.findUnique.mockResolvedValue(userWithSpace);
      mockPrismaService.user.update.mockResolvedValue(userWithSpace);

      const result = await service.skipOnboardingStep(
        mockUserId,
        'connect_accounts' as OnboardingStep
      );

      expect(mockAuditService.logEvent).toHaveBeenCalledWith({
        action: 'onboarding_step_skipped',
        resource: 'user',
        resourceId: mockUserId,
        userId: mockUserId,
        metadata: { step: 'connect_accounts' },
      });
    });

    it('should throw BadRequestException for required step', async () => {
      await expect(
        service.skipOnboardingStep(mockUserId, 'email_verification' as OnboardingStep)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid step', async () => {
      await expect(
        service.skipOnboardingStep(mockUserId, 'invalid_step' as OnboardingStep)
      ).rejects.toThrow(BadRequestException);
    });

    it('should complete onboarding if no more steps', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        onboardingCompleted: true,
      });

      await service.skipOnboardingStep(mockUserId, 'feature_tour' as OnboardingStep);

      // Should trigger completeOnboarding
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            onboardingCompleted: true,
          }),
        })
      );
    });
  });

  describe('resetOnboarding', () => {
    it('should reset onboarding to initial state', async () => {
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        onboardingCompleted: false,
        onboardingCompletedAt: null,
        onboardingStep: 'welcome',
      });
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.resetOnboarding(mockUserId);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          onboardingCompleted: false,
          onboardingCompletedAt: null,
          onboardingStep: 'welcome',
          updatedAt: expect.any(Date),
        },
      });
      expect(mockAuditService.logEvent).toHaveBeenCalledWith({
        action: 'onboarding_reset',
        resource: 'user',
        resourceId: mockUserId,
        userId: mockUserId,
      });
      expect(result.completed).toBe(false);
      expect(result.currentStep).toBe('welcome');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrismaService.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.getOnboardingStatus(mockUserId)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle missing user spaces gracefully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        userSpaces: [],
        providerConnections: [],
      });

      const result = await service.getOnboardingStatus(mockUserId);

      expect(result).toBeTruthy();
      expect(result.stepStatus.space_setup).toBe(false);
    });

    it('should handle concurrent updates correctly', async () => {
      // Set up mock before calls - use steps without dependencies
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      // Simulate two concurrent updates using steps without dependencies
      const update1 = service.updateOnboardingStep(mockUserId, {
        step: 'welcome' as OnboardingStep,
      });
      const update2 = service.updateOnboardingStep(mockUserId, {
        step: 'preferences' as OnboardingStep,
      });

      await Promise.all([update1, update2]);

      // Both updates should complete without errors
      expect(mockPrismaService.user.update).toHaveBeenCalledTimes(2);
    });
  });
});
