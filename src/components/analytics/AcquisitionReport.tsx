'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  BarChart2,
  TrendingUp,
  DollarSign,
  Award,
  Filter,
  RotateCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  AlertCircle,
  Search,
  Calendar,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import {
  getAcquisitionReport,
  AcquisitionReportItem,
  AcquisitionReportParams,
} from '../../services/analytics';

export type SortField =
  | 'quality_score'
  | 'lead_count'
  | 'spend_amount'
  | 'revenue_amount'
  | 'roi'
  | 'channel_name';

export type SortOrder = 'asc' | 'desc';

export type DatePreset = '7d' | '30d' | '90d' | 'ytd' | 'all';

export interface AcquisitionSummary {
  totalLeads: number;
  averageQualityScore: number;
  totalSpend: number;
  totalRevenue: number;
  overallROI: string;
}

export interface AcquisitionReportProps {
  /**
   * Optional pre-fetched acquisition report items
   */
  initialData?: AcquisitionReportItem[] | null;
  /**
   * Optional initial filter parameters
   */
  initialParams?: AcquisitionReportParams;
  /**
   * Optional loading state override from parent component
   */
  loading?: boolean;
  /**
   * Optional error message override from parent component
   */
  error?: string | null;
  /**
   * Callback fired when parameters change or user clicks refresh
   */
  onRefresh?: (params: AcquisitionReportParams) => void;
  /**
   * Callback fired when user clicks CSV/PDF export buttons
   */
  onExport?: (format: 'csv' | 'pdf') => void;
  /**
   * Whether to automatically fetch data on mount and parameter changes if initialData is not provided
   */
  autoFetch?: boolean;
  /**
   * Additional CSS class names
   */
  className?: string;
}

/**
 * Format raw numbers as USD currency ($1,234.56).
 */
