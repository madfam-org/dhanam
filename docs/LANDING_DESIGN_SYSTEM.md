# Dhanam Landing — Design System

**Version:** 1.0  
**Date:** 2026-06-15  
**Status:** Approved for landing remediation  
**Scope:** Marketing surfaces at `dhan.am` only (does not replace the in-app Dhanam dashboard design system)

---

## Naming

| Name       | Role                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Dhanam** | Product brand on the landing — logo, hero, CTAs, feature copy                                                          |
| **MADFAM** | Company — footer legal line, ecosystem banner (`@madfam/ecosystem-banner`), links to `madfam.io` policies where shared |

Consumer visitors should perceive **Dhanam** first. MADFAM appears as trust/company context, not as the primary headline brand.

---

## Aesthetic direction: Regenerative Ledger

**Soft Modernity with LATAM warmth** — premium enough for wealth tracking, approachable enough for first-time budgeters, distinct from US fintech template blue.

### Principles

1. **Show the product** — every major section pairs copy with a Dhanam UI frame (screenshot, animated mock, or embed).
2. **Token-first** — use CSS variables from `apps/web/src/styles/globals.css`; extend with landing-scoped vars if needed.
3. **Motion with restraint** — stagger, fade, count-up; always honor `prefers-reduced-motion`.
4. **No AI slop** — banned: Inter, Roboto, Arial, arbitrary purple gradients, generic hero blobs, emoji as partner logos.

### Anti-patterns (current landing — remove in remediation)

| Pattern                       | Location                                | Replace with                                                          |
| ----------------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| `from-blue-600 to-purple-600` | `hero.tsx`, `final-cta.tsx`             | `bg-primary`, semantic accent gradient using `--primary` / `--accent` |
| Rainbow icon tile colors      | `features-grid.tsx`, `how-it-works.tsx` | 2–3 semantic accents max; `--info`, `--success`, `--primary`          |
| Text-only hero                | `hero.tsx`                              | `HeroProductPreview`                                                  |
| Twelve identical cards        | `features-grid.tsx`                     | Scroll story chapters + collapsed "All features"                      |

---

## Typography

Load via `next/font` in landing layout (PR-2 / Phase G).

| Role            | Font (recommended)                   | Fallback              | Usage                      |
| --------------- | ------------------------------------ | --------------------- | -------------------------- |
| Display         | **Fraunces** or **Instrument Serif** | Georgia, serif        | H1, H2, pull quotes        |
| UI / body       | **DM Sans** or **Geist Sans**        | system-ui, sans-serif | Nav, body, buttons, labels |
| Mono (optional) | **Geist Mono**                       | monospace             | Stats, currency figures    |

### Scale (landing)

| Element         | Size                               | Weight | Tracking         |
| --------------- | ---------------------------------- | ------ | ---------------- |
| H1              | `text-4xl md:text-6xl lg:text-7xl` | 700    | `tracking-tight` |
| H2              | `text-3xl md:text-4xl`             | 700    | `tracking-tight` |
| H3              | `text-xl md:text-2xl`              | 600    | normal           |
| Body            | `text-base md:text-lg`             | 400    | normal           |
| Small / trust   | `text-sm`                          | 500    | normal           |
| Eyebrow / badge | `text-xs uppercase`                | 600    | `tracking-wide`  |

---

## Color

### Core tokens (existing — prefer these)

From `apps/web/src/styles/globals.css`:

- `--background`, `--foreground`
- `--primary`, `--primary-foreground`
- `--muted`, `--muted-foreground`
- `--card`, `--border`
- `--success`, `--info`, `--warning`, `--destructive`
- Financial: `--income`, `--expense`, `--transfer`
- Goals: `--goal-excellent`, `--goal-on-track`, `--goal-attention`, `--goal-at-risk`

### Landing extensions (add in Phase B if needed)

Define under `:root` with `--landing-` prefix to avoid dashboard regression:

```css
:root {
  /* Deep teal primary shift for marketing — optional override on .landing-root only */
  --landing-accent: 168 45% 38%; /* teal */
  --landing-accent-warm: 32 65% 52%; /* copper — wealth highlights */
  --landing-surface: 40 30% 97%; /* warm sand background */
  --landing-gradient-start: 168 40% 96%;
  --landing-gradient-end: 40 25% 98%;
}
```

Apply via wrapper:

```html
<div class="landing-root min-h-screen bg-[hsl(var(--landing-surface))]"></div>
```

### Gradient rules

| Allowed                 | Example                                                   |
| ----------------------- | --------------------------------------------------------- |
| Subtle surface gradient | `from-background via-background to-muted/20` using tokens |
| Primary CTA             | Solid `bg-primary` or single-hue `primary` → `primary/90` |
| Hero accent             | Teal → sand radial at 5–10% opacity                       |

| Forbidden               | Reason                                            |
| ----------------------- | ------------------------------------------------- |
| Blue → purple multi-hue | Generic SaaS; violates repo aesthetic rules       |
| Full-bleed rainbow      | Competes with data visualization in product shots |

---

## Spacing and layout

| Token             | Value                                     | Use                       |
| ----------------- | ----------------------------------------- | ------------------------- |
| Section padding Y | `py-16 md:py-24`                          | Standard section          |
| Container         | `container mx-auto px-6`                  | Match existing landing    |
| Max text width    | `max-w-2xl` (body), `max-w-4xl` (hero)    | Readability               |
| Chapter grid      | `grid lg:grid-cols-2 gap-12 items-center` | Product story alternating |

### Breakpoints

Follow Tailwind defaults. Hero mockup stacks below copy on `< lg`.

---

## Components

### LandingNav

