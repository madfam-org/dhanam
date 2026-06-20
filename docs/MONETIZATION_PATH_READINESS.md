# Monetization-Path Readiness — Dhanam

**Last Updated:** 2026-06-19  
**Agent entrypoint:** [`MONETIZATION_SESSION.md`](MONETIZATION_SESSION.md) — read that
file first for session routing and the private ops boundary.

**Scope:** Dhanam's execution slice toward first MXN revenue. Pairs with
`docs/FIRST_PESOS_COMMERCIAL_GA_MONETIZATION_2026-06-01.md` (the G0–G9 gate
framework) and the cross-repo sequence in
`internal-devops/roadmaps/2026-06-13-first-pesos-execution-roadmap.md`.

## Position

Dhanam is the ecosystem **cash register**: the only holder of payment-processor
keys, the catalog/checkout/ledger/entitlement authority, and the billing rails
every other product sells through. The 2026-06-13 review verdict: **code
readiness HIGH, first-revenue readiness MEDIUM-LOW** — the binding constraints
are operational, not missing CRUD.

## Strategic call: first peso ≠ Dhanam consumer SKU

The fastest meaningful first peso is a **high-ticket B2B SKU on the Dhanam
rails**, per the First-Pesos slate:

| Priority    | SKU                  | Price        | Note                                               |
| ----------- | -------------------- | ------------ | -------------------------------------------------- |
| P1          | `karafiel__contador` | MXN 1,299/mo | High-value MX B2B (SAT/CFDI/RFC)                   |
| P1 fallback | `coforma__startup`   | MXN 999/mo   | Warm CAB/PMF buyer                                 |
| Smoke only  | `dhanam__pro`        | MXN 299/mo   | `plumbing_smoke_only` — not a first-revenue anchor |

Dhanam's own consumer tiers still get productized (see SKU work below), but they
are Phase 1, not the first transaction.

## Shipped 2026-06-13 (this repo)

- **Free tier added to `catalog.yaml`** (`dhanam.tiers.free`, `dhanam_tier: community`,
  `prices: {}`): the acquisition funnel the consumer SKU ladder was missing.
  Eng follow-up: enforce the 1-space / 2-sims-day / 1-bank-connection caps via
  the existing `usage-limit.guard` / `feature-gate.guard`.
- **Prisma `SubscriptionTier` comments corrected** to match catalog truth
  (essentials 4.99/79, pro 14.99/299, premium 29.99/599). Comment-only; no migration.

## Shipped 2026-06-19 (sprint — this repo)

- **Route recommendation catalog amount** — `GET /billing/checkout/route-recommendation`
  now resolves `amountMinor` from `product_prices.amount_cents` when `plan` + `product`
  are supplied (Essentials → 7900 centavos, not the legacy 19900 default). Fee previews
  and preflight scripts align with live checkout pricing.
- **Preflight hardening** — `scripts/essentials-purchase-preflight.sh` checks
  `STRIPE_MX_*` + `DHANAM_WEBHOOK_SECRET` on prod pods; asserts `amountMinor=7900`.
- **Sprint orchestration** — `internal-devops/scripts/run-first-peso-sprint-verify.sh`
  and `internal-devops/runbooks/2026-06-19-first-peso-sprint-execution.md`.

## Shipped 2026-06-17 (platform ops — Essentials anchor)

- **`FEATURE_STRIPE_MXN_LIVE=true`** on prod; preflight 10/10 pass.
- Billing fixes #571–#573 promoted; Karafiel CFDI bridge merged (#62).
- **Binding gate shifted to Karafiel:** CSD upload + `FEATURE_CFDI_AUTO_ISSUE` flip.

## Shipped 2026-06-16 (platform ops — private record)

- **Phase 0 secret store restored** — `dhanam-secrets` sync green, `dhanam-api`
  **2/2**, `/health/full` healthy. Operator detail (Vault paths, break-glass steps):
  `internal-devops/runbooks/2026-06-16-dhanam-secrets-recovery-session.md`.
- **No dhanam repo change required** for Phase 0; durable Enclii ExternalSecret
  manifests land in `enclii/infra/k8s/base/external-secrets/vault-secrets/`.

## Shipped 2026-06-14 (this repo)

