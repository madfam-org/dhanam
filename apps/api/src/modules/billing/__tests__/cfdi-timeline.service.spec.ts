import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { CfdiTimelineService } from '../services/cfdi-timeline.service';

describe('CfdiTimelineService', () => {
  let service: CfdiTimelineService;
  const billingEvent = {
    findMany: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CfdiTimelineService,
        {
          provide: PrismaService,
          useValue: { billingEvent },
        },
      ],
    }).compile();

    service = module.get(CfdiTimelineService);
    billingEvent.findMany.mockReset();
    billingEvent.update.mockReset();
  });

  it('returns 0 when payment id is empty', async () => {
    expect(await service.attachCfdiUuid('', 'uuid-1')).toBe(0);
    expect(billingEvent.findMany).not.toHaveBeenCalled();
  });

  it('merges cfdiUuid onto events matched by paymentIntentId or payment_id', async () => {
    billingEvent.findMany
      .mockResolvedValueOnce([
        { id: 'evt-1', metadata: { paymentIntentId: 'pi_abc', amount: 7900 } },
      ])
      .mockResolvedValueOnce([
        { id: 'evt-1', metadata: { paymentIntentId: 'pi_abc', amount: 7900 } },
        { id: 'evt-2', metadata: { payment_id: 'pi_abc' } },
      ]);
    billingEvent.update.mockResolvedValue({});

    const updated = await service.attachCfdiUuid('pi_abc', '11111111-2222-3333-4444-555555555555');

    expect(updated).toBe(2);
    expect(billingEvent.update).toHaveBeenCalledTimes(2);
    expect(billingEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-1' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            cfdiUuid: '11111111-2222-3333-4444-555555555555',
            karafielDelivered: true,
          }),
        }),
      })
    );
  });

  it('returns 0 when no billing events match', async () => {
    billingEvent.findMany.mockResolvedValue([]);

    expect(await service.attachCfdiUuid('pi_missing', 'uuid-x')).toBe(0);
    expect(billingEvent.update).not.toHaveBeenCalled();
  });
});
