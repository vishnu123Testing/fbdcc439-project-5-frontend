'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Headphones,
  ShieldCheck,
  Building,
  User,
  Key,
  RefreshCw,
  AlertCircle,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  X,
  Plus,
  MessageSquare,
  LifeBuoy,
  HelpCircle,
  Activity,
  ChevronDown,
  Star,
  Timer,
  BarChart2,
  TrendingUp,
  AlertTriangle,
  Award,
  Users,
  Check,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Layers,
  Zap,
  ArrowLeft,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import { apiClient, UserMeResponse, ApiError } from '../../../services/apiClient';
import {
  supportService,
  SupportAnalyticsResponse,
  AnalyticsFilterParams,
  TicketPriority,
} from '../../../services/support';
import { StatusLabel } from '../../../components/common/StatusLabel';
import { useAccessibility } from '../../../components/common/AccessibilityContext';

/**
 * Time window filter presets for operational support analytics [FR-8].
 */
export type TimeWindowPreset = '24h' | '7d' | '30d' | '90d' | 'all' | 'custom';

/**
 * Format duration in seconds into a human-readable display string (e.g., '14m 32s', '2h 15m') [FR-8].
 */
function formatDuration(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || seconds <= 0) {
    return '0s';
  }
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const remainingMins = Math.round((seconds % 3600) / 60);
  if (hours < 24) {
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Render interactive star icons for CSAT rating visualizations [FR-8, FR-9].
 */
function CSATStars({ rating }: { rating: number }) {
  const rounded = Math.round(rating * 10) / 10;
  return (
    <div className="flex items-center space-x-1" aria-label={`CSAT Rating: ${rounded} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= Math.floor(rounded);
        const isHalf = star === Math.ceil(rounded) && rounded % 1 >= 0.5;
        return (
          <Star
            key={star}
            className={`w-5 h-5 ${
              isFilled
                ? 'text-amber-500 fill-amber-500'
                : isHalf
                ? 'text-amber-500 fill-amber-300'
                : 'text-stone-300 fill-stone-100'
            }`}
            aria-hidden="true"
          />
        );
      })}
      <span className="ml-1 text-sm font-semibold text-stone-800">{rounded.toFixed(1)}</span>
    </div>
  );
}

export default function SupportAnalyticsPage() {
  const { announce } = useAccessibility();

  // Accessibility / High Contrast State
  const [highContrast, setHighContrast] = useState<boolean>(false);

  // User and Auth State
  const [currentUser, setCurrentUser] = useState<UserMeResponse | null>(null);

  // Analytics Metrics Data State [FR-8]
  const [analytics, setAnalytics] = useState<SupportAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Filter Control States [FR-8]
  const [preset, setPreset] = useState<TimeWindowPreset>('30d');
  const [startTimeInput, setStartTimeInput] = useState<string>('');
  const [endTimeInput, setEndTimeInput] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<TicketPriority | ''>('');
  const [clientIdFilter, setClientIdFilter] = useState<string>('');

  // Calculate ISO timestamp parameters based on active time window preset [FR-8]
  const getFilterWindowParams = useCallback(
    (p: TimeWindowPreset, startCustom?: string, endCustom?: string): AnalyticsFilterParams => {
      const params: AnalyticsFilterParams = {};

      if (selectedPriority) {
        params.priority = selectedPriority;
      }
      if (clientIdFilter.trim()) {
        params.client_id = clientIdFilter.trim();
      }

      const now = new Date();

      if (p === '24h') {
        const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        params.start_time = start.toISOString();
        params.end_time = now.toISOString();
      } else if (p === '7d') {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        params.start_time = start.toISOString();
        params.end_time = now.toISOString();
      } else if (p === '30d') {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        params.start_time = start.toISOString();
        params.end_time = now.toISOString();
      } else if (p === '90d') {
        const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        params.start_time = start.toISOString();
        params.end_time = now.toISOString();
      } else if (p === 'custom') {
        if (startCustom) {
          params.start_time = new Date(startCustom).toISOString();
        }
        if (endCustom) {
          params.end_time = new Date(endCustom).toISOString();
        }
      }
      // 'all' leaves start_time and end_time undefined

      return params;
    },
    [selectedPriority, clientIdFilter]
  );

  // Fetch current user details on mount
  useEffect(() => {
    let isMounted = true;
    apiClient
      .getMe()
      .then((user) => {
        if (isMounted) {
          setCurrentUser(user);
        }
      })
      .catch((err) => {
        console.warn('Authentication token check optional for support analytics page:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Operational Support Analytics from backend [FR-8]
  const fetchAnalytics = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const params = getFilterWindowParams(preset, startTimeInput, endTimeInput);
        const data = await supportService.getSupportAnalytics(params);
        setAnalytics(data);
        setLastRefreshed(new Date());
        announce('Operational support analytics metrics loaded successfully.', 'polite');
      } catch (err: unknown) {
        console.error('Failed to fetch operational support analytics:', err);
        let errorMsg = 'Failed to load support analytics. Please try again.';
        if (err instanceof ApiError) {
          errorMsg = err.message || `API Error (${err.status})`;
        } else if (err instanceof Error) {
          errorMsg = err.message;
        }
        setError(errorMsg);
        announce(`Error loading support analytics: ${errorMsg}`, 'assertive');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [preset, startTimeInput, endTimeInput, getFilterWindowParams, announce]
  );

  // Re-fetch analytics when preset or filter options change
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Handle Preset Button Click [FR-8]
  const handlePresetSelect = (newPreset: TimeWindowPreset) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      setStartTimeInput('');
      setEndTimeInput('');
    }
  };

  // Reset Filters to default (30 Days, All Priorities, No Client ID)
  const handleResetFilters = () => {
    setPreset('30d');
    setStartTimeInput('');
    setEndTimeInput('');
    setSelectedPriority('');
    setClientIdFilter('');
  };

  // Derived Analytics Values & Safe Calculations [FR-8]
  const totalTickets = analytics?.total_tickets ?? 0;
  const openTickets = analytics?.open_tickets ?? 0;
  const pendingTickets = analytics?.pending_tickets ?? 0;
  const resolvedTickets = analytics?.resolved_tickets ?? 0;

  const resolutionRatePercent = useMemo(() => {
    if (totalTickets === 0) return 0;
    return Math.round((resolvedTickets / totalTickets) * 1000) / 10;
  }, [totalTickets, resolvedTickets]);

  const avgFirstResponseSecs = analytics?.average_first_response_time_seconds ?? 0;
  const mttrSecs = analytics?.mean_time_to_resolution_seconds ?? 0;

  const totalSlaTargets = analytics?.total_sla_targets ?? 0;
  const breachedSlaTargets = analytics?.breached_sla_targets ?? 0;
  const breachRatePercent = analytics?.sla_breach_rate_percent ?? 0;
  const complianceRatePercent = useMemo(() => {
    const comp = 100 - breachRatePercent;
    return Math.max(0, Math.min(100, Math.round(comp * 10) / 10));
  }, [breachRatePercent]);

  const avgCsatScore = analytics?.average_csat_score ?? 0;
  const csatCount = analytics?.csat_response_count ?? 0;

  const priorityP1 = analytics?.priority_breakdown?.P1 ?? 0;
  const priorityP2 = analytics?.priority_breakdown?.P2 ?? 0;
  const priorityP3 = analytics?.priority_breakdown?.P3 ?? 0;

  const priorityTotal = priorityP1 + priorityP2 + priorityP3 || 1;
  const p1Pct = Math.round((priorityP1 / priorityTotal) * 100);
  const p2Pct = Math.round((priorityP2 / priorityTotal) * 100);
  const p3Pct = Math.round((priorityP3 / priorityTotal) * 100);

  return (
    <div
      className={`min-h-screen ${
        highContrast ? 'bg-black text-white' : 'bg-[#fbf9f4] text-[#1b1c19]'
      } font-sans antialiased pb-16 transition-colors duration-200`}
    >
      {/* ----------------------------------------------------------------- */}
      {/* Header & Global Support Bar                                        */}
      {/* ----------------------------------------------------------------- */}
      <header
        className={`border-b ${
          highContrast ? 'border-stone-800 bg-stone-900' : 'border-[#e4e2dd] bg-[#fbf9f4]'
        } sticky top-0 z-20 backdrop-blur-md bg-opacity-95`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Title & Navigation Link */}
            <div>
              <div className="flex items-center space-x-2 text-xs tracking-wider uppercase font-medium text-stone-500 mb-1">
                <Link
                  href="/support"
                  className="hover:text-stone-800 flex items-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41] rounded"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Support Operations
                </Link>
                <span>/</span>
                <span className="text-[#735c41]">Analytics Dashboard</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif text-[#1b1c19] tracking-tight">
                Operational Support Analytics
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
                Real-time performance metrics, SLA compliance, MTTR trends, and CSAT ratings [FR-8]
              </p>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center space-x-3">
              <Link
                href="/support"
                className="inline-flex items-center px-3.5 py-2 text-xs font-medium rounded-md border border-[#d1c4b9] text-[#4e453d] bg-white hover:bg-[#f5f3ee] transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]"
              >
                <Headphones className="w-3.5 h-3.5 mr-1.5 text-[#735c41]" /> Ticket Management
              </Link>
              <button
                type="button"
                onClick={() => fetchAnalytics(true)}
                disabled={loading || refreshing}
                className="inline-flex items-center px-3.5 py-2 text-xs font-medium rounded-md text-white bg-[#59452b] hover:bg-[#735c41] transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                aria-label="Refresh operational support analytics metrics"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh Metrics'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* Main Container                                                    */}
      {/* ----------------------------------------------------------------- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Error Notification Alert */}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-4 flex items-start space-x-3" role="alert">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800">Failed to load analytics data</h3>
              <p className="text-xs text-red-700 mt-0.5">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => fetchAnalytics(true)}
              className="px-2.5 py-1 text-xs font-medium text-red-800 bg-red-100 hover:bg-red-200 rounded transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* Filter Controls & Analysis Window Panel [FR-8]                 */}
        {/* --------------------------------------------------------------- */}
        <section
          className={`p-4 sm:p-5 rounded-lg border ${
            highContrast ? 'border-stone-800 bg-stone-900' : 'border-[#e4e2dd] bg-white'
          } shadow-sm space-y-4`}
          aria-label="Analytics Filter Controls"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-3 border-b border-[#f0eee9]">
            {/* Time Window Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-stone-500 block">
                Analysis Time Window [FR-8]
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {(['24h', '7d', '30d', '90d', 'all', 'custom'] as TimeWindowPreset[]).map((p) => {
                  const isActive = preset === p;
                  const labelMap: Record<TimeWindowPreset, string> = {
                    '24h': 'Last 24 Hours',
                    '7d': 'Last 7 Days',
                    '30d': 'Last 30 Days',
                    '90d': 'Last 90 Days',
                    all: 'All Time',
                    custom: 'Custom Range',
                  };
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePresetSelect(p)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        isActive
                          ? 'bg-[#59452b] text-white shadow-sm'
                          : 'bg-[#f5f3ee] text-[#4e453d] hover:bg-[#eae8e3]'
                      }`}
                    >
                      {labelMap[p]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Last Refreshed Indicator */}
            {lastRefreshed && (
              <div className="flex items-center text-xs text-stone-500 space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                <span>Last updated: {lastRefreshed.toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          {/* Detailed Filters Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {/* Priority Filter */}
            <div>
              <label htmlFor="priority-filter" className="block text-xs font-medium text-stone-600 mb-1">
                Priority Filter [FR-[#1, FR-8]]
              </label>
              <select
                id="priority-filter"
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as TicketPriority | '')}
                className="w-full text-xs rounded-md border-[#d1c4b9] bg-[#fbf9f4] text-stone-800 p-2 focus:border-[#735c41] focus:ring-[#735c41]"
              >
                <option value="">All Priorities (P1, P2, P3)</option>
                <option value="P1">P1 - Critical / Urgent</option>
                <option value="P2">P2 - High Priority</option>
                <option value="P3">P3 - Standard / Normal</option>
              </select>
            </div>

            {/* Client ID Filter */}
            <div>
              <label htmlFor="client-id-filter" className="block text-xs font-medium text-stone-600 mb-1">
                Client Entity Filter [FR-8]
              </label>
              <div className="relative">
                <input
                  id="client-id-filter"
                  type="text"
                  placeholder="e.g. client-001"
                  value={clientIdFilter}
                  onChange={(e) => setClientIdFilter(e.target.value)}
                  className="w-full text-xs rounded-md border-[#d1c4b9] bg-[#fbf9f4] text-stone-800 p-2 pr-8 focus:border-[#735c41] focus:ring-[#735c41]"
                />
                {clientIdFilter && (
                  <button
                    type="button"
                    onClick={() => setClientIdFilter('')}
                    className="absolute right-2 top-2 text-stone-400 hover:text-stone-600"
                    aria-label="Clear client filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Custom Start Time (Enabled if custom preset selected) */}
            <div>
              <label htmlFor="start-time-input" className="block text-xs font-medium text-stone-600 mb-1">
                Custom Start Time
              </label>
              <input
                id="start-time-input"
                type="datetime-local"
                disabled={preset !== 'custom'}
                value={startTimeInput}
                onChange={(e) => setStartTimeInput(e.target.value)}
                className="w-full text-xs rounded-md border-[#d1c4b9] bg-[#fbf9f4] text-stone-800 p-1.5 disabled:opacity-50 focus:border-[#735c41] focus:ring-[#735c41]"
              />
            </div>

            {/* Custom End Time */}
            <div>
              <label htmlFor="end-time-input" className="block text-xs font-medium text-stone-600 mb-1">
                Custom End Time
              </label>
              <input
                id="end-time-input"
                type="datetime-local"
                disabled={preset !== 'custom'}
                value={endTimeInput}
                onChange={(e) => setEndTimeInput(e.target.value)}
                className="w-full text-xs rounded-md border-[#d1c4b9] bg-[#fbf9f4] text-stone-800 p-1.5 disabled:opacity-50 focus:border-[#735c41] focus:ring-[#735c41]"
              />
            </div>
          </div>

          {/* Reset Filters CTA */}
          {(selectedPriority || clientIdFilter || preset === 'custom') && (
            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-medium text-[#735c41] hover:text-[#59452b] flex items-center"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Reset Filters
              </button>
            </div>
          )}
        </section>

        {/* Loading Skeleton Indicator */}
        {loading && !analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-32 bg-[#eae8e3] rounded-lg border border-[#e4e2dd]" />
            ))}
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* Key Metrics Cards Grid [FR-8]                                   */}
        {/* --------------------------------------------------------------- */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" aria-label="Key Performance Indicators">
          {/* Card 1: Total Ticket Volume & Status */}
          <div
            className={`p-4 rounded-lg border ${
              highContrast ? 'border-stone-800 bg-stone-900' : 'border-[#e4e2dd] bg-white'
            } shadow-sm space-y-2`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-stone-500">Ticket Volume</span>
              <span className="p-1.5 rounded-md bg-[#f5f3ee] text-[#735c41]">
                <Layers className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-serif text-[#1b1c19]">{totalTickets}</div>
              <p className="text-xs text-stone-500 mt-1">
                <span className="font-medium text-emerald-700">{resolvedTickets}</span> Resolved ({resolutionRatePercent}%)
              </p>
            </div>
            {/* Status Breakdown Bar */}
            <div className="space-y-1 pt-1">
              <div className="w-full bg-stone-100 rounded-full h-1.5 flex overflow-hidden">
                <div
                  style={{ width: `${totalTickets > 0 ? (openTickets / totalTickets) * 100 : 0}%` }}
                  className="bg-sky-500 h-full"
                  title={`Open: ${openTickets}`}
                />
                <div
                  style={{ width: `${totalTickets > 0 ? (pendingTickets / totalTickets) * 100 : 0}%` }}
                  className="bg-amber-500 h-full"
                  title={`Pending: ${pendingTickets}`}
                />
                <div
                  style={{ width: `${totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0}%` }}
                  className="bg-emerald-600 h-full"
                  title={`Resolved: ${resolvedTickets}`}
                />
              </div>
              <div className="flex justify-between text-[10px] text-stone-500 pt-0.5">
                <span>{openTickets} Open</span>
                <span>{pendingTickets} Pending</span>
                <span>{resolvedTickets} Closed</span>
              </div>
            </div>
          </div>

          {/* Card 2: Average First Response Time */}
          <div
            className={`p-4 rounded-lg border ${
              highContrast ? 'border-stone-800 bg-stone-900' : 'border-[#e4e2dd] bg-white'
            } shadow-sm space-y-2`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-stone-500">Avg First Response</span>
              <span className="p-1.5 rounded-md bg-[#f5f3ee] text-[#735c41]">
                <Zap className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-serif text-[#1b1c19]">
                {formatDuration(avgFirstResponseSecs)}
              </div>
              <p className="text-xs text-stone-500 mt-1">First agent response SLA</p>
            </div>
            <div className="pt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#f0eee9] text-[#59452b]">
                Target: &lt; 1h (P1) / &lt; 4h (P2)
              </span>
            </div>
          </div>

          {/* Card 3: Mean Time to Resolution (MTTR) */}
          <div
            className={`p-4 rounded-lg border ${
              highContrast ? 'border-stone-800 bg-stone-900' : 'border-[#e4e2dd] bg-white'
            } shadow-sm space-y-2`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-stone-500">MTTR (Resolution)</span>
              <span className="p-1.5 rounded-md bg-[#f5f3ee] text-[#735c41]">
                <Timer className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-serif text-[#1b1c19]">{formatDuration(mttrSecs)}</div>
              <p className="text-xs text-stone-500 mt-1">Mean time to ticket resolution</p>
            </div>
            <div className="pt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#f0eee9] text-[#59452b]">
                Benchmark: &lt; 24h average
              </span>
            </div>
          </div>

          {/* Card 4: SLA Compliance Rate & Breaches */}
          <div
            className={`p-4 rounded-lg border ${
              highContrast ? 'border-stone-800 bg-stone-900' : 'border-[#e4e2dd] bg-white'
            } shadow-sm space-y-2`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-stone-500">SLA Compliance</span>
              <span
                className={`p-1.5 rounded-md ${
                  breachRatePercent > 15 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div
                className={`text-2xl sm:text-3xl font-serif ${
                  complianceRatePercent >= 90
                    ? 'text-emerald-800'
                    : complianceRatePercent >= 80
                    ? 'text-amber-800'
                    : 'text-red-800'
                }`}
              >
                {complianceRatePercent}%
              </div>
              <p className="text-xs text-stone-500 mt-1">
                {breachedSlaTargets} breached / {totalSlaTargets} targets
              </p>
            </div>
            <div className="pt-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                  breachRatePercent === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : breachRatePercent <= 10
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {breachRatePercent.toFixed(1)}% Breach Rate
              </span>
            </div>
          </div>

          {/* Card 5: CSAT Satisfaction Score */}
          <div
            className={`p-4 rounded-lg border ${
              highContrast ? 'border-stone-800 bg-stone-900' : 'border-[#e4e2dd] bg-white'
            } shadow-sm space-y-2`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-stone-500">CSAT Score [FR-9]</span>
              <span className="p-1.5 rounded-md bg-[#f5f3ee] text-[#735c41]">
                <Star className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl sm:text-3xl font-serif text-[#1b1c19]">
                  {avgCsatScore > 0 ? avgCsatScore.toFixed(1) : 'N/A'}
                </span>
                <span className="text-xs text-stone-400">/ 5.0</span>
              </div>
              <div className="mt-1">
                <CSATStars rating={avgCsatScore} />
              </div>
            </div>
            <div className="pt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#f0eee9] text-[#59452b]">
                {csatCount} survey response{csatCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Priority Breakdown & Operational Analysis Section [FR-8]       */}
        {/* --------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Priority Distribution Cards */}
          <div
            className={`lg:col-span-1 p-5 rounded-lg border ${
              highContrast ? 'border-stone-800 bg-stone-900' : 'border-[#e4e2dd] bg-white'
            } shadow-sm space-y-4`}
          >
            <div>
              <h2 className="text-base font-serif text-[#1b1c19] flex items-center">
                <PieChart className="w-4 h-4 mr-2 text-[#735c41]" /> Priority Breakdown [FR-1, FR-8]
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">Ticket volume distribution across assigned priority tiers</p>
            </div>

            <div className="space-y-4 pt-2">
              {/* P1 Critical Priority */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center text-red-800">
                    <span className="w-2 h-2 rounded-full bg-red-600 mr-2" /> P1 - Critical / Urgent
                  </span>
                  <span className="text-stone-700">
                    {priorityP1} tickets ({p1Pct}%)
                  </span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                  <div style={{ width: `${p1Pct}%` }} className="bg-red-600 h-full rounded-full" />
                </div>
                <p className="text-[10px] text-stone-500">SLA Targets: 1h First Response | 4h Resolution</p>
              </div>

              {/* P2 High Priority */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center text-amber-800">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" /> P2 - High Priority
                  </span>
                  <span className="text-stone-700">
                    {priorityP2} tickets ({p2Pct}%)
                  </span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                  <div style={{ width: `${p2Pct}%` }} className="bg-amber-500 h-full rounded-full" />
                </div>
                <p className="text-[10px] text-stone-500">SLA Targets: 4h First Response | 24h Resolution</p>
              </div>

              {/* P3 Standard Priority */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center text-stone-800">
                    <span className="w-2 h-2 rounded-full bg-stone-400 mr-2" /> P3 - Standard / Normal
                  </span>
                  <span className="text-stone-700">
                    {priorityP3} tickets ({p3Pct}%)
                  </span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                  <div style={{ width: `${p3Pct}%` }} className="bg-stone-400 h-full rounded-full" />
                </div>
                <p className="text-[10px] text-stone-500">SLA Targets: 24h First Response | 72h Resolution</p>
              </div>
            </div>
          </div>

          {/* SLA Performance & Health Panel */}
          <div
            className={`lg:col-span-2 p-5 rounded-lg border ${
              highContrast ? 'border-stone-800 bg-stone-900' : 'border-[#e4e2dd] bg-white'
            } shadow-sm space-y-4`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-serif text-[#1b1c19] flex items-center">
                  <Activity className="w-4 h-4 mr-2 text-[#735c41]" /> Operational SLA Performance Details [FR-4, FR-8]
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Detailed evaluation of countdown timers, warning thresholds, and resolution rates
                </p>
              </div>
              <StatusLabel
                status={complianceRatePercent >= 90 ? 'operational' : complianceRatePercent >= 80 ? 'warning' : 'degraded'}
                label={
                  complianceRatePercent >= 90
                    ? 'Optimal Health'
                    : complianceRatePercent >= 80
                    ? 'Warning State'
                    : 'Action Required'
                }
              />
            </div>

            {/* SLA Metrics Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Response Time SLA Metric Box */}
              <div className="p-3.5 rounded-md bg-[#fbf9f4] border border-[#f0eee9] space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-[#59452b]">
                  <span className="flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5" /> First Response SLA
                  </span>
                  <span className="text-xs font-semibold">{formatDuration(avgFirstResponseSecs)}</span>
                </div>
                <p className="text-xs text-stone-600">
                  Measures average time from ticket submission until initial agent interaction [FR-4, FR-7].
                </p>
                <div className="text-[11px] text-stone-500 border-t border-[#eae8e3] pt-2 flex justify-between">
                  <span>Evaluated Targets: {totalSlaTargets}</span>
                  <span className="font-medium text-stone-700">Warning Threshold: 80%</span>
                </div>
              </div>

              {/* Resolution MTTR Metric Box */}
              <div className="p-3.5 rounded-md bg-[#fbf9f4] border border-[#f0eee9] space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-[#59452b]">
                  <span className="flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Resolution MTTR
                  </span>
                  <span className="text-xs font-semibold">{formatDuration(mttrSecs)}</span>
                </div>
                <p className="text-xs text-stone-600">
                  Measures mean time required to fully resolve and close active support tickets [FR-7, FR-8].
                </p>
                <div className="text-[11px] text-stone-500 border-t border-[#eae8e3] pt-2 flex justify-between">
                  <span>Resolved Volume: {resolvedTickets}</span>
                  <span className="font-medium text-stone-700">Target MTTR: &lt; 24h</span>
                </div>
              </div>
            </div>

            {/* Operational Insights Callout */}
            <div className="p-3.5 rounded-md bg-[#f5f3ee] border border-[#e4e2dd] flex items-start space-x-3">
              <Info className="w-4 h-4 text-[#735c41] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-[#4e453d] space-y-1">
                <p className="font-medium text-[#1b1c19]">SLA Policy & Escalation Guidance [FR-5, FR-6]</p>
                <p>
                  Proactive warning notifications are dispatched when 80% of an SLA countdown target elapses without agent
                  activity. Unresolved tickets automatically escalate across support tiers upon reaching expiration [FR-[#5, FR-6]].
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------------- */}
        {/* Detailed Metrics Table [FR-8]                                    */}
        {/* --------------------------------------------------------------- */}
        <section
          className={`p-5 rounded-lg border ${
            highContrast ? 'border-stone-800 bg-stone-900' : 'border-[#e4e2dd] bg-white'
          } shadow-sm space-y-4`}
          aria-label="Operational Performance Summary Table"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-serif text-[#1b1c19] flex items-center">
                <BarChart2 className="w-4 h-4 mr-2 text-[#735c41]" /> Operational Support Performance Summary Table
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Comprehensive data breakdown across ticket states, SLA targets, and client ratings
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700 border-collapse">
              <thead>
                <tr className="border-b border-[#e4e2dd] bg-[#fbf9f4] text-stone-600 font-medium uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Metric Indicator</th>
                  <th className="py-2.5 px-3">Recorded Value</th>
                  <th className="py-2.5 px-3">Benchmark / Target</th>
                  <th className="py-2.5 px-3">Status Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0eee9]">
                <tr>
                  <td className="py-2.5 px-3 font-medium text-stone-900">Total Ticket Volume</td>
                  <td className="py-2.5 px-3">{totalTickets} tickets</td>
                  <td className="py-2.5 px-3 text-stone-500">N/A (Volume metric)</td>
                  <td className="py-2.5 px-3">
                    <StatusLabel status="info" label={`${resolvedTickets} resolved`} showIcon={false} />
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-stone-900">Average First Response Time</td>
                  <td className="py-2.5 px-3 font-semibold">{formatDuration(avgFirstResponseSecs)}</td>
                  <td className="py-2.5 px-3 text-stone-500">&lt; 1h (P1) / &lt; 4h (P2)</td>
                  <td className="py-2.5 px-3">
                    <StatusLabel
                      status={avgFirstResponseSecs < 3600 ? 'success' : 'warning'}
                      label={avgFirstResponseSecs < 3600 ? 'Within Target' : 'Review Needed'}
                      showIcon={false}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-stone-900">Mean Time to Resolution (MTTR)</td>
                  <td className="py-2.5 px-3 font-semibold">{formatDuration(mttrSecs)}</td>
                  <td className="py-2.5 px-3 text-stone-500">&lt; 24 Hours MTTR</td>
                  <td className="py-2.5 px-3">
                    <StatusLabel
                      status={mttrSecs < 86400 ? 'success' : 'warning'}
                      label={mttrSecs < 86400 ? 'Healthy MTTR' : 'Extended Duration'}
                      showIcon={false}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-stone-900">SLA Target Evaluation Volume</td>
                  <td className="py-2.5 px-3">{totalSlaTargets} targets</td>
                  <td className="py-2.5 px-3 text-stone-500">100% Tracking</td>
                  <td className="py-2.5 px-3">
                    <StatusLabel status="active" label="Active Tracking" showIcon={false} />
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-stone-900">SLA Breach Volume & Rate</td>
                  <td className="py-2.5 px-3 font-semibold">
                    {breachedSlaTargets} ({breachRatePercent.toFixed(1)}%)
                  </td>
                  <td className="py-2.5 px-3 text-stone-500">&lt; 10% Breach Rate</td>
                  <td className="py-2.5 px-3">
                    <StatusLabel
                      status={breachRatePercent <= 10 ? 'success' : 'error'}
                      label={breachRatePercent <= 10 ? 'Compliant' : 'Breach Threshold Exceeded'}
                      showIcon={false}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-stone-900">Customer Satisfaction (CSAT)</td>
                  <td className="py-2.5 px-3 font-semibold">
                    {avgCsatScore > 0 ? `${avgCsatScore.toFixed(1)} / 5.0` : 'No ratings yet'}
                  </td>
                  <td className="py-2.5 px-3 text-stone-500">&ge; 4.0 Target Rating</td>
                  <td className="py-2.5 px-3">
                    <StatusLabel
                      status={avgCsatScore >= 4.0 ? 'success' : avgCsatScore > 0 ? 'warning' : 'neutral'}
                      label={avgCsatScore >= 4.0 ? 'High Satisfaction' : avgCsatScore > 0 ? 'Moderate CSAT' : 'Pending CSAT'}
                      showIcon={false}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
