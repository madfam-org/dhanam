# @dhanam/billing-sdk

Typed client for the Dhanam billing API — checkout flows, subscription management, and webhook verification.

Zero runtime dependencies. Works in Node.js, edge runtimes, and browsers.

## Install

```bash
pnpm add @dhanam/billing-sdk
# or
npm install @dhanam/billing-sdk
```

Requires the `@dhanam` scope to be configured against `npm.madfam.io` (see `.npmrc`).

## Quick Start

```ts
import { DhanamClient } from '@dhanam/billing-sdk';

const dhanam = new DhanamClient({
  baseUrl: 'https://api.dhan.am',
  token: 'eyJ…', // JWT or async () => getToken()
});

// Check subscription status
const status = await dhanam.getStatus();
console.log(status.tier); // 'community' | 'essentials' | 'pro'

// Initiate upgrade
const { checkoutUrl } = await dhanam.upgrade({ plan: 'pro' });

// Build public checkout URL (no auth needed)
const url = dhanam.buildCheckoutUrl({
  plan: 'essentials',
  userId: 'usr_abc123',
  returnUrl: 'https://app.dhan.am/billing/success',
});
```

## Webhook Verification

```ts
import { verifyWebhookSignature, parseWebhookPayload } from '@dhanam/billing-sdk';

// In your webhook handler:
const isValid = await verifyWebhookSignature(rawBody, signature, secret);

// Or parse + verify in one step:
const payload = await parseWebhookPayload(rawBody, signature, secret);
// payload.type === 'subscription.created'
```

## API

### `DhanamClient`

| Method | Auth | Description |
|--------|------|-------------|
| `buildCheckoutUrl(opts)` | No | Build a public checkout redirect URL |
| `upgrade(opts)` | Yes | Initiate a premium upgrade |
| `getStatus()` | Yes | Get current subscription status |
| `getUsage()` | Yes | Get billing-period usage metrics |
| `getHistory()` | Yes | Get billing event history |
| `createPortalSession()` | Yes | Create a self-service portal session |

### Webhook Utilities

| Function | Description |
|----------|-------------|
| `verifyWebhookSignature(rawBody, signature, secret)` | HMAC-SHA256 verification |
| `parseWebhookPayload(rawBody, signature?, secret?)` | Parse + optional verify |

### Error Handling

```ts
import { DhanamApiError, DhanamAuthError } from '@dhanam/billing-sdk';

try {
  await dhanam.getStatus();
} catch (err) {
  if (err instanceof DhanamAuthError) {
    // 401 — token expired or missing
  } else if (err instanceof DhanamApiError) {
    console.error(err.status, err.code, err.body);
  }
}
```

## Configuration

```ts
const dhanam = new DhanamClient({
  baseUrl: 'https://api.dhan.am',

  // Static token
  token: 'eyJ…',

  // Or async token provider (useful with Janua SSO)
  token: async () => {
    const session = await getSession();
    return session.accessToken;
  },

  // Custom fetch (optional — defaults to globalThis.fetch)
  fetch: customFetch,
});
```

## License

AGPL-3.0-only
