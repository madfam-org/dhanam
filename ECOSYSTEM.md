# dhanam — Ecosystem Context

> [!IMPORTANT]
> Dhanam is the billing, payment, entitlement, and financial-data backbone for the ecosystem. Treat bank/provider payloads, transactions, subscriptions, invoices, entitlements, documents, estate-planning records, webhooks, and package-publish/deploy operations as sensitive and side-effectful. Keep examples placeholder-only. This is the financial-data side-effect doctrine for ecosystem context.

> [!IMPORTANT]
> MADFAM-ENCLII-FIRST-LEGACY-RAW v1: This document contains legacy raw infrastructure command examples.
> Routine production operations must use Enclii web, API, or CLI. Treat raw
> `kubectl`, `helm`, SSH, provider CLI/API, `docker exec`, and direct container
> access as platform bootstrap or documented break-glass only, and record any
> missing Enclii adapter gap.

> **MADFAM's billing + payment-gateway platform — multi-tenant, LATAM-first, ESG crypto insights.**

This file is self-contained: a Claude session on a fresh machine can operate
this service by reading only this one document. No external links are
load-bearing — the MADFAM ecosystem map and the full enclii CLI reference are
embedded below.

---

## 1. What this repo is

Dhanam is the ecosystem's billing backbone: catalog-backed checkout, Stripe
subscription fallback, Stripe MX/SPEI relay, Paddle/Stripe MX router
foundation, Janua billing integration, entitlement and credit metering,
subscription management, product-webhook fan-out, and customer portals. Every
paid feature across the MADFAM ecosystem should flow through Dhanam, but the
full internal MADFAM POS is still being completed. Dhanam also runs the ESG
crypto insight module and wealth-tracking features for end users. It ships a
public-facing web app, an API, and an admin console.

**Pillar**: Financial / Billing
**Type**: service
**Status**: production

### Deployed services

| Service        | Public domain        | Production container port |
| -------------- | -------------------- | ------------------------- |
| `dhanam-web`   | dhan.am, app.dhan.am | 4200                      |
| `dhanam-api`   | api.dhan.am          | 4300                      |
| `dhanam-admin` | admin.dhan.am        | 3400                      |

Current runtime status: production public routes and full API health are green
per `docs/STABILITY_WRAP_UP_2026-05-20.md`. Staging smoke is green, but live
staging digest proof remains best-effort/manual until the Enclii proof adapter
exists. Treat `docs/ROADMAP.md` and `docs/TECH_DEBT.md` as the current
operational status records.

**Kubernetes namespace**: `dhanam`
**Cluster**: bare-metal k3s on Hetzner (see topology section below).

### Upstream dependencies (this repo consumes)

- postgres (customers, invoices, credits, entitlements)
- janua (auth, multi-tenant)
- payment gateways: Stripe, Stripe MX/SPEI, Paddle, Janua billing, Conekta
  direct foundation
- belvo (bank-account insights)
- karafiel (CFDI emission for Mexican invoices)

### Downstream consumers (this repo is consumed by)

- every ecosystem repo with paid tiers (webhooks route to downstream services)
- tezca, avala, forgesight, cotiza, karafiel, phynd-crm — all receive billing webhooks for tier up/downgrades

### Key environment variables

- `DATABASE_URL — Postgres`
- `JANUA_JWKS_URI — auth`
- `STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET`
- `MERCADOPAGO_ACCESS_TOKEN / CONEKTA_PRIVATE_KEY / BELVO_SECRET_ID`
- `DHANAM_WEBHOOK_SECRET — HMAC signing for outbound webhooks to downstream services`

---

## MADFAM Ecosystem Map

MADFAM runs ~40 services on sovereign bare-metal infrastructure. Everything
below is embedded here so this document stands alone.

### The platforms every repo should know about

