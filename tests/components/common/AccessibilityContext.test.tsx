import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  AccessibilityProvider,
  useAccessibility,
} from '../../../src/components/common/AccessibilityContext';

const TestComponent: React.FC = () => {
  const { announcement, announce, clearAnnouncement } = useAccessibility();

  return (
    <div>
      <p data-testid="msg">{announcement?.message || 'No announcement'}</p>
      <button onClick={() => announce('Page loaded', 'polite')}>Announce Polite</button>
      <button onClick={() => announce('Error occurred', 'assertive')}>Announce Assertive</button>
      <button onClick={clearAnnouncement}>Clear</button>
    </div>
  );
};

describe('AccessibilityContext', () => {
  it('throws an error if useAccessibility is used outside of AccessibilityProvider', () => {
    // Suppress console.error for expected error boundary test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestComponent />)).toThrow(
      'useAccessibility must be used within an AccessibilityProvider'
    );

    consoleSpy.mockRestore();
  });

  it('provides default state and updates announcements', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    expect(screen.getByTestId('msg')).toHaveTextContent('No announcement');
    expect(screen.getByTestId('a11y-announcer')).toHaveTextContent('');

    // Trigger polite announcement
    act(() => {
      screen.getByText('Announce Polite').click();
    });

    expect(screen.getByTestId('msg')).toHaveTextContent('Page loaded');
    expect(screen.getByTestId('a11y-announcer')).toHaveTextContent('Page loaded');
    expect(screen.getByTestId('a11y-announcer')).toHaveAttribute('aria-live', 'polite');

    // Trigger assertive announcement
    act(() => {
      screen.getByText('Announce Assertive').click();
    });

    expect(screen.getByTestId('msg')).toHaveTextContent('Error occurred');
    expect(screen.getByTestId('a11y-announcer')).toHaveTextContent('Error occurred');
    expect(screen.getByTestId('a11y-announcer')).toHaveAttribute('aria-live', 'assertive');

    // Clear announcement
    act(() => {
      screen.getByText('Clear').click();
    });

    expect(screen.getByTestId('msg')).toHaveTextContent('No announcement');
    expect(screen.getByTestId('a11y-announcer')).toHaveTextContent('');
  });
});
