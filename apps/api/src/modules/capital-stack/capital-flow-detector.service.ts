import { Injectable, Logger } from '@nestjs/common';

import { CapitalPurpose, OwnerCapitalFlowType, OwnerCapitalJournalStatus } from '@db';

import { PrismaService } from '../../core/prisma/prisma.service';

import { EntityGroupService } from './entity-group.service';
import { OwnerCapitalJournalService } from './owner-capital-journal.service';

export interface DetectionCandidate {
  entityGroupId: string;
  flowType: OwnerCapitalFlowType;
  confidence: number;
  ruleIds: string[];
  sourceTransactionId: string;
  sourceSpaceId: string;
  targetSpaceId?: string;
  targetTransactionId?: string;
  amount: number;
  currency: string;
}

/**
 * Rule-based detector for owner-facility → entity flows (RFC-6 Phase 3).
 * Phase 1 ships the service shell; rules activate behind FEATURE_CAPITAL_STACK_DETECTOR.
 */
@Injectable()
export class CapitalFlowDetectorService {
  private readonly logger = new Logger(CapitalFlowDetectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entityGroups: EntityGroupService,
    private readonly journals: OwnerCapitalJournalService
  ) {}

  async evaluateTransaction(
    transactionId: string,
    _userId: string
  ): Promise<DetectionCandidate | null> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        account: {
          include: {
            space: {
              include: {
                household: true,
                operatorBinding: true,
              },
            },
          },
        },
      },
    });

    if (!transaction?.account) {
      return null;
    }

    const { account } = transaction;
    const household = account.space.household;

    if (!household || household.type !== 'owner_operator') {
      return null;
    }

    if (account.capitalPurpose !== CapitalPurpose.owner_facility) {
      return null;
    }

    const entityRfc = await this.resolveEntityRfc(household.id);
    const metadata = transaction.metadata as Record<string, unknown> | null;
    const txnRfc = typeof metadata?.rfc === 'string' ? metadata.rfc : undefined;

    let confidence = 0.4;
    const ruleIds: string[] = ['scope_owner_facility'];

    if (entityRfc && txnRfc && entityRfc === txnRfc) {
      confidence += 0.45;
      ruleIds.push('rfc_counterparty_match');
    }

    const businessSpace = await this.prisma.space.findFirst({
      where: {
        householdId: household.id,
        type: 'business',
      },
    });

    let targetTransactionId: string | undefined;
    let targetSpaceId = businessSpace?.id;

    const pairedInflow = await this.findMatchingBusinessInflow(
      household.id,
      transaction.amount,
      transaction.currency,
      transaction.date,
      transaction.id
    );

    if (pairedInflow) {
      confidence += 0.35;
      ruleIds.push('amount_window_pair');
      targetTransactionId = pairedInflow.id;
      targetSpaceId = pairedInflow.spaceId;
    }

    if (confidence < 0.5) {
      return null;
    }

    return {
      entityGroupId: household.id,
      flowType: OwnerCapitalFlowType.capital_contribution,
      confidence: Math.min(confidence, 0.99),
      ruleIds,
      sourceTransactionId: transaction.id,
      sourceSpaceId: account.spaceId,
      targetSpaceId,
      targetTransactionId,
      amount: Number(transaction.amount),
      currency: transaction.currency,
    };
  }

  /** Transactions on owner_facility accounts not yet linked to a journal. */
  async findUnjournaledTransactions(
    limit = 50
  ): Promise<Array<{ transactionId: string; beneficialOwnerUserId: string | null }>> {
    const journaled = await this.prisma.ownerCapitalJournal.findMany({
      where: { sourceTransactionId: { not: null } },
      select: { sourceTransactionId: true },
      take: 5000,
    });

    const excludeIds = journaled
      .map((row) => row.sourceTransactionId)
      .filter((id): id is string => Boolean(id));

    const transactions = await this.prisma.transaction.findMany({
      where: {
        deletedAt: null,
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
        account: {
          capitalPurpose: CapitalPurpose.owner_facility,
          space: {
            household: { type: 'owner_operator' },
          },
        },
      },
      include: {
        account: {
          include: {
            space: {
              include: {
                household: { select: { beneficialOwnerUserId: true } },
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });

    return transactions.map((txn) => ({
      transactionId: txn.id,
      beneficialOwnerUserId: txn.account.space.household?.beneficialOwnerUserId ?? null,
    }));
  }

  private async findMatchingBusinessInflow(
    householdId: string,
    amount: { toString(): string },
    currency: string,
    sourceDate: Date,
    excludeTxnId: string
  ): Promise<{ id: string; spaceId: string } | null> {
    const amountNum = Number(amount);
    const tolerance = Math.max(amountNum * 0.01, 0.01);
    const windowStart = new Date(sourceDate);
    windowStart.setDate(windowStart.getDate() - 3);
    const windowEnd = new Date(sourceDate);
    windowEnd.setDate(windowEnd.getDate() + 3);

    const match = await this.prisma.transaction.findFirst({
      where: {
        id: { not: excludeTxnId },
        deletedAt: null,
        currency: currency as 'MXN',
        amount: {
          gte: amountNum - tolerance,
          lte: amountNum + tolerance,
        },
        date: { gte: windowStart, lte: windowEnd },
        journalTargetEntries: { none: {} },
        account: {
          capitalPurpose: CapitalPurpose.entity_operating,
          space: { householdId, type: 'business' },
        },
      },
      select: {
        id: true,
        account: { select: { spaceId: true } },
      },
      orderBy: { date: 'asc' },
    });

    if (!match) {
      return null;
    }

    return { id: match.id, spaceId: match.account.spaceId };
  }

  async applyCandidate(candidate: DetectionCandidate, userId: string, autoThreshold = 0.85) {
    const status = candidate.targetTransactionId
      ? candidate.confidence >= autoThreshold
        ? OwnerCapitalJournalStatus.matched
        : OwnerCapitalJournalStatus.proposed
      : candidate.confidence >= autoThreshold
        ? OwnerCapitalJournalStatus.proposed
        : OwnerCapitalJournalStatus.draft;

    const journal = await this.journals.create(
      {
        entityGroupId: candidate.entityGroupId,
        flowType: candidate.flowType,
        amount: candidate.amount,
        currency: candidate.currency as 'MXN',
        sourceSpaceId: candidate.sourceSpaceId,
        targetSpaceId: candidate.targetSpaceId,
        sourceTransactionId: candidate.sourceTransactionId,
        targetTransactionId: candidate.targetTransactionId,
        status,
        detectionConfidence: candidate.confidence,
        metadata: { ruleIds: candidate.ruleIds },
      },
      userId
    );

    this.logger.log(`Detection applied journal=${journal.id} confidence=${candidate.confidence}`);

    return journal;
  }

  private async resolveEntityRfc(householdId: string): Promise<string | undefined> {
    const binding = await this.prisma.spaceOperatorBinding.findFirst({
      where: {
        space: { householdId, type: 'business' },
      },
    });
    return binding?.taxId;
  }
}
