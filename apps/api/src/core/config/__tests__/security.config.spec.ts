import { ConfigService } from '@nestjs/config';

import { SecurityConfigService } from '../security.config';

describe('SecurityConfigService', () => {
  function serviceWith(values: Record<string, unknown>) {
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    return new SecurityConfigService(config);
  }

  describe('getJwtExpiry', () => {
    it('prefers JWT_ACCESS_EXPIRY', () => {
      const service = serviceWith({
        JWT_ACCESS_EXPIRY: '30m',
        JWT_EXPIRES_IN: '10m',
        'jwt.accessExpiry': '5m',
      });

      expect(service.getJwtExpiry()).toBe('30m');
    });

    it('keeps JWT_EXPIRES_IN as a legacy fallback', () => {
      const service = serviceWith({
        JWT_ACCESS_EXPIRY: '',
        JWT_EXPIRES_IN: '10m',
        'jwt.accessExpiry': '5m',
      });

      expect(service.getJwtExpiry()).toBe('10m');
    });

    it('falls back to loaded config and then shared defaults', () => {
      expect(
        serviceWith({
          JWT_ACCESS_EXPIRY: ' ',
          JWT_EXPIRES_IN: '',
          'jwt.accessExpiry': '45m',
        }).getJwtExpiry()
      ).toBe('45m');

      expect(serviceWith({}).getJwtExpiry()).toBe('15m');
    });
  });
});
