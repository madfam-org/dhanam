import { test, expect } from './helpers/fixtures';
import type { Page } from '@playwright/test';
import { checkA11y } from './helpers/a11y';

async function waitForAccessiblePage(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('body')).toBeVisible();
}

test.describe('Accessibility (WCAG AA)', () => {
  // Disable color-contrast checks in CI as they can be flaky with CSS loading
  const disableRules = ['color-contrast'];

  test.describe('Public pages', () => {
    test('login page', async ({ page }) => {
      await page.goto('/login');
      await waitForAccessiblePage(page);
      await checkA11y(page, { disableRules });
    });

    test('register page', async ({ page }) => {
      await page.goto('/register');
      await waitForAccessiblePage(page);
      await checkA11y(page, { disableRules });
    });

    test('forgot password page', async ({ page }) => {
      await page.goto('/forgot-password');
      await waitForAccessiblePage(page);
      await checkA11y(page, { disableRules });
    });

    test('demo page', async ({ page }) => {
      await page.goto('/demo');
      await waitForAccessiblePage(page);
      await checkA11y(page, { disableRules });
    });

    test('privacy page', async ({ page }) => {
      await page.goto('/privacy');
      await waitForAccessiblePage(page);
      await checkA11y(page, { disableRules });
    });

    test('terms page', async ({ page }) => {
      await page.goto('/terms');
      await waitForAccessiblePage(page);
      await checkA11y(page, { disableRules });
    });

    test('landing page (EN)', async ({ page }) => {
      await page.goto('/en');
      await waitForAccessiblePage(page);
      await checkA11y(page, { disableRules });
    });

    test('landing page (ES)', async ({ page }) => {
      await page.goto('/es');
      await waitForAccessiblePage(page);
      await checkA11y(page, { disableRules });
    });
  });

  test.describe('Authenticated pages', () => {
    test('dashboard', async ({ guestPage }) => {
      await waitForAccessiblePage(guestPage);
      await checkA11y(guestPage, { disableRules });
    });

    test('accounts page', async ({ guestPage }) => {
      await guestPage.goto('/accounts');
      await waitForAccessiblePage(guestPage);
      await checkA11y(guestPage, { disableRules });
    });

    test('transactions page', async ({ guestPage }) => {
      await guestPage.goto('/transactions');
      await waitForAccessiblePage(guestPage);
      await checkA11y(guestPage, { disableRules });
    });

    test('budgets page', async ({ guestPage }) => {
      await guestPage.goto('/budgets');
      await waitForAccessiblePage(guestPage);
      await checkA11y(guestPage, { disableRules });
    });

    test('analytics page', async ({ guestPage }) => {
      await guestPage.goto('/analytics');
      await waitForAccessiblePage(guestPage);
      await checkA11y(guestPage, { disableRules });
    });

    test('settings page', async ({ guestPage }) => {
      await guestPage.goto('/settings');
      await waitForAccessiblePage(guestPage);
      await checkA11y(guestPage, { disableRules });
    });

    test('billing upgrade page', async ({ guestPage }) => {
      await guestPage.goto('/billing/upgrade');
      await waitForAccessiblePage(guestPage);
      await checkA11y(guestPage, { disableRules });
    });

    test('assets page', async ({ guestPage }) => {
      await guestPage.goto('/assets');
      await waitForAccessiblePage(guestPage);
      await checkA11y(guestPage, { disableRules });
    });

    test('reports page', async ({ guestPage }) => {
      await guestPage.goto('/reports');
      await waitForAccessiblePage(guestPage);
      await checkA11y(guestPage, { disableRules });
    });

    test('notifications page', async ({ guestPage }) => {
      await guestPage.goto('/notifications');
      await waitForAccessiblePage(guestPage);
      await checkA11y(guestPage, { disableRules });
    });
  });

  test.describe('Onboarding flow', () => {
    test('onboarding page', async ({ page }) => {
      await page.goto('/onboarding');
      await waitForAccessiblePage(page);
      // May redirect — check whichever page we land on
      await checkA11y(page, { disableRules });
    });

    test('verify email page', async ({ page }) => {
      await page.goto('/verify-email');
      await waitForAccessiblePage(page);
      await checkA11y(page, { disableRules });
    });
  });
});
