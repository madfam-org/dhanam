import { resolveDemoPersonaKey } from '@/components/landing/persona-config';

describe('resolveDemoPersonaKey', () => {
  it('maps landing-only personas to live demo keys', () => {
    expect(resolveDemoPersonaKey('sofia')).toBe('patricia');
    expect(resolveDemoPersonaKey('roberto')).toBe('carlos');
  });

  it('passes through core demo personas', () => {
    expect(resolveDemoPersonaKey('maria')).toBe('maria');
    expect(resolveDemoPersonaKey('diego')).toBe('diego');
  });
});
