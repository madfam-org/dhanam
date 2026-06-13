import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PaymentGatewayRegistry } from '../gateways/payment-gateway.registry';

import { InternalPosService } from '../services/internal-pos.service';

describe('InternalPosService', () => {
  let service: InternalPosService;
  let prisma: jest.Mocked<PrismaService>;
  let gatewayRegistry: jest.Mocked<PaymentGatewayRegistry>;

  const stripeMxGateway = {
    id: 'stripe_mx',
    isConfigured: jest.fn().mockReturnValue(true),
    createPosCharge: jest.fn(),
    createRefund: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalPosService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
            billingEvent: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              count: jest.fn(),
            },
            webhookDeliveryFailure: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn() },
        },
        {
          provide: PaymentGatewayRegistry,
          useValue: {
            resolvePosGateway: jest.fn().mockReturnValue('stripe_mx'),
            require: jest.fn().mockReturnValue(stripeMxGateway),
            isConfigured: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    service = module.get(InternalPosService);
    prisma = module.get(PrismaService);
    gatewayRegistry = module.get(PaymentGatewayRegistry);
  });

  describe('createCharge', () => {
    it('creates an MXN Stripe MX PaymentIntent via gateway adapter', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'mx@example.com',
        name: 'MX User',
        stripeCustomerId: 'cus_mx',
        countryCode: 'MX',
      });
      stripeMxGateway.createPosCharge.mockResolvedValue({
        paymentIntentId: 'pi_mx',
        clientSecret: 'sec_mx',
        status: 'requires_payment_method',
        currency: 'MXN',
        amountMinor: 19900,
      });

      const result = await service.createCharge({
        userId: 'user-1',
        amountMinor: 19900,
        currency: 'MXN',
        description: 'POS sale',
        operatorId: 'admin-1',
        correlationId: 'corr-1',
      });

      expect(result.provider).toBe('stripe_mx');
      expect(result.paymentIntentId).toBe('pi_mx');
      expect(stripeMxGateway.createPosCharge).toHaveBeenCalled();
      expect(prisma.billingEvent.create).toHaveBeenCalled();
    });

    it('throws when user is missing', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.createCharge({
          userId: 'missing',
          amountMinor: 100,
          currency: 'USD',
          description: 'test',
          operatorId: 'admin-1',
        })
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects non-USD legacy charges', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'us@example.com',
        countryCode: 'US',
      });
      gatewayRegistry.resolvePosGateway.mockReturnValue('legacy_stripe');

      await expect(
        service.createCharge({
          userId: 'user-1',
          amountMinor: 100,
          currency: 'EUR',
          description: 'test',
          operatorId: 'admin-1',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getTimeline', () => {
    it('returns CFDI uuid and product webhook deliveries for correlated events', async () => {
      const createdAt = new Date('2026-06-12T10:00:00.000Z');
      (prisma.billingEvent.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'be-pos-1',
          type: 'pos_charge',
          status: 'completed',
          amount: { toString: () => '199.00' },
          currency: 'MXN',
          createdAt,
          metadata: {
            correlationId: 'corr-timeline-1',
            paymentIntentId: 'pi_timeline_mx',
            cfdiUuid: 'cfdi-uuid-from-karafiel',
          },
        },
      ]);
      (prisma.webhookDeliveryFailure.findMany as jest.Mock).mockResolvedValue([
        {
          consumer: 'karafiel',
          eventType: 'payment.succeeded',
          lastErrorMessage: 'timeout',
          resolvedAt: null,
          payload: { type: 'payment.succeeded', data: { payment_id: 'pi_timeline_mx' } },
        },
      ]);

      const timeline = await service.getTimeline('corr-timeline-1');

      expect(timeline).toHaveLength(1);
      expect(timeline[0].cfdiUuid).toBe('cfdi-uuid-from-karafiel');
      expect(timeline[0].productWebhookDeliveries).toEqual([
        expect.objectContaining({
          consumer: 'karafiel',
          status: 'failed',
          eventType: 'payment.succeeded',
        }),
      ]);
    });

    it('reads snake_case cfdi_uuid from legacy metadata', async () => {
      (prisma.billingEvent.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'be-pos-2',
          type: 'pos_charge',
          status: 'completed',
          amount: { toString: () => '50.00' },
          currency: 'MXN',
          createdAt: new Date(),
          metadata: {
            correlationId: 'corr-timeline-2',
            payment_id: 'pi_legacy',
            cfdi_uuid: 'legacy-cfdi-uuid',
          },
        },
      ]);

      const timeline = await service.getTimeline('corr-timeline-2');

      expect(timeline[0].cfdiUuid).toBe('legacy-cfdi-uuid');
    });
  });
});
