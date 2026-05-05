/**
 * =============================================================================
 * Dhanam Referral Module (Rewards-Only)
 * =============================================================================
 * Provides reward application and ambassador tier management for the
 * MADFAM ecosystem referral system.
 *
 * Funnel tracking (referral codes, lifecycle) has moved to PhyneCRM.
 *
 * ## Features
 * - Reward creation from PhyneCRM conversion webhooks
 * - Reward application (subscription extensions, credit grants)
 * - Ambassador tier system (none -> bronze -> silver -> gold -> platinum)
 *
 * ## Jobs
 * - ReferralRewardJob: Processes pending rewards every 15 minutes
 * =============================================================================
 */
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { BillingModule } from '../billing/billing.module';
import { JobsModule } from '../jobs/jobs.module';

import { AmbassadorService } from './ambassador.service';
import { ReferralHmacGuard } from './guards/referral-hmac.guard';
import { ReferralRewardJob } from './jobs/referral-reward.job';
import { ReferralRewardProcessor } from './jobs/referral-reward.processor';
import { ReferralRewardService } from './referral-reward.service';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';

@Module({
  imports: [
    ConfigModule,
    BillingModule,
    // forwardRef on JobsModule because JobsModule pulls in a long
    // dependency chain (Spaces → Billing → Monitoring → Jobs) and we
    // only need QueueService here. Mirrors the same pattern used by
    // MonitoringModule per the comment in monitoring.module.ts.
    forwardRef(() => JobsModule),
  ],
  controllers: [ReferralController],
  providers: [
    // Core services
    ReferralService,
    ReferralRewardService,
    AmbassadorService,

    // Jobs
    ReferralRewardJob,
    ReferralRewardProcessor,

    // Guards
    ReferralHmacGuard,
  ],
  exports: [ReferralService, ReferralRewardService, AmbassadorService],
})
export class ReferralModule {}
