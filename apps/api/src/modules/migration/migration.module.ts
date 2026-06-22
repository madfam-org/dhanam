import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuditModule } from '@core/audit/audit.module';
import { CryptoModule } from '@core/crypto/crypto.module';
import { PrismaModule } from '@core/prisma/prisma.module';
import { JobsModule } from '@modules/jobs/jobs.module';
import { SpacesModule } from '@modules/spaces/spaces.module';

import { PlatformImportProcessor } from './jobs/platform-import.processor';
import { MigrationController } from './migration.controller';
import { PlatformImportService } from './platform-import.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    CryptoModule,
    AuditModule,
    forwardRef(() => SpacesModule),
    forwardRef(() => JobsModule),
  ],
  controllers: [MigrationController],
  providers: [PlatformImportService, PlatformImportProcessor],
  exports: [PlatformImportService],
})
export class MigrationModule {}
