#!/usr/bin/env node

import crypto from 'node:crypto';

const sku = {
  product: 'karafiel',
  tier: 'contador',
  plan: 'karafiel_contador',
  priceCode: 'karafiel_contador',
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optionalEnv(name, fallback = undefined) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    return fallback;
  }
  return value.trim();
}

function parseAmount(value) {
  if (!value) {
    return 129900;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('DHANAM_CHECKOUT_AMOUNT_CENTAVOS must be a positive integer');
  }

  return parsed;
}

async function postEvidence(payload) {
  const baseUrl = optionalEnv('TULANA_API_BASE_URL', 'https://tulana-api.madfam.io/api/v1').replace(/\/+$/, '');
  const token = requireEnv('TULANA_COMMERCIAL_GA_EVIDENCE_TOKEN');
  const endpoint = `${baseUrl}/madfam-skus/${sku.product}/${sku.tier}/commercial-ga-evidence/`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Tulana evidence write failed (${response.status}): ${bodyText}`);
  }

  return bodyText ? JSON.parse(bodyText) : {};
}

function buildPayload() {
  const sessionId = process.argv[2] || optionalEnv('DHANAM_CHECKOUT_SESSION_ID');
  if (!sessionId) {
    throw new Error('Usage: record-karafiel-contador-g5-evidence.mjs <checkout_session_id>');
  }

  const period = requireEnv('TULANA_COMMERCIAL_GA_PERIOD');
  const environment = optionalEnv('TULANA_COMMERCIAL_GA_ENVIRONMENT', 'production');
  const amountCentavos = parseAmount(optionalEnv('DHANAM_CHECKOUT_AMOUNT_CENTAVOS'));
  const currency = optionalEnv('DHANAM_CHECKOUT_CURRENCY', 'MXN').toUpperCase();
  const evidenceUrl = optionalEnv(
    'DHANAM_CHECKOUT_EVIDENCE_URL',
    `repo://dhanam/docs/KARAFIEL_CONTADOR_G5_OPERATOR_CHECKOUT_RUNBOOK_2026-06-01.md#${encodeURIComponent(sessionId)}`,
  );

  return {
    gate_id: 'G5',
    status: 'passed',
    confidence: 'high',
    evidence_type: 'dhanam_checkout_session',
    evidence_url: evidenceUrl,
    source_system: 'dhanam',
    source_record_id: sessionId,
    owner: 'dhanam',
    period,
    environment,
    metadata: {
      product: sku.product,
      tier: sku.tier,
      sku: `${sku.product}__${sku.tier}`,
      plan: sku.plan,
      price_code: sku.priceCode,
      checkout_session_id: sessionId,
      amount_centavos: amountCentavos,
      currency,
      money_path_gate: 'G5',
      operator_run_id: optionalEnv('DHANAM_OPERATOR_RUN_ID', crypto.randomUUID()),
      operator_email: optionalEnv('DHANAM_OPERATOR_EMAIL'),
      checkout_status_url: optionalEnv('DHANAM_CHECKOUT_STATUS_URL'),
      return_url: optionalEnv('DHANAM_CHECKOUT_RETURN_URL'),
      bbva_account_target: 'configured_in_dhanam_secrets_not_logged',
    },
  };
}

try {
  const payload = buildPayload();
  const result = await postEvidence(payload);
  console.log(
    JSON.stringify(
      {
        ok: true,
        gate_id: payload.gate_id,
        status: payload.status,
        sku: payload.metadata.sku,
        source_record_id: payload.source_record_id,
        tulana_record_id: result?.id ?? null,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
