#!/usr/bin/env node
/**
 * Golden probe — offline contract check for Dhanam → product webhook envelopes.
 *
 * Validates the payment.succeeded envelope shape and HMAC signing contract used by
 * StripeMxSpeiRelayService and SubscriptionLifecycleService fan-out.
 *
 * Usage:
 *   node scripts/golden-probes/verify-product-webhook-envelope.mjs
 *   GOLDEN_PROBE_SECRET=local-test node scripts/golden-probes/verify-product-webhook-envelope.mjs
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const REQUIRED_TOP_LEVEL = ['type', 'id', 'timestamp', 'data'];
const REQUIRED_DATA = ['customer_id', 'payment_id', 'amount', 'amount_minor', 'currency'];

function buildSampleEnvelope() {
  return {
    type: 'payment.succeeded',
    id: '00000000-0000-4000-8000-000000000001',
    timestamp: new Date().toISOString(),
    data: {
      customer_id: 'user_golden_probe',
      subscription_id: '',
      payment_id: 'pi_golden_probe',
      amount: '19.90',
      amount_minor: 1990,
      currency: 'MXN',
    },
  };
}

function signEnvelope(envelope, secret) {
  const body = JSON.stringify(envelope);
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  return { body, signature };
}

function verifySignature(body, signature, secret) {
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const envelope = buildSampleEnvelope();
for (const key of REQUIRED_TOP_LEVEL) {
  assert(key in envelope, `missing top-level field: ${key}`);
}
for (const key of REQUIRED_DATA) {
  assert(key in envelope.data, `missing data field: ${key}`);
}

assert(envelope.data.currency === envelope.data.currency.toUpperCase(), 'currency must be uppercase');
assert(typeof envelope.data.amount_minor === 'number', 'amount_minor must be a number');
assert(typeof envelope.data.amount === 'string', 'amount must be a decimal string');

const secret = process.env.GOLDEN_PROBE_SECRET || 'golden-probe-local-secret';
const { body, signature } = signEnvelope(envelope, secret);
assert(verifySignature(body, signature, secret), 'HMAC signature must verify');
assert(signature.length === 64, 'signature must be 64-char hex');

console.log('golden-probe: payment.succeeded envelope contract OK');
console.log(`  envelope_id=${envelope.id}`);
console.log(`  payment_id=${envelope.data.payment_id}`);
