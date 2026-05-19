import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlaidApi,
  Configuration,
  PlaidEnvironments,
  CountryCode,
  Products,
  ItemPublicTokenExchangeRequest,
  LinkTokenCreateRequest,
  AccountsGetRequest,
  TransactionsSyncRequest,
  DepositoryAccountSubtype,
  CreditAccountSubtype,
  LiabilitiesGetRequest,
  LoanAccountSubtype,
} from 'plaid';

import { AuditService } from '@core/audit/audit.service';
import { MonitorPerformance } from '@core/decorators/monitor-performance.decorator';
import { Retry } from '@core/decorators/retry.decorator';
import { ProviderException } from '@core/exceptions/domain-exceptions';
import type { InputJsonValue } from '@db';
import { Prisma as _Prisma, Account, Currency } from '@db';

import { CryptoService } from '../../../core/crypto/crypto.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PlaidAccountMetadata } from '../../../types/metadata.types';
import { isUniqueConstraintError } from '../../../types/prisma-errors.types';
import { CircuitBreakerService } from '../orchestrator/circuit-breaker.service';

import { CreatePlaidLinkDto, PlaidWebhookDto } from './dto';
import { PlaidWebhookHandler } from './plaid-webhook.handler';
import { createPlaidApiWrapper, mapPlaidAccountType, mapPlaidCurrency } from './plaid.utils';

