import { HttpStatus } from '@nestjs/common';

import { PaymentRequiredException } from '../exceptions/payment-required.exception';
import { SubscriptionExpiredException } from '../exceptions/subscription-expired.exception';
import { UsageLimitExceededException } from '../exceptions/usage-limit-exceeded.exception';

describe('Billing Exceptions', () => {
  describe('PaymentRequiredException', () => {
    it('should use default message when not provided', () => {
      const exception = new PaymentRequiredException();

      expect(exception.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(exception.getResponse()).toEqual({
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'Payment Required',
        message: 'This feature requires a Premium subscription',
      });
    });

    it('should use custom message when provided', () => {
      const customMessage = 'Custom payment message';
      const exception = new PaymentRequiredException(customMessage);

      expect(exception.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(exception.getResponse()).toEqual({
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'Payment Required',
        message: customMessage,
      });
    });
  });

  describe('SubscriptionExpiredException', () => {
    it('should use default message when not provided', () => {
      const exception = new SubscriptionExpiredException();

      expect(exception.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(exception.getResponse()).toEqual({
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'Subscription Expired',
        message: 'Your subscription has expired. Please renew to continue using premium features',
      });
    });

    it('should use custom message when provided', () => {
      const customMessage = 'Your subscription has expired';
      const exception = new SubscriptionExpiredException(customMessage);

      expect(exception.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(exception.getResponse()).toEqual({
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'Subscription Expired',
        message: customMessage,
      });
    });
  });

  describe('UsageLimitExceededException', () => {
    it('should use default message when not provided', () => {
      const exception = new UsageLimitExceededException();

      expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(exception.getResponse()).toMatchObject({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Usage Limit Exceeded',
      });
    });

    it('should use custom message when provided', () => {
      const customMessage = 'Custom usage limit message';
      const exception = new UsageLimitExceededException(customMessage);

      expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(exception.getResponse()).toEqual({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Usage Limit Exceeded',
        message: customMessage,
      });
    });
  });
});
