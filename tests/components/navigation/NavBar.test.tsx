import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NavBar, DEFAULT_NAV_ITEMS, isRouteActive, getNavIcon } from '../../src/components/navigation/NavBar';
import { apiClient, NavItem, UserMeResponse } from '../../src/services/apiClient';

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock apiClient calls
vi.mock('../../../src/services/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/apiClient')>();
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

describe('NavBar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders global navigation header with WCAG AA aria-label', () => {
    render(<NavBar items={DEFAULT_NAV_ITEMS} currentPath="/dashboard" />);

    const nav = screen.getByRole('navigation', { name: /global navigation/i });
    expect(nav).toBeInDocument();
  });

  it('renders direct links to all 6 core domain areas', () => {
    render(<NavBar items={DEFAULT_NAV_ITEMS} currentPath="/dashboard" />);

    const links = screen.getAllByRole('menuitem');
    const titles = links.map((link) => link.textContent);

    expect(titles).toContain('Dashboard');
    expect(titles).toContain('Performance');
    expect(titles).toContain('Contracts');
    expect(titles).toContain('Support');
    expect(titles).toContain('Financials');
    expect(titles).toContain('Knowledge Base');

    expect(screen.getByRole('menuitem', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('menuitem', { name: /performance/i })).toHaveAttribute('href', '/performance');
    expect(screen.getByRole('menuitem', { name: /contracts/i })).toHaveAttribute('href', '/contracts');
    expect(screen.getByRole('menuitem', { name: /support/i })).toHaveAttribute('href', '/support');
    expect(screen.getByRole('menuitem', { name: /financials/i })).toHaveAttribute('href', '/financials');
    expect(screen.getByRole('menuitem', { name: /knowledge base/i })).toHaveAttribute('href', '/knowledge');
  });

  it('visually and programmatically highlights the active route', () => {
    const { rerender } = render(<NavBar items={DEFAULT_NAV_ITEMS} currentPath="/dashboard" />);

    const dashboardLink = screen.getByRole('menuitem', { name: /dashboard/i });
    const contractsLink = screen.getByRole('menuitem', { name: /contracts/i });

    expect(dashboardLink).toHaveAttribute('aria-current', 'page');
    expect(contractsLink).not.toHaveAttribute('aria-current');

    rerender(<NavBar items={DEFAULT_NAV_ITEMS} currentPath="/contracts" />);

    expect(screen.getByRole('menuitem', { name: /dashboard/i })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('menuitem', { name: /contracts/i })).toHaveAttribute('aria-current', 'page');
  });

  it('filters out inaccessible navigation links based on user role authorization', () => {
    const restrictedItems: NavItem[] = [
      { title: 'Dashboard', path: '/dashboard', is_accessible: true, icon_id: 'dashboard' },
      { title: 'Performance', path: '/performance', is_accessible: true, icon_id: 'performance' },
      { title: 'Financials', path: '/financials', is_accessible: false, icon_id: 'financials' },
    ];

    render(<NavBar items={restrictedItems} currentPath="/dashboard" />);

    expect(screen.getByRole('menuitem', { name: /dashboard/i })).toBeInDocument();
    expect(screen.getByRole('menuitem', { name: /performance/i })).toBeInDocument();
    expect(screen.queryByRole('menuitem', { name: /financials/i })).not.toBeInDocument();
  });

  it('renders mobile menu toggle button and expands mobile menu on click', () => {
    render(<NavBar items={DEFAULT_NAV_ITEMS} currentPath="/dashboard" />);

    const toggleBtn = screen.getByRole('button', { name: /open navigation menu/i });
    expect(toggleBtn).toBeInDocument();
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(toggleBtn).toHaveAttribute('aria-controls', 'mobile-navigation-menu');

    // Click toggle button to open mobile menu
    fireEvent.click(toggleBtn);

    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Close navigation menu');

    const mobileMenu = screen.getByTestId('mobile-navigation-menu');
    expect(mobileMenu).toBeInDocument();

    // Verify links in mobile menu
    const mobileDashboardLink = screen.getAllByRole('link', { name: /dashboard/i })[1];
    expect(mobileDashboardLink).toBeInDocument();

    // Click link inside mobile menu to close menu
    fireEvent.click(mobileDashboardLink);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('displays user details when user prop is provided', () => {
    const mockUser: UserMeResponse = {
      user_id: 'usr-999',
      email: 'admin@company.com',
      tenant_id: 'ten-111',
      roles: ['Admin'],
    };

    render(<NavBar items={DEFAULT_NAV_ITEMS} currentPath="/dashboard" user={mockUser} />);

    expect(screen.getByText('admin@company.com')).toBeInDocument();
    expect(screen.getByText('(Admin)')).toBeInDocument();
  });

  it('triggers onLogout prop callback when logout button is clicked', () => {
    const handleLogout = vi.fn();
    render(<NavBar items={DEFAULT_NAV_ITEMS} currentPath="/dashboard" onLogout={handleLogout} />);

    const logoutButtons = screen.getAllByRole('button', { name: /log out of application/i });
    fireEvent.click(logoutButtons[0]);

    expect(handleLogout).toHaveBeenCalledTimes(1);
  });

  it('calls apiClient.removeToken when logout button clicked without onLogout prop', () => {
    render(<NavBar items={DEFAULT_NAV_ITEMS} currentPath="/dashboard" />);

    const logoutButtons = screen.getAllByRole('button', { name: /log out of application/i });
    fireEvent.click(logoutButtons[0]);

    expect(apiClient.removeToken).toHaveBeenCalled();
  });

  it('fetches navigation items and user identity automatically when props are omitted', async () => {
    render(<NavBar currentPath="/dashboard" />);

    await waitFor(() => {
      expect(apiClient.getNavigationMenu).toHaveBeenCalled();
      expect(apiClient.getMe).toHaveBeenCalled();
    });

    expect(screen.getByText('user@example.com')).toBeInDocument();
  });

  it('correctly checks active route matching helper function', () => {
    expect(isRouteActive('/dashboard', '/dashboard')).toBe(true);
    expect(isRouteActive('/dashboard/analytics', '/dashboard')).toBe(true);
    expect(isRouteActive('/contracts', '/dashboard')).toBe(false);
    expect(isRouteActive('/', '/')).toBe(true);
    expect(isRouteActive('/dashboard', '/')).toBe(false);
  });

  it('returns valid icon nodes from getNavIcon helper', () => {
    expect(getNavIcon('dashboard')).not.toBeNull();
    expect(getNavIcon('performance')).not.toBeNull();
    expect(getNavIcon('contracts')).not.toBeNull();
    expect(getNavIcon('support')).not.toBeNull();
    expect(getNavIcon('financials')).not.toBeNull();
    expect(getNavIcon('knowledge')).not.toBeNull();
    expect(getNavIcon('unknown')).toBeNull();
  });
});
