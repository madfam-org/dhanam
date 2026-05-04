import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { CryptoModule } from '@core/crypto/crypto.module';
import { PrismaModule } from '@core/prisma/prisma.module';
import { AnalyticsModule } from '@modules/analytics/analytics.module';
import { CategoriesModule } from '@modules/categories/categories.module';
import { EsgModule } from '@modules/esg/esg.module';
import { MlModule } from '@modules/ml/ml.module';
import { ProvidersModule } from '@modules/providers/providers.module';
import { SpacesModule } from '@modules/spaces/spaces.module';

import { EnhancedJobsService } from './enhanced-jobs.service';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { CategorizeTransactionsProcessor } from './processors/categorize-transactions.processor';
import { ConnectionHealthCheckProcessor } from './processors/connection-health-check.processor';
import { ESGUpdateProcessor } from './processors/esg-update.processor';
import { InactivityMonitorProcessor } from './processors/inactivity-monitor.processor';
import { MLRetrainProcessor } from './processors/ml-retrain.processor';
import { ScheduledReportProcessor } from './processors/scheduled-report.processor';
import { SyncTransactionsProcessor } from './processors/sync-transactions.processor';
import { ValuationSnapshotProcessor } from './processors/valuation-snapshot.processor';
import { QueueService } from './queue.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    CryptoModule,
    // forwardRef on the SpacesModule edge breaks the cycle:
    // JobsModule → SpacesModule → BillingModule → MonitoringModule → JobsModule.
    // CategoriesModule transitively imports SpacesModule (also via forwardRef
    // per #415), but JobsModule imports CategoriesModule directly — so wrap
    // both edges that lead to SpacesModule for safety. Existing forwardRefs
    // on AnalyticsModule + MlModule were anticipated; SpacesModule wasn't.
    forwardRef(() => CategoriesModule),
    forwardRef(() => SpacesModule),
    EsgModule,
    ProvidersModule,
    forwardRef(() => AnalyticsModule),
    forwardRef(() => MlModule),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    EnhancedJobsService,
    QueueService,
    SyncTransactionsProcessor,
    CategorizeTransactionsProcessor,
    ESGUpdateProcessor,
    ValuationSnapshotProcessor,
    ScheduledReportProcessor,
    MLRetrainProcessor,
    ConnectionHealthCheckProcessor,
    InactivityMonitorProcessor,
  ],
  exports: [JobsService, EnhancedJobsService, QueueService],
})
export class JobsModule {}
