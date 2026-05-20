const { withSentryConfig } = require('@sentry/nextjs');

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.dhan.am/v1';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dhan.am';
const oidcIssuer = process.env.NEXT_PUBLIC_OIDC_ISSUER || 'https://auth.madfam.io';

function originForCsp(value) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  eslint: {
    // ESLint is enforced by the repo lint gates; keep production builds
    // focused on compile/type correctness and avoid Next's legacy ESLint probe.
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['@dhanam/shared', '@dhanam/ui', '@janua/ui', '@janua/react-sdk'],

  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_APP_URL: appUrl,
    NEXT_PUBLIC_OIDC_ISSUER: process.env.NEXT_PUBLIC_OIDC_ISSUER,
    NEXT_PUBLIC_OIDC_CLIENT_ID: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID,
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              `connect-src 'self' ${originForCsp(apiUrl)} ${originForCsp(oidcIssuer)} https://*.ingest.sentry.io`,
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
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
