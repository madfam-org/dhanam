import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { PrismaService } from '@core/prisma/prisma.service';
import { TIMEOUT_PRESETS } from '@core/utils/timeout.util';
import { QueueService } from '@modules/jobs/queue.service';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    queues: HealthCheck;
    external: HealthCheck;
    providers: ProviderHealthCheck;
  };
  version: string;
  environment: string;
}

export interface BasicHealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
  };
}

export interface HealthCheck {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface ProviderHealthCheck {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  details: {
    belvo: ProviderStatus;
    plaid: ProviderStatus;
    bitso: ProviderStatus;
  };
}

export interface ProviderStatus {
  status: 'up' | 'down' | 'unconfigured';
  required?: boolean;
  mode?: 'required' | 'optional' | 'unconfigured';
  responseTime?: number;
  error?: string;
}

interface QueueStat {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();
  private isShuttingDown = false;
  private redisClient: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService
  ) {}

  /**
   * Mark the service as shutting down (called during graceful shutdown)
   */
  setShuttingDown(value: boolean): void {
    this.isShuttingDown = value;
  }

  async getBasicHealthStatus(): Promise<BasicHealthStatus> {
    const [dbResult, redisResult] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const database: HealthCheck =
      dbResult.status === 'fulfilled' ? dbResult.value : this.createFailedCheck(dbResult.reason);
    const redis: HealthCheck =
      redisResult.status === 'fulfilled'
        ? redisResult.value
        : this.createFailedCheck(redisResult.reason);

    const status = database.status === 'up' && redis.status === 'up' ? 'healthy' : 'unhealthy';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks: { database, redis },
    };
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const [dbResult, redisResult, queuesResult, externalResult, providersResult] =
      await Promise.allSettled([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkQueues(),
        this.checkExternalServices(),
        this.checkAllProviders(),
      ]);

    // Map core checks
    const database: HealthCheck =
      dbResult.status === 'fulfilled' ? dbResult.value : this.createFailedCheck(dbResult.reason);
    const redis: HealthCheck =
      redisResult.status === 'fulfilled'
        ? redisResult.value
        : this.createFailedCheck(redisResult.reason);
    const queues: HealthCheck =
      queuesResult.status === 'fulfilled'
        ? queuesResult.value
        : this.createFailedCheck(queuesResult.reason);
    const external: HealthCheck =
      externalResult.status === 'fulfilled'
        ? externalResult.value
        : this.createFailedCheck(externalResult.reason);
    const providers: ProviderHealthCheck =
      providersResult.status === 'fulfilled'
        ? providersResult.value
        : this.createFailedProviderCheck('Provider check failed');

