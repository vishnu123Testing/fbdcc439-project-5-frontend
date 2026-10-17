'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  FileText,
  Receipt,
  CreditCard,
  Clock,
  AlertCircle,
  RotateCw,
  Search,
  DollarSign,
  Filter,
  CheckCircle2,
  XCircle,
  Calendar,
  Layers,
  ArrowUpRight,
  ChevronRight,
  User,
  AlertTriangle,
  Building,
  Info,
  Check,
  TrendingUp,
  Link as LinkIcon,
} from 'lucide-react';
import {
  listQuotes,
  listInvoices,
  listPayments,
  QuoteResponse,
  InvoiceResponse,
  PaymentResponse,
  QuoteQueryParams,
  InvoiceQueryParams,
  PaymentQueryParams,
} from '../../services/financial';

/**
 * Tab sections supported by the Consolidated Financial Dashboard.
 */
export type ActiveTab = 'overview' | 'quotes' | 'invoices' | 'payments';

/**
 * Props for the Financial Dashboard component.
 */
export interface FinancialDashboardProps {
  /**
   * Pre-fetched quotes array [FR-1]
   */
  initialQuotes?: QuoteResponse[] | null;
  /**
   * Pre-fetched invoices array [FR-2]
   */
  initialInvoices?: InvoiceResponse[] | null;
  /**
   * Pre-fetched payment records array [FR-3]
   */
  initialPayments?: PaymentResponse[] | null;
  /**
   * Optional customer ID filter
   */
  customerId?: string;
  /**
   * Optional loading state override
   */
  loading?: boolean;
  /**
   * Optional error message override
   */
  error?: string | null;
  /**
   * Callback fired when user triggers refresh
   */
  onRefresh?: () => void;
  /**
   * Callback when a quote is clicked/selected [FR-1]
   */
  onSelectQuote?: (quote: QuoteResponse) => void;
  /**
   * Callback when an invoice is clicked/selected [FR-2]
   */
  onSelectInvoice?: (invoice: InvoiceResponse) => void;
  /**
   * Callback when a payment record is clicked/selected [FR-3]
   */
  onSelectPayment?: (payment: PaymentResponse) => void;
  /**
   * Initial active tab navigation section
   */
  defaultTab?: ActiveTab;
  /**
   * Additional CSS class names
   */
  className?: string;
}

/**
 * Format numeric currency values into standardized USD string format ($X,XXX.XX).
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format ISO date string into human-readable date representation (e.g. "Apr 15, 2026").
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Normalizes status strings by converting underscores to spaces and trimming whitespace.
 */
export function normalizeStateString(val: string): string {
  if (!val) return '';
  return val.replace(/_/g, ' ').trim();
}

/**
 * Returns style metadata and badges for Quote approval states [FR-1].
 */
export function getQuoteApprovalBadge(state: string) {
  const norm = normalizeStateString(state).toLowerCase();
  switch (norm) {
    case 'approved':
      return {
        label: 'Approved',
        variant: 'success' as const,
        bgClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        badgeBg: 'bg-emerald-100 text-emerald-800',
      };
    case 'pending approval':
    case 'pending_approval':
      return {
        label: 'Pending Approval',
        variant: 'warning' as const,
        bgClass: 'bg-amber-50 text-amber-800 border-amber-200',
        badgeBg: 'bg-amber-100 text-amber-800',
      };
    case 'expired':
      return {
        label: 'Expired',
        variant: 'error' as const,
        bgClass: 'bg-rose-50 text-rose-800 border-rose-200',
        badgeBg: 'bg-rose-100 text-rose-800',
      };
    case 'draft':
    default:
      return {
        label: 'Draft',
        variant: 'neutral' as const,
        bgClass: 'bg-stone-100 text-stone-700 border-stone-200',
        badgeBg: 'bg-stone-200 text-stone-800',
      };
  }
}

/**
 * Returns style metadata and badges for Invoice statuses [FR-2].
 */
export function getInvoiceStatusBadge(status: string) {
  const norm = normalizeStateString(status).toLowerCase();
  switch (norm) {
    case 'paid':
      return {
        label: 'Paid',
        variant: 'success' as const,
        bgClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        badgeBg: 'bg-emerald-100 text-emerald-800',
      };
    case 'current':
      return {
        label: 'Current',
        variant: 'info' as const,
        bgClass: 'bg-sky-50 text-sky-800 border-sky-200',
        badgeBg: 'bg-sky-100 text-sky-800',
      };
    case 'pending':
      return {
        label: 'Pending',
        variant: 'warning' as const,
        bgClass: 'bg-amber-50 text-amber-800 border-amber-200',
        badgeBg: 'bg-amber-100 text-amber-800',
      };
    case 'past due':
    case 'past_due':
      return {
        label: 'Past Due',
        variant: 'error' as const,
        bgClass: 'bg-rose-50 text-rose-800 border-rose-200',
        badgeBg: 'bg-rose-100 text-rose-800',
      };
    default:
      return {
        label: status || 'Unknown',
        variant: 'neutral' as const,
        bgClass: 'bg-stone-100 text-stone-700 border-stone-200',
        badgeBg: 'bg-stone-200 text-stone-800',
      };
  }
}

