# Testing Documentation

Last updated: 2026-05-22

## Current (operational)

| Document                                                         | Use                              |
| ---------------------------------------------------------------- | -------------------------------- |
| [TEST_SUMMARY.md](TEST_SUMMARY.md)                               | Test layers and how to run them  |
| [TEST_RESULTS.md](TEST_RESULTS.md)                               | Latest verification snapshot     |
| [API Test Coverage Guide](../../apps/api/TEST_COVERAGE_GUIDE.md) | API Jest, chaos, DB-backed tests |

## Historical session reports

Moved to [reports/historical/testing/](../reports/historical/testing/) — preserved
for context; may reference stale counts or infrastructure.

## Link checker

```bash
python3 scripts/check-doc-links.py --primary
python3 scripts/check-doc-links.py --all-docs
```
