import { buildAppDemoLaunchUrl } from './launch-demo';

describe('buildAppDemoLaunchUrl', () => {
  it('builds app demo URL with persona query on app subdomain', () => {
    expect(buildAppDemoLaunchUrl('https://app.dhan.am', 'guest')).toBe(
      'https://app.dhan.am/demo?persona=guest'
    );
  });

  it('strips trailing slash from app base URL', () => {
    expect(buildAppDemoLaunchUrl('https://app.dhan.am/', 'maria')).toBe(
      'https://app.dhan.am/demo?persona=maria'
    );
  });

  it('points at the persona picker (no query) when persona is omitted', () => {
    expect(buildAppDemoLaunchUrl('https://app.dhan.am')).toBe('https://app.dhan.am/demo');
    expect(buildAppDemoLaunchUrl('https://app.dhan.am/')).toBe('https://app.dhan.am/demo');
  });
});
