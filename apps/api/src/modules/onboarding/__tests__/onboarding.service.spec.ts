import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { PreferencesService } from '../../preferences/preferences.service';
import { OnboardingAnalytics } from '../onboarding.analytics';
import { OnboardingService } from '../onboarding.service';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let prisma: jest.Mocked<PrismaService>;
  let configService: jest.Mocked<ConfigService>;
  let auditService: jest.Mocked<AuditService>;
  let jwtService: jest.Mocked<JwtService>;
  let emailService: jest.Mocked<EmailService>;
  let analytics: jest.Mocked<OnboardingAnalytics>;
  let preferencesService: jest.Mocked<PreferencesService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    emailVerified: false,
    locale: 'es',
    timezone: 'America/Mexico_City',
    onboardingCompleted: false,
    onboardingCompletedAt: null,
    onboardingStep: 'welcome',
    userSpaces: [
      {
        space: {
          id: 'space-123',
          type: 'personal',
          currency: 'MXN',
          accounts: [],
          budgets: [],
        },
      },
    ],
    providerConnections: [],
  };

  const mockUserWithProgress = {
    ...mockUser,
    emailVerified: true,
    onboardingStep: 'preferences',
    userSpaces: [
      {
        space: {
          id: 'space-123',
          type: 'personal',
          currency: 'USD', // Changed from default
          accounts: [{ id: 'account-1' }],
          budgets: [{ id: 'budget-1' }],
        },
      },
    ],
    providerConnections: [{ id: 'conn-1' }],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            space: {
              update: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                JWT_SECRET: 'test-jwt-secret',
                WEB_URL: 'https://app.dhan.am',
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: AuditService,
          useValue: {
            logEvent: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendEmailVerification: jest.fn().mockResolvedValue(undefined),
            sendOnboardingComplete: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: OnboardingAnalytics,
          useValue: {
            trackStepCompleted: jest.fn(),
            trackOnboardingCompleted: jest.fn(),
            trackPreferencesUpdated: jest.fn(),
            trackEmailVerificationSent: jest.fn(),
            trackEmailVerificationCompleted: jest.fn(),
          },
        },
        {
          provide: PreferencesService,
          useValue: {
            updateUserPreferences: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
    auditService = module.get(AuditService) as jest.Mocked<AuditService>;
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
    emailService = module.get(EmailService) as jest.Mocked<EmailService>;
    analytics = module.get(OnboardingAnalytics) as jest.Mocked<OnboardingAnalytics>;
    preferencesService = module.get(PreferencesService) as jest.Mocked<PreferencesService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOnboardingStatus', () => {
    it('should return onboarding status for new user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.getOnboardingStatus('user-123');

      expect(result.completed).toBe(false);
      expect(result.currentStep).toBe('welcome');
      expect(result.progress).toBeGreaterThan(0);
      expect(result.stepStatus.welcome).toBe(true);
      expect(result.stepStatus.email_verification).toBe(false);
    });

    it('should return onboarding status for user with progress', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserWithProgress as any);

      const result = await service.getOnboardingStatus('user-123');

      expect(result.stepStatus.email_verification).toBe(true);
      expect(result.stepStatus.preferences).toBe(true);
      expect(result.stepStatus.space_setup).toBe(true);
      expect(result.stepStatus.connect_accounts).toBe(true);
      expect(result.stepStatus.first_budget).toBe(true);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getOnboardingStatus('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should calculate progress correctly', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserWithProgress as any);

      const result = await service.getOnboardingStatus('user-123');

      // Most steps complete
      expect(result.progress).toBeGreaterThan(50);
    });

    it('should return remaining required steps', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.getOnboardingStatus('user-123');

      expect(result.remainingSteps).toContain('email_verification');
      expect(result.remainingSteps).toContain('preferences');
    });

    it('should return optional steps', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.getOnboardingStatus('user-123');

      expect(result.optionalSteps).toContain('connect_accounts');
      expect(result.optionalSteps).toContain('first_budget');
      expect(result.optionalSteps).toContain('feature_tour');
    });
  });

  describe('updateOnboardingStep', () => {
    it('should update onboarding step', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserWithProgress as any);
      prisma.user.update.mockResolvedValue({
        ...mockUserWithProgress,
        onboardingStep: 'space_setup',
      } as any);

      const result = await service.updateOnboardingStep('user-123', { step: 'space_setup' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({ onboardingStep: 'space_setup' }),
      });
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'onboarding_step_updated' })
      );
      expect(analytics.trackStepCompleted).toHaveBeenCalled();
    });

    it('should throw error for invalid step', async () => {
      await expect(
        service.updateOnboardingStep('user-123', { step: 'invalid_step' as any })
      ).rejects.toThrow(BadRequestException);
    });

    it('should check step dependencies', async () => {
      // User with no userSpaces means space_setup is not complete
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        userSpaces: [], // Empty userSpaces means space_setup step is incomplete
        providerConnections: [],
      } as any);

      await expect(
        service.updateOnboardingStep('user-123', { step: 'connect_accounts' })
      ).rejects.toThrow('Must complete space_setup step first');
    });

    it('should throw NotFoundException for non-existent user during dependency check', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOnboardingStep('nonexistent', { step: 'connect_accounts' })
      ).rejects.toThrow(NotFoundException);
    });

    it('should auto-complete onboarding when step is completed', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserWithProgress as any);
      prisma.user.update.mockResolvedValue({
        ...mockUserWithProgress,
        onboardingCompleted: true,
        onboardingStep: 'completed',
      } as any);

      await service.updateOnboardingStep('user-123', { step: 'completed' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ onboardingCompleted: true }),
        })
      );
    });
  });

  describe('completeOnboarding', () => {
    it('should complete onboarding', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserWithProgress as any);
      prisma.user.update.mockResolvedValue({
        ...mockUserWithProgress,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        onboardingStep: 'completed',
      } as any);

      const result = await service.completeOnboarding('user-123', {});

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          onboardingCompleted: true,
          onboardingStep: 'completed',
        }),
      });
      expect(emailService.sendOnboardingComplete).toHaveBeenCalled();
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'onboarding_completed' })
      );
      expect(analytics.trackOnboardingCompleted).toHaveBeenCalled();
    });

    it('should handle email sending failure gracefully', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserWithProgress as any);
      prisma.user.update.mockResolvedValue({
        ...mockUserWithProgress,
        onboardingCompleted: true,
      } as any);
      emailService.sendOnboardingComplete.mockRejectedValue(new Error('Email failed'));

      // Should not throw
      await expect(service.completeOnboarding('user-123', {})).resolves.toBeDefined();
    });

    it('should track time spent if provided', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserWithProgress as any);
      prisma.user.update.mockResolvedValue({
        ...mockUserWithProgress,
        onboardingCompleted: true,
      } as any);

      await service.completeOnboarding('user-123', { metadata: { timeSpent: 300 } });

      expect(analytics.trackOnboardingCompleted).toHaveBeenCalledWith('user-123', 300);
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.user.update.mockResolvedValue({ ...mockUser, locale: 'en', timezone: 'UTC' } as any);

      const result = await service.updatePreferences('user-123', {
        locale: 'en',
        timezone: 'UTC',
      });

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { locale: 'en', timezone: 'UTC' },
      });
      expect(analytics.trackPreferencesUpdated).toHaveBeenCalled();
    });

    it('should update space currency', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.space.update.mockResolvedValue({ id: 'space-123', currency: 'USD' } as any);

      await service.updatePreferences('user-123', { currency: 'USD' });

      expect(prisma.space.update).toHaveBeenCalledWith({
        where: { id: 'space-123' },
        data: { currency: 'USD' },
      });
    });

    it('should throw NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updatePreferences('nonexistent', { locale: 'en' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('should update notification preferences via preferences service', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await service.updatePreferences('user-123', {
        emailNotifications: true,
        transactionAlerts: true,
        budgetAlerts: true,
      });

      expect(preferencesService.updateUserPreferences).toHaveBeenCalledWith('user-123', {
        emailNotifications: true,
        transactionAlerts: true,
        budgetAlerts: true,
        weeklyReports: undefined,
        monthlyReports: undefined,
        defaultCurrency: undefined,
      });
    });
  });

  describe('sendEmailVerification', () => {
    it('should send email verification', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.sendEmailVerification('user-123');

      expect(result.success).toBe(true);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          email: 'test@example.com',
          type: 'email_verification',
        }),
        expect.objectContaining({ expiresIn: '24h' })
      );
      expect(emailService.sendEmailVerification).toHaveBeenCalled();
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'email_verification_sent' })
      );
      expect(analytics.trackEmailVerificationSent).toHaveBeenCalled();
    });

    it('should return false if email already verified', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, emailVerified: true } as any);

      const result = await service.sendEmailVerification('user-123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Email already verified');
    });

    it('should throw NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.sendEmailVerification('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      jwtService.verify.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        type: 'email_verification',
      });
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser as any) // First call for verification
        .mockResolvedValueOnce({ ...mockUser, emailVerified: true } as any); // Second call for status
      prisma.user.update.mockResolvedValue({ ...mockUser, emailVerified: true } as any);

      const result = await service.verifyEmail({ token: 'valid-token' });

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({ emailVerified: true }),
      });
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'email_verified' })
      );
      expect(analytics.trackEmailVerificationCompleted).toHaveBeenCalled();
    });

    it('should throw error for invalid token type', async () => {
      jwtService.verify.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        type: 'password_reset', // Wrong type
      });

      await expect(service.verifyEmail({ token: 'invalid-token' })).rejects.toThrow(
        'Invalid verification token'
      );
    });

    it('should throw error for mismatched email', async () => {
      jwtService.verify.mockReturnValue({
        userId: 'user-123',
        email: 'different@example.com',
        type: 'email_verification',
      });
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(service.verifyEmail({ token: 'token' })).rejects.toThrow('Token email mismatch');
    });

    it('should return false if email already verified', async () => {
      jwtService.verify.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        type: 'email_verification',
      });
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, emailVerified: true } as any);

      const result = await service.verifyEmail({ token: 'valid-token' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Email already verified');
    });

    it('should throw error for expired token', async () => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      jwtService.verify.mockImplementation(() => {
        throw error;
      });

      await expect(service.verifyEmail({ token: 'expired-token' })).rejects.toThrow(
        'Invalid or expired verification token'
      );
    });

    it('should throw error for invalid JWT', async () => {
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      jwtService.verify.mockImplementation(() => {
        throw error;
      });

      await expect(service.verifyEmail({ token: 'invalid-jwt' })).rejects.toThrow(
        'Invalid or expired verification token'
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      jwtService.verify.mockReturnValue({
        userId: 'nonexistent',
        email: 'test@example.com',
        type: 'email_verification',
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail({ token: 'token' })).rejects.toThrow(NotFoundException);
    });

    it('should auto-advance to preferences step after verification', async () => {
      jwtService.verify.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        type: 'email_verification',
      });
      prisma.user.findUnique
        .mockResolvedValueOnce({ ...mockUser, onboardingStep: 'email_verification' } as any)
        .mockResolvedValueOnce({
          ...mockUser,
          emailVerified: true,
          onboardingStep: 'preferences',
        } as any);
      prisma.user.update.mockResolvedValue({ ...mockUser, emailVerified: true } as any);

      await service.verifyEmail({ token: 'valid-token' });

      // Should call update twice: once for email verification, once for step advancement
      expect(prisma.user.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('skipOnboardingStep', () => {
    it('should skip optional step and move to next', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUserWithProgress,
        onboardingStep: 'connect_accounts',
      } as any);
      prisma.user.update.mockResolvedValue({
        ...mockUserWithProgress,
        onboardingStep: 'first_budget',
      } as any);

      const result = await service.skipOnboardingStep('user-123', 'connect_accounts');

      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'onboarding_step_skipped' })
      );
    });

    it('should throw error when skipping required step', async () => {
      await expect(service.skipOnboardingStep('user-123', 'email_verification')).rejects.toThrow(
        'Cannot skip required step'
      );
    });

    it('should throw error for invalid step', async () => {
      await expect(service.skipOnboardingStep('user-123', 'invalid' as any)).rejects.toThrow(
        'Invalid step'
      );
    });

    it('should complete onboarding if skipping last optional step', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUserWithProgress,
        onboardingStep: 'feature_tour',
      } as any);
      prisma.user.update.mockResolvedValue({
        ...mockUserWithProgress,
        onboardingCompleted: true,
        onboardingStep: 'completed',
      } as any);

      await service.skipOnboardingStep('user-123', 'feature_tour');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ onboardingCompleted: true }),
        })
      );
    });
  });

  describe('resetOnboarding', () => {
    it('should reset onboarding to initial state', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserWithProgress as any);
      prisma.user.update.mockResolvedValue({
        ...mockUserWithProgress,
        onboardingCompleted: false,
        onboardingCompletedAt: null,
        onboardingStep: 'welcome',
      } as any);

      const result = await service.resetOnboarding('user-123');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          onboardingCompleted: false,
          onboardingCompletedAt: null,
          onboardingStep: 'welcome',
        }),
      });
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'onboarding_reset' })
      );
    });
  });
});
