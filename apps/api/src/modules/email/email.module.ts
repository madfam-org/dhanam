import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '@core/prisma/prisma.module';
import { AnalyticsModule } from '@modules/analytics/analytics.module';

import { EmailController } from './email.controller';
import { EmailProcessor } from './email.processor';
import { EmailService } from './email.service';
import { InvestorReportsController } from './investor-reports.controller';
import { JanuaEmailService } from './janua-email.service';
import { DripCampaignTask } from './tasks/drip-campaign.task';
import { MonthlyReportTask } from './tasks/monthly-report.task';
import { WeeklySummaryTask } from './tasks/weekly-summary.task';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AnalyticsModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),
    BullModule.registerQueue({
      name: 'email',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 1000,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
  ],
  controllers: [EmailController, InvestorReportsController],
  providers: [
    EmailService,
    JanuaEmailService,
    EmailProcessor,
    WeeklySummaryTask,
    MonthlyReportTask,
    DripCampaignTask,
  ],
  exports: [EmailService, JanuaEmailService],
})
export class EmailModule {}
