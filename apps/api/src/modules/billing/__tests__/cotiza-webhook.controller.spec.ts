import * as crypto from 'crypto';

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '../../../core/audit/audit.service';
import { PostHogService } from '../../analytics/posthog.service';
import {
  CotizaWebhookController,
  CotizaWebhookEventType,
  CotizaWebhookPayload,
} from '../cotiza-webhook.controller';

describe('CotizaWebhookController', () => {
  let controller: CotizaWebhookController;
  let auditService: jest.Mocked<AuditService>;

  const WEBHOOK_SECRET = 'cotiza-test-secret-abc123';

  function signPayload(body: string): string {
    return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  }

  function createMockRequest(body: string): any {
    return {
      rawBody: Buffer.from(body, 'utf-8'),
    };
  }

  function makePayload(
    type: CotizaWebhookEventType,
    overrides?: Partial<CotizaWebhookPayload>
  ): CotizaWebhookPayload {
    return {
      id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      timestamp: new Date().toISOString(),
      source_app: 'cotiza',
      data: {
        tenant_id: 'tenant-001',
        amount: 15000,
        currency: 'MXN',
        provider: 'stripe_mx',
        ...(overrides?.data || {}),
      },
      ...overrides,
    };
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CotizaWebhookController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'COTIZA_WEBHOOK_SECRET') return WEBHOOK_SECRET;
              return defaultValue;
            }),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PostHogService,
          useValue: {
            capture: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get<CotizaWebhookController>(CotizaWebhookController);
    auditService = module.get(AuditService) as jest.Mocked<AuditService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Signature verification
  // ---------------------------------------------------------------------------
  describe('signature verification', () => {
    it('should accept valid HMAC-SHA256 signature', async () => {
      const payload = makePayload(CotizaWebhookEventType.PAYMENT_SUCCEEDED);
      const body = JSON.stringify(payload);
      const signature = signPayload(body);

      const result = await controller.handleCotizaWebhook(
        createMockRequest(body),
        signature,
        payload
      );

      expect(result.received).toBe(true);
      expect(result.event).toBe(CotizaWebhookEventType.PAYMENT_SUCCEEDED);
    });

    it('should throw UnauthorizedException for invalid signature', async () => {
      const payload = makePayload(CotizaWebhookEventType.PAYMENT_SUCCEEDED);
      const body = JSON.stringify(payload);

      await expect(
        controller.handleCotizaWebhook(createMockRequest(body), 'bad-signature', payload)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for missing signature', async () => {
      const payload = makePayload(CotizaWebhookEventType.PAYMENT_SUCCEEDED);
      const body = JSON.stringify(payload);

      await expect(
        controller.handleCotizaWebhook(createMockRequest(body), undefined as any, payload)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when webhook secret is not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [CotizaWebhookController],
        providers: [
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ''),
            },
          },
          {
            provide: AuditService,
            useValue: { log: jest.fn() },
          },
          {
            provide: PostHogService,
            useValue: { capture: jest.fn().mockResolvedValue(undefined) },
          },
        ],
      }).compile();

      const unconfiguredController = module.get<CotizaWebhookController>(CotizaWebhookController);
      const payload = makePayload(CotizaWebhookEventType.PAYMENT_SUCCEEDED);
      const body = JSON.stringify(payload);

      await expect(
        unconfiguredController.handleCotizaWebhook(
          createMockRequest(body),
          signPayload(body),
          payload
        )
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ---------------------------------------------------------------------------
  // Idempotency
  // ---------------------------------------------------------------------------
  describe('idempotency', () => {
    it('should skip duplicate webhook IDs', async () => {
      const payload = makePayload(CotizaWebhookEventType.PAYMENT_SUCCEEDED, {
        id: 'dedup-test-001',
      });
      const body = JSON.stringify(payload);
      const signature = signPayload(body);

      // First call should process
      await controller.handleCotizaWebhook(createMockRequest(body), signature, payload);
      expect(auditService.log).toHaveBeenCalledTimes(1);

      // Second call should skip
      const result = await controller.handleCotizaWebhook(
        createMockRequest(body),
        signature,
        payload
      );
      expect(result.received).toBe(true);
      expect(auditService.log).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------
  describe('event handling', () => {
    it('should handle payment.succeeded and log audit event', async () => {
      const payload = makePayload(CotizaWebhookEventType.PAYMENT_SUCCEEDED, {
        data: {
          tenant_id: 'tenant-001',
          amount: 25000,
          currency: 'MXN',
          provider: 'stripe_mx',
          quote_id: 'quote-abc',
        },
      });
      const body = JSON.stringify(payload);
      const signature = signPayload(body);

      await controller.handleCotizaWebhook(createMockRequest(body), signature, payload);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cotiza.payment.succeeded',
          resource: 'billing',
          metadata: expect.objectContaining({
            tenantId: 'tenant-001',
            amount: 25000,
            currency: 'MXN',
          }),
        })
      );
    });

    it('should handle payment.failed', async () => {
      const payload = makePayload(CotizaWebhookEventType.PAYMENT_FAILED);
      const body = JSON.stringify(payload);
      const signature = signPayload(body);

      await controller.handleCotizaWebhook(createMockRequest(body), signature, payload);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'cotiza.payment.failed' })
      );
    });

    it('should handle payment.refunded', async () => {
      const payload = makePayload(CotizaWebhookEventType.PAYMENT_REFUNDED);
      const body = JSON.stringify(payload);
      const signature = signPayload(body);

      await controller.handleCotizaWebhook(createMockRequest(body), signature, payload);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'cotiza.payment.refunded' })
      );
    });

    it('should handle quote.paid', async () => {
      const payload = makePayload(CotizaWebhookEventType.QUOTE_PAID, {
        data: { tenant_id: 'tenant-001', quote_id: 'quote-xyz', amount: 5000, currency: 'MXN' },
      });
      const body = JSON.stringify(payload);
      const signature = signPayload(body);

      await controller.handleCotizaWebhook(createMockRequest(body), signature, payload);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cotiza.quote.paid',
          resourceId: 'quote-xyz',
        })
      );
    });

    it('should handle invoice.paid', async () => {
      const payload = makePayload(CotizaWebhookEventType.INVOICE_PAID, {
        data: {
          tenant_id: 'tenant-001',
          invoice_id: 'inv-123',
          amount: 10000,
          currency: 'MXN',
        },
      });
      const body = JSON.stringify(payload);
      const signature = signPayload(body);

      await controller.handleCotizaWebhook(createMockRequest(body), signature, payload);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cotiza.invoice.paid',
          resourceId: 'inv-123',
        })
      );
    });

    it('should handle subscription.created', async () => {
      const payload = makePayload(CotizaWebhookEventType.SUBSCRIPTION_CREATED, {
        data: {
          tenant_id: 'tenant-001',
          subscription_id: 'sub-001',
          plan_id: 'plan-pro',
          status: 'active',
        },
      });
      const body = JSON.stringify(payload);
      const signature = signPayload(body);

      await controller.handleCotizaWebhook(createMockRequest(body), signature, payload);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cotiza.subscription.created',
          resourceId: 'sub-001',
        })
      );
    });

    it('should handle subscription.cancelled', async () => {
      const payload = makePayload(CotizaWebhookEventType.SUBSCRIPTION_CANCELLED, {
        data: {
          tenant_id: 'tenant-001',
          subscription_id: 'sub-002',
          plan_id: 'plan-pro',
          status: 'cancelled',
        },
      });
      const body = JSON.stringify(payload);
      const signature = signPayload(body);

      await controller.handleCotizaWebhook(createMockRequest(body), signature, payload);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cotiza.subscription.cancelled',
        })
      );
    });

    it('should handle unknown event type gracefully', async () => {
      const payload = makePayload('unknown.event' as CotizaWebhookEventType);
      const body = JSON.stringify(payload);
      const signature = signPayload(body);

      const result = await controller.handleCotizaWebhook(
        createMockRequest(body),
        signature,
        payload
      );

      expect(result.received).toBe(true);
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should return received: false when handler throws', async () => {
      auditService.log.mockRejectedValueOnce(new Error('DB connection lost'));

      const payload = makePayload(CotizaWebhookEventType.PAYMENT_SUCCEEDED);
      const body = JSON.stringify(payload);
      const signature = signPayload(body);

      const result = await controller.handleCotizaWebhook(
        createMockRequest(body),
        signature,
        payload
      );

      expect(result.received).toBe(false);
      expect(result.error).toBe('DB connection lost');
    });
  });
});
