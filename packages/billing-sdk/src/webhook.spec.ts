import crypto from 'crypto';

import { parseWebhookPayload, verifyWebhookSignature } from './webhook';
import { DhanamWebhookEventType } from './types';

function sign(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

const samplePayload = JSON.stringify({
  id: 'evt_123',
  type: DhanamWebhookEventType.SUBSCRIPTION_CREATED,
  timestamp: '2025-02-25T00:00:00Z',
  data: {
    customer_id: 'cus_abc',
    subscription_id: 'sub_xyz',
    plan_id: 'pro',
    status: 'active',
    provider: 'stripe',
  },
});

describe('verifyWebhookSignature', () => {
  const secret = 'whsec_test_secret_key';

  it('returns true for a valid signature', async () => {
    const sig = sign(samplePayload, secret);
    const result = await verifyWebhookSignature(samplePayload, sig, secret);
    expect(result).toBe(true);
  });

  it('returns false for an invalid signature', async () => {
    const result = await verifyWebhookSignature(samplePayload, 'bad_signature_hex', secret);
    expect(result).toBe(false);
  });

  it('returns false for wrong secret', async () => {
    const sig = sign(samplePayload, 'wrong_secret');
    const result = await verifyWebhookSignature(samplePayload, sig, secret);
    expect(result).toBe(false);
  });

  it('returns false for tampered body', async () => {
    const sig = sign(samplePayload, secret);
    const tampered = samplePayload.replace('evt_123', 'evt_hacked');
    const result = await verifyWebhookSignature(tampered, sig, secret);
    expect(result).toBe(false);
  });
});

describe('parseWebhookPayload', () => {
  const secret = 'whsec_parse_test';

  it('parses and verifies a valid payload', async () => {
    const sig = sign(samplePayload, secret);
    const result = await parseWebhookPayload(samplePayload, sig, secret);

    expect(result.id).toBe('evt_123');
    expect(result.type).toBe(DhanamWebhookEventType.SUBSCRIPTION_CREATED);
    expect(result.data.customer_id).toBe('cus_abc');
    expect(result.data.provider).toBe('stripe');
  });

  it('throws on invalid signature', async () => {
    await expect(
      parseWebhookPayload(samplePayload, 'invalid', secret),
    ).rejects.toThrow('Invalid webhook signature');
  });

  it('parses without verification when no signature provided', async () => {
    const result = await parseWebhookPayload(samplePayload);
    expect(result.id).toBe('evt_123');
  });

  it('parses without verification when no secret provided', async () => {
    const sig = sign(samplePayload, secret);
    const result = await parseWebhookPayload(samplePayload, sig);
    expect(result.id).toBe('evt_123');
  });
});
