import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';

import { SubscriptionStatus } from '@db';

import { PrismaService } from '../../core/prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';

import { CreateSubscriptionDto, UpdateSubscriptionDto, CancelSubscriptionDto } from './dto';
import { SubscriptionDetectorService } from './subscription-detector.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private prisma: PrismaService,
    private spacesService: SpacesService,
    private detectorService: SubscriptionDetectorService
  ) {}

  /**
   * Get all subscriptions for a space
   */
  async findAll(
    spaceId: string,
    userId: string,
    options?: { status?: SubscriptionStatus; category?: string }
  ) {
    await this.spacesService.verifyUserAccess(userId, spaceId, 'viewer');

    const where: Record<string, unknown> = { spaceId };

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.category) {
      where.category = options.category;
    }

    const subscriptions = await this.prisma.subscription.findMany({
      where,
      orderBy: { nextBillingDate: 'asc' },
      include: {
        recurringPattern: {
          select: {
            id: true,
            merchantName: true,
            occurrenceCount: true,
            lastOccurrence: true,
          },
        },
      },
    });

    return subscriptions.map((s) => this.transformToResponse(s));
  }

  /**
   * Get a single subscription
   */
  async findOne(spaceId: string, userId: string, id: string) {
    await this.spacesService.verifyUserAccess(userId, spaceId, 'viewer');

    const subscription = await this.prisma.subscription.findFirst({
      where: { id, spaceId },
      include: {
        recurringPattern: {
          include: {
            transactions: {
              take: 10,
              orderBy: { date: 'desc' },
              select: {
                id: true,
                date: true,
                amount: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return this.transformToResponse(subscription);
  }

  /**
   * Create a new subscription manually
   */
  async create(spaceId: string, userId: string, dto: CreateSubscriptionDto) {
    await this.spacesService.verifyUserAccess(userId, spaceId, 'member');

    // Check for existing subscription with same service name
    const existing = await this.prisma.subscription.findFirst({
      where: {
        spaceId,
        serviceName: dto.serviceName,
        status: { notIn: ['cancelled', 'expired'] },
      },
    });

    if (existing) {
      throw new ConflictException('An active subscription for this service already exists');
    }

    // Validate recurring pattern if provided
    if (dto.recurringId) {
      const recurring = await this.prisma.recurringTransaction.findFirst({
        where: { id: dto.recurringId, spaceId },
      });

      if (!recurring) {
        throw new NotFoundException('Recurring pattern not found');
      }

      // Check if recurring pattern already has a subscription
      const existingFromRecurring = await this.prisma.subscription.findFirst({
        where: { recurringId: dto.recurringId },
      });

      if (existingFromRecurring) {
        throw new ConflictException('This recurring pattern is already linked to a subscription');
      }
    }

    const annualCost = this.detectorService.calculateAnnualCost(dto.amount, dto.billingCycle);

    const subscription = await this.prisma.subscription.create({
      data: {
        spaceId,
        serviceName: dto.serviceName,
        serviceUrl: dto.serviceUrl,
        serviceIcon: dto.serviceIcon,
        category: dto.category ?? 'other',
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency,
        billingCycle: dto.billingCycle,
        nextBillingDate: dto.nextBillingDate ? new Date(dto.nextBillingDate) : null,
        status: dto.status ?? 'active',
        startDate: new Date(dto.startDate),
        trialEndDate: dto.trialEndDate ? new Date(dto.trialEndDate) : null,
        annualCost,
        recurringId: dto.recurringId,
        alertBeforeDays: dto.alertBeforeDays ?? 3,
        alertEnabled: dto.alertEnabled ?? true,
        notes: dto.notes,
      },
    });

    this.logger.log(`Created subscription: ${subscription.id} for space: ${spaceId}`);
    return this.transformToResponse(subscription);
  }

  /**
   * Update a subscription
   */
  async update(spaceId: string, userId: string, id: string, dto: UpdateSubscriptionDto) {
    await this.spacesService.verifyUserAccess(userId, spaceId, 'member');

    const existing = await this.prisma.subscription.findFirst({
      where: { id, spaceId },
    });

    if (!existing) {
      throw new NotFoundException('Subscription not found');
    }

    // Recalculate annual cost if amount or billing cycle changed
    const amount = dto.amount ?? Number(existing.amount);
    const billingCycle = dto.billingCycle ?? existing.billingCycle;
    const annualCost = this.detectorService.calculateAnnualCost(amount, billingCycle);

    // Generate savings recommendation if usage frequency is set
    const usageFrequency = dto.usageFrequency ?? existing.usageFrequency;
    const savingsRecommendation = this.detectorService.generateSavingsRecommendation(
      dto.serviceName ?? existing.serviceName,
      usageFrequency,
      annualCost
    );

    const subscription = await this.prisma.subscription.update({
      where: { id },
      data: {
        ...(dto.serviceName && { serviceName: dto.serviceName }),
        ...(dto.serviceUrl !== undefined && { serviceUrl: dto.serviceUrl }),
        ...(dto.serviceIcon !== undefined && { serviceIcon: dto.serviceIcon }),
        ...(dto.category && { category: dto.category }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.billingCycle && { billingCycle: dto.billingCycle }),
        ...(dto.nextBillingDate !== undefined && {
          nextBillingDate: dto.nextBillingDate ? new Date(dto.nextBillingDate) : null,
        }),
        ...(dto.status && { status: dto.status }),
        ...(dto.trialEndDate !== undefined && {
          trialEndDate: dto.trialEndDate ? new Date(dto.trialEndDate) : null,
        }),
        ...(dto.alertBeforeDays !== undefined && { alertBeforeDays: dto.alertBeforeDays }),
        ...(dto.alertEnabled !== undefined && { alertEnabled: dto.alertEnabled }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.usageFrequency !== undefined && { usageFrequency: dto.usageFrequency }),
        annualCost,
        savingsRecommendation,
      },
    });

    return this.transformToResponse(subscription);
  }

  /**
   * Cancel a subscription
   */
  async cancel(spaceId: string, userId: string, id: string, dto: CancelSubscriptionDto) {
    await this.spacesService.verifyUserAccess(userId, spaceId, 'member');

    const existing = await this.prisma.subscription.findFirst({
      where: { id, spaceId },
    });

    if (!existing) {
      throw new NotFoundException('Subscription not found');
    }

    if (existing.status === 'cancelled') {
      throw new ConflictException('Subscription is already cancelled');
    }

    const subscription = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: dto.reason,
        endDate: dto.endDate ? new Date(dto.endDate) : new Date(),
      },
    });

    this.logger.log(`Cancelled subscription: ${id} for space: ${spaceId}`);
    return this.transformToResponse(subscription);
  }

  /**
   * Pause a subscription
   */
  async pause(spaceId: string, userId: string, id: string) {
    await this.spacesService.verifyUserAccess(userId, spaceId, 'member');

    const existing = await this.prisma.subscription.findFirst({
      where: { id, spaceId },
    });

    if (!existing) {
      throw new NotFoundException('Subscription not found');
    }

    if (existing.status !== 'active') {
      throw new ConflictException('Can only pause active subscriptions');
    }

    const subscription = await this.prisma.subscription.update({
      where: { id },
      data: { status: 'paused' },
    });

    return this.transformToResponse(subscription);
  }

  /**
   * Resume a paused subscription
   */
  async resume(spaceId: string, userId: string, id: string) {
    await this.spacesService.verifyUserAccess(userId, spaceId, 'member');

    const existing = await this.prisma.subscription.findFirst({
      where: { id, spaceId },
    });

    if (!existing) {
      throw new NotFoundException('Subscription not found');
    }

    if (existing.status !== 'paused') {
      throw new ConflictException('Can only resume paused subscriptions');
    }

    const subscription = await this.prisma.subscription.update({
      where: { id },
      data: { status: 'active' },
    });

    return this.transformToResponse(subscription);
  }

  /**
   * Delete a subscription
   */
  async remove(spaceId: string, userId: string, id: string) {
    await this.spacesService.verifyUserAccess(userId, spaceId, 'member');

    const existing = await this.prisma.subscription.findFirst({
      where: { id, spaceId },
    });

    if (!existing) {
      throw new NotFoundException('Subscription not found');
    }

    await this.prisma.subscription.delete({
      where: { id },
    });

    this.logger.log(`Deleted subscription: ${id} for space: ${spaceId}`);
  }

  /**
   * Detect and create subscriptions from recurring patterns
   */
  async detectAndCreate(spaceId: string, userId: string) {
    await this.spacesService.verifyUserAccess(userId, spaceId, 'member');

    const detected = await this.detectorService.detectSubscriptions(spaceId);
    const created: Array<ReturnType<SubscriptionsService['transformToResponse']>> = [];

    for (const sub of detected) {
      try {
        const subscription = await this.prisma.subscription.create({
          data: {
            spaceId,
            serviceName: sub.serviceName,
            serviceUrl: sub.serviceUrl,
            serviceIcon: sub.serviceIcon,
            category: sub.category,
            amount: sub.amount,
            currency: sub.currency,
            billingCycle: sub.billingCycle,
            nextBillingDate: sub.nextBillingDate,
            lastBillingDate: sub.lastBillingDate,
            status: 'active',
            startDate: sub.lastBillingDate || new Date(),
            annualCost: this.detectorService.calculateAnnualCost(sub.amount, sub.billingCycle),
            recurringId: sub.recurringId,
          },
        });

        created.push(this.transformToResponse(subscription));
      } catch (error) {
        // Skip duplicates silently
        if ((error as { code?: string }).code === 'P2002') {
          continue;
        }
        throw error;
      }
    }

    this.logger.log(`Created ${created.length} subscriptions from detection for space: ${spaceId}`);
    return { detected: created, total: detected.length };
  }

  /**
   * Get subscription summary/dashboard data
   */
  async getSummary(spaceId: string, userId: string) {
    await this.spacesService.verifyUserAccess(userId, spaceId, 'viewer');

    const subscriptions = await this.prisma.subscription.findMany({
      where: { spaceId, status: { in: ['active', 'trial'] } },
    });

    // Calculate totals by category
    const byCategory: Record<string, { count: number; monthlyTotal: number }> = {};
    let totalMonthly = 0;
    let totalAnnual = 0;

    for (const sub of subscriptions) {
      const annualCost = Number(sub.annualCost);
      const monthlyEquivalent = annualCost / 12;

      totalMonthly += monthlyEquivalent;
      totalAnnual += annualCost;

      const category = sub.category;
      if (!byCategory[category]) {
        byCategory[category] = { count: 0, monthlyTotal: 0 };
      }
      byCategory[category].count++;
      byCategory[category].monthlyTotal += monthlyEquivalent;
    }

    // Get upcoming billing this month
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const upcoming = await this.prisma.subscription.findMany({
      where: {
        spaceId,
        status: 'active',
        nextBillingDate: { gte: now, lte: endOfMonth },
      },
      orderBy: { nextBillingDate: 'asc' },
      take: 10,
    });

    // Get subscriptions with savings recommendations
    const withSavings = await this.prisma.subscription.findMany({
      where: {
        spaceId,
        status: 'active',
        savingsRecommendation: { not: null },
      },
      take: 5,
    });

    // Count by status
    const statusCounts = await this.prisma.subscription.groupBy({
      by: ['status'],
      where: { spaceId },
      _count: { status: true },
    });

    const statusMap: Record<string, number> = {};
    for (const s of statusCounts) {
      statusMap[s.status] = s._count.status;
    }

    return {
      totalMonthly: Math.round(totalMonthly * 100) / 100,
      totalAnnual: Math.round(totalAnnual * 100) / 100,
      activeCount: statusMap['active'] || 0,
      trialCount: statusMap['trial'] || 0,
      pausedCount: statusMap['paused'] || 0,
      cancelledCount: statusMap['cancelled'] || 0,
      byCategory: Object.entries(byCategory).map(([category, data]) => ({
        category,
        count: data.count,
        monthlyTotal: Math.round(data.monthlyTotal * 100) / 100,
      })),
      upcomingThisMonth: upcoming.map((s) => ({
        id: s.id,
        serviceName: s.serviceName,
        amount: Number(s.amount),
        currency: s.currency,
        billingDate: s.nextBillingDate?.toISOString(),
        daysUntil: s.nextBillingDate
          ? Math.ceil((s.nextBillingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      })),
      savingsOpportunities: withSavings.map((s) => ({
        id: s.id,
        serviceName: s.serviceName,
        recommendation: s.savingsRecommendation,
        annualCost: Number(s.annualCost),
      })),
    };
  }

  private transformToResponse(subscription: Record<string, unknown>) {
    return {
      id: subscription.id,
      spaceId: subscription.spaceId,
      serviceName: subscription.serviceName,
      serviceUrl: subscription.serviceUrl,
      serviceIcon: subscription.serviceIcon,
      category: subscription.category,
      description: subscription.description,
      amount: Number(subscription.amount),
      currency: subscription.currency,
      billingCycle: subscription.billingCycle,
      nextBillingDate: (subscription.nextBillingDate as Date)?.toISOString() || null,
      lastBillingDate: (subscription.lastBillingDate as Date)?.toISOString() || null,
      status: subscription.status,
      startDate: (subscription.startDate as Date)?.toISOString(),
      endDate: (subscription.endDate as Date)?.toISOString() || null,
      trialEndDate: (subscription.trialEndDate as Date)?.toISOString() || null,
      cancelledAt: (subscription.cancelledAt as Date)?.toISOString() || null,
      cancellationReason: subscription.cancellationReason,
      annualCost: Number(subscription.annualCost),
      usageFrequency: subscription.usageFrequency,
      savingsRecommendation: subscription.savingsRecommendation,
      alternativeServices: subscription.alternativeServices,
      alertBeforeDays: subscription.alertBeforeDays,
      alertEnabled: subscription.alertEnabled,
      notes: subscription.notes,
      recurringId: subscription.recurringId,
      createdAt: (subscription.createdAt as Date)?.toISOString(),
      updatedAt: (subscription.updatedAt as Date)?.toISOString(),
      recurringPattern: subscription.recurringPattern || null,
    };
  }
}
