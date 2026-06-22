import { MXN_IVA_RATE, mxnGrossMajorFromNetCentavos } from '@dhanam/shared';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '@core/prisma/prisma.service';

import { CatalogProduct, ProductCatalogService } from './product-catalog.service';

interface RegionalPrice {
  monthlyPrice: number;
  monthlyPriceNet: number | null;
  monthlyPriceGross: number | null;
  promoPrice: number | null;
  currency: string;
  ivaRate: number | null;
  priceDisplayMode: 'iva_inclusive_ceil' | 'list';
}

interface PricingTier {
  id: string;
  name: string;
  monthlyPrice: number;
  monthlyPriceNet: number | null;
  monthlyPriceGross: number | null;
  promoPrice: number | null;
  currency: string;
  ivaRate: number | null;
  priceDisplayMode: 'iva_inclusive_ceil' | 'list';
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

// Currency mapping by country
const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD',
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

const DHANAM_PRODUCT_SLUG = 'dhanam';
type DhanamTierSlug = 'essentials' | 'pro' | 'premium';

@Injectable()
export class PricingEngineService {
  private readonly logger = new Logger(PricingEngineService.name);

  constructor(
    private prisma: PrismaService,
    private catalog: ProductCatalogService
  ) {}

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
    const currency = region?.currency ?? staticDefaults.currency;
    const catalogCurrency = currency === 'MXN' ? 'MXN' : 'USD';

    return this.getCatalogPrices(catalogCurrency);
  }

  private async getCatalogProduct(): Promise<CatalogProduct> {
    try {
      return await this.catalog.getProductBySlug(DHANAM_PRODUCT_SLUG);
    } catch (error) {
      this.logger.error('Dhanam product catalog is unavailable for regional pricing', error);
      throw new ServiceUnavailableException(
        'Dhanam product catalog is unavailable; refusing to serve static fallback prices'
      );
    }
  }

  private async getCatalogPrices(currency: string): Promise<{
    essentials: RegionalPrice;
    pro: RegionalPrice;
    premium: RegionalPrice;
  }> {
    const product = await this.getCatalogProduct();
    const byTier = new Map(product.tiers.map((tier) => [tier.tierSlug, tier]));

    const resolveTier = (tierSlug: DhanamTierSlug): RegionalPrice => {
      const tier = byTier.get(tierSlug);
      const price = tier?.prices[currency] ?? tier?.prices.USD;
      const priceCurrency = tier?.prices[currency]?.monthly ? currency : 'USD';
      const monthlyCents = price?.monthly;
      if (!tier || monthlyCents === null || monthlyCents === undefined) {
        throw new ServiceUnavailableException(
          `Dhanam catalog is missing ${currency} monthly price for ${tierSlug}`
        );
      }

      if (priceCurrency === 'MXN') {
        const netMajor = monthlyCents / 100;
        const grossMajor = mxnGrossMajorFromNetCentavos(monthlyCents);
        return {
          monthlyPrice: grossMajor,
          monthlyPriceNet: netMajor,
          monthlyPriceGross: grossMajor,
          promoPrice: null,
          currency: priceCurrency,
          ivaRate: MXN_IVA_RATE,
          priceDisplayMode: 'iva_inclusive_ceil',
        };
      }

      const listMajor = monthlyCents / 100;
      return {
        monthlyPrice: listMajor,
        monthlyPriceNet: null,
        monthlyPriceGross: null,
        promoPrice: null,
        currency: priceCurrency,
        ivaRate: null,
        priceDisplayMode: 'list',
      };
    };

    return {
      essentials: resolveTier('essentials'),
      pro: resolveTier('pro'),
      premium: resolveTier('premium'),
    };
  }

  /**
   * Get full pricing response for a country code.
   */
  async getPricingForCountry(countryCode: string): Promise<PricingResponse> {
    const code = countryCode.toUpperCase();
    const regionNumber = await this.getRegionForCountry(code);
    const preferredCurrency = COUNTRY_CURRENCY[code] ?? 'USD';
    const prices = await this.getCatalogPrices(preferredCurrency);

    const regionNames = ['tier1', 'tier2', 'latam', 'emerging'];
    const regionName = regionNames[regionNumber - 1] || 'tier1';

    const displayCurrency = prices.essentials.currency;
    const product = await this.getCatalogProduct();
    const catalogTier = new Map(product.tiers.map((tier) => [tier.tierSlug, tier]));

    const buildTier = (id: string, name: string, price: RegionalPrice): PricingTier => ({
      id,
      name,
      monthlyPrice: price.monthlyPrice,
      monthlyPriceNet: price.monthlyPriceNet,
      monthlyPriceGross: price.monthlyPriceGross,
      promoPrice: price.promoPrice,
      currency: price.currency,
      ivaRate: price.ivaRate,
      priceDisplayMode: price.priceDisplayMode,
      features: catalogTier.get(id)?.features ?? [],
    });

    return {
      region: regionNumber,
      regionName,
      currency: displayCurrency,
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
