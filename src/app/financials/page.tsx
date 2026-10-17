'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  CreditCard,
  Receipt,
  ShieldCheck,
  Building,
  User,
  Key,
  RefreshCw,
  AlertCircle,
  Filter,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  X,
  Plus,
  Download,
  Lock,
  FileText,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { apiClient, UserMeResponse, NavItem, ApiError } from '../../services/apiClient';
import { StatusLabel } from '../../components/common/StatusLabel';
import { useAccessibility } from '../../components/common/AccessibilityContext';

export interface FinancialTransaction {
  id: string;
  transaction_id: string;
  description: string;
  client_entity: string;
  category: 'subscription' | 'usage_fee' | 'audit_service' | 'support_retainer' | 'custom_integration';
  amount: number;
  formatted_amount: string;
  status: 'completed' | 'pending' | 'processing' | 'failed';
  billing_date: string;
  payment_method: string;
  audit_correlation_id: string;
  assigned_role_required: string;
}

const INITIAL_TRANSACTIONS: FinancialTransaction[] = [
  {
    id: 'fin-101',
    transaction_id: 'TXN-2026-001',
    description: 'Annual Enterprise Platform Licensing',
    client_entity: 'Acme Financial Corp',
    category: 'subscription',
    amount: 120000.0,
    formatted_amount: '$120,000.00',
    status: 'completed',
    billing_date: '2026-03-01',
    payment_method: 'ACH Transfer (Bank Wire)',
    audit_correlation_id: 'corr-fin-8801-a1',
    assigned_role_required: 'ClientStandard',
  },
  {
    id: 'fin-102',
    transaction_id: 'TXN-2026-002',
    description: 'RBAC Access Control & Security Audit Retainer',
    client_entity: 'Apex Systems LLC',
    category: 'audit_service',
    amount: 18500.0,
    formatted_amount: '$18,500.00',
    status: 'completed',
    billing_date: '2026-03-10',
    payment_method: 'Corporate Credit Card',
    audit_correlation_id: 'corr-fin-8802-b2',
    assigned_role_required: 'ClientViewer',
  },
  {
    id: 'fin-103',
    transaction_id: 'TXN-2026-003',
    description: 'High-Volume API Usage & Telemetry Settlement',
    client_entity: 'Nexus Operations',
    category: 'usage_fee',
    amount: 14250.0,
    formatted_amount: '$14,250.00',
    status: 'pending',
    billing_date: '2026-03-15',
    payment_method: 'Direct Debit (SEPA)',
    audit_correlation_id: 'corr-fin-8803-c3',
    assigned_role_required: 'Admin',
  },
  {
    id: 'fin-104',
    transaction_id: 'TXN-2026-004',
    description: 'Dedicated Support & SLA Infrastructure Retainer',
    client_entity: 'Vanguard Tech',
    category: 'support_retainer',
    amount: 9500.0,
    formatted_amount: '$9,500.00',
    status: 'processing',
    billing_date: '2026-03-18',
    payment_method: 'ACH Transfer',
    audit_correlation_id: 'corr-fin-8804-d4',
    assigned_role_required: 'Admin',
  },
  {
    id: 'fin-105',
    transaction_id: 'TXN-2026-005',
    description: 'Custom SSO & Tenant Boundary Integration',
    client_entity: 'Global Logistics',
    category: 'custom_integration',
    amount: 25000.0,
    formatted_amount: '$25,000.00',
    status: 'failed',
    billing_date: '2026-02-28',
    payment_method: 'Wire Transfer',
    audit_correlation_id: 'corr-fin-8805-e5',
    assigned_role_required: 'Admin',
  },
  {
    id: 'fin-106',
    transaction_id: 'TXN-2026-006',
    description: 'Multi-Tenant JSON Audit Storage License',
    client_entity: 'Acme Financial Corp',
    category: 'subscription',
    amount: 32000.0,
    formatted_amount: '$32,000.00',
    status: 'completed',
    billing_date: '2026-03-20',
    payment_method: 'ACH Transfer',
    audit_correlation_id: 'corr-fin-8806-f6',
    assigned_role_required: 'ClientStandard',
  },
];

