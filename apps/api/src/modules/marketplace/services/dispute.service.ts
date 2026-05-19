import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { Prisma } from '@db';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { DisputeEvidence } from '../../billing/services/payment-processor.interface';
import { StripeConnectService } from '../../billing/services/stripe-connect.service';

@Injectable()
export class DisputeService {
  private readonly logger = new Logger(DisputeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeConnect: StripeConnectService
  ) {}

  async get(id: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id } });
    if (!dispute) throw new NotFoundException(`Dispute ${id} not found`);
    return dispute;
  }

  async submitEvidence(id: string, evidence: DisputeEvidence) {
    const dispute = await this.get(id);
    const updated = await this.stripeConnect.submitDisputeEvidence(
      dispute.externalDisputeId,
      evidence
    );

    await this.prisma.dispute.update({
      where: { id },
      data: {
        status: updated.status,
        evidence: evidence as unknown as Prisma.InputJsonValue,
        evidenceDueBy: updated.evidenceDueBy ?? dispute.evidenceDueBy,
      },
    });

    this.logger.log(
      `Dispute ${id} (${dispute.externalDisputeId}) evidence submitted; status=${updated.status}`
    );
    return updated;
  }
}
