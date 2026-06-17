import { buildContentSecurityPolicy } from './csp';

describe('buildContentSecurityPolicy', () => {
  it('denies framing for default app routes', () => {
    const policy = buildContentSecurityPolicy('app.dhan.am', 'https://api.dhan.am/v1', {
      path: '/dashboard',
    });
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain('frame-src');
  });

  it('allows marketing parents to embed /embed routes', () => {
    const policy = buildContentSecurityPolicy('app.dhan.am', 'https://api.dhan.am/v1', {
      path: '/embed/demo/dashboard',
    });
    expect(policy).toContain('frame-ancestors https://dhan.am https://www.dhan.am');
    expect(policy).not.toContain("frame-ancestors 'none'");
  });

  it('allows landing host to frame the app', () => {
    const policy = buildContentSecurityPolicy('dhan.am', 'https://api.dhan.am/v1', {
      path: '/en',
    });
    expect(policy).toContain('frame-src');
    expect(policy).toContain('https://app.dhan.am');
  });

  it('allows localhost landing to frame local app', () => {
    const policy = buildContentSecurityPolicy('localhost', 'http://localhost:4010/v1', {
      path: '/en',
    });
    expect(policy).toContain('frame-src');
    expect(policy).toContain('http://localhost:3040');
  });
});
