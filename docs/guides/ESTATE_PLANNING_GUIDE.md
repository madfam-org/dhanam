# Estate Planning Guide

> Comprehensive digital will and testament management within Dhanam.

## Overview

Dhanam's estate planning module allows users to create, manage, and maintain digital wills with:

- **Beneficiary Designations**: Allocate assets by type and percentage
- **Executor Management**: Assign primary and backup executors
- **Will Lifecycle**: Draft, activate, revoke workflow
- **Audit Trail**: Complete logging of all will modifications

## Features

### Will Management

| Status     | Description                | Allowed Actions          |
| ---------- | -------------------------- | ------------------------ |
| `draft`    | Initial creation, editable | Update, delete, activate |
| `active`   | Currently in effect        | Revoke only              |
| `revoked`  | No longer in effect        | View only                |
| `executed` | Finalized (post-death)     | View only                |

### Beneficiary Designations

Beneficiaries are designated per asset type with percentage allocations:

```typescript
interface BeneficiaryDesignation {
  willId: string;
  beneficiaryId: string; // Household member ID
  assetType: AssetType; // CASH, INVESTMENTS, REAL_ESTATE, etc.
  assetId?: string; // Specific asset (optional)
  percentage: number; // Must sum to 100% per asset type
  conditions?: string; // Conditional inheritance
  notes?: string;
}
```

**Asset Types:**

- `CASH` - Bank accounts, liquid assets
- `INVESTMENTS` - Stocks, bonds, mutual funds
- `REAL_ESTATE` - Property, land
- `CRYPTO` - Cryptocurrency holdings
- `RETIREMENT` - 401k, IRA accounts
- `PERSONAL` - Vehicles, jewelry, other items
- `ALL` - General allocation across all assets

### Executor Assignment

```typescript
interface WillExecutor {
  willId: string;
  executorId: string; // Household member ID
  isPrimary: boolean; // Primary executor flag
  order: number; // Backup order (1, 2, 3...)
  notes?: string;
}
```

## API Endpoints

### Wills

| Method   | Endpoint                                | Description          |
| -------- | --------------------------------------- | -------------------- |
| `POST`   | `/estate-planning/wills`                | Create new will      |
| `GET`    | `/estate-planning/wills/:id`            | Get will details     |
| `GET`    | `/estate-planning/households/:id/wills` | List household wills |
| `PATCH`  | `/estate-planning/wills/:id`            | Update will          |
| `DELETE` | `/estate-planning/wills/:id`            | Delete draft will    |
| `POST`   | `/estate-planning/wills/:id/activate`   | Activate will        |
| `POST`   | `/estate-planning/wills/:id/revoke`     | Revoke active will   |

### Beneficiaries

| Method   | Endpoint                                           | Description        |
| -------- | -------------------------------------------------- | ------------------ |
| `POST`   | `/estate-planning/wills/:id/beneficiaries`         | Add beneficiary    |
| `PATCH`  | `/estate-planning/wills/:willId/beneficiaries/:id` | Update beneficiary |
| `DELETE` | `/estate-planning/wills/:willId/beneficiaries/:id` | Remove beneficiary |

### Executors

| Method   | Endpoint                                       | Description     |
| -------- | ---------------------------------------------- | --------------- |
| `POST`   | `/estate-planning/wills/:id/executors`         | Add executor    |
| `PATCH`  | `/estate-planning/wills/:willId/executors/:id` | Update executor |
| `DELETE` | `/estate-planning/wills/:willId/executors/:id` | Remove executor |

## Usage Examples

### Create a Will

```typescript
const will = await fetch('/api/estate-planning/wills', {
  method: 'POST',
  body: JSON.stringify({
    householdId: 'hh_123',
    name: 'Primary Will 2025',
    notes: 'Updated after property purchase',
    legalDisclaimer: false, // Must be true before activation
  }),
});
```

### Add Beneficiaries

```typescript
// Split investments 60/40 between children
await fetch(`/api/estate-planning/wills/${willId}/beneficiaries`, {
  method: 'POST',
  body: JSON.stringify({
    beneficiaryId: 'member_child1',
    assetType: 'INVESTMENTS',
    percentage: 60,
    notes: 'Primary beneficiary for investment accounts',
  }),
});

await fetch(`/api/estate-planning/wills/${willId}/beneficiaries`, {
  method: 'POST',
  body: JSON.stringify({
    beneficiaryId: 'member_child2',
    assetType: 'INVESTMENTS',
    percentage: 40,
  }),
});
```

### Activate Will

```typescript
// Prerequisites:
// - Legal disclaimer accepted
// - At least one beneficiary
// - At least one executor
// - Beneficiary allocations sum to 100% per asset type

await fetch(`/api/estate-planning/wills/${willId}/activate`, {
  method: 'POST',
});
// Note: This automatically revokes any other active will for the household
```

