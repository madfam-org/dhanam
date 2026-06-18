import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import {
  CapitalPurpose,
  Currency,
  OwnerCapitalFlowType,
  OwnerCapitalJournalStatus,
  Prisma,
} from '@db';

import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';

import { EntityGroupService } from './entity-group.service';

export interface CreateJournalInput {
  entityGroupId: string;
  flowType: OwnerCapitalFlowType;
  amount: number;
  currency: Currency;
  sourceSpaceId?: string;
  targetSpaceId?: string;
  sourceTransactionId?: string;
  targetTransactionId?: string;
  notes?: string;
  status?: OwnerCapitalJournalStatus;
  detectionConfidence?: number;
  metadata?: Prisma.InputJsonValue;
}

export interface MatchJournalInput {
  targetTransactionId: string;
  targetSpaceId?: string;
}

@Injectable()
export class OwnerCapitalJournalService {
  private readonly logger = new Logger(OwnerCapitalJournalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entityGroups: EntityGroupService
  ) {}

  async list(
    userId: string,
    filters: {
      entityGroupId?: string;
      status?: OwnerCapitalJournalStatus;
      flowType?: OwnerCapitalFlowType;
    }
  ) {
    const groups = await this.entityGroups.listForUser(userId);
    const groupIds = groups.map((g) => g.id);

    if (filters.entityGroupId && !groupIds.includes(filters.entityGroupId)) {
      throw new NotFoundException('Entity group not found');
    }

    return this.prisma.ownerCapitalJournal.findMany({
      where: {
        entityGroupId: filters.entityGroupId ?? { in: groupIds },
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.flowType ? { flowType: filters.flowType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async create(input: CreateJournalInput, userId: string, isAdmin = false) {
    await this.entityGroups.assertBeneficialOwnerOrAdmin(input.entityGroupId, userId, isAdmin);

    if (input.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const journal = await this.prisma.ownerCapitalJournal.create({
      data: {
        entityGroupId: input.entityGroupId,
        flowType: input.flowType,
        status: input.status ?? OwnerCapitalJournalStatus.draft,
        sourceSpaceId: input.sourceSpaceId,
        targetSpaceId: input.targetSpaceId,
        sourceTransactionId: input.sourceTransactionId,
        targetTransactionId: input.targetTransactionId,
        amount: input.amount,
        currency: input.currency,
        detectionConfidence: input.detectionConfidence,
        notes: input.notes,
        metadata: input.metadata,
        createdByUserId: userId,
      },
    });

    await this.audit.log({
      userId,
      action: 'OWNER_CAPITAL_JOURNAL_CREATED',
      resource: 'owner_capital_journal',
      resourceId: journal.id,
      severity: 'low',
      metadata: { flowType: input.flowType, entityGroupId: input.entityGroupId },
    });

    return journal;
  }

  async match(journalId: string, input: MatchJournalInput, userId: string, isAdmin = false) {
    const journal = await this.getJournalForUser(journalId, userId);
    await this.entityGroups.assertBeneficialOwnerOrAdmin(journal.entityGroupId, userId, isAdmin);

    const updated = await this.prisma.ownerCapitalJournal.update({
      where: { id: journalId },
      data: {
        targetTransactionId: input.targetTransactionId,
        targetSpaceId: input.targetSpaceId ?? journal.targetSpaceId,
        status: OwnerCapitalJournalStatus.matched,
      },
    });

    await this.audit.log({
      userId,
      action: 'OWNER_CAPITAL_JOURNAL_MATCHED',
      resource: 'owner_capital_journal',
      resourceId: journalId,
      severity: 'low',
      metadata: { targetTransactionId: input.targetTransactionId },
    });

    return updated;
  }

  async updateStatus(
    journalId: string,
    status: OwnerCapitalJournalStatus,
    userId: string,
    metadata?: Prisma.InputJsonValue
  ) {
    const journal = await this.prisma.ownerCapitalJournal.update({
      where: { id: journalId },
      data: {
        status,
        ...(metadata !== undefined ? { metadata } : {}),
      },
    });

    await this.audit.log({
      userId,
      action: 'OWNER_CAPITAL_JOURNAL_STATUS_UPDATED',
      resource: 'owner_capital_journal',
      resourceId: journalId,
      severity: 'medium',
      metadata: { status },
    });

    return journal;
  }

  async getReviewQueue() {
    return this.prisma.ownerCapitalJournal.findMany({
      where: {
        status: { in: ['proposed', 'manual_review', 'compliance_pending'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async resolveManual(
    journalId: string,
    userId: string,
    body: { resolution: 'sealed' | 'void'; karafielCaseId?: string; notes?: string }
  ) {
    const status =
      body.resolution === 'void'
        ? OwnerCapitalJournalStatus.void
        : OwnerCapitalJournalStatus.compliance_sealed;

    return this.prisma.ownerCapitalJournal.update({
      where: { id: journalId },
      data: {
        status,
        karafielCaseId: body.karafielCaseId ?? undefined,
        notes: body.notes,
        metadata: {
          resolvedOutOfBand: body.resolution === 'sealed',
          resolvedBy: userId,
          resolvedAt: new Date().toISOString(),
        },
      },
    });
  }

  async setAccountCapitalPurpose(
    accountId: string,
    capitalPurpose: CapitalPurpose,
    userId: string
  ) {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        space: { userSpaces: { some: { userId } } },
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return this.prisma.account.update({
      where: { id: accountId },
      data: { capitalPurpose },
    });
  }

  private async getJournalForUser(journalId: string, userId: string) {
    const groups = await this.entityGroups.listForUser(userId);
    const journal = await this.prisma.ownerCapitalJournal.findFirst({
      where: {
        id: journalId,
        entityGroupId: { in: groups.map((g) => g.id) },
      },
    });

    if (!journal) {
      throw new NotFoundException('Journal entry not found');
    }

    return journal;
  }
}
