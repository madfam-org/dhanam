import { formatCurrency, parseCurrency, createMoney, convertCurrency } from '../utils/currency';
import { Currency } from '../types';

describe('Currency Utilities', () => {
  describe('formatCurrency', () => {
    it('should format MXN in Spanish locale', () => {
      const result = formatCurrency(1234.56, Currency.MXN, 'es-MX');
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('$');
    });

    it('should format USD in English locale', () => {
      const result = formatCurrency(1234.56, Currency.USD, 'en-US');
      expect(result).toContain('$');
      expect(result).toContain('1,234.56');
    });

    it('should format EUR in Spanish locale', () => {
      const result = formatCurrency(1234.56, Currency.EUR, 'es-ES');
      expect(result).toBeDefined();
    });

    it('should default to Spanish locale', () => {
      const result = formatCurrency(1000, Currency.MXN);
      expect(result).toBeDefined();
      expect(result).toContain('$');
    });

    it('should respect decimal places for currency', () => {
      const result = formatCurrency(1234.567, Currency.USD, 'en-US');
      // USD has 2 decimal places
      expect(result).toContain('1,234.57');
    });
  });

  describe('parseCurrency', () => {
    it('should parse formatted currency string', () => {
      expect(parseCurrency('$1,234.56')).toBe(1234.56);
    });

    it('should parse negative amounts', () => {
      expect(parseCurrency('-$1,234.56')).toBe(-1234.56);
    });

    it('should parse plain numbers', () => {
      expect(parseCurrency('1234.56')).toBe(1234.56);
    });

    it('should handle currency symbols', () => {
      expect(parseCurrency('€1,234.56')).toBe(1234.56);
    });

    it('should return NaN for invalid strings', () => {
      expect(parseCurrency('invalid')).toBeNaN();
    });

    it('should handle integers', () => {
      expect(parseCurrency('$1,000')).toBe(1000);
    });
  });

  describe('createMoney', () => {
    it('should create Money object with amount and currency', () => {
      const money = createMoney(100, Currency.USD);
      expect(money.amount).toBe(100);
      expect(money.currency).toBe(Currency.USD);
    });

    it('should handle zero amount', () => {
      const money = createMoney(0, Currency.MXN);
      expect(money.amount).toBe(0);
      expect(money.currency).toBe(Currency.MXN);
    });

    it('should handle negative amounts', () => {
      const money = createMoney(-500, Currency.EUR);
      expect(money.amount).toBe(-500);
      expect(money.currency).toBe(Currency.EUR);
    });

    it('should handle decimal amounts', () => {
      const money = createMoney(99.99, Currency.USD);
      expect(money.amount).toBe(99.99);
    });
  });

  describe('convertCurrency', () => {
    it('should convert USD to MXN with exchange rate', () => {
      const money = createMoney(100, Currency.USD);
      const converted = convertCurrency(money, Currency.MXN, 17.5);

      expect(converted.amount).toBe(1750);
      expect(converted.currency).toBe(Currency.MXN);
    });

    it('should return same money if currencies match', () => {
      const money = createMoney(100, Currency.USD);
      const converted = convertCurrency(money, Currency.USD, 1.5);

      expect(converted.amount).toBe(100);
      expect(converted.currency).toBe(Currency.USD);
      expect(converted).toBe(money); // Same reference
    });

    it('should handle fractional exchange rates', () => {
      const money = createMoney(1000, Currency.MXN);
      const converted = convertCurrency(money, Currency.USD, 0.057);

      expect(converted.amount).toBeCloseTo(57, 1);
      expect(converted.currency).toBe(Currency.USD);
    });

    it('should handle zero amount', () => {
      const money = createMoney(0, Currency.EUR);
      const converted = convertCurrency(money, Currency.USD, 1.1);

      expect(converted.amount).toBe(0);
      expect(converted.currency).toBe(Currency.USD);
    });

    it('should handle negative amounts', () => {
      const money = createMoney(-100, Currency.USD);
      const converted = convertCurrency(money, Currency.EUR, 0.9);

      expect(converted.amount).toBe(-90);
      expect(converted.currency).toBe(Currency.EUR);
    });
  });
});
