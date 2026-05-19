import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '@core/audit/audit.service';
import { PrismaService } from '@core/prisma/prisma.service';

import { createAuditMock, createLoggerMock } from '../../../test/helpers/api-mock-factory';
import { SpacesService } from '../spaces/spaces.service';

import { SavedReportService } from './saved-report.service';

describe('SavedReportService', () => {
  let service: SavedReportService;
  let prisma: any;
  let spacesService: jest.Mocked<Pick<SpacesService, 'verifyUserAccess'>>;
  let auditService: ReturnType<typeof createAuditMock>;

  const mockReport = {
    id: 'report-1',
    spaceId: 'space-1',
    createdBy: 'user-1',
    name: 'Monthly Report',
    description: 'Monthly financial report',
    type: 'financial',
    schedule: 'monthly',
    format: 'pdf',
    filters: { startDate: '2026-01-01' },
    enabled: true,
    isShared: false,
    lastRunAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      savedReport: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      reportShare: {
        findFirst: jest.fn(),
      },
    };

    spacesService = {
      verifyUserAccess: jest.fn().mockResolvedValue(undefined),
    };

    auditService = createAuditMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedReportService,
        { provide: PrismaService, useValue: prisma },
        { provide: SpacesService, useValue: spacesService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<SavedReportService>(SavedReportService);
    (service as any).logger = createLoggerMock();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a saved report with defaults', async () => {
      prisma.savedReport.create.mockResolvedValue(mockReport);

      const result = await service.create('user-1', {
        spaceId: 'space-1',
        name: 'Monthly Report',
        type: 'financial',
      } as any);

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith('user-1', 'space-1', 'member');
      expect(prisma.savedReport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          spaceId: 'space-1',
          createdBy: 'user-1',
          name: 'Monthly Report',
          format: 'pdf',
          enabled: true,
        }),
      });
      expect(auditService.logEvent).toHaveBeenCalled();
      expect(result).toEqual(mockReport);
    });

    it('should use provided format and enabled values', async () => {
      prisma.savedReport.create.mockResolvedValue({ ...mockReport, format: 'csv', enabled: false });

      await service.create('user-1', {
        spaceId: 'space-1',
        name: 'CSV Report',
        type: 'financial',
        format: 'csv',
        enabled: false,
      } as any);

      expect(prisma.savedReport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          format: 'csv',
          enabled: false,
        }),
      });
    });

    it('should throw when access denied', async () => {
      spacesService.verifyUserAccess.mockRejectedValue(new ForbiddenException('Access denied'));

      await expect(
        service.create('user-1', { spaceId: 'space-1', name: 'Test', type: 'financial' } as any)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('should return paginated reports', async () => {
      prisma.savedReport.findMany.mockResolvedValue([mockReport]);

      const result = await service.findAll('user-1', 'space-1');

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith('user-1', 'space-1', 'viewer');
      expect(prisma.savedReport.findMany).toHaveBeenCalledWith({
        where: { spaceId: 'space-1' },
        include: expect.objectContaining({
          creator: expect.any(Object),
          generatedReports: expect.any(Object),
          _count: expect.any(Object),
        }),
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual([mockReport]);
    });

    it('should verify viewer access', async () => {
      prisma.savedReport.findMany.mockResolvedValue([]);

      await service.findAll('user-1', 'space-1');

      expect(spacesService.verifyUserAccess).toHaveBeenCalledWith('user-1', 'space-1', 'viewer');
    });
  });

  describe('findOne', () => {
    it('should return a report when found and user has access', async () => {
      const reportWithIncludes = {
        ...mockReport,
        creator: { id: 'user-1', name: 'User', email: 'u@e.com' },
        generatedReports: [],
        _count: { shares: 0, generatedReports: 0 },
        space: { userSpaces: [{ userId: 'user-1' }] },
      };
      prisma.savedReport.findUnique
        .mockResolvedValueOnce(reportWithIncludes) // findOne call
        .mockResolvedValueOnce({
          ...reportWithIncludes,
          space: { userSpaces: [{ userId: 'user-1' }] },
        }); // verifyAccess call

      const result = await service.findOne('user-1', 'report-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('report-1');
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.savedReport.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when no access', async () => {
      const reportWithIncludes = {
        ...mockReport,
        creator: { id: 'user-2', name: 'Other', email: 'o@e.com' },
        generatedReports: [],
        _count: { shares: 0, generatedReports: 0 },
      };
      prisma.savedReport.findUnique
        .mockResolvedValueOnce(reportWithIncludes) // findOne call
        .mockResolvedValueOnce({ ...mockReport, space: { userSpaces: [] } }); // verifyAccess - no space membership

      prisma.reportShare.findFirst.mockResolvedValue(null); // no share either

      await expect(service.findOne('user-3', 'report-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update a report partially', async () => {
      prisma.savedReport.findUnique.mockResolvedValue({
        ...mockReport,
        space: { userSpaces: [{ userId: 'user-1' }] },
      });
      prisma.savedReport.update.mockResolvedValue({ ...mockReport, name: 'Updated Name' });

      const result = await service.update('user-1', 'report-1', { name: 'Updated Name' } as any);

      expect(result.name).toBe('Updated Name');
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should update multiple fields including description, schedule, and filters', async () => {
      prisma.savedReport.findUnique.mockResolvedValue({
        ...mockReport,
        space: { userSpaces: [{ userId: 'user-1' }] },
      });
      prisma.savedReport.update.mockResolvedValue({
        ...mockReport,
        name: 'New',
        description: 'Updated desc',
        format: 'csv',
        schedule: 'weekly',
        filters: { startDate: '2026-02-01' },
        enabled: false,
      });

      await service.update('user-1', 'report-1', {
        name: 'New',
        description: 'Updated desc',
        format: 'csv',
        schedule: 'weekly',
        filters: { startDate: '2026-02-01' },
        enabled: false,
      } as any);

      expect(prisma.savedReport.update).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          name: 'New',
          description: 'Updated desc',
          format: 'csv',
          schedule: 'weekly',
          filters: { startDate: '2026-02-01' },
          enabled: false,
        }),
      });
    });

    it('should throw when access denied', async () => {
      prisma.savedReport.findUnique.mockResolvedValue({
        ...mockReport,
        space: { userSpaces: [] },
      });
      prisma.reportShare.findFirst.mockResolvedValue(null);

      await expect(service.update('user-3', 'report-1', { name: 'Nope' } as any)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('delete', () => {
    it('should delete a report', async () => {
      prisma.savedReport.findUnique
        .mockResolvedValueOnce({ ...mockReport, space: { userSpaces: [{ userId: 'user-1' }] } }) // verifyAccess
        .mockResolvedValueOnce(mockReport); // findUnique in delete
      prisma.savedReport.delete.mockResolvedValue(mockReport);

      await service.delete('user-1', 'report-1');

      expect(prisma.savedReport.delete).toHaveBeenCalledWith({ where: { id: 'report-1' } });
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should throw NotFoundException when report not found for deletion', async () => {
      prisma.savedReport.findUnique
        .mockResolvedValueOnce({ ...mockReport, space: { userSpaces: [{ userId: 'user-1' }] } }) // verifyAccess
        .mockResolvedValueOnce(null); // findUnique in delete

      await expect(service.delete('user-1', 'report-1')).rejects.toThrow(NotFoundException);
    });

    it('should require manager role', async () => {
      prisma.savedReport.findUnique.mockResolvedValue({
        ...mockReport,
        space: { userSpaces: [] },
      });
      prisma.reportShare.findFirst.mockResolvedValue({ role: 'viewer' });

      await expect(service.delete('user-1', 'report-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('verifyAccess', () => {
    it('should allow access for space member', async () => {
      prisma.savedReport.findUnique.mockResolvedValue({
        ...mockReport,
        space: { userSpaces: [{ userId: 'user-1' }] },
      });

      await expect(service.verifyAccess('user-1', 'report-1', ['viewer'])).resolves.toBeUndefined();
    });

    it('should allow access for shared user with accepted status', async () => {
      prisma.savedReport.findUnique.mockResolvedValue({
        ...mockReport,
        space: { userSpaces: [] },
      });
      prisma.reportShare.findFirst.mockResolvedValue({ role: 'editor' });

      await expect(
        service.verifyAccess('user-2', 'report-1', ['editor', 'manager'])
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundException for non-existent report', async () => {
      prisma.savedReport.findUnique.mockResolvedValue(null);

      await expect(service.verifyAccess('user-1', 'nonexistent', ['viewer'])).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException when no space membership and no share', async () => {
      prisma.savedReport.findUnique.mockResolvedValue({
        ...mockReport,
        space: { userSpaces: [] },
      });
      prisma.reportShare.findFirst.mockResolvedValue(null);

      await expect(service.verifyAccess('user-3', 'report-1', ['viewer'])).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw ForbiddenException when share role insufficient', async () => {
      prisma.savedReport.findUnique.mockResolvedValue({
        ...mockReport,
        space: { userSpaces: [] },
      });
      prisma.reportShare.findFirst.mockResolvedValue({ role: 'viewer' });

      await expect(service.verifyAccess('user-2', 'report-1', ['manager'])).rejects.toThrow(
        ForbiddenException
      );
    });
  });
});
