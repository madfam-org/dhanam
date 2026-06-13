import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import { AuditService } from '@core/audit/audit.service';
import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { BillingService, type OperatorCheckoutStatus } from '@modules/billing/billing.service';
import { parseFeeScheduleEntries } from '@modules/billing/config/payment-route-fee-schedule';
import {
  CheckoutRouteOverrideService,
  type StoredRouteOverride,
} from '@modules/billing/services/checkout-route-override.service';
import type {
  CheckoutRoutingContext,
  CheckoutRoutingPreview,
} from '@modules/billing/services/checkout-routing-policy.service';
import type {
  PosChargeResult,
  PosRefundResult,
  PosReconciliationSummary,
  PosTimelineEntry,
} from '@modules/billing/services/internal-pos.service';
import { PaymentRouteFeeScheduleService } from '@modules/billing/services/payment-route-fee-schedule.service';

import {
  AdminPosChargeDto,
  AdminPosCheckoutDto,
  AdminPosRefundDto,
  AdminPosStatusDto,
  AdminRouteFeeScheduleUpsertDto,
  AdminRouteOverrideClearDto,
  AdminRouteOverrideDto,
  AdminRoutePreviewDto,
} from './dto';

@Injectable()
export class AdminPosBillingService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
    private auditService: AuditService,
    @Optional() private billingService?: BillingService,
    @Optional() private routeOverride?: CheckoutRouteOverrideService,
    @Optional() private feeSchedule?: PaymentRouteFeeScheduleService
  ) {}

  async createPosCheckout(
    dto: AdminPosCheckoutDto,
    adminUserId: string
  ): Promise<{
    checkoutUrl: string;
    provider: string;
    userId: string;
    product: string;
    plan: string;
    countryCode: string | null;
    sessionId: string | null;
  }> {
    if (!this.billingService) {
      throw new InternalServerErrorException('Billing service is not available');
    }

    const product = dto.product || 'dhanam';
    const result = await this.billingService.createOperatorCheckout(dto.userId, {
      plan: dto.plan,
      product,
      orgId: dto.orgId,
      countryCode: dto.countryCode?.toUpperCase(),
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
      operatorId: adminUserId,
      source: 'internal_pos',
    });

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.billing_pos_checkout_created',
      resource: 'Billing',
      resourceId: dto.userId,
      metadata: {
        provider: result.provider,
        sessionId: result.sessionId,
        product,
        plan: dto.plan,
        orgId: dto.orgId,
        countryCode: dto.countryCode?.toUpperCase(),
        hasCustomSuccessUrl: Boolean(dto.successUrl),
        hasCustomCancelUrl: Boolean(dto.cancelUrl),
      },
      severity: 'high',
    });

    this.logger.log(
      `Admin ${adminUserId} created POS checkout for user ${dto.userId} (${product}/${dto.plan}) via ${result.provider}`,
      'AdminPosBillingService'
    );

    return {
      checkoutUrl: result.checkoutUrl,
      provider: result.provider,
      userId: dto.userId,
      product,
      plan: dto.plan,
      countryCode: dto.countryCode?.toUpperCase() || null,
      sessionId: result.sessionId || null,
    };
  }

  async getPosCheckoutStatus(
    dto: AdminPosStatusDto,
    adminUserId: string
  ): Promise<OperatorCheckoutStatus> {
    if (!this.billingService) {
      throw new InternalServerErrorException('Billing service is not available');
    }

    const result = await this.billingService.getOperatorCheckoutStatus(dto.sessionId);

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.billing_pos_status_viewed',
      resource: 'Billing',
      resourceId: result.userId || dto.sessionId,
      metadata: {
        provider: result.provider,
        sessionId: dto.sessionId,
        userId: result.userId,
        product: result.product,
        plan: result.plan,
        status: result.status,
        paymentStatus: result.paymentStatus,
      },
      severity: 'medium',
    });

    return result;
  }

  async previewCheckoutRoute(
    dto: AdminRoutePreviewDto,
    adminUserId: string
  ): Promise<CheckoutRoutingPreview> {
    if (!this.billingService) {
      throw new InternalServerErrorException('Billing service is not available');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { countryCode: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const countryCode = (dto.countryCode || user.countryCode || 'US').toUpperCase();
    const preview = await this.billingService.previewCheckoutRouting({
      userId: dto.userId,
      plan: dto.plan,
      product: dto.product,
      countryCode,
      successUrl: `${webUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${webUrl}/billing/cancel`,
      providerOverride: dto.providerOverride,
      overrideKind: dto.providerOverride ? 'preview' : undefined,
      amountMinor: dto.amountMinor,
      paymentMethod: dto.paymentMethod as CheckoutRoutingContext['paymentMethod'],
    });

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.billing_route_preview',
      resource: 'Billing',
      resourceId: dto.userId,
      metadata: {
        plan: dto.plan,
        product: dto.product,
        countryCode,
        provider: preview.provider,
        routeReason: preview.routeReason,
      },
      severity: 'low',
    });

    return preview;
  }

  async createPosCharge(dto: AdminPosChargeDto, adminUserId: string): Promise<PosChargeResult> {
    if (!this.billingService) {
      throw new InternalServerErrorException('Billing service is not available');
    }

    const result = await this.billingService.createPosCharge({
      userId: dto.userId,
      amountMinor: dto.amountMinor,
      currency: dto.currency,
      description: dto.description,
      paymentMethod: dto.paymentMethod,
      correlationId: dto.correlationId,
      countryCode: dto.countryCode?.toUpperCase(),
      operatorId: adminUserId,
      provider: dto.provider,
    });

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.billing_pos_charge_created',
      resource: 'Billing',
      resourceId: dto.userId,
      metadata: {
        correlationId: result.correlationId,
        paymentIntentId: result.paymentIntentId,
        provider: result.provider,
        amountMinor: result.amountMinor,
        currency: result.currency,
      },
      severity: 'high',
    });

    return result;
  }

  async createPosRefund(dto: AdminPosRefundDto, adminUserId: string): Promise<PosRefundResult> {
    if (!this.billingService) {
      throw new InternalServerErrorException('Billing service is not available');
    }

    const result = await this.billingService.createPosRefund({
      paymentIntentId: dto.paymentIntentId,
      amountMinor: dto.amountMinor,
      reason: dto.reason,
      correlationId: dto.correlationId,
      operatorId: adminUserId,
    });

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.billing_pos_refund_created',
      resource: 'Billing',
      resourceId: dto.paymentIntentId,
      metadata: {
        correlationId: result.correlationId,
        refundId: result.refundId,
        provider: result.provider,
        amountMinor: result.amountMinor,
        currency: result.currency,
      },
      severity: 'high',
    });

    return result;
  }

  async getPosTimeline(correlationId: string, adminUserId: string): Promise<PosTimelineEntry[]> {
    if (!this.billingService) {
      throw new InternalServerErrorException('Billing service is not available');
    }

    const timeline = await this.billingService.getPosTimeline(correlationId);

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.billing_pos_timeline_viewed',
      resource: 'Billing',
      resourceId: correlationId,
      metadata: { eventCount: timeline.length },
      severity: 'low',
    });

    return timeline;
  }

  async getBillingReconciliation(
    adminUserId: string,
    limit = 25
  ): Promise<PosReconciliationSummary> {
    if (!this.billingService) {
      throw new InternalServerErrorException('Billing service is not available');
    }

    const summary = await this.billingService.getBillingReconciliationSummary(limit);

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.billing_reconciliation_viewed',
      resource: 'Billing',
      metadata: { flaggedCount: summary.flaggedCount },
      severity: 'low',
    });

    return summary;
  }

  async setCheckoutRouteOverride(
    dto: AdminRouteOverrideDto,
    adminUserId: string
  ): Promise<StoredRouteOverride> {
    if (!this.routeOverride) {
      throw new InternalServerErrorException('Route override service is not available');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const record = await this.routeOverride.setOverride({
      targetUserId: dto.userId,
      product: dto.product || 'dhanam',
      provider: dto.provider,
      countryCode: dto.countryCode?.toUpperCase(),
      reason: dto.reason,
      operatorId: adminUserId,
      ttlHours: dto.ttlHours,
    });

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.billing_route_override_set',
      resource: 'Billing',
      resourceId: dto.userId,
      metadata: record,
      severity: 'high',
    });

    return record;
  }

  async clearCheckoutRouteOverride(
    dto: AdminRouteOverrideClearDto,
    adminUserId: string
  ): Promise<{ cleared: true }> {
    if (!this.routeOverride) {
      throw new InternalServerErrorException('Route override service is not available');
    }

    await this.routeOverride.clearOverride(
      dto.userId,
      dto.product || 'dhanam',
      adminUserId,
      dto.reason
    );

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.billing_route_override_cleared',
      resource: 'Billing',
      resourceId: dto.userId,
      metadata: { product: dto.product || 'dhanam', reason: dto.reason },
      severity: 'medium',
    });

    return { cleared: true };
  }

  async getRouteFeeSchedule(adminUserId: string) {
    if (!this.feeSchedule) {
      throw new InternalServerErrorException('Fee schedule service is not available');
    }

    const schedule = this.feeSchedule.getSchedule();

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.billing_route_fee_schedule_viewed',
      resource: 'Billing',
      metadata: {
        version: schedule.version,
        source: schedule.source,
        entryCount: schedule.entries.length,
      },
      severity: 'low',
    });

    return schedule;
  }

  async upsertRouteFeeSchedule(
    dto: AdminRouteFeeScheduleUpsertDto,
    adminUserId: string
  ): Promise<{ version: string; entryCount: number; source: string }> {
    if (!this.feeSchedule) {
      throw new InternalServerErrorException('Fee schedule service is not available');
    }

    const entries = parseFeeScheduleEntries(dto.entries);
    const result = await this.feeSchedule.upsertPlatformOverride({
      version: dto.version,
      entries,
      updatedBy: adminUserId,
    });

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.billing_route_fee_schedule_updated',
      resource: 'Billing',
      metadata: result,
      severity: 'high',
    });

    return {
      ...result,
      source: 'platform_config',
    };
  }

  async clearRouteFeeSchedule(adminUserId: string): Promise<{ cleared: true; version: string }> {
    if (!this.feeSchedule) {
      throw new InternalServerErrorException('Fee schedule service is not available');
    }

    await this.feeSchedule.clearPlatformOverride(adminUserId);
    const schedule = this.feeSchedule.getSchedule();

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.billing_route_fee_schedule_cleared',
      resource: 'Billing',
      metadata: { version: schedule.version, source: schedule.source },
      severity: 'medium',
    });

    return { cleared: true, version: schedule.version };
  }
}
