import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultThresholds, defaultOptions } from '../config.js';
import { login, authHeaders } from '../helpers/auth.js';

export const options = {
  ...defaultOptions,
  thresholds: {
    ...defaultThresholds,
    http_req_duration: ['p(95)<1500'], // Page loads <1.5s p95
  },
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

  // Simulate dashboard page load (parallel API calls)
  const responses = http.batch([
    ['GET', `${BASE_URL}/v1/spaces/${spaceId}/accounts`, null, authHeaders(data.token)],
    ['GET', `${BASE_URL}/v1/spaces/${spaceId}/budgets`, null, authHeaders(data.token)],
    ['GET', `${BASE_URL}/v1/spaces/${spaceId}/wealth/summary`, null, authHeaders(data.token)],
  ]);

  responses.forEach((res, i) => {
    check(res, {
      [`dashboard request ${i} succeeds`]: (r) => r.status === 200,
    });
  });

  sleep(2);
}
