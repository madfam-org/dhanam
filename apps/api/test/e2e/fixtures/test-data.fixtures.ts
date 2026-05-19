import { Currency } from '@prisma/client';

export const TestDataFixtures = {
  users: {
    standard: {
      email: 'standard@example.com',
      password: 'Standard123!',
      name: 'Standard User',
      locale: 'es',
      timezone: 'America/Mexico_City',
    },
    admin: {
      email: 'admin@example.com',
      password: 'Admin123!',
      name: 'Admin User',
      locale: 'en',
      timezone: 'UTC',
      isAdmin: true,
    },
    businessOwner: {
      email: 'business@example.com',
      password: 'Business123!',
      name: 'Business Owner',
      locale: 'en',
      timezone: 'America/New_York',
    },
  },

  spaces: {
    personal: {
      name: 'Personal Finance',
      type: 'personal' as const,
      currency: 'MXN' as Currency,
      timezone: 'America/Mexico_City',
    },
    business: {
      name: 'My Business',
      type: 'business' as const,
      currency: 'USD' as Currency,
      timezone: 'America/New_York',
    },
    family: {
      name: 'Family Budget',
      type: 'personal' as const,
      currency: 'EUR' as Currency,
      timezone: 'Europe/Madrid',
    },
  },

  accounts: {
    checking: {
      provider: 'manual',
      providerAccountId: 'manual-checking-001',
      name: 'Main Checking',
      type: 'checking',
      subtype: 'checking',
      currency: 'MXN' as Currency,
      balance: 15000,
    },
    savings: {
      provider: 'manual',
      providerAccountId: 'manual-savings-001',
      name: 'Emergency Fund',
      type: 'savings',
      subtype: 'savings',
      currency: 'MXN' as Currency,
      balance: 50000,
    },
    creditCard: {
      provider: 'manual',
      providerAccountId: 'manual-credit-001',
      name: 'Credit Card',
      type: 'credit',
      subtype: 'credit_card',
      currency: 'MXN' as Currency,
      balance: -3500,
    },
    investment: {
      provider: 'manual',
      providerAccountId: 'manual-investment-001',
      name: 'Investment Account',
      type: 'investment',
      subtype: 'brokerage',
      currency: 'USD' as Currency,
      balance: 25000,
    },
    crypto: {
      provider: 'bitso',
      providerAccountId: 'bitso-btc-001',
      name: 'Bitcoin Wallet',
      type: 'crypto',
      subtype: 'wallet',
      currency: 'BTC' as Currency,
      balance: 0.25,
    },
  },

  budgets: {
    monthlyPersonal: {
      name: 'Monthly Personal Budget',
      period: 'monthly' as const,
      currency: 'MXN' as Currency,
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    },
    quarterlyBusiness: {
      name: 'Q1 Business Budget',
      period: 'quarterly' as const,
      currency: 'USD' as Currency,
      startDate: new Date(new Date().getFullYear(), 0, 1),
      endDate: new Date(new Date().getFullYear(), 2, 31),
    },
    yearlyFamily: {
      name: 'Annual Family Budget',
      period: 'yearly' as const,
      currency: 'EUR' as Currency,
      startDate: new Date(new Date().getFullYear(), 0, 1),
      endDate: new Date(new Date().getFullYear(), 11, 31),
    },
  },

  categories: {
    income: [
      {
        name: 'Salary',
        type: 'income' as const,
        limit: 0,
        icon: 'briefcase',
        color: '#4CAF50',
      },
      {
        name: 'Freelance',
        type: 'income' as const,
        limit: 0,
        icon: 'laptop',
        color: '#8BC34A',
      },
      {
        name: 'Investments',
        type: 'income' as const,
        limit: 0,
        icon: 'trending-up',
        color: '#CDDC39',
      },
    ],
    expense: [
      {
        name: 'Housing',
        type: 'expense' as const,
        limit: 15000,
        icon: 'home',
        color: '#2196F3',
      },
      {
        name: 'Food & Dining',
        type: 'expense' as const,
        limit: 8000,
        icon: 'restaurant',
        color: '#FF9800',
      },
      {
        name: 'Transportation',
        type: 'expense' as const,
        limit: 5000,
        icon: 'car',
        color: '#9C27B0',
      },
      {
        name: 'Utilities',
        type: 'expense' as const,
        limit: 3000,
        icon: 'zap',
        color: '#F44336',
      },
      {
        name: 'Entertainment',
        type: 'expense' as const,
        limit: 4000,
        icon: 'film',
        color: '#E91E63',
      },
      {
        name: 'Healthcare',
        type: 'expense' as const,
        limit: 2000,
        icon: 'heart',
        color: '#FF5722',
      },
      {
        name: 'Shopping',
        type: 'expense' as const,
        limit: 3000,
        icon: 'shopping-bag',
        color: '#795548',
      },
    ],
  },

  transactions: {
    income: [
      {
        amount: 50000,
        description: 'Monthly Salary',
        merchantName: 'Employer Inc',
        date: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
      {
        amount: 10000,
        description: 'Freelance Project',
        merchantName: 'Client ABC',
        date: new Date(new Date().getFullYear(), new Date().getMonth(), 15),
      },
    ],
    expenses: [
      {
        amount: -12000,
        description: 'Rent Payment',
        merchantName: 'Property Management',
        category: 'Housing',
      },
      {
        amount: -450,
        description: 'Grocery Shopping',
        merchantName: 'Supermarket XYZ',
        category: 'Food & Dining',
      },
      {
        amount: -1200,
        description: 'Gas Station',
        merchantName: 'Pemex',
        category: 'Transportation',
      },
      {
        amount: -800,
        description: 'Restaurant',
        merchantName: 'La Casa de Toño',
        category: 'Food & Dining',
      },
      {
        amount: -2500,
        description: 'Electricity Bill',
        merchantName: 'CFE',
        category: 'Utilities',
      },
      {
        amount: -600,
        description: 'Netflix & Spotify',
        merchantName: 'Entertainment Services',
        category: 'Entertainment',
      },
    ],
  },

  rules: [
    {
      name: 'Supermarket to Groceries',
      type: 'merchant',
      condition: {
        field: 'merchantName',
        operator: 'contains',
        value: 'Supermarket',
      },
      action: {
        type: 'categorize',
        categoryName: 'Food & Dining',
      },
      priority: 1,
    },
    {
      name: 'Gas Stations to Transport',
      type: 'merchant',
      condition: {
        field: 'merchantName',
        operator: 'contains',
        value: 'Pemex',
      },
      action: {
        type: 'categorize',
        categoryName: 'Transportation',
      },
      priority: 1,
    },
    {
      name: 'Large Income to Salary',
      type: 'amount',
      condition: {
        field: 'amount',
        operator: 'greater_than',
        value: 30000,
      },
      action: {
        type: 'categorize',
        categoryName: 'Salary',
      },
      priority: 2,
    },
  ],

  providers: {
    belvo: {
      institutionId: 'banamex_mx_retail',
      credentials: {
        username: 'test_user',
        password: 'test_password',
      },
      expectedAccounts: 2,
    },
    plaid: {
      publicToken: 'public-sandbox-b0e2c4ee-a763-4df5-bfe9-46a46bce993d',
      institutionId: 'ins_109508',
      expectedAccounts: 3,
    },
    bitso: {
      apiKey: 'test_api_key_123',
      apiSecret: 'test_api_secret_456',
      expectedAssets: ['BTC', 'ETH', 'MXN'],
    },
  },

  webhooks: {
    belvo: {
      accountsCreated: {
        event_type: 'ACCOUNTS_CREATED',
        link_id: 'test-link-id',
        request_id: 'test-request-id',
        data: {
          accounts: ['account1', 'account2'],
        },
      },
      transactionsCreated: {
        event_type: 'TRANSACTIONS_CREATED',
        link_id: 'test-link-id',
        request_id: 'test-request-id',
        data: {
          account_id: 'account1',
          count: 25,
        },
      },
    },
    plaid: {
      transactionsUpdate: {
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'INITIAL_UPDATE',
        item_id: 'test-item-id',
        account_ids: ['account1', 'account2'],
        new_transactions: 10,
      },
      itemError: {
        webhook_type: 'ITEM',
        webhook_code: 'ERROR',
        item_id: 'test-item-id',
        error: {
          error_type: 'ITEM_ERROR',
          error_code: 'ITEM_LOGIN_REQUIRED',
          error_message: 'User needs to re-authenticate',
        },
      },
    },
  },

  analytics: {
    events: {
      signUp: {
        event: 'sign_up',
        properties: {
          source: 'organic',
          referrer: null,
        },
      },
      onboardingComplete: {
        event: 'onboarding_complete',
        properties: {
          duration: 300000,
          stepsCompleted: 7,
          stepsSkipped: 0,
        },
      },
      connectInitiated: {
        event: 'connect_initiated',
        properties: {
          provider: 'belvo',
          institution: 'banamex_mx_retail',
        },
      },
      budgetCreated: {
        event: 'budget_created',
        properties: {
          period: 'monthly',
          categoriesCount: 7,
          currency: 'MXN',
        },
      },
    },
    userProperties: {
      locale: 'es',
      timezone: 'America/Mexico_City',
      spaces_count: 1,
      accounts_count: 3,
      budgets_count: 1,
      onboarding_completed: true,
    },
  },

  errorScenarios: {
    invalidToken: 'invalid.jwt.token',
    expiredToken:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    malformedRequest: { invalid: 'data', missing: 'required fields' },
    unauthorizedAccess: { spaceId: 'other-users-space-id' },
    nonExistentResource: { id: 'non-existent-id' },
    duplicateResource: { email: 'existing@example.com' },
    validationErrors: {
      shortPassword: 'short',
      invalidEmail: 'not-an-email',
      futureDates: new Date(Date.now() + 86400000 * 365), // 1 year in future
      negativeAmounts: -100,
      invalidCurrency: 'XXX',
    },
  },
};
