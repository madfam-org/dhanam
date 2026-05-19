import { test, expect } from './helpers/fixtures';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ adminPage }) => {
    // adminPage fixture already navigates to /dashboard after authentication
    await expect(adminPage).toHaveURL(/\/dashboard/);
  });

  test('should display the dashboard page heading', async ({ adminPage }) => {
    const heading = adminPage.getByRole('main').getByRole('heading', { name: 'Admin Dashboard' });
    await expect(heading).toBeVisible();
  });

  test('should display the page subtitle', async ({ adminPage }) => {
    await expect(adminPage.getByText('System overview and statistics')).toBeVisible();
  });

  test('should display stats cards', async ({ adminPage }) => {
    // The dashboard renders 6 StatsCard components when data is loaded.
    // During loading it renders skeletons. Wait for either real cards or
    // skeletons to appear so the test is resilient to async data fetching.
    const statsCardTitles = [
      'Total Users',
      'Active Users (30d)',
      'Total Spaces',
      'Connected Accounts',
      'Transactions',
      '2FA Enabled',
    ];

    for (const title of statsCardTitles) {
      // Use a generous timeout since data may be fetched asynchronously.
      const card = adminPage.getByText(title);
      await expect(card).toBeVisible({ timeout: 10000 });
    }
  });

  test('should display Account Providers section', async ({ adminPage }) => {
    const section = adminPage.getByRole('heading', { name: 'Account Providers' });
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  test('should display Transaction Insights section', async ({ adminPage }) => {
    const section = adminPage.getByRole('heading', { name: 'Transaction Insights' });
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  test('should have a navigation sidebar', async ({ adminPage }) => {
    const nav = adminPage.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('should navigate to System Health via sidebar', async ({ adminPage }) => {
    const link = adminPage.locator('nav').getByRole('link', { name: 'System Health' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(adminPage).toHaveURL(/\/system-health/);
  });

  test('should navigate to Queues via sidebar', async ({ adminPage }) => {
    const link = adminPage.locator('nav').getByRole('link', { name: 'Queues' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(adminPage).toHaveURL(/\/queues/);
  });

  test('should navigate to Compliance via sidebar', async ({ adminPage }) => {
    const link = adminPage.locator('nav').getByRole('link', { name: 'GDPR & Retention' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(adminPage).toHaveURL(/\/compliance/);
  });

  test('should navigate to Users via sidebar', async ({ adminPage }) => {
    const link = adminPage.locator('nav').getByRole('link', { name: 'Users' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(adminPage).toHaveURL(/\/users/);
  });

  test('should navigate to Spaces via sidebar', async ({ adminPage }) => {
    const link = adminPage.locator('nav').getByRole('link', { name: 'Spaces' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(adminPage).toHaveURL(/\/spaces/);
  });
});
