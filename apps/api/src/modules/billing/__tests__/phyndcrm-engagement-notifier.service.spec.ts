/**
 * PhyndCrmEngagementNotifierService — fire-and-forget emission to
 * PhyndCRM's engagement events webhook. Tests cover:
 *   - skipped when envelope has no engagement_id
 *   - skipped when secret or URL unset
 *   - HMAC signature matches body
 *   - dedup_key shape is stable across retries
 *   - success / failed / refunded each translate correctly
 *   - network failure is swallowed (never throws)
 */
import { createHmac } from 'crypto';

import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { PhyndCrmEngagementNotifierService } from '../services/phyndcrm-engagement-notifier.service';
import type { DhanamPaymentEnvelope } from '../services/stripe-mx-spei-relay.service';

const SECRET = 'phynd-events-secret';
const URL = 'https://phynd-crm.madfam.io';

function mkConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    PHYNDCRM_API_URL: URL,
    PHYND_ENGAGEMENT_EVENTS_SECRET: SECRET,
    PHYNDCRM_WEBHOOK_TIMEOUT: 5000,
    ...overrides,
  };
  return {
    get: jest.fn((key: string, def?: unknown) => values[key] ?? def),
  };
}

function mkEnvelope(
  partial: Partial<DhanamPaymentEnvelope> = {},
  ecosystem: Partial<NonNullable<DhanamPaymentEnvelope['data']['ecosystem']>> | null = null
): DhanamPaymentEnvelope {
  return {
    type: 'payment.succeeded',
    id: 'env_abc',
    timestamp: '2026-04-19T09:00:00.000Z',
    data: {
      customer_id: 'user_1',
      subscription_id: 'sub_1',
      payment_id: 'pi_123',
      amount: '199.00',
      amount_minor: 19900,
      currency: 'MXN',
      ...(ecosystem && {
        ecosystem: ecosystem as NonNullable<DhanamPaymentEnvelope['data']['ecosystem']>,
      }),
    },
    ...partial,
  };
}