/**
 * Filter quotes array by approval state and search string [FR-1].
 */
export function filterQuotes(
  quotes: QuoteResponse[],
  stateFilter: string,
  searchQuery: string
): QuoteResponse[] {
  if (!quotes || !Array.isArray(quotes)) return [];
  const searchNorm = searchQuery.trim().toLowerCase();
  const filterNorm = stateFilter.trim().toLowerCase();

  return quotes.filter((q) => {
    // State match check
    if (filterNorm && filterNorm !== 'all') {
      const qState = normalizeStateString(q.approval_state).toLowerCase();
      if (qState !== filterNorm) {
        return false;
      }
    }

    // Search query check
    if (searchNorm) {
      const matchesId = q.quote_id.toLowerCase().includes(searchNorm);
      const matchesCustomer = q.customer_id.toLowerCase().includes(searchNorm);
      const matchesAmount = String(q.total_amount).includes(searchNorm);
      const matchesState = normalizeStateString(q.approval_state)
        .toLowerCase()
        .includes(searchNorm);
      return matchesId || matchesCustomer || matchesAmount || matchesState;
    }

    return true;
  });
}

/**
 * Filter invoices array by status filter and search string [FR-2].
 */
export function filterInvoices(
  invoices: InvoiceResponse[],
  statusFilter: string,
  searchQuery: string
): InvoiceResponse[] {
  if (!invoices || !Array.isArray(invoices)) return [];
  const searchNorm = searchQuery.trim().toLowerCase();
  const filterNorm = statusFilter.trim().toLowerCase();

  return invoices.filter((inv) => {
    // Status match check
    if (filterNorm && filterNorm !== 'all') {
      const invStatus = normalizeStateString(inv.status).toLowerCase();
      if (invStatus !== filterNorm) {
        return false;
      }
    }

    // Search query check
    if (searchNorm) {
      const matchesId = inv.invoice_id.toLowerCase().includes(searchNorm);
      const matchesCustomer = inv.customer_id.toLowerCase().includes(searchNorm);
      const matchesQuoteId = inv.quote_id
        ? inv.quote_id.toLowerCase().includes(searchNorm)
        : false;
      const matchesAmount = String(inv.total_amount).includes(searchNorm);
      const matchesStatus = normalizeStateString(inv.status)
        .toLowerCase()
        .includes(searchNorm);
      return (
        matchesId || matchesCustomer || matchesQuoteId || matchesAmount || matchesStatus
      );
    }

    return true;
  });
}

/**
 * Filter payment history records by invoice ID filter and search string [FR-3].
 */
export function filterPayments(
  payments: PaymentResponse[],
  invoiceIdFilter: string,
  searchQuery: string
): PaymentResponse[] {
  if (!payments || !Array.isArray(payments)) return [];
  const searchNorm = searchQuery.trim().toLowerCase();
  const invFilterNorm = invoiceIdFilter.trim().toLowerCase();

  return payments.filter((p) => {
    // Linked invoice filter check
    if (invFilterNorm && invFilterNorm !== 'all') {
      if (p.invoice_id.toLowerCase() !== invFilterNorm) {
        return false;
      }
    }

    // Search query check
    if (searchNorm) {
      const matchesPaymentId = p.payment_id.toLowerCase().includes(searchNorm);
      const matchesInvoiceId = p.invoice_id.toLowerCase().includes(searchNorm);
      const matchesMethod = p.payment_method.toLowerCase().includes(searchNorm);
      const matchesAmount = String(p.amount_paid).includes(searchNorm);
      return matchesPaymentId || matchesInvoiceId || matchesMethod || matchesAmount;
    }

    return true;
  });
}

/**
 * Calculates aggregate summary metrics across quotes, invoices, and payments.
 */
export function calculateFinancialSummary(
  quotes: QuoteResponse[] = [],
  invoices: InvoiceResponse[] = [],
  payments: PaymentResponse[] = []
) {
  const safeQuotes = Array.isArray(quotes) ? quotes : [];
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  const totalQuoteValue = safeQuotes.reduce((acc, q) => acc + (q.total_amount || 0), 0);
  const approvedQuotesCount = safeQuotes.filter(
    (q) => normalizeStateString(q.approval_state).toLowerCase() === 'approved'
  ).length;
  const pendingQuotesCount = safeQuotes.filter((q) =>
    normalizeStateString(q.approval_state).toLowerCase().includes('pending')
  ).length;

  const totalInvoiceValue = safeInvoices.reduce((acc, inv) => acc + (inv.total_amount || 0), 0);
  const totalOutstandingBalance = safeInvoices.reduce(
    (acc, inv) => acc + (inv.outstanding_amount || 0),
    0
  );
  const pastDueInvoicesCount = safeInvoices.filter(
    (inv) =>
      normalizeStateString(inv.status).toLowerCase().includes('past due') ||
      inv.days_overdue > 0
  ).length;

  const totalPaymentsCollected = safePayments.reduce(
    (acc, p) => acc + (p.amount_paid || 0),
    0
  );

  return {
    quotesCount: safeQuotes.length,
    totalQuoteValue,
    approvedQuotesCount,
    pendingQuotesCount,
    invoicesCount: safeInvoices.length,
    totalInvoiceValue,
    totalOutstandingBalance,
    pastDueInvoicesCount,
    paymentsCount: safePayments.length,
    totalPaymentsCollected,
  };
}

