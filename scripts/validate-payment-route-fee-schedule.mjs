#!/usr/bin/env node
/**
 * Validates apps/api/src/modules/billing/config/payment-route-fee-schedule.bundled.json
 * Run: node scripts/validate-payment-route-fee-schedule.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schedulePath = join(
  __dirname,
  '../apps/api/src/modules/billing/config/payment-route-fee-schedule.bundled.json'
);

const VALID_PROVIDERS = new Set(['stripe_mx', 'paddle', 'legacy_stripe', 'conekta']);
const VALID_METHODS = new Set([
  'card',
  'spei',
  'customer_balance',
  'oxxo',
  'oxxo_cash',
  'paypal',
  'apple_pay',
  'google_pay',
]);

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function parseEntries(raw) {
  if (!Array.isArray(raw)) {
    fail('entries must be an array');
  }

  return raw.map((item, index) => {
    if (!item || typeof item !== 'object') {
      fail(`entry ${index} must be an object`);
    }

    const provider = item.provider;
    const paymentMethod = item.paymentMethod;

    if (!VALID_PROVIDERS.has(provider)) {
      fail(`entry ${index}: invalid provider "${provider}"`);
    }
    if (!VALID_METHODS.has(paymentMethod)) {
      fail(`entry ${index}: invalid paymentMethod "${paymentMethod}"`);
    }

    const currency = String(item.currency || '').toUpperCase();
    if (currency.length !== 3) {
      fail(`entry ${index}: currency must be a 3-letter ISO code`);
    }

    const percentBps = Number(item.percentBps);
    const fixedMinor = Number(item.fixedMinor);
    const customerFxBps = Number(item.customerFxBps ?? 0);

    if (!Number.isFinite(percentBps) || percentBps < 0) {
      fail(`entry ${index}: percentBps must be a non-negative number`);
    }
    if (!Number.isFinite(fixedMinor) || fixedMinor < 0) {
      fail(`entry ${index}: fixedMinor must be a non-negative number`);
    }
    if (!Number.isFinite(customerFxBps) || customerFxBps < 0) {
      fail(`entry ${index}: customerFxBps must be a non-negative number`);
    }

    const countries =
      item.countries === '*'
        ? '*'
        : Array.isArray(item.countries)
          ? item.countries
          : null;

    if (countries !== '*' && (!countries || countries.length === 0)) {
      fail(`entry ${index}: countries must be "*" or a non-empty array`);
    }

    if (!item.label || typeof item.label !== 'string') {
      fail(`entry ${index}: label is required`);
    }

    return { provider, paymentMethod, currency };
  });
}

let parsed;
try {
  parsed = JSON.parse(readFileSync(schedulePath, 'utf8'));
} catch (error) {
  fail(`unable to read schedule: ${error.message}`);
}

if (!parsed.version || typeof parsed.version !== 'string') {
  fail('version must be a non-empty string');
}

const entries = parseEntries(parsed.entries);
if (entries.length === 0) {
  fail('schedule must contain at least one entry');
}

console.log(
  `✅ payment-route-fee-schedule.bundled.json valid (v${parsed.version}, ${entries.length} entries)`
);
