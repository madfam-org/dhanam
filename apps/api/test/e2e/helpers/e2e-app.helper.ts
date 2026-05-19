import fastifyCookie from '@fastify/cookie';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

function disableExternalProviderCredentialsForE2E() {
  process.env.PLAID_CLIENT_ID = '';
  process.env.PLAID_SECRET = '';
}

function configureE2EAuthEnvironment() {
  process.env.AUTH_MODE = 'local';
  process.env.ENABLE_LOCAL_AUTH = 'true';
  process.env.JANUA_ISSUER = process.env.JANUA_ISSUER || 'https://auth.test.madfam.local';
  process.env.JANUA_JWKS_URI =
    process.env.JANUA_JWKS_URI || 'https://auth.test.madfam.local/.well-known/jwks.json';
  process.env.JANUA_AUDIENCE = process.env.JANUA_AUDIENCE || 'dhanam-api';
}

/**
 * Creates and initialises a NestFastifyApplication for E2E tests.
 *
 * Mirrors the plugin registrations in main.ts that controllers depend on:
 *  - @fastify/cookie  (required by AuthController.setCookie)
 *  - ValidationPipe    (whitelist + transform)
 *  - Global prefix v1
 */
export async function createE2EApp(): Promise<NestFastifyApplication> {
  configureE2EAuthEnvironment();
  disableExternalProviderCredentialsForE2E();
  const { AppModule } = await import('../../../src/app.module');

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

  // Cookie plugin — auth controller calls res.setCookie()

  await app.register(fastifyCookie as any, {
    secret: 'e2e-test-cookie-secret',
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.setGlobalPrefix('v1');

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
