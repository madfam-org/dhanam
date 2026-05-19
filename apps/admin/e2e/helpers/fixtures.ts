import { test as base, expect, Page, Route } from '@playwright/test';
import { adminLogin, adminLogout } from './auth';

async function fulfillJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization,content-type',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  });
}

async function installAdminApiMocks(page: Page): Promise<void> {
  await page.context().route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/admin/stats')) {
      await fulfillJson(route, {
        users: { total: 120, verified: 110, withTotp: 42, active30Days: 88 },
        spaces: { total: 75, personal: 48, business: 27 },
        accounts: { total: 210, connected: 185, byProvider: { plaid: 90, belvo: 65, bitso: 30 } },
        transactions: { total: 18420, last30Days: 2400, categorized: 17100 },
      });
      return;
    }

    if (path.endsWith('/admin/feature-flags')) {
      await fulfillJson(route, []);
      return;
    }

    if (path.endsWith('/admin/health')) {
      await fulfillJson(route, {
        database: { status: 'healthy', connections: 7 },
        redis: { status: 'healthy', connected: true },
        queues: { status: 'healthy' },
        providers: { status: 'healthy' },
        uptime: 3600,
      });
      return;
    }

    if (path.endsWith('/admin/metrics')) {
      await fulfillJson(route, {
        dau: 42,
        wau: 180,
        mau: 620,
        queueStats: { status: 'healthy' },
        resourceUsage: { memoryMB: 256, uptimeSeconds: 3600 },
      });
      return;
    }

    if (path.endsWith('/admin/queues')) {
      await fulfillJson(route, {
        queues: [
          { name: 'sync-transactions', status: 'healthy', recentJobs: 12, failedJobs: 0 },
          { name: 'categorize-transactions', status: 'healthy', recentJobs: 24, failedJobs: 1 },
        ],
      });
      return;
    }

    if (path.endsWith('/admin/users')) {
      await fulfillJson(route, { data: [], total: 0, page: 1, limit: 25, totalPages: 0 });
      return;
    }

    if (path.endsWith('/admin/spaces')) {
      await fulfillJson(route, { data: [], total: 0, page: 1, limit: 25, totalPages: 0 });
      return;
    }

    await route.continue();
  });
}

async function gotoAdminDashboard(page: Page): Promise<void> {
  try {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('net::ERR_ABORTED')) {
      throw error;
    }

    if (!/\/dashboard/.test(page.url())) {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    }
  }

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator('main')).toBeVisible();
}

/**
 * Extended test fixtures with admin authentication helpers.
 */
export const test = base.extend<{
  adminPage: Page;
}>({
  /**
   * A Page pre-authenticated as an admin user and navigated to /dashboard.
   */
  adminPage: async ({ page }, use) => {
    await installAdminApiMocks(page);
    await adminLogin(page);
    await gotoAdminDashboard(page);
    await use(page);
    await adminLogout(page);
  },
});

export { expect };
