import type Stripe from 'stripe';

/**
 * Pinned Stripe API version for Dhanam billing clients.
 * Cast until the installed stripe package types include this release.
 */
export const STRIPE_API_VERSION = '2026-02-25.clover' as unknown as Stripe.LatestApiVersion;
