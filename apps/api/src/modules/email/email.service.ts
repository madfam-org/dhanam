import * as fs from 'fs/promises';
import * as path from 'path';

import { TIME_UNITS } from '@dhanam/shared';
import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import * as handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';

import { PrismaService } from '../../core/prisma/prisma.service';

import { EmailJobData, EmailTemplate, EmailOptions } from './types';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private templates = new Map<EmailTemplate, handlebars.TemplateDelegate>();
  private readonly templatesDir = path.join(__dirname, 'templates');

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @InjectQueue('email') private readonly emailQueue: Queue<EmailJobData>
  ) {
    this.initializeTransporter();
    this.loadTemplates();
  }

  private initializeTransporter() {
    const smtpHost = this.configService.get('SMTP_HOST');

    // Skip SMTP configuration when SMTP is not configured
    if (!smtpHost) {
      this.logger.warn('Email transporter not configured - SMTP_HOST not set');
      return;
    }

    const smtpUser = this.configService.get('SMTP_USER');
    const smtpPassword = this.configService.get('SMTP_PASSWORD');

    const smtpConfig: Record<string, any> = {
      host: smtpHost,
      port: this.configService.get('SMTP_PORT', 587),
      secure: this.configService.get('SMTP_SECURE', false),
    };

    // Only add auth if credentials are provided (skip for MailHog/dev environments)
    if (smtpUser && smtpPassword) {
      smtpConfig.auth = {
        user: smtpUser,
        pass: smtpPassword,
      };
    }

    this.transporter = nodemailer.createTransport(smtpConfig);

    // Verify connection - don't block on verification failure
    this.transporter.verify((error) => {
      if (error) {
        this.logger.warn(
          'Email transporter verification failed - emails may not be delivered:',
          error.message
        );
        // Don't throw - allow service to continue, emails will fail at send time
      } else {
        this.logger.log('Email transporter ready');
      }
    });
  }

  private async loadTemplates() {
    const templates: EmailTemplate[] = [
      'welcome',
      'password-reset',
      'password-changed',
      'two-factor-enabled',
      'two-factor-disabled',
      'login-alert',
      'budget-alert',
      'transaction-categorized',
      'sync-completed',
      'sync-failed',
      'weekly-summary',
      'monthly-report',
      'investor-report',
      'onboarding-complete',
      'email-verification',
      'drip-day-1-connect',
      'drip-day-3-budget',
      'drip-day-7-summary',
      'drip-day-14-trial',
      'drip-reengagement-day-7',
      'drip-reengagement-day-14',
    ];

    for (const template of templates) {
      try {
        const htmlPath = path.join(this.templatesDir, `${template}.hbs`);
        const htmlContent = await fs.readFile(htmlPath, 'utf-8');
        this.templates.set(template, handlebars.compile(htmlContent));

        // Register partials
        await this.registerPartials();
      } catch (error) {
        this.logger.warn(`Failed to load template ${template}:`, error);
      }
    }
  }

  private async registerPartials() {
    // Register custom helpers for template conditionals
    handlebars.registerHelper('eq', (a: any, b: any) => a === b);

    const partialsDir = path.join(this.templatesDir, 'partials');
    try {
      const files = await fs.readdir(partialsDir);

      for (const file of files) {
        if (file.endsWith('.hbs')) {
          const name = path.basename(file, '.hbs');
          const content = await fs.readFile(path.join(partialsDir, file), 'utf-8');
          handlebars.registerPartial(name, content);
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load partials:', error);
    }
  }

  // Queue email for sending
  async sendEmail(options: EmailOptions): Promise<void> {
    const jobData: EmailJobData = {
      to: options.to,
      subject: options.subject,
      template: options.template,
      context: options.context,
      attachments: options.attachments,
      priority: options.priority || 'normal',
    };

    const jobOptions = {
      priority: options.priority === 'high' ? 1 : options.priority === 'low' ? 3 : 2,
      delay: options.delay,
    };

    await this.emailQueue.add('send-email', jobData, jobOptions);
    this.logger.log(`Email queued for ${options.to} with template ${options.template}`);
  }

  // Send email immediately (used by processor)
  async sendEmailDirect(data: EmailJobData): Promise<void> {
    // Skip if transporter is not configured (SMTP_HOST not set)
    if (!this.transporter) {
      this.logger.log(`[SKIP] Email to ${data.to} skipped - no SMTP configured`);
      return;
    }

    try {
      const template = this.templates.get(data.template);
      if (!template) {
        throw new Error(`Template ${data.template} not found`);
      }

      // Add common context
      const context = {
        ...data.context,
        appName: 'Dhanam',
        appUrl: this.configService.get('APP_URL', 'https://app.dhanam.io'),
        supportEmail: this.configService.get('SUPPORT_EMAIL', 'support@dhanam.io'),
        year: new Date().getFullYear(),
      };

      const html = template(context);

      const mailOptions: nodemailer.SendMailOptions = {
        from: this.configService.get('EMAIL_FROM', 'Dhanam <noreply@dhanam.io>'),
        to: data.to,
        subject: data.subject,
        html,
        attachments: data.attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${data.to}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${data.to}:`, error);
      throw error;
    }
  }

  // Specific email methods
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Welcome to Dhanam!',
      template: 'welcome',
      context: { name },
      priority: 'high',
    });
  }

  async sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.configService.get('APP_URL')}/reset-password?token=${resetToken}`;

    await this.sendEmail({
      to: email,
      subject: 'Reset Your Password',
      template: 'password-reset',
      context: { name, resetUrl },
      priority: 'high',
    });
  }

  async sendPasswordChangedEmail(email: string, name: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Password Changed Successfully',
      template: 'password-changed',
      context: { name, changedAt: new Date().toLocaleString() },
      priority: 'high',
    });
  }

  async sendTwoFactorEnabledEmail(email: string, name: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Two-Factor Authentication Enabled',
      template: 'two-factor-enabled',
      context: { name },
      priority: 'high',
    });
  }

  async sendLoginAlertEmail(email: string, name: string, loginInfo: any): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'New Login to Your Account',
      template: 'login-alert',
      context: {
        name,
        ...loginInfo,
        loginTime: new Date().toLocaleString(),
      },
      priority: 'high',
    });
  }

  async sendBudgetAlertEmail(
    email: string,
    name: string,
    budgetName: string,
    percentage: number,
    spent: number,
    limit: number,
    currency: string
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: `Budget Alert: ${budgetName} at ${percentage}%`,
      template: 'budget-alert',
      context: {
        name,
        budgetName,
        percentage,
        spent,
        limit,
        currency,
        remaining: limit - spent,
      },
      priority: 'normal',
    });
  }

  async sendTransactionCategorizedEmail(
    email: string,
    name: string,
    transactions: any[]
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: `${transactions.length} Transactions Categorized`,
      template: 'transaction-categorized',
      context: {
        name,
        transactions,
        count: transactions.length,
      },
      priority: 'low',
    });
  }

  async sendSyncCompletedEmail(
    email: string,
    name: string,
    provider: string,
    accountsUpdated: number,
    transactionsAdded: number
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: `${provider} Sync Completed`,
      template: 'sync-completed',
      context: {
        name,
        provider,
        accountsUpdated,
        transactionsAdded,
        syncTime: new Date().toLocaleString(),
      },
      priority: 'low',
    });
  }

  async sendSyncFailedEmail(
    email: string,
    name: string,
    provider: string,
    error: string
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: `${provider} Sync Failed`,
      template: 'sync-failed',
      context: {
        name,
        provider,
        error,
        failedAt: new Date().toLocaleString(),
      },
      priority: 'normal',
    });
  }

  async sendWeeklySummaryEmail(email: string, name: string, summaryData: any): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Your Weekly Financial Summary',
      template: 'weekly-summary',
      context: {
        name,
        ...summaryData,
      },
      priority: 'low',
      delay: 0, // Send immediately when generated
    });
  }

  async sendMonthlyReportEmail(
    email: string,
    name: string,
    reportData: any,
    pdfBuffer?: Buffer
  ): Promise<void> {
    const attachments = pdfBuffer
      ? [
          {
            filename: `dhanam-report-${new Date().toISOString().slice(0, 7)}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ]
      : undefined;

    await this.sendEmail({
      to: email,
      subject: 'Your Monthly Financial Report',
      template: 'monthly-report',
      context: {
        name,
        ...reportData,
      },
      attachments,
      priority: 'normal',
    });
  }

  // Batch email sending
  async sendBatchEmails(
    recipients: string[],
    subject: string,
    template: EmailTemplate,
    context: Record<string, any>
  ): Promise<void> {
    const jobs = recipients.map((to) => ({
      name: 'send-email',
      data: {
        to,
        subject,
        template,
        context,
        priority: 'low',
      } as EmailJobData,
    }));

    await this.emailQueue.addBulk(jobs);
    this.logger.log(`Queued ${recipients.length} batch emails`);
  }

  // New onboarding-specific email methods

  async sendEmailVerification(
    userId: string,
    data: {
      verificationToken: string;
      verificationUrl: string;
    }
  ): Promise<void> {
    // Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    await this.sendEmail({
      to: user.email,
      subject: 'Verifica tu email - Dhanam',
      template: 'email-verification',
      context: {
        userName: user.name,
        verificationUrl: data.verificationUrl,
      },
      priority: 'high',
    });

    this.logger.log(`Email verification sent to ${user.email}`);
  }

  async sendOnboardingComplete(
    userId: string,
    data: {
      skipOptional: boolean;
      completedAt: string;
      metadata: Record<string, any>;
    }
  ): Promise<void> {
    // Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate completion time if available
    const completionTime = data.metadata.timeSpent
      ? this.formatDuration(data.metadata.timeSpent)
      : 'N/A';

    const stepsCompleted = data.metadata.stepsCompleted || '7';
    const dashboardUrl = `${this.configService.get('WEB_URL')}/dashboard`;

    await this.sendEmail({
      to: user.email,
      subject: '🎉 ¡Tu cuenta de Dhanam está lista! - Configuración completada',
      template: 'onboarding-complete',
      context: {
        userName: user.name,
        completionTime,
        stepsCompleted,
        dashboardUrl,
        skipOptional: data.skipOptional,
      },
      priority: 'high',
    });

    this.logger.log(`Onboarding completion email sent to ${user.email}`);
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < TIME_UNITS.HOUR_SECONDS) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / TIME_UNITS.HOUR_SECONDS);
      const minutes = Math.floor((seconds % TIME_UNITS.HOUR_SECONDS) / 60);
      return `${hours}h ${minutes}m`;
    }
  }
}