@Injectable()
export class PlaidService {
  private readonly logger = new Logger(PlaidService.name);
  private plaidClient: PlaidApi | null = null;
  private readonly webhookSecret: string;
  private readonly callPlaidApi: ReturnType<typeof createPlaidApiWrapper>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly auditService: AuditService,
    private readonly webhookHandler: PlaidWebhookHandler
  ) {
    this.initializePlaidClient();
    this.webhookSecret = this.configService.get('PLAID_WEBHOOK_SECRET', '');
    this.callPlaidApi = createPlaidApiWrapper(this.circuitBreaker);
  }

  private initializePlaidClient() {
    const clientId = this.configService.get('PLAID_CLIENT_ID');
    const secret = this.configService.get('PLAID_SECRET');
    const env = this.configService.get('PLAID_ENV', 'sandbox');

    if (!clientId || !secret) {
      this.logger.warn('Plaid credentials not configured, service disabled');
      return;
    }

    const configuration = new Configuration({
      basePath: PlaidEnvironments[env],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
        },
      },
    });

    this.plaidClient = new PlaidApi(configuration);
    this.logger.log('Plaid client initialized successfully');
  }

  @Retry('provider_sync')
  async createLinkToken(userId: string): Promise<{ linkToken: string; expiration: Date }> {
    if (!this.plaidClient) {
      // Configuration error - not retryable
      throw new BadRequestException('Plaid integration is not configured');
    }

    const request: LinkTokenCreateRequest = {
      products: [Products.Transactions, Products.Auth, Products.Liabilities],
      client_name: 'Dhanam Ledger',
      country_codes: [CountryCode.Us],
      language: 'en',
      user: {
        client_user_id: userId,
      },
      webhook: this.configService.get('PLAID_WEBHOOK_URL'),
      account_filters: {
        depository: {
          account_subtypes: [DepositoryAccountSubtype.Checking, DepositoryAccountSubtype.Savings],
        },
        credit: {
          account_subtypes: [CreditAccountSubtype.CreditCard],
        },
        loan: {
          account_subtypes: [
            LoanAccountSubtype.Auto,
            LoanAccountSubtype.Student,
            LoanAccountSubtype.Mortgage,
            LoanAccountSubtype.Consumer,
            LoanAccountSubtype.HomeEquity,
            LoanAccountSubtype.LineOfCredit,
          ],
        },
      },
    };

    const response = await this.callPlaidApi('linkTokenCreate', () =>
      this.plaidClient!.linkTokenCreate(request)
    );
    const { link_token, expiration } = response.data;

    return {
      linkToken: link_token,
      expiration: new Date(expiration),
    };
  }

  /**
   * Fetch and sync accounts for a specific Plaid connection
   * @param connectionId - The provider connection ID
   * @returns Array of synced accounts
   */
  async fetchAccounts(connectionId: string): Promise<Account[]> {
    const connection = await this.prisma.providerConnection.findUnique({
      where: { id: connectionId },
      include: { user: { include: { userSpaces: { take: 1 } } as any } as any },
    });

    if (!connection || connection.provider !== 'plaid') {
      throw new BadRequestException('Invalid Plaid connection');
    }

    const accessToken = this.cryptoService.decrypt(JSON.parse(connection.encryptedToken));
    const itemId = connection.providerUserId;
    const spaceId = (connection.user as any).userSpaces[0]?.spaceId;

    if (!spaceId) {
      throw new BadRequestException('No space found for user');
    }

    return this.syncAccounts(spaceId, accessToken, itemId);
  }

  /**
   * Fetch transactions for a specific account within a date range
   * @param accountId - The account ID
   * @param startDate - Start date for transaction fetch
   * @param endDate - End date for transaction fetch (defaults to today)
   * @returns Transaction sync result
   */
  async fetchTransactionsByDateRange(
    accountId: string,
    startDate: Date,
    _endDate: Date = new Date()
  ): Promise<{ transactionCount: number; accountCount: number }> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: {
        space: {
          include: {
            userSpaces: {
              include: { user: { include: { providerConnections: true } } as any } as any,
            },
          } as any,
        } as any,
      },
    });

    if (!account || account.provider !== 'plaid') {
      throw new BadRequestException('Invalid Plaid account');
    }

    const metadata = account.metadata as unknown as PlaidAccountMetadata;
    const itemId = metadata?.itemId;
    if (!itemId) {
      throw new BadRequestException('Account missing Plaid item ID');
    }

    const connection = (account as any).space.userSpaces
      .flatMap((userSpace: any) => userSpace.user.providerConnections)
      .find((conn: any) => conn.provider === 'plaid' && conn.providerUserId === itemId);

    if (!connection) {
      throw new BadRequestException('Plaid connection not found');
    }

    const accessToken = this.cryptoService.decrypt(JSON.parse(connection.encryptedToken));

    return this.syncTransactions(accessToken, itemId);
  }

  @Retry('provider_sync')
  async createLink(
    spaceId: string,
    userId: string,
    dto: CreatePlaidLinkDto
  ): Promise<{ accounts: Account[] }> {
    if (!this.plaidClient) {
      // Configuration error - not retryable
      throw new BadRequestException('Plaid integration is not configured');
    }

    try {
      // Exchange public token for access token (with timeout and circuit breaker)
      const exchangeRequest: ItemPublicTokenExchangeRequest = {
        public_token: dto.publicToken,
      };

      const exchangeResponse = await this.callPlaidApi('itemPublicTokenExchange', () =>
        this.plaidClient!.itemPublicTokenExchange(exchangeRequest)
      );
      const { access_token, item_id } = exchangeResponse.data;

      // Store encrypted access token
      const encryptedToken = this.cryptoService.encrypt(access_token);
      await this.prisma.providerConnection.create({
        data: {
          provider: 'plaid',
          providerUserId: item_id,
          encryptedToken: JSON.stringify(encryptedToken),
          metadata: {
            spaceId, // Store spaceId for webhook routing
            publicToken: dto.publicToken,
            itemId: item_id,
            externalId: dto.externalId,
            connectedAt: new Date().toISOString(),
          } as InputJsonValue,
          user: { connect: { id: userId } },
        },
      });

      // Fetch and sync accounts
      const accounts = await this.syncAccounts(spaceId, access_token, item_id);

      // Initial transaction sync (non-blocking - log errors but don't fail)
      try {
        await this.syncTransactions(access_token, item_id);
      } catch (txError) {
        this.logger.warn(`Initial transaction sync failed for item ${item_id}:`, txError);
        // Don't fail the link creation - transactions will sync on next scheduled job
      }

      // Initial liability sync (for credit cards, loans, mortgages)
      try {
        await this.syncLiabilities(access_token, item_id);
      } catch (error) {
        // Liabilities may not be available for all accounts, log but don't fail
        this.logger.warn(`Liabilities sync skipped for item ${item_id}:`, error);
      }

      // Log successful connection
      await this.auditService.logProviderConnection('plaid', userId, spaceId, true);

      this.logger.log(`Successfully linked Plaid item ${item_id} for user ${userId}`);
      return { accounts };
    } catch (error) {
      // Log failed connection
      await this.auditService.logProviderConnection('plaid', userId, spaceId, false);

      // Re-throw if already a domain exception
      if (error instanceof ProviderException) {
        throw error;
      }

      this.logger.error('Failed to create Plaid link:', error);
      throw ProviderException.syncFailed(
        'plaid',
        'createLink',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async syncAccounts(
    spaceId: string,
    accessToken: string,
    itemId: string
  ): Promise<Account[]> {
    try {
      const request: AccountsGetRequest = {
        access_token: accessToken,
      };

      const response = await this.callPlaidApi('accountsGet', () =>
        this.plaidClient!.accountsGet(request)
      );
      const plaidAccounts = response.data.accounts;

      const accounts: Account[] = [];

      for (const plaidAccount of plaidAccounts) {
        // Check if account already exists
        const existingAccount = await this.prisma.account.findFirst({
          where: {
            spaceId,
            provider: 'plaid',
            providerAccountId: plaidAccount.account_id,
          },
        });

        const accountData = {
          spaceId,
          provider: 'plaid' as const,
          providerAccountId: plaidAccount.account_id,
          name: plaidAccount.name,
          type: mapPlaidAccountType(plaidAccount.type),
          subtype: plaidAccount.subtype || plaidAccount.type,
          currency: mapPlaidCurrency(plaidAccount.balances.iso_currency_code || 'USD'),
          balance: plaidAccount.balances.current || 0,
          lastSyncedAt: new Date(),
          metadata: {
            mask: plaidAccount.mask,
            officialName: plaidAccount.official_name,
            itemId,
            balances: {
              available: plaidAccount.balances.available,
              current: plaidAccount.balances.current,
              limit: plaidAccount.balances.limit,
              iso_currency_code: plaidAccount.balances.iso_currency_code,
              unofficial_currency_code: plaidAccount.balances.unofficial_currency_code,
            },
          } as InputJsonValue,
        };

        if (existingAccount) {
          // Update existing account
          const updated = await this.prisma.account.update({
            where: { id: existingAccount.id },
            data: accountData,
          });
          accounts.push(updated);
        } else {
          // Create new account
          const account = await this.prisma.account.create({ data: accountData });
          accounts.push(account);
        }
      }

      this.logger.log(`Synced ${accounts.length} accounts for item ${itemId}`);
      return accounts;
    } catch (error) {
      // Re-throw domain exceptions
      if (error instanceof ProviderException) {
        throw error;
      }

      this.logger.error('Failed to sync Plaid accounts:', error);
      throw ProviderException.syncFailed(
        'plaid',
        'syncAccounts',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  @Retry('provider_sync')
  @MonitorPerformance(2000) // 2 second threshold for transaction sync
  async syncTransactions(
    accessToken: string,
    itemId: string
  ): Promise<{ transactionCount: number; accountCount: number; nextCursor?: string }> {
    if (!this.plaidClient) {
      // Configuration error - not retryable
      throw new BadRequestException('Plaid integration is not configured');
    }

    try {
      // Use transactions sync for better performance (with timeout and circuit breaker)
      const request: TransactionsSyncRequest = {
        access_token: accessToken,
      };

      const response = await this.callPlaidApi('transactionsSync', () =>
        this.plaidClient!.transactionsSync(request)
      );
      const { added, modified, removed, next_cursor } = response.data;

      // Process added transactions
      for (const plaidTransaction of added) {
        await this.createTransactionFromPlaid(plaidTransaction, itemId);
      }

      // Process modified transactions
      for (const plaidTransaction of modified) {
        await this.updateTransactionFromPlaid(plaidTransaction, itemId);
      }

      // Process removed transactions
      for (const removedId of removed) {
        await this.removeTransaction(removedId.transaction_id, itemId);
      }

      // Store cursor for next sync
      if (next_cursor) {
        await this.prisma.providerConnection.updateMany({
          where: {
            provider: 'plaid',
            providerUserId: itemId,
          },
          data: {
            metadata: {
              cursor: next_cursor,
              lastSyncAt: new Date().toISOString(),
            },
          },
        });
      }

      this.logger.log(
        `Synced transactions for item ${itemId}: ${added.length} added, ${modified.length} modified, ${removed.length} removed`
      );

      return {
        transactionCount: added.length + modified.length,
        accountCount: 1, // Will be determined by account sync
        nextCursor: next_cursor,
      };
    } catch (error) {
      // Re-throw domain exceptions
      if (error instanceof ProviderException) {
        throw error;
      }

      this.logger.error(`Failed to sync transactions for item ${itemId}:`, error);
      throw ProviderException.syncFailed(
        'plaid',
        'syncTransactions',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Sync liability data (credit cards, loans, mortgages) from Plaid
   * Updates account records with APR, minimum payment, due dates, etc.
   */
  @Retry('provider_sync')
  @MonitorPerformance(3000)
  async syncLiabilities(
    accessToken: string,
    itemId: string
  ): Promise<{ accountsUpdated: number; liabilityTypes: string[] }> {
    if (!this.plaidClient) {
      // Configuration error - not retryable
      throw new BadRequestException('Plaid integration is not configured');
    }

    try {
      const request: LiabilitiesGetRequest = {
        access_token: accessToken,
      };

      const response = await this.callPlaidApi('liabilitiesGet', () =>
        this.plaidClient!.liabilitiesGet(request)
      );
      const { liabilities, accounts } = response.data;

      const liabilityTypes: string[] = [];
      let accountsUpdated = 0;

      // Process credit card liabilities
      if (liabilities.credit) {
        liabilityTypes.push('credit');
        for (const credit of liabilities.credit) {
          const account = accounts.find((a) => a.account_id === credit.account_id);
          if (!account) continue;

          await this.prisma.account.updateMany({
            where: {
              provider: 'plaid',
              providerAccountId: credit.account_id,
            },
            data: {
              liabilityType: 'credit',
              apr: credit.aprs?.[0]?.apr_percentage ? credit.aprs[0].apr_percentage / 100 : null,
              minimumPayment: credit.minimum_payment_amount || null,
              nextPaymentDueDate: credit.next_payment_due_date
                ? new Date(credit.next_payment_due_date)
                : null,
              lastPaymentAmount: credit.last_payment_amount || null,
              lastPaymentDate: credit.last_payment_date ? new Date(credit.last_payment_date) : null,
              isOverdue: credit.is_overdue || false,
              creditLimit: account.balances.limit || null,
              lastSyncedAt: new Date(),
            },
          });
          accountsUpdated++;
        }
      }

      // Process student loans
      if (liabilities.student) {
        liabilityTypes.push('student');
        for (const student of liabilities.student) {
          await this.prisma.account.updateMany({
            where: {
              provider: 'plaid',
              providerAccountId: student.account_id,
            },
            data: {
              liabilityType: 'student',
              apr: student.interest_rate_percentage ? student.interest_rate_percentage / 100 : null,
              minimumPayment: student.minimum_payment_amount || null,
              nextPaymentDueDate: student.next_payment_due_date
                ? new Date(student.next_payment_due_date)
                : null,
              lastPaymentAmount: student.last_payment_amount || null,
              lastPaymentDate: student.last_payment_date
                ? new Date(student.last_payment_date)
                : null,
              isOverdue: student.is_overdue || false,
              originationDate: student.origination_date ? new Date(student.origination_date) : null,
              originalPrincipal: student.origination_principal_amount || null,
              lastSyncedAt: new Date(),
            },
          });
          accountsUpdated++;
        }
      }

      // Process mortgages
      if (liabilities.mortgage) {
        liabilityTypes.push('mortgage');
        for (const mortgage of liabilities.mortgage) {
          await this.prisma.account.updateMany({
            where: {
              provider: 'plaid',
              providerAccountId: mortgage.account_id,
            },
            data: {
              liabilityType: 'mortgage',
              apr: mortgage.interest_rate?.percentage
                ? mortgage.interest_rate.percentage / 100
                : null,
              nextPaymentDueDate: mortgage.next_payment_due_date
                ? new Date(mortgage.next_payment_due_date)
                : null,
              lastPaymentAmount: mortgage.last_payment_amount || null,
              lastPaymentDate: mortgage.last_payment_date
                ? new Date(mortgage.last_payment_date)
                : null,
              isOverdue: mortgage.past_due_amount ? mortgage.past_due_amount > 0 : false,
              originationDate: mortgage.origination_date
                ? new Date(mortgage.origination_date)
                : null,
              originalPrincipal: mortgage.origination_principal_amount || null,
              lastSyncedAt: new Date(),
            },
          });
          accountsUpdated++;
        }
      }

      this.logger.log(
        `Synced liabilities for item ${itemId}: ${accountsUpdated} accounts, types: ${liabilityTypes.join(', ')}`
      );

      return { accountsUpdated, liabilityTypes };
    } catch (error) {
      // Re-throw domain exceptions
      if (error instanceof ProviderException) {
        throw error;
      }

      this.logger.error(`Failed to sync liabilities for item ${itemId}:`, error);
      throw ProviderException.syncFailed(
        'plaid',
        'syncLiabilities',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get upcoming bills for a space based on liability due dates
   */
  async getUpcomingBills(
    spaceId: string,
    daysAhead: number = 30
  ): Promise<
    Array<{
      accountId: string;
      accountName: string;
      liabilityType: string;
      amount: number;
      dueDate: Date;
      isOverdue: boolean;
    }>
  > {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const accounts = await this.prisma.account.findMany({
      where: {
        spaceId,
        liabilityType: { not: null },
        OR: [
          {
            nextPaymentDueDate: {
              lte: futureDate,
            },
          },
          { isOverdue: true },
        ],
      },
      orderBy: [{ isOverdue: 'desc' }, { nextPaymentDueDate: 'asc' }],
    });

    return accounts.map((account) => ({
      accountId: account.id,
      accountName: account.name,
      liabilityType: account.liabilityType || 'unknown',
      amount: account.minimumPayment?.toNumber() || 0,
      dueDate: account.nextPaymentDueDate || new Date(),
      isOverdue: account.isOverdue,
    }));
  }

  private async createTransactionFromPlaid(plaidTransaction: any, _itemId: string) {
    try {
      // Find the account
      const account = await this.prisma.account.findFirst({
        where: {
          provider: 'plaid',
          providerAccountId: plaidTransaction.account_id,
        },
      });

      if (!account) {
        this.logger.warn(`Account not found for transaction ${plaidTransaction.transaction_id}`);
        return;
      }

      // Create transaction
      await this.prisma.transaction.create({
        data: {
          accountId: account.id,
          providerTransactionId: plaidTransaction.transaction_id,
          amount: -plaidTransaction.amount, // Plaid uses positive for outflows
          currency: account.currency as Currency,
          date: new Date(plaidTransaction.date),
          description: plaidTransaction.name,
          merchant: plaidTransaction.merchant_name,
          metadata: {
            plaidCategory: plaidTransaction.category,
            plaidCategoryId: plaidTransaction.category_id,
            accountOwner: plaidTransaction.account_owner,
            authorizedDate: plaidTransaction.authorized_date,
            location: plaidTransaction.location,
            paymentMeta: plaidTransaction.payment_meta,
          } as InputJsonValue,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        // Transaction already exists, skip
        return;
      }
      this.logger.error(`Failed to create transaction ${plaidTransaction.transaction_id}:`, error);
    }
  }

  private async updateTransactionFromPlaid(plaidTransaction: any, _itemId: string) {
    try {
      await this.prisma.transaction.updateMany({
        where: {
          providerTransactionId: plaidTransaction.transaction_id,
        },
        data: {
          amount: -plaidTransaction.amount,
          date: new Date(plaidTransaction.date),
          description: plaidTransaction.name,
          merchant: plaidTransaction.merchant_name,
          metadata: {
            plaidCategory: plaidTransaction.category,
            plaidCategoryId: plaidTransaction.category_id,
            accountOwner: plaidTransaction.account_owner,
            authorizedDate: plaidTransaction.authorized_date,
            location: plaidTransaction.location,
            paymentMeta: plaidTransaction.payment_meta,
          } as InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update transaction ${plaidTransaction.transaction_id}:`, error);
    }
  }

  private async removeTransaction(transactionId: string, _itemId: string) {
    try {
      await this.prisma.transaction.deleteMany({
        where: {
          providerTransactionId: transactionId,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to remove transaction ${transactionId}:`, error);
    }
  }

  async handleWebhook(webhookData: PlaidWebhookDto, signature: string): Promise<void> {
    if (
      !this.webhookHandler.verifySignature(
        JSON.stringify(webhookData),
        signature,
        this.webhookSecret
      )
    ) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const { webhook_type, webhook_code, item_id } = webhookData;
    this.logger.log(`Received Plaid webhook: ${webhook_type}:${webhook_code} for item ${item_id}`);

    try {
      switch (webhook_type) {
        case 'TRANSACTIONS':
          await this.webhookHandler.handleTransactionWebhook(
            webhookData,
            this.syncTransactions.bind(this),
            this.removeTransaction.bind(this)
          );
          break;
        case 'ACCOUNTS':
          await this.webhookHandler.handleAccountWebhook(
            webhookData,
            this.callPlaidApi,
            this.plaidClient
          );
          break;
        case 'ITEM':
          await this.webhookHandler.handleItemWebhook(webhookData);
          break;
        default:
          this.logger.log(`Unhandled webhook type: ${webhook_type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle webhook for item ${item_id}:`, error);
      throw error;
    }
  }
}
