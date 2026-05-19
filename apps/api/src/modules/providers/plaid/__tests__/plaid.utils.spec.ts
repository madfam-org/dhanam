import { ProviderException, ErrorCode } from '@core/exceptions/domain-exceptions';
import { AccountType, Currency } from '@db';

import { CircuitBreakerService } from '../../orchestrator/circuit-breaker.service';
import {
  mapPlaidAccountType,
  mapPlaidCurrency,
  mapPlaidError,
  createPlaidApiWrapper,
} from '../plaid.utils';

describe('Plaid Utilities', () => {
  describe('mapPlaidAccountType', () => {
    it('should map depository to checking', () => {
      expect(mapPlaidAccountType('depository')).toBe(AccountType.checking);
    });

    it('should map credit to credit', () => {
      expect(mapPlaidAccountType('credit')).toBe(AccountType.credit);
    });

    it('should map investment to investment', () => {
      expect(mapPlaidAccountType('investment')).toBe(AccountType.investment);
    });

    it('should map unknown types to other', () => {
      expect(mapPlaidAccountType('unknown')).toBe(AccountType.other);
      expect(mapPlaidAccountType('loan')).toBe(AccountType.other);
    });

    it('should handle case-insensitive input', () => {
      expect(mapPlaidAccountType('DEPOSITORY')).toBe(AccountType.checking);
      expect(mapPlaidAccountType('Credit')).toBe(AccountType.credit);
    });
  });

  describe('mapPlaidCurrency', () => {
    it('should map MXN correctly', () => {
      expect(mapPlaidCurrency('MXN')).toBe(Currency.MXN);
      expect(mapPlaidCurrency('mxn')).toBe(Currency.MXN);
    });

    it('should map USD correctly', () => {
      expect(mapPlaidCurrency('USD')).toBe(Currency.USD);
      expect(mapPlaidCurrency('usd')).toBe(Currency.USD);
    });

    it('should map EUR correctly', () => {
      expect(mapPlaidCurrency('EUR')).toBe(Currency.EUR);
      expect(mapPlaidCurrency('eur')).toBe(Currency.EUR);
    });

    it('should default unknown currencies to USD', () => {
      expect(mapPlaidCurrency('GBP')).toBe(Currency.USD);
      expect(mapPlaidCurrency('unknown')).toBe(Currency.USD);
    });

    it('should handle null/undefined input', () => {
      expect(mapPlaidCurrency(null as unknown as string)).toBe(Currency.USD);
      expect(mapPlaidCurrency(undefined as unknown as string)).toBe(Currency.USD);
    });
  });

  describe('mapPlaidError', () => {
    it('should pass through ProviderException unchanged', () => {
      const originalError = ProviderException.authFailed('plaid', new Error('test'));
      const result = mapPlaidError(originalError, 'test');
      expect(result).toBe(originalError);
    });

    it('should map INVALID_ACCESS_TOKEN to authFailed', () => {
      const error = {
        response: {
          data: {
            error_code: 'INVALID_ACCESS_TOKEN',
            error_message: 'Invalid token',
          },
        },
      };
      const result = mapPlaidError(error, 'sync');
      expect(result.code).toBe(ErrorCode.PROVIDER_AUTH_FAILED);
    });

    it('should map ITEM_LOGIN_REQUIRED to authFailed', () => {
      const error = {
        response: {
          data: {
            error_code: 'ITEM_LOGIN_REQUIRED',
            error_message: 'Login required',
          },
        },
      };
      const result = mapPlaidError(error, 'sync');
      expect(result.code).toBe(ErrorCode.PROVIDER_AUTH_FAILED);
    });

    it('should map RATE_LIMIT_EXCEEDED to rateLimited', () => {
      const error = {
        response: {
          data: {
            error_code: 'RATE_LIMIT_EXCEEDED',
            error_message: 'Rate limited',
          },
        },
      };
      const result = mapPlaidError(error, 'sync');
      expect(result.code).toBe(ErrorCode.PROVIDER_RATE_LIMITED);
    });

    it('should map INSTITUTION_DOWN to unavailable', () => {
      const error = {
        response: {
          data: {
            error_code: 'INSTITUTION_DOWN',
            error_message: 'Bank unavailable',
          },
        },
      };
      const result = mapPlaidError(error, 'sync');
      expect(result.code).toBe(ErrorCode.PROVIDER_UNAVAILABLE);
    });

    it('should map ECONNABORTED to timeout', () => {
      const error = { code: 'ECONNABORTED' };
      const result = mapPlaidError(error, 'sync');
      expect(result.code).toBe(ErrorCode.PROVIDER_TIMEOUT);
    });

    it('should map ECONNREFUSED to unavailable', () => {
      const error = { code: 'ECONNREFUSED' };
      const result = mapPlaidError(error, 'sync');
      expect(result.code).toBe(ErrorCode.PROVIDER_UNAVAILABLE);
    });

    it('should map INTERNAL_SERVER_ERROR with timeout to timeout', () => {
      const error = {
        response: {
          data: {
            error_code: 'INTERNAL_SERVER_ERROR',
            error_message: 'Request timeout exceeded',
          },
        },
      };
      const result = mapPlaidError(error, 'sync');
      expect(result.code).toBe(ErrorCode.PROVIDER_TIMEOUT);
    });

    it('should map INTERNAL_SERVER_ERROR without timeout to generic retryable error', () => {
      const error = {
        response: {
          data: {
            error_code: 'INTERNAL_SERVER_ERROR',
            error_message: 'Something went wrong',
          },
        },
      };
      const result = mapPlaidError(error, 'sync');
      expect(result).toBeInstanceOf(ProviderException);
    });

    it('should wrap unknown errors in syncFailed', () => {
      const error = new Error('Unknown error');
      const result = mapPlaidError(error, 'sync');
      expect(result.code).toBe(ErrorCode.PROVIDER_SYNC_FAILED);
    });
  });

  describe('createPlaidApiWrapper', () => {
    let mockCircuitBreaker: jest.Mocked<CircuitBreakerService>;
    let callPlaidApi: ReturnType<typeof createPlaidApiWrapper>;

    beforeEach(() => {
      mockCircuitBreaker = {
        isCircuitOpen: jest.fn().mockResolvedValue(false),
        recordSuccess: jest.fn().mockResolvedValue(undefined),
        recordFailure: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<CircuitBreakerService>;
      callPlaidApi = createPlaidApiWrapper(mockCircuitBreaker);
    });

    it('should execute API call successfully', async () => {
      const mockResult = { data: 'test' };
      const apiCall = jest.fn().mockResolvedValue(mockResult);

      const result = await callPlaidApi('test', apiCall);

      expect(result).toEqual(mockResult);
      expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledWith('plaid', 'US');
      expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalled();
    });

    it('should throw when circuit is open', async () => {
      mockCircuitBreaker.isCircuitOpen.mockResolvedValue(true);
      const apiCall = jest.fn();

      await expect(callPlaidApi('test', apiCall)).rejects.toThrow(ProviderException);
      expect(apiCall).not.toHaveBeenCalled();
    });

    it('should record failure and rethrow on API error', async () => {
      const error = new Error('API error');
      const apiCall = jest.fn().mockRejectedValue(error);

      await expect(callPlaidApi('test', apiCall)).rejects.toThrow(ProviderException);
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled();
    });
  });
});
