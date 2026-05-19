import {
  MonteCarloEngine,
  SimulationConfig,
  monteCarloEngine,
} from '../engines/monte-carlo.engine';

describe('MonteCarloEngine', () => {
  let engine: MonteCarloEngine;

  beforeEach(() => {
    engine = new MonteCarloEngine();
  });

  describe('simulate', () => {
    const baseConfig: SimulationConfig = {
      initialBalance: 100000,
      monthlyContribution: 1000,
      years: 10,
      iterations: 1000,
      expectedReturn: 0.07,
      returnVolatility: 0.15,
    };

    it('should return simulation result with all required fields', () => {
      const result = engine.simulate(baseConfig);

      expect(result.config).toEqual(baseConfig);
      expect(result.finalBalance).toBeDefined();
      expect(result.yearlyProjections).toBeDefined();
      expect(result.probabilities).toBeDefined();
      expect(result.allOutcomes).toBeDefined();
      expect(result.executionTimeMs).toBeDefined();
    });

    it('should return correct number of outcomes', () => {
      const result = engine.simulate(baseConfig);
      expect(result.allOutcomes).toHaveLength(baseConfig.iterations);
    });

    it('should return yearly projections for each year plus initial', () => {
      const result = engine.simulate(baseConfig);
      expect(result.yearlyProjections).toHaveLength(baseConfig.years + 1);
    });

    it('should have increasing median balance with positive returns', () => {
      const result = engine.simulate(baseConfig);

      // Final median should be greater than initial
      expect(result.finalBalance.median).toBeGreaterThan(baseConfig.initialBalance);
    });

    it('should have wider confidence interval for higher volatility', () => {
      const lowVolResult = engine.simulate({ ...baseConfig, returnVolatility: 0.05 });
      const highVolResult = engine.simulate({ ...baseConfig, returnVolatility: 0.25 });

      const lowVolRange = lowVolResult.finalBalance.p90 - lowVolResult.finalBalance.p10;
      const highVolRange = highVolResult.finalBalance.p90 - highVolResult.finalBalance.p10;

      expect(highVolRange).toBeGreaterThan(lowVolRange);
    });

    it('should calculate success rate correctly', () => {
      const result = engine.simulate(baseConfig);

      expect(result.probabilities.successRate).toBeGreaterThanOrEqual(0);
      expect(result.probabilities.successRate).toBeLessThanOrEqual(1);
      // With positive contributions and returns, should have high success
      expect(result.probabilities.successRate).toBeGreaterThan(0.9);
    });

    it('should calculate doubling probability correctly', () => {
      const result = engine.simulate(baseConfig);

      expect(result.probabilities.doublingProbability).toBeGreaterThanOrEqual(0);
      expect(result.probabilities.doublingProbability).toBeLessThanOrEqual(1);
    });

    it('should handle inflation adjustment', () => {
      const configWithInflation: SimulationConfig = {
        ...baseConfig,
        inflationRate: 0.03,
      };

      const result = engine.simulate(configWithInflation);

      expect(result.probabilities.maintainingPurchasingPower).toBeDefined();
      expect(result.probabilities.maintainingPurchasingPower).toBeGreaterThanOrEqual(0);
      expect(result.probabilities.maintainingPurchasingPower).toBeLessThanOrEqual(1);
    });

    it('should handle withdrawal scenario (negative contributions)', () => {
      const withdrawalConfig: SimulationConfig = {
        initialBalance: 1000000,
        monthlyContribution: -4000, // $4000/month withdrawal
        years: 30,
        iterations: 500,
        expectedReturn: 0.05,
        returnVolatility: 0.12,
      };

      const result = engine.simulate(withdrawalConfig);

      // Success rate should be less than 100% with withdrawals
      expect(result.probabilities.successRate).toBeLessThan(1);
      expect(result.probabilities.successRate).toBeGreaterThan(0);
    });

    it('should report execution time', () => {
      const result = engine.simulate(baseConfig);
      expect(result.executionTimeMs).toBeGreaterThan(0);
    });
  });

  describe('validation', () => {
    const baseConfig: SimulationConfig = {
      initialBalance: 100000,
      monthlyContribution: 1000,
      years: 10,
      iterations: 1000,
      expectedReturn: 0.07,
      returnVolatility: 0.15,
    };

    it('should reject iterations below 100', () => {
      expect(() => engine.simulate({ ...baseConfig, iterations: 50 })).toThrow(
        'Iterations must be at least 100'
      );
    });

    it('should reject iterations above 100,000', () => {
      expect(() => engine.simulate({ ...baseConfig, iterations: 150000 })).toThrow(
        'Iterations cannot exceed 100,000'
      );
    });

    it('should reject years below 1', () => {
      expect(() => engine.simulate({ ...baseConfig, years: 0 })).toThrow(
        'Years must be at least 1'
      );
    });

    it('should reject years above 100', () => {
      expect(() => engine.simulate({ ...baseConfig, years: 101 })).toThrow(
        'Years cannot exceed 100'
      );
    });

    it('should reject negative volatility', () => {
      expect(() => engine.simulate({ ...baseConfig, returnVolatility: -0.1 })).toThrow(
        'Return volatility cannot be negative'
      );
    });

    it('should reject volatility above 100%', () => {
      expect(() => engine.simulate({ ...baseConfig, returnVolatility: 1.5 })).toThrow(
        'Return volatility cannot exceed 100%'
      );
    });
  });

  describe('simulateRetirement', () => {
    const retirementConfig = {
      currentAge: 35,
      retirementAge: 65,
      lifeExpectancy: 90,
      currentSavings: 50000,
      monthlyContribution: 1000,
      monthlyWithdrawal: 4000,
      preRetirementReturn: 0.08,
      postRetirementReturn: 0.05,
      returnVolatility: 0.15,
      iterations: 500,
    };

    it('should return retirement simulation result', () => {
      const result = engine.simulateRetirement(retirementConfig);

      expect(result.successProbability).toBeDefined();
      expect(result.balanceAtRetirement).toBeDefined();
      expect(result.balanceAtLifeExpectancy).toBeDefined();
      expect(result.yearlyProjections).toBeDefined();
      expect(result.successByAge).toBeDefined();
    });

    it('should have success probability between 0 and 1', () => {
      const result = engine.simulateRetirement(retirementConfig);

      expect(result.successProbability).toBeGreaterThanOrEqual(0);
      expect(result.successProbability).toBeLessThanOrEqual(1);
    });

    it('should calculate balance at retirement', () => {
      const result = engine.simulateRetirement(retirementConfig);

      expect(result.balanceAtRetirement.count).toBe(retirementConfig.iterations);
      expect(result.balanceAtRetirement.mean).toBeGreaterThan(retirementConfig.currentSavings);
    });

    it('should track success by age', () => {
      const result = engine.simulateRetirement(retirementConfig);

      expect(result.successByAge.length).toBeGreaterThan(0);

      // Success rate should decrease over time in retirement
      const firstRetirementAge = result.successByAge.find(
        (s) => s.age === retirementConfig.retirementAge
      );
      expect(firstRetirementAge?.successRate).toBeDefined();
    });

    it('should handle early retirement scenario', () => {
      const earlyRetirement = {
        ...retirementConfig,
        retirementAge: 50, // Early retirement
        monthlyContribution: 2000, // Higher savings rate
      };

      const result = engine.simulateRetirement(earlyRetirement);
      expect(result.successProbability).toBeDefined();
    });

    it('should report median years until depletion when applicable', () => {
      const aggressiveWithdrawal = {
        ...retirementConfig,
        monthlyWithdrawal: 10000, // Very high withdrawal
        iterations: 300,
      };

      const result = engine.simulateRetirement(aggressiveWithdrawal);

      // With aggressive withdrawal, some scenarios should run out
      if (result.successProbability < 1) {
        expect(result.medianYearsUntilDepletion).not.toBeNull();
      }
    });
  });

  describe('calculateSafeWithdrawalRate', () => {
    it('should return a withdrawal rate between 1% and 10%', () => {
      const result = engine.calculateSafeWithdrawalRate({
        portfolioValue: 1000000,
        yearsInRetirement: 30,
        successProbability: 0.95,
        expectedReturn: 0.06,
        returnVolatility: 0.15,
        iterations: 500,
        maxAttempts: 12,
      });

      expect(result).toBeGreaterThanOrEqual(0.01);
      expect(result).toBeLessThanOrEqual(0.1);
    });

    it('should return higher rate for shorter retirement', () => {
      const shortRetirement = engine.calculateSafeWithdrawalRate({
        portfolioValue: 1000000,
        yearsInRetirement: 15,
        successProbability: 0.95,
        expectedReturn: 0.06,
        returnVolatility: 0.15,
        iterations: 500,
        maxAttempts: 12,
      });

      const longRetirement = engine.calculateSafeWithdrawalRate({
        portfolioValue: 1000000,
        yearsInRetirement: 40,
        successProbability: 0.95,
        expectedReturn: 0.06,
        returnVolatility: 0.15,
        iterations: 500,
        maxAttempts: 12,
      });

      expect(shortRetirement).toBeGreaterThan(longRetirement);
    });

    it('should return lower rate for higher success probability', () => {
      const lowerProbability = engine.calculateSafeWithdrawalRate({
        portfolioValue: 1000000,
        yearsInRetirement: 30,
        successProbability: 0.8,
        expectedReturn: 0.06,
        returnVolatility: 0.15,
        iterations: 500,
        maxAttempts: 12,
      });

      const higherProbability = engine.calculateSafeWithdrawalRate({
        portfolioValue: 1000000,
        yearsInRetirement: 30,
        successProbability: 0.99,
        expectedReturn: 0.06,
        returnVolatility: 0.15,
        iterations: 500,
        maxAttempts: 12,
      });

      expect(lowerProbability).toBeGreaterThan(higherProbability);
    });
  });

  describe('default export', () => {
    it('should export a default engine instance', () => {
      expect(monteCarloEngine).toBeInstanceOf(MonteCarloEngine);
    });

    it('should be usable for simulations', () => {
      const result = monteCarloEngine.simulate({
        initialBalance: 10000,
        monthlyContribution: 100,
        years: 5,
        iterations: 100,
        expectedReturn: 0.07,
        returnVolatility: 0.15,
      });

      expect(result.finalBalance).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle zero initial balance', () => {
      const result = engine.simulate({
        initialBalance: 0,
        monthlyContribution: 500,
        years: 5,
        iterations: 100,
        expectedReturn: 0.07,
        returnVolatility: 0.15,
      });

      expect(result.finalBalance.median).toBeGreaterThan(0);
    });

    it('should handle zero monthly contribution', () => {
      const result = engine.simulate({
        initialBalance: 100000,
        monthlyContribution: 0,
        years: 10,
        iterations: 100,
        expectedReturn: 0.07,
        returnVolatility: 0.15,
      });

      expect(result.finalBalance).toBeDefined();
    });

    it('should handle zero expected return', () => {
      const result = engine.simulate({
        initialBalance: 100000,
        monthlyContribution: 0,
        years: 5,
        iterations: 100,
        expectedReturn: 0,
        returnVolatility: 0.1,
      });

      // With zero expected return, median should be close to initial
      expect(result.finalBalance.median).toBeGreaterThan(50000);
      expect(result.finalBalance.median).toBeLessThan(200000);
    });

    it('should prevent balance from going negative', () => {
      const result = engine.simulate({
        initialBalance: 10000,
        monthlyContribution: -2000, // Large withdrawal
        years: 10,
        iterations: 100,
        expectedReturn: 0.03,
        returnVolatility: 0.15,
      });

      // Some outcomes should hit zero but not go negative
      expect(result.allOutcomes.every((balance) => balance >= 0)).toBe(true);
    });
  });
});
