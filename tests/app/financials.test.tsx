import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FinancialsPage from '../../src/app/financials/page';
import { apiClient, ApiError } from '../../src/services/apiClient';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';

const mockPush = vi.fn();

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/financials',
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

describe('FinancialsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login if no authentication token is present', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue(null);

    render(
      <AccessibilityProvider>
        <FinancialsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders loading state initially while fetching financials data', () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockReturnValue(new Promise(() => {})); // pending promise
    vi.mocked(apiClient.getNavigationMenu).mockReturnValue(new Promise(() => {}));

    render(
      <AccessibilityProvider>
        <FinancialsPage />
      </AccessibilityProvider>
    );

    const loadingContainer = screen.getByRole('status', { name: /loading financials view/i });
    expect(loadingContainer).toBeInDocument();
    expect(loadingContainer).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading financial records & billing ledger...')).toBeInDocument();
  });

  it('renders financials page with user identity, summary metrics, ledger table, and governance notice', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-fin-1',
      email: 'fin.admin@example.com',
      tenant_id: 'tenant-fin-77',
      roles: ['Admin', 'ClientStandard'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({
      items: [
        { title: 'Dashboard', path: '/dashboard', is_accessible: true, icon_id: 'dashboard' },
        { title: 'Financials', path: '/financials', is_accessible: true, icon_id: 'financials' },
      ],
    });

    render(
      <AccessibilityProvider>
        <FinancialsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /financials & tenant billing/i })
      ).toBeInDocument();
    });

    // Check user context
    expect(screen.getByText('fin.admin@example.com')).toBeInDocument();
    expect(screen.getByText('tenant-fin-77')).toBeInDocument();
    expect(screen.getByText('Admin, ClientStandard')).toBeInDocument();

    // Check stats summary
    expect(
      screen.getByRole('heading', { level: 2, name: /financial portfolio summary/i })
    ).toBeInDocument();

    // Check table content
    expect(
      screen.getByRole('heading', { level: 2, name: /tenant billing ledger & transactions/i })
    ).toBeInDocument();
    expect(screen.getByText('TXN-2026-001')).toBeInDocument();
    expect(screen.getByText('Annual Enterprise Platform Licensing')).toBeInDocument();
    expect(screen.getByText('Acme Financial Corp')).toBeInDocument();

    // Governance section check
    expect(
      screen.getByRole('heading', { level: 2, name: /financial governance & audit logging specification/i })
    ).toBeInDocument();
  });

  it('allows searching transactions by description, transaction ID, or client entity', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-fin-1',
      email: 'fin.admin@example.com',
      tenant_id: 'tenant-fin-77',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <FinancialsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /financials & tenant billing/i })
      ).toBeInDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search transactions, client entities, or correlation ids/i);
    fireEvent.change(searchInput, { target: { value: 'Apex' } });

    // Apex transaction should be in document
    expect(screen.getByText('Apex Systems LLC')).toBeInDocument();
    expect(screen.getByText('TXN-2026-002')).toBeInDocument();
    // Non-matching transaction should not be shown
    expect(screen.queryByText('TXN-2026-001')).not.toBeInDocument();
  });

  it('allows filtering transactions by category and status', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-fin-1',
      email: 'fin.admin@example.com',
      tenant_id: 'tenant-fin-77',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <FinancialsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /financials & tenant billing/i })
      ).toBeInDocument();
    });

    // Click Category filter: "Audit Service"
    const auditServiceCatBtn = screen.getByRole('button', { name: 'Audit Service' });
    fireEvent.click(auditServiceCatBtn);

    expect(screen.getByText('TXN-2026-002')).toBeInDocument();
    expect(screen.queryByText('TXN-2026-001')).not.toBeInDocument();

    // Click Category filter: "All"
    const allCatBtn = screen.getAllByRole('button', { name: 'All' })[0];
    fireEvent.click(allCatBtn);

    expect(screen.getByText('TXN-2026-001')).toBeInDocument();

    // Click Status filter: "pending"
    const pendingStatusBtn = screen.getByRole('button', { name: 'pending' });
    fireEvent.click(pendingStatusBtn);

    expect(screen.getByText('TXN-2026-003')).toBeInDocument();
    expect(screen.queryByText('TXN-2026-001')).not.toBeInDocument();
  });

  it('opens and closes the transaction details modal when clicking Details', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-fin-1',
      email: 'fin.admin@example.com',
      tenant_id: 'tenant-fin-77',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <FinancialsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /financials & tenant billing/i })
      ).toBeInDocument();
    });

    const detailsBtns = screen.getAllByRole('button', { name: /view ledger details for transaction txn-2026-001/i });
    fireEvent.click(detailsBtns[0]);

    // Modal should open
    const modalDialog = screen.getByRole('dialog');
    expect(modalDialog).toBeInDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Annual Enterprise Platform Licensing' })).toBeInDocument();

    // Download receipt button inside modal
    const downloadReceiptBtn = screen.getByRole('button', { name: /download audit receipt/i });
    fireEvent.click(downloadReceiptBtn);
    expect(screen.getByText(/audit-logged receipt generated for transaction txn-2026-001/i)).toBeInDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /close transaction details modal/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog')).not.toBeInDocument();
  });

  it('triggers action notice when clicking Request Invoice or Export Statement', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-fin-1',
      email: 'fin.admin@example.com',
      tenant_id: 'tenant-fin-77',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <FinancialsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /financials & tenant billing/i })
      ).toBeInDocument();
    });

    const requestInvoiceBtn = screen.getByRole('button', { name: /request invoice/i });
    fireEvent.click(requestInvoiceBtn);
    expect(screen.getByText(/invoice request generated under tenant context/i)).toBeInDocument();

    const exportStatementBtn = screen.getByRole('button', { name: /export statement/i });
    fireEvent.click(exportStatementBtn);
    expect(screen.getByText(/tenant financial statement export initiated/i)).toBeInDocument();
  });

  it('refreshes financials data when clicking refresh button', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-fin-1',
      email: 'fin.admin@example.com',
      tenant_id: 'tenant-fin-77',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <FinancialsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /financials & tenant billing/i })
      ).toBeInDocument();
    });

    const refreshBtn = screen.getByRole('button', { name: /refresh financials data/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(apiClient.getMe).toHaveBeenCalledTimes(2);
    });
  });

  it('renders error alert on API failure and allows retrying', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockRejectedValueOnce(new Error('Failed to fetch financials identity'));

    render(
      <AccessibilityProvider>
        <FinancialsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInDocument();
      expect(screen.getByText('Failed to Load Financials')).toBeInDocument();
      expect(screen.getByText('Failed to fetch financials identity')).toBeInDocument();
    });

    // Mock successful retry
    vi.mocked(apiClient.getMe).mockResolvedValueOnce({
      user_id: 'usr-retry-fin',
      email: 'financials.retry@example.com',
      tenant_id: 'tenant-retry-fin',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValueOnce({ items: [] });

    const retryBtn = screen.getByRole('button', { name: /retry loading/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /financials & tenant billing/i })
      ).toBeInDocument();
      expect(screen.getByText('financials.retry@example.com')).toBeInDocument();
    });
  });

  it('handles 401 unauthorized error by redirecting to /login', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('invalid-token');
    vi.mocked(apiClient.getMe).mockRejectedValue(new ApiError(401, 'Unauthorized token'));

    render(
      <AccessibilityProvider>
        <FinancialsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});