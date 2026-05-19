import * as crypto from 'crypto';

import { Test, TestingModule } from '@nestjs/testing';

import { CryptoService } from '@core/crypto/crypto.service';
import { PrismaService } from '@core/prisma/prisma.service';

import { createLoggerMock } from '../../../../test/helpers/api-mock-factory';

import { PlaidWebhookHandler } from './plaid-webhook.handler';

describe('PlaidWebhookHandler', () => {
  let handler: PlaidWebhookHandler;
  let prisma: any;
  let cryptoService: jest.Mocked<Pick<CryptoService, 'decrypt'>>;

  const mockConnection = {
    id: 'conn-1',
    provider: 'plaid',
    providerUserId: 'item-123',
    encryptedToken: JSON.stringify({ iv: 'abc', data: 'xyz' }),
    spaceId: 'space-1',
  };

  beforeEach(async () => {
    prisma = {
      providerConnection: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      account: {
        updateMany: jest.fn(),
      },
    };

    cryptoService = {
      decrypt: jest.fn().mockReturnValue('access-token-123'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaidWebhookHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: CryptoService, useValue: cryptoService },
      ],
    }).compile();

    handler = module.get<PlaidWebhookHandler>(PlaidWebhookHandler);
    (handler as any).logger = createLoggerMock();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifySignature', () => {
    const secret = 'test-webhook-secret';
    const payload = '{"test": "data"}';

    it('should return true for valid HMAC signature', () => {
      const expectedSig = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

      expect(handler.verifySignature(payload, expectedSig, secret)).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const invalidSig = crypto
        .createHmac('sha256', 'wrong-secret')
        .update(payload, 'utf8')
        .digest('hex');

      expect(handler.verifySignature(payload, invalidSig, secret)).toBe(false);
    });

    it('should return false for empty secret', () => {
      expect(handler.verifySignature(payload, 'some-sig', '')).toBe(false);
    });

    it('should return false for empty signature', () => {
      expect(handler.verifySignature(payload, '', secret)).toBe(false);
    });

    it('should return false for non-hex string (timingSafeEqual throws)', () => {
      expect(handler.verifySignature(payload, 'not-valid-hex-zzz', secret)).toBe(false);
    });
  });

  describe('handleTransactionWebhook', () => {
    const syncTransactions = jest.fn().mockResolvedValue(undefined);
    const removeTransaction = jest.fn().mockResolvedValue(undefined);

    it('should sync on SYNC_UPDATES_AVAILABLE', async () => {
      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection);

      await handler.handleTransactionWebhook(
        { item_id: 'item-123', webhook_code: 'SYNC_UPDATES_AVAILABLE' } as any,
        syncTransactions,
        removeTransaction
      );

      expect(syncTransactions).toHaveBeenCalledWith('access-token-123', 'item-123');
    });

    it('should sync on DEFAULT_UPDATE', async () => {
      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection);

      await handler.handleTransactionWebhook(
        { item_id: 'item-123', webhook_code: 'DEFAULT_UPDATE' } as any,
        syncTransactions,
        removeTransaction
      );

      expect(syncTransactions).toHaveBeenCalled();
    });

    it('should sync on INITIAL_UPDATE', async () => {
      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection);

      await handler.handleTransactionWebhook(
        { item_id: 'item-123', webhook_code: 'INITIAL_UPDATE' } as any,
        syncTransactions,
        removeTransaction
      );

      expect(syncTransactions).toHaveBeenCalled();
    });

    it('should sync on HISTORICAL_UPDATE', async () => {
      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection);

      await handler.handleTransactionWebhook(
        { item_id: 'item-123', webhook_code: 'HISTORICAL_UPDATE' } as any,
        syncTransactions,
        removeTransaction
      );

      expect(syncTransactions).toHaveBeenCalled();
    });

    it('should remove transactions on TRANSACTIONS_REMOVED', async () => {
      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection);

      await handler.handleTransactionWebhook(
        {
          item_id: 'item-123',
          webhook_code: 'TRANSACTIONS_REMOVED',
          removed_transactions: ['txn-1', 'txn-2'],
        } as any,
        syncTransactions,
        removeTransaction
      );

      expect(removeTransaction).toHaveBeenCalledTimes(2);
      expect(removeTransaction).toHaveBeenCalledWith('txn-1', 'item-123');
      expect(removeTransaction).toHaveBeenCalledWith('txn-2', 'item-123');
    });

    it('should handle TRANSACTIONS_REMOVED with empty removed list', async () => {
      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection);

      await handler.handleTransactionWebhook(
        {
          item_id: 'item-123',
          webhook_code: 'TRANSACTIONS_REMOVED',
          removed_transactions: undefined,
        } as any,
        syncTransactions,
        removeTransaction
      );

      expect(removeTransaction).not.toHaveBeenCalled();
    });

    it('should return early when connection not found', async () => {
      prisma.providerConnection.findFirst.mockResolvedValue(null);

      await handler.handleTransactionWebhook(
        { item_id: 'unknown-item', webhook_code: 'SYNC_UPDATES_AVAILABLE' } as any,
        syncTransactions,
        removeTransaction
      );

      expect(syncTransactions).not.toHaveBeenCalled();
      expect(cryptoService.decrypt).not.toHaveBeenCalled();
    });
  });

  describe('handleAccountWebhook', () => {
    it('should update account balances', async () => {
      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection);

      const mockPlaidClient = {
        accountsGet: jest.fn().mockResolvedValue({
          data: {
            accounts: [
              {
                account_id: 'acct-1',
                mask: '1234',
                official_name: 'Checking',
                balances: {
                  current: 5000,
                  available: 4500,
                  limit: null,
                  iso_currency_code: 'USD',
                  unofficial_currency_code: null,
                },
              },
            ],
          },
        }),
      };

      const callPlaidApi = jest.fn().mockImplementation((_op, apiCall) => apiCall());

      await handler.handleAccountWebhook(
        { item_id: 'item-123', webhook_code: 'DEFAULT_UPDATE' } as any,
        callPlaidApi,
        mockPlaidClient
      );

      expect(prisma.account.updateMany).toHaveBeenCalledWith({
        where: {
          provider: 'plaid',
          providerAccountId: 'acct-1',
        },
        data: expect.objectContaining({
          balance: 5000,
          lastSyncedAt: expect.any(Date),
        }),
      });
    });

    it('should return early when connection not found', async () => {
      prisma.providerConnection.findFirst.mockResolvedValue(null);

      await handler.handleAccountWebhook(
        { item_id: 'unknown-item', webhook_code: 'DEFAULT_UPDATE' } as any,
        jest.fn(),
        {}
      );

      expect(prisma.account.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('handleItemWebhook', () => {
    it('should mark connection as errored on ERROR', async () => {
      prisma.providerConnection.updateMany.mockResolvedValue({ count: 1 });

      await handler.handleItemWebhook({
        item_id: 'item-123',
        webhook_code: 'ERROR',
        error: {
          error_type: 'ITEM_ERROR',
          error_code: 'ITEM_LOGIN_REQUIRED',
          error_message: 'Login required',
        },
      } as any);

      expect(prisma.providerConnection.updateMany).toHaveBeenCalledWith({
        where: { provider: 'plaid', providerUserId: 'item-123' },
        data: {
          metadata: expect.objectContaining({
            error: expect.any(Object),
            erroredAt: expect.any(String),
          }),
        },
      });
    });

    it('should mark connection as expiring on PENDING_EXPIRATION', async () => {
      prisma.providerConnection.updateMany.mockResolvedValue({ count: 1 });

      await handler.handleItemWebhook({
        item_id: 'item-123',
        webhook_code: 'PENDING_EXPIRATION',
      } as any);

      expect(prisma.providerConnection.updateMany).toHaveBeenCalledWith({
        where: { provider: 'plaid', providerUserId: 'item-123' },
        data: {
          metadata: expect.objectContaining({
            pendingExpiration: true,
          }),
        },
      });
    });

    it('should mark connection as revoked on USER_PERMISSION_REVOKED', async () => {
      prisma.providerConnection.updateMany.mockResolvedValue({ count: 1 });

      await handler.handleItemWebhook({
        item_id: 'item-123',
        webhook_code: 'USER_PERMISSION_REVOKED',
      } as any);

      expect(prisma.providerConnection.updateMany).toHaveBeenCalledWith({
        where: { provider: 'plaid', providerUserId: 'item-123' },
        data: {
          metadata: expect.objectContaining({
            revokedAt: expect.any(String),
          }),
        },
      });
    });

    it('should do nothing for unknown webhook code', async () => {
      await handler.handleItemWebhook({
        item_id: 'item-123',
        webhook_code: 'UNKNOWN_CODE',
      } as any);

      expect(prisma.providerConnection.updateMany).not.toHaveBeenCalled();
    });
  });
});
