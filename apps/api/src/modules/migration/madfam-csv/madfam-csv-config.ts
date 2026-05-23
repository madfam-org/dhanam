/**
 * Operator-configurable routing for MADFAM CSV import.
 *
 * Real RFCs and space slugs must come from environment (or future PlatformConfig),
 * never from the public repository.
 */
export type SpaceRole = 'business' | 'partner' | 'personal';

export interface MadfamCsvRoutingConfig {
  businessRfc: string;
  spaceKeys: Record<SpaceRole, string>;
  /** Suffix on shared personal-bank providerAccountIds. Prod default `-afac`. */
  accountSuffixes: Record<'partner' | 'personal', string>;
}

/** Synthetic values only — safe for unit tests and fixtures. */
export const SYNTHETIC_MADFAM_CSV_ROUTING: MadfamCsvRoutingConfig = {
  businessRfc: 'XAXX010101000',
  spaceKeys: {
    business: 'business-entity',
    partner: 'partner-entity',
    personal: 'personal-entity',
  },
  accountSuffixes: {
    partner: '-partner',
    personal: '-personal',
  },
};

function partnerAccountSuffix(): string {
  const raw = process.env.MADFAM_ACCOUNT_SUFFIX_PARTNER?.trim();
  if (raw) return raw.startsWith('-') ? raw : `-${raw}`;
  // Production continuity: first import used "-afac" on partner-routed accounts.
  return '-afac';
}

function personalAccountSuffix(): string {
  const raw = process.env.MADFAM_ACCOUNT_SUFFIX_PERSONAL?.trim();
  if (raw) return raw.startsWith('-') ? raw : `-${raw}`;
  return '-personal';
}

export function loadMadfamCsvRoutingConfig(): MadfamCsvRoutingConfig {
  const businessRfc = (process.env.MADFAM_BUSINESS_RFC || '').trim().toUpperCase();
  return {
    businessRfc,
    spaceKeys: {
      business: process.env.MADFAM_SPACE_KEY_BUSINESS || 'business',
      partner: process.env.MADFAM_SPACE_KEY_PARTNER || 'partner',
      personal: process.env.MADFAM_SPACE_KEY_PERSONAL || 'personal',
    },
    accountSuffixes: {
      partner: partnerAccountSuffix(),
      personal: personalAccountSuffix(),
    },
  };
}

export function requireMadfamCsvRoutingConfig(): MadfamCsvRoutingConfig {
  const config = loadMadfamCsvRoutingConfig();
  if (!config.businessRfc) {
    throw new Error(
      'MADFAM_BUSINESS_RFC env var is required for CSV import routing. ' +
        'Set it to the business tax ID used in your export (never commit real RFCs to git).'
    );
  }
  return config;
}
