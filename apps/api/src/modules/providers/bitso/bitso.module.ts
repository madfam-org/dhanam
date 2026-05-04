import { Module, forwardRef } from '@nestjs/common';

import { CryptoModule } from '../../../core/crypto/crypto.module';
import { PrismaModule } from '../../../core/prisma/prisma.module';
import { BillingModule } from '../../billing/billing.module';
import { SpacesModule } from '../../spaces/spaces.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';

import { BitsoController } from './bitso.controller';
import { BitsoService } from './bitso.service';

// forwardRef per cascade #414-#419 — SpacesModule/BillingModule reached
// transitively from JobsModule → ProvidersModule → BitsoModule.
@Module({
  imports: [
    PrismaModule,
    CryptoModule,
    forwardRef(() => SpacesModule),
    OrchestratorModule,
    forwardRef(() => BillingModule),
  ],
  controllers: [BitsoController],
  providers: [BitsoService],
  exports: [BitsoService],
})
export class BitsoModule {}
