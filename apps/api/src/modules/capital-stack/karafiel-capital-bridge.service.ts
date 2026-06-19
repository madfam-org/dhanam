import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { ComplianceBridgeDirection, OwnerCapitalJournalStatus, Prisma } from '@db';

import { PrismaService } from '../../core/prisma/prisma.service';
import { KarafielService, type ExtractedTransactionData } from '../integrations/karafiel.service';

import { ComplianceBridgeEventService } from './compliance-bridge-event.service';
import { OwnerCapitalJournalService } from './owner-capital-journal.service';

export interface KarafielCapitalFlowPayload {
  correlation_id: string;
  flow_type: string;
  source: 'dhanam';
  status: string;
  beneficial_owner: {
    dhanam_user_id: string;
    email: string;
    name: string;
    rfc?: string;
  };
  entity: {
    dhanam_space_id: string;
    legal_name: string;
    rfc: string;
    operator_dhanam_user_id: string;
  };
  source_transaction?: Record<string, unknown>;
  target_transaction?: Record<string, unknown>;
  detection?: {
    confidence: number;
    rule_ids: string[];
    detected_at: string;
  };
}

export interface KarafielCapitalFlowResult {
  karafiel_case_id: string;
  status: string;
  review_required: boolean;
}

@Injectable()
export class KarafielCapitalBridgeService {
  private readonly logger = new Logger(KarafielCapitalBridgeService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly karafiel: KarafielService,
    private readonly prisma: PrismaService,
    private readonly bridgeEvents: ComplianceBridgeEventService,
    private readonly journals: OwnerCapitalJournalService
  ) {}

  isKarafielEnabled(): boolean {
    return (
      this.config.get<string>('FEATURE_CAPITAL_STACK_KARAFIEL') === 'true' &&
      this.karafiel.isConfigured()
    );
  }

  async sendJournalToKarafiel(
    journalId: string,
    userId: string
  ): Promise<KarafielCapitalFlowResult> {
    const journal = await this.prisma.ownerCapitalJournal.findUniqueOrThrow({
      where: { id: journalId },
      include: {
        entityGroup: {
          include: {
            beneficialOwner: true,
            spaces: {
              include: { operatorBinding: true },
            },
          },
        },
        sourceTransaction: {
          include: { account: { select: { capitalPurpose: true, spaceId: true } } },
        },
        targetTransaction: {
          include: { account: { select: { capitalPurpose: true, spaceId: true } } },
        },
      },
    });

    if (
      journal.karafielCaseId &&
      (journal.status === OwnerCapitalJournalStatus.compliance_pending ||
        journal.status === OwnerCapitalJournalStatus.manual_review ||
        journal.status === OwnerCapitalJournalStatus.compliance_sealed)
    ) {
      return {
        karafiel_case_id: journal.karafielCaseId,
        status: 'accepted',
        review_required: journal.status === OwnerCapitalJournalStatus.manual_review,
      };
    }

    const businessSpace = journal.entityGroup.spaces.find((s) => s.type === 'business');
    const binding =
      businessSpace?.operatorBinding ??
      (await this.prisma.spaceOperatorBinding.findFirst({
        where: {
          spaceId: { in: journal.entityGroup.spaces.map((s) => s.id) },
        },
      }));

    if (!binding || !journal.entityGroup.beneficialOwner) {
      throw new Error('Entity group missing operator binding or beneficial owner');
    }

    const payload: KarafielCapitalFlowPayload = {
      correlation_id: journal.id,
      flow_type: journal.flowType,
      source: 'dhanam',
      status: journal.status,
      beneficial_owner: {
        dhanam_user_id: journal.entityGroup.beneficialOwner.id,
        email: journal.entityGroup.beneficialOwner.email,
        name: journal.entityGroup.beneficialOwner.name,
      },
      entity: {
        dhanam_space_id: binding.spaceId,
        legal_name: binding.legalName,
        rfc: binding.taxId,
        operator_dhanam_user_id: binding.operatorUserId,
      },
      source_transaction: journal.sourceTransaction
        ? this.mapTransactionPayload(journal.sourceTransaction)
        : undefined,
      target_transaction: journal.targetTransaction
        ? this.mapTransactionPayload(journal.targetTransaction)
        : undefined,
      detection: journal.detectionConfidence
        ? {
            confidence: Number(journal.detectionConfidence),
            rule_ids: [],
            detected_at: new Date().toISOString(),
          }
        : undefined,
    };

    await this.bridgeEvents.record({
      journalId: journal.id,
      direction: ComplianceBridgeDirection.dhanam_to_karafiel,
      eventType: 'capital_flow_send',
      correlationId: journal.id,
      payload: payload as unknown as Prisma.InputJsonValue,
    });

    if (!this.isKarafielEnabled()) {
      this.logger.warn('Karafiel capital bridge disabled — mock case id returned');
      const mock: KarafielCapitalFlowResult = {
        karafiel_case_id: `MOCK-CAP-${journal.id.slice(0, 8)}`,
        status: 'accepted',
        review_required: true,
      };
      await this.journals.updateStatus(journalId, OwnerCapitalJournalStatus.manual_review, userId, {
        karafielMock: true,
      });
      return mock;
    }

    const baseUrl = this.config.get<string>('KARAFIEL_API_URL') || 'https://api.karafiel.madfam.io';
    const apiKey = this.config.get<string>('KARAFIEL_API_KEY') || '';

    try {
      const response = await firstValueFrom(
        this.http.post<KarafielCapitalFlowResult>(
          `${baseUrl}/v1/compliance/capital-flow`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'X-Source': 'dhanam',
            },
            timeout: 15_000,
          }
        )
      );

      const nextStatus = response.data.review_required
        ? OwnerCapitalJournalStatus.manual_review
        : OwnerCapitalJournalStatus.compliance_pending;

      await this.prisma.ownerCapitalJournal.update({
        where: { id: journalId },
        data: {
          status: nextStatus,
          karafielCaseId: response.data.karafiel_case_id,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Karafiel capital-flow failed for ${journalId}`, error);
      await this.journals.updateStatus(journalId, OwnerCapitalJournalStatus.manual_review, userId, {
        karafielError: true,
      });
      throw error;
    }
  }

  /** Map document extraction to Karafiel transaction shape (shared with ingest). */
  toKarafielTransaction(data: ExtractedTransactionData) {
    return {
      date: data.date,
      amount: data.amount,
      currency: data.currency,
      merchant: data.merchant,
      issuer_rfc: data.issuerRfc,
      recipient_rfc: data.recipientRfc,
      description: data.description,
      cfdi_uuid: data.cfdiUuid,
      confidence: data.confidence,
    };
  }

  private mapTransactionPayload(txn: {
    id: string;
    date: Date;
    amount: { toString(): string };
    currency: string;
    description: string;
    merchant: string | null;
    metadata: unknown;
    account: { capitalPurpose: string | null; spaceId: string };
  }) {
    const metadata = txn.metadata as Record<string, unknown> | null;
    const amountMinor = Math.round(Number(txn.amount) * 100);

    return {
      dhanam_transaction_id: txn.id,
      space_id: txn.account.spaceId,
      date: txn.date.toISOString(),
      amount_minor: amountMinor,
      currency: txn.currency,
      description: txn.description,
      capital_purpose: txn.account.capitalPurpose,
      merchant: txn.merchant ?? undefined,
      metadata_rfc: typeof metadata?.rfc === 'string' ? metadata.rfc : undefined,
    };
  }
}