## Validation Rules

### Activation Requirements

1. **Legal Disclaimer**: Must be accepted (`legalDisclaimer: true`)
2. **Beneficiaries**: At least one beneficiary required
3. **Executors**: At least one executor required
4. **Allocation Validation**: Percentages must sum to exactly 100% per asset type

### Modification Restrictions

| Status   | Can Modify        | Can Delete |
| -------- | ----------------- | ---------- |
| draft    | Yes               | Yes        |
| active   | No (revoke first) | No         |
| revoked  | No                | No         |
| executed | No                | No         |

## Audit Logging

All estate planning operations are logged for compliance:

| Action                | Severity | Details Logged                         |
| --------------------- | -------- | -------------------------------------- |
| `WILL_CREATED`        | Medium   | Will name, household ID                |
| `WILL_UPDATED`        | Low      | Changed fields                         |
| `WILL_ACTIVATED`      | High     | Will name, household ID                |
| `WILL_REVOKED`        | High     | Will name                              |
| `WILL_DELETED`        | Medium   | Will name                              |
| `BENEFICIARY_ADDED`   | Medium   | Beneficiary ID, asset type, percentage |
| `BENEFICIARY_UPDATED` | Medium   | Changed fields                         |
| `BENEFICIARY_REMOVED` | Medium   | Beneficiary designation ID             |
| `EXECUTOR_ADDED`      | Medium   | Executor ID, primary flag              |
| `EXECUTOR_UPDATED`    | Medium   | Changed fields                         |
| `EXECUTOR_REMOVED`    | Medium   | Executor ID                            |

## Life Beat - Dead Man's Switch

Life Beat is an automated check-in system that ensures designated executors gain access to financial information if the account owner becomes incapacitated or passes away.

### How It Works

1. **Regular Check-Ins**: Owner receives periodic reminders to confirm activity
2. **Escalation Timeline**: If no check-in occurs, notifications escalate
3. **Executor Access**: After final escalation, executor gains read-only access

### Escalation Levels

| Level | Days | Action                                                  |
| ----- | ---- | ------------------------------------------------------- |
| 0     | 0    | Normal operation, check-in reminders sent               |
| 1     | 30   | Warning: Urgent check-in request + executor notified    |
| 2     | 60   | Alert: Final warning + executor receives limited access |
| 3     | 90   | Critical: Full executor access granted                  |

### Configuration

```typescript
interface LifeBeatConfig {
  enabled: boolean;
  checkInInterval: 'weekly' | 'biweekly' | 'monthly';
  escalationDays: [number, number, number]; // Default: [30, 60, 90]
  executorId: string;
  notificationChannels: ('email' | 'sms')[];
}
```

### API Endpoints

| Method | Endpoint                                      | Description               |
| ------ | --------------------------------------------- | ------------------------- |
| `GET`  | `/estate-planning/life-beat/config`           | Get current configuration |
| `PUT`  | `/estate-planning/life-beat/config`           | Update configuration      |
| `POST` | `/estate-planning/life-beat/check-in`         | Record a check-in         |
| `POST` | `/estate-planning/life-beat/emergency-access` | Grant emergency access    |

### Check-In Flow

```typescript
// Record check-in (resets escalation timer)
await fetch('/api/estate-planning/life-beat/check-in', {
  method: 'POST',
  body: JSON.stringify({
    householdId: 'hh_123',
  }),
});
```

### Executor Access Levels

| Level       | Permissions                                     |
| ----------- | ----------------------------------------------- |
| `read-only` | View accounts, balances, transactions           |
| `full`      | All read-only + download documents, export data |

### Important Considerations

1. **Legal Disclaimer**: Life Beat does not replace legal power of attorney
2. **Executor Verification**: Executors should be verified household members
3. **False Positives**: System errs on side of caution with multiple warnings
4. **Privacy**: Executor access is logged and time-limited

---

## Security Considerations

- **Access Control**: Only household members can view/modify wills
- **Audit Trail**: All changes are logged with user ID and timestamp
- **Encryption**: Sensitive notes and conditions are encrypted at rest
- **2FA Required**: Activation and revocation require 2FA verification
- **Life Beat Logging**: All check-ins and access grants are audit logged

## Legal Disclaimer

The estate planning feature is intended for **informational and organizational purposes only**. Users should:

1. Consult with a qualified estate planning attorney
2. Ensure compliance with local jurisdiction requirements
3. Understand that digital wills may not be legally binding in all regions
4. Review and update designations regularly

## Related Documentation

- [API Reference](../API.md)
- [Household Management](./HOUSEHOLD_FEATURES_GUIDE.md)
- [Security & Compliance](../ADMIN_DASHBOARD.md)

---

**Module**: `apps/api/src/modules/estate-planning/`
**Status**: Implemented; production availability follows current stability gates
**Last Updated**: 2026-05-20
