export interface ESGScore {
  overall: number;
  environmental: number;
  social: number;
  governance: number;
  confidence: number;
  lastUpdated: Date;
  methodology: string;
  sources: string[];
}

export interface ESGMetrics {
  energyIntensity?: number; // kWh per transaction
  carbonIntensity?: number; // gCO2 per transaction
  consensusMechanism: 'pow' | 'pos' | 'dpos' | 'hybrid' | 'other';
  decentralizationScore?: number;
  developerActivity?: number;
  communityEngagement?: number;
  transparencyScore?: number;
  regulatoryCompliance?: number;
}

export interface AssetESGData {
  symbol: string;
  name: string;
  score: ESGScore;
  metrics: ESGMetrics;
  category: 'cryptocurrency' | 'defi' | 'nft' | 'stablecoin';
  marketCap?: number;
  volume24h?: number;
}

export interface PortfolioESGAnalysis {
  weightedScore: ESGScore;
  assetBreakdown: Array<{
    symbol: string;
    weight: number;
    score: ESGScore;
    contribution: number;
  }>;
  insights: {
    topPerformers: string[];
    improvementAreas: string[];
    recommendations: string[];
  };
  trends: {
    scoreHistory: Array<{
      date: Date;
      score: number;
    }>;
    monthOverMonth: number;
    yearOverYear: number;
  };
}

export interface ESGProvider {
  name: string;
  getAssetESG(symbol: string): Promise<AssetESGData | null>;
  getMultipleAssetESG(symbols: string[]): Promise<AssetESGData[]>;
  refreshAssetData(symbol: string): Promise<void>;
}

export interface ESGConfiguration {
  providers: {
    primary: string;
    fallback: string[];
  };
  caching: {
    ttl: number; // Cache TTL in seconds
    maxSize: number; // Max cache entries
  };
  scoring: {
    weights: {
      environmental: number;
      social: number;
      governance: number;
    };
    minimumConfidence: number;
  };
  updates: {
    refreshInterval: number; // Seconds between updates
    batchSize: number; // Assets to update per batch
  };
}
