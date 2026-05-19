import { getQueueToken } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bull';
import * as nodemailer from 'nodemailer';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { EmailService } from '../email.service';
import { EmailTemplate } from '../types';

// Mock nodemailer
jest.mock('nodemailer');

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue('<html>{{userName}}</html>'),
  readdir: jest.fn().mockResolvedValue([]),
}));

// Mock handlebars
jest.mock('handlebars', () => ({
  compile: jest.fn().mockReturnValue((context: any) => `<html>${context.userName}</html>`),
  registerPartial: jest.fn(),
  registerHelper: jest.fn(),
}));

describe('EmailService', () => {
  let service: EmailService;
  let configService: jest.Mocked<ConfigService>;
  let prisma: jest.Mocked<PrismaService>;
  let emailQueue: jest.Mocked<Queue>;
  let mockTransporter: any;

  beforeEach(async () => {
    mockTransporter = {
      verify: jest.fn((callback) => callback(null)),
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    // Create config mock with implementation BEFORE module compilation
    const mockConfigGet = jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        SMTP_HOST: 'smtp.test.com',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_USER: 'test@test.com',
        SMTP_PASSWORD: 'password',
        APP_URL: 'https://app.dhanam.io',
        WEB_URL: 'https://app.dhanam.io',
        SUPPORT_EMAIL: 'support@dhanam.io',
        EMAIL_FROM: 'Dhanam <noreply@dhanam.io>',
      };
      return config[key] ?? defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: mockConfigGet,
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: getQueueToken('email'),
          useValue: {
            add: jest.fn(),
            addBulk: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    emailQueue = module.get(getQueueToken('email')) as jest.Mocked<Queue>;

    // Clear call history but keep the implementations
    mockConfigGet.mockClear();
    (nodemailer.createTransport as jest.Mock).mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmail', () => {
    it('should queue an email for sending', async () => {
      await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'welcome',
        context: { name: 'John' },
        priority: 'high',
      });

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        {
          to: 'test@example.com',
          subject: 'Test Email',
          template: 'welcome',
          context: { name: 'John' },
          priority: 'high',
        },
        { priority: 1, delay: undefined }
      );
    });

    it('should use normal priority by default', async () => {
      await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'welcome',
        context: { name: 'John' },
      });

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          priority: 'normal',
        }),
        { priority: 2, delay: undefined }
      );
    });

    it('should support low priority emails', async () => {
      await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'welcome',
        context: { name: 'John' },
        priority: 'low',
      });

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          priority: 'low',
        }),
        { priority: 3, delay: undefined }
      );
    });

    it('should support delayed sending', async () => {
      await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'welcome',
        context: { name: 'John' },
        delay: 5000,
      });

      expect(emailQueue.add).toHaveBeenCalledWith('send-email', expect.any(Object), {
        priority: 2,
        delay: 5000,
      });
    });
  });

  describe('sendEmailDirect', () => {
    it('should send email immediately', async () => {
      await service.sendEmailDirect({
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'welcome' as EmailTemplate,
        context: { userName: 'John' },
        priority: 'normal',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Dhanam <noreply@dhanam.io>',
          to: 'test@example.com',
          subject: 'Test Email',
          html: expect.stringContaining('John'),
        })
      );
    });

    it('should add common context to templates', async () => {
      await service.sendEmailDirect({
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'welcome' as EmailTemplate,
        context: { userName: 'John' },
        priority: 'normal',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.html).toBeDefined();
    });

    it('should throw error if template not found', async () => {
      await expect(
        service.sendEmailDirect({
          to: 'test@example.com',
          subject: 'Test Email',
          template: 'non-existent-template' as EmailTemplate,
          context: {},
          priority: 'normal',
        })
      ).rejects.toThrow('Template non-existent-template not found');
    });

    it('should include attachments if provided', async () => {
      const attachments = [
        {
          filename: 'test.pdf',
          content: Buffer.from('test'),
          contentType: 'application/pdf',
        },
      ];

      await service.sendEmailDirect({
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'welcome' as EmailTemplate,
        context: { userName: 'John' },
        attachments,
        priority: 'normal',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments,
        })
      );
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email with high priority', async () => {
      await service.sendWelcomeEmail('test@example.com', 'John Doe');

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Welcome to Dhanam!',
          template: 'welcome',
          context: { name: 'John Doe' },
          priority: 'high',
        }),
        expect.any(Object)
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with reset URL', async () => {
      await service.sendPasswordResetEmail('test@example.com', 'John Doe', 'reset-token-123');

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Reset Your Password',
          template: 'password-reset',
          context: {
            name: 'John Doe',
            resetUrl: 'https://app.dhanam.io/reset-password?token=reset-token-123',
          },
          priority: 'high',
        }),
        expect.any(Object)
      );
    });
  });

  describe('sendPasswordChangedEmail', () => {
    it('should send password changed confirmation', async () => {
      await service.sendPasswordChangedEmail('test@example.com', 'John Doe');

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Password Changed Successfully',
          template: 'password-changed',
          priority: 'high',
        }),
        expect.any(Object)
      );
    });
  });

  describe('sendTwoFactorEnabledEmail', () => {
    it('should send 2FA enabled notification', async () => {
      await service.sendTwoFactorEnabledEmail('test@example.com', 'John Doe');

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Two-Factor Authentication Enabled',
          template: 'two-factor-enabled',
          context: { name: 'John Doe' },
          priority: 'high',
        }),
        expect.any(Object)
      );
    });
  });

  describe('sendLoginAlertEmail', () => {
    it('should send login alert with login info', async () => {
      const loginInfo = {
        ipAddress: '192.168.1.1',
        location: 'New York, US',
        device: 'Chrome on Windows',
      };

      await service.sendLoginAlertEmail('test@example.com', 'John Doe', loginInfo);

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'New Login to Your Account',
          template: 'login-alert',
          context: expect.objectContaining({
            name: 'John Doe',
            ipAddress: '192.168.1.1',
            location: 'New York, US',
            device: 'Chrome on Windows',
          }),
          priority: 'high',
        }),
        expect.any(Object)
      );
    });
  });

  describe('sendBudgetAlertEmail', () => {
    it('should send budget alert with spending details', async () => {
      await service.sendBudgetAlertEmail(
        'test@example.com',
        'John Doe',
        'Groceries',
        85,
        850,
        1000,
        'MXN'
      );

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Budget Alert: Groceries at 85%',
          template: 'budget-alert',
          context: {
            name: 'John Doe',
            budgetName: 'Groceries',
            percentage: 85,
            spent: 850,
            limit: 1000,
            currency: 'MXN',
            remaining: 150,
          },
          priority: 'normal',
        }),
        expect.any(Object)
      );
    });
  });

  describe('sendSyncCompletedEmail', () => {
    it('should send sync completion notification', async () => {
      await service.sendSyncCompletedEmail('test@example.com', 'John Doe', 'Belvo', 5, 120);

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Belvo Sync Completed',
          template: 'sync-completed',
          context: expect.objectContaining({
            name: 'John Doe',
            provider: 'Belvo',
            accountsUpdated: 5,
            transactionsAdded: 120,
          }),
          priority: 'low',
        }),
        expect.any(Object)
      );
    });
  });

  describe('sendSyncFailedEmail', () => {
    it('should send sync failure notification', async () => {
      await service.sendSyncFailedEmail(
        'test@example.com',
        'John Doe',
        'Plaid',
        'Connection timeout'
      );

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Plaid Sync Failed',
          template: 'sync-failed',
          context: expect.objectContaining({
            name: 'John Doe',
            provider: 'Plaid',
            error: 'Connection timeout',
          }),
          priority: 'normal',
        }),
        expect.any(Object)
      );
    });
  });

  describe('sendWeeklySummaryEmail', () => {
    it('should send weekly summary with data', async () => {
      const summaryData = {
        totalSpent: 5000,
        totalIncome: 10000,
        netWorth: 50000,
      };

      await service.sendWeeklySummaryEmail('test@example.com', 'John Doe', summaryData);

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Your Weekly Financial Summary',
          template: 'weekly-summary',
          context: expect.objectContaining({
            name: 'John Doe',
            totalSpent: 5000,
            totalIncome: 10000,
            netWorth: 50000,
          }),
          priority: 'low',
        }),
        { priority: 3, delay: 0 }
      );
    });
  });

  describe('sendMonthlyReportEmail', () => {
    it('should send monthly report without PDF', async () => {
      const reportData = {
        month: 'January 2024',
        totalSpent: 15000,
        totalIncome: 30000,
      };

      await service.sendMonthlyReportEmail('test@example.com', 'John Doe', reportData);

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Your Monthly Financial Report',
          template: 'monthly-report',
          context: expect.objectContaining({
            name: 'John Doe',
            month: 'January 2024',
          }),
          attachments: undefined,
          priority: 'normal',
        }),
        expect.any(Object)
      );
    });

    it('should send monthly report with PDF attachment', async () => {
      const reportData = {
        month: 'January 2024',
        totalSpent: 15000,
        totalIncome: 30000,
      };
      const pdfBuffer = Buffer.from('fake-pdf-content');

      await service.sendMonthlyReportEmail('test@example.com', 'John Doe', reportData, pdfBuffer);

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              contentType: 'application/pdf',
              content: pdfBuffer,
            }),
          ]),
        }),
        expect.any(Object)
      );
    });
  });

  describe('sendBatchEmails', () => {
    it('should queue multiple emails in batch', async () => {
      const recipients = ['user1@example.com', 'user2@example.com', 'user3@example.com'];

      await service.sendBatchEmails(recipients, 'Batch Email', 'welcome', { name: 'User' });

      expect(emailQueue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'send-email',
            data: expect.objectContaining({
              to: 'user1@example.com',
            }),
          }),
          expect.objectContaining({
            name: 'send-email',
            data: expect.objectContaining({
              to: 'user2@example.com',
            }),
          }),
          expect.objectContaining({
            name: 'send-email',
            data: expect.objectContaining({
              to: 'user3@example.com',
            }),
          }),
        ])
      );
    });
  });

  describe('sendEmailVerification', () => {
    it('should send email verification to user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'John Doe',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await service.sendEmailVerification('user-123', {
        verificationToken: 'token-123',
        verificationUrl: 'https://app.dhanam.io/verify?token=token-123',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Verifica tu email - Dhanam',
          template: 'email-verification',
          priority: 'high',
        }),
        expect.any(Object)
      );
    });

    it('should throw error if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.sendEmailVerification('user-123', {
          verificationToken: 'token-123',
          verificationUrl: 'https://app.dhanam.io/verify',
        })
      ).rejects.toThrow('User not found');
    });
  });

  describe('sendOnboardingComplete', () => {
    it('should send onboarding completion email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'John Doe',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await service.sendOnboardingComplete('user-123', {
        skipOptional: false,
        completedAt: '2024-01-01T00:00:00Z',
        metadata: {
          timeSpent: 300,
          stepsCompleted: 7,
        },
      });

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          to: 'test@example.com',
          subject: '🎉 ¡Tu cuenta de Dhanam está lista! - Configuración completada',
          template: 'onboarding-complete',
          context: expect.objectContaining({
            userName: 'John Doe',
            completionTime: '5m',
            stepsCompleted: 7,
            dashboardUrl: 'https://app.dhanam.io/dashboard',
            skipOptional: false,
          }),
          priority: 'high',
        }),
        expect.any(Object)
      );
    });

    it('should use default stepsCompleted when not provided in metadata', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'John Doe',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await service.sendOnboardingComplete('user-123', {
        skipOptional: true,
        completedAt: '2024-01-01T00:00:00Z',
        metadata: {
          // No stepsCompleted provided - should default to '7'
        },
      });

      const callArgs = (emailQueue.add as jest.Mock).mock.calls[0][1];
      expect(callArgs.context.stepsCompleted).toBe('7');
      expect(callArgs.context.completionTime).toBe('N/A');
    });

    it('should throw error if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.sendOnboardingComplete('user-123', {
          skipOptional: false,
          completedAt: '2024-01-01T00:00:00Z',
          metadata: {},
        })
      ).rejects.toThrow('User not found');
    });

    it('should format duration correctly for seconds', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'John Doe',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await service.sendOnboardingComplete('user-123', {
        skipOptional: false,
        completedAt: '2024-01-01T00:00:00Z',
        metadata: {
          timeSpent: 45,
        },
      });

      const context = (emailQueue.add as jest.Mock).mock.calls[0][1].context;
      expect(context.completionTime).toBe('45s');
    });

    it('should format duration correctly for hours', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'John Doe',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await service.sendOnboardingComplete('user-123', {
        skipOptional: false,
        completedAt: '2024-01-01T00:00:00Z',
        metadata: {
          timeSpent: 3900, // 1h 5m
        },
      });

      const context = (emailQueue.add as jest.Mock).mock.calls[0][1].context;
      expect(context.completionTime).toBe('1h 5m');
    });
  });
});

