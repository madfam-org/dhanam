# Dhanam Hero iPad Showcase

**Status:** Implemented (feature-flagged)  
**Surfaces:** `dhan.am/{locale}` hero · `app.dhan.am/embed/demo/*`  
**Owner:** Dhanam web

---

## Overview

The marketing hero can display a **3D iPad** (React Three Fiber) whose screen runs the **live demo app** in an iframe. A cross-origin **showcase tour** drives navigation, highlights, and a ghost cursor — looping forever with long pauses between cycles and alternating **María** and **Patricia** personas.

| Decision     | Choice                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Personas     | **María** (budgeting/AI) and **Patricia** (wealth/projections/estate) — alternate each loop                             |
| Mobile       | **Static carousel** (`HeroMobileShowcase`) — no live iframe (perf + stability)                                          |
| iPad model   | **Bundled** `public/landing/models/ipad-pro.glb` — Poly by Google tablet (CC BY 3.0); procedural fallback if load fails |
| Tour pacing  | Loop forever · **14s** break after each tour · **4s** before persona switch                                             |
| Feature flag | `NEXT_PUBLIC_HERO_IPAD_ENABLED` (default off until operator enable)                                                     |

---

## Architecture

```
dhan.am (parent)                         app.dhan.am (child iframe)
────────────────                         ──────────────────────────
HeroIpadExperience                       /embed/demo/dashboard?persona=&showcase=1
  ├─ HeroMobileShowcase (<lg)              middleware → dashboard routes
  ├─ IpadScene (R3F, lg+)                 embed-mode + demo-mode cookies
  │    └─ HeroEmbedFrame                    ShowcaseProvider + EmbedBootstrap
  └─ useShowcaseTourDriver ──postMessage──► navigate / highlight / cursor
```

### URLs

| URL                                                                    | Purpose              |
| ---------------------------------------------------------------------- | -------------------- |
| `https://app.dhan.am/embed/demo/dashboard?persona=maria&showcase=1`    | María embed entry    |
| `https://app.dhan.am/embed/demo/dashboard?persona=patricia&showcase=1` | Patricia embed entry |

### Protocol

Types live in `packages/shared/src/showcase/protocol.ts`.

**Parent → child:** `navigate`, `highlight`, `scroll`, `cursor`, `pause`, `resume`, `restart`  
**Child → parent:** `ready`, `route-changed`, `error`

Origin allowlist (child accepts parent from): `dhan.am`, `www.dhan.am`, `localhost:3040`, `pr-*.web.preview.dhan.am`.

---

## Environment variables

