/**
 * API Mock Factory
 *
 * Shared mock factories for common API dependencies.
 * Reduces boilerplate in test files and ensures consistent mocking patterns.
 */

import type { ConfigService } from '@nestjs/config';

import type { RedisService } from '../../src/core/redis/redis.service';

/**
 * Create a mock Redis service with optional cache hit simulation
 */
export function createRedisMock(
  cacheHits?: Map<string, unknown>
): jest.Mocked<Pick<RedisService, 'get' | 'set' | 'del' | 'exists' | 'expire' | 'ttl'>> {
  const cache = cacheHits || new Map<string, unknown>();

  return {
    get: jest.fn().mockImplementation(async (key: string) => {
      const value = cache.get(key);
      return value !== undefined ? JSON.stringify(value) : null;
    }),
    set: jest.fn().mockImplementation(async (key: string, value: string) => {
      cache.set(key, JSON.parse(value));
      return 'OK';
    }),
    del: jest.fn().mockImplementation(async (key: string) => {
      cache.delete(key);
      return 1;
    }),
    exists: jest.fn().mockImplementation(async (key: string) => {
      return cache.has(key) ? 1 : 0;
    }),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(3600),
  };
}

/**
 * Create a mock ConfigService with configurable overrides
 */
export function createConfigMock(
  overrides: Record<string, unknown> = {}
): jest.Mocked<Pick<ConfigService, 'get' | 'getOrThrow'>> {
  const defaults: Record<string, unknown> = {
    NODE_ENV: 'test',
    // Zillow defaults
    ZILLOW_API_KEY: '',
    ZILLOW_API_URL: 'https://api.bridgedataoutput.com/api/v2/zestimates',
    ZILLOW_RATE_LIMIT: 100,
    ZILLOW_CACHE_ENABLED: true,
    ZILLOW_CACHE_TTL_HOURS: 24,
    // Zapper defaults
    ZAPPER_API_KEY: '',
    ZAPPER_API_URL: 'https://api.zapper.xyz/v2',
    ZAPPER_RATE_LIMIT: 30,
    // R2 Storage defaults
    R2_ACCOUNT_ID: 'test-account',
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
    R2_BUCKET_NAME: 'test-bucket',
    R2_PUBLIC_URL: 'https://test.r2.dev',
    // General defaults
    API_URL: 'http://localhost:4010',
    ...overrides,
  };

  const config = { ...defaults, ...overrides };

  return {
    get: jest.fn().mockImplementation(<T>(key: string, defaultValue?: T) => {
      return config[key] !== undefined ? config[key] : defaultValue;
    }),
    getOrThrow: jest.fn().mockImplementation(<T>(key: string) => {
      if (config[key] === undefined) {
        throw new Error(`Config key ${key} not found`);
      }
      return config[key] as T;
    }),
  };
}

/**
 * Create a mock S3 client for R2 storage testing
 */
export function createS3ClientMock() {
  return {
    send: jest.fn().mockResolvedValue({}),
  };
}

/**
 * Create a mock for getSignedUrl from @aws-sdk/s3-request-presigner
 */
export function createPresignerMock(url = 'https://test.r2.dev/presigned-url') {
  return jest.fn().mockResolvedValue(url);
}

/**
 * Create a mock Logger that suppresses output during tests
 */
export function createLoggerMock() {
  return {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };
}

/**
 * Create a mock PrismaService with common model mocks
 */
export function createPrismaMock(modelOverrides: Record<string, unknown> = {}) {
  // Helper to create fresh mocks for each model (avoid shared references)
  const createModelMock = () => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  });

  const mock = {
    user: createModelMock(),
    space: createModelMock(),
    account: createModelMock(),
    transaction: createModelMock(),
    budget: createModelMock(),
    category: createModelMock(),
    categoryCorrection: createModelMock(),
    manualAsset: createModelMock(),
    document: createModelMock(),
    providerHealthStatus: createModelMock(),
    recurringTransaction: createModelMock(),
    subscription: createModelMock(),
    connectionAttempt: createModelMock(),
    executorAssignment: createModelMock(),
    executorAccessLog: createModelMock(),
    incomeEvent: createModelMock(),
    categoryGoal: createModelMock(),
    incomeAllocation: createModelMock(),
    ...modelOverrides,
    $transaction: jest.fn((callback: (prisma: unknown) => unknown) => callback(mock)),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  return mock;
}

/**
 * Create a mock HTTP response for fetch
 */
export function createFetchResponse<T>(
  data: T,
  options: { ok?: boolean; status?: number; statusText?: string } = {}
) {
  const { ok = true, status = 200, statusText = 'OK' } = options;

  return Promise.resolve({
    ok,
    status,
    statusText,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
  } as Response);
}

/**
 * Create a mock AuditService
 */
export function createAuditMock() {
  const mock = {
    log: jest.fn().mockResolvedValue(undefined),
    logEvent: jest.fn().mockResolvedValue(undefined),
  };
  return mock;
}

/**
 * Create a mock HTTP error response for fetch
 */
export function createFetchErrorResponse(status: number, statusText: string, errorBody?: unknown) {
  return Promise.resolve({
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve(errorBody || { error: statusText }),
    text: () => Promise.resolve(JSON.stringify(errorBody || { error: statusText })),
    headers: new Headers(),
  } as Response);
}
