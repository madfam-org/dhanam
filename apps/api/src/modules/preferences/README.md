# Preferences Module

> User preference management for notifications, display settings, privacy, and localization.

## Purpose

The Preferences module centralizes all user-configurable settings across the Dhanam platform. It manages notification preferences (email and push), display customization (theme, layout, charts), privacy controls, financial defaults, ESG visibility options, and backup configurations. Preferences are automatically created with sensible defaults based on user locale and can be updated individually or in bulk.

## Key Entities

### UserPreferences

Comprehensive user settings record.

| Category                | Fields                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Email Notifications** | `emailNotifications`, `transactionAlerts`, `budgetAlerts`, `weeklyReports`, `monthlyReports`, `securityAlerts`, `promotionalEmails` |
| **Push Notifications**  | `pushNotifications`, `transactionPush`, `budgetPush`, `securityPush`                                                                |
| **Privacy**             | `dataSharing`, `analyticsTracking`, `personalizedAds`                                                                               |
| **Display**             | `dashboardLayout`, `chartType`, `themeMode`, `compactView`, `showBalances`                                                          |
| **Financial**           | `defaultCurrency`, `hideSensitiveData`, `autoCategorizeTxns`, `includeWeekends`                                                     |
| **ESG**                 | `esgScoreVisibility`, `sustainabilityAlerts`, `impactReporting`                                                                     |
| **Backup**              | `autoBackup`, `backupFrequency`, `exportFormat`                                                                                     |

### Default Values

| Setting                | Default      | Notes                          |
| ---------------------- | ------------ | ------------------------------ |
| `emailNotifications`   | `true`       | Master email toggle            |
| `transactionAlerts`    | `true`       | New transaction alerts         |
| `budgetAlerts`         | `true`       | Budget threshold alerts        |
| `weeklyReports`        | `true`       | Weekly summary email           |
| `monthlyReports`       | `true`       | Monthly summary email          |
| `securityAlerts`       | `true`       | Security-related notifications |
| `promotionalEmails`    | `false`      | Marketing communications       |
| `pushNotifications`    | `true`       | Master push toggle             |
| `transactionPush`      | `true`       | Transaction push alerts        |
| `budgetPush`           | `true`       | Budget push alerts             |
| `securityPush`         | `true`       | Security push alerts           |
| `dataSharing`          | `false`      | Third-party data sharing       |
| `analyticsTracking`    | `true`       | Usage analytics                |
| `personalizedAds`      | `false`      | Ad personalization             |
| `dashboardLayout`      | `standard`   | Dashboard view mode            |
| `chartType`            | `line`       | Default chart type             |
| `themeMode`            | `light`      | UI theme                       |
| `compactView`          | `false`      | Compact display mode           |
| `showBalances`         | `true`       | Balance visibility             |
| `defaultCurrency`      | Locale-based | MXN for es, USD otherwise      |
| `hideSensitiveData`    | `false`      | Mask sensitive values          |
| `autoCategorizeTxns`   | `true`       | AI categorization              |
| `includeWeekends`      | `true`       | Weekend in calculations        |
| `esgScoreVisibility`   | `true`       | Show ESG scores                |
| `sustainabilityAlerts` | `false`      | ESG change alerts              |
| `impactReporting`      | `false`      | Environmental reports          |
| `autoBackup`           | `false`      | Automatic backups              |
| `backupFrequency`      | `null`       | Backup schedule                |
| `exportFormat`         | `csv`        | Data export format             |

### Configuration Options

**Theme Modes**

- `light`
- `dark`
- `system`

**Dashboard Layouts**

- `standard`
- `compact`
- `detailed`

**Chart Types**

- `line`
- `bar`
- `pie`
- `area`

**Export Formats**

- `csv`
- `json`
- `xlsx`
- `pdf`

**Backup Frequencies**

- `daily`
- `weekly`
- `monthly`

## API Endpoints

| Method  | Endpoint               | Description                   |
| ------- | ---------------------- | ----------------------------- |
| `GET`   | `/preferences`         | Get current preferences       |
| `GET`   | `/preferences/summary` | Get preferences summary       |
| `PATCH` | `/preferences`         | Update individual preferences |
| `PUT`   | `/preferences/bulk`    | Bulk update by category       |
| `POST`  | `/preferences/reset`   | Reset to defaults             |

### Request/Response Examples

**Get Preferences**

