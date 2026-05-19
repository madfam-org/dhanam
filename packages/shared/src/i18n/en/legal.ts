/**
 * English Legal Page Translations
 * Privacy policy, terms, security, cookies, ESG methodology
 */
export const legal = {
  // Common
  lastUpdated: 'Last updated: {{date}}',
  tableOfContents: 'Table of Contents',
  backToHome: 'Back to Home',
  effectiveDate: 'Effective Date',
  contactUs: 'Contact Us',
  questionsContact: 'If you have questions about this document, contact us at',

  // Privacy Policy
  privacyTitle: 'Privacy Policy',
  privacySubtitle: 'Aviso de Privacidad',
  privacyIntro:
    'This Privacy Policy describes how Dhanam ("we", "our", or "us") collects, uses, and protects your personal information in compliance with the Mexican Federal Law on Protection of Personal Data Held by Private Parties (LFPDPPP).',
  privacySections: {
    dataController: 'Data Controller',
    dataControllerContent:
      '[LEGAL COUNSEL TO PROVIDE — Company name, RFC, address, contact email for data privacy officer]',
    dataCollected: 'Personal Data Collected',
    dataCollectedContent:
      '[LEGAL COUNSEL TO PROVIDE — Categories: identity data, financial data, device data, usage analytics]',
    purposes: 'Purposes of Data Processing',
    purposesContent:
      '[LEGAL COUNSEL TO PROVIDE — Primary purposes: account management, financial aggregation, analytics. Secondary purposes: marketing, product improvement]',
    legalBasis: 'Legal Basis',
    legalBasisContent:
      '[LEGAL COUNSEL TO PROVIDE — Consent, contract performance, legitimate interest]',
    arcoRights: 'ARCO Rights',
    arcoRightsContent:
      '[LEGAL COUNSEL TO PROVIDE — Access, Rectification, Cancellation, Opposition rights per LFPDPPP Articles 28-35. Process for exercising rights, response timeline (20 business days)]',
    dataTransfers: 'International Data Transfers',
    dataTransfersContent:
      '[LEGAL COUNSEL TO PROVIDE — Transfers to service providers (PostHog, Sentry, cloud infrastructure), adequacy measures, consent requirements]',
    retention: 'Data Retention',
    retentionContent:
      '[LEGAL COUNSEL TO PROVIDE — Retention periods by data category, deletion procedures, legal hold obligations]',
    security: 'Security Measures',
    securityContent:
      'We implement industry-standard security measures including AES-256-GCM encryption for sensitive data at rest, TLS 1.3 for data in transit, and regular security assessments.',
    cookies: 'Cookies and Tracking',
    cookiesContent:
      'For details on our use of cookies and tracking technologies, please see our Cookie Policy.',
    changes: 'Changes to This Policy',
    changesContent:
      '[LEGAL COUNSEL TO PROVIDE — Notification procedures for material changes, consent renewal requirements]',
    contact: 'Contact Information',
    contactContent:
      '[LEGAL COUNSEL TO PROVIDE — Privacy officer contact, physical address, email, phone]',
  },

  // Terms of Service
  termsTitle: 'Terms of Service',
  termsSubtitle: 'Terms and Conditions of Use',
  termsIntro:
    'These Terms of Service ("Terms") govern your access to and use of the Dhanam application and services. By creating an account, you agree to be bound by these Terms.',
  termsSections: {
    acceptance: 'Acceptance of Terms',
    acceptanceContent:
      '[LEGAL COUNSEL TO PROVIDE — Binding agreement upon registration, age requirements (18+), capacity to enter contracts]',
    serviceDescription: 'Service Description',
    serviceDescriptionContent:
      'Dhanam provides financial management tools including budgeting, wealth tracking, and portfolio analytics. Dhanam is an information tool only and does not provide financial advice, investment recommendations, or custody of assets.',
    accounts: 'User Accounts',
    accountsContent:
      '[LEGAL COUNSEL TO PROVIDE — Account creation, security responsibilities, prohibited sharing, account termination]',
    subscriptions: 'Subscriptions and Billing',
    subscriptionsContent:
      '[LEGAL COUNSEL TO PROVIDE — Free and paid tiers, billing cycles, payment methods (Stripe MX for Mexico, Paddle for international), cancellation, refund policy]',
    financialDisclaimer: 'Financial Disclaimer',
    financialDisclaimerContent:
      'Dhanam is not a financial advisor, broker, or dealer. Information provided through the service is for informational purposes only and should not be considered financial advice. Always consult a qualified financial professional before making investment decisions.',
    intellectualProperty: 'Intellectual Property',
    intellectualPropertyContent:
      '[LEGAL COUNSEL TO PROVIDE — Ownership of service, user content license, trademark usage]',
    userConduct: 'Acceptable Use',
    userConductContent:
      '[LEGAL COUNSEL TO PROVIDE — Prohibited activities, data scraping, reverse engineering, unauthorized access]',
    thirdPartyServices: 'Third-Party Services',
    thirdPartyServicesContent:
      'Dhanam integrates with third-party financial data providers (Belvo, Plaid, Bitso, and others). Your use of these integrations is subject to their respective terms of service and privacy policies.',
    liability: 'Limitation of Liability',
    liabilityContent:
      '[LEGAL COUNSEL TO PROVIDE — Disclaimer of warranties, limitation of damages, force majeure, data accuracy disclaimers]',
    jurisdiction: 'Governing Law and Jurisdiction',
    jurisdictionContent:
      '[LEGAL COUNSEL TO PROVIDE — Governed by laws of Mexico, jurisdiction of Mexico City courts, dispute resolution process]',
    termination: 'Termination',
    terminationContent:
      '[LEGAL COUNSEL TO PROVIDE — User termination rights, our termination rights, effects of termination, data export]',
    changes: 'Changes to Terms',
    changesContent:
      '[LEGAL COUNSEL TO PROVIDE — Notification procedures, continued use constitutes acceptance, material change handling]',
  },

  // Security Page
  securityTitle: 'Security',
  securitySubtitle: 'How we protect your financial data',
  securityIntro:
    'The security of your financial data is our highest priority. This page describes the measures we take to protect your information.',
  securitySections: {
    overview: 'Security Overview',
    overviewContent:
      'Dhanam employs multiple layers of security to protect your data, following industry best practices and regulatory requirements.',
    encryption: 'Encryption',
    encryptionContent:
      'All sensitive data is encrypted at rest using AES-256-GCM. Data in transit is protected with TLS 1.3. Provider credentials and tokens are encrypted with application-level encryption before database storage.',
    authentication: 'Authentication',
    authenticationContent:
      'Dhanam uses Janua SSO (MADFAM ecosystem) for authentication with support for TOTP-based two-factor authentication. JWT tokens have short expiration (15 minutes) with rotating refresh tokens (30 days maximum).',
    infrastructure: 'Infrastructure',
    infrastructureContent:
      'Our infrastructure runs on Kubernetes with network policies, pod security contexts (non-root, read-only filesystem, dropped capabilities), and regular security updates.',
    monitoring: 'Monitoring',
    monitoringContent:
      'We use continuous monitoring with Prometheus, Grafana, and Alertmanager for real-time security event detection and response.',
    dataAccess: 'Data Access',
    dataAccessContent:
      'Financial data integrations are read-only. We never store your banking passwords. Provider connections use OAuth or API tokens with minimum required permissions.',
    responsibleDisclosure: 'Responsible Disclosure',
    responsibleDisclosureContent:
      'If you discover a security vulnerability, please report it to security@dhanam.com. We ask that you give us reasonable time to address the issue before public disclosure.',
    responsibleDisclosureSteps: {
      email: 'Email security@dhanam.com with details of the vulnerability',
      include: 'Include steps to reproduce the issue',
      timeline: 'Allow 90 days for remediation before public disclosure',
      scope: 'In-scope: *.dhan.am, *.dhanam.com, mobile apps',
    },
    compliance: 'Compliance',
    complianceContent:
      '[LEGAL COUNSEL TO PROVIDE — LFPDPPP compliance status, SOC 2 plans, PCI DSS applicability assessment]',
  },

  // Cookie Policy
  cookiesTitle: 'Cookie Policy',
  cookiesSubtitle: 'How we use cookies and similar technologies',
  cookiesIntro:
    'This Cookie Policy explains how Dhanam uses cookies and similar tracking technologies when you visit our website.',
  cookiesSections: {
    whatAreCookies: 'What Are Cookies',
    whatAreCookiesContent:
      'Cookies are small text files stored on your device when you visit a website. They help the website remember your preferences and improve your experience.',
    cookiesWeUse: 'Cookies We Use',
    essential: 'Essential Cookies',
    essentialContent:
      'Required for the application to function. These include session cookies, authentication tokens, and CSRF protection. Cannot be disabled.',
    essentialExamples: 'dhanam_locale (language preference), session tokens, CSRF tokens',
    analytics: 'Analytics Cookies',
    analyticsContent:
      'Help us understand how visitors use our application. We use PostHog for analytics. These are only enabled with your consent.',
    analyticsExamples: 'PostHog tracking cookies',
    preferences: 'Preference Cookies',
    preferencesContent:
      'Remember your settings such as theme (light/dark mode) and language preference.',
    preferencesExamples: 'dhanam_locale, theme preference',
    consentMechanism: 'Your Cookie Choices',
    consentMechanismContent:
      'When you first visit Dhanam, a cookie consent banner will appear. You can accept or reject analytics cookies. Your choice is stored in the dhanam_consent cookie for one year. You can change your preference at any time by clearing your cookies and revisiting the site.',
    thirdParty: 'Third-Party Cookies',
    thirdPartyContent:
      '[LEGAL COUNSEL TO PROVIDE — List of third-party services that may set cookies: PostHog, Sentry, payment processors]',
    managing: 'Managing Cookies',
    managingContent:
      'You can control cookies through your browser settings. Note that disabling essential cookies may prevent the application from functioning correctly.',
    changes: 'Changes to This Policy',
    changesContent:
      'We may update this Cookie Policy from time to time. Changes will be posted on this page.',
  },

  // ESG Methodology
  esgTitle: 'ESG Methodology',
  esgSubtitle: 'How we score crypto assets for Environmental, Social, and Governance factors',
  esgIntro:
    'Dhanam provides ESG (Environmental, Social, and Governance) scores for cryptocurrency assets to help users make informed investment decisions.',
  esgSections: {
    overview: 'Methodology Overview',
    overviewContent:
      'Our ESG scoring system evaluates crypto assets across three dimensions: Environmental impact (energy consumption, consensus mechanism), Social factors (community governance, accessibility), and Governance (transparency, token distribution).',
    sources: 'Data Sources',
    sourcesContent:
      'ESG scores are computed using the open-source Dhanam package, which aggregates data from public blockchain metrics, project documentation, and third-party research.',
    environmental: 'Environmental (E) Score',
    environmentalContent:
      'Evaluates energy intensity of the consensus mechanism, carbon footprint estimates, and environmental sustainability initiatives.',
    social: 'Social (S) Score',
    socialContent:
      'Assesses community participation, developer ecosystem, inclusivity, and social impact programs.',
    governance: 'Governance (G) Score',
    governanceContent:
      'Evaluates token distribution fairness, governance mechanisms, regulatory compliance, and organizational transparency.',
    composite: 'Composite Score',
    compositeContent:
      'The composite ESG score is a weighted average of E, S, and G components. Each component is scored on a scale from 0 to 100.',
    limitations: 'Limitations and Disclaimers',
    limitationsContent:
      'ESG scores are estimates based on available data and should not be the sole basis for investment decisions. Methodology and data sources are subject to change. Scores may not capture all relevant factors.',
    updates: 'Score Updates',
    updatesContent:
      'ESG scores are refreshed periodically as new data becomes available and methodology is refined.',
  },

  // Status Page
  statusTitle: 'System Status',
  statusSubtitle: 'Current operational status of Dhanam services',
  statusDescription: 'For real-time system status and incident history, visit our status page.',
  statusRedirect: 'Go to Status Page',

  // Documentation
  docsTitle: 'Documentation',
  docsSubtitle: 'Developer and user documentation',
  docsDescription: 'Explore our documentation for guides, API references, and integration details.',
  docsRedirect: 'View Documentation',
} as const;
