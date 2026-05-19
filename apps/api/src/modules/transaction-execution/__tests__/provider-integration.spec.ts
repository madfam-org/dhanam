import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { CryptoService } from '../../../core/crypto/crypto.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BelvoExecutionProvider } from '../providers/belvo-execution.provider';
import { BitsoExecutionProvider } from '../providers/bitso-execution.provider';
import { ExecutionOrder } from '../providers/execution-provider.interface';
import { PlaidExecutionProvider } from '../providers/plaid-execution.provider';

/**
 * Provider Integration Tests
 *
 * These tests verify provider implementations work correctly with their APIs
 * Run with: pnpm test provider-integration
 *
 * NOTE: These tests require provider credentials in .env.test
 * Set ENABLE_PROVIDER_INTEGRATION_TESTS=true to run them
 */

describe('Provider Integration Tests', () => {
  let bitsoProvider: BitsoExecutionProvider;
  let plaidProvider: PlaidExecutionProvider;
  let belvoProvider: BelvoExecutionProvider;
  let prismaService: PrismaService;
  let configService: ConfigService;
  let cryptoService: CryptoService;

  const shouldRunIntegrationTests = process.env.ENABLE_PROVIDER_INTEGRATION_TESTS === 'true';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BitsoExecutionProvider,
        PlaidExecutionProvider,
        BelvoExecutionProvider,
        {
          provide: PrismaService,
          useValue: {
            account: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              // Return test credentials from environment
              return process.env[key];
            },
          },
        },
        {
          provide: CryptoService,
          useValue: {
            decrypt: jest.fn((encrypted) => 'decrypted-token'),
            encrypt: jest.fn((data) => JSON.stringify({ encrypted: true })),
          },
        },
      ],
    }).compile();

    bitsoProvider = module.get<BitsoExecutionProvider>(BitsoExecutionProvider);
    plaidProvider = module.get<PlaidExecutionProvider>(PlaidExecutionProvider);
    belvoProvider = module.get<BelvoExecutionProvider>(BelvoExecutionProvider);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
    cryptoService = module.get<CryptoService>(CryptoService);
  });

  describe('Bitso Provider', () => {
    const mockBitsoOrder: ExecutionOrder = {
      id: 'test-order-1',
      type: 'buy',
      amount: 100,
      currency: 'MXN',
      assetSymbol: 'BTC',
      accountId: 'test-account-1',
    };

    it('should validate Bitso buy order', async () => {
      const result = await bitsoProvider.validateOrder(mockBitsoOrder);

      expect(result).toHaveProperty('valid');
      if (result.valid === false) {
        expect(result.errors).toBeDefined();
        expect(Array.isArray(result.errors)).toBe(true);
      }
    });

    it('should validate currency support', async () => {
      const invalidOrder = { ...mockBitsoOrder, currency: 'GBP' };
      const result = await bitsoProvider.validateOrder(invalidOrder);

      expect(result.valid).toBe(false);
      expect(result.errors?.some((err) => err.includes('Currency GBP is not supported'))).toBe(
        true
      );
    });

    it('should validate order amount limits', async () => {
      const tooSmallOrder = { ...mockBitsoOrder, amount: 0.0001 };
      const result = await bitsoProvider.validateOrder(tooSmallOrder);

      expect(result.valid).toBe(false);
      expect(result.errors?.some((err) => err.includes('Order amount below minimum'))).toBe(true);
    });

    (shouldRunIntegrationTests ? it : it.skip)(
      'should health check Bitso API',
      async () => {
        const isHealthy = await bitsoProvider.healthCheck();

        // Health check may fail without credentials, but should not throw
        expect(typeof isHealthy).toBe('boolean');
      },
      30000
    );

    (shouldRunIntegrationTests ? it : it.skip)(
      'should get market price from Bitso',
      async () => {
        const price = await bitsoProvider.getMarketPrice('BTC', 'MXN');

        expect(typeof price).toBe('number');
        expect(price).toBeGreaterThan(0);
      },
      30000
    );
  });

  describe('Plaid Provider', () => {
    const mockPlaidOrder: ExecutionOrder = {
      id: 'test-order-2',
      type: 'transfer',
      amount: 1000,
      currency: 'USD',
      accountId: 'test-account-2',
      toAccountId: 'test-account-3',
    };

    it('should validate Plaid transfer order', async () => {
      const result = await plaidProvider.validateOrder(mockPlaidOrder);

      expect(result).toHaveProperty('valid');
      if (result.valid === false) {
        expect(result.errors).toBeDefined();
      }
    });

    it('should reject buy/sell orders', async () => {
      const buyOrder = { ...mockPlaidOrder, type: 'buy' as const };
      const result = await plaidProvider.executeBuy(buyOrder);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_SUPPORTED');
    });

    it('should validate currency support', async () => {
      const invalidOrder = { ...mockPlaidOrder, currency: 'MXN' };
      const result = await plaidProvider.validateOrder(invalidOrder);

      expect(result.valid).toBe(false);
      expect(result.errors?.some((err) => err.includes('Currency MXN is not supported'))).toBe(
        true
      );
    });

    it('should validate transfer requires destination account', async () => {
      const invalidOrder = { ...mockPlaidOrder, toAccountId: undefined };
      const result = await plaidProvider.validateOrder(invalidOrder);

      expect(result.valid).toBe(false);
      expect(result.errors?.some((err) => err.includes('Destination account required'))).toBe(true);
    });

    it('should validate same-day ACH limits', async () => {
      const tooLargeOrder = { ...mockPlaidOrder, amount: 50000 };
      const result = await plaidProvider.validateOrder(tooLargeOrder);

      expect(result.valid).toBe(false);
      expect(result.errors?.some((err) => err.includes('exceeds same-day ACH maximum'))).toBe(true);
    });

    (shouldRunIntegrationTests ? it : it.skip)(
      'should health check Plaid API',
      async () => {
        const isHealthy = await plaidProvider.healthCheck();

        // Health check expects to fail gracefully
        expect(typeof isHealthy).toBe('boolean');
      },
      30000
    );
  });

  describe('Belvo Provider', () => {
    const mockBelvoOrder: ExecutionOrder = {
      id: 'test-order-3',
      type: 'transfer',
      amount: 5000,
      currency: 'MXN',
      accountId: 'test-account-4',
      toAccountId: 'test-account-5',
    };

    it('should validate Belvo transfer order', async () => {
      const result = await belvoProvider.validateOrder(mockBelvoOrder);

      expect(result).toHaveProperty('valid');
      if (result.valid === false) {
        expect(result.errors).toBeDefined();
      }
    });

    it('should reject buy/sell orders', async () => {
      const buyOrder = { ...mockBelvoOrder, type: 'buy' as const };
      const result = await belvoProvider.executeBuy(buyOrder);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NOT_SUPPORTED');
    });

    it('should validate currency support (MXN only)', async () => {
      const invalidOrder = { ...mockBelvoOrder, currency: 'USD' };
      const result = await belvoProvider.validateOrder(invalidOrder);

      expect(result.valid).toBe(false);
      expect(result.errors?.some((err) => err.includes('Currency USD is not supported'))).toBe(
        true
      );
    });

    it('should validate transfer requires destination account', async () => {
      const invalidOrder = { ...mockBelvoOrder, toAccountId: undefined };
      const result = await belvoProvider.validateOrder(invalidOrder);

      expect(result.valid).toBe(false);
      expect(
        result.errors?.some((err) =>
          err.includes('Destination account required for SPEI transfers')
        )
      ).toBe(true);
    });

    (shouldRunIntegrationTests ? it : it.skip)(
      'should health check Belvo API',
      async () => {
        const isHealthy = await belvoProvider.healthCheck();

        expect(typeof isHealthy).toBe('boolean');
      },
      30000
    );
  });

  describe('Provider Capabilities', () => {
    it('Bitso should have correct capabilities', () => {
      const caps = bitsoProvider.capabilities;

      expect(caps.supportsBuy).toBe(true);
      expect(caps.supportsSell).toBe(true);
      expect(caps.supportsTransfer).toBe(false);
      expect(caps.supportedCurrencies).toContain('MXN');
      expect(caps.supportedAssets).toEqual(expect.arrayContaining(['BTC', 'ETH']));
    });

    it('Plaid should have correct capabilities', () => {
      const caps = plaidProvider.capabilities;

      expect(caps.supportsBuy).toBe(false);
      expect(caps.supportsSell).toBe(false);
      expect(caps.supportsTransfer).toBe(true);
      expect(caps.supportsDeposit).toBe(true);
      expect(caps.supportsWithdraw).toBe(true);
      expect(caps.supportedCurrencies).toContain('USD');
      expect(caps.maxOrderAmount).toBe(25000); // Same-day ACH limit
    });

    it('Belvo should have correct capabilities', () => {
      const caps = belvoProvider.capabilities;

      expect(caps.supportsBuy).toBe(false);
      expect(caps.supportsSell).toBe(false);
      expect(caps.supportsTransfer).toBe(true);
      expect(caps.supportedCurrencies).toContain('MXN');
      expect(caps.supportedCurrencies).not.toContain('USD');
    });
  });

  describe('Provider Error Handling', () => {
    it('should handle missing credentials gracefully', async () => {
      const order: ExecutionOrder = {
        id: 'test-order-invalid',
        type: 'buy',
        amount: 100,
        currency: 'MXN',
        assetSymbol: 'BTC',
        accountId: 'non-existent-account',
      };

      // Without credentials, providers should return error result (not throw)
      const result = await bitsoProvider.executeBuy(order);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBeDefined();
      expect(result.errorMessage).toBeDefined();
    });

    it('should handle market price errors gracefully', async () => {
      await expect(plaidProvider.getMarketPrice('BTC', 'USD')).rejects.toThrow(
        'Plaid does not provide market prices'
      );

      await expect(belvoProvider.getMarketPrice('BTC', 'MXN')).rejects.toThrow(
        'Belvo does not provide market prices'
      );
    });
  });
});
