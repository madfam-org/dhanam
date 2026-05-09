import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';

import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PhyneCrmEngagementNotifierService } from '../services/phyndcrm-engagement-notifier.service';
import { StripeMxSpeiRelayService } from '../services/stripe-mx-spei-relay.service';
import { WebhookDlqService } from '../services/webhook-dlq.service';

// ─── helpers ────────────────────────────────────────────────────────────

function makePrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    billingEvent: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
}

function makeConfigMock(overrides: Record<string, string> = {}) {
  return {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key in overrides) return overrides[key];
      return defaultValue;
    }),
  };
}

function piEvent(
  type: 'payment_intent.succeeded' | 'payment_intent.payment_failed',
  overrides: Partial<Stripe.PaymentIntent> = {},
  eventOverrides: Partial<Stripe.Event> = {}
): Stripe.Event {
  const pi: Partial<Stripe.PaymentIntent> = {
    id: 'pi_test_123',
    object: 'payment_intent',
    amount: 19900,
    currency: 'mxn',
    customer: 'cus_test_abc',
    metadata: { dhanam_user_id: 'user-123' },
    status: type === 'payment_intent.succeeded' ? 'succeeded' : 'requires_payment_method',
    ...overrides,
  };
  return {
    id: `evt_${Math.random().toString(36).slice(2, 10)}`,
    object: 'event',
    api_version: '2026-02-25.clover',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
    data: { object: pi as Stripe.PaymentIntent },
    ...eventOverrides,
  } as Stripe.Event;
}

function refundEvent(overrides: Partial<Stripe.Charge> = {}): Stripe.Event {
  const charge: Partial<Stripe.Charge> = {
    id: 'ch_test_123',
    object: 'charge',
    amount: 19900,
    amount_refunded: 19900,
    currency: 'mxn',
    customer: 'cus_test_abc',
    metadata: { dhanam_user_id: 'user-123' },
    payment_intent: 'pi_original_abc',
    refunds: {
      object: 'list',
      data: [{ id: 're_test_xyz', amount: 19900 } as Stripe.Refund],
      has_more: false,
      url: '',
    } as Stripe.ApiList<Stripe.Refund>,
    ...overrides,
  };
  return {
    id: `evt_${Math.random().toString(36).slice(2, 10)}`,
    object: 'event',
    api_version: '2026-02-25.clover',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: 'charge.refunded',
    data: { object: charge as Stripe.Charge },
  } as Stripe.Event;
}

// ─── suite ──────────────────────────────────────────────────────────────

