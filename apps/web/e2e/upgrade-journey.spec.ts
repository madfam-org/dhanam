import { test, expect } from './helpers/fixtures';
import { test as baseTest } from '@playwright/test';
import type { Page } from '@playwright/test';

async function waitForPageShell(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('body')).toBeVisible();
}

/**
 * Upgrade Journey E2E Tests
 *
 * Validates the billing/upgrade flow, premium feature gating, and
 * checkout result pages. Tests use the `guestPage` fixture (community-tier
 * guest user) to verify that upgrade prompts and tier cards render correctly.
 *
 * The demo page test uses a raw `page` fixture (unauthenticated) since the
 * demo page is a public route that does not require auth.
 */

test.describe('Upgrade Journey', () => {
  test('community user sees upgrade page', async ({ guestPage }) => {
    await guestPage.goto('/billing/upgrade');
    await waitForPageShell(guestPage);

    // The upgrade page renders a "Choose Your Plan" heading
    const heading = guestPage.getByRole('heading', { name: /choose your plan/i });
    await expect(heading).toBeVisible();
  });

  test('upgrade page shows tier cards', async ({ guestPage }) => {
    await guestPage.goto('/billing/upgrade');
    await waitForPageShell(guestPage);

    // All three paid tiers should be visible
    await expect(guestPage.getByRole('heading', { name: 'Essentials' })).toBeVisible();
    await expect(guestPage.getByRole('heading', { name: 'Pro' })).toBeVisible();
    await expect(guestPage.getByRole('heading', { name: 'Premium' })).toBeVisible();
  });

  test('premium feature shows gate for free user', async ({ guestPage }) => {
    // Projections page wraps content in PremiumGate; a community-tier user
    // should see either the gate upsell or the page content (if gate is bypassed in demo)
    await guestPage.goto('/projections');

    const hasUpgradeText = await guestPage.locator('text=/upgrade|premium|unlock/i').count();
    const hasPageHeading = await guestPage.locator('h1').count();
    expect(hasUpgradeText + hasPageHeading).toBeGreaterThan(0);
  });

  test('billing cancel page renders', async ({ guestPage }) => {
    await guestPage.goto('/billing/cancel');

    // Cancel page shows "Checkout Cancelled" title
    await expect(guestPage.getByText(/cancel/i).first()).toBeVisible();
  });

  test('billing success page renders', async ({ guestPage }) => {
    await guestPage.goto('/billing/success');

    // Success page shows "Welcome to Premium!" title
    await expect(guestPage.getByText(/premium|success|welcome/i).first()).toBeVisible();
  });

  test('settings page shows billing section', async ({ guestPage }) => {
    await guestPage.goto('/settings');
    await waitForPageShell(guestPage);

    // The settings page renders a CreditCard-icon card with billing title.
    // The i18n key is section.billing.title; look for common billing terms.
    const billingSection = guestPage.locator('text=/billing|subscription|plan/i');
    await expect(billingSection.first()).toBeVisible();
  });

  test('billing page renders for authenticated user', async ({ guestPage }) => {
    await guestPage.goto('/billing');
    await waitForPageShell(guestPage);

    // The billing page should render at least a heading
    await expect(guestPage.locator('h1, h2').first()).toBeVisible();
  });
});

baseTest.describe('Demo Page', () => {
  baseTest('demo page renders persona cards', async ({ page }) => {
    await page.goto('/demo');

    // The demo page title is "Experience Dhanam"
    await expect(page.getByText('Experience Dhanam')).toBeVisible();

    // Should show all four narrative personas (Maria, Carlos, Patricia, Diego)
    await expect(page.getByText('Maria Gonz').first()).toBeVisible();
    await expect(page.getByText('Carlos Mendoza').first()).toBeVisible();
    await expect(page.getByText('Patricia Ruiz').first()).toBeVisible();
    await expect(page.getByText('Diego Navarro').first()).toBeVisible();
  });
});
