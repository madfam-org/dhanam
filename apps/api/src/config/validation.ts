import Joi from 'joi';

const jwtDuration = Joi.string().pattern(/^\d+(?:\.\d+)?(?:ms|s|m|h|d|w|y)$/);

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  PORT: Joi.number().default(4000),

  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),

  // Auth
  JWT_SECRET: Joi.string().required().min(32),
  JWT_REFRESH_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required().min(32),
    otherwise: Joi.string().optional().allow(''),
  }),
  JWT_EXPIRES_IN: jwtDuration.default('15m'),
  JWT_ACCESS_EXPIRY: jwtDuration.default('15m'),
  JWT_REFRESH_EXPIRY: jwtDuration.default('30d'),
  AUTH_MODE: Joi.string().valid('janua', 'local').default('local'),

  ENCRYPTION_KEY: Joi.string().required().length(32),

  // Janua OIDC (required when AUTH_MODE=janua)
  JANUA_ENABLED: Joi.string().optional().allow(''),
  JANUA_ISSUER: Joi.when('AUTH_MODE', {
    is: 'janua',
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  JANUA_JWKS_URI: Joi.when('AUTH_MODE', {
    is: 'janua',
    then: Joi.string().uri().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  JANUA_AUDIENCE: Joi.string().default('janua.dev'),
  JANUA_CLIENT_ID: Joi.string().optional().allow(''),
  JANUA_CLIENT_SECRET: Joi.string().optional().allow(''),

  // Stripe
  STRIPE_SECRET_KEY: Joi.string().optional().allow(''),
  STRIPE_WEBHOOK_SECRET: Joi.string().optional().allow(''),
  STRIPE_MX_SECRET_KEY: Joi.string().optional().allow(''),
  STRIPE_MX_WEBHOOK_SECRET: Joi.string().optional().allow(''),

  // Paddle
  PADDLE_VENDOR_ID: Joi.string().optional().allow(''),
  PADDLE_API_KEY: Joi.string().optional().allow(''),
  PADDLE_CLIENT_TOKEN: Joi.string().optional().allow(''),
  PADDLE_WEBHOOK_SECRET: Joi.string().optional().allow(''),

  // Providers
  BELVO_SECRET_KEY_ID: Joi.string().optional().allow(''),
  BELVO_SECRET_KEY_PASSWORD: Joi.string().optional().allow(''),
  BELVO_ENV: Joi.string().valid('sandbox', 'development', 'production').default('sandbox'),
  BELVO_WEBHOOK_SECRET: Joi.string().optional().allow(''),

  PLAID_CLIENT_ID: Joi.string().optional().allow(''),
  PLAID_SECRET: Joi.string().optional().allow(''),
  PLAID_ENV: Joi.string().valid('sandbox', 'development', 'production').default('sandbox'),
  PLAID_WEBHOOK_SECRET: Joi.string().optional().allow(''),

  BITSO_API_KEY: Joi.string().optional().allow(''),
  BITSO_API_SECRET: Joi.string().optional().allow(''),

  BANXICO_API_TOKEN: Joi.string().optional().allow(''),

  // Email
  SMTP_HOST: Joi.string().optional().allow('').default('localhost'),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().optional().allow(''),
  SMTP_PASSWORD: Joi.string().optional().allow(''),
  EMAIL_FROM: Joi.string().email().default('noreply@dhanam.app'),

  // Monitoring
  POSTHOG_API_KEY: Joi.string().optional(),
  POSTHOG_HOST: Joi.string().uri().default('https://analytics.madfam.io'),

  // Application URLs
  WEB_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().uri().required(),
    otherwise: Joi.string().default('http://localhost:3040'),
  }),
  CORS_ORIGINS: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().default('http://localhost:3040'),
  }),
});