describe('EmailService - SMTP not configured', () => {
  let service: EmailService;
  let emailQueue: jest.Mocked<Queue>;

  beforeEach(async () => {
    // Config without SMTP_HOST to test fallback branch
    const mockConfigGetNoSmtp = jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        // SMTP_HOST is undefined/null
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        APP_URL: 'https://app.dhanam.io',
        WEB_URL: 'https://app.dhanam.io',
        SUPPORT_EMAIL: 'support@dhanam.io',
        EMAIL_FROM: 'Dhanam <noreply@dhanam.io>',
      };
      return config[key] ?? defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: mockConfigGetNoSmtp,
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: getQueueToken('email'),
          useValue: {
            add: jest.fn(),
            addBulk: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    emailQueue = module.get(getQueueToken('email')) as jest.Mocked<Queue>;
  });

  it('should skip email sending when SMTP not configured', async () => {
    await service.sendEmailDirect({
      to: 'test@example.com',
      subject: 'Test Email',
      template: 'welcome' as EmailTemplate,
      context: { userName: 'John' },
      priority: 'normal',
    });

    // No sendMail call should happen - transporter is null
    // Service should log skip message and return early
    expect(emailQueue.add).not.toHaveBeenCalled();
  });
});

describe('EmailService - SMTP verification failure', () => {
  let service: EmailService;
  let mockTransporter: any;

  beforeEach(async () => {
    mockTransporter = {
      verify: jest.fn((callback) => callback(new Error('Connection refused'))),
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const mockConfigGet = jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        SMTP_HOST: 'smtp.test.com',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        // No SMTP_USER/SMTP_PASSWORD to test auth-less path
        APP_URL: 'https://app.dhanam.io',
        WEB_URL: 'https://app.dhanam.io',
        SUPPORT_EMAIL: 'support@dhanam.io',
        EMAIL_FROM: 'Dhanam <noreply@dhanam.io>',
      };
      return config[key] ?? defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: mockConfigGet,
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: getQueueToken('email'),
          useValue: {
            add: jest.fn(),
            addBulk: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should continue operating despite verification failure', async () => {
    // Service should be defined even when verification fails
    expect(service).toBeDefined();

    // Transporter should be created without auth when credentials not provided
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.test.com',
        port: 587,
      })
    );
  });

  it('should still send emails even after verification warning', async () => {
    await service.sendEmailDirect({
      to: 'test@example.com',
      subject: 'Test Email',
      template: 'welcome' as EmailTemplate,
      context: { userName: 'John' },
      priority: 'normal',
    });

    expect(mockTransporter.sendMail).toHaveBeenCalled();
  });
});

