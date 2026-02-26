import type { DhanamWebhookPayload } from './types';

/**
 * Verify a Dhanam webhook signature using HMAC-SHA256 with timing-safe comparison.
 *
 * Works in Node.js (>=15.0.0 for `crypto.timingSafeEqual`) and edge runtimes
 * that expose the Web Crypto API (`globalThis.crypto.subtle`).
 *
 * @param rawBody  - The raw request body string exactly as received.
 * @param signature - The value of the `x-janua-signature` header.
 * @param secret   - Your webhook signing secret.
 * @returns `true` if the signature is valid.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  // --- Web Crypto path (works in Edge, Cloudflare Workers, Deno, modern Node) ---
  if (globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const expected = bufferToHex(mac);
    return timingSafeEqual(expected, signature);
  }

  // --- Node.js crypto fallback ---
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature),
  );
}

/**
 * Parse and optionally verify a Dhanam webhook payload.
 *
 * @param rawBody   - The raw request body string.
 * @param signature - The `x-janua-signature` header value (omit to skip verification).
 * @param secret    - Your webhook signing secret (required when signature is provided).
 * @returns The parsed webhook payload.
 * @throws {Error} If signature verification fails.
 */
export async function parseWebhookPayload(
  rawBody: string,
  signature?: string,
  secret?: string,
): Promise<DhanamWebhookPayload> {
  if (signature && secret) {
    const valid = await verifyWebhookSignature(rawBody, signature, secret);
    if (!valid) {
      throw new Error('Invalid webhook signature');
    }
  }

  return JSON.parse(rawBody) as DhanamWebhookPayload;
}

// ── Helpers ──────────────────────────────────────

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Falls back to byte-by-byte OR when `crypto.timingSafeEqual` is unavailable.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
