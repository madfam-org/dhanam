import { DhanamClient } from './client';
import { DhanamApiError, DhanamAuthError } from './errors';

function mockFetch(status: number, body: unknown): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe('DhanamClient', () => {
  const baseUrl = 'https://api.dhan.am';

  describe('buildCheckoutUrl', () => {
    it('builds a public checkout URL with query params', () => {
      const client = new DhanamClient({ baseUrl });
      const url = client.buildCheckoutUrl({
        plan: 'essentials',
        userId: 'usr_123',
        returnUrl: 'https://app.dhan.am/success',
      });
      expect(url).toBe(
        'https://api.dhan.am/billing/checkout?plan=essentials&user_id=usr_123&return_url=https%3A%2F%2Fapp.dhan.am%2Fsuccess',
      );
    });

    it('strips trailing slash from baseUrl', () => {
      const client = new DhanamClient({ baseUrl: 'https://api.dhan.am/' });
      const url = client.buildCheckoutUrl({
        plan: 'pro',
        userId: 'usr_1',
        returnUrl: 'http://localhost:3000',
      });
      expect(url).toContain('https://api.dhan.am/billing/checkout?');
    });
  });

  describe('upgrade', () => {
    it('POSTs to /billing/upgrade with auth header', async () => {
      const fetch = mockFetch(200, { checkoutUrl: 'https://pay.example.com', provider: 'stripe' });
      const client = new DhanamClient({ baseUrl, token: 'tok_abc', fetch });

      const result = await client.upgrade({ plan: 'pro' });

      expect(fetch).toHaveBeenCalledWith('https://api.dhan.am/billing/upgrade', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer tok_abc',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan: 'pro' }),
      });
      expect(result).toEqual({ checkoutUrl: 'https://pay.example.com', provider: 'stripe' });
    });

    it('supports async token provider', async () => {
      const fetch = mockFetch(200, { checkoutUrl: 'url', provider: 'polar' });
      const tokenFn = jest.fn().mockResolvedValue('dynamic_token');
      const client = new DhanamClient({ baseUrl, token: tokenFn, fetch });

      await client.upgrade();

      expect(tokenFn).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer dynamic_token' }),
        }),
      );
    });
  });

  describe('getStatus', () => {
    it('GETs /billing/status', async () => {
      const body = { tier: 'pro', startedAt: '2025-01-01', expiresAt: null, isActive: true };
      const fetch = mockFetch(200, body);
      const client = new DhanamClient({ baseUrl, token: 'tok', fetch });

      const result = await client.getStatus();

      expect(fetch).toHaveBeenCalledWith('https://api.dhan.am/billing/status', {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: 'Bearer tok' },
        body: undefined,
      });
      expect(result).toEqual(body);
    });
  });

  describe('getUsage', () => {
    it('GETs /billing/usage', async () => {
      const body = { date: '2025-02-25', tier: 'essentials', usage: {} };
      const fetch = mockFetch(200, body);
      const client = new DhanamClient({ baseUrl, token: 'tok', fetch });

      const result = await client.getUsage();
      expect(result).toEqual(body);
    });
  });

  describe('getHistory', () => {
    it('GETs /billing/history', async () => {
      const body = { events: [] };
      const fetch = mockFetch(200, body);
      const client = new DhanamClient({ baseUrl, token: 'tok', fetch });

      const result = await client.getHistory();
      expect(result).toEqual(body);
    });
  });

  describe('createPortalSession', () => {
    it('POSTs to /billing/portal', async () => {
      const fetch = mockFetch(200, { portalUrl: 'https://portal.example.com' });
      const client = new DhanamClient({ baseUrl, token: 'tok', fetch });

      const result = await client.createPortalSession();

      expect(fetch).toHaveBeenCalledWith('https://api.dhan.am/billing/portal', {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: 'Bearer tok' },
        body: undefined,
      });
      expect(result).toEqual({ portalUrl: 'https://portal.example.com' });
    });
  });

  describe('error handling', () => {
    it('throws DhanamAuthError on 401', async () => {
      const fetch = mockFetch(401, { message: 'Unauthorized' });
      const client = new DhanamClient({ baseUrl, token: 'bad', fetch });

      await expect(client.getStatus()).rejects.toThrow(DhanamAuthError);
    });

    it('throws DhanamApiError on other errors', async () => {
      const fetch = mockFetch(500, { message: 'Internal Server Error' });
      const client = new DhanamClient({ baseUrl, token: 'tok', fetch });

      await expect(client.getStatus()).rejects.toThrow(DhanamApiError);
      try {
        await client.getStatus();
      } catch (err) {
        expect((err as DhanamApiError).status).toBe(500);
      }
    });

    it('works without a token for unauthenticated calls', async () => {
      const fetch = mockFetch(200, { tier: 'community', isActive: true, startedAt: null, expiresAt: null });
      const client = new DhanamClient({ baseUrl, fetch });

      const result = await client.getStatus();
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        }),
      );
      expect(result.tier).toBe('community');
    });
  });
});
