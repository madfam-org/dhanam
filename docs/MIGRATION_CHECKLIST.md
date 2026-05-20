# Dhanam Migration Checklist

> [!NOTE]
> Historical migration checklist. It preserves the Janua/domain migration
> context and may mention old `dhanam.io` hosts. For current domains and
> deployment status, read [DEPLOYMENT.md](DEPLOYMENT.md) and
> [STABILITY_WRAP_UP_2026-05-20.md](STABILITY_WRAP_UP_2026-05-20.md).

> [!IMPORTANT]
> MADFAM-ENCLII-FIRST-LEGACY-RAW v1: This document contains legacy raw infrastructure command examples.
> Routine production operations must use Enclii web, API, or CLI. Treat raw
> `kubectl`, `helm`, SSH, provider CLI/API, `docker exec`, and direct container
> access as platform bootstrap or documented break-glass only, and record any
> missing Enclii adapter gap.

> **Mission**: Migrate Dhanam to Galaxy Ecosystem with Janua OIDC + Hybrid Billing
> **Target**: Enclii K8s Cluster | **Status**: Ready for Deployment

---

## Pre-Flight Checklist

### 1. Janua OIDC Client Registration

- [ ] **Register Dhanam in Janua Admin**

  ```
  Client ID: dhanam-api
  Client Type: Confidential
  Redirect URIs:
    - https://app.dhan.am/api/auth/callback/janua
    - http://localhost:3040/api/auth/callback/janua (dev)
  Allowed Scopes: openid profile email
  Token Endpoint Auth: client_secret_basic
  ```

- [ ] **Verify OIDC Discovery**

  ```bash
  curl https://auth.madfam.io/.well-known/openid-configuration | jq .
  ```

- [ ] **Note Client Credentials**
  - OIDC_CLIENT_ID: `_______________`
  - OIDC_CLIENT_SECRET: `_______________`

---

### 2. Billing Provider Setup

#### Stripe Mexico (MX Market)

- [ ] **Create Stripe MX Account** (if not exists)
  - Dashboard: https://dashboard.stripe.com/mx

- [ ] **Generate API Keys**
  - STRIPE_MX_PUBLISHABLE_KEY: `pk_live_____________`
  - STRIPE_MX_SECRET_KEY: `sk_live_____________`

- [ ] **Configure Webhook**
  - Endpoint: `https://api.dhan.am/billing/webhooks/stripe`
  - Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.*`
  - STRIPE_MX_WEBHOOK_SECRET: `whsec_____________`

- [ ] **Enable Payment Methods**
  - [x] Card payments
  - [ ] OXXO (cash)
  - [ ] SPEI (bank transfer)

#### Paddle (Global Market)

- [ ] **Access Paddle Vendor Dashboard**
  - Dashboard: https://vendors.paddle.com

- [ ] **Note Credentials**
  - PADDLE_VENDOR_ID: `_______________`
  - PADDLE_API_KEY: `_______________`
  - PADDLE_CLIENT_TOKEN: `_______________`

- [ ] **Configure Webhook**
  - Endpoint: `https://api.dhan.am/billing/webhooks/paddle`
  - PADDLE_WEBHOOK_SECRET: `_______________`

- [ ] **Configure Products in Paddle**
  - [ ] Free tier (price_id: `_______________`)
  - [ ] Pro tier (price_id: `_______________`)
  - [ ] Enterprise tier (price_id: `_______________`)

---

### 3. Database & Infrastructure

- [ ] **Create Dhanam Database**

  ```sql
  CREATE DATABASE dhanam;
  CREATE USER dhanam_user WITH ENCRYPTED PASSWORD '<secure-password>';
  GRANT ALL PRIVILEGES ON DATABASE dhanam TO dhanam_user;
  ```

- [ ] **Note Connection String**
  - DATABASE_URL: `postgresql://dhanam_user:<password>@<host>:5432/dhanam`

- [ ] **Verify Redis Access**
  - REDIS_URL: `redis://redis.data.svc.cluster.local:6379/0`