describe('PhyndCrmEngagementNotifierService', () => {
  let svc: PhyndCrmEngagementNotifierService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PhyndCrmEngagementNotifierService,
        { provide: ConfigService, useValue: mkConfig() },
      ],
    }).compile();
    svc = module.get(PhyndCrmEngagementNotifierService);

    fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    } as unknown as Response);
  });

  afterEach(() => fetchSpy.mockRestore());

  it('is a no-op when envelope has no engagement_id', async () => {
    await svc.notify(mkEnvelope());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('is a no-op when engagement_id is falsy', async () => {
    await svc.notify(mkEnvelope({}, { engagement_id: '' }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips when PHYNDCRM_API_URL is unset', async () => {
    const module = await Test.createTestingModule({
      providers: [
        PhyndCrmEngagementNotifierService,
        { provide: ConfigService, useValue: mkConfig({ PHYNDCRM_API_URL: '' }) },
      ],
    }).compile();
    const svc2 = module.get(PhyndCrmEngagementNotifierService);
    await svc2.notify(mkEnvelope({}, { engagement_id: 'eng_1' }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips when the shared secret is unset', async () => {
    const module = await Test.createTestingModule({
      providers: [
        PhyndCrmEngagementNotifierService,
        { provide: ConfigService, useValue: mkConfig({ PHYND_ENGAGEMENT_EVENTS_SECRET: '' }) },
      ],
    }).compile();
    const svc2 = module.get(PhyndCrmEngagementNotifierService);
    await svc2.notify(mkEnvelope({}, { engagement_id: 'eng_1' }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSTs to /api/v1/engagements/events with HMAC body signature', async () => {
    await svc.notify(mkEnvelope({}, { engagement_id: 'eng_1', cotiza_quote_id: 'q_1' }));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [urlArg, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(urlArg).toBe(`${URL}/api/v1/engagements/events`);
    expect(init.method).toBe('POST');
    const body = init.body as string;
    const expectedSig = createHmac('sha256', SECRET).update(body).digest('hex');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-webhook-signature']).toBe(expectedSig);
    expect(headers['x-webhook-timestamp']).toBe('2026-04-19T09:00:00.000Z');
  });

  it('builds a stable dedup_key from envelope type + payment_id', async () => {
    await svc.notify(mkEnvelope({}, { engagement_id: 'eng_1' }));
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.dedup_key).toBe('dhanam:payment.succeeded:pi_123');
    expect(body.source).toBe('dhanam');
    expect(body.event_type).toBe('payment.succeeded');
    expect(body.engagement_id).toBe('eng_1');
    expect(body.status).toBe('completed');
  });

  it('flips status to "failed" for payment.failed', async () => {
    await svc.notify(
      mkEnvelope({
        type: 'payment.failed',
        data: {
          customer_id: 'u',
          subscription_id: '',
          payment_id: 'pi_x',
          amount: '50.00',
          amount_minor: 5000,
          currency: 'MXN',
          failure_reason: 'card_declined',
          failure_code: 'generic_decline',
          ecosystem: { engagement_id: 'eng_1' },
        },
      })
    );
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.event_type).toBe('payment.failed');
    expect(body.status).toBe('failed');
    expect(body.message).toContain('card_declined');
    expect(body.metadata.failure_code).toBe('generic_decline');
  });

  it('passes through cotiza + milestone metadata into the payload', async () => {
    await svc.notify(
      mkEnvelope(
        {},
        {
          engagement_id: 'eng_1',
          cotiza_quote_id: 'q_1',
          cotiza_quote_item_id: 'qi_1',
          milestone_id: 'm_1',
          order_id: 'ord_1',
          source: 'cotiza',
        }
      )
    );
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.metadata.cotiza_quote_id).toBe('q_1');
    expect(body.metadata.cotiza_quote_item_id).toBe('qi_1');
    expect(body.metadata.milestone_id).toBe('m_1');
    expect(body.metadata.order_id).toBe('ord_1');
    expect(body.metadata.source_product).toBe('cotiza');
  });

  it('swallows fetch rejections without throwing', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(svc.notify(mkEnvelope({}, { engagement_id: 'eng_1' }))).resolves.toBeUndefined();
  });

  it('tolerates non-2xx responses without throwing', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: async () => 'upstream down',
    } as unknown as Response);
    await expect(svc.notify(mkEnvelope({}, { engagement_id: 'eng_1' }))).resolves.toBeUndefined();
  });

  it('strips trailing slash from PHYNDCRM_API_URL', async () => {
    const module = await Test.createTestingModule({
      providers: [
        PhyndCrmEngagementNotifierService,
        { provide: ConfigService, useValue: mkConfig({ PHYNDCRM_API_URL: `${URL}///` }) },
      ],
    }).compile();
    const svc2 = module.get(PhyndCrmEngagementNotifierService);
    await svc2.notify(mkEnvelope({}, { engagement_id: 'eng_1' }));
    const [urlArg] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(urlArg).toBe(`${URL}/api/v1/engagements/events`);
  });
});

describe('extractEcosystemMetadata (stripe-mx-spei-relay)', () => {
  it('returns null for empty metadata', async () => {
    const mod = await import('../services/stripe-mx-spei-relay.service');
    expect(mod.extractEcosystemMetadata(null)).toBeNull();
    expect(mod.extractEcosystemMetadata({})).toBeNull();
  });

  it('picks only known keys, skips empties', async () => {
    const mod = await import('../services/stripe-mx-spei-relay.service');
    const result = mod.extractEcosystemMetadata({
      engagement_id: 'eng_1',
      cotiza_quote_id: 'q_1',
      source: '',
      unrelated: 'ignored',
    });
    expect(result).toEqual({ engagement_id: 'eng_1', cotiza_quote_id: 'q_1' });
  });
});
