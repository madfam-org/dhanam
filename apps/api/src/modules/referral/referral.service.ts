import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';

import { PrismaService } from '../../core/prisma/prisma.service';
import { QueueService } from '../jobs/queue.service';

import { AmbassadorService } from './ambassador.service';
import { ReferralConversionDataDto } from './dto/referral-event.dto';

/**
 * =============================================================================
 * Referral Service (Rewards-Only)
 * =============================================================================
 * Handles reward creation from PhyneCRM conversion webhooks and
 * reward history queries.
 *
 * Funnel tracking (code generation, validation, application, lifecycle
 * events, stats) has moved to PhyneCRM. Dhanam retains only:
 * - Reward creation on conversion
 * - Reward history retrieval
 * - Ambassador tier recalculation (delegated to AmbassadorService)
 *
 * @see ReferralRewardService - reward application (Stripe / credits)
 * @see AmbassadorService - tier management
 * =============================================================================
 */
@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ambassadorService: AmbassadorService,
    // forwardRef matches the ReferralModule → JobsModule edge that is
    // already wrapped to break the Spaces → Billing → Monitoring → Jobs
    // → Referral cycle. QueueService itself has no dependency back into
    // ReferralModule.
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService
  ) {}

  /**
   * Handle a `referral.converted` webhook from PhyneCRM.
   *
   * Creates ReferralReward rows:
   * - Referrer: 1 month subscription extension
   * - Referrer: 50 credits
   * - Referred user: 50 credits
   *
   * Then recalculates the referrer's ambassador tier.
   *
   * The `referralId` stored in each reward is a cross-service reference
   * to the PhyneCRM referral record, not a local FK.
   */
  async handleConversionWebhook(data: ReferralConversionDataDto): Promise<{
    rewards_created: number;
    ambassador_tier: string;
  }> {
    const { referral_code, referrer_user_id, referred_user_id, source_product, target_product } =
      data;

    // Use the referral code as the cross-service reference ID.
    // PhyneCRM owns the referral record; we just store its code for traceability.
    const referralId = referral_code;

    // Check for duplicate: avoid double-rewarding the same conversion
    const existing = await this.prisma.referralReward.findFirst({
      where: {
        referralId,
        recipientUserId: referrer_user_id,
        rewardType: 'subscription_extension',
      },
    });

    if (existing) {
      this.logger.warn(
        `Duplicate conversion webhook for code=${referral_code}, referrer=${referrer_user_id}. Skipping.`
      );
      const profile = await this.ambassadorService.getProfile(referrer_user_id);
      return { rewards_created: 0, ambassador_tier: profile.tier };
    }

    // Create rewards atomically. We use individual `create` calls inside
    // a transaction (rather than `createMany`) because `createMany` does
    // not return generated ids — and we need them to drive the BullMQ
    // enqueue with a stable jobId for idempotency.
    const rewardSpecs: Array<{
      recipientUserId: string;
      rewardType: 'subscription_extension' | 'credit_grant';
      amount: number;
      description: string;
    }> = [
      {
        recipientUserId: referrer_user_id,
        rewardType: 'subscription_extension',
        amount: 1,
        description: 'Referral reward: 1 free month for successful referral',
      },
      {
        recipientUserId: referrer_user_id,
        rewardType: 'credit_grant',
        amount: 50,
        description: 'Referral bonus: 50 credits for referrer',
      },
      {
        recipientUserId: referred_user_id,
        rewardType: 'credit_grant',
        amount: 50,
        description: 'Welcome bonus: 50 credits for being referred',
      },
    ];

    const createdRewards = await this.prisma.$transaction(
      rewardSpecs.map((spec) =>
        this.prisma.referralReward.create({
          data: {
            referralId,
            recipientUserId: spec.recipientUserId,
            rewardType: spec.rewardType,
            amount: spec.amount,
            description: spec.description,
            metadata: { source_product, target_product },
          },
          select: {
            id: true,
            recipientUserId: true,
            rewardType: true,
          },
        })
      )
    );

    this.logger.log(
      `Created ${createdRewards.length} rewards for conversion: code=${referral_code} referrer=${referrer_user_id} referred=${referred_user_id}`
    );

    // Auto-enqueue an apply job per reward. JobId = reward.id makes the
    // enqueue idempotent: a duplicate webhook (PhyneCRM retry, manual
    // replay) cannot create a duplicate job, and the worker also short-
    // circuits if reward.applied is already true.
    //
    // Failures here are logged but never thrown — the reward rows are
    // already in the DB, and the existing 15-min cron sweep
    // (ReferralRewardJob) will pick them up as a safety net.
    for (const reward of createdRewards) {
      try {
        const job = await this.queueService.addReferralRewardJob({
          rewardId: reward.id,
          recipientUserId: reward.recipientUserId,
          rewardType: reward.rewardType,
          referralId,
        });

        if (job) {
          this.logger.debug(`Enqueued reward apply job for ${reward.id} (${reward.rewardType})`);
        } else {
          this.logger.warn(
            `Reward ${reward.id} created but enqueue returned null (queue not ready). Cron sweep will pick it up.`
          );
        }
      } catch (enqueueError) {
        const err = enqueueError instanceof Error ? enqueueError : new Error(String(enqueueError));
        this.logger.error(
          `Reward ${reward.id} created but enqueue failed: ${err.message}. Cron sweep will pick it up.`,
          err.stack
        );
      }
    }

    // Recalculate ambassador tier
    const tierResult = await this.ambassadorService.recalculateTier(referrer_user_id);

    if (tierResult.promoted) {
      this.logger.log(
        `Ambassador promoted: ${referrer_user_id} ${tierResult.previousTier} -> ${tierResult.newTier}`
      );
    }

    return {
      rewards_created: createdRewards.length,
      ambassador_tier: tierResult.newTier,
    };
  }

  /**
   * Get reward history for a user (as recipient).
   */
  async getRewards(userId: string): Promise<
    Array<{
      id: string;
      rewardType: string;
      amount: number;
      description: string;
      applied: boolean;
      appliedAt: Date | null;
      createdAt: Date;
    }>
  > {
    return this.prisma.referralReward.findMany({
      where: { recipientUserId: userId },
      select: {
        id: true,
        rewardType: true,
        amount: true,
        description: true,
        applied: true,
        appliedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
