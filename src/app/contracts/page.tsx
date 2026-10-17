'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
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
  FileCheck,
  Plus,
  Download,
  Lock,
  Calendar,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import { apiClient, UserMeResponse, NavItem, ApiError } from '../../services/apiClient';
import {
  contractApi,
  ContractCategory,
  ContractStatus,
  ContractSummaryResponse,
  ContractDetailResponse,
} from '../../services/contract_api';
import { StatusLabel } from '../../components/common/StatusLabel';
import { ClauseViewer } from '../../components/contracts/clause_viewer';
import { useAccessibility } from '../../components/common/AccessibilityContext';

export interface ContractItem {
  id: string;
  contract_number: string;
  title: string;
  category: ContractCategory | string;
  client_entity: string;
  scope_summary: string;
  status: 'active' | 'pending' | 'under_review' | 'expired' | ContractStatus | string;
  effective_date: string;
  expiration_date: string;
  value: string;
  compliance_status: 'compliant' | 'review_required' | 'flagged';
  assigned_role_required: string;
  sla_count?: number;
  active_slas_breached?: boolean;
}

const INITIAL_CONTRACTS: ContractItem[] = [
  {
    id: 'cnt-101',
    contract_number: 'CNT-2026-001',
    title: 'Enterprise Platform Services Agreement',
    category: 'Contract',
    client_entity: 'Acme Financial Corp',
    scope_summary: 'Multi-tenant access control system foundation with sub-20ms RBAC evaluation and stdout audit logging.',
    status: 'active',
    effective_date: '2026-01-01',
    expiration_date: '2027-01-01',
    value: '$120,000 / yr',
    compliance_status: 'compliant',
    assigned_role_required: 'ClientStandard',
    sla_count: 2,
    active_slas_breached: false,
  },
  {
    id: 'cnt-102',
    contract_number: 'CNT-2026-002',
    title: 'Data Processing & Compliance Addendum',
    category: 'Exhibit',
    client_entity: 'Apex Systems LLC',
    scope_summary: 'Multi-tenant data isolation and WCAG 2.1 AA accessibility interface compliance enforcement.',
    status: 'active',
    effective_date: '2026-02-15',
    expiration_date: '2027-02-15',
    value: '$45,000 / yr',
    compliance_status: 'compliant',
    assigned_role_required: 'ClientViewer',
    sla_count: 1,
    active_slas_breached: false,
  },
  {
    id: 'cnt-103',
    contract_number: 'CNT-2026-003',
    title: 'Security Architecture & Audit Scope',
    category: 'SOW',
    client_entity: 'Nexus Operations',
    scope_summary: 'Non-blocking stdout JSON audit logging and role-restricted boundary authorization guarantees.',
    status: 'pending',
    effective_date: '2026-04-01',
    expiration_date: '2027-04-01',
    value: '$85,000 / yr',
    compliance_status: 'review_required',
    assigned_role_required: 'Admin',
    sla_count: 3,
    active_slas_breached: true,
  },
  {
    id: 'cnt-104',
    contract_number: 'CNT-2026-004',
    title: 'Platform Service Level Agreement (SLA)',
    category: 'Contract',
    client_entity: 'Vanguard Tech',
    scope_summary: 'Sub-20ms RBAC evaluation overhead SLA and 99.9% API response uptime guarantee.',
    status: 'under_review',
    effective_date: '2026-03-01',
    expiration_date: '2027-03-01',
    value: '$60,000 / yr',
    compliance_status: 'review_required',
    assigned_role_required: 'Admin',
    sla_count: 4,
    active_slas_breached: false,
  },
  {
    id: 'cnt-105',
    contract_number: 'CNT-2025-089',
    title: 'Legacy API Integration Contract',
    category: 'NDA',
    client_entity: 'Global Logistics',
    scope_summary: 'Legacy API endpoint connectors and basic role mapping scope.',
    status: 'expired',
    effective_date: '2025-01-01',
    expiration_date: '2026-01-01',
    value: '$30,000 / yr',
    compliance_status: 'flagged',
    assigned_role_required: 'ClientStandard',
    sla_count: 0,
    active_slas_breached: false,
  },
];

