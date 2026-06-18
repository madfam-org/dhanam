import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { AuditModule } from '../../core/audit/audit.module';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { KarafielService } from '../integrations/karafiel.service';

import { CapitalFlowDetectorService } from './capital-flow-detector.service';
import { CapitalStackAccountsService } from './capital-stack-accounts.service';
import {
  CapitalStackAdminController,
  ComplianceBridgeAdminController,
} from './capital-stack-admin.controller';
import { CapitalStackTransactionHookService } from './capital-stack-transaction-hook.service';
import { CapitalStackController } from './capital-stack.controller';
import { ComplianceBridgeEventService } from './compliance-bridge-event.service';
import { EntityGroupService } from './entity-group.service';
import { InternalComplianceController } from './internal-compliance.controller';
import { KarafielCapitalBridgeService } from './karafiel-capital-bridge.service';
import { OwnerCapitalJournalService } from './owner-capital-journal.service';

@Module({
  imports: [PrismaModule, AuditModule, HttpModule],
  controllers: [
    CapitalStackController,
    CapitalStackAdminController,
    ComplianceBridgeAdminController,
    InternalComplianceController,
  ],
  providers: [
    EntityGroupService,
    OwnerCapitalJournalService,
    ComplianceBridgeEventService,
    KarafielCapitalBridgeService,
    CapitalFlowDetectorService,
    CapitalStackAccountsService,
    CapitalStackTransactionHookService,
    KarafielService,
  ],
  exports: [
    EntityGroupService,
    OwnerCapitalJournalService,
    ComplianceBridgeEventService,
    KarafielCapitalBridgeService,
    CapitalFlowDetectorService,
    CapitalStackAccountsService,
    CapitalStackTransactionHookService,
  ],
})
export class CapitalStackModule {}
