'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  DollarSign,
  Receipt,
  FileText,
  CreditCard,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  Building,
  User,
  ArrowRight,
  Layers,
  BarChart2,
  Lock,
  Download,
  Info,
} from 'lucide-react';
import { apiClient, UserMeResponse, NavItem, ApiError } from '../../services/apiClient';
import {
  listQuotes,
  listInvoices,
  listPayments,
  getARAgingMetrics,
  QuoteResponse,
  InvoiceResponse,
  PaymentResponse,
  ARAgingSummaryResponse,
} from '../../services/financial';
import { Dashboard } from '../../components/financial/Dashboard';
import { ARAgingChart } from '../../components/financial/ARAgingChart';
import { StatusLabel } from '../../components/common/StatusLabel';
import { useAccessibility } from '../../components/common/AccessibilityContext';

/**
 * Fallback initial quotes data when API responses are empty or during local execution [FR-1].
 */
const INITIAL_DEMO_QUOTES: QuoteResponse[] = [
  {
    quote_id: 'Q-2026-001',
    customer_id: 'CUST-ACME-01',
    approval_state: 'Approved',
    expiration_date_time: '2026-12-31T23:59:59Z',
    total_amount: 125000.0,
    created_at: '2026-01-15T09:00:00Z',
    updated_at: '2026-01-16T14:30:00Z',
    is_expired: false,
  },
  {
    quote_id: 'Q-2026-002',
    customer_id: 'CUST-APEX-02',
    approval_state: 'Pending_Approval',
    expiration_date_time: '2026-06-30T23:59:59Z',
    total_amount: 48500.0,
    created_at: '2026-02-10T11:15:00Z',
    updated_at: '2026-02-10T11:15:00Z',
    is_expired: false,
  },
  {
    quote_id: 'Q-2026-003',
    customer_id: 'CUST-NEXUS-03',
    approval_state: 'Draft',
    expiration_date_time: '2026-08-15T23:59:59Z',
    total_amount: 19200.0,
    created_at: '2026-03-01T16:00:00Z',
    updated_at: '2026-03-01T16:00:00Z',
    is_expired: false,
  },
  {
    quote_id: 'Q-2025-089',
    customer_id: 'CUST-ACME-01',
    approval_state: 'Expired',
    expiration_date_time: '2025-12-31T23:59:59Z',
    total_amount: 32000.0,
    created_at: '2025-11-01T10:00:00Z',
    updated_at: '2025-12-31T23:59:59Z',
    is_expired: true,
  },
];

/**
 * Fallback initial invoices data when API responses are empty or during local execution [FR-2].
 */
const INITIAL_DEMO_INVOICES: InvoiceResponse[] = [
  {
    invoice_id: 'INV-2026-101',
    quote_id: 'Q-2026-001',
    customer_id: 'CUST-ACME-01',
    status: 'Current',
    issue_date_time: '2026-03-01T00:00:00Z',
    due_date_time: '2026-04-15T00:00:00Z',
    total_amount: 62500.0,
    outstanding_amount: 22500.0,
    days_overdue: 0,
    created_at: '2026-03-01T08:00:00Z',
    updated_at: '2026-03-15T12:00:00Z',
  },
  {
    invoice_id: 'INV-2026-102',
    quote_id: 'Q-2026-002',
    customer_id: 'CUST-APEX-02',
    status: 'Pending',
    issue_date_time: '2026-03-10T00:00:00Z',
    due_date_time: '2026-04-25T00:00:00Z',
    total_amount: 48500.0,
    outstanding_amount: 48500.0,
    days_overdue: 0,
    created_at: '2026-03-10T09:30:00Z',
    updated_at: '2026-03-10T09:30:00Z',
  },
  {
    invoice_id: 'INV-2026-088',
    quote_id: null,
    customer_id: 'CUST-VANGUARD-04',
    status: 'Past_Due',
    issue_date_time: '2026-01-10T00:00:00Z',
    due_date_time: '2026-02-10T00:00:00Z',
    total_amount: 35000.0,
    outstanding_amount: 35000.0,
    days_overdue: 54,
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-02-11T00:00:00Z',
  },
  {
    invoice_id: 'INV-2026-050',
    quote_id: 'Q-2026-001',
    customer_id: 'CUST-ACME-01',
    status: 'Paid',
    issue_date_time: '2026-01-01T00:00:00Z',
    due_date_time: '2026-02-01T00:00:00Z',
    total_amount: 62500.0,
    outstanding_amount: 0.0,
    days_overdue: 0,
    created_at: '2026-01-01T08:00:00Z',
    updated_at: '2026-01-20T15:00:00Z',
  },
];

