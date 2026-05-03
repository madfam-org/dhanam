import { z } from 'zod';

const envSchemaBase = z.object({
  // API
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_BASE_URL: z.string().url().default('http://localhost:3040'),
  NEXT_PUBLIC_ADMIN_URL: z.string().url().optional(),

  // Auth (Janua OIDC)
  NEXT_PUBLIC_AUTH_MODE: z.enum(['local', 'janua']).default('local'),
  NEXT_PUBLIC_JANUA_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_JANUA_API_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_OIDC_ISSUER: z.string().url().optional(),
  NEXT_PUBLIC_OIDC_CLIENT_ID: z.string().min(1).optional(),

  // Analytics (PostHog)
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),

  // Error Monitoring (Sentry)
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().optional(),

  // Billing
  NEXT_PUBLIC_STRIPE_MX_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: z.string().optional(),
  NEXT_PUBLIC_PADDLE_ENVIRONMENT: z.enum(['sandbox', 'production']).optional(),

  // Localization
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['en', 'es', 'pt']).default('en'),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const envSchema = envSchemaBase.superRefine((data, ctx) => {
  // In janua auth mode, OIDC vars are required (auth literally won't work without them)
  if (data.NEXT_PUBLIC_AUTH_MODE === 'janua') {
    if (!data.NEXT_PUBLIC_OIDC_ISSUER) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'NEXT_PUBLIC_OIDC_ISSUER is required when auth mode is janua',
        path: ['NEXT_PUBLIC_OIDC_ISSUER'],
      });
    }
    if (!data.NEXT_PUBLIC_OIDC_CLIENT_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'NEXT_PUBLIC_OIDC_CLIENT_ID is required when auth mode is janua',
        path: ['NEXT_PUBLIC_OIDC_CLIENT_ID'],
      });
    }
    if (!data.NEXT_PUBLIC_JANUA_API_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'NEXT_PUBLIC_JANUA_API_URL is required when auth mode is janua',
        path: ['NEXT_PUBLIC_JANUA_API_URL'],
      });
    }
  }

  // Note: PostHog absence used to be a fatal error in production — that was
  // wrong. Observability is non-essential for the app to serve users; treating
  // it as load-blocking caused 5+ days of CrashLoopBackOff (660 restarts on
  // dhanam-web-85f66c94fb) when the env var was simply forgotten in the K8s
  // Secret rollout. The check was downgraded to a non-blocking warn at module
  // load (see getEnv() below) so prod can boot even when PostHog is unset.
  //
  // Repeat incident 2026-04-28: a 20h crashloop hit again when prod kept
  // running an image built before the original fix shipped (PR #399, commit
  // ba6cac1). The validator code was already correct on main; the deployed
  // image was simply stale. This block is a load-bearing reminder: if a
  // future PR ever wants to promote PostHog (or any observability var) back
  // to required, the answer is no. Add it here as a soft warn instead.
  //
  // Repeat incident #3 (2026-04-28, evening): same stale-image symptom
  // resurfaced — pods crashlooping with the old "should be set in production
  // for observability" message that no longer exists in source. Self-hosted
  // PostHog has been REMOVED from the platform (see enclii CLAUDE.md: S106
  // removed, S110 cleaned). The Cloudflare Worker proxy at
  // analytics.madfam.io still exists for PostHog Cloud, but that path is
  // entirely opt-in via the env var being set — its absence is now the
  // expected steady state, not a misconfiguration. If you find yourself
  // here writing a `required()` call, stop: every call site
  // (posthog.ts, useAnalytics.ts, PostHogProvider.tsx) already guards on
  // truthiness and no-ops cleanly when the key is unset.
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  // Ops escape hatch: if a future validator regression ever blocks pod boot,
  // operators can flip SKIP_ENV_VALIDATION=1 in the ConfigMap to bypass Zod
  // entirely and recover the web tier in seconds. The schema is still parsed
  // partially via getEnvUnsafe() at use sites, so type narrowing still works.
  // Use only as a break-glass — log loudly so it's visible in incident review.
  if (process.env.SKIP_ENV_VALIDATION === '1') {
    console.warn(
      '[dhanam-web] SKIP_ENV_VALIDATION=1 — Zod env schema bypassed. ' +
        'This is a break-glass for prod incidents only; remove it once recovered.'
    );
    cachedEnv = envSchemaBase.partial().parse(process.env) as Env;
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    const message = Object.entries(formatted)
      .map(([key, errors]) => `  ${key}: ${errors?.join(', ')}`)
      .join('\n');
    throw new Error(`[dhanam-web] Invalid environment variables:\n${message}`);
  }
  cachedEnv = parsed.data;

  // Warn (but don't fail) on missing observability — see superRefine note above.
  if (cachedEnv.NODE_ENV === 'production' && !cachedEnv.NEXT_PUBLIC_POSTHOG_KEY) {
    console.warn(
      '[dhanam-web] NEXT_PUBLIC_POSTHOG_KEY not set in production — observability disabled. ' +
        'Set it in dhanam-secrets to re-enable PostHog tracking.'
    );
  }

  return cachedEnv;
}

export function getEnvUnsafe(): Partial<Env> {
  return envSchemaBase.partial().parse(process.env);
}
