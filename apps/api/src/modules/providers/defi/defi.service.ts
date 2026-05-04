import { Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { SpacesService } from '../../spaces/spaces.service';

import type { DeFiPosition, DeFiNetwork, DeFiSyncResult } from './defi-position.interface';
import { ZapperService } from './zapper.service';

export interface DeFiAccountSummary {
  accountId: string;
  accountName: string;
  walletAddress: string;
  network: DeFiNetwork;
  totalValueUsd: number;
  positionCount: number;
  lastSyncedAt?: Date;
  positions: DeFiPosition[];
}

export interface SpaceDeFiSummary {
  totalValueUsd: number;
  totalBorrowedUsd: number;
  netWorthUsd: number;
  positionCount: number;
  accounts: DeFiAccountSummary[];
  byProtocol: Record<string, { valueUsd: number; count: number }>;
  byType: Record<string, { valueUsd: number; count: number }>;
}

@Injectable()
export class DeFiService {
  private readonly logger = new Logger(DeFiService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => SpacesService))
    private readonly spacesService: SpacesService,
    private readonly zapperService: ZapperService
  ) {}

  /**
   * Check if DeFi features are available
   */
  isAvailable(): boolean {
    return this.zapperService.isAvailable();
  }

  /**
   * Get DeFi positions for a specific account
   */
  async getAccountPositions(
    spaceId: string,
    accountId: string
  ): Promise<DeFiAccountSummary | null> {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        spaceId,
        type: 'crypto',
      },
    });

    if (!account) {
      return null;
    }

    const metadata = account.metadata as { walletAddress?: string; network?: string } | null;
    const walletAddress = metadata?.walletAddress;

    if (!walletAddress) {
      return {
        accountId: account.id,
        accountName: account.name,
        walletAddress: '',
        network: 'ethereum',
        totalValueUsd: 0,
        positionCount: 0,
        positions: [],
      };
    }

    const network = (metadata?.network as DeFiNetwork) || 'ethereum';

    try {
      const portfolio = await this.zapperService.getPortfolio(walletAddress, network);

      return {
        accountId: account.id,
        accountName: account.name,
        walletAddress,
        network,
        totalValueUsd: portfolio.totalBalanceUsd,
        positionCount: portfolio.positions.length,
        lastSyncedAt: portfolio.lastUpdated,
        positions: portfolio.positions,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch DeFi positions for ${accountId}: ${error}`);
      throw error;
    }
  }

  /**
   * Get all DeFi positions across all crypto accounts in a space
   */
  async getSpaceDeFiSummary(spaceId: string): Promise<SpaceDeFiSummary> {
    const accounts = await this.prisma.account.findMany({
      where: {
        spaceId,
        type: 'crypto',
      },
    });

    const accountSummaries: DeFiAccountSummary[] = [];
    let totalValueUsd = 0;
    let totalBorrowedUsd = 0;
    let positionCount = 0;
    const byProtocol: Record<string, { valueUsd: number; count: number }> = {};
    const byType: Record<string, { valueUsd: number; count: number }> = {};

    for (const account of accounts) {
      const metadata = account.metadata as { walletAddress?: string; network?: string } | null;
      const walletAddress = metadata?.walletAddress;

      if (!walletAddress) continue;

      const network = (metadata?.network as DeFiNetwork) || 'ethereum';

      try {
        const portfolio = await this.zapperService.getPortfolio(walletAddress, network);

        accountSummaries.push({
          accountId: account.id,
          accountName: account.name,
          walletAddress,
          network,
          totalValueUsd: portfolio.totalBalanceUsd,
          positionCount: portfolio.positions.length,
          lastSyncedAt: portfolio.lastUpdated,
          positions: portfolio.positions,
        });

        totalValueUsd += portfolio.totalBalanceUsd;
        totalBorrowedUsd += portfolio.totalBorrowedUsd;
        positionCount += portfolio.positions.length;

        // Aggregate by protocol and type
        for (const position of portfolio.positions) {
          // By protocol
          if (!byProtocol[position.protocol]) {
            byProtocol[position.protocol] = { valueUsd: 0, count: 0 };
          }
          byProtocol[position.protocol].valueUsd += position.balanceUsd;
          byProtocol[position.protocol].count += 1;

          // By type
          if (!byType[position.type]) {
            byType[position.type] = { valueUsd: 0, count: 0 };
          }
          byType[position.type].valueUsd += position.balanceUsd;
          byType[position.type].count += 1;
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch DeFi for account ${account.id}: ${error}`);
      }
    }

    return {
      totalValueUsd,
      totalBorrowedUsd,
      netWorthUsd: totalValueUsd - totalBorrowedUsd,
      positionCount,
      accounts: accountSummaries,
      byProtocol,
      byType,
    };
  }

  /**
   * Sync DeFi positions for a specific account
   */
  async syncAccountPositions(spaceId: string, accountId: string): Promise<DeFiSyncResult> {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        spaceId,
        type: 'crypto',
      },
    });

    if (!account) {
      throw new NotFoundException('Crypto account not found');
    }

    const metadata = account.metadata as { walletAddress?: string; network?: string } | null;
    const walletAddress = metadata?.walletAddress;

    if (!walletAddress) {
      return {
        success: false,
        accountId,
        positionsFound: 0,
        totalValueUsd: 0,
        error: 'No wallet address configured for this account',
      };
    }

    const network = (metadata?.network as DeFiNetwork) || 'ethereum';

    try {
      const portfolio = await this.zapperService.getPortfolio(walletAddress, network);

      // Store the DeFi balance in metadata for reference
      const defiValue = portfolio.netWorthUsd;
      const updatedMetadata = {
        ...metadata,
        defiValueUsd: defiValue,
        defiPositionCount: portfolio.positions.length,
        lastDefiSync: new Date().toISOString(),
      };

      await this.prisma.account.update({
        where: { id: accountId },
        data: {
          metadata: updatedMetadata as object,
        },
      });

      return {
        success: true,
        accountId,
        positionsFound: portfolio.positions.length,
        totalValueUsd: portfolio.netWorthUsd,
      };
    } catch (error) {
      this.logger.error(`DeFi sync failed for ${accountId}: ${error}`);
      return {
        success: false,
        accountId,
        positionsFound: 0,
        totalValueUsd: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Sync DeFi positions for all crypto accounts in a space
   */
  async syncAllAccountsInSpace(spaceId: string): Promise<DeFiSyncResult[]> {
    const accounts = await this.prisma.account.findMany({
      where: {
        spaceId,
        type: 'crypto',
      },
    });

    const results: DeFiSyncResult[] = [];

    for (const account of accounts) {
      try {
        const result = await this.syncAccountPositions(spaceId, account.id);
        results.push(result);
        // Rate limiting between accounts
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        results.push({
          success: false,
          accountId: account.id,
          positionsFound: 0,
          totalValueUsd: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }
}
