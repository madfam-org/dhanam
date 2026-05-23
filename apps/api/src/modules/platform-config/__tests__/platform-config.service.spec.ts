import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PlatformConfigScope } from '../../../../generated/prisma';

import { AuditService } from '@core/audit/audit.service';
import { PrismaService } from '@core/prisma/prisma.service';

import { MADFAM_IMPORT_CONFIG_KEYS } from '../platform-config.keys';
import { PlatformConfigService } from '../platform-config.service';

describe('PlatformConfigService', () => {
  let service: PlatformConfigService;

  const prisma = {
    platformConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  };

  const auditService = {
    logEvent: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformConfigService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(PlatformConfigService);
  });

  it('lists platform config with optional prefix', async () => {
    prisma.platformConfig.findMany.mockResolvedValue([
      {
        key: MADFAM_IMPORT_CONFIG_KEYS.businessRfc,
        scope: PlatformConfigScope.platform,
        scopeId: '',
        value: 'XAXX010101000',
        updatedBy: 'admin-1',
        updatedAt: new Date('2026-01-01'),
      },
    ]);

    const rows = await service.listPlatform('madfam.import.');
    expect(rows).toHaveLength(1);
    expect(prisma.platformConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ key: { startsWith: 'madfam.import.' } }),
      })
    );
  });

  it('upserts config and writes audit log', async () => {
    const updatedAt = new Date();
    prisma.platformConfig.upsert.mockResolvedValue({
      key: MADFAM_IMPORT_CONFIG_KEYS.businessRfc,
      scope: PlatformConfigScope.platform,
      scopeId: '',
      value: 'XAXX010101000',
      updatedBy: 'admin-1',
      updatedAt,
    });

    const entry = await service.upsert(
      MADFAM_IMPORT_CONFIG_KEYS.businessRfc,
      'XAXX010101000',
      'admin-1'
    );

    expect(entry.key).toBe(MADFAM_IMPORT_CONFIG_KEYS.businessRfc);
    expect(auditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.upsert_platform_config',
        resource: 'PlatformConfig',
      })
    );
  });

  it('requireKey throws when missing', async () => {
    prisma.platformConfig.findUnique.mockResolvedValue(null);
    await expect(service.requireKey('missing.key')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateMadfamImportSettings upserts provided fields', async () => {
    prisma.platformConfig.upsert.mockImplementation(({ create }) =>
      Promise.resolve({
        ...create,
        updatedAt: new Date(),
      })
    );
    prisma.platformConfig.findMany.mockResolvedValue([
      {
        key: MADFAM_IMPORT_CONFIG_KEYS.businessRfc,
        scope: PlatformConfigScope.platform,
        scopeId: '',
        value: 'XAXX010101000',
        updatedBy: 'admin-1',
        updatedAt: new Date(),
      },
    ]);

    const settings = await service.updateMadfamImportSettings(
      { businessRfc: 'XAXX010101000' },
      'admin-1'
    );

    expect(settings.businessRfc).toBe('XAXX010101000');
    expect(prisma.platformConfig.upsert).toHaveBeenCalled();
  });
});
