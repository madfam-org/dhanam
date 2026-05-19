import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { Prisma } from '@db';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { StripeConnectService } from '../../billing/services/stripe-connect.service';
import { EventDispatcherService } from '../../webhook-outbound/services/event-dispatcher.service';
import type { CreatePayoutDto } from '../dto/marketplace.dto';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeConnect: StripeConnectService,
    private readonly events: EventDispatcherService
  ) {}

  async create(dto: CreatePayoutDto) {
    const merchant = await this.prisma.merchantAccount.findUnique({
      where: { id: dto.merchantId },
    });
    if (!merchant) throw new NotFoundException(`Merchant ${dto.merchantId} not found`);

    const handle = await this.stripeConnect.createPayout({
      amount: dto.amount,
      currency: dto.currency,
      merchantExternalId: merchant.externalAccountId,
      method: dto.method,
      description: dto.description,
    });

    const payout = await this.prisma.payout.create({
      data: {
        merchantAccountId: merchant.id,
        externalPayoutId: handle.externalId,
        amount: new Prisma.Decimal(dto.amount / 100),
        currency: dto.currency,
        status: handle.status,
        method: dto.method,
        arrivalDate: handle.arrivalDate,
      },
    });
    this.logger.log(`Payout ${payout.id} (${handle.externalId}) created`);
    return payout;
  }

  async listForMerchant(merchantId: string) {
    return this.prisma.payout.findMany({
      where: { merchantAccountId: merchantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Webhook: payout.paid / payout.failed. */
  async updateStatusFromWebhook(
    externalPayoutId: string,
    status: 'paid' | 'failed' | 'canceled' | 'in_transit',
    failureCode?: string
  ) {
    const p = await this.prisma.payout.findUnique({
      where: { externalPayoutId },
    });
    if (!p) {
      this.logger.warn(`payout webhook for unknown ${externalPayoutId}`);
      return;
    }
    const updated = await this.prisma.payout.update({
      where: { id: p.id },
      data: {
        status,
        failureCode: failureCode ?? p.failureCode,
        paidAt: status === 'paid' ? new Date() : p.paidAt,
        failedAt: status === 'failed' ? new Date() : p.failedAt,
      },
    });
    if (status === 'paid') {
      await this.events.emit('payout.paid', { payoutId: updated.id });
    } else if (status === 'failed') {
      await this.events.emit('payout.failed', { payoutId: updated.id });
    }
  }
}