| Platform        | Repo                          | Role                                                                                               |
| --------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| **Enclii**      | `madfam-org/enclii`           | PaaS control plane — all deploys go through this                                                   |
| **Janua**       | `madfam-org/janua`            | OIDC/OAuth 2.0 provider — RS256 JWKS at `auth.madfam.io/.well-known/jwks.json`                     |
| **Dhanam**      | `madfam-org/dhanam`           | Billing boundary, catalog checkout, Stripe MX/SPEI, webhook relay, internal POS roadmap            |
| **Selva**       | `madfam-org/selva-office` | LLM inference routing + agent orchestration                                                        |
| **Karafiel**    | `madfam-org/karafiel`         | Operational compliance — CFDI, NOM-151, e.firma, SAT-adjacent. Owns legal-ops / contract templates |
| **Tezca**       | `madfam-org/tezca`            | Mexican law oracle (informational only — feeds Karafiel)                                           |
| **Cotiza**      | `madfam-org/digifab-quoting`  | MADFAM's quoting engine (fabrication + services)                                                   |
| **Forgesight**  | `madfam-org/forgesight`       | Digital fabrication industry intelligence (pricing/vendor feed to Cotiza)                          |
| **Pravara MES** | `madfam-org/pravara-mes`      | Fabrication-node routing and dispatch (physical jobs)                                              |
| **PhyndCRM**    | `madfam-org/phynd-crm`        | Client-facing deliverables portal (single pane of glass per engagement)                            |
| **Fortuna**     | `madfam-org/fortuna`          | Problem intelligence / zeitgeist analysis                                                          |
| **Avala**       | `madfam-org/avala`            | Learning verification platform                                                                     |

### Cross-repo conventions

- **Auth**: every authenticated service verifies Janua JWTs via JWKS at
  `https://auth.madfam.io/.well-known/jwks.json`. RS256 only — HS256 is
  fail-closed after the 2026-04-23 audit (H3/H4).
- **Billing**: credit metering + entitlements flow through Dhanam. See
  `madfam-org/dhanam` for the meter/entitlement/invoice APIs.
- **Inference**: every LLM call should route through Selva
  (`selva-office`) at `/v1` (OpenAI-compatible). Do not talk directly
  to OpenAI / Anthropic from service code.
- **CORS**: explicit allowlist per service. Wildcards are banned
  (audit 2026-04-23 H2/H5/H6).
- **Images**: `@sha256:`-pinned in every manifest. Kyverno fail-closes on
  `:latest` or mutable tags.
- **Onboarding**: `POST /v1/admin/onboard` on switchyard-api creates
  namespace, ArgoCD app, Cloudflare tunnel routes, Janua client, and
  NetworkPolicies in one shot. See `enclii/docs/guides/ONBOARDING_GUIDE.md`.

### Production topology

Bare-metal k3s on Hetzner with Cloudflare Tunnel ingress, Longhorn storage, and
ArgoCD GitOps. **Node names, SKUs, IPs, SSH access, and cost ledger** live in the
private `madfam-org/internal-devops` repo — not in this public tree.

Public surfaces: `app.dhan.am`, `api.dhan.am`, `admin.dhan.am`. Routine deploys
via Enclii; see [Deployment Guide](docs/DEPLOYMENT.md) and
[Public Repo Security Remediation](docs/PUBLIC_REPO_SECURITY_REMEDIATION.md).

---

## Enclii CLI — DevOps Reference

**Strong preference: use `enclii` over `kubectl`** for all operational
tasks. The CLI routes through Switchyard API, which gives you audit
logging, lifecycle event tracking, and service-scoped context. Escape
to kubectl only for the gaps listed at the end of this section.

### Install

```bash
# macOS
brew install enclii/tap/enclii

# Linux
curl -sSL https://get.enclii.dev | bash

# From source (in the enclii repo)
make build-cli && ./bin/enclii --version
```

### Auth

```bash
enclii login                  # browser SSO (Janua)
enclii whoami                 # verify active session
enclii logout                 # clear local creds
```

Env vars: `ENCLII_API_URL` (default `https://api.enclii.dev`),
`ENCLII_TOKEN` (alternative to interactive login),
`ENCLII_PROJECT`, `ENCLII_ENV`.