- Sticky `top-0 z-50`
- `backdrop-blur-md bg-background/80 border-b`
- Links: Features (or `#story`), Demo, Pricing (`#pricing`), Security
- Locale switcher: ES / EN / PT
- CTAs: Sign In (ghost), Get Started (primary)
- Mobile: drawer with same links

### Hero

- Split layout: copy left (or top on mobile), `HeroProductPreview` right
- Eyebrow badge (single line, `--primary/10` background)
- Dual CTA: **Try Live Demo** (primary), **Create Free Account** (outline)
- Microcopy under CTAs: instant access, no signup, 1 hour
- `LandingTrustStrip` immediately below CTAs

### HeroProductPreview

- Rounded `2xl` frame, subtle shadow, `border`
- Optional: 3–4s crossfade between dashboard states (net worth → budget → forecast)
- `priority` image loading for LCP
- Alt text describes Dhanam dashboard, not generic "app screenshot"

### LandingTrustStrip

- Horizontal row of 3–4 items with icons
- Examples: "14-day free trial · No credit card", "AES-256 encrypted", "Read-only bank access"
- Use `--success` or `--info` sparingly for icons

### ProductStorySection

- Six `<section>` blocks with `id` anchors
- Odd chapters: copy left, image right; even chapters reversed
- Each chapter: H2, 2–3 sentence body, optional bullet (max 3), CTA link optional
- Scroll reveal: `opacity` + `translate-y-4` → rest; disabled when `prefers-reduced-motion: reduce`

### PersonaCards

- Replace emoji with illustrated avatars (SVG or optimized WebP)
- Card: archetype, pain (muted red), superpower (foreground), CTA → demo
- Hover: slight lift `hover:-translate-y-1`, shadow, optional preview thumbnail
- Min touch target 44×44px on mobile

### TestimonialCarousel

- Auto-advance 8s; pause on hover/focus
- Quote, name, location or role, optional tenure
- Keyboard: prev/next buttons, aria-live polite

### StatsBar

- 3–4 metrics with count-up animation (respect reduced motion)
- Examples pre-launch: countries supported, DeFi networks, demo sessions (from PostHog)

### PressStrip / SocialProof

- Grayscale logos, color on hover
- Minimum logo height 32px; consistent optical padding
- No emoji placeholders in production

### Pricing

- Preserve existing `pricing.tsx` behavior (API + MXN fallback)
- Visual: highlight Copilot Pro tier with `border-primary`
- Do not conflate Community self-hosted with hosted tier cards

### FinalCta

- Full-width band using `--landing-gradient-*` or `primary/5`
- Repeat demo + signup; optional urgency copy for demo session

### Footer

- Dhanam logo + product links
- Copyright: Dhanam + link to MADFAM legal entity (match `footer.tsx` today)
- Do not replace Dhanam with MADFAM in the product column

---

## Motion

| Interaction       | Spec                         | Reduced motion     |
| ----------------- | ---------------------------- | ------------------ |
| Section reveal    | 400ms ease-out, 60ms stagger | Instant show       |
| Stat count-up     | 1.2s once in viewport        | Show final number  |
| Hero mockup cycle | 4s fade                      | Static first frame |
| Nav background    | 200ms on scroll              | N/A                |
| Button press      | `active:scale-[0.98]`        | OK                 |

Use `tailwindcss-animate` where already configured; prefer CSS over heavy JS libraries.

---

## Accessibility

- Color contrast: WCAG AA minimum for all text on landing backgrounds
- Focus rings: visible on all interactive elements (`ring-ring`)
- Skip link: "Skip to main content" in `LandingNav` (add in Phase B)
- Images: descriptive `alt`; decorative mockup frames `alt=""` only if adjacent text fully describes
- Carousels: pause control, keyboard navigation, `aria-roledescription="carousel"`
- Locale switcher: `aria-current="true"` on active language

Gate with `@axe-core/playwright` on `/en` and `/es` (Phase G).

---

## Imagery and assets

Directory: `apps/web/public/landing/`

| Asset                 | Dimensions | Notes                                             |
| --------------------- | ---------- | ------------------------------------------------- |
| `hero-dashboard.webp` | 1440×900   | LCP candidate                                     |
| `chapter-*.webp`      | 1200×800   | One per product story chapter                     |
| `og-image.png`        | 1200×630   | Root metadata; Dhanam brand, not MADFAM corporate |
| `logos/*.svg`         | vector     | Partner press logos                               |

Use WebP with PNG fallback if needed. Compress for <200KB hero where possible.

---

## i18n

All user-facing landing strings live in:

`packages/shared/src/i18n/{en,es,pt-BR}/landing.ts`

Rules:

- **Dhanam** in product strings; **MADFAM** only where legally or ecologically required
- ES is default locale for `dhan.am` (middleware + `x-default` hreflang)
- Avoid English-only idioms in ES/PT hero copy; validate with native review before GA

---

## Ecosystem chrome

The MADFAM ecosystem banner (`EcosystemBannerClient` in root `layout.tsx`) remains **outside** the landing design system — do not restyle it in landing PRs. It is global MADFAM cross-product chrome at the bottom of `<body>`.

---

## Implementation checklist (design QA)

Before merging each landing PR:

- [ ] No `from-blue-600 to-purple-600` or hardcoded rainbow icon backgrounds
- [ ] H1 readable at 320px viewport width
- [ ] Primary CTA is **Try Live Demo** in hero
- [ ] Product visual visible without scrolling on 1440×900
- [ ] `#pricing` reachable from nav
- [ ] Footer credits MADFAM company without overshadowing Dhanam brand
- [ ] `prefers-reduced-motion` tested manually once

---

## Related documents

- [LANDING_REMEDIATION.md](LANDING_REMEDIATION.md) — full program plan
- [apps/web/src/styles/globals.css](../apps/web/src/styles/globals.css) — canonical tokens