describe('StripeMxSpeiRelayService', () => {
  let service: StripeMxSpeiRelayService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let config: ReturnType<typeof makeConfigMock>;
  let audit: { log: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    prisma = makePrismaMock();
    config = makeConfigMock({
      PRODUCT_WEBHOOK_URLS: 'karafiel:https://api.karafiel.mx/api/v1/webhooks/dhanam',
      DHANAM_WEBHOOK_SECRET: 'test-secret',
      FEATURE_STRIPE_MXN_LIVE: 'false',
    });
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    // Prisma defaults: user known by dhanam id, no existing billing event,
    // billingEvent.create succeeds.
    prisma.user.findUnique.mockResolvedValue({ id: 'user-123' });
    prisma.billingEvent.findFirst.mockResolvedValue(null);
    prisma.billingEvent.create.mockResolvedValue({ id: 'be_1' });

    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
    (globalThis as any).fetch = fetchMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeMxSpeiRelayService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: AuditService, useValue: audit },
        {
          // Notifier is fire-and-forget; stub it to a no-op so the
          // relay tests stay focused on dispatch/envelope concerns.
          provide: PhyneCrmEngagementNotifierService,
          useValue: { notify: jest.fn().mockResolvedValue(undefined) },
        },
        {
          // DLQ is best-effort persistence; stub to a no-op so the
          // existing relay tests stay focused on envelope/dispatch.
          // Failure-recording behavior is covered separately in
          // webhook-dlq.service.spec.ts.
          provide: WebhookDlqService,
          useValue: { recordFailure: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(StripeMxSpeiRelayService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (globalThis as any).fetch;
  });

  // ─── envelope transform: payment_intent.succeeded ────────────────────

  describe('payment_intent.succeeded → payment.succeeded', () => {
    it('emits a valid Dhanam envelope with MXN amounts and payment_id', async () => {
      const event = piEvent('payment_intent.succeeded');

      const result = await service.relay(event);

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.karafiel.mx/api/v1/webhooks/dhanam');
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers['X-Dhanam-Signature']).toMatch(/^[a-f0-9]{64}$/);
      expect(init.headers['X-Dhanam-Event-Type']).toBe('payment.succeeded');

      const body = JSON.parse(init.body as string);
      expect(body).toMatchObject({
        type: 'payment.succeeded',
        data: {
          customer_id: 'user-123',
          payment_id: 'pi_test_123',
          amount: '199.00',
          amount_minor: 19900,
          currency: 'MXN',
          subscription_id: '',
        },
      });
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/); // uuid v4
      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('propagates subscription_id from PaymentIntent metadata', async () => {
      const event = piEvent('payment_intent.succeeded', {
        metadata: { dhanam_user_id: 'user-123', subscription_id: 'sub_abc' },
      });

      await service.relay(event);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.data.subscription_id).toBe('sub_abc');
    });

    it('persists a BillingEvent with the Stripe event id for dedup', async () => {
      const event = piEvent('payment_intent.succeeded');

      await service.relay(event);

      expect(prisma.billingEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          type: 'payment_succeeded',
          status: 'succeeded',
          amount: 199,
          currency: 'MXN',
          stripeEventId: event.id,
        }),
      });
    });
  });

  // ─── envelope transform: payment_intent.payment_failed ───────────────

  describe('payment_intent.payment_failed → payment.failed', () => {
    it('carries failure_reason + failure_code', async () => {
      const event = piEvent('payment_intent.payment_failed', {
        last_payment_error: {
          message: 'SPEI timeout: customer did not complete transfer',
          code: 'payment_intent_authentication_failure',
        } as Stripe.PaymentIntent.LastPaymentError,
      });

      await service.relay(event);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.type).toBe('payment.failed');
      expect(body.data.failure_reason).toBe('SPEI timeout: customer did not complete transfer');
      expect(body.data.failure_code).toBe('payment_intent_authentication_failure');
    });
  });

  // ─── envelope transform: charge.refunded ─────────────────────────────

  describe('charge.refunded → payment.refunded', () => {
    it('emits refund envelope with refunded_payment_id pointing at original PI', async () => {
      const event = refundEvent();

      const result = await service.relay(event);

      expect(result).toBe(true);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toMatchObject({
        type: 'payment.refunded',
        data: {
          customer_id: 'user-123',
          payment_id: 're_test_xyz', // the refund's id, NOT the original PI
          amount: '199.00',
          amount_minor: 19900,
          currency: 'MXN',
          refunded_payment_id: 'pi_original_abc',
          original_payment_id: 'pi_original_abc',
        },
      });
    });
  });

  // ─── idempotency on replayed Stripe events ───────────────────────────

  describe('idempotency', () => {
    it('does not re-dispatch when stripe event id has already been persisted', async () => {
      prisma.billingEvent.findFirst.mockResolvedValue({ id: 'be_existing' });
      const event = piEvent('payment_intent.succeeded');

      const result = await service.relay(event);

      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(prisma.billingEvent.create).not.toHaveBeenCalled();
    });
  });

  // ─── currency guard ──────────────────────────────────────────────────

  describe('currency guard', () => {
    it('drops non-MXN PaymentIntents', async () => {
      const event = piEvent('payment_intent.succeeded', { currency: 'usd' });

      const result = await service.relay(event);

      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(prisma.billingEvent.create).not.toHaveBeenCalled();
    });

    it('drops non-MXN refund charges', async () => {
      const event = refundEvent({ currency: 'usd' });

      const result = await service.relay(event);

      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ─── unsupported event types ─────────────────────────────────────────

  describe('unsupported event types', () => {
    it('skips events the relay does not handle (e.g., invoice.paid)', async () => {
      const event = {
        id: 'evt_invoice_1',
        type: 'invoice.paid',
        livemode: false,
        data: { object: { id: 'in_1', currency: 'mxn' } },
      } as unknown as Stripe.Event;

      const result = await service.relay(event);

      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(prisma.billingEvent.create).not.toHaveBeenCalled();
    });
  });

  // ─── feature flag gate on livemode events ────────────────────────────

  describe('FEATURE_STRIPE_MXN_LIVE gate', () => {
    it('refuses livemode events when flag is off', async () => {
      const event = piEvent('payment_intent.succeeded', {}, { livemode: true });

      const result = await service.relay(event);

      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(prisma.billingEvent.create).not.toHaveBeenCalled();
    });

    it('accepts livemode events when flag is on', async () => {
      config.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'FEATURE_STRIPE_MXN_LIVE') return 'true';
        if (key === 'PRODUCT_WEBHOOK_URLS') {
          return 'karafiel:https://api.karafiel.mx/api/v1/webhooks/dhanam';
        }
        if (key === 'DHANAM_WEBHOOK_SECRET') return 'test-secret';
        return defaultValue;
      });

      const event = piEvent('payment_intent.succeeded', {}, { livemode: true });

      const result = await service.relay(event);

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('accepts test-mode events even when flag is off', async () => {
      // default config has flag off; test-mode event should still relay
      const event = piEvent('payment_intent.succeeded');
      const result = await service.relay(event);
      expect(result).toBe(true);
    });

    it('isLiveModeEnabled reflects the env var', () => {
      expect(service.isLiveModeEnabled()).toBe(false);
      config.get.mockImplementation((k: string, d?: any) =>
        k === 'FEATURE_STRIPE_MXN_LIVE' ? 'true' : d
      );
      expect(service.isLiveModeEnabled()).toBe(true);
      config.get.mockImplementation((k: string, d?: any) =>
        k === 'FEATURE_STRIPE_MXN_LIVE' ? '1' : d
      );
      expect(service.isLiveModeEnabled()).toBe(true);
    });
  });

  // ─── customer_id resolution ──────────────────────────────────────────

  describe('customer_id resolution', () => {
    it('prefers metadata.dhanam_user_id when present', async () => {
      const event = piEvent('payment_intent.succeeded', {
        customer: 'cus_stripe_unknown',
        metadata: { dhanam_user_id: 'user-from-metadata' },
      });

      await service.relay(event);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.data.customer_id).toBe('user-from-metadata');
    });

    it('falls back to Prisma User.stripeCustomerId lookup', async () => {
      prisma.user.findUnique.mockImplementation(({ where }: any) => {
        if (where.stripeCustomerId === 'cus_known') {
          return Promise.resolve({ id: 'user-from-db' });
        }
        return Promise.resolve(null);
      });
      const event = piEvent('payment_intent.succeeded', {
        customer: 'cus_known',
        metadata: {},
      });

      await service.relay(event);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.data.customer_id).toBe('user-from-db');
    });

    it('last-resort falls back to Stripe customer id when user not federated', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const event = piEvent('payment_intent.succeeded', {
        customer: 'cus_partner_only',
        metadata: {},
      });

      const result = await service.relay(event);

      expect(result).toBe(true);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.data.customer_id).toBe('cus_partner_only');
      // Unlinked → audit entry instead of BillingEvent row
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STRIPE_MX_RELAY_UNLINKED' })
      );
    });

    it('drops event entirely when no customer id is present at all', async () => {
      const event = piEvent('payment_intent.succeeded', {
        customer: null,
        metadata: {},
      });

      const result = await service.relay(event);

      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ─── dispatch resilience ─────────────────────────────────────────────

  describe('dispatch resilience', () => {
    it('ACK=true even if downstream webhook fails with non-2xx', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 502, text: async () => 'bad gateway' });
      const event = piEvent('payment_intent.succeeded');

      const result = await service.relay(event);

      expect(result).toBe(true); // envelope was built + persisted
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('ACK=true even if downstream throws', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
      const event = piEvent('payment_intent.succeeded');

      const result = await service.relay(event);

      expect(result).toBe(true);
    });

    it('skips dispatch when PRODUCT_WEBHOOK_URLS is empty', async () => {
      config.get.mockImplementation((k: string, d?: any) => {
        if (k === 'PRODUCT_WEBHOOK_URLS') return '';
        if (k === 'DHANAM_WEBHOOK_SECRET') return 'test-secret';
        return d;
      });
      const event = piEvent('payment_intent.succeeded');

      const result = await service.relay(event);

      expect(result).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses to dispatch when DHANAM_WEBHOOK_SECRET is missing', async () => {
      config.get.mockImplementation((k: string, d?: any) => {
        if (k === 'PRODUCT_WEBHOOK_URLS') {
          return 'karafiel:https://api.karafiel.mx/api/v1/webhooks/dhanam';
        }
        if (k === 'DHANAM_WEBHOOK_SECRET') return '';
        return d;
      });
      const event = piEvent('payment_intent.succeeded');

      const result = await service.relay(event);

      expect(result).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fans out to all configured products', async () => {
      config.get.mockImplementation((k: string, d?: any) => {
        if (k === 'PRODUCT_WEBHOOK_URLS') {
          return 'karafiel:https://api.karafiel.mx/a,tezca:https://api.tezca.mx/b';
        }
        if (k === 'DHANAM_WEBHOOK_SECRET') return 'test-secret';
        return d;
      });
      const event = piEvent('payment_intent.succeeded');

      await service.relay(event);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const urls = fetchMock.mock.calls.map(([u]) => u);
      expect(urls).toEqual(
        expect.arrayContaining(['https://api.karafiel.mx/a', 'https://api.tezca.mx/b'])
      );
    });
  });
});
