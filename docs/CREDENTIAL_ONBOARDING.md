# Credential Onboarding Runbook

> [!IMPORTANT]
> MADFAM-ENCLII-FIRST-LEGACY-RAW v1: This document contains legacy raw infrastructure command examples.
> Routine production operations must use Enclii web, API, or CLI. Treat raw
> `kubectl`, `helm`, SSH, provider CLI/API, `docker exec`, and direct container
> access as platform bootstrap or documented break-glass only, and record any
> missing Enclii adapter gap.

Step-by-step instructions for activating each external provider in Dhanam. Each provider follows the same general pattern:

1. Obtain credentials from the provider dashboard
2. Apply credentials to the appropriate K8s secret
3. The service constructor auto-detects real credentials and initializes
4. Configure webhooks (if applicable)
5. Verify via health check

---

## Stripe MX (Billing)

**Dashboard**: https://dashboard.stripe.com

**Required Env Vars**:
| Variable | Source | Description |
|----------|--------|-------------|
| `STRIPE_MX_SECRET_KEY` | API Keys | `sk_live_...` or `sk_test_...` |
| `STRIPE_MX_PUBLISHABLE_KEY` | API Keys | `pk_live_...` or `pk_test_...` |
| `STRIPE_MX_WEBHOOK_SECRET` | Webhooks > Signing secret | `whsec_...` |
| `STRIPE_ESSENTIALS_PRICE_ID` | Products | `price_...` |
| `STRIPE_PREMIUM_PRICE_ID` | Products | `price_...` |
| `STRIPE_PRO_PLAN_PRICE_ID` | Products | `price_...` (optional) |
| `STRIPE_PREMIUM_PLAN_PRICE_ID` | Products | `price_...` (optional) |
| `STRIPE_INTRO_COUPON_ID` | Coupons | Introductory offer coupon (optional) |

**K8s Secret**: `dhanam-billing-secrets`

**Constructor**: `apps/api/src/modules/billing/billing.service.ts:177-215`

- Auto-detects placeholder values (containing `placeholder`, starting with `your_`)
- In production: sets `billingDisabled = true` on placeholder detection
- In development: logs warnings

**Webhook Endpoint**: `POST /v1/billing/webhooks/stripe`

**Steps**:

```bash
# 1. Get credentials from Stripe Dashboard
# 2. Update K8s secret
kubectl -n dhanam create secret generic dhanam-billing-secrets \
  --from-literal=STRIPE_MX_SECRET_KEY=sk_live_... \
  --from-literal=STRIPE_MX_PUBLISHABLE_KEY=pk_live_... \
  --from-literal=STRIPE_MX_WEBHOOK_SECRET=whsec_... \
  --from-literal=STRIPE_ESSENTIALS_PRICE_ID=price_... \
  --from-literal=STRIPE_PREMIUM_PRICE_ID=price_... \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Configure webhook in Stripe Dashboard:
#    URL: https://api.dhan.am/v1/billing/webhooks/stripe
#    Events: checkout.session.completed, customer.subscription.*, invoice.*

# 4. Restart API deployment
kubectl -n dhanam rollout restart deployment dhanam-api

# 5. Verify
curl -s https://api.dhan.am/v1/billing/plans | jq '.plans | length'
# Should return > 0
```

---

## Belvo (MX Banking)

**Dashboard**: https://dashboard.belvo.com

**Required Env Vars**:
| Variable | Source | Description |
|----------|--------|-------------|
| `BELVO_SECRET_KEY_ID` | API Keys | Secret Key ID |
| `BELVO_SECRET_KEY_PASSWORD` | API Keys | Secret Key Password |
| `BELVO_ENVIRONMENT` | N/A | `sandbox` or `production` |
| `BELVO_WEBHOOK_SECRET` | Webhooks | Webhook verification secret |

**K8s Secret**: `dhanam-provider-secrets`

**Constructor**: `apps/api/src/modules/providers/belvo/belvo.service.ts:32-50`

