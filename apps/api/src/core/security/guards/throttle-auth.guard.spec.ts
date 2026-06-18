import { SHOWCASE_REQUEST_HEADER, SHOWCASE_REQUEST_HEADER_VALUE } from '@dhanam/shared';
import { ExecutionContext } from '@nestjs/common';

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
          origin: 'https://dhan.am',
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

    it('skips throttling when showcase header is present without referer', async () => {
      const skip = await guard['shouldSkip'](
        mockContext({
          [SHOWCASE_REQUEST_HEADER]: SHOWCASE_REQUEST_HEADER_VALUE,
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

    it('does not skip showcase header from untrusted origin', async () => {
      const skip = await guard['shouldSkip'](
        mockContext({
          [SHOWCASE_REQUEST_HEADER]: SHOWCASE_REQUEST_HEADER_VALUE,
          origin: 'https://evil.example/login',
        })
      );
      expect(skip).toBe(false);
    });
  });

  describe('getTracker', () => {
    it('uses cf-connecting-ip for per-visitor tracking', async () => {
      const tracker = await guard['getTracker']({
        ip: '10.0.0.1',
        headers: { 'cf-connecting-ip': '203.0.113.44' },
      });
      expect(tracker).toBe('203.0.113.44');
    });
  });
});
