import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import { AuditService } from '@core/audit/audit.service';
import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { RedisService } from '@core/redis/redis.service';
import { Prisma } from '@db';
import { BillingService } from '@modules/billing/billing.service';
import { FailedQueueJob, QueueService } from '@modules/jobs/queue.service';

import {
  AdminPosCheckoutDto,
  CacheFlushDto,
  PaginatedResponseDto,
  SpaceSearchDto,
  UserActionDto,
} from './dto';

@Injectable()
export class AdminOpsService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
    private redis: RedisService,
    private auditService: AuditService,
    private queueService: QueueService,
    @Optional() private billingService?: BillingService
  ) {}

  async getSystemHealth(adminUserId: string): Promise<{
    database: { status: string; connections: number };
    redis: { status: string; connected: boolean };
    queues: { status: string };
    providers: { status: string };
    uptime: number;
  }> {
    const [dbConnections, redisConnected, queueStatus] = await Promise.all([
      this.getDatabaseConnections(),
      this.redis.ping(),
      this.getQueueStatus(),
    ]);

    this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.view_system_health',
      resource: 'System',
      severity: 'low',
    });

    return {
      database: {
        status: dbConnections > 0 ? 'healthy' : 'degraded',
        connections: dbConnections,
      },
      redis: {
        status: redisConnected ? 'healthy' : 'down',
        connected: redisConnected,
      },
      queues: {
        status: queueStatus,
      },
      providers: {
        status: 'healthy',
      },
      uptime: process.uptime(),
    };
  }

  async getMetrics(adminUserId: string): Promise<{
    dau: number;
    wau: number;
    mau: number;
    queueStats: { status: string };
    resourceUsage: { memoryMB: number; uptimeSeconds: number };
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [dau, wau, mau, queueStatus] = await Promise.all([
      this.prisma.user.count({ where: { lastLoginAt: { gte: oneDayAgo } } }),
      this.prisma.user.count({ where: { lastLoginAt: { gte: sevenDaysAgo } } }),
      this.prisma.user.count({ where: { lastLoginAt: { gte: thirtyDaysAgo } } }),
      this.getQueueStatus(),
    ]);

    const memUsage = process.memoryUsage();

    this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.view_metrics',
      resource: 'System',
      severity: 'low',
    });

    return {
      dau,
      wau,
      mau,
      queueStats: { status: queueStatus },
      resourceUsage: {
        memoryMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        uptimeSeconds: Math.round(process.uptime()),
      },
    };
  }

  async flushCache(dto: CacheFlushDto, adminUserId: string): Promise<{ flushedCount: number }> {
    if (!dto.confirm) {
      throw new NotFoundException('Cache flush not confirmed');
    }

    const client = this.redis.getClient();
    const keys = await client.keys(dto.pattern);
    let flushedCount = 0;

    if (keys.length > 0) {
      flushedCount = await client.del(...keys);
    }

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.cache_flush',
      resource: 'Cache',
      metadata: { pattern: dto.pattern, flushedCount },
      severity: 'high',
    });

    this.logger.log(
      `Cache flush by admin ${adminUserId}: pattern="${dto.pattern}", flushed=${flushedCount}`,
      'AdminOpsService'
    );

    return { flushedCount };
  }

  async getQueueStats(adminUserId: string): Promise<{
    queues: Array<{
      name: string;
      status: string;
      recentJobs: number;
      failedJobs: number;
    }>;
  }> {
    const stats = await this.queueService.getAllQueueStats();
    const queues = stats.map((queue) => {
      const liveJobs = queue.waiting + queue.active + queue.delayed;
      const recentJobs = liveJobs + queue.completed;

      return {
        name: queue.name,
        status: queue.failed > 0 ? 'error' : liveJobs > 0 ? 'active' : 'idle',
        recentJobs,
        failedJobs: queue.failed,
      };
    });

    this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.view_queue_stats',
      resource: 'Queue',
      severity: 'low',
    });

    return { queues };
  }

  async retryFailedJobs(queueName: string, adminUserId: string): Promise<{ retriedCount: number }> {
    const retriedCount = await this.queueService.retryFailedJobs(queueName);

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.queue_retry_failed',
      resource: 'Queue',
      resourceId: queueName,
      metadata: { retriedCount },
      severity: 'high',
    });

    this.logger.log(
      `Retried ${retriedCount} failed jobs in queue "${queueName}" by admin ${adminUserId}`,
      'AdminOpsService'
    );

    return { retriedCount };
  }

  async getFailedJobs(
    queueName: string,
    limit: number | undefined,
    adminUserId: string
  ): Promise<{ jobs: FailedQueueJob[] }> {
    const normalizedLimit =
      typeof limit === 'number' && Number.isFinite(limit)
        ? Math.min(Math.max(Math.trunc(limit), 1), 100)
        : 25;
    const jobs = await this.queueService.getFailedJobs(queueName, normalizedLimit);

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.queue_view_failed',
      resource: 'Queue',
      resourceId: queueName,
      metadata: { limit: normalizedLimit, returnedCount: jobs.length },
      severity: 'medium',
    });

    return { jobs };
  }

  async clearFailedJobs(
    queueName: string,
    confirm: boolean,
    adminUserId: string
  ): Promise<{ clearedCount: number }> {
    if (confirm !== true) {
      throw new BadRequestException('Failed job cleanup must be explicitly confirmed');
    }

    const clearedCount = await this.queueService.clearFailedJobs(queueName);

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.queue_clear_failed',
      resource: 'Queue',
      resourceId: queueName,
      metadata: { clearedCount },
      severity: 'high',
    });

    this.logger.log(
      `Cleared ${clearedCount} failed jobs in queue "${queueName}" by admin ${adminUserId}`,
      'AdminOpsService'
    );

    return { clearedCount };
  }

  async clearQueue(
    queueName: string,
    confirm: boolean,
    adminUserId: string
  ): Promise<{ clearedCount: number }> {
    if (confirm !== true) {
      throw new BadRequestException('Queue clear must be explicitly confirmed');
    }

    const clearedCount = await this.queueService.clearQueue(queueName);

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.queue_clear',
      resource: 'Queue',
      resourceId: queueName,
      metadata: { clearedCount },
      severity: 'high',
    });

    this.logger.log(
      `Cleared ${clearedCount} jobs from queue "${queueName}" by admin ${adminUserId}`,
      'AdminOpsService'
    );

    return { clearedCount };
  }

  async searchSpaces(dto: SpaceSearchDto): Promise<PaginatedResponseDto<any>> {
    const where: Prisma.SpaceWhereInput = {};

    if (dto.query) {
      where.OR = [
        { name: { contains: dto.query, mode: 'insensitive' } },
        {
          userSpaces: {
            some: {
              user: {
                email: { contains: dto.query, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }

    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const [spaces, total] = await Promise.all([
      this.prisma.space.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          userSpaces: {
            include: {
              user: {
                select: { id: true, email: true, name: true },
              },
            },
          },
          _count: {
            select: { accounts: true, budgets: true },
          },
        },
      }),
      this.prisma.space.count({ where }),
    ]);

    const data = spaces.map((space) => ({
      id: space.id,
      name: space.name,
      type: space.type,
      currency: space.currency,
      createdAt: space.createdAt,
      members: space.userSpaces.map((us) => ({
        id: us.user.id,
        email: us.user.email,
        name: us.user.name,
        role: us.role,
      })),
      accountCount: space._count.accounts,
      budgetCount: space._count.budgets,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deactivateUser(
    userId: string,
    dto: UserActionDto,
    adminUserId: string
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      }),
      this.prisma.session.deleteMany({
        where: { userId },
      }),
    ]);

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.deactivate_user',
      resource: 'User',
      resourceId: userId,
      metadata: { reason: dto.reason },
      severity: 'high',
    });

    this.logger.log(
      `User ${userId} deactivated by admin ${adminUserId}: ${dto.reason}`,
      'AdminOpsService'
    );

    return { success: true };
  }

  async resetUserTotp(
    userId: string,
    dto: UserActionDto,
    adminUserId: string
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpSecret: null,
      },
    });

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.reset_2fa',
      resource: 'User',
      resourceId: userId,
      metadata: { reason: dto.reason },
      severity: 'high',
    });

    this.logger.log(
      `2FA reset for user ${userId} by admin ${adminUserId}: ${dto.reason}`,
      'AdminOpsService'
    );

    return { success: true };
  }

  async forceLogout(userId: string, adminUserId: string): Promise<{ invalidatedCount: number }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const result = await this.prisma.session.deleteMany({
      where: { userId },
    });

    const client = this.redis.getClient();
    const sessionKeys = await client.keys(`session:${userId}:*`);
    if (sessionKeys.length > 0) {
      await client.del(...sessionKeys);
    }

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.force_logout',
      resource: 'User',
      resourceId: userId,
      metadata: { invalidatedCount: result.count },
      severity: 'high',
    });

    return { invalidatedCount: result.count };
  }

  async getBillingEvents(page: number = 1, limit: number = 20): Promise<PaginatedResponseDto<any>> {
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      action: { startsWith: 'billing.' },
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

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
      'AdminOpsService'
    );

    return {
      checkoutUrl: result.checkoutUrl,
      provider: result.provider,
      userId: dto.userId,
      product,
      plan: dto.plan,
      countryCode: dto.countryCode?.toUpperCase() || null,
    };
  }

  async gdprExport(
    userId: string,
    adminUserId: string
  ): Promise<{
    user: {
      id: string;
      email: string;
      name: string | null;
      locale: string;
      timezone: string;
      createdAt: Date;
      connections: Array<{
        id: string;
        provider: string;
        providerUserId: string | null;
        createdAt: Date;
      }>;
    };
    spaces: Array<{ id: string; name: string; type: string; role: string }>;
    transactions: number;
    auditLogs: number;
    exportedAt: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userSpaces: {
          include: { space: true },
        },
        providerConnections: {
          select: {
            id: true,
            provider: true,
            providerUserId: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const spaceIds = user.userSpaces.map((us) => us.spaceId);

    const [transactionCount, auditLogCount] = await Promise.all([
      this.prisma.transaction.count({
        where: { account: { spaceId: { in: spaceIds } } },
      }),
      this.prisma.auditLog.count({
        where: { userId },
      }),
    ]);

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.gdpr_export',
      resource: 'User',
      resourceId: userId,
      severity: 'high',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        locale: user.locale,
        timezone: user.timezone,
        createdAt: user.createdAt,
        connections: user.providerConnections,
      },
      spaces: user.userSpaces.map((us) => ({
        id: us.space.id,
        name: us.space.name,
        type: us.space.type,
        role: us.role,
      })),
      transactions: transactionCount,
      auditLogs: auditLogCount,
      exportedAt: new Date().toISOString(),
    };
  }

  async gdprDelete(
    userId: string,
    adminUserId: string
  ): Promise<{ queued: boolean; jobId: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    const jobId = `gdpr-delete-${userId}-${Date.now()}`;

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.gdpr_delete_requested',
      resource: 'User',
      resourceId: userId,
      metadata: { jobId },
      severity: 'high',
    });

    this.logger.log(
      `GDPR deletion requested for user ${userId} by admin ${adminUserId}, job=${jobId}`,
      'AdminOpsService'
    );

    return { queued: true, jobId };
  }

  async executeRetention(adminUserId: string): Promise<{ executed: boolean; jobId: string }> {
    const jobId = `retention-${Date.now()}`;

    await this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.retention_execute',
      resource: 'System',
      metadata: { jobId },
      severity: 'high',
    });

    this.logger.log(
      `Retention policy execution requested by admin ${adminUserId}, job=${jobId}`,
      'AdminOpsService'
    );

    return { executed: true, jobId };
  }

  async getDeploymentStatus(): Promise<{
    version: string;
    commitSha: string;
    buildTime: string;
    nodeVersion: string;
    environment: string;
  }> {
    return {
      version: process.env.APP_VERSION || '0.0.0',
      commitSha: process.env.COMMIT_SHA || 'unknown',
      buildTime: process.env.BUILD_TIME || new Date().toISOString(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
    };
  }

  async getProviderHealth(adminUserId: string): Promise<{
    providers: Array<{
      name: string;
      status: string;
      accountCount: number;
      lastSyncAt: string | null;
    }>;
  }> {
    const providerStats = await this.prisma.account.groupBy({
      by: ['provider'],
      _count: true,
      _max: { lastSyncedAt: true },
    });

    this.auditService.logEvent({
      userId: adminUserId,
      action: 'admin.view_provider_health',
      resource: 'Provider',
      severity: 'low',
    });

    const providers = providerStats.map((p) => ({
      name: p.provider,
      status: 'healthy',
      accountCount: p._count,
      lastSyncAt: p._max?.lastSyncedAt?.toISOString() || null,
    }));

    return { providers };
  }

  private async getDatabaseConnections(): Promise<number> {
    try {
      const result = (await this.prisma.$queryRaw`
        SELECT count(*) as connection_count
        FROM pg_stat_activity
        WHERE datname = current_database()
      `) as any[];
      return parseInt(result[0]?.connection_count || '0');
    } catch (error) {
      this.logger.error(
        'Failed to get database connections',
        error instanceof Error ? error.message : String(error)
      );
      return 0;
    }
  }

  private async getQueueStatus(): Promise<'active' | 'error' | 'idle'> {
    try {
      const failedJobs = await this.prisma.auditLog.count({
        where: {
          action: { startsWith: 'job.failed' },
          timestamp: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
      });

      if (failedJobs > 0) {
        return 'error';
      }

      const activeJobs = await this.prisma.auditLog.count({
        where: {
          action: { startsWith: 'job.started' },
          timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
      });

      return activeJobs > 0 ? 'active' : 'idle';
    } catch (error) {
      this.logger.error(
        'Failed to get queue status',
        error instanceof Error ? error.message : String(error)
      );
      return 'error';
    }
  }
}
