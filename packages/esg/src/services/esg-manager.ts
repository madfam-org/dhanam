import {
  ESGProvider,
  AssetESGData,
  PortfolioESGAnalysis,
  ESGConfiguration,
} from '../types/esg.types';
import { PortfolioESGAnalyzer, PortfolioHolding } from './portfolio-analyzer';
import { DhanamESGProvider } from '../providers/dhanam-provider';

export class ESGManager {
  private readonly providers = new Map<string, ESGProvider>();
  private readonly cache = new Map<string, AssetESGData>();
  private readonly config: ESGConfiguration;

  constructor(config?: Partial<ESGConfiguration>) {
    this.config = {
      providers: {
        primary: 'dhanam',
        fallback: [],
      },
      caching: {
        ttl: 3600, // 1 hour
        maxSize: 1000,
      },
      scoring: {
        weights: {
          environmental: 0.4,
          social: 0.3,
          governance: 0.3,
        },
        minimumConfidence: 50,
      },
      updates: {
        refreshInterval: 3600, // 1 hour
        batchSize: 10,
      },
      ...config,
    };

    // Initialize default providers
    this.registerProvider(new DhanamESGProvider());
  }

  registerProvider(provider: ESGProvider): void {
    this.providers.set(provider.name.toLowerCase(), provider);
  }

  async getAssetESG(symbol: string): Promise<AssetESGData | null> {
    const cacheKey = symbol.toUpperCase();

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      const age = Date.now() - cached.score.lastUpdated.getTime();

      if (age < this.config.caching.ttl * 1000) {
        return cached;
      }
    }

    // Try primary provider
    const primaryProvider = this.providers.get(this.config.providers.primary);
    if (primaryProvider) {
      try {
        const data = await primaryProvider.getAssetESG(symbol);
        if (data && data.score.confidence >= this.config.scoring.minimumConfidence) {
          this.cacheAsset(data);
          return data;
        }
      } catch (error) {
        console.warn('Primary ESG provider failed', { symbol, error: (error as Error).message });
      }
    }

    // Try fallback providers
    for (const fallbackName of this.config.providers.fallback) {
      const provider = this.providers.get(fallbackName);
      if (provider) {
        try {
          const data = await provider.getAssetESG(symbol);
          if (data) {
            this.cacheAsset(data);
            return data;
          }
        } catch (error) {
          console.warn('Fallback ESG provider failed', {
            provider: fallbackName,
            symbol,
            error: (error as Error).message,
          });
        }
      }
    }

    return null;
  }

  async getMultipleAssetESG(symbols: string[]): Promise<AssetESGData[]> {
    const batchSize = this.config.updates.batchSize;
    const results: AssetESGData[] = [];

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((symbol) => this.getAssetESG(symbol))
      );

      const validResults = batchResults
        .filter(
          (result): result is PromiseFulfilledResult<AssetESGData> =>
            result.status === 'fulfilled' &&
            result.value != null &&
            typeof result.value === 'object' &&
            'score' in result.value
        )
        .map((result) => result.value);

      results.push(...validResults);

      // Add small delay between batches to avoid rate limiting
      if (i + batchSize < symbols.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  async analyzePortfolio(holdings: PortfolioHolding[]): Promise<PortfolioESGAnalysis> {
    const symbols = [...new Set(holdings.map((h) => h.symbol.toUpperCase()))];
    const esgData = await this.getMultipleAssetESG(symbols);

    const esgMap = new Map<string, AssetESGData>();
    esgData.forEach((data) => {
      esgMap.set(data.symbol, data);
    });

    const analyzer = new PortfolioESGAnalyzer(esgMap);
    return analyzer.analyzePortfolio(holdings);
  }

  async refreshAssetData(symbols: string[]): Promise<void> {
    // Clear cache for specified symbols
    symbols.forEach((symbol) => {
      this.cache.delete(symbol.toUpperCase());
    });

    // Refresh data in background
    await this.getMultipleAssetESG(symbols);
  }

  private cacheAsset(data: AssetESGData): void {
    // Implement LRU cache behavior
    if (this.cache.size >= this.config.caching.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(data.symbol, data);
  }

  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.caching.maxSize,
    };
  }

  clearCache(): void {
    this.cache.clear();
  }

  updateConfiguration(newConfig: Partial<ESGConfiguration>): void {
    Object.assign(this.config, newConfig);
  }

  getConfiguration(): ESGConfiguration {
    return { ...this.config };
  }
}
