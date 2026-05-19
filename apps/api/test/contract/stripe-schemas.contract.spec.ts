/**
 * Contract tests for Stripe webhook event schemas.
 *
 * These tests validate that our fixture data matches the expected shape
 * of Stripe webhook events, catching schema drift before it hits production.
 */
import { z } from 'zod';

// -- Stripe event schemas (mirrors what our webhook handler expects) --

const StripeCheckoutSessionSchema = z.object({
  id: z.string().startsWith('cs_'),
  customer: z.string().startsWith('cus_'),
  customer_email: z.string().email(),
  subscription: z.string().startsWith('sub_').nullable(),
  mode: z.enum(['subscription', 'payment', 'setup']),
  status: z.enum(['complete', 'expired', 'open']),
  metadata: z.record(z.string(), z.string()).optional(),
});

const StripeSubscriptionSchema = z.object({
  id: z.string().startsWith('sub_'),
  customer: z.string().startsWith('cus_'),
  status: z.enum([
    'active',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'past_due',
    'paused',
    'trialing',
    'unpaid',
  ]),
  items: z.object({
    data: z.array(
      z.object({
        price: z.object({
          id: z.string().startsWith('price_'),
        }),
      })
    ),
  }),
});

const StripeInvoiceSchema = z.object({
  id: z.string().startsWith('in_'),
  customer: z.string().startsWith('cus_'),
  subscription: z.string().startsWith('sub_').nullable(),
  status: z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']),
  attempt_count: z.number().int().nonnegative(),
});

const StripePaymentIntentSchema = z.object({
  id: z.string().startsWith('pi_'),
  customer: z.string().startsWith('cus_'),
  amount: z.number().int().positive(),
  currency: z.string().length(3),
  status: z.enum([
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'processing',
    'requires_capture',
    'canceled',
    'succeeded',
  ]),
});

const StripeEventSchema = z.object({
  id: z.string().startsWith('evt_'),
  type: z.string(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
});

// -- Test fixtures --

const fixtures = {
  checkoutCompleted: {
    id: 'evt_test_checkout_001',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_abc123',
        customer: 'cus_test_customer1',
        customer_email: 'user@example.com',
        subscription: 'sub_test_sub123',
        mode: 'subscription' as const,
        status: 'complete' as const,
        metadata: { userId: 'user-123', tier: 'pro' },
      },
    },
  },

  invoicePaid: {
    id: 'evt_test_invoice_001',
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_test_inv123',
        customer: 'cus_test_customer1',
        subscription: 'sub_test_sub123',
        status: 'paid' as const,
        attempt_count: 1,
      },
    },
  },

  subscriptionUpdated: {
    id: 'evt_test_sub_update_001',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_test_sub123',
        customer: 'cus_test_customer1',
        status: 'active' as const,
        items: {
          data: [{ price: { id: 'price_pro_monthly' } }],
        },
      },
    },
  },

  subscriptionDeleted: {
    id: 'evt_test_sub_delete_001',
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: 'sub_test_sub123',
        customer: 'cus_test_customer1',
        status: 'canceled' as const,
        items: {
          data: [{ price: { id: 'price_pro_monthly' } }],
        },
      },
    },
  },

  paymentFailed: {
    id: 'evt_test_payment_fail_001',
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: 'in_test_inv_fail',
        customer: 'cus_test_customer1',
        subscription: 'sub_test_sub123',
        status: 'open' as const,
        attempt_count: 1,
      },
    },
  },
};

// -- Contract tests --

describe('Stripe Webhook Schema Contracts', () => {
  describe('Event envelope', () => {
    it('checkout.session.completed matches event schema', () => {
      expect(() => StripeEventSchema.parse(fixtures.checkoutCompleted)).not.toThrow();
    });

    it('invoice.paid matches event schema', () => {
      expect(() => StripeEventSchema.parse(fixtures.invoicePaid)).not.toThrow();
    });

    it('customer.subscription.updated matches event schema', () => {
      expect(() => StripeEventSchema.parse(fixtures.subscriptionUpdated)).not.toThrow();
    });

    it('customer.subscription.deleted matches event schema', () => {
      expect(() => StripeEventSchema.parse(fixtures.subscriptionDeleted)).not.toThrow();
    });

    it('invoice.payment_failed matches event schema', () => {
      expect(() => StripeEventSchema.parse(fixtures.paymentFailed)).not.toThrow();
    });
  });

  describe('checkout.session.completed payload', () => {
    it('session object matches CheckoutSession schema', () => {
      expect(() =>
        StripeCheckoutSessionSchema.parse(fixtures.checkoutCompleted.data.object)
      ).not.toThrow();
    });

    it('contains required metadata fields', () => {
      const session = fixtures.checkoutCompleted.data.object;
      expect(session.metadata).toBeDefined();
      expect(session.metadata!.tier).toBeDefined();
    });
  });

  describe('subscription event payloads', () => {
    it('subscription.updated matches Subscription schema', () => {
      expect(() =>
        StripeSubscriptionSchema.parse(fixtures.subscriptionUpdated.data.object)
      ).not.toThrow();
    });

    it('subscription.deleted matches Subscription schema', () => {
      expect(() =>
        StripeSubscriptionSchema.parse(fixtures.subscriptionDeleted.data.object)
      ).not.toThrow();
    });
  });

  describe('invoice event payloads', () => {
    it('invoice.paid matches Invoice schema', () => {
      expect(() => StripeInvoiceSchema.parse(fixtures.invoicePaid.data.object)).not.toThrow();
    });

    it('invoice.payment_failed matches Invoice schema', () => {
      expect(() => StripeInvoiceSchema.parse(fixtures.paymentFailed.data.object)).not.toThrow();
    });
  });
});
