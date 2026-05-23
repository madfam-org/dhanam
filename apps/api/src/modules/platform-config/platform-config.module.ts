import { Module } from '@nestjs/common';

import { AuditModule } from '@core/audit/audit.module';
import { PrismaModule } from '@core/prisma/prisma.module';

import { PlatformConfigService } from './platform-config.service';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [PlatformConfigService],
  exports: [PlatformConfigService],
})
export class PlatformConfigModule {}
