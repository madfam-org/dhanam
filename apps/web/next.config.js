const { withSentryConfig } = require('@sentry/nextjs');
const { z } = require('zod');

const envSchema = z.object({
  NEXT_PUBLIC_BASE_URL: z.string().url(),
  NEXT_PUBLIC_API_URL: z.string().url(),
});

if (
  process.env.NODE_ENV !== 'development' &&
  process.env.NODE_ENV !== 'test' &&
  process.env.SKIP_ENV_VALIDATION !== 'true'
) {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  });

  if (!parsed.success) {
    console.error('❌ Invalid environment variables in non-development environment:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables for production build');
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  eslint: {
    // ESLint runs in CI/lint workflow; skipping here keeps Docker build green
    // when project-service mode trips on test files outside the prod tsconfig.
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    '@dhanam/shared',
    '@dhanam/ui',
    '@janua/ui',
    '@janua/react-sdk',
    '@janua/typescript-sdk',
  ],

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.dhan.am/v1',
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'https://app.dhan.am',
    NEXT_PUBLIC_ADMIN_URL: process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.dhan.am',
    NEXT_PUBLIC_OIDC_ISSUER: process.env.NEXT_PUBLIC_OIDC_ISSUER,
    NEXT_PUBLIC_OIDC_CLIENT_ID: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID,
    NEXT_PUBLIC_JANUA_API_URL: process.env.NEXT_PUBLIC_JANUA_API_URL,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE || 'en',
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },

  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://analytics.madfam.io https://challenges.cloudflare.com https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              `connect-src 'self' ${(() => {
                try {
                  return new URL(process.env.NEXT_PUBLIC_API_URL || 'https://api.dhan.am').origin;
                } catch {
                  return 'https://api.dhan.am';
                }
              })()} https://analytics.madfam.io ${process.env.NEXT_PUBLIC_OIDC_ISSUER || 'https://auth.madfam.io'} https://challenges.cloudflare.com https://cloudflareinsights.com https://*.ingest.sentry.io`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  disableSourceMapUpload: !process.env.SENTRY_AUTH_TOKEN,
});
