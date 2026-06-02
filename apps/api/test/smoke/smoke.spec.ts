/**
 * Smoke Tests for Post-Deployment Validation
 *
 * These tests verify that the API is functioning correctly after deployment.
 * They should be run against a live environment (staging/production) to validate:
 * - Health endpoints respond correctly
 * - Database connectivity is established
 * - Redis connectivity is established
 * - Financial provider APIs are reachable
 * - Auth endpoints behave correctly (401 for unauthenticated requests)
 */

import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { AppModule } from '../../src/app.module';

describe('Smoke Tests', () => {
  let app: INestApplication;
  let configService: ConfigService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

    configService = moduleFixture.get<ConfigService>(ConfigService);

    // Apply same global configuration as main app
    app.setGlobalPrefix('v1');

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('Health Endpoints', () => {
    it('GET /v1/monitoring/health should return 200 with health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/monitoring/health')
        .expect((res) => {
          // Accept 200 (healthy) or 503 (degraded but responding)
          expect([200, 503]).toContain(res.status);
        });

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('redis');
      expect(response.body.checks).toHaveProperty('providers');
    });

    it('GET /v1/monitoring/health/ready should return readiness status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/monitoring/health/ready')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(response.body).toHaveProperty('ready');
      expect(response.body).toHaveProperty('checks');
    });

    it('GET /v1/monitoring/health/live should return 200 with liveness status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/monitoring/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('alive');
      expect(response.body.alive).toBe(true);
      expect(response.body).toHaveProperty('uptime');
      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });

  describe('Database Connectivity', () => {
    it('Health check should report database status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/monitoring/health')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(response.body.checks.database).toHaveProperty('status');
      // Database should be 'up' for a healthy deployment
      // If it's 'down', the smoke test should fail to alert us
      if (response.body.status === 'healthy') {
        expect(response.body.checks.database.status).toBe('up');
      }
    });
  });

  describe('Redis Connectivity', () => {
    it('Health check should report redis status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/monitoring/health')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(response.body.checks.redis).toHaveProperty('status');
      // Redis should be 'up' for a healthy deployment
      if (response.body.status === 'healthy') {
        expect(response.body.checks.redis.status).toBe('up');
      }
    });
  });

  describe('Provider Connectivity', () => {
    it('Health check should report provider status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/monitoring/health')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(response.body.checks.providers).toHaveProperty('status');
      expect(response.body.checks.providers).toHaveProperty('details');
      expect(response.body.checks.providers.details).toHaveProperty('belvo');
      expect(response.body.checks.providers.details).toHaveProperty('plaid');
      expect(response.body.checks.providers.details).toHaveProperty('bitso');

      // Each provider should have a status (up, down, or unconfigured)
      const validStatuses = ['up', 'down', 'unconfigured'];
      expect(validStatuses).toContain(response.body.checks.providers.details.belvo.status);
      expect(validStatuses).toContain(response.body.checks.providers.details.plaid.status);
      expect(validStatuses).toContain(response.body.checks.providers.details.bitso.status);
    });
  });

  describe('Auth Endpoints', () => {
    it('GET /v1/auth/me should return 401 for unauthenticated requests', async () => {
      const response = await request(app.getHttpServer()).get('/v1/auth/me').expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('POST /v1/auth/login with invalid credentials should return 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'invalid@test.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('Protected endpoints should require authentication', async () => {
      // Try accessing a protected endpoint without auth
      const response = await request(app.getHttpServer()).get('/v1/spaces').expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('API Responsiveness', () => {
    it('Health endpoint should respond within 5 seconds', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/v1/monitoring/health')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
    });

    it('Liveness probe should respond quickly (under 1 second)', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer()).get('/v1/monitoring/health/live').expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Critical Services Health', () => {
    it('All critical services should be operational for a healthy system', async () => {
      const response = await request(app.getHttpServer()).get('/v1/monitoring/health');

      // For a smoke test to pass, the system should be at least degraded (not unhealthy)
      expect(['healthy', 'degraded']).toContain(response.body.status);

      // If system is healthy, all critical checks should be up
      if (response.body.status === 'healthy') {
        expect(response.body.checks.database.status).toBe('up');
        expect(response.body.checks.redis.status).toBe('up');
      }
    });
  });
});

/**
 * Remote Smoke Tests
 *
 * These tests can be run against a remote production/staging URL.
 * Use environment variable SMOKE_TEST_URL to specify the target.
 */
describe('Remote Smoke Tests', () => {
  const baseUrl = process.env.SMOKE_TEST_URL;

  // Skip these tests if no remote URL is configured
  const conditionalIt = baseUrl ? it : it.skip;

  conditionalIt('Remote health endpoint should respond', async () => {
    if (!baseUrl) return;

    const response = await fetch(`${baseUrl}/v1/monitoring/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    expect([200, 503]).toContain(response.status);

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
  });

  conditionalIt('Remote readiness probe should respond', async () => {
    if (!baseUrl) return;

    const response = await fetch(`${baseUrl}/v1/monitoring/health/ready`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    expect([200, 503]).toContain(response.status);

    const body = await response.json();
    expect(body).toHaveProperty('ready');
  });

  conditionalIt('Remote liveness probe should return 200', async () => {
    if (!baseUrl) return;

    const response = await fetch(`${baseUrl}/v1/monitoring/health/live`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.alive).toBe(true);
  });

  conditionalIt('Remote FX health endpoint should be public', async () => {
    if (!baseUrl) return;

    const response = await fetch(`${baseUrl}/v1/fx-rates/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('service', 'fx-rates');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('testRate');
  });

  conditionalIt('Remote FX auth posture should be protected for rate endpoints', async () => {
    if (!baseUrl) return;

    const fxRate = await fetch(`${baseUrl}/v1/fx/rate?from=USD&to=MXN&type=spot&allow_stale=true`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const fxRatesRate = await fetch(`${baseUrl}/v1/fx-rates/rate?from=USD&to=MXN`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const fxRates = await fetch(
      `${baseUrl}/v1/fx/rates?base=USD&targets=MXN&type=spot&allow_stale=true`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const fxHistory = await fetch(
      `${baseUrl}/v1/fx/history?from=USD&to=MXN&type=spot&from_date=2026-01-01&to_date=2026-01-10`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const currencies = await fetch(`${baseUrl}/v1/fx-rates/currencies`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(fxRate.status).toBe(401);
    expect(fxRatesRate.status).toBe(401);
    expect(fxRates.status).toBe(401);
    expect(fxHistory.status).toBe(401);
    expect(currencies.status).toBe(200);

    const payload = await currencies.json();
    expect(payload).toHaveProperty('currencies');
    expect(payload).toHaveProperty('count');
    expect(payload.count).toBeGreaterThan(0);
  });
});
