import { test, expect } from './helpers/fixtures';

test.describe('MADFAM POS', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/pos');
    await expect(adminPage).toHaveURL(/\/pos/);
  });

  test('should display POS heading and tab navigation', async ({ adminPage }) => {
    await expect(adminPage.getByRole('heading', { name: 'MADFAM POS' })).toBeVisible();
    await expect(adminPage.getByRole('tab', { name: 'Subscription' })).toBeVisible();
    await expect(adminPage.getByRole('tab', { name: 'Route Preview' })).toBeVisible();
    await expect(adminPage.getByRole('tab', { name: 'Charge / Refund' })).toBeVisible();
    await expect(adminPage.getByRole('tab', { name: 'Timeline / Reconcile' })).toBeVisible();
  });

  test('should render subscription checkout panel by default', async ({ adminPage }) => {
    await expect(adminPage.getByText('Checkout Request')).toBeVisible();
    await expect(adminPage.getByText('Checkout Link')).toBeVisible();
    await expect(adminPage.getByText('Checkout Status')).toBeVisible();
  });

  test('should show route preview form', async ({ adminPage }) => {
    await adminPage.getByRole('tab', { name: 'Route Preview' }).click();
    await expect(adminPage.getByText('Routing Matrix Preview')).toBeVisible();
    await expect(adminPage.getByRole('button', { name: 'Preview route' })).toBeVisible();
  });

  test('should show charge and refund forms', async ({ adminPage }) => {
    await adminPage.getByRole('tab', { name: 'Charge / Refund' }).click();
    await expect(adminPage.getByText('Direct Charge')).toBeVisible();
    await expect(adminPage.getByText('Refund')).toBeVisible();
    await expect(adminPage.getByRole('button', { name: 'Create charge' })).toBeVisible();
    await expect(adminPage.getByRole('button', { name: 'Issue refund' })).toBeVisible();
  });

  test('should show timeline and reconciliation panels', async ({ adminPage }) => {
    await adminPage.getByRole('tab', { name: 'Timeline / Reconcile' }).click();
    await expect(adminPage.getByText('POS Timeline')).toBeVisible();
    await expect(adminPage.getByText('Reconciliation')).toBeVisible();
    await expect(adminPage.getByRole('button', { name: 'Load timeline' })).toBeVisible();
  });
});
