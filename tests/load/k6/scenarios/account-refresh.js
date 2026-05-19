import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, refreshThresholds } from '../config.js';
import { login, authHeaders } from '../helpers/auth.js';

export const options = {
  stages: [
    { duration: '10s', target: 3 }, // Low concurrency for refresh ops
    { duration: '1m', target: 3 },
    { duration: '10s', target: 0 },
  ],
  thresholds: refreshThresholds,
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
  const accountId = __ENV.TEST_ACCOUNT_ID || 'test-account';

  // Manual account refresh
  const res = http.post(
    `${BASE_URL}/v1/spaces/${spaceId}/accounts/${accountId}/refresh`,
    null,
    authHeaders(data.token)
  );

  check(res, {
    'refresh succeeds': (r) => r.status === 200 || r.status === 202,
    'refresh under 15s': (r) => r.timings.duration < 15000,
  });

  sleep(5);
}
