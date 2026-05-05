import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';

import { QueueService, ReferralRewardJobData } from '../../jobs/queue.service';
import { AmbassadorService } from '../ambassador.service';
import { ReferralRewardProcessor } from '../jobs/referral-reward.processor';
import { ReferralRewardService } from '../referral-reward.service';

/**
 * =============================================================================
 * Referral Reward Processor unit tests
 * =============================================================================
 * Covers the BullMQ-side contract: success, transient failure (applied=false
 * → throw → BullMQ retry), thrown exception propagation, and best-effort
 * tier recalculation.
 *
 * The retry policy itself (3 retries, 1m/5m/30m custom backoff) is asserted
 * against `QueueService.referralRewardBackoff()` in
 * `queue.service.referral-backoff.spec.ts` — that's where the schedule
 * lives, and the processor doesn't need to know about it.
 * =============================================================================
 */
describe('ReferralRewardProcessor', () => {
  let processor: ReferralRewardProcessor;
  let rewardService: jest.Mocked<ReferralRewardService>;
  let ambassadorService: jest.Mocked<AmbassadorService>;
  let queueService: jest.Mocked<QueueService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralRewardProcessor,
        {
          provide: ReferralRewardService,
          useValue: { applyReward: jest.fn() },
        },
        {
          provide: AmbassadorService,
          useValue: { recalculateTier: jest.fn() },
        },
        {
          provide: QueueService,
          useValue: { registerWorker: jest.fn() },
        },
      ],
    }).compile();

    processor = module.get(ReferralRewardProcessor);
    rewardService = module.get(ReferralRewardService) as jest.Mocked<ReferralRewardService>;
    ambassadorService = module.get(AmbassadorService) as jest.Mocked<AmbassadorService>;
    queueService = module.get(QueueService) as jest.Mocked<QueueService>;

    jest.clearAllMocks();
  });

  function buildJob(
    data: ReferralRewardJobData['payload'],
    overrides: Partial<{ id: string; attemptsMade: number; opts: { attempts?: number } }> = {}
  ): Job<ReferralRewardJobData['payload']> {
    return {
      id: overrides.id ?? 'job-1',
      data,
      attemptsMade: overrides.attemptsMade ?? 0,
      opts: overrides.opts ?? { attempts: 4 },
    } as unknown as Job<ReferralRewardJobData['payload']>;
  }

  const samplePayload: ReferralRewardJobData['payload'] = {
    rewardId: 'reward-abc',
    recipientUserId: 'user-1',
    rewardType: 'credit_grant',
    referralId: 'KRF-ABCD1234',
  };

  describe('process()', () => {
    it('should apply the reward and recalculate the recipient tier', async () => {
      rewardService.applyReward.mockResolvedValue({ applied: true });
      ambassadorService.recalculateTier.mockResolvedValue({
        previousTier: 'none',
        newTier: 'bronze',
        promoted: true,
      });

      const result = await processor.process(buildJob(samplePayload));

      expect(result.applied).toBe(true);
      expect(rewardService.applyReward).toHaveBeenCalledWith('reward-abc');
      expect(ambassadorService.recalculateTier).toHaveBeenCalledWith('user-1');
    });

    it('should throw when applyReward returns applied=false (transient — let BullMQ retry)', async () => {
      rewardService.applyReward.mockResolvedValue({ applied: false });

      await expect(processor.process(buildJob(samplePayload))).rejects.toThrow(
        /apply returned applied=false/
      );
      // Tier recalculation must NOT run when the reward did not apply.
      expect(ambassadorService.recalculateTier).not.toHaveBeenCalled();
    });

    it('should propagate exceptions thrown by applyReward', async () => {
      rewardService.applyReward.mockRejectedValue(new Error('stripe outage'));

      await expect(processor.process(buildJob(samplePayload))).rejects.toThrow('stripe outage');
      expect(ambassadorService.recalculateTier).not.toHaveBeenCalled();
    });

    it('should not poison reward success when tier recalc fails', async () => {
      rewardService.applyReward.mockResolvedValue({ applied: true, actionId: 'ext_user_1m' });
      ambassadorService.recalculateTier.mockRejectedValue(new Error('tier db blip'));

      const result = await processor.process(buildJob(samplePayload));

      // Reward result preserved — tier recalc is best-effort.
      expect(result).toEqual({ applied: true, actionId: 'ext_user_1m' });
    });

    it('should reflect the upcoming attempt number in logs / Sentry context (final attempt branch)', async () => {
      // attemptsMade=3 with attempts=4 means we're on attempt 4 — the
      // last try. The processor should still throw on applied=false so
      // BullMQ moves the job to the failed set (and downstream into
      // QueueService's dead letter queue).
      rewardService.applyReward.mockResolvedValue({ applied: false });

      await expect(
        processor.process(buildJob(samplePayload, { attemptsMade: 3, opts: { attempts: 4 } }))
      ).rejects.toThrow(/applied=false on attempt 4\/4/);
    });
  });

  describe('onModuleInit()', () => {
    it('should register a worker against the referral-rewards queue', () => {
      processor.onModuleInit();

      expect(queueService.registerWorker).toHaveBeenCalledTimes(1);
      const [queueName, fn] = queueService.registerWorker.mock.calls[0];
      expect(queueName).toBe('referral-rewards');
      expect(typeof fn).toBe('function');
    });

    it('should swallow registerWorker failures in test envs (NODE_ENV=test)', () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      queueService.registerWorker.mockImplementation(() => {
        throw new Error('queue not initialised');
      });

      expect(() => processor.onModuleInit()).not.toThrow();

      process.env.NODE_ENV = prev;
    });
  });
});
