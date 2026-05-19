import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '@core/audit/audit.service';
import { PrismaService } from '@core/prisma/prisma.service';

import { createAuditMock, createLoggerMock } from '../../../test/helpers/api-mock-factory';
import { R2StorageService } from '../storage/r2.service';

import { ReportArchiveService } from './report-archive.service';
import { ReportService } from './report.service';
import { SavedReportService } from './saved-report.service';

describe('ReportArchiveService', () => {
  let service: ReportArchiveService;
  let prisma: any;
  let reportService: jest.Mocked<
    Pick<
      ReportService,
      'generatePdfReport' | 'generateCsvExport' | 'generateExcelExport' | 'generateJsonExport'
    >
  >;
  let savedReportService: jest.Mocked<Pick<SavedReportService, 'verifyAccess'>>;
  let r2Storage: any;
  let auditService: ReturnType<typeof createAuditMock>;

  const mockSavedReport = {
    id: 'saved-1',
    spaceId: 'space-1',
    name: 'Monthly Report',
    format: 'pdf',
    filters: { startDate: '2026-01-01', endDate: '2026-01-31' },
    createdBy: 'user-1',
  };

  const mockGeneratedReport = {
    id: 'gen-1',
    savedReportId: 'saved-1',
    spaceId: 'space-1',
    generatedBy: 'user-1',
    format: 'pdf',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31'),
    r2Key: 'spaces/space-1/reports/saved-1/123.pdf',
    fileSize: 2048,
    downloadCount: 0,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      savedReport: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      generatedReport: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    reportService = {
      generatePdfReport: jest.fn().mockResolvedValue(Buffer.from('pdf-content')),
      generateCsvExport: jest.fn().mockResolvedValue('col1,col2\nv1,v2'),
      generateExcelExport: jest.fn().mockResolvedValue(Buffer.from('excel-content')),
      generateJsonExport: jest.fn().mockResolvedValue('{"data":[]}'),
    };

    savedReportService = {
      verifyAccess: jest.fn().mockResolvedValue(undefined),
    };

    r2Storage = {
      uploadFile: jest.fn().mockResolvedValue({ key: 'uploaded-key' }),
      getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://download.url/report'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    auditService = createAuditMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportArchiveService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReportService, useValue: reportService },
        { provide: SavedReportService, useValue: savedReportService },
        { provide: R2StorageService, useValue: r2Storage },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<ReportArchiveService>(ReportArchiveService);
    (service as any).logger = createLoggerMock();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAndArchive', () => {
    it('should generate PDF report and archive', async () => {
      prisma.savedReport.findUnique.mockResolvedValue(mockSavedReport);
      prisma.generatedReport.create.mockResolvedValue(mockGeneratedReport);
      prisma.savedReport.update.mockResolvedValue({});

      const result = await service.generateAndArchive('saved-1', 'user-1');

      expect(reportService.generatePdfReport).toHaveBeenCalled();
      expect(r2Storage.uploadFile).toHaveBeenCalled();
      expect(prisma.generatedReport.create).toHaveBeenCalled();
      expect(result.generatedReport).toEqual(mockGeneratedReport);
      expect(result.downloadUrl).toBe('https://download.url/report');
    });

    it('should generate CSV export', async () => {
      prisma.savedReport.findUnique.mockResolvedValue({ ...mockSavedReport, format: 'csv' });
      prisma.generatedReport.create.mockResolvedValue({ ...mockGeneratedReport, format: 'csv' });
      prisma.savedReport.update.mockResolvedValue({});

      await service.generateAndArchive('saved-1', 'user-1');

      expect(reportService.generateCsvExport).toHaveBeenCalled();
    });

    it('should generate Excel export', async () => {
      prisma.savedReport.findUnique.mockResolvedValue({ ...mockSavedReport, format: 'excel' });
      prisma.generatedReport.create.mockResolvedValue({ ...mockGeneratedReport, format: 'excel' });
      prisma.savedReport.update.mockResolvedValue({});

      await service.generateAndArchive('saved-1', 'user-1');

      expect(reportService.generateExcelExport).toHaveBeenCalled();
    });

    it('should generate JSON export', async () => {
      prisma.savedReport.findUnique.mockResolvedValue({ ...mockSavedReport, format: 'json' });
      prisma.generatedReport.create.mockResolvedValue({ ...mockGeneratedReport, format: 'json' });
      prisma.savedReport.update.mockResolvedValue({});

      await service.generateAndArchive('saved-1', 'user-1');

      expect(reportService.generateJsonExport).toHaveBeenCalled();
    });

    it('should use default date range when filters is null', async () => {
      prisma.savedReport.findUnique.mockResolvedValue({ ...mockSavedReport, filters: null });
      prisma.generatedReport.create.mockResolvedValue(mockGeneratedReport);
      prisma.savedReport.update.mockResolvedValue({});

      await service.generateAndArchive('saved-1', 'user-1');

      expect(reportService.generatePdfReport).toHaveBeenCalledWith(
        'space-1',
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should use default date range when filters is empty object', async () => {
      prisma.savedReport.findUnique.mockResolvedValue({ ...mockSavedReport, filters: {} });
      prisma.generatedReport.create.mockResolvedValue(mockGeneratedReport);
      prisma.savedReport.update.mockResolvedValue({});

      await service.generateAndArchive('saved-1', 'user-1');

      expect(reportService.generatePdfReport).toHaveBeenCalledWith(
        'space-1',
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should throw NotFoundException when saved report not found', async () => {
      prisma.savedReport.findUnique.mockResolvedValue(null);

      await expect(service.generateAndArchive('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should verify access before generating', async () => {
      prisma.savedReport.findUnique.mockResolvedValue(mockSavedReport);
      savedReportService.verifyAccess.mockRejectedValue(new Error('Access denied'));

      await expect(service.generateAndArchive('saved-1', 'user-3')).rejects.toThrow();
    });

    it('should fall back to PDF for unknown format', async () => {
      prisma.savedReport.findUnique.mockResolvedValue({ ...mockSavedReport, format: 'unknown' });
      prisma.generatedReport.create.mockResolvedValue(mockGeneratedReport);
      prisma.savedReport.update.mockResolvedValue({});

      await service.generateAndArchive('saved-1', 'user-1');

      expect(reportService.generatePdfReport).toHaveBeenCalled();
    });

    it('should update lastRunAt on saved report', async () => {
      prisma.savedReport.findUnique.mockResolvedValue(mockSavedReport);
      prisma.generatedReport.create.mockResolvedValue(mockGeneratedReport);
      prisma.savedReport.update.mockResolvedValue({});

      await service.generateAndArchive('saved-1', 'user-1');

      expect(prisma.savedReport.update).toHaveBeenCalledWith({
        where: { id: 'saved-1' },
        data: { lastRunAt: expect.any(Date) },
      });
    });
  });

  describe('getHistory', () => {
    it('should return ordered generated reports', async () => {
      prisma.generatedReport.findMany.mockResolvedValue([mockGeneratedReport]);

      const result = await service.getHistory('saved-1');

      expect(result).toHaveLength(1);
      expect(prisma.generatedReport.findMany).toHaveBeenCalledWith({
        where: { savedReportId: 'saved-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: expect.objectContaining({ generator: expect.any(Object) }),
      });
    });

    it('should respect limit param', async () => {
      prisma.generatedReport.findMany.mockResolvedValue([]);

      await service.getHistory('saved-1', 5);

      expect(prisma.generatedReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });

  describe('getDownloadUrl', () => {
    it('should return presigned URL and increment download count', async () => {
      prisma.generatedReport.findUnique.mockResolvedValue({
        ...mockGeneratedReport,
        savedReport: mockSavedReport,
      });
      prisma.generatedReport.update.mockResolvedValue({});

      const result = await service.getDownloadUrl('gen-1', 'user-1');

      expect(result.downloadUrl).toBe('https://download.url/report');
      expect(prisma.generatedReport.update).toHaveBeenCalledWith({
        where: { id: 'gen-1' },
        data: { downloadCount: { increment: 1 } },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.generatedReport.findUnique.mockResolvedValue(null);

      await expect(service.getDownloadUrl('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should verify access', async () => {
      prisma.generatedReport.findUnique.mockResolvedValue({
        ...mockGeneratedReport,
        savedReport: mockSavedReport,
      });
      prisma.generatedReport.update.mockResolvedValue({});

      await service.getDownloadUrl('gen-1', 'user-1');

      expect(savedReportService.verifyAccess).toHaveBeenCalledWith('user-1', 'saved-1', [
        'viewer',
        'editor',
        'manager',
      ]);
    });
  });

  describe('deleteGenerated', () => {
    it('should delete from R2 and DB', async () => {
      prisma.generatedReport.findUnique.mockResolvedValue(mockGeneratedReport);
      prisma.generatedReport.delete.mockResolvedValue({});

      await service.deleteGenerated('gen-1', 'user-1');

      expect(r2Storage.deleteFile).toHaveBeenCalledWith(mockGeneratedReport.r2Key);
      expect(prisma.generatedReport.delete).toHaveBeenCalledWith({ where: { id: 'gen-1' } });
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.generatedReport.findUnique.mockResolvedValue(null);

      await expect(service.deleteGenerated('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should verify manager access', async () => {
      prisma.generatedReport.findUnique.mockResolvedValue(mockGeneratedReport);
      prisma.generatedReport.delete.mockResolvedValue({});

      await service.deleteGenerated('gen-1', 'user-1');

      expect(savedReportService.verifyAccess).toHaveBeenCalledWith('user-1', 'saved-1', [
        'manager',
      ]);
    });
  });
});
