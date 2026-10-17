import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RootLayout from '../../src/app/layout';

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock apiClient calls
vi.mock('../../src/services/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/apiClient')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getNavigationMenu: vi.fn().mockResolvedValue({
        items: [
          { title: 'Dashboard', path: '/dashboard', is_accessible: true, icon_id: 'dashboard' },
          { title: 'Performance', path: '/performance', is_accessible: true, icon_id: 'performance' },
          { title: 'Contracts', path: '/contracts', is_accessible: true, icon_id: 'contracts' },
          { title: 'Support', path: '/support', is_accessible: true, icon_id: 'support' },
          { title: 'Financials', path: '/financials', is_accessible: true, icon_id: 'financials' },
          { title: 'Knowledge Base', path: '/knowledge', is_accessible: true, icon_id: 'knowledge' },
        ],
      }),
      getMe: vi.fn().mockResolvedValue({
        user_id: 'usr-123',
        email: 'user@example.com',
        tenant_id: 'ten-456',
        roles: ['ClientStandard'],
      }),
      removeToken: vi.fn(),
    },
  };
});

describe('RootLayout Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children within main landmark viewport', () => {
    render(
      <RootLayout>
        <div data-testid="test-child">Dashboard Main Content</div>
      </RootLayout>
    );

    expect(screen.getByTestId('test-child')).toBeInDocument();
    expect(screen.getByText('Dashboard Main Content')).toBeInDocument();

    const mainElement = screen.getByRole('main');
    expect(mainElement).toHaveAttribute('id', 'main-content');
  });

  it('provides WCAG 2.1 AA compliant skip link to main content', () => {
    render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>
    );

    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toBeInDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('embeds persistent navigation bar component', () => {
    render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>
    );

    const nav = screen.getByRole('navigation', { name: /global navigation/i });
    expect(nav).toBeInDocument();

    // Verify presence of primary domain links
    expect(screen.getByRole('menuitem', { name: /dashboard/i })).toBeInDocument();
    expect(screen.getByRole('menuitem', { name: /performance/i })).toBeInDocument();
    expect(screen.getByRole('menuitem', { name: /contracts/i })).toBeInDocument();
    expect(screen.getByRole('menuitem', { name: /support/i })).toBeInDocument();
    expect(screen.getByRole('menuitem', { name: /financials/i })).toBeInDocument();
    expect(screen.getByRole('menuitem', { name: /knowledge base/i })).toBeInDocument();
  });

  it('embeds accessibility context with dynamic ARIA live region announcer', () => {
    render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>
    );

    const announcer = screen.getByTestId('a11y-announcer');
    expect(announcer).toBeInDocument();
    expect(announcer).toHaveAttribute('aria-live', 'polite');
  });

  it('renders persistent footer landmark with compliance information', () => {
    render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>
    );

    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInDocument();
    expect(footer).toHaveTextContent(/PairFront/i);
    expect(footer).toHaveTextContent(/WCAG 2.1 AA Compliant/i);
  });
});
