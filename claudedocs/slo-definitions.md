# Service Level Objectives (SLOs)

## API Performance

| Metric          | Target   | Measurement                       |
| --------------- | -------- | --------------------------------- |
| Availability    | 99.9%    | Uptime over 30-day rolling window |
| API p95 latency | < 500ms  | 95th percentile response time     |
| API p99 latency | < 1500ms | 99th percentile response time     |
| Error rate      | < 0.1%   | 5xx responses / total responses   |

## Web Application

| Metric            | Target  | Measurement                   |
| ----------------- | ------- | ----------------------------- |
| Page load (LCP)   | < 1.5s  | Largest Contentful Paint, p95 |
| First Input Delay | < 100ms | FID, p95                      |
| CLS               | < 0.1   | Cumulative Layout Shift, p75  |

## Data Operations

| Metric                   | Target      | Measurement              |
| ------------------------ | ----------- | ------------------------ |
| Manual account refresh   | < 15s       | End-to-end provider sync |
| Bulk transactions (100+) | < 2s        | p95 processing time      |
| Background sync          | Every 60min | BullMQ scheduled job     |

## Reliability

| Metric               | Target   | Notes                    |
| -------------------- | -------- | ------------------------ |
| RTO (Recovery Time)  | 4 hours  | Time to restore service  |
| RPO (Recovery Point) | 24 hours | Maximum data loss window |
| Backup frequency     | Daily    | Automated pg_dump        |
| Backup retention     | 30 days  | Rolling window           |

## Security

| Metric               | Target                     | Notes                   |
| -------------------- | -------------------------- | ----------------------- |
| Auth failure lockout | 5 attempts / 15min         | Per-IP rate limiting    |
| Session duration     | 15min access / 30d refresh | JWT + rotating refresh  |
| Key rotation         | 90 days                    | Encryption key rotation |
| Vulnerability scan   | Weekly                     | Trivy + CodeQL in CI    |

## Monitoring & Alerting

| Alert         | Threshold          | Severity |
| ------------- | ------------------ | -------- |
| Error rate    | > 1% for 5min      | Critical |
| p95 latency   | > 1.5s for 5min    | Warning  |
| Backup age    | > 25 hours         | Critical |
| Auth failures | > 10/sec for 15min | Warning  |
| Database down | 1 minute           | Critical |
| Redis down    | 1 minute           | Critical |
