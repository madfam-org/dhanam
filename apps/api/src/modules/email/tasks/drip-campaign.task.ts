import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '@core/prisma/prisma.service';
import { PostHogService } from '@modules/analytics/posthog.service';

import { EmailService } from '../email.service';

@Injectable()
export class DripCampaignTask {
  private readonly logger = new Logger(DripCampaignTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly postHogService: PostHogService
  ) {}

  /**
   * Activation drip: nudge new users toward key actions
   * Runs daily at 10 AM UTC
   */
  @Cron('0 10 * * *')
  async processActivationDrips() {
    this.logger.log('Starting activation drip campaign');

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const users = await this.prisma.user.findMany({
        where: {
          isActive: true,
          createdAt: { gte: thirtyDaysAgo },
          preferences: { emailNotifications: true },
        },
        include: {
          preferences: true,
          userSpaces: {
            where: { role: 'owner' },
            include: {
              space: {
                include: {
                  accounts: { select: { id: true } },
                  budgets: { select: { id: true } },
                },
              },
            },
          },
          dripEvents: {
            where: { campaign: 'activation' },
          },
        },
      });

      for (const user of users) {
        try {
          await this.processActivationUser(user);
        } catch (error) {
          this.logger.error(`Activation drip failed for ${user.email}:`, error);
        }
      }

      this.logger.log(`Activation drip completed for ${users.length} eligible users`);
    } catch (error) {
      this.logger.error('Activation drip campaign failed:', error);
    }
  }

  /**
   * Re-engagement drip: bring back inactive users
   * Runs daily at 11 AM UTC
   */
  @Cron('0 11 * * *')
  async processReEngagementDrips() {
    this.logger.log('Starting re-engagement drip campaign');

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const users = await this.prisma.user.findMany({
        where: {
          isActive: true,
          lastActivityAt: { lt: sevenDaysAgo },
          preferences: { emailNotifications: true },
        },
        include: {
          preferences: true,
          userSpaces: {
            where: { role: 'owner' },
            include: {
              space: {
                include: {
                  accounts: {
                    include: {
                      transactions: {
                        where: { categoryId: null },
                        select: { id: true },
                      },
                    },
                  },
                },
              },
            },
          },
          dripEvents: {
            where: { campaign: 're-engagement' },
          },
        },
      });

      for (const user of users) {
        try {
          await this.processReEngagementUser(user);
        } catch (error) {
          this.logger.error(`Re-engagement drip failed for ${user.email}:`, error);
        }
      }

      this.logger.log(`Re-engagement drip completed for ${users.length} eligible users`);
    } catch (error) {
      this.logger.error('Re-engagement drip campaign failed:', error);
    }
  }

  private async processActivationUser(user: any) {
    const daysSinceSignup = this.daysBetween(user.createdAt, new Date());
    const sentSteps = new Set(user.dripEvents.map((e: any) => e.step));

    const accountCount = user.userSpaces.reduce(
      (sum: number, us: any) => sum + (us.space.accounts?.length || 0),
      0
    );
    const budgetCount = user.userSpaces.reduce(
      (sum: number, us: any) => sum + (us.space.budgets?.length || 0),
      0
    );

    // Day 1: Connect accounts nudge (skip if user already has accounts)
    if (daysSinceSignup >= 1 && accountCount === 0 && !sentSteps.has('day-1-connect')) {
      await this.sendDrip(user, 'activation', 'day-1-connect', 'drip-day-1-connect', {
        name: user.name,
        subject: 'Connect your accounts to get started',
      });
    }

    // Day 3: Create budget nudge (skip if user already has budgets)
    if (daysSinceSignup >= 3 && budgetCount === 0 && !sentSteps.has('day-3-budget')) {
      await this.sendDrip(user, 'activation', 'day-3-budget', 'drip-day-3-budget', {
        name: user.name,
        accountCount,
        subject: 'Create your first budget',
      });
    }

    // Day 7: Personalized summary (always send)
    if (daysSinceSignup >= 7 && !sentSteps.has('day-7-summary')) {
      const transactionCount = await this.getTransactionCount(user);
      const goalCount = await this.getGoalCount(user);

      await this.sendDrip(user, 'activation', 'day-7-summary', 'drip-day-7-summary', {
        name: user.name,
        daysSinceSignup,
        accountCount,
        transactionCount,
        budgetCount,
        hasGoals: goalCount > 0,
        subject: 'Your first week with Dhanam',
      });
    }

    // Day 14: Trial ending warning
    if (
      daysSinceSignup >= 12 &&
      !sentSteps.has('day-14-trial') &&
      user.trialEndsAt &&
      user.subscriptionTier === 'community'
    ) {
      const daysRemaining = this.daysBetween(new Date(), user.trialEndsAt);
      if (daysRemaining >= 0 && daysRemaining <= 3) {
        await this.sendDrip(user, 'activation', 'day-14-trial', 'drip-day-14-trial', {
          name: user.name,
          daysRemaining,
          tier: user.trialTier || 'premium',
          subject: `Your trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`,
        });
      }
    }
  }

  private async processReEngagementUser(user: any) {
    const daysInactive = user.lastActivityAt
      ? this.daysBetween(user.lastActivityAt, new Date())
      : 999;
    const sentSteps = new Set(user.dripEvents.map((e: any) => e.step));

    // Day 7 inactive: "We miss you"
    if (daysInactive >= 7 && daysInactive < 14 && !sentSteps.has('day-7-inactive')) {
      await this.sendDrip(user, 're-engagement', 'day-7-inactive', 'drip-reengagement-day-7', {
        name: user.name,
        daysInactive,
        subject: 'Your finances are waiting for you',
      });
    }

    // Day 14 inactive: "Here's what you're missing"
    if (daysInactive >= 14 && !sentSteps.has('day-14-inactive')) {
      const unreviewedCount = user.userSpaces.reduce(
        (sum: number, us: any) =>
          sum +
          us.space.accounts.reduce(
            (aSum: number, acc: any) => aSum + (acc.transactions?.length || 0),
            0
          ),
        0
      );

      const totalBalance = await this.getTotalBalance(user);

      await this.sendDrip(user, 're-engagement', 'day-14-inactive', 'drip-reengagement-day-14', {
        name: user.name,
        daysInactive,
        unreviewedCount,
        totalBalance: totalBalance.toFixed(2),
        subject: `You have ${unreviewedCount} unreviewed transactions`,
      });
    }
  }

  private async sendDrip(
    user: any,
    campaign: string,
    step: string,
    template: string,
    context: Record<string, any>
  ) {
    const { subject, ...templateContext } = context;

    // Record the drip event first (unique constraint prevents duplicates)
    await this.prisma.dripEvent.create({
      data: {
        userId: user.id,
        campaign,
        step,
      },
    });

    await this.emailService.sendEmail({
      to: user.email,
      subject,
      template: template as any,
      context: templateContext,
      priority: 'low',
    });

    this.postHogService.capture({
      distinctId: user.id,
      event: 'drip_email_sent',
      properties: { campaign, step, template },
    });

    this.logger.log(`Sent drip ${campaign}/${step} to ${user.email}`);
  }

  private daysBetween(from: Date, to: Date): number {
    return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }

  private async getTransactionCount(user: any): Promise<number> {
    const spaceIds = user.userSpaces.map((us: any) => us.space.id);
    if (spaceIds.length === 0) return 0;

    const count = await this.prisma.transaction.count({
      where: { account: { spaceId: { in: spaceIds } } },
    });
    return count;
  }

  private async getGoalCount(user: any): Promise<number> {
    const count = await this.prisma.goal.count({
      where: { createdBy: user.id, status: 'active' },
    });
    return count;
  }

  private async getTotalBalance(user: any): Promise<number> {
    const spaceIds = user.userSpaces.map((us: any) => us.space.id);
    if (spaceIds.length === 0) return 0;

    const result = await this.prisma.account.aggregate({
      where: { spaceId: { in: spaceIds } },
      _sum: { balance: true },
    });
    return result._sum.balance?.toNumber() || 0;
  }

  // ─── Cancellation Retention Drip ───────────────────────────────

  /**
   * Post-cancellation retention: win-back emails at day 3, 7, and 14.
   * Runs daily at 12 PM UTC.
   */
  @Cron('0 12 * * *')
  async processRetentionDrips() {
    this.logger.log('Starting cancellation retention drip campaign');

    try {
      // Find users enrolled in the retention campaign
      const enrolled = await this.prisma.dripEvent.findMany({
        where: {
          campaign: 'cancellation-retention',
          step: 'enrolled',
        },
        include: {
          user: { select: { id: true, email: true, name: true, cancelledAt: true } },
        },
      });

      let sent = 0;

      for (const event of enrolled) {
        const user = event.user;
        if (!user?.cancelledAt || !user.email) continue;

        const daysSinceCancel = Math.floor(
          (Date.now() - new Date(user.cancelledAt).getTime()) / (1000 * 60 * 60 * 24)
        );

        try {
          if (daysSinceCancel >= 3 && daysSinceCancel < 7) {
            await this.sendRetentionStep(user, 'day3_miss_you', daysSinceCancel);
            sent++;
          } else if (daysSinceCancel >= 7 && daysSinceCancel < 14) {
            await this.sendRetentionStep(user, 'day7_win_back', daysSinceCancel);
            sent++;
          } else if (daysSinceCancel >= 14 && daysSinceCancel < 21) {
            await this.sendRetentionStep(user, 'day14_last_chance', daysSinceCancel);
            sent++;
          }
        } catch (error) {
          this.logger.error(`Retention drip failed for ${user.email}:`, error);
        }
      }

      this.logger.log(`Retention drip complete: ${sent} emails sent`);
    } catch (error) {
      this.logger.error('Retention drip campaign failed:', error);
    }
  }

  private async sendRetentionStep(
    user: { id: string; email: string; name: string | null },
    step: string,
    daysSinceCancel: number
  ) {
    // Idempotency: check if this step was already sent
    const existing = await this.prisma.dripEvent.findFirst({
      where: { userId: user.id, campaign: 'cancellation-retention', step },
    });
    if (existing) return;

    const subjects: Record<string, string> = {
      day3_miss_you: 'Te echamos de menos',
      day7_win_back: 'Una oferta especial para ti',
      day14_last_chance: 'Ultima oportunidad',
    };

    const bodies: Record<string, string> = {
      day3_miss_you: `Hola ${user.name || ''},\n\nNotamos que cancelaste tu suscripcion. Queremos que sepas que tu experiencia nos importa. Si hay algo que podamos mejorar, nos encantaria saberlo.\n\nSiempre puedes volver cuando quieras.`,
      day7_win_back: `Hola ${user.name || ''},\n\nTenemos una oferta especial: 30% de descuento por 3 meses si decides regresar. Tu historial y configuracion siguen guardados.\n\nResponde a este correo si te interesa.`,
      day14_last_chance: `Hola ${user.name || ''},\n\nEste es un recordatorio amistoso de que tu cuenta sigue disponible. Despues de 30 dias, tus datos seran eliminados de acuerdo con nuestra politica de privacidad.\n\nSi cambias de opinion, reactivar es facil.`,
    };

    // EmailOptions no longer accepts a free-form `text` field; route through
    // the closest existing reengagement template and pass the prior body as
    // context so operators can later wire it into the .hbs template.
    // Behaviour change: previously `text` was silently dropped by the email
    // pipeline (which renders only the .hbs template `html`), so this fix
    // is type-only — the prior body was never being delivered.
    await this.emailService.sendEmail({
      to: user.email,
      subject: subjects[step] || 'Hola de nuevo',
      template: 'drip-reengagement-day-14',
      context: {
        name: user.name || '',
        daysInactive: daysSinceCancel,
        body: bodies[step] || '',
        step,
      },
      priority: 'low',
    });

    // Record the drip event
    await this.prisma.dripEvent.create({
      data: {
        userId: user.id,
        campaign: 'cancellation-retention',
        step,
      },
    });

    // Track in PostHog
    await this.postHogService.capture({
      distinctId: user.id,
      event: 'retention_drip_sent',
      properties: { step, days_since_cancel: daysSinceCancel },
    });
  }
}
