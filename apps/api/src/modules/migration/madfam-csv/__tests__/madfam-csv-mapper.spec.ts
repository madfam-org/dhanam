import { SYNTHETIC_MADFAM_CSV_ROUTING } from '../madfam-csv-config';
import {
  isBusinessRfc,
  routeToSpace,
  mapAccount,
  parseAmount,
  mapAmount,
  mapDate,
  parseGroupAndCategory,
  isIncomeGroup,
  parseCsvLine,
  parseCsv,
  spaceKeyForRole,
} from '../madfam-csv-mapper';

const TEST_CONFIG = SYNTHETIC_MADFAM_CSV_ROUTING;
const BUSINESS_RFC = TEST_CONFIG.businessRfc;
const PERSONAL_RFC = 'XEXX010101000';

describe('madfam-csv-mapper', () => {
  describe('isBusinessRfc', () => {
    it('returns true for configured business RFC', () => {
      expect(isBusinessRfc(BUSINESS_RFC, TEST_CONFIG)).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isBusinessRfc(BUSINESS_RFC.toLowerCase(), TEST_CONFIG)).toBe(true);
    });

    it('trims whitespace', () => {
      expect(isBusinessRfc(` ${BUSINESS_RFC} `, TEST_CONFIG)).toBe(true);
    });

    it('returns false for personal RFC', () => {
      expect(isBusinessRfc(PERSONAL_RFC, TEST_CONFIG)).toBe(false);
    });

    it('returns false when business RFC is not configured', () => {
      expect(isBusinessRfc(BUSINESS_RFC, { ...TEST_CONFIG, businessRfc: '' })).toBe(false);
    });
  });

  describe('routeToSpace', () => {
    it('routes business RFC to business role', () => {
      expect(routeToSpace(BUSINESS_RFC, 'Gasto Deducible (Negocio)', TEST_CONFIG)).toBe('business');
    });

    it('routes personal RFC + Gasto No Deducible to personal role', () => {
      expect(routeToSpace(PERSONAL_RFC, 'Gasto No Deducible', TEST_CONFIG)).toBe('personal');
    });

    it('routes personal RFC + partner classification to partner role', () => {
      expect(routeToSpace(PERSONAL_RFC, 'Préstamo de Socio (AFAC)', TEST_CONFIG)).toBe('partner');
      expect(routeToSpace(PERSONAL_RFC, 'Gasto Deducible (Negocio)', TEST_CONFIG)).toBe('partner');
      expect(routeToSpace(PERSONAL_RFC, 'Aportación de Capital', TEST_CONFIG)).toBe('partner');
    });
  });

  describe('spaceKeyForRole', () => {
    it('returns configured space keys', () => {
      expect(spaceKeyForRole('business', TEST_CONFIG)).toBe('business-entity');
      expect(spaceKeyForRole('partner', TEST_CONFIG)).toBe('partner-entity');
      expect(spaceKeyForRole('personal', TEST_CONFIG)).toBe('personal-entity');
    });
  });

  describe('mapAccount', () => {
    it('maps BBVA Empresarial for business role (no suffix)', () => {
      const result = mapAccount('BBVA Empresarial', 'business');
      expect(result).toEqual({
        providerAccountId: 'madfam-csv-bbva-empresarial',
        name: 'BBVA Empresarial',
        type: 'checking',
      });
    });

    it('maps Banamex Joy Personal with partner suffix', () => {
      const result = mapAccount('Banamex Joy Personal', 'partner', TEST_CONFIG);
      expect(result).toEqual({
        providerAccountId: 'madfam-csv-banamex-joy-partner',
        name: 'Banamex Joy Personal',
        type: 'checking',
      });
    });

    it('maps Banamex Joy Personal with personal suffix', () => {
      const result = mapAccount('Banamex Joy Personal', 'personal');
      expect(result).toEqual({
        providerAccountId: 'madfam-csv-banamex-joy-personal',
        name: 'Banamex Joy Personal',
        type: 'checking',
      });
    });

    it('maps BBVA Azul Personal as credit', () => {
      const result = mapAccount('BBVA Azul Personal', 'partner', TEST_CONFIG);
      expect(result).toEqual({
        providerAccountId: 'madfam-csv-bbva-azul-partner',
        name: 'BBVA Azul Personal',
        type: 'credit',
      });
    });

    it('maps Banamex Oro Personal as credit', () => {
      const result = mapAccount('Banamex Oro Personal', 'personal', TEST_CONFIG);
      expect(result).toEqual({
        providerAccountId: 'madfam-csv-banamex-oro-personal',
        name: 'Banamex Oro Personal',
        type: 'credit',
      });
    });

    it('throws for unknown account name', () => {
      expect(() => mapAccount('Unknown Bank', 'partner')).toThrow(
        'Unknown Cuenta_Origen: "Unknown Bank"'
      );
    });
  });

  describe('parseAmount', () => {
    it('parses a simple number', () => {
      expect(parseAmount('100.50')).toBe(100.5);
    });

    it('strips commas from formatted numbers', () => {
      expect(parseAmount('1,614.69')).toBe(1614.69);
    });

    it('returns 0 for empty string', () => {
      expect(parseAmount('')).toBe(0);
    });

    it('returns 0 for whitespace-only string', () => {
      expect(parseAmount('   ')).toBe(0);
    });

    it('returns 0 for non-numeric string', () => {
      expect(parseAmount('abc')).toBe(0);
    });
  });

  describe('mapAmount', () => {
    it('returns positive for income-only', () => {
      expect(mapAmount('5,000.00', '0')).toBe(5000);
    });

    it('returns negative for expense-only', () => {
      expect(mapAmount('0', '1,614.69')).toBe(-1614.69);
    });

    it('returns null when both are zero', () => {
      expect(mapAmount('0', '0')).toBeNull();
    });

    it('returns null when both are empty', () => {
      expect(mapAmount('', '')).toBeNull();
    });

    it('prioritizes income when both are present', () => {
      expect(mapAmount('100', '50')).toBe(100);
    });

    it('handles comma-formatted expense', () => {
      expect(mapAmount('', '12,345.67')).toBe(-12345.67);
    });
  });

  describe('mapDate', () => {
    it('parses YYYY-MM-DD to noon UTC', () => {
      const date = mapDate('2025-03-15');
      expect(date.toISOString()).toBe('2025-03-15T12:00:00.000Z');
    });

    it('trims whitespace', () => {
      const date = mapDate('  2024-12-01  ');
      expect(date.toISOString()).toBe('2024-12-01T12:00:00.000Z');
    });

    it('throws for invalid format', () => {
      expect(() => mapDate('03/15/2025')).toThrow('Invalid date format');
    });

    it('throws for empty string', () => {
      expect(() => mapDate('')).toThrow('Invalid date format');
    });
  });

  describe('parseGroupAndCategory', () => {
    it('extracts I+D group with SaaS/AI category', () => {
      expect(parseGroupAndCategory('I+D', 'SaaS/AI')).toEqual({
        groupName: 'I+D',
        categoryName: 'SaaS/AI',
      });
    });

    it('extracts OpEx group', () => {
      expect(parseGroupAndCategory('OpEx', 'Telefonía (Telcel)')).toEqual({
        groupName: 'OpEx',
        categoryName: 'Telefonía (Telcel)',
      });
    });

    it('trims whitespace', () => {
      expect(parseGroupAndCategory('  I+D  ', '  SaaS/AI  ')).toEqual({
        groupName: 'I+D',
        categoryName: 'SaaS/AI',
      });
    });
  });

  describe('isIncomeGroup', () => {
    it('returns true for Financiamiento', () => {
      expect(isIncomeGroup('Financiamiento')).toBe(true);
    });

    it('returns false for I+D', () => {
      expect(isIncomeGroup('I+D')).toBe(false);
    });
  });

  describe('parseCsvLine', () => {
    it('splits simple comma-separated values', () => {
      expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    it('handles quoted fields with commas', () => {
      expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
    });
  });

  describe('parseCsv', () => {
    it('parses CSV content with headers', () => {
      const csv = [
        'No_Transaccion,Fecha_Operacion,Concepto_Original,Nota_Items,Ingreso,Egreso,Cuenta_Origen,RFC,Moneda_Origen,Categoria_Estrategica,Subcategoria,Clasificacion_Contable,Mes_Corte',
        `1,2025-01-15,OpenAI,ChatGPT Pro,0,"1,614.69",BBVA Empresarial,${BUSINESS_RFC},USD,I+D,SaaS/AI,Gasto Deducible (Negocio),Enero 2025`,
      ].join('\n');

      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0].RFC).toBe(BUSINESS_RFC);
      expect(rows[0].Cuenta_Origen).toBe('BBVA Empresarial');
    });

    it('returns empty array for content with only headers', () => {
      expect(parseCsv('No_Transaccion,Fecha_Operacion')).toHaveLength(0);
    });
  });
});
