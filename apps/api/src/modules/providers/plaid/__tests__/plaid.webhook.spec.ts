import * as crypto from 'crypto';

import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '@core/audit/audit.service';
import { CryptoService } from '@core/crypto/crypto.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { CircuitBreakerService } from '@modules/providers/orchestrator/circuit-breaker.service';

import { PlaidWebhookDto } from '../dto/webhook.dto';
import { PlaidWebhookHandler } from '../plaid-webhook.handler';
import { PlaidService } from '../plaid.service';

describe('PlaidService - Webhook Contract Tests', () => {
  let service: PlaidService;
  let webhookHandler: PlaidWebhookHandler;
  let prisma: jest.Mocked<PrismaService>;
  let cryptoService: jest.Mocked<CryptoService>;

  const WEBHOOK_SECRET = 'test-plaid-webhook-secret';
  const ACCESS_TOKEN = 'access-sandbox-test-token';
  const ENCRYPTED_TOKEN = 'encrypted-access-sandbox-test-token';

  const mockConnection = {
    id: 'conn-123',
    provider: 'plaid',
    providerUserId: 'item-123',
    userId: 'user-123',
    encryptedToken: JSON.stringify(ENCRYPTED_TOKEN),
    metadata: {
      cursor: null,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaidService,
        PlaidWebhookHandler,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'PLAID_WEBHOOK_SECRET') return WEBHOOK_SECRET;
              if (key === 'PLAID_CLIENT_ID') return null; // Disable Plaid client
              if (key === 'PLAID_SECRET') return null;
              return defaultValue;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            providerConnection: {
              findFirst: jest.fn(),
              updateMany: jest.fn(),
            },
            account: {
              findFirst: jest.fn(),
              create: jest.fn(),
              updateMany: jest.fn(),
            },
            transaction: {
              findFirst: jest.fn(),
              create: jest.fn(),
              updateMany: jest.fn(),
              deleteMany: jest.fn(),
            },
          },
        },
        {
          provide: CryptoService,
          useValue: {
            encrypt: jest.fn((data) => `encrypted-${data}`),
            decrypt: jest.fn(() => ACCESS_TOKEN),
          },
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
          },
        },
      ],
    }).compile();

    service = module.get<PlaidService>(PlaidService);
    webhookHandler = module.get<PlaidWebhookHandler>(PlaidWebhookHandler);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    cryptoService = module.get(CryptoService) as jest.Mocked<CryptoService>;

    jest.clearAllMocks();
  });

  describe('Webhook Signature Verification (SECURITY CRITICAL)', () => {
    it('should verify valid HMAC-SHA256 signature', async () => {
      // Arrange
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'SYNC_UPDATES_AVAILABLE',
        item_id: 'item-123',
        environment: 'sandbox',
      };
      const payload = JSON.stringify(webhookDto);
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payload, 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest
        .spyOn(service as any, 'syncTransactions')
        .mockResolvedValue({ transactionCount: 0, accountCount: 0 });

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, validSignature)).resolves.not.toThrow();
    });

    it('should reject invalid signature (SECURITY)', async () => {
      // Arrange
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
        environment: 'sandbox',
      };
      // Use a valid hex string of same length as expected signature (64 chars for SHA256)
      const invalidSignature = 'a'.repeat(64);

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, invalidSignature)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.handleWebhook(webhookDto, invalidSignature)).rejects.toThrow(
        'Invalid webhook signature'
      );
    });

    it('should use timing-safe comparison to prevent timing attacks', async () => {
      // Arrange
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'SYNC_UPDATES_AVAILABLE',
        item_id: 'item-123',
        environment: 'sandbox',
      };
      const payload = JSON.stringify(webhookDto);
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payload, 'utf8')
        .digest('hex');

      // Tamper with one character (same length)
      const tamperedSignature = validSignature.replace('a', 'b');

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, tamperedSignature)).rejects.toThrow(
        'Invalid webhook signature'
      );
    });

    it('should reject webhook with missing signature', async () => {
      // Arrange
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
        environment: 'sandbox',
      };

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, '')).rejects.toThrow(
        'Invalid webhook signature'
      );
    });

    it('should reject webhook when secret not configured', async () => {
      // Arrange: Create service without webhook secret
      const moduleWithoutSecret = await Test.createTestingModule({
        providers: [
          PlaidService,
          PlaidWebhookHandler,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ''), // No secret
            },
          },
          {
            provide: PrismaService,
            useValue: prisma,
          },
          {
            provide: CryptoService,
            useValue: cryptoService,
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
            },
          },
        ],
      }).compile();

      const serviceWithoutSecret = moduleWithoutSecret.get<PlaidService>(PlaidService);

      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
        environment: 'sandbox',
      };

      // Act & Assert
      await expect(serviceWithoutSecret.handleWebhook(webhookDto, 'any-signature')).rejects.toThrow(
        'Invalid webhook signature'
      );
    });
  });

  describe('TRANSACTIONS Webhook Type', () => {
    it('should handle SYNC_UPDATES_AVAILABLE event', async () => {
      // Arrange
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'SYNC_UPDATES_AVAILABLE',
        item_id: 'item-123',
        environment: 'sandbox',
        new_transactions: 5,
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      const syncTransactionsSpy = jest
        .spyOn(service as any, 'syncTransactions')
        .mockResolvedValue({ transactionCount: 5, accountCount: 1 });

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(syncTransactionsSpy).toHaveBeenCalledWith(ACCESS_TOKEN, 'item-123');
      expect(cryptoService.decrypt).toHaveBeenCalledWith(JSON.parse(mockConnection.encryptedToken));
    });

    it('should handle DEFAULT_UPDATE event', async () => {
      // Arrange
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'item-123',
        environment: 'sandbox',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      const syncTransactionsSpy = jest
        .spyOn(service as any, 'syncTransactions')
        .mockResolvedValue({ transactionCount: 0, accountCount: 1 });

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(syncTransactionsSpy).toHaveBeenCalledWith(ACCESS_TOKEN, 'item-123');
    });

    it('should handle INITIAL_UPDATE event', async () => {
      // Arrange
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'INITIAL_UPDATE',
        item_id: 'item-123',
        environment: 'sandbox',
        new_transactions: 100,
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      const syncTransactionsSpy = jest
        .spyOn(service as any, 'syncTransactions')
        .mockResolvedValue({ transactionCount: 100, accountCount: 1 });

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(syncTransactionsSpy).toHaveBeenCalledWith(ACCESS_TOKEN, 'item-123');
    });

    it('should handle HISTORICAL_UPDATE event', async () => {
      // Arrange
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'HISTORICAL_UPDATE',
        item_id: 'item-123',
        environment: 'sandbox',
        new_transactions: 250,
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      const syncTransactionsSpy = jest
        .spyOn(service as any, 'syncTransactions')
        .mockResolvedValue({ transactionCount: 250, accountCount: 1 });

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(syncTransactionsSpy).toHaveBeenCalledWith(ACCESS_TOKEN, 'item-123');
    });

    it('should handle TRANSACTIONS_REMOVED event', async () => {
      // Arrange
      const removedIds = ['txn-1', 'txn-2', 'txn-3'];
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'TRANSACTIONS_REMOVED',
        item_id: 'item-123',
        environment: 'sandbox',
        removed_transactions: removedIds,
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      const removeTransactionSpy = jest
        .spyOn(service as any, 'removeTransaction')
        .mockResolvedValue(undefined);

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(removeTransactionSpy).toHaveBeenCalledTimes(3);
      expect(removeTransactionSpy).toHaveBeenCalledWith('txn-1', 'item-123');
      expect(removeTransactionSpy).toHaveBeenCalledWith('txn-2', 'item-123');
      expect(removeTransactionSpy).toHaveBeenCalledWith('txn-3', 'item-123');
    });

    it('should handle missing connection gracefully', async () => {
      // Arrange
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'DEFAULT_UPDATE',
        item_id: 'nonexistent-item',
        environment: 'sandbox',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, validSignature)).resolves.not.toThrow();
    });
  });

  describe('ACCOUNTS Webhook Type', () => {
    it('should log ACCOUNTS webhook event', async () => {
      // Arrange
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'ACCOUNTS',
        webhook_code: 'DEFAULT_UPDATE_ACCOUNTS',
        item_id: 'item-123',
        environment: 'sandbox',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      const loggerSpy = jest.spyOn((service as any).logger, 'log');
      // Mock webhookHandler.handleAccountWebhook to prevent calling null plaidClient
      jest.spyOn(webhookHandler, 'handleAccountWebhook').mockResolvedValue(undefined);

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Received Plaid webhook: ACCOUNTS:DEFAULT_UPDATE_ACCOUNTS for item item-123'
      );
    });
  });

  describe('ITEM Webhook Type', () => {
    it('should log ERROR event', async () => {
      // Arrange
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'ITEM',
        webhook_code: 'ERROR',
        item_id: 'item-123',
        environment: 'sandbox',
        error: {
          error_type: 'ITEM_ERROR',
          error_code: 'ITEM_LOGIN_REQUIRED',
          error_message: 'User needs to re-authenticate',
          display_message: 'Please re-connect your account',
        },
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      // The error log comes from PlaidWebhookHandler
      const loggerSpy = jest.spyOn((webhookHandler as any).logger, 'error');

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(`Plaid item error for item-123:`, webhookDto.error);
    });

    it('should log PENDING_EXPIRATION event', async () => {
      // Arrange
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'ITEM',
        webhook_code: 'PENDING_EXPIRATION',
        item_id: 'item-123',
        environment: 'sandbox',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      // The warn log comes from PlaidWebhookHandler
      const loggerSpy = jest.spyOn((webhookHandler as any).logger, 'warn');

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith('Plaid item item-123 will expire soon');
    });

    it('should log USER_PERMISSION_REVOKED event', async () => {
      // Arrange
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'ITEM',
        webhook_code: 'USER_PERMISSION_REVOKED',
        item_id: 'item-123',
        environment: 'sandbox',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      // The log comes from PlaidWebhookHandler
      const loggerSpy = jest.spyOn((webhookHandler as any).logger, 'log');

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith('User revoked permissions for Plaid item item-123');
    });
  });

  describe('Webhook Event Logging', () => {
    it('should log all incoming webhooks with type and code', async () => {
      // Arrange
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'SYNC_UPDATES_AVAILABLE',
        item_id: 'item-123',
        environment: 'sandbox',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest
        .spyOn(service as any, 'syncTransactions')
        .mockResolvedValue({ transactionCount: 0, accountCount: 0 });
      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Received Plaid webhook: TRANSACTIONS:SYNC_UPDATES_AVAILABLE for item item-123'
      );
    });
  });

  describe('Payload Tampering Detection', () => {
    it('should detect tampered payload', async () => {
      // Arrange
      const originalWebhook: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'SYNC_UPDATES_AVAILABLE',
        item_id: 'item-123',
        environment: 'sandbox',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(originalWebhook), 'utf8')
        .digest('hex');

      // Tamper with item_id after signature
      const tamperedWebhook: PlaidWebhookDto = {
        ...originalWebhook,
        item_id: 'tampered-item-456',
      };

      // Act & Assert
      await expect(service.handleWebhook(tamperedWebhook, validSignature)).rejects.toThrow(
        'Invalid webhook signature'
      );
    });

    it('should detect modified webhook code', async () => {
      // Arrange
      const originalWebhook: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'SYNC_UPDATES_AVAILABLE',
        item_id: 'item-123',
        environment: 'sandbox',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(originalWebhook), 'utf8')
        .digest('hex');

      // Modify webhook code
      const tamperedWebhook: PlaidWebhookDto = {
        ...originalWebhook,
        webhook_code: 'TRANSACTIONS_REMOVED',
      };

      // Act & Assert
      await expect(service.handleWebhook(tamperedWebhook, validSignature)).rejects.toThrow(
        'Invalid webhook signature'
      );
    });

    it('should detect injected transaction count', async () => {
      // Arrange
      const originalWebhook: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'SYNC_UPDATES_AVAILABLE',
        item_id: 'item-123',
        environment: 'sandbox',
        new_transactions: 5,
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(originalWebhook), 'utf8')
        .digest('hex');

      // Tamper with transaction count
      const tamperedWebhook: PlaidWebhookDto = {
        ...originalWebhook,
        new_transactions: 500, // Inflated count
      };

      // Act & Assert
      await expect(service.handleWebhook(tamperedWebhook, validSignature)).rejects.toThrow(
        'Invalid webhook signature'
      );
    });
  });

  describe('Error Handling', () => {
    it('should propagate sync errors', async () => {
      // Arrange
      const webhookDto: PlaidWebhookDto = {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'SYNC_UPDATES_AVAILABLE',
        item_id: 'item-123',
        environment: 'sandbox',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncTransactions').mockRejectedValue(new Error('Sync failed'));
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, validSignature)).rejects.toThrow(
        'Sync failed'
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to handle webhook for item item-123:',
        expect.any(Error)
      );
    });
  });
});