### Day-to-day for dhanam-api

The commands below default to `dhanam-api` — the primary service name for
this repo as registered in Switchyard. For any other service in the
ecosystem, swap the name.

```bash
# Status + where the pods are running
enclii ps --wide
enclii ps dhanam-api --env production

# Logs (tail, filter, history)
enclii logs dhanam-api -f                          # live tail
enclii logs dhanam-api --since 1h --level error    # last hour, errors only
enclii logs dhanam-api --env staging -f

# Deploy (preview, staging, production)
enclii deploy --env preview                       # from current branch
enclii deploy --env staging
enclii deploy --env production --strategy canary --canary-percent 10

# Rollback
enclii rollback dhanam-api                         # previous release
enclii rollback dhanam-api --to-revision 5

# Releases + history
enclii releases dhanam-api                          # list builds
enclii releases dhanam-api --latest --output json

# Secrets (routed through Lockbox → Vault → ESO → K8s)
enclii secrets list dhanam-api
enclii secrets set MY_KEY=value --service dhanam-api --secret
enclii secrets rm MY_KEY --service dhanam-api

# Domains, tunnel routes, DNS
enclii domains list dhanam-api
enclii domains add dhanam-api my.example.com       # auto-provisions tunnel route + DNS

# Scheduled jobs (cron + one-off)
enclii jobs list
enclii jobs run <job-name>                         # trigger one-off

# Routing (ingress + TLS)
enclii junctions list dhanam-api

# Serverless (scale-to-zero functions)
enclii functions list

# Local dev environment
enclii local up         # spin up dependent services (postgres, redis, …)
enclii local logs
enclii local down
```

### Full onboarding (only used when adding a brand-new service)

```bash
# One-shot: namespace + ArgoCD app + tunnel routes + Janua client + netpol
enclii onboard --repo madfam-org/<name> --db-name <db> --secrets-file .env
```

### Enclii-first production operations

Enclii is the required control plane for routine production operations.
Use the web UI, API, or CLI before reaching for raw infrastructure tools:

- ArgoCD sync / diff / rollback — `enclii ops apps ...`
- Pod logs, diagnosis, and safe restarts — `enclii ops pods ...`
- Longhorn / PVC / PV inspection and repair planning — `enclii ops storage ...`
- Kyverno violations and time-bound waivers — `enclii ops policy ...`
- ExternalSecrets and Vault readiness — `enclii ops secrets ...`
- ARC runner inspection and drain workflows — `enclii ops runners ...`
- DNS, tunnels, SaaS hostnames, providers, and repo automation — `enclii providers ...`
- Service lifecycle, domains, secrets, jobs, and observability — `enclii deploy`, `enclii rollback`, `enclii logs`, `enclii observe`, `enclii domains`, `enclii secrets`, `enclii jobs`

### Break-glass-only access

Raw `kubectl`, `helm`, SSH, provider CLIs/APIs, `docker exec`, and direct
container access are allowed only for platform bootstrap or documented
break-glass emergencies when Enclii is unavailable or lacks an implemented
adapter. Record the actor, reason, target service/environment, commands
executed, result, and follow-up Enclii adapter gap or incident link.

### Cluster access

kubeconfig + SSH keys live in `madfam-org/internal-devops` (private repo)
for bootstrap and break-glass use only. Routine production operations must
go through Enclii web, API, or CLI.

### Exit codes (scripting against the CLI)

| Code | Meaning          |
| ---- | ---------------- |
| 0    | success          |
| 10   | validation error |
| 20   | build failed     |
| 30   | deploy failed    |
| 40   | timeout          |
| 50   | auth error       |

---

## Document provenance

Generated 2026-04-23 as part of the "each repo stands alone" docs sweep. If the
ecosystem map or CLI reference drifts from reality, update the generator at
`madfam-org/enclii/docs/templates/ECOSYSTEM.md.template` and re-render — don't
edit per-repo copies in isolation.
