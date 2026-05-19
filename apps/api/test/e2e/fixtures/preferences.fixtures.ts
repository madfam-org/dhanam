export const PreferencesTestData = {
  testUser: {
    email: 'preferences.test@example.com',
    password: 'PreferencesTest123!',
    name: 'Preferences Test User',
    locale: 'es',
    timezone: 'America/Mexico_City',
  },

  defaultUserPreferences: {
    emailNotifications: true,
    transactionAlerts: true,
    budgetAlerts: true,
    weeklyReports: false,
    monthlyReports: true,
    language: 'es',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'es-MX',
    defaultCurrency: 'MXN',
    fiscalYearStart: 1,
    weekStartsOn: 1,
    showCentsInAmounts: true,
    compactDisplay: false,
  },

  updatedUserPreferences: {
    emailNotifications: false,
    transactionAlerts: true,
    budgetAlerts: false,
    weeklyReports: true,
    monthlyReports: false,
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    numberFormat: 'en-US',
    defaultCurrency: 'USD',
    fiscalYearStart: 4,
    weekStartsOn: 0,
    showCentsInAmounts: false,
    compactDisplay: true,
  },

  defaultSpacePreferences: {
    defaultAccountId: null,
    autoCategorizationEnabled: true,
    recurringTransactionDetection: true,
    merchantEnrichment: true,
    categoryLearning: true,
    budgetRollover: false,
    budgetWarningThreshold: 80,
    unusualSpendingAlerts: true,
    billReminders: true,
    billReminderDays: 3,
    exportFormat: 'csv',
    includeAttachmentsInExport: false,
    defaultBudgetPeriod: 'monthly',
    showSubcategories: true,
    consolidateTransfers: true,
    hideReconciled: false,
    defaultTransactionStatus: 'cleared',
  },

  businessSpacePreferences: {
    autoCategorizationEnabled: false,
    recurringTransactionDetection: true,
    merchantEnrichment: true,
    categoryLearning: false,
    budgetRollover: true,
    budgetWarningThreshold: 90,
    unusualSpendingAlerts: true,
    billReminders: true,
    billReminderDays: 7,
    exportFormat: 'xlsx',
    includeAttachmentsInExport: true,
    defaultBudgetPeriod: 'quarterly',
    showSubcategories: true,
    consolidateTransfers: false,
    hideReconciled: true,
    defaultTransactionStatus: 'pending',
  },

  notificationPreferences: {
    email: {
      enabled: true,
      frequency: 'immediate',
      types: ['transaction', 'budget_alert', 'weekly_summary', 'bill_reminder'],
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
    },
    push: {
      enabled: true,
      types: ['transaction', 'budget_alert', 'bill_reminder'],
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '08:00',
      },
    },
    inApp: {
      enabled: true,
      types: ['transaction', 'budget_alert', 'bill_reminder', 'system_update'],
    },
    sms: {
      enabled: false,
      types: [],
    },
  },

  preferenceTemplates: {
    default: {
      id: 'default',
      name: 'Default',
      description: 'Balanced notifications and features for most users',
      preferences: {
        emailNotifications: true,
        transactionAlerts: true,
        budgetAlerts: true,
        weeklyReports: false,
        monthlyReports: true,
        autoCategorizationEnabled: true,
        recurringTransactionDetection: true,
        budgetRollover: false,
        compactDisplay: false,
      },
    },
    minimalist: {
      id: 'minimalist',
      name: 'Minimalist',
      description: 'Minimal notifications, focused on essentials',
      preferences: {
        emailNotifications: false,
        transactionAlerts: false,
        budgetAlerts: true,
        weeklyReports: false,
        monthlyReports: false,
        autoCategorizationEnabled: true,
        recurringTransactionDetection: false,
        budgetRollover: false,
        compactDisplay: true,
      },
    },
    powerUser: {
      id: 'power_user',
      name: 'Power User',
      description: 'All features enabled for maximum control',
      preferences: {
        emailNotifications: true,
        transactionAlerts: true,
        budgetAlerts: true,
        weeklyReports: true,
        monthlyReports: true,
        autoCategorizationEnabled: true,
        recurringTransactionDetection: true,
        budgetRollover: true,
        compactDisplay: false,
      },
    },
  },

  importUserPrefs: {
    language: 'en',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: 'en-US',
    defaultCurrency: 'EUR',
    fiscalYearStart: 4,
    weekStartsOn: 1,
    showCentsInAmounts: true,
    compactDisplay: false,
    emailNotifications: true,
    transactionAlerts: false,
    budgetAlerts: true,
    weeklyReports: true,
    monthlyReports: true,
  },

  importNotificationPrefs: {
    email: {
      enabled: true,
      frequency: 'daily',
      types: ['budget_alert', 'weekly_summary', 'monthly_summary'],
    },
    push: {
      enabled: false,
      types: [],
    },
    inApp: {
      enabled: true,
      types: ['transaction', 'budget_alert', 'system_update'],
    },
  },

  invalidPreferences: {
    invalidCurrency: { defaultCurrency: 'INVALID' },
    invalidLanguage: { language: 'xx' },
    invalidDateFormat: { dateFormat: 'invalid-format' },
    invalidFiscalYear: { fiscalYearStart: 13 },
    invalidWeekStart: { weekStartsOn: 8 },
    invalidThreshold: { budgetWarningThreshold: 150 },
    invalidBillReminder: { billReminderDays: -1 },
    invalidExportFormat: { exportFormat: 'doc' },
    invalidBudgetPeriod: { defaultBudgetPeriod: 'invalid' },
  },

  preferenceHistory: [
    {
      field: 'emailNotifications',
      oldValue: true,
      newValue: false,
      changedAt: new Date(Date.now() - 86400000), // 1 day ago
    },
    {
      field: 'defaultCurrency',
      oldValue: 'MXN',
      newValue: 'USD',
      changedAt: new Date(Date.now() - 172800000), // 2 days ago
    },
    {
      field: 'language',
      oldValue: 'es',
      newValue: 'en',
      changedAt: new Date(Date.now() - 259200000), // 3 days ago
    },
  ],

  currencyPreferences: {
    supported: ['MXN', 'USD', 'EUR', 'CAD', 'GBP', 'JPY', 'BRL', 'ARS'],
    displayFormats: {
      MXN: { symbol: '$', position: 'before', decimal: '.', thousands: ',' },
      USD: { symbol: '$', position: 'before', decimal: '.', thousands: ',' },
      EUR: { symbol: '€', position: 'after', decimal: ',', thousands: '.' },
      GBP: { symbol: '£', position: 'before', decimal: '.', thousands: ',' },
    },
  },

  localePreferences: {
    'es-MX': {
      language: 'es',
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'es-MX',
      defaultCurrency: 'MXN',
      fiscalYearStart: 1,
      weekStartsOn: 1,
    },
    'en-US': {
      language: 'en',
      dateFormat: 'MM/DD/YYYY',
      numberFormat: 'en-US',
      defaultCurrency: 'USD',
      fiscalYearStart: 1,
      weekStartsOn: 0,
    },
    'en-GB': {
      language: 'en',
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'en-GB',
      defaultCurrency: 'GBP',
      fiscalYearStart: 4,
      weekStartsOn: 1,
    },
  },
};
