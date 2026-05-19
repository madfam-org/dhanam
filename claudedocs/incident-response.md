# Incident Response Plan

## Severity Levels

### P1 - Critical

- **Definition**: Service fully unavailable, data breach, or security compromise
- **Response time**: 15 minutes
- **Examples**: Database down, authentication bypass, data exfiltration
- **Escalation**: Immediate notification to all on-call engineers + CTO

### P2 - High

- **Definition**: Major feature degraded, significant performance impact
- **Response time**: 1 hour
- **Examples**: Provider sync failures, >5% error rate, payment processing down
- **Escalation**: On-call engineer + team lead

### P3 - Medium

- **Definition**: Minor feature degraded, workaround available
- **Response time**: 4 hours
- **Examples**: Single provider down (with failover), non-critical job failures
- **Escalation**: On-call engineer

### P4 - Low

- **Definition**: Cosmetic issues, minor inconvenience
- **Response time**: Next business day
- **Examples**: UI glitches, non-critical log errors
- **Escalation**: Ticket created, normal sprint process

## Escalation Matrix

| Role             | P1        | P2  | P3  | P4       |
| ---------------- | --------- | --- | --- | -------- |
| On-call engineer | Immediate | 1h  | 4h  | Next day |
| Team lead        | 15min     | 2h  | -   | -        |
| CTO              | 30min     | 4h  | -   | -        |
| Affected users   | 1h        | 4h  | -   | -        |

## Response Procedure

### 1. Detect

- Automated alerts (Prometheus/Grafana)
- Synthetic monitoring failures
- User reports
- Audit log anomalies

### 2. Triage

- Assign severity level (P1-P4)
- Identify affected systems and users
- Create incident channel/thread

### 3. Contain

- **Data breach**: Revoke compromised credentials, disable affected accounts
- **Service outage**: Failover to backup, enable maintenance mode
- **Performance**: Scale resources, disable non-critical features
- **Security**: Block suspicious IPs, rotate affected keys

### 4. Communicate

**Internal template:**

> **Incident**: [Brief description]
> **Severity**: P[1-4]
> **Impact**: [Users/systems affected]
> **Status**: [Investigating/Identified/Mitigating/Resolved]
> **Next update**: [Time]

**External template (P1/P2):**

> We are aware of [issue description] affecting [feature]. Our team is actively working on a resolution. We will provide updates every [30min/1hr].

### 5. Resolve

- Implement fix
- Verify fix in staging
- Deploy to production
- Confirm resolution with monitoring

### 6. Post-Mortem (Required for P1/P2)

**Template:**

```
## Incident Post-Mortem: [Title]
**Date**: [Date]
**Duration**: [Start - End]
**Severity**: P[1-4]
**Author**: [Name]

### Summary
[1-2 sentence description]

### Timeline
- HH:MM - [Event]
- HH:MM - [Event]

### Root Cause
[Technical explanation]

### Impact
- Users affected: [count]
- Revenue impact: [if applicable]
- Data impact: [if applicable]

### Resolution
[What fixed it]

### Action Items
- [ ] [Preventive measure] - Owner: [Name] - Due: [Date]
- [ ] [Monitoring improvement] - Owner: [Name] - Due: [Date]

### Lessons Learned
[What we learned]
```

## Data Breach Specific

### Containment Checklist

- [ ] Identify scope of compromised data
- [ ] Revoke all active sessions for affected users
- [ ] Rotate encryption keys
- [ ] Block attack vector
- [ ] Preserve forensic evidence (logs, snapshots)

### Notification Requirements

- **Internal**: Immediate notification to security team
- **Users**: Within 72 hours per GDPR/applicable regulations
- **Regulators**: Per applicable data protection laws
- **Law enforcement**: If criminal activity suspected

### Evidence Preservation

- Export audit logs for affected time period
- Snapshot affected database tables
- Capture network logs and access logs
- Document timeline of events
