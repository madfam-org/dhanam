import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { StripeService } from '../stripe.service';

import { InternalPosService } from '../services/internal-pos.service';
import { StripeMxService } from '../services/stripe-mx.service';

describe('InternalPosService', () => {
  let service: InternalPosService;
  let prisma: jest.Mocked<PrismaService>;
  let stripeMx: jest.Mocked<StripeMxService>;
  let stripe: jest.Mocked<StripeService>;

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
          provide: StripeMxService,
          useValue: {
            isConfigured: jest.fn().mockReturnValue(true),
            createPaymentIntent: jest.fn(),
            createRefund: jest.fn(),
          },
        },
        {
          provide: StripeService,
          useValue: {
            createPaymentIntent: jest.fn(),
            createRefund: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(InternalPosService);
    prisma = module.get(PrismaService);
    stripeMx = module.get(StripeMxService);
    stripe = module.get(StripeService);
  });

  describe('createCharge', () => {
    it('creates an MXN Stripe MX PaymentIntent', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'mx@example.com',
        name: 'MX User',
        stripeCustomerId: 'cus_mx',
        countryCode: 'MX',
      });
      stripeMx.createPaymentIntent.mockResolvedValue({
        id: 'pi_mx',
        client_secret: 'sec_mx',
        status: 'requires_payment_method',
      } as any);

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
      expect(stripeMx.createPaymentIntent).toHaveBeenCalled();
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
      stripeMx.isConfigured.mockReturnValue(false);

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
    it('returns billing events for a correlation id', async () => {
      (prisma.billingEvent.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'evt-1',
          type: 'payment_succeeded',
          status: 'pending',
          amount: 19900,
          currency: 'MXN',
          createdAt: new Date(),
          metadata: { correlationId: 'corr-1' },
        },
      ]);

      const timeline = await service.getTimeline('corr-1');
      expect(timeline).toHaveLength(1);
      expect(timeline[0].id).toBe('evt-1');
    });
  });

  describe('getReconciliationSummary', () => {
    it('returns flagged mismatch count', async () => {
      (prisma.billingEvent.count as jest.Mock).mockResolvedValue(2);
      (prisma.billingEvent.findMany as jest.Mock).mockResolvedValue([]);

      const summary = await service.getReconciliationSummary();
      expect(summary.flaggedCount).toBe(2);
    });
  });
});
