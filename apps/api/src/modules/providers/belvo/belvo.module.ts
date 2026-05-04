import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuditModule } from '@core/audit/audit.module';
import { CryptoModule } from '@core/crypto/crypto.module';
import { PrismaModule } from '@core/prisma/prisma.module';
import { AccountsModule } from '@modules/accounts/accounts.module';
import { BillingModule } from '@modules/billing/billing.module';
import { OrchestratorModule } from '@modules/providers/orchestrator/orchestrator.module';
import { TransactionsModule } from '@modules/transactions/transactions.module';

import { BelvoController } from './belvo.controller';
import { BelvoService } from './belvo.service';

// forwardRef per cascade #414-#419 — BillingModule reached transitively
// from JobsModule → ProvidersModule → BelvoModule.
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    CryptoModule,
    AuditModule,
    AccountsModule,
    TransactionsModule,
    OrchestratorModule,
    forwardRef(() => BillingModule),
  ],
  controllers: [BelvoController],
  providers: [BelvoService],
  exports: [BelvoService],
})
export class BelvoModule {}
