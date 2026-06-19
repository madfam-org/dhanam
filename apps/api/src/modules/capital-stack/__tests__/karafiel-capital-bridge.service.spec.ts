import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';

import { OwnerCapitalJournalStatus } from '@db';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { KarafielService } from '../../integrations/karafiel.service';

import { ComplianceBridgeEventService } from '../compliance-bridge-event.service';
import { KarafielCapitalBridgeService } from '../karafiel-capital-bridge.service';
import { OwnerCapitalJournalService } from '../owner-capital-journal.service';

describe('KarafielCapitalBridgeService', () => {
  let service: KarafielCapitalBridgeService;
  let http: { post: jest.Mock };
  let prisma: { ownerCapitalJournal: { findUniqueOrThrow: jest.Mock; update: jest.Mock } };
  let journals: { updateStatus: jest.Mock };
  let bridgeEvents: { record: jest.Mock };

  const journalFixture = {
    id: 'journal-1',
    flowType: 'capital_contribution',
    status: OwnerCapitalJournalStatus.matched,
    detectionConfidence: 0.92,
    karafielCaseId: null,
    entityGroup: {
      beneficialOwner: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' },
      spaces: [{ type: 'business', operatorBinding: null }],
    },
    sourceTransaction: {
      id: 'txn-src',
      date: new Date('2026-06-18T12:00:00.000Z'),
      amount: { toString: () => '19900' },
      currency: 'MXN',
      description: 'LOC draw',
      merchant: 'BBVA',
      metadata: { rfc: 'RFC123' },
      account: { capitalPurpose: 'owner_facility', spaceId: 'space-personal' },
    },
    targetTransaction: null,
  };

  beforeEach(async () => {
    http = { post: jest.fn() };
    prisma = {
      ownerCapitalJournal: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(journalFixture),
        update: jest.fn(),
      },
    };
    journals = { updateStatus: jest.fn() };
    bridgeEvents = { record: jest.fn().mockResolvedValue({ id: 'event-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KarafielCapitalBridgeService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'FEATURE_CAPITAL_STACK_KARAFIEL') return 'false';
              return undefined;
            },
          },
        },
        { provide: HttpService, useValue: http },
        { provide: KarafielService, useValue: { isConfigured: () => false } },
        { provide: PrismaService, useValue: prisma },
        { provide: ComplianceBridgeEventService, useValue: bridgeEvents },
        { provide: OwnerCapitalJournalService, useValue: journals },
      ],
    }).compile();

    service = module.get(KarafielCapitalBridgeService);
  });

  it('returns mock case id when Karafiel bridge is disabled', async () => {
    prisma.ownerCapitalJournal.findUniqueOrThrow.mockResolvedValue({
      ...journalFixture,
      entityGroup: {
        ...journalFixture.entityGroup,
        spaces: [
          {
            type: 'business',
            operatorBinding: {
              spaceId: 'space-biz',
              operatorUserId: 'op-1',
              legalName: 'Innovaciones MADFAM',
              taxId: 'RFC123',
            },
          },
        ],
      },
    });

    const result = await service.sendJournalToKarafiel('journal-1', 'owner-1');

    expect(result.karafiel_case_id).toMatch(/^MOCK-CAP-/);
    expect(result.review_required).toBe(true);
    expect(journals.updateStatus).toHaveBeenCalledWith(
      'journal-1',
      OwnerCapitalJournalStatus.manual_review,
      'owner-1',
      { karafielMock: true }
    );
    expect(bridgeEvents.record).toHaveBeenCalled();
  });

  it('short-circuits when journal already has a Karafiel case id', async () => {
    prisma.ownerCapitalJournal.findUniqueOrThrow.mockResolvedValue({
      ...journalFixture,
      karafielCaseId: 'kf-existing',
      status: OwnerCapitalJournalStatus.compliance_pending,
    });

    const result = await service.sendJournalToKarafiel('journal-1', 'owner-1');

    expect(result).toEqual({
      karafiel_case_id: 'kf-existing',
      status: 'accepted',
      review_required: false,
    });
    expect(http.post).not.toHaveBeenCalled();
  });

  it('posts to Karafiel when feature flag and credentials are enabled', async () => {
    const enabled = new KarafielCapitalBridgeService(
      {
        get: (key: string) => {
          if (key === 'FEATURE_CAPITAL_STACK_KARAFIEL') return 'true';
          if (key === 'KARAFIEL_API_URL') return 'https://api.karafiel.test';
          if (key === 'KARAFIEL_API_KEY') return 'key-1';
          return undefined;
        },
      } as ConfigService,
      http as unknown as HttpService,
      { isConfigured: () => true } as KarafielService,
      prisma as unknown as PrismaService,
      bridgeEvents as unknown as ComplianceBridgeEventService,
      journals as unknown as OwnerCapitalJournalService
    );

    prisma.ownerCapitalJournal.findUniqueOrThrow.mockResolvedValue({
      ...journalFixture,
      entityGroup: {
        ...journalFixture.entityGroup,
        spaces: [
          {
            type: 'business',
            operatorBinding: {
              spaceId: 'space-biz',
              operatorUserId: 'op-1',
              legalName: 'Innovaciones MADFAM',
              taxId: 'RFC123',
            },
          },
        ],
      },
    });

    http.post.mockReturnValue(
      of({
        data: {
          karafiel_case_id: 'kf-live',
          status: 'accepted',
          review_required: false,
        },
      })
    );

    const result = await enabled.sendJournalToKarafiel('journal-1', 'owner-1');

    expect(result.karafiel_case_id).toBe('kf-live');
    expect(http.post).toHaveBeenCalledWith(
      'https://api.karafiel.test/v1/compliance/capital-flow',
      expect.objectContaining({
        correlation_id: 'journal-1',
        source_transaction: expect.objectContaining({ dhanam_transaction_id: 'txn-src' }),
      }),
      expect.any(Object)
    );
    expect(prisma.ownerCapitalJournal.update).toHaveBeenCalled();
  });
});
