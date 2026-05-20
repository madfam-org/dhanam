import { Page } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:4010/v1';
const ADMIN_BASE = process.env.E2E_BASE_URL || 'http://localhost:3400';

type AdminE2EUser = {
  id: string;
  email: string;
  name: string;
  spaces: Array<{ id: string; role: string }>;
};

function seedAdminStorage({ storageState }: { storageState: unknown }) {
  localStorage.setItem('auth-storage', JSON.stringify(storageState));
  document.cookie = 'auth-storage=true; path=/; max-age=604800; SameSite=Lax';
}

async function installAdminSession(page: Page, token: string, user: AdminE2EUser): Promise<void> {
  const storageState = {
    state: {
      user,
      token,
      isAuthenticated: true,
      isAdmin: true,
    },
    version: 0,
  };

  await page.context().addCookies([
    {
      name: 'auth-storage',
      value: 'true',
      url: ADMIN_BASE,
      sameSite: 'Lax',
    },
  ]);

  await page.context().addInitScript(seedAdminStorage, { storageState });
  await page.addInitScript(seedAdminStorage, { storageState });

  // Materialize localStorage on the admin origin before protected routes mount.
  // On about:blank the init script is not enough for the first dashboard load.
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(seedAdminStorage, { storageState });
}

function syntheticAdminUser(email = 'admin@dhanam.demo'): AdminE2EUser {
  return {
    id: 'e2e-admin-user',
    email,
    name: 'E2E Admin',
    spaces: [{ id: 'e2e-admin-space', role: 'owner' }],
  };
}

async function installSyntheticAdminSession(page: Page, email: string): Promise<void> {
  await installAdminSession(page, 'e2e-synthetic-access-token', syntheticAdminUser(email));
}

async function installApiBackedAdminSession(
  page: Page,
  email: string,
  token: string
): Promise<void> {
  await installAdminSession(page, token, syntheticAdminUser(email));
}

/**
 * Authenticate as an admin user via the API and inject tokens into localStorage.
 * Falls back to a synthetic admin session for CI smoke tests where the API
 * fixture does not seed a real admin account.
 */
export async function adminLogin(page: Page): Promise<void> {
  const email = process.env.E2E_ADMIN_EMAIL || 'admin@dhanam.demo';
  const password = process.env.E2E_ADMIN_PASSWORD || 'AdminPassword123!';
  const useApiAuth = process.env.E2E_ADMIN_USE_API_AUTH === 'true';

  if (process.env.CI && !useApiAuth) {
    await installSyntheticAdminSession(page, email);
    return;
  }

  try {
    const response = await page.request.post(`${API_BASE}/auth/login`, {
      data: { email, password },
    });

    if (response.ok()) {
      const data = await response.json();
      await installApiBackedAdminSession(page, email, data.tokens.accessToken);
      return;
    }
  } catch {
    // Fall through to synthetic session below.
  }

  await installSyntheticAdminSession(page, email);
}

/**
 * Clear admin auth state.
 */
export async function adminLogout(page: Page): Promise<void> {
  await page.context().clearCookies({ name: 'auth-storage' });
  await page.evaluate(() => {
    localStorage.removeItem('auth-storage');
    document.cookie = 'auth-storage=; path=/; max-age=0; SameSite=Lax';
  });
}
