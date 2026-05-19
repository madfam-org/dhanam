/**
 * Synthetic Monitoring - Smoke Tests
 * Run periodically to verify critical user flows.
 * SOC 2 Control: Continuous availability monitoring.
 *
 * Usage: npx ts-node infra/monitoring/synthetic.ts
 */

const API_URL = process.env.API_URL || 'https://api.dhan.am/v1';
const WEB_URL = process.env.WEB_URL || 'https://app.dhan.am';
const TIMEOUT = 10_000;

interface CheckResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkHealth(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(`${API_URL}/monitoring/health`);
    const data = await res.json();
    return {
      name: 'API Health',
      passed: res.ok && data.status !== 'unhealthy',
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'API Health',
      passed: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkWebApp(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(WEB_URL);
    return {
      name: 'Web App',
      passed: res.ok,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Web App',
      passed: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkAuthEndpoint(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(`${API_URL}/auth/me`, {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    // Expecting 401 - proves auth endpoint is working
    return {
      name: 'Auth Endpoint',
      passed: res.status === 401,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Auth Endpoint',
      passed: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkSecurityHeaders(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(WEB_URL);
    const headers = res.headers;
    const required = [
      'x-frame-options',
      'x-content-type-options',
      'strict-transport-security',
      'content-security-policy',
    ];
    const missing = required.filter((h) => !headers.get(h));
    return {
      name: 'Security Headers',
      passed: missing.length === 0,
      durationMs: Date.now() - start,
      error: missing.length > 0 ? `Missing: ${missing.join(', ')}` : undefined,
    };
  } catch (error) {
    return {
      name: 'Security Headers',
      passed: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main() {
  console.log(`Synthetic monitoring - ${new Date().toISOString()}`);
  console.log(`API: ${API_URL}`);
  console.log(`Web: ${WEB_URL}\n`);

  const results = await Promise.all([
    checkHealth(),
    checkWebApp(),
    checkAuthEndpoint(),
    checkSecurityHeaders(),
  ]);

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(
      `${icon} ${result.name} (${result.durationMs}ms)${result.error ? ` - ${result.error}` : ''}`
    );
  }

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.log(`\n${failed.length} check(s) failed`);
    process.exit(1);
  }

  console.log('\nAll checks passed');
}

main().catch(console.error);