- Auto-initializes `belvoClient` when both `BELVO_SECRET_KEY_ID` and `BELVO_SECRET_KEY_PASSWORD` are present

**Webhook Endpoint**: `POST /v1/providers/belvo/webhooks`

**Steps**:

```bash
# 1. Get credentials from Belvo Dashboard > API Keys
# 2. Update K8s secret
kubectl -n dhanam get secret dhanam-provider-secrets -o yaml > /tmp/provider-secrets.yaml
# Edit to add BELVO_* keys, then apply
kubectl apply -f /tmp/provider-secrets.yaml && rm /tmp/provider-secrets.yaml

# 3. Configure webhook in Belvo Dashboard:
#    URL: https://api.dhan.am/v1/providers/belvo/webhooks

# 4. Restart API
kubectl -n dhanam rollout restart deployment dhanam-api

# 5. Verify
curl -s https://api.dhan.am/health/full | jq '.providers.belvo'
# Should show: "configured"
```

---

## Plaid (US Banking)

**Dashboard**: https://dashboard.plaid.com

**Required Env Vars**:
| Variable | Source | Description |
|----------|--------|-------------|
| `PLAID_CLIENT_ID` | Keys | Client ID |
| `PLAID_SECRET` | Keys | Secret (sandbox/development/production) |
| `PLAID_ENVIRONMENT` | N/A | `sandbox`, `development`, or `production` |
| `PLAID_WEBHOOK_SECRET` | Webhooks | Webhook verification secret |

**K8s Secret**: `dhanam-provider-secrets`

**Constructor**: `apps/api/src/modules/providers/plaid/plaid.service.ts` (constructor)

**Webhook Endpoint**: `POST /v1/providers/plaid/webhooks`

**Steps**:

```bash
# 1. Get credentials from Plaid Dashboard > Keys
# 2. Add to dhanam-provider-secrets (same pattern as Belvo)
# 3. Configure webhook: https://api.dhan.am/v1/providers/plaid/webhooks
# 4. Restart: kubectl -n dhanam rollout restart deployment dhanam-api
# 5. Verify: curl -s https://api.dhan.am/health/full | jq '.providers.plaid'
```

---

## Bitso (Crypto Exchange)

**Dashboard**: https://bitso.com/api-setup

**Required Env Vars**:
| Variable | Source | Description |
|----------|--------|-------------|
| `BITSO_API_KEY` | API Setup | API Key |
| `BITSO_API_SECRET` | API Setup | API Secret |

**K8s Secret**: `dhanam-provider-secrets`

**Constructor**: `apps/api/src/modules/providers/bitso/bitso.service.ts` (constructor)

**Webhook Endpoint**: `POST /v1/providers/bitso/webhooks`

**Steps**:

```bash
# 1. Get credentials from Bitso > API Setup
# 2. Add to dhanam-provider-secrets
# 3. Configure webhook: https://api.dhan.am/v1/providers/bitso/webhooks
# 4. Restart: kubectl -n dhanam rollout restart deployment dhanam-api
# 5. Verify: curl -s https://api.dhan.am/health/full | jq '.providers.bitso'
```

---

## Paddle (Billing - International)

**Dashboard**: https://vendors.paddle.com

**Required Env Vars**:
| Variable | Source | Description |
|----------|--------|-------------|
| `PADDLE_VENDOR_ID` | Developer Tools > Authentication | Vendor ID |
| `PADDLE_API_KEY` | Developer Tools > Authentication | API Key |
| `PADDLE_CLIENT_TOKEN` | Developer Tools > Client-side Tokens | Client token |
| `PADDLE_WEBHOOK_SECRET` | Notifications > Webhook destinations | Webhook secret |
| `PADDLE_ENVIRONMENT` | N/A | `sandbox` or `live` |

**K8s Secret**: `dhanam-billing-secrets`

**Webhook Endpoint**: `POST /v1/billing/webhooks/paddle`

**Steps**:

