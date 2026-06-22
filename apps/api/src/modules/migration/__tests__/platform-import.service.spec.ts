import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditService } from '@core/audit/audit.service';
import { CryptoService } from '@core/crypto/crypto.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { PlatformImportSource, PlatformImportStatus } from '@db';
import { PostHogService } from '@modules/analytics/posthog.service';
import { QueueService } from '@modules/jobs/queue.service';
import { SpacesService } from '@modules/spaces/spaces.service';

import { LunchMoneyImportRunner } from '../lunchmoney/lunchmoney-import.runner';
import { PlatformImportService } from '../platform-import.service';

jest.mock('../lunchmoney/lunchmoney-import.runner');

describe('PlatformImportService', () => {
  let service: PlatformImportService;
  let prisma: jest.Mocked<PrismaService>;
  let spacesService: jest.Mocked<SpacesService>;
  let cryptoService: jest.Mocked<CryptoService>;
  let queueService: jest.Mocked<QueueService>;
  let configService: jest.Mocked<ConfigService>;
  let postHogService: jest.Mocked<PostHogService>;

  const mockPreflight = {
    budgetName: 'Personal',
    lunchMoneyAccountId: 42,
    primaryCurrency: 'USD',
    dateRange: { startDate: '2020-01-01', endDate: '2026-06-22' },
    counts: {
      categories: 10,
      tags: 2,
      accounts: 3,
      plaidAccounts: 1,
      manualAssets: 2,
      cryptoAccounts: 0,
      transactions: 100,
      groupTransactionsSkipped: 0,
      recurringItems: 4,
    },
    limitations: ['snapshot only'],
  };

  beforeEach(() => {
    prisma = {
      platformImportJob: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    spacesService = {
      verifyUserAccess: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SpacesService>;

    cryptoService = {
      encrypt: jest.fn().mockReturnValue('enc-token'),
      decrypt: jest.fn().mockReturnValue('plain-token'),
    } as unknown as jest.Mocked<CryptoService>;

    queueService = {
      addPlatformImportJob: jest.fn().mockResolvedValue({ id: 'bull-1' }),
    } as unknown as jest.Mocked<QueueService>;

    configService = {
      get: jest.fn().mockImplementation((key: string, def?: string) => {
        if (key === 'FEATURE_LUNCHMONEY_IMPORT') return 'true';
        return def;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    postHogService = {
      capture: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PostHogService>;

    (LunchMoneyImportRunner as jest.Mock).mockImplementation(() => ({
      preflight: jest.fn().mockResolvedValue(mockPreflight),
      run: jest.fn().mockResolvedValue({ counts: { transactionsCreated: 5 } }),
    }));

    service = new PlatformImportService(
      prisma,
      spacesService,
      cryptoService,
      { logEvent: jest.fn() } as unknown as AuditService,
      queueService,
      configService,
      postHogService
    );
  });

  it('rejects when feature flag is off', async () => {
    configService.get.mockReturnValue('false');
    await expect(
      service.preflightLunchMoney('user-1', 'space-1', 'token-12345678')
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('starts import job with encrypted token and enqueues worker', async () => {
    const created = {
      id: 'job-1',
      spaceId: 'space-1',
      userId: 'user-1',
      source: PlatformImportSource.lunchmoney,
      status: PlatformImportStatus.pending,
      encryptedToken: 'enc-token',
    };

    (prisma.platformImportJob.create as jest.Mock).mockResolvedValue(created);
    (prisma.platformImportJob.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      ...created,
      bullmqJobId: 'bull-1',
    });

    const result = await service.startLunchMoneyImport(
      'user-1',
      'space-1',
      'token-12345678',
      '2020-01-01'
    );

    expect(spacesService.verifyUserAccess).toHaveBeenCalledWith('user-1', 'space-1', 'member');
    expect(cryptoService.encrypt).toHaveBeenCalledWith('token-12345678');
    expect(queueService.addPlatformImportJob).toHaveBeenCalledWith({
      importJobId: 'job-1',
      spaceId: 'space-1',
      userId: 'user-1',
    });
    expect(result).not.toHaveProperty('encryptedToken');
    expect(postHogService.capture).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'migration_started', distinctId: 'user-1' })
    );
  });

  it('sanitizes job responses', async () => {
    (prisma.platformImportJob.findFirst as jest.Mock).mockResolvedValue({
      id: 'job-1',
      spaceId: 'space-1',
      userId: 'user-1',
      encryptedToken: 'secret',
      status: PlatformImportStatus.completed,
    });

    const job = await service.getJob('user-1', 'space-1', 'job-1');
    expect(job).not.toHaveProperty('encryptedToken');
  });
});
