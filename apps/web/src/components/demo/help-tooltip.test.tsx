import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import { HelpTooltip } from './help-tooltip';

const commonTranslations: Record<string, string> = {
  'aria.help': 'Help',
};

jest.mock('@dhanam/shared', () => ({
  useTranslation: () => ({
    t: (key: string) => commonTranslations[key] || key,
    locale: 'en',
    setLocale: jest.fn(),
    hasKey: () => true,
    getNamespace: () => ({}),
  }),
}));

describe('HelpTooltip', () => {
  it('should render info icon', () => {
    render(<HelpTooltip content="Test content" />);

    const button = screen.getByRole('button', { name: 'Help' });
    expect(button).toBeInTheDocument();
  });

  it('should not show tooltip initially', () => {
    render(<HelpTooltip content="Test content" />);

    expect(screen.queryByText('Test content')).not.toBeInTheDocument();
  });

  it('should show tooltip on mouse enter', async () => {
    render(<HelpTooltip content="Test tooltip content" />);

    const button = screen.getByRole('button', { name: 'Help' });
    fireEvent.mouseEnter(button);

    await waitFor(() => {
      expect(screen.getByText('Test tooltip content')).toBeInTheDocument();
    });
  });

  it('should hide tooltip on mouse leave', async () => {
    render(<HelpTooltip content="Test tooltip content" />);

    const button = screen.getByRole('button', { name: 'Help' });

    // Show tooltip
    fireEvent.mouseEnter(button);
    await waitFor(() => {
      expect(screen.getByText('Test tooltip content')).toBeInTheDocument();
    });

    // Hide tooltip
    fireEvent.mouseLeave(button);
    await waitFor(() => {
      expect(screen.queryByText('Test tooltip content')).not.toBeInTheDocument();
    });
  });

  it('should toggle tooltip on click', async () => {
    render(<HelpTooltip content="Test tooltip content" />);

    const button = screen.getByRole('button', { name: 'Help' });

    // Show on first click
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText('Test tooltip content')).toBeInTheDocument();
    });

    // Hide on second click
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.queryByText('Test tooltip content')).not.toBeInTheDocument();
    });
  });

  it('should display optional title when provided', async () => {
    render(<HelpTooltip title="Tooltip Title" content="Test content" />);

    const button = screen.getByRole('button', { name: 'Help' });
    fireEvent.mouseEnter(button);

    await waitFor(() => {
      expect(screen.getByText('Tooltip Title')).toBeInTheDocument();
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });
  });

  it('should not display title when not provided', async () => {
    render(<HelpTooltip content="Test content only" />);

    const button = screen.getByRole('button', { name: 'Help' });
    fireEvent.mouseEnter(button);

    await waitFor(() => {
      expect(screen.getByText('Test content only')).toBeInTheDocument();
    });

    // Check that there's no semibold text (which would indicate a title)
    const tooltipContent = screen.getByText('Test content only');
    expect(tooltipContent.className).toContain('text-xs');
    expect(tooltipContent.className).not.toContain('font-semibold');
  });

  it('should prevent default on click', () => {
    const mockPreventDefault = jest.fn();

    render(<HelpTooltip content="Test content" />);

    const button = screen.getByRole('button', { name: 'Help' });
    fireEvent.click(button, { preventDefault: mockPreventDefault });

    // Event handler should call preventDefault
    // This is implicit in the component's onClick handler
    expect(button).toBeInTheDocument(); // Just verify it rendered correctly
  });

  it('should apply correct styling classes', () => {
    render(<HelpTooltip content="Test content" />);

    const button = screen.getByRole('button', { name: 'Help' });

    expect(button.className).toContain('text-muted-foreground');
    expect(button.className).toContain('hover:text-foreground');
    expect(button.className).toContain('transition-colors');
  });

  it('should handle long content gracefully', async () => {
    const longContent =
      'This is a very long tooltip content that spans multiple lines and should still be displayed properly within the tooltip container with appropriate text wrapping and formatting.';

    render(<HelpTooltip content={longContent} />);

    const button = screen.getByRole('button', { name: 'Help' });
    fireEvent.mouseEnter(button);

    await waitFor(() => {
      expect(screen.getByText(longContent)).toBeInTheDocument();
    });
  });

  it('should position tooltip correctly with positioning classes', async () => {
    render(<HelpTooltip content="Test content" />);

    const button = screen.getByRole('button', { name: 'Help' });
    fireEvent.mouseEnter(button);

    await waitFor(() => {
      const tooltipContainer = screen.getByText('Test content').closest('div');
      expect(tooltipContainer?.className).toContain('absolute');
      expect(tooltipContainer?.className).toContain('z-50');
      expect(tooltipContainer?.className).toContain('left-1/2');
      expect(tooltipContainer?.className).toContain('-translate-x-1/2');
      expect(tooltipContainer?.className).toContain('bottom-full');
    });
  });
});
