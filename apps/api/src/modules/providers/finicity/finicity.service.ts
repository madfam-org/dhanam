import * as crypto from 'crypto';

import { PROVIDER_DEFAULTS } from '@dhanam/shared';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

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
 * Finicity/Mastercard Open Banking Integration - Tertiary provider
 * Provides financial data aggregation across US and Canada
 * https://developer.mastercard.com/open-banking-us/documentation/
 */
@Injectable()
export class FinicityService implements IFinancialProvider {
  readonly name = Provider.finicity;
  private readonly logger = new Logger(FinicityService.name);
  private readonly partnerId: string;
  private readonly partnerSecret: string;
  private readonly appKey: string;
  private readonly baseUrl: string;
  private readonly webhookSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private cryptoService: CryptoService,
    private httpService: HttpService
  ) {
    this.partnerId = this.configService.get('FINICITY_PARTNER_ID', '');
    this.partnerSecret = this.configService.get('FINICITY_PARTNER_SECRET', '');
    this.appKey = this.configService.get('FINICITY_APP_KEY', '');
    this.baseUrl = this.configService.get(
      'FINICITY_BASE_URL',
      'https://api.finicity.com' // Production URL
    );
    this.webhookSecret = this.configService.get('FINICITY_WEBHOOK_SECRET', '');

    if (!this.partnerId || !this.partnerSecret || !this.appKey) {
      this.logger.warn('Finicity credentials not configured, service disabled');
    } else {
      this.logger.log('Finicity service initialized');
    }
  }

  /**
   * Get or refresh Finicity partner token
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/aggregation/v2/partners/authentication`,
          {
            partnerId: this.partnerId,
            partnerSecret: this.partnerSecret,
          },
          {
            headers: {
              'Finicity-App-Key': this.appKey,
              'Content-Type': 'application/json',
            },
          }
        )
      );

      this.accessToken = response.data.token;
      // Token expires in 2 hours, refresh 5 minutes before
      this.tokenExpiry = new Date(Date.now() + 115 * 60 * 1000);

      return this.accessToken!;
    } catch (error: unknown) {
      this.logger.error('Failed to get Finicity access token:', error);
      throw new Error('Finicity authentication failed', { cause: error });
    }
  }

  async healthCheck(): Promise<ProviderHealthCheck> {
    const startTime = Date.now();

    if (!this.partnerId || !this.partnerSecret || !this.appKey) {
      return {
        provider: Provider.finicity,
        status: 'down',
        errorRate: 100,
        avgResponseTimeMs: 0,
        lastCheckedAt: new Date(),
        error: 'Finicity not configured',
      };
    }

    try {
      // Ping Finicity by getting partner authentication
      await this.getAccessToken();
      const responseTimeMs = Date.now() - startTime;

      return {
        provider: Provider.finicity,
        status: 'healthy',
        errorRate: 0,
        avgResponseTimeMs: responseTimeMs,
        lastCheckedAt: new Date(),
      };
    } catch (error: unknown) {
      return {
        provider: Provider.finicity,
        status: 'down',
        errorRate: 100,
        avgResponseTimeMs: Date.now() - startTime,
        lastCheckedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async createLink(params: CreateLinkParams): Promise<LinkResult> {
    if (!this.partnerId || !this.appKey) {
      throw new BadRequestException('Finicity integration not configured');
    }

    try {
      const token = await this.getAccessToken();

      // Step 1: Create a Finicity customer (or use existing)
      let customerId = params.metadata?.finicityCustomerId as string | undefined;

      if (!customerId) {
        const createCustomerResponse = await firstValueFrom(
          this.httpService.post(
            `${this.baseUrl}/aggregation/v2/customers/testing`,
            {
              username: `dhanam_${params.userId}`,
              firstName: 'Dhanam',
              lastName: 'User',
            },
            {
              headers: {
                'Finicity-App-Key': this.appKey,
                'Finicity-App-Token': token,
                'Content-Type': 'application/json',
              },
            }
          )
        );

        customerId = createCustomerResponse.data.id;
      }

      // Step 2: Generate Connect URL
      const connectResponse = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/connect/v2/generate`,
          {
            partnerId: this.partnerId,
            customerId: customerId,
            redirectUri:
              params.redirectUri ||
              `${this.configService.get('WEB_URL', 'https://app.dhan.am')}/connect/callback`,
            webhook: this.configService.get('FINICITY_WEBHOOK_URL'),
            webhookContentType: 'application/json',
          },
          {
            headers: {
              'Finicity-App-Key': this.appKey,
              'Finicity-App-Token': token,
              'Content-Type': 'application/json',
            },
          }
        )
      );

      const connectUrl = connectResponse.data.link;

      if (!connectUrl) {
        throw new Error('Failed to generate Finicity Connect URL');
      }

      return {
        linkToken: connectUrl,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        expiration: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes (legacy)
        metadata: {
          finicityCustomerId: customerId,
          provider: 'finicity',
        },
      };
    } catch (error: unknown) {
      this.logger.error('Failed to create Finicity Link:', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to create Finicity link'
      );
    }
  }

  async exchangeToken(params: ExchangeTokenParams): Promise<ExchangeTokenResult> {
    if (!this.appKey) {
      throw new BadRequestException('Finicity integration not configured');
    }

    try {
      const token = await this.getAccessToken();
      const customerId = params.metadata?.finicityCustomerId as string;

      if (!customerId) {
        throw new Error('Finicity customer ID required');
      }

      // After Connect flow, fetch the added accounts
      const accountsResponse = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/aggregation/v1/customers/${customerId}/accounts`, {
          headers: {
            'Finicity-App-Key': this.appKey,
            'Finicity-App-Token': token,
            Accept: 'application/json',
          },
        })
      );

      const accounts = accountsResponse.data.accounts || [];

      if (accounts.length === 0) {
        throw new Error('No accounts found after Finicity Connect');
      }

      // Get the first account's institution info
      const firstAccount = accounts[0];
      const institutionId = firstAccount.institutionId;

      // Store encrypted customer ID
      const credentials = {
        customerId,
        institutionId,
      };

      const encryptedToken = this.cryptoService.encrypt(JSON.stringify(credentials));

      // Create provider connection
      await this.prisma.providerConnection.create({
        data: {
          provider: 'finicity',
          providerUserId: customerId,
          encryptedToken: JSON.stringify(encryptedToken),
          metadata: {
            finicityCustomerId: customerId,
            institutionId,
            connectedAt: new Date().toISOString(),
          } as InputJsonValue,
          user: { connect: { id: params.userId } },
        },
      });

      return {
        accessToken: customerId,
        itemId: customerId,
        institutionId: institutionId || '',
        institutionName: firstAccount.institutionName || '',
      };
    } catch (error: unknown) {
      this.logger.error('Failed to exchange Finicity token:', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to exchange Finicity token'
      );
    }
  }

  async getAccounts(params: GetAccountsParams): Promise<ProviderAccount[]> {
    if (!this.appKey) {
      throw new BadRequestException('Finicity integration not configured');
    }

    try {
      const token = await this.getAccessToken();
      const customerId = params.accessToken; // customerId

      // Fetch accounts from Finicity
      const accountsResponse = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/aggregation/v1/customers/${customerId}/accounts`, {
          headers: {
            'Finicity-App-Key': this.appKey,
            'Finicity-App-Token': token,
            Accept: 'application/json',
          },
        })
      );

      const finicityAccounts = accountsResponse.data.accounts || [];
      const providerAccounts: ProviderAccount[] = [];

      for (const finicityAccount of finicityAccounts) {
        providerAccounts.push({
          providerAccountId: finicityAccount.id,
          name: finicityAccount.name || 'Unknown Account',
          type: this.mapAccountType(finicityAccount.type),
          subtype: finicityAccount.type?.toLowerCase() || 'checking',
          balance: finicityAccount.balance || 0,
          currency: this.mapCurrency(finicityAccount.currency || 'USD'),
          mask: finicityAccount.number?.slice(-4),
          metadata: {
            institutionId: finicityAccount.institutionId,
            institutionName: finicityAccount.institutionName,
            accountNumberDisplay: finicityAccount.displayPosition,
            status: finicityAccount.status,
          },
        });
      }

      return providerAccounts;
    } catch (error: unknown) {
      this.logger.error('Failed to get Finicity accounts:', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to get Finicity accounts'
      );
    }
  }

  async syncTransactions(params: SyncTransactionsParams): Promise<SyncTransactionsResult> {
    if (!this.appKey) {
      throw new BadRequestException('Finicity integration not configured');
    }

    try {
      const token = await this.getAccessToken();
      const customerId = params.accessToken; // customerId

      // Calculate date range (default 90 days)
      const toDate = params.endDate
        ? Math.floor(new Date(params.endDate).getTime() / 1000)
        : Math.floor(Date.now() / 1000);
      const fromDate = params.startDate
        ? Math.floor(new Date(params.startDate).getTime() / 1000)
        : Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);

      // Fetch all accounts for customer
      const accountsResponse = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/aggregation/v1/customers/${customerId}/accounts`, {
          headers: {
            'Finicity-App-Key': this.appKey,
            'Finicity-App-Token': token,
            Accept: 'application/json',
          },
        })
      );

      const finicityAccounts = accountsResponse.data.accounts || [];
      let totalAdded = 0;
      let totalModified = 0;

      // Fetch transactions for each account
      for (const finicityAccount of finicityAccounts) {
        const accountId = finicityAccount.id;

        const transactionsResponse = await firstValueFrom(
          this.httpService.get(
            `${this.baseUrl}/aggregation/v3/customers/${customerId}/accounts/${accountId}/transactions`,
            {
              headers: {
                'Finicity-App-Key': this.appKey,
                'Finicity-App-Token': token,
                Accept: 'application/json',
              },
              params: {
                fromDate,
                toDate,
                limit: PROVIDER_DEFAULTS.FINICITY_FETCH_LIMIT,
              },
            }
          )
        );

        const finicityTransactions = transactionsResponse.data.transactions || [];

        for (const finicityTxn of finicityTransactions) {
          // Find corresponding account in our database
          const account = await this.prisma.account.findFirst({
            where: {
              provider: 'finicity',
              providerAccountId: accountId,
            },
          });

          if (!account) {
            this.logger.warn(`Account not found for Finicity transaction ${finicityTxn.id}`);
            continue;
          }

          // Check if transaction exists
          const existing = await this.prisma.transaction.findFirst({
            where: {
              providerTransactionId: finicityTxn.id.toString(),
            },
          });

          if (!existing) {
            // Create new transaction
            await this.prisma.transaction.create({
              data: {
                accountId: account.id,
                providerTransactionId: finicityTxn.id.toString(),
                amount: finicityTxn.amount || 0,
                currency: account.currency as Currency,
                date: new Date(finicityTxn.postedDate * 1000 || finicityTxn.transactionDate * 1000),
                description: finicityTxn.description || '',
                merchant: finicityTxn.normalizedPayeeName,
                metadata: {
                  finicityCategory: finicityTxn.categorization?.category,
                  finicityType: finicityTxn.type,
                  finicityStatus: finicityTxn.status,
                  finicityMemo: finicityTxn.memo,
                } as InputJsonValue,
              },
            });
            totalAdded++;
          } else {
            // Update existing transaction
            await this.prisma.transaction.update({
              where: { id: existing.id },
              data: {
                amount: finicityTxn.amount || 0,
                date: new Date(finicityTxn.postedDate * 1000 || finicityTxn.transactionDate * 1000),
                description: finicityTxn.description || '',
                merchant: finicityTxn.normalizedPayeeName,
                metadata: {
                  finicityCategory: finicityTxn.categorization?.category,
                  finicityType: finicityTxn.type,
                  finicityStatus: finicityTxn.status,
                  finicityMemo: finicityTxn.memo,
                } as InputJsonValue,
              },
            });
            totalModified++;
          }
        }
      }

      this.logger.log(
        `Finicity transaction sync complete: ${totalAdded} added, ${totalModified} modified`
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
        cursor: toDate.toString(),
      };
    } catch (error: unknown) {
      this.logger.error('Failed to sync Finicity transactions:', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to sync Finicity transactions'
      );
    }
  }

  async handleWebhook(
    payload: Record<string, unknown>,
    signature?: string
  ): Promise<WebhookHandlerResult> {
    if (!this.appKey) {
      throw new BadRequestException('Finicity integration not configured');
    }

    // Verify webhook signature
    if (signature && !this.verifyWebhookSignature(JSON.stringify(payload), signature)) {
      throw new BadRequestException('Invalid Finicity webhook signature');
    }

    const { eventType, customerId, accountId } = payload as {
      eventType: string;
      customerId: string;
      accountId: string;
    };

    this.logger.log(`Received Finicity webhook: ${eventType}`);

    try {
      switch (eventType) {
        case 'aggregation':
        case 'account.created':
        case 'account.updated':
          // Re-sync accounts
          await this.handleAccountEvent(customerId, accountId);
          break;

        case 'transaction.created':
        case 'transaction.updated':
          // Trigger transaction sync
          await this.handleTransactionEvent(customerId, accountId);
          break;

        default:
          this.logger.log(`Unhandled Finicity webhook type: ${eventType}`);
      }

      return {
        processed: true,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to handle Finicity webhook:', error);
      return {
        processed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async searchInstitutions(query: string, region?: string): Promise<InstitutionInfo[]> {
    if (!this.appKey) {
      throw new BadRequestException('Finicity integration not configured');
    }

    try {
      const token = await this.getAccessToken();

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/institution/v2/institutions`, {
          headers: {
            'Finicity-App-Key': this.appKey,
            'Finicity-App-Token': token,
            Accept: 'application/json',
          },
          params: {
            search: query,
            start: 1,
            limit: PROVIDER_DEFAULTS.FINICITY_MAX_ACCOUNTS,
          },
        })
      );

      const institutions = response.data.institutions || [];

      return institutions.map(
        (
          inst: Record<string, unknown> & {
            id: number;
            name?: string;
            branding?: { logo?: string; primaryColor?: string };
            urlHomeApp?: string;
          }
        ) => ({
          institutionId: inst.id.toString(),
          name: inst.name || '',
          logo: inst.branding?.logo,
          primaryColor: inst.branding?.primaryColor,
          url: inst.urlHomeApp,
          supportedProducts: ['accounts', 'transactions'],
          region: region || 'US',
        })
      );
    } catch (error: unknown) {
      this.logger.error('Failed to search Finicity institutions:', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to search institutions'
      );
    }
  }

  async getInstitution(institutionId: string): Promise<InstitutionInfo> {
    if (!this.appKey) {
      throw new BadRequestException('Finicity integration not configured');
    }

    try {
      const token = await this.getAccessToken();

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/institution/v2/institutions/${institutionId}`, {
          headers: {
            'Finicity-App-Key': this.appKey,
            'Finicity-App-Token': token,
            Accept: 'application/json',
          },
        })
      );

      const inst = response.data.institution;

      if (!inst) {
        throw new Error('Institution not found');
      }

      return {
        id: inst.id.toString(),
        institutionId: inst.id.toString(),
        name: inst.name || '',
        provider: Provider.finicity,
        logo: inst.branding?.logo,
        primaryColor: inst.branding?.primaryColor,
        url: inst.urlHomeApp,
        supportedProducts: ['accounts', 'transactions'],
        region: 'US',
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get Finicity institution:', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to get institution'
      );
    }
  }

  // Helper methods

  private async handleAccountEvent(customerId: string, accountId: string) {
    // Find connection and update account
    const connection = await this.prisma.providerConnection.findFirst({
      where: {
        provider: 'finicity',
        providerUserId: customerId,
      },
    });

    if (!connection) {
      this.logger.warn(`Connection not found for Finicity customer ${customerId}`);
      return;
    }

    this.logger.log(`Finicity account event for customer ${customerId}, account ${accountId}`);
    // In production, trigger background account sync
  }

  private async handleTransactionEvent(customerId: string, accountId: string) {
    this.logger.log(`Finicity transaction event for customer ${customerId}, account ${accountId}`);
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

  private mapAccountType(finicityType: string): AccountType {
    const typeMap: Record<string, AccountType> = {
      checking: AccountType.checking,
      savings: AccountType.savings,
      moneyMarket: AccountType.savings,
      cd: AccountType.savings,
      creditCard: AccountType.credit,
      lineOfCredit: AccountType.credit,
      investment: AccountType.investment,
      investmentTaxDeferred: AccountType.investment,
      employeeStockPurchasePlan: AccountType.investment,
      ira: AccountType.investment,
      '401k': AccountType.investment,
      roth: AccountType.investment,
      mortgage: AccountType.other,
      loan: AccountType.other,
    };

    return typeMap[finicityType] || AccountType.other;
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
