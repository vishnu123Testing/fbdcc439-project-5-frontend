import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContractsPage from '../../src/app/contracts/page';
import { apiClient, ApiError } from '../../src/services/apiClient';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';

const mockPush = vi.fn();

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/contracts',
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

// Mock apiClient
vi.mock('../../src/services/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/apiClient')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getToken: vi.fn(),
      getMe: vi.fn(),
      getNavigationMenu: vi.fn(),
    },
  };
});

describe('ContractsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login if no authentication token is present', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue(null);

    render(
      <AccessibilityProvider>
        <ContractsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders loading state initially while fetching contracts data', () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockReturnValue(new Promise(() => {})); // pending
    vi.mocked(apiClient.getNavigationMenu).mockReturnValue(new Promise(() => {}));

    render(
      <AccessibilityProvider>
        <ContractsPage />
      </AccessibilityProvider>
    );

    const loadingContainer = screen.getByRole('status', { name: /loading contracts view/i });
    expect(loadingContainer).toBeInDocument();
    expect(loadingContainer).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading client contracts & agreements...')).toBeInDocument();
  });

  it('renders contracts page with user identity, statistics, table, and governance notice', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-contracts-1',
      email: 'contracts.admin@example.com',
      tenant_id: 'tenant-contracts-99',
      roles: ['Admin', 'ClientStandard'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({
      items: [
        { title: 'Dashboard', path: '/dashboard', is_accessible: true, icon_id: 'dashboard' },
        { title: 'Contracts', path: '/contracts', is_accessible: true, icon_id: 'contracts' },
      ],
    });

    render(
      <AccessibilityProvider>
        <ContractsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /contracts & scope management/i })
      ).toBeInDocument();
    });

    // Check user context
    expect(screen.getByText('contracts.admin@example.com')).toBeInDocument();
    expect(screen.getByText('tenant-contracts-99')).toBeInDocument();
    expect(screen.getByText('Admin, ClientStandard')).toBeInDocument();

    // Check stats overview
    expect(
      screen.getByRole('heading', { level: 2, name: /contract portfolio overview/i })
    ).toBeInDocument();

    // Check table content
    expect(
      screen.getByRole('heading', { level: 2, name: /client entity agreements & scopes/i })
    ).toBeInDocument();
    expect(screen.getByText('Enterprise Platform Services Agreement')).toBeInDocument();
    expect(screen.getByText('Acme Financial Corp')).toBeInDocument();
    expect(screen.getByText('Apex Systems LLC')).toBeInDocument();

    // Governance section check
    expect(
      screen.getByRole('heading', { level: 2, name: /contract governance & rbac policy/i })
    ).toBeInDocument();
  });

  it('allows searching contracts by title or client name', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-contracts-1',
      email: 'contracts.admin@example.com',
      tenant_id: 'tenant-contracts-99',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <ContractsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /contracts & scope management/i })
      ).toBeInDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search contracts, client entities, or scopes/i);
    fireEvent.change(searchInput, { target: { value: 'Acme' } });

    // Acme agreement should be in the document
    expect(screen.getByText('Enterprise Platform Services Agreement')).toBeInDocument();
    // Non-matching agreement should not be shown
    expect(screen.queryByText('Apex Systems LLC')).not.toBeInDocument();
  });

  it('allows filtering contracts by status', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-contracts-1',
      email: 'contracts.admin@example.com',
      tenant_id: 'tenant-contracts-99',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <ContractsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /contracts & scope management/i })
      ).toBeInDocument();
    });

    // Click Pending filter button
    const pendingFilterBtn = screen.getByRole('button', { name: 'Pending' });
    fireEvent.click(pendingFilterBtn);

    expect(screen.getByText('Security Architecture & Audit Scope')).toBeInDocument();
    expect(screen.queryByText('Enterprise Platform Services Agreement')).not.toBeInDocument();

    // Click All filter button to restore
    const allFilterBtn = screen.getByRole('button', { name: 'All' });
    fireEvent.click(allFilterBtn);

    expect(screen.getByText('Enterprise Platform Services Agreement')).toBeInDocument();
  });

  it('opens and closes the scope details modal when clicking View Scope', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-contracts-1',
      email: 'contracts.admin@example.com',
      tenant_id: 'tenant-contracts-99',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <ContractsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /contracts & scope management/i })
      ).toBeInDocument();
    });

    const viewScopeBtns = screen.getAllByRole('button', { name: /view scope terms for enterprise platform services agreement/i });
    fireEvent.click(viewScopeBtns[0]);

    // Modal should open
    const modalDialog = screen.getByRole('dialog');
    expect(modalDialog).toBeInDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Enterprise Platform Services Agreement' })).toBeInDocument();
    expect(screen.getByText(/multi-tenant access control system foundation with sub-20ms rbac evaluation/i)).toBeInDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /close contract details modal/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog')).not.toBeInDocument();
  });

  it('triggers a request notice when clicking Request Scope', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-contracts-1',
      email: 'contracts.admin@example.com',
      tenant_id: 'tenant-contracts-99',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <ContractsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /contracts & scope management/i })
      ).toBeInDocument();
    });

    const requestScopeBtn = screen.getByRole('button', { name: /request scope/i });
    fireEvent.click(requestScopeBtn);

    expect(screen.getByText(/contract scope request initiated for tenant context/i)).toBeInDocument();
  });

  it('refreshes contract data when clicking refresh button', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-contracts-1',
      email: 'contracts.admin@example.com',
      tenant_id: 'tenant-contracts-99',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <ContractsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /contracts & scope management/i })
      ).toBeInDocument();
    });

    const refreshBtn = screen.getByRole('button', { name: /refresh contracts data/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(apiClient.getMe).toHaveBeenCalledTimes(2);
    });
  });

  it('renders error alert on API failure and allows retrying', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockRejectedValueOnce(new Error('Failed to fetch contracts identity'));

    render(
      <AccessibilityProvider>
        <ContractsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInDocument();
      expect(screen.getByText('Failed to Load Contracts')).toBeInDocument();
      expect(screen.getByText('Failed to fetch contracts identity')).toBeInDocument();
    });

    // Mock successful retry
    vi.mocked(apiClient.getMe).mockResolvedValueOnce({
      user_id: 'usr-retry-1',
      email: 'contracts.retry@example.com',
      tenant_id: 'tenant-retry',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValueOnce({ items: [] });

    const retryBtn = screen.getByRole('button', { name: /retry loading/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /contracts & scope management/i })
      ).toBeInDocument();
      expect(screen.getByText('contracts.retry@example.com')).toBeInDocument();
    });
  });

  it('handles 401 unauthorized error by redirecting to /login', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('invalid-token');
    vi.mocked(apiClient.getMe).mockRejectedValue(new ApiError(401, 'Unauthorized token'));

    render(
      <AccessibilityProvider>
        <ContractsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('filters contracts multi-criteria by category, counterparty, and expiration [FR-11]', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-contracts-1',
      email: 'contracts.admin@example.com',
      tenant_id: 'tenant-contracts-99',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <ContractsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /contracts & scope management/i })
      ).toBeInDocument();
    });

    // 1. Filter by Category "SOW"
    const categorySelect = screen.getByLabelText(/category:/i);
    fireEvent.change(categorySelect, { target: { value: 'SOW' } });

    expect(screen.getByText('Security Architecture & Audit Scope')).toBeInDocument();
    expect(screen.queryByText('Enterprise Platform Services Agreement')).not.toBeInDocument();

    // Reset category filter
    fireEvent.change(categorySelect, { target: { value: 'all' } });

    // 2. Filter by Counterparty
    const counterpartyInput = screen.getByPlaceholderText(/filter by counterparty name/i);
    fireEvent.change(counterpartyInput, { target: { value: 'Apex' } });

    expect(screen.getByText('Data Processing & Compliance Addendum')).toBeInDocument();
    expect(screen.queryByText('Enterprise Platform Services Agreement')).not.toBeInDocument();

    // Reset counterparty filter
    fireEvent.change(counterpartyInput, { target: { value: '' } });

    // 3. Filter by Expiration Window
    const expirationSelect = screen.getByLabelText(/expiration window:/i);
    fireEvent.change(expirationSelect, { target: { value: 'expired' } });

    expect(screen.getByText('Legacy API Integration Contract')).toBeInDocument();
    expect(screen.queryByText('Enterprise Platform Services Agreement')).not.toBeInDocument();
  });
});