- **Production checkout funnel** — public, catalog-driven `/pricing` page + a
  plan-aware `/register` handoff, and the "Try Live Demo" CTA now opens the
  persona picker instead of auto-launching the guest dashboard (#522, #524).
  This closes the long-standing production-checkout-UI gap.
- **MX-only global Stripe routing** — `sync-catalog.ts` + the gateway registry
  route non-MXN through the MX account until Paddle is configured (#518); an
  in-cluster `dhanam-catalog-sync` job runs the catalog sync where it can reach
  the database (#521).
- **API hardened** — `strictNullChecks` enabled with 46 null-safety fixes (#525)
  and the TypeScript 6 upgrade on top (#526).

> **Immediate gate (operational, not code):** Phase 0 secret store **MITIGATED**
> (2026-06-16). **Phase 1** is now the binding gate: Stripe MX KYC + BBVA payout,
> then catalog sync and `FEATURE_STRIPE_MXN_LIVE`. Private sequencing:
> `internal-devops/runbooks/2026-06-14-dhanam-first-peso-cutover.md` and
> `runbooks/2026-06-16-dhanam-secrets-recovery-session.md`.

## Gates Dhanam owns (G0–G9)

| Gate                     | Status | Dhanam action to close                                                              |
| ------------------------ | ------ | ----------------------------------------------------------------------------------- |
| G0 Catalog truth         | Ready  | Keep `catalog.yaml` the single source; re-run `sync-catalog.ts` after the Free tier |
| G1 Pricing evidence      | Ready  | Apply Tulana proposals (see `tulana/docs/dhanam-pricing-readiness-2026-06-13.md`)   |
| G5 Live checkout         | READY  | Flag live; authenticated checkout smoke + one live charge remain (sprint Step 5)    |
| G6 Payment + ledger      | OPEN   | Prove one idempotent `BillingEvent` per payment on live Essentials charge           |
| G7 Entitlement + fan-out | OPEN   | Karafiel CSD upload + CFDI flip (sprint Steps 1–3); then live CFDI UUID (TD-1010)   |

(G2–G4 Selva/PhyndCRM, G8 BBVA, G9 Converge are owned outside this repo.)

## Open Dhanam tasks (ranked)

1. **Karafiel CFDI go-live (binding)** — CSD upload → `cfdi-go-live-flip.sh flip` → webhook smoke → staging/live CFDI UUID. Sprint: `internal-devops/runbooks/2026-06-19-first-peso-sprint-execution.md`.
2. **Live Essentials charge** — one real MXN card through `POST /v1/billing/upgrade`; verify G6/G7 evidence.
3. **Production catalog/Stripe sync (TD-1014):** populate the GitHub Production env
   (`DATABASE_URL` + Stripe secrets) and run `scripts/sync-catalog.ts` against prod.
4. **Adopt `@madfam/webhook-attribution`** in `MadfamEventsController` for the
   inbound RouteCraft fan-out (replaces bespoke HMAC handling; idempotency by `event_id`).
5. **Close Karafiel CFDI staging proof (TD-1010)** so MXN B2B charges emit a CFDI egreso.
6. **Mercado Pago gap:** referenced ecosystem-wide but not implemented in Dhanam.
   Decide build-vs-defer; until built, do not advertise MP as a checkout path.
7. **Enable `STAGING_COMMERCIAL_STRICT=true` (TD-1009)** so staging hard-gates before prod promote.

## SKU architecture (consumer, MXN)

| Tier       | MXN/mo | MXN/yr | dhanam_tier | Role                     |
| ---------- | ------ | ------ | ----------- | ------------------------ |
| Free       | 0      | 0      | community   | Acquisition funnel (NEW) |
| Essentials | 79     | 759    | essentials  | Entry paid               |
| Pro        | 299    | 2,868  | pro         | Mid (billing-smoke)      |
| Premium    | 599    | 5,752  | premium     | Top self-serve           |

`founding_member_mx` (40% off, 12 mo) is the launch coupon. Finalize/validate via
Tulana before locking — see the Tulana readiness doc.

## Verify

```sh
# After editing catalog.yaml:
npx tsx scripts/sync-catalog.ts --dry-run
```
