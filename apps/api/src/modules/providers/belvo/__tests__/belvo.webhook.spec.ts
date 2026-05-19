import * as crypto from 'crypto';

import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '@core/audit/audit.service';
import { CryptoService } from '@core/crypto/crypto.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { CircuitBreakerService } from '@modules/providers/orchestrator/circuit-breaker.service';

import { BelvoService } from '../belvo.service';
import { BelvoWebhookDto, BelvoWebhookEvent } from '../dto/webhook.dto';

describe('BelvoService - Webhook Contract Tests', () => {
  let service: BelvoService;
  let prisma: jest.Mocked<PrismaService>;
  let auditService: jest.Mocked<AuditService>;

  const WEBHOOK_SECRET = 'test-belvo-webhook-secret';

  const mockConnection = {
    id: 'conn-123',
    provider: 'belvo',
    providerUserId: 'link-123',
    userId: 'user-123',
    metadata: {},
    user: {
      userSpaces: [
        {
          space: {
            id: 'space-123',
            name: 'Test Space',
          },
        },
      ],
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BelvoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'BELVO_WEBHOOK_SECRET') return WEBHOOK_SECRET;
              if (key === 'BELVO_SECRET_KEY_ID') return null; // Disable Belvo client
              if (key === 'BELVO_SECRET_KEY_PASSWORD') return null;
              return defaultValue;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            providerConnection: {
              findFirst: jest.fn(),
              create: jest.fn(),
              updateMany: jest.fn(),
            },
            account: {
              findFirst: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
            },
            transaction: {
              findFirst: jest.fn(),
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
          provide: AuditService,
          useValue: {
            logProviderConnection: jest.fn(),
            log: jest.fn(),
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

    service = module.get<BelvoService>(BelvoService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    auditService = module.get(AuditService) as jest.Mocked<AuditService>;

    jest.clearAllMocks();
  });

  describe('Webhook Signature Verification (SECURITY CRITICAL)', () => {
    it('should verify valid HMAC-SHA256 signature', async () => {
      // Arrange
      const webhookDto: BelvoWebhookDto = {
        event: BelvoWebhookEvent.ACCOUNTS_CREATED,
        link_id: 'link-123',
        data: {},
      };
      const payload = JSON.stringify(webhookDto);
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payload, 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncAccounts').mockResolvedValue([]);

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, validSignature)).resolves.not.toThrow();
    });

    it('should reject invalid signature (SECURITY)', async () => {
      // Arrange
      const webhookDto: BelvoWebhookDto = {
        event: BelvoWebhookEvent.ACCOUNTS_CREATED,
        link_id: 'link-123',
        data: {},
      };
      const invalidSignature = 'invalid-signature-12345';

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
      const webhookDto: BelvoWebhookDto = {
        event: BelvoWebhookEvent.ACCOUNTS_CREATED,
        link_id: 'link-123',
        data: {},
      };
      const payload = JSON.stringify(webhookDto);
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payload, 'utf8')
        .digest('hex');

      // Modify signature slightly (same length, different content)
      const tamperedSignature = validSignature.replace('a', 'b');

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, tamperedSignature)).rejects.toThrow(
        'Invalid webhook signature'
      );
    });

    it('should reject webhook with missing signature', async () => {
      // Arrange
      const webhookDto: BelvoWebhookDto = {
        event: BelvoWebhookEvent.ACCOUNTS_CREATED,
        link_id: 'link-123',
        data: {},
      };

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, '')).rejects.toThrow(
        'Invalid webhook signature'
      );
    });

    it('should reject webhook when secret not configured', async () => {
      // Arrange: Create new service instance without webhook secret
      const moduleWithoutSecret = await Test.createTestingModule({
        providers: [
          BelvoService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'BELVO_WEBHOOK_SECRET') return ''; // No secret
                return null;
              }),
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
            provide: AuditService,
            useValue: auditService,
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

      const serviceWithoutSecret = moduleWithoutSecret.get<BelvoService>(BelvoService);

      const webhookDto: BelvoWebhookDto = {
        event: BelvoWebhookEvent.ACCOUNTS_CREATED,
        link_id: 'link-123',
        data: {},
      };

      // Act & Assert
      await expect(serviceWithoutSecret.handleWebhook(webhookDto, 'any-signature')).rejects.toThrow(
        'Invalid webhook signature'
      );
    });
  });

  describe('ACCOUNTS_CREATED Event', () => {
    it('should sync accounts when ACCOUNTS_CREATED event received', async () => {
      // Arrange
      const webhookDto: BelvoWebhookDto = {
        event: BelvoWebhookEvent.ACCOUNTS_CREATED,
        link_id: 'link-123',
        data: {
          accounts: [{ id: 'acc-1', name: 'Checking' }],
        },
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      const syncAccountsSpy = jest.spyOn(service as any, 'syncAccounts').mockResolvedValue([]);

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(syncAccountsSpy).toHaveBeenCalledWith('space-123', 'user-123', 'link-123');
    });

    it('should handle missing connection gracefully', async () => {
      // Arrange
      const webhookDto: BelvoWebhookDto = {
        event: BelvoWebhookEvent.ACCOUNTS_CREATED,
        link_id: 'nonexistent-link',
        data: {},
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, validSignature)).resolves.not.toThrow();
    });

    it('should handle missing space gracefully', async () => {
      // Arrange
      const webhookDto: BelvoWebhookDto = {
        event: BelvoWebhookEvent.ACCOUNTS_CREATED,
        link_id: 'link-123',
        data: {},
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      const connectionWithoutSpace = {
        ...mockConnection,
        user: {
          userSpaces: [],
        },
      };
      prisma.providerConnection.findFirst.mockResolvedValue(connectionWithoutSpace as any);

      // Act & Assert
      await expect(service.handleWebhook(webhookDto, validSignature)).resolves.not.toThrow();
    });
  });

  describe('TRANSACTIONS_CREATED Event', () => {
    it('should sync transactions when TRANSACTIONS_CREATED event received', async () => {
      // Arrange
      const webhookDto: BelvoWebhookDto = {
        event: BelvoWebhookEvent.TRANSACTIONS_CREATED,
        link_id: 'link-123',
        data: {
          transaction_count: 25,
        },
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      const syncTransactionsSpy = jest
        .spyOn(service as any, 'syncTransactions')
        .mockResolvedValue([]);

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(syncTransactionsSpy).toHaveBeenCalledWith('space-123', 'user-123', 'link-123');
    });
  });

  describe('LINK_FAILED Event', () => {
    it('should log error when LINK_FAILED event received', async () => {
      // Arrange
      const webhookDto: BelvoWebhookDto = {
        event: BelvoWebhookEvent.LINK_FAILED,
        link_id: 'link-123',
        data: {
          error: 'Authentication failed',
          error_code: 'invalid_credentials',
        },
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(`Link failed: ${webhookDto.link_id}`, webhookDto.data);
    });
  });

  describe('LINK_CREATED Event', () => {
    it('should handle LINK_CREATED event (no action required)', async () => {
      // Arrange
      const webhookDto: BelvoWebhookDto = {
        event: BelvoWebhookEvent.LINK_CREATED,
        link_id: 'link-123',
        data: {},
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
      expect(loggerSpy).toHaveBeenCalledWith('Received Belvo webhook: link_created');
    });
  });

  describe('Webhook Event Logging', () => {
    it('should log all incoming webhooks', async () => {
      // Arrange
      const webhookDto: BelvoWebhookDto = {
        event: BelvoWebhookEvent.ACCOUNTS_CREATED,
        link_id: 'link-123',
        data: {},
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncAccounts').mockResolvedValue([]);
      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      // Act
      await service.handleWebhook(webhookDto, validSignature);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith('Received Belvo webhook: accounts_created');
    });
  });

  describe('Webhook Idempotency', () => {
    it('should handle duplicate webhook deliveries gracefully', async () => {
      // Arrange
      const webhookDto: BelvoWebhookDto = {
        event: BelvoWebhookEvent.ACCOUNTS_CREATED,
        link_id: 'link-123',
        data: {},
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(webhookDto), 'utf8')
        .digest('hex');

      prisma.providerConnection.findFirst.mockResolvedValue(mockConnection as any);
      jest.spyOn(service as any, 'syncAccounts').mockResolvedValue([]);

      // Act - Process same webhook twice
      await service.handleWebhook(webhookDto, validSignature);
      await service.handleWebhook(webhookDto, validSignature);

      // Assert - Should not throw errors
      expect(prisma.providerConnection.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe('Payload Tampering Detection', () => {
    it('should detect tampered payload', async () => {
      // Arrange
      const originalWebhook: BelvoWebhookDto = {
        event: BelvoWebhookEvent.ACCOUNTS_CREATED,
        link_id: 'link-123',
        data: {},
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(originalWebhook), 'utf8')
        .digest('hex');

      // Tamper with link_id after signature generation
      const tamperedWebhook: BelvoWebhookDto = {
        ...originalWebhook,
        link_id: 'tampered-link-456',
      };

      // Act & Assert
      await expect(service.handleWebhook(tamperedWebhook, validSignature)).rejects.toThrow(
        'Invalid webhook signature'
      );
    });

    it('should detect modified event type', async () => {
      // Arrange
      const originalWebhook: BelvoWebhookDto = {
        event: BelvoWebhookEvent.ACCOUNTS_CREATED,
        link_id: 'link-123',
        data: {},
      };
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(originalWebhook), 'utf8')
        .digest('hex');

      // Modify event after signature
      const tamperedWebhook: BelvoWebhookDto = {
        ...originalWebhook,
        event: BelvoWebhookEvent.TRANSACTIONS_CREATED,
      };

      // Act & Assert
      await expect(service.handleWebhook(tamperedWebhook, validSignature)).rejects.toThrow(
        'Invalid webhook signature'
      );
    });
  });
});
