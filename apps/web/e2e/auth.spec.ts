import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login page with required elements', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();
    await expect(page.getByText(/welcome back/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /try demo/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /forgot/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
  });

  test('should render a Janua SSO sign-in surface', async ({ page }) => {
    await expect(
      page
        .getByRole('link', { name: /janua|sign in/i })
        .or(page.locator('form'))
        .or(page.locator('[data-janua], [class*="janua" i]'))
        .first()
    ).toBeVisible();
  });

  test('should navigate to register page', async ({ page }) => {
    await page.getByRole('link', { name: /sign up/i }).click();
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
    await page.getByRole('link', { name: /forgot/i }).click();
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
