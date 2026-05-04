import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';

import { EnhancedEsgService } from './enhanced-esg.service';
import { EsgController } from './esg.controller';
import { EsgService } from './esg.service';

// Cycle: BillingModule → MonitoringModule → JobsModule → EsgModule
// → BillingModule. forwardRef defers BillingModule resolution so the
// graph completes; provider DI resolves once both modules are built.
// Caught in production after #417 surfaced this 5th-layer edge that
// the static scan missed (BillingModule pulls EsgModule in via the
// MonitoringModule → JobsModule chain, not directly).
@Module({
  imports: [PrismaModule, forwardRef(() => BillingModule)],
  controllers: [EsgController],
  providers: [EsgService, EnhancedEsgService],
  exports: [EsgService, EnhancedEsgService],
})
export class EsgModule {}
