import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditService } from '@core/audit/audit.service';
import { CryptoService } from '@core/crypto/crypto.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { PostHogService } from '@modules/analytics/posthog.service';
import { QueueService } from '@modules/jobs/queue.service';
import { SpacesService } from '@modules/spaces/spaces.service';
import { PlatformImportSource, PlatformImportStatus } from '@db';

import { LunchMoneyImportRunner } from './lunchmoney/lunchmoney-import.runner';
import type { LunchMoneyPreflightResult } from './lunchmoney/lunchmoney-import.types';

const TOKEN_TTL_HOURS = 24;
const DEFAULT_START_DATE = '2024-01-01';

@Injectable()
export class PlatformImportService {
  private readonly logger = new Logger(PlatformImportService.name);
  private readonly runner: LunchMoneyImportRunner;

  constructor(
    private readonly prisma: PrismaService,
    private readonly spacesService: SpacesService,
    private readonly cryptoService: CryptoService,
    private readonly auditService: AuditService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly postHogService: PostHogService
  ) {
    this.runner = new LunchMoneyImportRunner(prisma);
  }

  isLunchMoneyImportEnabled(): boolean {
    return this.configService.get<string>('FEATURE_LUNCHMONEY_IMPORT', 'false') === 'true';
  }

  assertLunchMoneyImportEnabled(): void {
    if (!this.isLunchMoneyImportEnabled()) {
      throw new ForbiddenException('LunchMoney import is not enabled on this environment');
    }
  }

  async preflightLunchMoney(
    userId: string,
    spaceId: string,
    apiToken: string,
    startDate?: string
  ): Promise<LunchMoneyPreflightResult> {
    this.assertLunchMoneyImportEnabled();
    await this.spacesService.verifyUserAccess(userId, spaceId, 'member');

    const effectiveStart = startDate || DEFAULT_START_DATE;
    try {
      return await this.runner.preflight(apiToken, effectiveStart);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LunchMoney preflight failed';
      this.logger.warn(`LM preflight failed for space ${spaceId}: ${message}`);
      throw new BadRequestException('Could not connect to LunchMoney. Check your API token.');
    }
  }

  async startLunchMoneyImport(
    userId: string,
    spaceId: string,
    apiToken: string,
    startDate?: string,
    budgetLabel?: string
  ) {
    this.assertLunchMoneyImportEnabled();
    await this.spacesService.verifyUserAccess(userId, spaceId, 'member');

    const effectiveStart = startDate || DEFAULT_START_DATE;
    const preflightSummary = await this.preflightLunchMoney(
      userId,
      spaceId,
      apiToken,
      effectiveStart
    );

    const encryptedToken = this.cryptoService.encrypt(apiToken);
    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

    const job = await this.prisma.platformImportJob.create({
      data: {
        spaceId,
        userId,
        source: PlatformImportSource.lunchmoney,
        status: PlatformImportStatus.pending,
        encryptedToken,
        tokenExpiresAt,
        startDate: effectiveStart,
        preflightSummary: preflightSummary as object,
        options: budgetLabel ? { budgetLabel } : undefined,
      },
    });

    const bullJob = await this.queueService.addPlatformImportJob({
      importJobId: job.id,
      spaceId,
      userId,
    });

    if (bullJob?.id) {
      await this.prisma.platformImportJob.update({
        where: { id: job.id },
        data: { bullmqJobId: String(bullJob.id) },
      });
    }

    await this.auditService.logEvent({
      userId,
      action: 'migration.started',
      resource: 'platform_import_job',
      resourceId: job.id,
      metadata: {
        spaceId,
        source: PlatformImportSource.lunchmoney,
        startDate: effectiveStart,
        preflightCounts: preflightSummary.counts,
      },
      severity: 'medium',
    });

    void this.trackMigration('migration_started', userId, {
      spaceId,
      source: PlatformImportSource.lunchmoney,
      jobId: job.id,
      startDate: effectiveStart,
    });

    return this.sanitizeJob(
      await this.prisma.platformImportJob.findUniqueOrThrow({ where: { id: job.id } })
    );
  }

