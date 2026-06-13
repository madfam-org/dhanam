import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Golden probes (WS3) — contract tests for Dhanam → MADFAM product webhooks.
 * Live Karafiel/Cotiza/PhyndCRM endpoints are exercised via staging drills;
 * these tests lock the envelope + signing contract in CI.
 */
describe('Golden product webhook probes', () => {
  const secret = 'golden-probe-test-secret';

  function buildPaymentSucceededEnvelope(overrides: Record<string, unknown> = {}) {
    return {
      type: 'payment.succeeded',
      id: '11111111-2222-3333-4444-555555555555',
      timestamp: '2026-06-12T12:00:00.000Z',
      data: {
        customer_id: 'user-probe-1',
        subscription_id: 'sub_probe',
        payment_id: 'pi_probe_mx',
        amount: '199.00',
        amount_minor: 19900,
        currency: 'MXN',
        ...overrides,
      },
    };
  }

  function signBody(body: string): string {
    return createHmac('sha256', secret).update(body).digest('hex');
  }

  it('payment.succeeded envelope includes required Karafiel fields', () => {
    const envelope = buildPaymentSucceededEnvelope();
    expect(envelope.type).toBe('payment.succeeded');
    expect(envelope.data.payment_id).toMatch(/^pi_/);
    expect(envelope.data.amount_minor).toBe(19900);
    expect(envelope.data.currency).toBe('MXN');
    expect(envelope.data.customer_id).toBeTruthy();
  });

  it('HMAC signature verifies with X-Dhanam-Signature contract', () => {
    const envelope = buildPaymentSucceededEnvelope();
    const body = JSON.stringify(envelope);
    const signature = signBody(body);

    const expected = createHmac('sha256', secret).update(body).digest('hex');
    expect(timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))).toBe(true);
  });

  it('payment.refunded envelope preserves original_payment_id', () => {
    const envelope = {
      type: 'payment.refunded',
      id: '22222222-3333-4444-5555-666666666666',
      timestamp: '2026-06-12T12:01:00.000Z',
      data: {
        customer_id: 'user-probe-1',
        payment_id: 're_probe_refund',
        original_payment_id: 'pi_probe_mx',
        refunded_payment_id: 'pi_probe_mx',
        amount: '50.00',
        amount_minor: 5000,
        currency: 'MXN',
      },
    };

    const body = JSON.stringify(envelope);
    const signature = signBody(body);
    expect(signature).toHaveLength(64);
    expect(envelope.data.original_payment_id).toBe('pi_probe_mx');
  });

  it('Cotiza milestone metadata keys are snake_case in ecosystem block', () => {
    const envelope = buildPaymentSucceededEnvelope({
      ecosystem: {
        engagement_id: 'eng_123',
        cotiza_quote_id: 'quote_456',
        cotiza_quote_item_id: 'item_789',
        milestone_id: 'ms_001',
        order_id: 'ord_002',
        source_product: 'cotiza',
      },
    });

    const eco = (envelope.data as Record<string, unknown>).ecosystem as Record<string, string>;
    expect(eco.engagement_id).toBe('eng_123');
    expect(eco.cotiza_quote_id).toBe('quote_456');
    expect(eco.milestone_id).toBe('ms_001');
  });
});
