import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SupportPage from '../../src/app/support/page';
import { apiClient, ApiError } from '../../src/services/apiClient';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';

const mockPush = vi.fn();

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/support',
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

describe('SupportPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login if no authentication token is present', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue(null);

    render(
      <AccessibilityProvider>
        <SupportPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders loading state initially while fetching support data', () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockReturnValue(new Promise(() => {})); // pending promise
    vi.mocked(apiClient.getNavigationMenu).mockReturnValue(new Promise(() => {}));

    render(
      <AccessibilityProvider>
        <SupportPage />
      </AccessibilityProvider>
    );

    const loadingContainer = screen.getByRole('status', { name: /loading support view/i });
    expect(loadingContainer).toBeInDocument();
    expect(loadingContainer).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading support & operations portal...')).toBeInDocument();
  });

  it('renders error banner and retry button when data fetching fails', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockRejectedValue(new Error('Network connectivity issue'));
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <SupportPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInDocument();
    });

    expect(screen.getByText('Failed to Load Support Portal')).toBeInDocument();
    expect(screen.getByText('Network connectivity issue')).toBeInDocument();

    const retryButton = screen.getByRole('button', { name: /retry loading/i });
    expect(retryButton).toBeInDocument();
  });

  it('redirects to /login when getMe returns 401 Unauthorized error', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('invalid-token');
    vi.mocked(apiClient.getMe).mockRejectedValue(new ApiError('Unauthorized access', 401));

    render(
      <AccessibilityProvider>
        <SupportPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders support portal with user identity, operational health, ticket table, and FAQ accordion', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-support-100',
      email: 'support.user@example.com',
      tenant_id: 'tenant-support-88',
      roles: ['ClientStandard', 'ClientViewer'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({
      items: [
        { title: 'Dashboard', path: '/dashboard', is_accessible: true, icon_id: 'dashboard' },
        { title: 'Support', path: '/support', is_accessible: true, icon_id: 'support' },
      ],
    });

    render(
      <AccessibilityProvider>
        <SupportPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /support & operations portal/i })
      ).toBeInDocument();
    });

    // Verify user session details
    expect(screen.getByText('support.user@example.com')).toBeInDocument();
    expect(screen.getByText('tenant-support-88')).toBeInDocument();
    expect(screen.getByText('ClientStandard, ClientViewer')).toBeInDocument();

    // Verify System Operational Status section
    expect(screen.getByText('System Operational Status')).toBeInDocument();
    expect(screen.getByText('RBAC Access Gate')).toBeInDocument();
    expect(screen.getByText('Multi-Tenant Isolation Gate')).toBeInDocument();

    // Verify initial tickets in table
    expect(screen.getByText('TKT-2026-001')).toBeInDocument();
    expect(screen.getByText('RBAC Evaluation Latency Consultation')).toBeInDocument();
    expect(screen.getByText('TKT-2026-003')).toBeInDocument();

    // Verify FAQ items
    expect(
      screen.getByText('How does the platform enforce sub-20ms RBAC evaluation overhead?')
    ).toBeInDocument();
  });

  it('filters support tickets by status and search query', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-1',
      email: 'user@example.com',
      tenant_id: 'tenant-1',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <SupportPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-001')).toBeInDocument();
    });

    // Filter by 'Resolved' status
    const resolvedButton = screen.getByRole('button', { name: /^resolved$/i });
    fireEvent.click(resolvedButton);

    // TKT-2026-002 is resolved; TKT-2026-001 is in_progress so shouldn't be in document
    expect(screen.getByText('TKT-2026-002')).toBeInDocument();
    expect(screen.queryByText('TKT-2026-001')).not.toBeInDocument();

    // Reset status filter to 'All'
    const allButton = screen.getByRole('button', { name: /^all$/i });
    fireEvent.click(allButton);
    expect(screen.getByText('TKT-2026-001')).toBeInDocument();

    // Search query test
    const searchInput = screen.getByLabelText(/search support tickets/i);
    fireEvent.change(searchInput, { target: { value: 'Correlation ID' } });

    expect(screen.getByText('TKT-2026-002')).toBeInDocument();
    expect(screen.queryByText('TKT-2026-001')).not.toBeInDocument();
  });

  it('opens ticket details, navigates to detail route', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-1',
      email: 'user@example.com',
      tenant_id: 'tenant-1',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <SupportPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-001')).toBeInDocument();
    });

    // Click "View Details" on first ticket
    const viewButtons = screen.getAllByRole('button', { name: /view details for ticket tkt-2026-001/i });
    fireEvent.click(viewButtons[0]);

    expect(mockPush).toHaveBeenCalledWith('/support/sup-101');
  });

  it('opens submit support ticket modal and adds a new ticket upon form submission', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-1',
      email: 'user@example.com',
      tenant_id: 'tenant-1',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <SupportPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit support ticket/i })).toBeInDocument();
    });

    // Open create ticket modal
    fireEvent.click(screen.getByRole('button', { name: /submit support ticket/i }));

    expect(screen.getByRole('dialog')).toBeInDocument();
    expect(screen.getByRole('heading', { level: 3, name: /submit support ticket/i })).toBeInDocument();

    // Fill form
    const subjectInput = screen.getByLabelText(/subject \/ summary \*/i);
    const categorySelect = screen.getByLabelText(/category/i);
    const prioritySelect = screen.getByLabelText(/priority level/i);
    const descriptionTextarea = screen.getByLabelText(/description \/ context \*/i);

    fireEvent.change(subjectInput, { target: { value: 'Custom Role Perms Escalation' } });
    fireEvent.change(categorySelect, { target: { value: 'rbac_access' } });
    fireEvent.change(prioritySelect, { target: { value: 'high' } });
    fireEvent.change(descriptionTextarea, {
      target: { value: 'Requesting permission scope adjustment for ClientViewer role.' },
    });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /submit request/i });
    fireEvent.click(submitButton);

    // Modal closes and new ticket appears in list
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInDocument();
    });

    expect(screen.getByText('Custom Role Perms Escalation')).toBeInDocument();
    expect(screen.getByText(/created successfully and queued for review/i)).toBeInDocument();
  });

  it('expands FAQ items when clicked', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-1',
      email: 'user@example.com',
      tenant_id: 'tenant-1',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <SupportPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText('How does the platform enforce sub-20ms RBAC evaluation overhead?')
      ).toBeInDocument();
    });

    const faqButton = screen.getByRole('button', {
      name: /how does the platform enforce sub-20ms rbac evaluation overhead\?/i,
    });

    expect(faqButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(faqButton);

    expect(faqButton).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText(/the backend evaluates role-based access control policies synchronously/i)
    ).toBeInDocument();
  });
});
