import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { Prisma } from '@db';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { StripeConnectService } from '../../billing/services/stripe-connect.service';
import { EventDispatcherService } from '../../webhook-outbound/services/event-dispatcher.service';
import type { CreateTransferDto } from '../dto/marketplace.dto';

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeConnect: StripeConnectService,
    private readonly events: EventDispatcherService
  ) {}

  async create(dto: CreateTransferDto) {
    const merchant = await this.prisma.merchantAccount.findUnique({
      where: { id: dto.merchantId },
    });
    if (!merchant) throw new NotFoundException(`Merchant ${dto.merchantId} not found`);

    const handle = await this.stripeConnect.createTransfer({
      amount: dto.amount,
      currency: dto.currency,
      merchantExternalId: merchant.externalAccountId,
      sourceChargeId: dto.sourceChargeId,
      description: dto.description,
      metadata: dto.metadata,
    });

    const transfer = await this.prisma.transfer.create({
      data: {
        merchantAccountId: merchant.id,
        externalTransferId: handle.externalId,
        sourceChargeId: dto.sourceChargeId,
        amount: new Prisma.Decimal(dto.amount / 100),
        currency: dto.currency,
        status: handle.status,
        metadata: (dto.metadata ?? null) as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Transfer ${transfer.id} (${handle.externalId}) created`);
    await this.events.emit('transfer.created', { transferId: transfer.id });
    return transfer;
  }

  async listForMerchant(merchantId: string) {
    return this.prisma.transfer.findMany({
      where: { merchantAccountId: merchantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Webhook handler — Stripe `transfer.reversed`. */
  async markReversed(externalTransferId: string) {
    const t = await this.prisma.transfer.findUnique({
      where: { externalTransferId },
    });
    if (!t) {
      this.logger.warn(`transfer.reversed for unknown ${externalTransferId}`);
      return;
    }
    const updated = await this.prisma.transfer.update({
      where: { id: t.id },
      data: { status: 'reversed', reversedAt: new Date() },
    });
    await this.events.emit('transfer.reversed', { transferId: updated.id });
  }

  async promoteFromPendingByExternalId(externalTransferId: string) {
    const t = await this.prisma.transfer.findUnique({
      where: { externalTransferId },
    });
    if (!t) return;
    if (t.status === 'paid') return;
    await this.prisma.transfer.update({
      where: { id: t.id },
      data: { status: 'paid' },
    });
  }
}
