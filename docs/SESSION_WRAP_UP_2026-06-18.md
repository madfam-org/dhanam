# Session Wrap-Up — 2026-06-18

**Repos touched:** `madfam-org/dhanam`  
**Operator focus:** Owner–operator Capital Stack (RFC-6) Phase 1 production rollout  
**Read next session with:** [OWNER_OPERATOR_CAPITAL_STACK.md](guides/OWNER_OPERATOR_CAPITAL_STACK.md), [OWNER_CAPITAL_KARAFIEL_OPS.md](runbooks/OWNER_CAPITAL_KARAFIEL_OPS.md), [owner-operator-capital-stack.md](rfcs/owner-operator-capital-stack.md)

---

## Executive summary

Shipped **RFC-6 Phase 1** (Capital Stack API module, schema, docs, prod feature flags) and bootstrapped the **Innovaciones MADFAM operator slice** on production Postgres. Merged [PR #588](https://github.com/madfam-org/dhanam/pull/588); corrected a mistaken API digest via [PR #589](https://github.com/madfam-org/dhanam/pull/589). Production API now serves `/v1/capital-stack/*` with `FEATURE_CAPITAL_STACK_ENABLED=true`.

---

## Production state (verified 2026-06-18)

| Surface           | Status                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------ |
| API Capital Stack | Live — `GET /v1/capital-stack/groups` returns **401** (route registered, JWT required)     |
| API image         | `ghcr.io/madfam-org/dhanam/api@sha256:2781f779…` (PR #588 build)                           |
| Feature flags     | `FEATURE_CAPITAL_STACK_ENABLED=true`, Karafiel + detector `false`                          |
| DB bootstrap      | `owner_operator` household, `SpaceOperatorBinding`, account `capital_purpose` tags applied |
| Migration         | `20260618000000_add_capital_stack` marked applied (manual bootstrap preceded migrate init) |

### Operator identities

| Email             | Role                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| `aldo@madfam.io`  | Beneficial owner — owns `Aldo Personal`, **admin** on `Innovaciones MADFAM`            |
| `admin@madfam.io` | Entity operator — owns `Innovaciones MADFAM`, `MADFAM Operations`, `MADFAM Socio AFAC` |

Removed: `arantza.orquidea@gmail.com`. Retained: demo users + Tulana service account.

### Account classification (`Aldo Personal`)

| `capital_purpose`  | Count |
| ------------------ | ----- |
| `personal_life`    | 51    |
| `owner_facility`   | 18    |
| `entity_operating` | 3     |

---

## Deploy notes

1. Staging build digest for PR #588: `sha256:2781f779…` (not the older `8709078…` pre-merge artifact).
2. Promote workflow enforces **30 min soak** — break-glass or wait before API-only promote.
3. If bootstrap SQL runs before `prisma migrate deploy`, resolve with `UPDATE _prisma_migrations SET finished_at = NOW() WHERE migration_name = '20260618000000_add_capital_stack'`.
4. Record Enclii adapter gap when using `kubectl apply -k` or Argo patch for digest repair.

---

## Open blockers

| Item                                        | Owner               | Notes                                                                                                  |
| ------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| Janua account for `aldo@madfam.io`          | Platform / operator | Dhanam user exists; SSO login blocked until Janua provisioned                                          |
| Staging ArgoCD sync                         | Platform            | Kyverno GHCR DENIED — **fix staged** in `overlays/staging/kyverno-policy-exception.yaml` (push + sync) |
| Karafiel `POST /v1/compliance/capital-flow` | Karafiel repo       | Companion RFC drafted; flip `FEATURE_CAPITAL_STACK_KARAFIEL` after                                     |
| Phase 2–5 (UI, detector, admin queue)       | Engineering         | Phases 2–4 largely shipped; E2E + backfill job remain                                                  |

## Production promotion (2026-06-18 evening)

- **Promote run:** [#27745183656](https://github.com/madfam-org/dhanam/actions/runs/27745183656) — `f6e7cc69`
- **ArgoCD:** `dhanam-services` Synced / Healthy
- **Digests:** API `e56c6db4…`, Web `8b5dab91…`, Admin `9423f97a…`

---

## Related PRs

- [#588](https://github.com/madfam-org/dhanam/pull/588) — feat(capital-stack): RFC-6 foundation
- [#589](https://github.com/madfam-org/dhanam/pull/589) — fix(deploy): correct prod API digest