```json
// GET /preferences
// Response
{
  "id": "uuid",
  "userId": "uuid",
  "emailNotifications": true,
  "transactionAlerts": true,
  "budgetAlerts": true,
  "weeklyReports": true,
  "monthlyReports": true,
  "securityAlerts": true,
  "promotionalEmails": false,
  "pushNotifications": true,
  "transactionPush": true,
  "budgetPush": true,
  "securityPush": true,
  "dataSharing": false,
  "analyticsTracking": true,
  "personalizedAds": false,
  "dashboardLayout": "standard",
  "chartType": "line",
  "themeMode": "dark",
  "compactView": false,
  "showBalances": true,
  "defaultCurrency": "MXN",
  "hideSensitiveData": false,
  "autoCategorizeTxns": true,
  "includeWeekends": true,
  "esgScoreVisibility": true,
  "sustainabilityAlerts": false,
  "impactReporting": false,
  "autoBackup": false,
  "backupFrequency": null,
  "exportFormat": "csv",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-25T00:00:00Z"
}
```

**Update Individual Preferences**

```json
// PATCH /preferences
{
  "themeMode": "dark",
  "compactView": true,
  "defaultCurrency": "USD"
}
```

**Bulk Update by Category**

```json
// PUT /preferences/bulk
{
  "notifications": {
    "emailNotifications": true,
    "transactionAlerts": true,
    "promotionalEmails": false
  },
  "display": {
    "themeMode": "dark",
    "dashboardLayout": "compact"
  },
  "privacy": {
    "dataSharing": false,
    "analyticsTracking": true
  }
}
```

**Preferences Summary**

```json
// GET /preferences/summary
{
  "totalSettings": 29,
  "categories": {
    "notifications": 11,
    "privacy": 3,
    "display": 5,
    "financial": 4,
    "esg": 3,
    "backup": 3
  },
  "lastUpdated": "2025-01-25T00:00:00Z",
  "customizations": 5
}
```

## Service Architecture

```
PreferencesController
       │
       ▼
  PreferencesService
       │
       ├──► PrismaService (database operations)
       │
       └──► AuditService (change logging)
```

### Key Service Methods

- **getUserPreferences()**: Fetch or create default preferences
- **updateUserPreferences()**: Partial update with change tracking
- **bulkUpdatePreferences()**: Category-based batch updates
- **resetPreferences()**: Delete and recreate with defaults
- **getPreferencesSummary()**: Statistics and customization count

## Data Flow

### Preference Retrieval

```
1. Fetch UserPreferences by userId
2. If not found:
   a. Get user locale/timezone
   b. Determine default currency from locale
   c. Create UserPreferences with defaults
3. Map to response DTO
4. Return preferences
```

### Preference Update

```
1. Ensure preferences exist (create if needed)
2. Fetch previous preferences for comparison
3. Apply updates to record
4. Calculate changed fields
5. If changes detected:
   a. Log audit event with before/after
6. Return updated preferences
```

### Bulk Update

```
1. Ensure preferences exist
2. Fetch previous state
3. Flatten category structure:
   - notifications.* -> root level
   - privacy.* -> root level
   - display.* -> root level
   - financial.* -> root level
   - esg.* -> root level
   - backup.* -> root level
4. Apply flattened updates
5. Log audit with category breakdown
6. Return updated preferences
```

### Reset Flow

```
1. Fetch user to get locale/timezone
2. Delete existing preferences (if any)
3. Create fresh defaults based on locale
4. Log reset audit event
5. Return new defaults
```

### Customization Count

```
1. Get current preferences
2. Get default preference values
3. Compare each field
4. Count differences
5. Return customization count
```

## Error Handling

| Error               | Status | Condition      |
| ------------------- | ------ | -------------- |
| `NotFoundException` | 404    | User not found |

### Error Messages

- "User not found" - Invalid user ID during reset

## Related Modules

| Module          | Relationship                              |
| --------------- | ----------------------------------------- |
| `users`         | Preferences belong to users               |
| `notifications` | Preferences control notification delivery |
| `alerts`        | Alert settings reference preferences      |
| `dashboard`     | Layout/display preferences                |
| `transactions`  | Auto-categorization preference            |
| `esg`           | ESG visibility preferences                |
| `backup`        | Backup schedule preferences               |

## Testing

### Test Location

```
apps/api/src/modules/preferences/
  preferences.service.spec.ts
```

### Test Coverage Areas

- Preference creation with defaults
- Individual preference updates
- Bulk category updates
- Reset functionality
- Locale-based default currency
- Change tracking
- Customization counting
- Summary generation
- Audit logging

### Running Tests

```bash
# Unit tests
pnpm test -- preferences

# With coverage
pnpm test:cov -- preferences
```

### Test Scenarios

- New user gets locale-appropriate defaults
- Update single preference
- Update multiple preferences
- Bulk update specific categories
- Reset returns to defaults
- Count customizations accurately
- Track changes in audit log

---

**Module**: `preferences`
**Last Updated**: January 2025
