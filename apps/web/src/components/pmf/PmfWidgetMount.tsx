'use client';

/**
 * PmfWidgetMount — scaffolded integration for `@madfam/pmf-widget`.
 *
 * SCAFFOLD STATUS (read before "fixing" the dynamic import):
 *
 * `@madfam/pmf-widget@0.1.0` is built but NOT YET PUBLISHED to the
 * MADFAM npm registry. Publish is blocked on `NPM_MADFAM_TOKEN`
 * rotation (operator-only). The dep is **intentionally not declared**
 * in apps/web/package.json: while the prior arrangement let pnpm
 * resolve the lockfile entry from cache, fresh CI runs (and any
 * `pnpm install` after a lockfile cache miss) hit
 * `ERR_PNPM_FETCH_401` from npm.madfam.io because the tarball isn't
 * actually published, which blocked every dhanam CI workflow.
 *
 * Why this is safe today:
 *   1. The import is dynamic (runtime, with `webpackIgnore` /
 *      `@vite-ignore`), not static — bundlers do not resolve it at
 *      build time, so a missing module does not fail the build.
 *   2. The component is gated on `NEXT_PUBLIC_PMF_WIDGET_ENABLED`. Until
 *      an operator flips the flag, the dynamic import never fires and
 *      no runtime resolution is attempted.
 *   3. A local type stub at `apps/web/src/types/madfam-pmf-widget.d.ts`
 *      satisfies `tsc --noEmit` so typecheck passes without the package
 *      installed. Delete the stub after the real package is installed
 *      so the published types take over.
 *
 * Activation checklist (post-publish):
 *   - Rotate NPM_MADFAM_TOKEN (operator) and publish
 *     `@madfam/pmf-widget@^0.1.0` to npm.madfam.io
 *   - `pnpm add @madfam/pmf-widget@^0.1.0 -F @dhanam/web` to re-add it
 *     to dependencies + lockfile
 *   - Set `NEXT_PUBLIC_PMF_WIDGET_ENABLED=true` in the deployed env
 *   - Set `NEXT_PUBLIC_TULANA_API_URL` if not the default
 *   - Delete `apps/web/src/types/madfam-pmf-widget.d.ts`
 *
 * See RFC 0013 (internal-devops/rfcs/0013-pmf-via-coforma-and-tulana.md)
 * for the full PMF measurement architecture. Reference implementation:
 * tezca PR #39 (apps/web/components/pmf/PmfWidgetMount.tsx).
 */

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ComponentType } from 'react';

import { useAuth } from '~/lib/hooks/use-auth';

/**
 * Read the flag at render time (not module-load time) so tests can flip
 * `process.env.NEXT_PUBLIC_PMF_WIDGET_ENABLED` between render passes
 * without needing to reset Jest's module cache (which also resets the
 * React instance and breaks @testing-library/react). In production
 * builds Next.js inlines `process.env.NEXT_PUBLIC_*` at build time, so
 * this still compiles down to a constant on the client.
 */
function isFlagEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PMF_WIDGET_ENABLED === 'true';
}

function getTulanaApiUrl(): string {
  return process.env.NEXT_PUBLIC_TULANA_API_URL || 'https://tulana-api.madfam.io';
}

/**
 * Route prefixes where the PMF widget MUST NOT render.
 *
 * Dhanam's authenticated dashboard product surface lives under
 * `/dashboard/*` (and assorted feature routes). The widget should fire
 * there once the user has hit the core value moment (first transaction
 * categorized). Auth, onboarding, billing checkout, and the marketing
 * root are excluded — both because they would distort PMF signal and
 * because anonymous traffic on marketing should never see the
 * authenticated widget regardless.
 */
const EXCLUDED_PATH_PREFIXES = [
  '/login', // Janua sign-in
  '/auth', // OIDC callback / utility pages
  '/onboarding', // First-run wizard — first-session noise
  '/billing/checkout', // Stripe MX / Conekta / Paddle checkout flow
  '/billing/success', // Post-checkout confirmation (transactional)
];

// Marketing root `/` is excluded as an exact match (not prefix) so we
// don't accidentally exclude every authenticated route under it.
const EXCLUDED_EXACT_PATHS = new Set<string>(['/']);

function isExcludedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (EXCLUDED_EXACT_PATHS.has(pathname)) return true;
  return EXCLUDED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

// Minimal structural type matching @madfam/pmf-widget's PMFWidgetProps.
interface PmfWidgetComponentProps {
  product: string;
  user: { id: string; email?: string; name?: string; plan?: string };
  apiUrl: string;
  triggers: {
    nps?: { afterSession?: number; dismissCooldownDays?: number };
    ellis?: { afterSession?: number; dismissCooldownDays?: number };
    smile?: { afterAction?: { type: string; count: number } };
  };
  productLabel?: string;
  disabled?: boolean;
}

type PmfWidgetModule = {
  PMFWidget: ComponentType<PmfWidgetComponentProps>;
};

export function PmfWidgetMount() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const [Widget, setWidget] = useState<ComponentType<PmfWidgetComponentProps> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const flagEnabled = isFlagEnabled();
  const pathExcluded = isExcludedPath(pathname);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!flagEnabled) return;
    if (pathExcluded) return;
    if (!isAuthenticated || !userId) return;

    let cancelled = false;
    const modulePath = '@madfam/pmf-widget';
    import(/* webpackIgnore: true */ /* @vite-ignore */ modulePath)
      .then((mod: PmfWidgetModule) => {
        if (cancelled) return;
        setWidget(() => mod.PMFWidget);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [flagEnabled, isAuthenticated, userId, pathExcluded]);

  if (!flagEnabled) return null;
  if (pathExcluded) return null;
  if (loadFailed) return null;
  if (!Widget) return null;
  if (!isAuthenticated || !userId || !user) return null;

  return (
    <Widget
      product="dhanam"
      user={{
        id: userId,
        email: user.email ?? undefined,
        name: user.name ?? undefined,
      }}
      apiUrl={getTulanaApiUrl()}
      productLabel="Dhanam"
      triggers={{
        nps: { afterSession: 5, dismissCooldownDays: 30 },
        ellis: { afterSession: 3, dismissCooldownDays: 45 },
        smile: { afterAction: { type: 'transaction_categorized', count: 1 } },
      }}
    />
  );
}
