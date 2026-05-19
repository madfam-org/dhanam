/**
 * Contract tests for Belvo API response and webhook schemas.
 *
 * Validates that our test fixtures match Belvo's expected data shapes
 * for the Mexico market integration.
 */
import { z } from 'zod';

// -- Belvo API response schemas --

const BelvoAccountSchema = z.object({
  id: z.string().uuid(),
  link: z.string().uuid(),
  institution: z.object({
    name: z.string(),
    type: z.enum(['bank', 'fiscal', 'gig', 'employment']),
  }),
  name: z.string(),
  number: z.string().nullable(),
  category: z.enum(['CHECKING_ACCOUNT', 'SAVINGS_ACCOUNT', 'CREDIT_CARD', 'LOAN_ACCOUNT']),
  currency: z.string().length(3),
  balance: z.object({
    available: z.number().nullable(),
    current: z.number(),
  }),
  collected_at: z.string().datetime(),
});

const BelvoTransactionSchema = z.object({
  id: z.string().uuid(),
  account: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  amount: z.number(),
  currency: z.string().length(3),
  value_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string(),
  merchant: z
    .object({
      name: z.string().nullable(),
      website: z.string().nullable(),
      logo: z.string().nullable(),
    })
    .nullable(),
  category: z.string().nullable(),
  type: z.enum(['INFLOW', 'OUTFLOW']),
  status: z.enum(['PENDING', 'PROCESSED', 'UNCATEGORIZED']),
  reference: z.string().nullable(),
  collected_at: z.string().datetime(),
});

const BelvoWebhookSchema = z.object({
  webhook_id: z.string().uuid(),
  webhook_type: z.string(),
  webhook_code: z.string(),
  link_id: z.string().uuid(),
  data: z.record(z.string(), z.unknown()).optional(),
});

// -- Test fixtures --

const accountFixtures = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    link: '550e8400-e29b-41d4-a716-446655440000',
    institution: {
      name: 'BBVA México',
      type: 'bank' as const,
    },
    name: 'Cuenta de Cheques',
    number: '012345678901',
    category: 'CHECKING_ACCOUNT' as const,
    currency: 'MXN',
    balance: {
      available: 15000.5,
      current: 15200.0,
    },
    collected_at: '2024-03-15T10:30:00.000Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    link: '550e8400-e29b-41d4-a716-446655440000',
    institution: {
      name: 'Banorte',
      type: 'bank' as const,
    },
    name: 'Tarjeta de Crédito',
    number: null,
    category: 'CREDIT_CARD' as const,
    currency: 'MXN',
    balance: {
      available: 20000.0,
      current: 8500.0,
    },
    collected_at: '2024-03-15T10:30:00.000Z',
  },
];

const transactionFixtures = [
  {
    id: '660e8400-e29b-41d4-a716-446655440001',
    account: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Cuenta de Cheques',
    },
    amount: 350.0,
    currency: 'MXN',
    value_date: '2024-03-15',
    description: 'OXXO PAGO SERVICIO',
    merchant: {
      name: 'OXXO',
      website: null,
      logo: null,
    },
    category: 'Utilities',
    type: 'OUTFLOW' as const,
    status: 'PROCESSED' as const,
    reference: 'REF-001-MX',
    collected_at: '2024-03-15T12:00:00.000Z',
  },
  {
    id: '660e8400-e29b-41d4-a716-446655440002',
    account: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Cuenta de Cheques',
    },
    amount: 25000.0,
    currency: 'MXN',
    value_date: '2024-03-01',
    description: 'DEPOSITO NOMINA',
    merchant: null,
    category: 'Income',
    type: 'INFLOW' as const,
    status: 'PROCESSED' as const,
    reference: null,
    collected_at: '2024-03-01T08:00:00.000Z',
  },
];

const webhookFixtures = {
  newAccounts: {
    webhook_id: '770e8400-e29b-41d4-a716-446655440001',
    webhook_type: 'ACCOUNTS',
    webhook_code: 'new_accounts_available',
    link_id: '550e8400-e29b-41d4-a716-446655440000',
    data: { total: 2 },
  },
  newTransactions: {
    webhook_id: '770e8400-e29b-41d4-a716-446655440002',
    webhook_type: 'TRANSACTIONS',
    webhook_code: 'new_transactions_available',
    link_id: '550e8400-e29b-41d4-a716-446655440000',
    data: { total: 15 },
  },
  historicalUpdate: {
    webhook_id: '770e8400-e29b-41d4-a716-446655440003',
    webhook_type: 'TRANSACTIONS',
    webhook_code: 'historical_update',
    link_id: '550e8400-e29b-41d4-a716-446655440000',
    data: { total: 90 },
  },
};

// -- Contract tests --

describe('Belvo Schema Contracts', () => {
  describe('Account response shapes', () => {
    it('checking account matches Belvo Account schema', () => {
      expect(() => BelvoAccountSchema.parse(accountFixtures[0])).not.toThrow();
    });

    it('credit card matches Belvo Account schema', () => {
      expect(() => BelvoAccountSchema.parse(accountFixtures[1])).not.toThrow();
    });

    it('all fixture accounts are valid', () => {
      accountFixtures.forEach((account) => {
        expect(() => BelvoAccountSchema.parse(account)).not.toThrow();
      });
    });
  });

  describe('Transaction response shapes', () => {
    it('outflow transaction matches Transaction schema', () => {
      expect(() => BelvoTransactionSchema.parse(transactionFixtures[0])).not.toThrow();
    });

    it('inflow transaction matches Transaction schema', () => {
      expect(() => BelvoTransactionSchema.parse(transactionFixtures[1])).not.toThrow();
    });

    it('all fixture transactions are valid', () => {
      transactionFixtures.forEach((txn) => {
        expect(() => BelvoTransactionSchema.parse(txn)).not.toThrow();
      });
    });
  });

  describe('Webhook event shapes', () => {
    it('new_accounts_available matches webhook schema', () => {
      expect(() => BelvoWebhookSchema.parse(webhookFixtures.newAccounts)).not.toThrow();
    });

    it('new_transactions_available matches webhook schema', () => {
      expect(() => BelvoWebhookSchema.parse(webhookFixtures.newTransactions)).not.toThrow();
    });

    it('historical_update matches webhook schema', () => {
      expect(() => BelvoWebhookSchema.parse(webhookFixtures.historicalUpdate)).not.toThrow();
    });
  });
});
