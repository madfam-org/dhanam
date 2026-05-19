import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { of, throwError } from 'rxjs';

import { JanuaEmailService, JANUA_TEMPLATES } from '../janua-email.service';

describe('JanuaEmailService', () => {
  let service: JanuaEmailService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  const mockAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  });

  const mockAxiosError = (message: string, detail?: string): AxiosError => {
    const error = new Error(message) as AxiosError;
    error.isAxiosError = true;
    error.response = {
      data: { detail },
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      config: { headers: {} } as InternalAxiosRequestConfig,
    };
    return error;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JanuaEmailService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                JANUA_API_URL: 'https://api.janua.dev',
                JANUA_INTERNAL_API_KEY: 'test-api-key',
                WEB_URL: 'https://app.dhan.am',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<JanuaEmailService>(JanuaEmailService);
    httpService = module.get(HttpService) as jest.Mocked<HttpService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkHealth', () => {
    it('should return true when service is healthy', async () => {
      httpService.get.mockReturnValue(of(mockAxiosResponse({ status: 'healthy' })));

      const result = await service.checkHealth();

      expect(result).toBe(true);
      expect(service.available).toBe(true);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.janua.dev/api/v1/internal/email/health',
        expect.objectContaining({
          timeout: 5000,
        })
      );
    });

    it('should return false when service is unhealthy', async () => {
      httpService.get.mockReturnValue(of(mockAxiosResponse({ status: 'unhealthy' })));

      const result = await service.checkHealth();

      expect(result).toBe(false);
      expect(service.available).toBe(false);
    });

    it('should return false when health check fails', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('Connection refused')));

      const result = await service.checkHealth();

      expect(result).toBe(false);
      expect(service.available).toBe(false);
    });

    it('should return false when API key is not configured', async () => {
      // Create new service instance without API key
      const moduleWithoutKey = await Test.createTestingModule({
        providers: [
          JanuaEmailService,
          {
            provide: HttpService,
            useValue: { get: jest.fn(), post: jest.fn() },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'JANUA_INTERNAL_API_KEY') return '';
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const serviceWithoutKey = moduleWithoutKey.get<JanuaEmailService>(JanuaEmailService);
      const result = await serviceWithoutKey.checkHealth();

      expect(result).toBe(false);
    });
  });

  describe('sendEmail', () => {
    it('should send a custom HTML email successfully', async () => {
      httpService.post.mockReturnValue(
        of(mockAxiosResponse({ success: true, message_id: 'msg_123' }))
      );

      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Hello World</p>',
      });

      expect(result.success).toBe(true);
      expect(result.message_id).toBe('msg_123');
      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.janua.dev/api/v1/internal/email/send',
        expect.objectContaining({
          to: ['user@example.com'],
          subject: 'Test Email',
          html: '<p>Hello World</p>',
          source_app: 'dhanam',
          source_type: 'notification',
        }),
        expect.objectContaining({ timeout: 30000 })
      );
    });

    it('should handle multiple recipients', async () => {
      httpService.post.mockReturnValue(
        of(mockAxiosResponse({ success: true, message_id: 'msg_123' }))
      );

      await service.sendEmail({
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Test Email',
        html: '<p>Hello</p>',
      });

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          to: ['user1@example.com', 'user2@example.com'],
        }),
        expect.any(Object)
      );
    });

    it('should include optional fields', async () => {
      httpService.post.mockReturnValue(of(mockAxiosResponse({ success: true })));

      await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
        from_email: 'custom@dhan.am',
        from_name: 'Custom Sender',
        reply_to: 'reply@dhan.am',
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        attachments: [{ filename: 'test.pdf', content: 'base64content' }],
        tags: { campaign: 'welcome' },
      });

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          from_email: 'custom@dhan.am',
          from_name: 'Custom Sender',
          reply_to: 'reply@dhan.am',
          cc: ['cc@example.com'],
          bcc: ['bcc@example.com'],
          attachments: [{ filename: 'test.pdf', content: 'base64content' }],
          tags: { campaign: 'welcome' },
        }),
        expect.any(Object)
      );
    });

    it('should handle API errors', async () => {
      httpService.post.mockReturnValue(
        throwError(() => mockAxiosError('Request failed', 'Email service unavailable'))
      );

      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service unavailable');
    });

    it('should use custom source type', async () => {
      httpService.post.mockReturnValue(of(mockAxiosResponse({ success: true })));

      await service.sendEmail(
        { to: 'user@example.com', subject: 'Test', html: '<p>Test</p>' },
        'billing'
      );

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ source_type: 'billing' }),
        expect.any(Object)
      );
    });
  });

  describe('sendTemplateEmail', () => {
    it('should send a template email successfully', async () => {
      httpService.post.mockReturnValue(
        of(mockAxiosResponse({ success: true, message_id: 'msg_456' }))
      );

      const result = await service.sendTemplateEmail({
        to: 'user@example.com',
        template: JANUA_TEMPLATES.AUTH_WELCOME,
        variables: { user_name: 'John Doe' },
      });

      expect(result.success).toBe(true);
      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.janua.dev/api/v1/internal/email/send-template',
        expect.objectContaining({
          to: ['user@example.com'],
          template: 'auth/welcome',
          variables: { user_name: 'John Doe' },
          source_app: 'dhanam',
        }),
        expect.any(Object)
      );
    });

    it('should handle API errors', async () => {
      httpService.post.mockReturnValue(
        throwError(() => mockAxiosError('Request failed', 'Template not found'))
      );

      const result = await service.sendTemplateEmail({
        to: 'user@example.com',
        template: 'invalid/template',
        variables: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template not found');
    });
  });

  describe('sendBatchEmails', () => {
    it('should send batch emails successfully', async () => {
      httpService.post.mockReturnValue(
        of(mockAxiosResponse({ success: true, sent_count: 3, failed_count: 0, results: [] }))
      );

      const emails = [
        { to: ['user1@example.com'], subject: 'Test 1', html: '<p>1</p>' },
        { to: ['user2@example.com'], subject: 'Test 2', html: '<p>2</p>' },
        { to: ['user3@example.com'], subject: 'Test 3', html: '<p>3</p>' },
      ];

      const result = await service.sendBatchEmails(emails);

      expect(result.success).toBe(true);
      expect(result.sent_count).toBe(3);
      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.janua.dev/api/v1/internal/email/send-batch',
        expect.objectContaining({
          emails,
          source_app: 'dhanam',
          source_type: 'batch',
        }),
        expect.objectContaining({ timeout: 60000 })
      );
    });

    it('should handle API errors for batch', async () => {
      httpService.post.mockReturnValue(
        throwError(() => mockAxiosError('Request failed', 'Batch limit exceeded'))
      );

      const emails = [{ to: ['user@example.com'], subject: 'Test', html: '<p>Test</p>' }];
      const result = await service.sendBatchEmails(emails);

      expect(result.success).toBe(false);
      expect(result.failed_count).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].error).toBe('Batch limit exceeded');
    });
  });

  describe('listTemplates', () => {
    it('should list available templates', async () => {
      const templates = [
        {
          name: 'auth/welcome',
          description: 'Welcome email',
          required_variables: ['user_name'],
          optional_variables: [],
        },
      ];
      httpService.get.mockReturnValue(of(mockAxiosResponse(templates)));

      const result = await service.listTemplates();

      expect(result).toEqual(templates);
    });

    it('should return empty array on error', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('Network error')));

      const result = await service.listTemplates();

      expect(result).toEqual([]);
    });
  });

  describe('Convenience methods', () => {
    beforeEach(() => {
      httpService.post.mockReturnValue(
        of(mockAxiosResponse({ success: true, message_id: 'msg_123' }))
      );
    });

    describe('sendWelcomeEmail', () => {
      it('should send welcome email with correct template', async () => {
        const result = await service.sendWelcomeEmail('user@example.com', 'John Doe');

        expect(result.success).toBe(true);
        expect(httpService.post).toHaveBeenCalledWith(
          expect.stringContaining('send-template'),
          expect.objectContaining({
            template: 'auth/welcome',
            variables: expect.objectContaining({
              user_name: 'John Doe',
              app_name: 'Dhanam',
            }),
          }),
          expect.any(Object)
        );
      });
    });

    describe('sendPasswordResetEmail', () => {
      it('should send password reset email with correct template', async () => {
        const result = await service.sendPasswordResetEmail(
          'user@example.com',
          'John Doe',
          'reset-token-123'
        );

        expect(result.success).toBe(true);
        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            template: 'auth/password-reset',
            variables: expect.objectContaining({
              user_name: 'John Doe',
              reset_link: 'https://app.dhan.am/reset-password?token=reset-token-123',
              expires_in: '1 hour',
            }),
          }),
          expect.any(Object)
        );
      });
    });

    describe('sendEmailVerification', () => {
      it('should send email verification with correct template', async () => {
        const result = await service.sendEmailVerification(
          'user@example.com',
          'John Doe',
          'https://app.dhan.am/verify?token=abc'
        );

        expect(result.success).toBe(true);
        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            template: 'auth/email-verification',
            variables: expect.objectContaining({
              verification_link: 'https://app.dhan.am/verify?token=abc',
              expires_in: '24 hours',
            }),
          }),
          expect.any(Object)
        );
      });
    });

    describe('send2FACode', () => {
      it('should send 2FA code email with correct template', async () => {
        const result = await service.send2FACode('user@example.com', 'John Doe', '123456');

        expect(result.success).toBe(true);
        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            template: 'auth/2fa-code',
            variables: expect.objectContaining({
              code: '123456',
              expires_in: '10 minutes',
            }),
          }),
          expect.any(Object)
        );
      });
    });

    describe('sendPaymentFailedEmail', () => {
      it('should send payment failed email with correct template', async () => {
        const result = await service.sendPaymentFailedEmail(
          'user@example.com',
          9900, // cents
          'USD',
          'Card declined'
        );

        expect(result.success).toBe(true);
        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            template: 'billing/payment-failed',
            variables: expect.objectContaining({
              amount: 'USD 99.00',
              reason: 'Card declined',
            }),
          }),
          expect.any(Object)
        );
      });
    });

    describe('sendSubscriptionCreatedEmail', () => {
      it('should send subscription created email with correct template', async () => {
        const result = await service.sendSubscriptionCreatedEmail(
          'user@example.com',
          'Premium',
          2900,
          'USD',
          'monthly'
        );

        expect(result.success).toBe(true);
        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            template: 'billing/subscription-created',
            variables: expect.objectContaining({
              plan_name: 'Premium',
              amount: 'USD 29.00',
              billing_cycle: 'monthly',
            }),
          }),
          expect.any(Object)
        );
      });
    });

    describe('sendBudgetAlert', () => {
      it('should send budget alert with critical severity', async () => {
        const result = await service.sendBudgetAlert(
          'user@example.com',
          'John Doe',
          'Groceries',
          100,
          500,
          500,
          'MXN'
        );

        expect(result.success).toBe(true);
        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            template: 'notification/alert',
            variables: expect.objectContaining({
              title: 'Budget Alert: Groceries',
              severity: 'critical',
            }),
          }),
          expect.any(Object)
        );
      });

      it('should send budget alert with warning severity at 80%', async () => {
        await service.sendBudgetAlert(
          'user@example.com',
          'John Doe',
          'Groceries',
          80,
          400,
          500,
          'MXN'
        );

        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            variables: expect.objectContaining({
              severity: 'warning',
            }),
          }),
          expect.any(Object)
        );
      });

      it('should send budget alert with info severity below 80%', async () => {
        await service.sendBudgetAlert(
          'user@example.com',
          'John Doe',
          'Groceries',
          50,
          250,
          500,
          'MXN'
        );

        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            variables: expect.objectContaining({
              severity: 'info',
            }),
          }),
          expect.any(Object)
        );
      });
    });
  });

  describe('JANUA_TEMPLATES', () => {
    it('should have all expected template keys', () => {
      expect(JANUA_TEMPLATES.AUTH_WELCOME).toBe('auth/welcome');
      expect(JANUA_TEMPLATES.AUTH_PASSWORD_RESET).toBe('auth/password-reset');
      expect(JANUA_TEMPLATES.AUTH_EMAIL_VERIFICATION).toBe('auth/email-verification');
      expect(JANUA_TEMPLATES.AUTH_MAGIC_LINK).toBe('auth/magic-link');
      expect(JANUA_TEMPLATES.AUTH_2FA_CODE).toBe('auth/2fa-code');
      expect(JANUA_TEMPLATES.BILLING_INVOICE).toBe('billing/invoice');
      expect(JANUA_TEMPLATES.BILLING_PAYMENT_SUCCESS).toBe('billing/payment-success');
      expect(JANUA_TEMPLATES.BILLING_PAYMENT_FAILED).toBe('billing/payment-failed');
      expect(JANUA_TEMPLATES.BILLING_SUBSCRIPTION_CREATED).toBe('billing/subscription-created');
      expect(JANUA_TEMPLATES.BILLING_SUBSCRIPTION_CANCELED).toBe('billing/subscription-canceled');
      expect(JANUA_TEMPLATES.NOTIFICATION_ALERT).toBe('notification/alert');
    });
  });
});
