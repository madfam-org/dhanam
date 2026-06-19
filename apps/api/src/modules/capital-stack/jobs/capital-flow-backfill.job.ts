import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { CapitalFlowDetectorService } from '../capital-flow-detector.service';

/**
 * Nightly backfill for owner-facility transactions that landed before the
 * real-time detector hook was enabled (RFC-6 Phase 3).
 */
@Injectable()
export class CapitalFlowBackfillJob {
  private readonly logger = new Logger(CapitalFlowBackfillJob.name);

  constructor(
    private readonly config: ConfigService,
    private readonly detector: CapitalFlowDetectorService
  ) {}

  isActive(): boolean {
    return (
      this.config.get<string>('FEATURE_CAPITAL_STACK_ENABLED') === 'true' &&
      this.config.get<string>('FEATURE_CAPITAL_STACK_DETECTOR') === 'true'
    );
  }

  /** Daily 4:30 AM UTC — after billing reconciliation, before peak traffic. */
  @Cron('30 4 * * *', { name: 'capital-flow-backfill' })
  async runScheduledBackfill(): Promise<void> {
    if (!this.isActive()) {
      return;
    }

    const result = await this.runBackfill();
    if (result.processed > 0) {
      this.logger.log(
        `Capital flow backfill complete: processed=${result.processed} journals=${result.journalsCreated}`
      );
    }
  }

  async runBackfill(limit = 50): Promise<{ processed: number; journalsCreated: number }> {
    if (!this.isActive()) {
      return { processed: 0, journalsCreated: 0 };
    }

    const threshold = Number(
      this.config.get<string>('CAPITAL_STACK_AUTO_PROPOSE_THRESHOLD') ?? '0.85'
    );

    const candidates = await this.detector.findUnjournaledTransactions(limit);
    let journalsCreated = 0;

    for (const row of candidates) {
      const ownerUserId = row.beneficialOwnerUserId;
      if (!ownerUserId) {
        continue;
      }

      try {
        const detection = await this.detector.evaluateTransaction(row.transactionId, ownerUserId);
        if (!detection) {
          continue;
        }

        await this.detector.applyCandidate(detection, ownerUserId, threshold);
        journalsCreated += 1;
      } catch (error) {
        this.logger.warn(
          `Backfill skipped txn=${row.transactionId}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return { processed: candidates.length, journalsCreated };
  }
}
