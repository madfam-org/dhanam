import { Module } from '@nestjs/common';

import { AuditModule } from '@core/audit/audit.module';
import { LoggerModule } from '@core/logger/logger.module';
import { PrismaModule } from '@core/prisma/prisma.module';
import { RedisModule } from '@core/redis/redis.module';
import { BillingModule } from '@modules/billing/billing.module';
import { JobsModule } from '@modules/jobs/jobs.module';
import { PlatformConfigModule } from '@modules/platform-config/platform-config.module';

import { AdminOpsService } from './admin-ops.service';
import { AdminPosBillingService } from './admin-pos-billing.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [
    PrismaModule,
    LoggerModule,
    RedisModule,
    AuditModule,
    JobsModule,
    BillingModule,
    PlatformConfigModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminOpsService, AdminPosBillingService, AdminGuard],
  exports: [AdminService, AdminOpsService, AdminPosBillingService, AdminGuard],
})
export class AdminModule {}
