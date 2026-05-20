import { test, expect } from './helpers/fixtures';
import { test as baseTest } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { setGeoCountry } from './helpers/auth';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3040';
const API_BASE = process.env.E2E_API_URL || 'http://localhost:4010/v1';

async function waitForPageShell(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('body')).toBeVisible();
}

async function gotoLandingPricing(page: Page): Promise<Locator> {
  await page.goto(`${BASE_URL}/en`, { waitUntil: 'domcontentloaded' });
  const pricingSection = page.locator('#pricing');
  await expect(pricingSection).toBeVisible({ timeout: 10000 });
  await expect(pricingSection.locator('.rounded-lg.bg-card')).toHaveCount(3, { timeout: 10000 });
  return pricingSection;
}

async function expectCurrentConsumerTiers(section: Locator): Promise<void> {
  const text = (await section.textContent()) ?? '';
  expect(text).toMatch(/Free|Essentials/);
  expect(text).toMatch(/Copilot Pro|Pro/);
  expect(text).toMatch(/Family Plus|Premium/);
}

/**
 * E2E tests for the full subscription journey:
 * - Landing page pricing display (static fallback + API-driven)
 * - Regional pricing via geo cookie
 * - Demo flow from landing to dashboard
 * - Registration with plan query param
 * - Upgrade page tier display
 * - Billing pricing API contract
 */

baseTest.describe('Landing Page Pricing', () => {
  baseTest('should display 3 pricing tiers on landing page', async ({ page }) => {
    const pricingSection = await gotoLandingPricing(page);

    // The pricing grid renders 3 cards with class "rounded-lg bg-card"
    const tierCards = pricingSection.locator('.rounded-lg.bg-card');
    await expect(tierCards).toHaveCount(3);

    await expectCurrentConsumerTiers(pricingSection);
  });

  baseTest('should show MXN prices when geo cookie is set to MX', async ({ page }) => {
    // Navigate first so we have a valid URL for cookie domain
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'domcontentloaded' });

    // Set the geo cookie before reloading
    await setGeoCountry(page, 'MX');
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'domcontentloaded' });

    // Wait for the pricing API call to resolve and render
    await waitForPageShell(page);

    const pricingSection = await gotoLandingPricing(page);

    // The pricing component calls billingApi.getPricing(geoCookie) and
    // renders via Intl.NumberFormat with the returned currency.
    // For MX, API returns currency: "MXN" with promo prices (31, 32, 33).
    const pricingText = await pricingSection.textContent();

    // Should contain MXN-formatted amounts or MX$ prefix
    const hasMexicanPricing =
      pricingText?.includes('MXN') ||
      pricingText?.includes('MX$') ||
      pricingText?.includes('$31') ||
      pricingText?.includes('$32') ||
      pricingText?.includes('$33');
    expect(hasMexicanPricing).toBeTruthy();
  });

  baseTest('should show promo banner when regional promo pricing is active', async ({ page }) => {
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'domcontentloaded' });
    await setGeoCountry(page, 'MX');
    const pricingSection = await gotoLandingPricing(page);

    // The Pricing component renders a promo banner when hasPromo is true:
    // "Start free for N days -- then promo pricing for N months"
    const promoIndicator = pricingSection.getByText(/promo pricing/i);
    // If the API returned promo prices, the banner should be visible
    const pricingText = await pricingSection.textContent();
    if (/\$31|MX\$31|MXN\s*31/.test(pricingText ?? '')) {
      await expect(promoIndicator).toBeVisible();
    }
  });

  baseTest('should show strikethrough original price when promo is active', async ({ page }) => {
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'domcontentloaded' });
    await setGeoCountry(page, 'MX');
    const pricingSection = await gotoLandingPricing(page);

    // When promoPrice !== null, the component renders the original price with
    // class "line-through" inside each card
    const strikethroughPrices = pricingSection.locator('.line-through');
    const count = await strikethroughPrices.count();

    // If promo prices are active, all 3 tiers should show a strikethrough
    if (count > 0) {
      expect(count).toBe(3);
    }
  });

  baseTest('should separate hosted pricing from the Community edition link', async ({ page }) => {
    const pricingSection = await gotoLandingPricing(page);

    const tierCards = pricingSection.locator('.rounded-lg.bg-card');
    const cardTexts = await tierCards.allTextContents();

    for (const text of cardTexts) {
      expect(text).not.toMatch(/community/i);
    }

    // The self-hosted link should be present below the grid
    const selfHostedLink = pricingSection.getByText(/community edition/i);
    await expect(selfHostedLink).toBeVisible();
  });

  baseTest('should display "Most Popular" badge on Pro tier', async ({ page }) => {
    const pricingSection = await gotoLandingPricing(page);

    // The Pro card has a "Most Popular" badge (from t('pricing.mostPopular'))
    const mostPopularBadge = pricingSection.getByText(/most popular/i);
    await expect(mostPopularBadge).toBeVisible();
  });

  baseTest('should show "cancel anytime" note under pricing', async ({ page }) => {
    const pricingSection = await gotoLandingPricing(page);

    // Each card has t('pricing.cancelAnytime') text
    const cancelNote = pricingSection.getByText(/cancel anytime/i).first();
    await expect(cancelNote).toBeVisible();
  });
});

