# Dhanam Hero Tablet Showcase

> Env flags use `HERO_IPAD_*` for backward compatibility. The GLB is a **generic tablet** (Poly by Google), not an Apple iPad product mesh.

**Status:** Implemented (feature-flagged)  
**Surfaces:** `dhan.am/{locale}` hero · `app.dhan.am/embed/demo/*`  
**Owner:** Dhanam web

---

## Overview

The marketing hero can display a **3D tablet** (React Three Fiber) whose screen runs the **live demo app** in an iframe. A cross-origin **showcase tour** drives navigation, highlights, and a ghost cursor — looping forever with long pauses between cycles and alternating **María** and **Patricia** personas.

| Decision     | Choice                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------- |
| Personas     | **María** (budgeting/AI) and **Patricia** (wealth/projections/estate) — alternate each loop |
| Mobile       | **CSS tablet frame** (`HeroTabletFlat`) with live iframe — no WebGL (perf + stability)      |
| Desktop      | **Compositor** (`HeroTabletCompositor`) — WebGL bezel + DOM iframe, shared CSS transforms   |
| Tablet model | **Procedural R3F bezel** — GLB retained only as optional legacy path                        |
| Tour pacing  | Loop forever · **14s** break after each tour · **4s** before persona switch                 |
| Feature flag | `NEXT_PUBLIC_HERO_IPAD_ENABLED` (default off until operator enable)                         |

---

## Architecture

```
dhan.am (parent)                         app.dhan.am (child iframe)
────────────────                         ──────────────────────────
HeroIpadExperience                       /embed/demo/dashboard?persona=&showcase=1
  ├─ HeroTabletFlat (<lg or pre-hydrate)   middleware → dashboard routes
  ├─ HeroTabletCompositor (lg+, 3D)       embed-mode + demo-mode cookies
  │    ├─ HeroEmbedFrame (DOM — stable)     ShowcaseProvider + EmbedBootstrap
  │    └─ ProceduralTabletMesh (WebGL)    (no @react-three/drei Html)
  └─ useShowcaseTourDriver ──postMessage──► navigate / highlight / cursor
```

**Compositor invariant:** the live demo iframe is always a normal DOM node layered above the
canvas. WebGL draws bezels only. Do not mount the iframe via `drei` `<Html transform>` — it
collapses to 0×0 in production and hides the demo behind an untextured gray mesh.

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

### `tablet` GLB fails to render (CSP / textures)

Three.js `GLTFLoader` fetches embedded textures via `blob:` URLs. Marketing CSP must
include `blob:` in `connect-src` and `img-src` or the mesh loads without materials and
the console shows `Refused to connect because it violates CSP`.

### `ipad-pro.glb` 404 on production

**Layer 1 — Docker public path:** Next.js monorepo standalone serves `public/` from
`apps/web/public`. The runner stage must copy there (not only `./public` at image root).

**Layer 2 — Bundled fallback:** The hero loads the GLB via webpack from
`src/assets/landing/ipad-pro.glb`, emitted under `/_next/static/media/` (always served
correctly). Direct URL `/landing/models/ipad-pro.glb` is optional smoke only.

**Layer 3 — Rollout lag:** If git manifest has a new digest but the URL still 404s,
ArgoCD may not have rolled pods ([incident runbook](../runbooks/incidents/2026-06-15-dhanam-web-prod-rollout.md)).
Hard-refresh `dhanam-services` from operator kubeconfig or Enclii.

**Layer 4 — Untextured materials:** `ipad-gltf-body.tsx` strips embedded GLB textures
after clone so Three.js never creates `blob:` URLs. This keeps the tablet visible even
if an older CSP pod is still rolling.

### Embed iframe shows 401 on `/spaces` or `/auth/refresh`

The dashboard layout used to mount `EmbedBootstrap` only after auth, but embed showcase
needs the bootstrap to **create** auth first. Unauthenticated embed sessions now render
`EmbedBootstrap` + skeleton immediately; `useSpaces()` stays disabled until tokens exist.

```bash
curl -fsSI https://dhan.am/landing/models/ipad-pro.glb | head -3
./scripts/hero-tablet-prod-smoke.sh
```

---

## Related

- [LANDING_DESIGN_SYSTEM.md](./LANDING_DESIGN_SYSTEM.md)
- [LANDING_REMEDIATION.md](./LANDING_REMEDIATION.md) — ticket B4 embed demo
