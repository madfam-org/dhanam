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
});
