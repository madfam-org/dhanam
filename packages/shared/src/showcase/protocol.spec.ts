import {
  buildEmbedDemoUrl,
  isAllowedShowcaseParentOrigin,
  isShowcaseMessage,
  SHOWCASE_MESSAGE_TYPE,
  SHOWCASE_REQUEST_HEADER,
  SHOWCASE_REQUEST_HEADER_VALUE,
} from './protocol';

describe('showcase protocol', () => {
  describe('isAllowedShowcaseParentOrigin', () => {
    it('allows production marketing origins', () => {
      expect(isAllowedShowcaseParentOrigin('https://dhan.am')).toBe(true);
      expect(isAllowedShowcaseParentOrigin('https://www.dhan.am')).toBe(true);
    });

    it('allows local landing dev', () => {
      expect(isAllowedShowcaseParentOrigin('http://localhost:3040')).toBe(true);
    });

    it('allows preview landing hosts', () => {
      expect(isAllowedShowcaseParentOrigin('https://pr-42.web.preview.dhan.am')).toBe(true);
    });

    it('rejects app and arbitrary origins', () => {
      expect(isAllowedShowcaseParentOrigin('https://app.dhan.am')).toBe(false);
      expect(isAllowedShowcaseParentOrigin('https://evil.example')).toBe(false);
      expect(isAllowedShowcaseParentOrigin('not-a-url')).toBe(false);
    });
  });

  describe('isShowcaseMessage', () => {
    it('accepts typed showcase payloads', () => {
      expect(
        isShowcaseMessage({ type: SHOWCASE_MESSAGE_TYPE, event: 'ready', path: '/dashboard' })
      ).toBe(true);
      expect(
        isShowcaseMessage({ type: SHOWCASE_MESSAGE_TYPE, action: 'navigate', path: '/budgets' })
      ).toBe(true);
    });

    it('rejects unrelated payloads', () => {
      expect(isShowcaseMessage(null)).toBe(false);
      expect(isShowcaseMessage({ type: 'other', action: 'navigate' })).toBe(false);
    });
  });

  describe('buildEmbedDemoUrl', () => {
    it('builds embed demo URL with persona and showcase flag', () => {
      expect(buildEmbedDemoUrl('https://app.dhan.am', { persona: 'maria' })).toBe(
        'https://app.dhan.am/embed/demo/dashboard?persona=maria&showcase=1'
      );
    });

    it('includes locale when provided', () => {
      expect(buildEmbedDemoUrl('https://app.dhan.am', { persona: 'maria', locale: 'es' })).toBe(
        'https://app.dhan.am/embed/demo/dashboard?persona=maria&showcase=1&locale=es'
      );
    });

    it('supports custom paths', () => {
      expect(
        buildEmbedDemoUrl('https://app.dhan.am', { persona: 'patricia', path: '/assets' })
      ).toBe('https://app.dhan.am/embed/demo/assets?persona=patricia&showcase=1');
    });
  });

  describe('showcase request header', () => {
    it('exports stable header name and value for API throttle bypass', () => {
      expect(SHOWCASE_REQUEST_HEADER).toBe('x-dhanam-showcase');
      expect(SHOWCASE_REQUEST_HEADER_VALUE).toBe('1');
    });
  });
});