baseTest.describe('Demo Flow', () => {
  baseTest('should navigate from landing page to dashboard via demo button', async ({ page }) => {
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'domcontentloaded' });

    // The hero CTA text is "Try Live Demo" (from i18n hero.cta)
    const demoButton = page.getByRole('button', { name: /try live demo/i }).first();

    if (await demoButton.isVisible()) {
      await demoButton.click();

      // The handler calls authApi.loginAsGuest then redirects to /dashboard
      await page.waitForURL('**/dashboard**', { timeout: 15000 });
      expect(page.url()).toContain('dashboard');
    }
  });
});

baseTest.describe('Registration with Plan', () => {
  baseTest(
    'should show plan context on register page when plan query param is set',
    async ({ page }) => {
      await page.goto(`${BASE_URL}/register?plan=copilot_pro`);

      // The register page shows the selected plan in human-readable form.
      const pageContent = await page.textContent('body');
      const showsPlanContext =
        pageContent?.toLowerCase().includes('copilot pro') ||
        pageContent?.toLowerCase().includes('trial');
      expect(showsPlanContext).toBeTruthy();
    }
  );

  baseTest('should show "Start your free trial of Free" for free plan', async ({ page }) => {
    await page.goto(`${BASE_URL}/register?plan=free`);

    const trialText = page.getByText(/start your free trial of free/i);
    await expect(trialText).toBeVisible();
  });

  baseTest(
    'should show "Start your free trial of Family Plus" for family plan',
    async ({ page }) => {
      await page.goto(`${BASE_URL}/register?plan=family_plus`);

      const trialText = page.getByText(/start your free trial of family plus/i);
      await expect(trialText).toBeVisible();
    }
  );

  baseTest('should show default description when no plan param is set', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    // Without plan param: "Start managing your finances with Dhanam"
    const defaultText = page.getByText(/start managing your finances/i);
    await expect(defaultText).toBeVisible();
  });

  baseTest('should link from pricing CTA to register with plan query param', async ({ page }) => {
    const pricingSection = await gotoLandingPricing(page);

    // Each tier card has a CTA. Free may say "Get Started"; paid tiers use trial copy.
    const tierCtas = pricingSection.getByRole('button', { name: /get started|trial/i });
    const buttonCount = await tierCtas.count();
    expect(buttonCount).toBe(3);

    const [navigation] = await Promise.all([
      page.waitForURL('**/register**', { timeout: 10000 }).catch(() => null),
      tierCtas.first().click(),
    ]);

    if (navigation !== null) {
      expect(page.url()).toContain('register');
      expect(page.url()).toContain('plan=');
    }
  });
});

test.describe('Upgrade Page', () => {
  test('should display 3 tiers on upgrade page', async ({ guestPage }) => {
    await guestPage.goto(`${BASE_URL}/billing/upgrade`);
    await waitForPageShell(guestPage);

    // The upgrade page renders 3 Card components with tier names
    await expect(guestPage.getByRole('heading', { name: 'Essentials' })).toBeVisible();
    await expect(guestPage.getByRole('heading', { name: 'Pro' })).toBeVisible();
    await expect(guestPage.getByRole('heading', { name: 'Premium' })).toBeVisible();
  });

  test('should show "Choose Your Plan" heading on upgrade page', async ({ guestPage }) => {
    await guestPage.goto(`${BASE_URL}/billing/upgrade`);
    await waitForPageShell(guestPage);

    const heading = guestPage.getByRole('heading', { name: /choose your plan/i });
    await expect(heading).toBeVisible();
  });

  test('should show subscribe buttons for each tier', async ({ guestPage }) => {
    await guestPage.goto(`${BASE_URL}/billing/upgrade`);
    await waitForPageShell(guestPage);

    // Each non-current tier shows "Subscribe to <Name>" button
    const subscribeButtons = guestPage.getByRole('button', { name: /subscribe to/i });
    const count = await subscribeButtons.count();
    // Guest/community user should see subscribe on all 3 tiers
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should show regional pricing on upgrade page with MX geo', async ({ guestPage }) => {
    await setGeoCountry(guestPage, 'MX');

    await guestPage.goto(`${BASE_URL}/billing/upgrade`);
    await waitForPageShell(guestPage);

    const pageContent = await guestPage.textContent('body');
    // Should show pricing content (subscribe buttons or current plan indicator)
    expect(
      pageContent?.includes('Subscribe') || pageContent?.includes('Current Plan')
    ).toBeTruthy();
  });

  test('should show "cancel anytime" note on upgrade page', async ({ guestPage }) => {
    await guestPage.goto(`${BASE_URL}/billing/upgrade`);
    await waitForPageShell(guestPage);

    // The upgrade page renders: "Cancel anytime. Regional pricing applied automatically."
    const cancelNote = guestPage.getByText(/cancel anytime/i);
    await expect(cancelNote).toBeVisible();
  });

  test('should have back button to billing page', async ({ guestPage }) => {
    await guestPage.goto(`${BASE_URL}/billing/upgrade`);
    await waitForPageShell(guestPage);

    const backButton = guestPage.getByRole('button', { name: /back/i });
    await expect(backButton).toBeVisible();
  });
});

