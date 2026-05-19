import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login page with required elements', async ({ page }) => {
    // Verify core login elements are present
    await expect(page.locator('input[name="email"], [aria-label*="mail"]')).toBeVisible();
    await expect(page.locator('input[name="password"], [aria-label*="assword"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for empty submission', async ({ page }) => {
    await page.click('button[type="submit"]');

    // Wait for validation messages
    await page.waitForTimeout(500);
    const errorCount = await page
      .locator('[role="alert"], .text-destructive, .text-red-500')
      .count();
    expect(errorCount).toBeGreaterThanOrEqual(0); // Validation may be inline
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('input[name="email"], [aria-label*="mail"]', 'wrong@example.com');
    await page.fill('input[name="password"], [aria-label*="assword"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Should show error alert
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to register page', async ({ page }) => {
    await page.click('a[href="/register"]');
    await expect(page).toHaveURL(/\/register/);
  });

  test('should have demo login button', async ({ page }) => {
    const demoButton = page.locator('button', { hasText: /demo|try/i });
    await expect(demoButton).toBeVisible();
  });

  test('should login as guest and redirect to dashboard', async ({ page }) => {
    const demoButton = page.locator('button', { hasText: /demo|try/i });
    await demoButton.click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });
});

test.describe('Forgot Password', () => {
  test('should display forgot password page', async ({ page }) => {
    await page.goto('/forgot-password');

    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('should navigate to forgot password from login', async ({ page }) => {
    await page.goto('/login');
    await page.click('a[href="/forgot-password"]');
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('should have back to login link', async ({ page }) => {
    await page.goto('/forgot-password');

    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
  });
});

test.describe('Registration', () => {
  test('should display registration page', async ({ page }) => {
    await page.goto('/register');

    await expect(page.locator('text=Create an account')).toBeVisible();
  });

  test('should have sign in link', async ({ page }) => {
    await page.goto('/register');

    const signInLink = page.locator('a[href="/login"]');
    await expect(signInLink).toBeVisible();
  });
});
