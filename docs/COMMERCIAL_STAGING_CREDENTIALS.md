# Commercial Staging Credentials (G2)

> **Note:** Vault path names below are structural references only. Live secret
> values and full checklists belong in Enclii Lockbox and
> `madfam-org/internal-devops` — see
> [Public Repo Security Remediation](PUBLIC_REPO_SECURITY_REMEDIATION.md).

Last updated: 2026-05-22

Operator checklist for **commercial GA staging** on `enclii-dhanam-staging`.
Never commit filled secrets; use Enclii/Lockbox/Vault/ESO only.

## Secret groups

| K8s Secret               | Vault path (staging)            | Commercial keys                                 |
| ------------------------ | ------------------------------- | ----------------------------------------------- |
| `dhanam-secrets`         | `secret/dhanam/staging`         | `DHANAM_WEBHOOK_SECRET`, `PRODUCT_WEBHOOK_URLS` |
| `dhanam-billing-secrets` | `secret/dhanam/staging/billing` | Stripe MX, Paddle, Conekta, Phynd               |
| `dhanam-janua-secrets`   | `secret/dhanam/staging/janua`   | Janua (identity only; billing stays off)        |

Template: [`infra/k8s/staging-secrets-template.yaml`](../infra/k8s/staging-secrets-template.yaml)

## Vendor test credentials (required for G2 soak)

### Stripe Mexico (primary MX POS + checkout)

| Key                         | Format        | Source                                                                    |
| --------------------------- | ------------- | ------------------------------------------------------------------------- |
| `STRIPE_MX_SECRET_KEY`      | `sk_test_...` | Stripe Dashboard → Mexico entity → Test mode                              |
| `STRIPE_MX_PUBLISHABLE_KEY` | `pk_test_...` | Same                                                                      |
| `STRIPE_MX_WEBHOOK_SECRET`  | `whsec_...`   | Webhook endpoint `https://staging-api.dhan.am/v1/billing/webhooks/stripe` |

Staging env pins `FEATURE_STRIPE_MXN_LIVE=false` (test mode only).

### Paddle (global checkout)

| Key                     | Format            | Source                   |
| ----------------------- | ----------------- | ------------------------ |
| `PADDLE_VENDOR_ID`      | sandbox vendor id | Paddle sandbox dashboard |
| `PADDLE_API_KEY`        | sandbox API key   | Same                     |
| `PADDLE_CLIENT_TOKEN`   | client-side token | Same                     |
| `PADDLE_WEBHOOK_SECRET` | webhook secret    | Same                     |

Staging env: `PADDLE_ENVIRONMENT=sandbox`.

### Conekta (LATAM direct POS — Scope B / staging parity)

| Key                           | Format         | Source                                                            |
| ----------------------------- | -------------- | ----------------------------------------------------------------- |
| `CONEKTA_PRIVATE_KEY`         | `key_test_...` | [Conekta panel](https://panel.conekta.com) sandbox                |
| `CONEKTA_PUBLIC_KEY`          | `key_test_...` | Same                                                              |
| `CONEKTA_WEBHOOK_SIGNING_KEY` | signing key    | Webhook `https://staging-api.dhan.am/v1/billing/webhooks/conekta` |

Used when Stripe MX is unavailable or operator selects Conekta on `/pos`.

### Karafiel CFDI fan-out (WS2 proof)

| Key                     | Where            | Notes                                                             |
| ----------------------- | ---------------- | ----------------------------------------------------------------- |
| `PRODUCT_WEBHOOK_URLS`  | `dhanam-secrets` | `karafiel:https://staging-api.karafiel.io/api/v1/webhooks/dhanam` |
| `DHANAM_WEBHOOK_SECRET` | `dhanam-secrets` | Must match Karafiel staging `DHANAM_BILLING_WEBHOOK_SECRET`       |

POS timeline shows `cfdiUuid` when Karafiel returns it in the webhook response body.

### PhyndCRM engagement relay (optional)

| Key                              | Notes                                               |
| -------------------------------- | --------------------------------------------------- |
| `PHYND_ENGAGEMENT_EVENTS_SECRET` | Match PhyndCRM staging                              |
| `PHYNDCRM_API_URL`               | Set in env-patch to `https://staging-crm.madfam.io` |

## GitHub Actions (commercial smoke)

| Name                                | Type     | Purpose                                 |
| ----------------------------------- | -------- | --------------------------------------- |
| `STAGING_COMMERCIAL_ADMIN_TOKEN`    | Secret   | Platform-admin JWT                      |
| `STAGING_COMMERCIAL_SMOKE_USER_ID`  | Secret   | Existing staging user id                |
| `STAGING_COMMERCIAL_CHARGE_ENABLED` | Variable | `true` when Stripe test keys work       |
| `STAGING_COMMERCIAL_STRICT`         | Variable | `true` to fail CI without admin secrets |

## Verification commands

```bash
# Public + admin tier (local)
STAGING_API_URL=https://staging-api.dhan.am \
  STAGING_COMMERCIAL_ADMIN_TOKEN='…' \
  STAGING_COMMERCIAL_SMOKE_USER_ID='…' \
  STAGING_COMMERCIAL_CHARGE_ENABLED=true \
  ./scripts/staging-commercial-smoke.sh

# Syntax / CI wrapper
bash scripts/staging-commercial-smoke.test.sh
```

## Related

- [Commercial GA Execution](COMMERCIAL_GA_EXECUTION.md)
- [Commercial DLQ Drill runbook](runbooks/COMMERCIAL_DLQ_DRILL.md)
