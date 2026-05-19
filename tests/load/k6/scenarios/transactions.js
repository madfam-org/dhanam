import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, bulkOpThresholds, defaultOptions } from '../config.js';
import { login, authHeaders } from '../helpers/auth.js';

export const options = {
  ...defaultOptions,
  thresholds: bulkOpThresholds,
};

export function setup() {
  const auth = login(
    __ENV.TEST_EMAIL || 'loadtest@example.com',
    __ENV.TEST_PASSWORD || 'LoadTest123!'
  );
  return { token: auth?.accessToken };
}

export default function (data) {
  if (!data.token) return;

  const spaceId = __ENV.TEST_SPACE_ID || 'test-space';

  // List transactions (bulk read)
  const listRes = http.get(
    `${BASE_URL}/v1/spaces/${spaceId}/transactions?limit=100`,
    authHeaders(data.token)
  );

  check(listRes, {
    'list transactions succeeds': (r) => r.status === 200,
    'bulk read under 2s p95': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
