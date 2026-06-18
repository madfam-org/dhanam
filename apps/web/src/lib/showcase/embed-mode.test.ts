import { isEmbedPathname } from './embed-mode';

describe('embed-mode', () => {
  describe('isEmbedPathname', () => {
    it('returns true for embed demo routes', () => {
      expect(isEmbedPathname('/embed/demo/dashboard')).toBe(true);
      expect(isEmbedPathname('/embed/demo/assets')).toBe(true);
    });

    it('returns false for standard app routes', () => {
      expect(isEmbedPathname('/dashboard')).toBe(false);
      expect(isEmbedPathname('/en')).toBe(false);
    });
  });
});
