/**
 * Unit tests for WebhookDlqRetryJob — verifies the cron tick honors the
 * feature flag, batches via the service, and is failure-isolated so a
 * single bad row cannot halt the batch.
 */

import { Test, TestingModule } from '@nestjs/testing';

import { WebhookDlqRetryJob } from '../jobs/webhook-dlq-retry.job';
import { WebhookDlqService } from '../services/webhook-dlq.service';

function makeServiceMock(overrides: Partial<WebhookDlqService> = {}) {
  return {
    isAutoRetryEnabled: jest.fn().mockReturnValue(true),
    findDueForRetry: jest.fn().mockResolvedValue([]),
    replayDelivery: jest.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  } as unknown as jest.Mocked<WebhookDlqService>;
}

describe('WebhookDlqRetryJob', () => {
  let job: WebhookDlqRetryJob;
  let dlq: jest.Mocked<WebhookDlqService>;

  async function buildJob(serviceMock: jest.Mocked<WebhookDlqService>) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebhookDlqRetryJob, { provide: WebhookDlqService, useValue: serviceMock }],
    }).compile();
    job = module.get(WebhookDlqRetryJob);
    dlq = module.get(WebhookDlqService) as jest.Mocked<WebhookDlqService>;
  }

  describe('feature flag gate', () => {
    it('does nothing when isAutoRetryEnabled() returns false', async () => {
      await buildJob(makeServiceMock({ isAutoRetryEnabled: jest.fn().mockReturnValue(false) }));

      await job.tick();

      expect(dlq.findDueForRetry).not.toHaveBeenCalled();
      expect(dlq.replayDelivery).not.toHaveBeenCalled();
    });

    it('runs the batch when isAutoRetryEnabled() returns true', async () => {
      await buildJob(makeServiceMock());
      await job.tick();
      expect(dlq.findDueForRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('batch processing', () => {
    it('replays each due row and counts ok/fail outcomes', async () => {
      await buildJob(
        makeServiceMock({
          findDueForRetry: jest.fn().mockResolvedValue([
            { id: 'a', consumer: 'karafiel' },
            { id: 'b', consumer: 'karafiel' },
            { id: 'c', consumer: 'tezca' },
          ]),
          replayDelivery: jest
            .fn()
            .mockResolvedValueOnce({ ok: true })
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce({ ok: true }),
        })
      );

      await job.tick();

      expect(dlq.replayDelivery).toHaveBeenCalledTimes(3);
      expect(dlq.replayDelivery).toHaveBeenNthCalledWith(1, 'a');
      expect(dlq.replayDelivery).toHaveBeenNthCalledWith(2, 'b');
      expect(dlq.replayDelivery).toHaveBeenNthCalledWith(3, 'c');
    });

    it('continues processing remaining rows when a single replay throws', async () => {
      await buildJob(
        makeServiceMock({
          findDueForRetry: jest.fn().mockResolvedValue([
            { id: 'a', consumer: 'k' },
            { id: 'b', consumer: 'k' },
            { id: 'c', consumer: 'k' },
          ]),
          replayDelivery: jest
            .fn()
            .mockResolvedValueOnce({ ok: true })
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce({ ok: true }),
        })
      );

      // Should not propagate the exception out of the cron tick.
      await expect(job.tick()).resolves.toBeUndefined();
      expect(dlq.replayDelivery).toHaveBeenCalledTimes(3);
    });

    it('returns gracefully when findDueForRetry throws (e.g., DB hiccup)', async () => {
      await buildJob(
        makeServiceMock({
          findDueForRetry: jest.fn().mockRejectedValue(new Error('db down')),
        })
      );

      await expect(job.tick()).resolves.toBeUndefined();
      expect(dlq.replayDelivery).not.toHaveBeenCalled();
    });

    it('is a no-op when no rows are due', async () => {
      await buildJob(makeServiceMock({ findDueForRetry: jest.fn().mockResolvedValue([]) }));

      await job.tick();

      expect(dlq.replayDelivery).not.toHaveBeenCalled();
    });
  });
});
