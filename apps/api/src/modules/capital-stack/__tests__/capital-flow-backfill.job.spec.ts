import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { CapitalFlowDetectorService } from '../capital-flow-detector.service';
import { CapitalFlowBackfillJob } from '../jobs/capital-flow-backfill.job';

describe('CapitalFlowBackfillJob', () => {
  let job: CapitalFlowBackfillJob;
  let detector: {
    findUnjournaledTransactions: jest.Mock;
    evaluateTransaction: jest.Mock;
    applyCandidate: jest.Mock;
  };

  beforeEach(async () => {
    detector = {
      findUnjournaledTransactions: jest.fn().mockResolvedValue([
        { transactionId: 'txn-1', beneficialOwnerUserId: 'owner-1' },
        { transactionId: 'txn-2', beneficialOwnerUserId: null },
      ]),
      evaluateTransaction: jest.fn().mockResolvedValue({ entityGroupId: 'hh-1' }),
      applyCandidate: jest.fn().mockResolvedValue({ id: 'journal-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CapitalFlowBackfillJob,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'FEATURE_CAPITAL_STACK_ENABLED') return 'true';
              if (key === 'FEATURE_CAPITAL_STACK_DETECTOR') return 'true';
              if (key === 'CAPITAL_STACK_AUTO_PROPOSE_THRESHOLD') return '0.85';
              return undefined;
            },
          },
        },
        { provide: CapitalFlowDetectorService, useValue: detector },
      ],
    }).compile();

    job = module.get(CapitalFlowBackfillJob);
  });

  it('skips when detector feature flag is off', async () => {
    const inactive = new CapitalFlowBackfillJob(
      { get: () => 'false' } as ConfigService,
      detector as unknown as CapitalFlowDetectorService
    );

    const result = await inactive.runBackfill();
    expect(result).toEqual({ processed: 0, journalsCreated: 0 });
    expect(detector.findUnjournaledTransactions).not.toHaveBeenCalled();
  });

  it('creates journals for unjournaled owner-facility transactions', async () => {
    const result = await job.runBackfill(10);

    expect(result).toEqual({ processed: 2, journalsCreated: 1 });
    expect(detector.evaluateTransaction).toHaveBeenCalledWith('txn-1', 'owner-1');
    expect(detector.applyCandidate).toHaveBeenCalledTimes(1);
  });
});
