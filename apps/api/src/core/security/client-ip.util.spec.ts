import { resolveClientIp } from './client-ip.util';

describe('resolveClientIp', () => {
  it('prefers cf-connecting-ip', () => {
    expect(
      resolveClientIp({
        ip: '10.0.0.1',
        headers: {
          'cf-connecting-ip': '203.0.113.10',
          'x-forwarded-for': '198.51.100.1',
        },
      })
    ).toBe('203.0.113.10');
  });

  it('falls back to first x-forwarded-for hop', () => {
    expect(
      resolveClientIp({
        ip: '10.0.0.1',
        headers: { 'x-forwarded-for': '198.51.100.2, 10.0.0.1' },
      })
    ).toBe('198.51.100.2');
  });

  it('falls back to req.ip', () => {
    expect(resolveClientIp({ ip: '10.0.0.9', headers: {} })).toBe('10.0.0.9');
  });
});
