/**
 * =============================================================================
 * ConektaService unit tests
 * =============================================================================
 *
 * Coverage:
 * - Initialization: configured / not-configured / partially-configured states
 * - createCharge input validation (no actual HTTP calls — http.post is mocked)
 * - verifyWebhookSignature: valid signature, mismatch, missing header,
 *   missing key, length mismatch, body parse failure, all three header forms
 * - handleWebhookEvent: each event type maps to the right classification
 *
 * NO real Conekta API calls. NO real keys. Mirrors the test pattern in
 * `paddle.service.spec.ts` and `janua-billing.service.spec.ts`.
 * =============================================================================
 */

import * as crypto from 'crypto';

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';

import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ConektaService } from '../services/conekta.service';
import { PhyndCrmEngagementNotifierService } from '../services/phyndcrm-engagement-notifier.service';
import { WebhookDlqService } from '../services/webhook-dlq.service';

describe('ConektaService', () => {
  let service: ConektaService;
  let httpService: jest.Mocked<HttpService>;
  let prisma: {
    billingEvent: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
  };
  let audit: { log: jest.Mock };
  let phyndcrmNotifier: { notify: jest.Mock };
  let dlq: { recordFailure: jest.Mock };

  const CONEKTA_PRIVATE_KEY = 'key_test_private_xxx';
  const CONEKTA_PUBLIC_KEY = 'key_test_public_xxx';
  const CONEKTA_WEBHOOK_SIGNING_KEY = 'whsec_test_signing_key_abc123';
  const CONEKTA_API_VERSION = '2.1.0';

  const buildModule = async (overrides: Partial<Record<string, string>> = {}) => {
    const cfg: Record<string, string> = {
      CONEKTA_PRIVATE_KEY,
      CONEKTA_PUBLIC_KEY,
      CONEKTA_WEBHOOK_SIGNING_KEY,
      CONEKTA_API_VERSION,
      PRODUCT_WEBHOOK_URLS: '',
      DHANAM_WEBHOOK_SECRET: 'dhanam_webhook_secret_test',
      ...overrides,
    };

    prisma = {
      billingEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'be_test' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    phyndcrmNotifier = { notify: jest.fn().mockResolvedValue(undefined) };
    dlq = { recordFailure: jest.fn().mockResolvedValue({ id: 'dlq_test' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConektaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) =>
              cfg[key] !== undefined ? cfg[key] : defaultValue
            ),
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
            get: jest.fn(),
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: PhyndCrmEngagementNotifierService, useValue: phyndcrmNotifier },
        { provide: WebhookDlqService, useValue: dlq },
      ],
    }).compile();

    return {
      service: module.get<ConektaService>(ConektaService),
      httpService: module.get(HttpService) as jest.Mocked<HttpService>,
    };
  };

  beforeEach(async () => {
    const built = await buildModule();
    service = built.service;
    httpService = built.httpService;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('ok'),
    }) as jest.Mock;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  describe('initialization', () => {
    it('is defined', () => {
      expect(service).toBeDefined();
    });

    it('reports configured when private key is present', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('exposes the public key', () => {
      expect(service.getPublicKey()).toBe(CONEKTA_PUBLIC_KEY);
    });

    it('reports NOT configured when private key is missing', async () => {
      const built = await buildModule({ CONEKTA_PRIVATE_KEY: '' });
      expect(built.service.isConfigured()).toBe(false);
    });

    it('defaults to API version 2.1.0 when not provided', async () => {
      const built = await buildModule({ CONEKTA_API_VERSION: undefined as unknown as string });
      expect(built.service.isConfigured()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // createCharge — input validation only (no real HTTP)
  // ---------------------------------------------------------------------------

  describe('createCharge', () => {
    const validParams = {
      amount: 19900,
      currency: 'MXN',
      customerInfo: { name: 'Carlos', email: 'carlos@example.com' },
      paymentSource: { type: 'card' as const, tokenId: 'tok_test_xxx' },
    };

    it('throws when not configured', async () => {
      const built = await buildModule({ CONEKTA_PRIVATE_KEY: '' });
      await expect(built.service.createCharge(validParams)).rejects.toThrow();
    });

    it('rejects non-positive amount', async () => {
      await expect(service.createCharge({ ...validParams, amount: 0 })).rejects.toThrow(
        /positive integer/
      );
      await expect(service.createCharge({ ...validParams, amount: -100 })).rejects.toThrow(
        /positive integer/
      );
    });

    it('rejects non-integer amount', async () => {
      await expect(service.createCharge({ ...validParams, amount: 199.5 })).rejects.toThrow(
        /positive integer/
      );
    });

    it('rejects unsupported currency', async () => {
      await expect(service.createCharge({ ...validParams, currency: 'EUR' })).rejects.toThrow(
        /MXN or USD/
      );
    });

    it('accepts MXN and USD case-insensitively', async () => {
      httpService.post.mockReturnValue(
        of({
          data: {
            id: 'ord_test',
            amount: 19900,
            currency: 'MXN',
            payment_status: 'paid',
            charges: { data: [{ id: 'chg_test', status: 'paid' }] },
          },
        }) as ReturnType<HttpService['post']>
      );

      await expect(
        service.createCharge({ ...validParams, currency: 'mxn' })
      ).resolves.toMatchObject({ orderId: 'ord_test' });

      await expect(
        service.createCharge({ ...validParams, currency: 'usd' })
      ).resolves.toMatchObject({ orderId: 'ord_test' });
    });

    it('builds Basic auth + Conekta versioned Accept header', async () => {
      httpService.post.mockReturnValue(
        of({
          data: {
            id: 'ord_test',
            amount: 19900,
            currency: 'MXN',
            payment_status: 'paid',
            charges: { data: [{ id: 'chg_test', status: 'paid' }] },
          },
        }) as ReturnType<HttpService['post']>
      );

      await service.createCharge(validParams);

      const callArgs = httpService.post.mock.calls[0];
      const headers = callArgs[2]?.headers as Record<string, string>;
      const expectedAuth = `Basic ${Buffer.from(`${CONEKTA_PRIVATE_KEY}:`).toString('base64')}`;
      expect(headers.Authorization).toBe(expectedAuth);
      expect(headers.Accept).toBe(`application/vnd.conekta-v${CONEKTA_API_VERSION}+json`);
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('forwards Idempotency-Key when caller supplies one in metadata', async () => {
      httpService.post.mockReturnValue(
        of({
          data: {
            id: 'ord_test',
            amount: 19900,
            currency: 'MXN',
            payment_status: 'paid',
            charges: { data: [{ id: 'chg_test', status: 'paid' }] },
          },
        }) as ReturnType<HttpService['post']>
      );

      await service.createCharge({
        ...validParams,
        metadata: { idempotency_key: 'invoice-1234', invoice_id: 'invoice-1234' },
      });

      const headers = httpService.post.mock.calls[0][2]?.headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toBe('invoice-1234');
    });

    it('extracts SPEI payment instructions from the charge response', async () => {
      httpService.post.mockReturnValue(
        of({
          data: {
            id: 'ord_test',
            amount: 19900,
            currency: 'MXN',
            payment_status: 'pending_payment',
            charges: {
              data: [
                {
                  id: 'chg_test',
                  status: 'pending_payment',
                  payment_method: {
                    type: 'spei',
                    reference: '90123456789',
                    clabe: '646180111800000000',
                    bank: 'STP',
                    expires_at: 1735689600,
                  },
                },
              ],
            },
          },
        }) as ReturnType<HttpService['post']>
      );

      const result = await service.createCharge({
        ...validParams,
        paymentSource: { type: 'spei' },
      });

      expect(result.paymentInstructions).toEqual({
        type: 'spei',
        reference: '90123456789',
        clabe: '646180111800000000',
        bank: 'STP',
        barcodeUrl: undefined,
        expiresAt: 1735689600,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // verifyWebhookSignature — the load-bearing test set
  // ---------------------------------------------------------------------------

  describe('verifyWebhookSignature', () => {
    const validBody = JSON.stringify({
      id: 'evt_test_123',
      type: 'charge.paid',
      livemode: false,
      created_at: 1735689600,
      data: { object: { id: 'chg_test', order_id: 'ord_test' } },
    });

    const sign = (body: string, key: string = CONEKTA_WEBHOOK_SIGNING_KEY): string =>
      crypto.createHmac('sha256', key).update(body, 'utf8').digest('hex');

    it('verifies a valid signature in `sha256=<hex>` form', () => {
      const sig = `sha256=${sign(validBody)}`;
      const event = service.verifyWebhookSignature(validBody, sig);

      expect(event.id).toBe('evt_test_123');
      expect(event.type).toBe('charge.paid');
      expect(event.livemode).toBe(false);
      expect(event.createdAt).toBe(1735689600);
    });

    it('verifies a valid signature in `t=...,v1=<hex>` form', () => {
      const hex = sign(validBody);
      const sig = `t=1735689600,v1=${hex}`;
      const event = service.verifyWebhookSignature(validBody, sig);

      expect(event.id).toBe('evt_test_123');
    });

    it('verifies a valid signature in bare-hex form', () => {
      const sig = sign(validBody);
      const event = service.verifyWebhookSignature(validBody, sig);

      expect(event.id).toBe('evt_test_123');
    });

    /**
     * Load-bearing test: a signature mismatch MUST throw a clean Error
     * (which the controller maps to BadRequestException → HTTP 400).
     * It must NOT crash with RangeError, TypeError, or anything that
     * would surface as a 500 to Conekta and trigger their retry storm.
     */
    it('throws on signature mismatch (the must-not-500 case)', () => {
      const wrong = sign(validBody, 'wrong_key_xxx');
      expect(() => service.verifyWebhookSignature(validBody, `sha256=${wrong}`)).toThrow(
        /signature verification failed/i
      );
    });

    it('throws on missing signature header', () => {
      expect(() => service.verifyWebhookSignature(validBody, '')).toThrow(/Missing/i);
      expect(() => service.verifyWebhookSignature(validBody, '   ')).toThrow(/Missing/i);
    });

    it('throws on missing webhook signing key', async () => {
      const built = await buildModule({ CONEKTA_WEBHOOK_SIGNING_KEY: '' });
      const sig = `sha256=${sign(validBody)}`;
      expect(() => built.service.verifyWebhookSignature(validBody, sig)).toThrow(
        /CONEKTA_WEBHOOK_SIGNING_KEY/
      );
    });

    it('throws on empty body', () => {
      const sig = `sha256=${sign('{}')}`;
      expect(() => service.verifyWebhookSignature('', sig)).toThrow(/Empty webhook body/);
    });

    it('throws on signature length mismatch (without crashing timingSafeEqual)', () => {
      // A short hex string — would cause RangeError in timingSafeEqual if
      // we didn't pre-check lengths.
      const shortSig = 'sha256=abc123';
      expect(() => service.verifyWebhookSignature(validBody, shortSig)).toThrow(
        /signature length mismatch/i
      );
    });

    it('throws on malformed signature header (not in any recognized form)', () => {
      expect(() => service.verifyWebhookSignature(validBody, 'garbage-signature-format')).toThrow(
        /not in a recognized format/i
      );
    });

    it('throws on `t=...,v1=` form missing the v1= component', () => {
      expect(() => service.verifyWebhookSignature(validBody, 't=1735689600')).toThrow();
    });

    it('throws on body that is not valid JSON (after sig passes)', () => {
      const garbageBody = 'this is not json';
      const sig = `sha256=${sign(garbageBody)}`;
      expect(() => service.verifyWebhookSignature(garbageBody, sig)).toThrow(/not valid JSON/);
    });

    it('uses timing-safe comparison (smoke check via two equal-length wrong sigs)', () => {
      const wrong1 = 'a'.repeat(64);
      const wrong2 = 'b'.repeat(64);
      // Both must throw the same kind of error — no info leak via different
      // exception types between two same-length wrong sigs.
      expect(() => service.verifyWebhookSignature(validBody, `sha256=${wrong1}`)).toThrow(
        /signature verification failed/i
      );
      expect(() => service.verifyWebhookSignature(validBody, `sha256=${wrong2}`)).toThrow(
        /signature verification failed/i
      );
    });
  });

  // ---------------------------------------------------------------------------
  // handleWebhookEvent — classification routing
  // ---------------------------------------------------------------------------

  describe('handleWebhookEvent', () => {
    const baseEvent = (type: string, extras: Record<string, unknown> = {}) => ({
      id: `evt_${type}`,
      type,
      livemode: false,
      createdAt: 1735689600,
      data: {
        object: {
          id: 'chg_test_123',
          order_id: 'ord_test_456',
          ...extras,
        },
      },
    });

    it('classifies charge.paid', async () => {
      const result = await service.handleWebhookEvent(baseEvent('charge.paid'));
      expect(result).toMatchObject({
        handled: true,
        classification: 'paid',
        chargeId: 'chg_test_123',
        orderId: 'ord_test_456',
      });
    });

    it('classifies charge.declined', async () => {
      const result = await service.handleWebhookEvent(baseEvent('charge.declined'));
      expect(result.classification).toBe('declined');
      expect(result.handled).toBe(true);
    });

    it('classifies charge.refunded', async () => {
      const result = await service.handleWebhookEvent(baseEvent('charge.refunded'));
      expect(result.classification).toBe('refunded');
    });

    it('classifies order.expired', async () => {
      const result = await service.handleWebhookEvent(baseEvent('order.expired'));
      expect(result.classification).toBe('expired');
    });

    it('returns ignored classification for unknown event types (does not throw)', async () => {
      const result = await service.handleWebhookEvent(baseEvent('customer.created'));
      expect(result.handled).toBe(false);
      expect(result.classification).toBe('ignored');
    });

    it('persists charge.paid and fans out a canonical payment.succeeded envelope', async () => {
      const built = await buildModule({
        PRODUCT_WEBHOOK_URLS: 'karafiel:https://karafiel.test/webhooks/dhanam',
      });
      service = built.service;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('ok'),
      }) as jest.Mock;
      prisma.user.findUnique.mockImplementation(async (args) =>
        args.where.id === 'user_123' ? { id: 'user_123' } : null
      );

      const result = await service.handleWebhookEvent(
        baseEvent('charge.paid', {
          amount: 19900,
          currency: 'MXN',
          metadata: {
            dhanam_user_id: 'user_123',
            subscription_id: 'sub_123',
            engagement_id: 'eng_123',
            source: 'cotiza',
          },
        })
      );

      expect(result).toMatchObject({
        handled: true,
        classification: 'paid',
        chargeId: 'chg_test_123',
        orderId: 'ord_test_456',
        relayed: true,
      });
      expect(prisma.billingEvent.findFirst).toHaveBeenCalledWith({
        where: { stripeEventId: 'evt_charge.paid' },
        select: { id: true },
      });
      expect(prisma.billingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user_123',
            type: 'payment_succeeded',
            status: 'succeeded',
            amount: 199,
            currency: 'MXN',
            stripeEventId: 'evt_charge.paid',
            metadata: expect.objectContaining({
              envelope_type: 'payment.succeeded',
              conekta_event_type: 'charge.paid',
              payment_id: 'chg_test_123',
              subscription_id: 'sub_123',
              source: 'conekta_direct_relay',
            }),
          }),
        })
      );

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      const envelope = JSON.parse(init.body);
      expect(envelope).toMatchObject({
        type: 'payment.succeeded',
        data: {
          customer_id: 'user_123',
          subscription_id: 'sub_123',
          payment_id: 'chg_test_123',
          amount: '199.00',
          amount_minor: 19900,
          currency: 'MXN',
          ecosystem: {
            engagement_id: 'eng_123',
            source: 'cotiza',
          },
        },
      });
      expect(init.headers['X-Dhanam-Event-Type']).toBe('payment.succeeded');
      expect(phyndcrmNotifier.notify).toHaveBeenCalledWith(expect.objectContaining(envelope));
    });

    it('deduplicates repeated Conekta events by provider event id', async () => {
      prisma.billingEvent.findFirst.mockResolvedValueOnce({ id: 'be_existing' });

      const result = await service.handleWebhookEvent(baseEvent('charge.paid'));

      expect(result).toMatchObject({
        handled: true,
        classification: 'paid',
        idempotent: true,
        relayed: false,
      });
      expect(prisma.billingEvent.create).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(phyndcrmNotifier.notify).not.toHaveBeenCalled();
    });

    it('records product-webhook failures in the DLQ', async () => {
      const built = await buildModule({
        PRODUCT_WEBHOOK_URLS: 'karafiel:https://karafiel.test/webhooks/dhanam',
      });
      service = built.service;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('temporary outage'),
      }) as jest.Mock;
      prisma.user.findUnique.mockImplementation(async (args) =>
        args.where.id === 'user_123' ? { id: 'user_123' } : null
      );

      await service.handleWebhookEvent(
        baseEvent('charge.declined', {
          amount: 19900,
          currency: 'MXN',
          failure_code: 'card_declined',
          failure_message: 'Card was declined',
          metadata: { dhanam_user_id: 'user_123' },
        })
      );

      expect(dlq.recordFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          consumer: 'karafiel',
          consumerUrl: 'https://karafiel.test/webhooks/dhanam',
          eventType: 'payment.failed',
          statusCode: 500,
          errorMessage: expect.stringContaining('temporary outage'),
          payload: expect.objectContaining({
            type: 'payment.failed',
            data: expect.objectContaining({
              failure_reason: 'Card was declined',
              failure_code: 'card_declined',
            }),
          }),
        })
      );
    });

    it('audits unlinked events but still relays when a provider customer id exists', async () => {
      const built = await buildModule({
        PRODUCT_WEBHOOK_URLS: 'karafiel:https://karafiel.test/webhooks/dhanam',
      });
      service = built.service;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('ok'),
      }) as jest.Mock;

      await service.handleWebhookEvent(
        baseEvent('charge.refunded', {
          amount: 19900,
          amount_refunded: 5000,
          currency: 'MXN',
          customer_id: 'cus_conekta_123',
        })
      );

      expect(prisma.billingEvent.create).not.toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONEKTA_RELAY_UNLINKED',
          metadata: expect.objectContaining({
            conekta_event_id: 'evt_charge.refunded',
            customer_id: 'cus_conekta_123',
          }),
        })
      );
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(JSON.parse(init.body)).toMatchObject({
        type: 'payment.refunded',
        data: {
          customer_id: 'cus_conekta_123',
          amount: '50.00',
          amount_minor: 5000,
          refunded_payment_id: 'chg_test_123',
          original_payment_id: 'chg_test_123',
        },
      });
    });
  });
});
