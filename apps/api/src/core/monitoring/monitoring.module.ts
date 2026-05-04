import { Module, Global, forwardRef } from '@nestjs/common';

import { PrismaModule } from '@core/prisma/prisma.module';
import { JobsModule } from '@modules/jobs/jobs.module';

import { DeploymentMonitorService } from './deployment-monitor.service';
import { HealthService } from './health.service';
import { MetricsService } from './metrics.service';
import { MonitoringController } from './monitoring.controller';
import { SentryService } from './sentry.service';

// forwardRef on the JobsModule edge breaks every remaining circular
// dependency chain in dhanam-api. All 16 unbroken cycles in the module
// graph (verified 2026-05-04) close through:
//
//   BillingModule → MonitoringModule → JobsModule → ... → BillingModule
//
// JobsModule is registered before MonitoringModule in app.module.ts, so
// Nest tries to construct JobsModule first. JobsModule pulls in raw
// transitive deps (EsgModule, ProvidersModule and their providers) that
// reach BillingModule, which pulls MonitoringModule, which would re-enter
// JobsModule mid-construction → UndefinedModuleException at imports-array
// literal evaluation. forwardRef defers the JobsModule reference until
// after both modules are constructed.
//
// Companion forwardRefs already in place: BillingModule → EmailModule
// (#414), CategoriesModule → SpacesModule (#415), JobsModule →
// {SpacesModule, CategoriesModule, AnalyticsModule, MlModule} (#416).
@Global()
@Module({
  imports: [PrismaModule, forwardRef(() => JobsModule)],
  controllers: [MonitoringController],
  providers: [
    HealthService,
    MetricsService,
    SentryService,
    DeploymentMonitorService,
    {
      provide: 'SentryService',
      useExisting: SentryService,
    },
  ],
  exports: [HealthService, MetricsService, SentryService, DeploymentMonitorService],
})
export class MonitoringModule {}
