import * as crypto from 'crypto';

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';

import { PaddleService } from '../services/paddle.service';

describe('PaddleService', () => {
  let service: PaddleService;
  let httpService: jest.Mocked<HttpService>;

  const PADDLE_VENDOR_ID = 'vendor_test123';
  const PADDLE_API_KEY = 'test_api_key';
  const PADDLE_CLIENT_TOKEN = 'test_client_token';
  const PADDLE_WEBHOOK_SECRET = 'test_webhook_secret';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaddleService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'PADDLE_VENDOR_ID') return PADDLE_VENDOR_ID;
              if (key === 'PADDLE_API_KEY') return PADDLE_API_KEY;
              if (key === 'PADDLE_CLIENT_TOKEN') return PADDLE_CLIENT_TOKEN;
              if (key === 'PADDLE_WEBHOOK_SECRET') return PADDLE_WEBHOOK_SECRET;
              if (key === 'PADDLE_ENVIRONMENT') return 'sandbox';
              return defaultValue;
            }),
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaddleService>(PaddleService);
    httpService = module.get(HttpService) as jest.Mocked<HttpService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should be configured with valid credentials', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should not be configured without API key', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaddleService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'PADDLE_API_KEY') return '';
                if (key === 'PADDLE_VENDOR_ID') return PADDLE_VENDOR_ID;
                if (key === 'PADDLE_ENVIRONMENT') return 'sandbox';
                return defaultValue;
              }),
            },
          },
          {
            provide: HttpService,
            useValue: { post: jest.fn(), get: jest.fn() },
          },
        ],
      }).compile();

      const unconfiguredService = module.get<PaddleService>(PaddleService);
      expect(unconfiguredService.isConfigured()).toBe(false);
    });

    it('should not be configured without vendor ID', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaddleService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'PADDLE_API_KEY') return PADDLE_API_KEY;
                if (key === 'PADDLE_VENDOR_ID') return '';
                if (key === 'PADDLE_ENVIRONMENT') return 'sandbox';
                return defaultValue;
              }),
            },
          },
          {
            provide: HttpService,
            useValue: { post: jest.fn(), get: jest.fn() },
          },
        ],
      }).compile();

      const unconfiguredService = module.get<PaddleService>(PaddleService);
      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe('getClientToken', () => {
    it('should return the client token', () => {
      expect(service.getClientToken()).toBe(PADDLE_CLIENT_TOKEN);
    });
  });

  describe('getEnvironment', () => {
    it('should return sandbox environment', () => {
      expect(service.getEnvironment()).toBe('sandbox');
    });

    it('should return live environment when configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaddleService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'PADDLE_VENDOR_ID') return PADDLE_VENDOR_ID;
                if (key === 'PADDLE_API_KEY') return PADDLE_API_KEY;
                if (key === 'PADDLE_CLIENT_TOKEN') return PADDLE_CLIENT_TOKEN;
                if (key === 'PADDLE_ENVIRONMENT') return 'live';
                return defaultValue;
              }),
            },
          },
          {
            provide: HttpService,
            useValue: { post: jest.fn(), get: jest.fn() },
          },
        ],
      }).compile();

      const liveService = module.get<PaddleService>(PaddleService);
      expect(liveService.getEnvironment()).toBe('live');
    });
  });

  describe('createCustomer', () => {
    it('should create a customer via Paddle API', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'ctm_test123',
            email: 'test@example.com',
          },
        },
      };

      httpService.post.mockReturnValue(of(mockResponse) as any);

      const result = await service.createCustomer({
        email: 'test@example.com',
        name: 'Test User',
        countryCode: 'US',
        metadata: { dhanam_user_id: 'user-123' },
      });

      expect(httpService.post).toHaveBeenCalledWith(
        'https://sandbox-api.paddle.com/customers',
        {
          email: 'test@example.com',
          name: 'Test User',
          locale: 'en',
          custom_data: {
            dhanam_user_id: 'user-123',
            source: 'dhanam',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${PADDLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      expect(result).toEqual({
        customerId: 'ctm_test123',
        email: 'test@example.com',
      });
    });

    it('should throw error if not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaddleService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'PADDLE_API_KEY') return '';
                if (key === 'PADDLE_VENDOR_ID') return '';
                return defaultValue;
              }),
            },
          },
          {
            provide: HttpService,
            useValue: { post: jest.fn(), get: jest.fn() },
          },
        ],
      }).compile();

      const unconfiguredService = module.get<PaddleService>(PaddleService);

      await expect(
        unconfiguredService.createCustomer({ email: 'test@example.com' })
      ).rejects.toThrow('Paddle not configured');
    });

    it('should handle API errors', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('API Error')) as any);

      await expect(service.createCustomer({ email: 'test@example.com' })).rejects.toThrow(
        'API Error'
      );
    });

    it('should use correct locale for different countries', async () => {
      const mockResponse = {
        data: { data: { id: 'ctm_test', email: 'test@example.com' } },
      };
      httpService.post.mockReturnValue(of(mockResponse) as any);

      // Test German locale
      await service.createCustomer({ email: 'test@example.de', countryCode: 'DE' });
      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ locale: 'de' }),
        expect.any(Object)
      );

      // Test French locale
      await service.createCustomer({ email: 'test@example.fr', countryCode: 'FR' });
      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ locale: 'fr' }),
        expect.any(Object)
      );

      // Test default English for unknown country
      await service.createCustomer({ email: 'test@example.com', countryCode: 'ZZ' });
      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ locale: 'en' }),
        expect.any(Object)
      );
    });
  });

  describe('createTransaction', () => {
    it('should create a transaction with customer ID', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'txn_test123',
            checkout: { url: 'https://checkout.paddle.com/test' },
          },
        },
      };

      httpService.post.mockReturnValue(of(mockResponse) as any);

      const result = await service.createTransaction({
        customerId: 'ctm_123',
        customerEmail: 'test@example.com',
        priceId: 'pri_premium',
        successUrl: 'https://app.dhanam.com/success',
        metadata: { dhanam_user_id: 'user-123' },
      });

      expect(httpService.post).toHaveBeenCalledWith(
        'https://sandbox-api.paddle.com/transactions',
        expect.objectContaining({
          customer_id: 'ctm_123',
          items: [{ price_id: 'pri_premium', quantity: 1 }],
          checkout: { url: 'https://app.dhanam.com/success' },
          custom_data: {
            dhanam_user_id: 'user-123',
            source: 'dhanam',
          },
        }),
        expect.any(Object)
      );

      expect(result).toEqual({
        transactionId: 'txn_test123',
        checkoutUrl: 'https://checkout.paddle.com/test',
      });
    });

    it('should create a transaction with customer email when no ID', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'txn_test123',
          },
        },
      };

      httpService.post.mockReturnValue(of(mockResponse) as any);

      const result = await service.createTransaction({
        customerEmail: 'test@example.com',
        customerName: 'Test User',
        priceId: 'pri_premium',
        successUrl: 'https://app.dhanam.com/success',
      });

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          customer: {
            email: 'test@example.com',
            name: 'Test User',
          },
        }),
        expect.any(Object)
      );

      // Should build checkout URL when not provided in response
      expect(result.checkoutUrl).toBe('https://sandbox-checkout.paddle.com/checkout/txn_test123');
    });

    it('should throw error if not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaddleService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn(() => '') },
          },
          {
            provide: HttpService,
            useValue: { post: jest.fn(), get: jest.fn() },
          },
        ],
      }).compile();

      const unconfiguredService = module.get<PaddleService>(PaddleService);

      await expect(
        unconfiguredService.createTransaction({
          customerEmail: 'test@example.com',
          priceId: 'pri_123',
          successUrl: 'https://example.com',
        })
      ).rejects.toThrow('Paddle not configured');
    });

    it('should handle API errors', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('Transaction creation failed')) as any
      );

      await expect(
        service.createTransaction({
          customerEmail: 'test@example.com',
          priceId: 'pri_123',
          successUrl: 'https://example.com',
        })
      ).rejects.toThrow('Transaction creation failed');
    });
  });

  describe('getSubscription', () => {
    it('should retrieve subscription details', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'sub_test123',
            status: 'active',
            customer_id: 'ctm_123',
            items: [{ price: { id: 'pri_premium' } }],
            current_billing_period: {
              ends_at: '2025-02-01T00:00:00Z',
            },
            scheduled_change: null,
          },
        },
      };

      httpService.get.mockReturnValue(of(mockResponse) as any);

      const result = await service.getSubscription('sub_test123');

      expect(httpService.get).toHaveBeenCalledWith(
        'https://sandbox-api.paddle.com/subscriptions/sub_test123',
        {
          headers: {
            Authorization: `Bearer ${PADDLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      expect(result).toEqual({
        id: 'sub_test123',
        status: 'active',
        customerId: 'ctm_123',
        priceId: 'pri_premium',
        currentPeriodEnd: expect.any(Date),
        cancelAtPeriodEnd: false,
      });
    });

    it('should detect scheduled cancellation', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'sub_test123',
            status: 'active',
            customer_id: 'ctm_123',
            items: [{ price: { id: 'pri_premium' } }],
            current_billing_period: {
              ends_at: '2025-02-01T00:00:00Z',
            },
            scheduled_change: { action: 'cancel' },
          },
        },
      };

      httpService.get.mockReturnValue(of(mockResponse) as any);

      const result = await service.getSubscription('sub_test123');

      expect(result.cancelAtPeriodEnd).toBe(true);
    });

    it('should throw error if not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaddleService,
          { provide: ConfigService, useValue: { get: jest.fn(() => '') } },
          { provide: HttpService, useValue: { post: jest.fn(), get: jest.fn() } },
        ],
      }).compile();

      const unconfiguredService = module.get<PaddleService>(PaddleService);

      await expect(unconfiguredService.getSubscription('sub_123')).rejects.toThrow(
        'Paddle not configured'
      );
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription immediately', async () => {
      httpService.post.mockReturnValue(of({ data: {} }) as any);

      await service.cancelSubscription('sub_test123', true);

      expect(httpService.post).toHaveBeenCalledWith(
        'https://sandbox-api.paddle.com/subscriptions/sub_test123/cancel',
        { effective_from: 'immediately' },
        expect.any(Object)
      );
    });

    it('should cancel subscription at next billing period', async () => {
      httpService.post.mockReturnValue(of({ data: {} }) as any);

      await service.cancelSubscription('sub_test123', false);

      expect(httpService.post).toHaveBeenCalledWith(
        'https://sandbox-api.paddle.com/subscriptions/sub_test123/cancel',
        { effective_from: 'next_billing_period' },
        expect.any(Object)
      );
    });

    it('should throw error if not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaddleService,
          { provide: ConfigService, useValue: { get: jest.fn(() => '') } },
          { provide: HttpService, useValue: { post: jest.fn(), get: jest.fn() } },
        ],
      }).compile();

      const unconfiguredService = module.get<PaddleService>(PaddleService);

      await expect(unconfiguredService.cancelSubscription('sub_123', false)).rejects.toThrow(
        'Paddle not configured'
      );
    });

    it('should handle API errors', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('Cancellation failed')) as any);

      await expect(service.cancelSubscription('sub_123', false)).rejects.toThrow(
        'Cancellation failed'
      );
    });
  });

  describe('pauseSubscription', () => {
    it('should pause subscription', async () => {
      httpService.post.mockReturnValue(of({ data: {} }) as any);

      await service.pauseSubscription('sub_test123');

      expect(httpService.post).toHaveBeenCalledWith(
        'https://sandbox-api.paddle.com/subscriptions/sub_test123/pause',
        {},
        expect.any(Object)
      );
    });

    it('should throw error if not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaddleService,
          { provide: ConfigService, useValue: { get: jest.fn(() => '') } },
          { provide: HttpService, useValue: { post: jest.fn(), get: jest.fn() } },
        ],
      }).compile();

      const unconfiguredService = module.get<PaddleService>(PaddleService);

      await expect(unconfiguredService.pauseSubscription('sub_123')).rejects.toThrow(
        'Paddle not configured'
      );
    });
  });

  describe('resumeSubscription', () => {
    it('should resume subscription immediately', async () => {
      httpService.post.mockReturnValue(of({ data: {} }) as any);

      await service.resumeSubscription('sub_test123');

      expect(httpService.post).toHaveBeenCalledWith(
        'https://sandbox-api.paddle.com/subscriptions/sub_test123/resume',
        { effective_from: 'immediately' },
        expect.any(Object)
      );
    });

    it('should throw error if not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaddleService,
          { provide: ConfigService, useValue: { get: jest.fn(() => '') } },
          { provide: HttpService, useValue: { post: jest.fn(), get: jest.fn() } },
        ],
      }).compile();

      const unconfiguredService = module.get<PaddleService>(PaddleService);

      await expect(unconfiguredService.resumeSubscription('sub_123')).rejects.toThrow(
        'Paddle not configured'
      );
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signature', () => {
      const payload = '{"event_type":"subscription.created"}';
      const timestamp = '1234567890';

      // Generate valid signature
      const signedPayload = `${timestamp}:${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', PADDLE_WEBHOOK_SECRET)
        .update(signedPayload)
        .digest('hex');

      const signature = `ts=${timestamp};h1=${expectedSignature}`;

      const result = service.verifyWebhookSignature(payload, signature);

      expect(result).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = '{"event_type":"subscription.created"}';
      const signature = 'ts=1234567890;h1=invalid_signature';

      const result = service.verifyWebhookSignature(payload, signature);

      expect(result).toBe(false);
    });

    it('should reject malformed signature format', () => {
      const payload = '{"event_type":"subscription.created"}';

      // Missing timestamp
      expect(service.verifyWebhookSignature(payload, 'h1=signature')).toBe(false);

      // Missing signature
      expect(service.verifyWebhookSignature(payload, 'ts=123456')).toBe(false);

      // Invalid format
      expect(service.verifyWebhookSignature(payload, 'invalid')).toBe(false);
    });

    it('should return false when webhook secret not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaddleService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'PADDLE_VENDOR_ID') return PADDLE_VENDOR_ID;
                if (key === 'PADDLE_API_KEY') return PADDLE_API_KEY;
                if (key === 'PADDLE_WEBHOOK_SECRET') return '';
                if (key === 'PADDLE_ENVIRONMENT') return 'sandbox';
                return defaultValue;
              }),
            },
          },
          {
            provide: HttpService,
            useValue: { post: jest.fn(), get: jest.fn() },
          },
        ],
      }).compile();

      const serviceWithoutSecret = module.get<PaddleService>(PaddleService);

      const result = serviceWithoutSecret.verifyWebhookSignature('payload', 'ts=123;h1=sig');

      expect(result).toBe(false);
    });
  });
});
