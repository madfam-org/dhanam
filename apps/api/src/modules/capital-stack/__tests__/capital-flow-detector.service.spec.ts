import { Test, TestingModule } from '@nestjs/testing';

import { CapitalPurpose, OwnerCapitalFlowType, OwnerCapitalJournalStatus } from '@db';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CapitalFlowDetectorService } from '../capital-flow-detector.service';
import { EntityGroupService } from '../entity-group.service';
import { OwnerCapitalJournalService } from '../owner-capital-journal.service';

describe('CapitalFlowDetectorService', () => {
  let service: CapitalFlowDetectorService;
  let prisma: {
    transaction: { findUnique: jest.Mock };
    space: { findFirst: jest.Mock };
    spaceOperatorBinding: { findFirst: jest.Mock };
  };
  let journals: { create: jest.Mock };

  beforeEach(async () => {
    prisma = {
      transaction: { findUnique: jest.fn() },
      space: { findFirst: jest.fn().mockResolvedValue({ id: 'biz-space' }) },
      spaceOperatorBinding: {
        findFirst: jest.fn().mockResolvedValue({ taxId: 'IMA2501164Y7' }),
      },
    };

    journals = {
      create: jest.fn().mockResolvedValue({ id: 'journal-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CapitalFlowDetectorService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntityGroupService, useValue: {} },
        {
          provide: OwnerCapitalJournalService,
          useValue: journals,
        },
      ],
    }).compile();

    service = module.get(CapitalFlowDetectorService);
  });

  it('returns null for non owner_facility accounts', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'txn-1',
      amount: 500,
      currency: 'MXN',
      metadata: {},
      account: {
        capitalPurpose: CapitalPurpose.personal_life,
        spaceId: 'space-1',
        space: { household: { id: 'hh-1', type: 'owner_operator' } },
      },
    });

    const result = await service.evaluateTransaction('txn-1', 'user-1');
    expect(result).toBeNull();
  });

  it('proposes journal when RFC counterparty matches entity binding', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'txn-2',
      amount: 1200,
      currency: 'MXN',
      metadata: { rfc: 'IMA2501164Y7' },
      account: {
        capitalPurpose: CapitalPurpose.owner_facility,
        spaceId: 'space-personal',
        space: {
          household: { id: 'hh-1', type: 'owner_operator' },
          operatorBinding: null,
        },
      },
    });

    const candidate = await service.evaluateTransaction('txn-2', 'user-1');

    expect(candidate).toMatchObject({
      entityGroupId: 'hh-1',
      flowType: OwnerCapitalFlowType.capital_contribution,
      confidence: expect.any(Number),
      ruleIds: expect.arrayContaining(['scope_owner_facility', 'rfc_counterparty_match']),
    });

    await service.applyCandidate(candidate!, 'user-1', 0.85);

    expect(journals.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: OwnerCapitalJournalStatus.proposed,
        sourceTransactionId: 'txn-2',
      }),
      'user-1'
    );
  });
});
