import { Injectable, Logger } from '@nestjs/common';

import { Prisma } from '@db';

import { PrismaService } from '../../../core/prisma/prisma.service';

/**
 * Correlate Karafiel-issued CFDI UUIDs back onto Dhanam BillingEvent rows
 * for the admin POS timeline.
 */
@Injectable()
export class CfdiTimelineService {
  private readonly logger = new Logger(CfdiTimelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Attach a CFDI UUID to every billing event whose metadata references
   * the given Stripe PaymentIntent id (`pi_*`).
   */
  async attachCfdiUuid(paymentId: string, cfdiUuid: string | null): Promise<number> {
    if (!paymentId) {
      return 0;
    }

    const [byPaymentIntentId, byPaymentId] = await Promise.all([
      this.prisma.billingEvent.findMany({
        where: {
          metadata: {
            path: ['paymentIntentId'],
            equals: paymentId,
          },
        },
        take: 25,
      }),
      this.prisma.billingEvent.findMany({
        where: {
          metadata: {
            path: ['payment_id'],
            equals: paymentId,
          },
        },
        take: 25,
      }),
    ]);

    const seen = new Set<string>();
    let updated = 0;

    for (const event of [...byPaymentIntentId, ...byPaymentId]) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);

      const existing = (event.metadata as Record<string, unknown> | null) ?? {};
      const mergedCfdi =
        cfdiUuid ?? (typeof existing.cfdiUuid === 'string' ? existing.cfdiUuid : null);

      await this.prisma.billingEvent.update({
        where: { id: event.id },
        data: {
          metadata: {
            ...existing,
            ...(mergedCfdi ? { cfdiUuid: mergedCfdi } : {}),
            karafielDelivered: true,
            karafielDeliveredAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
      updated += 1;
    }

    if (updated === 0) {
      this.logger.debug(`No billing events found for payment_id=${paymentId} (CFDI timeline)`);
    }

    return updated;
  }
}
