import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { StripeConnectService } from '../../billing/services/stripe-connect.service';
import { EventDispatcherService } from '../../webhook-outbound/services/event-dispatcher.service';
import { MerchantService } from '../services/merchant.service';

describe('MerchantService', () => {
  let service: MerchantService;
  let prisma: any;
  let stripeConnect: any;
  let events: any;

  beforeEach(async () => {
    prisma = {
      merchantAccount: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    stripeConnect = {
      id: 'stripe',
      createMerchantAccount: jest.fn(),
      createMerchantOnboardingLink: jest.fn(),
      getMerchantAccount: jest.fn(),
      getMerchantBalance: jest.fn(),
    };
    events = {
      emit: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeConnectService, useValue: stripeConnect },
        { provide: EventDispatcherService, useValue: events },
      ],
    }).compile();
    service = module.get(MerchantService);
  });

  it('creates a merchant in Stripe and persists it locally', async () => {
    stripeConnect.createMerchantAccount.mockResolvedValue({
      externalId: 'acct_x',
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      requirements: { currentlyDue: ['individual.dob.day'], pastDue: [], disabledReason: null },
    });
    prisma.merchantAccount.create.mockResolvedValue({ id: 'ma_1' });

    const created = await service.createForUser('u1', 'u1@example.com', {
      country: 'US',
      defaultCurrency: 'USD' as any,
    });

    expect(created).toEqual({ id: 'ma_1' });
    expect(stripeConnect.createMerchantAccount).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', country: 'US' })
    );
    expect(prisma.merchantAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        processorId: 'stripe',
        externalAccountId: 'acct_x',
        chargesEnabled: false,
      }),
    });
  });

  it('refreshFromWebhook emits merchant.onboarded the first time charges_enabled flips true', async () => {
    prisma.merchantAccount.findFirst.mockResolvedValue({
      id: 'ma_1',
      externalAccountId: 'acct_x',
      chargesEnabled: false,
      detailsSubmitted: false,
      onboardedAt: null,
    });
    stripeConnect.getMerchantAccount.mockResolvedValue({
      externalId: 'acct_x',
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    });
    prisma.merchantAccount.update.mockResolvedValue({ id: 'ma_1' });

    await service.refreshFromWebhook('acct_x');

    expect(events.emit).toHaveBeenCalledWith('merchant.onboarded', { merchantId: 'ma_1' });
  });

  it('refreshFromWebhook emits merchant.requirements_updated when already onboarded', async () => {
    prisma.merchantAccount.findFirst.mockResolvedValue({
      id: 'ma_1',
      externalAccountId: 'acct_x',
      chargesEnabled: true,
      detailsSubmitted: true,
      onboardedAt: new Date(),
    });
    stripeConnect.getMerchantAccount.mockResolvedValue({
      externalId: 'acct_x',
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      requirements: { currentlyDue: ['tax_id'], pastDue: [], disabledReason: null },
    });
    prisma.merchantAccount.update.mockResolvedValue({ id: 'ma_1' });

    await service.refreshFromWebhook('acct_x');

    expect(events.emit).toHaveBeenCalledWith('merchant.requirements_updated', {
      merchantId: 'ma_1',
    });
  });

  it('warns but does not throw when account.updated is for an unknown external id', async () => {
    prisma.merchantAccount.findFirst.mockResolvedValue(null);
    await expect(service.refreshFromWebhook('acct_unknown')).resolves.toBeUndefined();
    expect(stripeConnect.getMerchantAccount).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