```bash
# 1. Get credentials from Paddle Dashboard
# 2. Add to dhanam-billing-secrets
# 3. Configure webhook: https://api.dhan.am/v1/billing/webhooks/paddle
# 4. Restart: kubectl -n dhanam rollout restart deployment dhanam-api
# 5. Verify: curl -s https://api.dhan.am/health/full | jq '.billing.paddle'
```

---

## Zapper (DeFi)

**Dashboard**: https://zapper.xyz/developers

**Required Env Vars**:
| Variable | Source | Description |
|----------|--------|-------------|
| `ZAPPER_API_KEY` | Developer Portal | API Key |

**K8s Secret**: `dhanam-provider-secrets`

**Webhook**: N/A (polling-based)

**Steps**:

```bash
# 1. Get API key from Zapper Developer Portal
# 2. Add to dhanam-provider-secrets
# 3. Restart: kubectl -n dhanam rollout restart deployment dhanam-api
# 4. Verify: curl -s https://api.dhan.am/health/full | jq '.providers.zapper'
```

---

## Zillow (Real Estate)

**Dashboard**: https://www.zillow.com/howto/api/APIOverview.htm

**Required Env Vars**:
| Variable | Source | Description |
|----------|--------|-------------|
| `ZILLOW_API_KEY` | Developer Portal | API Key |

**K8s Secret**: `dhanam-provider-secrets`

**Webhook**: N/A (on-demand valuation lookups)

**Steps**:

```bash
# 1. Get API key from Zillow
# 2. Add to dhanam-provider-secrets
# 3. Restart: kubectl -n dhanam rollout restart deployment dhanam-api
# 4. Verify: curl -s https://api.dhan.am/health/full | jq '.providers.zillow'
```

---

## Janua (Authentication SSO)

**Dashboard**: https://api.janua.dev (MADFAM internal)

**Required Env Vars**:
| Variable | Source | Description |
|----------|--------|-------------|
| `JANUA_API_URL` | N/A | `https://api.janua.dev` |
| `JANUA_INTERNAL_API_KEY` | Janua Admin Panel | Internal API key |
| `JANUA_JWKS_URI` | N/A | `https://auth.madfam.io/.well-known/jwks.json` |
| `JANUA_ISSUER` | N/A | `https://auth.madfam.io` |
| `JANUA_AUDIENCE` | N/A | `dhanam-api` |
| `JANUA_WEBHOOK_SECRET` | Janua Admin Panel | Webhook verification secret |
| `DHANAM_WEBHOOK_SECRET` | Self-generated | Secret for outbound webhooks |

**K8s Secret**: `dhanam-janua-secrets`

**Webhook Endpoint**: `POST /v1/billing/webhooks/janua`

**Steps**:

```bash
# 1. Obtain keys from MADFAM's Janua admin panel
# 2. Create/update K8s secret
kubectl -n dhanam create secret generic dhanam-janua-secrets \
  --from-literal=JANUA_API_URL=https://api.janua.dev \
  --from-literal=JANUA_INTERNAL_API_KEY=... \
  --from-literal=JANUA_WEBHOOK_SECRET=... \
  --from-literal=DHANAM_WEBHOOK_SECRET=... \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Set AUTH_MODE=janua in API env
# 4. Restart: kubectl -n dhanam rollout restart deployment dhanam-api
# 5. Verify: SSO login at https://app.dhan.am/login
```

---

## Verification Checklist

After activating any provider, verify the full health check:

```bash
curl -s https://api.dhan.am/health/full | jq '.'
```

Each activated provider should show as `configured` or `connected`. Update `TECH_DEBT.md` TD-004 status as providers are activated.

## K8s Secret Summary

| Secret Name               | Providers                                 |
| ------------------------- | ----------------------------------------- |
| `dhanam-billing-secrets`  | Stripe MX, Paddle                         |
| `dhanam-provider-secrets` | Belvo, Plaid, Bitso, Zapper, Zillow       |
| `dhanam-janua-secrets`    | Janua SSO                                 |
| `dhanam-secrets`          | JWT, database, Redis, general app secrets |
