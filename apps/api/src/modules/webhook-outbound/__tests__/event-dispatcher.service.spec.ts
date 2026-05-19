import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { EventDispatcherService } from '../services/event-dispatcher.service';
import { SvixClient } from '../services/svix.client';

describe('EventDispatcherService', () => {
  let service: EventDispatcherService;
  let prisma: any;
  let svix: any;

  beforeEach(async () => {
    prisma = {
      webhookEndpoint: { findMany: jest.fn() },
      webhookDelivery: { create: jest.fn().mockResolvedValue({}) },
    };
    svix = {
      isEnabled: jest.fn().mockReturnValue(true),
      sendMessage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventDispatcherService,
        { provide: PrismaService, useValue: prisma },
        { provide: SvixClient, useValue: svix },
      ],
    }).compile();
    service = module.get(EventDispatcherService);
  });

  it('no-ops silently when Svix is disabled', async () => {
    svix.isEnabled.mockReturnValue(false);
    await service.emit('payment.succeeded', { orderId: 'o1' });
    expect(prisma.webhookEndpoint.findMany).not.toHaveBeenCalled();
    expect(svix.sendMessage).not.toHaveBeenCalled();
  });

  it('drops the event when there are no active subscribers', async () => {
    prisma.webhookEndpoint.findMany.mockResolvedValue([]);
    await service.emit('payment.succeeded', { orderId: 'o1' });
    expect(svix.sendMessage).not.toHaveBeenCalled();
  });

  it('dispatches to every subscribed endpoint and records a delivery row', async () => {
    prisma.webhookEndpoint.findMany.mockResolvedValue([
      { id: 'we_1', consumerAppId: 'forj' },
      { id: 'we_2', consumerAppId: 'karafiel' },
    ]);
    svix.sendMessage.mockResolvedValue({ svixMessageId: 'msg_1' });

    await service.emit('payment.succeeded', { orderId: 'o1' });

    expect(svix.sendMessage).toHaveBeenCalledTimes(2);
    expect(prisma.webhookDelivery.create).toHaveBeenCalledTimes(2);
    const call = prisma.webhookDelivery.create.mock.calls[0][0];
    expect(call.data.eventType).toBe('payment.succeeded');
    expect(call.data.svixMessageId).toBe('msg_1');
    expect(call.data.attempts).toBe(1);
  });

  it('continues dispatching when one endpoint fails', async () => {
    prisma.webhookEndpoint.findMany.mockResolvedValue([
      { id: 'we_1', consumerAppId: 'forj' },
      { id: 'we_2', consumerAppId: 'karafiel' },
    ]);
    svix.sendMessage
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ svixMessageId: 'msg_2' });

    await service.emit('payment.succeeded', { orderId: 'o1' });

    expect(svix.sendMessage).toHaveBeenCalledTimes(2);
    // Two delivery rows created — one failed (lastStatus=0), one succeeded
    expect(prisma.webhookDelivery.create).toHaveBeenCalledTimes(2);
    const failed = prisma.webhookDelivery.create.mock.calls.find(
      (c: any[]) => c[0].data.lastStatus === 0
    );
    const succeeded = prisma.webhookDelivery.create.mock.calls.find(
      (c: any[]) => c[0].data.svixMessageId === 'msg_2'
    );
    expect(failed).toBeDefined();
    expect(succeeded).toBeDefined();
  });
});
