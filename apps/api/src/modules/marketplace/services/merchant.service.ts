import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { Currency, Prisma } from '@db';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { StripeConnectService } from '../../billing/services/stripe-connect.service';
import { EventDispatcherService } from '../../webhook-outbound/services/event-dispatcher.service';

@Injectable()
export class MerchantService {
  private readonly logger = new Logger(MerchantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeConnect: StripeConnectService,
    private readonly events: EventDispatcherService
  ) {}

  async createForUser(
    userId: string,
    email: string,
    input: {
      country: string;
      defaultCurrency: Currency;
      businessType?: 'individual' | 'company';
      metadata?: Record<string, string>;
    }
  ) {
    const handle = await this.stripeConnect.createMerchantAccount({
      userId,
      email,
      country: input.country,
      defaultCurrency: input.defaultCurrency,
      businessType: input.businessType,
      metadata: input.metadata,
    });

    const merchant = await this.prisma.merchantAccount.create({
      data: {
        userId,
        processorId: this.stripeConnect.id,
        externalAccountId: handle.externalId,
        country: input.country,
        defaultCurrency: input.defaultCurrency,
        chargesEnabled: handle.chargesEnabled,
        payoutsEnabled: handle.payoutsEnabled,
        detailsSubmitted: handle.detailsSubmitted,
        requirements: handle.requirements as unknown as Prisma.InputJsonValue,
        businessType: input.businessType,
        metadata: (input.metadata ?? null) as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Created merchant ${merchant.id} (${handle.externalId}) for user ${userId}`);
    return merchant;
  }

  async getOnboardingLink(id: string, returnUrl: string, refreshUrl: string) {
    const merchant = await this.requireById(id);
    return this.stripeConnect.createMerchantOnboardingLink(
      merchant.externalAccountId,
      returnUrl,
      refreshUrl
    );
  }

  async getById(id: string) {
    return this.requireById(id);
  }

  async listForUser(userId: string) {
    return this.prisma.merchantAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBalance(id: string) {
    const merchant = await this.requireById(id);
    return this.stripeConnect.getMerchantBalance(merchant.externalAccountId);
  }

  /**
   * Webhook-side handler — invoked by WebhookProcessorService when Stripe
   * emits `account.updated`. Refreshes local state and emits the
   * `merchant.onboarded` / `merchant.requirements_updated` outbound event.
   */
  async refreshFromWebhook(externalAccountId: string) {
    const merchant = await this.prisma.merchantAccount.findFirst({
      where: { externalAccountId, processorId: 'stripe' },
    });
    if (!merchant) {
      this.logger.warn(`account.updated for unknown external id ${externalAccountId}`);
      return;
    }

    const handle = await this.stripeConnect.getMerchantAccount(externalAccountId);

    const wasOnboarded = merchant.detailsSubmitted && merchant.chargesEnabled;
    const isOnboarded = handle.detailsSubmitted && handle.chargesEnabled;

    const updated = await this.prisma.merchantAccount.update({
      where: { id: merchant.id },
      data: {
        chargesEnabled: handle.chargesEnabled,
        payoutsEnabled: handle.payoutsEnabled,
        detailsSubmitted: handle.detailsSubmitted,
        requirements: handle.requirements as unknown as Prisma.InputJsonValue,
        onboardedAt: isOnboarded && !wasOnboarded ? new Date() : merchant.onboardedAt,
      },
    });

    if (isOnboarded && !wasOnboarded) {
      await this.events.emit('merchant.onboarded', { merchantId: updated.id });
    } else {
      await this.events.emit('merchant.requirements_updated', { merchantId: updated.id });
    }
  }

  private async requireById(id: string) {
    const m = await this.prisma.merchantAccount.findUnique({ where: { id } });
    if (!m) throw new NotFoundException(`Merchant ${id} not found`);
    return m;
  }
}
