import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardPage from '../../src/app/dashboard/page';
import { apiClient, ApiError } from '../../src/services/apiClient';
import { getDashboardSummary, getDomainDrilldown } from '../../src/services/dashboard';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';

const mockPush = vi.fn();

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
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

// Mock dashboard service
vi.mock('../../src/services/dashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/dashboard')>();
  return {
    ...actual,
    getDashboardSummary: vi.fn(),
    getDomainDrilldown: vi.fn(),
  };
});

const sampleSummary = {
  status: 'COMPLETE' as const,
  generated_at: '2026-10-06T12:00:00.000Z',
  metrics: [
    {
      domain: 'lead_gen',
      metric_key: 'qualified_leads',
      display_name: 'Qualified Leads',
      formatted_value: '1,250',
      raw_value: 1250,
      baseline_value: 1100,
      percentage_change: 13.6,
      status: 'VALID' as const,
      unit: 'count',
      error_detail: null,
    },
    {
      domain: 'sales_pipeline',
      metric_key: 'pipeline_value',
      display_name: 'Pipeline Value',
      formatted_value: '$450,000',
      raw_value: 450000,
      baseline_value: 400000,
      percentage_change: 12.5,
      status: 'VALID' as const,
      unit: 'currency',
      error_detail: null,
    },
    {
      domain: 'support',
      metric_key: 'open_tickets',
      display_name: 'Open Tickets',
      formatted_value: '0',
      raw_value: 0,
      baseline_value: 5,
      percentage_change: -100,
      status: 'ZERO' as const,
      unit: 'count',
      error_detail: null,
    },
    {
      domain: 'financials',
      metric_key: 'recurring_revenue',
      display_name: 'Recurring Revenue',
      formatted_value: '$125,000',
      raw_value: 125000,
      baseline_value: 120000,
      percentage_change: 4.1,
      status: 'VALID' as const,
      unit: 'currency',
      error_detail: null,
    },
  ],
};

const sampleDomainDrilldown = {
  domain: 'lead_gen',
  status: 'COMPLETE' as const,
  detailed_metrics: [
    {
      domain: 'lead_gen',
      metric_key: 'conversion_rate',
      display_name: 'Lead Conversion Rate',
      formatted_value: '4.2%',
      raw_value: 4.2,
      baseline_value: 3.8,
      percentage_change: 10.5,
      status: 'VALID' as const,
      unit: 'percentage',
      error_detail: null,
    },
  ],
  breakdown_items: [
    { label: 'Inbound Search', value: 45 },
    { label: 'Outbound Referral', value: 35 },
  ],
  error_detail: null,
};