| Variable                        | Default             | Description                                    |
| ------------------------------- | ------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_HERO_IPAD_ENABLED` | `false`             | Master switch for hero showcase                |
| `NEXT_PUBLIC_HERO_IPAD_3D`      | `true` when enabled | `false` forces flat iframe-in-frame (no WebGL) |

Enable locally:

```bash
NEXT_PUBLIC_HERO_IPAD_ENABLED=true pnpm dev:web
# Visit http://localhost:3040/en
```

Staging soak before production:

```bash
# infra/enclii or staging env patch
NEXT_PUBLIC_HERO_IPAD_ENABLED=true
```

**Soak window:** 30 minutes (aligned with `.enclii.yml` `min_soak_minutes: 30`).

---

## Tour scripts

| Persona  | Steps                                                          |
| -------- | -------------------------------------------------------------- |
| María    | dashboard → transactions → budgets → analytics → goals         |
| Patricia | dashboard → assets → projections → scenarios → estate-planning |

Constants (`packages/shared/src/showcase/protocol.ts`):

- `SHOWCASE_LOOP_BREAK_MS` = 14_000
- `SHOWCASE_PERSONA_SWITCH_MS` = 4_000
- `SHOWCASE_STEP_GAP_MS` = 800

Hovering the iframe **pauses** the tour (`pause` command).

---

## CSP

| Host          | Path       | `frame-ancestors`                            | `frame-src`                  |
| ------------- | ---------- | -------------------------------------------- | ---------------------------- |
| `app.dhan.am` | `/embed/*` | `dhan.am`, `www.dhan.am`, localhost, preview | —                            |
| `app.dhan.am` | other      | `'none'`                                     | —                            |
| `dhan.am`     | any        | `'none'`                                     | `app.dhan.am` (iframe embed) |

Implementation: `apps/web/src/lib/routing/csp.ts`.

---

## iPad 3D model

**Bundled:** `apps/web/public/landing/models/ipad-pro.glb` (~5 KB)

| Field       | Value                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------- |
| Source      | [Poly Pizza — Tablet by Poly by Google](https://poly.pizza/m/crlQklnLvz7)                       |
| License     | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) (commercial OK, attribution required) |
| Attribution | `HERO_IPAD_MODEL_ATTRIBUTION` in `hero-ipad-config.ts`                                          |

No verified **CC0** iPad GLB was found during sourcing (June 2026). CC0 alternatives on Poly Pizza are phones/laptops (Quaternius, Kenney), not tablets. This asset is the closest tablet-shaped match.

Implementation: `ipad-gltf-body.tsx` loads GLB via `useGLTF`; `ipad-procedural-body.tsx` is the Suspense fallback.

See `apps/web/public/landing/models/LICENSE.md`.

---

## Key files

```
packages/shared/src/showcase/
apps/web/src/lib/showcase/
apps/web/src/components/landing/hero-ipad/
apps/web/src/lib/routing/csp.ts
apps/web/src/middleware.ts
apps/web/src/app/(dashboard)/layout.tsx  # embed chrome strip
```

---

## Analytics (PostHog)

| Event                     | When                          |
| ------------------------- | ----------------------------- |
| `showcase_iframe_ready`   | Child posts `ready`           |
| `showcase_tour_step`      | Each tour step                |
| `showcase_tour_completed` | End of María or Patricia loop |
| `hero_ipad_hydrated`      | (optional) 3D canvas mounted  |

---

## Testing

```bash
pnpm --filter @dhanam/shared test
pnpm --filter @dhanam/web test -- csp.spec
pnpm --filter @dhanam/web test -- landing-demo-flow
```

Manual smoke:

1. `NEXT_PUBLIC_HERO_IPAD_ENABLED=true pnpm dev:web`
2. Open `http://localhost:3040/en` — desktop iframe or 3D iPad loads
3. Open `http://localhost:3040/embed/demo/dashboard?persona=maria&showcase=1` — chromeless dashboard
4. Confirm no CSP errors in console

---

## Rollout checklist

- [x] PR merged with hero iPad showcase + prod build args
- [ ] 30-minute post-deploy smoke on `dhan.am/en`
- [ ] axe `/en` and `/es` pass
- [ ] Visual regression baselines updated (`#landing-hero`)
- [x] `NEXT_PUBLIC_HERO_IPAD_ENABLED=true` in prod Enclii build args

---

## Troubleshooting

### `ipad-pro.glb` 404 on production

Next.js **monorepo standalone** serves `public/` from `apps/web/public` relative to the
standalone root (where `apps/web/server.js` runs). The Docker runner stage must copy:

```dockerfile
COPY --from=builder /app/apps/web/public ./apps/web/public
```

Copying to `./public` at the image root makes every public asset 404 (`og-image.png`,
`favicon.svg`, `landing/models/ipad-pro.glb`). Verify after deploy:

```bash
curl -fsSI https://dhan.am/landing/models/ipad-pro.glb | head -3
./scripts/hero-ipad-prod-smoke.sh
```

---

## Related

- [LANDING_DESIGN_SYSTEM.md](./LANDING_DESIGN_SYSTEM.md)
- [LANDING_REMEDIATION.md](./LANDING_REMEDIATION.md) — ticket B4 embed demo