- [ ] **Generate Encryption Key** (32 bytes hex)

  ```bash
  openssl rand -hex 32
  ```

  - ENCRYPTION_KEY: `_______________`

- [ ] **Generate NextAuth Secret**

  ```bash
  openssl rand -base64 32
  ```

  - NEXTAUTH_SECRET: `_______________`

---

### 4. Container Images

- [ ] **Build API Image**

  ```bash
  cd apps/api
  docker build -f apps/api/Dockerfile -t ghcr.io/madfam-org/dhanam/api:latest .
  docker push ghcr.io/madfam-org/dhanam/api:latest
  ```

- [ ] **Build Web Image**

  ```bash
  docker build -f apps/web/Dockerfile -t ghcr.io/madfam-org/dhanam/web:latest .
  docker push ghcr.io/madfam-org/dhanam/web:latest
  ```

- [ ] **Verify Images in Registry**
  ```bash
  docker pull ghcr.io/madfam-org/dhanam-api:latest
  docker pull ghcr.io/madfam-org/dhanam-web:latest
  ```

---

## Deployment Sequence

### Step 1: Create Namespace

```bash
kubectl apply -f infra/k8s/production/namespace.yaml
```

**Verify:**

```bash
kubectl get namespace dhanam
```

---

### Step 2: Create Secrets

```bash
# Copy template and fill in real values
cp infra/k8s/production/secrets-template.yaml infra/k8s/production/secrets.yaml

# Edit secrets.yaml with actual credentials (NEVER COMMIT THIS FILE)
vim infra/k8s/production/secrets.yaml

# Apply secrets
kubectl apply -f infra/k8s/production/secrets.yaml
```

**Verify:**

```bash
kubectl get secrets -n dhanam
# Should show: dhanam-secrets, dhanam-billing-secrets
```

---

### Step 3: Deploy API

```bash
kubectl apply -f infra/k8s/production/api-deployment.yaml
```

**Verify:**

```bash
kubectl get pods -n dhanam -l app=dhanam-api
kubectl logs -n dhanam -l app=dhanam-api --tail=50
```

**Health Check:**

```bash
kubectl port-forward -n dhanam svc/dhanam-api 4300:80
curl http://localhost:4300/health
```

---

### Step 4: Deploy Web

```bash
kubectl apply -f infra/k8s/production/web-deployment.yaml
```

**Verify:**

```bash
kubectl get pods -n dhanam -l app=dhanam-web
kubectl logs -n dhanam -l app=dhanam-web --tail=50
```

**Health Check:**

```bash
kubectl port-forward -n dhanam svc/dhanam-web 3300:80
curl http://localhost:3040/api/health
```

---

### Step 5: Configure Cloudflare Tunnel

**Option A: Add to Unified ConfigMap**

Edit `cloudflared-unified.yaml` in cloudflare-tunnel namespace:

```yaml
# Add to ingress section:
- hostname: app.dhan.am
  service: http://dhanam-web.dhanam.svc.cluster.local:80
  originRequest:
    noTLSVerify: true

- hostname: api.dhan.am
  service: http://dhanam-api.dhanam.svc.cluster.local:80
  originRequest:
    noTLSVerify: true
```

**Restart Cloudflared:**

```bash
kubectl rollout restart deployment/cloudflared -n cloudflare-tunnel
```

**Option B: Cloudflare Dashboard**

1. Navigate to Zero Trust → Networks → Tunnels
2. Select your tunnel
3. Add public hostnames for app.dhan.am and api.dhan.am

---

### Step 6: DNS Configuration

In Cloudflare Dashboard for dhanam.io:

| Type  | Name | Content                        | Proxy |
| ----- | ---- | ------------------------------ | ----- |
| CNAME | app  | `<tunnel-id>.cfargotunnel.com` | Yes   |
| CNAME | api  | `<tunnel-id>.cfargotunnel.com` | Yes   |

---

## Post-Deployment Verification

### API Health

```bash
# OIDC Discovery
curl -s https://api.dhan.am/health | jq .

# Should return:
# {
#   "status": "ok",
#   "janua": "connected",
#   "database": "connected",
#   "redis": "connected"
# }
```

