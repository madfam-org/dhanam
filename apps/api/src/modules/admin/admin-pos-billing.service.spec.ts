import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '@core/audit/audit.service';
import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { BillingService } from '@modules/billing/billing.service';

import { AdminPosBillingService } from './admin-pos-billing.service';

describe('AdminPosBillingService', () => {
  let service: AdminPosBillingService;

  const mockPrismaService = {
    user: { findUnique: jest.fn() },
  };

  const mockLoggerService = { log: jest.fn() };
  const mockAuditService = { logEvent: jest.fn() };
  const mockBillingService = {
    createOperatorCheckout: jest.fn(),
    getOperatorCheckoutStatus: jest.fn(),
    previewCheckoutRouting: jest.fn(),
    createPosCharge: jest.fn(),
    createPosRefund: jest.fn(),
    getPosTimeline: jest.fn(),
    getBillingReconciliationSummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminPosBillingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: BillingService, useValue: mockBillingService },
      ],
    }).compile();

    service = module.get(AdminPosBillingService);
    jest.clearAllMocks();
  });

  describe('createPosCheckout', () => {
    it('creates an operator checkout link and records a high-severity audit entry', async () => {
      mockBillingService.createOperatorCheckout.mockResolvedValue({
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_pos',
        provider: 'stripe',
        sessionId: 'cs_pos',
      });

      const result = await service.createPosCheckout(
        {
          userId: 'user_123',
          product: 'karafiel',
          plan: 'pro',
          orgId: 'org_123',
          countryCode: 'mx',
          successUrl: 'https://admin.dhan.am/pos/success',
          cancelUrl: 'https://admin.dhan.am/pos/cancel',
        },
        'admin1'
      );

      expect(mockBillingService.createOperatorCheckout).toHaveBeenCalledWith('user_123', {
        plan: 'pro',
        product: 'karafiel',
        orgId: 'org_123',
        countryCode: 'MX',
        successUrl: 'https://admin.dhan.am/pos/success',
        cancelUrl: 'https://admin.dhan.am/pos/cancel',
        operatorId: 'admin1',
        source: 'internal_pos',
      });
      expect(result.sessionId).toBe('cs_pos');
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'admin.billing_pos_checkout_created',
          severity: 'high',
        })
      );
    });

    it('defaults POS checkout product to dhanam', async () => {
      mockBillingService.createOperatorCheckout.mockResolvedValue({
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_pos',
        provider: 'stripe',
        sessionId: 'cs_pos',
      });

      await service.createPosCheckout({ userId: 'user_123', plan: 'pro' }, 'admin1');

      expect(mockBillingService.createOperatorCheckout).toHaveBeenCalledWith(
        'user_123',
        expect.objectContaining({ product: 'dhanam' })
      );
    });
  });

  describe('getPosCheckoutStatus', () => {
    it('loads checkout status and records an audit entry', async () => {
      mockBillingService.getOperatorCheckoutStatus.mockResolvedValue({
        sessionId: 'cs_pos',
        provider: 'stripe',
        status: 'complete',
        paymentStatus: 'paid',
        userId: 'user_123',
        billingEvents: [],
      });

      const result = await service.getPosCheckoutStatus({ sessionId: 'cs_pos' }, 'admin1');

      expect(result.status).toBe('complete');
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin.billing_pos_status_viewed' })
      );
    });
  });
});
