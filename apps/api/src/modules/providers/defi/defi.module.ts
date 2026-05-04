import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../../core/prisma/prisma.module';
import { RedisModule } from '../../../core/redis/redis.module';
import { BillingModule } from '../../billing/billing.module';
import { SpacesModule } from '../../spaces/spaces.module';

import { DeFiController } from './defi.controller';
import { DeFiService } from './defi.service';
import { ZapperService } from './zapper.service';

// forwardRef per cascade #414-#419 — DeFiService also @Inject(forwardRef)
// SpacesService at the constructor since it's actively injected.
@Module({
  imports: [
    ConfigModule,
    RedisModule,
    PrismaModule,
    forwardRef(() => SpacesModule),
    forwardRef(() => BillingModule),
  ],
  controllers: [DeFiController],
  providers: [ZapperService, DeFiService],
  exports: [ZapperService, DeFiService],
})
export class DeFiModule {}
