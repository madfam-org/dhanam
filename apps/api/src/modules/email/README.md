# Email Module

> Transactional email service with Handlebars templating, BullMQ queue processing, and priority-based delivery.

## Purpose

The Email module provides a robust email delivery system for all application notifications:

- **Queued delivery** via BullMQ for reliability and retry handling
- **Template-based emails** using Handlebars with partials support
- **Priority levels** for urgent vs. batch communications
- **Multiple email types** from security alerts to financial reports
- **Development-friendly** with MailHog support and graceful SMTP fallback

## Key Entities

### Email Templates

Available templates in `/templates/*.hbs`:

| Template                  | Priority | Description                        |
| ------------------------- | -------- | ---------------------------------- |
| `welcome`                 | High     | New user registration              |
| `password-reset`          | High     | Password reset request             |
| `password-changed`        | High     | Password change confirmation       |
| `two-factor-enabled`      | High     | 2FA activation notice              |
| `two-factor-disabled`     | High     | 2FA deactivation notice            |
| `login-alert`             | High     | Suspicious login notification      |
| `email-verification`      | High     | Email verification link            |
| `onboarding-complete`     | High     | Onboarding completion              |
| `budget-alert`            | Normal   | Budget threshold warning           |
| `transaction-categorized` | Low      | Batch categorization notice        |
| `sync-completed`          | Low      | Provider sync success              |
| `sync-failed`             | Normal   | Provider sync failure              |
| `weekly-summary`          | Low      | Weekly financial summary           |
| `monthly-report`          | Normal   | Monthly report with PDF attachment |

### Email Job Data Structure

```typescript
interface EmailJobData {
  to: string;
  subject: string;
  template: EmailTemplate;
  context: Record<string, any>;
  attachments?: Attachment[];
  priority: 'high' | 'normal' | 'low';
}
```

## API Endpoints

| Method | Endpoint       | Auth        | Description                               |
| ------ | -------------- | ----------- | ----------------------------------------- |
| `POST` | `/email/test`  | JWT (Admin) | Send test welcome email                   |
| `POST` | `/email/batch` | JWT (Admin) | Queue batch emails to multiple recipients |

### Example: Send Batch Emails

```bash
curl -X POST "https://api.dhan.am/email/batch" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": ["user1@example.com", "user2@example.com"],
    "subject": "Important Update",
    "template": "weekly-summary",
    "context": { "weekStart": "2025-01-20", "weekEnd": "2025-01-26" }
  }'
```

## Service Architecture

```
EmailModule
├── EmailController         # Admin endpoints for testing/batch
├── EmailService            # Core email logic
│   ├── Template loading (Handlebars)
│   ├── Queue management (BullMQ)
│   ├── Direct sending (Nodemailer)
│   └── Specific email methods
├── EmailProcessor          # BullMQ job processor
│   └── Handles 'send-email' jobs
├── JanuaEmailService       # Janua SSO integration
│   └── SSO-specific emails
└── Templates/
    ├── *.hbs              # Email templates
    └── partials/          # Reusable template components
```

### Email Delivery Flow

```
1. Service call (e.g., sendWelcomeEmail)
       │
       ▼
2. EmailService.sendEmail()
       │
       ▼
3. Job queued to BullMQ 'email' queue
       │
       ▼
4. EmailProcessor.handleSendEmail()
       │
       ▼
5. EmailService.sendEmailDirect()
       │
       ▼
6. Nodemailer sends via SMTP
```

### Priority Queue Mapping

| Priority | BullMQ Priority | Use Case                      |
| -------- | --------------- | ----------------------------- |
| `high`   | 1               | Security alerts, verification |
| `normal` | 2               | Standard notifications        |
| `low`    | 3               | Reports, batch updates        |

## Configuration

### Environment Variables

| Variable        | Description                  | Default                      |
| --------------- | ---------------------------- | ---------------------------- |
| `SMTP_HOST`     | SMTP server hostname         | None (emails skipped)        |
| `SMTP_PORT`     | SMTP server port             | `587`                        |
| `SMTP_USER`     | SMTP authentication user     | None                         |
| `SMTP_PASSWORD` | SMTP authentication password | None                         |
| `SMTP_SECURE`   | Use TLS                      | `false`                      |
| `EMAIL_FROM`    | Sender address               | `Dhanam <noreply@dhanam.io>` |
| `APP_URL`       | Application URL for links    | `https://app.dhanam.io`      |
| `SUPPORT_EMAIL` | Support contact              | `support@dhanam.io`          |

### Development Setup (MailHog)

```bash
# Start MailHog via docker-compose
pnpm dev:infra

# Configure .env
SMTP_HOST=localhost
SMTP_PORT=1025
# No auth needed for MailHog
```

View emails at `http://localhost:8025`

### Template Context

All templates receive these common variables:

```typescript
{
  appName: 'Dhanam',
  appUrl: 'https://app.dhanam.io',
  supportEmail: 'support@dhanam.io',
  year: 2025,
  // Plus template-specific context
}
```

## Related Modules

| Module       | Relationship                                |
| ------------ | ------------------------------------------- |
| `onboarding` | Triggers verification and completion emails |
| `auth`       | Triggers password reset and security emails |
| `budgets`    | Triggers budget alert emails                |
| `providers`  | Triggers sync status emails                 |
| `reports`    | Triggers weekly/monthly report emails       |
| `jobs`       | Queue integration for email processing      |

## Testing

### Unit Tests

```bash
# Run email tests
pnpm test -- --testPathPattern=email

# With coverage
pnpm test:cov -- --testPathPattern=email
```

### Test Scenarios

Located in `__tests__/`:

- Template loading and compilation
- Queue job creation with correct priorities
- Direct send with SMTP transport
- Batch email queuing
- Graceful handling when SMTP not configured

### Manual Testing

1. Ensure MailHog is running (`pnpm dev:infra`)
2. Trigger an email-generating action (registration, password reset)
3. Check MailHog UI at `http://localhost:8025`
4. Verify template rendering and content

### Queue Monitoring

```bash
# View queue stats via Redis CLI
redis-cli
> LLEN bull:email:wait
> LLEN bull:email:active
> LLEN bull:email:failed
```

---

**Module**: `email`
**Last Updated**: January 2025
