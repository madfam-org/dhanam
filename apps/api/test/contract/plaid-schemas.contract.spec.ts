/**
 * Contract tests for Plaid API response and webhook schemas.
 *
 * Validates that our test fixtures match Plaid's expected data shapes,
 * catching schema drift before it breaks provider sync.
 */
import { z } from 'zod';

// -- Plaid API response schemas --

const PlaidAccountSchema = z.object({
  account_id: z.string(),
  balances: z.object({
    available: z.number().nullable(),
    current: z.number(),
    iso_currency_code: z.string().length(3).nullable(),
    limit: z.number().nullable(),
  }),
  mask: z.string().nullable(),
  name: z.string(),
  official_name: z.string().nullable(),
  type: z.enum(['depository', 'credit', 'loan', 'investment', 'other']),
  subtype: z.string().nullable(),
});

const PlaidTransactionSchema = z.object({
  transaction_id: z.string(),
  account_id: z.string(),
  amount: z.number(),
  iso_currency_code: z.string().length(3).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string(),
  merchant_name: z.string().nullable(),
  pending: z.boolean(),
  category: z.array(z.string()).nullable(),
  category_id: z.string().nullable(),
  payment_channel: z.enum(['online', 'in store', 'other']),
});

const PlaidWebhookSchema = z.object({
  webhook_type: z.string(),
  webhook_code: z.string(),
  item_id: z.string(),
  error: z.unknown().nullable().optional(),
});

const PlaidTransactionsSyncWebhookSchema = PlaidWebhookSchema.extend({
  webhook_type: z.literal('TRANSACTIONS'),
  webhook_code: z.enum([
    'SYNC_UPDATES_AVAILABLE',
    'INITIAL_UPDATE',
    'HISTORICAL_UPDATE',
    'DEFAULT_UPDATE',
    'TRANSACTIONS_REMOVED',
  ]),
  initial_update_complete: z.boolean().optional(),
  historical_update_complete: z.boolean().optional(),
});

const PlaidBalanceWebhookSchema = PlaidWebhookSchema.extend({
  webhook_type: z.literal('ITEM'),
  webhook_code: z.literal('WEBHOOK_UPDATE_ACKNOWLEDGED'),
});

// -- Test fixtures --

const accountFixtures = [
  {
    account_id: 'plaid_acc_checking_001',
    balances: {
      available: 5000.0,
      current: 5200.5,
      iso_currency_code: 'USD',
      limit: null,
    },
    mask: '1234',
    name: 'Checking Account',
    official_name: 'Plaid Gold Standard Checking',
    type: 'depository' as const,
    subtype: 'checking',
  },
  {
    account_id: 'plaid_acc_credit_001',
    balances: {
      available: 3000.0,
      current: 2000.0,
      iso_currency_code: 'USD',
      limit: 5000.0,
    },
    mask: '5678',
    name: 'Credit Card',
    official_name: 'Plaid Platinum Credit Card',
    type: 'credit' as const,
    subtype: 'credit card',
  },
];

const transactionFixtures = [
  {
    transaction_id: 'plaid_txn_001',
    account_id: 'plaid_acc_checking_001',
    amount: 42.5,
    iso_currency_code: 'USD',
    date: '2024-03-15',
    name: 'UBER TRIP',
    merchant_name: 'Uber',
    pending: false,
    category: ['Travel', 'Taxi'],
    category_id: '22016000',
    payment_channel: 'online' as const,
  },
  {
    transaction_id: 'plaid_txn_002',
    account_id: 'plaid_acc_checking_001',
    amount: -2500.0,
    iso_currency_code: 'USD',
    date: '2024-03-01',
    name: 'DIRECT DEPOSIT',
    merchant_name: null,
    pending: false,
    category: ['Transfer', 'Payroll'],
    category_id: '21009000',
    payment_channel: 'other' as const,
  },
];

const webhookFixtures = {
  transactionsSync: {
    webhook_type: 'TRANSACTIONS' as const,
    webhook_code: 'SYNC_UPDATES_AVAILABLE' as const,
    item_id: 'plaid_item_001',
    error: null,
    initial_update_complete: true,
    historical_update_complete: false,
  },
  transactionsInitial: {
    webhook_type: 'TRANSACTIONS' as const,
    webhook_code: 'INITIAL_UPDATE' as const,
    item_id: 'plaid_item_001',
    error: null,
    initial_update_complete: true,
  },
  balanceUpdate: {
    webhook_type: 'ITEM' as const,
    webhook_code: 'WEBHOOK_UPDATE_ACKNOWLEDGED' as const,
    item_id: 'plaid_item_001',
    error: null,
  },
};

// -- Contract tests --

describe('Plaid Schema Contracts', () => {
  describe('Account response shapes', () => {
    it('checking account matches Account schema', () => {
      expect(() => PlaidAccountSchema.parse(accountFixtures[0])).not.toThrow();
    });

    it('credit account matches Account schema', () => {
      expect(() => PlaidAccountSchema.parse(accountFixtures[1])).not.toThrow();
    });

    it('all fixture accounts are valid', () => {
      accountFixtures.forEach((account) => {
        expect(() => PlaidAccountSchema.parse(account)).not.toThrow();
      });
    });
  });

  describe('Transaction response shapes', () => {
    it('expense transaction matches Transaction schema', () => {
      expect(() => PlaidTransactionSchema.parse(transactionFixtures[0])).not.toThrow();
    });

    it('income transaction matches Transaction schema', () => {
      expect(() => PlaidTransactionSchema.parse(transactionFixtures[1])).not.toThrow();
    });

    it('all fixture transactions are valid', () => {
      transactionFixtures.forEach((txn) => {
        expect(() => PlaidTransactionSchema.parse(txn)).not.toThrow();
      });
    });
  });

  describe('Webhook event shapes', () => {
    it('SYNC_UPDATES_AVAILABLE matches transactions webhook schema', () => {
      expect(() =>
        PlaidTransactionsSyncWebhookSchema.parse(webhookFixtures.transactionsSync)
      ).not.toThrow();
    });

    it('INITIAL_UPDATE matches transactions webhook schema', () => {
      expect(() =>
        PlaidTransactionsSyncWebhookSchema.parse(webhookFixtures.transactionsInitial)
      ).not.toThrow();
    });

    it('balance update matches webhook schema', () => {
      expect(() => PlaidBalanceWebhookSchema.parse(webhookFixtures.balanceUpdate)).not.toThrow();
    });
  });
});
