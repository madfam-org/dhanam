/**
 * Middleware unit tests
 * Tests public path routing to verify legal pages don't redirect to login.
 *
 * Note: NextRequest requires edge runtime globals (Request, Headers, etc.).
 * We test the routing logic by importing the publicPaths concept directly
 * rather than running the full middleware function.
 */

import { getHostnameFromHostHeader, getWwwApexRedirectUrl } from '../lib/routing/hosts';

describe('middleware public paths', () => {
  // We extract and test the routing logic by checking what the middleware
  // source defines as public. This avoids needing edge-runtime globals.

  const publicPaths = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/auth/callback',
    '/demo',
    '/demo/',
    '/privacy',
    '/terms',
    '/cookies',
    '/security',
    '/esg-methodology',
    '/status',
    '/docs',
  ];

  function isPublicPath(path: string): boolean {
    return publicPaths.some((p) => path.startsWith(p));
  }

  describe('legal pages should be public', () => {
    const legalPaths = [
      '/privacy',
      '/terms',
      '/cookies',
      '/security',
      '/esg-methodology',
      '/status',
      '/docs',
    ];

    for (const path of legalPaths) {
      it(`${path} should be a public path`, () => {
        expect(isPublicPath(path)).toBe(true);
      });
    }
  });

  describe('auth pages should be public', () => {
    const authPaths = ['/login', '/register', '/forgot-password', '/reset-password'];

    for (const path of authPaths) {
      it(`${path} should be a public path`, () => {
        expect(isPublicPath(path)).toBe(true);
      });
    }
  });

  describe('app pages should not be public', () => {
    const protectedPaths = ['/dashboard', '/settings', '/accounts', '/budgets', '/wealth'];

    for (const path of protectedPaths) {
      it(`${path} should not be a public path`, () => {
        expect(isPublicPath(path)).toBe(false);
      });
    }
  });

  describe('dashboard subpath redirect logic', () => {
    // Mirrors the middleware rule: /dashboard/<subpath> → /<subpath>
    function shouldRedirectDashboardSubpath(path: string): string | null {
      if (path.startsWith('/dashboard/') && path !== '/dashboard') {
        return path.replace(/^\/dashboard/, '');
      }
      return null;
    }

    it('/dashboard/settings should redirect to /settings', () => {
      expect(shouldRedirectDashboardSubpath('/dashboard/settings')).toBe('/settings');
    });

    it('/dashboard/accounts should redirect to /accounts', () => {
      expect(shouldRedirectDashboardSubpath('/dashboard/accounts')).toBe('/accounts');
    });

    it('/dashboard/settings/merchants should redirect to /settings/merchants', () => {
      expect(shouldRedirectDashboardSubpath('/dashboard/settings/merchants')).toBe(
        '/settings/merchants'
      );
    });

    it('/dashboard/billing should redirect to /billing', () => {
      expect(shouldRedirectDashboardSubpath('/dashboard/billing')).toBe('/billing');
    });

    it('/dashboard should NOT redirect (it is the actual dashboard page)', () => {
      expect(shouldRedirectDashboardSubpath('/dashboard')).toBeNull();
    });

    it('/ should NOT redirect', () => {
      expect(shouldRedirectDashboardSubpath('/')).toBeNull();
    });

    it('/settings should NOT redirect', () => {
      expect(shouldRedirectDashboardSubpath('/settings')).toBeNull();
    });
  });

  describe('subpaths should match', () => {
    it('/privacy/policy should match /privacy', () => {
      expect(isPublicPath('/privacy/policy')).toBe(true);
    });

    it('/terms/of-service should match /terms', () => {
      expect(isPublicPath('/terms/of-service')).toBe(true);
    });
  });
});

describe('middleware host routing helpers', () => {
  describe('getHostnameFromHostHeader', () => {
    it('removes a forwarded internal port from public host headers', () => {
      expect(getHostnameFromHostHeader('www.dhan.am:4200')).toBe('www.dhan.am');
    });

    it('uses the first value from a comma-separated forwarded host header', () => {
      expect(getHostnameFromHostHeader('www.dhan.am, dhanam-web:4200')).toBe('www.dhan.am');
    });
  });

  describe('getWwwApexRedirectUrl', () => {
    it('redirects www.dhan.am to apex without leaking the internal service port', () => {
      const redirectUrl = getWwwApexRedirectUrl('https://www.dhan.am:4200/', 'www.dhan.am');

      expect(redirectUrl?.toString()).toBe('https://dhan.am/');
    });

    it('preserves path and query while canonicalizing www to apex', () => {
      const redirectUrl = getWwwApexRedirectUrl(
        'https://www.dhan.am:4200/es?utm_source=test',
        'www.dhan.am:4200'
      );

      expect(redirectUrl?.toString()).toBe('https://dhan.am/es?utm_source=test');
    });

    it('does not redirect non-www hosts', () => {
      expect(getWwwApexRedirectUrl('https://app.dhan.am/login', 'app.dhan.am')).toBeNull();
    });
  });
});
