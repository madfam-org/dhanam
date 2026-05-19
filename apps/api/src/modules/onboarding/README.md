# Onboarding Module

> Guides new users through account setup with step-by-step progress tracking, email verification, and provider connection wizards.

## Purpose

The Onboarding module manages the complete new user experience, from initial registration through first budget creation. It provides:

- **Step-based progression** with dependency validation
- **Email verification** using JWT tokens
- **User preference configuration** (locale, timezone, currency, notifications)
- **Analytics tracking** via PostHog for funnel analysis
- **Provider connection wizard** integration for financial account linking

## Key Entities

### Onboarding Steps

The module defines 7 ordered steps with dependencies:

| Step                 | Order | Required | Dependencies  |
| -------------------- | ----- | -------- | ------------- |
| `welcome`            | 1     | Yes      | None          |
| `email_verification` | 2     | Yes      | None          |
| `preferences`        | 3     | Yes      | None          |
| `space_setup`        | 4     | Yes      | `preferences` |
| `connect_accounts`   | 5     | No       | `space_setup` |
| `first_budget`       | 6     | No       | `space_setup` |
| `feature_tour`       | 7     | No       | None          |

### DTOs

- **UpdateOnboardingStepDto** - Advance to a specific step with optional metadata
- **CompleteOnboardingDto** - Mark onboarding as finished (optional step skip flag)
- **UpdatePreferencesDto** - Set locale, timezone, currency, notification preferences
- **VerifyEmailDto** - Token-based email verification
- **OnboardingStatusDto** - Current progress snapshot with completion percentage

## API Endpoints

| Method | Endpoint                          | Auth   | Description                                     |
| ------ | --------------------------------- | ------ | ----------------------------------------------- |
| `GET`  | `/onboarding/status`              | JWT    | Get current onboarding progress and step status |
| `PUT`  | `/onboarding/step`                | JWT    | Update/advance current step                     |
| `POST` | `/onboarding/complete`            | JWT    | Mark onboarding as completed                    |
| `PUT`  | `/onboarding/preferences`         | JWT    | Update user preferences during onboarding       |
| `POST` | `/onboarding/verify-email`        | Public | Verify email with JWT token                     |
| `POST` | `/onboarding/resend-verification` | JWT    | Request new verification email                  |
| `POST` | `/onboarding/skip/:step`          | JWT    | Skip optional step (only non-required steps)    |
| `POST` | `/onboarding/reset`               | JWT    | Reset onboarding progress (support/testing)     |
| `GET`  | `/onboarding/health`              | Public | Service health check                            |

### Example: Get Onboarding Status

```bash
curl -X GET "https://api.dhan.am/onboarding/status" \
  -H "Authorization: Bearer <token>"
```

**Response:**

```json
{
  "completed": false,
  "currentStep": "preferences",
  "completedAt": null,
  "progress": 43,
  "stepStatus": {
    "welcome": true,
    "email_verification": true,
    "preferences": false,
    "space_setup": false,
    "connect_accounts": false,
    "first_budget": false,
    "feature_tour": false
  },
  "remainingSteps": ["preferences", "space_setup"],
  "optionalSteps": ["connect_accounts", "first_budget", "feature_tour"]
}
```

## Service Architecture

```
OnboardingModule
├── OnboardingController    # REST endpoints
├── OnboardingService       # Core business logic
│   ├── Step progression management
│   ├── Dependency validation
│   ├── Email verification (JWT-based)
│   └── Preferences synchronization
├── OnboardingAnalytics     # PostHog event tracking
│   ├── Funnel metrics
│   ├── Step completion times
│   └── Abandonment tracking
└── Dependencies
    ├── EmailService        # Verification emails
    ├── PreferencesService  # User settings
    ├── AuditService        # Action logging
    └── JwtService          # Token generation
```

### Analytics Events

The module tracks these PostHog events:

- `onboarding_started` - User begins onboarding
- `onboarding_step_completed` - Step finished with time spent
- `onboarding_step_skipped` - Optional step bypassed
- `onboarding_completed` - Full flow finished
- `onboarding_abandoned` - User exits before completion
- `email_verification_sent` - Verification email dispatched
- `email_verification_completed` - Email confirmed
- `onboarding_preferences_set` - Preferences saved
- `onboarding_provider_connection` - Financial account linked

## Configuration

### Environment Variables

| Variable     | Description                         | Default  |
| ------------ | ----------------------------------- | -------- |
| `JWT_SECRET` | Secret for verification tokens      | Required |
| `WEB_URL`    | Frontend URL for verification links | Required |

### Email Templates

The module triggers these email templates via EmailService:

- `email-verification` - Verification link email
- `onboarding-complete` - Welcome/completion email

## Related Modules

| Module        | Relationship                                |
| ------------- | ------------------------------------------- |
| `email`       | Sends verification and completion emails    |
| `preferences` | Stores and retrieves user settings          |
| `spaces`      | Creates initial personal space during setup |
| `providers`   | Handles financial account connections       |
| `auth`        | JWT authentication and user context         |
| `analytics`   | PostHog event tracking                      |
| `audit`       | Logs all onboarding actions                 |

## Testing

### Unit Tests

```bash
# Run onboarding tests
pnpm test -- --testPathPattern=onboarding

# With coverage
pnpm test:cov -- --testPathPattern=onboarding
```

### Test Coverage

The module includes comprehensive tests in `onboarding.service.spec.ts`:

- Step progression with dependency validation
- Email verification token generation and validation
- Preference updates across user and space entities
- Skip functionality for optional steps
- Reset functionality for support scenarios
- Analytics event emission verification

### Manual Testing

1. Create a new user via `/auth/register`
2. Check initial status at `/onboarding/status`
3. Verify email using token from inbox
4. Update preferences at `/onboarding/preferences`
5. Complete remaining steps or skip optional ones
6. Confirm completion at `/onboarding/complete`

---

**Module**: `onboarding`
**Last Updated**: January 2025
