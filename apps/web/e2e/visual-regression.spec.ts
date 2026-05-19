import { test, expect } from './helpers/fixtures';

/**
 * Visual regression tests using Playwright's built-in screenshot comparison.
 *
 * Run with: npx playwright test visual-regression --update-snapshots
 * to generate/update baseline screenshots.
 */

const screenshotOptions = {
  fullPage: false,
  animations: 'disabled' as const,
  mask: [] as any[],
};

test.describe('Visual Regression - Desktop', () => {
  test.describe('Public pages', () => {
    test('login page', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot('login-desktop.png', screenshotOptions);
    });

    test('register page', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot('register-desktop.png', screenshotOptions);
    });

    test('demo page', async ({ page }) => {
      await page.goto('/demo');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot('demo-desktop.png', screenshotOptions);
    });

    test('forgot password page', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot('forgot-password-desktop.png', screenshotOptions);
    });
  });

  test.describe('Authenticated pages', () => {
    test('dashboard', async ({ guestPage }) => {
      await guestPage.waitForLoadState('networkidle');
      await expect(guestPage).toHaveScreenshot('dashboard-desktop.png', {
        ...screenshotOptions,
        // Mask dynamic content that changes between runs
        mask: [guestPage.locator('[data-testid="sync-status"]'), guestPage.locator('time')],
      });
    });

    test('accounts page', async ({ guestPage }) => {
      await guestPage.goto('/accounts');
      await guestPage.waitForLoadState('networkidle');
      await expect(guestPage).toHaveScreenshot('accounts-desktop.png', screenshotOptions);
    });

    test('transactions page', async ({ guestPage }) => {
      await guestPage.goto('/transactions');
      await guestPage.waitForLoadState('networkidle');
      await expect(guestPage).toHaveScreenshot('transactions-desktop.png', screenshotOptions);
    });

    test('budgets page', async ({ guestPage }) => {
      await guestPage.goto('/budgets');
      await guestPage.waitForLoadState('networkidle');
      await expect(guestPage).toHaveScreenshot('budgets-desktop.png', screenshotOptions);
    });

    test('analytics page', async ({ guestPage }) => {
      await guestPage.goto('/analytics');
      await guestPage.waitForLoadState('networkidle');
      await expect(guestPage).toHaveScreenshot('analytics-desktop.png', screenshotOptions);
    });

    test('settings page', async ({ guestPage }) => {
      await guestPage.goto('/settings');
      await guestPage.waitForLoadState('networkidle');
      await expect(guestPage).toHaveScreenshot('settings-desktop.png', screenshotOptions);
    });

    test('billing upgrade page', async ({ guestPage }) => {
      await guestPage.goto('/billing/upgrade');
      await guestPage.waitForLoadState('networkidle');
      await expect(guestPage).toHaveScreenshot('billing-upgrade-desktop.png', screenshotOptions);
    });

    test('assets page', async ({ guestPage }) => {
      await guestPage.goto('/assets');
      await guestPage.waitForLoadState('networkidle');
      await expect(guestPage).toHaveScreenshot('assets-desktop.png', screenshotOptions);
    });
  });
});

test.describe('Visual Regression - Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('login-mobile.png', screenshotOptions);
  });

  test('register page', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('register-mobile.png', screenshotOptions);
  });

  test('dashboard', async ({ guestPage }) => {
    await guestPage.waitForLoadState('networkidle');
    await expect(guestPage).toHaveScreenshot('dashboard-mobile.png', {
      ...screenshotOptions,
      mask: [guestPage.locator('[data-testid="sync-status"]'), guestPage.locator('time')],
    });
  });

  test('accounts page', async ({ guestPage }) => {
    await guestPage.goto('/accounts');
    await guestPage.waitForLoadState('networkidle');
    await expect(guestPage).toHaveScreenshot('accounts-mobile.png', screenshotOptions);
  });

  test('transactions page', async ({ guestPage }) => {
    await guestPage.goto('/transactions');
    await guestPage.waitForLoadState('networkidle');
    await expect(guestPage).toHaveScreenshot('transactions-mobile.png', screenshotOptions);
  });

  test('budgets page', async ({ guestPage }) => {
    await guestPage.goto('/budgets');
    await guestPage.waitForLoadState('networkidle');
    await expect(guestPage).toHaveScreenshot('budgets-mobile.png', screenshotOptions);
  });

  test('billing upgrade page', async ({ guestPage }) => {
    await guestPage.goto('/billing/upgrade');
    await guestPage.waitForLoadState('networkidle');
    await expect(guestPage).toHaveScreenshot('billing-upgrade-mobile.png', screenshotOptions);
  });
});
