import { I18nProvider } from '@dhanam/shared';
import { render, screen } from '@testing-library/react';

import { ShowcaseTabletChrome } from './showcase-tablet-chrome';

jest.mock('next/navigation', () => ({
  usePathname: () => '/embed/demo/dashboard',
  useSearchParams: () => new URLSearchParams('persona=maria&showcase=1&locale=es'),
}));

jest.mock('~/lib/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { name: 'Maria González', email: 'maria@dhanam.demo' },
  }),
}));

describe('ShowcaseTabletChrome', () => {
  it('renders compact header and María nav rail in Spanish', () => {
    render(
      <I18nProvider defaultLocale="es">
        <ShowcaseTabletChrome />
      </I18nProvider>
    );
    expect(screen.getByText('Dhanam')).toBeInTheDocument();
    expect(screen.getByText('Panel')).toBeInTheDocument();
    expect(screen.getByText('Transacciones')).toBeInTheDocument();
    expect(screen.getByTitle('Panel')).toHaveAttribute('data-active', 'true');
  });
});
