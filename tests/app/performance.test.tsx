import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PerformancePage from '../../src/app/performance/page';
import { apiClient, ApiError } from '../../src/services/apiClient';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';

const mockPush = vi.fn();

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/performance',
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

describe('PerformancePage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login if no authentication token is present', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue(null);

    render(
      <AccessibilityProvider>
        <PerformancePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders loading state initially while fetching telemetry data', () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockReturnValue(new Promise(() => {})); // pending
    vi.mocked(apiClient.getNavigationMenu).mockReturnValue(new Promise(() => {}));

    render(
      <AccessibilityProvider>
        <PerformancePage />
      </AccessibilityProvider>
    );

    const loadingContainer = screen.getByRole('status', { name: /loading performance data/i });
    expect(loadingContainer).toBeInDocument();
    expect(loadingContainer).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading system performance telemetry...')).toBeInDocument();
  });

  it('renders performance analytics page with user identity, telemetry cards, and endpoint table', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-888',
      email: 'perf.admin@example.com',
      tenant_id: 'tenant-perf-101',
      roles: ['Admin', 'ClientStandard'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({
      items: [
        { title: 'Dashboard', path: '/dashboard', is_accessible: true, icon_id: 'dashboard' },
        { title: 'Performance', path: '/performance', is_accessible: true, icon_id: 'performance' },
      ],
    });

    render(
      <AccessibilityProvider>
        <PerformancePage />
      </AccessibilityProvider>
    );

    // Wait for content to render after loading
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /system performance & telemetry/i })
      ).toBeInDocument();
    });

    // Check user context
    expect(screen.getByText('perf.admin@example.com')).toBeInDocument();
    expect(screen.getByText('tenant-perf-101')).toBeInDocument();
    expect(screen.getByText('Admin, ClientStandard')).toBeInDocument();

    // Core performance indicators check
    expect(
      screen.getByRole('heading', { level: 2, name: /core performance indicators/i })
    ).toBeInDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'RBAC Evaluation Latency' })).toBeInDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Multi-Tenant Query Overhead' })).toBeInDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Audit Pipeline Throughput' })).toBeInDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'API Response Latency (p95)' })).toBeInDocument();

    // Endpoint telemetry table check
    expect(
      screen.getByRole('heading', { level: 2, name: /protected api endpoint telemetry/i })
    ).toBeInDocument();
    expect(screen.getByText('/api/v1/auth/login')).toBeInDocument();
    expect(screen.getByText('/api/v1/auth/register')).toBeInDocument();
    expect(screen.getByText('/api/v1/auth/me')).toBeInDocument();
    expect(screen.getByText('/api/v1/navigation/menu')).toBeInDocument();

    // Architecture guarantees summary check
    expect(
      screen.getByRole('heading', { level: 2, name: /architecture & non-functional requirements summary/i })
    ).toBeInDocument();
    expect(screen.getByText('NFR-1: RBAC Overhead')).toBeInDocument();
    expect(screen.getByText('NFR-2: Audit Logging')).toBeInDocument();
  });

  it('allows filtering telemetry metrics by category', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-888',
      email: 'perf.admin@example.com',
      tenant_id: 'tenant-perf-101',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <PerformancePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /system performance & telemetry/i })
      ).toBeInDocument();
    });

    // Click RBAC Latency category filter button
    const rbacFilterBtn = screen.getByRole('button', { name: /rbac latency/i });
    fireEvent.click(rbacFilterBtn);

    // Only RBAC card should be visible, others filtered out
    expect(screen.getByRole('heading', { level: 3, name: 'RBAC Evaluation Latency' })).toBeInDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Multi-Tenant Query Overhead' })).not.toBeInDocument();

    // Click "All Metrics" to reset filter
    const allMetricsBtn = screen.getByRole('button', { name: /all metrics/i });
    fireEvent.click(allMetricsBtn);

    expect(screen.getByRole('heading', { level: 3, name: 'Multi-Tenant Query Overhead' })).toBeInDocument();
  });

  it('allows updating time window selection', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-888',
      email: 'perf.admin@example.com',
      tenant_id: 'tenant-perf-101',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <PerformancePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /system performance & telemetry/i })
      ).toBeInDocument();
    });

    const range1hBtn = screen.getByRole('button', { name: '1H' });
    fireEvent.click(range1hBtn);

    expect(range1hBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('refreshes telemetry metrics when clicking refresh button', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-888',
      email: 'perf.admin@example.com',
      tenant_id: 'tenant-perf-101',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <PerformancePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /system performance & telemetry/i })
      ).toBeInDocument();
    });

    const refreshBtn = screen.getByRole('button', { name: /refresh performance metrics/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(apiClient.getMe).toHaveBeenCalledTimes(2);
    });
  });

  it('renders error alert on API failure and allows retrying', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockRejectedValueOnce(new Error('Failed to reach backend metrics server'));

    render(
      <AccessibilityProvider>
        <PerformancePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInDocument();
      expect(screen.getByText('Failed to Load Telemetry Data')).toBeInDocument();
      expect(screen.getByText('Failed to reach backend metrics server')).toBeInDocument();
    });

    // Mock successful re-fetch
    vi.mocked(apiClient.getMe).mockResolvedValueOnce({
      user_id: 'usr-888',
      email: 'perf.retry@example.com',
      tenant_id: 'tenant-retry',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValueOnce({ items: [] });

    // Click retry button
    const retryButton = screen.getByRole('button', { name: /retry loading/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /system performance & telemetry/i })
      ).toBeInDocument();
      expect(screen.getByText('perf.retry@example.com')).toBeInDocument();
    });
  });

  it('handles 401 unauthorized error by redirecting to /login', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('invalid-token');
    vi.mocked(apiClient.getMe).mockRejectedValue(new ApiError(401, 'Unauthorized token'));

    render(
      <AccessibilityProvider>
        <PerformancePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});