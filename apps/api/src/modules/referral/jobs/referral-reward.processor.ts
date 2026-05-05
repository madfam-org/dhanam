import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Job, Worker } from 'bullmq';

import { QueueService, ReferralRewardJobData } from '@modules/jobs/queue.service';

import { AmbassadorService } from '../ambassador.service';
import { ReferralRewardService } from '../referral-reward.service';

/**
 * =============================================================================
 * Referral Reward Processor (BullMQ worker)
 * =============================================================================
 * Worker for the `referral-rewards` queue. Each job applies one
 * `ReferralReward` row by delegating to `ReferralRewardService.applyReward()`,
 * then triggers ambassador-tier recalculation for the recipient.
 *
 * Lives inside the ReferralModule (rather than JobsModule) to avoid a
 * dependency cycle: ReferralModule already imports JobsModule for
 * `QueueService.addReferralRewardJob`. Co-locating the worker keeps the
 * graph one-way.
 *
 * Enqueue site: `ReferralService.handleConversionWebhook()` after the
 * reward rows are committed. JobId is the reward id, so duplicate
 * webhooks (PhyneCRM retry, manual replay) are silently de-duplicated by
 * BullMQ.
 *
 * Retry policy lives on the queue (`attempts: 4`, custom backoff
 * 1m / 5m / 30m). Final failures fall through to QueueService's existing
 * dead letter queue handling.
 *
 * Failure semantics:
 *   - `applyReward` returning `{ applied: false }` is treated as a
 *     transient failure (typically a Stripe API hiccup) and re-thrown so
 *     BullMQ retries.
 *   - `applyReward` throwing (network, DB) bubbles up untouched.
 *   - The "already applied" short-circuit in `applyReward` makes the
 *     worker fully idempotent on its own — even if BullMQ ran the same
 *     job twice past the dedup, the underlying mutation is a no-op.
 * =============================================================================
 */
@Injectable()
export class ReferralRewardProcessor implements OnModuleInit {
  private readonly logger = new Logger(ReferralRewardProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly rewardService: ReferralRewardService,
    private readonly ambassadorService: AmbassadorService
  ) {}

  onModuleInit(): void {
    // QueueService initialises queues lazily on its own onModuleInit. In
    // test envs without Redis it gracefully no-ops, and registerWorker
    // would throw — guard with the same NODE_ENV signal it uses.
    try {
      this.worker = this.queueService.registerWorker('referral-rewards', (job: Job) =>
        this.process(job as Job<ReferralRewardJobData['payload']>)
      );
      this.logger.log('Referral reward worker registered');
    } catch (error) {
      const isTestEnv = process.env.NODE_ENV === 'test';
      if (isTestEnv) {
        this.logger.warn('Skipping referral reward worker in test environment');
        return;
      }
      throw error;
    }
  }

  async process(job: Job<ReferralRewardJobData['payload']>): Promise<{
    applied: boolean;
    actionId?: string;
  }> {
    const { rewardId, recipientUserId, rewardType, referralId } = job.data;
    const startTime = Date.now();

    Sentry.withScope((scope) => {
      scope.setTag('job_type', 'referral-reward-apply');
      scope.setTag('job_id', job.id || 'unknown');
      scope.setTag('reward_type', rewardType);
      scope.setUser({ id: recipientUserId });
      scope.setContext('reward', {
        rewardId,
        referralId,
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts,
      });
    });

    this.logger.log(
      `Applying referral reward ${rewardId} (${rewardType}) for user ${recipientUserId}`
    );

    let result: { applied: boolean; actionId?: string };

    try {
      result = await this.rewardService.applyReward(rewardId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const attemptsMade = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts ?? 1;

      this.logger.error(
        `Reward ${rewardId} apply threw on attempt ${attemptsMade}/${maxAttempts}: ${err.message}`
      );

      Sentry.withScope((scope) => {
        scope.setTag('job_type', 'referral-reward-apply');
        scope.setTag('reward_id', rewardId);
        scope.setLevel(attemptsMade >= maxAttempts ? 'error' : 'warning');
        Sentry.captureException(err);
      });

      throw err;
    }

    if (!result.applied) {
      // Stripe outage or other recoverable condition. Throw so BullMQ
      // retries per the queue's backoff policy. Final failure → DLQ.
      const attemptsMade = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts ?? 1;
      const message = `Reward ${rewardId} apply returned applied=false on attempt ${attemptsMade}/${maxAttempts}`;
      this.logger.warn(message);

      Sentry.withScope((scope) => {
        scope.setTag('job_type', 'referral-reward-apply');
        scope.setTag('reward_id', rewardId);
        scope.setLevel(attemptsMade >= maxAttempts ? 'error' : 'warning');
        Sentry.captureMessage(message, 'warning');
      });

      throw new Error(message);
    }

    // Tier recalculation is best-effort — its failure must not poison the
    // reward's success. The reward row is already marked applied=true.
    try {
      await this.ambassadorService.recalculateTier(recipientUserId);
    } catch (tierError) {
      const err = tierError instanceof Error ? tierError : new Error(String(tierError));
      this.logger.warn(
        `Reward ${rewardId} applied, but tier recalc for ${recipientUserId} failed: ${err.message}. The next conversion or the cron sweep will heal this.`
      );
    }

    const durationMs = Date.now() - startTime;
    this.logger.log(`Reward ${rewardId} applied in ${durationMs}ms`);

    return result;
  }
}
