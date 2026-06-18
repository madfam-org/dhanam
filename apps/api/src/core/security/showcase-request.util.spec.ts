import { SHOWCASE_REQUEST_HEADER, SHOWCASE_REQUEST_HEADER_VALUE } from '@dhanam/shared';

import { isShowcaseRateLimitBypass } from './showcase-request.util';

describe('isShowcaseRateLimitBypass', () => {
  it('bypasses with showcase header and dhan.am origin', () => {
    expect(
      isShowcaseRateLimitBypass({
        headers: {
          [SHOWCASE_REQUEST_HEADER]: SHOWCASE_REQUEST_HEADER_VALUE,
          origin: 'https://dhan.am',
        },
      })
    ).toBe(true);
  });

  it('bypasses with showcase header and app.dhan.am referer', () => {
    expect(
      isShowcaseRateLimitBypass({
        headers: {
          [SHOWCASE_REQUEST_HEADER]: SHOWCASE_REQUEST_HEADER_VALUE,
          referer: 'https://app.dhan.am/embed/demo/dashboard?showcase=1',
        },
      })
    ).toBe(true);
  });

  it('bypasses with showcase header when origin/referer are absent', () => {
    expect(
      isShowcaseRateLimitBypass({
        headers: {
          [SHOWCASE_REQUEST_HEADER]: SHOWCASE_REQUEST_HEADER_VALUE,
        },
      })
    ).toBe(true);
  });

  it('does not bypass without showcase header', () => {
    expect(
      isShowcaseRateLimitBypass({
        headers: { origin: 'https://dhan.am' },
      })
    ).toBe(false);
  });

  it('does not bypass untrusted origin with showcase header', () => {
    expect(
      isShowcaseRateLimitBypass({
        headers: {
          [SHOWCASE_REQUEST_HEADER]: SHOWCASE_REQUEST_HEADER_VALUE,
          origin: 'https://evil.example',
        },
      })
    ).toBe(false);
  });
});
