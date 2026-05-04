import { Module, forwardRef } from '@nestjs/common';

import { AuditModule } from '@core/audit/audit.module';
import { CoreModule } from '@core/core.module';
import { SpacesModule } from '@modules/spaces/spaces.module';

import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';

// forwardRef per cascade #414-#419.
@Module({
  imports: [CoreModule, AuditModule, forwardRef(() => SpacesModule)],
  providers: [BlockchainService],
  controllers: [BlockchainController],
  exports: [BlockchainService],
})
export class BlockchainModule {}
