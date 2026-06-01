import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';

import { InfrastructureException } from '../../../core/exceptions/domain-exceptions';
import { StripeMxService } from '../services/stripe-mx.service';

describe('StripeMxService', () => {
  let service: StripeMxService;
  let configService: jest.Mocked<ConfigService>;

  const STRIPE_MX_SECRET_KEY = 'sk_test_mx_mock_key';
  const STRIPE_MX_WEBHOOK_SECRET = 'DUMMY_WEBHOOK_SECRET_DO_NOT_USE';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeMxService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'STRIPE_MX_SECRET_KEY') return STRIPE_MX_SECRET_KEY;
              if (key === 'STRIPE_MX_WEBHOOK_SECRET') return STRIPE_MX_WEBHOOK_SECRET;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StripeMxService>(StripeMxService);
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should initialize Stripe MX with valid API key', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should not be configured when STRIPE_MX_SECRET_KEY is missing', async () => {
      const mockGet = jest.fn((key: string, defaultValue?: any) => {
        if (key === 'STRIPE_MX_SECRET_KEY') return null;
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StripeMxService,
          {
            provide: ConfigService,
            useValue: { get: mockGet },
          },
        ],
      }).compile();

      const unconfiguredService = module.get<StripeMxService>(StripeMxService);
      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe('createCustomer', () => {
    it('should create a customer with Mexico region metadata', async () => {
      const mockCustomer = {
        id: 'cus_mx_test123',
        email: 'usuario@ejemplo.mx',
        name: 'Usuario Mexicano',
        metadata: { dhanam_user_id: 'user-123', region: 'MX', source: 'dhanam' },
        preferred_locales: ['es-MX'],
      } as Stripe.Customer;

      const createSpy = jest
        .spyOn(service['stripe']!.customers, 'create')
        .mockResolvedValue(mockCustomer);

      const result = await service.createCustomer({
        email: 'usuario@ejemplo.mx',
        name: 'Usuario Mexicano',
        phone: '+525512345678',
        metadata: { dhanam_user_id: 'user-123' },
      });

      expect(createSpy).toHaveBeenCalledWith({
        email: 'usuario@ejemplo.mx',
        name: 'Usuario Mexicano',
        phone: '+525512345678',
        metadata: {
          dhanam_user_id: 'user-123',
          region: 'MX',
          source: 'dhanam',
        },
        preferred_locales: ['es-MX'],
      });
      expect(result).toEqual(mockCustomer);
    });

    it('should throw error if not configured', async () => {
      const mockGet = jest.fn(() => null);
      const module: TestingModule = await Test.createTestingModule({
        providers: [StripeMxService, { provide: ConfigService, useValue: { get: mockGet } }],
      }).compile();

      const unconfiguredService = module.get<StripeMxService>(StripeMxService);

      await expect(
        unconfiguredService.createCustomer({ email: 'test@example.com' })
      ).rejects.toThrow(InfrastructureException);
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session with Mexican payment methods', async () => {
      const mockSession = {
        id: 'cs_mx_test123',
        url: 'https://checkout.stripe.com/pay/cs_mx_test123',
        customer: 'cus_mx_test123',
        mode: 'subscription',
      } as Stripe.Checkout.Session;

      const createSpy = jest
        .spyOn(service['stripe']!.checkout.sessions, 'create')
        .mockResolvedValue(mockSession);

      const result = await service.createCheckoutSession({
        customerId: 'cus_mx_test123',
        customerEmail: 'usuario@ejemplo.mx',
        customerName: 'Usuario Mexicano',
        priceId: 'price_premium_mx',
        successUrl: 'https://app.dhanam.com/success',
        cancelUrl: 'https://app.dhanam.com/cancel',
        metadata: { dhanam_user_id: 'user-123' },
        paymentMethods: ['card', 'oxxo', 'customer_balance'],
      });

      expect(createSpy).toHaveBeenCalledWith({
        mode: 'subscription',
        customer: 'cus_mx_test123',
        customer_email: undefined, // Not used when customerId is provided
        line_items: [{ price: 'price_premium_mx', quantity: 1 }],
        payment_method_types: ['card', 'oxxo', 'customer_balance'],
        success_url: 'https://app.dhanam.com/success',
        cancel_url: 'https://app.dhanam.com/cancel',
        locale: 'es-419',
        currency: 'mxn',
        billing_address_collection: 'required',
        metadata: {
          dhanam_user_id: 'user-123',
          region: 'MX',
          provider: 'stripe_mx',
        },
        subscription_data: {
          metadata: {
            dhanam_user_id: 'user-123',
            region: 'MX',
          },
        },
        automatic_tax: { enabled: true },
        tax_id_collection: { enabled: true },
      });
      expect(result).toEqual(mockSession);
    });

    it('should use default payment methods if not specified', async () => {
      const mockSession = {
        id: 'cs_mx_test123',
        url: 'https://checkout.stripe.com/pay/cs_mx_test123',
      } as Stripe.Checkout.Session;

      const createSpy = jest
        .spyOn(service['stripe']!.checkout.sessions, 'create')
        .mockResolvedValue(mockSession);

      await service.createCheckoutSession({
        customerEmail: 'usuario@ejemplo.mx',
        priceId: 'price_premium_mx',
        successUrl: 'https://app.dhanam.com/success',
        cancelUrl: 'https://app.dhanam.com/cancel',
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['card', 'oxxo', 'customer_balance'],
        })
      );
    });

    it('should use customer_email when customerId not provided', async () => {
      const mockSession = {
        id: 'cs_mx_test123',
        url: 'https://checkout.stripe.com/pay/cs_mx_test123',
      } as Stripe.Checkout.Session;

      const createSpy = jest
        .spyOn(service['stripe']!.checkout.sessions, 'create')
        .mockResolvedValue(mockSession);

      await service.createCheckoutSession({
        customerEmail: 'usuario@ejemplo.mx',
        priceId: 'price_premium_mx',
        successUrl: 'https://app.dhanam.com/success',
        cancelUrl: 'https://app.dhanam.com/cancel',
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_email: 'usuario@ejemplo.mx',
          customer: undefined,
        })
      );
    });

    it('should throw error if not configured', async () => {
      const mockGet = jest.fn(() => null);
      const module: TestingModule = await Test.createTestingModule({
        providers: [StripeMxService, { provide: ConfigService, useValue: { get: mockGet } }],
      }).compile();

      const unconfiguredService = module.get<StripeMxService>(StripeMxService);

      await expect(
        unconfiguredService.createCheckoutSession({
          customerEmail: 'test@example.com',
          priceId: 'price_123',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        })
      ).rejects.toThrow(InfrastructureException);
    });
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent in MXN', async () => {
      const mockPaymentIntent = {
        id: 'pi_mx_test123',
        amount: 49900,
        currency: 'mxn',
      } as Stripe.PaymentIntent;

      const createSpy = jest
        .spyOn(service['stripe']!.paymentIntents, 'create')
        .mockResolvedValue(mockPaymentIntent);

      const result = await service.createPaymentIntent({
        amount: 49900, // 499 MXN in centavos
        customerId: 'cus_mx_123',
        customerEmail: 'usuario@ejemplo.mx',
        description: 'Dhanam Premium Subscription',
        paymentMethod: 'oxxo',
        metadata: { dhanam_user_id: 'user-123' },
      });

      expect(createSpy).toHaveBeenCalledWith({
        amount: 49900,
        currency: 'mxn',
        customer: 'cus_mx_123',
        receipt_email: 'usuario@ejemplo.mx',
        description: 'Dhanam Premium Subscription',
        payment_method_types: ['oxxo'],
        metadata: {
          dhanam_user_id: 'user-123',
          region: 'MX',
        },
      });
      expect(result).toEqual(mockPaymentIntent);
    });

    it('should default to card payment method', async () => {
      const mockPaymentIntent = {
        id: 'pi_mx_test123',
        amount: 49900,
        currency: 'mxn',
      } as Stripe.PaymentIntent;

      const createSpy = jest
        .spyOn(service['stripe']!.paymentIntents, 'create')
        .mockResolvedValue(mockPaymentIntent);

      await service.createPaymentIntent({
        amount: 49900,
        customerEmail: 'usuario@ejemplo.mx',
        description: 'Test payment',
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['card'],
        })
      );
    });
  });

  describe('createPortalSession', () => {
    it('should create billing portal session with Spanish locale', async () => {
      const mockSession = {
        id: 'bps_mx_test123',
        url: 'https://billing.stripe.com/session/test123',
      } as Stripe.BillingPortal.Session;

      const createSpy = jest
        .spyOn(service['stripe']!.billingPortal.sessions, 'create')
        .mockResolvedValue(mockSession);

      const result = await service.createPortalSession({
        customerId: 'cus_mx_123',
        returnUrl: 'https://app.dhanam.com/billing',
      });

      expect(createSpy).toHaveBeenCalledWith({
        customer: 'cus_mx_123',
        return_url: 'https://app.dhanam.com/billing',
        locale: 'es-419',
      });
      expect(result).toEqual(mockSession);
    });

    it('should throw error if not configured', async () => {
      const mockGet = jest.fn(() => null);
      const module: TestingModule = await Test.createTestingModule({
        providers: [StripeMxService, { provide: ConfigService, useValue: { get: mockGet } }],
      }).compile();

      const unconfiguredService = module.get<StripeMxService>(StripeMxService);

      await expect(
        unconfiguredService.createPortalSession({
          customerId: 'cus_123',
          returnUrl: 'https://example.com',
        })
      ).rejects.toThrow(InfrastructureException);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should construct and verify webhook event', () => {
      const payload = JSON.stringify({ type: 'customer.subscription.created' });
      const signature = 'valid_signature';
      const mockEvent = {
        id: 'evt_mx_test123',
        type: 'customer.subscription.created',
      } as Stripe.Event;

      const constructSpy = jest
        .spyOn(service['stripe']!.webhooks, 'constructEvent')
        .mockReturnValue(mockEvent);

      const result = service.verifyWebhookSignature(payload, signature);

      expect(constructSpy).toHaveBeenCalledWith(payload, signature, STRIPE_MX_WEBHOOK_SECRET);
      expect(result).toEqual(mockEvent);
    });

    it('should throw error if webhook secret not configured', async () => {
      const mockGet = jest.fn((key: string, defaultValue?: any) => {
        if (key === 'STRIPE_MX_SECRET_KEY') return STRIPE_MX_SECRET_KEY;
        if (key === 'STRIPE_MX_WEBHOOK_SECRET') return '';
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [StripeMxService, { provide: ConfigService, useValue: { get: mockGet } }],
      }).compile();

      const serviceWithoutWebhookSecret = module.get<StripeMxService>(StripeMxService);

      expect(() => {
        serviceWithoutWebhookSecret.verifyWebhookSignature('payload', 'signature');
      }).toThrow(InfrastructureException);
    });

    it('should throw error for invalid signature', () => {
      jest.spyOn(service['stripe']!.webhooks, 'constructEvent').mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() => {
        service.verifyWebhookSignature('payload', 'invalid_signature');
      }).toThrow('Invalid signature');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription immediately', async () => {
      const mockSubscription = {
        id: 'sub_mx_test123',
        status: 'canceled',
      } as Stripe.Subscription;

      const cancelSpy = jest
        .spyOn(service['stripe']!.subscriptions, 'cancel')
        .mockResolvedValue(mockSubscription);

      const result = await service.cancelSubscription('sub_mx_test123', true);

      expect(cancelSpy).toHaveBeenCalledWith('sub_mx_test123');
      expect(result).toEqual(mockSubscription);
    });

    it('should cancel subscription at period end by default', async () => {
      const mockSubscription = {
        id: 'sub_mx_test123',
        status: 'active',
        cancel_at_period_end: true,
      } as Stripe.Subscription;

      const updateSpy = jest
        .spyOn(service['stripe']!.subscriptions, 'update')
        .mockResolvedValue(mockSubscription);

      const result = await service.cancelSubscription('sub_mx_test123', false);

      expect(updateSpy).toHaveBeenCalledWith('sub_mx_test123', {
        cancel_at_period_end: true,
      });
      expect(result).toEqual(mockSubscription);
    });

    it('should throw error if not configured', async () => {
      const mockGet = jest.fn(() => null);
      const module: TestingModule = await Test.createTestingModule({
        providers: [StripeMxService, { provide: ConfigService, useValue: { get: mockGet } }],
      }).compile();

      const unconfiguredService = module.get<StripeMxService>(StripeMxService);

      await expect(unconfiguredService.cancelSubscription('sub_123', false)).rejects.toThrow(
        InfrastructureException
      );
    });
  });

  describe('getSubscription', () => {
    it('should retrieve subscription', async () => {
      const mockSubscription = {
        id: 'sub_mx_test123',
        status: 'active',
        customer: 'cus_mx_123',
      } as Stripe.Subscription;

      const retrieveSpy = jest
        .spyOn(service['stripe']!.subscriptions, 'retrieve')
        .mockResolvedValue(mockSubscription);

      const result = await service.getSubscription('sub_mx_test123');

      expect(retrieveSpy).toHaveBeenCalledWith('sub_mx_test123');
      expect(result).toEqual(mockSubscription);
    });

    it('should throw error if not configured', async () => {
      const mockGet = jest.fn(() => null);
      const module: TestingModule = await Test.createTestingModule({
        providers: [StripeMxService, { provide: ConfigService, useValue: { get: mockGet } }],
      }).compile();

      const unconfiguredService = module.get<StripeMxService>(StripeMxService);

      await expect(unconfiguredService.getSubscription('sub_123')).rejects.toThrow(
        InfrastructureException
      );
    });
  });

  describe('createSpeiPaymentIntent (T1.1)', () => {
    it('creates an MXN PaymentIntent with customer_balance + bank_transfer', async () => {
      const mockPi = {
        id: 'pi_spei_test123',
        amount: 19900,
        currency: 'mxn',
        status: 'requires_action',
      } as Stripe.PaymentIntent;

      const createSpy = jest
        .spyOn(service['stripe']!.paymentIntents, 'create')
        .mockResolvedValue(mockPi);

      const result = await service.createSpeiPaymentIntent({
        amount: 19900,
        currency: 'MXN',
        customerId: 'cus_mx_123',
        customerEmail: 'usuario@ejemplo.mx',
        description: 'Karafiel Contador — mensual',
        paymentRequestId: 'dhanam-pi-user123-inv456',
        metadata: { dhanam_user_id: 'user-123' },
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 19900,
          currency: 'mxn',
          customer: 'cus_mx_123',
          receipt_email: 'usuario@ejemplo.mx',
          description: 'Karafiel Contador — mensual',
          payment_method_types: ['customer_balance'],
          payment_method_data: { type: 'customer_balance' },
          payment_method_options: {
            customer_balance: {
              funding_type: 'bank_transfer',
              bank_transfer: { type: 'mx_bank_transfer' },
            },
          },
          confirm: true,
          metadata: expect.objectContaining({
            dhanam_user_id: 'user-123',
            region: 'MX',
            payment_request_id: 'dhanam-pi-user123-inv456',
            settlement_rail: 'spei',
          }),
        }),
        { idempotencyKey: 'dhanam-pi-user123-inv456' }
      );
      expect(result).toEqual(mockPi);
    });

    it('rejects non-MXN currency', async () => {
      await expect(
        service.createSpeiPaymentIntent({
          amount: 19900,
          currency: 'USD',
          customerEmail: 'u@e.mx',
          description: 'x',
          paymentRequestId: 'req-1',
        })
      ).rejects.toThrow(InfrastructureException);
    });

    it('rejects missing paymentRequestId (idempotency is mandatory)', async () => {
      await expect(
        service.createSpeiPaymentIntent({
          amount: 19900,
          customerEmail: 'u@e.mx',
          description: 'x',
          paymentRequestId: '',
        })
      ).rejects.toThrow(InfrastructureException);
    });

    it('rejects non-positive or non-integer amounts', async () => {
      await expect(
        service.createSpeiPaymentIntent({
          amount: 0,
          customerEmail: 'u@e.mx',
          description: 'x',
          paymentRequestId: 'req-1',
        })
      ).rejects.toThrow(InfrastructureException);

      await expect(
        service.createSpeiPaymentIntent({
          amount: 99.5 as unknown as number,
          customerEmail: 'u@e.mx',
          description: 'x',
          paymentRequestId: 'req-1',
        })
      ).rejects.toThrow(InfrastructureException);
    });

    it('throws when service not configured', async () => {
      const mockGet = jest.fn(() => null);
      const module: TestingModule = await Test.createTestingModule({
        providers: [StripeMxService, { provide: ConfigService, useValue: { get: mockGet } }],
      }).compile();

      const unconfiguredService = module.get<StripeMxService>(StripeMxService);

      await expect(
        unconfiguredService.createSpeiPaymentIntent({
          amount: 19900,
          customerEmail: 'u@e.mx',
          description: 'x',
          paymentRequestId: 'req-1',
        })
      ).rejects.toThrow(InfrastructureException);
    });
  });

  describe('getCustomer', () => {
    it('should retrieve customer', async () => {
      const mockCustomer = {
        id: 'cus_mx_test123',
        email: 'usuario@ejemplo.mx',
      } as Stripe.Customer;

      const retrieveSpy = jest
        .spyOn(service['stripe']!.customers, 'retrieve')
        .mockResolvedValue(mockCustomer);

      const result = await service.getCustomer('cus_mx_test123');

      expect(retrieveSpy).toHaveBeenCalledWith('cus_mx_test123');
      expect(result).toEqual(mockCustomer);
    });

    it('should throw error if not configured', async () => {
      const mockGet = jest.fn(() => null);
      const module: TestingModule = await Test.createTestingModule({
        providers: [StripeMxService, { provide: ConfigService, useValue: { get: mockGet } }],
      }).compile();

      const unconfiguredService = module.get<StripeMxService>(StripeMxService);

      await expect(unconfiguredService.getCustomer('cus_123')).rejects.toThrow(
        InfrastructureException
      );
    });
  });
});
