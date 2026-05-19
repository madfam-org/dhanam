import * as crypto from 'crypto';

import { PROVIDER_DEFAULTS } from '@dhanam/shared';
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditService } from '@core/audit/audit.service';
import { CryptoService } from '@core/crypto/crypto.service';
import { MonitorPerformance } from '@core/decorators/monitor-performance.decorator';
import { Retry } from '@core/decorators/retry.decorator';
import { ProviderException } from '@core/exceptions/domain-exceptions';
import { PrismaService } from '@core/prisma/prisma.service';
import { withTimeout, TIMEOUT_PRESETS } from '@core/utils/timeout.util';
import type { InputJsonValue } from '@db';
import { Account, Transaction, Prisma as _Prisma, Currency, AccountType } from '@db';

import { CircuitBreakerService } from '../orchestrator/circuit-breaker.service';

import { CreateBelvoLinkDto, BelvoWebhookDto, BelvoWebhookEvent } from './dto';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Reason: Belvo SDK has no ESM export; require() is the only import method
const { default: Belvo } = require('belvo');

const BELVO_TIMEOUT_MS = TIMEOUT_PRESETS.provider_api;

@Injectable()
export class BelvoService {
  private readonly logger = new Logger(BelvoService.name);
  private belvoClient: any;
  private readonly webhookSecret: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private cryptoService: CryptoService,
    private auditService: AuditService,
    private circuitBreaker: CircuitBreakerService
  ) {
    const secretKeyId = this.configService.get<string>('BELVO_SECRET_KEY_ID');
    const secretKeyPassword = this.configService.get<string>('BELVO_SECRET_KEY_PASSWORD');
    const environment = this.configService.get<string>('BELVO_ENV', 'sandbox');

    this.webhookSecret = this.configService.get('BELVO_WEBHOOK_SECRET', '');

    if (secretKeyId && secretKeyPassword) {
      this.belvoClient = new Belvo(secretKeyId, secretKeyPassword, environment);
    } else {
      this.logger.warn('Belvo credentials not configured');
    }
  }

  /**
   * Check circuit breaker and throw if open
   */
  private async checkCircuitBreaker(): Promise<void> {
    const isOpen = await this.circuitBreaker.isCircuitOpen('belvo', 'MX');
    if (isOpen) {
      throw ProviderException.circuitOpen('belvo');
    }
  }

  /**
   * Record success with circuit breaker
   */
  private async recordSuccess(responseTimeMs: number): Promise<void> {
    await this.circuitBreaker.recordSuccess('belvo', 'MX', responseTimeMs);
  }

  /**
   * Record failure with circuit breaker
   */
  private async recordFailure(error: Error): Promise<void> {
    await this.circuitBreaker.recordFailure('belvo', 'MX', error.message);
  }

  /**
   * Wrap Belvo API call with timeout, circuit breaker, and error handling
   */
  private async callBelvoApi<T>(operation: string, apiCall: () => Promise<T>): Promise<T> {
    await this.checkCircuitBreaker();

    const startTime = Date.now();

    try {
      const result = await withTimeout(apiCall, {
        timeoutMs: BELVO_TIMEOUT_MS,
        operationName: `belvo.${operation}`,
      });

      await this.recordSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      await this.recordFailure(error instanceof Error ? error : new Error(String(error)));

      // Map errors to domain exceptions
      if (error instanceof ProviderException) {
        throw error;
      }

      const err = error instanceof Error ? error : new Error(String(error));

      // Check for specific Belvo error patterns
      if (err.message.includes('timeout') || err.message.includes('ETIMEDOUT')) {
        throw ProviderException.timeout('belvo', operation);
      }

      if (err.message.includes('401') || err.message.includes('unauthorized')) {
        throw ProviderException.authFailed('belvo', err);
      }

      if (err.message.includes('429') || err.message.includes('rate limit')) {
        throw ProviderException.rateLimited('belvo', 60000);
      }

      throw ProviderException.syncFailed('belvo', operation, err);
    }
  }

  @Retry('provider_sync')
  async createLink(
    spaceId: string,
    userId: string,
    dto: CreateBelvoLinkDto
  ): Promise<{ linkId: string; accounts: Account[] }> {
    if (!this.belvoClient) {
      // Configuration error - not retryable
      throw new BadRequestException('Belvo integration is not configured');
    }

    try {
      // Create link in Belvo with timeout and circuit breaker
      const link = await this.callBelvoApi<{ id: string }>('links.register', () =>
        this.belvoClient.links.register(dto.institution, dto.username, dto.password, {
          external_id: dto.externalId,
          access_mode: 'recurrent',
        })
      );

      // Store encrypted link with spaceId in metadata for proper routing
      const encryptedLinkId = this.cryptoService.encrypt(link.id);
      await this.prisma.providerConnection.create({
        data: {
          provider: 'belvo',
          providerUserId: link.id,
          encryptedToken: JSON.stringify(encryptedLinkId),
          metadata: {
            spaceId, // Store spaceId for webhook routing
            institution: dto.institution,
            createdAt: new Date().toISOString(),
          } as InputJsonValue,
          user: { connect: { id: userId } },
        },
      });

      // Fetch accounts immediately with circuit breaker
      const belvoAccounts = await this.callBelvoApi<any[]>('accounts.retrieve', () =>
        this.belvoClient.accounts.retrieve(link.id)
      );

      // Convert and store accounts
      const accounts = await this.syncAccounts(spaceId, userId, link.id, belvoAccounts);

      // Fetch initial transactions (non-blocking - log errors but don't fail)
      try {
        await this.syncTransactions(spaceId, userId, link.id);
      } catch (txError) {
        this.logger.warn(`Initial transaction sync failed for link ${link.id}:`, txError);
        // Don't fail the link creation - transactions will sync on next scheduled job
      }

      // Log successful connection
      await this.auditService.logProviderConnection('belvo', userId, spaceId, true);

      return { linkId: link.id, accounts };
    } catch (error) {
      // Log failed connection
      await this.auditService.logProviderConnection('belvo', userId, spaceId, false);

      // Re-throw if already a domain exception
      if (error instanceof ProviderException) {
        throw error;
      }

      this.logger.error('Failed to create Belvo link', error);
      throw ProviderException.syncFailed(
        'belvo',
        'createLink',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  @Retry('provider_sync')
  async syncAccounts(
    spaceId: string,
    _userId: string,
    linkId: string,
    belvoAccounts?: any[]
  ): Promise<Account[]> {
    if (!this.belvoClient) {
      // Configuration error - not retryable
      throw new BadRequestException('Belvo integration is not configured');
    }

    try {
      // Fetch accounts if not provided (with circuit breaker and timeout)
      if (!belvoAccounts) {
        belvoAccounts = await this.callBelvoApi('accounts.retrieve', () =>
          this.belvoClient.accounts.retrieve(linkId)
        );
      }

      const accounts: Account[] = [];

      for (const belvoAccount of belvoAccounts!) {
        const accountType = this.mapBelvoAccountType(belvoAccount.category);

        // Check if account already exists
        const existingAccount = await this.prisma.account.findFirst({
          where: {
            spaceId,
            provider: 'belvo',
            providerAccountId: belvoAccount.id,
          },
        });

        if (existingAccount) {
          // Update existing account
          const updated = await this.prisma.account.update({
            where: { id: existingAccount.id },
            data: {
              name: belvoAccount.name,
              balance: belvoAccount.balance.current,
              currency: this.mapCurrency(belvoAccount.currency),
              lastSyncedAt: new Date(),
              metadata: {
                ...(existingAccount.metadata as object),
                institution: belvoAccount.institution.name,
                number: belvoAccount.number,
              } as InputJsonValue,
            },
          });
          accounts.push(updated);
        } else {
          // Create new account
          const created = await this.prisma.account.create({
            data: {
              spaceId,
              provider: 'belvo',
              providerAccountId: belvoAccount.id,
              name: belvoAccount.name,
              type: accountType,
              subtype: belvoAccount.type,
              currency: this.mapCurrency(belvoAccount.currency),
              balance: belvoAccount.balance.current,
              lastSyncedAt: new Date(),
              metadata: {
                linkId,
                institution: belvoAccount.institution.name,
                number: belvoAccount.number,
              } as InputJsonValue,
            },
          });
          accounts.push(created);
        }
      }

      this.logger.log(`Synced ${accounts.length} accounts for link ${linkId}`);
      return accounts;
    } catch (error) {
      // Re-throw domain exceptions
      if (error instanceof ProviderException) {
        throw error;
      }

      this.logger.error('Failed to sync Belvo accounts', error);
      throw ProviderException.syncFailed(
        'belvo',
        'syncAccounts',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async syncTransactions(
    spaceId: string,
    _userId: string,
    linkId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<Transaction[]>;
  async syncTransactions(
    accessToken: string,
    linkId: string,
    cursor?: string
  ): Promise<{ transactionCount: number; accountCount: number; nextCursor?: string }>;
  @MonitorPerformance(2000) // 2 second threshold for transaction sync
  async syncTransactions(
    spaceIdOrAccessToken: string,
    userIdOrLinkId: string,
    linkIdOrCursor?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<
    Transaction[] | { transactionCount: number; accountCount: number; nextCursor?: string }
  > {
    if (!this.belvoClient) {
      throw new BadRequestException('Belvo integration not configured');
    }

    // Check if this is the new overloaded signature (3 parameters with different meaning)
    if (typeof linkIdOrCursor === 'string' && dateFrom === undefined && dateTo === undefined) {
      // This is the new signature: syncTransactions(accessToken, linkId, cursor?)
      // accessToken parameter not needed in our implementation
      const linkId = userIdOrLinkId;
      const cursor = linkIdOrCursor;

      try {
        // Get connection to find space
        const connection = await this.prisma.providerConnection.findFirst({
          where: {
            provider: 'belvo',
            providerUserId: linkId,
          },
          include: {
            user: {
              include: {
                userSpaces: {
                  include: { space: true },
                },
              },
            },
          },
        });

        if (!connection) {
          throw new Error(`No connection found for Belvo link: ${linkId}`);
        }

        const spaceId = connection.user.userSpaces[0]?.space?.id;
        if (!spaceId) {
          throw new Error(`No space found for user: ${connection.userId}`);
        }

        // Default to last 90 days if no cursor
        const endDate = new Date().toISOString().split('T')[0];
        const startDate =
          cursor ||
          new Date(
            Date.now() - PROVIDER_DEFAULTS.BELVO_TRANSACTION_HISTORY_DAYS * 24 * 60 * 60 * 1000
          )
            .toISOString()
            .split('T')[0];

        // Fetch transactions from Belvo
        const belvoTransactions = await this.belvoClient.transactions.retrieve(
          linkId,
          startDate,
          endDate
        );

        let transactionCount = 0;

        for (const belvoTx of belvoTransactions) {
          // Find the corresponding account
          const account = await this.prisma.account.findFirst({
            where: {
              spaceId,
              provider: 'belvo',
              providerAccountId: belvoTx.account.id,
            },
          });

          if (!account) {
            this.logger.warn(`Account not found for transaction: ${belvoTx.id}`);
            continue;
          }

          // Check if transaction already exists
          const existingTx = await this.prisma.transaction.findFirst({
            where: {
              accountId: account.id,
              metadata: {
                path: ['belvoId'],
                equals: belvoTx.id,
              },
            },
          });

          if (!existingTx) {
            // Create new transaction
            await this.prisma.transaction.create({
              data: {
                accountId: account.id,
                amount: belvoTx.type === 'INFLOW' ? belvoTx.amount : -belvoTx.amount,
                currency: account.currency as Currency,
                date: new Date(belvoTx.value_date),
                description: belvoTx.description,
                merchant: belvoTx.merchant?.name || null,
                metadata: {
                  belvoId: belvoTx.id,
                  category: belvoTx.category,
                  type: belvoTx.type,
                  status: belvoTx.status,
                  mcc: belvoTx.mcc,
                } as InputJsonValue,
              },
            });
            transactionCount++;
          }
        }

        return {
          transactionCount,
          accountCount: 1,
          nextCursor: endDate,
        };
      } catch (error) {
        this.logger.error('Failed to sync Belvo transactions via job', error);
        throw error;
      }
    }

    // Original signature: syncTransactions(spaceId, userId, linkId, dateFrom?, dateTo?)
    const spaceId = spaceIdOrAccessToken;
    // userId parameter not used in this implementation
    const linkId = linkIdOrCursor!;

    try {
      // Default to last 90 days if not specified
      const endDate = dateTo || new Date().toISOString().split('T')[0];
      const startDate =
        dateFrom ||
        new Date(
          Date.now() - PROVIDER_DEFAULTS.BELVO_TRANSACTION_HISTORY_DAYS * 24 * 60 * 60 * 1000
        )
          .toISOString()
          .split('T')[0];

      // Fetch transactions from Belvo
      const belvoTransactions = await this.belvoClient.transactions.retrieve(
        linkId,
        startDate,
        endDate
      );

      const transactions: Transaction[] = [];

      for (const belvoTx of belvoTransactions) {
        // Find the corresponding account
        const account = await this.prisma.account.findFirst({
          where: {
            spaceId,
            provider: 'belvo',
            providerAccountId: belvoTx.account.id,
          },
        });

        if (!account) {
          this.logger.warn(`Account not found for transaction: ${belvoTx.id}`);
          continue;
        }

        // Check if transaction already exists
        const existingTx = await this.prisma.transaction.findFirst({
          where: {
            accountId: account.id,
            metadata: {
              path: ['belvoId'],
              equals: belvoTx.id,
            },
          },
        });

        if (!existingTx) {
          // Create new transaction
          const created = await this.prisma.transaction.create({
            data: {
              accountId: account.id,
              amount: belvoTx.type === 'INFLOW' ? belvoTx.amount : -belvoTx.amount,
              currency: account.currency as Currency,
              date: new Date(belvoTx.value_date),
              description: belvoTx.description,
              merchant: belvoTx.merchant?.name || null,
              metadata: {
                belvoId: belvoTx.id,
                category: belvoTx.category,
                type: belvoTx.type,
                status: belvoTx.status,
                mcc: belvoTx.mcc,
              } as InputJsonValue,
            },
          });
          transactions.push(created);
        }
      }

      return transactions;
    } catch (error) {
      this.logger.error('Failed to sync Belvo transactions', error);
      throw new BadRequestException('Failed to sync transactions');
    }
  }

  async handleWebhook(dto: BelvoWebhookDto, signature: string): Promise<void> {
    // Verify webhook signature
    if (!this.verifyWebhookSignature(JSON.stringify(dto), signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Received Belvo webhook: ${dto.event}`);

    // Find the connection
    const connection = await this.prisma.providerConnection.findFirst({
      where: {
        provider: 'belvo',
        providerUserId: dto.link_id,
      },
      include: {
        user: {
          include: {
            userSpaces: {
              include: {
                space: true,
              },
            },
          },
        },
      },
    });

    if (!connection) {
      this.logger.warn(`No connection found for link: ${dto.link_id}`);
      return;
    }

    // Get spaceId from connection metadata (stored when link was created)
    const metadata = connection.metadata as { spaceId?: string } | null;
    let spaceId = metadata?.spaceId;

    // Fallback: If spaceId not in metadata (older connections), use first space
    if (!spaceId) {
      const firstSpace = connection.user.userSpaces[0]?.space;
      if (!firstSpace) {
        this.logger.warn(`No space found for user: ${connection.userId}`);
        return;
      }
      spaceId = firstSpace.id;
      this.logger.warn(
        `Using fallback space ${spaceId} for Belvo webhook. Connection ${connection.id} should be migrated to store spaceId in metadata.`
      );
    }

    switch (dto.event) {
      case BelvoWebhookEvent.ACCOUNTS_CREATED:
        await this.syncAccounts(spaceId, connection.userId, dto.link_id);
        break;
      case BelvoWebhookEvent.TRANSACTIONS_CREATED:
        await this.syncTransactions(spaceId, connection.userId, dto.link_id);
        break;
      case BelvoWebhookEvent.LINK_FAILED:
        this.logger.error(`Link failed: ${dto.link_id}`, dto.data);
        await this.prisma.providerConnection.updateMany({
          where: {
            provider: 'belvo',
            providerUserId: dto.link_id,
          },
          data: {
            metadata: {
              ...((connection.metadata as Record<string, unknown>) || {}),
              status: 'failed',
              failedAt: new Date().toISOString(),
              failureData: dto.data,
            } as InputJsonValue,
          },
        });
        await this.auditService.log({
          userId: connection.userId,
          action: 'provider.link_failed',
          resource: 'provider_connection',
          resourceId: connection.id,
          metadata: { provider: 'belvo', linkId: dto.link_id, event: dto.data },
        });
        break;
      default:
        this.logger.log(`Unhandled webhook event: ${dto.event}`);
    }
  }

  async deleteLink(userId: string, linkId: string): Promise<void> {
    if (!this.belvoClient) {
      throw new BadRequestException('Belvo integration not configured');
    }

    try {
      // Delete from Belvo
      await this.belvoClient.links.delete(linkId);

      // Delete connection record
      await this.prisma.providerConnection.deleteMany({
        where: {
          userId,
          provider: 'belvo',
          providerUserId: linkId,
        },
      });

      // Clean up associated accounts and their transactions
      // Accounts store the linkId in metadata when created by syncAccounts
      const accounts = await this.prisma.account.findMany({
        where: {
          provider: 'belvo',
          metadata: { path: ['linkId'], equals: linkId },
        },
        select: { id: true },
      });

      if (accounts.length > 0) {
        const accountIds = accounts.map((a) => a.id);
        await this.prisma.transaction.deleteMany({
          where: { accountId: { in: accountIds } },
        });
        await this.prisma.account.deleteMany({
          where: { id: { in: accountIds } },
        });
        this.logger.log(
          `Cleaned up ${accounts.length} accounts and their transactions for Belvo link ${linkId}`
        );
      }
    } catch (error) {
      this.logger.error('Failed to delete Belvo link', error);
      throw new BadRequestException('Failed to disconnect account');
    }
  }

  private mapBelvoAccountType(category: string): AccountType {
    const mapping: Record<string, AccountType> = {
      CHECKING_ACCOUNT: AccountType.checking,
      CREDIT_CARD: AccountType.credit,
      LOAN_ACCOUNT: AccountType.other,
      SAVINGS_ACCOUNT: AccountType.savings,
      INVESTMENT_ACCOUNT: AccountType.investment,
    };
    return mapping[category] || AccountType.other;
  }

  private mapCurrency(currency: string): Currency {
    const upperCurrency = currency?.toUpperCase();
    switch (upperCurrency) {
      case 'MXN':
        return Currency.MXN;
      case 'USD':
        return Currency.USD;
      case 'EUR':
        return Currency.EUR;
      default:
        // Default to MXN for Mexico-focused Belvo
        return Currency.MXN;
    }
  }

  private verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret || !signature) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');

    // timingSafeEqual requires buffers of equal length
    // Return false early if signatures have different lengths
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    try {
      return crypto.timingSafeEqual(
        new Uint8Array(Buffer.from(signature, 'hex')),
        new Uint8Array(Buffer.from(expectedSignature, 'hex'))
      );
    } catch (_error) {
      // If conversion to hex buffer fails (invalid hex string), signature is invalid
      return false;
    }
  }
}
