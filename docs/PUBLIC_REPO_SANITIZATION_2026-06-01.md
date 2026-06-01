# Dhanam Public Repo Sanitization Contract

Date: 2026-06-01
Status: launch-blocking for any SKU relying on Dhanam financial evidence, payments, FX, payouts, or BBVA settlement paths

## Position

Dhanam is the canonical financial source of truth. Public GitHub readiness for Dhanam must be stricter than ordinary app repos because mistakes can affect payment trust, settlement claims, BBVA payout handling, and Tulana financial evidence.

## Current remediation posture

- `apps/web/.env.production` contains only `NEXT_PUBLIC_*` build-time keys by key-name review. These are public browser-bundled constants, not server-side secrets, but the file still requires owner approval as intentionally public production config.
- Scanner-valid dummy credential strings in the identified billing test file were normalized to non-credential-shaped placeholders.
- No repo-level pass is granted until current-tree scan, history scan, public artifact review, and owner approval are recorded in Tulana.

## Launch-blocking checks

Dhanam-linked SKUs cannot pass Product/Offer GA public-repo sanitization until evidence confirms:

- No real BBVA, CLABE, payout, webhook, payment-provider, account, or customer financial data is present.
- Public examples use synthetic values only.
- `NEXT_PUBLIC_*` build-time config is intentional and approved.
- Server-only financial secrets live only in the approved runtime secret store.
- Dhanam-mediated evidence remains the only accepted financial evidence path for Tulana dashboards.

## Required Tulana evidence

Use `PUBLIC_GITHUB_REPO_SANITIZED` evidence attached to `P4`, `P8`, and `P9`; attach to `P0` when public Dhanam docs are used as buyer-facing proof.
