import { Test, TestingModule } from '@nestjs/testing';
import type Stripe from 'stripe';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { EventDispatcherService } from '../../webhook-outbound/services/event-dispatcher.service';
import { ChargeService } from '../services/charge.service';
import { ConnectWebhookHandler } from '../services/connect-webhook.handler';
import { MerchantService } from '../services/merchant.service';
import { PayoutService } from '../services/payout.service';
import { TransferService } from '../services/transfer.service';

describe('ConnectWebhookHandler', () => {
  let handler: ConnectWebhookHandler;
  let merchants: any;
  let charges: any;
  let transfers: any;
  let payouts: any;
  let events: any;

  beforeEach(async () => {
    merchants = { refreshFromWebhook: jest.fn() };
    charges = { recordApplicationFee: jest.fn() };
    transfers = {
      promoteFromPendingByExternalId: jest.fn(),
      markReversed: jest.fn(),
    };
    payouts = { updateStatusFromWebhook: jest.fn() };
    events = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectWebhookHandler,
        {
          provide: PrismaService,
          useValue: {
            dispute: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
          },
        },
        { provide: MerchantService, useValue: merchants },
        { provide: ChargeService, useValue: charges },
        { provide: TransferService, useValue: transfers },
        { provide: PayoutService, useValue: payouts },
        { provide: EventDispatcherService, useValue: events },
      ],
    }).compile();
    handler = module.get(ConnectWebhookHandler);
  });

  const event = (type: string, object: unknown): Stripe.Event =>
    ({ type, data: { object } }) as Stripe.Event;

  it('routes account.updated to MerchantService.refreshFromWebhook', async () => {
    const handled = await handler.handle(event('account.updated', { id: 'acct_1' }));
    expect(handled).toBe(true);
    expect(merchants.refreshFromWebhook).toHaveBeenCalledWith('acct_1');
  });

  it('routes payout.paid to PayoutService', async () => {
    const handled = await handler.handle(event('payout.paid', { id: 'po_1' }));
    expect(handled).toBe(true);
    expect(payouts.updateStatusFromWebhook).toHaveBeenCalledWith('po_1', 'paid');
  });

  it('routes payout.failed with failure_code', async () => {
    const handled = await handler.handle(
      event('payout.failed', { id: 'po_2', failure_code: 'insufficient_funds' })
    );
    expect(handled).toBe(true);
    expect(payouts.updateStatusFromWebhook).toHaveBeenCalledWith(
      'po_2',
      'failed',
      'insufficient_funds'
    );
  });

  it('routes transfer.reversed', async () => {
    const handled = await handler.handle(event('transfer.reversed', { id: 'tr_1' }));
    expect(handled).toBe(true);
    expect(transfers.markReversed).toHaveBeenCalledWith('tr_1');
  });

  it('returns false for events it does not know about', async () => {
    const handled = await handler.handle(event('foo.bar', { id: 'x' }));
    expect(handled).toBe(false);
  });
});
