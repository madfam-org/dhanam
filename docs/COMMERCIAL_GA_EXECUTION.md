# Commercial GA Execution Plan (G2)

Last updated: 2026-06-12

This is the **operator and engineering runbook** for reaching MADFAM billing
commercial GA (gate **G2**). It complements the program overview in
[GA Remediation Roadmap](GA_REMEDIATION_ROADMAP.md) and the capability tracker in
[Commercial Stability Roadmap](COMMERCIAL_STABILITY_ROADMAP.md).

**Scope:** Commercial / platform billing GA only. Consumer product GA (G3) and
full technical-stability sign-off (G1/M7) are tracked separately.

**G2 scope decision (default):** **Scope A** — Stripe MX + Paddle are in GA;
Conekta direct is integration-ready but not launched until Phase 3C proof is
recorded. Janua-routed billing remains disabled (`JANUA_BILLING_ENABLED=false`).
All PSP adapters implement `PaymentGatewayPort` via `PaymentGatewayRegistry`
(see [ADR-008](adr/008-integration-planes-janua-vs-direct.md)).

---

## Workstream status

| WS    | Name                           | Status (2026-06-12) | Next action                                             |
| ----- | ------------------------------ | ------------------- | ------------------------------------------------------- |
| 0     | Rollout truth                  | In progress         | Enclii vs Argo decision + three promote cycles          |
| **1** | **Deploy & prove routing/POS** | **In progress**     | Enable `STAGING_COMMERCIAL_STRICT=true` + admin secrets |
| 2     | POS completion + CFDI          | **In progress**     | Staging charge smoke + Karafiel CFDI on timeline        |
| 3     | Golden probes + DLQ drills     | **In progress**     | CI envelope probe green; staging DLQ drill execution    |
| 4     | Conekta parity (Scope B)       | Deferred (Scope A)  | Revisit after G2 Scope A sign-off                       |
| 5     | SDK + docs + semantics         | **In progress**     | Billing README + fee schedule docs synced with source   |
| 6     | G2 sign-off evidence           | Not started         | Commercial drill log after staging soak                 |

---

## WS1 — Deploy & prove (weeks 1–2)

### Automated smoke

After every staging deploy, CI runs the **public tier** of
[`scripts/staging-commercial-smoke.sh`](../scripts/staging-commercial-smoke.sh).

| Tier          | Checks                                                                   | CI default               |
| ------------- | ------------------------------------------------------------------------ | ------------------------ |
| Public        | `/health`, `/v1/billing/catalog`, `/v1/billing/pricing`, admin 401 gates | Always runs              |
| Admin         | route preview, reconciliation, timeline                                  | Requires GitHub secrets  |
| Charge/refund | Stripe test PaymentIntent + refund                                       | Opt-in via repo variable |

**GitHub configuration (optional, enables full WS1 admin tier):**

| Name                                | Type     | Purpose                                          |
| ----------------------------------- | -------- | ------------------------------------------------ |
| `STAGING_COMMERCIAL_ADMIN_TOKEN`    | Secret   | Platform-admin JWT for staging API               |
| `STAGING_COMMERCIAL_SMOKE_USER_ID`  | Secret   | Existing staging user id (MX or US)              |
| `STAGING_COMMERCIAL_CHARGE_ENABLED` | Variable | Set `true` when Stripe test keys work on staging |
| `STAGING_COMMERCIAL_STRICT`         | Variable | Set `true` to fail CI when admin secrets missing |

**Local run:**

```bash
STAGING_API_URL=https://staging-api.dhan.am \
  STAGING_COMMERCIAL_ADMIN_TOKEN='…' \
  STAGING_COMMERCIAL_SMOKE_USER_ID='…' \
  ./scripts/staging-commercial-smoke.sh
```

### Staging soak checklist (manual, before prod promote)

- [ ] Public commercial smoke green in latest `Deploy to Staging` run
- [ ] Admin `/pos` loads on `staging-admin.dhan.am`
- [ ] Route preview: MX → `stripe_mx`, US → `paddle` or `legacy_stripe`
- [ ] Fee schedule tab loads bundled JSON; override round-trip optional
- [ ] Landing `/` pricing block shows fee recommendation when geo cookie set
- [ ] `/billing/upgrade` instrument picker passes `paymentMethod` to checkout
- [ ] Operator checkout link creates session (sandbox)
- [ ] Reconciliation endpoint returns summary (may be zero flagged)
- [ ] Record staging deploy run id for promote workflow

