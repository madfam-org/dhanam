# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **CRITICAL**: Fix type confusion via parameter tampering in search controller (`@Query('q')` could return `string[]`) — CodeQL #104
- **HIGH**: Fix polynomial ReDoS in billing-sdk `baseUrl` trailing-slash stripping — CodeQL #116
- **HIGH**: Fix tainted format string in demo-data builder logging — CodeQL #132
- **MODERATE**: Update `ajv` override to `>=8.18.0` — CVE-2025-69873 (ReDoS)
- **MODERATE**: Add `file-type` override `>=21.3.2` — CVE-2026-31808, CVE-2026-32630 (also resolves Trivy alerts #129, #133)
- **LOW**: Add `@tootallnate/once` override `>=3.0.1` — CVE-2026-3449

### Fixed

- CI: Regenerate `pnpm-lock.yaml` after sequential Dependabot merges (#232, #238, #242) caused lockfile desync
- P1: SSO login yields empty dashboard — race condition between space loading and page rendering
  - Dashboard layout now calls `useSpaces()` early so child pages have data before rendering
  - Dashboard page shows loading skeleton while spaces load instead of empty state
  - Removed synthetic space ID from JanuaAuthBridge (caused ID mismatch with API)
  - API JIT provisioning wraps user + space creation in `$transaction` to prevent orphaned users
- P1: Accounts page blank on API error — added `isError` handling with retry UI
- P1: Budgets page blank on API error — added `isError` handling with retry UI
- P1: Zero-based budget error state too strict — relaxed from auth-only to any error in demo mode
- P1: Households page silent error catching — added `loadError` state with retry UI
- P1: Estate Planning page silent error catching — added `loadError` state with retry UI
- P2: Missing `action.categorize` i18n key on Transactions page (EN/ES/PT-BR)
- P2: Missing 7 notification i18n keys in EN and ES (`common` namespace)
- P2: Added `loadFailed` error key to all 3 locales for shared error UI

### Added

- **Compliance document ingestion pipeline** (`POST /v1/compliance/ingest`): Native PDF/image extraction pipeline for transactional documents. Uses GPT-4o-mini vision for structured metadata extraction (date, amount, merchant, RFC, CFDI UUID, line items). Falls back automatically to **Selva** (agentic inference router) for complex or unrecognized formats. Uploads originals to Cloudflare R2 under tier-based retention prefixes (admin → 20 years, premium → 10 years, pro → 7 years). Dispatches structured transaction metadata to **Karafiel** for one-to-one compliance sealing and NOM-151 provenance anchoring. Results persisted in new `ComplianceRecord` model.
- **`ComplianceRecord` database model**: Tracks document key, Karafiel seal ID (1:1), retention policy label, and extraction state (`NATIVE_SUCCESS`, `SELVA_PROCESSED`, `FAILED`).
- **`KarafielService`**: Sends extracted transaction metadata + R2 provenance URI to Karafiel's compliance API. Degrades gracefully with a `PENDING-*` mock receipt when `KARAFIEL_API_KEY` is not configured.
- **`DocumentExtractionService`**: Dual-engine document parser with native OpenAI vision extraction and automatic Selva fallback (confidence threshold 0.5).
- **`@fastify/multipart` registration**: Multipart/form-data support added to the Fastify bootstrap (25 MB limit, 1 file per request).
- **Login page UX**: Removed duplicate "Sign Up" link below Janua SSO widget.
- **Sign out fix**: Dashboard header logout now calls Janua's `signOut()` to correctly destroy the SSO session, preventing automatic re-login.

- **Analytics wiring**: PostHog event tracking wired into 12 frontend components — login (identifyUser), register (trackSignUp), logout (posthog.reset), onboarding steps, provider connections (Belvo/Plaid/Bitso), dashboard (trackViewNetWorth), category correction (trackTxnCategorized), budget creation (trackBudgetCreated)
- **Lifecycle drip campaigns**: Automated email sequences via `DripCampaignTask` with 2 daily cron jobs — activation drips (day 1/3/7/14) and re-engagement drips (day 7/14 inactive). Backed by `DripEvent` Prisma model with idempotent unique constraint, 6 Handlebars templates, and PostHog tracking
- **Auth provider separation (A1-A2)**: Extracted auth logic into `AuthProvider`/`MfaProvider` interfaces with `LocalAuthProvider` and `JanuaAuthProvider` implementations. `AUTH_MODE` env var (`local`|`janua`) selects the active provider at module init. `JwtAuthGuard` tries Janua RS256 first, falls back to local HS256 for demo/guest tokens. Security settings page links to Janua account in SSO mode. Frontend `auth.ts` supports both local and Janua auth endpoints
- Golden-ratio design token system for UI consistency
- Cookie consent banner (GDPR/LATAM compliance) in root layout
- Mobile hamburger menu on landing page navigation
- Custom 404 page with back-to-home link
- Confirm password field on registration form with match validation
- Explicit `<meta charset="utf-8" />` in root layout for PT-BR diacritics

### Fixed

- Billing success page `trackUpgradeCompleted` sending hardcoded `price: 0` — now reads from URL query params with fallback to plan default
- Security settings page violating React rules of hooks — hooks called after early return for Janua mode; moved hooks above conditional return
- RangeError in Bitso webhook signature verification
- www.dhan.am redirect including port number (`url.host` → `url.hostname`)
- Duplicate H1 on landing page (nav brand changed from `<h1>` to `<span>`)
- CSP blocking Cloudflare Insights (`script-src` and `connect-src` updated)
- useAuth hydration timeout using `requestIdleCallback` instead of `setTimeout`

## [0.2.0] - 2025-01-24

### Added

#### AI-Driven Categorization

- Machine learning-based transaction categorization with learning loop
- Fuzzy matching with Levenshtein distance for merchant normalization
- User correction aggregator with weighted scoring
- Nightly ML retrain processor via BullMQ
- Category correction API endpoints

#### DeFi/Web3 Portfolio Tracking

- Zapper API integration for DeFi position tracking
- Support for 10+ protocols: Uniswap V2/V3, Aave V2/V3, Compound, Curve, Lido, Yearn, Maker, Convex, Balancer, SushiSwap
- Multi-chain support: Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, BSC
- Position types: liquidity-pool, lending, borrowing, staking, farming, vault
- Net worth integration with protocol-level breakdown

#### Life Beat Dead Man's Switch

- 30/60/90 day escalation system for estate planning
- Configurable check-in intervals (weekly, biweekly, monthly)
- Designated executor notification workflow
- Emergency access grants for beneficiaries
- Integration with existing estate planning module

#### Zillow Real Estate Integration

- Address lookup and property search API
- Automated Zestimate valuations for real estate assets
- Historical valuation trends from Zillow
- Auto-update manual asset values via cron job

#### Long-Term Cashflow Projections

- 10-30 year projection engine for retirement planning
- Monte Carlo simulation integration (existing package)
- Life event timeline modeling (retirement, college, home purchase)
- Income growth and inflation assumptions
- What-if scenario analysis with comparison views

#### Yours/Mine/Ours Views

- Ownership filtering for household accounts
- Net worth breakdown by ownership type
- Multi-member household financial separation
- Asset assignment interface

#### Document Upload to R2

- Cloudflare R2 storage integration for asset attachments
- Presigned URL generation for secure uploads
- Support for appraisals, deeds, certificates, purchase agreements
- Document metadata and categorization

#### Enhanced Analytics & Reporting

- New chart components: net worth trends, income/expense, spending breakdown, portfolio allocation
- Excel export alongside existing CSV/PDF formats
- Scheduled report email delivery (weekly, monthly)
- Connection health monitoring with 15-minute cron checks
- Provider status dashboard with error messages and rate limiting info

### Changed

- Upgraded categorization engine to use ML-first approach with rule fallback
- Enhanced wealth dashboard with DeFi positions integration
- Improved estate planning module with Life Beat section

### Technical

- Added `@dhanam/defi-adapter` package for Zapper integration
- New BullMQ queues: `ml-retrain`, `life-beat-check`, `zillow-valuation`
- R2 storage configuration in infrastructure
- Extended manual assets API for Zillow and document uploads

## [0.1.0] - 2024-11-27

### Added

- **Dhanam** - Personal Wealth Tracking Platform
- `/demo` route with interactive demo mode
- Multi-currency support (MXN, USD primary)
- ESG crypto scoring for sustainable investments
- Bank account integration via Belvo/Plaid
- Crypto exchange integration via Bitso
- Budget tracking with customizable rules
- Net worth calculation and trending
- Transaction categorization (auto + manual)
- Bilingual interface (Spanish/English)
- Janua OAuth integration for SSO
- React Native mobile app foundation

### Security

- JWT authentication with refresh tokens
- Two-factor authentication (2FA)
- AES-256 encryption for sensitive data
- Argon2id password hashing
- Row-level security in PostgreSQL

### Technical

- Next.js 14 with App Router
- PostgreSQL with Prisma ORM
- Redis for session management
- Swagger API documentation at `/docs`
- 80%+ test coverage target
- Docker containerization
- CI/CD with GitHub Actions

### LATAM Focus

- MXN as primary currency
- Mexican bank integrations
- Spanish-first localization
- Regional tax considerations
