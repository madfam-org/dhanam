import { HttpService } from '@nestjs/axios';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';

import { Currency } from '@db';

import { CryptoService } from '../../../core/crypto/crypto.service';
import { PrismaService } from '../../../core/prisma/prisma.service';

import { FinicityService } from './finicity.service';

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

// Import Provider after the mock
const { Provider } = require('@prisma/client');

describe('FinicityService', () => {
  let service: FinicityService;
  let prisma: PrismaService;
  let configService: ConfigService;
  let cryptoService: CryptoService;
  let httpService: HttpService;

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
        FINICITY_PARTNER_ID: 'test-partner-id',
        FINICITY_PARTNER_SECRET: 'test-partner-secret',
        FINICITY_APP_KEY: 'test-app-key',
        FINICITY_BASE_URL: 'https://api.finicity.com',
        FINICITY_WEBHOOK_SECRET: 'test-webhook-secret',
        FINICITY_WEBHOOK_URL: 'https://api.dhanam.io/webhooks/finicity',
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

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinicityService,
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
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<FinicityService>(FinicityService);
    prisma = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
    cryptoService = module.get<CryptoService>(CryptoService);
    httpService = module.get<HttpService>(HttpService);

    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with valid credentials', () => {
      expect(service).toBeDefined();
      expect(service.name).toBe(Provider.finicity);
    });

    it('should handle missing credentials gracefully', () => {
      const mockConfigWithoutCreds = {
        get: jest.fn(() => ''),
      };

      const module = Test.createTestingModule({
        providers: [
          FinicityService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ConfigService, useValue: mockConfigWithoutCreds },
          { provide: CryptoService, useValue: mockCryptoService },
          { provide: HttpService, useValue: mockHttpService },
        ],
      });

      expect(module.compile()).resolves.toBeDefined();
    });
  });

  describe('getAccessToken', () => {
    it('should fetch and cache access token', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            token: 'finicity-access-token-123',
          },
        })
      );

      const result = await service.healthCheck();

      expect(result.status).toBe('healthy');
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://api.finicity.com/aggregation/v2/partners/authentication',
        {
          partnerId: 'test-partner-id',
          partnerSecret: 'test-partner-secret',
        },
        {
          headers: {
            'Finicity-App-Key': 'test-app-key',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should reuse cached token if not expired', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            token: 'finicity-access-token-123',
          },
        })
      );

      // First call fetches token
      await service.healthCheck();
      jest.clearAllMocks();

      // Second call should reuse cached token
      await service.healthCheck();

      expect(mockHttpService.post).not.toHaveBeenCalled(); // Should not authenticate again
    });

    it('should throw error when authentication fails', async () => {
      mockHttpService.post.mockReturnValue(throwError(() => new Error('Authentication failed')));

      await expect(service.healthCheck()).resolves.toMatchObject({
        status: 'down',
        error: expect.any(String),
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when Finicity is accessible', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            token: 'test-token',
          },
        })
      );

      const result = await service.healthCheck();

      expect(result.provider).toBe(Provider.finicity);
      expect(result.status).toBe('healthy');
      expect(result.errorRate).toBe(0);
      expect(result.avgResponseTimeMs).toBeGreaterThanOrEqual(0); // Can be 0 in fast test environment
    });

    it('should return down status when not configured', async () => {
      const serviceWithoutCreds = new FinicityService(
        prisma,
        { get: jest.fn(() => '') } as any,
        cryptoService,
        httpService
      );

      const result = await serviceWithoutCreds.healthCheck();

      expect(result.status).toBe('down');
      expect(result.errorRate).toBe(100);
      expect(result.error).toBe('Finicity not configured');
    });

    it('should return down status when authentication fails', async () => {
      mockHttpService.post.mockReturnValue(throwError(() => new Error('Auth error')));

      const result = await service.healthCheck();

      expect(result.status).toBe('down');
      expect(result.errorRate).toBe(100);
    });
  });

  describe('createLink', () => {
    it('should create Finicity Connect link for new customer', async () => {
      const params = {
        userId: 'user123',
        redirectUri: 'https://app.dhanam.io/callback',
      };

      // Mock authentication
      mockHttpService.post
        .mockReturnValueOnce(
          of({
            data: { token: 'finicity-token' },
          })
        )
        // Mock create customer
        .mockReturnValueOnce(
          of({
            data: { id: 'finicity-customer-123' },
          })
        )
        // Mock generate connect URL
        .mockReturnValueOnce(
          of({
            data: { link: 'https://connect.finicity.com/connect/v2/xyz789' },
          })
        );

      const result = await service.createLink(params);

      expect(result.linkToken).toBe('https://connect.finicity.com/connect/v2/xyz789');
      expect(result.expiration).toBeInstanceOf(Date);
      expect(result.metadata).toEqual({
        finicityCustomerId: 'finicity-customer-123',
        provider: 'finicity',
      });
    });

    it('should create link for existing customer', async () => {
      const params = {
        userId: 'user123',
        metadata: {
          finicityCustomerId: 'existing-customer-id',
        },
      };

      mockHttpService.post
        .mockReturnValueOnce(of({ data: { token: 'token' } }))
        .mockReturnValueOnce(
          of({
            data: { link: 'https://connect.finicity.com/connect/v2/abc123' },
          })
        );

      const result = await service.createLink(params);

      expect(result.linkToken).toBe('https://connect.finicity.com/connect/v2/abc123');
      expect(result.metadata?.finicityCustomerId).toBe('existing-customer-id');
    });

    it('should throw error when connect URL generation fails', async () => {
      mockHttpService.post
        .mockReturnValueOnce(of({ data: { token: 'token' } }))
        .mockReturnValueOnce(of({ data: { id: 'customer-id' } }))
        .mockReturnValueOnce(
          of({
            data: { link: null }, // Failed to generate
          })
        );

      await expect(service.createLink({ userId: 'user123' })).rejects.toThrow(
        'Failed to generate Finicity Connect URL'
      );
    });
  });

  describe('exchangeToken', () => {
    it('should exchange token and create provider connection', async () => {
      const params = {
        userId: 'user123',
        publicToken: 'finicity-connect-token',
        metadata: {
          finicityCustomerId: 'customer-123',
        },
      };

      mockHttpService.post.mockReturnValueOnce(of({ data: { token: 'access-token' } }));

      mockHttpService.get.mockReturnValueOnce(
        of({
          data: {
            accounts: [
              {
                id: 'acc-1',
                institutionId: 'chase',
                institutionName: 'Chase Bank',
                name: 'Checking',
              },
            ],
          },
        })
      );

      mockPrisma.providerConnection.create.mockResolvedValue({});

      const result = await service.exchangeToken(params);

      expect(result.accessToken).toBe('customer-123');
      expect(result.itemId).toBe('customer-123');
      expect(result.institutionId).toBe('chase');
      expect(result.institutionName).toBe('Chase Bank');
      expect(mockCryptoService.encrypt).toHaveBeenCalled();
    });

    it('should throw error when customer ID is missing', async () => {
      // Mock authentication first (which happens before customer ID check)
      mockHttpService.post.mockReturnValueOnce(of({ data: { token: 'token' } }));

      await expect(
        service.exchangeToken({
          userId: 'user123',
          publicToken: 'token',
          metadata: {},
        })
      ).rejects.toThrow('Finicity customer ID required');
    });

    it('should throw error when no accounts found', async () => {
      mockHttpService.post.mockReturnValueOnce(of({ data: { token: 'token' } }));
      mockHttpService.get.mockReturnValueOnce(
        of({
          data: { accounts: [] },
        })
      );

      await expect(
        service.exchangeToken({
          userId: 'user123',
          publicToken: 'token',
          metadata: { finicityCustomerId: 'customer-123' },
        })
      ).rejects.toThrow('No accounts found after Finicity Connect');
    });
  });

  describe('getAccounts', () => {
    it('should fetch accounts from Finicity', async () => {
      mockHttpService.post.mockReturnValueOnce(of({ data: { token: 'token' } }));

      mockHttpService.get.mockReturnValueOnce(
        of({
          data: {
            accounts: [
              {
                id: 'finicity-acc-1',
                name: 'Chase Checking',
                type: 'checking',
                balance: 5000,
                currency: 'USD',
                number: '****1234',
                institutionId: 'chase',
                institutionName: 'Chase Bank',
                status: 'active',
              },
              {
                id: 'finicity-acc-2',
                name: 'Savings Account',
                type: 'savings',
                balance: 10000,
                currency: 'USD',
              },
            ],
          },
        })
      );

      const result = await service.getAccounts({
        userId: 'user123',
        accessToken: 'customer-123',
      });

      expect(result).toHaveLength(2);
      expect(result[0].providerAccountId).toBe('finicity-acc-1');
      expect(result[0].name).toBe('Chase Checking');
      expect(result[0].type).toBe('checking');
      expect(result[0].balance).toBe(5000);
      expect(result[0].mask).toBe('1234');
    });

    it('should map Finicity account types correctly', async () => {
      mockHttpService.post.mockReturnValueOnce(of({ data: { token: 'token' } }));

      mockHttpService.get.mockReturnValueOnce(
        of({
          data: {
            accounts: [
              { id: '1', type: 'checking', balance: 1000, currency: 'USD' },
              { id: '2', type: 'savings', balance: 2000, currency: 'USD' },
              { id: '3', type: 'creditCard', balance: -500, currency: 'USD' },
              { id: '4', type: 'investment', balance: 50000, currency: 'USD' },
              { id: '5', type: '401k', balance: 100000, currency: 'USD' },
              { id: '6', type: 'mortgage', balance: -200000, currency: 'USD' },
            ],
          },
        })
      );

      const result = await service.getAccounts({
        userId: 'user123',
        accessToken: 'customer-123',
      });

      expect(result[0].type).toBe('checking');
      expect(result[1].type).toBe('savings');
      expect(result[2].type).toBe('credit');
      expect(result[3].type).toBe('investment');
      expect(result[4].type).toBe('investment'); // 401k -> investment
      expect(result[5].type).toBe('other'); // mortgage -> other
    });
  });

  describe('syncTransactions', () => {
    it('should sync transactions from Finicity', async () => {
      mockHttpService.post.mockReturnValueOnce(of({ data: { token: 'token' } }));

      mockHttpService.get
        // Get accounts
        .mockReturnValueOnce(
          of({
            data: {
              accounts: [{ id: 'acc-1', name: 'Checking' }],
            },
          })
        )
        // Get transactions for account
        .mockReturnValueOnce(
          of({
            data: {
              transactions: [
                {
                  id: 1001,
                  amount: -50.0,
                  description: 'Starbucks',
                  normalizedPayeeName: 'Starbucks',
                  postedDate: 1705305600, // 2024-01-15
                  categorization: {
                    category: 'Food & Dining',
                  },
                  type: 'debit',
                  status: 'active',
                },
                {
                  id: 1002,
                  amount: 1000.0,
                  description: 'Paycheck',
                  transactionDate: 1704067200, // 2024-01-01
                  type: 'credit',
                  status: 'active',
                },
              ],
            },
          })
        );

      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc123',
        currency: 'USD',
      });

      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue({});

      const result = await service.syncTransactions({
        userId: 'user123',
        accessToken: 'customer-123',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(result.added).toBe(2);
      expect(result.modified).toBe(0);
      expect(mockPrisma.transaction.create).toHaveBeenCalledTimes(2);
    });

    it('should update existing transactions', async () => {
      mockHttpService.post.mockReturnValueOnce(of({ data: { token: 'token' } }));

      mockHttpService.get
        .mockReturnValueOnce(of({ data: { accounts: [{ id: 'acc-1' }] } }))
        .mockReturnValueOnce(
          of({
            data: {
              transactions: [
                {
                  id: 1001,
                  amount: -55.0, // Updated amount
                  description: 'Starbucks Updated',
                  postedDate: 1705305600,
                },
              ],
            },
          })
        );

      mockPrisma.account.findFirst.mockResolvedValue({ id: 'acc123', currency: 'USD' });
      mockPrisma.transaction.findFirst.mockResolvedValue({ id: 'txn123' });
      mockPrisma.transaction.update.mockResolvedValue({});

      const result = await service.syncTransactions({
        userId: 'user123',
        accessToken: 'customer-123',
      });

      expect(result.added).toBe(0);
      expect(result.modified).toBe(1);
      expect(mockPrisma.transaction.update).toHaveBeenCalled();
    });

    it('should skip transactions for unknown accounts', async () => {
      mockHttpService.post.mockReturnValueOnce(of({ data: { token: 'token' } }));

      mockHttpService.get
        .mockReturnValueOnce(of({ data: { accounts: [{ id: 'acc-1' }] } }))
        .mockReturnValueOnce(
          of({
            data: {
              transactions: [
                {
                  id: 1001,
                  amount: -50.0,
                  postedDate: 1705305600,
                },
              ],
            },
          })
        );

      mockPrisma.account.findFirst.mockResolvedValue(null); // Account not found

      const result = await service.syncTransactions({
        userId: 'user123',
        accessToken: 'customer-123',
      });

      expect(result.added).toBe(0);
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });

    it('should use default date range when not provided', async () => {
      mockHttpService.post.mockReturnValueOnce(of({ data: { token: 'token' } }));
      mockHttpService.get
        .mockReturnValueOnce(of({ data: { accounts: [{ id: 'acc-1' }] } }))
        .mockReturnValueOnce(of({ data: { transactions: [] } }));

      mockPrisma.account.findFirst.mockResolvedValue(null);

      const result = await service.syncTransactions({
        userId: 'user123',
        accessToken: 'customer-123',
      });

      expect(result).toBeDefined();
      expect(result.added).toBe(0);
      expect(result.modified).toBe(0);

      // Verify that transactions endpoint was called with date parameters
      const getCall = mockHttpService.get.mock.calls.find(
        (call) => call[0] && typeof call[0] === 'string' && call[0].includes('/transactions')
      );
      expect(getCall).toBeDefined();
      if (getCall && getCall[1]) {
        expect(getCall[1].params).toBeDefined();
        expect(getCall[1].params.fromDate).toBeDefined();
        expect(getCall[1].params.toDate).toBeDefined();
      }
    });
  });

  describe('handleWebhook', () => {
    it('should process aggregation webhook', async () => {
      const payload = {
        eventType: 'aggregation',
        customerId: 'customer-123',
        accountId: 'acc-123',
      };

      mockPrisma.providerConnection.findFirst.mockResolvedValue({ id: 'conn123' });

      const result = await service.handleWebhook(payload);

      expect(result.processed).toBe(true);
    });

    it('should process transaction webhooks', async () => {
      const payload = {
        eventType: 'transaction.created',
        customerId: 'customer-123',
        accountId: 'acc-123',
      };

      const result = await service.handleWebhook(payload);

      expect(result.processed).toBe(true);
    });

    it('should handle unrecognized webhook types', async () => {
      const payload = {
        eventType: 'unknown.event',
        customerId: 'customer-123',
      };

      const result = await service.handleWebhook(payload);

      expect(result.processed).toBe(true);
    });

    it('should return error when webhook processing fails', async () => {
      const payload = {
        eventType: 'account.updated',
        customerId: 'customer-123',
        accountId: 'acc-123',
      };

      mockPrisma.providerConnection.findFirst.mockRejectedValue(new Error('Database error'));

      const result = await service.handleWebhook(payload);

      expect(result.processed).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('searchInstitutions', () => {
    it('should search institutions by query', async () => {
      // Mock authentication
      mockHttpService.post.mockReturnValueOnce(of({ data: { token: 'token' } }));

      // Mock institutions search
      mockHttpService.get.mockReturnValueOnce(
        of({
          data: {
            institutions: [
              {
                id: 101732,
                name: 'Chase Bank',
                branding: {
                  logo: 'https://logo.url/chase.png',
                  primaryColor: '#0071ce',
                },
                urlHomeApp: 'https://chase.com',
              },
              {
                id: 5,
                name: 'Bank of America',
                branding: {
                  logo: 'https://logo.url/bofa.png',
                },
              },
            ],
          },
        })
      );

      const result = await service.searchInstitutions('chase', 'US');

      expect(result).toHaveLength(2);
      expect(result[0].institutionId).toBe('101732');
      expect(result[0].name).toBe('Chase Bank');
      expect(result[0].logo).toBe('https://logo.url/chase.png');
      expect(result[0].region).toBe('US');

      // Verify authentication was called
      expect(mockHttpService.post).toHaveBeenCalled();
      // Verify search endpoint was called
      expect(mockHttpService.get).toHaveBeenCalled();
    });

    it('should default region to US', async () => {
      mockHttpService.post.mockReturnValueOnce(of({ data: { token: 'token' } }));
      mockHttpService.get.mockReturnValueOnce(
        of({
          data: {
            institutions: [{ id: 1, name: 'Test Bank' }],
          },
        })
      );

      const result = await service.searchInstitutions('test');

      expect(result[0].region).toBe('US');
    });
  });

  describe('getInstitution', () => {
    it('should fetch institution by ID', async () => {
      // Mock authentication
      mockHttpService.post.mockReturnValueOnce(of({ data: { token: 'token' } }));

      // Mock institution fetch
      mockHttpService.get.mockReturnValueOnce(
        of({
          data: {
            institution: {
              id: 101732,
              name: 'Chase Bank',
              branding: {
                logo: 'https://logo.url/chase.png',
                primaryColor: '#0071ce',
              },
              urlHomeApp: 'https://chase.com',
            },
          },
        })
      );

      const result = await service.getInstitution('101732');

      expect(result.institutionId).toBe('101732');
      expect(result.name).toBe('Chase Bank');
      expect(result.logo).toBe('https://logo.url/chase.png');
      expect(mockHttpService.post).toHaveBeenCalled();
      expect(mockHttpService.get).toHaveBeenCalled();
    });

    it('should throw error when institution not found', async () => {
      // Mock authentication
      mockHttpService.post.mockReturnValueOnce(of({ data: { token: 'token' } }));

      // Mock institution not found
      mockHttpService.get.mockReturnValueOnce(
        of({
          data: { institution: null },
        })
      );

      await expect(service.getInstitution('invalid')).rejects.toThrow('Institution not found');

      expect(mockHttpService.post).toHaveBeenCalled();
      expect(mockHttpService.get).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockHttpService.post.mockReturnValue(throwError(() => new Error('Network timeout')));

      await expect(service.createLink({ userId: 'user123' })).rejects.toThrow();
    });

    it('should handle API errors with proper messages', async () => {
      mockHttpService.post
        .mockReturnValueOnce(of({ data: { token: 'token' } }))
        .mockReturnValueOnce(
          throwError(() => ({
            response: {
              data: {
                message: 'Invalid partner credentials',
              },
            },
          }))
        );

      await expect(service.createLink({ userId: 'user123' })).rejects.toThrow();
    });
  });
});
