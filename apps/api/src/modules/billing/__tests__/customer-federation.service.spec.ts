import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { CustomerFederationService } from '../services/customer-federation.service';

describe('CustomerFederationService', () => {
  let service: CustomerFederationService;
  let prisma: jest.Mocked<PrismaService>;

  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const oneMonthAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const baseUser = {
    id: 'user-fed-001',
    subscriptionTier: 'pro',
    subscriptionStartedAt: oneMonthAgo,
    subscriptionExpiresAt: oneMonthFromNow,
    trialTier: null,
    trialEndsAt: null,
    billingProvider: 'stripe_mx',
    countryCode: 'MX',
    stripeCustomerId: 'cus_mx_001',
    paddleCustomerId: null,
    januaCustomerId: null,
    billingEvents: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerFederationService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CustomerFederationService>(CustomerFederationService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCustomerByExternalId', () => {
    it('should throw NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getCustomerByExternalId('nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should return federated customer data for an active subscriber', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        billingEvents: [
          {
            id: 'evt-001',
            type: 'subscription_created',
            amount: 199,
            currency: 'MXN',
            status: 'succeeded',
            createdAt: oneMonthAgo,
            metadata: { paidAt: oneMonthAgo.toISOString() },
          },
        ],
      } as any);

      const result = await service.getCustomerByExternalId('user-fed-001');

      expect(result.id).toBe('user-fed-001');
      expect(result.subscription).toEqual({ plan: 'pro', status: 'active' });
      expect(result.balance).toEqual({ amount: 0, currency: 'MXN' });
      expect(result.invoices).toHaveLength(1);
      expect(result.invoices[0]).toEqual(
        expect.objectContaining({
          id: 'evt-001',
          amount: 199,
          currency: 'MXN',
          status: 'paid',
        })
      );
      expect(result.payment_methods).toHaveLength(1);
      expect(result.payment_methods[0]).toEqual(
        expect.objectContaining({
          id: 'cus_mx_001',
          type: 'stripe',
          is_default: true,
        })
      );
    });

    it('should identify community tier as free status', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        subscriptionTier: 'community',
        subscriptionExpiresAt: null,
        stripeCustomerId: null,
        billingProvider: null,
      } as any);

      const result = await service.getCustomerByExternalId('user-fed-001');

      expect(result.subscription).toEqual({ plan: 'community', status: 'free' });
      expect(result.payment_methods).toHaveLength(0);
    });

    it('should identify trialing users', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        subscriptionTier: 'community',
        trialTier: 'pro',
        trialEndsAt: oneMonthFromNow,
      } as any);

      const result = await service.getCustomerByExternalId('user-fed-001');

      expect(result.subscription).toEqual({ plan: 'pro', status: 'trialing' });
    });

    it('should identify expired subscriptions', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        subscriptionExpiresAt: oneMonthAgo,
      } as any);

      const result = await service.getCustomerByExternalId('user-fed-001');

      expect(result.subscription).toEqual({ plan: 'pro', status: 'expired' });
    });

    it('should calculate outstanding balance from pending/failed events', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        billingEvents: [
          {
            id: 'evt-p1',
            type: 'payment_failed',
            amount: 199,
            currency: 'MXN',
            status: 'pending',
            createdAt: new Date(),
            metadata: null,
          },
          {
            id: 'evt-p2',
            type: 'payment_failed',
            amount: 199,
            currency: 'MXN',
            status: 'failed',
            createdAt: new Date(),
            metadata: null,
          },
          {
            id: 'evt-ok',
            type: 'payment_succeeded',
            amount: 199,
            currency: 'MXN',
            status: 'succeeded',
            createdAt: oneMonthAgo,
            metadata: null,
          },
        ],
      } as any);

      const result = await service.getCustomerByExternalId('user-fed-001');

      expect(result.balance.amount).toBe(398); // 199 + 199
      expect(result.balance.currency).toBe('MXN');
    });

    it('should default balance currency to USD for non-MX users', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        countryCode: 'US',
        billingProvider: 'paddle',
        stripeCustomerId: null,
        paddleCustomerId: 'ctm_001',
      } as any);

      const result = await service.getCustomerByExternalId('user-fed-001');

      expect(result.balance.currency).toBe('USD');
    });

    it('should filter billing events to invoice-relevant types only', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        billingEvents: [
          {
            id: 'evt-sub',
            type: 'subscription_created',
            amount: 199,
            currency: 'MXN',
            status: 'succeeded',
            createdAt: now,
            metadata: null,
          },
          {
            id: 'evt-other',
            type: 'customer_updated',
            amount: 0,
            currency: 'MXN',
            status: 'succeeded',
            createdAt: now,
            metadata: null,
          },
        ],
      } as any);

      const result = await service.getCustomerByExternalId('user-fed-001');

      expect(result.invoices).toHaveLength(1);
      expect(result.invoices[0].id).toBe('evt-sub');
    });

    it('should map billing status to invoice status correctly', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        billingEvents: [
          {
            id: 'evt-1',
            type: 'payment_succeeded',
            amount: 100,
            currency: 'MXN',
            status: 'succeeded',
            createdAt: now,
            metadata: null,
          },
          {
            id: 'evt-2',
            type: 'payment_failed',
            amount: 100,
            currency: 'MXN',
            status: 'failed',
            createdAt: now,
            metadata: null,
          },
          {
            id: 'evt-3',
            type: 'payment_refunded',
            amount: 100,
            currency: 'MXN',
            status: 'refunded',
            createdAt: now,
            metadata: null,
          },
        ],
      } as any);

      const result = await service.getCustomerByExternalId('user-fed-001');

      const statuses = result.invoices.map((i) => i.status);
      expect(statuses).toEqual(['paid', 'failed', 'refunded']);
    });

    it('should include Paddle and Janua payment methods when present', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        billingProvider: 'paddle',
        stripeCustomerId: 'cus_stripe_001',
        paddleCustomerId: 'ctm_paddle_001',
        januaCustomerId: 'jan_001',
      } as any);

      const result = await service.getCustomerByExternalId('user-fed-001');

      expect(result.payment_methods).toHaveLength(3);
      const types = result.payment_methods.map((m) => m.type);
      expect(types).toContain('stripe');
      expect(types).toContain('paddle');

      // Paddle should be default since billingProvider=paddle
      const paddleMethod = result.payment_methods.find((m) => m.type === 'paddle');
      expect(paddleMethod?.is_default).toBe(true);

      const stripeMethod = result.payment_methods.find((m) => m.type === 'stripe');
      expect(stripeMethod?.is_default).toBe(false);
    });

    it('should set paid_at from metadata when available', async () => {
      const paidDate = '2026-03-15T10:00:00.000Z';
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        billingEvents: [
          {
            id: 'evt-paid',
            type: 'payment_succeeded',
            amount: 199,
            currency: 'MXN',
            status: 'succeeded',
            createdAt: now,
            metadata: { paidAt: paidDate },
          },
        ],
      } as any);

      const result = await service.getCustomerByExternalId('user-fed-001');

      expect(result.invoices[0].paid_at).toBe(paidDate);
    });

    it('should set paid_at to null for non-succeeded events', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        billingEvents: [
          {
            id: 'evt-fail',
            type: 'payment_failed',
            amount: 199,
            currency: 'MXN',
            status: 'failed',
            createdAt: now,
            metadata: null,
          },
        ],
      } as any);

      const result = await service.getCustomerByExternalId('user-fed-001');

      expect(result.invoices[0].paid_at).toBeNull();
    });
  });
});
