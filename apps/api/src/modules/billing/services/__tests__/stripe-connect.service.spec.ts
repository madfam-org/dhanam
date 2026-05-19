import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { StripeConnectService } from '../stripe-connect.service';

// Mock the Stripe constructor so we don't hit the network.
jest.mock('stripe', () => {
  const accountsCreate = jest.fn();
  const accountsRetrieve = jest.fn();
  const accountLinksCreate = jest.fn();
  const paymentIntentsCreate = jest.fn();
  const transfersCreate = jest.fn();
  const payoutsCreate = jest.fn();
  const balanceRetrieve = jest.fn();
  const disputesUpdate = jest.fn();

  const MockStripe = jest.fn().mockImplementation(() => ({
    accounts: { create: accountsCreate, retrieve: accountsRetrieve },
    accountLinks: { create: accountLinksCreate },
    paymentIntents: { create: paymentIntentsCreate },
    transfers: { create: transfersCreate },
    payouts: { create: payoutsCreate },
    balance: { retrieve: balanceRetrieve },
    disputes: { update: disputesUpdate },
  }));

  // Expose the mocks so tests can set expectations
  (MockStripe as any).__mocks = {
    accountsCreate,
    accountsRetrieve,
    accountLinksCreate,
    paymentIntentsCreate,
    transfersCreate,
    payoutsCreate,
    balanceRetrieve,
    disputesUpdate,
  };

  return { __esModule: true, default: MockStripe };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeMock = require('stripe').default;

describe('StripeConnectService', () => {
  let service: StripeConnectService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeConnectService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'STRIPE_SECRET_KEY' ? 'sk_test_123' : undefined),
          },
        },
      ],
    }).compile();
    service = module.get(StripeConnectService);
  });

  it('declares marketplace-capable capabilities', () => {
    expect(service.id).toBe('stripe');
    expect(service.capabilities.marketplace).toBe(true);
    expect(service.capabilities.subscriptions).toBe(true);
    expect(service.capabilities.disputes).toBe(true);
  });

  describe('createMerchantAccount', () => {
    it('creates an Express Connect account and maps to a handle', async () => {
      StripeMock.__mocks.accountsCreate.mockResolvedValue({
        id: 'acct_123',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        requirements: { currently_due: ['external_account'], past_due: [], disabled_reason: null },
      });

      const handle = await service.createMerchantAccount({
        userId: 'user-1',
        email: 'merchant@example.com',
        country: 'US',
        defaultCurrency: 'USD' as any,
        businessType: 'company',
      });

      expect(handle.externalId).toBe('acct_123');
      expect(handle.chargesEnabled).toBe(false);
      expect(handle.requirements?.currentlyDue).toEqual(['external_account']);
      expect(StripeMock.__mocks.accountsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'express',
          country: 'US',
          email: 'merchant@example.com',
          business_type: 'company',
          metadata: expect.objectContaining({ dhanam_user_id: 'user-1' }),
        })
      );
    });
  });

  describe('createMerchantOnboardingLink', () => {
    it('returns url + expiresAt from Stripe AccountLink', async () => {
      StripeMock.__mocks.accountLinksCreate.mockResolvedValue({
        url: 'https://connect.stripe.com/setup/e/acct_123/abc',
        expires_at: 1900000000,
      });

      const link = await service.createMerchantOnboardingLink(
        'acct_123',
        'https://forj.design/connect/return',
        'https://forj.design/connect/refresh'
      );

      expect(link.url).toContain('connect.stripe.com');
      expect(link.expiresAt.getTime()).toBe(1900000000 * 1000);
    });
  });

  describe('createDestinationCharge', () => {
    it('routes with transfer_data.destination + on_behalf_of', async () => {
      StripeMock.__mocks.paymentIntentsCreate.mockResolvedValue({
        id: 'pi_123',
        amount: 5000,
        currency: 'usd',
        status: 'succeeded',
        client_secret: 'pi_123_secret',
      });

      const charge = await service.createDestinationCharge({
        amount: 5000,
        currency: 'USD' as any,
        merchantExternalId: 'acct_123',
        applicationFeeAmount: 250,
        description: 'Order #42',
      });

      expect(charge.status).toBe('succeeded');
      expect(charge.currency).toBe('USD');
      expect(StripeMock.__mocks.paymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          transfer_data: { destination: 'acct_123' },
          on_behalf_of: 'acct_123',
          application_fee_amount: 250,
        })
      );
    });
  });

  describe('createPayout', () => {
    it('calls stripe.payouts.create with stripeAccount options', async () => {
      StripeMock.__mocks.payoutsCreate.mockResolvedValue({
        id: 'po_1',
        amount: 10000,
        currency: 'usd',
        status: 'pending',
        arrival_date: 1900000000,
      });

      await service.createPayout({
        amount: 10000,
        currency: 'USD' as any,
        merchantExternalId: 'acct_123',
        method: 'instant',
      });

      const [body, opts] = StripeMock.__mocks.payoutsCreate.mock.calls[0];
      expect(body).toEqual(expect.objectContaining({ amount: 10000, method: 'instant' }));
      expect(opts).toEqual({ stripeAccount: 'acct_123' });
    });
  });

  describe('getMerchantBalance', () => {
    it('returns available + pending mapped to currency codes', async () => {
      StripeMock.__mocks.balanceRetrieve.mockResolvedValue({
        available: [{ amount: 12345, currency: 'usd' }],
        pending: [{ amount: 500, currency: 'usd' }],
      });

      const bal = await service.getMerchantBalance('acct_123');
      expect(bal.available[0].currency).toBe('USD');
      expect(bal.available[0].amount).toBe(12345);
      expect(bal.pending[0].amount).toBe(500);
    });
  });
});
