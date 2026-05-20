import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '@core/prisma/prisma.service';

import { CategorizeTransactionsProcessor } from './processors/categorize-transactions.processor';
import { ESGUpdateProcessor } from './processors/esg-update.processor';
import { SyncTransactionsProcessor } from './processors/sync-transactions.processor';
import { ValuationSnapshotProcessor } from './processors/valuation-snapshot.processor';
import { QueueService } from './queue.service';

@Injectable()
export class EnhancedJobsService implements OnModuleInit {
  private readonly logger = new Logger(EnhancedJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly syncProcessor: SyncTransactionsProcessor,
    private readonly categorizeProcessor: CategorizeTransactionsProcessor,
    private readonly esgProcessor: ESGUpdateProcessor,
    private readonly snapshotProcessor: ValuationSnapshotProcessor
  ) {}

  async onModuleInit() {
    this.registerWorkers();
    await this.scheduleRecurringJobs();
    this.logger.log('Enhanced jobs service initialized');
  }

  private registerWorkers() {
    // Register sync transactions worker
    this.queueService.registerWorker('sync-transactions', async (job) => {
      return this.syncProcessor.process(job);
    });

    // Register categorization worker
    this.queueService.registerWorker('categorize-transactions', async (job) => {
      return this.categorizeProcessor.process(job);
    });

    // Register ESG update worker
    this.queueService.registerWorker('esg-updates', async (job) => {
      return this.esgProcessor.process(job);
    });

    // Register valuation snapshot worker
    this.queueService.registerWorker('valuation-snapshots', async (job) => {
      return this.snapshotProcessor.process(job);
    });

    this.logger.log('All job workers registered');
  }

  private async scheduleRecurringJobs() {
    try {
      await Promise.all([
        this.queueService.removeRecurringJob(
          'categorize-transactions',
          'hourly-categorization',
          '0 * * * *'
        ),
        this.queueService.removeRecurringJob(
          'sync-transactions',
          'crypto-portfolio-sync',
          '0 */4 * * *'
        ),
        this.queueService.removeRecurringJob('valuation-snapshots', 'daily-snapshots', '0 3 * * *'),
        this.queueService.removeRecurringJob('esg-updates', 'esg-refresh', '0 6,18 * * *'),
      ]);

      this.logger.log(
        'Obsolete generic recurring jobs removed; Nest cron dispatchers enqueue granular jobs'
      );
    } catch (error) {
      this.logger.error('Failed to clean up obsolete recurring jobs:', error);
    }
  }

  // Manual job triggers
  async triggerUserSync(userId: string, provider?: string): Promise<void> {
    const connections = await this.prisma.providerConnection.findMany({
      where: {
        userId,
        ...(provider && { provider: provider as any }),
      },
    });

    for (const connection of connections) {
      await this.queueService.addSyncTransactionsJob(
        {
          provider: connection.provider as any,
          userId,
          connectionId: connection.id,
          fullSync: false,
        },
        80
      ); // High priority for manual triggers
    }

    this.logger.log(`Triggered sync jobs for user ${userId}, ${connections.length} connections`);
  }

  async triggerSpaceCategorization(spaceId: string): Promise<void> {
    await this.queueService.addCategorizeTransactionsJob(
      {
        spaceId,
      },
      70
    );

    this.logger.log(`Triggered categorization job for space ${spaceId}`);
  }

  async triggerESGRefresh(symbols: string[], forceRefresh = false): Promise<void> {
    await this.queueService.addESGUpdateJob(
      {
        symbols,
        forceRefresh,
      },
      forceRefresh ? 90 : 30
    );

    this.logger.log(`Triggered ESG refresh for ${symbols.length} symbols`);
  }

  async triggerValuationSnapshot(spaceId: string, date?: string): Promise<void> {
    await this.queueService.addValuationSnapshotJob(
      {
        spaceId,
        date,
      },
      60
    );

    this.logger.log(`Triggered valuation snapshot for space ${spaceId}`);
  }

