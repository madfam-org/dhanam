import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';

import { EcosystemBannerClient } from './ecosystem-banner-client';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

jest.mock('@madfam/ecosystem-banner', () => ({
  EcosystemBanner: ({ testId }: { testId?: string }) => (
    <div data-testid={testId ?? 'ecosystem-banner'}>banner</div>
  ),
}));

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

describe('EcosystemBannerClient', () => {
  it('renders on standard app routes', () => {
    mockUsePathname.mockReturnValue('/dashboard');
    render(<EcosystemBannerClient />);
    expect(screen.getByTestId('ecosystem-banner')).toBeInTheDocument();
  });

  it('does not render inside embed demo routes', () => {
    mockUsePathname.mockReturnValue('/embed/demo/dashboard');
    render(<EcosystemBannerClient />);
    expect(screen.queryByTestId('ecosystem-banner')).not.toBeInTheDocument();
  });
});
