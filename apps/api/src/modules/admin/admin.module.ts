import { Module } from '@nestjs/common';

import { AuditModule } from '@core/audit/audit.module';
import { LoggerModule } from '@core/logger/logger.module';
import { PrismaModule } from '@core/prisma/prisma.module';
import { RedisModule } from '@core/redis/redis.module';
import { BillingModule } from '@modules/billing/billing.module';
import { JobsModule } from '@modules/jobs/jobs.module';

import { AdminOpsService } from './admin-ops.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [PrismaModule, LoggerModule, RedisModule, AuditModule, JobsModule, BillingModule],
  controllers: [AdminController],
  providers: [AdminService, AdminOpsService, AdminGuard],
  exports: [AdminService, AdminOpsService, AdminGuard],
})
export class AdminModule {}
