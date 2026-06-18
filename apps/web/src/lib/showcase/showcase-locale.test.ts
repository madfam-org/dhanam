import { persistShowcaseLocale, resolveShowcaseLocaleFromSearch } from './showcase-locale';

describe('showcase-locale', () => {
  it('resolves supported locales from search params', () => {
    expect(resolveShowcaseLocaleFromSearch('es')).toBe('es');
    expect(resolveShowcaseLocaleFromSearch('pt-BR')).toBe('pt-BR');
    expect(resolveShowcaseLocaleFromSearch(null)).toBeNull();
  });

  it('persists locale to cookie and localStorage', () => {
    persistShowcaseLocale('es');
    expect(document.cookie).toContain('dhanam_locale=es');
    expect(localStorage.getItem('dhanam_locale')).toBe('es');
    expect(document.documentElement.lang).toBe('es');
  });
});
