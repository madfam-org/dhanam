import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { Currency } from '@db';

import { CryptoService } from '../../../core/crypto/crypto.service';
import { PrismaService } from '../../../core/prisma/prisma.service';

import { MxService } from './mx.service';

// Mock Prisma Provider and Currency enums
jest.mock('@prisma/client', () => ({
  ...jest.requireActual('@prisma/client'),
  Provider: {
    plaid: 'plaid',
    belvo: 'belvo',
    mx: 'mx',
    finicity: 'finicity',
    bitso: 'bitso',
    manual: 'manual',
  },
  Currency: {
    USD: 'USD',
    MXN: 'MXN',
    EUR: 'EUR',
  },
}));

// Mock MX Platform SDK
// Define mock functions outside so they can be referenced
const mockListInstitutions = jest.fn();
const mockReadInstitution = jest.fn();
const mockCreateUser = jest.fn();
const mockRequestWidgetURL = jest.fn();
const mockReadMember = jest.fn();
const mockListMemberAccounts = jest.fn();
const mockListTransactionsByMember = jest.fn();

// Mock MX Platform SDK
jest.mock('mx-platform-node', () => ({
  Configuration: jest.fn().mockImplementation(() => ({})),
  InstitutionsApi: jest.fn().mockImplementation(() => ({
    listInstitutions: mockListInstitutions,
    readInstitution: mockReadInstitution,
  })),
  UsersApi: jest.fn().mockImplementation(() => ({
    createUser: mockCreateUser,
  })),
  WidgetsApi: jest.fn().mockImplementation(() => ({
    requestWidgetURL: mockRequestWidgetURL,
  })),
  MembersApi: jest.fn().mockImplementation(() => ({
    readMember: mockReadMember,
  })),
  AccountsApi: jest.fn().mockImplementation(() => ({
    listMemberAccounts: mockListMemberAccounts,
  })),
  TransactionsApi: jest.fn().mockImplementation(() => ({
    listTransactionsByMember: mockListTransactionsByMember,
  })),
}));

// Import Provider after the mock
const { Provider } = require('@prisma/client');

