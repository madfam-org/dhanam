import * as crypto from 'crypto';

import { PROVIDER_DEFAULTS } from '@dhanam/shared';
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Configuration,
  InstitutionsApi,
  UsersApi,
  WidgetsApi,
  MembersApi,
  AccountsApi,
  TransactionsApi,
} from 'mx-platform-node';

import type { InputJsonValue } from '@db';
import { Provider, AccountType, Currency, Prisma as _Prisma } from '@db';

import { CryptoService } from '../../../core/crypto/crypto.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import {
  IFinancialProvider,
  ProviderHealthCheck,
  CreateLinkParams,
  LinkResult,
  ExchangeTokenParams,
  ExchangeTokenResult,
  GetAccountsParams,
  ProviderAccount,
  SyncTransactionsParams,
  SyncTransactionsResult,
  WebhookHandlerResult,
  InstitutionInfo,
} from '../orchestrator/provider.interface';

/**
 * MX Platform Integration - Backup provider for Plaid/Belvo
 * MX provides financial data aggregation across US, MX, and other regions
 * https://docs.mx.com/
 */
@Injectable()
export class MxService implements IFinancialProvider {
  readonly name = Provider.mx;
  private readonly logger = new Logger(MxService.name);
  private institutionsApi: InstitutionsApi | null = null;
  private usersApi: UsersApi | null = null;
  private widgetsApi: WidgetsApi | null = null;
  private membersApi: MembersApi | null = null;
  private accountsApi: AccountsApi | null = null;
  private transactionsApi: TransactionsApi | null = null;
  private readonly apiKey: string;
  private readonly clientId: string;
  private readonly baseUrl: string;
  private readonly webhookSecret: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private cryptoService: CryptoService
  ) {
    this.apiKey = this.configService.get('MX_API_KEY', '');
    this.clientId = this.configService.get('MX_CLIENT_ID', '');
    this.baseUrl = this.configService.get(
      'MX_BASE_URL',
      'https://int-api.mx.com' // Default to integration environment
    );
    this.webhookSecret = this.configService.get('MX_WEBHOOK_SECRET', '');

    if (!this.apiKey || !this.clientId) {
      this.logger.warn('MX credentials not configured, service disabled');
    } else {
      this.initializeMxClient();
    }
  }

  private initializeMxClient() {
    try {
      const configuration = new Configuration({
        basePath: this.baseUrl,
        username: this.clientId,
        password: this.apiKey,
      });

      this.institutionsApi = new InstitutionsApi(configuration);
      this.usersApi = new UsersApi(configuration);
      this.widgetsApi = new WidgetsApi(configuration);
      this.membersApi = new MembersApi(configuration);
      this.accountsApi = new AccountsApi(configuration);
      this.transactionsApi = new TransactionsApi(configuration);
      this.logger.log('MX client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize MX client:', error);
    }
  }

  private get isConfigured(): boolean {
    return this.institutionsApi !== null;
  }

  private static readonly API_VERSION = '1';

  async healthCheck(): Promise<ProviderHealthCheck> {
    const startTime = Date.now();

    if (!this.isConfigured) {
      return {
        provider: Provider.mx,
        status: 'down',
        errorRate: 100,
        avgResponseTimeMs: 0,
        lastCheckedAt: new Date(),
        error: 'MX not configured',
      };
    }

    try {
      // Ping MX by listing institutions with limit 1
      await this.institutionsApi!.listInstitutions(
        MxService.API_VERSION,
        undefined,
        undefined,
        1,
        1
      );
      const responseTimeMs = Date.now() - startTime;

      return {
        provider: Provider.mx,
        status: 'healthy',
        errorRate: 0,
        avgResponseTimeMs: responseTimeMs,
        lastCheckedAt: new Date(),
      };
    } catch (error: unknown) {
      return {
        provider: Provider.mx,
        status: 'down',
        errorRate: 100,
        avgResponseTimeMs: Date.now() - startTime,
        lastCheckedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async createLink(params: CreateLinkParams): Promise<LinkResult> {
    if (!this.isConfigured) {
      throw new BadRequestException('MX integration not configured');
    }

    try {
      // Step 1: Create a user in MX (or use existing)
      let mxUserGuid = params.metadata?.mxUserGuid as string | undefined;

      if (!mxUserGuid) {
        const createUserResponse = await this.usersApi!.createUser(MxService.API_VERSION, {
          user: {
            metadata: JSON.stringify({ dhanamUserId: params.userId }),
          },
        });
        mxUserGuid = createUserResponse.data.user?.guid;

        if (!mxUserGuid) {
          throw new Error('Failed to create MX user');
        }
      }

      // Step 2: Create Connect Widget URL
      const widgetRequest: Record<string, unknown> = {
        widget_url: {
          widget_type: 'connect_widget',
          mode: 'verification',
          ui_message_version: 4,
          wait_for_full_aggregation: false,
        },
      };

      const widgetResponse = await this.widgetsApi!.requestWidgetURL(
        MxService.API_VERSION,
        mxUserGuid,
        widgetRequest
      );
      const widgetUrl = widgetResponse.data.widget_url?.url;

      if (!widgetUrl) {
        throw new Error('Failed to generate MX widget URL');
      }

      return {
        linkToken: widgetUrl,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        expiration: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes (legacy)
        metadata: {
          mxUserGuid,
          provider: 'mx',
        },
      };
    } catch (error: unknown) {
      this.logger.error('Failed to create MX Link:', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to create MX link'
      );
    }
  }

  async exchangeToken(params: ExchangeTokenParams): Promise<ExchangeTokenResult> {
    if (!this.isConfigured) {
      throw new BadRequestException('MX integration not configured');
    }

    try {
      // In MX, the publicToken is actually the member_guid returned after user completes widget flow
      const memberGuid = params.publicToken;
      const mxUserGuid = params.metadata?.mxUserGuid as string;

      if (!mxUserGuid) {
        throw new Error('MX user GUID required');
      }

      // Verify the member exists
      const memberResponse = await this.membersApi!.readMember(
        MxService.API_VERSION,
        memberGuid,
        mxUserGuid
      );
      const member = memberResponse.data.member;

      if (!member) {
        throw new Error('Invalid MX member');
      }

      // Store encrypted member credentials
      const credentials = {
        memberGuid: member.guid,
        userGuid: mxUserGuid,
        institutionCode: member.institution_code,
      };

      const encryptedToken = this.cryptoService.encrypt(JSON.stringify(credentials));

      // Create provider connection
      await this.prisma.providerConnection.create({
        data: {
          provider: 'mx',
          providerUserId: member.guid,
          encryptedToken: JSON.stringify(encryptedToken),
          metadata: {
            mxUserGuid,
            institutionCode: member.institution_code,
            institutionName: member.name,
            connectedAt: new Date().toISOString(),
          } as InputJsonValue,
          user: { connect: { id: params.userId } },
        },
      });

      return {
        accessToken: member.guid,
        itemId: member.guid,
        institutionId: member.institution_code || '',
        institutionName: member.name || '',
      };
    } catch (error: unknown) {
      this.logger.error('Failed to exchange MX token:', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to exchange MX token'
      );
    }
  }

  async getAccounts(params: GetAccountsParams): Promise<ProviderAccount[]> {
    if (!this.isConfigured) {
      throw new BadRequestException('MX integration not configured');
    }

    try {
      const connection = await this.prisma.providerConnection.findFirst({
        where: {
          userId: params.userId,
          provider: 'mx',
          providerUserId: params.accessToken, // memberGuid
        },
      });

      if (!connection) {
        throw new Error('MX connection not found');
      }

      const metadata = connection.metadata as any;
      const mxUserGuid = metadata.mxUserGuid;

      // Fetch accounts from MX
      const accountsResponse = await this.accountsApi!.listMemberAccounts(
        MxService.API_VERSION,
        mxUserGuid,
        params.accessToken
      );

      const mxAccounts = accountsResponse.data.accounts || [];
      const providerAccounts: ProviderAccount[] = [];

      for (const mxAccount of mxAccounts) {
        providerAccounts.push({
          providerAccountId: mxAccount.guid || '',
          name: mxAccount.name || 'Unknown Account',
          type: this.mapAccountType(mxAccount.type || 'CHECKING'),
          subtype: mxAccount.subtype || mxAccount.type || 'checking',
          balance: mxAccount.balance || 0,
          currency: this.mapCurrency(mxAccount.currency_code || 'USD'),
          mask: mxAccount.account_number?.slice(-4),
          metadata: {
            institutionCode: metadata.institutionCode,
            routingNumber: mxAccount.routing_number,
            availableBalance: mxAccount.available_balance,
            cashBalance: mxAccount.cash_balance,
          },
        });
      }

      return providerAccounts;
    } catch (error: unknown) {
      this.logger.error('Failed to get MX accounts:', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to get MX accounts'
      );
    }
  }

  async syncTransactions(params: SyncTransactionsParams): Promise<SyncTransactionsResult> {
    if (!this.isConfigured) {
      throw new BadRequestException('MX integration not configured');
    }

    try {
      const connection = await this.prisma.providerConnection.findFirst({
        where: {
          userId: params.userId,
          provider: 'mx',
          providerUserId: params.accessToken, // memberGuid
        },
      });

      if (!connection) {
        throw new Error('MX connection not found');
      }

      const metadata = connection.metadata as any;
      const mxUserGuid = metadata.mxUserGuid;
      const memberGuid = params.accessToken;

      // Calculate date range (default 90 days)
      const toDate = String(params.endDate || new Date().toISOString().split('T')[0]);
      const fromDate = String(
        params.startDate ||
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      );

      // Fetch transactions from MX
      let page = 1;
      let hasMore = true;
      let totalAdded = 0;
      let totalModified = 0;

      while (hasMore) {
        const transactionsResponse = await this.transactionsApi!.listTransactionsByMember(
          MxService.API_VERSION,
          mxUserGuid,
          memberGuid,
          page,
          100, // recordsPerPage
          fromDate,
          toDate
        );

        const mxTransactions = transactionsResponse.data.transactions || [];
        hasMore = mxTransactions.length === 100; // Check if there might be more

        for (const mxTxn of mxTransactions) {
          const accountGuid = mxTxn.account_guid;

          // Find corresponding account in our database
          const account = await this.prisma.account.findFirst({
            where: {
              provider: 'mx',
              providerAccountId: accountGuid,
            },
          });

          if (!account) {
            this.logger.warn(`Account not found for MX transaction ${mxTxn.guid}`);
            continue;
          }

          // Check if transaction exists
          const existing = await this.prisma.transaction.findFirst({
            where: {
              providerTransactionId: mxTxn.guid,
            },
          });

          if (!existing) {
            // Create new transaction
            await this.prisma.transaction.create({
              data: {
                accountId: account.id,
                providerTransactionId: mxTxn.guid,
                amount: mxTxn.amount || 0,
                currency: account.currency as Currency,
                date: new Date(mxTxn.transacted_at || mxTxn.posted_at || new Date()),
                description: mxTxn.description || '',
                merchant: (mxTxn as any).merchant_name,
                metadata: {
                  mxCategory: mxTxn.category,
                  mxType: mxTxn.type,
                  mxStatus: mxTxn.status,
                  mxMerchantCategoryCode: mxTxn.merchant_category_code,
                  mxOriginalDescription: mxTxn.original_description,
                } as InputJsonValue,
              },
            });
            totalAdded++;
          } else {
            // Update existing transaction
            await this.prisma.transaction.update({
              where: { id: existing.id },
              data: {
                amount: mxTxn.amount || 0,
                date: new Date(mxTxn.transacted_at || mxTxn.posted_at || new Date()),
                description: mxTxn.description || '',
                merchant: (mxTxn as any).merchant_name,
                metadata: {
                  mxCategory: mxTxn.category,
                  mxType: mxTxn.type,
                  mxStatus: mxTxn.status,
                  mxMerchantCategoryCode: mxTxn.merchant_category_code,
                  mxOriginalDescription: mxTxn.original_description,
                } as InputJsonValue,
              },
            });
            totalModified++;
          }
        }

        page++;

        // Safety check: don't fetch more than configured max pages in one sync
        if (page > PROVIDER_DEFAULTS.MX_MAX_PAGES) {
          this.logger.warn(
            `Reached maximum page limit (${PROVIDER_DEFAULTS.MX_MAX_PAGES}) for MX transaction sync`
          );
          break;
        }
      }

      this.logger.log(
        `MX transaction sync complete: ${totalAdded} added, ${totalModified} modified`
      );

      return {
        transactions: [],
        hasMore: false,
        addedCount: totalAdded,
        modifiedCount: totalModified,
        removedCount: 0,
        added: totalAdded,
        modified: totalModified,
        removed: 0,
        cursor: toDate,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to sync MX transactions:', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to sync MX transactions'
      );
    }
  }

  async handleWebhook(
    payload: Record<string, unknown>,
    signature?: string
  ): Promise<WebhookHandlerResult> {
    if (!this.isConfigured) {
      throw new BadRequestException('MX integration not configured');
    }

    // Verify webhook signature
    if (signature && !this.verifyWebhookSignature(JSON.stringify(payload), signature)) {
      throw new BadRequestException('Invalid MX webhook signature');
    }

    const { type, payload: eventPayload } = payload as {
      type: string;
      payload: Record<string, unknown>;
    };

    this.logger.log(`Received MX webhook: ${type}`);

    try {
      switch (type) {
        case 'MEMBER.CREATED':
        case 'MEMBER.UPDATED':
          // Re-sync accounts when member is updated
          await this.handleMemberUpdate(eventPayload);
          break;

        case 'MEMBER.AGGREGATED':
          // Aggregation complete, sync accounts and transactions
          await this.handleMemberAggregated(eventPayload);
          break;

        case 'ACCOUNT.CREATED':
        case 'ACCOUNT.UPDATED':
          await this.handleAccountUpdate(eventPayload);
          break;

        case 'TRANSACTION.CREATED':
        case 'TRANSACTION.UPDATED':
          // Transactions updated, trigger sync
          await this.handleTransactionUpdate(eventPayload);
          break;

        default:
          this.logger.log(`Unhandled MX webhook type: ${type}`);
      }

      return {
        processed: true,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to handle MX webhook:', error);
      return {
        processed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async searchInstitutions(query: string, region?: string): Promise<InstitutionInfo[]> {
    if (!this.isConfigured) {
      throw new BadRequestException('MX integration not configured');
    }

    try {
      const response = await this.institutionsApi!.listInstitutions(
        MxService.API_VERSION,
        query,
        undefined, // isoCountryCode
        undefined, // page
        20 // recordsPerPage
      );

      const institutions = response.data.institutions || [];

      return institutions.map((inst) => ({
        id: inst.code || '',
        institutionId: inst.code || '',
        name: inst.name || '',
        provider: Provider.mx,
        logo: inst.medium_logo_url,
        primaryColor: (inst as any).brand_color,
        url: inst.url,
        supportedProducts: ['accounts', 'transactions'],
        region: region || 'US',
      }));
    } catch (error: unknown) {
      this.logger.error('Failed to search MX institutions:', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to search institutions'
      );
    }
  }

  async getInstitution(institutionId: string): Promise<InstitutionInfo> {
    if (!this.isConfigured) {
      throw new BadRequestException('MX integration not configured');
    }

    try {
      const response = await this.institutionsApi!.readInstitution(
        MxService.API_VERSION,
        institutionId
      );
      const inst = response.data.institution;

      if (!inst) {
        throw new Error('Institution not found');
      }

      return {
        id: inst.code || '',
        institutionId: inst.code || '',
        name: inst.name || '',
        provider: Provider.mx,
        logo: inst.medium_logo_url,
        primaryColor: (inst as any).brand_color,
        url: inst.url,
        supportedProducts: ['accounts', 'transactions'],
        region: 'US',
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get MX institution:', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to get institution'
      );
    }
  }

  // Helper methods

  private async handleMemberUpdate(payload: Record<string, unknown>) {
    const memberGuid = payload.member_guid;
    const _userGuid = payload.user_guid;

    // Find connection
    const connection = await this.prisma.providerConnection.findFirst({
      where: {
        provider: 'mx',
        providerUserId: memberGuid,
      },
    });

    if (!connection) {
      this.logger.warn(`Connection not found for MX member ${memberGuid}`);
      return;
    }

    // Update metadata
    await this.prisma.providerConnection.update({
      where: { id: connection.id },
      data: {
        metadata: {
          ...(connection.metadata as object),
          lastWebhookAt: new Date().toISOString(),
          lastStatus: payload.status,
        } as InputJsonValue,
      },
    });
  }

  private async handleMemberAggregated(payload: Record<string, unknown>) {
    const memberGuid = payload.member_guid;

    // Find connection and trigger sync
    const connection = await this.prisma.providerConnection.findFirst({
      where: {
        provider: 'mx',
        providerUserId: memberGuid,
      },
    });

    if (!connection) {
      this.logger.warn(`Connection not found for MX member ${memberGuid}`);
      return;
    }

    // Trigger background sync via BullMQ or direct call
    // For now, log that aggregation is complete
    this.logger.log(`MX aggregation complete for member ${memberGuid}`);
  }

  private async handleAccountUpdate(payload: Record<string, unknown>) {
    const accountGuid = payload.account_guid;

    // Find and update account
    const account = await this.prisma.account.findFirst({
      where: {
        provider: 'mx',
        providerAccountId: accountGuid,
      },
    });

    if (!account) {
      this.logger.warn(`Account not found for MX account ${accountGuid}`);
      return;
    }

    // Update balance if provided
    if (payload.balance !== undefined) {
      await this.prisma.account.update({
        where: { id: account.id },
        data: {
          balance: payload.balance,
          lastSyncedAt: new Date(),
        },
      });
    }
  }

  private async handleTransactionUpdate(payload: Record<string, unknown>) {
    // Log transaction update
    this.logger.log(`MX transaction updated: ${payload.transaction_guid}`);
    // In production, trigger background transaction sync
  }

  private verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret || !signature) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');

    return crypto.timingSafeEqual(
      new Uint8Array(Buffer.from(signature, 'hex')),
      new Uint8Array(Buffer.from(expectedSignature, 'hex'))
    );
  }

  private mapAccountType(mxType: string): AccountType {
    const typeMap: Record<string, AccountType> = {
      CHECKING: AccountType.checking,
      SAVINGS: AccountType.savings,
      CREDIT_CARD: AccountType.credit,
      INVESTMENT: AccountType.investment,
      LOAN: AccountType.other,
      LINE_OF_CREDIT: AccountType.credit,
      MORTGAGE: AccountType.other,
    };

    return typeMap[mxType.toUpperCase()] || AccountType.other;
  }

  private mapCurrency(currencyCode: string): Currency {
    const upperCurrency = currencyCode?.toUpperCase();
    switch (upperCurrency) {
      case 'MXN':
        return Currency.MXN;
      case 'USD':
        return Currency.USD;
      case 'EUR':
        return Currency.EUR;
      default:
        return Currency.USD;
    }
  }
}
