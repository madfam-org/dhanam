import { AssetESGData, PortfolioESGAnalysis, ESGScore } from '../types/esg.types';

export interface PortfolioHolding {
  symbol: string;
  value: number;
  quantity: number;
}

export class PortfolioESGAnalyzer {
  constructor(private readonly esgData: Map<string, AssetESGData>) {}

  analyzePortfolio(holdings: PortfolioHolding[]): PortfolioESGAnalysis {
    const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);

    if (totalValue === 0) {
      return this.getEmptyAnalysis();
    }

    const assetBreakdown = holdings
      .map((holding) => {
        const esgData = this.esgData.get(holding.symbol.toUpperCase());
        const weight = holding.value / totalValue;

        return {
          symbol: holding.symbol,
          weight,
          score: esgData?.score || this.getDefaultScore(),
          contribution: weight * (esgData?.score.overall || 50),
        };
      })
      .filter((asset) => asset.weight > 0.001); // Filter out negligible positions

    const weightedScore = this.calculateWeightedScore(assetBreakdown);
    const insights = this.generateInsights(assetBreakdown);
    const trends = this.calculateTrends(assetBreakdown);

    return {
      weightedScore,
      assetBreakdown,
      insights,
      trends,
    };
  }

  private calculateWeightedScore(breakdown: any[]): ESGScore {
    const totalWeight = breakdown.reduce((sum, asset) => sum + asset.weight, 0);

    if (totalWeight === 0) {
      return this.getDefaultScore();
    }

    const environmental =
      breakdown.reduce((sum, asset) => sum + asset.score.environmental * asset.weight, 0) /
      totalWeight;

    const social =
      breakdown.reduce((sum, asset) => sum + asset.score.social * asset.weight, 0) / totalWeight;

    const governance =
      breakdown.reduce((sum, asset) => sum + asset.score.governance * asset.weight, 0) /
      totalWeight;

    const overall = (environmental + social + governance) / 3;

    const confidence =
      breakdown.reduce((sum, asset) => sum + asset.score.confidence * asset.weight, 0) /
      totalWeight;

    return {
      overall: Math.round(overall),
      environmental: Math.round(environmental),
      social: Math.round(social),
      governance: Math.round(governance),
      confidence: Math.round(confidence),
      lastUpdated: new Date(),
      methodology: 'Dhanam Portfolio Weighted v2.0',
      sources: ['Portfolio weighted calculation'],
    };
  }

  private generateInsights(breakdown: any[]): any {
    const sortedByScore = [...breakdown].sort((a, b) => b.score.overall - a.score.overall);
    const topPerformers = sortedByScore.slice(0, 3).map((asset) => asset.symbol);

    const lowPerformers = sortedByScore
      .filter((asset) => asset.score.overall < 40)
      .map((asset) => asset.symbol);

    const recommendations = [];

    if (lowPerformers.length > 0) {
      recommendations.push(
        `Consider reducing exposure to low ESG assets: ${lowPerformers.slice(0, 2).join(', ')}`
      );
    }

    const avgEnvironmental = breakdown.reduce(
      (sum, asset) => sum + asset.score.environmental * asset.weight,
      0
    );
    if (avgEnvironmental < 50) {
      recommendations.push(
        'Consider increasing allocation to eco-friendly cryptocurrencies like Cardano (ADA) or Algorand (ALGO)'
      );
    }

    const powHeavy =
      breakdown.filter((asset) => asset.symbol === 'BTC' && asset.weight > 0.5).length > 0;

    if (powHeavy) {
      recommendations.push(
        'High Bitcoin allocation detected - consider diversifying to Proof-of-Stake assets for better ESG scores'
      );
    }

    return {
      topPerformers,
      improvementAreas:
        lowPerformers.length > 0 ? ['Environmental impact', 'Asset diversification'] : [],
      recommendations: recommendations.slice(0, 3),
    };
  }

  private calculateTrends(_breakdown: any[]): any {
    // Mock trend data - in production, this would use historical ESG scores
    const mockHistory = Array.from({ length: 12 }, (_, i) => ({
      date: new Date(Date.now() - (11 - i) * 30 * 24 * 60 * 60 * 1000),
      score: 50 + Math.random() * 30,
    }));

    return {
      scoreHistory: mockHistory,
      monthOverMonth: (Math.random() - 0.5) * 10, // Random +/- 5 point change
      yearOverYear: (Math.random() - 0.5) * 20, // Random +/- 10 point change
    };
  }

  private getDefaultScore(): ESGScore {
    return {
      overall: 50,
      environmental: 50,
      social: 50,
      governance: 50,
      confidence: 30,
      lastUpdated: new Date(),
      methodology: 'Default scoring',
      sources: ['Default values'],
    };
  }

  private getEmptyAnalysis(): PortfolioESGAnalysis {
    return {
      weightedScore: this.getDefaultScore(),
      assetBreakdown: [],
      insights: {
        topPerformers: [],
        improvementAreas: [],
        recommendations: ['Add cryptocurrency holdings to view ESG analysis'],
      },
      trends: {
        scoreHistory: [],
        monthOverMonth: 0,
        yearOverYear: 0,
      },
    };
  }

  static getESGScoreColor(score: number): string {
    if (score >= 80) return '#22c55e'; // Green
    if (score >= 60) return '#84cc16'; // Light green
    if (score >= 40) return '#f59e0b'; // Yellow
    if (score >= 20) return '#f97316'; // Orange
    return '#ef4444'; // Red
  }

  static getESGScoreLabel(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Poor';
    return 'Very Poor';
  }
}