describe('MxService', () => {
  let service: MxService;
  let prisma: PrismaService;
  let configService: ConfigService;
  let cryptoService: CryptoService;
  let mockMxClient: any;

  const mockPrisma = {
    providerConnection: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    account: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        MX_API_KEY: 'test-api-key',
        MX_CLIENT_ID: 'test-client-id',
        MX_BASE_URL: 'https://int-api.mx.com',
        MX_WEBHOOK_SECRET: 'test-webhook-secret',
      };
      return config[key] || defaultValue;
    }),
  };

  const mockCryptoService = {
    encrypt: jest.fn((data: string) => ({
      encryptedData: `encrypted_${data}`,
      iv: 'test-iv',
      tag: 'test-tag',
    })),
    decrypt: jest.fn((encrypted: any) => 'decrypted-data'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MxService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CryptoService,
          useValue: mockCryptoService,
        },
      ],
    }).compile();

    service = module.get<MxService>(MxService);
    prisma = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
    cryptoService = module.get<CryptoService>(CryptoService);

    // Access the private mxClient for mocking - Wait, we need to map the mocks to the unified object expected by tests
    // The tests expect mockMxClient to have all methods.
    mockMxClient = {
      listInstitutions: mockListInstitutions,
      readInstitution: mockReadInstitution,
      createUser: mockCreateUser,
      requestWidgetURL: mockRequestWidgetURL,
      readMember: mockReadMember,
      listMemberAccounts: mockListMemberAccounts,
      listTransactionsByMember: mockListTransactionsByMember,
    };

    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with valid credentials', () => {
      expect(service).toBeDefined();
      expect(service.name).toBe(Provider.mx);
    });

    it('should handle missing credentials gracefully', () => {
      const mockConfigWithoutCreds = {
        get: jest.fn(() => ''),
      };

      const module = Test.createTestingModule({
        providers: [
          MxService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ConfigService, useValue: mockConfigWithoutCreds },
          { provide: CryptoService, useValue: mockCryptoService },
        ],
      });

      expect(module.compile()).resolves.toBeDefined();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when MX is accessible', async () => {
      mockMxClient.listInstitutions.mockResolvedValue({
        data: { institutions: [] },
      });

      const result = await service.healthCheck();

      expect(result.provider).toBe(Provider.mx);
      expect(result.status).toBe('healthy');
      expect(result.errorRate).toBe(0);
      expect(result.avgResponseTimeMs).toBeGreaterThanOrEqual(0); // Can be 0 in fast test environment
      expect(result.lastCheckedAt).toBeInstanceOf(Date);
      expect(mockMxClient.listInstitutions).toHaveBeenCalledWith('1', undefined, undefined, 1, 1);
    });

    it('should return down status when MX is not configured', async () => {
      const serviceWithoutClient = new MxService(
        prisma,
        {
          get: jest.fn(() => ''),
        } as any,
        cryptoService
      );

      const result = await serviceWithoutClient.healthCheck();

      expect(result.provider).toBe(Provider.mx);
      expect(result.status).toBe('down');
      expect(result.errorRate).toBe(100);
      expect(result.error).toBe('MX not configured');
    });

    it('should return down status when MX API fails', async () => {
      mockMxClient.listInstitutions.mockRejectedValue(new Error('Network error'));

      const result = await service.healthCheck();

      expect(result.provider).toBe(Provider.mx);
      expect(result.status).toBe('down');
      expect(result.errorRate).toBe(100);
      expect(result.error).toBe('Network error');
    });
  });

  describe('createLink', () => {
    it('should create MX link for new user', async () => {
      const userId = 'user123';
      const params = {
        userId,
        redirectUri: 'https://app.dhanam.io/callback',
      };

      mockMxClient.createUser.mockResolvedValue({
        data: {
          user: {
            guid: 'mx-user-guid-123',
          },
        },
      });

      mockMxClient.requestWidgetURL.mockResolvedValue({
        data: {
          widget_url: {
            url: 'https://int-widgets.moneydesktop.com/md/connect/abc123',
          },
        },
      });

      const result = await service.createLink(params);

      expect(result.linkToken).toBe('https://int-widgets.moneydesktop.com/md/connect/abc123');
      expect(result.expiration).toBeInstanceOf(Date);
      expect(result.metadata).toEqual({
        mxUserGuid: 'mx-user-guid-123',
        provider: 'mx',
      });

      expect(mockMxClient.createUser).toHaveBeenCalledWith('1', {
        user: {
          metadata: JSON.stringify({ dhanamUserId: userId }),
        },
      });

      expect(mockMxClient.requestWidgetURL).toHaveBeenCalledWith('1', 'mx-user-guid-123', {
        widget_url: {
          widget_type: 'connect_widget',
          mode: 'verification',
          ui_message_version: 4,
          wait_for_full_aggregation: false,
        },
      });
    });

    it('should create MX link for existing MX user', async () => {
      const params = {
        userId: 'user123',
        metadata: {
          mxUserGuid: 'existing-mx-guid',
        },
      };

      mockMxClient.requestWidgetURL.mockResolvedValue({
        data: {
          widget_url: {
            url: 'https://int-widgets.moneydesktop.com/md/connect/xyz789',
          },
        },
      });

      const result = await service.createLink(params);

      expect(result.linkToken).toBe('https://int-widgets.moneydesktop.com/md/connect/xyz789');
      expect(result.metadata?.mxUserGuid).toBe('existing-mx-guid');
      expect(mockMxClient.createUser).not.toHaveBeenCalled(); // Should not create new user
    });

    it('should throw error when MX not configured', async () => {
      const serviceWithoutClient = new MxService(
        prisma,
        { get: jest.fn(() => '') } as any,
        cryptoService
      );

      await expect(serviceWithoutClient.createLink({ userId: 'user123' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw error when user creation fails', async () => {
      mockMxClient.createUser.mockResolvedValue({
        data: {
          user: null, // Failed to create
        },
      });

      await expect(service.createLink({ userId: 'user123' })).rejects.toThrow(
        'Failed to create MX user'
      );
    });

    it('should throw error when widget URL generation fails', async () => {
      mockMxClient.createUser.mockResolvedValue({
        data: {
          user: { guid: 'mx-guid' },
        },
      });

      mockMxClient.requestWidgetURL.mockResolvedValue({
        data: {
          widget_url: null, // Failed to generate
        },
      });

      await expect(service.createLink({ userId: 'user123' })).rejects.toThrow(
        'Failed to generate MX widget URL'
      );
    });
  });

  describe('exchangeToken', () => {
    it('should exchange public token for access token', async () => {
      const params = {
        userId: 'user123',
        publicToken: 'mx-member-guid',
        metadata: {
          mxUserGuid: 'mx-user-guid',
        },
      };

      mockMxClient.readMember.mockResolvedValue({
        data: {
          member: {
            guid: 'mx-member-guid',
            institution_code: 'chase',
            name: 'Chase Bank',
          },
        },
      });

      mockPrisma.providerConnection.create.mockResolvedValue({
        id: 'conn123',
        provider: 'mx',
      });

      const result = await service.exchangeToken(params);

      expect(result.accessToken).toBe('mx-member-guid');
      expect(result.itemId).toBe('mx-member-guid');
      expect(result.institutionId).toBe('chase');
      expect(result.institutionName).toBe('Chase Bank');

      expect(mockCryptoService.encrypt).toHaveBeenCalled();
      expect(mockPrisma.providerConnection.create).toHaveBeenCalled();
    });

    it('should throw error when MX user GUID is missing', async () => {
      const params = {
        userId: 'user123',
        publicToken: 'mx-member-guid',
        metadata: {}, // No mxUserGuid
      };

      await expect(service.exchangeToken(params)).rejects.toThrow('MX user GUID required');
    });

    it('should throw error when member is invalid', async () => {
      const params = {
        userId: 'user123',
        publicToken: 'invalid-member-guid',
        metadata: {
          mxUserGuid: 'mx-user-guid',
        },
      };

      mockMxClient.readMember.mockResolvedValue({
        data: {
          member: null, // Invalid member
        },
      });

      await expect(service.exchangeToken(params)).rejects.toThrow('Invalid MX member');
    });
  });

  describe('getAccounts', () => {
    it('should fetch accounts from MX', async () => {
      const params = {
        userId: 'user123',
        accessToken: 'mx-member-guid',
      };

      mockPrisma.providerConnection.findFirst.mockResolvedValue({
        id: 'conn123',
        userId: 'user123',
        provider: 'mx',
        providerUserId: 'mx-member-guid',
        metadata: {
          mxUserGuid: 'mx-user-guid',
          institutionCode: 'chase',
        },
      });

      mockMxClient.listMemberAccounts.mockResolvedValue({
        data: {
          accounts: [
            {
              guid: 'mx-acc-1',
              name: 'Chase Checking',
              type: 'CHECKING',
              subtype: 'checking',
              balance: 5000,
              currency_code: 'USD',
              account_number: '****1234',
              routing_number: '021000021',
            },
            {
              guid: 'mx-acc-2',
              name: 'Chase Savings',
              type: 'SAVINGS',
              balance: 10000,
              currency_code: 'USD',
            },
          ],
        },
      });

      const result = await service.getAccounts(params);

      expect(result).toHaveLength(2);
      expect(result[0].providerAccountId).toBe('mx-acc-1');
      expect(result[0].name).toBe('Chase Checking');
      expect(result[0].type).toBe('checking');
      expect(result[0].balance).toBe(5000);
      expect(result[0].currency).toBe(Currency.USD);
      expect(result[0].mask).toBe('1234');

      expect(result[1].providerAccountId).toBe('mx-acc-2');
      expect(result[1].type).toBe('savings');
    });

    it('should throw error when connection not found', async () => {
      mockPrisma.providerConnection.findFirst.mockResolvedValue(null);

      await expect(
        service.getAccounts({ userId: 'user123', accessToken: 'invalid' })
      ).rejects.toThrow('MX connection not found');
    });

    it('should map account types correctly', async () => {
      mockPrisma.providerConnection.findFirst.mockResolvedValue({
        metadata: { mxUserGuid: 'mx-user-guid' },
      });

      mockMxClient.listMemberAccounts.mockResolvedValue({
        data: {
          accounts: [
            { guid: '1', type: 'CHECKING', balance: 1000, currency_code: 'USD' },
            { guid: '2', type: 'SAVINGS', balance: 2000, currency_code: 'USD' },
            { guid: '3', type: 'CREDIT_CARD', balance: -500, currency_code: 'USD' },
            { guid: '4', type: 'INVESTMENT', balance: 50000, currency_code: 'USD' },
            { guid: '5', type: 'LOAN', balance: -10000, currency_code: 'USD' },
          ],
        },
      });

      const result = await service.getAccounts({ userId: 'user123', accessToken: 'token' });

      expect(result[0].type).toBe('checking');
      expect(result[1].type).toBe('savings');
      expect(result[2].type).toBe('credit');
      expect(result[3].type).toBe('investment');
      expect(result[4].type).toBe('other');
    });

    it('should map currencies correctly', async () => {
      mockPrisma.providerConnection.findFirst.mockResolvedValue({
        metadata: { mxUserGuid: 'mx-user-guid' },
      });

      mockMxClient.listMemberAccounts.mockResolvedValue({
        data: {
          accounts: [
            { guid: '1', type: 'CHECKING', balance: 1000, currency_code: 'USD' },
            { guid: '2', type: 'CHECKING', balance: 2000, currency_code: 'MXN' },
            { guid: '3', type: 'CHECKING', balance: 3000, currency_code: 'EUR' },
            { guid: '4', type: 'CHECKING', balance: 4000, currency_code: 'GBP' }, // Defaults to USD
          ],
        },
      });

      const result = await service.getAccounts({ userId: 'user123', accessToken: 'token' });

      expect(result[0].currency).toBe(Currency.USD);
      expect(result[1].currency).toBe(Currency.MXN);
      expect(result[2].currency).toBe(Currency.EUR);
      expect(result[3].currency).toBe(Currency.USD); // Default
    });
  });

  describe('syncTransactions', () => {
    it('should sync transactions from MX', async () => {
      const params = {
        userId: 'user123',
        accessToken: 'mx-member-guid',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      mockPrisma.providerConnection.findFirst.mockResolvedValue({
        metadata: { mxUserGuid: 'mx-user-guid' },
      });

      mockMxClient.listTransactionsByMember.mockResolvedValue({
        data: {
          transactions: [
            {
              guid: 'mx-txn-1',
              account_guid: 'mx-acc-1',
              amount: -50.0,
              description: 'Starbucks',
              merchant_name: 'Starbucks',
              category: 'Food & Dining',
              type: 'DEBIT',
              status: 'POSTED',
              transacted_at: '2024-01-15T10:00:00Z',
            },
            {
              guid: 'mx-txn-2',
              account_guid: 'mx-acc-1',
              amount: 1000.0,
              description: 'Paycheck',
              category: 'Income',
              type: 'CREDIT',
              status: 'POSTED',
              posted_at: '2024-01-01T00:00:00Z',
            },
          ],
        },
      });

      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc123',
        currency: 'USD',
      });

      mockPrisma.transaction.findFirst.mockResolvedValue(null); // New transactions

      mockPrisma.transaction.create.mockResolvedValue({});

      const result = await service.syncTransactions(params);

      expect(result.added).toBe(2);
      expect(result.modified).toBe(0);
      expect(result.removed).toBe(0);

      expect(mockPrisma.transaction.create).toHaveBeenCalledTimes(2);
    });

    it('should update existing transactions', async () => {
      mockPrisma.providerConnection.findFirst.mockResolvedValue({
        metadata: { mxUserGuid: 'mx-user-guid' },
      });

      mockMxClient.listTransactionsByMember.mockResolvedValue({
        data: {
          transactions: [
            {
              guid: 'mx-txn-1',
              account_guid: 'mx-acc-1',
              amount: -50.0,
              description: 'Starbucks Updated',
              transacted_at: '2024-01-15T10:00:00Z',
            },
          ],
        },
      });

      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc123',
        currency: 'USD',
      });

      mockPrisma.transaction.findFirst.mockResolvedValue({
        id: 'txn123', // Existing transaction
      });

      mockPrisma.transaction.update.mockResolvedValue({});

      const result = await service.syncTransactions({
        userId: 'user123',
        accessToken: 'token',
      });

      expect(result.added).toBe(0);
      expect(result.modified).toBe(1);
      expect(mockPrisma.transaction.update).toHaveBeenCalledTimes(1);
    });

    it('should handle pagination with multiple pages', async () => {
      mockPrisma.providerConnection.findFirst.mockResolvedValue({
        metadata: { mxUserGuid: 'mx-user-guid' },
      });

      // First page with 100 transactions (full page)
      const firstPageTransactions = Array(100)
        .fill(null)
        .map((_, i) => ({
          guid: `mx-txn-${i}`,
          account_guid: 'mx-acc-1',
          amount: -10.0,
          description: `Transaction ${i}`,
          transacted_at: '2024-01-15T10:00:00Z',
        }));

      // Second page with 50 transactions (partial page)
      const secondPageTransactions = Array(50)
        .fill(null)
        .map((_, i) => ({
          guid: `mx-txn-${100 + i}`,
          account_guid: 'mx-acc-1',
          amount: -10.0,
          description: `Transaction ${100 + i}`,
          transacted_at: '2024-01-15T10:00:00Z',
        }));

      mockMxClient.listTransactionsByMember
        .mockResolvedValueOnce({ data: { transactions: firstPageTransactions } })
        .mockResolvedValueOnce({ data: { transactions: secondPageTransactions } });

      mockPrisma.account.findFirst.mockResolvedValue({ id: 'acc123', currency: 'USD' });
      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue({});

      const result = await service.syncTransactions({
        userId: 'user123',
        accessToken: 'token',
      });

      expect(result.added).toBe(150);
      expect(mockMxClient.listTransactionsByMember).toHaveBeenCalledTimes(2);
    });

    it('should skip transactions for accounts not found', async () => {
      mockPrisma.providerConnection.findFirst.mockResolvedValue({
        metadata: { mxUserGuid: 'mx-user-guid' },
      });

      mockMxClient.listTransactionsByMember.mockResolvedValue({
        data: {
          transactions: [
            {
              guid: 'mx-txn-1',
              account_guid: 'unknown-account',
              amount: -50.0,
              transacted_at: '2024-01-15T10:00:00Z',
            },
          ],
        },
      });

      mockPrisma.account.findFirst.mockResolvedValue(null); // Account not found

      const result = await service.syncTransactions({
        userId: 'user123',
        accessToken: 'token',
      });

      expect(result.added).toBe(0);
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });

    it('should respect safety limit of 10 pages', async () => {
      mockPrisma.providerConnection.findFirst.mockResolvedValue({
        metadata: { mxUserGuid: 'mx-user-guid' },
      });

      // Always return full pages
      mockMxClient.listTransactionsByMember.mockResolvedValue({
        data: {
          transactions: Array(100).fill({
            guid: 'mx-txn-x',
            account_guid: 'mx-acc-1',
            amount: -10.0,
            transacted_at: '2024-01-15T10:00:00Z',
          }),
        },
      });

      mockPrisma.account.findFirst.mockResolvedValue({ id: 'acc123', currency: 'USD' });
      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue({});

      await service.syncTransactions({
        userId: 'user123',
        accessToken: 'token',
      });

      expect(mockMxClient.listTransactionsByMember).toHaveBeenCalledTimes(10);
    });
  });

  describe('handleWebhook', () => {
    it('should process MEMBER.UPDATED webhook', async () => {
      const payload = {
        type: 'MEMBER.UPDATED',
        payload: {
          member_guid: 'mx-member-123',
          user_guid: 'mx-user-123',
          status: 'UPDATED',
        },
      };

      mockPrisma.providerConnection.findFirst.mockResolvedValue({
        id: 'conn123',
        metadata: {},
      });

      mockPrisma.providerConnection.update.mockResolvedValue({});

      const result = await service.handleWebhook(payload);

      expect(result.processed).toBe(true);
      expect(mockPrisma.providerConnection.update).toHaveBeenCalled();
    });

    it('should process MEMBER.AGGREGATED webhook', async () => {
      const payload = {
        type: 'MEMBER.AGGREGATED',
        payload: {
          member_guid: 'mx-member-123',
          user_guid: 'mx-user-123',
        },
      };

      mockPrisma.providerConnection.findFirst.mockResolvedValue({
        id: 'conn123',
      });

      const result = await service.handleWebhook(payload);

      expect(result.processed).toBe(true);
    });

    it('should process ACCOUNT.UPDATED webhook', async () => {
      const payload = {
        type: 'ACCOUNT.UPDATED',
        payload: {
          account_guid: 'mx-acc-123',
          balance: 5000,
        },
      };

      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc123',
      });

      mockPrisma.account.update.mockResolvedValue({});

      const result = await service.handleWebhook(payload);

      expect(result.processed).toBe(true);
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc123' },
        data: {
          balance: 5000,
          lastSyncedAt: expect.any(Date),
        },
      });
    });

    it('should handle unrecognized webhook types', async () => {
      const payload = {
        type: 'UNKNOWN.EVENT',
        payload: {},
      };

      const result = await service.handleWebhook(payload);

      expect(result.processed).toBe(true);
    });

    it('should return error when webhook processing fails', async () => {
      const payload = {
        type: 'MEMBER.UPDATED',
        payload: {
          member_guid: 'mx-member-123',
        },
      };

      mockPrisma.providerConnection.findFirst.mockRejectedValue(new Error('Database error'));

      const result = await service.handleWebhook(payload);

      expect(result.processed).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('searchInstitutions', () => {
    it('should search for institutions by name', async () => {
      mockMxClient.listInstitutions.mockResolvedValue({
        data: {
          institutions: [
            {
              code: 'chase',
              name: 'Chase Bank',
              medium_logo_url: 'https://logo.url/chase.png',
              brand_color: '#0071ce',
              url: 'https://chase.com',
            },
            {
              code: 'bofa',
              name: 'Bank of America',
              medium_logo_url: 'https://logo.url/bofa.png',
            },
          ],
        },
      });

      const result = await service.searchInstitutions('chase', 'US');

      expect(result).toHaveLength(2);
      expect(result[0].institutionId).toBe('chase');
      expect(result[0].name).toBe('Chase Bank');
      expect(result[0].logo).toBe('https://logo.url/chase.png');
      expect(result[0].primaryColor).toBe('#0071ce');
      expect(result[0].supportedProducts).toContain('accounts');
      expect(result[0].region).toBe('US');

      expect(mockMxClient.listInstitutions).toHaveBeenCalledWith(
        '1',
        'chase',
        undefined,
        undefined,
        20
      );
    });

    it('should default region to US when not specified', async () => {
      mockMxClient.listInstitutions.mockResolvedValue({
        data: {
          institutions: [
            {
              code: 'chase',
              name: 'Chase Bank',
            },
          ],
        },
      });

      const result = await service.searchInstitutions('chase');

      expect(result[0].region).toBe('US');
    });
  });

  describe('getInstitution', () => {
    it('should fetch institution by ID', async () => {
      mockMxClient.readInstitution.mockResolvedValue({
        data: {
          institution: {
            code: 'chase',
            name: 'Chase Bank',
            medium_logo_url: 'https://logo.url/chase.png',
            brand_color: '#0071ce',
            url: 'https://chase.com',
          },
        },
      });

      const result = await service.getInstitution('chase');

      expect(result.institutionId).toBe('chase');
      expect(result.name).toBe('Chase Bank');
      expect(result.region).toBe('US');
    });

    it('should throw error when institution not found', async () => {
      mockMxClient.readInstitution.mockResolvedValue({
        data: {
          institution: null,
        },
      });

      await expect(service.getInstitution('invalid')).rejects.toThrow('Institution not found');
    });
  });
});
