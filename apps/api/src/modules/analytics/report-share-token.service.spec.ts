import { NotFoundException, ForbiddenException, GoneException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '@core/audit/audit.service';
import { PrismaService } from '@core/prisma/prisma.service';

import { createAuditMock, createLoggerMock } from '../../../test/helpers/api-mock-factory';
import { R2StorageService } from '../storage/r2.service';

import { ReportShareTokenService } from './report-share-token.service';
import { SavedReportService } from './saved-report.service';

describe('ReportShareTokenService', () => {
  let service: ReportShareTokenService;
  let prisma: any;
  let savedReportService: jest.Mocked<Pick<SavedReportService, 'verifyAccess'>>;
  let r2Storage: jest.Mocked<Pick<R2StorageService, 'getPresignedDownloadUrl'>>;
  let auditService: ReturnType<typeof createAuditMock>;

  const mockShareToken = {
    id: 'token-1',
    reportId: 'report-1',
    generatedReportId: null,
    token: 'abc123def456',
    createdBy: 'user-1',
    maxAccess: null,
    accessCount: 0,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    createdAt: new Date(),
  };

  const mockGeneratedReport = {
    id: 'gen-1',
    savedReportId: 'report-1',
    format: 'pdf',
    fileSize: 1024,
    r2Key: 'spaces/space-1/reports/report-1/gen-1.pdf',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      reportShareToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      generatedReport: {
        findUnique: jest.fn(),
      },
    };

    savedReportService = {
      verifyAccess: jest.fn().mockResolvedValue(undefined),
    };

    r2Storage = {
      getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://download.url/report.pdf'),
    };

    auditService = createAuditMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportShareTokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: SavedReportService, useValue: savedReportService },
        { provide: R2StorageService, useValue: r2Storage },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<ReportShareTokenService>(ReportShareTokenService);
    (service as any).logger = createLoggerMock();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createToken', () => {
    it('should create token with default 168h expiry', async () => {
      prisma.reportShareToken.create.mockResolvedValue(mockShareToken);

      const result = await service.createToken('user-1', 'report-1');

      expect(savedReportService.verifyAccess).toHaveBeenCalledWith('user-1', 'report-1', [
        'editor',
        'manager',
      ]);
      expect(prisma.reportShareToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reportId: 'report-1',
          createdBy: 'user-1',
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
      expect(result.id).toBe('token-1');
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should create token with custom options', async () => {
      prisma.reportShareToken.create.mockResolvedValue({ ...mockShareToken, maxAccess: 10 });

      await service.createToken('user-1', 'report-1', {
        expiresInHours: 24,
        maxAccess: 10,
      });

      expect(prisma.reportShareToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          maxAccess: 10,
        }),
      });
    });

    it('should accept generatedReportId option', async () => {
      prisma.reportShareToken.create.mockResolvedValue({
        ...mockShareToken,
        generatedReportId: 'gen-1',
      });

      await service.createToken('user-1', 'report-1', {
        generatedReportId: 'gen-1',
      });

      expect(prisma.reportShareToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          generatedReportId: 'gen-1',
        }),
      });
    });
  });

  describe('validateAndGetReport', () => {
    it('should validate token and return report with download URL', async () => {
      prisma.reportShareToken.findUnique.mockResolvedValue({
        ...mockShareToken,
        report: {
          name: 'Monthly Report',
          generatedReports: [mockGeneratedReport],
        },
      });
      prisma.reportShareToken.update.mockResolvedValue({});
      prisma.generatedReport.findUnique.mockResolvedValue(mockGeneratedReport);

      const result = await service.validateAndGetReport('abc123def456');

      expect(result.reportName).toBe('Monthly Report');
      expect(result.downloadUrl).toBe('https://download.url/report.pdf');
      expect(result.format).toBe('pdf');
    });

    it('should throw NotFoundException for invalid token', async () => {
      prisma.reportShareToken.findUnique.mockResolvedValue(null);

      await expect(service.validateAndGetReport('invalid')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for revoked token', async () => {
      prisma.reportShareToken.findUnique.mockResolvedValue({
        ...mockShareToken,
        revokedAt: new Date(),
        report: { name: 'Test', generatedReports: [] },
      });

      await expect(service.validateAndGetReport('abc123def456')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw GoneException for expired token', async () => {
      prisma.reportShareToken.findUnique.mockResolvedValue({
        ...mockShareToken,
        expiresAt: new Date(Date.now() - 1000), // expired
        report: { name: 'Test', generatedReports: [] },
      });

      await expect(service.validateAndGetReport('abc123def456')).rejects.toThrow(GoneException);
    });

    it('should throw GoneException when max access reached', async () => {
      prisma.reportShareToken.findUnique.mockResolvedValue({
        ...mockShareToken,
        maxAccess: 5,
        accessCount: 5,
        report: { name: 'Test', generatedReports: [] },
      });

      await expect(service.validateAndGetReport('abc123def456')).rejects.toThrow(GoneException);
    });

    it('should throw NotFoundException when no generated report available', async () => {
      prisma.reportShareToken.findUnique.mockResolvedValue({
        ...mockShareToken,
        generatedReportId: null,
        report: { name: 'Test', generatedReports: [] },
      });
      prisma.reportShareToken.update.mockResolvedValue({});

      await expect(service.validateAndGetReport('abc123def456')).rejects.toThrow(NotFoundException);
    });

    it('should use latest generated report as fallback', async () => {
      prisma.reportShareToken.findUnique.mockResolvedValue({
        ...mockShareToken,
        generatedReportId: null,
        report: {
          name: 'Monthly Report',
          generatedReports: [mockGeneratedReport],
        },
      });
      prisma.reportShareToken.update.mockResolvedValue({});
      prisma.generatedReport.findUnique.mockResolvedValue(mockGeneratedReport);

      const result = await service.validateAndGetReport('abc123def456');

      expect(prisma.generatedReport.findUnique).toHaveBeenCalledWith({
        where: { id: 'gen-1' },
      });
      expect(result.reportName).toBe('Monthly Report');
    });

    it('should throw when generated report record not found in DB', async () => {
      prisma.reportShareToken.findUnique.mockResolvedValue({
        ...mockShareToken,
        generatedReportId: 'gen-deleted',
        report: { name: 'Test', generatedReports: [] },
      });
      prisma.reportShareToken.update.mockResolvedValue({});
      prisma.generatedReport.findUnique.mockResolvedValue(null);

      await expect(service.validateAndGetReport('abc123def456')).rejects.toThrow(NotFoundException);
    });
  });

  describe('revokeToken', () => {
    it('should revoke a token', async () => {
      prisma.reportShareToken.findUnique.mockResolvedValue(mockShareToken);
      prisma.reportShareToken.update.mockResolvedValue({});

      await service.revokeToken('user-1', 'token-1');

      expect(prisma.reportShareToken.update).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should throw NotFoundException when token not found', async () => {
      prisma.reportShareToken.findUnique.mockResolvedValue(null);

      await expect(service.revokeToken('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should verify access before revoking', async () => {
      prisma.reportShareToken.findUnique.mockResolvedValue(mockShareToken);
      savedReportService.verifyAccess.mockRejectedValue(new ForbiddenException('No access'));

      await expect(service.revokeToken('user-3', 'token-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listTokens', () => {
    it('should return non-revoked non-expired tokens', async () => {
      prisma.reportShareToken.findMany.mockResolvedValue([mockShareToken]);

      const result = await service.listTokens('user-1', 'report-1');

      expect(result).toHaveLength(1);
      expect(prisma.reportShareToken.findMany).toHaveBeenCalledWith({
        where: {
          reportId: 'report-1',
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { createdAt: 'desc' },
        include: expect.objectContaining({
          creator: expect.any(Object),
        }),
      });
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired tokens and return count', async () => {
      prisma.reportShareToken.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.cleanupExpired();

      expect(result).toBe(3);
      expect(prisma.reportShareToken.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });

    it('should return 0 when no expired tokens', async () => {
      prisma.reportShareToken.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.cleanupExpired();

      expect(result).toBe(0);
    });
  });
});
