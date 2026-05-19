export const OnboardingTestData = {
  newUser: {
    email: 'onboarding.test@example.com',
    password: 'DhanamSecureTestPassword_2024!_Unique',
    name: 'Onboarding Test User',
    locale: 'es',
    timezone: 'America/Mexico_City',
  },

  partialUser: {
    email: 'partial.onboarding@example.com',
    password: 'PartialUser123!',
    name: 'Partial Onboarding User',
  },

  preferences: {
    locale: 'en',
    timezone: 'America/New_York',
    currency: 'USD',
    emailNotifications: true,
    transactionAlerts: true,
    budgetAlerts: true,
    weeklyReports: false,
    monthlyReports: true,
  },

  personalSpace: {
    name: 'Personal Finance',
    type: 'personal',
    currency: 'USD',
    timezone: 'America/New_York',
  },

  businessSpace: {
    name: 'Business Operations',
    type: 'business',
    currency: 'USD',
    timezone: 'America/New_York',
  },

  minimalSpace: {
    name: 'My Space',
    type: 'personal',
    currency: 'MXN',
    timezone: 'America/Mexico_City',
  },

  firstBudget: {
    name: 'Monthly Budget',
    period: 'monthly',
    currency: 'USD',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    categories: [
      {
        name: 'Housing',
        type: 'expense',
        limit: 2000,
        icon: 'home',
        color: '#4A90E2',
      },
      {
        name: 'Food & Dining',
        type: 'expense',
        limit: 800,
        icon: 'restaurant',
        color: '#F5A623',
      },
      {
        name: 'Transportation',
        type: 'expense',
        limit: 500,
        icon: 'car',
        color: '#7ED321',
      },
      {
        name: 'Utilities',
        type: 'expense',
        limit: 300,
        icon: 'bolt',
        color: '#BD10E0',
      },
      {
        name: 'Entertainment',
        type: 'expense',
        limit: 400,
        icon: 'movie',
        color: '#F8E71C',
      },
      {
        name: 'Salary',
        type: 'income',
        limit: 0,
        icon: 'money',
        color: '#50E3C2',
      },
    ],
  },

  providerConnections: {
    belvo: {
      provider: 'belvo',
      institutionId: 'banamex_mx_retail',
      credentials: {
        username: 'test_user',
        password: 'test_password',
      },
    },
    plaid: {
      provider: 'plaid',
      publicToken: 'public-sandbox-token',
      institutionId: 'ins_109508',
    },
    bitso: {
      provider: 'bitso',
      apiKey: 'test_api_key',
      apiSecret: 'test_api_secret',
    },
  },

  mockAccounts: [
    {
      provider: 'belvo',
      providerAccountId: 'belvo_checking_123',
      name: 'Banamex Checking',
      type: 'checking',
      subtype: 'checking',
      currency: 'MXN',
      balance: 25000,
    },
    {
      provider: 'belvo',
      providerAccountId: 'belvo_savings_456',
      name: 'Banamex Savings',
      type: 'checking',
      subtype: 'savings',
      currency: 'MXN',
      balance: 100000,
    },
    {
      provider: 'plaid',
      providerAccountId: 'plaid_checking_789',
      name: 'Chase Checking',
      type: 'checking',
      subtype: 'checking',
      currency: 'USD',
      balance: 5000,
    },
    {
      provider: 'bitso',
      providerAccountId: 'bitso_btc',
      name: 'Bitcoin Wallet',
      type: 'crypto',
      subtype: 'wallet',
      currency: 'BTC',
      balance: 0.5,
    },
  ],

  emailVerificationScenarios: {
    validToken: {
      userId: 'test-user-id',
      email: 'test@example.com',
      type: 'email_verification',
    },
    expiredToken: {
      userId: 'test-user-id',
      email: 'test@example.com',
      type: 'email_verification',
      expiresIn: '-1s',
    },
    invalidType: {
      userId: 'test-user-id',
      email: 'test@example.com',
      type: 'password_reset',
    },
    mismatchedEmail: {
      userId: 'test-user-id',
      email: 'different@example.com',
      type: 'email_verification',
    },
  },

  stepProgressionData: {
    welcome: {
      data: {
        source: 'direct',
        referrer: null,
      },
    },
    email_verification: {
      data: {
        remindersSent: 0,
      },
    },
    preferences: {
      data: {
        selectedTemplate: 'custom',
        changedFromDefaults: true,
      },
    },
    space_setup: {
      data: {
        spacesCreated: 1,
        primarySpaceType: 'personal',
      },
    },
    connect_accounts: {
      data: {
        providersConnected: ['belvo'],
        accountsLinked: 2,
        manualAccountsCreated: 0,
      },
    },
    first_budget: {
      data: {
        budgetType: 'monthly',
        categoriesCreated: 6,
        rulesCreated: 0,
      },
    },
    feature_tour: {
      data: {
        tourCompleted: true,
        stepsViewed: 10,
        timeSpent: 180000, // 3 minutes
      },
    },
  },

  onboardingMetrics: {
    timePerStep: {
      welcome: 10000,
      email_verification: 120000,
      preferences: 45000,
      space_setup: 60000,
      connect_accounts: 180000,
      first_budget: 120000,
      feature_tour: 180000,
    },
    dropoffRates: {
      welcome: 0.05,
      email_verification: 0.15,
      preferences: 0.1,
      space_setup: 0.08,
      connect_accounts: 0.25,
      first_budget: 0.12,
      feature_tour: 0.2,
    },
  },
};
