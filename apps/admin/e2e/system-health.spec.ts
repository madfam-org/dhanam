import { test, expect } from './helpers/fixtures';

test.describe('System Health', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/system-health');
    await expect(adminPage).toHaveURL(/\/system-health/);
  });

  test('should display the system health page heading', async ({ adminPage }) => {
    const heading = adminPage
      .getByRole('main')
      .getByRole('heading', { name: 'System Health', level: 1 });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('should display the page subtitle', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('main').getByText('Monitor system status and performance')
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test('should display the Refresh button', async ({ adminPage }) => {
    const refreshButton = adminPage.getByRole('button', { name: /Refresh/ });
    await expect(refreshButton).toBeVisible({ timeout: 10000 });
  });

  test('should display health status card with service names', async ({ adminPage }) => {
    // The HealthStatusCard renders service rows for Database, Redis,
    // Job Queues, and Providers. Wait for these to appear after data loads.
    const serviceNames = ['Database', 'Redis', 'Job Queues', 'Providers'];

    for (const name of serviceNames) {
      await expect(adminPage.getByRole('main').getByText(name, { exact: true })).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('should display overall system health indicator', async ({ adminPage }) => {
    // The HealthStatusCard shows either "All Systems Operational" or "Issues Detected"
    const operational = adminPage.getByText('All Systems Operational');
    const issues = adminPage.getByText('Issues Detected');

    await expect(operational.or(issues)).toBeVisible({ timeout: 10000 });
  });

  test('should display metrics stats cards', async ({ adminPage }) => {
    // After data loads, the page shows DAU, WAU, MAU, and Memory Usage cards.
    const metricLabels = ['DAU', 'WAU', 'MAU', 'Memory Usage'];

    for (const label of metricLabels) {
      await expect(adminPage.getByText(label, { exact: true })).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('should display cache controls section', async ({ adminPage }) => {
    // The CacheControls component renders below the metrics cards.
    // Look for its presence via heading or any cache-related text.
    const cacheSection = adminPage.getByText(/cache/i).first();
    await expect(cacheSection).toBeVisible({ timeout: 10000 });
  });
});
