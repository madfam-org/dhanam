# Runbook: Flip `FEATURE_STRIPE_MXN_LIVE` (enable live MXN processing)

**Last Updated:** 2026-06-13
**Owner:** Billing on-call + finance approver
**Gate:** First-Pesos G5/G6/G7. This is the single switch between "monetization
spine live" and "live pesos can clear."

> [!WARNING]
> Today `FEATURE_STRIPE_MXN_LIVE=false` in `infra/k8s/production/api-deployment.yaml`.
> Livemode Stripe events are ACK'd but **not processed** (see the guardrail in
> `apps/api/src/modules/billing/services/stripe-mx-spei-relay.service.ts`). The
> in-code comment is explicit: _flip to `true` only after a successful test SPEI →
> Karafiel CFDI emit roundtrip on live keys._ Do not flip early — a preview/staging
> env processing a live event is a material compliance break.

## Preconditions (ALL true before flipping)

- [ ] Ledger substrate is HA: Postgres CNPG cutover done + restore drill green
      (First-Pesos blocker #1; `enclii/docs/runbooks/POSTGRES_HA_CUTOVER.md`).
- [ ] Stripe MX **live** keys provisioned into Vault → ESO (never in chat/commits):
      `STRIPE_MX_SECRET_KEY`, `STRIPE_MX_WEBHOOK_SECRET`, live price IDs.
- [ ] Production catalog synced (TD-1014): GitHub Production env populated;
      `scripts/sync-catalog.ts` run against prod; `GET https://api.dhan.am/v1/billing/catalog`
      shows the target SKU at the intended MXN price.
- [ ] **Test-key roundtrip passed** (the documented guardrail): sandbox SPEI/card →
      webhook → one idempotent `BillingEvent` → entitlement activation → Karafiel
      CFDI emit (TD-1010). Captured as evidence.
- [ ] `STAGING_COMMERCIAL_STRICT=true` staging smoke is green (TD-1009).
- [ ] Live Stripe webhook endpoint registered → `https://api.dhan.am/...` (the MX
      relay path; see `runbooks/2026-05-04-stripe-webhook-registration` in internal-devops).
- [ ] Synthetic revenue probe + hourly revenue-loop probe ready to enable.

## Flip procedure (one service, guardrailed)

1. Set `FEATURE_STRIPE_MXN_LIVE: "true"` in `infra/k8s/production/api-deployment.yaml`.
   Keep `preview`/`staging` overlays at `false` (they force it off by design).
2. Ship via the normal GitOps path (push → CI → digest → ArgoCD sync), or
   `enclii deploy --env production` where the adapter exists. Do **not** hand-edit
   the live cluster outside GitOps.
3. Confirm the rollout: `GET https://api.dhan.am/health/full` green; relay logs
   show livemode events now **processed** (no "FEATURE_STRIPE_MXN_LIVE is off" warnings).

## First live transaction (G5 → G7)

1. Freeze scope: ONE SKU (`karafiel__contador`), ONE buyer, card-first.
2. **G5** — live checkout opens with correct SKU/price/currency/metadata/provider.
3. **G6** — payment success maps to exactly one durable `BillingEvent`/ledger row;
   re-deliver the webhook and confirm idempotency (no duplicate revenue).
4. **G7** — paid tier/credits activate; the signed product webhook reaches Karafiel
   (CFDI) / the consumer, or the DLQ captures a replayable failure.

## Prove pesos (G8 → G9) — do not declare first pesos before this

- **G8** BBVA payout packet: provider payment id, payout id, gross/fees/net MXN,
  arrival timestamp, reconciliation = `matched`.
- **G9** Converge evidence import: revenue snapshot with evidence rows > 0, sample
  data disabled.

## Rollback

- Set `FEATURE_STRIPE_MXN_LIVE: "false"` and sync. Livemode events return to
  ACK-without-process (no data loss; webhooks are idempotent and replayable).
- If a duplicate or mis-charged row appears, use the DLQ replay endpoints and the
  refund path; record in the incident log.

## References

- Gate framework: `docs/FIRST_PESOS_COMMERCIAL_GA_MONETIZATION_2026-06-01.md`
- Guardrail code: `apps/api/src/modules/billing/services/stripe-mx-spei-relay.service.ts`
- Prod flag: `infra/k8s/production/api-deployment.yaml`
- DLQ drill: `docs/runbooks/COMMERCIAL_DLQ_DRILL.md`
