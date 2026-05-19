import fastifyCookie from '@fastify/cookie';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../../src/app.module';

/**
 * Creates and initialises a NestFastifyApplication for E2E tests.
 *
 * Mirrors the plugin registrations in main.ts that controllers depend on:
 *  - @fastify/cookie  (required by AuthController.setCookie)
 *  - ValidationPipe    (whitelist + transform)
 *  - Global prefix v1
 */
export async function createE2EApp(): Promise<NestFastifyApplication> {
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
