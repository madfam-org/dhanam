import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../../core/prisma/prisma.module';
import { SpacesModule } from '../../spaces/spaces.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';

import { ConnectionHealthController } from './connection-health.controller';
import { ConnectionHealthService } from './connection-health.service';
import { ErrorMessagesService } from './error-messages.service';

// forwardRef per cascade #414-#419.
@Module({
  imports: [PrismaModule, OrchestratorModule, forwardRef(() => SpacesModule)],
  controllers: [ConnectionHealthController],
  providers: [ConnectionHealthService, ErrorMessagesService],
  exports: [ConnectionHealthService, ErrorMessagesService],
})
export class ConnectionHealthModule {}