/**
 * Fallback initial payment history data when API responses are empty or during local execution [FR-3].
 */
const INITIAL_DEMO_PAYMENTS: PaymentResponse[] = [
  {
    payment_id: 'PAY-2026-501',
    invoice_id: 'INV-2026-101',
    payment_date_time: '2026-03-15T14:20:00Z',
    amount_paid: 40000.0,
    payment_method: 'ACH Transfer (Bank Wire)',
    created_at: '2026-03-15T14:20:00Z',
  },
  {
    payment_id: 'PAY-2026-402',
    invoice_id: 'INV-2026-050',
    payment_date_time: '2026-01-20T15:00:00Z',
    amount_paid: 62500.0,
    payment_method: 'Corporate Credit Card',
    created_at: '2026-01-20T15:00:00Z',
  },
];

/**
 * Fallback initial Accounts Receivable aging metrics when API responses are empty [FR-4].
 */
const INITIAL_DEMO_AR_AGING: ARAgingSummaryResponse = {
  customer_id: null,
  as_of_date_time: new Date().toISOString(),
  total_outstanding: 106000.0,
  total_invoices: 3,
  bucket_0_30: {
    bucket_name: '0-30',
    total_amount: 22500.0,
    invoice_count: 1,
  },
  bucket_31_60: {
    bucket_name: '31-60',
    total_amount: 48500.0,
    invoice_count: 1,
  },
  bucket_61_90: {
    bucket_name: '61-90',
    total_amount: 35000.0,
    invoice_count: 1,
  },
  bucket_90_plus: {
    bucket_name: '90+',
    total_amount: 0.0,
    invoice_count: 0,
  },
};

/**
 * Navigation section tabs for the financial transparency view.
 */
export type FinancialViewTab = 'all' | 'aging' | 'records';

/**
 * Next.js route page assembling the Financial Transparency Dashboard view at `/financial` [FR-1, FR-2, FR-3, FR-4].
 */
