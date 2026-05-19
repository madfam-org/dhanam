import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as Sentry from '@sentry/node';

import { PrismaService } from '@core/prisma/prisma.service';
import { RulesService } from '@modules/categories/rules.service';
import { BitsoService } from '@modules/providers/bitso/bitso.service';
import { BlockchainService } from '@modules/providers/blockchain/blockchain.service';

/** Emails of the 5 base demo persona templates — never deleted by cleanup. */
const DEMO_PERSONA_EMAILS = [
  'guest@dhanam.demo',
  'maria@dhanam.demo',
  'carlos@dhanam.demo',
  'patricia@dhanam.demo',
  'diego@dhanam.demo',
] as const;

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private prisma: PrismaService,
    private rulesService: RulesService,
    private bitsoService: BitsoService,
    private blockchainService: BlockchainService
  ) {}

  /**
   * Wrap cron job execution with error tracking
   */
  private async withJobTracking<T>(
    jobName: string,
    operation: () => Promise<T>
  ): Promise<T | undefined> {
    const startTime = Date.now();
    const checkInId = Sentry.captureCheckIn(
      { monitorSlug: jobName, status: 'in_progress' },
      { schedule: { type: 'crontab', value: '* * * * *' } }
    );

    try {
      const result = await operation();
      const durationMs = Date.now() - startTime;

      Sentry.captureCheckIn({
        checkInId,
        monitorSlug: jobName,
        status: 'ok',
        duration: durationMs / 1000,
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      Sentry.captureCheckIn({
        checkInId,
        monitorSlug: jobName,
        status: 'error',
        duration: durationMs / 1000,
      });

      Sentry.withScope((scope) => {
        scope.setTag('job_name', jobName);
        scope.setTag('job_type', 'cron');
        scope.setContext('job', {
          jobName,
          durationMs,
        });
        Sentry.captureException(err);
      });

      this.logger.error(`Cron job ${jobName} failed after ${durationMs}ms: ${err.message}`);
      return undefined;
    }
  }

  // Run every hour - categorize new transactions
  @Cron(CronExpression.EVERY_HOUR)
  async categorizeNewTransactions(): Promise<void> {
    await this.withJobTracking('categorize-transactions-hourly', async () => {
      this.logger.log('Starting automatic transaction categorization');

      const spaces = await this.prisma.space.findMany({
        select: { id: true },
      });

      let totalCategorized = 0;
      let totalProcessed = 0;
      let errors = 0;

      for (const space of spaces) {
        try {
          const result = await this.rulesService.batchCategorizeTransactions(space.id);
          totalCategorized += result.categorized;
          totalProcessed += result.total;
        } catch (spaceError) {
          errors++;
          this.logger.warn(
            `Failed to categorize transactions for space ${space.id}: ${(spaceError as Error).message}`
          );
        }
      }

      this.logger.log(
        `Auto-categorization complete: ${totalCategorized}/${totalProcessed} transactions categorized across ${spaces.length} spaces (${errors} errors)`
      );

      return { totalCategorized, totalProcessed, spaces: spaces.length, errors };
    });
  }

  // Run every 4 hours - sync crypto portfolios
  @Cron('0 */4 * * *')
  async syncCryptoPortfolios(): Promise<void> {
    await this.withJobTracking('sync-crypto-portfolios', async () => {
      this.logger.log('Starting scheduled crypto portfolio sync');

      const connections = await this.prisma.providerConnection.findMany({
        where: {
          provider: 'bitso',
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      let synced = 0;
      let errors = 0;

      for (const connection of connections) {
        try {
          await this.bitsoService.syncPortfolio(connection.userId);
          synced++;
          this.logger.log(`Synced crypto portfolio for user ${connection.userId}`);
        } catch (error) {
          errors++;
          this.logger.warn(
            `Failed to sync crypto for user ${connection.userId}: ${(error as Error).message}`
          );
        }
      }

      this.logger.log(
        `Crypto sync complete: ${synced}/${connections.length} users synced (${errors} errors)`
      );
      return { synced, total: connections.length, errors };
    });
  }

  // Run every 6 hours - sync blockchain wallets (ETH, BTC)
  @Cron('0 */6 * * *')
  async syncBlockchainWallets(): Promise<void> {
    await this.withJobTracking('sync-blockchain-wallets', async () => {
      this.logger.log('Starting scheduled blockchain wallet sync');

      const accounts = await this.prisma.account.findMany({
        where: {
          provider: 'manual',
          metadata: {
            path: ['readOnly'],
            equals: true,
          },
        },
        include: {
          space: {
            include: {
              userSpaces: {
                select: { userId: true },
                take: 1,
              },
            },
          },
        },
        distinct: ['spaceId'],
      });

      const uniqueUserIds = new Set<string>(
        accounts
          .map((account) => account.space.userSpaces[0]?.userId)
          .filter((userId): userId is string => !!userId)
      );

      let synced = 0;
      let errors = 0;

      for (const userId of uniqueUserIds) {
        try {
          await this.blockchainService.syncWallets(userId);
          synced++;
          this.logger.log(`Synced blockchain wallets for user ${userId}`);
        } catch (error) {
          errors++;
          this.logger.warn(
            `Failed to sync blockchain wallets for user ${userId}: ${(error as Error).message}`
          );
        }
      }

      this.logger.log(
        `Blockchain wallet sync complete: ${synced}/${uniqueUserIds.size} users synced (${errors} errors)`
      );
      return { synced, total: uniqueUserIds.size, errors };
    });
  }

  // Run daily at 2 AM - cleanup expired sessions
  @Cron('0 2 * * *')
  async cleanupExpiredSessions(): Promise<void> {
    await this.withJobTracking('cleanup-expired-sessions', async () => {
      this.logger.log('Starting session cleanup');

      // This would be handled by Redis TTL, but we can log metrics
      const activeConnections = await this.prisma.providerConnection.count();
      const oldConnections = await this.prisma.providerConnection.count({
        where: {
          updatedAt: {
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          },
        },
      });

      this.logger.log(
        `Session cleanup complete. Active connections: ${activeConnections}, Stale connections: ${oldConnections}`
      );

      return { activeConnections, staleConnections: oldConnections };
    });
  }

  // Run daily at 3 AM - generate daily valuation snapshots
  @Cron('0 3 * * *')
  async generateValuationSnapshots(): Promise<void> {
    await this.withJobTracking('generate-valuation-snapshots', async () => {
      this.logger.log('Starting daily valuation snapshot generation');

      const spaces = await this.prisma.space.findMany({
        include: {
          accounts: true,
        },
      });

      let snapshotsCreated = 0;
      let errors = 0;

      for (const space of spaces) {
        try {
          // Calculate total assets and liabilities
          const totalAssets = space.accounts
            .filter((account: { type: string; balance: { toNumber: () => number } }) =>
              ['checking', 'savings', 'investment', 'crypto'].includes(account.type)
            )
            .reduce(
              (sum: number, account: { balance: { toNumber: () => number } }) =>
                sum + account.balance.toNumber(),
              0
            );

          const totalLiabilities = space.accounts
            .filter((account: { type: string }) => account.type === 'credit')
            .reduce(
              (sum: number, account: { balance: { toNumber: () => number } }) =>
                sum + Math.abs(account.balance.toNumber()),
              0
            );

          const netWorth = totalAssets - totalLiabilities;

          // Create asset valuation snapshot for each account
          for (const account of space.accounts) {
            await this.prisma.assetValuation.create({
              data: {
                accountId: account.id,
                date: new Date(),
                value: account.balance,
                currency: account.currency,
              },
            });
            snapshotsCreated++;
          }

          this.logger.log(
            `Created valuation snapshot for space ${space.id}: $${netWorth.toFixed(2)}`
          );
        } catch (spaceError) {
          errors++;
          this.logger.warn(
            `Failed to create snapshot for space ${space.id}: ${(spaceError as Error).message}`
          );
        }
      }

      this.logger.log(
        `Daily snapshots complete: ${snapshotsCreated} snapshots for ${spaces.length} spaces (${errors} errors)`
      );
      return { snapshotsCreated, spaces: spaces.length, errors };
    });
  }

  // Run daily at 3:30 AM - cleanup stale demo accounts
  @Cron('0 30 3 * * *')
  async cleanupDemoAccounts(): Promise<void> {
    await this.withJobTracking('cleanup-demo-accounts', async () => {
      this.logger.log('Starting demo account cleanup');

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Find stale demo users: email ends with @dhanam.demo, not updated in 7 days,
      // and not one of the 5 preserved persona templates
      const staleUsers = await this.prisma.user.findMany({
        where: {
          email: {
            endsWith: '@dhanam.demo',
            notIn: [...DEMO_PERSONA_EMAILS],
          },
          updatedAt: {
            lt: sevenDaysAgo,
          },
        },
        select: { id: true, email: true },
      });

      if (staleUsers.length === 0) {
        this.logger.log('No stale demo accounts to clean up');
        return { deleted: 0 };
      }

      const staleUserIds = staleUsers.map((u) => u.id);

      // Cascade-delete via Prisma (schema onDelete: Cascade handles spaces/accounts/transactions)
      const result = await this.prisma.user.deleteMany({
        where: { id: { in: staleUserIds } },
      });

      this.logger.log(`Demo account cleanup complete: ${result.count} stale demo accounts deleted`);

      return { deleted: result.count };
    });
  }

  // Manual trigger for immediate categorization
  async triggerCategorization(spaceId?: string): Promise<{
    categorized: number;
    total: number;
    spaces: number;
  }> {
    this.logger.log(`Manual categorization triggered for ${spaceId || 'all spaces'}`);

    const spaces = spaceId
      ? [{ id: spaceId }]
      : await this.prisma.space.findMany({ select: { id: true } });

    let totalCategorized = 0;
    let totalProcessed = 0;

    for (const space of spaces) {
      const result = await this.rulesService.batchCategorizeTransactions(space.id);
      totalCategorized += result.categorized;
      totalProcessed += result.total;
    }

    return {
      categorized: totalCategorized,
      total: totalProcessed,
      spaces: spaces.length,
    };
  }

  // Manual trigger for portfolio sync
  async triggerPortfolioSync(userId?: string): Promise<{
    syncedUsers: number;
    errors: number;
  }> {
    this.logger.log(`Manual portfolio sync triggered for ${userId || 'all users'}`);

    const connections = userId
      ? await this.prisma.providerConnection.findMany({
          where: { userId, provider: 'bitso' },
          select: { userId: true },
          distinct: ['userId'],
        })
      : await this.prisma.providerConnection.findMany({
          where: { provider: 'bitso' },
          select: { userId: true },
          distinct: ['userId'],
        });

    let syncedUsers = 0;
    let errors = 0;

    for (const connection of connections) {
      try {
        await this.bitsoService.syncPortfolio(connection.userId);
        syncedUsers++;
      } catch (error) {
        this.logger.error(`Failed to sync portfolio for user ${connection.userId}:`, error);
        errors++;
      }
    }

    return { syncedUsers, errors };
  }
}
