# Dhanam Landing Page — Full Remediation Plan

**Version:** 1.0  
**Date:** 2026-06-15  
**Status:** Phases A–G shipped to production (2026-06-15); ES hero copy fix #568 live  
**Owner:** Dhanam product / web (Aureo Labs, a MADFAM company)  
**Session handoff:** [SESSION_WRAP_UP_2026-06-15.md](SESSION_WRAP_UP_2026-06-15.md)

---

## Naming and scope

| Term             | Meaning                                                                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dhanam**       | The consumer financial platform (budget, wealth, DeFi, estate planning). Marketing site: [dhan.am](https://dhan.am). App: [app.dhan.am](https://app.dhan.am).                                               |
| **MADFAM**       | The company (Innovaciones MADFAM S.A.S. de C.V.) and ecosystem brand. Corporate site: [madfam.io](https://madfam.io). Dhanam is developed by **Aureo Labs**, a MADFAM company.                              |
| **This program** | Remediation of the **Dhanam marketing landing** at `dhan.am/{locale}` so first-visit UX matches or exceeds leading personal-finance competitors and the engagement bar set by the MADFAM corporate landing. |

This document is the canonical engineering and design plan for that work. Feature-level competitive pricing and capability matrices remain in [market-research/competitive-benchmarks.md](market-research/competitive-benchmarks.md). Visual and token rules are in [LANDING_DESIGN_SYSTEM.md](LANDING_DESIGN_SYSTEM.md).

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Program goals and success metrics](#2-program-goals-and-success-metrics)
3. [Competitive landing analysis](#3-competitive-landing-analysis)
4. [Current-state baseline (main)](#4-current-state-baseline-main)
5. [Gap analysis](#5-gap-analysis)
6. [Design direction](#6-design-direction)
7. [Target information architecture](#7-target-information-architecture)
8. [Remediation phases and tickets](#8-remediation-phases-and-tickets)
9. [File and module structure](#9-file-and-module-structure)
10. [PR slicing strategy](#10-pr-slicing-strategy)
11. [Test remediation matrix](#11-test-remediation-matrix)
12. [Analytics instrumentation](#12-analytics-instrumentation)
13. [Content and asset checklist](#13-content-and-asset-checklist)
14. [Risk register](#14-risk-register)
15. [Competitive messaging guardrails](#15-competitive-messaging-guardrails)
16. [Execution timeline](#16-execution-timeline)
17. [Definition of done](#17-definition-of-done)
18. [Related documents](#18-related-documents)

---

## 1. Executive summary

Dhanam already offers more product breadth than YNAB, Monarch Money, Rocket Money, or Lunch Money individually (unified wealth, DeFi, Monte Carlo, LATAM banking, estate planning, instant live demo). The **marketing landing does not yet communicate that breadth with the visual proof, emotional framing, or narrative pacing** those competitors use.

**Core problem:** The Dhanam landing is text-heavy and template-like (generic gradients, emoji partner logos, 12 identical feature cards) while competitors lead with product screenshots, outcome stories, and trust density in the first viewport.

**Core opportunity:** Dhanam's **Try Live Demo** flow (no signup, full product on `app.dhan.am`) is unmatched in this competitive set. The remediation program makes that moat visible immediately and wraps it in a scroll story aligned with MADFAM's persona-driven corporate UX.

**Recommended approach:** Five phases over ~5 weeks — architecture and SSR first, then hero and product scroll story, then personas and social proof, then conversion polish and accessibility.

---

## 2. Program goals and success metrics

### Goals

1. Match YNAB / Monarch / Rocket Money / Lunch Money **first-impression quality** on `dhan.am`.
2. Align with **MADFAM corporate landing** patterns (persona/path selection, clear CTAs) while keeping Dhanam's distinct financial identity.
3. Preserve and highlight Dhanam differentiators: **live demo**, **LATAM-native**, **unified wealth**, **probabilistic planning**.
4. Improve SEO, LCP, and accessibility without breaking geo-aware pricing or demo cross-origin launch.

### Success metrics

| Metric                    | Baseline (est.)        | Target                                           |
| ------------------------- | ---------------------- | ------------------------------------------------ |
| LCP (`dhan.am/{locale}`)  | >2.5s (client-heavy)   | <1.5s p95                                        |
| Hero → demo click rate    | Uninstrumented         | ≥15%                                             |
| Hero → signup click rate  | Uninstrumented         | ≥5%                                              |
| Scroll to `#pricing`      | Uninstrumented         | ≥40% of sessions                                 |
| Demo → account conversion | Uninstrumented         | Baseline + track in PostHog                      |
| Lighthouse SEO            | Degraded (CSR landing) | ≥90                                              |
| Accessibility             | Not gated on landing   | WCAG AA (`@axe-core/playwright` on `/en`, `/es`) |

---

## 3. Competitive landing analysis

Analysis date: 2026-06-15. URLs: [YNAB](https://www.ynab.com/), [Monarch Money](https://www.monarch.com/), [Rocket Money](https://www.rocketmoney.com/), [Lunch Money](https://lunchmoney.app/), [MADFAM](https://madfam.io/).

### 3.1 YNAB — emotional outcome machine

| Dimension    | Pattern                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Hero         | Rotating punchy headlines (_"Bad at money?"_, _"Never worry about money again"_) — anxiety and transformation, not features |
| Trust        | Award badges above fold (Best Budgeting App, Trustpilot, App of the Day)                                                    |
| Outcomes     | 90% better finances, 91% changed mindset, $600 saved month 1 / $6,000 year 1                                                |
| Stories      | Named testimonials with tenure (_"YNABer since 2015"_) and life outcomes                                                    |
| Segmentation | _"I want to…"_ goal picker before signup                                                                                    |
| Method       | _"Give every dollar a job"_ as philosophy, not a bullet                                                                     |
| Trial        | _"No credit card required"_ repeated; 34-day trial                                                                          |

**Steal for Dhanam:** Emotional headline, outcome stats, goal/persona picker, named testimonials.  
**Skip:** US-only tone; method dogma without showing product.

### 3.2 Monarch Money — product-led scroll story

| Dimension    | Pattern                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Hero         | _"Your home base for money clarity"_ + unified accounts promise                                      |
| Navigation   | Feature tabs: Track / Budget / Collaborate / Plan                                                    |
| Sections     | Full-width chapters with **real UI screenshots**: Net Worth, Transactions, Recurring, Reports, Goals |
| Couples      | _"Collaborate at no extra cost"_ — repeated differentiator                                           |
| Social proof | App Store review carousel + WSJ, Forbes, ZDNET press logos                                           |
| Scale        | _"13,000+ institutions"_                                                                             |
| Community    | Reddit (50K+), blog                                                                                  |

**Steal for Dhanam:** Screenshot scroll story, press quotes, institution/connectivity proof.  
**Skip:** Bank-only framing without LATAM or crypto depth.

### 3.3 Rocket Money — conversion funnel

| Dimension | Pattern                                                 |
| --------- | ------------------------------------------------------- |
| Hero      | Mobile-first QR to app; _"Take control of my finances"_ |
| Scale     | _"Join 10 million+ members"_, _"$2.5 billion saved"_    |
| Hook      | Subscription cancellation as single sharp pain          |
| Pricing   | Free vs Premium comparison table                        |
| Service   | Human concierge for bill negotiation                    |
| Reviews   | Long 5-star review wall                                 |

**Steal for Dhanam:** Scale-proof pattern (adapt to demo sessions / countries pre-launch), comparison clarity.  
**Skip:** Bill negotiation wedge (not Dhanam's primary hook).

### 3.4 Lunch Money — indie craft

| Dimension     | Pattern                                                      |
| ------------- | ------------------------------------------------------------ |
| Tone          | _"Delightfully simple"_ — warm, anti-corporate               |
| Audience      | Tags: Digital Nomads, Engineers, Couples, Cross-border users |
| Testimonials  | 15+ named quotes with countries                              |
| Positioning   | Mint / Personal Capital refugee explicit                     |
| Multicurrency | Cross-border stories (CAN & US, ITL & USA)                   |
| Security      | AES-256, bank-level; data not sold                           |
| Trial         | 30 days, no credit card                                      |

**Steal for Dhanam:** Audience tags, Mint refugee SEO, multicurrency/LATAM stories, privacy callout.  
**Skip:** Minimal depth — Dhanam should show depth _after_ simplicity in hero.

### 3.5 MADFAM corporate landing — ecosystem pattern

| Dimension       | Pattern                                       |
| --------------- | --------------------------------------------- |
| Personalization | _"I'm a…"_ role selector                      |
| Paths           | Product demo cards (including Dhanam)         |
| Assessment      | AI assessment CTA for undecided visitors      |
| Trust           | Enterprise client strip                       |
| Brand           | LATAM-first, privacy-first, design excellence |

**Steal for Dhanam:** Persona/path selection (already started in `PersonaCards`), dual CTA structure.  
**Skip:** B2B transformation framing on the consumer Dhanam landing.

### 3.6 Positioning matrix — where Dhanam should win

| Position               | Message                                                  | Competitor gap                          |
| ---------------------- | -------------------------------------------------------- | --------------------------------------- |
| Unified wealth         | Banks + crypto + property + collectibles — one net worth | Monarch / Rocket Money are bank-centric |
| Probabilistic planning | Don't just budget — know your odds                       | YNAB / Lunch Money lack Monte Carlo     |
| LATAM-native           | MXN-first, Belvo, Banxico FX                             | All four competitors are US-first       |
| Instant demo           | Full Dhanam on `app.dhan.am` in ~30 seconds, no signup   | All require signup or app install       |
| Household + business   | Personal and business spaces, unified picture            | Rocket Money is consumer-only           |
| Estate planning        | Life Beat — family financial safety net                  | Unique; Kubera partial overlap only     |

---

## 4. Current-state baseline (main)

Audited against `main` on 2026-06-15.

### 4.1 Production routing

| Route              | Behavior                                                                            |
| ------------------ | ----------------------------------------------------------------------------------- |
| `dhan.am/`         | Middleware redirects → `/{locale}` (cookie / geo; default `es`)                     |
| `dhan.am/{locale}` | Rewrites → `/[locale]/landing` — **canonical Dhanam marketing page**                |
| `app.dhan.am/`     | Auth gateway → `/login` or `/dashboard` (not a landing)                             |
| `localhost:3040/`  | Serves legacy `apps/web/src/app/page.tsx` — **stripped landing** (missing sections) |

Middleware: `apps/web/src/middleware.ts` (landing locale routing ~L165–209).

### 4.2 Canonical page composition

File: `apps/web/src/app/[locale]/landing/page.tsx`

Section order today:

1. Inline nav (duplicated logic)
2. `Hero`
3. `PersonaCards`
4. `ProblemSolution`
5. `HowItWorks`
6. `SecurityTrust`
7. `FeaturesGrid` (12 cards)
8. `PlatformDepth`
9. `SocialProof`
10. `Pricing` (`#pricing`)
11. `FinalCta`
12. `Footer`

Legacy root `apps/web/src/app/page.tsx` omits `PersonaCards`, `SecurityTrust`, and `PlatformDepth`.

### 4.3 Landing components

All under `apps/web/src/components/landing/`:

| Component              | Role                                        |
| ---------------------- | ------------------------------------------- |
| `hero.tsx`             | Text-only hero; blue-purple gradient CTAs   |
| `persona-cards.tsx`    | Four personas → `app.dhan.am/demo?persona=` |
| `problem-solution.tsx` | 8×8 bullet comparison                       |
| `how-it-works.tsx`     | Five-step icon grid                         |
| `security-trust.tsx`   | Four security pillars                       |
| `features-grid.tsx`    | Twelve feature cards                        |
| `platform-depth.tsx`   | DeFi / collectibles / scenarios accordions  |
| `social-proof.tsx`     | Emoji partner logos + open-source ESG link  |
| `pricing.tsx`          | Geo-aware billing API + MXN fallback        |
| `final-cta.tsx`        | Closing dual CTA                            |
| `footer.tsx`           | Links; credits MADFAM legal entity          |

### 4.4 i18n

Copy: `packages/shared/src/i18n/{en,es,pt-BR}/landing.ts`

Known drift: static pricing fallback in `pricing.tsx` uses Tulana v0.1 tiers (Free / Copilot Pro / Family Plus) while some i18n keys still reference legacy Essentials / Pro / Premium names.

### 4.5 Integrations already in place

- **Live demo:** `apps/web/src/lib/demo/launch-demo.ts` → `app.dhan.am/demo`
- **Analytics:** PostHog `live_demo_clicked`, `signup_clicked`, `trackPageView`
- **Ecosystem banner:** `@madfam/ecosystem-banner@0.1.3` in root `layout.tsx` (MADFAM cross-product chrome)
- **E2E:** Playwright pricing and demo tests in `apps/web/e2e/subscription-journey.spec.ts` (uses `/en`)

### 4.6 What works — do not regress

- Cross-origin demo launch (marketing on `dhan.am`, auth on `app.dhan.am`)
- Persona → demo deep links
- Geo cookie (`dhanam_geo`) + `billingApi.getPricing()`
- Locale routing and hreflang in root layout
- Community edition link separated from hosted tier cards (E2E enforced)

---

## 5. Gap analysis

| ID      | Defect                                                    | Impact                                        | Phase |
| ------- | --------------------------------------------------------- | --------------------------------------------- | ----- |
| **D1**  | Entire landing is `'use client'`                          | Route `loading.tsx` flash, poor LCP, weak SEO | A     |
| **D2**  | Duplicated page shells (`page.tsx` vs `[locale]/landing`) | Section drift, test confusion                 | A     |
| **D3**  | Invalid `<head>` inside client locale page                | Unreliable SEO tags in App Router             | A     |
| **D4**  | `og-image.png` referenced; missing from `public/`         | Broken social previews                        | A     |
| **D5**  | Generic blue-purple gradients                             | Template SaaS look; violates design rules     | B     |
| **D6**  | No product visuals in hero                                | Loses to all four competitors in first 5s     | B     |
| **D7**  | Emoji partner logos; no testimonials or press             | Weak trust vs YNAB/Monarch/Rocket Money       | E     |
| **D8**  | 12-card grid + 8×8 problem/solution                       | Cognitive overload                            | C     |
| **D9**  | Unit tests import `@/app/page` not locale landing         | False confidence                              | A     |
| **D10** | i18n pricing name drift                                   | Confusing copy in ES/PT                       | A     |
| **D11** | No landing-specific a11y / visual regression              | Quality gate gap                              | G     |
| **D12** | Stale E2E demo comment (guest login on same origin)       | Misleading test docs                          | A     |

---

## 6. Design direction

Full token and motion spec: [LANDING_DESIGN_SYSTEM.md](LANDING_DESIGN_SYSTEM.md).

**Aesthetic name:** _Regenerative Ledger_ — Soft Modernity with LATAM warmth.

- Aligns Dhanam with MADFAM's regenerative brand without copying Monarch/Rocket Money corporate blue.
- Uses Dhanam CSS variables in `apps/web/src/styles/globals.css`; no hardcoded rainbow Tailwind on landing.
- Banned on landing: Inter/Roboto, arbitrary purple gradients, emoji-as-logos, identical 12-card grids above fold.

---

## 7. Target information architecture

Replace feature dump with scroll story:

```
1. Sticky nav (Features · Demo · Pricing · Security · locale · Sign In · Get Started)
2. Hero — emotional headline + Dhanam product mockup + dual CTA + trust strip
3. Press / partner logo bar (Belvo, Plaid, Bitso, Zapper, …)
4. Persona picker — "Which financial life sounds like yours?"
5. Product chapters (6) — alternating copy + screenshot/GIF
6. How it works — pinned timeline (5 steps)
7. Social proof — testimonial carousel + stats bar
8. Security trust (upgrade existing pillars)
9. Pricing (#pricing) — preserve geo-aware MXN logic
10. Final CTA — demo urgency
11. Footer (MADFAM legal entity + Dhanam legal links)
```

**Demote:** `FeaturesGrid` → `/features` or collapsed accordion.  
**Compress:** `ProblemSolution` → 3-row visual comparison.

### Product chapter map

| #   | Chapter              | Dhanam screen                 | Competitor reference       |
| --- | -------------------- | ----------------------------- | -------------------------- |
| 1   | See everything       | Net worth unified             | Monarch Net Worth          |
| 2   | Understand spending  | AI categorization + recurring | Rocket Money subscriptions |
| 3   | Plan with confidence | Monte Carlo probability       | Unique vs YNAB/Lunch Money |
| 4   | Grow together        | Yours / Mine / Ours           | Monarch Collaborate        |
| 5   | Protect what matters | Life Beat estate              | Unique vs set              |
| 6   | Go deeper            | DeFi / collectibles / stress  | Reuse `PlatformDepth`      |

---

## 8. Remediation phases and tickets

### Phase A — Foundation and architecture (Week 1) ✅ Shipped 2026-06-15

**Objective:** Single source of truth, SSR-critical path, no loading flash.

| Ticket | Work                                              | Status                                          |
| ------ | ------------------------------------------------- | ----------------------------------------------- |
| **A1** | Extract shared `LandingPageClient` composition    | ✅                                              |
| **A2** | Locale page + legacy root both consume A1         | ✅ (`/` → `/en`; canonical `/[locale]/landing`) |
| **A3** | RSC shell + client islands (hero static SSR slot) | ✅                                              |
| **A4** | `generateMetadata` per locale                     | ✅                                              |
| **A5** | Remove invalid client `<head>`                    | ✅                                              |
| **A6** | Landing skeleton `loading.tsx`                    | ✅                                              |
| **A7** | Dynamic OG via `app/opengraph-image.tsx`          | ✅                                              |
| **A8** | Align i18n pricing strings with Tulana v0.1       | ✅                                              |

Implementation files: `landing-page-client.tsx`, `landing-nav.tsx`, `landing-hero-static.tsx`, `landing-hero-actions.tsx`, `[locale]/landing/page.tsx`, `opengraph-image.tsx`.

**Acceptance**

- `dhan.am/es` serves hero H1 in initial HTML (view-source).
- No spinner-only first paint >500ms on fast 3G (staging proof).
- One component tree for all landing entrypoints.
- Playwright pricing tests still pass.

### Phase B — Hero and above-the-fold (Week 1–2)

**Objective:** Match Monarch/Rocket Money visual impact in first viewport.

| Ticket | Work                                                              | Primary files                                                           |
| ------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **B1** | `LandingNav` — sticky, blur, anchor links, mobile drawer          | `landing-nav.tsx` — **partial** (nav extracted; sticky/blur in Phase B) |
| **B2** | Hero copy — outcome-led, all locales                              | `landing.ts` `hero.*`                                                   |
| **B3** | `HeroProductPreview` — dashboard mockup (PNG → animated cycle)    | New + `public/landing/`                                                 |
| **B4** | Embedded live-demo iframe (`app.dhan.am/embed/demo/*?showcase=1`) | ✅ — see [HERO_IPAD_SHOWCASE.md](./HERO_IPAD_SHOWCASE.md)               |
| **B5** | `LandingTrustStrip` — trial, encryption, read-only                | New component                                                           |
| **B6** | Design token migration — remove blue-purple gradients             | `final-cta.tsx` ✅; hero actions use `primary`                          |

**Copy direction (English examples — translate in ES/PT)**

| Key             | Current                                   | Target                                                             |
| --------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `hero.title`    | Your Entire Financial Life. One Platform. | Know where your money is going — and where it could go.            |
| `hero.subtitle` | Asset-class list                          | Connect accounts in minutes. One clear view of today and tomorrow. |
| `hero.badge`    | Autonomous Family Office for Everyone     | Built for LATAM. Ready for everything you own.                     |

**Acceptance**

- Product visual in hero (desktop + mobile).
- Primary CTA remains **Try Live Demo**.
- Nav scrolls to `#pricing`.

### Phase C — Product scroll story (Week 2–3)

| Ticket | Work                                                         |
| ------ | ------------------------------------------------------------ |
| **C1** | New `ProductStorySection` — six chapters, alternating layout |
| **C2** | Dashboard screenshots per chapter (demo data)                |
| **C3** | Scroll-triggered fade-in; `prefers-reduced-motion` fallback  |
| **C4** | Demote `FeaturesGrid` behind "See all features"              |
| **C5** | Compress `ProblemSolution` to 3-row table                    |

### Phase D — Persona and segmentation (Week 3)

| Ticket | Work                                                            |
| ------ | --------------------------------------------------------------- |
| **D1** | Upgrade `PersonaCards` — illustrated avatars, hover preview     |
| **D2** | Add personas: Sofia (cross-border), Roberto (freelancer)        |
| **D3** | Analytics: `persona_card_clicked` `{ persona, locale }`         |
| **D4** | Keep personas above problem/solution (current order is correct) |

### Phase E — Social proof and trust (Week 3–4)

| Ticket | Work                                                              |
| ------ | ----------------------------------------------------------------- |
| **E1** | `TestimonialCarousel` — 6–8 quotes (beta until App Store reviews) |
| **E2** | `StatsBar` — PostHog aggregates or conservative placeholders      |
| **E3** | SVG partner logos in `SocialProof` (replace emoji)                |
| **E4** | `PressStrip` — placeholder slots for future press                 |
| **E5** | "Your data is never sold" in `SecurityTrust`                      |

**Pre-launch testimonial policy:** Named beta users with consent, or _"Early access user, Mexico City"_ until legal review.

### Phase F — Conversion and funnel (Week 4)

| Ticket | Work                                                           |
| ------ | -------------------------------------------------------------- |
| **F1** | Pricing UX — annual toggle, MX$199 coffee/week anchoring       |
| **F2** | Final CTA — demo expiry urgency copy                           |
| **F3** | (Optional) Goal modal before signup                            |
| **F4** | SEO comparison pages: `/vs/mint`, `/vs/ynab`, `/vs/lunchmoney` |
| **F5** | Verify `?plan=` on all signup CTAs                             |

**Do not break:** `CheckoutPaymentRecommendations`, geo pricing, Community edition separation.

### Phase G — Motion, accessibility, performance (Week 4–5)

| Ticket | Work                                              |
| ------ | ------------------------------------------------- |
| **G1** | `@axe-core/playwright` on `/en`, `/es`            |
| **G2** | Visual regression baselines (hero, pricing)       |
| **G3** | Lazy below-fold images; `priority` on hero mockup |
| **G4** | `next/font` for display + UI pair                 |
| **G5** | PostHog section visibility + scroll depth         |

---

## 9. File and module structure

Target layout after remediation:

```
apps/web/src/components/landing/
├── landing-page.tsx           # composition root
├── landing-nav.tsx
├── hero.tsx
├── hero-product-preview.tsx
├── landing-trust-strip.tsx
├── product-story-section.tsx
├── persona-cards.tsx
├── problem-solution.tsx       # compressed
├── how-it-works.tsx
├── testimonial-carousel.tsx
├── stats-bar.tsx
├── press-strip.tsx
├── social-proof.tsx
├── security-trust.tsx
├── platform-depth.tsx
├── pricing.tsx                # preserve API logic
├── final-cta.tsx
├── footer.tsx
└── features-grid.tsx          # demoted / features page

apps/web/src/app/[locale]/landing/
├── page.tsx                   # thin server entry
├── layout.tsx                 # generateMetadata
└── loading.tsx

packages/shared/src/i18n/{en,es,pt-BR}/landing.ts
apps/web/public/landing/       # screenshots, logos
apps/web/public/og-image.png
```

---

## 10. PR slicing strategy

| PR       | Scope                                           | Risk   |
| -------- | ----------------------------------------------- | ------ |
| **PR-1** | Phase A — architecture, SSR, dedupe, OG image   | Medium |
| **PR-2** | Phase B — nav, hero, tokens, trust strip        | Low    |
| **PR-3** | Phase C — scroll story, demote feature grid     | Medium |
| **PR-4** | Phase D + E — personas, testimonials, logos     | Low    |
| **PR-5** | Phase F + G — conversion, a11y, perf, analytics | Low    |

Each PR must pass:

- `apps/web/test/integration/landing-demo-flow.test.tsx`
- `apps/web/e2e/subscription-journey.spec.ts` (landing/pricing block)
- New axe smoke (PR-5)

---

## 11. Test remediation matrix

| Test                         | Current              | Required change                             |
| ---------------------------- | -------------------- | ------------------------------------------- |
| `landing-demo-flow.test.tsx` | Imports `@/app/page` | Import shared `LandingPage` or locale route |
| Playwright pricing           | `/en` + `#pricing`   | Keep; add hero + nav anchor tests           |
| Middleware tests             | Locale redirect      | Regression: `/` → `/es`, rewrite to landing |
| Visual regression            | None                 | Add Playwright screenshots (PR-2+)          |
| i18n unit tests              | EN-only              | Spot-check ES/PT hero keys                  |

**New E2E cases**

- Sticky nav `#pricing` scroll
- Persona card → `app.dhan.am/demo?persona=maria`
- Hero H1 in SSR HTML
- Demo button → demo picker or dashboard (update stale guest-login assumption)

---

## 12. Analytics instrumentation

Extend PostHog on the Dhanam landing:

| Event                    | Properties                                                     |
| ------------------------ | -------------------------------------------------------------- |
| `landing_section_viewed` | `{ section, locale }`                                          |
| `persona_card_clicked`   | `{ persona, locale }`                                          |
| `landing_nav_clicked`    | `{ target: 'pricing' \| 'features' \| … }`                     |
| `scroll_depth`           | `{ percent: 25 \| 50 \| 75 \| 100 }`                           |
| `live_demo_clicked`      | Add `{ source: 'hero' \| 'final' \| 'nav' }` to existing event |
| `signup_clicked`         | Already includes `plan`, `locale`                              |

**Funnel:** Landing view → Demo click → Demo dashboard → Register → Trial start.

See [guides/POSTHOG_INTEGRATION.md](guides/POSTHOG_INTEGRATION.md).

---

## 13. Content and asset checklist

| Asset                                                   | Owner         | Blocks  |
| ------------------------------------------------------- | ------------- | ------- |
| Dashboard screenshots (6 chapters)                      | Design / Eng  | Phase C |
| Partner SVG logos (Belvo, Plaid, Bitso, Zapper, Zillow) | Brand / Legal | Phase E |
| OG image 1200×630 (Dhanam brand)                        | Design        | Phase A |
| Testimonials (6–8, consent)                             | PM / Growth   | Phase E |
| Press logos (when available)                            | PM            | Phase E |
| ES / PT copy review                                     | i18n          | Phase B |

---

## 14. Risk register

| Risk                            | Mitigation                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------- |
| SSR + Janua provider complexity | Landing shell avoids auth-dependent render; auth redirect in client island      |
| Cross-origin demo embed (B4)    | Shipped — [HERO_IPAD_SHOWCASE.md](./HERO_IPAD_SHOWCASE.md) (hero tablet + tour) |
| Screenshot drift vs product     | Regenerate from demo personas or CI snapshot job                                |
| Pricing API failure             | Keep static MXN fallback in `pricing.tsx`                                       |
| Scope creep (comparison pages)  | F4 optional after core landing                                                  |
| E2E demo flow mismatch          | Fix in PR-1; document cross-origin behavior                                     |

---

## 15. Competitive messaging guardrails

**Lead with (hero + chapter 1)**

1. Instant **Try Live Demo** on Dhanam
2. Unified wealth (bank + crypto + property + collectibles)
3. LATAM-native (Belvo, MXN, Banxico)

**Do not lead with**

- Monte Carlo jargon above fold
- Twelve-feature bullet grid
- "Autonomous Family Office" (too abstract for cold traffic)

**Company vs product in copy**

- Use **Dhanam** for product features, trial, demo, and app CTAs.
- Use **MADFAM** only for company legal line, ecosystem banner, and "by Aureo Labs, a MADFAM company" where appropriate — not as the primary hero brand for consumer acquisition.

---

## 16. Execution timeline

| Week | Deliverable                                                             |
| ---- | ----------------------------------------------------------------------- |
| 1    | PR-1 + PR-2: unified page, SSR hero, nav, product visual, design tokens |
| 2    | PR-3: six-chapter scroll story; feature grid demoted                    |
| 3    | PR-4: personas v2, testimonials, SVG logos                              |
| 4    | PR-5: conversion polish, axe, visual regression, analytics              |
| 5    | Buffer: comparison pages, embed demo, press assets                      |

---

## 17. Definition of done

- [ ] Single `LandingPage` composition; no section drift between routes
- [ ] Hero H1 + primary CTA in SSR HTML for `es`, `en`, `pt-BR`
- [ ] Product visual in hero; scroll story replaces feature-grid prominence
- [ ] Persona picker with analytics; 4+ visual persona cards
- [ ] Testimonials + partner SVG logos + stats bar
- [ ] Landing uses design tokens only (no hardcoded blue-purple gradients)
- [ ] LCP <1.5s p95 on `dhan.am/es` (staging / production proof)
- [ ] WCAG AA axe pass on `/en` and `/es`
- [ ] Landing integration + Playwright tests green
- [ ] PostHog funnel dashboard configured

---

## 18. Related documents

| Document                                                                               | Use                                           |
| -------------------------------------------------------------------------------------- | --------------------------------------------- |
| [LANDING_DESIGN_SYSTEM.md](LANDING_DESIGN_SYSTEM.md)                                   | Typography, color, motion, landing components |
| [market-research/competitive-benchmarks.md](market-research/competitive-benchmarks.md) | Pricing and feature matrix                    |
| [DEVELOPMENT.md](DEVELOPMENT.md)                                                       | Local ports; landing at `localhost:3040/en`   |
| [guides/POSTHOG_INTEGRATION.md](guides/POSTHOG_INTEGRATION.md)                         | Analytics events                              |
| [LAUNCH_OPERATIONS.md](LAUNCH_OPERATIONS.md)                                           | Launch checklist                              |
| [apps/web/src/lib/demo/launch-demo.ts](../apps/web/src/lib/demo/launch-demo.ts)        | Cross-origin demo launch contract             |

---

_Dhanam is a product of Aureo Labs, a MADFAM company. MADFAM is Innovaciones MADFAM S.A.S. de C.V._
