/**
 * Mock PrismaService with injectable failure modes per method
 */
export type FailureMode = 'succeed' | 'fail' | 'timeout';

export interface MockPrismaConfig {
  defaultMode?: FailureMode;
  failureError?: Error;
}

export function createMockPrismaService(config: MockPrismaConfig = {}) {
  const defaultMode = config.defaultMode ?? 'succeed';
  let currentMode = defaultMode;
  let failureError = config.failureError ?? new Error('Database unavailable');

  const providerHealthRecords = new Map<string, any>();

  function getKey(provider: string, region: string): string {
    return `${provider}:${region}`;
  }

  function checkMode() {
    if (currentMode === 'fail') throw failureError;
    if (currentMode === 'timeout') return new Promise(() => {}); // never resolves
    return undefined;
  }

  const mock = {
    setMode(mode: FailureMode) {
      currentMode = mode;
    },
    setError(error: Error) {
      failureError = error;
    },
    reset() {
      currentMode = defaultMode;
      providerHealthRecords.clear();
    },

    providerHealthStatus: {
      findUnique: jest.fn(async ({ where }: any) => {
        const modeResult = checkMode();
        if (modeResult) return modeResult;
        const key = getKey(where.provider_region.provider, where.provider_region.region);
        return providerHealthRecords.get(key) ?? null;
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const modeResult = checkMode();
        if (modeResult) return modeResult;
        const key = getKey(where.provider_region.provider, where.provider_region.region);
        let record = providerHealthRecords.get(key);
        if (record) {
          // Apply updates
          for (const [k, v] of Object.entries(update)) {
            if (typeof v === 'object' && v !== null && 'increment' in (v as any)) {
              record[k] = (record[k] || 0) + (v as any).increment;
            } else {
              record[k] = v;
            }
          }
          record.updatedAt = new Date();
        } else {
          record = {
            id: `health-${key}`,
            ...create,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        providerHealthRecords.set(key, record);
        return record;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const modeResult = checkMode();
        if (modeResult) return modeResult;
        let key: string;
        if (where.provider_region) {
          key = getKey(where.provider_region.provider, where.provider_region.region);
        } else {
          // Find record by id field
          key = '';
          for (const [k, v] of providerHealthRecords.entries()) {
            if (v.id === where.id) {
              key = k;
              break;
            }
          }
        }
        const record = providerHealthRecords.get(key);
        if (!record) throw new Error(`Record not found: ${JSON.stringify(where)}`);
        Object.assign(record, data, { updatedAt: new Date() });
        providerHealthRecords.set(key, record);
        return record;
      }),
      findMany: jest.fn(async () => {
        const modeResult = checkMode();
        if (modeResult) return modeResult;
        return Array.from(providerHealthRecords.values());
      }),
    },

    institutionProviderMapping: {
      findFirst: jest.fn(async () => {
        const modeResult = checkMode();
        if (modeResult) return modeResult;
        return null;
      }),
    },

    connectionAttempt: {
      create: jest.fn(async ({ data }: any) => {
        const modeResult = checkMode();
        if (modeResult) return modeResult;
        return { id: 'attempt-1', ...data, attemptedAt: new Date() };
      }),
    },

    $queryRaw: jest.fn(async () => {
      const modeResult = checkMode();
      if (modeResult) return modeResult;
      return [{ '?column?': 1 }];
    }),

    // Expose internal state for test assertions
    _healthRecords: providerHealthRecords,
  };

  return mock;
}
