import { Test, TestingModule } from '@nestjs/testing';

import { OwnerCapitalFlowType, OwnerCapitalJournalStatus } from '@db';

import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';

import { EntityGroupService } from '../entity-group.service';
import { OwnerCapitalJournalService } from '../owner-capital-journal.service';

describe('OwnerCapitalJournalService', () => {
  let service: OwnerCapitalJournalService;
  let prisma: {
    ownerCapitalJournal: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    account: { findFirst: jest.Mock; update: jest.Mock };
  };
  let entityGroups: { listForUser: jest.Mock; assertBeneficialOwnerOrAdmin: jest.Mock };

  beforeEach(async () => {
    prisma = {
      ownerCapitalJournal: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      account: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    entityGroups = {
      listForUser: jest.fn().mockResolvedValue([{ id: 'group-1' }]),
      assertBeneficialOwnerOrAdmin: jest.fn().mockResolvedValue({ id: 'group-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnerCapitalJournalService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AuditService,
          useValue: { log: jest.fn() },
        },
        { provide: EntityGroupService, useValue: entityGroups },
      ],
    }).compile();

    service = module.get(OwnerCapitalJournalService);
  });

  it('creates a journal entry for beneficial owner', async () => {
    prisma.ownerCapitalJournal.create.mockResolvedValue({
      id: 'journal-1',
      status: OwnerCapitalJournalStatus.draft,
    });

    const result = await service.create(
      {
        entityGroupId: 'group-1',
        flowType: OwnerCapitalFlowType.capital_contribution,
        amount: 1000,
        currency: 'MXN',
      },
      'user-1'
    );

    expect(result.id).toBe('journal-1');
    expect(prisma.ownerCapitalJournal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityGroupId: 'group-1',
          flowType: OwnerCapitalFlowType.capital_contribution,
          amount: 1000,
        }),
      })
    );
  });

  it('rejects non-positive amounts', async () => {
    await expect(
      service.create(
        {
          entityGroupId: 'group-1',
          flowType: OwnerCapitalFlowType.capital_contribution,
          amount: 0,
          currency: 'MXN',
        },
        'user-1'
      )
    ).rejects.toThrow('Amount must be positive');
  });

  it('matches journal to target transaction', async () => {
    prisma.ownerCapitalJournal.findFirst.mockResolvedValue({
      id: 'journal-1',
      entityGroupId: 'group-1',
      targetSpaceId: 'space-biz',
    });
    prisma.ownerCapitalJournal.update.mockResolvedValue({
      id: 'journal-1',
      status: OwnerCapitalJournalStatus.matched,
    });

    const result = await service.match('journal-1', { targetTransactionId: 'txn-2' }, 'user-1');

    expect(result.status).toBe(OwnerCapitalJournalStatus.matched);
  });
});
