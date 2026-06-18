import { getShowcaseNavForPersona, MARIA_SHOWCASE_NAV } from './hero-showcase-tours';
import { normalizeShowcaseLocale } from './protocol';

describe('hero showcase tours', () => {
  it('exposes nav items aligned with María tour routes', () => {
    expect(MARIA_SHOWCASE_NAV.map((item) => item.path)).toEqual([
      '/dashboard',
      '/transactions',
      '/budgets',
      '/analytics',
      '/goals',
    ]);
  });

  it('returns persona-specific nav rails', () => {
    expect(getShowcaseNavForPersona('patricia').some((item) => item.key === 'estatePlanning')).toBe(
      true
    );
  });
});

describe('normalizeShowcaseLocale', () => {
  it('defaults unknown values to es', () => {
    expect(normalizeShowcaseLocale(null)).toBe('es');
    expect(normalizeShowcaseLocale('fr')).toBe('es');
  });

  it('preserves supported landing locales', () => {
    expect(normalizeShowcaseLocale('en')).toBe('en');
    expect(normalizeShowcaseLocale('pt-BR')).toBe('pt-BR');
  });
});
