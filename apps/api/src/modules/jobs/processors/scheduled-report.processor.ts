import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

import { PrismaService } from '@core/prisma/prisma.service';
import { ReportService } from '@modules/analytics/report.service';

import { QueueService } from '../queue.service';

export interface ScheduledReportConfig {
  id: string;
  userId: string;
  spaceId: string;
  frequency: 'weekly' | 'monthly';
  format: 'pdf' | 'excel' | 'csv';
  recipients: string[];
  enabled: boolean;
  lastSentAt?: Date;
  nextRunAt?: Date;
}

/**
 * Processor for scheduled report generation and delivery
 * Runs on a schedule to check for reports that need to be sent
 */
@Injectable()
export class ScheduledReportProcessor implements OnModuleInit {
  private readonly logger = new Logger(ScheduledReportProcessor.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportService: ReportService,
    private readonly queueService: QueueService
  ) {}

  async onModuleInit() {
    this.logger.log('Scheduled Report Processor initialized');
  }

  /**
   * Check for weekly reports every Monday at 8:00 AM
   */
  @Cron('0 8 * * 1')
  async processWeeklyReports() {
    if (this.isProcessing) {
      this.logger.warn('Skipping weekly reports - previous job still running');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      this.logger.log('Processing weekly scheduled reports...');

      // Get users with weekly report preferences enabled
      const usersWithWeeklyReports = await this.prisma.userPreferences.findMany({
        where: {
          weeklyReports: true,
        },
        include: {
          user: {
            include: {
              userSpaces: {
                include: {
                  space: true,
                },
              },
            },
          },
        },
      });

      let reportsGenerated = 0;

      for (const prefs of usersWithWeeklyReports) {
        const user = prefs.user;
        if (!user.isActive) continue;

        // Generate report for each space the user belongs to
        for (const userSpace of user.userSpaces) {
          try {
            const lastWeekStart = startOfWeek(subWeeks(new Date(), 1));
            const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1));

            await this.generateAndSendReport({
              userId: user.id,
              spaceId: userSpace.spaceId,
              spaceName: userSpace.space.name,
              email: user.email,
              format: prefs.exportFormat as 'pdf' | 'excel' | 'csv',
              startDate: lastWeekStart,
              endDate: lastWeekEnd,
              reportType: 'weekly',
            });

            reportsGenerated++;
          } catch (error) {
            this.logger.error(
              `Failed to generate weekly report for user ${user.id}, space ${userSpace.spaceId}:`,
              error
            );
          }
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      this.logger.log(
        `Weekly reports complete: ${reportsGenerated} reports in ${duration.toFixed(2)}s`
      );
    } catch (error) {
      this.logger.error('Error processing weekly reports:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check for monthly reports on the 1st of each month at 8:00 AM
   */
  @Cron('0 8 1 * *')
  async processMonthlyReports() {
    if (this.isProcessing) {
      this.logger.warn('Skipping monthly reports - previous job still running');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      this.logger.log('Processing monthly scheduled reports...');

      // Get users with monthly report preferences enabled
      const usersWithMonthlyReports = await this.prisma.userPreferences.findMany({
        where: {
          monthlyReports: true,
        },
        include: {
          user: {
            include: {
              userSpaces: {
                include: {
                  space: true,
                },
              },
            },
          },
        },
      });

      let reportsGenerated = 0;

      for (const prefs of usersWithMonthlyReports) {
        const user = prefs.user;
        if (!user.isActive) continue;

        // Generate report for each space the user belongs to
        for (const userSpace of user.userSpaces) {
          try {
            const lastMonthStart = startOfMonth(subMonths(new Date(), 1));
            const lastMonthEnd = endOfMonth(subMonths(new Date(), 1));

            await this.generateAndSendReport({
              userId: user.id,
              spaceId: userSpace.spaceId,
              spaceName: userSpace.space.name,
              email: user.email,
              format: prefs.exportFormat as 'pdf' | 'excel' | 'csv',
              startDate: lastMonthStart,
              endDate: lastMonthEnd,
              reportType: 'monthly',
            });

            reportsGenerated++;
          } catch (error) {
            this.logger.error(
              `Failed to generate monthly report for user ${user.id}, space ${userSpace.spaceId}:`,
              error
            );
          }
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      this.logger.log(
        `Monthly reports complete: ${reportsGenerated} reports in ${duration.toFixed(2)}s`
      );
    } catch (error) {
      this.logger.error('Error processing monthly reports:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Generate and send a report
   */
  private async generateAndSendReport(config: {
    userId: string;
    spaceId: string;
    spaceName: string;
    email: string;
    format: 'pdf' | 'excel' | 'csv';
    startDate: Date;
    endDate: Date;
    reportType: 'weekly' | 'monthly';
  }): Promise<void> {
    const { spaceId, email, format, startDate, endDate, reportType, spaceName } = config;

    this.logger.log(`Generating ${reportType} ${format} report for ${email}`);

    let reportBuffer: Buffer;
    let contentType: string;
    let filename: string;

    // Generate report based on format
    switch (format) {
      case 'pdf':
        reportBuffer = await this.reportService.generatePdfReport(spaceId, startDate, endDate);
        contentType = 'application/pdf';
        filename = `dhanam-${reportType}-report-${startDate.toISOString().split('T')[0]}.pdf`;
        break;

      case 'excel':
        reportBuffer = await this.reportService.generateExcelExport(spaceId, startDate, endDate);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `dhanam-${reportType}-report-${startDate.toISOString().split('T')[0]}.xlsx`;
        break;

      case 'csv': {
        const csvContent = await this.reportService.generateCsvExport(spaceId, startDate, endDate);
        reportBuffer = Buffer.from(csvContent, 'utf-8');
        contentType = 'text/csv';
        filename = `dhanam-${reportType}-report-${startDate.toISOString().split('T')[0]}.csv`;
        break;
      }

      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Queue email with attachment
    await this.queueService.addEmailJob({
      to: email,
      template: `scheduled-${reportType}-report`,
      data: {
        spaceName,
        reportType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        attachment: {
          filename,
          content: reportBuffer.toString('base64'),
          contentType,
        },
      },
    });

    this.logger.log(`Queued ${reportType} report email to ${email}`);
  }

  /**
   * Manual trigger for generating a report (for on-demand use)
   */
  async triggerReport(
    spaceId: string,
    userId: string,
    email: string,
    format: 'pdf' | 'excel' | 'csv',
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
    });

    if (!space) {
      throw new Error('Space not found');
    }

    await this.generateAndSendReport({
      userId,
      spaceId,
      spaceName: space.name,
      email,
      format,
      startDate,
      endDate,
      reportType: 'monthly', // Use monthly template for on-demand reports
    });
  }
}