describe('DashboardPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDashboardSummary).mockResolvedValue(sampleSummary);
    vi.mocked(getDomainDrilldown).mockResolvedValue(sampleDomainDrilldown);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('redirects to /login if no authentication token is present', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue(null);

    render(
      <AccessibilityProvider>
        <DashboardPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders loading state initially while fetching data', () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockReturnValue(new Promise(() => {})); // pending
    vi.mocked(apiClient.getNavigationMenu).mockReturnValue(new Promise(() => {}));

    render(
      <AccessibilityProvider>
        <DashboardPage />
      </AccessibilityProvider>
    );

    const loadingContainer = screen.getByRole('status', { name: /loading dashboard content/i });
    expect(loadingContainer).toBeInDocument();
    expect(loadingContainer).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading platform dashboard data...')).toBeInDocument();
  });

  it('renders authenticated dashboard page with user details, KPI summary cards, and domain links', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-999',
      email: 'admin@example.com',
      tenant_id: 'tenant-123',
      roles: ['Admin', 'ClientStandard'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({
      items: [
        { title: 'Dashboard', path: '/dashboard', is_accessible: true, icon_id: 'dashboard' },
        { title: 'Performance', path: '/performance', is_accessible: true, icon_id: 'performance' },
        { title: 'Contracts', path: '/contracts', is_accessible: true, icon_id: 'contracts' },
        { title: 'Support', path: '/support', is_accessible: true, icon_id: 'support' },
        { title: 'Financials', path: '/financials', is_accessible: true, icon_id: 'financials' },
        { title: 'Knowledge Base', path: '/knowledge', is_accessible: true, icon_id: 'knowledge' },
      ],
    });

    render(
      <AccessibilityProvider>
        <DashboardPage />
      </AccessibilityProvider>
    );

    // Wait for content to render after loading
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /platform dashboard/i })).toBeInDocument();
    });

    // User context check
    expect(screen.getByText('admin@example.com')).toBeInDocument();
    expect(screen.getByText('tenant-123')).toBeInDocument();
    expect(screen.getByText('Admin')).toBeInDocument();
    expect(screen.getByText('ClientStandard')).toBeInDocument();

    // Consolidated Operational KPIs section check (FR-1)
    expect(screen.getByRole('heading', { level: 2, name: /consolidated operational kpis/i })).toBeInDocument();
    expect(screen.getByText('Qualified Leads')).toBeInDocument();
    expect(screen.getByText('1,250')).toBeInDocument();
    expect(screen.getByText('Pipeline Value')).toBeInDocument();
    expect(screen.getByText('$450,000')).toBeInDocument();

    // 30-Second Polling status check (FR-5)
    expect(screen.getByText('30-Second REST Polling Active')).toBeInDocument();

    // Security telemetry section check
    expect(screen.getByRole('heading', { name: /access control & security architecture/i })).toBeInDocument();
    expect(screen.getByText('Server-Side RBAC Gate')).toBeInDocument();
    expect(screen.getByText('Structured Audit Pipeline')).toBeInDocument();
    expect(screen.getByText('Multi-Tenant Data Isolation')).toBeInDocument();

    // Domain cards check
    expect(screen.getByRole('heading', { level: 2, name: /platform domains/i })).toBeInDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Performance' })).toBeInDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Contracts' })).toBeInDocument();

    // Domain links
    const performanceLink = screen.getByRole('link', { name: /explore domain/i, href: '/performance' });
    expect(performanceLink).toHaveAttribute('href', '/performance');
  });

  it('allows switching timeframe filters and triggers metric re-fetches', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-999',
      email: 'admin@example.com',
      tenant_id: 'tenant-123',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <DashboardPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /platform dashboard/i })).toBeInDocument();
    });

    const btn7d = screen.getByRole('button', { name: '7 Days' });
    fireEvent.click(btn7d);

    await waitFor(() => {
      expect(getDashboardSummary).toHaveBeenCalledWith('7d');
    });
  });

  it('allows manual refresh via the Refresh button', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-999',
      email: 'admin@example.com',
      tenant_id: 'tenant-123',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <DashboardPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /platform dashboard/i })).toBeInDocument();
    });

    const refreshButton = screen.getByRole('button', { name: /refresh operational metrics/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(getDashboardSummary).toHaveBeenCalledTimes(2);
    });
  });

  it('triggers automated 30-second polling refresh loop', async () => {
    vi.useFakeTimers();

    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-999',
      email: 'admin@example.com',
      tenant_id: 'tenant-123',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    render(
      <AccessibilityProvider>
        <DashboardPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(getDashboardSummary).toHaveBeenCalledTimes(1);
    });

    // Advance timers by 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(getDashboardSummary).toHaveBeenCalledTimes(2);
  });

  it('renders partial data warning banner when summary status is PARTIAL', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-999',
      email: 'admin@example.com',
      tenant_id: 'tenant-123',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });
    vi.mocked(getDashboardSummary).mockResolvedValue({
      ...sampleSummary,
      status: 'PARTIAL',
    });

    render(
      <AccessibilityProvider>
        <DashboardPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('status', { name: '' })).toBeInDocument();
      expect(screen.getByText(/partial metric data/i)).toBeInDocument();
    });
  });

  it('renders restricted indicator for domain sections not accessible to user role', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-111',
      email: 'viewer@example.com',
      tenant_id: 'tenant-abc',
      roles: ['ClientViewer'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({
      items: [
        { title: 'Dashboard', path: '/dashboard', is_accessible: true, icon_id: 'dashboard' },
        { title: 'Performance', path: '/performance', is_accessible: true, icon_id: 'performance' },
        { title: 'Financials', path: '/financials', is_accessible: false, icon_id: 'financials' },
      ],
    });

    render(
      <AccessibilityProvider>
        <DashboardPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /platform dashboard/i })).toBeInDocument();
    });

    // Financials card should indicate restricted access
    expect(screen.getByText('Restricted for assigned role')).toBeInDocument();
  });

  it('renders error alert on API failure and allows retrying', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockRejectedValueOnce(new Error('Network connection error'));

    render(
      <AccessibilityProvider>
        <DashboardPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInDocument();
      expect(screen.getByText('Failed to Load Dashboard')).toBeInDocument();
      expect(screen.getByText('Network connection error')).toBeInDocument();
    });

    // Mock successful re-fetch
    vi.mocked(apiClient.getMe).mockResolvedValueOnce({
      user_id: 'usr-222',
      email: 'retry@example.com',
      tenant_id: 'tenant-xyz',
      roles: ['ClientStandard'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValueOnce({
      items: [{ title: 'Dashboard', path: '/dashboard', is_accessible: true, icon_id: 'dashboard' }],
    });

    // Click retry button
    const retryButton = screen.getByRole('button', { name: /retry loading/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /platform dashboard/i })).toBeInDocument();
      expect(screen.getByText('retry@example.com')).toBeInDocument();
    });
  });

  it('handles 401 unauthorized error by redirecting to /login', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('invalid-token');
    vi.mocked(apiClient.getMe).mockRejectedValue(new ApiError(401, 'Unauthorized token'));

    render(
      <AccessibilityProvider>
        <DashboardPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});
