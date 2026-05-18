# Dhanam Ledger -- Launch Operations Runbook

> [!IMPORTANT]
> MADFAM-ENCLII-FIRST-LEGACY-RAW v1: This document contains legacy raw infrastructure command examples.
> Routine production operations must use Enclii web, API, or CLI. Treat raw
> `kubectl`, `helm`, SSH, provider CLI/API, `docker exec`, and direct container
> access as platform bootstrap or documented break-glass only, and record any
> missing Enclii adapter gap.

This runbook covers every step required to take Dhanam from development to production launch. It is organized by dependency chain so that long-lead items start first and shorter tasks fill in around them.

**Production URLs:**

| Surface      | URL                        |
| ------------ | -------------------------- |
| Web app      | `https://app.dhan.am`      |
| API          | `https://api.dhan.am`      |
| Admin        | `https://admin.dhanam.com` |
| Auth (Janua) | `https://auth.madfam.io`   |

**Deployment:** Push to `main` triggers Enclii auto-deploy to bare-metal Kubernetes.

---

## Table of Contents

1. [Critical Path and Timeline](#1-critical-path-and-timeline)
2. [Corporate and Legal Foundation](#2-corporate-and-legal-foundation)
3. [Legal Compliance Documents](#3-legal-compliance-documents)
4. [Financial Compliance (CNBV)](#4-financial-compliance-cnbv)
5. [External Account Creation](#5-external-account-creation)
6. [Infrastructure Provisioning](#6-infrastructure-provisioning)
7. [App Store Submissions](#7-app-store-submissions)
8. [Go-to-Market Sequence](#8-go-to-market-sequence)
9. [Launch Checklist](#9-launch-checklist)

---

## 1. Critical Path and Timeline

The critical path is dominated by two provider onboarding processes and one legal process. Everything else fits within or around them.

### 8-Week Gantt Overview

```
Week  1  2  3  4  5  6  7  8
      |--|--|--|--|--|--|--|--|
Belvo ████████████████████████  (4-8 wks, START DAY 1)
Plaid ████████████              (2-4 wks, START DAY 1)
RFC + Acta ████████             (2-4 wks, START DAY 1)
Apple D-U-N-S + Dev Program  ██████████  (2-3 wks, after Acta)
Paddle              ████████████         (2-4 wks, after RFC)
Stripe MX              ██████            (3-7 days, after RFC)
IMPI Trademark   ████████████████████... (3-6 months, non-blocking)
Infra / Secrets        ████              (Week 3-4)
App Store Prep            ████████       (Week 4-6)
Soft Launch                      ████    (Week 6-7)
Public Launch                       ████ (Week 7-8)
```

### Day 1 Parallel Starts

These items have the longest lead times. Begin all of them on Day 1:

| Item                        | Lead Time                     | Blocker For                              |
| --------------------------- | ----------------------------- | ---------------------------------------- |
| Belvo production access     | 4-8 weeks                     | MX financial data aggregation            |
| Plaid production access     | 2-4 weeks                     | US financial data aggregation            |
| RFC registration at SAT     | 2-4 weeks                     | Stripe MX, Paddle, business bank account |
| Acta Constitutiva (notario) | 2-4 weeks (parallel with RFC) | Apple Developer org, D-U-N-S             |
| IMPI trademark application  | 3-6 months (non-blocking)     | Nothing at launch; protects brand        |

### Week 2-3 Starts (depend on RFC or Acta)

| Item                    | Lead Time            | Depends On                 |
| ----------------------- | -------------------- | -------------------------- |
| Apple D-U-N-S number    | 1-2 weeks            | Acta Constitutiva          |
| Apple Developer Program | 1 week after D-U-N-S | D-U-N-S number             |
| Paddle seller approval  | 2-4 weeks            | RFC, business bank account |
| Stripe MX account       | 3-7 days             | RFC                        |

### Week 4-6 (infrastructure and store prep)

| Item                       | Lead Time | Depends On                      |
| -------------------------- | --------- | ------------------------------- |
| K8s secrets populated      | 1 day     | All credentials gathered        |
| DNS records verified       | 1 day     | Cloudflare access               |
| App Store listing created  | 2-3 days  | Apple Developer Program         |
| Play Store listing created | 2-3 days  | Google Play Developer account   |
| EAS production build       | 1 day     | App Store + Play Store accounts |

---

## 2. Corporate and Legal Foundation

### 2.1 RFC Registration at SAT

The RFC (Registro Federal de Contribuyentes) is Mexico's tax ID. It is required before you can open a business bank account, sign up for Stripe MX, or register with Paddle.

**Steps:**

- [ ] Gather documents: Acta Constitutiva (or poder notarial), official ID (INE), proof of address (comprobante de domicilio less than 3 months old).
- [ ] Schedule appointment at SAT office via [satid.sat.gob.mx](https://satid.sat.gob.mx/).
- [ ] Attend appointment. SAT issues the Cedula de Identificacion Fiscal with RFC and e.firma (FIEL).
- [ ] Store e.firma certificate (.cer) and private key (.key) securely -- these are needed for Paddle KYC and CFDI invoicing.

**Lead time:** 2-4 weeks (appointment availability varies by city).

### 2.2 Acta Constitutiva via Notario Publico

The Acta Constitutiva is the incorporation document. S.A.S. (Sociedad por Acciones Simplificada) is recommended for startups because it can be formed online and has no minimum capital requirement.

**Steps:**

- [ ] Draft bylaws (estatutos). For S.A.S., this can be done through [gob.mx/tuempresa](https://www.gob.mx/tuempresa).
- [ ] Verify company name availability at the Secretaria de Economia.
- [ ] Execute Acta before a notario publico (required for S.A. de C.V.; optional for S.A.S. if done online).
- [ ] Register Acta at the Registro Publico de Comercio.
- [ ] Obtain certified copies (at least 3 -- needed for bank, SAT, Apple).

**Lead time:** 2-4 weeks.

### 2.3 IMPI Trademark Registration

Non-blocking for launch but essential for brand protection. File early because Mexico is first-to-file.

**Steps:**

- [ ] Search existing trademarks at [marcanet.impi.gob.mx](https://marcanet.impi.gob.mx/).
- [ ] File application for "Dhanam" in:
  - **Class 36** -- Financial technology services, budgeting, wealth tracking.
  - **Class 42** -- SaaS, software platform services.
- [ ] Pay filing fee (~4,000 MXN per class as of 2025).
- [ ] Monitor for office actions or oppositions during the 1-month publication period.

**Lead time:** 3-6 months for registration. Non-blocking.

### 2.4 D-U-N-S Number

Required for Apple Developer Program enrollment as an organization.

**Steps:**

- [ ] Apply at [developer.apple.com/enroll/duns-lookup](https://developer.apple.com/enroll/duns-lookup/).
- [ ] Provide legal entity name exactly as it appears on the Acta Constitutiva.
- [ ] Dun & Bradstreet may call to verify. Ensure the registered phone number is reachable.
- [ ] Once assigned, the D-U-N-S number is used in the Apple Developer enrollment form.

**Lead time:** 1-2 weeks after Acta Constitutiva is registered.

---

## 3. Legal Compliance Documents

All four documents below must be written by or reviewed by legal counsel. This section provides content guidelines and required sections to accelerate drafting.

Legal pages are served at:

- `/privacy` -- Aviso de Privacidad
- `/terms` -- Terms of Service
- `/cookies` -- Cookie Policy
- `/security` -- Security Page

### 3.1 Aviso de Privacidad (Privacy Notice)

Required under Mexico's Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares (LFPDPPP).

**Required sections:**

- [ ] **Identity and address of the data controller** -- Legal entity name, RFC, physical address, contact email (privacidad@dhan.am).
- [ ] **Personal data collected** -- Exhaustive list grouped by category:
  - Identity data (name, email, phone)
  - Financial data (bank connections, transaction history, account balances)
  - Device data (IP address, device identifiers, browser fingerprint)
  - Usage data (PostHog analytics events)
- [ ] **Purpose of processing** -- Primary purposes (service delivery) and secondary purposes (analytics, marketing). Secondary purposes require separate opt-in.
- [ ] **ARCO rights** -- Explain how users exercise rights of Access, Rectification, Cancellation, and Opposition. Provide:
  - Email: arco@dhan.am
  - Response timeline: 20 business days
  - Process for identity verification
- [ ] **Data transfers** -- Disclose all third-party recipients:
  - Belvo (MX financial data aggregation)
  - Plaid (US financial data aggregation)
  - Bitso (crypto exchange data)
  - Zapper (DeFi portfolio data)
  - PostHog (analytics, EU-hosted)
  - Sentry (error tracking)
  - Cloudflare (CDN, security)
  - Janua / MADFAM (authentication)
- [ ] **International transfers** -- Specify that data may be processed in servers outside Mexico. Reference adequate protection measures.
- [ ] **Data retention** -- State retention periods:
  - Active accounts: data retained for duration of service
  - Deleted accounts: purged within 30 days (GDPR-aligned)
  - Financial records: 5-year minimum per Mexican fiscal requirements
- [ ] **Security measures** -- Reference AES-256-GCM encryption, TLS 1.3, TOTP 2FA.
- [ ] **Cookie notice reference** -- Link to `/cookies`.
- [ ] **Changes to notice** -- How users are notified of updates (email + in-app banner).
- [ ] **Effective date and version number**.

### 3.2 Terms of Service

- [ ] **Jurisdiction** -- Mexico City courts. Governing law: Mexican federal law.
- [ ] **Financial disclaimer** -- Dhanam is an informational tool, not a financial advisor. No investment recommendations. Users are solely responsible for financial decisions.
- [ ] **Service description** -- Read-only aggregation, budgeting, wealth tracking, ESG insights. Dhanam never initiates transactions or moves money.
- [ ] **Subscription terms** -- Plan tiers (Community free, Essentials, Professional, Family), billing cycles, cancellation policy, refund policy.
- [ ] **Payment processors** -- Stripe MX (Mexico), Paddle (global). Disclose that billing is handled by third parties.
- [ ] **Account termination** -- Conditions for suspension or termination (abuse, fraud, legal obligation).
- [ ] **Data portability** -- Users can export all their data in standard formats.
- [ ] **Limitation of liability** -- Dhanam is not liable for third-party provider outages, data accuracy from bank feeds, or cryptocurrency value changes.
- [ ] **Intellectual property** -- All Dhanam content, trademarks, and software are owned by the company.
- [ ] **Acceptable use** -- Prohibited activities (scraping, reverse engineering, unauthorized access).
- [ ] **Age requirement** -- Minimum 18 years (financial services context).

### 3.3 Cookie Policy

- [ ] **Cookie categories:**
  - **Strictly necessary** -- Session cookies, CSRF tokens, authentication state. Cannot be disabled.
  - **Functional** -- Language preference, theme, dashboard layout.
  - **Analytics** -- PostHog session recording and event tracking.
  - **Third-party** -- Sentry (error tracking), Cloudflare (performance).
- [ ] **Consent mechanism** -- `dhanam_consent` cookie stores user preferences as a JSON-encoded string with category flags. Default: strictly necessary only. Banner shown on first visit.
- [ ] **Third-party cookies** -- List each third-party cookie with domain, purpose, and expiration.
- [ ] **How to manage cookies** -- Browser-level instructions for Chrome, Safari, Firefox, Edge.
- [ ] **Link to Privacy Notice** for broader data processing context.

### 3.4 Security Page

- [ ] **Security overview** -- High-level description of security posture:
  - AES-256-GCM encryption for provider tokens at rest
  - TLS 1.3 for all data in transit
  - Argon2id password hashing with breach checks
  - TOTP 2FA support
  - Short-lived JWT (15 min) with rotating refresh tokens (30 day max)
  - RBAC with space-level access control
- [ ] **Infrastructure** -- Bare-metal Kubernetes (Enclii), Cloudflare WAF, network policies restricting pod-to-pod communication.
- [ ] **Responsible disclosure policy:**
  - Email: security@dhan.am
  - PGP key (publish to `/security/pgp-key.txt`)
  - Acknowledgment within 48 hours
  - Target resolution: 90 days
  - No legal action against good-faith researchers
  - Hall of fame for acknowledged reports
- [ ] **SOC 2 / audit status** -- State current status (e.g., "SOC 2 Type I planned for Q3 2026").
- [ ] **Penetration testing** -- Cadence and scope (e.g., annual third-party pentest).

---

## 4. Financial Compliance (CNBV)

### Does Dhanam Require CNBV Authorization?

Mexico's Ley para Regular las Instituciones de Tecnologia Financiera (Ley Fintech) regulates entities that:

1. Operate as electronic payment institutions (IFPEs)
2. Operate as collective financing institutions (crowdfunding)
3. Operate with virtual assets (exchanges, custody)

**Dhanam's posture:**

- Dhanam performs **read-only data aggregation**. It does not initiate payments, hold funds, or custody assets.
- Belvo (the primary MX aggregation provider) holds its own CNBV-relevant authorizations where applicable.
- Dhanam displays ESG scores and portfolio values but does not provide investment advice under Mexican securities law.

**Assessment:** Read-only aggregation likely does **not** require CNBV authorization, but the regulatory landscape is evolving.

**Recommended actions:**

- [ ] **Obtain a written legal opinion** from a Mexican fintech attorney confirming that Dhanam's read-only aggregation model does not require CNBV authorization under Ley Fintech Articles 30-37.
- [ ] **Document the opinion** and keep it accessible for potential regulatory inquiries.
- [ ] **Monitor CNBV secondary regulations** -- the Commission periodically updates rules around data aggregation and open banking.
- [ ] **Avoid feature creep into regulated territory** -- do not add payment initiation, fund transfers, or asset custody without reassessing compliance requirements.
- [ ] If the legal opinion is ambiguous, consider filing a voluntary consultation with the CNBV to obtain a formal ruling.

---

## 5. External Account Creation

### Credentials Summary Table

| Service             | Credentials Output                                                                                                          | K8s Secret               | Lead Time        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------- |
| Janua OIDC          | `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `JANUA_API_KEY`, `JANUA_ADMIN_KEY`, `JANUA_WEBHOOK_SECRET`, `DHANAM_WEBHOOK_SECRET` | `dhanam-secrets`         | 1 day (internal) |
| Stripe Mexico       | `STRIPE_MX_PUBLISHABLE_KEY`, `STRIPE_MX_SECRET_KEY`, `STRIPE_MX_WEBHOOK_SECRET` + price IDs                                 | `dhanam-billing-secrets` | 3-7 days         |
| Conekta (via Janua) | Routed through Janua billing -- confirm architecture                                                                        | N/A (Janua-managed)      | 1-2 weeks        |
| Paddle              | `PADDLE_VENDOR_ID`, `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`                                        | `dhanam-billing-secrets` | 2-4 weeks        |
| Belvo               | `BELVO_SECRET_KEY_ID`, `BELVO_SECRET_KEY_PASSWORD`, `BELVO_WEBHOOK_SECRET`                                                  | `dhanam-secrets`         | 4-8 weeks        |
| Plaid               | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_WEBHOOK_SECRET`                                                                   | `dhanam-secrets`         | 2-4 weeks        |
| Bitso               | `BITSO_API_KEY`, `BITSO_API_SECRET`                                                                                         | `dhanam-secrets`         | 1-2 weeks        |
| Zapper              | `ZAPPER_API_KEY`                                                                                                            | `dhanam-secrets`         | 1 day            |
| Zillow              | `ZILLOW_API_KEY` (API deprecated 2021 -- see alternatives)                                                                  | `dhanam-secrets`         | TBD              |
| Banxico             | `BANXICO_API_TOKEN`                                                                                                         | `dhanam-secrets`         | 1 day (free)     |
| PostHog             | `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_API_KEY`                                                                                | `dhanam-secrets`         | 1 day            |
| Sentry              | `SENTRY_DSN` (web + API)                                                                                                    | `dhanam-secrets`         | 1 day            |
| Email (Resend)      | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` + SPF/DKIM/DMARC DNS                                                              | `dhanam-secrets`         | 1-2 days         |
| OneSignal           | `EXPO_PUBLIC_ONESIGNAL_APP_ID`                                                                                              | N/A (build-time)         | 1 day            |

### 5.1 Janua OIDC (MADFAM SSO)

**URL:** Internal -- contact MADFAM platform team.

**Steps:**

- [ ] Request a new OIDC client for Dhanam production at `https://auth.madfam.io`.
- [ ] Provide redirect URIs:
  ```
  https://app.dhan.am/api/auth/callback/janua
  https://admin.dhanam.com/api/auth/callback/janua
  ```
- [ ] Receive `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET`.
- [ ] Request API keys: `JANUA_API_KEY` (user operations), `JANUA_ADMIN_KEY` (admin operations).
- [ ] Configure webhook endpoint: `https://api.dhan.am/v1/webhooks/janua`.
- [ ] Receive `JANUA_WEBHOOK_SECRET` and `DHANAM_WEBHOOK_SECRET`.
- [ ] Verify OIDC discovery endpoint responds: `https://auth.madfam.io/.well-known/openid-configuration`.

**K8s secret keys:** `dhanam-secrets` -- `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`.

### 5.2 Stripe Mexico

**URL:** [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)

**Steps:**

- [ ] Register a Stripe account. Select Mexico as the country.
- [ ] Complete business verification: RFC, legal entity name, business address, bank account (CLABE).
- [ ] Wait for Stripe to activate the account (3-7 business days).
- [ ] Create products and prices in the Stripe dashboard for each plan tier:
  - Essentials Monthly / Annual
  - Professional Monthly / Annual
  - Family Monthly / Annual
- [ ] Record the `price_xxx` IDs for each product.
- [ ] Navigate to Developers > API keys. Copy `pk_live_xxx` and `sk_live_xxx`.
- [ ] Navigate to Developers > Webhooks. Add endpoint: `https://api.dhan.am/v1/webhooks/stripe`.
- [ ] Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
- [ ] Copy the webhook signing secret `whsec_xxx`.
- [ ] Enable OXXO and SPEI as payment methods under Settings > Payment methods.

**K8s secret keys:** `dhanam-billing-secrets` -- `STRIPE_MX_PUBLISHABLE_KEY`, `STRIPE_MX_SECRET_KEY`, `STRIPE_MX_WEBHOOK_SECRET`.

### 5.3 Conekta (via Janua)

**URL:** [https://panel.conekta.com/sign_up](https://panel.conekta.com/sign_up)

**Note:** Conekta billing in Dhanam is routed through Janua's billing abstraction layer. Before creating a standalone Conekta account:

- [ ] Confirm with the MADFAM platform team whether Conekta credentials are managed by Janua or by Dhanam directly.
- [ ] If Janua-managed: no separate Conekta secret is needed in `dhanam-secrets`. Janua handles the Conekta API calls.
- [ ] If Dhanam-managed: register at Conekta, complete KYC (RFC, CLABE), and store `CONEKTA_API_KEY` and `CONEKTA_WEBHOOK_SECRET` in `dhanam-secrets`.

### 5.4 Paddle (Global Billing)

**URL:** [https://vendors.paddle.com/signup](https://vendors.paddle.com/signup)

**Steps:**

- [ ] Register at Paddle. Select "SaaS" as business type.
- [ ] Complete seller verification: legal entity details, RFC, bank account, tax information.
- [ ] Wait for seller approval (2-4 weeks -- Paddle manually reviews all new sellers).
- [ ] Once approved, navigate to Developer Tools > Authentication.
- [ ] Copy `PADDLE_VENDOR_ID` and generate a `PADDLE_API_KEY`.
- [ ] Generate a client-side token (`PADDLE_CLIENT_TOKEN`) for Paddle.js.
- [ ] Navigate to Developer Tools > Notifications. Add webhook URL: `https://api.dhan.am/v1/webhooks/paddle`.
- [ ] Copy `PADDLE_WEBHOOK_SECRET`.
- [ ] Create subscription plans mirroring Stripe tiers.
- [ ] Configure tax settings -- Paddle handles sales tax and VAT as merchant of record.

**K8s secret keys:** `dhanam-billing-secrets` -- `PADDLE_VENDOR_ID`, `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`.

### 5.5 Belvo (MX Financial Aggregation)

**URL:** [https://dashboard.belvo.com/register](https://dashboard.belvo.com/register)

**Steps:**

- [ ] Register for a Belvo sandbox account at the URL above.
- [ ] Develop and test the integration in sandbox mode (sandbox credentials are instant).
- [ ] Apply for production access via the Belvo dashboard or by contacting sales@belvo.com.
- [ ] Provide required information:
  - Company name and RFC
  - Use case description (read-only aggregation for budgeting and wealth tracking)
  - Expected volume (number of connections/month)
  - Privacy policy URL: `https://app.dhan.am/privacy`
  - Webhook endpoint: `https://api.dhan.am/v1/webhooks/belvo`
- [ ] Belvo reviews the application (4-8 weeks).
- [ ] Once approved, receive production `BELVO_SECRET_KEY_ID` and `BELVO_SECRET_KEY_PASSWORD`.
- [ ] Configure the production webhook and receive `BELVO_WEBHOOK_SECRET`.
- [ ] Update the Belvo Widget configuration to use the production environment.

**K8s secret keys:** `dhanam-secrets` -- `BELVO_SECRET_KEY_ID`, `BELVO_SECRET_KEY_PASSWORD`, `BELVO_WEBHOOK_SECRET`.

### 5.6 Plaid (US Financial Aggregation)

**URL:** [https://dashboard.plaid.com/signup](https://dashboard.plaid.com/signup)

**Steps:**

- [ ] Register for a Plaid account. Sandbox and development access are immediate.
- [ ] Build and test the integration in sandbox/development environments.
- [ ] Apply for production access via the Plaid dashboard (Apply > Production access).
- [ ] Provide required information:
  - Company information and legal entity
  - Use case: personal finance management, read-only
  - Expected user count
  - Privacy policy URL: `https://app.dhan.am/privacy`
  - Compliance questionnaire (AML/KYC questions)
- [ ] Plaid reviews the application (2-4 weeks).
- [ ] Once approved, production `PLAID_CLIENT_ID` and `PLAID_SECRET` become available in the dashboard.
- [ ] Configure webhook URL: `https://api.dhan.am/v1/webhooks/plaid`.
- [ ] Record `PLAID_WEBHOOK_SECRET` from the webhook configuration.

**K8s secret keys:** `dhanam-secrets` -- `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_WEBHOOK_SECRET`.

### 5.7 Bitso (Crypto Exchange)

**URL:** [https://bitso.com/register](https://bitso.com/register)

**Steps:**

- [ ] Register a Bitso account (personal or business).
- [ ] Complete KYC verification.
- [ ] Navigate to API Keys in account settings.
- [ ] Generate a new API key pair with **read-only** permissions (balances, trades, funding).
- [ ] Copy `BITSO_API_KEY` and `BITSO_API_SECRET`.
- [ ] Note: Bitso API keys are per-user. For the platform integration, Dhanam stores each user's Bitso credentials encrypted (AES-256-GCM). The platform-level key is for admin/monitoring only if applicable.

**K8s secret keys:** `dhanam-secrets` -- `BITSO_API_KEY`, `BITSO_API_SECRET` (platform-level, if used).

### 5.8 Zapper (DeFi Portfolio)

**URL:** [https://zapper.xyz/developers](https://zapper.xyz/developers)

**Steps:**

- [ ] Sign up for the Zapper API program.
- [ ] Request an API key (typically available same day).
- [ ] The API provides portfolio positions across Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, and BSC.
- [ ] Copy `ZAPPER_API_KEY`.

**K8s secret keys:** `dhanam-secrets` -- `ZAPPER_API_KEY`.

### 5.9 Zillow (Real Estate Valuation)

**Important:** The Zillow public API was deprecated in 2021. The Zestimate data is no longer available through a free API.

**Alternatives to evaluate:**

- [ ] **Zillow Bridge API** -- Available to select partners. Contact Zillow Group for partnership inquiry.
- [ ] **Redfin** -- No public API, but data can be referenced from their website for manual asset entry.
- [ ] **ATTOM Data** ([https://api.gateway.attomdata.com](https://api.gateway.attomdata.com)) -- Paid property data API with AVM (Automated Valuation Model). Pricing is per-lookup.
- [ ] **Estated** ([https://estated.com](https://estated.com)) -- Property data API with valuations. Pay-per-query model.
- [ ] **For MVP:** Allow users to manually enter and update property values. Automated valuation can be added post-launch.

**K8s secret keys:** `dhanam-secrets` -- `ZILLOW_API_KEY` (placeholder; update key name if using an alternative provider).

### 5.10 Banxico (Exchange Rates)

**URL:** [https://www.banxico.org.mx/SieAPIRest/service/v1/](https://www.banxico.org.mx/SieAPIRest/service/v1/)

**Steps:**

- [ ] Navigate to the Banxico SIE API portal.
- [ ] Register for a free API token (no approval process).
- [ ] Copy `BANXICO_API_TOKEN`.
- [ ] Key series for MXN/USD: `SF43718` (FIX rate), `SF46410` (spot rate).

**K8s secret keys:** `dhanam-secrets` -- `BANXICO_API_TOKEN`.

### 5.11 PostHog (Analytics)

**URL:** Self-hosted at `https://analytics.madfam.io` (see [POSTHOG_INTEGRATION.md](../guides/POSTHOG_INTEGRATION.md))

**Steps:**

- [ ] Register for a PostHog account (cloud or self-hosted).
- [ ] Create a new project named "Dhanam Production".
- [ ] Navigate to Project Settings. Copy the **Project API key** (this is the public key for the frontend).
- [ ] Generate a **Personal API key** for server-side event ingestion.
- [ ] Set `NEXT_PUBLIC_POSTHOG_KEY` to the project API key (build-time, public).
- [ ] Set `POSTHOG_API_KEY` to the personal API key (server-side, secret).

**K8s secret keys:** `dhanam-secrets` -- `POSTHOG_API_KEY`. The public key is a build-time variable in `.enclii.yml`.

### 5.12 Sentry (Error Tracking)

**URL:** [https://sentry.io/signup](https://sentry.io/signup)

**Steps:**

- [ ] Register for a Sentry account.
- [ ] Create a Sentry organization (e.g., "dhanam" or "madfam").
- [ ] Create two projects:
  - `dhanam-web` (platform: Next.js)
  - `dhanam-api` (platform: Node.js)
- [ ] Copy the `SENTRY_DSN` from each project's settings (Client Keys page).
- [ ] Optionally configure source maps upload via Sentry CLI in the CI pipeline.

**K8s secret keys:** `dhanam-secrets` -- `SENTRY_DSN` (shared or per-app, depending on desired separation).

### 5.13 Email (Resend or SMTP)

**URL:** [https://resend.com/signup](https://resend.com/signup) (recommended) or any SMTP provider.

**Steps:**

- [ ] Register for a Resend account (or alternative: Amazon SES, Mailgun, Postmark).
- [ ] Add and verify the sending domain: `dhan.am`.
- [ ] Add DNS records as instructed by the provider (see Section 6 for DNS details):
  - SPF TXT record
  - DKIM CNAME records
  - DMARC TXT record
- [ ] Generate an API key or SMTP credentials.
- [ ] Record `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` (or `RESEND_API_KEY` if using Resend's SDK).

**K8s secret keys:** `dhanam-secrets` -- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`.

### 5.14 OneSignal (Push Notifications)

**URL:** [https://onesignal.com](https://onesignal.com)

**Steps:**

- [ ] Register for a OneSignal account.
- [ ] Create a new app named "Dhanam".
- [ ] Configure platforms:
  - **iOS:** Upload APNs authentication key (.p8 file) from Apple Developer portal.
  - **Android:** Provide Firebase Cloud Messaging (FCM) server key.
- [ ] Copy the OneSignal App ID.
- [ ] Set `EXPO_PUBLIC_ONESIGNAL_APP_ID` in the Expo build configuration (`apps/mobile/eas.json`).

**K8s secret keys:** N/A -- this is a build-time mobile variable.

---

## 6. Infrastructure Provisioning

### 6.1 Database and Redis

**PostgreSQL:**

- [ ] Provision a managed PostgreSQL instance (or bare-metal). Minimum specs for launch:
  - 2 vCPU, 4 GB RAM, 50 GB SSD
  - PostgreSQL 15+
  - SSL required
  - Daily automated backups with 7-day retention
- [ ] Create the `dhanam` database and dedicated user **via Enclii provisioning API** (required per Law 7 — do not use raw `kubectl exec`):

  ```bash
  # Option A: Use the convenience script
  export ENCLII_API_URL=https://api.enclii.com
  export ENCLII_ADMIN_TOKEN=$(enclii auth token)
  export DB_PASSWORD=<secure-password>
  ./scripts/provision-db.sh

  # Option B: Use the Enclii CLI
  enclii onboard --db-name dhanam --db-password "${DB_PASSWORD}"
  ```

  The API endpoint (`POST /v1/admin/provision/postgres`) is idempotent — it checks `pg_database`/`pg_roles` before creating, and auto-updates PgBouncer config. Requires `POSTGRES_ADMIN_URL` set on `switchyard-api`. See `docs/DEPLOYMENT.md` for full details.

- [ ] Record the connection string: `postgresql://dhanam_user:pass@host:5432/dhanam`
- [ ] Run migrations: `npx prisma migrate deploy` (from `apps/api/`).

**Redis:**

- [ ] Provision a Redis instance. Minimum specs:
  - 1 GB RAM
  - Persistence: AOF or RDB snapshots
  - TLS recommended
- [ ] Record the connection string: `redis://host:6379/0`

### 6.2 Secret Generation

Generate cryptographic secrets for JWT, encryption, and NextAuth:

```bash
# JWT secret (API token signing)
openssl rand -base64 32
# Example output: aB3dEf7gHiJkLmNoPqRsTuVwXyZ012345==

# JWT refresh secret
openssl rand -base64 32

# NextAuth secret (web session encryption)
openssl rand -base64 32

# Encryption key (AES-256-GCM for provider tokens)
# IMPORTANT: Must be exactly 32 ASCII characters, NOT base64-encoded.
# The API validates this with Joi.string().length(32).
openssl rand -hex 16
# Example output: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6  (32 hex chars = 32 ASCII chars)
```

### 6.3 K8s Secrets Population

The secrets template is at `infra/k8s/production/secrets-template.yaml`.

```bash
# 1. Copy the template
cp infra/k8s/production/secrets-template.yaml infra/k8s/production/secrets.yaml

# 2. Edit secrets.yaml and fill in all values (DO NOT commit this file)

# 3. Apply secrets to the cluster
kubectl apply -f infra/k8s/production/secrets.yaml

# 4. Verify secrets exist
kubectl get secrets -n dhanam
# Expected: dhanam-secrets, dhanam-billing-secrets
```

The template defines two Secret resources:

| Secret Name              | Contents                                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dhanam-secrets`         | `DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `JWT_SECRET`, `JWT_REFRESH_SECRET`                          |
| `dhanam-billing-secrets` | `STRIPE_MX_PUBLISHABLE_KEY`, `STRIPE_MX_SECRET_KEY`, `STRIPE_MX_WEBHOOK_SECRET`, `PADDLE_VENDOR_ID`, `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET` |

Add additional provider credentials to `dhanam-secrets` as they are obtained:

```bash
kubectl -n dhanam patch secret dhanam-secrets --type merge -p \
  '{"stringData":{"BELVO_SECRET_KEY_ID":"<value>","BELVO_SECRET_KEY_PASSWORD":"<value>"}}'
```

### 6.4 DNS Records (Cloudflare)

Configure the following CNAME records in Cloudflare, all proxied (orange cloud):

| Type  | Name       | Target                                   | Proxy   |
| ----- | ---------- | ---------------------------------------- | ------- |
| CNAME | `app`      | Enclii tunnel endpoint                   | Proxied |
| CNAME | `api`      | Enclii tunnel endpoint                   | Proxied |
| CNAME | `admin`    | Enclii tunnel endpoint (if on `dhan.am`) | Proxied |
| CNAME | `www`      | `dhan.am`                                | Proxied |
| CNAME | `@` (apex) | Enclii tunnel endpoint                   | Proxied |

**Note:** `admin.dhanam.com` is on a separate domain. Configure its CNAME in the `dhanam.com` Cloudflare zone.

**Email DNS records** (in the `dhan.am` zone):

| Type  | Name                    | Value                                              |
| ----- | ----------------------- | -------------------------------------------------- |
| TXT   | `@`                     | `v=spf1 include:<email-provider-spf> -all`         |
| CNAME | `<selector>._domainkey` | Provider-supplied DKIM value                       |
| TXT   | `_dmarc`                | `v=DMARC1; p=quarantine; rua=mailto:dmarc@dhan.am` |

Replace `<email-provider-spf>` and `<selector>` with values from your email provider (Section 5.13).

### 6.5 Image Pull Secret

Create a GitHub Container Registry pull secret so K8s can pull images from `ghcr.io/madfam-org/dhanam/*`:

```bash
kubectl -n dhanam create secret docker-registry ghcr-credentials \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-pat-with-read-packages> \
  --docker-email=<email>
```

### 6.6 Deployment

With Enclii, deployment is automatic on push to `main`:

```bash
# Standard deployment (push triggers auto-deploy)
git push origin main

# Verify deployment status
kubectl -n dhanam rollout status deployment/dhanam-api
kubectl -n dhanam rollout status deployment/dhanam-web
kubectl -n dhanam rollout status deployment/dhanam-admin

# Check pod health
kubectl -n dhanam get pods
kubectl -n dhanam logs deployment/dhanam-api --tail=50
```

For manual deployment (fallback):

```bash
# Apply kustomize manifests directly
kubectl apply -k infra/k8s/production/

# Or trigger a manual Enclii deploy
# (See .github/workflows/deploy-enclii.yml for manual dispatch)
```

---

## 7. App Store Submissions

### 7.1 Apple App Store

**Prerequisites:**

- [ ] D-U-N-S number (Section 2.4)
- [ ] Apple Developer Program enrollment ($99/year): [https://developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll)

**App Store Connect Setup:**

- [ ] Log in to [App Store Connect](https://appstoreconnect.apple.com/).
- [ ] Create a new app:
  - Platform: iOS
  - Name: Dhanam
  - Primary language: Spanish (Mexico)
  - Bundle ID: `com.madfam.dhanam` (must match `apps/mobile/app.json`)
  - SKU: `dhanam-ios`
- [ ] Fill in metadata:
  - Subtitle (30 chars): "Finanzas personales inteligentes" or equivalent
  - Description (4000 chars): Feature overview in Spanish and English
  - Keywords (100 chars): presupuesto, finanzas, patrimonio, crypto, ESG
  - Support URL: `https://app.dhan.am/support`
  - Privacy Policy URL: `https://app.dhan.am/privacy`
- [ ] Upload screenshots (required sizes):
  - iPhone 6.7" (1290 x 2796): 3-10 screenshots
  - iPhone 6.5" (1284 x 2778): 3-10 screenshots
  - iPad Pro 12.9" (2048 x 2732): 3-10 screenshots (if supporting iPad)
- [ ] Select age rating: 17+ (financial information, unrestricted web access)
- [ ] Select categories:
  - Primary: Finance
  - Secondary: Business
- [ ] Configure App Privacy:
  - Data collected: Financial info, contact info, identifiers, usage data
  - Data linked to user: Financial info, contact info
  - Data used for tracking: None (Dhanam does not sell or share data for ad tracking)

**EAS Build and Submit:**

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in
eas login

# Build for iOS (production profile)
cd apps/mobile
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --latest
```

The EAS configuration is at `apps/mobile/eas.json`.

**Apple Review Guidelines to Watch:**

- [ ] **Guideline 2.3.1:** Ensure all links in the app are functional before submission.
- [ ] **Guideline 3.1.1:** If the app offers subscriptions, they must go through Apple's in-app purchase system unless the app qualifies for the "reader app" exemption. Financial data aggregation apps typically qualify. Confirm with legal counsel.
- [ ] **Guideline 5.1.1:** Privacy policy must be accessible from within the app and on the App Store listing.
- [ ] **Guideline 5.1.2:** Data use must match what is declared in the App Privacy section.

### 7.2 Google Play Store

**Prerequisites:**

- [ ] Google Play Developer account ($25 one-time): [https://play.google.com/console/signup](https://play.google.com/console/signup)

**Play Console Setup:**

- [ ] Log in to [Google Play Console](https://play.google.com/console).
- [ ] Create a new app:
  - App name: Dhanam
  - Default language: Spanish (Latin America)
  - App or game: App
  - Free or paid: Free (with in-app subscriptions)
- [ ] Complete the store listing:
  - Short description (80 chars)
  - Full description (4000 chars)
  - Screenshots: phone (min 2), 7-inch tablet, 10-inch tablet
  - Feature graphic (1024 x 500)
  - App icon (512 x 512)
- [ ] Complete the **Data Safety** section:
  - Data collected: Financial info, personal info, app activity
  - Data shared: None (Dhanam does not sell user data)
  - Encryption in transit: Yes
  - Data deletion: Users can request account deletion
- [ ] Select content rating: complete the IARC questionnaire.
- [ ] Select app category: Finance.
- [ ] Set target audience: 18+ (financial services).

**Build and Upload:**

```bash
# Build AAB (Android App Bundle) via EAS
cd apps/mobile
eas build --platform android --profile production

# Download the .aab file from the EAS dashboard
# Upload to Play Console > Release > Production > Create new release
```

- [ ] Upload the AAB to the production track.
- [ ] Complete the release notes in Spanish and English.
- [ ] Submit for review.

---

## 8. Go-to-Market Sequence

### Week 6: Soft Launch Mexico (Invite-Only)

**Goal:** Validate core flows with 50-100 real users before public launch.

- [ ] Enable invite codes in the Janua configuration (or via feature flag in Dhanam).
- [ ] Distribute invite codes to a curated group: friends, family, beta testers, fintech community members.
- [ ] Available tiers: **Community** (free) and **Essentials** (paid via Stripe MX).
- [ ] Payment methods: card only (OXXO/SPEI enabled in Week 7).
- [ ] Monitor:
  - PostHog funnels: sign_up > onboarding_complete > connect_success > view_net_worth
  - PostHog drip campaign events: drip_email_sent, onboarding_step_completed, onboarding_step_skipped, connect_failed
  - Sentry error rates
  - API p95 latency via Grafana dashboards
  - User feedback via Coforma (`https://coforma.madfam.io`)
- [ ] Triage and fix critical bugs daily.
- [ ] Collect qualitative feedback through direct conversations with early users.

### Week 7-8: Public Launch Mexico

**Goal:** Open registration and enable all payment methods.

- [ ] Remove invite-only restriction.
- [ ] Enable all plan tiers: Community, Essentials, Professional, Family.
- [ ] Enable OXXO and SPEI payment methods in Stripe MX dashboard.
- [ ] Publish app to App Store and Play Store (or open from TestFlight to production).
- [ ] Activate PostHog session recording for UX analysis.
- [ ] Submit the app to Mexican fintech media and communities:
  - Finnovista ecosystem
  - Mexican fintech Slack/Discord communities
  - ProductHunt (schedule launch)
- [ ] Set up automated alerts:
  - Error rate > 1% triggers PagerDuty
  - p95 latency > 1.5s triggers Slack warning
  - Belvo/Plaid webhook failures trigger investigation

### Month 2-3: US Expansion

**Prerequisites:** Plaid production access approved.

- [ ] Enable Plaid integration in production environment variables.
- [ ] Update onboarding flow to detect US-based users and offer Plaid connections.
- [ ] Enable USD currency formatting and US tax category mappings.
- [ ] Billing: US users continue on Stripe MX (Stripe is cross-border capable) or migrate to Stripe US if needed.
- [ ] Localization: ensure all strings are in English (already the default for non-MX locales).

### Month 3+: Global Expansion

**Prerequisites:** Paddle seller approval.

- [ ] Enable Paddle as the billing provider for non-MX users.
- [ ] Paddle acts as merchant of record, handling VAT/GST collection globally.
- [ ] Enable PT-BR locale for Brazilian users.
- [ ] Evaluate additional financial data providers for Brazil (e.g., Belvo Brazil, Pluggy).
- [ ] Monitor Paddle conversion rates and compare with Stripe MX performance.

---

## 9. Launch Checklist

### Legal and Compliance

- [ ] RFC registration complete
- [ ] Acta Constitutiva executed and registered
- [ ] IMPI trademark application filed (Class 36 + Class 42)
- [ ] D-U-N-S number assigned
- [ ] Written legal opinion on CNBV/Ley Fintech compliance obtained
- [ ] Aviso de Privacidad published at `/privacy`
- [ ] Terms of Service published at `/terms`
- [ ] Cookie Policy published at `/cookies`
- [ ] Security Page published at `/security`
- [ ] All legal documents reviewed by Mexican counsel

### External Accounts

- [ ] Janua OIDC client configured (production redirect URIs)
- [ ] Stripe MX account activated with products and prices created
- [ ] Conekta architecture confirmed (Janua-routed or standalone)
- [ ] Paddle seller approval received and plans configured
- [ ] Belvo production access granted
- [ ] Plaid production access granted
- [ ] Bitso API key generated (read-only)
- [ ] Zapper API key obtained
- [ ] Real estate valuation approach decided (Zillow alternative or manual)
- [ ] Banxico API token obtained
- [ ] PostHog project created and keys distributed
- [ ] Sentry projects created (web + API)
- [ ] Email provider configured with SPF/DKIM/DMARC verified
- [ ] OneSignal app created with APNs + FCM configured

### Infrastructure

- [ ] PostgreSQL provisioned, migrations applied, backups verified
- [ ] Redis provisioned and accessible
- [ ] All K8s secrets populated (`dhanam-secrets`, `dhanam-billing-secrets`)
- [ ] `ghcr-credentials` ImagePullSecret created in `dhanam` namespace
- [ ] DNS CNAME records configured for all 5 domains
- [ ] Email DNS records (SPF, DKIM, DMARC) configured and verified
- [ ] TLS certificates provisioned via Cloudflare
- [ ] Enclii auto-deploy verified (push to main triggers deployment)
- [ ] Health checks passing: `/api/health` on web, API health endpoint
- [ ] Prometheus ServiceMonitor scraping `/metrics`
- [ ] Grafana dashboards accessible and showing data
- [ ] Alertmanager configured with Slack/PagerDuty receivers

### Mobile

- [ ] Apple Developer Program enrollment complete
- [ ] App Store Connect listing created with metadata and screenshots
- [ ] Google Play Developer account registered
- [ ] Play Console listing created with Data Safety section complete
- [ ] EAS production build succeeds for iOS
- [ ] EAS production build succeeds for Android
- [ ] iOS app submitted and approved by Apple
- [ ] Android AAB uploaded and approved by Google
- [ ] Push notifications working via OneSignal (both platforms)
- [ ] Deep links verified (app opens from `https://app.dhan.am` links)

### Web Application

- [ ] Production build deploys without errors
- [ ] All environment variables set correctly
- [ ] Janua SSO login flow works end-to-end
- [ ] TOTP 2FA enrollment and verification working
- [ ] Belvo widget loads and creates connections (sandbox or production)
- [ ] Stripe checkout flow completes for all plan tiers
- [ ] Paddle checkout flow completes for global users
- [ ] OXXO and SPEI payment methods functional (Stripe MX)
- [ ] PostHog events firing correctly (verify in PostHog dashboard)
- [ ] Sentry capturing errors (trigger a test error and verify)
- [ ] i18n working for ES, EN, and PT-BR locales
- [ ] Cookie consent banner appears on first visit
- [ ] Admin SRE ops center accessible at `/admin`
- [ ] GDPR/LFPDPPP data export and deletion working
- [ ] 404 and error pages render correctly
- [ ] Responsive design verified on mobile breakpoints
- [ ] Lighthouse score > 90 for performance, accessibility, best practices

### Pre-Launch Verification

- [ ] Load test: simulate 100 concurrent users, verify p95 < 1.5s
- [ ] Webhook HMAC verification tested for all providers
- [ ] Provider failover tested (disable Belvo, verify graceful degradation)
- [ ] Backup restoration tested (restore from backup, verify data integrity)
- [ ] Rollback procedure documented and tested (revert to previous deployment)
- [ ] Incident response contacts identified and on-call schedule set
- [ ] Monitoring dashboards bookmarked and accessible to the team
- [ ] Launch day communication plan ready (social media, email, community posts)
