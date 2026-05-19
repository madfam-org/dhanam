import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { CryptoService } from '@core/crypto/crypto.service';
import { PrismaService } from '@core/prisma/prisma.service';

import { CircuitBreakerService } from '../orchestrator/circuit-breaker.service';

import { BitsoService } from './bitso.service';

// Create mock client with interceptors that axios.create() will return
const mockAxiosClient = {
  get: jest.fn(),
  post: jest.fn(),
  interceptors: {
    request: {
      use: jest.fn(),
    },
    response: {
      use: jest.fn(),
    },
  },
};

// Mock axios module
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => mockAxiosClient),
    get: jest.fn(),
    isAxiosError: jest.fn(() => false),
  },
}));

describe('BitsoService', () => {
  let service: BitsoService;
  let prisma: DeepMockProxy<PrismaService>;
  let cryptoService: DeepMockProxy<CryptoService>;
  let configService: DeepMockProxy<ConfigService>;

  // Config mock must be created before module compilation
  const mockConfigService = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'BITSO_API_KEY':
          return 'test-api-key';
        case 'BITSO_API_SECRET':
          return 'test-api-secret';
        case 'BITSO_WEBHOOK_SECRET':
          return 'webhook-secret';
        default:
          return '';
      }
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BitsoService,
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
      ],
    }).compile();

    service = module.get<BitsoService>(BitsoService);
    prisma = module.get(PrismaService);
    cryptoService = module.get(CryptoService);
    configService = module.get(ConfigService);

    // Reset axios mocks
    mockAxiosClient.get.mockReset();
    mockAxiosClient.post.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('connectAccount', () => {
    it('should connect Bitso account successfully', async () => {
      const mockAccountInfo = {
        client_id: 'client123',
        status: 'active',
        daily_limit: '10000',
        monthly_limit: '100000',
      };

      const mockBalances = [
        {
          currency: 'btc',
          available: '0.1',
          locked: '0.0',
          total: '0.1',
        },
      ];

      const mockTickers = [
        {
          book: 'btc_mxn',
          last: '500000',
          volume: '1000',
          high: '510000',
          low: '490000',
          vwap: '500000',
          ask: '500100',
          bid: '499900',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          book: 'usd_mxn',
          last: '20',
          volume: '1000',
          high: '20.5',
          low: '19.5',
          vwap: '20',
          ask: '20.1',
          bid: '19.9',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      // Mock axios responses using the module-level mockAxiosClient
      const axios = require('axios');
      mockAxiosClient.get
        .mockResolvedValueOnce({ data: { payload: mockAccountInfo } }) // account_status
        .mockResolvedValueOnce({ data: { payload: { balances: mockBalances } } }) // balance
        .mockResolvedValueOnce({ data: { payload: [] } }); // user_trades

      axios.default.get.mockResolvedValue({ data: { payload: mockTickers } });

      cryptoService.encrypt.mockReturnValue('encrypted-data');
      prisma.providerConnection.create.mockResolvedValue({} as any);
      prisma.account.create.mockResolvedValue({
        id: 'account1',
        name: 'BTC Wallet',
        type: 'crypto',
        currency: 'USD',
        balance: 1250, // 0.1 BTC * 500000 MXN * 0.05 USD/MXN
      } as any);

      const result = await service.connectAccount('space1', 'user1', {
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        externalId: 'ext1',
        autoSync: true,
      });

      expect(result).toBeDefined();
      expect(result.accounts).toHaveLength(1);
      expect(result.message).toContain('Successfully connected');
    });
  });

  describe('syncPortfolio', () => {
    it('should sync user portfolio', async () => {
      const mockConnections = [
        {
          id: 'conn1',
          providerUserId: 'client123',
          encryptedToken: JSON.stringify('encrypted-key'),
          metadata: { encryptedApiSecret: JSON.stringify('encrypted-secret') },
        },
      ];

      const mockUserSpaces = [{ spaceId: 'space1', space: { id: 'space1' } }];

      prisma.providerConnection.findMany.mockResolvedValue(mockConnections as any);
      prisma.userSpace.findMany.mockResolvedValue(mockUserSpaces as any);
      cryptoService.decrypt.mockReturnValue('decrypted-value');

      await expect(service.syncPortfolio('user1')).resolves.not.toThrow();
    });
  });

  describe('getPortfolioSummary', () => {
    it('should return portfolio summary', async () => {
      const mockAccounts = [
        {
          balance: 1000,
          metadata: {
            cryptoCurrency: 'BTC',
            cryptoAmount: 0.02,
          },
        },
        {
          balance: 500,
          metadata: {
            cryptoCurrency: 'ETH',
            cryptoAmount: 0.5,
          },
        },
      ];

      prisma.account.findMany.mockResolvedValue(mockAccounts as any);

      const result = await service.getPortfolioSummary('user1');

      expect(result).toBeDefined();
      expect(result.totalValue).toBe(1500);
      expect(result.holdings).toHaveLength(2);
      expect(result.holdings[0].percentage).toBeCloseTo(66.67, 1);
      expect(result.holdings[1].percentage).toBeCloseTo(33.33, 1);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signature', () => {
      const payload = '{"test":"data"}';
      const secret = 'webhook-secret';

      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      const result = (service as any).verifyWebhookSignature(payload, expectedSignature);
      expect(result).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = '{"test":"data"}';
      // Use a 64-char hex string (same length as SHA256 output) but wrong value
      const invalidSignature = 'a'.repeat(64);

      const result = (service as any).verifyWebhookSignature(payload, invalidSignature);
      expect(result).toBe(false);
    });
  });
});
