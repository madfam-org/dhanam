import { Test, TestingModule } from '@nestjs/testing';

import { MonteCarloConfig, MarketShock } from '../types/simulation.types';

import { MonteCarloEngine } from './monte-carlo.engine';

describe('MonteCarloEngine', () => {
  let engine: MonteCarloEngine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MonteCarloEngine],
    }).compile();

    engine = module.get<MonteCarloEngine>(MonteCarloEngine);
  });

  describe('Basic Simulation', () => {
    it('should be defined', () => {
      expect(engine).toBeDefined();
    });

    it('should run simulation with valid config', () => {
      const config: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 120, // 10 years
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const result = engine.simulate(config);

      expect(result).toBeDefined();
      expect(result.finalValues).toHaveLength(1000);
      expect(result.median).toBeGreaterThan(0);
      expect(result.mean).toBeGreaterThan(0);
      expect(result.timeSeries).toHaveLength(121); // months + 1 for initial
    });

    it('should produce positive median outcome with positive returns', () => {
      const config: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 60,
        iterations: 5000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const result = engine.simulate(config);

      // With positive returns and contributions, should grow
      expect(result.median).toBeGreaterThan(config.initialBalance);
      expect(result.median).toBeGreaterThan(30000); // At least contributions
    });

    it('should produce realistic percentile ranges', () => {
      const config: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 120,
        iterations: 10000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const result = engine.simulate(config);

      // Check ordering: p10 < p25 < median < p75 < p90
      expect(result.p10).toBeLessThan(result.p25);
      expect(result.p25).toBeLessThan(result.median);
      expect(result.median).toBeLessThan(result.p75);
      expect(result.p75).toBeLessThan(result.p90);

      // Check that spread is reasonable
      expect(result.p90).toBeGreaterThan(result.p10 * 1.5);
    });

    it('should have non-negative balances', () => {
      const config: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 120,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const result = engine.simulate(config);

      // All final values should be non-negative
      result.finalValues.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
      });

      expect(result.min).toBeGreaterThanOrEqual(0);
    });

    it('should produce time series with correct length', () => {
      const months = 60;
      const config: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const result = engine.simulate(config);

      expect(result.timeSeries).toHaveLength(months + 1);
      expect(result.timeSeries[0].month).toBe(0);
      expect(result.timeSeries[months].month).toBe(months);
    });

    it('should have increasing median over time with positive returns', () => {
      const config: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 120,
        iterations: 5000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const result = engine.simulate(config);

      // Check that median generally increases over time
      const firstQuarter = result.timeSeries[30].median;
      const secondQuarter = result.timeSeries[60].median;
      const thirdQuarter = result.timeSeries[90].median;
      const final = result.timeSeries[120].median;

      expect(secondQuarter).toBeGreaterThan(firstQuarter);
      expect(thirdQuarter).toBeGreaterThan(secondQuarter);
      expect(final).toBeGreaterThan(thirdQuarter);
    });
  });

  describe('Configuration Validation', () => {
    it('should throw error for negative initial balance', () => {
      const config: MonteCarloConfig = {
        initialBalance: -1000,
        monthlyContribution: 500,
        months: 120,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      expect(() => engine.simulate(config)).toThrow('Initial balance cannot be negative');
    });

    it('should throw error for non-positive months', () => {
      const config: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 0,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      expect(() => engine.simulate(config)).toThrow('Months must be positive');
    });

    it('should throw error for non-positive iterations', () => {
      const config: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 120,
        iterations: 0,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      expect(() => engine.simulate(config)).toThrow('Iterations must be positive');
    });

    it('should throw error for negative volatility', () => {
      const config: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 120,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: -0.15,
      };

      expect(() => engine.simulate(config)).toThrow('Volatility cannot be negative');
    });
  });

  describe('Market Shock Scenarios', () => {
    it('should run simulation with market shocks', () => {
      const config: MonteCarloConfig = {
        initialBalance: 100000,
        monthlyContribution: 1000,
        months: 120,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const shocks: MarketShock[] = [
        {
          type: 'crash',
          magnitude: -0.3,
          startMonth: 24,
          durationMonths: 6,
          recoveryMonths: 12,
        },
      ];

      const result = engine.simulateWithShocks(config, shocks);

      expect(result).toBeDefined();
      expect(result.finalValues).toHaveLength(1000);
    });

    it('should produce lower outcomes with market crash compared to baseline', () => {
      const config: MonteCarloConfig = {
        initialBalance: 100000,
        monthlyContribution: 1000,
        months: 120,
        iterations: 5000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const baseline = engine.simulate(config);

      const shocks: MarketShock[] = [
        {
          type: 'crash',
          magnitude: -0.3,
          startMonth: 12,
          durationMonths: 6,
          recoveryMonths: 12,
        },
      ];

      const withShock = engine.simulateWithShocks(config, shocks);

      // Median should be lower with shock
      expect(withShock.median).toBeLessThan(baseline.median);

      // P10 should be significantly lower
      expect(withShock.p10).toBeLessThan(baseline.p10);
    });

    it('should handle predefined BEAR_MARKET scenario', () => {
      const config: MonteCarloConfig = {
        initialBalance: 100000,
        monthlyContribution: 1000,
        months: 120,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const result = engine.simulateWithShocks(
        config,
        MonteCarloEngine.SCENARIOS.BEAR_MARKET.shocks
      );

      expect(result).toBeDefined();
      expect(result.median).toBeGreaterThan(0);
    });

    it('should handle predefined GREAT_RECESSION scenario', () => {
      const config: MonteCarloConfig = {
        initialBalance: 100000,
        monthlyContribution: 1000,
        months: 120,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const result = engine.simulateWithShocks(
        config,
        MonteCarloEngine.SCENARIOS.GREAT_RECESSION.shocks
      );

      expect(result).toBeDefined();
    });

    it('should show visible impact at shock timing', () => {
      const config: MonteCarloConfig = {
        initialBalance: 100000,
        monthlyContribution: 0, // No contributions to isolate shock impact
        months: 60,
        iterations: 5000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const shocks: MarketShock[] = [
        {
          type: 'crash',
          magnitude: -0.3,
          startMonth: 24,
          durationMonths: 6,
          recoveryMonths: 12,
        },
      ];

      const result = engine.simulateWithShocks(config, shocks);

      // Before shock (month 23)
      const beforeShock = result.timeSeries[23].median;

      // During shock (month 27, middle of crash)
      const duringShock = result.timeSeries[27].median;

      // Median should drop during shock
      expect(duringShock).toBeLessThan(beforeShock);
    });
  });

  describe('Success Rate Calculations', () => {
    it('should calculate success rate correctly', () => {
      const finalValues = [100, 200, 300, 400, 500];
      const targetAmount = 300;

      const successRate = engine.calculateSuccessRate(finalValues, targetAmount);

      expect(successRate).toBe(0.6); // 3 out of 5 (300, 400, 500)
    });

    it('should return 0 when no iterations succeed', () => {
      const finalValues = [100, 200, 300];
      const targetAmount = 500;

      const successRate = engine.calculateSuccessRate(finalValues, targetAmount);

      expect(successRate).toBe(0);
    });

    it('should return 1 when all iterations succeed', () => {
      const finalValues = [500, 600, 700];
      const targetAmount = 300;

      const successRate = engine.calculateSuccessRate(finalValues, targetAmount);

      expect(successRate).toBe(1);
    });
  });

  describe('Expected Shortfall Calculations', () => {
    it('should calculate expected shortfall correctly', () => {
      const finalValues = [100, 200, 300, 400, 500];
      const targetAmount = 300;

      const shortfall = engine.calculateExpectedShortfall(finalValues, targetAmount);

      // Average shortfall: (200 + 100) / 2 = 150
      expect(shortfall).toBe(150);
    });

    it('should return 0 when no shortfalls exist', () => {
      const finalValues = [400, 500, 600];
      const targetAmount = 300;

      const shortfall = engine.calculateExpectedShortfall(finalValues, targetAmount);

      expect(shortfall).toBe(0);
    });

    it('should handle all values below target', () => {
      const finalValues = [100, 200, 300];
      const targetAmount = 500;

      const shortfall = engine.calculateExpectedShortfall(finalValues, targetAmount);

      // Average: (400 + 300 + 200) / 3 = 300
      expect(shortfall).toBe(300);
    });
  });

  describe('Required Contribution Finder', () => {
    it('should find required contribution for target success rate', () => {
      const config = {
        initialBalance: 10000,
        months: 120,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const targetAmount = 100000;
      const desiredSuccessRate = 0.75;

      const requiredContribution = engine.findRequiredContribution(
        config,
        targetAmount,
        desiredSuccessRate,
        0.05 // 5% tolerance
      );

      expect(requiredContribution).toBeGreaterThan(0);
      expect(requiredContribution).toBeLessThan(targetAmount / config.months);
    });

    it('should return higher contribution for higher success rate target', () => {
      const config = {
        initialBalance: 10000,
        months: 120,
        iterations: 500,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const targetAmount = 100000;

      const contribution50 = engine.findRequiredContribution(config, targetAmount, 0.5);
      const contribution90 = engine.findRequiredContribution(config, targetAmount, 0.9);

      expect(contribution90).toBeGreaterThan(contribution50);
    });
  });

  describe('Scenario Application', () => {
    it('should apply scenario with return adjustment', () => {
      const baseConfig: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 60,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const modifiedConfig = engine.applyScenario(baseConfig, {
        name: 'Test',
        description: 'Test scenario',
        returnAdjustment: -0.02, // Reduce return by 2%
      });

      expect(modifiedConfig.expectedReturn).toBe(0.05);
      expect(modifiedConfig.volatility).toBe(0.15);
    });

    it('should apply scenario with volatility multiplier', () => {
      const baseConfig: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 60,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const modifiedConfig = engine.applyScenario(baseConfig, {
        name: 'Test',
        description: 'Test scenario',
        volatilityMultiplier: 1.5, // Increase volatility by 50%
      });

      expect(modifiedConfig.expectedReturn).toBe(0.07);
      expect(modifiedConfig.volatility).toBeCloseTo(0.225, 10);
    });

    it('should apply scenario with both adjustments', () => {
      const baseConfig: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 60,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const modifiedConfig = engine.applyScenario(baseConfig, {
        name: 'Test',
        description: 'Test scenario',
        returnAdjustment: -0.03,
        volatilityMultiplier: 2.0,
      });

      expect(modifiedConfig.expectedReturn).toBeCloseTo(0.04, 10);
      expect(modifiedConfig.volatility).toBeCloseTo(0.3, 10);
    });
  });

  describe('Predefined Scenarios', () => {
    it('should have BEAR_MARKET scenario defined', () => {
      expect(MonteCarloEngine.SCENARIOS.BEAR_MARKET).toBeDefined();
      expect(MonteCarloEngine.SCENARIOS.BEAR_MARKET.shocks).toHaveLength(1);
      expect(MonteCarloEngine.SCENARIOS.BEAR_MARKET.shocks[0].magnitude).toBe(-0.3);
    });

    it('should have GREAT_RECESSION scenario defined', () => {
      expect(MonteCarloEngine.SCENARIOS.GREAT_RECESSION).toBeDefined();
      expect(MonteCarloEngine.SCENARIOS.GREAT_RECESSION.shocks).toHaveLength(1);
      expect(MonteCarloEngine.SCENARIOS.GREAT_RECESSION.shocks[0].magnitude).toBe(-0.5);
    });

    it('should have DOT_COM_BUST scenario defined', () => {
      expect(MonteCarloEngine.SCENARIOS.DOT_COM_BUST).toBeDefined();
      expect(MonteCarloEngine.SCENARIOS.DOT_COM_BUST.shocks).toHaveLength(1);
      expect(MonteCarloEngine.SCENARIOS.DOT_COM_BUST.shocks[0].magnitude).toBe(-0.45);
    });

    it('should have MILD_RECESSION scenario defined', () => {
      expect(MonteCarloEngine.SCENARIOS.MILD_RECESSION).toBeDefined();
      expect(MonteCarloEngine.SCENARIOS.MILD_RECESSION.shocks).toHaveLength(1);
      expect(MonteCarloEngine.SCENARIOS.MILD_RECESSION.shocks[0].magnitude).toBe(-0.15);
    });

    it('should have MARKET_CORRECTION scenario defined', () => {
      expect(MonteCarloEngine.SCENARIOS.MARKET_CORRECTION).toBeDefined();
      expect(MonteCarloEngine.SCENARIOS.MARKET_CORRECTION.shocks).toHaveLength(1);
      expect(MonteCarloEngine.SCENARIOS.MARKET_CORRECTION.shocks[0].magnitude).toBe(-0.1);
    });
  });

  describe('Performance', () => {
    it('should complete 10,000 iterations in reasonable time', () => {
      const config: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 120,
        iterations: 10000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const startTime = Date.now();
      engine.simulate(config);
      const duration = Date.now() - startTime;

      // Should complete in under 30 seconds (generous for CI/dev machines)
      expect(duration).toBeLessThan(30000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero monthly contribution', () => {
      const config: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 0,
        months: 60,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const result = engine.simulate(config);

      expect(result).toBeDefined();
      expect(result.median).toBeGreaterThan(0);
    });

    it('should handle zero initial balance', () => {
      const config: MonteCarloConfig = {
        initialBalance: 0,
        monthlyContribution: 500,
        months: 60,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const result = engine.simulate(config);

      expect(result).toBeDefined();
      expect(result.median).toBeGreaterThan(0);
    });

    it('should handle negative expected return', () => {
      const config: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 60,
        iterations: 1000,
        expectedReturn: -0.05, // Negative return
        volatility: 0.15,
      };

      const result = engine.simulate(config);

      expect(result).toBeDefined();
      // May or may not be positive depending on contributions vs losses
    });

    it('should handle very high volatility', () => {
      const config: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 60,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.8, // 80% volatility
      };

      const result = engine.simulate(config);

      expect(result).toBeDefined();
      // Should have wide spread
      expect(result.p90).toBeGreaterThan(result.p10 * 2);
    });

    it('should handle very short time horizon (1 month)', () => {
      const config: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 1,
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const result = engine.simulate(config);

      expect(result).toBeDefined();
      expect(result.timeSeries).toHaveLength(2);
    });

    it('should handle very long time horizon (40 years)', () => {
      const config: MonteCarloConfig = {
        initialBalance: 10000,
        monthlyContribution: 500,
        months: 480, // 40 years
        iterations: 1000,
        expectedReturn: 0.07,
        volatility: 0.15,
      };

      const result = engine.simulate(config);

      expect(result).toBeDefined();
      expect(result.median).toBeGreaterThan(100000); // Should grow significantly
    });
  });
});
