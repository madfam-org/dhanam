import { Module, forwardRef } from '@nestjs/common';

import { AuditModule } from '../../../core/audit/audit.module';
import { CryptoModule } from '../../../core/crypto/crypto.module';
import { PrismaModule } from '../../../core/prisma/prisma.module';
import { BillingModule } from '../../billing/billing.module';
import { SpacesModule } from '../../spaces/spaces.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';

import { PlaidWebhookHandler } from './plaid-webhook.handler';
import { PlaidController } from './plaid.controller';
import { PlaidService } from './plaid.service';

// Cycle: SpacesModule/BillingModule are reached transitively by
// JobsModule → ProvidersModule → PlaidModule. forwardRef defers
// resolution so the JS module-evaluation order doesn't see undefined
// references. See #414/#415/#416/#417/#418/#419 for the cascade.
@Module({
  imports: [
    PrismaModule,
    CryptoModule,
    forwardRef(() => SpacesModule),
    OrchestratorModule,
    AuditModule,
    forwardRef(() => BillingModule),
  ],
  controllers: [PlaidController],
  providers: [PlaidService, PlaidWebhookHandler],
  exports: [PlaidService],
})
export class PlaidModule {}
