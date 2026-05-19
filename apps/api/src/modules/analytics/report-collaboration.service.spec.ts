import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '@core/audit/audit.service';
import { PrismaService } from '@core/prisma/prisma.service';

import { createAuditMock, createLoggerMock } from '../../../test/helpers/api-mock-factory';

import { ReportCollaborationService } from './report-collaboration.service';
import { SavedReportService } from './saved-report.service';

describe('ReportCollaborationService', () => {
  let service: ReportCollaborationService;
  let prisma: any;
  let savedReportService: jest.Mocked<Pick<SavedReportService, 'verifyAccess'>>;
  let auditService: ReturnType<typeof createAuditMock>;

  const mockShare = {
    id: 'share-1',
    reportId: 'report-1',
    sharedWith: 'user-2',
    role: 'editor',
    invitedBy: 'user-1',
    message: null,
    status: 'pending',
    acceptedAt: null,
    createdAt: new Date(),
    user: { id: 'user-2', name: 'User 2', email: 'user2@test.com' },
    inviter: { id: 'user-1', name: 'User 1', email: 'user1@test.com' },
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      reportShare: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      savedReport: {
        update: jest.fn(),
      },
    };

    savedReportService = {
      verifyAccess: jest.fn().mockResolvedValue(undefined),
    };

    auditService = createAuditMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportCollaborationService,
        { provide: PrismaService, useValue: prisma },
        { provide: SavedReportService, useValue: savedReportService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<ReportCollaborationService>(ReportCollaborationService);
    (service as any).logger = createLoggerMock();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('shareReport', () => {
    it('should share a report with another user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        name: 'User 2',
        email: 'user2@test.com',
      });
      prisma.reportShare.findUnique.mockResolvedValue(null); // no existing share
      prisma.reportShare.create.mockResolvedValue(mockShare);
      prisma.savedReport.update.mockResolvedValue({});

      const result = await service.shareReport('user-1', {
        reportId: 'report-1',
        shareWithEmail: 'user2@test.com',
        role: 'editor',
      });

      expect(savedReportService.verifyAccess).toHaveBeenCalledWith('user-1', 'report-1', [
        'manager',
        'editor',
      ]);
      expect(result).toEqual(mockShare);
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should throw when target user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.shareReport('user-1', {
          reportId: 'report-1',
          shareWithEmail: 'nonexistent@test.com',
          role: 'editor',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when report already shared with user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        name: 'User 2',
        email: 'user2@test.com',
      });
      prisma.reportShare.findUnique.mockResolvedValue(mockShare);

      await expect(
        service.shareReport('user-1', {
          reportId: 'report-1',
          shareWithEmail: 'user2@test.com',
          role: 'editor',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when access denied', async () => {
      savedReportService.verifyAccess.mockRejectedValue(new ForbiddenException('No access'));

      await expect(
        service.shareReport('user-3', {
          reportId: 'report-1',
          shareWithEmail: 'user2@test.com',
          role: 'editor',
        })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('acceptShare', () => {
    it('should accept a pending share invitation', async () => {
      prisma.reportShare.findUnique.mockResolvedValue({ ...mockShare, status: 'pending' });
      prisma.reportShare.update.mockResolvedValue({ ...mockShare, status: 'accepted' });

      const result = await service.acceptShare('user-2', 'share-1');

      expect(result.status).toBe('accepted');
      expect(prisma.reportShare.update).toHaveBeenCalledWith({
        where: { id: 'share-1' },
        data: expect.objectContaining({
          status: 'accepted',
          acceptedAt: expect.any(Date),
        }),
        include: expect.any(Object),
      });
    });

    it('should throw when share not found', async () => {
      prisma.reportShare.findUnique.mockResolvedValue(null);

      await expect(service.acceptShare('user-2', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw when invitation is not for this user', async () => {
      prisma.reportShare.findUnique.mockResolvedValue({ ...mockShare, sharedWith: 'other-user' });

      await expect(service.acceptShare('user-2', 'share-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw when status is not pending', async () => {
      prisma.reportShare.findUnique.mockResolvedValue({ ...mockShare, status: 'accepted' });

      await expect(service.acceptShare('user-2', 'share-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('declineShare', () => {
    it('should decline a pending share invitation', async () => {
      prisma.reportShare.findUnique.mockResolvedValue({ ...mockShare, status: 'pending' });
      prisma.reportShare.update.mockResolvedValue({});

      await service.declineShare('user-2', 'share-1');

      expect(prisma.reportShare.update).toHaveBeenCalledWith({
        where: { id: 'share-1' },
        data: { status: 'declined' },
      });
    });

    it('should throw when share not found', async () => {
      prisma.reportShare.findUnique.mockResolvedValue(null);

      await expect(service.declineShare('user-2', 'nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw when not the target user', async () => {
      prisma.reportShare.findUnique.mockResolvedValue({ ...mockShare, sharedWith: 'other-user' });

      await expect(service.declineShare('user-2', 'share-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw when status is not pending', async () => {
      prisma.reportShare.findUnique.mockResolvedValue({ ...mockShare, status: 'declined' });

      await expect(service.declineShare('user-2', 'share-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('revokeShare', () => {
    it('should revoke a share', async () => {
      prisma.reportShare.findUnique.mockResolvedValue(mockShare);
      prisma.reportShare.update.mockResolvedValue({});

      await service.revokeShare('user-1', 'share-1');

      expect(savedReportService.verifyAccess).toHaveBeenCalledWith('user-1', 'report-1', [
        'manager',
      ]);
      expect(prisma.reportShare.update).toHaveBeenCalledWith({
        where: { id: 'share-1' },
        data: { status: 'revoked' },
      });
    });

    it('should throw when share not found', async () => {
      prisma.reportShare.findUnique.mockResolvedValue(null);

      await expect(service.revokeShare('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw when non-manager tries to revoke', async () => {
      prisma.reportShare.findUnique.mockResolvedValue(mockShare);
      savedReportService.verifyAccess.mockRejectedValue(new ForbiddenException('Not manager'));

      await expect(service.revokeShare('user-3', 'share-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateShareRole', () => {
    it('should update share role', async () => {
      prisma.reportShare.findUnique.mockResolvedValue(mockShare);
      prisma.reportShare.update.mockResolvedValue({ ...mockShare, role: 'viewer' });

      const result = await service.updateShareRole('user-1', {
        shareId: 'share-1',
        newRole: 'viewer',
      });

      expect(result.role).toBe('viewer');
    });

    it('should throw when share not found', async () => {
      prisma.reportShare.findUnique.mockResolvedValue(null);

      await expect(
        service.updateShareRole('user-1', { shareId: 'nonexistent', newRole: 'viewer' })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when access denied', async () => {
      prisma.reportShare.findUnique.mockResolvedValue(mockShare);
      savedReportService.verifyAccess.mockRejectedValue(new ForbiddenException('No access'));

      await expect(
        service.updateShareRole('user-3', { shareId: 'share-1', newRole: 'viewer' })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getReportShares', () => {
    it('should return shares with user/inviter data', async () => {
      prisma.reportShare.findMany.mockResolvedValue([mockShare]);

      const result = await service.getReportShares('user-1', 'report-1');

      expect(result).toHaveLength(1);
      expect(result[0].user).toBeDefined();
      expect(result[0].inviter).toBeDefined();
    });
  });

  describe('getSharedWithMe', () => {
    it('should return accepted shares with mapped data', async () => {
      prisma.reportShare.findMany.mockResolvedValue([
        {
          ...mockShare,
          status: 'accepted',
          role: 'editor',
          report: {
            id: 'report-1',
            name: 'Report 1',
            space: { id: 'space-1' },
            generatedReports: [],
          },
          inviter: { id: 'user-1', name: 'User 1', email: 'user1@test.com' },
        },
      ]);

      const result = await service.getSharedWithMe('user-2');

      expect(result).toHaveLength(1);
      expect(result[0].shareRole).toBe('editor');
      expect(result[0].sharedBy).toEqual({ id: 'user-1', name: 'User 1', email: 'user1@test.com' });
    });
  });
});
