'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  LineChart,
  FileText,
  Headphones,
  DollarSign,
  BookOpen,
  ShieldCheck,
  Activity,
  Lock,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  User,
  Building,
  Key,
  Clock,
} from 'lucide-react';
import { apiClient, UserMeResponse, NavItem, ApiError } from '../../services/apiClient';
import {
  getDashboardSummary,
  getDomainDrilldown,
  SummaryAggregationResponse,
  DomainQuickViewResponse,
  Timeframe,
  DomainIdentifier,
} from '../../services/dashboard';
import { StatusLabel } from '../../components/common/StatusLabel';
import { MetricCard } from '../../components/dashboard/MetricCard';
import { QuickViewPanel } from '../../components/dashboard/QuickViewPanel';
import { useAccessibility } from '../../components/common/AccessibilityContext';

export interface DomainCardItem {
  id: string;
  title: string;
  path: string;
  description: string;
  icon: React.ReactNode;
  statusText: string;
  statusType: 'active' | 'operational' | 'pending' | 'info';
}

const DOMAIN_CARDS: DomainCardItem[] = [
  {
    id: 'performance',
    title: 'Performance',
    path: '/performance',
    description: 'System response latency telemetry, RBAC evaluation overhead metrics, and server health tracking.',
    icon: <LineChart className="w-6 h-6 text-[#59452b]" aria-hidden="true" />,
    statusText: 'Sub-20ms Telemetry',
    statusType: 'operational',
  },
  {
    id: 'contracts',
    title: 'Contracts',
    path: '/contracts',
    description: 'Client entity agreements, active scopes, terms enforcement, and entity management.',
    icon: <FileText className="w-6 h-6 text-[#59452b]" aria-hidden="true" />,
    statusText: 'Scope Protected',
    statusType: 'active',
  },
  {
    id: 'support',
    title: 'Support',
    path: '/support',
    description: 'System health status indicators, support tickets, and operational query assistance.',
    icon: <Headphones className="w-6 h-6 text-[#59452b]" aria-hidden="true" />,
    statusText: 'Operational',
    statusType: 'operational',
  },
  {
    id: 'financials',
    title: 'Financials',
    path: '/financials',
    description: 'Tenant billing ledgers, transaction records, and financial domain metrics.',
    icon: <DollarSign className="w-6 h-6 text-[#59452b]" aria-hidden="true" />,
    statusText: 'Tenant Isolated',
    statusType: 'active',
  },
  {
    id: 'knowledge',
    title: 'Knowledge Base',
    path: '/knowledge',
    description: 'Platform security architecture, access control guides, and system documentation.',
    icon: <BookOpen className="w-6 h-6 text-[#59452b]" aria-hidden="true" />,
    statusText: 'Documentation Active',
    statusType: 'info',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { announce } = useAccessibility();

  // Core user & auth navigation state
  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Executive KPI summary & domain quick view state (FR-1, FR-5, NFR-4)
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
  const [selectedDomain, setSelectedDomain] = useState<DomainIdentifier>('lead_gen');
  const [summary, setSummary] = useState<SummaryAggregationResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [domainData, setDomainData] = useState<DomainQuickViewResponse | null>(null);
  const [domainLoading, setDomainLoading] = useState<boolean>(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Fetch authentication and navigation data
  const loadAuthAndNav = useCallback(async () => {
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
      announce('Dashboard data loaded successfully.', 'polite');
    } catch (err) {
      console.error('Failed to load user auth context:', err);
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      const message = err instanceof Error ? err.message : 'An error occurred while loading dashboard data.';
      setError(message);
      announce(`Error loading dashboard: ${message}`, 'assertive');
    } finally {
      setLoading(false);
    }
  }, [router, announce]);

  // Fetch KPI summary metrics
  const loadSummaryMetrics = useCallback(
    async (showInitialLoading = false) => {
      if (showInitialLoading) {
        setSummaryLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setSummaryError(null);

      try {
        const data = await getDashboardSummary(timeframe);
        setSummary(data);
        setLastRefreshed(new Date());
      } catch (err) {
        console.error('Failed to fetch KPI summary metrics:', err);
        setSummaryError(err instanceof Error ? err.message : 'Unable to load KPI metrics summary.');
      } finally {
        if (showInitialLoading) {
          setSummaryLoading(false);
        }
        setIsRefreshing(false);
      }
    },
    [timeframe]
  );

  // Fetch domain drilldown metrics
  const loadDomainDetails = useCallback(
    async (domain: DomainIdentifier, showInitialLoading = false) => {
      if (showInitialLoading) {
        setDomainLoading(true);
      }
      setDomainError(null);

      try {
        const data = await getDomainDrilldown(domain, timeframe);
        setDomainData(data);
      } catch (err) {
        console.error(`Failed to fetch domain drilldown for ${domain}:`, err);
        setDomainError(err instanceof Error ? err.message : `Unable to load ${domain} details.`);
      } finally {
        if (showInitialLoading) {
          setDomainLoading(false);
        }
      }
    },
    [timeframe]
  );

  // Initial mount load for user context
  useEffect(() => {
    loadAuthAndNav();
  }, [loadAuthAndNav]);

  // Load KPI summary metrics when user is authenticated or timeframe changes
  useEffect(() => {
    if (user) {
      loadSummaryMetrics(true);
    }
  }, [user, loadSummaryMetrics]);

  // Load domain details when user is authenticated, domain changes, or timeframe changes
  useEffect(() => {
    if (user) {
      loadDomainDetails(selectedDomain, true);
    }
  }, [user, selectedDomain, loadDomainDetails]);

  // 30-Second REST polling refresh loop for KPI metrics (FR-5)
  useEffect(() => {
    if (!user) return;

    const intervalId = setInterval(() => {
      loadSummaryMetrics(false);
      loadDomainDetails(selectedDomain, false);
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [user, selectedDomain, loadSummaryMetrics, loadDomainDetails]);

  // Event Handlers
  const handleTimeframeChange = (newTimeframe: Timeframe) => {
    setTimeframe(newTimeframe);
    announce(`Timeframe changed to ${newTimeframe}`, 'polite');
  };

  const handleDomainSelect = (domain: string) => {
    const validDomain = domain as DomainIdentifier;
    setSelectedDomain(validDomain);
    announce(`Selected ${validDomain} domain metrics`, 'polite');
  };

  const handleManualRefresh = () => {
    loadSummaryMetrics(false);
    loadDomainDetails(selectedDomain, false);
    announce('Refreshing operational metrics...', 'polite');
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading dashboard content"
        className="flex flex-col items-center justify-center min-h-[400px] py-12 px-4 space-y-4"
      >
        <div className="w-10 h-10 border-4 border-[#735c41] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#4e453d]">Loading platform dashboard data...</p>
        <span className="sr-only">Loading dashboard content, please wait.</span>
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
            <h2 className="text-lg font-serif font-semibold text-[#93000a]">Failed to Load Dashboard</h2>
            <p className="text-sm text-[#4e453d]">{error}</p>
          </div>
        </div>
        <div className="pt-2 flex gap-3">
          <button
            onClick={() => loadAuthAndNav()}
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
      <header className="border-b border-[#d1c4b9]/40 pb-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-7 h-7 text-[#59452b]" aria-hidden="true" />
              <h1 className="text-3xl sm:text-4xl font-serif text-[#1b1c19] tracking-tight">
                Platform Dashboard
              </h1>
            </div>
            <p className="mt-1 text-sm sm:text-base text-[#4e453d]">
              Overview of system status, tenant access boundaries, and core domain capabilities.
            </p>
          </div>

          {/* Polling & Timeframe Refresh Controls */}
          <div className="shrink-0 flex flex-wrap items-center gap-3">
            {/* Timeframe Selector */}
            <div
              className="inline-flex items-center rounded-md p-1 bg-[#f0eee9] border border-[#d1c4b9]/50 text-xs"
              role="group"
              aria-label="Timeframe selector"
            >
              {(['7d', '30d', '90d'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => handleTimeframeChange(tf)}
                  className={clsx(
                    'px-3 py-1.5 rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]',
                    timeframe === tf
                      ? 'bg-[#59452b] text-white shadow-sm'
                      : 'text-[#4e453d] hover:text-[#1b1c19] hover:bg-[#eae8e3]'
                  )}
                  aria-pressed={timeframe === tf}
                >
                  {tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#59452b] bg-[#f5f3ee] border border-[#d1c4b9] rounded-md hover:bg-[#eae8e3] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors disabled:opacity-50"
              aria-label="Refresh operational metrics"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isRefreshing && 'animate-spin')} aria-hidden="true" />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <StatusLabel status="active" label="System Active" ariaLive="polite" />
          </div>
        </div>

        {/* Polling Status Bar */}
        <div className="flex items-center justify-between text-xs text-[#80756b] bg-[#f5f3ee] px-3.5 py-2 rounded-md border border-[#d1c4b9]/30">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#374a5f] animate-pulse" aria-hidden="true" />
            <span className="font-medium text-[#4e453d]">30-Second REST Polling Active</span>
          </div>
          {lastRefreshed && (
            <div className="flex items-center gap-1 text-[#80756b]">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Updated {lastRefreshed.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </header>

      {/* Section 1: Executive KPI Summary Cards (FR-1, FR-5, NFR-4) */}
      <section aria-labelledby="kpi-summary-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="kpi-summary-heading" className="text-xl font-serif text-[#1b1c19] tracking-tight">
              Consolidated Operational KPIs
            </h2>
            <p className="text-xs text-[#4e453d]">
              High-frequency key performance indicators across active operational domains ({timeframe} comparative baseline).
            </p>
          </div>
          <span className="text-xs font-medium text-[#735c41] bg-[#f0eee9] px-2.5 py-1 rounded-full border border-[#d1c4b9]/40">
            Auto-Refreshed
          </span>
        </div>

        {/* Partial Outage Status Warning */}
        {summary?.status === 'PARTIAL' && (
          <div
            role="status"
            className="p-3 bg-[#fdddbb]/40 border border-[#715a3f]/30 rounded-md text-xs text-[#58432a] flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#735c41] shrink-0" aria-hidden="true" />
              <span>
                <strong>Partial Metric Data:</strong> One or more downstream domain connectors timed out. Available KPI cards are displayed.
              </span>
            </div>
            <button
              onClick={handleManualRefresh}
              className="text-xs font-semibold underline hover:text-[#281804]"
            >
              Retry
            </button>
          </div>
        )}

        {/* KPI Cards Grid */}
        {summaryLoading ? (
          <div
            role="status"
            aria-label="Loading KPI summary cards"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="bg-[#f5f3ee] border border-[#d1c4b9]/40 rounded-lg p-5 animate-pulse space-y-3">
                <div className="h-4 bg-[#eae8e3] rounded w-1/2" />
                <div className="h-8 bg-[#eae8e3] rounded w-3/4" />
                <div className="h-3 bg-[#eae8e3] rounded w-1/3" />
              </div>
            ))}
            <span className="sr-only">Loading KPI summary metrics...</span>
          </div>
        ) : summaryError && (!summary || !summary.metrics || summary.metrics.length === 0) ? (
          <div className="p-4 bg-[#ffdad6]/30 border border-[#ba1a1a]/20 rounded-lg flex items-center justify-between text-xs text-[#93000a]">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#ba1a1a]" aria-hidden="true" />
              <span>{summaryError}</span>
            </div>
            <button
              onClick={handleManualRefresh}
              className="px-3 py-1 bg-[#59452b] text-white rounded font-medium text-xs hover:bg-[#735c41]"
            >
              Retry Metrics
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summary?.metrics && summary.metrics.length > 0 ? (
              summary.metrics.map((metric) => (
                <MetricCard
                  key={`${metric.domain}-${metric.metric_key}`}
                  metric={metric}
                  onSelect={(dom) => handleDomainSelect(dom)}
                  onRetry={() => loadSummaryMetrics(false)}
                />
              ))
            ) : (
              <div className="col-span-full p-4 bg-[#f0eee9] border border-[#d1c4b9]/40 rounded-lg text-center text-xs text-[#80756b]">
                No operational metric summary records available.
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section 2: Domain Quick-View Panel (FR-1, QuickViewPanel) */}
      <section aria-label="Domain Quick View Breakdown">
        <QuickViewPanel
          domain={selectedDomain}
          data={domainData}
          loading={domainLoading}
          error={domainError}
          timeframe={timeframe}
          onDomainChange={(dom) => handleDomainSelect(dom)}
          onRetry={() => loadDomainDetails(selectedDomain, true)}
          onTimeframeChange={(tf) => handleTimeframeChange(tf)}
        />
      </section>

      {/* Section 3: User Context & Identity Overview */}
      {user && (
        <section
          aria-label="User identity and tenant context"
          className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-5 sm:p-6 shadow-sm space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d1c4b9]/30 pb-4">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wider text-[#80756b] font-medium">Authenticated Account</span>
              <div className="flex items-center gap-2 text-base font-semibold text-[#1b1c19]">
                <User className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
                <span>{user.email}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-[#4e453d] bg-[#f0eee9] px-3 py-1.5 rounded-md border border-[#d1c4b9]/40">
                <Building className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
                <span className="font-medium">Tenant ID:</span>
                <span className="font-mono text-[#1b1c19]">{user.tenant_id}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-[#4e453d] bg-[#f0eee9] px-3 py-1.5 rounded-md border border-[#d1c4b9]/40">
                <Key className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
                <span className="font-medium">Roles:</span>
                <div className="flex gap-1">
                  {user.roles && user.roles.length > 0 ? (
                    user.roles.map((role) => (
                      <span
                        key={role}
                        className="bg-[#735c41] text-white text-[11px] font-semibold px-2 py-0.5 rounded"
                      >
                        {role}
                      </span>
                    ))
                  ) : (
                    <span className="text-[#80756b]">No roles assigned</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-[#80756b]">
            All data access is restricted to tenant <span className="font-mono text-[#1b1c19]">{user.tenant_id}</span> and enforced via server-side Role-Based Access Control (RBAC).
          </p>
        </section>
      )}

      {/* Section 4: Security & System Architecture Telemetry */}
      <section aria-labelledby="architecture-status-heading" className="space-y-4">
        <h2 id="architecture-status-heading" className="text-xl font-serif text-[#1b1c19] tracking-tight">
          Access Control & Security Architecture
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#f0eee9] border border-[#d1c4b9]/40 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <ShieldCheck className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
              <StatusLabel status="operational" label="Sub-20ms Engine" />
            </div>
            <h3 className="text-base font-semibold text-[#1b1c19]">Server-Side RBAC Gate</h3>
            <p className="text-xs text-[#4e453d] leading-relaxed">
              RBAC evaluation overhead is restricted to sub-20ms per request. Unauthorized requests are rejected with HTTP 403.
            </p>
          </div>

          <div className="bg-[#f0eee9] border border-[#d1c4b9]/40 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Activity className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
              <StatusLabel status="active" label="Non-Blocking Logs" />
            </div>
            <h3 className="text-base font-semibold text-[#1b1c19]">Structured Audit Pipeline</h3>
            <p className="text-xs text-[#4e453d] leading-relaxed">
              Machine-readable JSON audit logs with correlation IDs are emitted directly to stdout without blocking API performance.
            </p>
          </div>

          <div className="bg-[#f0eee9] border border-[#d1c4b9]/40 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Lock className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
              <StatusLabel status="success" label="Isolated Boundary" />
            </div>
            <h3 className="text-base font-semibold text-[#1b1c19]">Multi-Tenant Data Isolation</h3>
            <p className="text-xs text-[#4e453d] leading-relaxed">
              Database layer queries strictly filter records by tenant identifier to prevent cross-entity data leakage.
            </p>
          </div>
        </div>
      </section>

      {/* Section 5: Domain Sections Quick Access */}
      <section aria-labelledby="domain-sections-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="domain-sections-heading" className="text-xl font-serif text-[#1b1c19] tracking-tight">
            Platform Domains
          </h2>
          <span className="text-xs text-[#80756b]">Global Navigation Scope</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {DOMAIN_CARDS.map((card) => {
            const navInfo = navItems.find((n) => n.path === card.path);
            const isAccessible = navInfo ? navInfo.is_accessible : true;

            return (
              <div
                key={card.id}
                className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-5 hover:border-[#735c41]/50 hover:bg-[#eae8e3]/60 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-[#f0eee9] rounded-md border border-[#d1c4b9]/30">
                      {card.icon}
                    </div>
                    <StatusLabel status={card.statusType} label={card.statusText} />
                  </div>

                  <div>
                    <h3 className="text-lg font-serif font-semibold text-[#1b1c19] group-hover:text-[#59452b] transition-colors">
                      {card.title}
                    </h3>
                    <p className="mt-1 text-xs text-[#4e453d] leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#d1c4b9]/30 flex items-center justify-between">
                  {isAccessible ? (
                    <Link
                      href={card.path}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#59452b] hover:text-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#735c41] rounded px-1 py-0.5"
                    >
                      <span>Explore Domain</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="text-xs font-medium text-[#80756b] italic">
                      Restricted for assigned role
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 6: Activity Overview Summary */}
      <section aria-labelledby="activity-heading" className="bg-[#f0eee9] border border-[#d1c4b9]/40 rounded-lg p-5 sm:p-6 space-y-4">
        <h2 id="activity-heading" className="text-lg font-serif font-semibold text-[#1b1c19]">
          Active Session & System Health Overview
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="bg-[#f5f3ee] p-3 rounded border border-[#d1c4b9]/30 space-y-1">
            <span className="text-[#80756b]">Authentication Status</span>
            <p className="font-semibold text-[#1b1c19] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#374a5f]" />
              Bearer Token Active
            </p>
          </div>

          <div className="bg-[#f5f3ee] p-3 rounded border border-[#d1c4b9]/30 space-y-1">
            <span className="text-[#80756b]">Global Navigation</span>
            <p className="font-semibold text-[#1b1c19]">
              {navItems.length} Authorized Routes
            </p>
          </div>

          <div className="bg-[#f5f3ee] p-3 rounded border border-[#d1c4b9]/30 space-y-1">
            <span className="text-[#80756b]">WCAG 2.1 AA Compliance</span>
            <p className="font-semibold text-[#1b1c19]">
              Contrast & Screen Reader Ready
            </p>
          </div>

          <div className="bg-[#f5f3ee] p-3 rounded border border-[#d1c4b9]/30 space-y-1">
            <span className="text-[#80756b]">Audit Event State</span>
            <p className="font-semibold text-[#1b1c19]">
              Contextual Metadata Logged
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
