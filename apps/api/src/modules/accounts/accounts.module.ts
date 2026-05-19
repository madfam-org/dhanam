import { Module, forwardRef } from '@nestjs/common';

import { LoggerModule } from '@core/logger/logger.module';
import { PrismaModule } from '@core/prisma/prisma.module';

import { BelvoModule } from '../providers/belvo/belvo.module';
import { BitsoModule } from '../providers/bitso/bitso.module';
import { PlaidModule } from '../providers/plaid/plaid.module';
import { SpacesModule } from '../spaces/spaces.module';

import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

// forwardRef per cascade #414-#435 — AccountsModule reached via
// JobsModule → ProvidersModule → BelvoModule → AccountsModule.
@Module({
  imports: [
    forwardRef(() => SpacesModule),
    PrismaModule,
    LoggerModule,
    PlaidModule,
    BitsoModule,
    forwardRef(() => BelvoModule),
  ],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
