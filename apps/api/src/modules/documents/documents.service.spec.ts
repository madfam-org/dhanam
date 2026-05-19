import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '@core/audit/audit.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { DocumentStatus } from '@db';

import { createAuditMock, createLoggerMock } from '../../../test/helpers/api-mock-factory';
import { BillingService } from '../billing/billing.service';
import { SpacesService } from '../spaces/spaces.service';
import { R2StorageService } from '../storage/r2.service';

import { CsvPreviewService } from './csv-preview.service';
import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: any;
  let spacesService: jest.Mocked<Pick<SpacesService, 'verifyUserAccess'>>;
  let r2Storage: any;
  let auditService: ReturnType<typeof createAuditMock>;
  let csvPreviewService: jest.Mocked<Pick<CsvPreviewService, 'generatePreview'>>;
  let billingService: any;

  const mockDocument = {
    id: 'doc-1',
    spaceId: 'space-1',
    uploadedBy: 'user-1',
    filename: 'test.pdf',
    contentType: 'application/pdf',
    fileSize: 1024,
    r2Key: 'spaces/space-1/documents/general/abc.pdf',
    category: 'general',
    status: 'pending_upload',
    csvPreview: null,
    csvMapping: null,
    manualAssetId: null,
    accountId: null,
    errorMessage: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      document: {
        aggregate: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    spacesService = {
      verifyUserAccess: jest.fn().mockResolvedValue(undefined),
    };

    r2Storage = {
      isAvailable: jest.fn().mockReturnValue(true),
      getPresignedUploadUrlGeneric: jest.fn().mockResolvedValue({
        uploadUrl: 'https://presigned.url/upload',
        key: 'spaces/space-1/documents/general/abc.pdf',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      }),
      getFileSize: jest.fn().mockResolvedValue(2048),
      getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://presigned.url/download'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      downloadFile: jest.fn(),
    };

    auditService = createAuditMock();

    csvPreviewService = {
      generatePreview: jest.fn().mockResolvedValue({
        headers: ['col1', 'col2'],
        rows: [['v1', 'v2']],
        totalRows: 1,
        delimiter: ',',
        previewRowCount: 1,
      }),
    };

    billingService = {
      getTierLimits: jest.fn((tier: string) => {
        const limits: Record<string, any> = {
          community: { storageBytes: Infinity },
          essentials: { storageBytes: 500 * 1024 * 1024 },
          pro: { storageBytes: 5 * 1024 * 1024 * 1024 },
          premium: { storageBytes: 25 * 1024 * 1024 * 1024 },
        };
        return limits[tier] || limits.community;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SpacesService, useValue: spacesService },
        { provide: R2StorageService, useValue: r2Storage },
        { provide: AuditService, useValue: auditService },
        { provide: CsvPreviewService, useValue: csvPreviewService },
        { provide: BillingService, useValue: billingService },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    (service as any).logger = createLoggerMock();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStorageUsage', () => {
    it('should return storage usage', async () => {
      prisma.document.aggregate.mockResolvedValue({
        _sum: { fileSize: 10_000_000 },
        _count: 5,
      });

      const result = await service.getStorageUsage('space-1');

      expect(result.used).toBe(10_000_000);
      expect(result.documentCount).toBe(5);
      expect(result.limit).toBe(500 * 1024 * 1024);
      expect(result.remaining).toBe(500 * 1024 * 1024 - 10_000_000);
    });

    it('should default to 0 when no documents exist', async () => {
      prisma.document.aggregate.mockResolvedValue({
        _sum: { fileSize: null },
        _count: 0,
      });

      const result = await service.getStorageUsage('space-1');

      expect(result.used).toBe(0);
      expect(result.documentCount).toBe(0);
    });
  });

  describe('requestUploadUrl', () => {
    it('should generate presigned URL and create document record', async () => {
      prisma.document.create.mockResolvedValue(mockDocument);

      const result = await service.requestUploadUrl('space-1', 'user-1', {
        filename: 'test.pdf',
        contentType: 'application/pdf',
      } as any);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith('user-1', 'space-1', 'member');
      expect(result.documentId).toBe('doc-1');
      expect(result.uploadUrl).toBe('https://presigned.url/upload');
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should bypass access check for admin', async () => {
      prisma.document.create.mockResolvedValue(mockDocument);

      await service.requestUploadUrl(
        'space-1',
        'admin-1',
        {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        } as any,
        true
      );

      expect(spacesService.verifyUserAccess).not.toHaveBeenCalled();
    });

    it('should check quota when estimatedSize provided', async () => {
      prisma.document.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });
      prisma.document.create.mockResolvedValue(mockDocument);

      await service.requestUploadUrl(
        'space-1',
        'user-1',
        {
          filename: 'test.pdf',
          contentType: 'application/pdf',
          estimatedSize: 1000,
        } as any,
        false,
        'essentials'
      );

      expect(prisma.document.aggregate).toHaveBeenCalled();
    });

    it('should throw when R2 not available', async () => {
      r2Storage.isAvailable.mockReturnValue(false);

      await expect(
        service.requestUploadUrl('space-1', 'user-1', {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when file exceeds max size for non-admin', async () => {
      prisma.document.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });

      await expect(
        service.requestUploadUrl('space-1', 'user-1', {
          filename: 'huge.pdf',
          contentType: 'application/pdf',
          estimatedSize: 60 * 1024 * 1024, // 60MB
        } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when space quota exceeded for essentials tier', async () => {
      prisma.document.aggregate.mockResolvedValue({
        _sum: { fileSize: 499 * 1024 * 1024 },
        _count: 100,
      });

      await expect(
        service.requestUploadUrl(
          'space-1',
          'user-1',
          {
            filename: 'test.pdf',
            contentType: 'application/pdf',
            estimatedSize: 10 * 1024 * 1024, // 10MB would exceed 500MB
          } as any,
          false,
          'essentials'
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow unlimited storage for community tier', async () => {
      prisma.document.aggregate.mockResolvedValue({
        _sum: { fileSize: 10 * 1024 * 1024 * 1024 }, // 10GB already used
        _count: 100,
      });
      prisma.document.create.mockResolvedValue(mockDocument);

      // Community tier has Infinity storage — quota check skipped entirely
      // (still subject to per-file 50MB limit)
      await expect(
        service.requestUploadUrl(
          'space-1',
          'user-1',
          {
            filename: 'test.pdf',
            contentType: 'application/pdf',
            estimatedSize: 10 * 1024 * 1024, // 10MB (under 50MB per-file limit)
          } as any,
          false,
          'community'
        )
      ).resolves.toBeDefined();

      // aggregate should NOT be called since community has Infinity storage
      expect(prisma.document.aggregate).not.toHaveBeenCalled();
    });
  });

  describe('confirmUpload', () => {
    it('should confirm non-CSV upload as uploaded status', async () => {
      prisma.document.findFirst.mockResolvedValue({ ...mockDocument, status: 'pending_upload' });
      prisma.document.update.mockResolvedValue({ ...mockDocument, status: 'uploaded' });
      prisma.document.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });

      const result = await service.confirmUpload('space-1', 'user-1', 'doc-1', {
        filename: 'test.pdf',
        contentType: 'application/pdf',
      } as any);

      expect(result.status).toBe('uploaded');
    });

    it('should generate CSV preview for small CSV files', async () => {
      prisma.document.findFirst.mockResolvedValue({
        ...mockDocument,
        contentType: 'text/csv',
        status: 'pending_upload',
      });
      r2Storage.getFileSize.mockResolvedValue(1000); // Small file
      prisma.document.update.mockResolvedValue({ ...mockDocument, status: 'ready' });
      prisma.document.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });

      await service.confirmUpload('space-1', 'user-1', 'doc-1', {
        filename: 'data.csv',
        contentType: 'text/csv',
      } as any);

      expect(csvPreviewService.generatePreview).toHaveBeenCalled();
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DocumentStatus.ready }),
        })
      );
    });

    it('should mark large CSV as processing', async () => {
      prisma.document.findFirst.mockResolvedValue({
        ...mockDocument,
        contentType: 'text/csv',
        status: 'pending_upload',
      });
      r2Storage.getFileSize.mockResolvedValue(10 * 1024 * 1024); // 10MB
      prisma.document.update.mockResolvedValue({ ...mockDocument, status: 'processing' });
      prisma.document.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });

      await service.confirmUpload('space-1', 'user-1', 'doc-1', {
        filename: 'big.csv',
        contentType: 'text/csv',
      } as any);

      expect(csvPreviewService.generatePreview).not.toHaveBeenCalled();
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DocumentStatus.processing }),
        })
      );
    });

    it('should mark as failed when CSV preview fails', async () => {
      prisma.document.findFirst.mockResolvedValue({
        ...mockDocument,
        contentType: 'text/csv',
        status: 'pending_upload',
      });
      r2Storage.getFileSize.mockResolvedValue(1000);
      csvPreviewService.generatePreview.mockRejectedValue(new Error('Parse error'));
      prisma.document.update.mockResolvedValue({ ...mockDocument, status: 'failed' });
      prisma.document.aggregate.mockResolvedValue({ _sum: { fileSize: 0 }, _count: 0 });

      await service.confirmUpload('space-1', 'user-1', 'doc-1', {
        filename: 'bad.csv',
        contentType: 'text/csv',
      } as any);

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DocumentStatus.failed }),
        })
      );
    });

    it('should throw when document already confirmed', async () => {
      prisma.document.findFirst.mockResolvedValue({ ...mockDocument, status: 'uploaded' });

      await expect(
        service.confirmUpload('space-1', 'user-1', 'doc-1', {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when file not in R2', async () => {
      prisma.document.findFirst.mockResolvedValue({ ...mockDocument, status: 'pending_upload' });
      r2Storage.getFileSize.mockResolvedValue(null);

      await expect(
        service.confirmUpload('space-1', 'user-1', 'doc-1', {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when document not found', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.confirmUpload('space-1', 'user-1', 'doc-1', {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        } as any)
      ).rejects.toThrow(NotFoundException);
    });

    it('should skip access check when isAdmin is true', async () => {
      prisma.document.findFirst.mockResolvedValue({ ...mockDocument, status: 'pending_upload' });
      r2Storage.getFileSize.mockResolvedValue(1024);
      prisma.document.update.mockResolvedValue({ ...mockDocument, status: 'uploaded' });

      await service.confirmUpload(
        'space-1',
        'admin-1',
        'doc-1',
        {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        } as any,
        true
      );

      expect(spacesService.verifyUserAccess).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated documents', async () => {
      prisma.document.findMany.mockResolvedValue([mockDocument]);
      prisma.document.count.mockResolvedValue(1);

      const result = await service.findAll('space-1', 'user-1', {} as any);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should apply filters', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await service.findAll('space-1', 'user-1', {
        category: 'general',
        status: 'ready',
        page: 2,
        limit: 10,
      } as any);

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            spaceId: 'space-1',
            category: 'general',
            status: 'ready',
          }),
          skip: 10,
          take: 10,
        })
      );
    });

    it('should apply contentType filter', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await service.findAll('space-1', 'user-1', {
        contentType: 'text/csv',
      } as any);

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contentType: 'text/csv',
          }),
        })
      );
    });
  });

  describe('findAllAdmin', () => {
    it('should return all documents without space filter', async () => {
      prisma.document.findMany.mockResolvedValue([mockDocument]);
      prisma.document.count.mockResolvedValue(1);

      const result = await service.findAllAdmin({} as any);

      expect(result.data).toHaveLength(1);
      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        })
      );
    });

    it('should apply category, status, and contentType filters', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await service.findAllAdmin({
        category: 'bank_statement',
        status: 'ready',
        contentType: 'application/pdf',
        page: 1,
        limit: 5,
      } as any);

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'bank_statement',
            status: 'ready',
            contentType: 'application/pdf',
          }),
          take: 5,
        })
      );
    });
  });

  describe('findOne', () => {
    it('should return document when found', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument);

      const result = await service.findOne('space-1', 'user-1', 'doc-1');

      expect(result).toEqual(mockDocument);
    });

    it('should throw when not found', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(service.findOne('space-1', 'user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findOneAdmin', () => {
    it('should return document when found', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument);

      const result = await service.findOneAdmin('doc-1');

      expect(result).toEqual(mockDocument);
    });

    it('should throw when not found', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(service.findOneAdmin('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDownloadUrl', () => {
    it('should return presigned download URL', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument);

      const result = await service.getDownloadUrl('space-1', 'user-1', 'doc-1');

      expect(result.downloadUrl).toBe('https://presigned.url/download');
      expect(result.filename).toBe('test.pdf');
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should throw when document not found', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(service.getDownloadUrl('space-1', 'user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('deleteDocument', () => {
    it('should soft-delete document and delete from R2', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument);
      prisma.document.update.mockResolvedValue(mockDocument);

      await service.deleteDocument('space-1', 'user-1', 'doc-1');

      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(r2Storage.deleteFile).toHaveBeenCalledWith(mockDocument.r2Key);
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should handle R2 delete failure gracefully', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument);
      prisma.document.update.mockResolvedValue(mockDocument);
      r2Storage.deleteFile.mockRejectedValue(new Error('R2 error'));

      // Should not throw
      await expect(service.deleteDocument('space-1', 'user-1', 'doc-1')).resolves.toBeUndefined();
    });

    it('should throw when document not found', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(service.deleteDocument('space-1', 'user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('deleteDocumentAdmin', () => {
    it('should hard-delete document', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument);
      prisma.document.delete.mockResolvedValue(mockDocument);

      await service.deleteDocumentAdmin('doc-1', 'admin-1');

      expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
      expect(r2Storage.deleteFile).toHaveBeenCalled();
    });

    it('should throw when not found', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(service.deleteDocumentAdmin('nonexistent', 'admin-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should handle R2 failure gracefully on admin delete', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument);
      prisma.document.delete.mockResolvedValue(mockDocument);
      r2Storage.deleteFile.mockRejectedValue(new Error('R2 error'));

      await expect(service.deleteDocumentAdmin('doc-1', 'admin-1')).resolves.toBeUndefined();
    });
  });

  describe('updateCsvMapping', () => {
    it('should update CSV mapping', async () => {
      prisma.document.findFirst.mockResolvedValue({ ...mockDocument, contentType: 'text/csv' });
      prisma.document.update.mockResolvedValue({
        ...mockDocument,
        csvMapping: { dateCol: 'Date' },
      });

      const result = await service.updateCsvMapping('space-1', 'user-1', 'doc-1', {
        dateCol: 'Date',
      } as any);

      expect(result.csvMapping).toEqual({ dateCol: 'Date' });
    });

    it('should throw when document not found', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCsvMapping('space-1', 'user-1', 'nonexistent', {} as any)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when document is not CSV', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument); // PDF

      await expect(
        service.updateCsvMapping('space-1', 'user-1', 'doc-1', {} as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('tier-aware storage', () => {
    it('should return unlimited storage info for community tier', async () => {
      prisma.document.aggregate.mockResolvedValue({
        _sum: { fileSize: 1_000_000 },
        _count: 3,
      });

      const result = await service.getStorageUsage('space-1', Infinity);

      expect(result.used).toBe(1_000_000);
      expect(result.limit).toBe(-1); // -1 indicates unlimited
      expect(result.remaining).toBe(Infinity);
    });

    it('should return essentials tier storage limit', async () => {
      prisma.document.aggregate.mockResolvedValue({
        _sum: { fileSize: 100_000_000 },
        _count: 10,
      });

      const essentialsLimit = 500 * 1024 * 1024;
      const result = await service.getStorageUsage('space-1', essentialsLimit);

      expect(result.used).toBe(100_000_000);
      expect(result.limit).toBe(essentialsLimit);
      expect(result.remaining).toBe(essentialsLimit - 100_000_000);
    });

    it('should enforce pro tier storage limit (5GB)', async () => {
      prisma.document.aggregate.mockResolvedValue({
        _sum: { fileSize: 5 * 1024 * 1024 * 1024 - 1024 }, // just under 5GB
        _count: 50,
      });
      prisma.document.findFirst.mockResolvedValue({ ...mockDocument, status: 'pending_upload' });
      r2Storage.getFileSize.mockResolvedValue(10 * 1024 * 1024); // 10MB

      await expect(
        service.confirmUpload(
          'space-1',
          'user-1',
          'doc-1',
          {
            filename: 'test.pdf',
            contentType: 'application/pdf',
          } as any,
          false,
          'pro'
        )
      ).rejects.toThrow(BadRequestException);
    });
  });
});
