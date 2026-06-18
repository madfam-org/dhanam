import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';
import { CapitalStackModule } from '../capital-stack/capital-stack.module';
import { SpacesModule } from '../spaces/spaces.module';

import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

// forwardRef per cascade #414-#435.
@Module({
  imports: [PrismaModule, forwardRef(() => SpacesModule), forwardRef(() => CapitalStackModule)],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
