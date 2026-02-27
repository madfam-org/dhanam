/**
 * =============================================================================
 * Dhanam API Configuration
 * =============================================================================
 * Supports both standalone mode and Galaxy ecosystem integration (Janua SSO).
 * =============================================================================
 */
export const configuration = () => ({
  node_env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4300', 10), // MADFAM port block: 4300-4399

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL,
  },

  // ==========================================================================
  // Janua OIDC Configuration (Galaxy Ecosystem)
  // ==========================================================================
  janua: {
    enabled: process.env.JANUA_ENABLED === 'true',
    issuer: process.env.JANUA_ISSUER,
    jwksUri: process.env.JANUA_JWKS_URI,
    audience: process.env.JANUA_AUDIENCE || 'janua.dev',
    // Optional: Client credentials for backend-to-Janua API calls
    clientId: process.env.JANUA_CLIENT_ID,
    clientSecret: process.env.JANUA_CLIENT_SECRET,
  },

  // Legacy local JWT (for standalone mode)
  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },

  providers: {
    belvo: {
      secretId: process.env.BELVO_SECRET_ID,
      secretPassword: process.env.BELVO_SECRET_PASSWORD,
      webhookSecret: process.env.BELVO_WEBHOOK_SECRET,
    },
    plaid: {
      clientId: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      env: process.env.PLAID_ENV || 'sandbox',
      webhookSecret: process.env.PLAID_WEBHOOK_SECRET,
    },
    bitso: {
      apiKey: process.env.BITSO_API_KEY,
      apiSecret: process.env.BITSO_API_SECRET,
    },
  },

  external: {
    banxico: {
      apiToken: process.env.BANXICO_API_TOKEN,
    },
  },

  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'noreply@dhanam.app',
  },

  monitoring: {
    posthog: {
      apiKey: process.env.POSTHOG_API_KEY,
      host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
    },
  },

  cors: {
    origins: process.env.CORS_ORIGINS || 'http://localhost:3000',
  },
});
