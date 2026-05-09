import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { AmbassadorService } from '../ambassador.service';
import { ReferralRewardService } from '../referral-reward.service';

/**
 * =============================================================================
 * Referral Reward Job
 * =============================================================================
 * Processes unapplied referral rewards every 15 minutes.
 *
 * Reward rows are created by ReferralService.handleConversionWebhook() when
 * PhyndCRM sends a referral.converted event. This job picks up any rewards
 * that have not yet been applied (subscription extension or credit grant)
 * and executes them.
 *
 * Designed to be idempotent: already-applied rewards are skipped.
 * =============================================================================
 */
@Injectable()
export class ReferralRewardJob {
  private readonly logger = new Logger(ReferralRewardJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardService: ReferralRewardService,
    private readonly ambassadorService: AmbassadorService
  ) {}

  /**
   * Process pending referral rewards every 15 minutes.
   */
  @Cron('*/15 * * * *', { name: 'referral-reward-processing' })
  async processRewards(): Promise<void> {
    this.logger.log('Starting referral reward processing');

    // Find unapplied rewards
    const unappliedRewards = await this.prisma.referralReward.findMany({
      where: { applied: false },
      select: {
        id: true,
        recipientUserId: true,
      },
      take: 100, // Process in batches to avoid overload
    });

    if (unappliedRewards.length === 0) {
      this.logger.debug('No unapplied rewards to process');
      return;
    }

    this.logger.log(`Processing ${unappliedRewards.length} unapplied rewards`);

    let applied = 0;
    let failed = 0;
    const usersToRecalculate = new Set<string>();

    for (const reward of unappliedRewards) {
      try {
        const result = await this.rewardService.applyReward(reward.id);
        if (result.applied) {
          applied++;
          usersToRecalculate.add(reward.recipientUserId);
        }
      } catch (error) {
        this.logger.error(
          `Failed to apply reward ${reward.id}: ${(error as Error).message}`,
          (error as Error).stack
        );
        failed++;
      }
    }

    // Recalculate ambassador tiers for all affected users
    for (const userId of usersToRecalculate) {
      try {
        await this.ambassadorService.recalculateTier(userId);
      } catch (error) {
        this.logger.error(`Failed to recalculate tier for ${userId}: ${(error as Error).message}`);
      }
    }

    this.logger.log(
      `Referral reward processing complete: ${applied} applied, ${failed} failed, ${usersToRecalculate.size} tiers recalculated`
    );
  }
}