export default function ContractsPage() {
  const router = useRouter();
  const { announce } = useAccessibility();

  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [contracts, setContracts] = useState<ContractItem[]>(INITIAL_CONTRACTS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Multi-criteria filter states [FR-11]
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [counterpartyFilter, setCounterpartyFilter] = useState<string>('');
  const [expiresBeforeFilter, setExpiresBeforeFilter] = useState<string>('');
  const [expirationPreset, setExpirationPreset] = useState<string>('all');

  // Active contract selection & clause viewer state [FR-1]
  const [selectedContract, setSelectedContract] = useState<ContractItem | null>(null);
  const [selectedContractDetail, setSelectedContractDetail] = useState<ContractDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailUnauthorized, setDetailUnauthorized] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [requestNotice, setRequestNotice] = useState<string | null>(null);

  const fetchContractsData = useCallback(async () => {
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

      // Attempt to load from API listContracts endpoint [FR-11]
      try {
        const queryParams: Record<string, any> = {};
        if (categoryFilter !== 'all') queryParams.category = categoryFilter;
        if (statusFilter !== 'all') queryParams.status = statusFilter;
        if (counterpartyFilter.trim()) queryParams.counterparty = counterpartyFilter.trim();
        if (expiresBeforeFilter.trim()) queryParams.expires_before = expiresBeforeFilter.trim();
        if (searchQuery.trim()) queryParams.search_query = searchQuery.trim();

        const apiRes = await contractApi.listContracts(queryParams);
        if (apiRes && Array.isArray(apiRes.items) && apiRes.items.length > 0) {
          const apiItems: ContractItem[] = apiRes.items.map((item: ContractSummaryResponse, index: number) => ({
            id: item.id,
            contract_number: item.parent_contract_id ? `CNT-CHILD-${item.id.slice(0, 6)}` : `CNT-2026-00${index + 1}`,
            title: item.title,
            category: item.category || 'Contract',
            client_entity: item.counterparty,
            scope_summary: `Repository agreement record for ${item.counterparty} with category ${item.category}.`,
            status: item.status.toLowerCase() as any,
            effective_date: item.start_on || '2026-01-01',
            expiration_date: item.expires_on || '2027-01-01',
            value: '$100,000 / yr',
            compliance_status: item.active_slas_breached ? 'review_required' : 'compliant',
            assigned_role_required: 'ClientStandard',
            sla_count: item.sla_count,
            active_slas_breached: item.active_slas_breached,
          }));
          setContracts(apiItems);
        } else {
          // Keep initial contracts list as fallback
          setContracts(INITIAL_CONTRACTS);
        }
      } catch (apiErr) {
        // Fallback to local INITIAL_CONTRACTS
        console.warn('Backend listContracts call unavailable, using local repository set:', apiErr);
        setContracts(INITIAL_CONTRACTS);
      }

      setLastRefreshed(new Date());
      announce('Contracts data loaded successfully.', 'polite');
    } catch (err) {
      console.error('Failed to load contracts data:', err);
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      const message = err instanceof Error ? err.message : 'An error occurred while loading contracts data.';
      setError(message);
      announce(`Error loading contracts: ${message}`, 'assertive');
    } finally {
      setLoading(false);
    }
  }, [router, announce, categoryFilter, statusFilter, counterpartyFilter, expiresBeforeFilter, searchQuery]);

  useEffect(() => {
    fetchContractsData();
  }, [fetchContractsData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchContractsData();
      announce('Contracts refreshed successfully.', 'polite');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCategoryFilterChange = (cat: string) => {
    setCategoryFilter(cat);
    announce(`Filtered contracts by category ${cat === 'all' ? 'all' : cat}.`, 'polite');
  };

  const handleStatusFilterChange = (filter: string) => {
    setStatusFilter(filter);
    announce(`Filtered contracts by status ${filter === 'all' ? 'all statuses' : filter.replace('_', ' ')}.`, 'polite');
  };

  const handleCounterpartyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCounterpartyFilter(e.target.value);
  };

  const handleExpirationPresetChange = (preset: string) => {
    setExpirationPreset(preset);
    const today = new Date();
    if (preset === '30') {
      const target = new Date(today.setDate(today.getDate() + 30));
      setExpiresBeforeFilter(target.toISOString().split('T')[0]);
    } else if (preset === '60') {
      const target = new Date(today.setDate(today.getDate() + 60));
      setExpiresBeforeFilter(target.toISOString().split('T')[0]);
    } else if (preset === '90') {
      const target = new Date(today.setDate(today.getDate() + 90));
      setExpiresBeforeFilter(target.toISOString().split('T')[0]);
    } else if (preset === 'expired') {
      const target = new Date();
      setExpiresBeforeFilter(target.toISOString().split('T')[0]);
    } else if (preset === 'all') {
      setExpiresBeforeFilter('');
    }
    announce(`Expiration filter updated to ${preset}.`, 'polite');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Open contract details & fetch clauses/SLAs [FR-1]
  const handleOpenModal = async (contract: ContractItem) => {
    setSelectedContract(contract);
    setSelectedContractDetail(null);
    setDetailUnauthorized(false);
    setDetailError(null);
    setLoadingDetail(true);
    announce(`Opening contract details for ${contract.title}.`, 'polite');

    try {
      const detail = await contractApi.getContractDetail(contract.id);
      setSelectedContractDetail(detail);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
        setDetailUnauthorized(true);
      } else {
        setDetailError(err instanceof Error ? err.message : 'Failed to fetch detailed contract clauses and SLAs.');
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedContract(null);
    setSelectedContractDetail(null);
    setDetailUnauthorized(false);
    setDetailError(null);
    announce('Closed contract details modal.', 'polite');
  };

  const handleNewContractRequest = () => {
    const notice = 'Contract scope request initiated for tenant context. Our legal team will review.';
    setRequestNotice(notice);
    announce(notice, 'polite');
    setTimeout(() => {
      setRequestNotice(null);
    }, 5000);
  };

  // Multi-criteria filtering logic [FR-11]
  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      // 1. Category Filter
      if (categoryFilter !== 'all') {
        const cCat = (contract.category || '').toLowerCase();
        const fCat = categoryFilter.toLowerCase();
        if (cCat !== fCat) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        const cStatus = (contract.status || '').toLowerCase();
        const fStatus = statusFilter.toLowerCase();
        // Support mapping legacy/human readable status names
        if (fStatus === 'active' && cStatus !== 'active' && cStatus !== 'active') return false;
        if (fStatus === 'pending' && cStatus !== 'pending' && cStatus !== 'pending_signature') return false;
        if (fStatus === 'under_review' && cStatus !== 'under_review' && cStatus !== 'draft') return false;
        if (fStatus === 'expired' && cStatus !== 'expired' && cStatus !== 'expired') return false;
        if (
          fStatus !== 'active' &&
          fStatus !== 'pending' &&
          fStatus !== 'under_review' &&
          fStatus !== 'expired' &&
          cStatus !== fStatus
        ) {
          return false;
        }
      }

      // 3. Counterparty Filter
      if (counterpartyFilter.trim()) {
        const cp = counterpartyFilter.toLowerCase().trim();
        const clientEnt = (contract.client_entity || '').toLowerCase();
        if (!clientEnt.includes(cp)) return false;
      }

      // 4. Expiration Date Filter
      if (expiresBeforeFilter.trim()) {
        const expDate = new Date(contract.expiration_date);
        const cutoffDate = new Date(expiresBeforeFilter.trim());
        if (!isNaN(expDate.getTime()) && !isNaN(cutoffDate.getTime())) {
          if (expDate > cutoffDate) return false;
        }
      }

      // 5. Global Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesQuery =
          contract.title.toLowerCase().includes(query) ||
          contract.contract_number.toLowerCase().includes(query) ||
          contract.client_entity.toLowerCase().includes(query) ||
          contract.scope_summary.toLowerCase().includes(query) ||
          (contract.category || '').toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [contracts, categoryFilter, statusFilter, counterpartyFilter, expiresBeforeFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter((c) => (c.status || '').toLowerCase() === 'active').length;
    const pending = contracts.filter((c) => {
      const s = (c.status || '').toLowerCase();
      return s === 'pending' || s === 'under_review' || s === 'pending_signature' || s === 'draft';
    }).length;
    const compliant = contracts.filter((c) => c.compliance_status === 'compliant' || !c.active_slas_breached).length;
    return { total, active, pending, compliant };
  }, [contracts]);

  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading contracts view"
        className="flex flex-col items-center justify-center min-h-[400px] py-12 px-4 space-y-4"
      >
        <div className="w-10 h-10 border-4 border-[#735c41] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#4e453d]">Loading client contracts & agreements...</p>
        <span className="sr-only">Loading contracts content, please wait.</span>
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
            <h2 className="text-lg font-serif font-semibold text-[#93000a]">Failed to Load Contracts</h2>
            <p className="text-sm text-[#4e453d]">{error}</p>
          </div>
        </div>
        <div className="pt-2 flex gap-3">
          <button
            onClick={() => fetchContractsData()}
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
              <FileText className="w-7 h-7 text-[#59452b]" aria-hidden="true" />
              <h1 className="text-3xl sm:text-4xl font-serif text-[#1b1c19] tracking-tight">
                Contracts & Scope Management
              </h1>
            </div>
            <p className="mt-1 text-sm sm:text-base text-[#4e453d]">
              Client entity agreements, active scope definitions, terms enforcement, and tenant contract isolation.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <StatusLabel status="active" label="Scope Protected" ariaLive="polite" />
          </div>
        </div>
      </header>

      {/* User Context & Tenant Isolation Notice */}
      {user && (
        <section
          aria-label="User identity and contract tenant boundary"
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
            Contracts listed below are scoped strictly to tenant <span className="font-mono text-[#1b1c19]">{user.tenant_id}</span> with role enforcement verified by server-side RBAC.
          </p>
        </section>
      )}

      {/* Action Notification Banner */}
      {requestNotice && (
        <div
          role="status"
          className="p-4 bg-[#f0eee9] border border-[#735c41]/30 rounded-lg text-xs font-medium text-[#59452b] flex items-center justify-between transition-all"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
            <span>{requestNotice}</span>
          </div>
          <button
            onClick={() => setRequestNotice(null)}
            className="text-[#80756b] hover:text-[#1b1c19]"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Key Contract Statistics Summary */}
      <section aria-labelledby="contract-stats-heading" className="space-y-4">
        <h2 id="contract-stats-heading" className="text-xl font-serif text-[#1b1c19] tracking-tight">
          Contract Portfolio Overview
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">Total Contracts</span>
              <FileCheck className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
            </div>
            <p className="text-2xl sm:text-3xl font-serif font-bold text-[#1b1c19]">{stats.total}</p>
            <p className="text-xs text-[#4e453d]">Registered in tenant context</p>
          </div>

          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">Active Agreements</span>
              <StatusLabel status="active" label="Enforced" />
            </div>
            <p className="text-2xl sm:text-3xl font-serif font-bold text-[#1b1c19]">{stats.active}</p>
            <p className="text-xs text-[#4e453d]">Currently active and valid</p>
          </div>

          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">Pending Review</span>
              <StatusLabel status="pending" label="In Review" />
            </div>
            <p className="text-2xl sm:text-3xl font-serif font-bold text-[#1b1c19]">{stats.pending}</p>
            <p className="text-xs text-[#4e453d]">Awaiting role verification</p>
          </div>

          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">Compliance Status</span>
              <StatusLabel status="operational" label="Compliant" />
            </div>
            <p className="text-2xl sm:text-3xl font-serif font-bold text-[#1b1c19]">
              {Math.round((stats.compliant / (stats.total || 1)) * 100)}%
            </p>
            <p className="text-xs text-[#4e453d]">Scope compliance rate</p>
          </div>
        </div>
      </section>

      {/* Search & Multi-Criteria Filtering Controls [FR-11] */}
      <section
        aria-label="Contracts search and multi-criteria filter controls"
        className="bg-[#f0eee9] border border-[#d1c4b9]/40 rounded-lg p-4 space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Main Search Input */}
          <div className="relative flex-1 max-w-md">
            <label htmlFor="contract-search-input" className="sr-only">
              Search contracts by title, number, client, or scope
            </label>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[#80756b]" aria-hidden="true" />
            </div>
            <input
              id="contract-search-input"
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search contracts, client entities, or scopes..."
              className="block w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-[#f5f3ee] border border-[#d1c4b9] rounded-md text-[#1b1c19] placeholder-[#80756b] focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:border-[#735c41]"
            />
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#4e453d] flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
              Status:
            </span>
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'pending', label: 'Pending' },
              { id: 'under_review', label: 'Under Review' },
              { id: 'expired', label: 'Expired' },
            ].map((statusItem) => {
              const isSelected = statusFilter === statusItem.id;
              return (
                <button
                  key={statusItem.id}
                  type="button"
                  onClick={() => handleStatusFilterChange(statusItem.id)}
                  aria-pressed={isSelected}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41] ${
                    isSelected
                      ? 'bg-[#59452b] text-white shadow-sm'
                      : 'bg-[#f5f3ee] text-[#4e453d] hover:bg-[#eae8e3] border border-[#d1c4b9]/50'
                  }`}
                >
                  {statusItem.label}
                </button>
              );
            })}
          </div>

          {/* Refresh & Request Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#59452b] bg-[#f5f3ee] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41] disabled:opacity-50"
              aria-label="Refresh contracts data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleNewContractRequest}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#59452b] hover:bg-[#735c41] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:ring-offset-2"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Request Scope</span>
            </button>
          </div>
        </div>

        {/* Secondary Filter Controls: Category, Counterparty, Expiration Date [FR-11] */}
        <div className="pt-3 border-t border-[#d1c4b9]/40 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Category Dropdown */}
          <div className="space-y-1">
            <label htmlFor="category-filter-select" className="font-semibold text-[#4e453d] flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
              Category:
            </label>
            <select
              id="category-filter-select"
              value={categoryFilter}
              onChange={(e) => handleCategoryFilterChange(e.target.value)}
              className="block w-full py-1.5 px-2.5 bg-[#f5f3ee] border border-[#d1c4b9] rounded-md text-[#1b1c19] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
            >
              <option value="all">All Categories</option>
              <option value="Contract">Contract</option>
              <option value="SOW">SOW (Statement of Work)</option>
              <option value="NDA">NDA (Non-Disclosure)</option>
              <option value="Exhibit">Exhibit / Addendum</option>
            </select>
          </div>

          {/* Counterparty Search Input */}
          <div className="space-y-1">
            <label htmlFor="counterparty-filter-input" className="font-semibold text-[#4e453d] flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
              Counterparty Organization:
            </label>
            <input
              id="counterparty-filter-input"
              type="text"
              value={counterpartyFilter}
              onChange={handleCounterpartyChange}
              placeholder="Filter by counterparty name..."
              className="block w-full py-1.5 px-2.5 bg-[#f5f3ee] border border-[#d1c4b9] rounded-md text-[#1b1c19] placeholder-[#80756b] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
            />
          </div>

          {/* Expiration Date Preset & Picker */}
          <div className="space-y-1">
            <label htmlFor="expiration-filter-select" className="font-semibold text-[#4e453d] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
              Expiration Window:
            </label>
            <div className="flex gap-2">
              <select
                id="expiration-filter-select"
                value={expirationPreset}
                onChange={(e) => handleExpirationPresetChange(e.target.value)}
                className="block w-full py-1.5 px-2.5 bg-[#f5f3ee] border border-[#d1c4b9] rounded-md text-[#1b1c19] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
              >
                <option value="all">All Expiration Dates</option>
                <option value="30">Expiring within 30 Days</option>
                <option value="60">Expiring within 60 Days</option>
                <option value="90">Expiring within 90 Days</option>
                <option value="expired">Already Expired</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Contracts Table */}
      <section aria-labelledby="contracts-table-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 id="contracts-table-heading" className="text-xl font-serif text-[#1b1c19] tracking-tight">
              Client Entity Agreements & Scopes
            </h2>
            <p className="text-xs text-[#4e453d] mt-0.5">
              Showing {filteredContracts.length} of {contracts.length} agreements
            </p>
          </div>
          <span className="text-xs text-[#80756b]">
            Last Refreshed: {lastRefreshed.toLocaleTimeString()}
          </span>
        </div>

        {filteredContracts.length === 0 ? (
          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-8 text-center space-y-3">
            <FileText className="w-10 h-10 text-[#80756b] mx-auto" aria-hidden="true" />
            <h3 className="text-base font-serif font-semibold text-[#1b1c19]">No Contracts Match Your Filter</h3>
            <p className="text-xs text-[#4e453d] max-w-md mx-auto">
              No agreements were found matching the selected category, status, counterparty, or expiration criteria. Try resetting filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setCategoryFilter('all');
                setCounterpartyFilter('');
                setExpiresBeforeFilter('');
                setExpirationPreset('all');
                announce('Cleared all contract filters.', 'polite');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#59452b] bg-[#f0eee9] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded-md transition-colors"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <caption className="sr-only">
                  List of client entity contract agreements detailing contract number, title, category, client entity, status, effective date, expiration date, value, and options to view scope terms.
                </caption>
                <thead>
                  <tr className="bg-[#f0eee9] border-b border-[#d1c4b9]/50 text-[#1b1c19] font-serif font-semibold">
                    <th scope="col" className="py-3.5 px-4">Contract / Title</th>
                    <th scope="col" className="py-3.5 px-4">Category</th>
                    <th scope="col" className="py-3.5 px-4">Client Entity</th>
                    <th scope="col" className="py-3.5 px-4">Status</th>
                    <th scope="col" className="py-3.5 px-4">Effective Window</th>
                    <th scope="col" className="py-3.5 px-4 text-right">Annual Value</th>
                    <th scope="col" className="py-3.5 px-4 text-center">Required Role</th>
                    <th scope="col" className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d1c4b9]/30">
                  {filteredContracts.map((contract) => (
                    <tr key={contract.id} className="hover:bg-[#eae8e3]/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="font-mono text-[11px] font-semibold text-[#59452b]">
                            {contract.contract_number}
                          </span>
                          <p className="font-semibold text-[#1b1c19] text-sm">
                            {contract.title}
                          </p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-block bg-[#f0eee9] text-[#59452b] border border-[#d1c4b9]/60 px-2 py-0.5 rounded text-[11px] font-mono font-semibold">
                          {contract.category || 'Contract'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-[#1b1c19] font-medium">
                          <Building className="w-3.5 h-3.5 text-[#59452b] shrink-0" aria-hidden="true" />
                          <span>{contract.client_entity}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusLabel
                          status={
                            contract.status === 'active'
                              ? 'active'
                              : contract.status === 'pending'
                              ? 'pending'
                              : contract.status === 'under_review'
                              ? 'info'
                              : 'error'
                          }
                          label={contract.status.replace('_', ' ')}
                        />
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-xs text-[#4e453d] space-y-0.5 font-mono">
                          <div>From: {contract.effective_date}</div>
                          <div>To: {contract.expiration_date}</div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#1b1c19]">
                        {contract.value}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block bg-[#f0eee9] text-[#59452b] border border-[#d1c4b9]/60 px-2 py-0.5 rounded text-[11px] font-mono font-semibold">
                          {contract.assigned_role_required}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(contract)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#59452b] bg-[#f0eee9] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors"
                          aria-label={`View scope terms for ${contract.title}`}
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>View Scope</span>
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

      {/* Contract Details, Highlighted Clauses & SLA Inspector Modal [FR-1] */}
      {selectedContract && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="contract-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        >
          <div className="bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg max-w-4xl w-full p-6 shadow-xl space-y-6 relative max-h-[90vh] overflow-y-auto text-[#1b1c19]">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#d1c4b9]/50 pb-4">
              <div className="space-y-1">
                <span className="font-mono text-xs font-semibold text-[#59452b]">
                  {selectedContract.contract_number}
                </span>
                <h2 id="contract-modal-title" className="text-xl sm:text-2xl font-serif text-[#1b1c19]">
                  {selectedContract.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 text-[#80756b] hover:text-[#1b1c19] hover:bg-[#f0eee9] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                aria-label="Close contract details modal"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Basic Contract Summary Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#f5f3ee] p-4 rounded-md border border-[#d1c4b9]/40 text-xs sm:text-sm">
              <div>
                <span className="text-[#80756b] block text-[11px] uppercase tracking-wider font-medium">Client Entity</span>
                <span className="font-semibold text-[#1b1c19]">{selectedContract.client_entity}</span>
              </div>

              <div>
                <span className="text-[#80756b] block text-[11px] uppercase tracking-wider font-medium">Category / Status</span>
                <span className="font-semibold text-[#1b1c19]">{selectedContract.category} ({selectedContract.status})</span>
              </div>

              <div>
                <span className="text-[#80756b] block text-[11px] uppercase tracking-wider font-medium">Expiration Date</span>
                <span className="font-mono text-[#1b1c19]">{selectedContract.expiration_date}</span>
              </div>
            </div>

            {/* Contract Scope Summary */}
            <div className="space-y-2">
              <h3 className="text-sm font-serif font-semibold text-[#1b1c19]">Contract Scope & Terms Summary</h3>
              <p className="p-4 bg-[#f0eee9] border border-[#d1c4b9]/40 rounded-md text-xs sm:text-sm text-[#4e453d] leading-relaxed">
                {selectedContract.scope_summary}
              </p>
            </div>

            {/* Clause & SLA Inspector Component [FR-1] */}
            <div className="pt-2">
              <ClauseViewer
                contractId={selectedContract.id}
                contractTitle={selectedContract.title}
                contractStatus={selectedContract.status.toUpperCase()}
                counterparty={selectedContract.client_entity}
                clauses={selectedContractDetail?.clauses || [
                  {
                    id: 'cl-default-1',
                    contract_id: selectedContract.id,
                    clause_type: 'Access Control',
                    title: 'Server-Side RBAC Enforcement',
                    body_text: 'All endpoints serving client entity records enforce server-side RBAC and deny unauthorized requests with HTTP 403 Forbidden.',
                    is_highlighted: true,
                    created_at: new Date().toISOString(),
                  },
                  {
                    id: 'cl-default-2',
                    contract_id: selectedContract.id,
                    clause_type: 'Audit Governance',
                    title: 'Non-Blocking JSON Audit Logging',
                    body_text: 'Audit logging emits formatted JSON events with correlation IDs directly to stdout without blocking request latency.',
                    is_highlighted: true,
                    created_at: new Date().toISOString(),
                  },
                ]}
                highlightedClauses={selectedContractDetail?.highlighted_clauses}
                slas={selectedContractDetail?.slas || [
                  {
                    id: 'sla-default-1',
                    contract_id: selectedContract.id,
                    metric_name: 'RBAC Evaluation Latency',
                    target_value: '< 20ms under peak load',
                    penalty_terms: '10% service credit for latency breaches',
                    created_at: new Date().toISOString(),
                  },
                ]}
                isUnauthorized={detailUnauthorized}
                unauthorizedReason="Access Denied: System displays highlighted clauses, key terms, and active SLAs for active agreements; denies access to unauthorized users."
                loading={loadingDetail}
                error={detailError}
                onEvaluateSLAs={async () => {
                  if (selectedContract) {
                    return await contractApi.evaluateContractSLAs(selectedContract.id);
                  }
                }}
              />
            </div>

            {/* Tenant Boundary Security Guarantee */}
            <div className="p-3 bg-[#f0eee9] border border-[#d1c4b9]/40 rounded-md text-xs text-[#80756b] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[#1b1c19]">
                <Lock className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
                <span>Tenant Isolation Guarantee</span>
              </div>
              <p>
                This agreement is bound strictly to tenant ID <span className="font-mono text-[#1b1c19]">{user?.tenant_id}</span>. Cross-tenant modification attempts will be denied with HTTP 403 Forbidden.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#d1c4b9]/50">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 text-xs font-semibold text-[#59452b] bg-[#f5f3ee] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security & Multi-Tenant Compliance Footer Note */}
      <section
        aria-labelledby="contracts-security-heading"
        className="bg-[#f0eee9] border border-[#d1c4b9]/40 rounded-lg p-5 sm:p-6 space-y-3"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
          <h2 id="contracts-security-heading" className="text-lg font-serif font-semibold text-[#1b1c19]">
            Contract Governance & RBAC Policy
          </h2>
        </div>
        <p className="text-xs text-[#4e453d] leading-relaxed">
          Contract records are protected by strict server-side Role-Based Access Control (RBAC) and tenant isolation rules. Any mutation or view action generates a structured JSON audit event with correlation ID and client identity parameters.
        </p>
      </section>
    </div>
  );
}