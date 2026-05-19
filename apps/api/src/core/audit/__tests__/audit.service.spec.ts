import { Test, TestingModule } from '@nestjs/testing';

import { CryptoService } from '@core/crypto/crypto.service';
import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';

import { AuditService, AuditEventData } from '../audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: jest.Mocked<PrismaService>;
  let logger: jest.Mocked<LoggerService>;
  let cryptoService: jest.Mocked<CryptoService>;

  beforeEach(async () => {
    const mockPrisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const mockCryptoService = {
      hmac: jest.fn().mockReturnValue('mock-hmac-hash'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggerService, useValue: mockLogger },
        { provide: CryptoService, useValue: mockCryptoService },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prisma = module.get(PrismaService);
    logger = module.get(LoggerService);
    cryptoService = module.get(CryptoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logEvent', () => {
    it('should create an audit log entry with basic data', async () => {
      const data: AuditEventData = {
        action: 'USER_LOGIN',
        resource: 'auth',
        userId: 'user-123',
      };

      await service.logEvent(data);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'USER_LOGIN',
          resource: 'auth',
          userId: 'user-123',
          severity: 'low',
          timestamp: expect.any(Date),
        }),
      });
    });

    it('should include HMAC chain hash in metadata', async () => {
      await service.logEvent({ action: 'TEST_ACTION' });

      expect(cryptoService.hmac).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.stringContaining('_chain'),
        }),
      });
    });

    it('should chain HMAC hashes across consecutive events', async () => {
      cryptoService.hmac.mockReturnValueOnce('hash-1').mockReturnValueOnce('hash-2');

      await service.logEvent({ action: 'EVENT_1' });
      await service.logEvent({ action: 'EVENT_2' });

      // Second call should include hash-1 as part of input
      const secondCallInput = cryptoService.hmac.mock.calls[1][0];
      expect(secondCallInput).toContain('hash-1');
    });

    it('should start HMAC chain from "0" for first event', async () => {
      await service.logEvent({ action: 'FIRST_EVENT' });

      const firstCallInput = cryptoService.hmac.mock.calls[0][0];
      expect(firstCallInput).toMatch(/^0\|/);
    });

    it('should serialize metadata and embed chain hash', async () => {
      const data: AuditEventData = {
        action: 'DATA_ACCESS',
        metadata: { field: 'email', reason: 'export' },
      };

      await service.logEvent(data);

      const createCall = prisma.auditLog.create.mock.calls[0][0];
      const storedMetadata = JSON.parse(createCall.data.metadata as string);
      expect(storedMetadata.field).toBe('email');
      expect(storedMetadata.reason).toBe('export');
      expect(storedMetadata._chain).toBe('mock-hmac-hash');
    });

    it('should create metadata with chain hash when no metadata provided', async () => {
      await service.logEvent({ action: 'SIMPLE_EVENT' });

      const createCall = prisma.auditLog.create.mock.calls[0][0];
      const storedMetadata = JSON.parse(createCall.data.metadata as string);
      expect(storedMetadata._chain).toBe('mock-hmac-hash');
    });

    it('should default severity to "low"', async () => {
      await service.logEvent({ action: 'TEST' });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ severity: 'low' }),
      });
    });

    it('should use provided severity', async () => {
      await service.logEvent({ action: 'TEST', severity: 'critical' });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ severity: 'critical' }),
      });
    });

    it('should log warning for critical severity events', async () => {
      await service.logEvent({
        action: 'SUSPICIOUS_LOGIN',
        resource: 'auth',
        userId: 'user-123',
        severity: 'critical',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Security event: SUSPICIOUS_LOGIN'),
        'AuditService'
      );
    });

    it('should log warning for high severity events', async () => {
      await service.logEvent({
        action: 'PASSWORD_RESET',
        resource: 'user',
        userId: 'user-123',
        severity: 'high',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Security event: PASSWORD_RESET'),
        'AuditService'
      );
    });

    it('should not log warning for low severity events', async () => {
      await service.logEvent({ action: 'PAGE_VIEW', severity: 'low' });

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should not log warning for medium severity events', async () => {
      await service.logEvent({ action: 'TOTP_ENABLED', severity: 'medium' });

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should handle Prisma errors gracefully', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('DB connection failed'));

      await service.logEvent({ action: 'TEST' });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to log audit event',
        'DB connection failed',
        'AuditService'
      );
    });

    it('should include all optional fields when provided', async () => {
      const data: AuditEventData = {
        action: 'DATA_EXPORT',
        resource: 'transactions',
        resourceId: 'txn-456',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: { format: 'csv' },
        severity: 'medium',
      };

      await service.logEvent(data);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'DATA_EXPORT',
          resource: 'transactions',
          resourceId: 'txn-456',
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          severity: 'medium',
        }),
      });
    });
  });

  describe('log', () => {
    it('should delegate to logEvent', async () => {
      const data: AuditEventData = { action: 'TEST_LOG' };

      await service.log(data);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'TEST_LOG' }),
      });
    });
  });

  describe('exportUserAuditLogs', () => {
    it('should return sanitized logs for a user', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'LOGIN',
          resource: 'auth',
          resourceId: null,
          timestamp: new Date('2026-01-01'),
          severity: 'low',
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          metadata: '{"_chain":"hash"}',
        },
      ];

      prisma.auditLog.findMany.mockResolvedValue(mockLogs as any);

      const result = await service.exportUserAuditLogs('user-123');

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { timestamp: 'asc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        action: 'LOGIN',
        resource: 'auth',
        resourceId: null,
        timestamp: new Date('2026-01-01'),
        severity: 'low',
      });
    });

    it('should exclude sensitive fields from export (ipAddress, metadata)', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: 'LOGIN',
          resource: 'auth',
          resourceId: null,
          timestamp: new Date(),
          severity: 'low',
          userId: 'user-123',
          ipAddress: '10.0.0.1',
          metadata: '{"secret":"data"}',
        },
      ] as any);

      const result = await service.exportUserAuditLogs('user-123');

      expect(result[0]).not.toHaveProperty('ipAddress');
      expect(result[0]).not.toHaveProperty('metadata');
      expect(result[0]).not.toHaveProperty('id');
    });

    it('should return empty array for user with no logs', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.exportUserAuditLogs('user-999');

      expect(result).toEqual([]);
    });
  });

  describe('applyRetentionPolicy', () => {
    it('should delete logs older than specified retention period', async () => {
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 42 });

      const result = await service.applyRetentionPolicy(365);

      expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({
        where: {
          timestamp: { lt: expect.any(Date) },
          retainUntil: { lt: expect.any(Date) },
        },
      });
      expect(result).toBe(42);
    });

    it('should default to 365 days retention', async () => {
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });

      await service.applyRetentionPolicy();

      const call = prisma.auditLog.deleteMany.mock.calls[0][0];
      const cutoffDate = call.where.timestamp.lt as Date;
      const now = new Date();
      const diffDays = Math.round((now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(364);
      expect(diffDays).toBeLessThanOrEqual(366);
    });

    it('should log the number of purged records', async () => {
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 10 });

      await service.applyRetentionPolicy(30);

      expect(logger.log).toHaveBeenCalledWith(
        'Retention policy applied: 10 audit logs purged',
        'AuditService'
      );
    });
  });

  describe('convenience methods', () => {
    it('logAuthSuccess should log AUTH_SUCCESS with low severity', async () => {
      await service.logAuthSuccess('user-123', '10.0.0.1', 'Chrome');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'AUTH_SUCCESS',
          resource: 'auth',
          userId: 'user-123',
          ipAddress: '10.0.0.1',
          userAgent: 'Chrome',
          severity: 'low',
        }),
      });
    });

    it('logAuthFailure should log AUTH_FAILURE with medium severity and email in metadata', async () => {
      await service.logAuthFailure('bad@example.com', '10.0.0.1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'AUTH_FAILURE',
          severity: 'medium',
        }),
      });
      const metadata = JSON.parse(prisma.auditLog.create.mock.calls[0][0].data.metadata as string);
      expect(metadata.attemptedEmail).toBe('bad@example.com');
    });

    it('logPasswordReset should log with high severity', async () => {
      await service.logPasswordReset('user-123');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PASSWORD_RESET',
          severity: 'high',
        }),
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('logSuspiciousActivity should log with critical severity', async () => {
      await service.logSuspiciousActivity('BRUTE_FORCE', 'user-123', '10.0.0.1', { attempts: 50 });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'BRUTE_FORCE',
          resource: 'security',
          severity: 'critical',
        }),
      });
    });

    it('logDataAccess should use high severity for DELETE operations', async () => {
      await service.logDataAccess('transactions', 'txn-1', 'user-123', 'DELETE');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'DATA_DELETE',
          severity: 'high',
        }),
      });
    });

    it('logDataAccess should use low severity for READ operations', async () => {
      await service.logDataAccess('transactions', 'txn-1', 'user-123', 'READ');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'DATA_READ',
          severity: 'low',
        }),
      });
    });

    it('logProviderConnection should log success with medium severity', async () => {
      await service.logProviderConnection('belvo', 'user-123', 'space-1', true, '10.0.0.1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PROVIDER_CONNECTED',
          severity: 'medium',
        }),
      });
    });

    it('logProviderConnection should log failure with high severity', async () => {
      await service.logProviderConnection('plaid', 'user-123', 'space-1', false);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PROVIDER_CONNECTION_FAILED',
          severity: 'high',
        }),
      });
    });
  });
});
