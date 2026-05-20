import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '@core/prisma/prisma.service';

interface RegionalPrice {
  monthlyPrice: number;
  promoPrice: number | null;
  currency: string;
}

interface PricingTier {
  id: string;
  name: string;
  monthlyPrice: number;
  promoPrice: number | null;
  currency: string;
  features: string[];
}

export interface PricingResponse {
  region: number;
  regionName: string;
  currency: string;
  tiers: PricingTier[];
  trial: {
    daysWithoutCC: number;
    daysWithCC: number;
    promoMonths: number;
  };
}

// Base USD prices (Tier 1)
const BASE_PRICES = {
  essentials: 4.99,
  pro: 11.99,
  premium: 19.99,
};

// Mexico promo override prices (MXN)
const MX_PROMO_PRICES: Record<string, number> = {
  essentials: 31,
  pro: 32,
  premium: 33,
};

// Currency mapping by country
const COUNTRY_CURRENCY: Record<string, string> = {
  MX: 'MXN',
  BR: 'BRL',
  CO: 'COP',
  AR: 'ARS',
  CL: 'CLP',
  PE: 'PEN',
  GB: 'GBP',
  JP: 'JPY',
  KR: 'KRW',
  IN: 'INR',
  AU: 'AUD',
  NZ: 'NZD',
  CH: 'CHF',
  SE: 'SEK',
  DK: 'DKK',
  NO: 'NOK',
};

const STATIC_COUNTRY_REGION: Record<string, number> = {
  US: 1,
  CA: 1,
  GB: 1,
  AU: 1,
  NZ: 1,
  JP: 1,
  KR: 1,
  CH: 1,
  SE: 1,
  DK: 1,
  NO: 1,
  MX: 3,
  BR: 3,
  CO: 3,
  AR: 3,
  CL: 3,
  PE: 3,
  IN: 4,
};

const STATIC_REGION_DEFAULTS: Record<string, { discount: number; currency: string }> = {
  tier1: { discount: 0, currency: 'USD' },
  tier2: { discount: 0.25, currency: 'USD' },
  latam: { discount: 0.45, currency: 'USD' },
  emerging: { discount: 0.65, currency: 'USD' },
};

const TIER_FEATURES: Record<string, string[]> = {
  essentials: [
    'AI transaction categorization',
    'Bank sync (Belvo + Bitso)',
    '2 financial spaces',
    '10 simulations/day',
    '60-day cashflow forecast',
    'ESG crypto scoring',
    '500 MB document storage',
  ],
  pro: [
    'Everything in Essentials, plus:',
    'Unlimited provider connections',
    'Unlimited simulations',
    '5 financial spaces',
    'Estate planning & Life Beat',
    'Household views',
    'Collectibles valuation',
    '5 GB storage',
    'Priority support',
  ],
  premium: [
    'Everything in Pro, plus:',
    '10 financial spaces',
    '50,000 Monte Carlo iterations',
    '24 stress scenarios',
    '25 GB storage',
    'Dedicated priority support',
    'Advanced analytics',
  ],
};

@Injectable()
export class PricingEngineService {
  private readonly logger = new Logger(PricingEngineService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get the pricing region number for a country code.
   * Falls back to tier1 (region 1) if not found.
   */
  async getRegionForCountry(countryCode: string): Promise<number> {
    const code = countryCode.toUpperCase();

    const region = await this.prisma.pricingRegion.findFirst({
      where: { countries: { has: code } },
    });

    // Map name to region number
    const regionMap: Record<string, number> = {
      tier1: 1,
      tier2: 2,
      latam: 3,
      emerging: 4,
    };

    if (region) {
      return regionMap[region.name] ?? 1;
    }

    return STATIC_COUNTRY_REGION[code] ?? 1;
  }

  /**
   * Get prices for a specific region.
   */
  async getPricesForRegion(regionNumber: number): Promise<{
    essentials: RegionalPrice;
    pro: RegionalPrice;
    premium: RegionalPrice;
  }> {
    const regionNames = ['tier1', 'tier2', 'latam', 'emerging'];
    const regionName = regionNames[regionNumber - 1] || 'tier1';

    const region = await this.prisma.pricingRegion.findUnique({
      where: { name: regionName },
    });

    const staticDefaults = STATIC_REGION_DEFAULTS[regionName] ?? STATIC_REGION_DEFAULTS.tier1;
    const discount = region?.discount ?? staticDefaults.discount;
    const currency = region?.currency ?? staticDefaults.currency;

    const applyDiscount = (base: number): number => Math.round(base * (1 - discount) * 100) / 100;

    return {
      essentials: {
        monthlyPrice: applyDiscount(BASE_PRICES.essentials),
        promoPrice: null,
        currency,
      },
      pro: {
        monthlyPrice: applyDiscount(BASE_PRICES.pro),
        promoPrice: null,
        currency,
      },
      premium: {
        monthlyPrice: applyDiscount(BASE_PRICES.premium),
        promoPrice: null,
        currency,
      },
    };
  }

  /**
   * Get full pricing response for a country code.
   */
  async getPricingForCountry(countryCode: string): Promise<PricingResponse> {
    const code = countryCode.toUpperCase();
    const regionNumber = await this.getRegionForCountry(code);
    const prices = await this.getPricesForRegion(regionNumber);

    const regionNames = ['tier1', 'tier2', 'latam', 'emerging'];
    const regionName = regionNames[regionNumber - 1] || 'tier1';

    // Apply Mexico promo overrides
    const isMexico = code === 'MX';
    const displayCurrency = COUNTRY_CURRENCY[code] || prices.essentials.currency;

    const buildTier = (id: string, name: string, price: RegionalPrice): PricingTier => ({
      id,
      name,
      monthlyPrice: price.monthlyPrice,
      promoPrice: isMexico ? (MX_PROMO_PRICES[id] ?? null) : price.promoPrice,
      currency: isMexico ? 'MXN' : displayCurrency,
      features: TIER_FEATURES[id] || [],
    });

    return {
      region: regionNumber,
      regionName,
      currency: isMexico ? 'MXN' : displayCurrency,
      tiers: [
        buildTier('essentials', 'Essentials', prices.essentials),
        buildTier('pro', 'Pro', prices.pro),
        buildTier('premium', 'Premium', prices.premium),
      ],
      trial: {
        daysWithoutCC: 3,
        daysWithCC: 21,
        promoMonths: 3,
      },
    };
  }
}
