import {
  getPublicSurfaceTier,
  isMarketingHostname,
  resolvePublicApiUrl,
  resolvePublicAppUrl,
  resolvePublicSurfacesFromHostHeader,
} from './public-surface';

describe('public-surface', () => {
  describe('getPublicSurfaceTier', () => {
    it('classifies production hosts', () => {
      expect(getPublicSurfaceTier('dhan.am')).toBe('production');
      expect(getPublicSurfaceTier('app.dhan.am')).toBe('production');
    });

    it('classifies staging hosts', () => {
      expect(getPublicSurfaceTier('staging.dhan.am')).toBe('staging');
      expect(getPublicSurfaceTier('staging-api.dhan.am')).toBe('staging');
    });

    it('classifies preview hosts', () => {
      expect(getPublicSurfaceTier('pr-42.web.preview.dhan.am')).toBe('preview');
    });
  });

  describe('resolvePublicAppUrl', () => {
    it('maps marketing apex to app.dhan.am even when build args are staging', () => {
      expect(resolvePublicAppUrl('dhan.am', 'https://staging.dhan.am')).toBe('https://app.dhan.am');
      expect(resolvePublicAppUrl('www.dhan.am', 'https://staging.dhan.am')).toBe(
        'https://app.dhan.am'
      );
    });

    it('keeps staging URLs on staging hosts', () => {
      expect(resolvePublicAppUrl('staging.dhan.am', 'https://app.dhan.am')).toBe(
        'https://staging.dhan.am'
      );
    });

    it('corrects app.dhan.am when baked URL is staging', () => {
      expect(resolvePublicAppUrl('app.dhan.am', 'https://staging.dhan.am')).toBe(
        'https://app.dhan.am'
      );
    });

    it('resolves preview app URLs from hostname', () => {
      expect(resolvePublicAppUrl('pr-7.web.preview.dhan.am', 'https://app.dhan.am')).toBe(
        'https://pr-7.web.preview.dhan.am'
      );
    });
  });

  describe('resolvePublicApiUrl', () => {
    it('maps production hosts to api.dhan.am when build args are staging', () => {
      expect(resolvePublicApiUrl('dhan.am', 'https://staging-api.dhan.am/v1')).toBe(
        'https://api.dhan.am/v1'
      );
      expect(resolvePublicApiUrl('app.dhan.am', 'https://staging-api.dhan.am/v1')).toBe(
        'https://api.dhan.am/v1'
      );
    });

    it('keeps staging API on staging hosts', () => {
      expect(resolvePublicApiUrl('staging.dhan.am', 'https://api.dhan.am/v1')).toBe(
        'https://staging-api.dhan.am/v1'
      );
    });

    it('resolves preview API URLs from hostname', () => {
      expect(resolvePublicApiUrl('pr-3.web.preview.dhan.am', 'https://api.dhan.am/v1')).toBe(
        'https://pr-3.api.preview.dhan.am/v1'
      );
    });
  });

  describe('resolvePublicSurfacesFromHostHeader', () => {
    it('strips internal service ports from forwarded host headers', () => {
      const surfaces = resolvePublicSurfacesFromHostHeader('dhan.am:4200', {
        appUrl: 'https://staging.dhan.am',
        apiUrl: 'https://staging-api.dhan.am/v1',
      });

      expect(surfaces.appUrl).toBe('https://app.dhan.am');
      expect(surfaces.apiUrl).toBe('https://api.dhan.am/v1');
    });
  });

  describe('isMarketingHostname', () => {
    it('detects apex marketing hosts only', () => {
      expect(isMarketingHostname('dhan.am')).toBe(true);
      expect(isMarketingHostname('www.dhan.am')).toBe(true);
      expect(isMarketingHostname('app.dhan.am')).toBe(false);
    });
  });
});
