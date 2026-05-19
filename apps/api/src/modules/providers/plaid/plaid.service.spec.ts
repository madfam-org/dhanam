import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { AuditService } from '@core/audit/audit.service';
import { CryptoService } from '@core/crypto/crypto.service';
import { PrismaService } from '@core/prisma/prisma.service';

import { CircuitBreakerService } from '../orchestrator/circuit-breaker.service';

import { PlaidWebhookHandler } from './plaid-webhook.handler';
import { PlaidService } from './plaid.service';

// Mock Plaid
jest.mock('plaid', () => ({
  PlaidApi: jest.fn().mockImplementation(() => ({
    linkTokenCreate: jest.fn(),
    itemPublicTokenExchange: jest.fn(),
    accountsGet: jest.fn(),
    transactionsSync: jest.fn(),
    liabilitiesGet: jest.fn(),
  })),
  Configuration: jest.fn(),
  PlaidEnvironments: {
    sandbox: 'https://sandbox.plaid.com',
    development: 'https://development.plaid.com',
    production: 'https://production.plaid.com',
  },
  CountryCode: { Us: 'US' },
  Products: { Transactions: 'transactions', Auth: 'auth', Liabilities: 'liabilities' },
  DepositoryAccountSubtype: { Checking: 'checking', Savings: 'savings' },
  CreditAccountSubtype: { CreditCard: 'credit_card' },
  LoanAccountSubtype: {
    Auto: 'auto',
    Student: 'student',
    Mortgage: 'mortgage',
    Consumer: 'consumer',
    HomeEquity: 'home_equity',
    LineOfCredit: 'line_of_credit',
  },
}));

describe('PlaidService', () => {
  let service: PlaidService;
  let prisma: DeepMockProxy<PrismaService>;
  let cryptoService: DeepMockProxy<CryptoService>;
  let configService: DeepMockProxy<ConfigService>;

  // Config mock must be created before module compilation
  const mockConfigService = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'PLAID_CLIENT_ID':
          return 'test-client-id';
        case 'PLAID_SECRET':
          return 'test-secret';
        case 'PLAID_ENV':
          return 'sandbox';
        case 'PLAID_WEBHOOK_URL':
          return 'https://api.example.com/webhooks/plaid';
        case 'PLAID_WEBHOOK_SECRET':
          return 'webhook-secret';
        default:
          return undefined;
      }
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaidService,
        PlaidWebhookHandler,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaService>(),
        },
        {
          provide: CryptoService,
          useValue: mockDeep<CryptoService>(),
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CircuitBreakerService,
          useValue: {
            isCircuitOpen: jest.fn().mockResolvedValue(false),
            recordSuccess: jest.fn().mockResolvedValue(undefined),
            recordFailure: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuditService,
          useValue: {
            logProviderConnection: jest.fn().mockResolvedValue(undefined),
            logSecurityEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<PlaidService>(PlaidService);
    prisma = module.get(PrismaService);
    cryptoService = module.get(CryptoService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createLinkToken', () => {
    it('should create link token', async () => {
      const mockResponse = {
        data: {
          link_token: 'link-token-123',
          expiration: '2024-12-31T23:59:59Z',
        },
      };

      const mockLinkTokenCreate = jest.fn().mockResolvedValue(mockResponse);

      // Set mock BEFORE calling method - override the plaidClient entirely
      (service as any).plaidClient = {
        linkTokenCreate: mockLinkTokenCreate,
      };

      const result = await service.createLinkToken('user1');

      expect(mockLinkTokenCreate).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.linkToken).toBe('link-token-123');
      expect(result.expiration).toBeInstanceOf(Date);
    });

    it('should throw error when Plaid not configured', async () => {
      (service as any).plaidClient = null;

      await expect(service.createLinkToken('user1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('syncTransactions', () => {
    it('should sync transactions successfully', async () => {
      const mockResponse = {
        data: {
          added: [
            {
              transaction_id: 'tx1',
              account_id: 'acc1',
              amount: 100,
              name: 'Test Transaction',
              date: '2024-01-01',
            },
          ],
          modified: [],
          removed: [],
          next_cursor: 'cursor-123',
        },
      };

      (service as any).plaidClient = {
        transactionsSync: jest.fn().mockResolvedValue(mockResponse),
      };

      prisma.account.findFirst.mockResolvedValue({
        id: 'account1',
        currency: 'USD',
      } as any);

      prisma.providerConnection.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.syncTransactions('access-token', 'item-id');

      expect(result).toBeDefined();
      expect(result.transactionCount).toBe(1);
      expect(result.nextCursor).toBe('cursor-123');
    });
  });
});
