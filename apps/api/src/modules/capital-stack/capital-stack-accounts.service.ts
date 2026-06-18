import { Injectable, NotFoundException } from '@nestjs/common';

import { CapitalPurpose } from '@db';

import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';

import { EntityGroupService } from './entity-group.service';

export interface BulkCapitalPurposeUpdate {
  accountId: string;
  capitalPurpose: CapitalPurpose;
}

@Injectable()
export class CapitalStackAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entityGroups: EntityGroupService,
    private readonly audit: AuditService
  ) {}

  async listForEntityGroup(entityGroupId: string, userId: string) {
    await this.entityGroups.requireAccess(entityGroupId, userId);

    return this.prisma.account.findMany({
      where: {
        space: { householdId: entityGroupId },
      },
      select: {
        id: true,
        name: true,
        type: true,
        capitalPurpose: true,
        spaceId: true,
        space: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: [{ space: { type: 'asc' } }, { name: 'asc' }],
    });
  }

  async bulkSetCapitalPurpose(
    entityGroupId: string,
    updates: BulkCapitalPurposeUpdate[],
    userId: string,
    isAdmin = false
  ) {
    await this.entityGroups.assertBeneficialOwnerOrAdmin(entityGroupId, userId, isAdmin);

    const accountIds = updates.map((u) => u.accountId);
    const accounts = await this.prisma.account.findMany({
      where: {
        id: { in: accountIds },
        space: { householdId: entityGroupId },
      },
      select: { id: true },
    });

    if (accounts.length !== accountIds.length) {
      throw new NotFoundException('One or more accounts are not in this entity group');
    }

    const results = await this.prisma.$transaction(
      updates.map((update) =>
        this.prisma.account.update({
          where: { id: update.accountId },
          data: { capitalPurpose: update.capitalPurpose },
          select: {
            id: true,
            name: true,
            capitalPurpose: true,
            spaceId: true,
          },
        })
      )
    );

    await this.audit.log({
      userId,
      action: 'CAPITAL_STACK_ACCOUNTS_CLASSIFIED',
      resource: 'household',
      resourceId: entityGroupId,
      severity: 'low',
      metadata: {
        count: results.length,
        accountIds: results.map((r) => r.id),
      },
    });

    return { updated: results.length, accounts: results };
  }
}