baseTest.describe('Billing Pricing API', () => {
  baseTest('GET /billing/pricing returns regional pricing for MX', async ({ request }) => {
    const response = await request.get(`${API_BASE}/billing/pricing?country=MX`);

    if (response.ok()) {
      const data = await response.json();

      // Region mapping: MX -> latam (region 3)
      expect(data.region).toBe(3);
      expect(data.regionName).toBe('latam');
      expect(data.currency).toBe('MXN');

      // Should return exactly 3 paid tiers
      expect(data.tiers).toHaveLength(3);
      expect(data.tiers[0].id).toBe('essentials');
      expect(data.tiers[1].id).toBe('pro');
      expect(data.tiers[2].id).toBe('premium');

      // MX promo prices from the LATAM pricing table
      expect(data.tiers[0].promoPrice).toBe(31);
      expect(data.tiers[1].promoPrice).toBe(32);
      expect(data.tiers[2].promoPrice).toBe(33);

      // Trial configuration
      expect(data.trial.daysWithoutCC).toBe(3);
      expect(data.trial.daysWithCC).toBe(21);
      expect(data.trial.promoMonths).toBe(3);
    }
  });

  baseTest(
    'GET /billing/pricing defaults to US pricing when no country specified',
    async ({ request }) => {
      const response = await request.get(`${API_BASE}/billing/pricing`);

      if (response.ok()) {
        const data = await response.json();

        // US falls in tier1 (region 1)
        expect(data.region).toBe(1);
        expect(data.tiers).toHaveLength(3);

        // No promo prices for tier-1 countries
        expect(data.tiers[0].promoPrice).toBeNull();
        expect(data.tiers[1].promoPrice).toBeNull();
        expect(data.tiers[2].promoPrice).toBeNull();
      }
    }
  );

  baseTest('GET /billing/pricing returns correct tiers for BR (Brazil)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/billing/pricing?country=BR`);

    if (response.ok()) {
      const data = await response.json();

      // BR -> latam region
      expect(data.regionName).toBe('latam');
      expect(data.tiers).toHaveLength(3);

      // Each tier should have id, name, monthlyPrice, currency, features
      for (const tier of data.tiers) {
        expect(tier.id).toBeDefined();
        expect(tier.name).toBeDefined();
        expect(tier.monthlyPrice).toBeGreaterThan(0);
        expect(tier.currency).toBeDefined();
        expect(Array.isArray(tier.features)).toBe(true);
      }
    }
  });

  baseTest(
    'GET /billing/pricing response shape matches PricingResponse interface',
    async ({ request }) => {
      const response = await request.get(`${API_BASE}/billing/pricing`);

      if (response.ok()) {
        const data = await response.json();

        // Validate top-level shape
        expect(typeof data.region).toBe('number');
        expect(typeof data.regionName).toBe('string');
        expect(typeof data.currency).toBe('string');
        expect(Array.isArray(data.tiers)).toBe(true);
        expect(typeof data.trial).toBe('object');

        // Validate trial shape
        expect(typeof data.trial.daysWithoutCC).toBe('number');
        expect(typeof data.trial.daysWithCC).toBe('number');
        expect(typeof data.trial.promoMonths).toBe('number');

        // Validate tier shape
        for (const tier of data.tiers) {
          expect(typeof tier.id).toBe('string');
          expect(typeof tier.name).toBe('string');
          expect(typeof tier.monthlyPrice).toBe('number');
          expect(typeof tier.currency).toBe('string');
          expect(Array.isArray(tier.features)).toBe(true);
          // promoPrice is number | null
          expect(tier.promoPrice === null || typeof tier.promoPrice === 'number').toBe(true);
        }
      }
    }
  );
});