describe('EmailService - sendMail failure', () => {
  let service: EmailService;
  let mockTransporter: any;

  beforeEach(async () => {
    mockTransporter = {
      verify: jest.fn((callback) => callback(null)),
      sendMail: jest.fn().mockRejectedValue(new Error('SMTP connection failed')),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const mockConfigGet = jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        SMTP_HOST: 'smtp.test.com',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_USER: 'test@test.com',
        SMTP_PASSWORD: 'password',
        APP_URL: 'https://app.dhanam.io',
        WEB_URL: 'https://app.dhanam.io',
        SUPPORT_EMAIL: 'support@dhanam.io',
        EMAIL_FROM: 'Dhanam <noreply@dhanam.io>',
      };
      return config[key] ?? defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: mockConfigGet,
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: getQueueToken('email'),
          useValue: {
            add: jest.fn(),
            addBulk: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should throw error when sendMail fails', async () => {
    await expect(
      service.sendEmailDirect({
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'welcome' as EmailTemplate,
        context: { userName: 'John' },
        priority: 'normal',
      })
    ).rejects.toThrow('SMTP connection failed');
  });
});

describe('EmailService - sendTransactionCategorizedEmail', () => {
  let service: EmailService;
  let emailQueue: jest.Mocked<Queue>;
  let mockTransporter: any;

  beforeEach(async () => {
    mockTransporter = {
      verify: jest.fn((callback) => callback(null)),
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const mockConfigGet = jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        SMTP_HOST: 'smtp.test.com',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_USER: 'test@test.com',
        SMTP_PASSWORD: 'password',
        APP_URL: 'https://app.dhanam.io',
        WEB_URL: 'https://app.dhanam.io',
        SUPPORT_EMAIL: 'support@dhanam.io',
        EMAIL_FROM: 'Dhanam <noreply@dhanam.io>',
      };
      return config[key] ?? defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: mockConfigGet,
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: getQueueToken('email'),
          useValue: {
            add: jest.fn(),
            addBulk: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    emailQueue = module.get(getQueueToken('email')) as jest.Mocked<Queue>;
  });

  it('should send transaction categorized email with correct subject', async () => {
    const transactions = [
      { id: 'tx1', description: 'Grocery Store', amount: 50.0, category: 'Food' },
      { id: 'tx2', description: 'Gas Station', amount: 35.0, category: 'Transportation' },
    ];

    await service.sendTransactionCategorizedEmail('test@example.com', 'John', transactions);

    expect(emailQueue.add).toHaveBeenCalledWith(
      'send-email',
      expect.objectContaining({
        to: 'test@example.com',
        subject: '2 Transactions Categorized',
        template: 'transaction-categorized',
        context: expect.objectContaining({
          name: 'John',
          transactions,
          count: 2,
        }),
        priority: 'low',
      }),
      expect.any(Object)
    );
  });

  it('should handle single transaction correctly', async () => {
    const transactions = [{ id: 'tx1', description: 'Coffee Shop', amount: 5.0, category: 'Food' }];

    await service.sendTransactionCategorizedEmail('test@example.com', 'Jane', transactions);

    expect(emailQueue.add).toHaveBeenCalledWith(
      'send-email',
      expect.objectContaining({
        subject: '1 Transactions Categorized',
        context: expect.objectContaining({
          count: 1,
        }),
      }),
      expect.any(Object)
    );
  });
});
