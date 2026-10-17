import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FinancialDashboardPage, {
  INITIAL_DEMO_QUOTES,
  INITIAL_DEMO_INVOICES,
  INITIAL_DEMO_PAYMENTS,
  INITIAL_DEMO_AR_AGING,
} from '../../src/app/financial/page';
import { apiClient } from '../../src/services/apiClient';
import * as financialService from '../../src/services/financial';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';

const mockPush = vi.fn();

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/financial',
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

// Mock financialService functions
vi.mock('../../src/services/financial', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/financial')>();
  return {
    ...actual,
    listQuotes: vi.fn(),
    listInvoices: vi.fn(),
    listPayments: vi.fn(),
    getARAgingMetrics: vi.fn(),
  };
});

describe('FinancialDashboardPage Route Component (/financial) [FR-1, FR-2, FR-3, FR-4]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects unauthenticated users to /login if no authentication token is present', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue(null);

    render(
      <AccessibilityProvider>
        <FinancialDashboardPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders the page header, executive KPI summary, and sections when authenticated', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token-xyz');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-101',
      email: 'financial.admin@example.com',
      tenant_id: 'tenant-001',
      roles: ['Admin', 'ClientStandard'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({
      items: [{ title: 'Financials', path: '/financial', is_accessible: true }],
    });

    vi.mocked(financialService.listQuotes).mockResolvedValue(INITIAL_DEMO_QUOTES);
    vi.mocked(financialService.listInvoices).mockResolvedValue(INITIAL_DEMO_INVOICES);
    vi.mocked(financialService.listPayments).mockResolvedValue(INITIAL_DEMO_PAYMENTS);
    vi.mocked(financialService.getARAgingMetrics).mockResolvedValue(INITIAL_DEMO_AR_AGING);

    render(
      <AccessibilityProvider>
        <FinancialDashboardPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /Financial Transparency Dashboard/i })
      ).toBeInTheDocument();
    });

    // Check user email display
    expect(screen.getByText(/financial.admin@example.com/i)).toBeInTheDocument();

    // Check KPI Cards
    expect(screen.getByText(/Outstanding AR Balance/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Authorized Quotes/i)).toBeInTheDocument();
    expect(screen.getByText(/Tracked Invoices/i)).toBeInTheDocument();
    expect(screen.getByText(/Payments Collected/i)).toBeInTheDocument();
  });

  it('displays Accounts Receivable (AR) Aging Duration Buckets [FR-4]', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token-xyz');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-[#1b1c19]',
      email: 'user@example.com',
      tenant_id: 'tenant-001',
      roles: ['ClientStandard'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    vi.mocked(financialService.listQuotes).mockResolvedValue([]);
    vi.mocked(financialService.listInvoices).mockResolvedValue([]);
    vi.mocked(financialService.listPayments).mockResolvedValue([]);
    vi.mocked(financialService.getARAgingMetrics).mockResolvedValue(INITIAL_DEMO_AR_AGING);

    render(
      <AccessibilityProvider>
        <FinancialDashboardPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      // Check heading for AR Aging Metrics
      expect(
        screen.getByRole('heading', { name: /Accounts Receivable \(AR\) Aging Metrics/i })
      ).toBeInTheDocument();
    });

    // AR Aging duration buckets should be rendered in cards or table
    expect(screen.getByText(/0-30 Days/i)).toBeInTheDocument();
    expect(screen.getByText(/31-60 Days/i)).toBeInTheDocument();
    expect(screen.getByText(/61-90 Days/i)).toBeInTheDocument();
    expect(screen.getByText(/90\+ Days/i)).toBeInTheDocument();
  });

  it('allows filtering by Customer ID and refreshing data', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token-xyz');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-101',
      email: 'user@example.com',
      tenant_id: 'tenant-001',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    vi.mocked(financialService.listQuotes).mockResolvedValue(INITIAL_DEMO_QUOTES);
    vi.mocked(financialService.listInvoices).mockResolvedValue(INITIAL_DEMO_INVOICES);
    vi.mocked(financialService.listPayments).mockResolvedValue(INITIAL_DEMO_PAYMENTS);
    vi.mocked(financialService.getARAgingMetrics).mockResolvedValue(INITIAL_DEMO_AR_AGING);

    render(
      <AccessibilityProvider>
        <FinancialDashboardPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Filter by Customer UUID/i)).toBeInTheDocument();
    });

    // Type a customer filter
    const filterInput = screen.getByPlaceholderText(/Filter by Customer UUID/i);
    fireEvent.change(filterInput, { target: { value: 'CUST-ACME-01' } });

    // Click refresh button
    const refreshBtn = screen.getByRole('button', { name: /Refresh financial metrics/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(financialService.listQuotes).toHaveBeenCalledWith({
        customer_id: 'CUST-ACME-01',
      });
    });
  });

  it('supports tab switching between complete view, aging, and records', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token-xyz');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-101',
      email: 'user@example.com',
      tenant_id: 'tenant-001',
      roles: ['Admin'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({ items: [] });

    vi.mocked(financialService.listQuotes).mockResolvedValue(INITIAL_DEMO_QUOTES);
    vi.mocked(financialService.listInvoices).mockResolvedValue(INITIAL_DEMO_INVOICES);
    vi.mocked(financialService.listPayments).mockResolvedValue(INITIAL_DEMO_PAYMENTS);
    vi.mocked(financialService.getARAgingMetrics).mockResolvedValue(INITIAL_DEMO_AR_AGING);

    render(
      <AccessibilityProvider>
        <FinancialDashboardPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /View Accounts Receivable Aging Buckets/i })).toBeInTheDocument();
    });

    const agingTabBtn = screen.getByRole('button', { name: /View Accounts Receivable Aging Buckets/i });
    fireEvent.click(agingTabBtn);

    expect(screen.getByText(/AR Aging Buckets \[FR-4\]/i)).toBeInTheDocument();
  });
});
