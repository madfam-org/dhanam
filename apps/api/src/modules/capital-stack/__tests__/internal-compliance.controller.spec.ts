import * as crypto from 'crypto';

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { OwnerCapitalJournalStatus } from '@db';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { ComplianceBridgeEventService } from '../compliance-bridge-event.service';
import { InternalComplianceController } from '../internal-compliance.controller';

describe('InternalComplianceController', () => {
  let controller: InternalComplianceController;
  let prisma: {
    ownerCapitalJournal: { updateMany: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
  };
  let bridgeEvents: { record: jest.Mock };

  const secret = 'test-webhook-secret';

  beforeEach(async () => {
    prisma = {
      ownerCapitalJournal: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          id: 'journal-1',
          flowType: 'capital_contribution',
          metadata: {},
        }),
      },
    };

    bridgeEvents = { record: jest.fn().mockResolvedValue({ id: 'event-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalComplianceController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'DHANAM_WEBHOOK_SECRET' ? secret : undefined),
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: ComplianceBridgeEventService, useValue: bridgeEvents },
      ],
    }).compile();

    controller = module.get(InternalComplianceController);
  });

  function sign(body: object): string {
    return crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
  }

  it('rejects missing signature', async () => {
    await expect(
      controller.capitalFlowResolved({ rawBody: undefined } as never, '', {
        correlation_id: 'journal-1',
        karafiel_case_id: 'kf-1',
        resolution: 'sealed',
      })
    ).rejects.toThrow(UnauthorizedException);
  });

  it('marks journal compliance_sealed on sealed resolution', async () => {
    const dto = {
      correlation_id: 'journal-1',
      karafiel_case_id: 'kf-1',
      resolution: 'sealed',
      sealed_at: '2026-06-18T17:00:00.000Z',
    };

    const response = await controller.capitalFlowResolved(
      { rawBody: JSON.stringify(dto) } as never,
      sign(dto),
      dto
    );

    expect(response.status).toBe('ok');
    expect(prisma.ownerCapitalJournal.updateMany).toHaveBeenCalledWith({
      where: { id: 'journal-1' },
      data: expect.objectContaining({
        status: OwnerCapitalJournalStatus.compliance_sealed,
        karafielCaseId: 'kf-1',
      }),
    });
    expect(bridgeEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'capital_flow_resolved' })
    );
  });

  it('records manual action from Karafiel operator', async () => {
    const dto = {
      correlation_id: 'journal-1',
      karafiel_case_id: 'kf-1',
      action: 'reclassify_flow',
      actor_email: 'ops@example.com',
      payload: { new_flow_type: 'shareholder_loan' },
    };

    await controller.manualAction({ rawBody: JSON.stringify(dto) } as never, sign(dto), dto);

    expect(prisma.ownerCapitalJournal.update).toHaveBeenCalledWith({
      where: { id: 'journal-1' },
      data: expect.objectContaining({
        flowType: 'shareholder_loan',
        status: OwnerCapitalJournalStatus.manual_review,
      }),
    });
  });
});