  // Batch operations
  async triggerBulkSync(userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      await this.triggerUserSync(userId);
    }
    this.logger.log(`Triggered bulk sync for ${userIds.length} users`);
  }

  async triggerBulkCategorization(spaceIds: string[]): Promise<void> {
    for (const spaceId of spaceIds) {
      await this.triggerSpaceCategorization(spaceId);
    }
    this.logger.log(`Triggered bulk categorization for ${spaceIds.length} spaces`);
  }

  // Legacy cron jobs (kept for backward compatibility)
  @Cron(CronExpression.EVERY_HOUR)
  async categorizeNewTransactions(): Promise<void> {
    this.logger.log('Cron: Starting automatic transaction categorization');
    const bucket = this.getUtcHourBucket();

    const spaces = await this.prisma.space.findMany({
      select: { id: true },
    });

    // Add categorization jobs for all spaces
    for (const space of spaces) {
      await this.queueService.addCategorizeTransactionsJob(
        {
          spaceId: space.id,
        },
        30,
        `cron-categorize-${space.id}-${bucket}`
      );
    }

    this.logger.log(`Cron: Queued categorization jobs for ${spaces.length} spaces`);
  }

  @Cron('0 */4 * * *')
  async syncCryptoPortfolios(): Promise<void> {
    this.logger.log('Cron: Starting scheduled crypto portfolio sync');
    const bucket = this.getUtcFourHourBucket();

    const connections = await this.prisma.providerConnection.findMany({
      where: { provider: 'bitso' },
      select: { userId: true, id: true },
      distinct: ['userId'],
    });

    // Add sync jobs for all crypto connections
    for (const connection of connections) {
      await this.queueService.addSyncTransactionsJob(
        {
          provider: 'bitso',
          userId: connection.userId,
          connectionId: connection.id,
          fullSync: false,
        },
        50,
        0,
        `cron-sync-bitso-${connection.userId}-${connection.id}-${bucket}`
      );
    }

    this.logger.log(`Cron: Queued crypto sync jobs for ${connections.length} users`);
  }

  @Cron('0 3 * * *')
  async generateValuationSnapshots(): Promise<void> {
    this.logger.log('Cron: Starting daily valuation snapshot generation');

    const spaces = await this.prisma.space.findMany({
      select: { id: true },
    });

    // Add snapshot jobs for all spaces
    for (const space of spaces) {
      await this.queueService.addValuationSnapshotJob(
        {
          spaceId: space.id,
        },
        20
      );
    }

    this.logger.log(`Cron: Queued snapshot jobs for ${spaces.length} spaces`);
  }

  @Cron('0 6,18 * * *') // Twice daily
  async refreshESGData(): Promise<void> {
    this.logger.log('Cron: Starting ESG data refresh');

    // Get all unique crypto symbols from accounts
    const cryptoAccounts = await this.prisma.account.findMany({
      where: { type: 'crypto' },
      select: { metadata: true },
      distinct: ['metadata'],
    });

    const symbols = new Set<string>();

    for (const account of cryptoAccounts) {
      const metadata = account.metadata as any;
      const symbol = metadata?.cryptoCurrency || metadata?.symbol;
      if (symbol) {
        symbols.add(symbol.toUpperCase());
      }
    }

    // Add popular cryptocurrencies that users might be interested in
    const popularCryptos = ['BTC', 'ETH', 'ADA', 'DOT', 'SOL', 'ALGO', 'MATIC', 'AVAX'];
    popularCryptos.forEach((symbol) => symbols.add(symbol));

    if (symbols.size > 0) {
      await this.queueService.addESGUpdateJob(
        {
          symbols: Array.from(symbols),
          forceRefresh: false,
        },
        25,
        `cron-esg-refresh-${this.getUtcHourBucket()}`
      );

      this.logger.log(`Cron: Queued ESG refresh for ${symbols.size} symbols`);
    }
  }

  // Monitoring and health checks
  async getJobStatistics() {
    const stats = await this.queueService.getAllQueueStats();

    const totalJobs = stats.reduce(
      (sum, queue) =>
        sum + queue.waiting + queue.active + queue.completed + queue.failed + queue.delayed,
      0
    );

    const failedJobs = stats.reduce((sum, queue) => sum + queue.failed, 0);
    const activeJobs = stats.reduce((sum, queue) => sum + queue.active, 0);

    return {
      queues: stats,
      summary: {
        totalJobs,
        activeJobs,
        failedJobs,
        successRate:
          totalJobs > 0 ? (((totalJobs - failedJobs) / totalJobs) * 100).toFixed(2) : '100',
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getFailedJobs(queueName?: string) {
    if (queueName) {
      return this.queueService.getQueueStats(queueName);
    }

    return this.queueService.getAllQueueStats();
  }

  async retryAllFailedJobs(): Promise<void> {
    const stats = await this.queueService.getAllQueueStats();

    for (const queueStat of stats) {
      if (queueStat.failed > 0) {
        await this.queueService.retryFailedJobs(queueStat.name);
      }
    }

    this.logger.log('Retried all failed jobs across all queues');
  }

  private getUtcHourBucket(date = new Date()): string {
    return date.toISOString().slice(0, 13);
  }

  private getUtcFourHourBucket(date = new Date()): string {
    const bucketStart = new Date(date);
    bucketStart.setUTCMinutes(0, 0, 0);
    bucketStart.setUTCHours(Math.floor(bucketStart.getUTCHours() / 4) * 4);
    return bucketStart.toISOString().slice(0, 13);
  }
}
