import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import KnowledgePage from '../../src/app/knowledge/page';
import { apiClient, ApiError } from '../../src/services/apiClient';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';

const mockPush = vi.fn();

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/knowledge',
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

describe('KnowledgePage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login if no authentication token is present', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue(null);

    render(
      <AccessibilityProvider>
        <KnowledgePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders loading state initially while fetching knowledge data', () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockReturnValue(new Promise(() => {})); // pending promise
    vi.mocked(apiClient.getNavigationMenu).mockReturnValue(new Promise(() => {}));

    render(
      <AccessibilityProvider>
        <KnowledgePage />
      </AccessibilityProvider>
    );

    const loadingContainer = screen.getByRole('status', { name: /loading knowledge base view/i });
    expect(loadingContainer).toBeInDocument();
    expect(loadingContainer).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading Knowledge Base & Documentation')).toBeInDocument();
  });

  it('renders error banner and retry button when data fetching fails', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockRejectedValue(new Error('Network connectivity issue'));
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <KnowledgePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInDocument();
    });

    expect(screen.getByText('Failed to Load Knowledge Base')).toBeInDocument();
    expect(screen.getByText('Network connectivity issue')).toBeInDocument();

    const retryButton = screen.getByRole('button', { name: /retry loading/i });
    expect(retryButton).toBeInDocument();
  });

  it('redirects to /login when getMe returns 401 Unauthorized error', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('invalid-token');
    vi.mocked(apiClient.getMe).mockRejectedValue(new ApiError(401, 'Unauthorized access'));

    render(
      <AccessibilityProvider>
        <KnowledgePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders knowledge base page with user identity, metrics, articles, search and category filters', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-kb-1',
      email: 'knowledge.user@example.com',
      tenant_id: 'tenant-kb-88',
      roles: ['ClientStandard'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({
      items: [
        { title: 'Dashboard', path: '/dashboard', is_accessible: true, icon_id: 'dashboard' },
        { title: 'Knowledge Base', path: '/knowledge', is_accessible: true, icon_id: 'knowledge' },
      ],
    });

    render(
      <AccessibilityProvider>
        <KnowledgePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /knowledge base/i })
      ).toBeInDocument();
    });

    // Verify user context card
    expect(screen.getByText('knowledge.user@example.com')).toBeInDocument();
    expect(screen.getByText('tenant-kb-88')).toBeInDocument();
    expect(screen.getByText('ClientStandard')).toBeInDocument();

    // Verify metrics
    expect(screen.getByText('Sub-20ms')).toBeInDocument();
    expect(screen.getByText('100% Isolated')).toBeInDocument();
    expect(screen.getByText('WCAG 2.1 AA')).toBeInDocument();

    // Verify articles rendered
    expect(
      screen.getByText('Server-Side RBAC Enforcement & Sub-20ms Evaluation SLA')
    ).toBeInDocument();
    expect(
      screen.getByText('Multi-Tenant Isolation & Row-Level Data Filtering')
    ).toBeInDocument();
  });

  it('filters articles by search query text', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-kb-1',
      email: 'knowledge.user@example.com',
      tenant_id: 'tenant-kb-88',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <KnowledgePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Server-Side RBAC Enforcement & Sub-20ms Evaluation SLA')
      ).toBeInDocument();
    });

    const searchInput = screen.getByRole('textbox', {
      name: /search articles by title, tag, or content/i,
    });

    // Search for "OpenAPI"
    fireEvent.change(searchInput, { target: { value: 'OpenAPI' } });

    expect(
      screen.getByText('OpenAPI 3.1 Contract Generation & Client Synchronisation')
    ).toBeInDocument();
    expect(
      screen.queryByText('Multi-Tenant Isolation & Row-Level Data Filtering')
    ).not.toBeInDocument();
  });

  it('filters articles by category dropdown and pill buttons', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-kb-1',
      email: 'knowledge.user@example.com',
      tenant_id: 'tenant-kb-88',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <KnowledgePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Server-Side RBAC Enforcement & Sub-20ms Evaluation SLA')
      ).toBeInDocument();
    });

    const categorySelect = screen.getByLabelText(/filter articles by category/i);
    fireEvent.change(categorySelect, { target: { value: 'audit' } });

    expect(
      screen.getByText('Non-Blocking Machine-Readable Audit Logging Pipeline')
    ).toBeInDocument();
    expect(
      screen.queryByText('Server-Side RBAC Enforcement & Sub-20ms Evaluation SLA')
    ).not.toBeInDocument();
  });

  it('opens and closes article detail modal', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-kb-1',
      email: 'knowledge.user@example.com',
      tenant_id: 'tenant-kb-88',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <KnowledgePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Server-Side RBAC Enforcement & Sub-20ms Evaluation SLA')
      ).toBeInDocument();
    });

    const viewArticleButtons = screen.getAllByRole('button', { name: /view full details/i });
    fireEvent.click(viewArticleButtons[0]);

    // Modal should be open
    const modal = screen.getByRole('dialog');
    expect(modal).toBeInDocument();
    expect(screen.getByText('Technical Specification Context')).toBeInDocument();

    // Close modal via close button
    const closeButton = screen.getByRole('button', { name: /close article modal/i });
    fireEvent.click(closeButton);

    expect(screen.queryByRole('dialog')).not.toBeInDocument();
  });

  it('allows marking an article as helpful and announces feedback', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-kb-1',
      email: 'knowledge.user@example.com',
      tenant_id: 'tenant-kb-88',
      roles: ['ClientViewer'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <KnowledgePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Server-Side RBAC Enforcement & Sub-20ms Evaluation SLA')
      ).toBeInDocument();
    });

    const helpfulButtons = screen.getAllByRole('button', { name: /mark article .* as helpful/i });
    fireEvent.click(helpfulButtons[0]);

    // Check live announcer updated
    const announcer = screen.getByTestId('a11y-announcer');
    expect(announcer).toHaveTextContent('Thank you for your feedback! Marked as helpful.');
  });
});
