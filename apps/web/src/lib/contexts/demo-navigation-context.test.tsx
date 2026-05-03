import { render, screen } from '@testing-library/react';
import React from 'react';

import { DemoNavigationProvider, useDemoNavigation } from './demo-navigation-context';

const mockUsePathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

function TestConsumer() {
  const { isDemoMode, demoHref, stripDemoPrefix } = useDemoNavigation();
  return (
    <div>
      <span data-testid="isDemoMode">{String(isDemoMode)}</span>
      <span data-testid="demoHref">{demoHref('/dashboard')}</span>
      <span data-testid="stripDemoPrefix">{stripDemoPrefix('/demo/accounts')}</span>
      <span data-testid="stripRoot">{stripDemoPrefix('/demo')}</span>
    </div>
  );
}

describe('DemoNavigationContext', () => {
  describe('when pathname starts with /demo', () => {
    beforeEach(() => {
      mockUsePathname.mockReturnValue('/demo/dashboard');
    });

    it('isDemoMode is true', () => {
      render(
        <DemoNavigationProvider>
          <TestConsumer />
        </DemoNavigationProvider>
      );
      expect(screen.getByTestId('isDemoMode').textContent).toBe('true');
    });

    it('demoHref prefixes paths with /demo', () => {
      render(
        <DemoNavigationProvider>
          <TestConsumer />
        </DemoNavigationProvider>
      );
      expect(screen.getByTestId('demoHref').textContent).toBe('/demo/dashboard');
    });

    it('stripDemoPrefix removes /demo prefix', () => {
      render(
        <DemoNavigationProvider>
          <TestConsumer />
        </DemoNavigationProvider>
      );
      expect(screen.getByTestId('stripDemoPrefix').textContent).toBe('/accounts');
    });

    it('stripDemoPrefix returns / when only /demo is stripped', () => {
      render(
        <DemoNavigationProvider>
          <TestConsumer />
        </DemoNavigationProvider>
      );
      expect(screen.getByTestId('stripRoot').textContent).toBe('/');
    });
  });

  describe('when pathname does not start with /demo', () => {
    beforeEach(() => {
      mockUsePathname.mockReturnValue('/dashboard');
    });

    it('isDemoMode is false', () => {
      render(
        <DemoNavigationProvider>
          <TestConsumer />
        </DemoNavigationProvider>
      );
      expect(screen.getByTestId('isDemoMode').textContent).toBe('false');
    });

    it('demoHref returns path unchanged', () => {
      render(
        <DemoNavigationProvider>
          <TestConsumer />
        </DemoNavigationProvider>
      );
      expect(screen.getByTestId('demoHref').textContent).toBe('/dashboard');
    });
  });

  describe('without provider (default context)', () => {
    it('returns non-demo defaults', () => {
      render(<TestConsumer />);
      expect(screen.getByTestId('isDemoMode').textContent).toBe('false');
      expect(screen.getByTestId('demoHref').textContent).toBe('/dashboard');
    });
  });
});