  async getJob(userId: string, spaceId: string, jobId: string) {
    await this.spacesService.verifyUserAccess(userId, spaceId, 'member');

    const job = await this.prisma.platformImportJob.findFirst({
      where: { id: jobId, spaceId, userId },
    });

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    return this.sanitizeJob(job);
  }

  async listJobs(userId: string, spaceId: string, limit = 10) {
    await this.spacesService.verifyUserAccess(userId, spaceId, 'member');

    const jobs = await this.prisma.platformImportJob.findMany({
      where: { spaceId, userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return jobs.map((job) => this.sanitizeJob(job));
  }

  async executeLunchMoneyJob(importJobId: string): Promise<void> {
    const job = await this.prisma.platformImportJob.findUnique({
      where: { id: importJobId },
    });

    if (!job || job.source !== PlatformImportSource.lunchmoney) {
      throw new NotFoundException(`Import job ${importJobId} not found`);
    }

    if (
      job.status === PlatformImportStatus.completed ||
      job.status === PlatformImportStatus.cancelled
    ) {
      return;
    }

    if (!job.encryptedToken) {
      throw new BadRequestException('Import job has no credentials');
    }

    if (job.tokenExpiresAt && job.tokenExpiresAt < new Date()) {
      await this.markFailed(job.id, job.userId, job.spaceId, 'API token expired before import ran');
      return;
    }

    await this.prisma.platformImportJob.update({
      where: { id: job.id },
      data: {
        status: PlatformImportStatus.running,
        startedAt: new Date(),
        errorMessage: null,
      },
    });

    try {
      const apiToken = this.cryptoService.decrypt(job.encryptedToken);
      const options = (job.options ?? {}) as { budgetLabel?: string };

      const result = await this.runner.run({
        spaceId: job.spaceId,
        apiToken,
        startDate: job.startDate ?? DEFAULT_START_DATE,
        onLog: (phase, message) => this.logger.log(`[${job.id}][${phase}] ${message}`),
        budgetLabel: options.budgetLabel,
      });

      await this.prisma.platformImportJob.update({
        where: { id: job.id },
        data: {
          status: PlatformImportStatus.completed,
          resultSummary: result as object,
          completedAt: new Date(),
          encryptedToken: null,
          tokenExpiresAt: null,
        },
      });

      await this.auditService.logEvent({
        userId: job.userId,
        action: 'migration.completed',
        resource: 'platform_import_job',
        resourceId: job.id,
        metadata: {
          spaceId: job.spaceId,
          source: job.source,
          counts: result.counts,
        },
        severity: 'medium',
      });

      void this.trackMigration('migration_completed', job.userId, {
        spaceId: job.spaceId,
        source: job.source,
        jobId: job.id,
        counts: result.counts,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      await this.markFailed(job.id, job.userId, job.spaceId, message);
      throw error;
    }
  }

  private async markFailed(
    jobId: string,
    userId: string,
    spaceId: string,
    message: string
  ): Promise<void> {
    await this.prisma.platformImportJob.update({
      where: { id: jobId },
      data: {
        status: PlatformImportStatus.failed,
        errorMessage: message,
        completedAt: new Date(),
        encryptedToken: null,
        tokenExpiresAt: null,
      },
    });

    await this.auditService.logEvent({
      userId,
      action: 'migration.failed',
      resource: 'platform_import_job',
      resourceId: jobId,
      metadata: { spaceId, error: message },
      severity: 'high',
    });

    void this.trackMigration('migration_failed', userId, {
      spaceId,
      jobId,
      error: message,
    });
  }

  private trackMigration(
    event: 'migration_started' | 'migration_completed' | 'migration_failed',
    userId: string,
    properties: Record<string, unknown>
  ): void {
    void this.postHogService.capture({ distinctId: userId, event, properties }).catch((err) => {
      this.logger.warn(`PostHog ${event} capture failed: ${err instanceof Error ? err.message : err}`);
    });
  }

  private sanitizeJob<T extends { encryptedToken?: string | null }>(job: T) {
    const { encryptedToken: _token, ...rest } = job;
    return rest;
  }
}
