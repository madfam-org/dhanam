# Monetization Session — Agent Entrypoint

**Last Updated:** 2026-06-16  
**Scope:** Open **dhanam alone** for monetization engineering. This file is the
single in-repo routing index — read it before GA/stability docs unless the task
is explicitly stability-only.

## Position

Dhanam is the ecosystem **cash register**: sole Stripe-key holder, catalog/checkout/
ledger/entitlement authority, and billing rails every product sells through. Code
readiness is **high**; first-revenue readiness is **medium-low** because binding
constraints are operational (secret store, Stripe MX live, BBVA payout), not missing
CRUD.

The fastest meaningful first peso is a **high-ticket B2B SKU on Dhanam rails**
(`karafiel__contador`, MXN 1,299/mo), not the low-ticket consumer tiers.

## Read order (monetization sessions)

1. **`AGENTS.md`** — operating doctrine, side-effect guards, Janua/Enclii contracts.
2. **This file** — session routing and repo vs private ops boundary.
3. **[MONETIZATION_PATH_READINESS.md](MONETIZATION_PATH_READINESS.md)** — current
   gate table (G0–G9 slice Dhanam owns), shipped work, ranked open tasks.
4. **[FIRST_PESOS_COMMERCIAL_GA_MONETIZATION_2026-06-01.md](FIRST_PESOS_COMMERCIAL_GA_MONETIZATION_2026-06-01.md)** —
   full G0–G9 framework and first-peso proof requirements.
5. Task-specific runbooks and modules (below).

For stability-only work (unrelated to revenue), use
[GA_REMEDIATION_ROADMAP.md](GA_REMEDIATION_ROADMAP.md) instead of this index.

## In-repo execution map

| Task                               | Start here                                                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate status + ranked backlog       | [MONETIZATION_PATH_READINESS.md](MONETIZATION_PATH_READINESS.md)                                                                                         |
| G0–G9 framework + proof bar        | [FIRST_PESOS_COMMERCIAL_GA_MONETIZATION_2026-06-01.md](FIRST_PESOS_COMMERCIAL_GA_MONETIZATION_2026-06-01.md)                                             |
| Flip live MXN checkout             | [runbooks/STRIPE_MXN_LIVE_FLIP.md](runbooks/STRIPE_MXN_LIVE_FLIP.md)                                                                                     |
| Staging commercial smoke (WS1–WS6) | [COMMERCIAL_GA_EXECUTION.md](COMMERCIAL_GA_EXECUTION.md)                                                                                                 |
| Catalog authoring + sync           | [`catalog.yaml`](../catalog.yaml), [`scripts/sync-catalog.ts`](../scripts/sync-catalog.ts), [CATALOG_TRUTH_2026-05-20.md](CATALOG_TRUTH_2026-05-20.md)   |
| Billing API + webhooks             | [apps/api/src/modules/billing/README.md](../apps/api/src/modules/billing/README.md), [packages/billing-sdk/README.md](../packages/billing-sdk/README.md) |
| Production checkout UI             | `apps/web` — `/pricing`, `/register`, billing checkout routes                                                                                            |
| Active monetization debt           | [TECH_DEBT.md](TECH_DEBT.md) — TD-1009, TD-1010, TD-1014                                                                                                 |
| Tulana SKU handoff                 | [TULANA_SKU_AND_CATALOG_HANDOFF_2026-05-29.md](TULANA_SKU_AND_CATALOG_HANDOFF_2026-05-29.md)                                                             |
| DLQ / replay drill                 | [runbooks/COMMERCIAL_DLQ_DRILL.md](runbooks/COMMERCIAL_DLQ_DRILL.md)                                                                                     |
| Break-glass (Enclii gap)           | [runbooks/BREAK_GLASS.md](runbooks/BREAK_GLASS.md)                                                                                                       |

## Code anchors

```
catalog.yaml                          # SKU source of truth (authoring)
scripts/sync-catalog.ts               # Stripe + DB catalog sync
apps/api/src/modules/billing/         # Checkout, ledger, webhooks, entitlements
apps/web/src/app/                     # Public pricing + register funnel
packages/billing-sdk/                 # Ecosystem billing client
infra/k8s/production/                 # Deploy manifests (ExternalSecret commented — see ops)
```

Verify catalog edits:

```sh
npx tsx scripts/sync-catalog.ts --dry-run
```

## Private ops boundary (not in this repo)

Routine production cutover, Vault/ESO remediation, and cross-repo sequencing live
in **`internal-devops`**. Open that repo (alone or beside dhanam) when the session
touches Phase 0 platform blockers or operator cutover — not for app feature work.

| Aspect                               | Canonical private path                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| **Private ops session entrypoint**   | `internal-devops/runbooks/MONETIZATION_OPS_SESSION.md`                                       |
| Cross-repo first-peso sequencing     | `internal-devops/roadmaps/2026-06-13-first-pesos-execution-roadmap.md`                       |
| Operator cutover (Phases 0–5)        | `internal-devops/runbooks/2026-06-14-dhanam-first-peso-cutover.md`                           |
| Secret-store degradation             | `internal-devops/runbooks/2026-06-13-dhanam-secrets-degradation-incident.md` (**MITIGATED**) |
| Phase 0 recovery record (2026-06-16) | `internal-devops/runbooks/2026-06-16-dhanam-secrets-recovery-session.md`                     |
| Full ecosystem money architecture    | `internal-devops/ecosystem/monetization-architecture-2026-04-26.md`                          |

**Phase 0 gate (2026-06-16):** Secret store **restored** — `dhanam-api` 2/2,
`/health/full` green. **Phase 1** (Stripe MX KYC + BBVA payout) is the next gate.
Private detail: `internal-devops/runbooks/2026-06-16-dhanam-secrets-recovery-session.md`.

## Adjacent repos (pull in only when needed)

| Repo                | When                                                         |
| ------------------- | ------------------------------------------------------------ |
| `internal-devops`   | Vault/secrets restore, first-peso cutover, Stripe MX KYC ops |
| `tulana`            | G1 pricing evidence finalization                             |
| `karafiel`          | TD-1010 CFDI staging proof                                   |
| `solarpunk-foundry` | `@madfam/webhook-attribution` shared contract                |
| `enclii`            | Platform GA, Postgres HA — not first-peso product work       |
| `janua`             | Auth/OAuth only — never holds money                          |

## Session routing (quick)

| You are…                                           | Primary repo                                  |
| -------------------------------------------------- | --------------------------------------------- |
| Shipping checkout, billing, catalog, entitlements  | **dhanam** (this file)                        |
| Fixing Vault / restoring secrets / running cutover | **internal-devops** + dhanam for verification |
| Finalizing SKU prices                              | **tulana** → apply in dhanam `catalog.yaml`   |

## Related public docs

- [docs/README.md](README.md) — full documentation map
- [llms.txt](../llms.txt) — compact LLM index (monetization-first)
- [llms-full.txt](../llms-full.txt) — durable agent context map
