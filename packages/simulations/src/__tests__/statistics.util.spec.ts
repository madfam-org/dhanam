import {
  mean,
  stdDev,
  variance,
  percentile,
  median,
  correlation,
  covariance,
  normalRandom,
  normalRandomArray,
  cagr,
  futureValue,
  futureValueOfAnnuity,
  presentValue,
  confidenceInterval,
  summarize,
} from '../utils/statistics.util';

describe('Statistical Utilities', () => {
  describe('mean', () => {
    it('should calculate the arithmetic mean correctly', () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
      expect(mean([10, 20, 30])).toBe(20);
      expect(mean([100])).toBe(100);
    });

    it('should handle negative numbers', () => {
      expect(mean([-5, -10, -15])).toBe(-10);
      expect(mean([-5, 0, 5])).toBe(0);
    });

    it('should throw error for empty array', () => {
      expect(() => mean([])).toThrow('Cannot calculate mean of empty array');
    });
  });

  describe('stdDev', () => {
    it('should calculate standard deviation correctly', () => {
      const result = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(result).toBeCloseTo(2.138, 2);
    });

    it('should handle identical values (stdDev = 0)', () => {
      expect(stdDev([5, 5, 5, 5])).toBe(0);
    });

    it('should throw error for arrays with less than 2 values', () => {
      expect(() => stdDev([1])).toThrow('Standard deviation requires at least 2 values');
    });
  });

  describe('variance', () => {
    it('should calculate variance correctly', () => {
      const result = variance([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(result).toBeCloseTo(4.571, 2);
    });
  });

  describe('percentile', () => {
    it('should calculate percentiles correctly', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      expect(percentile(data, 0)).toBe(1);
      expect(percentile(data, 50)).toBe(5.5);
      expect(percentile(data, 100)).toBe(10);
    });

    it('should handle interpolation for non-exact percentiles', () => {
      const data = [1, 2, 3, 4, 5];

      const p75 = percentile(data, 75);
      expect(p75).toBeCloseTo(4, 1);
    });

    it('should throw error for percentile out of range', () => {
      expect(() => percentile([1, 2, 3], -1)).toThrow('Percentile must be between 0 and 100');
      expect(() => percentile([1, 2, 3], 101)).toThrow('Percentile must be between 0 and 100');
    });
  });

  describe('median', () => {
    it('should calculate median for odd-length arrays', () => {
      expect(median([1, 2, 3, 4, 5])).toBe(3);
    });

    it('should calculate median for even-length arrays', () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });
  });

  describe('correlation', () => {
    it('should calculate perfect positive correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];

      expect(correlation(x, y)).toBeCloseTo(1, 10);
    });

    it('should calculate perfect negative correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [10, 8, 6, 4, 2];

      expect(correlation(x, y)).toBeCloseTo(-1, 10);
    });

    it('should calculate zero correlation for independent variables', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 5, 5, 5, 5]; // Constant

      expect(correlation(x, y)).toBe(0);
    });

    it('should throw error for arrays of different lengths', () => {
      expect(() => correlation([1, 2], [1, 2, 3])).toThrow('Arrays must have equal length');
    });
  });

  describe('covariance', () => {
    it('should calculate covariance correctly', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 5, 4, 5];

      const result = covariance(x, y);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('normalRandom', () => {
    it('should generate values with approximately correct mean and stdDev', () => {
      const samples = normalRandomArray(10000, 100, 15);

      const sampleMean = mean(samples);
      const sampleStdDev = stdDev(samples);

      expect(sampleMean).toBeCloseTo(100, 0);
      expect(sampleStdDev).toBeCloseTo(15, 0);
    });

    it('should generate different values on each call', () => {
      const val1 = normalRandom();
      const val2 = normalRandom();

      expect(val1).not.toBe(val2);
    });
  });

  describe('cagr', () => {
    it('should calculate compound annual growth rate', () => {
      const result = cagr(100, 200, 5);

      expect(result).toBeCloseTo(0.1487, 3); // ~14.87%
    });

    it('should handle negative growth', () => {
      const result = cagr(100, 50, 3);

      expect(result).toBeLessThan(0);
    });

    it('should throw error for invalid inputs', () => {
      expect(() => cagr(0, 100, 5)).toThrow('Beginning value must be positive');
      expect(() => cagr(100, 200, 0)).toThrow('Years must be positive');
    });
  });

  describe('futureValue', () => {
    it('should calculate future value with compound interest', () => {
      const result = futureValue(1000, 0.07, 10, 1);

      expect(result).toBeCloseTo(1967.15, 2);
    });

    it('should handle monthly compounding', () => {
      const result = futureValue(1000, 0.07, 10, 12);

      expect(result).toBeCloseTo(2009.66, 2);
    });
  });

  describe('futureValueOfAnnuity', () => {
    it('should calculate future value of monthly payments', () => {
      const result = futureValueOfAnnuity(100, 0.07, 10, 12);

      expect(result).toBeCloseTo(17308.48, 2);
    });

    it('should handle zero interest rate', () => {
      const result = futureValueOfAnnuity(100, 0, 10, 12);

      expect(result).toBe(100 * 10 * 12); // Simple sum
    });
  });

  describe('presentValue', () => {
    it('should calculate present value correctly', () => {
      const result = presentValue(10000, 0.05, 10);

      expect(result).toBeCloseTo(6139.13, 2);
    });

    it('should be inverse of futureValue', () => {
      const fv = futureValue(1000, 0.07, 10, 1);
      const pv = presentValue(fv, 0.07, 10);

      expect(pv).toBeCloseTo(1000, 1);
    });
  });

  describe('confidenceInterval', () => {
    it('should calculate 95% confidence interval', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const [lower, upper] = confidenceInterval(data, 0.95);

      expect(lower).toBeCloseTo(1.225, 1);
      expect(upper).toBeCloseTo(9.775, 1);
    });

    it('should handle different confidence levels', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const [lower50, upper50] = confidenceInterval(data, 0.5);
      const [lower95, upper95] = confidenceInterval(data, 0.95);

      // 50% CI should be narrower than 95% CI
      expect(upper50 - lower50).toBeLessThan(upper95 - lower95);
    });

    it('should throw error for invalid confidence level', () => {
      expect(() => confidenceInterval([1, 2, 3], 0)).toThrow('Confidence must be between 0 and 1');
      expect(() => confidenceInterval([1, 2, 3], 1)).toThrow('Confidence must be between 0 and 1');
    });
  });

  describe('summarize', () => {
    it('should calculate all summary statistics', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const stats = summarize(data);

      expect(stats.count).toBe(10);
      expect(stats.mean).toBe(5.5);
      expect(stats.median).toBe(5.5);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(10);
      expect(stats.p10).toBeCloseTo(1.9, 1);
      expect(stats.p90).toBeCloseTo(9.1, 1);
      expect(stats.stdDev).toBeGreaterThan(0);
      expect(stats.variance).toBeGreaterThan(0);
    });

    it('should handle single-value array', () => {
      const stats = summarize([42]);

      expect(stats.count).toBe(1);
      expect(stats.mean).toBe(42);
      expect(stats.median).toBe(42);
      expect(stats.stdDev).toBe(0);
      expect(stats.variance).toBe(0);
    });
  });
});