export function formatCurrency(amount?: number | null): string {
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
 * Safe ROI formatter ensuring zero-spend or zero-revenue channels display "N/A"
 * without division-by-zero errors [FR-003].
 */
export function formatROI(
  roiVal?: string | null,
  spend?: number | null,
  revenue?: number | null
): string {
  if (spend === null || spend === undefined || spend <= 0) {
    return 'N/A';
  }
  if (revenue === null || revenue === undefined || revenue <= 0) {
    return 'N/A';
  }
  if (!roiVal || roiVal.trim().toUpperCase() === 'N/A') {
    return 'N/A';
  }

  const cleaned = roiVal.trim();
  if (cleaned.endsWith('%')) {
    return cleaned;
  }

  const num = parseFloat(cleaned);
  if (isNaN(num) || !isFinite(num)) {
    return 'N/A';
  }

  return `${num.toFixed(2)}%`;
}

/**
 * Metadata for rendering lead quality score badges and visual progress indicators [FR-002].
 */
export function getQualityScoreMeta(score?: number | null): {
  label: string;
  badgeClass: string;
  barClass: string;
  tier: 'high' | 'medium' | 'low' | 'unrated';
} {
  if (score === null || score === undefined || isNaN(score) || score <= 0) {
    return {
      label: 'Unrated',
      badgeClass: 'bg-neutral-100 text-neutral-700 border-neutral-300',
      barClass: 'bg-neutral-300',
      tier: 'unrated',
    };
  }
  if (score >= 80) {
    return {
      label: 'High Quality',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      barClass: 'bg-emerald-600',
      tier: 'high',
    };
  }
  if (score >= 50) {
    return {
      label: 'Moderate Quality',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      barClass: 'bg-amber-500',
      tier: 'medium',
    };
  }
  return {
    label: 'Low Quality',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    barClass: 'bg-rose-500',
    tier: 'low',
  };
}

/**
 * Compute summary KPIs across channel acquisition items [FR-001].
 */
export function calculateSummaryMetrics(items: AcquisitionReportItem[]): AcquisitionSummary {
  if (!items || items.length === 0) {
    return {
      totalLeads: 0,
      averageQualityScore: 0,
      totalSpend: 0,
      totalRevenue: 0,
      overallROI: 'N/A',
    };
  }

  const totalLeads = items.reduce((sum, item) => sum + (item.lead_count || 0), 0);
  const totalSpend = items.reduce((sum, item) => sum + (item.spend_amount || 0), 0);
  const totalRevenue = items.reduce((sum, item) => sum + (item.revenue_amount || 0), 0);

  const validScores = items
    .map((i) => i.quality_score)
    .filter((s) => s !== null && s !== undefined && !isNaN(s) && s > 0);

  const averageQualityScore =
    validScores.length > 0
      ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
      : 0;

  const overallROI = formatROI(
    totalSpend > 0 && totalRevenue > 0
      ? `${(((totalRevenue - totalSpend) / totalSpend) * 100).toFixed(2)}%`
      : 'N/A',
    totalSpend,
    totalRevenue
  );

  return {
    totalLeads,
    averageQualityScore,
    totalSpend,
    totalRevenue,
    overallROI,
  };
}

/**
 * Sort acquisition report items by field and order [FR-002].
 */
export function sortAcquisitionItems(
  items: AcquisitionReportItem[],
  sortBy: SortField,
  sortOrder: SortOrder
): AcquisitionReportItem[] {
  return [...items].sort((a, b) => {
    let valA: number | string = a[sortBy];
    let valB: number | string = b[sortBy];

    if (sortBy === 'roi') {
      const parsedA = formatROI(a.roi, a.spend_amount, a.revenue_amount);
      const parsedB = formatROI(b.roi, b.spend_amount, b.revenue_amount);

      const numA =
        parsedA === 'N/A' ? -999999 : parseFloat(parsedA.replace('%', ''));
      const numB =
        parsedB === 'N/A' ? -999999 : parseFloat(parsedB.replace('%', ''));

      valA = isNaN(numA) ? -999999 : numA;
      valB = isNaN(numB) ? -999999 : numB;
    } else if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB as string).toLowerCase();
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Calculate start and end date string bounds for quick presets.
 */
export function getDatePresetRange(preset: DatePreset): {
  start_date_val?: string;
  end_date_val?: string;
} {
  if (preset === 'all') {
    return { start_date_val: undefined, end_date_val: undefined };
  }
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start = new Date();

  if (preset === '7d') {
    start.setDate(now.getDate() - 7);
  } else if (preset === '30d') {
    start.setDate(now.getDate() - 30);
  } else if (preset === '90d') {
    start.setDate(now.getDate() - 90);
  } else if (preset === 'ytd') {
    start = new Date(now.getFullYear(), 0, 1);
  }

  return {
    start_date_val: start.toISOString().split('T')[0],
    end_date_val: end,
  };
}

export function AcquisitionReport({
  initialData = null,
  initialParams,
  loading: externalLoading,
  error: externalError,
  onRefresh,
  onExport,
  autoFetch = true,
  className,
}: AcquisitionReportProps) {
  const [reportData, setReportData] = useState<AcquisitionReportItem[]>(initialData || []);
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Filter and sorting state
  const [startDate, setStartDate] = useState<string>(initialParams?.start_date_val || '');
  const [endDate, setEndDate] = useState<string>(initialParams?.end_date_val || '');
  const [selectedChannelId, setSelectedChannelId] = useState<string>(initialParams?.channel_id || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortField>(
    (initialParams?.sort_by as SortField) || 'quality_score'
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialParams?.sort_order || 'desc');
  const [activePreset, setActivePreset] = useState<DatePreset | null>('30d');

  const isLoading = externalLoading ?? internalLoading;
  const errorMessage = externalError ?? internalError;

  // Sync initialData prop if updated externally
  useEffect(() => {
    if (initialData) {
      setReportData(initialData);
    }
  }, [initialData]);

  // Fetch acquisition report from API [FR-001]
  const fetchData = useCallback(
    async (overrideParams?: AcquisitionReportParams) => {
      setInternalLoading(true);
      setInternalError(null);

      const params: AcquisitionReportParams = overrideParams || {
        start_date_val: startDate || undefined,
        end_date_val: endDate || undefined,
        channel_id: selectedChannelId || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      try {
        const result = await getAcquisitionReport(params);
        setReportData(result);
        if (onRefresh) {
          onRefresh(params);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch acquisition report';
        setInternalError(msg);
      } finally {
        setInternalLoading(false);
      }
    },
    [startDate, endDate, selectedChannelId, sortBy, sortOrder, onRefresh]
  );

  // Initial load if autoFetch is true and no initialData
  useEffect(() => {
    if (autoFetch && !initialData) {
      fetchData();
    }
  }, [autoFetch, initialData, fetchData]);

  // Quick preset selector handler
  const handlePresetChange = (preset: DatePreset) => {
    setActivePreset(preset);
    const range = getDatePresetRange(preset);
    setStartDate(range.start_date_val || '');
    setEndDate(range.end_date_val || '');

    if (autoFetch) {
      fetchData({
        start_date_val: range.start_date_val,
        end_date_val: range.end_date_val,
        channel_id: selectedChannelId || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
    }
  };

  // Header column click sort toggle [FR-002]
  const handleHeaderSort = (field: SortField) => {
    let newOrder: SortOrder = 'desc';
    if (sortBy === field) {
      newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    } else {
      // Default quality_score, leads, spend, revenue, roi to desc; channel_name to asc
      newOrder = field === 'channel_name' ? 'asc' : 'desc';
    }

    setSortBy(field);
    setSortOrder(newOrder);

    if (autoFetch) {
      fetchData({
        start_date_val: startDate || undefined,
        end_date_val: endDate || undefined,
        channel_id: selectedChannelId || undefined,
        sort_by: field,
        sort_order: newOrder,
      });
    }
  };

  // Reset filter controls
  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedChannelId('');
    setSearchQuery('');
    setSortBy('quality_score');
    setSortOrder('desc');
    setActivePreset(null);

    if (autoFetch) {
      fetchData({
        sort_by: 'quality_score',
        sort_order: 'desc',
      });
    }
  };

  // Channel dropdown options dynamically built from data
  const availableChannels = useMemo(() => {
    const map = new Map<string, string>();
    reportData.forEach((item) => {
      if (item.channel_id && item.channel_name) {
        map.set(item.channel_id, item.channel_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [reportData]);

  // Filtered and sorted data list
  const processedData = useMemo(() => {
    let filtered = [...reportData];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) =>
        item.channel_name.toLowerCase().includes(q)
      );
    }

    if (selectedChannelId) {
      filtered = filtered.filter((item) => item.channel_id === selectedChannelId);
    }

    return sortAcquisitionItems(filtered, sortBy, sortOrder);
  }, [reportData, searchQuery, selectedChannelId, sortBy, sortOrder]);

  // Summary KPIs calculation
  const summary = useMemo(
    () => calculateSummaryMetrics(processedData),
    [processedData]
  );

  return (
    <div
      className={twMerge(
        'w-full bg-surface border border-surface-dim rounded-lg p-6 shadow-sm font-sans space-y-6',
        className
      )}
      data-testid="acquisition-report"
    >
      {/* Component Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-surface-dim">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" aria-hidden="true" />
            <h2 className="text-2xl font-serif font-normal text-neutral-900 tracking-tight">
              Channel Acquisition & ROI Report
            </h2>
          </div>
          <p className="text-sm text-neutral-600 mt-1">
            Attributed leads, quality scores, spend, revenue, and return on investment across channels.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onExport && (
            <div className="flex items-center gap-1 bg-surface-container border border-surface-dim rounded-md p-1">
              <button
                type="button"
                onClick={() => onExport('csv')}
                className="px-2.5 py-1 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-white rounded transition"
                title="Export report as CSV"
              >
                <Download className="w-3.5 h-3.5 inline mr-1" />
                CSV
              </button>
              <button
                type="button"
                onClick={() => onExport('pdf')}
                className="px-2.5 py-1 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-white rounded transition"
                title="Export report as PDF"
              >
                <Download className="w-3.5 h-3.5 inline mr-1" />
                PDF
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => fetchData()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container hover:bg-surface border border-surface-dim text-xs font-medium text-neutral-800 rounded-md transition focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            aria-label="Refresh report data"
          >
            <RotateCw
              className={clsx('w-3.5 h-3.5 text-neutral-600', isLoading && 'animate-spin')}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards [FR-001, FR-003] */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-surface-container/60 border border-surface-dim rounded-md p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-1">
            Attributed Leads
          </div>
          <div className="text-2xl font-semibold text-neutral-900" data-testid="summary-total-leads">
            {summary.totalLeads.toLocaleString()}
          </div>
          <div className="text-xs text-neutral-500 mt-1">Total across channels</div>
        </div>

        <div className="bg-surface-container/60 border border-surface-dim rounded-md p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-1">
            Avg Quality Score
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-neutral-900" data-testid="summary-avg-quality">
              {summary.averageQualityScore}
            </span>
            <span className="text-xs text-neutral-500">/ 100</span>
          </div>
          <div className="text-xs text-neutral-500 mt-1">Weighted average quality</div>
        </div>

        <div className="bg-surface-container/60 border border-surface-dim rounded-md p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-1">
            Marketing Spend
          </div>
          <div className="text-2xl font-semibold text-neutral-900" data-testid="summary-total-spend">
            {formatCurrency(summary.totalSpend)}
          </div>
          <div className="text-xs text-neutral-500 mt-1">Total acquisition cost</div>
        </div>

        <div className="bg-surface-container/60 border border-surface-dim rounded-md p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-1">
            Attributed Revenue
          </div>
          <div className="text-2xl font-semibold text-neutral-900" data-testid="summary-total-revenue">
            {formatCurrency(summary.totalRevenue)}
          </div>
          <div className="text-xs text-neutral-500 mt-1">Generated pipeline value</div>
        </div>

        <div className="bg-surface-container/60 border border-surface-dim rounded-md p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-1">
            Overall ROI
          </div>
          <div
            className={clsx(
              'text-2xl font-semibold',
              summary.overallROI === 'N/A'
                ? 'text-neutral-500'
                : summary.overallROI.startsWith('-')
                ? 'text-rose-700'
                : 'text-emerald-700'
            )}
            data-testid="summary-overall-roi"
          >
            {summary.overallROI}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            {summary.overallROI === 'N/A' ? 'Zero spend safety' : 'Revenue / Spend'}
          </div>
        </div>
      </div>

      {/* Filter and Control Bar [FR-001, FR-002] */}
      <div className="bg-surface-container/40 border border-surface-dim rounded-md p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-neutral-600 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-neutral-500" />
              Range:
            </span>
            {(['7d', '30d', '90d', 'ytd', 'all'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetChange(preset)}
                className={clsx(
                  'px-2.5 py-1 text-xs font-medium rounded transition',
                  activePreset === preset
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white border border-surface-dim text-neutral-700 hover:bg-surface'
                )}
              >
                {preset === '7d'
                  ? 'Last 7 Days'
                  : preset === '30d'
                  ? 'Last 30 Days'
                  : preset === '90d'
                  ? 'Last 90 Days'
                  : preset === 'ytd'
                  ? 'Year to Date'
                  : 'All Time'}
              </button>
            ))}
          </div>

          {/* Search channel box */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search channel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-surface-dim rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-neutral-800"
              aria-label="Search channels by name"
            />
          </div>
        </div>

        {/* Detailed Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-surface-dim/60">
          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePreset(null);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-surface-dim rounded-md text-neutral-800 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePreset(null);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-surface-dim rounded-md text-neutral-800 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Channel Dropdown Filter */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Channel Filter</label>
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-surface-dim rounded-md text-neutral-800 focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Filter by acquisition channel"
            >
              <option value="">All Channels</option>
              {availableChannels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Primary Sort Selector */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Sort By</label>
            <div className="flex gap-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-surface-dim rounded-md text-neutral-800 focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label="Sort channels by metric"
              >
                <option value="quality_score">Quality Score (FR-002)</option>
                <option value="lead_count">Attributed Leads</option>
                <option value="spend_amount">Marketing Spend</option>
                <option value="revenue_amount">Revenue</option>
                <option value="roi">Calculated ROI</option>
                <option value="channel_name">Channel Name</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="px-2 py-1.5 bg-white border border-surface-dim text-neutral-700 hover:bg-surface rounded-md text-xs font-medium transition"
                title={`Sort ${sortOrder === 'desc' ? 'Descending' : 'Ascending'}`}
              >
                {sortOrder === 'desc' ? 'High' : 'Low'}
              </button>
            </div>
          </div>
        </div>

        {/* Filter Action Buttons */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs text-neutral-600 hover:text-neutral-900 font-medium underline transition"
          >
            Reset Filters
          </button>

          <button
            type="button"
            onClick={() => fetchData()}
            disabled={isLoading}
            className="px-4 py-1.5 bg-primary text-white text-xs font-medium rounded-md hover:bg-primary/90 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Error Alert Display */}
      {errorMessage && (
        <div
          className="p-4 bg-rose-50 border border-rose-200 rounded-md text-rose-800 flex items-start gap-3"
          data-testid="acquisition-error"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold">Error Loading Acquisition Report</h4>
            <p className="text-xs text-rose-700 mt-0.5">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded text-xs font-medium transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton / Spinner */}
      {isLoading && (
        <div className="py-12 text-center space-y-3" data-testid="acquisition-loading">
          <RotateCw className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-xs text-neutral-600 font-medium">
            Aggregating channel acquisition metrics and ROI...
          </p>
        </div>
      )}

      {/* Channel Data Table */}
      {!isLoading && !errorMessage && (
        <div className="overflow-x-auto border border-surface-dim rounded-md">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container border-b border-surface-dim text-neutral-700 font-medium uppercase tracking-wider text-[11px]">
                <th
                  scope="col"
                  onClick={() => handleHeaderSort('channel_name')}
                  className="py-3 px-4 cursor-pointer hover:bg-surface-container-high transition select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Channel Name</span>
                    {sortBy === 'channel_name' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-primary" />
                      ))}
                  </div>
                </th>

                <th
                  scope="col"
                  onClick={() => handleHeaderSort('lead_count')}
                  className="py-3 px-4 text-right cursor-pointer hover:bg-surface-container-high transition select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Attributed Leads</span>
                    {sortBy === 'lead_count' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-primary" />
                      ))}
                  </div>
                </th>

                <th
                  scope="col"
                  onClick={() => handleHeaderSort('quality_score')}
                  className="py-3 px-4 cursor-pointer hover:bg-surface-container-high transition select-none"
                  data-testid="header-quality-score"
                >
                  <div className="flex items-center gap-1">
                    <span>Quality Score</span>
                    {sortBy === 'quality_score' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-primary" />
                      ))}
                  </div>
                </th>

                <th
                  scope="col"
                  onClick={() => handleHeaderSort('spend_amount')}
                  className="py-3 px-4 text-right cursor-pointer hover:bg-surface-container-high transition select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Spend</span>
                    {sortBy === 'spend_amount' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-primary" />
                      ))}
                  </div>
                </th>

                <th
                  scope="col"
                  onClick={() => handleHeaderSort('revenue_amount')}
                  className="py-3 px-4 text-right cursor-pointer hover:bg-surface-container-high transition select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Revenue</span>
                    {sortBy === 'revenue_amount' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-primary" />
                      ))}
                  </div>
                </th>

                <th
                  scope="col"
                  onClick={() => handleHeaderSort('roi')}
                  className="py-3 px-4 text-right cursor-pointer hover:bg-surface-container-high transition select-none"
                  data-testid="header-roi"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>ROI</span>
                    {sortBy === 'roi' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-primary" />
                      ))}
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-surface-dim bg-white">
              {processedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-500 text-xs">
                    No acquisition channel records found matching the current filters.
                  </td>
                </tr>
              ) : (
                processedData.map((item, idx) => {
                  const scoreMeta = getQualityScoreMeta(item.quality_score);
                  const formattedRoi = formatROI(
                    item.roi,
                    item.spend_amount,
                    item.revenue_amount
                  );

                  return (
                    <tr
                      key={item.channel_id || `channel-${idx}`}
                      className="hover:bg-surface/50 transition"
                      data-testid={`channel-row-${item.channel_id}`}
                    >
                      {/* Channel Name */}
                      <td className="py-3 px-4 font-medium text-neutral-900">
                        {item.channel_name}
                      </td>

                      {/* Attributed Leads */}
                      <td className="py-3 px-4 text-right text-neutral-800 font-mono">
                        {item.lead_count.toLocaleString()}
                      </td>

                      {/* Lead Quality Score [FR-002] */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900 min-w-[32px]">
                            {item.quality_score}
                          </span>
                          <div className="w-20 bg-neutral-200 h-2 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className={clsx('h-full transition-all', scoreMeta.barClass)}
                              style={{ width: `${Math.min(100, Math.max(0, item.quality_score))}%` }}
                            />
                          </div>
                          <span
                            className={clsx(
                              'px-2 py-0.5 text-[10px] font-semibold rounded border',
                              scoreMeta.badgeClass
                            )}
                          >
                            {scoreMeta.label}
                          </span>
                        </div>
                      </td>

                      {/* Spend Amount */}
                      <td className="py-3 px-4 text-right text-neutral-800 font-mono">
                        {formatCurrency(item.spend_amount)}
                      </td>

                      {/* Revenue Amount */}
                      <td className="py-3 px-4 text-right text-neutral-800 font-mono">
                        {formatCurrency(item.revenue_amount)}
                      </td>

                      {/* Calculated ROI [FR-003] */}
                      <td className="py-3 px-4 text-right">
                        <span
                          className={clsx(
                            'inline-block px-2 py-0.5 text-xs font-semibold rounded font-mono',
                            formattedRoi === 'N/A'
                              ? 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                              : formattedRoi.startsWith('-')
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          )}
                          data-testid={`roi-value-${item.channel_id}`}
                        >
                          {formattedRoi}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Aggregated Totals Footer Row */}
            {processedData.length > 0 && (
              <tfoot>
                <tr className="bg-surface-container/80 border-t-2 border-surface-dim font-semibold text-neutral-900">
                  <td className="py-3 px-4">Total / Average</td>
                  <td className="py-3 px-4 text-right font-mono">
                    {summary.totalLeads.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-neutral-700">
                      Avg: {summary.averageQualityScore} / 100
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatCurrency(summary.totalSpend)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatCurrency(summary.totalRevenue)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-primary">
                    {summary.overallROI}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

export default AcquisitionReport;