/**
 * Consolidated Financial Dashboard Component [FR-1, FR-2, FR-3]
 */
export const Dashboard: React.FC<FinancialDashboardProps> = ({
  initialQuotes = null,
  initialInvoices = null,
  initialPayments = null,
  customerId,
  loading: externalLoading = false,
  error: externalError = null,
  onRefresh,
  onSelectQuote,
  onSelectInvoice,
  onSelectPayment,
  defaultTab = 'overview',
  className,
}) => {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<ActiveTab>(defaultTab);

  // Data States
  const [quotes, setQuotes] = useState<QuoteResponse[]>(initialQuotes || []);
  const [invoices, setInvoices] = useState<InvoiceResponse[]>(initialInvoices || []);
  const [payments, setPayments] = useState<PaymentResponse[]>(initialPayments || []);

  // Internal Loading & Error States
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Search & Filter States
  const [quoteStateFilter, setQuoteStateFilter] = useState<string>('all');
  const [quoteSearch, setQuoteSearch] = useState<string>('');

  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');
  const [invoiceSearch, setInvoiceSearch] = useState<string>('');

  const [paymentInvoiceFilter, setPaymentInvoiceFilter] = useState<string>('all');
  const [paymentSearch, setPaymentSearch] = useState<string>('');

  // Combined Loading & Error States
  const isFetching = externalLoading || internalLoading;
  const activeError = externalError || internalError;

  // Fetch financial data from API if initial data is not supplied
  const fetchData = useCallback(async () => {
    setInternalLoading(true);
    setInternalError(null);

    try {
      const quoteParams: QuoteQueryParams = customerId ? { customer_id: customerId } : {};
      const invoiceParams: InvoiceQueryParams = customerId
        ? { customer_id: customerId }
        : {};
      const paymentParams: PaymentQueryParams = customerId
        ? { customer_id: customerId }
        : {};

      const [quotesRes, invoicesRes, paymentsRes] = await Promise.all([
        listQuotes(quoteParams),
        listInvoices(invoiceParams),
        listPayments(paymentParams),
      ]);

      setQuotes(quotesRes || []);
      setInvoices(invoicesRes || []);
      setPayments(paymentsRes || []);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Failed to retrieve financial dashboard records.';
      setInternalError(errMsg);
    } finally {
      setInternalLoading(false);
    }
  }, [customerId]);

  // Initial fetch effect
  useEffect(() => {
    if (initialQuotes !== null && initialInvoices !== null && initialPayments !== null) {
      setQuotes(initialQuotes || []);
      setInvoices(initialInvoices || []);
      setPayments(initialPayments || []);
    } else {
      fetchData();
    }
  }, [initialQuotes, initialInvoices, initialPayments, fetchData]);

  // Sync state if props update
  useEffect(() => {
    if (initialQuotes !== null && initialQuotes !== undefined) {
      setQuotes(initialQuotes);
    }
    if (initialInvoices !== null && initialInvoices !== undefined) {
      setInvoices(initialInvoices);
    }
    if (initialPayments !== null && initialPayments !== undefined) {
      setPayments(initialPayments);
    }
  }, [initialQuotes, initialInvoices, initialPayments]);

  // Handle Manual Refresh
  const handleRefreshClick = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      fetchData();
    }
  };

  // Filtered dataset calculations
  const filteredQuotes = useMemo(
    () => filterQuotes(quotes, quoteStateFilter, quoteSearch),
    [quotes, quoteStateFilter, quoteSearch]
  );

  const filteredInvoices = useMemo(
    () => filterInvoices(invoices, invoiceStatusFilter, invoiceSearch),
    [invoices, invoiceStatusFilter, invoiceSearch]
  );

  const filteredPayments = useMemo(
    () => filterPayments(payments, paymentInvoiceFilter, paymentSearch),
    [payments, paymentInvoiceFilter, paymentSearch]
  );

  // Summary Metrics
  const summary = useMemo(
    () => calculateFinancialSummary(quotes, invoices, payments),
    [quotes, invoices, payments]
  );

  // Helper to jump to Payments tab filtered by a specific invoice ID [FR-3]
  const handleViewInvoicePayments = (invoiceId: string) => {
    setPaymentInvoiceFilter(invoiceId);
    setActiveTab('payments');
  };

  return (
    <div
      className={twMerge(
        'w-full bg-[#fbf9f4] text-[#1b1c19] min-h-[600px] font-sans antialiased',
        className
      )}
      data-testid="financial-dashboard"
    >
      {/* Top Header Section */}
      <div className="border-b border-[#e3ded1] pb-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-md bg-[#f0eee9] text-[#735c41]">
                <DollarSign className="w-5 h-5" aria-hidden="true" />
              </span>
              <h1 className="text-2xl font-serif text-[#59452b] tracking-tight font-normal">
                Financial Transparency Dashboard
              </h1>
            </div>
            <p className="text-sm text-[#4e453d] mt-1">
              Consolidated view of authorized quotes, billing ledger invoices, and payment
              history records.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshClick}
              disabled={isFetching}
              className={clsx(
                'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border transition-colors',
                'border-[#c2b9a7] bg-[#f5f3ee] text-[#59452b] hover:bg-[#eae8e3]',
                'focus:outline-none focus:ring-2 focus:ring-[#735c41]',
                isFetching && 'opacity-60 cursor-not-allowed'
              )}
              aria-label="Refresh financial dashboard records"
            >
              <RotateCw
                className={clsx('w-4 h-4', isFetching && 'animate-spin')}
                aria-hidden="true"
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {activeError && (
          <div
            role="alert"
            className="mt-4 p-4 rounded-md bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <h3 className="text-sm font-medium">Failed to load financial records</h3>
              <p className="text-xs text-rose-700 mt-0.5">{activeError}</p>
            </div>
            <button
              onClick={handleRefreshClick}
              className="text-xs font-semibold underline text-rose-800 hover:text-rose-950 focus:outline-none"
            >
              Retry
            </button>
          </div>
        )}

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Quotes Summary Card [FR-1] */}
          <div className="p-4 rounded-lg bg-[#f0eee9] border border-[#e3ded1] shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#735c41]">
              <span className="text-xs font-medium uppercase tracking-wider text-[#80756b]">
                Authorized Quotes
              </span>
              <FileText className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-serif text-[#1b1c19]">
                {formatCurrency(summary.totalQuoteValue)}
              </span>
            </div>
            <div className="mt-2 text-xs text-[#4e453d] flex items-center justify-between border-t border-[#e3ded1] pt-2">
              <span>{summary.quotesCount} total quotes</span>
              <span className="text-emerald-800 font-medium">
                {summary.approvedQuotesCount} approved
              </span>
            </div>
          </div>

          {/* Invoices Summary Card [FR-2] */}
          <div className="p-4 rounded-lg bg-[#f0eee9] border border-[#e3ded1] shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#735c41]">
              <span className="text-xs font-medium uppercase tracking-wider text-[#80756b]">
                Outstanding Balance
              </span>
              <Receipt className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-serif text-[#1b1c19]">
                {formatCurrency(summary.totalOutstandingBalance)}
              </span>
            </div>
            <div className="mt-2 text-xs text-[#4e453d] flex items-center justify-between border-t border-[#e3ded1] pt-2">
              <span>{summary.invoicesCount} total invoices</span>
              {summary.pastDueInvoicesCount > 0 ? (
                <span className="text-rose-700 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                  {summary.pastDueInvoicesCount} past due
                </span>
              ) : (
                <span className="text-emerald-700 font-medium">0 past due</span>
              )}
            </div>
          </div>

          {/* Payments Summary Card [FR-3] */}
          <div className="p-4 rounded-lg bg-[#f0eee9] border border-[#e3ded1] shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#735c41]">
              <span className="text-xs font-medium uppercase tracking-wider text-[#80756b]">
                Payments Collected
              </span>
              <CreditCard className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-serif text-[#1b1c19]">
                {formatCurrency(summary.totalPaymentsCollected)}
              </span>
            </div>
            <div className="mt-2 text-xs text-[#4e453d] flex items-center justify-between border-t border-[#e3ded1] pt-2">
              <span>{summary.paymentsCount} transactions</span>
              <span className="text-sky-800 font-medium">Recorded history</span>
            </div>
          </div>

          {/* Invoices Billed Card */}
          <div className="p-4 rounded-lg bg-[#f0eee9] border border-[#e3ded1] shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#735c41]">
              <span className="text-xs font-medium uppercase tracking-wider text-[#80756b]">
                Total Volume Billed
              </span>
              <TrendingUp className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-serif text-[#1b1c19]">
                {formatCurrency(summary.totalInvoiceValue)}
              </span>
            </div>
            <div className="mt-2 text-xs text-[#4e453d] flex items-center justify-between border-t border-[#e3ded1] pt-2">
              <span>Collection rate</span>
              <span className="font-medium text-[#59452b]">
                {summary.totalInvoiceValue > 0
                  ? `${Math.round(
                      (summary.totalPaymentsCollected / summary.totalInvoiceValue) * 100
                    )}%`
                  : '0%'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className="border-b border-[#e3ded1] mb-6">
        <nav
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Financial Dashboard Sections"
        >
          <button
            role="tab"
            id="tab-overview"
            aria-selected={activeTab === 'overview'}
            aria-controls="panel-overview"
            onClick={() => setActiveTab('overview')}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap',
              activeTab === 'overview'
                ? 'border-[#735c41] bg-[#f0eee9] text-[#59452b]'
                : 'border-transparent text-[#80756b] hover:text-[#1b1c19] hover:bg-[#f5f3ee]'
            )}
          >
            <Layers className="w-4 h-4" aria-hidden="true" />
            <span>Consolidated Overview</span>
          </button>

          <button
            role="tab"
            id="tab-quotes"
            aria-selected={activeTab === 'quotes'}
            aria-controls="panel-quotes"
            onClick={() => setActiveTab('quotes')}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap',
              activeTab === 'quotes'
                ? 'border-[#735c41] bg-[#f0eee9] text-[#59452b]'
                : 'border-transparent text-[#80756b] hover:text-[#1b1c19] hover:bg-[#f5f3ee]'
            )}
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            <span>Quotes & Approval States</span>
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-[#e3ded1] text-[#59452b]">
              {quotes.length}
            </span>
          </button>

          <button
            role="tab"
            id="tab-invoices"
            aria-selected={activeTab === 'invoices'}
            aria-controls="panel-invoices"
            onClick={() => setActiveTab('invoices')}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap',
              activeTab === 'invoices'
                ? 'border-[#735c41] bg-[#f0eee9] text-[#59452b]'
                : 'border-transparent text-[#80756b] hover:text-[#1b1c19] hover:bg-[#f5f3ee]'
            )}
          >
            <Receipt className="w-4 h-4" aria-hidden="true" />
            <span>Invoices Ledger</span>
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-[#e3ded1] text-[#59452b]">
              {invoices.length}
            </span>
          </button>

          <button
            role="tab"
            id="tab-payments"
            aria-selected={activeTab === 'payments'}
            aria-controls="panel-payments"
            onClick={() => setActiveTab('payments')}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap',
              activeTab === 'payments'
                ? 'border-[#735c41] bg-[#f0eee9] text-[#59452b]'
                : 'border-transparent text-[#80756b] hover:text-[#1b1c19] hover:bg-[#f5f3ee]'
            )}
          >
            <CreditCard className="w-4 h-4" aria-hidden="true" />
            <span>Payment Histories</span>
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-[#e3ded1] text-[#59452b]">
              {payments.length}
            </span>
          </button>
        </nav>
      </div>

      {/* Loading Indicator Overlay/State */}
      {isFetching && (
        <div
          role="status"
          aria-busy="true"
          className="p-8 rounded-lg bg-[#f0eee9]/60 border border-[#e3ded1] text-center my-4"
        >
          <RotateCw className="w-6 h-6 animate-spin text-[#735c41] mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm font-medium text-[#59452b]">
            Loading financial records & billing ledger...
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: CONSOLIDATED OVERVIEW                                              */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && !isFetching && (
        <div
          id="panel-overview"
          role="tabpanel"
          aria-labelledby="tab-overview"
          className="space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Quotes Panel [FR-1] */}
            <div className="p-5 rounded-lg bg-[#ffffff] border border-[#e3ded1] shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-[#f0eee9] pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#735c41]" aria-hidden="true" />
                  <h2 className="text-lg font-serif text-[#59452b]">Recent Quotes</h2>
                </div>
                <button
                  onClick={() => setActiveTab('quotes')}
                  className="text-xs font-medium text-[#735c41] hover:underline inline-flex items-center gap-1"
                >
                  <span>View All Quotes</span>
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              {quotes.length === 0 ? (
                <div className="py-8 text-center text-[#80756b] text-sm">
                  No authorized quotes available.
                </div>
              ) : (
                <div className="space-y-3">
                  {quotes.slice(0, 4).map((q) => {
                    const badge = getQuoteApprovalBadge(q.approval_state);
                    return (
                      <div
                        key={q.quote_id}
                        onClick={() => onSelectQuote?.(q)}
                        className={clsx(
                          'p-3 rounded-md border border-[#e3ded1] bg-[#fbf9f4] hover:border-[#c2b9a7] transition-all flex items-center justify-between',
                          onSelectQuote && 'cursor-pointer'
                        )}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#1b1c19] font-mono">
                              {q.quote_id}
                            </span>
                            <span
                              className={clsx(
                                'px-2 py-0.5 text-xs font-medium rounded-full border',
                                badge.bgClass
                              )}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <p className="text-xs text-[#80756b] flex items-center gap-2">
                            <span>Cust: {q.customer_id}</span>
                            <span>•</span>
                            <span>Exp: {formatDate(q.expiration_date_time)}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-medium text-[#59452b]">
                            {formatCurrency(q.total_amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Invoices Panel [FR-2] */}
            <div className="p-5 rounded-lg bg-[#ffffff] border border-[#e3ded1] shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-[#f0eee9] pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#735c41]" aria-hidden="true" />
                  <h2 className="text-lg font-serif text-[#59452b]">Outstanding Invoices</h2>
                </div>
                <button
                  onClick={() => setActiveTab('invoices')}
                  className="text-xs font-medium text-[#735c41] hover:underline inline-flex items-center gap-1"
                >
                  <span>View All Invoices</span>
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              {invoices.length === 0 ? (
                <div className="py-8 text-center text-[#80756b] text-sm">
                  No invoices recorded in ledger.
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.slice(0, 4).map((inv) => {
                    const badge = getInvoiceStatusBadge(inv.status);
                    return (
                      <div
                        key={inv.invoice_id}
                        onClick={() => onSelectInvoice?.(inv)}
                        className={clsx(
                          'p-3 rounded-md border border-[#e3ded1] bg-[#fbf9f4] hover:border-[#c2b9a7] transition-all flex items-center justify-between',
                          onSelectInvoice && 'cursor-pointer'
                        )}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#1b1c19] font-mono">
                              {inv.invoice_id}
                            </span>
                            <span
                              className={clsx(
                                'px-2 py-0.5 text-xs font-medium rounded-full border',
                                badge.bgClass
                              )}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <p className="text-xs text-[#80756b]">
                            Due: {formatDate(inv.due_date_time)}
                            {inv.days_overdue > 0 && (
                              <span className="ml-2 text-rose-700 font-medium">
                                ({inv.days_overdue} days overdue)
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-medium text-[#1b1c19]">
                            {formatCurrency(inv.total_amount)}
                          </span>
                          <p className="text-xs text-[#80756b]">
                            Balance: {formatCurrency(inv.outstanding_amount)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Payment History Feed [FR-3] */}
          <div className="p-5 rounded-lg bg-[#ffffff] border border-[#e3ded1] shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-[#f0eee9] pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#735c41]" aria-hidden="true" />
                <h2 className="text-lg font-serif text-[#59452b]">
                  Recent Payment Transactions
                </h2>
              </div>
              <button
                onClick={() => setActiveTab('payments')}
                className="text-xs font-medium text-[#735c41] hover:underline inline-flex items-center gap-1"
              >
                <span>View Full Payment History</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {payments.length === 0 ? (
              <div className="py-8 text-center text-[#80756b] text-sm">
                No payment transaction history records available.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {payments.slice(0, 6).map((p) => (
                  <div
                    key={p.payment_id}
                    onClick={() => onSelectPayment?.(p)}
                    className={clsx(
                      'p-3 rounded-md border border-[#e3ded1] bg-[#fbf9f4] space-y-2',
                      onSelectPayment && 'cursor-pointer hover:border-[#c2b9a7]'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-medium text-[#80756b]">
                        {p.payment_id}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#f0eee9] text-[#59452b]">
                        {p.payment_method}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between border-t border-[#e3ded1] pt-2">
                      <span className="text-xs text-[#80756b]">
                        Inv: {p.invoice_id}
                      </span>
                      <span className="text-base font-semibold text-emerald-800">
                        {formatCurrency(p.amount_paid)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#80756b] text-right">
                      Date: {formatDate(p.payment_date_time)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: QUOTES WITH APPROVAL STATES [FR-1]                                 */}
      {/* ========================================================================= */}
      {activeTab === 'quotes' && !isFetching && (
        <div
          id="panel-quotes"
          role="tabpanel"
          aria-labelledby="tab-quotes"
          className="space-y-6"
        >
          {/* Controls Bar for Quotes */}
          <div className="p-4 rounded-lg bg-[#ffffff] border border-[#e3ded1] flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                className="w-4 h-4 text-[#80756b] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={quoteSearch}
                onChange={(e) => setQuoteSearch(e.target.value)}
                placeholder="Search quotes by ID, customer, or amount..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-[#c2b9a7] bg-[#fbf9f4] text-[#1b1c19] placeholder-[#80756b] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                aria-label="Search authorized quotes"
              />
            </div>

            {/* Approval State Filters */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              <span className="text-xs font-medium text-[#80756b] mr-2 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" aria-hidden="true" /> State:
              </span>
              {['all', 'draft', 'pending approval', 'approved', 'expired'].map((st) => {
                const isActive = quoteStateFilter === st;
                return (
                  <button
                    key={st}
                    onClick={() => setQuoteStateFilter(st)}
                    className={clsx(
                      'px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap',
                      isActive
                        ? 'bg-[#59452b] text-[#ffffff]'
                        : 'bg-[#f0eee9] text-[#59452b] hover:bg-[#eae8e3]'
                    )}
                    aria-pressed={isActive}
                  >
                    {st === 'all' ? 'All States' : st}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quotes Table */}
          {filteredQuotes.length === 0 ? (
            <div
              className="p-12 rounded-lg bg-[#ffffff] border border-[#e3ded1] text-center"
              aria-live="polite"
            >
              <FileText className="w-10 h-10 text-[#c2b9a7] mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-base font-medium text-[#59452b]">No authorized quotes found</h3>
              <p className="text-sm text-[#80756b] mt-1 max-w-sm mx-auto">
                No quote records matched your current filter criteria or state selection.
              </p>
              {(quoteStateFilter !== 'all' || quoteSearch) && (
                <button
                  onClick={() => {
                    setQuoteStateFilter('all');
                    setQuoteSearch('');
                  }}
                  className="mt-4 px-3 py-1.5 text-xs font-medium rounded bg-[#f0eee9] text-[#59452b] hover:bg-[#eae8e3]"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-[#e3ded1] bg-[#ffffff] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm" aria-label="Authorized Quotes List">
                  <thead className="bg-[#f0eee9] text-[#59452b] text-xs font-medium uppercase tracking-wider border-b border-[#e3ded1]">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Quote ID
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Customer ID
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Approval State
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Expiration Date
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Created Date
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Total Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3ded1]">
                    {filteredQuotes.map((q) => {
                      const badge = getQuoteApprovalBadge(q.approval_state);
                      return (
                        <tr
                          key={q.quote_id}
                          onClick={() => onSelectQuote?.(q)}
                          className={clsx(
                            'hover:bg-[#fbf9f4] transition-colors',
                            onSelectQuote && 'cursor-pointer'
                          )}
                        >
                          <td className="px-4 py-3 font-mono text-xs font-medium text-[#1b1c19]">
                            {q.quote_id}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#4e453d] font-mono">
                            {q.customer_id}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={clsx(
                                'px-2.5 py-1 text-xs font-medium rounded-full border inline-flex items-center gap-1',
                                badge.bgClass
                              )}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#1b1c19]">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#80756b]" aria-hidden="true" />
                              {formatDate(q.expiration_date_time)}
                              {q.is_expired && (
                                <span className="text-[10px] font-semibold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                                  EXPIRED
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#80756b]">
                            {formatDate(q.created_at)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-[#59452b] text-base">
                            {formatCurrency(q.total_amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STATUS-FILTERED INVOICES [FR-2]                                   */}
      {/* ========================================================================= */}
      {activeTab === 'invoices' && !isFetching && (
        <div
          id="panel-invoices"
          role="tabpanel"
          aria-labelledby="tab-invoices"
          className="space-y-6"
        >
          {/* Controls Bar for Invoices */}
          <div className="p-4 rounded-lg bg-[#ffffff] border border-[#e3ded1] flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                className="w-4 h-4 text-[#80756b] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                placeholder="Search invoices by ID, customer, quote, or status..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-[#c2b9a7] bg-[#fbf9f4] text-[#1b1c19] placeholder-[#80756b] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                aria-label="Search status-filtered invoices"
              />
            </div>

            {/* Status Filter Buttons [FR-2] */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              <span className="text-xs font-medium text-[#80756b] mr-2 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" aria-hidden="true" /> Status:
              </span>
              {['all', 'current', 'pending', 'past due', 'paid'].map((st) => {
                const isActive = invoiceStatusFilter === st;
                return (
                  <button
                    key={st}
                    onClick={() => setInvoiceStatusFilter(st)}
                    className={clsx(
                      'px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap',
                      isActive
                        ? 'bg-[#59452b] text-[#ffffff]'
                        : 'bg-[#f0eee9] text-[#59452b] hover:bg-[#eae8e3]'
                    )}
                    aria-pressed={isActive}
                  >
                    {st === 'all' ? 'All Invoices' : st}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Invoices Table */}
          {filteredInvoices.length === 0 ? (
            <div
              className="p-12 rounded-lg bg-[#ffffff] border border-[#e3ded1] text-center"
              aria-live="polite"
            >
              <Receipt className="w-10 h-10 text-[#c2b9a7] mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-base font-medium text-[#59452b]">No invoices found</h3>
              <p className="text-sm text-[#80756b] mt-1 max-w-sm mx-auto">
                No invoice records match your current status filter or search parameters.
              </p>
              {(invoiceStatusFilter !== 'all' || invoiceSearch) && (
                <button
                  onClick={() => {
                    setInvoiceStatusFilter('all');
                    setInvoiceSearch('');
                  }}
                  className="mt-4 px-3 py-1.5 text-xs font-medium rounded bg-[#f0eee9] text-[#59452b] hover:bg-[#eae8e3]"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-[#e3ded1] bg-[#ffffff] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm" aria-label="Status-filtered Invoices Ledger">
                  <thead className="bg-[#f0eee9] text-[#59452b] text-xs font-medium uppercase tracking-wider border-b border-[#e3ded1]">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Invoice ID
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Customer / Quote
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Issue Date
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Due Date
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Total Amount
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Outstanding
                      </th>
                      <th scope="col" className="px-4 py-3 text-center">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3ded1]">
                    {filteredInvoices.map((inv) => {
                      const badge = getInvoiceStatusBadge(inv.status);
                      const isOverdue = inv.days_overdue > 0 || badge.label === 'Past Due';
                      return (
                        <tr
                          key={inv.invoice_id}
                          onClick={() => onSelectInvoice?.(inv)}
                          className={clsx(
                            'hover:bg-[#fbf9f4] transition-colors',
                            onSelectInvoice && 'cursor-pointer'
                          )}
                        >
                          <td className="px-4 py-3 font-mono text-xs font-medium text-[#1b1c19]">
                            {inv.invoice_id}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#4e453d] font-mono">
                            <div>Cust: {inv.customer_id}</div>
                            {inv.quote_id && (
                              <div className="text-[#80756b] text-[11px]">
                                Quote: {inv.quote_id}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={clsx(
                                'px-2.5 py-1 text-xs font-medium rounded-full border inline-flex items-center gap-1',
                                badge.bgClass
                              )}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#80756b]">
                            {formatDate(inv.issue_date_time)}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#1b1c19]">
                            <div>{formatDate(inv.due_date_time)}</div>
                            {isOverdue && (
                              <div className="text-rose-700 font-semibold text-[11px]">
                                {inv.days_overdue} days overdue
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-[#1b1c19]">
                            {formatCurrency(inv.total_amount)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-[#59452b]">
                            {formatCurrency(inv.outstanding_amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewInvoicePayments(inv.invoice_id);
                              }}
                              className="px-2.5 py-1 text-xs font-medium rounded bg-[#f0eee9] text-[#735c41] hover:bg-[#eae8e3] inline-flex items-center gap-1"
                              aria-label={`View payments for invoice ${inv.invoice_id}`}
                            >
                              <LinkIcon className="w-3 h-3" aria-hidden="true" />
                              <span>Payments</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PAYMENT HISTORIES LINKED TO INVOICES [FR-3]                       */}
      {/* ========================================================================= */}
      {activeTab === 'payments' && !isFetching && (
        <div
          id="panel-payments"
          role="tabpanel"
          aria-labelledby="tab-payments"
          className="space-y-6"
        >
          {/* Controls Bar for Payments */}
          <div className="p-4 rounded-lg bg-[#ffffff] border border-[#e3ded1] flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                className="w-4 h-4 text-[#80756b] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                placeholder="Search payment records by ID, invoice, or method..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-[#c2b9a7] bg-[#fbf9f4] text-[#1b1c19] placeholder-[#80756b] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                aria-label="Search payment history records"
              />
            </div>

            {/* Linked Invoice Filter Dropdown [FR-3] */}
            <div className="flex items-center gap-2">
              <label htmlFor="invoice-filter-select" className="text-xs font-medium text-[#80756b] whitespace-nowrap">
                Linked Invoice:
              </label>
              <select
                id="invoice-filter-select"
                value={paymentInvoiceFilter}
                onChange={(e) => setPaymentInvoiceFilter(e.target.value)}
                className="py-1.5 px-3 text-xs rounded-md border border-[#c2b9a7] bg-[#fbf9f4] text-[#1b1c19] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                aria-label="Filter payments by linked invoice ID"
              >
                <option value="all">All Invoices</option>
                {invoices.map((inv) => (
                  <option key={inv.invoice_id} value={inv.invoice_id}>
                    Invoice {inv.invoice_id} ({formatCurrency(inv.total_amount)})
                  </option>
                ))}
              </select>

              {paymentInvoiceFilter !== 'all' && (
                <button
                  onClick={() => setPaymentInvoiceFilter('all')}
                  className="px-2 py-1 text-xs text-[#80756b] hover:text-[#1b1c19] underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Payments Table */}
          {filteredPayments.length === 0 ? (
            <div
              className="p-12 rounded-lg bg-[#ffffff] border border-[#e3ded1] text-center"
              aria-live="polite"
            >
              <CreditCard className="w-10 h-10 text-[#c2b9a7] mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-base font-medium text-[#59452b]">
                No payment transaction records found
              </h3>
              <p className="text-sm text-[#80756b] mt-1 max-w-sm mx-auto">
                No payment history records match your invoice filter or search query.
              </p>
              {(paymentInvoiceFilter !== 'all' || paymentSearch) && (
                <button
                  onClick={() => {
                    setPaymentInvoiceFilter('all');
                    setPaymentSearch('');
                  }}
                  className="mt-4 px-3 py-1.5 text-xs font-medium rounded bg-[#f0eee9] text-[#59452b] hover:bg-[#eae8e3]"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-[#e3ded1] bg-[#ffffff] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table
                  className="w-full text-left text-sm"
                  aria-label="Complete Payment Histories linked to Invoices"
                >
                  <thead className="bg-[#f0eee9] text-[#59452b] text-xs font-medium uppercase tracking-wider border-b border-[#e3ded1]">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Payment ID
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Linked Invoice ID
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Payment Method
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Transaction Date
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Amount Paid
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3ded1]">
                    {filteredPayments.map((p) => (
                      <tr
                        key={p.payment_id}
                        onClick={() => onSelectPayment?.(p)}
                        className={clsx(
                          'hover:bg-[#fbf9f4] transition-colors',
                          onSelectPayment && 'cursor-pointer'
                        )}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium text-[#1b1c19]">
                          {p.payment_id}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#59452b]">
                          <span className="inline-flex items-center gap-1 bg-[#f0eee9] px-2 py-0.5 rounded">
                            <Receipt className="w-3 h-3 text-[#735c41]" aria-hidden="true" />
                            {p.invoice_id}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#1b1c19]">
                          <span className="px-2 py-0.5 rounded border border-[#e3ded1] bg-[#fbf9f4]">
                            {p.payment_method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#80756b]">
                          {formatDate(p.payment_date_time)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-800 text-base">
                          {formatCurrency(p.amount_paid)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
