# Dhanam FX provisioning readiness - 2026-06-01

## Executive state

Dhanam is the intended single aggregate source of truth for MADFAM FX needs.

Current production proof:

- `dhanam-api` has two ready pods in namespace `dhanam`.
- `GET /health` inside the API pod returns `status=healthy`.
- `GET /v1/fx-rates/health` inside the API pod returns `status=healthy` and a live USD/MXN rate.
- `GET /v1/fx/rate?...` correctly returns `401 Unauthorized` without a Janua JWT.
- Tulana can mint a Janua client-credentials token and call Dhanam internally.
- `GET /v1/fx/rate?from=USD&to=MXN&type=spot` from Tulana returns `200` (defaults `allow_stale=true`).
- `GET /v1/fx/rate?from=USD&to=MXN&type=spot&allow_stale=false` returns `502` only when no fresh rate is available.
- Current platform spot source is provenance-aware, typically `dhanam:fx:spot:<provider>` when the authenticated `/v1/fx` flow succeeds, or `dhanam:fx-rates:health` on fallback.
- `dhanam-secrets` contains `BANXICO_API_TOKEN`, but the encoded value length is `0`; live DOF provider credentials are not provisioned.

No secret values were printed or copied during this audit.

## Source-of-truth boundary

Dhanam owns FX provider access and provisioning.

Tulana should consume Dhanam FX only. Tulana should not be independently
provisioned with Banxico credentials.

## API readiness

Legacy compatibility endpoint:

- `/v1/fx-rates/health`: public USD/MXN health proof.
- `/v1/fx-rates/currencies`: public supported-currency list.
- `/v1/fx-rates/rate`: JWT-protected legacy rate endpoint.

Platform endpoint:

- `/v1/fx/rate`: JWT-protected provenance-aware endpoint.
- `allow_stale` defaults to `true` when omitted.
- Caller must choose `type=spot`, `type=dof`, or `type=settled`.
- This distinction matters: launch offer pricing should use `spot`; SAT/CFDI
  defensibility should use `dof`; reconciliation should use `settled`.

## Provisioning gaps to close

- Replace the temporary `dhanam_legacy_fx_rates` platform LKG bridge with a live spot provider.
- Provision `OPENEXCHANGERATES_APP_ID` if Dhanam should have a stronger primary
  spot provider before falling back to exchangerate.host.
- Prefer explicit `BANXICO_SIE_TOKEN` for DOF even though the current provider
  can fall back to `BANXICO_API_TOKEN`.
- Populate non-empty Banxico provider credentials before treating `type=dof` as cleared.
- Add an operational freshness checkpoint for FX so Tulana readiness can fail
  closed when Dhanam FX is stale.

## Readiness classification

Current state: launch-pricing spot path cleared; full provider completeness not cleared.

Dhanam is live and capable of serving authenticated platform USD/MXN `spot`
from Tulana through a Dhanam-owned last-known-good observation seeded from the
legacy Dhanam FX health path. Full platform readiness still requires live spot
and DOF provider credentials plus freshness monitoring for `/v1/fx/rate`.

## Production contract check (2026-06-02)

- `GET /v1/fx/rate?from=USD&to=MXN&type=spot` returns `401` without bearer token.
- `GET /v1/fx-rates/health` returns `200` with public USD/MXN `testRate`.
- `GET /v1/fx-rates/rate` returns `401` without bearer token.
- `GET /v1/fx-rates/currencies` returns `200` and `count > 0`.
- `GET /v1/fx/rates` and `GET /v1/fx/history` return `401` without bearer token.
- API host base (`https://api.dhan.am`) responds `404` to root requests and `200` on `/v1/monitoring/health` in normal operation.
- Public production surface contract check: `dhan.am` and `app.dhan.am` redirect (`307`), `admin.dhan.am` redirects (`307`), `api.dhan.am` root 404, and `https://dhan.am/api/health` returns `200`.
