import { PortfolioESGAnalyzer, PortfolioHolding } from '../services/portfolio-analyzer';
import { AssetESGData, ESGScore } from '../types/esg.types';

describe('PortfolioESGAnalyzer', () => {
  const mockBTCData: AssetESGData = {
    symbol: 'BTC',
    name: 'Bitcoin',
    score: {
      overall: 45,
      environmental: 20,
      social: 60,
      governance: 55,
      confidence: 80,
      lastUpdated: new Date(),
      methodology: 'Test',
      sources: ['Test source'],
    },
    metrics: {
      consensusMechanism: 'pow',
      energyIntensity: 100,
    },
    category: 'cryptocurrency',
  };

  const mockETHData: AssetESGData = {
    symbol: 'ETH',
    name: 'Ethereum',
    score: {
      overall: 65,
      environmental: 50,
      social: 70,
      governance: 75,
      confidence: 85,
      lastUpdated: new Date(),
      methodology: 'Test',
      sources: ['Test source'],
    },
    metrics: {
      consensusMechanism: 'pos',
      energyIntensity: 0.1,
    },
    category: 'cryptocurrency',
  };

  const mockADAData: AssetESGData = {
    symbol: 'ADA',
    name: 'Cardano',
    score: {
      overall: 80,
      environmental: 90,
      social: 75,
      governance: 75,
      confidence: 75,
      lastUpdated: new Date(),
      methodology: 'Test',
      sources: ['Test source'],
    },
    metrics: {
      consensusMechanism: 'pos',
      energyIntensity: 0.05,
    },
    category: 'cryptocurrency',
  };

  describe('analyzePortfolio', () => {
    it('should analyze single asset portfolio', () => {
      const esgData = new Map<string, AssetESGData>([['BTC', mockBTCData]]);
      const analyzer = new PortfolioESGAnalyzer(esgData);

      const holdings: PortfolioHolding[] = [{ symbol: 'BTC', quantity: 1, value: 50000 }];

      const analysis = analyzer.analyzePortfolio(holdings);

      expect(analysis.weightedScore).toBeDefined();
      expect(analysis.assetBreakdown).toHaveLength(1);
      expect(analysis.assetBreakdown[0].symbol).toBe('BTC');
      expect(analysis.assetBreakdown[0].weight).toBe(1);
    });

    it('should calculate weighted score for multiple assets', () => {
      const esgData = new Map<string, AssetESGData>([
        ['BTC', mockBTCData],
        ['ETH', mockETHData],
      ]);
      const analyzer = new PortfolioESGAnalyzer(esgData);

      const holdings: PortfolioHolding[] = [
        { symbol: 'BTC', quantity: 1, value: 50000 }, // 50% weight
        { symbol: 'ETH', quantity: 10, value: 50000 }, // 50% weight
      ];

      const analysis = analyzer.analyzePortfolio(holdings);

      expect(analysis.weightedScore.overall).toBeDefined();
      // Average of BTC (45) and ETH (65) should be around 55
      expect(analysis.weightedScore.overall).toBeGreaterThan(50);
      expect(analysis.weightedScore.overall).toBeLessThan(60);
    });

    it('should handle empty portfolio', () => {
      const esgData = new Map<string, AssetESGData>();
      const analyzer = new PortfolioESGAnalyzer(esgData);

      const holdings: PortfolioHolding[] = [];

      const analysis = analyzer.analyzePortfolio(holdings);

      expect(analysis.weightedScore.overall).toBe(50); // Default score
      expect(analysis.assetBreakdown).toHaveLength(0);
      expect(analysis.insights.recommendations).toContain(
        'Add cryptocurrency holdings to view ESG analysis'
      );
    });

    it('should handle zero value portfolio', () => {
      const esgData = new Map<string, AssetESGData>([['BTC', mockBTCData]]);
      const analyzer = new PortfolioESGAnalyzer(esgData);

      const holdings: PortfolioHolding[] = [{ symbol: 'BTC', quantity: 0, value: 0 }];

      const analysis = analyzer.analyzePortfolio(holdings);

      expect(analysis.weightedScore.overall).toBe(50); // Default score
    });

    it('should use default score for unknown assets', () => {
      const esgData = new Map<string, AssetESGData>([['BTC', mockBTCData]]);
      const analyzer = new PortfolioESGAnalyzer(esgData);

      const holdings: PortfolioHolding[] = [{ symbol: 'UNKNOWN', quantity: 1, value: 1000 }];

      const analysis = analyzer.analyzePortfolio(holdings);

      expect(analysis.assetBreakdown[0].score.overall).toBe(50); // Default
      expect(analysis.assetBreakdown[0].score.confidence).toBe(30); // Low confidence
    });

    it('should filter out negligible positions', () => {
      const esgData = new Map<string, AssetESGData>([
        ['BTC', mockBTCData],
        ['ETH', mockETHData],
      ]);
      const analyzer = new PortfolioESGAnalyzer(esgData);

      const holdings: PortfolioHolding[] = [
        { symbol: 'BTC', quantity: 1, value: 100000 },
        { symbol: 'ETH', quantity: 0.00001, value: 0.05 }, // Very small position
      ];

      const analysis = analyzer.analyzePortfolio(holdings);

      // ETH position is < 0.1% so should be filtered
      expect(analysis.assetBreakdown).toHaveLength(1);
      expect(analysis.assetBreakdown[0].symbol).toBe('BTC');
    });

    it('should calculate contribution correctly', () => {
      const esgData = new Map<string, AssetESGData>([
        ['BTC', mockBTCData],
        ['ETH', mockETHData],
      ]);
      const analyzer = new PortfolioESGAnalyzer(esgData);

      const holdings: PortfolioHolding[] = [
        { symbol: 'BTC', quantity: 1, value: 75000 }, // 75% weight
        { symbol: 'ETH', quantity: 10, value: 25000 }, // 25% weight
      ];

      const analysis = analyzer.analyzePortfolio(holdings);

      const btcAsset = analysis.assetBreakdown.find((a) => a.symbol === 'BTC');
      const ethAsset = analysis.assetBreakdown.find((a) => a.symbol === 'ETH');

      expect(btcAsset?.weight).toBeCloseTo(0.75, 2);
      expect(ethAsset?.weight).toBeCloseTo(0.25, 2);

      // BTC contribution: 0.75 * 45 = 33.75
      expect(btcAsset?.contribution).toBeCloseTo(33.75, 1);
      // ETH contribution: 0.25 * 65 = 16.25
      expect(ethAsset?.contribution).toBeCloseTo(16.25, 1);
    });
  });

  describe('insights generation', () => {
    it('should identify top performers', () => {
      const esgData = new Map<string, AssetESGData>([
        ['BTC', mockBTCData],
        ['ETH', mockETHData],
        ['ADA', mockADAData],
      ]);
      const analyzer = new PortfolioESGAnalyzer(esgData);

      const holdings: PortfolioHolding[] = [
        { symbol: 'BTC', quantity: 1, value: 50000 },
        { symbol: 'ETH', quantity: 10, value: 30000 },
        { symbol: 'ADA', quantity: 1000, value: 20000 },
      ];

      const analysis = analyzer.analyzePortfolio(holdings);

      // ADA (80), ETH (65), BTC (45) - top performers should be in order
      expect(analysis.insights.topPerformers).toContain('ADA');
    });

    it('should recommend reducing low ESG assets', () => {
      const lowESGData: AssetESGData = {
        ...mockBTCData,
        symbol: 'LOW',
        score: { ...mockBTCData.score, overall: 30 },
      };

      const esgData = new Map<string, AssetESGData>([
        ['LOW', lowESGData],
        ['ETH', mockETHData],
      ]);
      const analyzer = new PortfolioESGAnalyzer(esgData);

      const holdings: PortfolioHolding[] = [
        { symbol: 'LOW', quantity: 1, value: 50000 },
        { symbol: 'ETH', quantity: 10, value: 50000 },
      ];

      const analysis = analyzer.analyzePortfolio(holdings);

      expect(analysis.insights.improvementAreas.length).toBeGreaterThan(0);
    });

    it('should warn about high BTC allocation', () => {
      const esgData = new Map<string, AssetESGData>([['BTC', mockBTCData]]);
      const analyzer = new PortfolioESGAnalyzer(esgData);

      const holdings: PortfolioHolding[] = [
        { symbol: 'BTC', quantity: 2, value: 100000 }, // 100% BTC
      ];

      const analysis = analyzer.analyzePortfolio(holdings);

      const hasPowWarning = analysis.insights.recommendations.some(
        (r: string) => r.includes('Proof-of-Stake') || r.includes('Bitcoin')
      );
      expect(hasPowWarning).toBe(true);
    });
  });

  describe('trends calculation', () => {
    it('should return trend data', () => {
      const esgData = new Map<string, AssetESGData>([['BTC', mockBTCData]]);
      const analyzer = new PortfolioESGAnalyzer(esgData);

      const holdings: PortfolioHolding[] = [{ symbol: 'BTC', quantity: 1, value: 50000 }];

      const analysis = analyzer.analyzePortfolio(holdings);

      expect(analysis.trends).toBeDefined();
      expect(analysis.trends.scoreHistory).toHaveLength(12); // 12 months
      expect(analysis.trends.monthOverMonth).toBeDefined();
      expect(analysis.trends.yearOverYear).toBeDefined();
    });
  });

  describe('static utility methods', () => {
    it('should return correct color for excellent score', () => {
      expect(PortfolioESGAnalyzer.getESGScoreColor(85)).toBe('#22c55e');
    });

    it('should return correct color for good score', () => {
      expect(PortfolioESGAnalyzer.getESGScoreColor(65)).toBe('#84cc16');
    });

    it('should return correct color for fair score', () => {
      expect(PortfolioESGAnalyzer.getESGScoreColor(45)).toBe('#f59e0b');
    });

    it('should return correct color for poor score', () => {
      expect(PortfolioESGAnalyzer.getESGScoreColor(25)).toBe('#f97316');
    });

    it('should return correct color for very poor score', () => {
      expect(PortfolioESGAnalyzer.getESGScoreColor(15)).toBe('#ef4444');
    });

    it('should return correct label for excellent score', () => {
      expect(PortfolioESGAnalyzer.getESGScoreLabel(85)).toBe('Excellent');
    });

    it('should return correct label for good score', () => {
      expect(PortfolioESGAnalyzer.getESGScoreLabel(65)).toBe('Good');
    });

    it('should return correct label for fair score', () => {
      expect(PortfolioESGAnalyzer.getESGScoreLabel(45)).toBe('Fair');
    });

    it('should return correct label for poor score', () => {
      expect(PortfolioESGAnalyzer.getESGScoreLabel(25)).toBe('Poor');
    });

    it('should return correct label for very poor score', () => {
      expect(PortfolioESGAnalyzer.getESGScoreLabel(15)).toBe('Very Poor');
    });

    it('should handle boundary scores correctly', () => {
      expect(PortfolioESGAnalyzer.getESGScoreLabel(80)).toBe('Excellent');
      expect(PortfolioESGAnalyzer.getESGScoreLabel(60)).toBe('Good');
      expect(PortfolioESGAnalyzer.getESGScoreLabel(40)).toBe('Fair');
      expect(PortfolioESGAnalyzer.getESGScoreLabel(20)).toBe('Poor');
    });
  });
});
