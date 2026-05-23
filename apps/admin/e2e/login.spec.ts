import { test, expect } from '@playwright/test';

import { checkA11y } from './helpers/a11y';

const appBase = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3040';

test.describe('Admin login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('main#main', { timeout: 15000 });
  });

  test('renders operator shell and sign-in controls', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dhanam Admin', level: 1 })).toBeVisible();
    await expect(page.getByText('Operator console')).toBeVisible();
    await expect(page.locator('main#main')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('uses consumer-app legal and recovery URLs', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      `${appBase}/forgot-password`
    );
    await expect(page.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
      'href',
      `${appBase}/terms`
    );
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      `${appBase}/privacy`
    );
  });

  test('GitHub OAuth button is visually readable', async ({ page }) => {
    const github = page.getByRole('button', { name: 'Continue with GitHub' });
    const color = await github.evaluate((el) => getComputedStyle(el).color);
    const backgroundColor = await github.evaluate((el) => getComputedStyle(el).backgroundColor);

    expect(color).not.toBe('rgb(255, 255, 255)');
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('meets WCAG AA on login page', async ({ page }) => {
    await checkA11y(page, { include: 'main#main' });
  });
});
