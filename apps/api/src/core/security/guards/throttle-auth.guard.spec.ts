import { ExecutionContext } from '@nestjs/common';
import { SHOWCASE_REQUEST_HEADER, SHOWCASE_REQUEST_HEADER_VALUE } from '@dhanam/shared';

import { ThrottleAuthGuard } from './throttle-auth.guard';

function mockContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip: '127.0.0.1',
        headers,
        get: (name: string) => headers[name.toLowerCase()],
      }),
    }),
  } as ExecutionContext;
}

describe('ThrottleAuthGuard', () => {
  const guard = new ThrottleAuthGuard({} as never, {} as never, {} as never);

  describe('shouldSkip', () => {
    it('skips throttling for trusted showcase embed requests', async () => {
      const skip = await guard['shouldSkip'](
        mockContext({
          [SHOWCASE_REQUEST_HEADER]: SHOWCASE_REQUEST_HEADER_VALUE,
          referer: 'https://dhan.am/es',
        })
      );
      expect(skip).toBe(true);
    });

    it('skips throttling for app.dhan.am embed referer', async () => {
      const skip = await guard['shouldSkip'](
        mockContext({
          [SHOWCASE_REQUEST_HEADER]: SHOWCASE_REQUEST_HEADER_VALUE,
          referer: 'https://app.dhan.am/embed/demo/dashboard?showcase=1',
        })
      );
      expect(skip).toBe(true);
    });

    it('does not skip without showcase header', async () => {
      const skip = await guard['shouldSkip'](
        mockContext({
          referer: 'https://dhan.am/es',
        })
      );
      expect(skip).toBe(false);
    });

    it('does not skip showcase header from untrusted referer', async () => {
      const skip = await guard['shouldSkip'](
        mockContext({
          [SHOWCASE_REQUEST_HEADER]: SHOWCASE_REQUEST_HEADER_VALUE,
          referer: 'https://evil.example/login',
        })
      );
      expect(skip).toBe(false);
    });
  });
});
