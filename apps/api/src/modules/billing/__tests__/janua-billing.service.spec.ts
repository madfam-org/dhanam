import * as crypto from 'crypto';

import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { JanuaBillingService } from '../janua-billing.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('JanuaBillingService', () => {
  let service: JanuaBillingService;
  let configService: jest.Mocked<ConfigService>;

  const JANUA_API_URL = 'http://janua-api:8001';
  const JANUA_API_KEY = 'test_janua_api_key';
  const JANUA_WEBHOOK_SECRET = 'test_janua_webhook_secret';

  beforeEach(async () => {
    mockFetch.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JanuaBillingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'JANUA_API_URL') return JANUA_API_URL;
              if (key === 'JANUA_API_KEY') return JANUA_API_KEY;
              if (key === 'JANUA_BILLING_ENABLED') return true;
              if (key === 'JANUA_WEBHOOK_SECRET') return JANUA_WEBHOOK_SECRET;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<JanuaBillingService>(JanuaBillingService);
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should be enabled with valid API key', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should not be enabled without API key', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JanuaBillingService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'JANUA_API_KEY') return '';
                if (key === 'JANUA_BILLING_ENABLED') return true;
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const disabledService = module.get<JanuaBillingService>(JanuaBillingService);
      expect(disabledService.isEnabled()).toBe(false);
    });

    it('should not be enabled when disabled via config', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JanuaBillingService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'JANUA_API_KEY') return JANUA_API_KEY;
                if (key === 'JANUA_BILLING_ENABLED') return false;
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const disabledService = module.get<JanuaBillingService>(JanuaBillingService);
      expect(disabledService.isEnabled()).toBe(false);
    });

    it('should not treat the string false as enabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JanuaBillingService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'JANUA_API_KEY') return JANUA_API_KEY;
                if (key === 'JANUA_BILLING_ENABLED') return 'false';
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const disabledService = module.get<JanuaBillingService>(JanuaBillingService);
      expect(disabledService.isEnabled()).toBe(false);
    });

    it('should default to disabled when the Janua billing flag is absent', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JanuaBillingService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'JANUA_API_KEY') return JANUA_API_KEY;
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const disabledService = module.get<JanuaBillingService>(JanuaBillingService);
      expect(disabledService.isEnabled()).toBe(false);
    });
  });

  describe('getProviderForCountry', () => {
    it('should route Mexico to conekta', () => {
      const provider = service.getProviderForCountry('MX');
      expect(provider).toBe('conekta');
    });

    it('should route US to polar', () => {
      const provider = service.getProviderForCountry('US');
      expect(provider).toBe('polar');
    });

    it('should route other countries to polar', () => {
      const countries = ['DE', 'FR', 'GB', 'JP', 'BR', 'CA'];
      countries.forEach((country) => {
        expect(service.getProviderForCountry(country)).toBe('polar');
      });
    });
  });

  describe('createCustomer', () => {
    it('should create customer via Janua API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          customer_id: 'cus_janua_123',
        }),
      });

      const result = await service.createCustomer({
        email: 'test@example.com',
        name: 'Test User',
        countryCode: 'MX',
        metadata: { dhanam_user_id: 'user-123' },
      });

      expect(mockFetch).toHaveBeenCalledWith(`${JANUA_API_URL}/api/billing/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${JANUA_API_KEY}`,
        },
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'Test User',
          country_code: 'MX',
          provider: 'conekta', // Mexico → conekta
          metadata: {
            dhanam_user_id: 'user-123',
            product: 'dhanam',
          },
        }),
      });

      expect(result).toEqual({
        customerId: 'cus_janua_123',
        provider: 'conekta',
      });
    });

    it('should use polar provider for non-MX countries', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ customer_id: 'cus_polar_123' }),
      });

      const result = await service.createCustomer({
        email: 'test@example.com',
        countryCode: 'US',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"provider":"polar"'),
        })
      );

      expect(result.provider).toBe('polar');
    });

    it('should throw error if not enabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JanuaBillingService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'JANUA_API_KEY') return '';
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const disabledService = module.get<JanuaBillingService>(JanuaBillingService);

      await expect(
        disabledService.createCustomer({
          email: 'test@example.com',
          countryCode: 'MX',
        })
      ).rejects.toThrow('Janua billing not enabled');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: async () => 'Internal Server Error',
      });

      await expect(
        service.createCustomer({
          email: 'test@example.com',
          countryCode: 'MX',
        })
      ).rejects.toThrow('Failed to create customer: Internal Server Error');
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session via Janua API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          checkout_url: 'https://checkout.conekta.com/session123',
          session_id: 'session_123',
        }),
      });

      const result = await service.createCheckoutSession({
        customerId: 'cus_123',
        customerEmail: 'test@ejemplo.mx',
        priceId: 'pro',
        countryCode: 'MX',
        successUrl: 'https://app.dhanam.com/success',
        cancelUrl: 'https://app.dhanam.com/cancel',
        metadata: { dhanam_user_id: 'user-123' },
      });

      expect(mockFetch).toHaveBeenCalledWith(`${JANUA_API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${JANUA_API_KEY}`,
        },
        body: JSON.stringify({
          customer_id: 'cus_123',
          customer_email: 'test@ejemplo.mx',
          plan_id: 'dhanam_pro',
          country_code: 'MX',
          provider: 'conekta',
          success_url: 'https://app.dhanam.com/success',
          cancel_url: 'https://app.dhanam.com/cancel',
          metadata: {
            dhanam_user_id: 'user-123',
            product: 'dhanam',
          },
        }),
      });

      expect(result).toEqual({
        checkoutUrl: 'https://checkout.conekta.com/session123',
        sessionId: 'session_123',
        provider: 'conekta',
      });
    });

    it('should throw error if not enabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JanuaBillingService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn(() => '') },
          },
        ],
      }).compile();

      const disabledService = module.get<JanuaBillingService>(JanuaBillingService);

      await expect(
        disabledService.createCheckoutSession({
          customerId: 'cus_123',
          customerEmail: 'test@example.com',
          priceId: 'pro',
          countryCode: 'MX',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        })
      ).rejects.toThrow('Janua billing not enabled');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: async () => 'Invalid plan ID',
      });

      await expect(
        service.createCheckoutSession({
          customerId: 'cus_123',
          customerEmail: 'test@example.com',
          priceId: 'invalid',
          countryCode: 'MX',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        })
      ).rejects.toThrow('Failed to create checkout: Invalid plan ID');
    });
  });

  describe('createPortalSession', () => {
    it('should create portal session via Janua API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          portal_url: 'https://billing.conekta.com/portal123',
        }),
      });

      const result = await service.createPortalSession({
        customerId: 'cus_123',
        countryCode: 'MX',
        returnUrl: 'https://app.dhanam.com/billing',
      });

      expect(mockFetch).toHaveBeenCalledWith(`${JANUA_API_URL}/api/billing/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${JANUA_API_KEY}`,
        },
        body: JSON.stringify({
          customer_id: 'cus_123',
          provider: 'conekta',
          return_url: 'https://app.dhanam.com/billing',
        }),
      });

      expect(result).toEqual({
        portalUrl: 'https://billing.conekta.com/portal123',
      });
    });

    it('should throw error if not enabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JanuaBillingService,
          { provide: ConfigService, useValue: { get: jest.fn(() => '') } },
        ],
      }).compile();

      const disabledService = module.get<JanuaBillingService>(JanuaBillingService);

      await expect(
        disabledService.createPortalSession({
          customerId: 'cus_123',
          countryCode: 'MX',
          returnUrl: 'https://example.com',
        })
      ).rejects.toThrow('Janua billing not enabled');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: async () => 'Customer not found',
      });

      await expect(
        service.createPortalSession({
          customerId: 'cus_invalid',
          countryCode: 'MX',
          returnUrl: 'https://example.com',
        })
      ).rejects.toThrow('Failed to create portal session: Customer not found');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription via Janua API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await service.cancelSubscription({
        subscriptionId: 'sub_123',
        provider: 'conekta',
        immediate: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${JANUA_API_URL}/api/billing/subscriptions/sub_123/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${JANUA_API_KEY}`,
          },
          body: JSON.stringify({
            provider: 'conekta',
            immediate: false,
          }),
        }
      );
    });

    it('should cancel subscription immediately when specified', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await service.cancelSubscription({
        subscriptionId: 'sub_123',
        provider: 'polar',
        immediate: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"immediate":true'),
        })
      );
    });

    it('should throw error if not enabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JanuaBillingService,
          { provide: ConfigService, useValue: { get: jest.fn(() => '') } },
        ],
      }).compile();

      const disabledService = module.get<JanuaBillingService>(JanuaBillingService);

      await expect(
        disabledService.cancelSubscription({
          subscriptionId: 'sub_123',
          provider: 'conekta',
        })
      ).rejects.toThrow('Janua billing not enabled');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: async () => 'Subscription already cancelled',
      });

      await expect(
        service.cancelSubscription({
          subscriptionId: 'sub_123',
          provider: 'conekta',
        })
      ).rejects.toThrow('Failed to cancel subscription: Subscription already cancelled');
    });
  });

  describe('getPlans', () => {
    it('should return MXN plans for Mexico', async () => {
      const plans = await service.getPlans('MX');

      expect(plans).toHaveLength(4);

      const freePlan = plans.find((p) => p.id === 'community');
      expect(freePlan).toMatchObject({
        price: 0,
        currency: 'MXN',
      });

      const proPlan = plans.find((p) => p.id === 'pro');
      expect(proPlan).toMatchObject({
        price: 199,
        currency: 'MXN',
      });

      const premiumPlan = plans.find((p) => p.id === 'premium');
      expect(premiumPlan).toMatchObject({
        price: 329,
        currency: 'MXN',
      });
    });

    it('should return USD plans for other countries', async () => {
      const plans = await service.getPlans('US');

      expect(plans).toHaveLength(4);

      const freePlan = plans.find((p) => p.id === 'community');
      expect(freePlan).toMatchObject({
        price: 0,
        currency: 'USD',
      });

      const proPlan = plans.find((p) => p.id === 'pro');
      expect(proPlan).toMatchObject({
        price: 11.99,
        currency: 'USD',
      });

      const premiumPlan = plans.find((p) => p.id === 'premium');
      expect(premiumPlan).toMatchObject({
        price: 19.99,
        currency: 'USD',
      });
    });

    it('should include correct features for community plan', async () => {
      const plans = await service.getPlans('US');
      const freePlan = plans.find((p) => p.id === 'community');

      expect(freePlan?.features).toContain('Unlimited simulations & ESG');
      expect(freePlan?.features).toContain('All features included');
      expect(freePlan?.features).toContain('Self-hosted — bring your own keys');
    });

    it('should include correct features for pro plan', async () => {
      const plans = await service.getPlans('US');
      const premiumPlan = plans.find((p) => p.id === 'pro');

      expect(premiumPlan?.features).toContain('Unlimited ESG calculations');
      expect(premiumPlan?.features).toContain('Life Beat / estate planning');
      expect(premiumPlan?.features).toContain('Priority support (24hr SLA)');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signature', () => {
      const payload = '{"event":"subscription.created"}';

      // Generate valid signature
      const expectedSignature = crypto
        .createHmac('sha256', JANUA_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      const result = service.verifyWebhookSignature(payload, expectedSignature);

      expect(result).toBe(true);
    });

    it('should reject invalid webhook signature with matching length', () => {
      const payload = '{"event":"subscription.created"}';

      // Generate a different signature (same length but wrong content)
      const wrongSignature = crypto
        .createHmac('sha256', 'wrong_secret')
        .update(payload)
        .digest('hex');

      const result = service.verifyWebhookSignature(payload, wrongSignature);

      expect(result).toBe(false);
    });

    it('should return false when webhook secret not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JanuaBillingService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'JANUA_API_URL') return JANUA_API_URL;
                if (key === 'JANUA_API_KEY') return JANUA_API_KEY;
                if (key === 'JANUA_BILLING_ENABLED') return true;
                if (key === 'JANUA_WEBHOOK_SECRET') return '';
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const serviceWithoutSecret = module.get<JanuaBillingService>(JanuaBillingService);

      const result = serviceWithoutSecret.verifyWebhookSignature('payload', 'signature');

      expect(result).toBe(false);
    });

    it('should throw error for signature length mismatch (timingSafeEqual behavior)', () => {
      const payload = '{"event":"subscription.created"}';
      // Signature with different length - timingSafeEqual throws RangeError
      const shortSignature = 'short';

      // timingSafeEqual requires equal length buffers
      expect(() => {
        service.verifyWebhookSignature(payload, shortSignature);
      }).toThrow('Input buffers must have the same byte length');
    });
  });
});
