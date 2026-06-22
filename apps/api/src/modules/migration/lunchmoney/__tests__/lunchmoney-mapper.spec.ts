jest.mock('@prisma/client', () => ({
  ...jest.requireActual('@prisma/client'),
  AccountType: {
    checking: 'checking',
    savings: 'savings',
    credit: 'credit',
    investment: 'investment',
    crypto: 'crypto',
    other: 'other',
  },
  Currency: { MXN: 'MXN', USD: 'USD', EUR: 'EUR', CAD: 'CAD' },
  Provider: { manual: 'manual' },
  RecurrenceFrequency: {
    weekly: 'weekly',
    biweekly: 'biweekly',
    monthly: 'monthly',
    quarterly: 'quarterly',
    yearly: 'yearly',
  },
}));

import { Logger } from '@nestjs/common';

import { IdMap } from '../id-map';
import {
  mapCurrency,
  mapAssetType,
  mapPlaidAccountType,
  mapRecurringCadence,
  mapAssetToAccount,
  mapPlaidAccountToAccount,
  mapCryptoToAccount,
  mapRecurringItem,
} from '../lunchmoney-mapper';
import { LMAsset, LMPlaidAccount, LMCrypto, LMRecurringItem } from '../lunchmoney-types';

describe('LunchMoney Mapper', () => {
  describe('mapCurrency', () => {
    it.each([
      ['mxn', 'MXN'],
      ['USD', 'USD'],
      ['eur', 'EUR'],
      ['CAD', 'CAD'],
    ])('maps "%s" to %s', (input, expected) => {
      expect(mapCurrency(input)).toBe(expected);
    });

    it('defaults unknown currency to MXN with a logger warning', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      const result = mapCurrency('GBP');

      expect(result).toBe('MXN');
      expect(warnSpy).toHaveBeenCalledWith('Unknown currency "GBP", defaulting to MXN');
      warnSpy.mockRestore();
    });
  });

  describe('mapAssetType', () => {
    it.each([
      ['cash', 'checking'],
      ['checking', 'checking'],
    ])('maps "%s" to checking', (input, expected) => {
      expect(mapAssetType(input)).toBe(expected);
    });

    it('maps "savings" to savings', () => {
      expect(mapAssetType('savings')).toBe('savings');
    });

    it.each([
      ['credit card', 'credit'],
      ['credit', 'credit'],
    ])('maps "%s" to credit', (input, expected) => {
      expect(mapAssetType(input)).toBe(expected);
    });

    it.each([
      ['investment', 'investment'],
      ['brokerage', 'investment'],
      ['employee compensation', 'investment'],
    ])('maps "%s" to investment', (input, expected) => {
      expect(mapAssetType(input)).toBe(expected);
    });

    it.each([
      ['cryptocurrency', 'crypto'],
      ['crypto', 'crypto'],
    ])('maps "%s" to crypto', (input, expected) => {
      expect(mapAssetType(input)).toBe(expected);
    });

    it('maps unknown type to other', () => {
      expect(mapAssetType('real estate')).toBe('other');
    });
  });

  describe('mapPlaidAccountType', () => {
    it('maps "depository" with null subtype to checking', () => {
      expect(mapPlaidAccountType('depository', null)).toBe('checking');
    });

    it('maps "depository" with "savings" subtype to savings', () => {
      expect(mapPlaidAccountType('depository', 'savings')).toBe('savings');
    });

    it('maps "credit" to credit', () => {
      expect(mapPlaidAccountType('credit')).toBe('credit');
    });

    it('maps "investment" to investment', () => {
      expect(mapPlaidAccountType('investment')).toBe('investment');
    });

    it('maps unknown type to other', () => {
      expect(mapPlaidAccountType('loan')).toBe('other');
    });
  });

  describe('mapRecurringCadence', () => {
    it.each([
      ['weekly', 'weekly'],
      ['every week', 'weekly'],
    ])('maps "%s" to weekly', (input, expected) => {
      expect(mapRecurringCadence(input)).toBe(expected);
    });

    it('maps "twice a month" to biweekly', () => {
      expect(mapRecurringCadence('twice a month')).toBe('biweekly');
    });

    it('maps "biweekly" to biweekly', () => {
      expect(mapRecurringCadence('biweekly')).toBe('biweekly');
    });

    it.each([
      ['monthly', 'monthly'],
      ['every month', 'monthly'],
    ])('maps "%s" to monthly', (input, expected) => {
      expect(mapRecurringCadence(input)).toBe(expected);
    });

    it('maps "quarterly" to quarterly', () => {
      expect(mapRecurringCadence('quarterly')).toBe('quarterly');
    });

    it('maps "every 3 months" to quarterly', () => {
      expect(mapRecurringCadence('every 3 months')).toBe('quarterly');
    });

    it.each([
      ['yearly', 'yearly'],
      ['annually', 'yearly'],
    ])('maps "%s" to yearly', (input, expected) => {
      expect(mapRecurringCadence(input)).toBe(expected);
    });

    it('defaults unknown cadence to monthly', () => {
      expect(mapRecurringCadence('something unusual')).toBe('monthly');
    });
  });

  describe('mapAssetToAccount', () => {
    it('maps all fields correctly', () => {
      const asset: LMAsset = {
        id: 42,
        type_name: 'checking',
        subtypeName: 'personal',
        name: 'Main Account',
        display_name: 'My Checking',
        balance: '1234.56',
        balance_as_of: '2025-12-01',
        currency: 'usd',
        institution_name: 'Chase',
        closed_on: null,
        created_at: '2024-01-01',
      };

      const result = mapAssetToAccount(asset);

      expect(result).toEqual({
        provider: 'manual',
        providerAccountId: 'lm-asset-42',
        name: 'My Checking',
        type: 'checking',
        subtype: 'personal',
        currency: 'USD',
        balance: 1234.56,
        institutionName: 'Chase',
        metadata: { lunchMoneyId: 42, lunchMoneyType: 'asset' },
      });
    });

    it('falls back to name when display_name is null', () => {
      const asset: LMAsset = {
        id: 1,
        type_name: 'savings',
        subtypeName: null,
        name: 'Savings Account',
        display_name: null,
        balance: '500.00',
        balance_as_of: '2025-12-01',
        currency: 'MXN',
        institution_name: null,
        closed_on: null,
        created_at: '2024-01-01',
      };

      const result = mapAssetToAccount(asset);

      expect(result.name).toBe('Savings Account');
      expect(result.subtype).toBeUndefined();
      expect(result.institutionName).toBeUndefined();
    });
  });

  describe('mapPlaidAccountToAccount', () => {
    it('maps correctly with metadata including mask and institution', () => {
      const plaid: LMPlaidAccount = {
        id: 77,
        date_linked: '2024-06-15',
        name: 'Plaid Checking',
        display_name: 'My Plaid Account',
        type: 'depository',
        subtype: 'checking',
        mask: '4321',
        institution_name: 'Wells Fargo',
        status: 'active',
        balance: '2500.00',
        currency: 'usd',
        balance_last_update: '2025-12-01',
        limit: null,
      };

      const result = mapPlaidAccountToAccount(plaid);

      expect(result).toEqual({
        provider: 'manual',
        providerAccountId: 'lm-plaid-77',
        name: 'My Plaid Account',
        type: 'checking',
        subtype: 'checking',
        currency: 'USD',
        balance: 2500.0,
        institutionName: 'Wells Fargo',
        metadata: {
          lunchMoneyId: 77,
          lunchMoneyType: 'plaid_account',
          institutionName: 'Wells Fargo',
          mask: '4321',
        },
      });
    });
  });

  describe('mapCryptoToAccount', () => {
    it('maps correctly with crypto type and source metadata', () => {
      const crypto: LMCrypto = {
        id: 99,
        zabo_account_id: null,
        source: 'coinbase',
        name: 'Bitcoin Wallet',
        display_name: 'BTC Hodl',
        balance: '0.5',
        balance_as_of: '2025-12-01',
        currency: 'usd',
        status: 'active',
        institution_name: 'Coinbase',
        created_at: '2024-03-01',
      };

      const result = mapCryptoToAccount(crypto);

      expect(result).toEqual({
        provider: 'manual',
        providerAccountId: 'lm-crypto-99-usd',
        name: 'BTC Hodl',
        type: 'crypto',
        currency: 'USD',
        balance: 0.5,
        institutionName: 'Coinbase',
        metadata: {
          lunchMoneyId: 99,
          lunchMoneyType: 'crypto',
          source: 'coinbase',
        },
      });
    });
  });

  describe('mapRecurringItem', () => {
    it('maps payee to merchantName, |amount| to expectedAmount, cadence to frequency', () => {
      const item: LMRecurringItem = {
        id: 10,
        start_date: '2024-01-01',
        end_date: null,
        cadence: 'monthly',
        payee: 'Netflix',
        amount: '-15.99',
        currency: 'usd',
        description: 'Streaming subscription',
        billing_date: '2025-01-15',
        type: 'cleared',
        original_name: null,
        source: 'plaid',
        plaid_account_id: 77,
        asset_id: null,
        transaction_id: null,
        category_id: 5,
      };

      const result = mapRecurringItem(item);

      expect(result).toEqual({
        merchantName: 'Netflix',
        expectedAmount: 15.99,
        currency: 'USD',
        frequency: 'monthly',
        notes: 'Streaming subscription',
        metadata: {
          lunchMoneyId: 10,
          lunchMoneyType: 'recurring',
          cadence: 'monthly',
          source: 'plaid',
        },
      });
    });

    it('handles positive amounts correctly', () => {
      const item: LMRecurringItem = {
        id: 20,
        start_date: '2024-01-01',
        end_date: null,
        cadence: 'every week',
        payee: 'Employer',
        amount: '2000.00',
        currency: 'MXN',
        description: null,
        billing_date: '2025-01-07',
        type: 'cleared',
        original_name: null,
        source: 'manual',
        plaid_account_id: null,
        asset_id: null,
        transaction_id: null,
        category_id: null,
      };

      const result = mapRecurringItem(item);

      expect(result.expectedAmount).toBe(2000.0);
      expect(result.frequency).toBe('weekly');
    });
  });
});