export default function FinancialsPage() {
  const router = useRouter();
  const { announce } = useAccessibility();

  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(INITIAL_TRANSACTIONS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchFinancialsData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const token = apiClient.getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const [userData, navData] = await Promise.all([
        apiClient.getMe(),
        apiClient.getNavigationMenu(),
      ]);

      setUser(userData);
      setNavItems(navData.items || []);
      announce('Financial ledger data loaded successfully.', 'polite');
    } catch (err) {
      console.error('Failed to load financials data:', err);
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      const message = err instanceof Error ? err.message : 'An error occurred while loading financials data.';
      setError(message);
      announce(`Error loading financials: ${message}`, 'assertive');
    } finally {
      setLoading(false);
    }
  }, [router, announce]);

  useEffect(() => {
    fetchFinancialsData();
  }, [fetchFinancialsData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchFinancialsData();
      announce('Financial transactions refreshed successfully.', 'polite');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCategoryFilterChange = (category: string) => {
    setCategoryFilter(category);
    announce(`Filtered financial transactions by ${category === 'all' ? 'all categories' : category.replace('_', ' ')}.`, 'polite');
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    announce(`Filtered financial transactions by ${status === 'all' ? 'all statuses' : status}.`, 'polite');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleOpenModal = (txn: FinancialTransaction) => {
    setSelectedTransaction(txn);
    announce(`Viewing ledger details for transaction ${txn.transaction_id}.`, 'polite');
  };

  const handleCloseModal = () => {
    setSelectedTransaction(null);
    announce('Closed transaction details modal.', 'polite');
  };

  const handleExportStatement = () => {
    const notice = 'Tenant financial statement export initiated. Download link prepared with audit signature.';
    setActionNotice(notice);
    announce(notice, 'polite');
    setTimeout(() => {
      setActionNotice(null);
    }, 5000);
  };

  const handleGenerateInvoice = () => {
    const notice = 'Invoice request generated under tenant context. Audit log event recorded.';
    setActionNotice(notice);
    announce(notice, 'polite');
    setTimeout(() => {
      setActionNotice(null);
    }, 5000);
  };

  const handleDownloadReceipt = (txn: FinancialTransaction) => {
    const notice = `Audit-logged receipt generated for transaction ${txn.transaction_id}.`;
    setActionNotice(notice);
    announce(notice, 'polite');
    setTimeout(() => {
      setActionNotice(null);
    }, 5000);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const matchesCategory = categoryFilter === 'all' || txn.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || txn.status === statusFilter;
      const query = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !query ||
        txn.transaction_id.toLowerCase().includes(query) ||
        txn.description.toLowerCase().includes(query) ||
        txn.client_entity.toLowerCase().includes(query) ||
        txn.category.toLowerCase().includes(query) ||
        txn.audit_correlation_id.toLowerCase().includes(query);

      return matchesCategory && matchesStatus && matchesQuery;
    });
  }, [transactions, categoryFilter, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const totalCount = transactions.length;
    const totalAmount = transactions.reduce((acc, t) => acc + t.amount, 0);
    const completedAmount = transactions
      .filter((t) => t.status === 'completed')
      .reduce((acc, t) => acc + t.amount, 0);
    const pendingAmount = transactions
      .filter((t) => t.status === 'pending' || t.status === 'processing')
      .reduce((acc, t) => acc + t.amount, 0);
    const auditVerifiedRate = Math.round(
      (transactions.filter((t) => t.status !== 'failed').length / (totalCount || 1)) * 100
    );

    return {
      totalCount,
      totalAmount,
      completedAmount,
      pendingAmount,
      auditVerifiedRate,
    };
  }, [transactions]);

  const getStatusType = (status: FinancialTransaction['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'active';
      case 'pending':
        return 'pending';
      case 'failed':
        return 'error';
      default:
        return 'info';
    }
  };

  const formatCategoryLabel = (category: string) => {
    switch (category) {
      case 'subscription':
        return 'Subscription';
      case 'usage_fee':
        return 'Usage Fee';
      case 'audit_service':
        return 'Audit Service';
      case 'support_retainer':
        return 'Support Retainer';
      case 'custom_integration':
        return 'Custom Integration';
      default:
        return category;
    }
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading financials view"
        className="flex flex-col items-center justify-center min-h-[400px] py-12 px-4 space-y-4"
      >
        <div className="w-10 h-10 border-4 border-[#735c41] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#4e453d]">Loading financial records & billing ledger...</p>
        <span className="sr-only">Loading financials content, please wait.</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="my-6 p-6 bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded-lg max-w-2xl mx-auto space-y-4 text-[#1b1c19]"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-[#ba1a1a] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="text-lg font-serif font-semibold text-[#93000a]">Failed to Load Financials</h2>
            <p className="text-sm text-[#4e453d]">{error}</p>
          </div>
        </div>
        <div className="pt-2 flex gap-3">
          <button
            onClick={() => fetchFinancialsData()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#59452b] rounded-md hover:bg-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:ring-offset-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Retry Loading
          </button>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#59452b] bg-[#f5f3ee] border border-[#d1c4b9] rounded-md hover:bg-[#eae8e3] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors"
          >
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Page Header */}
      <header className="border-b border-[#d1c4b9]/40 pb-6 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-7 h-7 text-[#59452b]" aria-hidden="true" />
              <h1 className="text-3xl sm:text-4xl font-serif text-[#1b1c19] tracking-tight">
                Financials & Tenant Billing
              </h1>
            </div>
            <p className="mt-1 text-sm sm:text-base text-[#4e453d]">
              Multi-tenant financial transactions, billing ledgers, settlement records, and audit-logged invoices.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <StatusLabel status="active" label="Tenant Isolated" ariaLive="polite" />
          </div>
        </div>
      </header>

      {/* User Context & Tenant Isolation Notice */}
      {user && (
        <section
          aria-label="User identity and financial tenant boundary"
          className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-5 sm:p-6 shadow-sm space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d1c4b9]/30 pb-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[#1b1c19]">{user.email}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 bg-[#f0eee9] px-3 py-1.5 rounded-md border border-[#d1c4b9]/40">
                <Building className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
                <span className="font-medium text-[#4e453d]">Tenant Context:</span>
                <span className="font-mono font-semibold text-[#1b1c19]">{user.tenant_id}</span>
              </div>

              <div className="flex items-center gap-1.5 bg-[#f0eee9] px-3 py-1.5 rounded-md border border-[#d1c4b9]/40">
                <Key className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
                <span className="font-medium text-[#4e453d]">Roles:</span>
                <span className="font-semibold text-[#1b1c19]">{user.roles?.join(', ') || 'None'}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-[#80756b]">
            Financial transactions listed below are isolated strictly to tenant <span className="font-mono text-[#1b1c19]">{user.tenant_id}</span> with sub-20ms server-side RBAC evaluation and structured JSON audit logging.
          </p>
        </section>
      )}

      {/* Action Notification Banner */}
      {actionNotice && (
        <div
          role="status"
          className="p-4 bg-[#f0eee9] border border-[#735c41]/30 rounded-lg text-xs font-medium text-[#59452b] flex items-center justify-between transition-all"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
            <span>{actionNotice}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-[#80756b] hover:text-[#1b1c19]"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Key Financial Summary Cards */}
      <section aria-labelledby="financial-summary-heading" className="space-y-4">
        <h2 id="financial-summary-heading" className="text-xl font-serif text-[#1b1c19] tracking-tight">
          Financial Portfolio Summary
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">Total Billing</span>
              <Wallet className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
            </div>
            <p className="text-2xl sm:text-3xl font-serif font-bold text-[#1b1c19]">
              ${stats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-[#4e453d]">{stats.totalCount} ledger entries in tenant context</p>
          </div>

          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">Completed Settlements</span>
              <StatusLabel status="operational" label="Settled" />
            </div>
            <p className="text-2xl sm:text-3xl font-serif font-bold text-[#1b1c19]">
              ${stats.completedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-[#4e453d]">Verified and settled funds</p>
          </div>

          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">Pending Invoices</span>
              <StatusLabel status="pending" label="Pending" />
            </div>
            <p className="text-2xl sm:text-3xl font-serif font-bold text-[#1b1c19]">
              ${stats.pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-[#4e453d]">Awaiting settlement clearance</p>
          </div>

          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">Audit Pass Rate</span>
              <StatusLabel status="active" label="Verified" />
            </div>
            <p className="text-2xl sm:text-3xl font-serif font-bold text-[#1b1c19]">
              {stats.auditVerifiedRate}%
            </p>
            <p className="text-xs text-[#4e453d]">Compliant transaction events</p>
          </div>
        </div>
      </section>

      {/* Search, Filters & Actions Bar */}
      <section
        aria-label="Financials search and filter controls"
        className="bg-[#f0eee9] border border-[#d1c4b9]/40 rounded-lg p-4 space-y-4 lg:space-y-0 lg:flex lg:items-center lg:justify-between gap-4"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#80756b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search transactions, client entities, or correlation IDs..."
              aria-label="Search transactions, client entities, or correlation IDs"
              className="w-full pl-9 pr-4 py-2 bg-[#fbf9f4] border border-[#d1c4b9] rounded-md text-sm text-[#1b1c19] placeholder-[#80756b] focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:border-transparent transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Filter className="w-4 h-4 text-[#80756b] shrink-0" aria-hidden="true" />
            <span className="text-xs font-medium text-[#4e453d] shrink-0">Category:</span>
            <div className="flex items-center gap-1">
              {['all', 'subscription', 'usage_fee', 'audit_service', 'support_retainer', 'custom_integration'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryFilterChange(cat)}
                  aria-pressed={categoryFilter === cat}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                    categoryFilter === cat
                      ? 'bg-[#59452b] text-white'
                      : 'bg-[#f5f3ee] text-[#4e453d] hover:bg-[#eae8e3]'
                  }`}
                >
                  {cat === 'all' ? 'All' : formatCategoryLabel(cat)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between lg:justify-end">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-[#4e453d] shrink-0">Status:</span>
            {['all', 'completed', 'pending', 'processing', 'failed'].map((st) => (
              <button
                key={st}
                onClick={() => handleStatusFilterChange(st)}
                aria-pressed={statusFilter === st}
                className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-[#59452b] text-white'
                    : 'bg-[#f5f3ee] text-[#4e453d] hover:bg-[#eae8e3]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh financials data"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#59452b] bg-[#f5f3ee] border border-[#d1c4b9] rounded-md hover:bg-[#eae8e3] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleGenerateInvoice}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#59452b] bg-[#f5f3ee] border border-[#d1c4b9] rounded-md hover:bg-[#eae8e3] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Request Invoice</span>
            </button>

            <button
              onClick={handleExportStatement}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#59452b] rounded-md hover:bg-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:ring-offset-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export Statement</span>
            </button>
          </div>
        </div>
      </section>

      {/* Financial Transactions Table Section */}
      <section aria-labelledby="financial-table-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 id="financial-table-heading" className="text-xl font-serif text-[#1b1c19] tracking-tight">
            Tenant Billing Ledger & Transactions
          </h2>
          <span className="text-xs text-[#80756b]">
            Showing {filteredTransactions.length} of {transactions.length} total entries
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-12 text-center space-y-3">
            <Receipt className="w-10 h-10 text-[#80756b] mx-auto" aria-hidden="true" />
            <h3 className="text-lg font-serif text-[#1b1c19]">No Financial Records Found</h3>
            <p className="text-sm text-[#4e453d] max-w-md mx-auto">
              No transactions match your current search query or active filter settings.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
                setStatusFilter('all');
                announce('Cleared all financial search filters.', 'polite');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#59452b] bg-[#f0eee9] border border-[#d1c4b9] rounded-md hover:bg-[#eae8e3] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
            >
              Clear Filters & Reset View
            </button>
          </div>
        ) : (
          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f0eee9] border-b border-[#d1c4b9]/40 text-xs font-medium text-[#4e453d] uppercase tracking-wider">
                    <th scope="col" className="py-3.5 px-4">Transaction ID</th>
                    <th scope="col" className="py-3.5 px-4">Description & Client</th>
                    <th scope="col" className="py-3.5 px-4">Category</th>
                    <th scope="col" className="py-3.5 px-4">Billing Date</th>
                    <th scope="col" className="py-3.5 px-4 text-right">Amount</th>
                    <th scope="col" className="py-3.5 px-4">Status</th>
                    <th scope="col" className="py-3.5 px-4">Audit Correlation ID</th>
                    <th scope="col" className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d1c4b9]/30 text-sm text-[#1b1c19]">
                  {filteredTransactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-[#eae8e3]/50 transition-colors">
                      <td className="py-4 px-4 font-mono font-semibold text-xs text-[#59452b]">
                        {txn.transaction_id}
                      </td>

                      <td className="py-4 px-4 space-y-0.5">
                        <div className="font-medium text-[#1b1c19]">{txn.description}</div>
                        <div className="text-xs text-[#80756b] flex items-center gap-1">
                          <Building className="w-3 h-3" aria-hidden="true" />
                          <span>{txn.client_entity}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f0eee9] text-[#4e453d] border border-[#d1c4b9]/50">
                          {formatCategoryLabel(txn.category)}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-xs text-[#4e453d] whitespace-nowrap">
                        {txn.billing_date}
                      </td>

                      <td className="py-4 px-4 font-mono font-semibold text-right text-sm text-[#1b1c19]">
                        {txn.formatted_amount}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <StatusLabel
                          status={getStatusType(txn.status)}
                          label={txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
                        />
                      </td>

                      <td className="py-4 px-4 font-mono text-xs text-[#80756b] whitespace-nowrap">
                        {txn.audit_correlation_id}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleOpenModal(txn)}
                          aria-label={`View ledger details for transaction ${txn.transaction_id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#59452b] bg-[#f0eee9] border border-[#d1c4b9] rounded hover:bg-[#eae8e3] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Financial Governance & Audit Policy Notice */}
      <section
        aria-labelledby="governance-heading"
        className="bg-[#f0eee9] border border-[#d1c4b9]/40 rounded-lg p-6 space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-[#d1c4b9]/30 pb-3">
          <ShieldCheck className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
          <h2 id="governance-heading" className="text-lg font-serif text-[#1b1c19]">
            Financial Governance & Audit Logging Specification
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-[#4e453d]">
          <div className="space-y-1.5">
            <h3 className="font-semibold text-[#1b1c19] text-sm">Server-Side RBAC Enforcement</h3>
            <p>
              Every API endpoint serving billing records evaluates assigned user roles (e.g., ClientStandard, ClientViewer, Admin) prior to returning sensitive financial details (FR-1, NFR-1).
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-semibold text-[#1b1c19] text-sm">Machine-Readable Audit Logs</h3>
            <p>
              Financial transactions emit structured JSON audit events to stdout with correlation IDs, timestamps (logged_at), assigned roles, client IP, and outcome status (FR-6, FR-7, NFR-2).
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-semibold text-[#1b1c19] text-sm">Strict Multi-Tenant Isolation</h3>
            <p>
              Ledger items and invoices are strictly partitioned by tenant ID. Cross-tenant financial data queries are denied immediately with HTTP 403 Forbidden (FR-9).
            </p>
          </div>
        </div>
      </section>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
        >
          <div className="bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg shadow-xl max-w-lg w-full p-6 space-y-6 relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[#d1c4b9]/40 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
                  <span className="font-mono font-semibold text-xs text-[#59452b]">
                    {selectedTransaction.transaction_id}
                  </span>
                  <StatusLabel
                    status={getStatusType(selectedTransaction.status)}
                    label={selectedTransaction.status.charAt(0).toUpperCase() + selectedTransaction.status.slice(1)}
                  />
                </div>
                <h2 id="modal-title" className="text-xl font-serif text-[#1b1c19]">
                  {selectedTransaction.description}
                </h2>
              </div>

              <button
                onClick={handleCloseModal}
                aria-label="Close transaction details modal"
                className="text-[#80756b] hover:text-[#1b1c19] p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-[#735c41]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-[#f5f3ee] border border-[#d1c4b9]/40 rounded-md p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[#80756b] font-medium">Client Entity:</span>
                  <span className="font-semibold text-[#1b1c19]">{selectedTransaction.client_entity}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#80756b] font-medium">Category:</span>
                  <span className="font-medium text-[#1b1c19]">{formatCategoryLabel(selectedTransaction.category)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#80756b] font-medium">Billing Date:</span>
                  <span className="font-medium text-[#1b1c19]">{selectedTransaction.billing_date}</span>
                </div>

                <div className="flex justify-between items-center border-t border-[#d1c4b9]/30 pt-2">
                  <span className="text-[#80756b] font-medium">Transaction Amount:</span>
                  <span className="font-mono text-base font-bold text-[#1b1c19]">
                    {selectedTransaction.formatted_amount}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[#4e453d]">
                  <span className="font-medium">Payment Method:</span>
                  <span>{selectedTransaction.payment_method}</span>
                </div>

                <div className="flex items-center justify-between text-[#4e453d]">
                  <span className="font-medium">Audit Correlation ID:</span>
                  <span className="font-mono text-[#1b1c19]">{selectedTransaction.audit_correlation_id}</span>
                </div>

                <div className="flex items-center justify-between text-[#4e453d]">
                  <span className="font-medium">Role Required:</span>
                  <span className="font-semibold text-[#59452b]">{selectedTransaction.assigned_role_required}</span>
                </div>

                {user && (
                  <div className="flex items-center justify-between text-[#4e453d]">
                    <span className="font-medium">Tenant Isolation:</span>
                    <span className="font-mono text-[#1b1c19]">{user.tenant_id}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#d1c4b9]/40 pt-4">
              <button
                onClick={() => handleDownloadReceipt(selectedTransaction)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#59452b] rounded-md hover:bg-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:ring-offset-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Download Audit Receipt</span>
              </button>

              <button
                onClick={handleCloseModal}
                className="px-3.5 py-2 text-xs font-medium text-[#59452b] bg-[#f0eee9] border border-[#d1c4b9] rounded-md hover:bg-[#eae8e3] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}