### Authentication Flow

```bash
# Get a Janua token (use your preferred method)
TOKEN=$(curl -s -X POST https://auth.madfam.io/oauth/token \
  -d "grant_type=password&username=test@madfam.io&password=xxx&client_id=dhanam-api" \
  | jq -r .access_token)

# Verify token works with Dhanam API
curl -H "Authorization: Bearer $TOKEN" https://api.dhan.am/users/me
```

### Billing Webhooks

```bash
# Stripe webhook test (from Stripe Dashboard)
# Paddle webhook test (from Paddle Dashboard)
# Or use Stripe CLI:
stripe listen --forward-to https://api.dhan.am/billing/webhooks/stripe
```

### Web Application

1. Navigate to https://app.dhan.am
2. Click "Sign In with Galaxy Account"
3. Authenticate via Janua
4. Verify redirect back to Dhanam dashboard

---

## Rollback Procedures

### Emergency Rollback

```bash
# Scale down to zero
kubectl scale deployment/dhanam-api -n dhanam --replicas=0
kubectl scale deployment/dhanam-web -n dhanam --replicas=0

# Or delete entirely
kubectl delete -f infra/k8s/production/api-deployment.yaml
kubectl delete -f infra/k8s/production/web-deployment.yaml
```

### Database Rollback

```bash
# Restore from backup (adjust timestamp)
pg_restore -h <host> -U dhanam_user -d dhanam backup_YYYYMMDD.dump
```

---

## Monitoring Setup

### Prometheus Metrics

API exposes metrics at `/metrics` on port 4300:

- `dhanam_http_requests_total`
- `dhanam_billing_transactions_total`
- `dhanam_sync_duration_seconds`

### Grafana Dashboards

Import dashboards for:

- [ ] API performance (request latency, error rates)
- [ ] Billing metrics (transactions, revenue)
- [ ] User activity (signups, active users)

### Alerts

Configure alerts for:

- [ ] API error rate > 1%
- [ ] Response latency p95 > 2s
- [ ] Pod restarts > 3 in 5 minutes
- [ ] Billing webhook failures

---

## Security Checklist

- [ ] Secrets stored in K8s secrets (not environment files)
- [ ] NetworkPolicy restricts secret access to dhanam-api pods only
- [ ] TLS terminated at Cloudflare edge
- [ ] CORS configured for app.dhan.am only
- [ ] Rate limiting enabled on billing webhooks
- [ ] Audit logging enabled for billing operations
- [ ] Janua tokens validated via JWKS (not shared secret)

---

## Migration Sign-Off

| Phase                      | Status | Verified By | Date |
| -------------------------- | ------ | ----------- | ---- |
| Janua OIDC Integration     | [ ]    |             |      |
| Billing Module (Stripe MX) | [ ]    |             |      |
| Billing Module (Paddle)    | [ ]    |             |      |
| K8s Deployment             | [ ]    |             |      |
| Cloudflare Routing         | [ ]    |             |      |
| Health Checks              | [ ]    |             |      |
| Security Review            | [ ]    |             |      |

**Approved for Production:** [ ]

**Deployment Lead:** **\*\***\_\_\_**\*\***

**Date:** **\*\***\_\_\_**\*\***

---

## Quick Reference

### Endpoints

| Service | Internal                               | External    |
| ------- | -------------------------------------- | ----------- |
| API     | dhanam-api.dhanam.svc.cluster.local:80 | api.dhan.am |
| Web     | dhanam-web.dhanam.svc.cluster.local:80 | app.dhan.am |

### Ports (MADFAM Block)

| Service | Container Port | Service Port |
| ------- | -------------- | ------------ |
| API     | 4300           | 80           |
| Web     | 3300           | 80           |

### Namespaces

| Resource          | Namespace         |
| ----------------- | ----------------- |
| Dhanam workloads  | dhanam            |
| Secrets           | dhanam            |
| Cloudflare tunnel | cloudflare-tunnel |
| Shared Redis      | data              |
| Shared PostgreSQL | data              |
