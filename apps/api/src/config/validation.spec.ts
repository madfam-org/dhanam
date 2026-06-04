import fs from 'node:fs';
import path from 'node:path';

import { validationSchema } from './validation';

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:test_password@localhost:5432/dhanam_test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'test-jwt-secret-for-ci-minimum-32-chars',
  JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-for-ci-32-chars',
  ENCRYPTION_KEY: 'ci-test-encryption-key-exactly32',
};

function parseExampleEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, '../../.env.example');
  const contents = fs.readFileSync(envPath, 'utf8');
  const parsed: Record<string, string> = {};

  for (const line of contents.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split('=');
    parsed[key] = valueParts.join('=');
  }

  return parsed;
}

describe('validationSchema', () => {
  it('accepts supported JWT duration defaults', () => {
    const { error, value } = validationSchema.validate(baseEnv);

    expect(error).toBeUndefined();
    expect(value.JWT_EXPIRES_IN).toBe('15m');
    expect(value.JWT_ACCESS_EXPIRY).toBe('15m');
    expect(value.JWT_REFRESH_EXPIRY).toBe('30d');
  });

  it('rejects placeholder JWT expiry values before boot', () => {
    const { error } = validationSchema.validate({
      ...baseEnv,
      JWT_EXPIRES_IN: 'replace-with-jwt-expires-in',
    });

    expect(error?.message).toContain('JWT_EXPIRES_IN');
  });

  it('keeps the example env JWT durations runnable for E2E bootstrap', () => {
    const example = parseExampleEnv();
    const { error } = validationSchema.validate({
      ...baseEnv,
      JWT_EXPIRES_IN: example.JWT_EXPIRES_IN,
      JWT_REFRESH_EXPIRY: example.JWT_REFRESH_EXPIRY,
    });

    expect(error).toBeUndefined();
  });
});
