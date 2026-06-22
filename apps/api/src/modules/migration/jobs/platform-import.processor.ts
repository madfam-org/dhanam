import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';

import { PlatformImportJobData, QueueService } from '@modules/jobs/queue.service';

import { PlatformImportService } from '../platform-import.service';

@Injectable()
export class PlatformImportProcessor implements OnModuleInit {
  private readonly logger = new Logger(PlatformImportProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly platformImportService: PlatformImportService
  ) {}

  onModuleInit(): void {
    try {
      this.worker = this.queueService.registerWorker('platform-import', (job: Job) =>
        this.process(job as Job<PlatformImportJobData['payload']>)
      );
      this.logger.log('Platform import worker registered');
    } catch (error) {
      if (process.env.NODE_ENV === 'test') {
        this.logger.warn('Skipping platform import worker in test environment');
        return;
      }
      throw error;
    }
  }

  async process(job: Job<PlatformImportJobData['payload']>): Promise<{ ok: true }> {
    const { importJobId } = job.data;
    this.logger.log(`Processing platform import job ${importJobId}`);
    await this.platformImportService.executeLunchMoneyJob(importJobId);
    return { ok: true };
  }
}
