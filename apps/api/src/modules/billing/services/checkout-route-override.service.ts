import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '@core/prisma/prisma.service';

import type { CheckoutRouteProvider } from './checkout-routing-policy.service';

export const ROUTE_OVERRIDE_AUDIT_ACTION = 'billing.route_override.active';
export const ROUTE_OVERRIDE_CLEAR_ACTION = 'billing.route_override.cleared';

export interface StoredRouteOverride {
  targetUserId: string;
  product: string;
  provider: CheckoutRouteProvider;
  countryCode?: string;
  reason: string;
  operatorId: string;
  expiresAt: string;
  createdAt: string;
}

export interface SetRouteOverrideInput {
  targetUserId: string;
  product: string;
  provider: CheckoutRouteProvider;
  countryCode?: string;
  reason: string;
  operatorId: string;
  /** Hours until override expires (default 24). */
  ttlHours?: number;
}

@Injectable()
export class CheckoutRouteOverrideService {
  private readonly logger = new Logger(CheckoutRouteOverrideService.name);

  constructor(private prisma: PrismaService) {}

  overrideResourceId(userId: string, product: string): string {
    return `${userId}:${product.toLowerCase()}`;
  }

  async setOverride(input: SetRouteOverrideInput): Promise<StoredRouteOverride> {
    const ttlHours = input.ttlHours ?? 24;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const product = input.product.toLowerCase();

    const record: StoredRouteOverride = {
      targetUserId: input.targetUserId,
      product,
      provider: input.provider,
      countryCode: input.countryCode?.toUpperCase(),
      reason: input.reason,
      operatorId: input.operatorId,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    };

    await this.prisma.auditLog.create({
      data: {
        userId: input.operatorId,
        action: ROUTE_OVERRIDE_AUDIT_ACTION,
        resource: 'BillingRouteOverride',
        resourceId: this.overrideResourceId(input.targetUserId, product),
        severity: 'high',
        metadata: JSON.stringify(record),
      },
    });

    this.logger.log(
      `Route override set: user=${input.targetUserId} product=${product} provider=${input.provider}`
    );

    return record;
  }

  async clearOverride(
    targetUserId: string,
    product: string,
    operatorId: string,
    reason?: string
  ): Promise<void> {
    const normalizedProduct = product.toLowerCase();
    await this.prisma.auditLog.create({
      data: {
        userId: operatorId,
        action: ROUTE_OVERRIDE_CLEAR_ACTION,
        resource: 'BillingRouteOverride',
        resourceId: this.overrideResourceId(targetUserId, normalizedProduct),
        severity: 'medium',
        metadata: JSON.stringify({
          targetUserId,
          product: normalizedProduct,
          reason: reason ?? 'operator_cleared',
          clearedAt: new Date().toISOString(),
        }),
      },
    });
  }

  async getActiveOverride(
    targetUserId: string,
    product?: string
  ): Promise<StoredRouteOverride | null> {
    const normalizedProduct = (product || 'dhanam').toLowerCase();
    const resourceId = this.overrideResourceId(targetUserId, normalizedProduct);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        resource: 'BillingRouteOverride',
        resourceId,
        action: { in: [ROUTE_OVERRIDE_AUDIT_ACTION, ROUTE_OVERRIDE_CLEAR_ACTION] },
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    for (const log of logs) {
      if (log.action === ROUTE_OVERRIDE_CLEAR_ACTION) {
        return null;
      }
      if (log.action !== ROUTE_OVERRIDE_AUDIT_ACTION || !log.metadata) {
        continue;
      }

      try {
        const parsed = JSON.parse(log.metadata) as StoredRouteOverride;
        if (!parsed.expiresAt) {
          continue;
        }
        if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
          continue;
        }
        return parsed;
      } catch {
        continue;
      }
    }

    return null;
  }
}
