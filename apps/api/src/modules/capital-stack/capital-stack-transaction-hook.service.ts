import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CapitalFlowDetectorService } from './capital-flow-detector.service';

/**
 * Fire-and-forget hook invoked after new transactions land (RFC-6 Phase 3).
 * Gated by FEATURE_CAPITAL_STACK_ENABLED + FEATURE_CAPITAL_STACK_DETECTOR.
 */
@Injectable()
export class CapitalStackTransactionHookService {
  private readonly logger = new Logger(CapitalStackTransactionHookService.name);

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

  async onTransactionCreated(transactionId: string, userId: string): Promise<void> {
    if (!this.isActive()) {
      return;
    }

    try {
      const candidate = await this.detector.evaluateTransaction(transactionId, userId);
      if (!candidate) {
        return;
      }

      const threshold = Number(
        this.config.get<string>('CAPITAL_STACK_AUTO_PROPOSE_THRESHOLD') ?? '0.85'
      );
      await this.detector.applyCandidate(candidate, userId, threshold);
    } catch (error) {
      this.logger.warn(
        `Capital stack detection skipped for txn=${transactionId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