describe('IdMap', () => {
  let idMap: IdMap;

  beforeEach(() => {
    idMap = new IdMap();
  });

  describe('set/get/has', () => {
    it('stores and retrieves mappings correctly', () => {
      idMap.set('account', 42, 'uuid-abc-123');

      expect(idMap.has('account', 42)).toBe(true);
      expect(idMap.get('account', 42)).toBe('uuid-abc-123');
    });

    it('handles multiple entity types independently', () => {
      idMap.set('account', 1, 'uuid-acc-1');
      idMap.set('category', 1, 'uuid-cat-1');

      expect(idMap.get('account', 1)).toBe('uuid-acc-1');
      expect(idMap.get('category', 1)).toBe('uuid-cat-1');
    });

    it('overwrites existing mappings', () => {
      idMap.set('account', 1, 'uuid-old');
      idMap.set('account', 1, 'uuid-new');

      expect(idMap.get('account', 1)).toBe('uuid-new');
    });
  });

  describe('get', () => {
    it('returns undefined for missing LM id', () => {
      expect(idMap.get('account', 999)).toBeUndefined();
    });

    it('returns undefined for missing entity type', () => {
      expect(idMap.get('nonexistent', 1)).toBeUndefined();
    });
  });

  describe('has', () => {
    it('returns false for missing entries', () => {
      expect(idMap.has('account', 999)).toBe(false);
    });
  });

  describe('count', () => {
    it('returns 0 for missing entity type', () => {
      expect(idMap.count('nonexistent')).toBe(0);
    });

    it('returns correct count after insertions', () => {
      idMap.set('account', 1, 'uuid-1');
      idMap.set('account', 2, 'uuid-2');
      idMap.set('account', 3, 'uuid-3');

      expect(idMap.count('account')).toBe(3);
    });
  });

  describe('summary', () => {
    it('returns empty object when no entries exist', () => {
      expect(idMap.summary()).toEqual({});
    });

    it('returns all entity type counts', () => {
      idMap.set('account', 1, 'uuid-a1');
      idMap.set('account', 2, 'uuid-a2');
      idMap.set('category', 10, 'uuid-c1');
      idMap.set('tag', 5, 'uuid-t1');
      idMap.set('tag', 6, 'uuid-t2');
      idMap.set('tag', 7, 'uuid-t3');

      expect(idMap.summary()).toEqual({
        account: 2,
        category: 1,
        tag: 3,
      });
    });
  });

  describe('getAll', () => {
    it('returns empty map for missing entity type', () => {
      const result = idMap.getAll('nonexistent');

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('returns full map for entity type', () => {
      idMap.set('account', 1, 'uuid-1');
      idMap.set('account', 2, 'uuid-2');

      const result = idMap.getAll('account');

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get('1')).toBe('uuid-1');
      expect(result.get('2')).toBe('uuid-2');
    });
  });
});
