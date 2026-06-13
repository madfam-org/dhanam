import { DhanamPosClient } from './pos';

function mockFetch(status: number, body: unknown): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe('DhanamPosClient', () => {
  const baseUrl = 'https://api.dhan.am';

  it('previewRoute posts to admin billing route preview', async () => {
    const preview = {
      provider: 'stripe_mx',
      routeReason: 'country_mx',
      countryCode: 'MX',
      currency: 'MXN',
      paymentMethods: ['card'],
      catalogPlanId: 'dhanam_pro',
    };
    const fetch = mockFetch(200, preview);
    const client = new DhanamPosClient({
      baseUrl,
      getAccessToken: async () => 'admin-token',
      fetch,
    });

    const result = await client.previewRoute({
      userId: 'user-1',
      plan: 'pro',
      product: 'dhanam',
      countryCode: 'MX',
    });

    expect(result.provider).toBe('stripe_mx');
    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/v1/admin/billing/route/preview`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer admin-token',
        }),
      })
    );
  });

  it('getTimeline fetches correlation timeline', async () => {
    const timeline = [
      {
        id: 'be-1',
        type: 'pos_charge',
        status: 'completed',
        amount: '199.00',
        currency: 'MXN',
        createdAt: '2026-06-12T10:00:00.000Z',
        cfdiUuid: 'cfdi-uuid-1',
      },
    ];
    const fetch = mockFetch(200, timeline);
    const client = new DhanamPosClient({
      baseUrl,
      getAccessToken: async () => 'admin-token',
      fetch,
    });

    const result = await client.getTimeline('corr-123');
    expect(result).toHaveLength(1);
    expect(result[0]?.cfdiUuid).toBe('cfdi-uuid-1');
    expect(fetch.mock.calls[0][0]).toBe(`${baseUrl}/v1/admin/billing/pos/timeline/corr-123`);
  });

  it('createRefund supports partial amountMinor', async () => {
    const refund = {
      correlationId: 'corr-1',
      refundId: 're_1',
      provider: 'stripe_mx',
      status: 'succeeded',
      amountMinor: 500,
      currency: 'MXN',
    };
    const fetch = mockFetch(200, refund);
    const client = new DhanamPosClient({
      baseUrl,
      getAccessToken: async () => 'admin-token',
      fetch,
    });

    const result = await client.createRefund({
      paymentIntentId: 'pi_1',
      amountMinor: 500,
      reason: 'partial adjustment',
    });

    expect(result.amountMinor).toBe(500);
    const body = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(body.amountMinor).toBe(500);
  });
});
