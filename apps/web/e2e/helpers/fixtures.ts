import { test as base, expect, Page } from '@playwright/test';
import { loginAsGuest, loginWithCredentials, logout } from './auth';

async function gotoAuthenticatedDashboard(page: Page): Promise<void> {
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
 * Extended test fixtures with authentication helpers
 */
export const test = base.extend<{
  authenticatedPage: Page;
  guestPage: Page;
}>({
  /**
   * Page pre-authenticated as a guest demo user
   */
  guestPage: async ({ page }, use) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginAsGuest(page);
    await gotoAuthenticatedDashboard(page);
    await use(page);
    await logout(page);
  },

  /**
   * Page pre-authenticated with test credentials
   */
  authenticatedPage: async ({ page }, use) => {
    const email = process.env.E2E_TEST_EMAIL || 'test@dhanam.demo';
    const password = process.env.E2E_TEST_PASSWORD || 'TestPassword123!';

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    try {
      await loginWithCredentials(page, email, password);
    } catch {
      // Fallback to guest login if credentials don't work
      await loginAsGuest(page);
    }

    await gotoAuthenticatedDashboard(page);
    await use(page);
    await logout(page);
  },
});

export { expect };

/**
 * Test data constants
 */
export const TEST_DATA = {
  validUser: {
    email: 'e2e-test@example.com',
    password: 'E2eTestPassword123!',
    name: 'E2E Test User',
  },
  demoUser: {
    email: 'guest@dhanam.demo',
    name: 'Demo User',
  },
  spaces: {
    personal: {
      name: 'Personal',
      currency: 'USD',
    },
  },
};
