# Dhanam Public Repo Sanitization Owner Decision

Date: 2026-06-01
Current status: blocked, not sanitized

## Evidence summary

- Current-tree exact credential-signature paths: 0
- Git-history matched paths: 9
- GitHub Actions artifacts reported: 2013
- Releases page count: 1

## Required owner decisions

- Choose `history_rewrite` or `risk_acceptance_plus_revocation` for history matches.
- Choose `artifact_body_review`, `artifact_retention_cleanup`, or `artifact_risk_acceptance` for public artifacts.
- Confirm no BBVA, CLABE, payout, payment-provider, webhook, customer financial data, or production financial secret exists in public source/history/artifacts.
- Approve or reject whether Dhanam can produce `PUBLIC_GITHUB_REPO_SANITIZED` Tulana evidence.

## Recommended decision

Keep status blocked until artifact review and history disposition are complete. Prefer risk acceptance plus revocation only if every history match is confirmed synthetic/test-only.

## Artifact retention evidence update

Current-tree workflow audit found zero checked workflows using `actions/upload-artifact`, so no current workflow retention edit was applied in this pass. Existing GitHub artifact volume remains launch-blocking.

Full metadata-only artifact evidence for Dhanam is captured centrally in Tulana at `docs/evidence/public-github-artifact-full-metadata-dhanam-janua-2026-06-01.tsv`.

Owner still needs to choose artifact body review, artifact retention cleanup, or explicit time-bounded artifact risk acceptance.

## Full artifact metadata update

- Total artifacts: 2013
- Active artifacts: 1691
- Expired artifacts: 322
- Total artifact bytes: 335,981,214
- Risk-name artifacts: 251
- Active risk-name artifacts: 13
- Risk-name artifact bytes: 223,039,753

Owner review should start with active risk-name artifacts, then remaining risk-name artifacts, then release-linked artifacts.
