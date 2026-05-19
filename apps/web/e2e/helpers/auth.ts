import { Page } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:4010/v1';

type E2ETokens = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

type E2EUser = {
  id: string;
  email: string;
  name?: string;
  locale?: string;
  timezone?: string;
  [key: string]: unknown;
};

type E2ESpace = {
  id: string;
  name: string;
  [key: string]: unknown;
};

type E2ESession = {
  tokens: E2ETokens;
  user: E2EUser;
  spaces: E2ESpace[];
};

let cachedGuestSession: E2ESession | null = null;

async function installWebSession(
  page: Page,
  tokens: E2ETokens,
  user: E2EUser,
  spaces: E2ESpace[] = []
): Promise<void> {
  await page.evaluate(
    ({ tokens, user, spaces }) => {
      localStorage.setItem('janua_access_token', tokens.accessToken);
      if (tokens.refreshToken) {
        localStorage.setItem('janua_refresh_token', tokens.refreshToken);
      }
      localStorage.setItem('dhanam_user_profile', JSON.stringify(user));

      // Legacy keys are kept for older tests that assert helper state directly.
      localStorage.setItem('auth_tokens', JSON.stringify(tokens));
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({ state: { accessToken: tokens.accessToken }, version: 0 })
      );
      localStorage.setItem(
        'space-storage',
        JSON.stringify({
          state: {
            spaces,
            currentSpace: spaces[0] ?? null,
          },
          version: 0,
        })
      );
      localStorage.setItem('dhanam-demo-tour-seen', '1');

      document.cookie = 'auth-storage=true; path=/; max-age=604800; SameSite=Lax';
      document.cookie = 'dhanam_consent=accepted; path=/; max-age=31536000; SameSite=Lax';
      if (user.email?.endsWith('@dhanam.demo')) {
        document.cookie = 'demo-mode=true; path=/; max-age=7200; SameSite=Lax';
      }
    },
    { tokens, user, spaces }
  );
}

async function fetchUserProfile(page: Page, accessToken: string): Promise<E2EUser> {
  const response = await page.request.get(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok()) {
    throw new Error(`User profile fetch failed: ${response.status()}`);
  }

  const data = await response.json();
  return data.data || data;
}

async function fetchSpaces(page: Page, accessToken: string): Promise<E2ESpace[]> {
  const response = await page.request.get(`${API_BASE}/spaces`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok()) {
    return [];
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * Login as demo guest user via API and set auth cookies/storage
 */
export async function loginAsGuest(page: Page): Promise<void> {
  if (cachedGuestSession) {
    await installWebSession(
      page,
      cachedGuestSession.tokens,
      cachedGuestSession.user,
      cachedGuestSession.spaces
    );
    return;
  }

  const response = await page.request.post(`${API_BASE}/auth/guest`, {
    data: {},
  });

  if (!response.ok()) {
    throw new Error(`Guest login failed: ${response.status()}`);
  }

  const data = await response.json();
  const user = await fetchUserProfile(page, data.tokens.accessToken).catch(() => data.user);
  const spaces = await fetchSpaces(page, data.tokens.accessToken);
  cachedGuestSession = { tokens: data.tokens, user, spaces };
  await installWebSession(page, data.tokens, user, spaces);
}

/**
 * Login with email/password via the API
 */
export async function loginWithCredentials(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  const response = await page.request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()}`);
  }

  const data = await response.json();
  const user = data.user || (await fetchUserProfile(page, data.tokens.accessToken));
  const spaces = await fetchSpaces(page, data.tokens.accessToken);
  await installWebSession(page, data.tokens, user, spaces);
}

/**
 * Login via the UI (filling form fields)
 */
export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="email"], [aria-label="Email"]', email);
  await page.fill('input[name="password"], [aria-label="Password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

/**
 * Clear authentication state
 */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('janua_access_token');
    localStorage.removeItem('janua_refresh_token');
    localStorage.removeItem('dhanam_user_profile');
    localStorage.removeItem('auth_tokens');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth-storage');
    localStorage.removeItem('space-storage');
    document.cookie = 'auth-storage=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'demo-mode=; path=/; max-age=0; SameSite=Lax';
  });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const tokens = localStorage.getItem('auth_tokens');
    return tokens !== null;
  });
}

/**
 * Register a new user with a plan via the API, then start a trial
 */
export async function registerWithPlan(
  page: Page,
  userData: { email: string; password: string; name: string },
  plan: string
): Promise<void> {
  const registerResponse = await page.request.post(`${API_BASE}/auth/register`, {
    data: {
      email: userData.email,
      password: userData.password,
      name: userData.name,
    },
  });

  if (!registerResponse.ok()) {
    throw new Error(`Registration failed: ${registerResponse.status()}`);
  }

  const registerData = await registerResponse.json();
  const user = registerData.user || (await fetchUserProfile(page, registerData.tokens.accessToken));
  const spaces = await fetchSpaces(page, registerData.tokens.accessToken);
  await installWebSession(page, registerData.tokens, user, spaces);

  // Start trial for the selected plan
  const trialResponse = await page.request.post(`${API_BASE}/billing/trial/start`, {
    data: { plan },
    headers: {
      Authorization: `Bearer ${registerData.tokens.accessToken}`,
    },
  });

  if (!trialResponse.ok()) {
    console.warn(`Trial start failed: ${trialResponse.status()}, continuing without trial`);
  }
}

/**
 * Set the geo country cookie for regional pricing tests
 */
export async function setGeoCountry(page: Page, countryCode: string): Promise<void> {
  const url = page.url() || 'http://localhost:3040';
  const domain = new URL(url).hostname;
  await page.context().addCookies([
    {
      name: 'dhanam_geo',
      value: countryCode,
      domain,
      path: '/',
    },
  ]);
}
