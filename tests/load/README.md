# Load Testing

k6-based load tests for Dhanam API. Thresholds match the performance requirements documented in CLAUDE.md.

## Prerequisites

Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/

## Thresholds

| Scenario                       | Threshold      | Source     |
| ------------------------------ | -------------- | ---------- |
| Page loads                     | p95 < 1,500ms  | CLAUDE.md  |
| Bulk transactions (100+ items) | p95 < 2,000ms  | CLAUDE.md  |
| Manual account refresh         | p95 < 15,000ms | CLAUDE.md  |
| Error rate                     | < 1%           | SLA target |

## Running

```bash
# Baseline health check
k6 run tests/load/k6/scenarios/api-health.js

# Auth flow
k6 run tests/load/k6/scenarios/auth-flow.js

# Dashboard load simulation
k6 run -e BASE_URL=https://staging.api.dhan.am \
       -e TEST_EMAIL=loadtest@example.com \
       -e TEST_PASSWORD=LoadTest123! \
       -e TEST_SPACE_ID=<space-id> \
       tests/load/k6/scenarios/dashboard.js

# All scenarios against staging
for f in tests/load/k6/scenarios/*.js; do k6 run -e BASE_URL=https://staging.api.dhan.am "$f"; done
```

## CI

The `load-test.yml` workflow runs on manual dispatch targeting staging by default.
