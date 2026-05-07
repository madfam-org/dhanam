export type EmailTemplate =
  | 'welcome'
  | 'email-verification'
  | 'onboarding-complete'
  | 'password-reset'
  | 'password-changed'
  | 'two-factor-enabled'
  | 'two-factor-disabled'
  | 'login-alert'
  | 'budget-alert'
  | 'transaction-categorized'
  | 'sync-completed'
  | 'sync-failed'
  | 'weekly-summary'
  | 'monthly-report'
  | 'investor-report'
  | 'drip-day-1-connect'
  | 'drip-day-3-budget'
  | 'drip-day-7-summary'
  | 'drip-day-14-trial'
  | 'drip-reengagement-day-7'
  | 'drip-reengagement-day-14';

export interface EmailJobData {
  to: string;
  subject: string;
  template: EmailTemplate;
  context: Record<string, any>;
  attachments?: EmailAttachment[];
  priority: 'high' | 'normal' | 'low';
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  template: EmailTemplate;
  context: Record<string, any>;
  attachments?: EmailAttachment[];
  priority?: 'high' | 'normal' | 'low';
  delay?: number; // Delay in milliseconds
}
