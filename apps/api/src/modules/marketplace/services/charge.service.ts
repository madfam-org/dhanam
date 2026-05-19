import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { Currency, Prisma } from '@db';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { StripeConnectService } from '../../billing/services/stripe-connect.service';
import { EventDispatcherService } from '../../webhook-outbound/services/event-dispatcher.service';
import type { CreateDestinationChargeDto } from '../dto/marketplace.dto';

@Injectable()
export class ChargeService {
  private readonly logger = new Logger(ChargeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeConnect: StripeConnectService,
    private readonly events: EventDispatcherService
  ) {}

  async createDestination(dto: CreateDestinationChargeDto) {
    const merchant = await this.prisma.merchantAccount.findUnique({
      where: { id: dto.merchantId },
    });
    if (!merchant) throw new NotFoundException(`Merchant ${dto.merchantId} not found`);

    const charge = await this.stripeConnect.createDestinationCharge({
      amount: dto.amount,
      currency: dto.currency,
      merchantExternalId: merchant.externalAccountId,
      applicationFeeAmount: dto.applicationFeeAmount,
      customerId: dto.customerId,
      paymentMethodId: dto.paymentMethodId,
      description: dto.description,
      captureMethod: dto.captureMethod,
      metadata: dto.metadata,
    });

    this.logger.log(
      `Destination charge ${charge.externalId} amount=${dto.amount} ${dto.currency} merchant=${merchant.id}`
    );

    // We don't persist a Charge row in dhanam today — a charge is Stripe's
    // authoritative record, and the full lifecycle (refund, dispute,
    // transfer.created, application_fee.created) is webhook-driven. Only
    // the derivative rows (Transfer, Dispute, ApplicationFee) land in
    // our DB.
    await this.events.emit('charge.succeeded', {
      externalChargeId: charge.externalId,
      merchantId: merchant.id,
      amount: dto.amount,
      currency: dto.currency,
      applicationFeeAmount: dto.applicationFeeAmount,
    });

    return charge;
  }

  /** Webhook handler for `application_fee.created`. */
  async recordApplicationFee(input: {
    externalFeeId: string;
    externalChargeId: string;
    merchantExternalId: string;
    amount: number;
    currency: string;
  }) {
    const merchant = await this.prisma.merchantAccount.findFirst({
      where: { externalAccountId: input.merchantExternalId, processorId: 'stripe' },
    });
    if (!merchant) {
      this.logger.warn(`application_fee.created for unknown merchant ${input.merchantExternalId}`);
      return;
    }
    await this.prisma.applicationFee.upsert({
      where: { externalFeeId: input.externalFeeId },
      create: {
        externalFeeId: input.externalFeeId,
        externalChargeId: input.externalChargeId,
        merchantAccountId: merchant.id,
        amount: new Prisma.Decimal(input.amount / 100),
        currency: input.currency.toUpperCase() as Currency,
      },
      update: {},
    });
  }
}
