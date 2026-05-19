import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import {
  createPrismaMock,
  createLoggerMock,
  createAuditMock,
} from '../../../test/helpers/api-mock-factory';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JanuaEmailService } from '../email/janua-email.service';

import { ExecutorAccessService } from './executor-access.service';

describe('ExecutorAccessService', () => {
  let service: ExecutorAccessService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let auditMock: ReturnType<typeof createAuditMock>;

  const testUserId = 'user-123';
  const testAssignmentId = 'assign-456';
  const testExecutorEmail = 'executor@example.com';

  const mockAssignment = {
    id: testAssignmentId,
    userId: testUserId,
    executorEmail: testExecutorEmail,
    executorName: 'John Executor',
    relationship: 'spouse',
    priority: 1,
    verified: true,
    verifiedAt: new Date(),
    accessGranted: false,
    accessGrantedAt: null,
    accessExpiresAt: null,
    accessToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: testUserId,
    name: 'Account Holder',
    email: 'holder@example.com',
    lastActivityAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
    lastLoginAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    lifeBeatAlertDays: [30, 60, 90],
    executorAssignments: [mockAssignment],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock = createPrismaMock();
    auditMock = createAuditMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutorAccessService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
        {
          provide: JanuaEmailService,
          useValue: {
            sendEmail: jest.fn().mockResolvedValue({ success: true }),
            sendTemplateEmail: jest.fn().mockResolvedValue({ success: true }),
            sendExecutorVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
            sendExecutorAccessRequestEmail: jest.fn().mockResolvedValue({ success: true }),
            sendExecutorAccessGrantedEmail: jest.fn().mockResolvedValue({ success: true }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                APP_URL: 'http://localhost:3000',
                WEB_URL: 'http://localhost:3000',
                EXECUTOR_ACCESS_DAYS: 7,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ExecutorAccessService>(ExecutorAccessService);
    (service as any).logger = createLoggerMock();
  });

  describe('addExecutor', () => {
    beforeEach(() => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue(null);
      prismaMock.executorAssignment.aggregate.mockResolvedValue({ _max: { priority: null } });
      prismaMock.executorAssignment.create.mockResolvedValue({
        ...mockAssignment,
        id: 'new-assignment',
      });
    });

    it('should add a new executor', async () => {
      const result = await service.addExecutor(testUserId, {
        email: testExecutorEmail,
        name: 'John Executor',
        relationship: 'spouse',
      });

      expect(result.id).toBe('new-assignment');
      expect(result.verificationSent).toBe(true);
      expect(prismaMock.executorAssignment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: testUserId,
          executorEmail: testExecutorEmail,
          executorName: 'John Executor',
          relationship: 'spouse',
          priority: 1,
        }),
      });
    });

    it('should throw ForbiddenException for duplicate executor', async () => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue(mockAssignment);

      await expect(
        service.addExecutor(testUserId, {
          email: testExecutorEmail,
          name: 'John Executor',
          relationship: 'spouse',
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should auto-increment priority', async () => {
      prismaMock.executorAssignment.aggregate.mockResolvedValue({ _max: { priority: 2 } });

      await service.addExecutor(testUserId, {
        email: 'second@example.com',
        name: 'Second Executor',
        relationship: 'sibling',
      });

      expect(prismaMock.executorAssignment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 3,
        }),
      });
    });

    it('should use provided priority if specified', async () => {
      await service.addExecutor(testUserId, {
        email: testExecutorEmail,
        name: 'John Executor',
        relationship: 'spouse',
        priority: 5,
      });

      expect(prismaMock.executorAssignment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 5,
        }),
      });
    });

    it('should log the action', async () => {
      await service.addExecutor(testUserId, {
        email: testExecutorEmail,
        name: 'John Executor',
        relationship: 'spouse',
      });

      expect(auditMock.log).toHaveBeenCalledWith({
        userId: testUserId,
        action: 'executor_added',
        resource: 'executor_assignment',
        resourceId: 'new-assignment',
        metadata: expect.objectContaining({
          executorEmail: testExecutorEmail,
        }),
      });
    });
  });

  describe('verifyExecutor', () => {
    beforeEach(() => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        verified: false,
        verifiedAt: null,
      });
      prismaMock.executorAssignment.update.mockResolvedValue({
        ...mockAssignment,
        verified: true,
        verifiedAt: new Date(),
      });
    });

    it('should verify an executor', async () => {
      const result = await service.verifyExecutor(testAssignmentId, testExecutorEmail);

      expect(result.verified).toBe(true);
      expect(prismaMock.executorAssignment.update).toHaveBeenCalledWith({
        where: { id: testAssignmentId },
        data: expect.objectContaining({
          verified: true,
        }),
      });
    });

    it('should throw NotFoundException for non-existent assignment', async () => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue(null);

      await expect(service.verifyExecutor('non-existent', testExecutorEmail)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException for email mismatch', async () => {
      await expect(service.verifyExecutor(testAssignmentId, 'wrong@example.com')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should return verified=true if already verified', async () => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue(mockAssignment);

      const result = await service.verifyExecutor(testAssignmentId, testExecutorEmail);

      expect(result.verified).toBe(true);
      expect(prismaMock.executorAssignment.update).not.toHaveBeenCalled();
    });
  });

  describe('removeExecutor', () => {
    beforeEach(() => {
      prismaMock.executorAssignment.findFirst.mockResolvedValue(mockAssignment);
      prismaMock.executorAssignment.delete.mockResolvedValue(mockAssignment);
    });

    it('should remove an executor', async () => {
      const result = await service.removeExecutor(testUserId, testAssignmentId);

      expect(result.removed).toBe(true);
      expect(prismaMock.executorAssignment.delete).toHaveBeenCalledWith({
        where: { id: testAssignmentId },
      });
    });

    it('should throw NotFoundException for non-existent assignment', async () => {
      prismaMock.executorAssignment.findFirst.mockResolvedValue(null);

      await expect(service.removeExecutor(testUserId, 'non-existent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should log the removal', async () => {
      await service.removeExecutor(testUserId, testAssignmentId);

      expect(auditMock.log).toHaveBeenCalledWith({
        userId: testUserId,
        action: 'executor_removed',
        resource: 'executor_assignment',
        resourceId: testAssignmentId,
        metadata: expect.objectContaining({
          executorEmail: testExecutorEmail,
        }),
      });
    });
  });

  describe('getExecutors', () => {
    it('should return all executors for a user', async () => {
      prismaMock.executorAssignment.findMany.mockResolvedValue([mockAssignment]);

      const result = await service.getExecutors(testUserId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: testAssignmentId,
        email: testExecutorEmail,
        name: 'John Executor',
        relationship: 'spouse',
        priority: 1,
        verified: true,
        verifiedAt: expect.any(Date),
        accessGranted: false,
        accessExpiresAt: null,
      });
    });

    it('should order by priority', async () => {
      prismaMock.executorAssignment.findMany.mockResolvedValue([mockAssignment]);

      await service.getExecutors(testUserId);

      expect(prismaMock.executorAssignment.findMany).toHaveBeenCalledWith({
        where: { userId: testUserId },
        orderBy: { priority: 'asc' },
      });
    });

    it('should return empty array when no executors', async () => {
      prismaMock.executorAssignment.findMany.mockResolvedValue([]);

      const result = await service.getExecutors(testUserId);

      expect(result).toEqual([]);
    });
  });

  describe('requestAccess', () => {
    beforeEach(() => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        accountHolder: mockUser,
      });
    });

    it('should submit access request successfully', async () => {
      const result = await service.requestAccess(testAssignmentId, testExecutorEmail);

      expect(result.requestSubmitted).toBe(true);
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'executor_access_requested',
        })
      );
    });

    it('should throw NotFoundException for non-existent assignment', async () => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue(null);

      await expect(service.requestAccess('non-existent', testExecutorEmail)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException for unauthorized email', async () => {
      await expect(service.requestAccess(testAssignmentId, 'wrong@example.com')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw ForbiddenException if not verified', async () => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        verified: false,
        accountHolder: mockUser,
      });

      await expect(service.requestAccess(testAssignmentId, testExecutorEmail)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw ForbiddenException if user recently active', async () => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        accountHolder: {
          ...mockUser,
          lastActivityAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        },
      });

      await expect(service.requestAccess(testAssignmentId, testExecutorEmail)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should require second confirmation when multiple verified executors', async () => {
      const secondExecutor = { ...mockAssignment, id: 'assign-2', verified: true };
      prismaMock.executorAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        accountHolder: {
          ...mockUser,
          executorAssignments: [mockAssignment, secondExecutor],
        },
      });

      const result = await service.requestAccess(testAssignmentId, testExecutorEmail);

      expect(result.requiresSecondConfirmation).toBe(true);
    });

    it('should not require second confirmation when only one verified executor', async () => {
      const result = await service.requestAccess(testAssignmentId, testExecutorEmail);

      expect(result.requiresSecondConfirmation).toBe(false);
    });
  });

  describe('grantAccess', () => {
    beforeEach(() => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        accountHolder: { id: testUserId, name: 'Account Holder' },
      });
      prismaMock.executorAssignment.update.mockResolvedValue({
        ...mockAssignment,
        accessGranted: true,
        accessToken: 'test-token',
      });
    });

    it('should grant access and return token', async () => {
      const result = await service.grantAccess(testAssignmentId);

      expect(result.accessToken).toBeDefined();
      expect(result.accessToken).toHaveLength(64); // 32 bytes hex
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.accountHolder.id).toBe(testUserId);
      expect(result.readOnlyAccess).toBe(true);
    });

    it('should throw NotFoundException for non-existent assignment', async () => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue(null);

      await expect(service.grantAccess('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should update assignment with access details', async () => {
      await service.grantAccess(testAssignmentId);

      expect(prismaMock.executorAssignment.update).toHaveBeenCalledWith({
        where: { id: testAssignmentId },
        data: expect.objectContaining({
          accessGranted: true,
          accessGrantedAt: expect.any(Date),
          accessExpiresAt: expect.any(Date),
          accessToken: expect.any(String),
        }),
      });
    });

    it('should set 7-day expiration', async () => {
      const result = await service.grantAccess(testAssignmentId);

      const now = new Date();
      const daysDiff = Math.round(
        (result.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBe(7);
    });

    it('should log access grant with granter info', async () => {
      await service.grantAccess(testAssignmentId, 'second-executor-id');

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'executor_access_granted',
          metadata: expect.objectContaining({
            grantedByExecutorId: 'second-executor-id',
          }),
        })
      );
    });
  });

  describe('validateAccessToken', () => {
    it('should return valid for active token', async () => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        accessGranted: true,
        accessToken: 'valid-token',
        accessExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      });

      const result = await service.validateAccessToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.assignment?.id).toBe(testAssignmentId);
      expect(result.assignment?.userId).toBe(testUserId);
    });

    it('should return invalid for non-existent token', async () => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue(null);

      const result = await service.validateAccessToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.assignment).toBeUndefined();
    });

    it('should return invalid for expired token', async () => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        accessGranted: true,
        accessToken: 'expired-token',
        accessExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      });

      const result = await service.validateAccessToken('expired-token');

      expect(result.valid).toBe(false);
    });

    it('should return invalid if access not granted', async () => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        accessGranted: false,
        accessToken: 'token',
        accessExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const result = await service.validateAccessToken('token');

      expect(result.valid).toBe(false);
    });

    it('should return invalid if no expiration date', async () => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        accessGranted: true,
        accessToken: 'token',
        accessExpiresAt: null,
      });

      const result = await service.validateAccessToken('token');

      expect(result.valid).toBe(false);
    });
  });

  describe('revokeAccess', () => {
    beforeEach(() => {
      prismaMock.executorAssignment.findFirst.mockResolvedValue({
        ...mockAssignment,
        accessGranted: true,
        accessToken: 'some-token',
      });
      prismaMock.executorAssignment.update.mockResolvedValue({
        ...mockAssignment,
        accessGranted: false,
        accessToken: null,
      });
    });

    it('should revoke access', async () => {
      const result = await service.revokeAccess(testUserId, testAssignmentId);

      expect(result.revoked).toBe(true);
      expect(prismaMock.executorAssignment.update).toHaveBeenCalledWith({
        where: { id: testAssignmentId },
        data: {
          accessGranted: false,
          accessToken: null,
          accessExpiresAt: null,
        },
      });
    });

    it('should throw NotFoundException for non-existent assignment', async () => {
      prismaMock.executorAssignment.findFirst.mockResolvedValue(null);

      await expect(service.revokeAccess(testUserId, 'non-existent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should log the revocation', async () => {
      await service.revokeAccess(testUserId, testAssignmentId);

      expect(auditMock.log).toHaveBeenCalledWith({
        userId: testUserId,
        action: 'executor_access_revoked',
        resource: 'executor_assignment',
        resourceId: testAssignmentId,
        metadata: expect.objectContaining({
          executorEmail: testExecutorEmail,
        }),
      });
    });
  });

  describe('logExecutorAction', () => {
    it('should log executor action', async () => {
      prismaMock.executorAccessLog.create.mockResolvedValue({});

      await service.logExecutorAction(
        testAssignmentId,
        'view_account',
        'account',
        'acc-123',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(prismaMock.executorAccessLog.create).toHaveBeenCalledWith({
        data: {
          executorAssignmentId: testAssignmentId,
          action: 'view_account',
          resourceType: 'account',
          resourceId: 'acc-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      });
    });

    it('should handle optional parameters', async () => {
      prismaMock.executorAccessLog.create.mockResolvedValue({});

      await service.logExecutorAction(testAssignmentId, 'view_dashboard');

      expect(prismaMock.executorAccessLog.create).toHaveBeenCalledWith({
        data: {
          executorAssignmentId: testAssignmentId,
          action: 'view_dashboard',
          resourceType: undefined,
          resourceId: undefined,
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });
  });

  describe('getAccessLog', () => {
    const mockLogs = [
      {
        executorAssignmentId: testAssignmentId,
        action: 'view_account',
        resourceType: 'account',
        createdAt: new Date(),
      },
      {
        executorAssignmentId: testAssignmentId,
        action: 'view_transaction',
        resourceType: 'transaction',
        createdAt: new Date(),
      },
    ];

    it('should return access logs for a specific assignment', async () => {
      prismaMock.executorAccessLog.findMany.mockResolvedValue(mockLogs);
      prismaMock.executorAssignment.findMany.mockResolvedValue([
        { id: testAssignmentId, executorEmail: testExecutorEmail },
      ]);

      const result = await service.getAccessLog(testUserId, testAssignmentId);

      expect(result).toHaveLength(2);
      expect(result[0].executorEmail).toBe(testExecutorEmail);
      expect(result[0].action).toBe('view_account');
    });

    it('should return all logs when no assignmentId specified', async () => {
      prismaMock.executorAssignment.findMany.mockResolvedValue([{ id: testAssignmentId }]);
      prismaMock.executorAccessLog.findMany.mockResolvedValue(mockLogs);

      await service.getAccessLog(testUserId);

      expect(prismaMock.executorAccessLog.findMany).toHaveBeenCalledWith({
        where: {
          executorAssignmentId: { in: [testAssignmentId] },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });

    it('should return unknown for missing executor emails', async () => {
      prismaMock.executorAccessLog.findMany.mockResolvedValue(mockLogs);
      prismaMock.executorAssignment.findMany.mockResolvedValue([]); // No assignments found

      const result = await service.getAccessLog(testUserId, testAssignmentId);

      expect(result[0].executorEmail).toBe('unknown');
    });

    it('should limit to 100 logs', async () => {
      prismaMock.executorAccessLog.findMany.mockResolvedValue([]);
      prismaMock.executorAssignment.findMany.mockResolvedValue([]);

      await service.getAccessLog(testUserId, testAssignmentId);

      expect(prismaMock.executorAccessLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });

    it('should order by createdAt descending', async () => {
      prismaMock.executorAccessLog.findMany.mockResolvedValue([]);
      prismaMock.executorAssignment.findMany.mockResolvedValue([]);

      await service.getAccessLog(testUserId, testAssignmentId);

      expect(prismaMock.executorAccessLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } })
      );
    });
  });

  describe('two-person activation rule', () => {
    it('should enforce two-person rule when multiple executors exist', async () => {
      const secondExecutor = {
        ...mockAssignment,
        id: 'assign-2',
        executorEmail: 'second@example.com',
        verified: true,
      };

      prismaMock.executorAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        accountHolder: {
          ...mockUser,
          executorAssignments: [mockAssignment, secondExecutor],
        },
      });

      const result = await service.requestAccess(testAssignmentId, testExecutorEmail);

      expect(result.requiresSecondConfirmation).toBe(true);
    });

    it('should not require second confirmation for single verified executor', async () => {
      const unverifiedExecutor = {
        ...mockAssignment,
        id: 'assign-2',
        verified: false,
      };

      prismaMock.executorAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        accountHolder: {
          ...mockUser,
          executorAssignments: [mockAssignment, unverifiedExecutor],
        },
      });

      const result = await service.requestAccess(testAssignmentId, testExecutorEmail);

      expect(result.requiresSecondConfirmation).toBe(false);
    });
  });

  describe('inactivity checks', () => {
    it('should allow access when user inactive beyond alert days', async () => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        accountHolder: {
          ...mockUser,
          lastActivityAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days
          lifeBeatAlertDays: [30, 60, 90],
        },
      });

      const result = await service.requestAccess(testAssignmentId, testExecutorEmail);

      expect(result.requestSubmitted).toBe(true);
    });

    it('should deny access when user recently active', async () => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        accountHolder: {
          ...mockUser,
          lastActivityAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
          lifeBeatAlertDays: [30, 60, 90],
        },
      });

      await expect(service.requestAccess(testAssignmentId, testExecutorEmail)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should use lastLoginAt when lastActivityAt is null', async () => {
      prismaMock.executorAssignment.findUnique.mockResolvedValue({
        ...mockAssignment,
        accountHolder: {
          ...mockUser,
          lastActivityAt: null,
          lastLoginAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days
          lifeBeatAlertDays: [30, 60, 90],
        },
      });

      const result = await service.requestAccess(testAssignmentId, testExecutorEmail);

      expect(result.requestSubmitted).toBe(true);
    });
  });
});