    const coreChecks: HealthCheck[] = [database, redis, queues, external, providers];
    const overallStatus = this.determineOverallStatus(coreChecks);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks: {
        database,
        redis,
        queues,
        external,
        providers,
      },
      version: process.env.npm_package_version || '0.1.0',
      environment: this.configService.get('NODE_ENV', 'development'),
    };
  }

  async getReadinessStatus(): Promise<{
    ready: boolean;
    reason?: string;
    checks: Record<string, HealthCheck>;
  }> {
    // If shutting down, return not ready immediately
    if (this.isShuttingDown) {
      return {
        ready: false,
        reason: 'Service is shutting down',
        checks: {},
      };
    }

    const health = await this.getBasicHealthStatus();
    const ready = health.checks.database.status === 'up' && health.checks.redis.status === 'up';
    const failedServices = [health.checks.database, health.checks.redis]
      .filter((check) => check.status !== 'up')
      .map((check) => check.error || 'Unknown error');

    return {
      ready,
      reason: ready ? undefined : `Critical services unavailable: ${failedServices.join(', ')}`,
      checks: health.checks,
    };
  }

  async getLivenessStatus(): Promise<{ alive: boolean; uptime: number; shuttingDown: boolean }> {
    return {
      alive: !this.isShuttingDown,
      uptime: Date.now() - this.startTime,
      shuttingDown: this.isShuttingDown,
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'up',
        responseTime: Date.now() - start,
        details: {
          connection: 'active',
        },
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Database check failed',
      };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    const start = Date.now();
    const redisUrl = this.configService.get('REDIS_URL');

    if (!redisUrl) {
      return {
        status: 'down',
        error: 'Redis URL not configured',
      };
    }

    try {
      // Reuse shared Redis connection instead of creating a new one per health check
      if (!this.redisClient || this.redisClient.status === 'end') {
        this.redisClient = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          connectTimeout: TIMEOUT_PRESETS.health_check,
          lazyConnect: true,
        });
        await this.redisClient.connect();
      }
      await this.redisClient.ping();

      return {
        status: 'up',
        responseTime: Date.now() - start,
        details: {
          connection: 'active',
        },
      };
    } catch (error) {
      // Reset client on failure so next check creates a fresh connection
      if (this.redisClient) {
        try {
          this.redisClient.disconnect();
        } catch {
          // ignore disconnect errors
        }
        this.redisClient = null;
      }
      return {
        status: 'down',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Redis check failed',
      };
    }
  }

  private async checkQueues(): Promise<HealthCheck> {
    const start = Date.now();

    try {
      const queueStats = await this.queueService.getAllQueueStats();

      const failedJobs = queueStats.reduce((sum: number, q: QueueStat) => sum + q.failed, 0);
      const failedQueues = queueStats
        .filter((queue: QueueStat) => queue.failed > 0)
        .map((queue: QueueStat) => ({ name: queue.name, failed: queue.failed }));
      const BACKPRESSURE_THRESHOLD = 1000;
      const hasBackpressure = queueStats.some(
        (queue: QueueStat) => queue.waiting > BACKPRESSURE_THRESHOLD
      );

      const status = hasBackpressure ? 'down' : failedJobs > 0 ? 'degraded' : 'up';

      return {
        status,
        responseTime: Date.now() - start,
        details: {
          queues: queueStats.length,
          totalJobs: queueStats.reduce(
            (sum: number, q: QueueStat) => sum + q.active + q.waiting + q.completed,
            0
          ),
          failedJobs,
          failedQueues,
          waitingJobs: queueStats.reduce((sum: number, q: QueueStat) => sum + q.waiting, 0),
          backpressure: hasBackpressure,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Queue check failed',
      };
    }
  }

  private async checkExternalServices(): Promise<HealthCheck> {
    const start = Date.now();
    const checks = [];
    const banxicoToken =
      this.configService.get<string>('BANXICO_API_TOKEN', '') ||
      this.configService.get<string>('BANXICO_SIE_TOKEN', '');

    if (!banxicoToken) {
      return {
        status: 'up',
        responseTime: Date.now() - start,
        details: {
          services: [
            {
              name: 'Banxico',
              status: 'unconfigured',
              optional: true,
            },
          ],
        },
      };
    }

    // Check the same Banxico SIE surface used by the FX providers. The old
    // unauthenticated /doc probe returns 404 and creates a false outage.
    const endpoints = [
      {
        name: 'Banxico',
        url: `https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43718/datos/oportuno?token=${encodeURIComponent(
          banxicoToken
        )}`,
      },
    ];

    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_PRESETS.health_check);

        const response = await fetch(endpoint.url, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        clearTimeout(timeoutId);

        checks.push({
          name: endpoint.name,
          status: response.ok ? 'up' : 'down',
          statusCode: response.status,
        });
      } catch (error) {
        checks.push({
          name: endpoint.name,
          status: 'down',
          error: error instanceof Error ? error.message : 'Connection failed',
        });
      }
    }

    const allUp = checks.every((check) => check.status === 'up');

    return {
      status: allUp ? 'up' : 'down',
      responseTime: Date.now() - start,
      details: { services: checks },
    };
  }

  private determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
    const downCount = checks.filter((check) => check.status === 'down').length;
    const degradedCount = checks.filter((check) => check.status === 'degraded').length;
    const totalChecks = checks.length;
    const nonDownCount = totalChecks - downCount;

    if (downCount === 0 && degradedCount === 0) {
      return 'healthy';
    } else if (downCount === 0 || nonDownCount >= totalChecks * 0.7) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  private createFailedCheck(error: unknown): HealthCheck {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Health check failed',
    };
  }

  private createFailedProviderCheck(error: string): ProviderHealthCheck {
    return {
      status: 'down',
      details: {
        belvo: { status: 'down', error },
        plaid: { status: 'down', error },
        bitso: { status: 'down', error },
      },
    };
  }

  /**
   * Check all financial data provider connectivity
   */
  async checkAllProviders(): Promise<ProviderHealthCheck> {
    const start = Date.now();

    const [belvo, plaid, bitso] = await Promise.all([
      this.checkBelvoConnectivity(),
      this.checkPlaidConnectivity(),
      this.checkBitsoConnectivity(),
    ]);

    const providers = [belvo, plaid, bitso];
    const requiredProviders = providers.filter((provider) => provider.required === true);
    const requiredFailures = requiredProviders.filter((provider) => provider.status !== 'up');
    const optionalConfiguredFailures = providers.filter(
      (provider) => provider.required !== true && provider.status === 'down'
    );

    let overallStatus: 'up' | 'down' | 'degraded';
    if (requiredFailures.length > 0) {
      overallStatus = 'down';
    } else if (optionalConfiguredFailures.length > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'up';
    }

    return {
      status: overallStatus,
      responseTime: Date.now() - start,
      details: { belvo, plaid, bitso },
    };
  }

  /**
   * Check Belvo API connectivity
   */
  async checkBelvoConnectivity(): Promise<ProviderStatus> {
    const secretKeyId = this.configService.get<string>('BELVO_SECRET_KEY_ID');
    const secretKeyPassword = this.configService.get<string>('BELVO_SECRET_KEY_PASSWORD');
    const required = this.isProviderRequired('BELVO', true);

    if (!secretKeyId || !secretKeyPassword) {
      return { status: 'unconfigured', required, mode: 'unconfigured' };
    }

    const start = Date.now();

    try {
      // Check Belvo API health endpoint (sandbox/production)
      const env = this.configService.get<string>('BELVO_ENV', 'sandbox');
      const baseUrl = env === 'production' ? 'https://api.belvo.com' : 'https://sandbox.belvo.com';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_PRESETS.health_check);

      const response = await fetch(`${baseUrl}/api/`, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          Authorization:
            'Basic ' + Buffer.from(`${secretKeyId}:${secretKeyPassword}`).toString('base64'),
        },
      });

      clearTimeout(timeoutId);

      if (response.ok || response.status === 401) {
        // 401 means API is reachable but credentials may be wrong - still counts as reachable
        return {
          status: response.ok ? 'up' : 'up', // API is reachable
          required,
          mode: required ? 'required' : 'optional',
          responseTime: Date.now() - start,
        };
      }

      return {
        status: 'down',
        required,
        mode: required ? 'required' : 'optional',
        responseTime: Date.now() - start,
        error: `HTTP ${response.status}`,
      };
    } catch (error) {
      this.logger.warn('Belvo connectivity check failed', error);
      return {
        status: 'down',
        required,
        mode: required ? 'required' : 'optional',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Check Plaid API connectivity
   */
  async checkPlaidConnectivity(): Promise<ProviderStatus> {
    const clientId = this.configService.get<string>('PLAID_CLIENT_ID');
    const secret = this.configService.get<string>('PLAID_SECRET');
    const required = this.isProviderRequired('PLAID', false);

    if (!clientId || !secret) {
      return { status: 'unconfigured', required, mode: 'unconfigured' };
    }

    const start = Date.now();

    try {
      // Check Plaid API health by calling categories endpoint (doesn't require auth)
      const env = this.configService.get<string>('PLAID_ENV', 'sandbox');
      const baseUrl =
        env === 'production'
          ? 'https://production.plaid.com'
          : env === 'development'
            ? 'https://development.plaid.com'
            : 'https://sandbox.plaid.com';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_PRESETS.health_check);

      const response = await fetch(`${baseUrl}/categories/get`, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      clearTimeout(timeoutId);

      // Plaid returns 400 for invalid request but that means API is reachable
      if (response.ok || response.status === 400) {
        return {
          status: 'up',
          required,
          mode: required ? 'required' : 'optional',
          responseTime: Date.now() - start,
        };
      }

      return {
        status: 'down',
        required,
        mode: required ? 'required' : 'optional',
        responseTime: Date.now() - start,
        error: `HTTP ${response.status}`,
      };
    } catch (error) {
      this.logger.warn('Plaid connectivity check failed', error);
      return {
        status: 'down',
        required,
        mode: required ? 'required' : 'optional',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Check Bitso API connectivity
   */
  async checkBitsoConnectivity(): Promise<ProviderStatus> {
    const apiKey = this.configService.get<string>('BITSO_API_KEY');
    const apiSecret = this.configService.get<string>('BITSO_API_SECRET');
    const required = this.isProviderRequired('BITSO', false);

    if (!apiKey || !apiSecret) {
      return { status: 'unconfigured', required, mode: 'unconfigured' };
    }

    const start = Date.now();

    try {
      // Check Bitso public API (ticker endpoint doesn't require auth)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_PRESETS.health_check);

      const response = await fetch('https://api.bitso.com/v3/ticker?book=btc_mxn', {
        signal: controller.signal,
        method: 'GET',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return {
          status: 'up',
          required,
          mode: required ? 'required' : 'optional',
          responseTime: Date.now() - start,
        };
      }

      return {
        status: 'down',
        required,
        mode: required ? 'required' : 'optional',
        responseTime: Date.now() - start,
        error: `HTTP ${response.status}`,
      };
    } catch (error) {
      this.logger.warn('Bitso connectivity check failed', error);
      return {
        status: 'down',
        required,
        mode: required ? 'required' : 'optional',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  private isProviderRequired(provider: 'BELVO' | 'PLAID' | 'BITSO', productionDefault: boolean) {
    const configured = this.configService.get<string>(`PROVIDER_${provider}_REQUIRED`);
    if (configured !== undefined && configured !== '') {
      return configured === 'true';
    }

    return this.configService.get<string>('NODE_ENV', 'development') === 'production'
      ? productionDefault
      : false;
  }
}
