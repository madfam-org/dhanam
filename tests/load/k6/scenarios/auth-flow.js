import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultThresholds, defaultOptions } from '../config.js';

export const options = {
  ...defaultOptions,
  thresholds: defaultThresholds,
};

export default function () {
  // Login
  const loginRes = http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL || 'loadtest@example.com',
      password: __ENV.TEST_PASSWORD || 'LoadTest123!',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(loginRes, {
    'login succeeds': (r) => r.status === 200 || r.status === 201,
  });

  if (loginRes.status === 200 || loginRes.status === 201) {
    const body = JSON.parse(loginRes.body);

    // Token refresh
    const refreshRes = http.post(
      `${BASE_URL}/v1/auth/refresh`,
      JSON.stringify({
        refreshToken: body.refreshToken,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    check(refreshRes, {
      'refresh succeeds': (r) => r.status === 200 || r.status === 201,
    });
  }

  sleep(2);
}
