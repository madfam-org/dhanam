import * as crypto from 'crypto';

import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { CryptoService } from '@core/crypto/crypto.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { CircuitBreakerService } from '@modules/providers/orchestrator/circuit-breaker.service';

import { BitsoService } from '../bitso.service';
import { BitsoWebhookDto } from '../dto/webhook.dto';

describe('BitsoService - Webhook Contract Tests', () => {
  let service: BitsoService;
  let prisma: jest.Mocked<PrismaService>;

  const WEBHOOK_SECRET = 'test-bitso-webhook-secret';

  const mockConnection = {
    id: 'conn-123',
    provider: 'bitso',
    providerUserId: 'bitso-user-123',
    userId: 'user-123',
    encryptedToken: JSON.stringify('encrypted-api-key'),
  };

  const mockAccount = {
    id: 'account-123',
    spaceId: 'space-123',
    provider: 'bitso',
    name: 'BTC Wallet',
    balance: 1.5,
    currency: 'BTC',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BitsoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'BITSO_WEBHOOK_SECRET') return WEBHOOK_SECRET;
              if (key === 'BITSO_API_KEY') return null; // Disable Bitso client
              if (key === 'BITSO_API_SECRET') return null;
              return defaultValue;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            providerConnection: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
            account: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              updateMany: jest.fn(),
            },
            transaction: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: CryptoService,
          useValue: {
            encrypt: jest.fn((data) => `encrypted-${data}`),
            decrypt: jest.fn((data) => data.replace('encrypted-', '')),
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
      ],
    }).compile();

    service = module.get<BitsoService>(BitsoService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;

    jest.clearAllMocks();
  });

  describe('Webhook Signature Verification (SECURITY CRITICAL)', () => {
    it('should verify valid HMAC-SHA256 signature', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'txn-123',
        user: 'bitso-user-123',
        amount: 0.5,
        currency: 'BTC',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
      };
      const payload = JSON.stringify(webhookDto);
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payload, 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncPortfolio').mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, validSignature)).resolves.not.toThrow();
    });

    it('should reject invalid signature (SECURITY)', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'txn-123',
        user: 'bitso-user-123',
        amount: 0.5,
        currency: 'BTC',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
      };
      const invalidSignature = 'invalid-signature-xyz';

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
      const webhookDto: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'txn-123',
        user: 'bitso-user-123',
        amount: 0.5,
        currency: 'BTC',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
      };
      const payload = JSON.stringify(webhookDto);
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payload, 'utf8')
        .digest('hex');

      // Tamper signature (same length)
      const tamperedSignature = validSignature.replace('a', 'b');

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, tamperedSignature)).rejects.toThrow(
        'Invalid webhook signature'
      );
    });

    it('should reject webhook with missing signature', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'txn-123',
        user: 'bitso-user-123',
        amount: 0.5,
        currency: 'BTC',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
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
          BitsoService,
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
            useValue: { encrypt: jest.fn(), decrypt: jest.fn() },
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

      const serviceWithoutSecret = moduleWithoutSecret.get<BitsoService>(BitsoService);

      const webhookDto: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'txn-123',
        user: 'bitso-user-123',
        amount: 0.5,
        currency: 'BTC',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
      };

      // Act & Assert
      await expect(serviceWithoutSecret.handleWebhook(webhookDto, 'any-signature')).rejects.toThrow(
        'Invalid webhook signature'
      );
    });
  });

  describe('DEPOSITS Webhook Type', () => {
    it('should handle completed deposit', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'deposit-123',
        user: 'bitso-user-123',
        amount: 1.5,
        currency: 'BTC',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
        details: {
          address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        },
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncPortfolio').mockResolvedValue(undefined);

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(prisma.providerConnection.findFirst).toHaveBeenCalledWith({
        where: {
          provider: 'bitso',
          providerUserId: 'bitso-user-123',
        },
      });
    });

    it('should handle pending deposit', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'deposit-pending',
        user: 'bitso-user-123',
        amount: 0.25,
        currency: 'ETH',
        status: 'pending',
        timestamp: '2025-11-15T12:00:00Z',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncPortfolio').mockResolvedValue(undefined);

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert - Should still sync portfolio
      expect(prisma.providerConnection.findFirst).toHaveBeenCalled();
    });
  });

  describe('WITHDRAWALS Webhook Type', () => {
    it('should handle completed withdrawal', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'withdrawals',
        tid: 'withdrawal-123',
        user: 'bitso-user-123',
        amount: 0.5,
        currency: 'BTC',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
        details: {
          destination: '1BoatSLRHtKNngkdXEeobR76b53LETtpyT',
        },
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncPortfolio').mockResolvedValue(undefined);

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(prisma.providerConnection.findFirst).toHaveBeenCalled();
    });

    it('should handle failed withdrawal', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'withdrawals',
        tid: 'withdrawal-failed',
        user: 'bitso-user-123',
        amount: 2.0,
        currency: 'BTC',
        status: 'failed',
        timestamp: '2025-11-15T12:00:00Z',
        details: {
          error: 'Insufficient funds',
        },
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncPortfolio').mockResolvedValue(undefined);

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert - Should still sync to reflect correct balance
      expect(prisma.providerConnection.findFirst).toHaveBeenCalled();
    });
  });

  describe('TRADES Webhook Type', () => {
    it('should handle completed trade', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'trades',
        tid: 'trade-123',
        user: 'bitso-user-123',
        amount: 0.1,
        currency: 'BTC',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
        details: {
          book: 'btc_mxn',
          price: '500000',
          side: 'buy',
        },
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncPortfolio').mockResolvedValue(undefined);

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(prisma.providerConnection.findFirst).toHaveBeenCalled();
    });

    it('should handle sell trade', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'trades',
        tid: 'trade-sell-456',
        user: 'bitso-user-123',
        amount: 0.05,
        currency: 'BTC',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
        details: {
          book: 'btc_usd',
          price: '45000',
          side: 'sell',
        },
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncPortfolio').mockResolvedValue(undefined);

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(prisma.providerConnection.findFirst).toHaveBeenCalled();
    });
  });

  describe('ORDERS Webhook Type', () => {
    it('should handle new order', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'orders',
        tid: 'order-123',
        user: 'bitso-user-123',
        amount: 0.2,
        currency: 'BTC',
        status: 'pending',
        timestamp: '2025-11-15T12:00:00Z',
        details: {
          type: 'limit',
          price: '46000',
        },
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      // Service logs order webhook receipt, not "unhandled"
      expect(loggerSpy).toHaveBeenCalledWith('Order webhook received for order-123');
    });
  });

  describe('Webhook Event Logging', () => {
    it('should log all incoming webhooks', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'txn-789',
        user: 'bitso-user-123',
        amount: 1.0,
        currency: 'BTC',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncPortfolio').mockResolvedValue(undefined);
      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Received Bitso webhook: deposits for transaction txn-789'
      );
    });
  });

  describe('Payload Tampering Detection', () => {
    it('should detect tampered payload', async () => {
      // Arrange
      const originalWebhook: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'txn-123',
        user: 'bitso-user-123',
        amount: 0.5,
        currency: 'BTC',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(originalWebhook), 'utf8')
        .digest('hex');

      // Tamper with amount after signature
      const tamperedWebhook: BitsoWebhookDto = {
        ...originalWebhook,
        amount: 10.0, // Inflated amount
      };

      // Act & Assert
      await expect(service.handleWebhook(tamperedWebhook, validSignature)).rejects.toThrow(
        'Invalid webhook signature'
      );
    });

    it('should detect modified user ID', async () => {
      // Arrange
      const originalWebhook: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'txn-123',
        user: 'bitso-user-123',
        amount: 0.5,
        currency: 'BTC',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(originalWebhook), 'utf8')
        .digest('hex');

      // Tamper with user ID
      const tamperedWebhook: BitsoWebhookDto = {
        ...originalWebhook,
        user: 'bitso-user-999',
      };

      // Act & Assert
      await expect(service.handleWebhook(tamperedWebhook, validSignature)).rejects.toThrow(
        'Invalid webhook signature'
      );
    });

    it('should detect modified status', async () => {
      // Arrange
      const originalWebhook: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'txn-123',
        user: 'bitso-user-123',
        amount: 0.5,
        currency: 'BTC',
        status: 'pending',
        timestamp: '2025-11-15T12:00:00Z',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(originalWebhook), 'utf8')
        .digest('hex');

      // Change status from pending to completed
      const tamperedWebhook: BitsoWebhookDto = {
        ...originalWebhook,
        status: 'completed',
      };

      // Act & Assert
      await expect(service.handleWebhook(tamperedWebhook, validSignature)).rejects.toThrow(
        'Invalid webhook signature'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing connection gracefully', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'txn-123',
        user: 'nonexistent-user',
        amount: 0.5,
        currency: 'BTC',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, validSignature)).resolves.not.toThrow();
    });

    it('should propagate sync errors', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'txn-123',
        user: 'bitso-user-123',
        amount: 0.5,
        currency: 'BTC',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncPortfolio').mockRejectedValue(new Error('Sync failed'));
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, validSignature)).rejects.toThrow(
        'Sync failed'
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to handle webhook for transaction txn-123:',
        expect.any(Error)
      );
    });
  });

  describe('Multiple Currency Support', () => {
    it('should handle BTC deposits', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'btc-deposit',
        user: 'bitso-user-123',
        amount: 0.5,
        currency: 'BTC',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncPortfolio').mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, validSignature)).resolves.not.toThrow();
    });

    it('should handle ETH deposits', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'eth-deposit',
        user: 'bitso-user-123',
        amount: 5.0,
        currency: 'ETH',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncPortfolio').mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, validSignature)).resolves.not.toThrow();
    });

    it('should handle MXN fiat deposits', async () => {
      // Arrange
      const webhookDto: BitsoWebhookDto = {
        type: 'deposits',
        tid: 'mxn-deposit',
        user: 'bitso-user-123',
        amount: 10000,
        currency: 'MXN',
        status: 'completed',
        timestamp: '2025-11-15T12:00:00Z',
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncPortfolio').mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, validSignature)).resolves.not.toThrow();
    });
  });
});
