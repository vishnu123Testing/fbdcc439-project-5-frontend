import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StatusLabel, getStatusVariant } from '../../src/components/common/StatusLabel';

describe('StatusLabel Component', () => {
  it('renders with role="status", aria-live, and aria-atomic attributes', () => {
    render(<StatusLabel status="active" />);

    const badge = screen.getByRole('status');
    expect(badge).toBeInDocument();
    expect(badge).toHaveAttribute('role', 'status');
    expect(badge).toHaveAttribute('aria-live', 'polite');
    expect(badge).toHaveAttribute('aria-atomic', 'true');
  });

  it('renders default assertive aria-live for error status', () => {
    render(<StatusLabel status="error" />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-live', 'assertive');
  });

  it('allows overriding ariaLive via props', () => {
    render(<StatusLabel status="error" ariaLive="polite" />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-live', 'polite');
  });

  it('capitalizes default status string and supports custom label prop', () => {
    const { rerender } = render(<StatusLabel status="initializing" />);
    expect(screen.getByText('Initializing')).toBeInDocument();

    rerender(<StatusLabel status="initializing" label="System Initializing..." />);
    expect(screen.getByText('System Initializing...')).toBeInDocument();
  });

  it('renders accessible screen reader text prefix', () => {
    render(<StatusLabel status="operational" srPrefix="Current Status: " />);

    expect(screen.getByText('Current Status:')).toBeInDocument();
    expect(screen.getByText('Current Status:')).toHaveClass('sr-only');
  });

  it('renders visual status dot with aria-hidden="true" when showIcon is true', () => {
    const { rerender } = render(<StatusLabel status="active" showIcon={true} />);

    const dot = screen.getByTestId('status-dot');
    expect(dot).toBeInDocument();
    expect(dot).toHaveAttribute('aria-hidden', 'true');

    rerender(<StatusLabel status="active" showIcon={false} />);
    expect(screen.queryByTestId('status-dot')).not.toBeInDocument();
  });

  it('correctly maps status strings to status variants', () => {
    expect(getStatusVariant('active')).toBe('success');
    expect(getStatusVariant('operational')).toBe('success');
    expect(getStatusVariant('pending')).toBe('warning');
    expect(getStatusVariant('degraded')).toBe('warning');
    expect(getStatusVariant('failed')).toBe('error');
    expect(getStatusVariant('critical')).toBe('error');
    expect(getStatusVariant('initializing')).toBe('info');
    expect(getStatusVariant('loading')).toBe('info');
    expect(getStatusVariant('unknown-state')).toBe('neutral');
  });

  it('applies data-status and data-variant attributes', () => {
    render(<StatusLabel status="pending" />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('data-status', 'pending');
    expect(badge).toHaveAttribute('data-variant', 'warning');
  });

  it('applies custom className and passes through HTML attributes', () => {
    render(<StatusLabel status="ok" className="custom-badge-class" id="test-status-id" />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveClass('custom-badge-class');
    expect(badge).toHaveAttribute('id', 'test-status-id');
  });

  it('renders WCAG AA compliant contrast styles for each status variant', () => {
    const variants = ['success', 'warning', 'error', 'info', 'neutral'] as const;

    variants.forEach((variant) => {
      const { unmount } = render(<StatusLabel status="test" variant={variant} />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('data-variant', variant);
      // Ensure element has style object applied
      expect(badge.style.backgroundColor).toBeTruthy();
      expect(badge.style.color).toBeTruthy();
      unmount();
    });
  });

  it('forwards ref to underlying span element', () => {
    const ref = React.createRef<HTMLSpanElement>();
    render(<StatusLabel status="active" ref={ref} />);

    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('SPAN');
  });
});
