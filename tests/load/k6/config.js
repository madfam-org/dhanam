// Shared k6 configuration and thresholds
// Thresholds derived from CLAUDE.md performance requirements

export const BASE_URL = __ENV.BASE_URL || 'https://api.dhan.am';

export const defaultThresholds = {
  http_req_failed: ['rate<0.01'], // <1% error rate
  http_req_duration: ['p(95)<1500'], // Page loads <1.5s p95
};

export const bulkOpThresholds = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<2000'], // Bulk ops <2s p95
};

export const refreshThresholds = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<15000'], // Manual refresh <15s
};

export const defaultOptions = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up
    { duration: '1m', target: 10 }, // Steady state
    { duration: '10s', target: 0 }, // Ramp down
  ],
};
