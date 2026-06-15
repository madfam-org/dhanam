import { getLandingTranslation, getTranslation, normalizeLandingLocale } from './get-translation';

describe('getTranslation', () => {
  it('resolves nested landing keys for English', () => {
    expect(getLandingTranslation('en', 'hero.title')).toContain('where your money is going');
  });

  it('falls back to Spanish when key missing in English', () => {
    expect(getTranslation('en', 'common.save')).toBeTruthy();
  });

  it('interpolates params', () => {
    expect(getLandingTranslation('en', 'footer.copyright', { year: 2026 })).toContain('2026');
  });

  it('normalizes landing locale', () => {
    expect(normalizeLandingLocale('en')).toBe('en');
    expect(normalizeLandingLocale('fr')).toBe('es');
  });
});