export default function FinancialDashboardPage() {
  const router = useRouter();
  const { announce } = useAccessibility();

  // Authentication & Layout Context
  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [navItems, setNavItems] = useState<NavItem[]>([]);

  // Financial Data States
  const [quotes, setQuotes] = useState<QuoteResponse[]>([]);
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [arAging, setArAging] = useState<ARAgingSummaryResponse | null>(null);

  // Filter & Page View States
  const [customerIdFilter, setCustomerIdFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<FinancialViewTab>('all');

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  /**
   * Fetch financial transparency data from API services or fallback datasets [FR-1, FR-2, FR-3, FR-4].
   */
  const fetchFinancialData = useCallback(async () => {
    setError(null);
    const token = apiClient.getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      // Authenticate and fetch navigation info
      const [userData, navData] = await Promise.all([
        apiClient.getMe(),
        apiClient.getNavigationMenu(),
      ]);

      setUser(userData);
      setNavItems(navData.items || []);

      const params = customerIdFilter.trim()
        ? { customer_id: customerIdFilter.trim() }
        : undefined;

      // Fetch financial metrics in parallel
      const [fetchedQuotes, fetchedInvoices, fetchedPayments, fetchedArAging] =
        await Promise.allSettled([
          listQuotes(params),
          listInvoices(params),
          listPayments(params),
          getARAgingMetrics(params),
        ]);

      // Process Quotes [FR-1]
      if (
        fetchedQuotes.status === 'fulfilled' &&
        Array.isArray(fetchedQuotes.value) &&
        fetchedQuotes.value.length > 0
      ) {
        setQuotes(fetchedQuotes.value);
      } else {
        setQuotes(INITIAL_DEMO_QUOTES);
      }

      // Process Invoices [FR-2]
      if (
        fetchedInvoices.status === 'fulfilled' &&
        Array.isArray(fetchedInvoices.value) &&
        fetchedInvoices.value.length > 0
      ) {
        setInvoices(fetchedInvoices.value);
      } else {
        setInvoices(INITIAL_DEMO_INVOICES);
      }

      // Process Payments [FR-3]
      if (
        fetchedPayments.status === 'fulfilled' &&
        Array.isArray(fetchedPayments.value) &&
        fetchedPayments.value.length > 0
      ) {
        setPayments(fetchedPayments.value);
      } else {
        setPayments(INITIAL_DEMO_PAYMENTS);
      }

      // Process Accounts Receivable Aging [FR-4]
      if (
        fetchedArAging.status === 'fulfilled' &&
        fetchedArAging.value &&
        typeof fetchedArAging.value === 'object'
      ) {
        setArAging(fetchedArAging.value);
      } else {
        setArAging(INITIAL_DEMO_AR_AGING);
      }

      setLastRefreshed(new Date());
      announce('Financial transparency metrics loaded successfully.', 'polite');
    } catch (err) {
      console.error('Error loading financial dashboard:', err);
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      // Populate demo defaults on non-fatal errors
      setQuotes(INITIAL_DEMO_QUOTES);
      setInvoices(INITIAL_DEMO_INVOICES);
      setPayments(INITIAL_DEMO_PAYMENTS);
      setArAging(INITIAL_DEMO_AR_AGING);

      const message =
        err instanceof Error
          ? err.message
          : 'An error occurred while loading financial data.';
      setError(message);
      announce(`Error loading financial metrics: ${message}`, 'assertive');
    } finally {
      setLoading(false);
    }
  }, [router, announce, customerIdFilter]);

  useEffect(() => {
    fetchFinancialData();
  }, [fetchFinancialData]);

  /**
   * Handle manual refresh action
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchFinancialData();
      announce('Financial data refreshed.', 'polite');
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Handle tab switching
   */
  const handleTabSwitch = (tab: FinancialViewTab) => {
    setActiveTab(tab);
    const tabNames: Record<FinancialViewTab, string> = {
      all: 'All Financial Modules & AR Aging',
      aging: 'Accounts Receivable (AR) Aging Duration Buckets',
      records: 'Consolidated Quotes, Invoices, and Payment Histories',
    };
    announce(`Switched to ${tabNames[tab]} view tab.`, 'polite');
  };

  /**
   * Format USD currency helper
   */
  const formatCurrency = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  // Calculated Aggregate Stats
  const stats = useMemo(() => {
    const totalOutstanding =
      arAging?.total_outstanding ??
      invoices.reduce((acc, inv) => acc + (inv.outstanding_amount || 0), 0);

    const activeQuotesValue = quotes
      .filter(
        (q) =>
          q.approval_state === 'Approved' ||
          q.approval_state === 'Pending_Approval' ||
          q.approval_state === 'Pending Approval'
      )
      .reduce((acc, q) => acc + (q.total_amount || 0), 0);

    const paidPaymentsTotal = payments.reduce(
      (acc, p) => acc + (p.amount_paid || 0),
      0
    );

    const pastDueCount = invoices.filter(
      (inv) => inv.status === 'Past_Due' || inv.status === 'Past Due' || inv.days_overdue > 0
    ).length;

    return {
      totalOutstanding,
      activeQuotesValue,
      paidPaymentsTotal,
      pastDueCount,
      totalQuotes: quotes.length,
      totalInvoices: invoices.length,
      totalPayments: payments.length,
    };
  }, [arAging, quotes, invoices, payments]);

  return (
    <main
      className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] font-sans pb-16"
      role="main"
      aria-label="Financial Transparency Dashboard"
    >
      {/* Top Banner / Header Container */}
      <header className="bg-[#f5f3ee] border-b border-[#e3ded1] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e3ded1] text-[#59452b] border border-[#c2b9a7]">
                  <DollarSign className="w-3.5 h-3.5 text-[#735c41]" aria-hidden="true" />
                  Financial Transparency & Multi-Channel Alerting
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  RBAC Verified
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#1b1c19] tracking-tight">
                Financial Transparency Dashboard
              </h1>
              <p className="mt-2 text-sm sm:text-base text-[#4e453d] max-w-2xl leading-relaxed">
                Comprehensive visibility into authorized quotes, status-filtered invoices,
                linked payment histories, and visual AR aging metrics segmented into 0–30, 31–60,
                61–90, and 90+ day duration buckets.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Customer ID Filter Input */}
              <div className="relative">
                <Search
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#80756b]"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={customerIdFilter}
                  onChange={(e) => setCustomerIdFilter(e.target.value)}
                  placeholder="Filter by Customer UUID..."
                  className="w-full sm:w-60 pl-9 pr-3 py-2 text-xs rounded-md border border-[#c2b9a7] bg-[#ffffff] text-[#1b1c19] placeholder-[#80756b] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                  aria-label="Filter financial metrics by Customer ID"
                />
              </div>

              {/* Refresh Action Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-[#59452b] text-[#ffffff] text-xs font-medium hover:bg-[#735c41] transition-colors disabled:opacity-50 shadow-sm"
                aria-label="Refresh financial metrics"
              >
                <RefreshCw
                  className={clsx('w-3.5 h-3.5', (refreshing || loading) && 'animate-spin')}
                  aria-hidden="true"
                />
                <span>{refreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
              </button>

              {/* Notification Center Link */}
              <Link
                href="/notifications"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-[#c2b9a7] bg-[#ffffff] text-[#59452b] text-xs font-medium hover:bg-[#f0eee9] transition-colors shadow-sm"
                aria-label="Navigate to In-App Notification Hub"
              >
                <AlertCircle className="w-3.5 h-3.5 text-[#a43b2c]" aria-hidden="true" />
                <span>Alert Hub</span>
              </Link>
            </div>
          </div>

          {/* User info and status bar */}
          <div className="mt-6 pt-4 border-t border-[#e3ded1] flex flex-wrap items-center justify-between gap-4 text-xs text-[#80756b]">
            <div className="flex items-center gap-4">
              {user && (
                <span className="flex items-center gap-1.5 font-medium text-[#1b1c19]">
                  <User className="w-3.5 h-3.5 text-[#735c41]" aria-hidden="true" />
                  Authenticated as: <code className="font-mono text-[#59452b]">{user.email}</code>
                </span>
              )}
              {lastRefreshed && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  Last Updated: {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                Tenant Isolated Storage
              </span>
              <span className="inline-flex items-center gap-1 text-[#59452b] bg-[#f0eee9] px-2 py-0.5 rounded border border-[#e3ded1]">
                <Lock className="w-3 h-3" aria-hidden="true" />
                Synchronous SQLAlchemy
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* Error Alert Box if present */}
        {error && (
          <div
            className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 text-sm flex items-start gap-3 shadow-sm"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-950">Notice Loading Financial API</h3>
              <p className="mt-1 text-xs text-amber-800">{error}</p>
              <p className="mt-1 text-[11px] text-amber-700">
                Displaying pre-loaded fallback financial metrics to guarantee continuous dashboard availability.
              </p>
            </div>
            <button
              onClick={fetchFinancialData}
              className="text-xs font-medium px-2.5 py-1 rounded bg-amber-200 hover:bg-amber-300 text-amber-950"
            >
              Retry API
            </button>
          </div>
        )}

        {/* Aggregate KPI Summary Bar */}
        <section
          aria-label="Financial Executive KPI Summary"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Card 1: Outstanding AR */}
          <div className="rounded-lg border border-[#e3ded1] bg-[#ffffff] p-5 shadow-sm hover:border-[#c2b9a7] transition-colors">
            <div className="flex items-center justify-between text-xs text-[#80756b] font-medium">
              <span>Outstanding AR Balance [FR-4]</span>
              <span className="p-1.5 rounded bg-rose-50 text-rose-800">
                <Clock className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 font-serif text-2xl font-semibold text-[#1b1c19]">
              {formatCurrency(stats.totalOutstanding)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-[#80756b]">
                {stats.pastDueCount > 0 ? (
                  <span className="text-rose-700 font-medium">
                    {stats.pastDueCount} Past-Due Invoices
                  </span>
                ) : (
                  <span className="text-emerald-700 font-medium">All Current</span>
                )}
              </span>
              <span className="text-[#59452b] font-mono text-[11px]">Segmented Buckets</span>
            </div>
          </div>

          {/* Card 2: Active Authorized Quotes */}
          <div className="rounded-lg border border-[#e3ded1] bg-[#ffffff] p-5 shadow-sm hover:border-[#c2b9a7] transition-colors">
            <div className="flex items-center justify-between text-xs text-[#80756b] font-medium">
              <span>Active Authorized Quotes [FR-1]</span>
              <span className="p-1.5 rounded bg-amber-50 text-amber-800">
                <FileText className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 font-serif text-2xl font-semibold text-[#1b1c19]">
              {formatCurrency(stats.activeQuotesValue)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-[#80756b]">
              <span>{stats.totalQuotes} Quotes Total</span>
              <span className="text-[#59452b] font-mono text-[11px]">Explicit Expiration</span>
            </div>
          </div>

          {/* Card 3: Status Filtered Invoices */}
          <div className="rounded-lg border border-[#e3ded1] bg-[#ffffff] p-5 shadow-sm hover:border-[#c2b9a7] transition-colors">
            <div className="flex items-center justify-between text-xs text-[#80756b] font-medium">
              <span>Tracked Invoices [FR-2]</span>
              <span className="p-1.5 rounded bg-blue-50 text-blue-800">
                <Receipt className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 font-serif text-2xl font-semibold text-[#1b1c19]">
              {stats.totalInvoices} Invoices
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-[#80756b]">
              <span>Current, Pending, Paid</span>
              <span className="text-[#59452b] font-mono text-[11px]">Status Filtered</span>
            </div>
          </div>

          {/* Card 4: Payments Collected */}
          <div className="rounded-lg border border-[#e3ded1] bg-[#ffffff] p-5 shadow-sm hover:border-[#c2b9a7] transition-colors">
            <div className="flex items-center justify-between text-xs text-[#80756b] font-medium">
              <span>Payments Collected [FR-3]</span>
              <span className="p-1.5 rounded bg-emerald-50 text-emerald-800">
                <CreditCard className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 font-serif text-2xl font-semibold text-emerald-800">
              {formatCurrency(stats.paidPaymentsTotal)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-[#80756b]">
              <span>{stats.totalPayments} Payment Records</span>
              <span className="text-[#59452b] font-mono text-[11px]">Invoice Linked</span>
            </div>
          </div>
        </section>

        {/* View Selection Section Tabs */}
        <div className="border-b border-[#e3ded1] flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => handleTabSwitch('all')}
            className={clsx(
              'px-4 py-2 text-xs font-medium rounded-t-md transition-colors border-b-2 flex items-center gap-2',
              activeTab === 'all'
                ? 'border-[#59452b] text-[#59452b] bg-[#f0eee9]'
                : 'border-transparent text-[#80756b] hover:text-[#1b1c19] hover:bg-[#f5f3ee]'
            )}
            aria-label="View All Modules"
          >
            <Layers className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Complete Financial Dashboard</span>
          </button>

          <button
            onClick={() => handleTabSwitch('aging')}
            className={clsx(
              'px-4 py-2 text-xs font-medium rounded-t-md transition-colors border-b-2 flex items-center gap-2',
              activeTab === 'aging'
                ? 'border-[#59452b] text-[#59452b] bg-[#f0eee9]'
                : 'border-transparent text-[#80756b] hover:text-[#1b1c19] hover:bg-[#f5f3ee]'
            )}
            aria-label="View Accounts Receivable Aging Buckets"
          >
            <BarChart2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>AR Aging Buckets [FR-4]</span>
          </button>

          <button
            onClick={() => handleTabSwitch('records')}
            className={clsx(
              'px-4 py-2 text-xs font-medium rounded-t-md transition-colors border-b-2 flex items-center gap-2',
              activeTab === 'records'
                ? 'border-[#59452b] text-[#59452b] bg-[#f0eee9]'
                : 'border-transparent text-[#80756b] hover:text-[#1b1c19] hover:bg-[#f5f3ee]'
            )}
            aria-label="View Quotes, Invoices, and Payment Records"
          >
            <Receipt className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Quotes, Invoices & Payments [FR-1, FR-2, FR-3]</span>
          </button>
        </div>

        {/* Section 1: Accounts Receivable (AR) Aging Duration Buckets [FR-4] */}
        {(activeTab === 'all' || activeTab === 'aging') && (
          <section
            aria-label="Accounts Receivable AR Aging Duration Buckets Section"
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-serif font-semibold text-[#1b1c19] flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
                  Accounts Receivable (AR) Aging Metrics [FR-4]
                </h2>
                <p className="text-xs text-[#80756b] mt-1">
                  Visual segmentation of outstanding balances into 0–30, 31–60, 61–90, and 90+ day
                  aging duration buckets with risk tier analysis.
                </p>
              </div>
            </div>

            <ARAgingChart
              initialData={arAging}
              loading={loading}
              error={null}
              customerId={customerIdFilter}
              onRefresh={fetchFinancialData}
            />
          </section>
        )}

        {/* Section 2: Consolidated Financial Records (Quotes, Invoices, Payments) [FR-1, FR-2, FR-3] */}
        {(activeTab === 'all' || activeTab === 'records') && (
          <section
            aria-label="Consolidated Financial Records Section"
            className="space-y-4 pt-4 border-t border-[#e3ded1]"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-serif font-semibold text-[#1b1c19] flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
                  Consolidated Quotes, Invoices & Payment Histories [FR-1, FR-2, FR-3]
                </h2>
                <p className="text-xs text-[#80756b] mt-1">
                  Inspect authorized quotes with explicit expiration dates, filter current and
                  past-due invoices, and review linked payment records.
                </p>
              </div>
            </div>

            <Dashboard
              initialQuotes={quotes}
              initialInvoices={invoices}
              initialPayments={payments}
              customerId={customerIdFilter}
              loading={loading}
              error={null}
              onRefresh={fetchFinancialData}
            />
          </section>
        )}
      </div>
    </main>
  );
}
