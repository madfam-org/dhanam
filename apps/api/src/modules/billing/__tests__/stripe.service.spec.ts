import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';

import { StripeService } from '../stripe.service';

describe('StripeService', () => {
  let service: StripeService;
  let configService: jest.Mocked<ConfigService>;

  const STRIPE_SECRET_KEY = 'sk_test_mock_key';
  const STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STRIPE_SECRET_KEY') return STRIPE_SECRET_KEY;
              if (key === 'STRIPE_WEBHOOK_SECRET') return STRIPE_WEBHOOK_SECRET;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should initialize Stripe with valid API key', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should warn when STRIPE_SECRET_KEY is not configured', async () => {
      const mockGet = jest.fn((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return null;
        return null;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StripeService,
          {
            provide: ConfigService,
            useValue: { get: mockGet },
          },
        ],
      }).compile();

      const unconfiguredService = module.get<StripeService>(StripeService);
      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe('createCustomer', () => {
    it('should create a Stripe customer with email and name', async () => {
      const mockCustomer = {
        id: 'cus_test123',
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user-123' },
      } as Stripe.Customer;

      // Mock the Stripe customers.create method
      const createSpy = jest
        .spyOn(service['stripe'].customers, 'create')
        .mockResolvedValue(mockCustomer);

      const result = await service.createCustomer({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user-123' },
      });

      expect(createSpy).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user-123' },
      });
      expect(result).toEqual(mockCustomer);
    });

    it('should create a customer with empty metadata if not provided', async () => {
      const mockCustomer = {
        id: 'cus_test123',
        email: 'test@example.com',
        metadata: {},
      } as Stripe.Customer;

      const createSpy = jest
        .spyOn(service['stripe'].customers, 'create')
        .mockResolvedValue(mockCustomer);

      await service.createCustomer({ email: 'test@example.com' });

      expect(createSpy).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: undefined,
        metadata: {},
      });
    });
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session for subscription', async () => {
      const mockSession = {
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/pay/cs_test123',
        customer: 'cus_test123',
        mode: 'subscription',
      } as Stripe.Checkout.Session;

      const createSpy = jest
        .spyOn(service['stripe'].checkout.sessions, 'create')
        .mockResolvedValue(mockSession);

      const result = await service.createCheckoutSession({
        customerId: 'cus_test123',
        priceId: 'price_test123',
        successUrl: 'https://app.dhanam.com/success',
        cancelUrl: 'https://app.dhanam.com/cancel',
        metadata: { userId: 'user-123' },
      });

      expect(createSpy).toHaveBeenCalledWith({
        customer: 'cus_test123',
        mode: 'subscription',
        line_items: [{ price: 'price_test123', quantity: 1 }],
        success_url: 'https://app.dhanam.com/success',
        cancel_url: 'https://app.dhanam.com/cancel',
        metadata: { userId: 'user-123' },
        billing_address_collection: 'auto',
        allow_promotion_codes: true,
        subscription_data: { metadata: { userId: 'user-123' } },
      });
      expect(result).toEqual(mockSession);
    });

    it('should create checkout session with empty metadata if not provided (lines 66, 70 branches)', async () => {
      const mockSession = {
        id: 'cs_test456',
        url: 'https://checkout.stripe.com/pay/cs_test456',
        customer: 'cus_test123',
        mode: 'subscription',
      } as Stripe.Checkout.Session;

      const createSpy = jest
        .spyOn(service['stripe'].checkout.sessions, 'create')
        .mockResolvedValue(mockSession);

      await service.createCheckoutSession({
        customerId: 'cus_test123',
        priceId: 'price_test123',
        successUrl: 'https://app.dhanam.com/success',
        cancelUrl: 'https://app.dhanam.com/cancel',
        // No metadata provided - tests lines 66 and 70 fallback to {}
      });

      expect(createSpy).toHaveBeenCalledWith({
        customer: 'cus_test123',
        mode: 'subscription',
        line_items: [{ price: 'price_test123', quantity: 1 }],
        success_url: 'https://app.dhanam.com/success',
        cancel_url: 'https://app.dhanam.com/cancel',
        metadata: {},
        billing_address_collection: 'auto',
        allow_promotion_codes: true,
        subscription_data: { metadata: {} },
      });
    });
  });

  describe('createPortalSession', () => {
    it('should create a billing portal session', async () => {
      const mockSession = {
        id: 'bps_test123',
        url: 'https://billing.stripe.com/session/test123',
        customer: 'cus_test123',
      } as Stripe.BillingPortal.Session;

      const createSpy = jest
        .spyOn(service['stripe'].billingPortal.sessions, 'create')
        .mockResolvedValue(mockSession);

      const result = await service.createPortalSession({
        customerId: 'cus_test123',
        returnUrl: 'https://app.dhanam.com/billing',
      });

      expect(createSpy).toHaveBeenCalledWith({
        customer: 'cus_test123',
        return_url: 'https://app.dhanam.com/billing',
      });
      expect(result).toEqual(mockSession);
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel a subscription', async () => {
      const mockSubscription = {
        id: 'sub_test123',
        status: 'canceled',
      } as Stripe.Subscription;

      const cancelSpy = jest
        .spyOn(service['stripe'].subscriptions, 'cancel')
        .mockResolvedValue(mockSubscription);

      const result = await service.cancelSubscription('sub_test123');

      expect(cancelSpy).toHaveBeenCalledWith('sub_test123');
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('updateSubscription', () => {
    it('should update a subscription', async () => {
      const mockSubscription = {
        id: 'sub_test123',
        status: 'active',
      } as Stripe.Subscription;

      const updateSpy = jest
        .spyOn(service['stripe'].subscriptions, 'update')
        .mockResolvedValue(mockSubscription);

      const params: Stripe.SubscriptionUpdateParams = {
        metadata: { updated: 'true' },
      };

      const result = await service.updateSubscription('sub_test123', params);

      expect(updateSpy).toHaveBeenCalledWith('sub_test123', params);
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('getSubscription', () => {
    it('should retrieve a subscription', async () => {
      const mockSubscription = {
        id: 'sub_test123',
        status: 'active',
        customer: 'cus_test123',
      } as Stripe.Subscription;

      const retrieveSpy = jest
        .spyOn(service['stripe'].subscriptions, 'retrieve')
        .mockResolvedValue(mockSubscription);

      const result = await service.getSubscription('sub_test123');

      expect(retrieveSpy).toHaveBeenCalledWith('sub_test123');
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('getCustomer', () => {
    it('should retrieve a customer', async () => {
      const mockCustomer = {
        id: 'cus_test123',
        email: 'test@example.com',
      } as Stripe.Customer;

      const retrieveSpy = jest
        .spyOn(service['stripe'].customers, 'retrieve')
        .mockResolvedValue(mockCustomer);

      const result = await service.getCustomer('cus_test123');

      expect(retrieveSpy).toHaveBeenCalledWith('cus_test123');
      expect(result).toEqual(mockCustomer);
    });
  });

  describe('constructWebhookEvent', () => {
    it('should construct and verify webhook event with valid signature', () => {
      const payload = JSON.stringify({ type: 'customer.subscription.created' });
      const signature = 'valid_signature';
      const mockEvent = {
        id: 'evt_test123',
        type: 'customer.subscription.created',
      } as Stripe.Event;

      const constructSpy = jest
        .spyOn(service['stripe'].webhooks, 'constructEvent')
        .mockReturnValue(mockEvent);

      const result = service.constructWebhookEvent(payload, signature, STRIPE_WEBHOOK_SECRET);

      expect(constructSpy).toHaveBeenCalledWith(payload, signature, STRIPE_WEBHOOK_SECRET);
      expect(result).toEqual(mockEvent);
    });

    it('should throw error for invalid webhook signature', () => {
      const payload = JSON.stringify({ type: 'customer.subscription.created' });
      const invalidSignature = 'invalid_signature';

      jest.spyOn(service['stripe'].webhooks, 'constructEvent').mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() => {
        service.constructWebhookEvent(payload, invalidSignature, STRIPE_WEBHOOK_SECRET);
      }).toThrow('Invalid signature');
    });
  });

  describe('getUpcomingInvoice', () => {
    it('should retrieve upcoming invoice for customer', async () => {
      const mockInvoice = {
        id: 'in_test123',
        customer: 'cus_test123',
        amount_due: 1999,
      } as Stripe.Invoice;

      // Mock the upcoming method on the invoices object
      const mockUpcoming = jest.fn().mockResolvedValue(mockInvoice);
      (service['stripe'].invoices as any).upcoming = mockUpcoming;

      const result = await service.getUpcomingInvoice('cus_test123');

      expect(mockUpcoming).toHaveBeenCalledWith({ customer: 'cus_test123' });
      expect(result).toEqual(mockInvoice);
    });
  });

  describe('listInvoices', () => {
    it('should list customer invoices with default limit', async () => {
      const mockInvoiceList = {
        data: [
          { id: 'in_1', amount_due: 1999 },
          { id: 'in_2', amount_due: 1999 },
        ],
      } as Stripe.ApiList<Stripe.Invoice>;

      const listSpy = jest
        .spyOn(service['stripe'].invoices, 'list')
        .mockResolvedValue(mockInvoiceList);

      const result = await service.listInvoices('cus_test123');

      expect(listSpy).toHaveBeenCalledWith({ customer: 'cus_test123', limit: 10 });
      expect(result).toEqual(mockInvoiceList);
    });

    it('should list customer invoices with custom limit', async () => {
      const mockInvoiceList = {
        data: [{ id: 'in_1', amount_due: 1999 }],
      } as Stripe.ApiList<Stripe.Invoice>;

      const listSpy = jest
        .spyOn(service['stripe'].invoices, 'list')
        .mockResolvedValue(mockInvoiceList);

      await service.listInvoices('cus_test123', 5);

      expect(listSpy).toHaveBeenCalledWith({ customer: 'cus_test123', limit: 5 });
    });
  });
});
