/**
 * Types and helpers for MADFAM checkout fee-aware routing.
 * Live schedule data: payment-route-fee-schedule.json (+ optional platform_config override).
 */

export type PaymentInstrumentId =
  | 'card'
  | 'spei'
  | 'customer_balance'
  | 'oxxo'
  | 'oxxo_cash'
  | 'paypal'
  | 'apple_pay'
  | 'google_pay';

export type RoutableCheckoutProvider = 'stripe_mx' | 'paddle' | 'legacy_stripe' | 'conekta';

export interface FeeScheduleEntry {
  provider: RoutableCheckoutProvider;
  paymentMethod: PaymentInstrumentId;
  currency: string;
  percentBps: number;
  fixedMinor: number;
  customerFxBps: number;
  label: string;
  countries: string[] | '*';
}

export interface FeeScheduleFile {
  version: string;
  source?: string;
  entries: FeeScheduleEntry[];
}

const VALID_PROVIDERS = new Set<RoutableCheckoutProvider>([
  'stripe_mx',
  'paddle',
  'legacy_stripe',
  'conekta',
]);

const VALID_METHODS = new Set<PaymentInstrumentId>([
  'card',
  'spei',
  'customer_balance',
  'oxxo',
  'oxxo_cash',
  'paypal',
  'apple_pay',
  'google_pay',
]);

export function parseFeeScheduleEntries(raw: unknown): FeeScheduleEntry[] {
  if (!Array.isArray(raw)) {
    throw new Error('Fee schedule entries must be an array');
  }

  return raw.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Fee schedule entry ${index} must be an object`);
    }
    const row = item as Record<string, unknown>;
    const provider = row.provider as RoutableCheckoutProvider;
    const paymentMethod = row.paymentMethod as PaymentInstrumentId;

    if (!VALID_PROVIDERS.has(provider)) {
      throw new Error(`Invalid provider at entry ${index}: ${String(row.provider)}`);
    }
    if (!VALID_METHODS.has(paymentMethod)) {
      throw new Error(`Invalid paymentMethod at entry ${index}: ${String(row.paymentMethod)}`);
    }

    return {
      provider,
      paymentMethod,
      currency: String(row.currency).toUpperCase(),
      percentBps: Number(row.percentBps),
      fixedMinor: Number(row.fixedMinor),
      customerFxBps: Number(row.customerFxBps ?? 0),
      label: String(row.label),
      countries: row.countries === '*' ? '*' : (row.countries as string[]),
    };
  });
}

export function validateFeeScheduleEntries(entries: FeeScheduleEntry[]): void {
  if (entries.length === 0) {
    throw new Error('Fee schedule must contain at least one entry');
  }

  for (const [index, entry] of entries.entries()) {
    if (!entry.currency || entry.currency.length !== 3) {
      throw new Error(`Entry ${index}: currency must be a 3-letter ISO code`);
    }
    if (!Number.isFinite(entry.percentBps) || entry.percentBps < 0) {
      throw new Error(`Entry ${index}: percentBps must be a non-negative number`);
    }
    if (!Number.isFinite(entry.fixedMinor) || entry.fixedMinor < 0) {
      throw new Error(`Entry ${index}: fixedMinor must be a non-negative number`);
    }
    if (
      entry.countries !== '*' &&
      (!Array.isArray(entry.countries) || entry.countries.length === 0)
    ) {
      throw new Error(`Entry ${index}: countries must be "*" or a non-empty array`);
    }
  }
}

export function estimateProcessingFeeMinor(
  amountMinor: number,
  entry: FeeScheduleEntry
): { merchantFeeMinor: number; customerFxCostMinor: number; totalEconomicCostMinor: number } {
  const merchantFeeMinor = Math.round((amountMinor * entry.percentBps) / 10_000) + entry.fixedMinor;
  const customerFxCostMinor = Math.round((amountMinor * entry.customerFxBps) / 10_000);
  return {
    merchantFeeMinor,
    customerFxCostMinor,
    totalEconomicCostMinor: merchantFeeMinor + customerFxCostMinor,
  };
}

export function scheduleAppliesToCountry(entry: FeeScheduleEntry, countryCode: string): boolean {
  if (entry.countries === '*') {
    return true;
  }
  return entry.countries.includes(countryCode.toUpperCase());
}