### Production promotion (API then admin)

1. Run `scripts/production-preflight.sh`
2. Promote **API** digest with `staging_smoke_run_id` from soak
3. Run `scripts/production-rollout-proof.js` (or enable `ENCLII_ROLLOUT_PROOF_ENABLED`)
4. Promote **admin** digest
5. Re-run public commercial smoke against `https://api.dhan.am` (adapt `STAGING_API_URL`)
6. Update [Stability Wrap-Up](STABILITY_WRAP_UP_2026-05-20.md) if prod proof changes

---

## WS2 — POS completion + CFDI (weeks 2–4)

| Priority | Deliverable                              | Acceptance                                             |
| -------- | ---------------------------------------- | ------------------------------------------------------ |
| P0       | Partial refund amount in admin `/pos` UI | **Done** — optional `amountMinor` on refund form       |
| P0       | CFDI id in POS timeline                  | **Done (source)** — staging Karafiel proof pending     |
| P0       | Conekta path in `InternalPosService`     | Deferred (Scope A); gateway wired when selected        |
| P1       | `POST /admin/billing/route/override`     | **Done** — API + admin UI on Route Preview tab         |
| P1       | Fee schedule admin maintenance           | **Done** — GET/PUT/DELETE + admin Fee Schedule tab     |
| P1       | Web fee recommendations                  | **Done** — landing pricing + upgrade instrument picker |
| P1       | Staging + prod E2E for charge/refund     | **Partial** — API timeline/override/fee-schedule E2E   |

---

## WS3 — Webhooks, golden probes, DLQ (weeks 3–6)

### Golden probes (per launched product)

| Product  | Trigger                     | Verify            |
| -------- | --------------------------- | ----------------- |
| Karafiel | `payment.succeeded` MXN     | CFDI / ledger row |
| Cotiza   | Milestone metadata present  | Quote status      |
| PhyndCRM | `engagement_id` in metadata | Timeline event    |
| Tezca    | Catalog checkout            | Tier webhook      |

### DLQ drill

Document execution in `docs/runbooks/COMMERCIAL_DLQ_DRILL.md` (WS3 deliverable):

1. Inject failing consumer URL
2. Confirm DLQ row
3. Replay + resolve via admin `/webhook-dlq`
4. Confirm idempotency

---

## WS6 — G2 sign-off checklist

Use this table in the final GA review. Evidence column links to run logs or CI runs.

| ID   | Item                                    | Evidence                                        |
| ---- | --------------------------------------- | ----------------------------------------------- |
| G2-1 | Single routing policy in prod           | Staging matrix smoke + sample audit metadata    |
| G2-2 | POS charge, refund, timeline, reconcile | Commercial drill log                            |
| G2-3 | DLQ drill passed                        | `COMMERCIAL_DLQ_DRILL.md` execution record      |
| G2-4 | Golden probes green                     | CI / manual probe output per product            |
| G2-5 | Docs match production                   | Billing README + this file updated same release |
| G2-6 | No blocking High debt                   | TD-1009, TD-1010 closed or downgraded           |

---

## Weekly cadence (WS1 kickoff)

| Week    | Focus                                                    |
| ------- | -------------------------------------------------------- |
| **1**   | Commercial smoke in CI; staging soak; docs sync          |
| **2**   | Promote API/admin; prod public smoke; Scope A/B sign-off |
| **3–4** | WS2 CFDI + partial refund UI                             |
| **5–6** | WS3 probes + DLQ drill                                   |

---

## Related documents

- [GA Remediation Roadmap](GA_REMEDIATION_ROADMAP.md)
- [Commercial Stability Roadmap](COMMERCIAL_STABILITY_ROADMAP.md)
- [Tech Debt Register](TECH_DEBT.md) — TD-1009, TD-1010, TD-1011
- [Billing module README](../apps/api/src/modules/billing/README.md)
- [scripts/README.md](../scripts/README.md)

When WS status changes, update this file and the milestone table in
[GA Remediation Roadmap](GA_REMEDIATION_ROADMAP.md) in the same PR.
