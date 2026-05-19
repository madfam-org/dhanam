import http from 'k6/http';
import { BASE_URL } from '../config.js';

export function login(email, password) {
  const res = http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({
      email,
      password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (res.status === 200) {
    const body = JSON.parse(res.body);
    return {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
    };
  }

  return null;
}

export function authHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
}
