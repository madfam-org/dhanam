# Session Wrap-Up — 2026-06-18

**Repos touched:** `madfam-org/dhanam`  
**Operator focus:** Owner–operator Capital Stack (RFC-6) — Phases 0–5 engineering complete; operator gates remain  
**Read next session with:** [OWNER_OPERATOR_CAPITAL_STACK.md](guides/OWNER_OPERATOR_CAPITAL_STACK.md), [OWNER_CAPITAL_KARAFIEL_OPS.md](runbooks/OWNER_CAPITAL_KARAFIEL_OPS.md), [owner-operator-capital-stack.md](rfcs/owner-operator-capital-stack.md)

---

## Executive summary

Shipped **RFC-6 Phases 0–5** in Dhanam: schema + API, web owner cockpit, admin review queue, detector + nightly backfill, Karafiel bridge (mock + live-ready), golden E2E, and staging detector flag. Production promoted via [PR #591](https://github.com/madfam-org/dhanam/pull/591) and [promote run #27784147909](https://github.com/madfam-org/dhanam/actions/runs/27784147909) (`f6b5379e`).

**Engineering is done.** Remaining work is **operator-gated** (Janua SSO, Karafiel live receiver, prod detector/Karafiel flags, staging web smoke). See [Operator-gated checklist](#operator-gated-checklist) below.

---

## Production state (verified 2026-06-18 evening)

| Surface            | URL / artifact                                      | Status                        |
| ------------------ | --------------------------------------------------- | ----------------------------- |
| API Capital Stack  | `https://api.dhan.am/v1/capital-stack/*`            | Live — JWT required           |
| Web cockpit        | `https://app.dhan.am/capital-stack`                 | Live (post #591 promote)      |
| Admin review queue | `https://admin.dhan.am/capital-stack`               | Live                          |
| ArgoCD             | `dhanam-services`                                   | Synced / Healthy @ `f6b5379e` |
| Prod digests       | API `fab24fe0…`, Web `5e6cf917…`, Admin `d24ddc9c…` | From staging promote          |

### Feature flags (production API)

| Flag                             | Prod value | Effect                                                 |
| -------------------------------- | ---------- | ------------------------------------------------------ |
| `FEATURE_CAPITAL_STACK_ENABLED`  | `true`     | User + admin capital-stack routes                      |
| `FEATURE_CAPITAL_STACK_KARAFIEL` | `false`    | Outbound Karafiel uses **mock** case IDs until flipped |
| `FEATURE_CAPITAL_STACK_DETECTOR` | `false`    | Real-time + backfill detection **off** until flipped   |

### Feature flags (staging API — in repo overlay)

| Flag                             | Staging value (overlay) | Notes                                     |
| -------------------------------- | ----------------------- | ----------------------------------------- |
| `FEATURE_CAPITAL_STACK_ENABLED`  | `true`                  |                                           |
| `FEATURE_CAPITAL_STACK_KARAFIEL` | `false`                 | Enable after Karafiel staging proof       |
| `FEATURE_CAPITAL_STACK_DETECTOR` | `true`                  | Pending merge/deploy of phases 3–5 branch |

### DB bootstrap (Innovaciones MADFAM)

| Item                                         | Status                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| `owner_operator` household                   | Applied                                                                           |
| `SpaceOperatorBinding`                       | Applied                                                                           |
| Account `capital_purpose` tags               | Applied — 51 personal / 18 owner_facility / 3 entity_operating on `Aldo Personal` |
| Migration `20260618000000_add_capital_stack` | Applied (manual bootstrap preceded `migrate deploy`)                              |

### Operator identities

| Email             | Role                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| `aldo@madfam.io`  | Beneficial owner — `Aldo Personal` + **admin** on `Innovaciones MADFAM` |
| `admin@madfam.io` | Entity operator — owns business spaces                                  |

Removed: `arantza.orquidea@gmail.com`. Retained: demo users + Tulana service account.

---

## What shipped (engineering)

| Phase | Scope                                                       | Key artifacts                                          |
| ----- | ----------------------------------------------------------- | ------------------------------------------------------ |
| 0     | Prod hygiene, account classify, bootstrap                   | `bootstrap-owner-operator-stack.ts`, prod DB           |
| 1     | Schema, API module, CRUD journal                            | `apps/api/src/modules/capital-stack/`                  |
| 2     | Owner cockpit, bulk classify                                | `apps/web/.../capital-stack/page.tsx`                  |
| 3     | Detector S2 pairing, txn hook, nightly backfill             | `CapitalFlowDetectorService`, `CapitalFlowBackfillJob` |
| 4     | Karafiel bridge, HMAC callbacks, admin queue + bridge audit | `KarafielCapitalBridgeService`, admin `/capital-stack` |
| 5     | Golden E2E, staging detector flag, docs                     | `capital-stack.e2e-spec.ts`, `env-patch-api.yaml`      |

---

## Operator-gated checklist

Complete these in order. Do **not** flip Karafiel or detector on prod until the prior step passes.

| #   | Gate                               | Owner            | Action                                                                                                                                                                           | Done when                                                              |
| --- | ---------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | **Janua SSO for beneficial owner** | Platform / Janua | Provision `aldo@madfam.io` in Janua (`https://auth.madfam.io`). Dhanam user row already exists.                                                                                  | Owner can sign in at `https://app.dhan.am` and see `/capital-stack`    |
| 2   | **Commit + deploy phases 3–5**     | Engineering      | Merge uncommitted RFC-6 phases 3–5 work; staging soak; promote to prod (30 min soak or break-glass per RFC 0001).                                                                | `f6b5379e`+ includes backfill, bridge tests, web journal actions       |
| 3   | **Staging Kyverno + smoke**        | Platform         | Sync `dhanam-staging` after Kyverno exception merge (#591). Fix staging web env header smoke (`staging.dhan.am` must expose `staging-api.dhan.am`).                              | `deploy-staging.yml` green end-to-end                                  |
| 4   | **Karafiel receiver**              | Karafiel         | Implement `POST /v1/compliance/capital-flow` per [karafiel-capital-flow-contract.md](rfcs/karafiel-capital-flow-contract.md). Staging endpoint + shared `DHANAM_WEBHOOK_SECRET`. | Karafiel accepts Dhanam outbound; callbacks seal journal               |
| 5   | **Karafiel staging proof**         | Operator         | Set `FEATURE_CAPITAL_STACK_KARAFIEL=true` on **staging** only. Run happy path: proposed → match → send → callback → `compliance_sealed`.                                         | Admin bridge audit shows `capital_flow_send` + `capital_flow_resolved` |
| 6   | **Detector on staging**            | Operator         | Confirm `FEATURE_CAPITAL_STACK_DETECTOR=true` on staging (overlay). Trigger txn on `owner_facility` account; verify proposed journal or backfill job output.                     | Journal created with `detectionConfidence`                             |
| 7   | **Prod Karafiel flip**             | Operator         | After staging soak ≥30 min: `FEATURE_CAPITAL_STACK_KARAFIEL=true` in prod `api-deployment.yaml` + `KARAFIEL_API_KEY` in `dhanam-secrets`. Promote via Enclii/manual gate.        | Live Karafiel case IDs (not `MOCK-CAP-*`)                              |
| 8   | **Prod detector flip**             | Operator         | After Karafiel stable: `FEATURE_CAPITAL_STACK_DETECTOR=true` on prod. Monitor backfill job (4:30 UTC) + review queue volume.                                                     | Auto-proposed journals appear for owner-facility txns                  |
| 9   | **PlatformConfig**                 | Operator         | Set org-scoped keys (Vault RFC — never git): `capital_stack.auto_send_threshold`, `capital_stack.manual_review_threshold`, `madfam.import.business_rfc`.                         | Admin/platform_config or API reflects values                           |

### Quick verification commands

```bash
# API route registered (expect 401 without JWT)
curl -sS -o /dev/null -w "%{http_code}" https://api.dhan.am/v1/capital-stack/groups

# Prod feature flags (kubectl break-glass — record Enclii adapter gap)
kubectl get deploy dhanam-api -n enclii-dhanam -o jsonpath='{.spec.template.spec.containers[0].env}' | jq '.[] | select(.name|startswith("FEATURE_CAPITAL_STACK"))'

# Compliance bridge audit (admin JWT)
curl -sS -H "Authorization: Bearer $ADMIN_JWT" https://api.dhan.am/v1/admin/compliance-bridge/events
```

---

## Known gaps (non-blocking for mock path)

| Gap                                             | Impact                                                             | Workaround                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Staging web smoke fails API-origin header check | Blocks automated staging promote smoke                             | API health passes; use break-glass promote (documented in RFC 0001) |
| Karafiel live API not deployed                  | `send-to-karafiel` returns `MOCK-CAP-*`; journal → `manual_review` | Admin **Seal** / **Void** on review queue; or wait for gate #4      |
| Prod detector off                               | No auto-journals on new txns                                       | Manual journal create + match in web cockpit                        |
| `aldo@madfam.io` Janua missing                  | Owner cannot use web cockpit                                       | Operator uses admin review queue until gate #1                      |

---

## Deploy notes

1. Promote workflow enforces **30 min soak** from `deploy(staging): update digests` commit — wait or use `break_glass_without_smoke=true` with `reason=manual:…`.
2. Web/admin images are **rebuilt with prod `NEXT_PUBLIC_*`** on promote; only API reuses staging digest.
3. If bootstrap SQL runs before `prisma migrate deploy`, mark migration applied:

   ```sql
   UPDATE _prisma_migrations SET finished_at = NOW()
   WHERE migration_name = '20260618000000_add_capital_stack' AND finished_at IS NULL;
   ```

4. Record Enclii adapter gap when using raw `kubectl` / Argo patch for digest repair.

---

## Related PRs and workflow runs

| Item                      | Link                                                                              |
| ------------------------- | --------------------------------------------------------------------------------- |
| RFC-6 foundation          | [PR #588](https://github.com/madfam-org/dhanam/pull/588)                          |
| Prod API digest fix       | [PR #589](https://github.com/madfam-org/dhanam/pull/589)                          |
| Phases 2–4 + Kyverno      | [PR #591](https://github.com/madfam-org/dhanam/pull/591)                          |
| Prod promote (phases 2–4) | [Run #27784147909](https://github.com/madfam-org/dhanam/actions/runs/27784147909) |
| Prior prod promote        | [Run #27745183656](https://github.com/madfam-org/dhanam/actions/runs/27745183656) |

---

## Documentation map

| Audience            | Document                                                                    |
| ------------------- | --------------------------------------------------------------------------- |
| Beneficial owner    | [OWNER_OPERATOR_CAPITAL_STACK.md](guides/OWNER_OPERATOR_CAPITAL_STACK.md)   |
| Operator / SRE      | [OWNER_CAPITAL_KARAFIEL_OPS.md](runbooks/OWNER_CAPITAL_KARAFIEL_OPS.md)     |
| Engineering spec    | [owner-operator-capital-stack.md](rfcs/owner-operator-capital-stack.md)     |
| Karafiel integrator | [karafiel-capital-flow-contract.md](rfcs/karafiel-capital-flow-contract.md) |
| Module maintainer   | [capital-stack README](../apps/api/src/modules/capital-stack/README.md)     |
