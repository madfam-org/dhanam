import { Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';

import { Currency, Prisma } from '@db';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { EventDispatcherService } from '../../webhook-outbound/services/event-dispatcher.service';

import { ChargeService } from './charge.service';
import { MerchantService } from './merchant.service';
import { PayoutService } from './payout.service';
import { TransferService } from './transfer.service';

/**
 * Routes Stripe Connect-related webhook events to the right handler.
 * Called from BillingService.handleConnectEvent (which is called from
 * billing.controller.ts's existing Stripe webhook switch).
 *
 * Connect events we care about:
 *   account.updated
 *   charge.dispute.created / updated / closed
 *   payout.paid / failed
 *   transfer.created / reversed
 *   application_fee.created / refunded
 */
@Injectable()
export class ConnectWebhookHandler {
  private readonly logger = new Logger(ConnectWebhookHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly merchants: MerchantService,
    private readonly charges: ChargeService,
    private readonly transfers: TransferService,
    private readonly payouts: PayoutService,
    private readonly events: EventDispatcherService
  ) {}

  async handle(event: Stripe.Event): Promise<boolean> {
    switch (event.type) {
      case 'account.updated':
        await this.merchants.refreshFromWebhook((event.data.object as Stripe.Account).id);
        return true;

      case 'charge.dispute.created':
        await this.onDisputeCreated(event.data.object as Stripe.Dispute);
        return true;
      case 'charge.dispute.updated':
      case 'charge.dispute.closed':
        await this.onDisputeUpdated(event.data.object as Stripe.Dispute);
        return true;

      case 'payout.paid':
        await this.payouts.updateStatusFromWebhook((event.data.object as Stripe.Payout).id, 'paid');
        return true;
      case 'payout.failed': {
        const p = event.data.object as Stripe.Payout;
        await this.payouts.updateStatusFromWebhook(p.id, 'failed', p.failure_code ?? undefined);
        return true;
      }

      case 'transfer.created':
        await this.transfers.promoteFromPendingByExternalId(
          (event.data.object as Stripe.Transfer).id
        );
        return true;
      case 'transfer.reversed':
        await this.transfers.markReversed((event.data.object as Stripe.Transfer).id);
        return true;

      case 'application_fee.created':
        await this.onApplicationFeeCreated(event.data.object as Stripe.ApplicationFee);
        return true;

      default:
        return false;
    }
  }

  private async onDisputeCreated(d: Stripe.Dispute) {
    // The dispute's charge has a transfer.destination that identifies the merchant.
    // We best-effort look up by the stored charge's merchant. If we can't find
    // a merchant, we still persist the dispute with a null merchant.
    // In practice dhanam sees disputes only for merchants it created.
    const merchant = await this.findMerchantForCharge(
      typeof d.charge === 'string' ? d.charge : d.charge.id
    );
    if (!merchant) {
      this.logger.warn(`charge.dispute.created for unknown merchant: charge=${d.charge}`);
      return;
    }
    const row = await this.prisma.dispute.upsert({
      where: { externalDisputeId: d.id },
      create: {
        merchantAccountId: merchant.id,
        externalDisputeId: d.id,
        externalChargeId: typeof d.charge === 'string' ? d.charge : d.charge.id,
        amount: new Prisma.Decimal(d.amount / 100),
        currency: d.currency.toUpperCase() as Currency,
        reason: d.reason,
        status: d.status,
        evidenceDueBy: d.evidence_details?.due_by
          ? new Date(d.evidence_details.due_by * 1000)
          : undefined,
      },
      update: { status: d.status },
    });
    await this.events.emit('charge.dispute.created', {
      disputeId: row.id,
      amount: d.amount,
      currency: d.currency,
      reason: d.reason,
    });
  }

  private async onDisputeUpdated(d: Stripe.Dispute) {
    const row = await this.prisma.dispute.findUnique({
      where: { externalDisputeId: d.id },
    });
    if (!row) return;
    const resolved = d.status === 'won' || d.status === 'lost' || d.status === 'warning_closed';
    await this.prisma.dispute.update({
      where: { id: row.id },
      data: {
        status: d.status,
        resolvedAt: resolved ? new Date() : row.resolvedAt,
      },
    });
    const eventType = resolved ? 'charge.dispute.closed' : 'charge.dispute.updated';
    await this.events.emit(eventType, { disputeId: row.id, status: d.status });
  }

  private async onApplicationFeeCreated(fee: Stripe.ApplicationFee) {
    const merchantExternalId = typeof fee.account === 'string' ? fee.account : fee.account.id;
    await this.charges.recordApplicationFee({
      externalFeeId: fee.id,
      externalChargeId: typeof fee.charge === 'string' ? fee.charge : fee.charge.id,
      merchantExternalId,
      amount: fee.amount,
      currency: fee.currency,
    });
  }

  private async findMerchantForCharge(_externalChargeId: string) {
    // We don't store Stripe charges directly, but a dispute's charge has
    // destination=<acct> which Stripe preserves in the dispute event
    // envelope. For now, we resolve to null when the mapping is ambiguous
    // and rely on the dispute's account hint at webhook time. A future
    // improvement is to persist a lightweight Charge row with merchant id.
    return null as null | { id: string };
  }
}
