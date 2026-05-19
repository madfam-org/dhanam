import type { Page } from '@playwright/test';

import { test, expect } from './helpers/fixtures';

async function expectPageHeading(page: Page) {
  await expect(page.locator('h1')).toBeVisible();
}

async function navigateBySidebarLabel(page: Page, label: RegExp, urlPattern: string | RegExp) {
  await page.getByRole('link', { name: label }).click();
  await page.waitForURL(urlPattern);
  await expectPageHeading(page);
}

/**
 * Core User Journey E2E Tests
 *
 * Validates the primary navigation paths and page rendering for an
 * authenticated guest user. Each test uses the `guestPage` fixture
 * which logs in via the guest-login API and lands on /dashboard.
 *
 * Navigation selectors target the sidebar's `data-tour` attributes
 * (e.g. data-tour="sidebar-accounts") and link hrefs from dashboard-nav.
 */

test.describe('Core User Journey', () => {
  test('guest user can access dashboard', async ({ guestPage }) => {
    // guestPage fixture already navigates to /dashboard after guest login
    await expectPageHeading(guestPage);
    await expect(guestPage).toHaveURL(/dashboard/);
  });

  test('dashboard shows metric cards', async ({ guestPage }) => {
    // The dashboard renders metric cards including a net-worth tour target
    const metricCard = guestPage.locator('[data-tour="net-worth"], [class*="Card"]');
    const cardCount = await metricCard.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);
  });

  test('can navigate to accounts page', async ({ guestPage }) => {
    await navigateBySidebarLabel(guestPage, /^Accounts$/, '**/accounts');
  });

  test('can navigate to transactions page', async ({ guestPage }) => {
    await navigateBySidebarLabel(guestPage, /^Transactions$/, '**/transactions');
  });

  test('can navigate to budgets page', async ({ guestPage }) => {
    await navigateBySidebarLabel(guestPage, /^Budgets$/, '**/budgets');
  });

  test('can navigate to analytics page', async ({ guestPage }) => {
    await navigateBySidebarLabel(guestPage, /^Analytics$/, '**/analytics');
  });

  test('can navigate to settings page', async ({ guestPage }) => {
    await navigateBySidebarLabel(guestPage, /^Settings$/, '**/settings');
  });

  test('can navigate to assets page', async ({ guestPage }) => {
    // Assets is not in the sidebar nav; navigate directly
    await guestPage.goto('/assets', { waitUntil: 'domcontentloaded' });
    await expectPageHeading(guestPage);
  });

  test('can navigate to estate planning', async ({ guestPage }) => {
    await navigateBySidebarLabel(guestPage, /^Estate Planning$/, '**/estate-planning');
  });

  test('can navigate to households', async ({ guestPage }) => {
    await navigateBySidebarLabel(guestPage, /^Households$/, '**/households');
  });

  test('can navigate to reports', async ({ guestPage }) => {
    await navigateBySidebarLabel(guestPage, /^Reports$/, '**/reports');
  });

  test('can navigate to notifications', async ({ guestPage }) => {
    // Notifications is not in the sidebar nav; navigate directly
    await guestPage.goto('/notifications', { waitUntil: 'domcontentloaded' });
    await expectPageHeading(guestPage);
  });
});
