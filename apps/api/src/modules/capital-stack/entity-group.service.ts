import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';

import { HouseholdType } from '@db';

import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';

export interface CreateEntityGroupInput {
  name: string;
  beneficialOwnerUserId: string;
  operatorUserId: string;
  personalSpaceId: string;
  businessSpaceId: string;
  legalName: string;
  taxId: string;
  ownershipPercent?: number;
  baseCurrency?: 'MXN' | 'USD' | 'EUR' | 'CAD';
}

@Injectable()
export class EntityGroupService {
  private readonly logger = new Logger(EntityGroupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async listForUser(userId: string) {
    return this.prisma.household.findMany({
      where: {
        type: HouseholdType.owner_operator,
        OR: [
          { beneficialOwnerUserId: userId },
          { members: { some: { userId } } },
          {
            spaces: {
              some: {
                userSpaces: { some: { userId } },
              },
            },
          },
        ],
      },
      include: {
        spaces: {
          select: { id: true, name: true, type: true },
        },
        beneficialOwner: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDashboard(entityGroupId: string, userId: string) {
    const group = await this.requireAccess(entityGroupId, userId);

    const [journalCounts, unreconciled, facilityAccounts] = await Promise.all([
      this.prisma.ownerCapitalJournal.groupBy({
        by: ['status'],
        where: { entityGroupId },
        _count: { _all: true },
      }),
      this.prisma.ownerCapitalJournal.count({
        where: {
          entityGroupId,
          status: { in: ['proposed', 'manual_review', 'draft'] },
        },
      }),
      this.prisma.account.count({
        where: {
          capitalPurpose: 'owner_facility',
          space: { householdId: entityGroupId },
        },
      }),
    ]);

    const statusMap = Object.fromEntries(journalCounts.map((row) => [row.status, row._count._all]));

    return {
      entityGroup: group,
      metrics: {
        journalByStatus: statusMap,
        unreconciledFlows: unreconciled,
        ownerFacilityAccountCount: facilityAccounts,
      },
    };
  }

  async createEntityGroup(input: CreateEntityGroupInput, actorUserId: string) {
    const ownershipPercent = input.ownershipPercent ?? 100;

    const result = await this.prisma.$transaction(async (tx) => {
      const household = await tx.household.create({
        data: {
          name: input.name,
          type: HouseholdType.owner_operator,
          baseCurrency: input.baseCurrency ?? 'MXN',
          beneficialOwnerUserId: input.beneficialOwnerUserId,
          members: {
            create: [
              { userId: input.beneficialOwnerUserId, relationship: 'other' },
              { userId: input.operatorUserId, relationship: 'other' },
            ],
          },
        },
      });

      await tx.space.updateMany({
        where: { id: { in: [input.personalSpaceId, input.businessSpaceId] } },
        data: { householdId: household.id },
      });

      const binding = await tx.spaceOperatorBinding.create({
        data: {
          spaceId: input.businessSpaceId,
          operatorUserId: input.operatorUserId,
          beneficialOwnerUserId: input.beneficialOwnerUserId,
          legalName: input.legalName,
          taxId: input.taxId,
          ownershipPercent,
        },
      });

      const existingAccess = await tx.userSpace.findUnique({
        where: {
          userId_spaceId: {
            userId: input.beneficialOwnerUserId,
            spaceId: input.businessSpaceId,
          },
        },
      });

      if (!existingAccess) {
        await tx.userSpace.create({
          data: {
            userId: input.beneficialOwnerUserId,
            spaceId: input.businessSpaceId,
            role: 'admin',
          },
        });
      }

      return { household, binding };
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'CAPITAL_STACK_ENTITY_GROUP_CREATED',
      resource: 'household',
      resourceId: result.household.id,
      severity: 'medium',
      metadata: {
        beneficialOwnerUserId: input.beneficialOwnerUserId,
        businessSpaceId: input.businessSpaceId,
      },
    });

    this.logger.log(`Entity group created: ${result.household.id}`);
    return result;
  }

  async requireAccess(entityGroupId: string, userId: string) {
    const group = await this.prisma.household.findFirst({
      where: {
        id: entityGroupId,
        type: HouseholdType.owner_operator,
        OR: [
          { beneficialOwnerUserId: userId },
          { members: { some: { userId } } },
          {
            spaces: {
              some: { userSpaces: { some: { userId } } },
            },
          },
        ],
      },
      include: {
        spaces: { select: { id: true, name: true, type: true } },
        beneficialOwner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!group) {
      throw new NotFoundException('Entity group not found');
    }

    return group;
  }

  async assertBeneficialOwnerOrAdmin(entityGroupId: string, userId: string, isAdmin: boolean) {
    const group = await this.requireAccess(entityGroupId, userId);
    if (!isAdmin && group.beneficialOwnerUserId !== userId) {
      throw new ForbiddenException('Beneficial owner or platform admin required');
    }
    return group;
  }
}
