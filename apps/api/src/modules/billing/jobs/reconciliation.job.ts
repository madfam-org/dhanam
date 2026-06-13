import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import Stripe from 'stripe';

import { PrismaService } from '@core/prisma/prisma.service';
import { Prisma } from '@db';

@Injectable()
export class ReconciliationJob {
  private readonly logger = new Logger(ReconciliationJob.name);
  private stripeClient: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService
  ) {}

  // Lazy Stripe init: Stripe v20.4.1 throws "Neither apiKey nor
  // config.authenticator provided" when constructed with an empty
  // string. Production deployments without STRIPE_SECRET_KEY (e.g.
  // FEATURE_STRIPE_MXN_LIVE=false) crashloop the entire API on
  // module instantiation. Lazy init defers the constructor call to
  // the cron tick, where we can also no-op gracefully when key is
  // absent.
  private get stripe(): Stripe | null {
    if (this.stripeClient) return this.stripeClient;
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key) return null;
    this.stripeClient = new Stripe(key, { apiVersion: '2026-02-25.clover' });
    return this.stripeClient;
  }

  /**
   * Nightly reconciliation: compare local subscription state with Stripe's
   * source of truth. Flags discrepancies as BillingEvent records and logs
   * warnings for manual review.
   *
   * Runs daily at 3:00 AM UTC.
   */
  @Cron('0 3 * * *', { name: 'billing-reconciliation' })
  async reconcile(): Promise<void> {
    const stripe = this.stripe;
    if (!stripe) {
      this.logger.warn('Skipping billing reconciliation — STRIPE_SECRET_KEY not configured');
      return;
    }
    this.logger.log('Starting nightly billing reconciliation');

    const subscribedUsers = await this.prisma.user.findMany({
      where: {
        subscriptionTier: { not: null },
        stripeCustomerId: { not: null },
      },
      select: {
        id: true,
        email: true,
        subscriptionTier: true,
        stripeCustomerId: true,
        subscriptionExpiresAt: true,
      },
    });

    let checked = 0;
    let mismatches = 0;

    for (const user of subscribedUsers) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId!,
          status: 'active',
          limit: 1,
        });

        const activeStripe = subscriptions.data[0];

        if (!activeStripe && user.subscriptionTier) {
          // Local says subscribed, Stripe says no active subscription
          await this.flagMismatch(user.id, {
            type: 'local_active_stripe_inactive',
            localTier: user.subscriptionTier,
            stripeStatus: 'no_active_subscription',
          });
          mismatches++;
        } else if (activeStripe && !user.subscriptionTier) {
          // Stripe says active, local says no subscription
          await this.flagMismatch(user.id, {
            type: 'stripe_active_local_inactive',
            stripeStatus: activeStripe.status,
            stripePlan: activeStripe.items.data[0]?.price?.id ?? 'unknown',
          });
          mismatches++;
        }

        checked++;
      } catch (error) {
        this.logger.error(`Reconciliation failed for user ${user.id}: ${(error as Error).message}`);
      }
    }

    this.logger.log(`Reconciliation complete: ${checked} checked, ${mismatches} mismatches`);
  }

  private async flagMismatch(userId: string, details: Record<string, unknown>): Promise<void> {
    this.logger.warn(`Billing mismatch for user ${userId}: ${JSON.stringify(details)}`);

    await this.prisma.billingEvent.create({
      data: {
        userId,
        type: 'reconciliation_mismatch',
        amount: 0,
        currency: 'USD',
        status: 'flagged',
        // `details` is shaped as Record<string, unknown>; Prisma's Json column
        // accepts InputJsonValue (a recursively-typed JSON shape). The runtime
        // value IS valid JSON, but TS can't prove it from the unknown value
        // type — cast at the boundary.
        metadata: details as Prisma.InputJsonValue,
      },
    });
  }
}
