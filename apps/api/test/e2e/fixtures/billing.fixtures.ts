export const stripeWebhookFixtures = {
  checkoutCompleted: (customerId: string, email: string) => ({
    id: 'evt_test_checkout',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        customer: customerId,
        customer_email: email,
        subscription: 'sub_test_123',
        mode: 'subscription',
        status: 'complete',
        metadata: { userId: '', tier: 'pro' },
      },
    },
  }),

  subscriptionCreated: (customerId: string) => ({
    id: 'evt_test_sub_created',
    type: 'customer.subscription.created',
    data: {
      object: {
        id: 'sub_test_123',
        customer: customerId,
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
        items: {
          data: [{ price: { id: 'price_pro', product: 'prod_pro' } }],
        },
      },
    },
  }),

  subscriptionUpdated: (customerId: string, newTier: string) => ({
    id: 'evt_test_sub_updated',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_test_123',
        customer: customerId,
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
        items: {
          data: [{ price: { id: `price_${newTier}`, product: `prod_${newTier}` } }],
        },
      },
    },
  }),

  subscriptionDeleted: (customerId: string) => ({
    id: 'evt_test_sub_deleted',
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: 'sub_test_123',
        customer: customerId,
        status: 'canceled',
        items: { data: [{ price: { id: 'price_pro' } }] },
      },
    },
  }),

  invoicePaymentSucceeded: (customerId: string) => ({
    id: 'evt_test_invoice_paid',
    type: 'invoice.payment_succeeded',
    data: {
      object: {
        id: 'in_test_paid_123',
        customer: customerId,
        subscription: 'sub_test_123',
        status: 'paid',
        amount_paid: 1999,
        currency: 'usd',
      },
    },
  }),

  invoicePaymentFailed: (customerId: string) => ({
    id: 'evt_test_invoice_failed',
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: 'in_test_123',
        customer: customerId,
        subscription: 'sub_test_123',
        status: 'open',
        attempt_count: 1,
      },
    },
  }),
};
