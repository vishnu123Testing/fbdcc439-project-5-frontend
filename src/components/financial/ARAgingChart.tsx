'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Clock,
  DollarSign,
  AlertCircle,
  RotateCw,
  TrendingUp,
  BarChart2,
  Table as TableIcon,
  CheckCircle2,
  ShieldCheck,
  Filter,
  Download,
  Info,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  getARAgingMetrics,
  getARAgingSummary,
  ARAgingSummaryResponse,
  ARAgingBucketResponse,
  ARAgingQueryParams,
} from '../../services/financial';

/**
 * View display modes supported by the AR aging chart.
 */
export type ViewMode = 'visual' | 'table';

/**
 * Risk classification levels for duration buckets.
 */
export type RiskTier = 'low' | 'moderate' | 'high' | 'critical';

/**
 * Metadata styling and labeling properties for an aging bucket.
 */
export interface BucketMeta {
  key: string; // "0-30", "31-60", "61-90", "90+"
  title: string;
  riskLabel: string;
  tier: RiskTier;
  description: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  badgeClass: string;
  barColor: string;
  barBgColor: string;
}

/**
 * Normalized bucket model for display and calculation.
 */
export interface ARAgingProcessedBucket {
  key: string;
  name: string;
  amount: number;
  count: number;
  percentage: number;
  meta: BucketMeta;
  raw: ARAgingBucketResponse;
}

/**
 * Props for the ARAgingChart component.
 */
export interface ARAgingChartProps {
  /**
   * Pre-fetched AR aging summary data object [FR-4]
   */
  initialData?: ARAgingSummaryResponse | null;
  /**
   * Alias for initialData
   */
  data?: ARAgingSummaryResponse | null;
  /**
   * Initial filter parameters (customer_id, as_of_date_time)
   */
  initialParams?: ARAgingQueryParams;
  /**
   * Optional loading state override from parent
   */
  loading?: boolean;
  /**
   * Optional error message override from parent
   */
  error?: string | null;
  /**
   * Callback fired when user triggers refresh or parameter changes
   */
  onRefresh?: (params?: ARAgingQueryParams) => void;
  /**
   * Callback fired when user selects or clicks an aging bucket card
   */
  onSelectBucket?: (bucketName: string, bucketData: ARAgingBucketResponse) => void;
  /**
   * Callback fired when user exports CSV or PDF report
   */
  onExport?: (format: 'csv' | 'pdf') => void;
  /**
   * Whether to auto-fetch data on mount when initialData/data is not provided
   */
  autoFetch?: boolean;
  /**
   * Custom title for the card header
   */
  title?: string;
  /**
   * Filter specifically for a given customer UUID
   */
  customerId?: string;
  /**
   * Additional CSS class names
   */
  className?: string;
}

/**
 * Format raw numeric values into formatted USD currency strings ($12,345.67).
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
 * Format numeric ratios/percentages into string representation (e.g. 45.2%).
 */
export function formatPercentage(value?: number | null): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.0%';
  }
  const clamped = Math.max(0, value);
  return `${clamped.toFixed(1)}%`;
}

/**
 * Calculate bucket percentage relative to total outstanding balance.
 */
export function calculateBucketPercentage(
  bucketAmount?: number | null,
  totalAmount?: number | null
): number {
  if (!bucketAmount || !totalAmount || totalAmount <= 0) {
    return 0;
  }
  const pct = (bucketAmount / totalAmount) * 100;
  return Math.min(100, Math.max(0, pct));
}

/**
 * Determine if an AR aging summary contains zero outstanding balances and zero invoices.
 */
export function isSummaryEmpty(summary?: ARAgingSummaryResponse | null): boolean {
  if (!summary) return true;
  const totalAmount = summary.total_outstanding ?? 0;
  const totalInvoices = summary.total_invoices ?? 0;
  if (totalAmount > 0 || totalInvoices > 0) return false;

  const b0 = summary.bucket_0_30?.total_amount ?? 0;
  const b31 = summary.bucket_31_60?.total_amount ?? 0;
  const b61 = summary.bucket_61_90?.total_amount ?? 0;
  const b90 = summary.bucket_90_plus?.total_amount ?? 0;

  return b0 === 0 && b31 === 0 && b61 === 0 && b90 === 0;
}

/**
 * Get styling, risk labeling, and metadata for a duration bucket key.
 */
export function getBucketMeta(bucketKey: string): BucketMeta {
  const normalized = (bucketKey || '').trim().toLowerCase();

  if (normalized.includes('0') && normalized.includes('30')) {
    return {
      key: '0-30',
      title: '0-30 Days',
      riskLabel: 'Current / Low Risk',
      tier: 'low',
      description: 'Current invoices due within 30 days or newly billed',
      bgClass: 'bg-emerald-50/70',
      textClass: 'text-emerald-950',
      borderClass: 'border-emerald-200',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      barColor: 'bg-emerald-600',
      barBgColor: 'bg-emerald-100',
    };
  }

  if (
    normalized.includes('31') ||
    (normalized.includes('30') && normalized.includes('60'))
  ) {
    return {
      key: '31-60',
      title: '31-60 Days',
      riskLabel: 'Moderate Overdue',
      tier: 'moderate',
      description: 'Invoices past due by 31 to 60 days',
      bgClass: 'bg-amber-50/70',
      textClass: 'text-amber-950',
      borderClass: 'border-amber-200',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      barColor: 'bg-amber-600',
      barBgColor: 'bg-amber-100',
    };
  }

  if (
    normalized.includes('61') ||
    (normalized.includes('60') && normalized.includes('90'))
  ) {
    return {
      key: '61-90',
      title: '61-90 Days',
      riskLabel: 'High Overdue',
      tier: 'high',
      description: 'Invoices past due by 61 to 90 days',
      bgClass: 'bg-orange-50/70',
      textClass: 'text-orange-950',
      borderClass: 'border-orange-200',
      badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
      barColor: 'bg-orange-600',
      barBgColor: 'bg-orange-100',
    };
  }

  // 90+ Days
  return {
    key: '90+',
    title: '90+ Days',
    riskLabel: 'Critical Overdue',
    tier: 'critical',
    description: 'Invoices severely overdue by more than 90 days',
    bgClass: 'bg-red-50/70',
    textClass: 'text-red-950',
    borderClass: 'border-red-200',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    barColor: 'bg-red-600',
    barBgColor: 'bg-red-100',
  };
}

/**
 * Process an AR aging summary into an array of 4 bucket structures (0-30, 31-60, 61-90, 90+).
 */
export function getBucketsList(
  summary?: ARAgingSummaryResponse | null
): ARAgingProcessedBucket[] {
  const total = summary?.total_outstanding ?? 0;

  const fallbackBucket = (name: string): ARAgingBucketResponse => ({
    bucket_name: name,
    total_amount: 0,
    invoice_count: 0,
  });

  const b0 = summary?.bucket_0_30 || fallbackBucket('0-30');
  const b31 = summary?.bucket_31_60 || fallbackBucket('31-60');
  const b61 = summary?.bucket_61_90 || fallbackBucket('61-90');
  const b90 = summary?.bucket_90_plus || fallbackBucket('90+');

  const rawList = [
    { key: '0-30', data: b0 },
    { key: '31-60', data: b31 },
    { key: '61-90', data: b61 },
    { key: '90+', data: b90 },
  ];

  return rawList.map(({ key, data }) => {
    const amount = data.total_amount ?? 0;
    const count = data.invoice_count ?? 0;
    const percentage = calculateBucketPercentage(amount, total);
    const meta = getBucketMeta(key);

    return {
      key,
      name: data.bucket_name || key,
      amount,
      count,
      percentage,
      meta,
      raw: data,
    };
  });
}

/**
 * ARAgingChart visual component rendering 0-30, 31-60, 61-90, and 90+ day duration buckets
 * with zero-data empty state support [FR-4].
 */
export const ARAgingChart: React.FC<ARAgingChartProps> = ({
  initialData,
  data,
  initialParams,
  loading: externalLoading,
  error: externalError,
  onRefresh,
  onSelectBucket,
  onExport,
  autoFetch = true,
  title = 'Accounts Receivable (AR) Aging',
  customerId,
  className,
}) => {
  const effectiveInitialData = useMemo(() => initialData || data || null, [initialData, data]);

  const [summaryData, setSummaryData] = useState<ARAgingSummaryResponse | null>(
    effectiveInitialData
  );
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const [filterCustomerId, setFilterCustomerId] = useState<string>(
    customerId || initialParams?.customer_id || ''
  );
  const [asOfDate, setAsOfDate] = useState<string>(
    initialParams?.as_of_date_time || ''
  );
  const [viewMode, setViewMode] = useState<ViewMode>('visual');
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);

  // Sync external props when changed
  useEffect(() => {
    if (effectiveInitialData !== undefined) {
      setSummaryData(effectiveInitialData);
    }
  }, [effectiveInitialData]);

  useEffect(() => {
    if (customerId !== undefined) {
      setFilterCustomerId(customerId);
    }
  }, [customerId]);

  const isLoading = externalLoading ?? internalLoading;
  const errorMessage = externalError ?? internalError;

  /**
   * Fetch AR aging data from financial service wrapper [FR-4].
   */
  const fetchData = useCallback(
    async (paramsToUse?: ARAgingQueryParams) => {
      setInternalLoading(true);
      setInternalError(null);

      const queryParams: ARAgingQueryParams = paramsToUse || {
        customer_id: filterCustomerId || undefined,
        as_of_date_time: asOfDate || undefined,
      };

      try {
        const res = await getARAgingMetrics(queryParams);
        setSummaryData(res);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to retrieve Accounts Receivable aging metrics.';
        setInternalError(msg);
      } finally {
        setInternalLoading(false);
      }
    },
    [filterCustomerId, asOfDate]
  );

  // Auto-fetch data if missing
  useEffect(() => {
    if (autoFetch && !effectiveInitialData && !summaryData) {
      fetchData();
    }
  }, [autoFetch, effectiveInitialData, summaryData, fetchData]);

  /**
   * Handle user refresh action.
   */
  const handleRefreshClick = useCallback(() => {
    const params: ARAgingQueryParams = {
      customer_id: filterCustomerId || undefined,
      as_of_date_time: asOfDate || undefined,
    };
    if (onRefresh) {
      onRefresh(params);
    }
    fetchData(params);
  }, [filterCustomerId, asOfDate, onRefresh, fetchData]);

  /**
   * Handle selecting an individual duration bucket.
   */
  const handleBucketClick = useCallback(
    (bucket: ARAgingProcessedBucket) => {
      setSelectedBucketKey(bucket.key);
      if (onSelectBucket) {
        onSelectBucket(bucket.name, bucket.raw);
      }
    },
    [onSelectBucket]
  );

  const emptyState = useMemo(() => isSummaryEmpty(summaryData), [summaryData]);
  const processedBuckets = useMemo(() => getBucketsList(summaryData), [summaryData]);

  const totalOutstanding = summaryData?.total_outstanding ?? 0;
  const totalInvoices = summaryData?.total_invoices ?? 0;

  // High risk overdue total (61-90 and 90+)
  const highRiskTotal = useMemo(() => {
    if (!summaryData) return 0;
    const b61 = summaryData.bucket_61_90?.total_amount ?? 0;
    const b90 = summaryData.bucket_90_plus?.total_amount ?? 0;
    return b61 + b90;
  }, [summaryData]);

  // Current rate (% of AR in 0-30 bucket)
  const currentRatio = useMemo(() => {
    if (!summaryData || totalOutstanding <= 0) return 0;
    const b0 = summaryData.bucket_0_30?.total_amount ?? 0;
    return (b0 / totalOutstanding) * 100;
  }, [summaryData, totalOutstanding]);

  const formattedAsOf = useMemo(() => {
    const rawDate = summaryData?.as_of_date_time || asOfDate;
    if (!rawDate) return 'Current';
    try {
      const parsed = new Date(rawDate);
      if (isNaN(parsed.getTime())) return rawDate;
      return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return rawDate;
    }
  }, [summaryData, asOfDate]);

  return (
    <div
      className={twMerge(
        'w-full rounded-lg border border-[#E3DED1] bg-[#fbf9f4] p-5 shadow-sm text-[#1b1c19]',
        className
      )}
      data-testid="ar-aging-chart"
      role="region"
      aria-label="Accounts Receivable Aging Chart"
    >
      {/* Card Header & Controls Toolbar */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E3DED1] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#59452b]" aria-hidden="true" />
            <h2 className="font-serif text-xl font-normal tracking-tight text-[#1b1c19]">
              {title}
            </h2>
          </div>
          <p className="mt-1 text-xs text-[#4e453d] font-sans">
            Segmented balance analysis across 0–30, 31–60, 61–90, and 90+ day aging duration buckets.
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* As Of Date Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[#f0eee9] px-2.5 py-1 text-xs text-[#4e453d] border border-[#d1c4b9]">
            <Calendar className="h-3.5 w-3.5 text-[#59452b]" aria-hidden="true" />
            <span>As of: <strong>{formattedAsOf}</strong></span>
          </div>

          {/* Customer Filter Indicator */}
          {filterCustomerId && (
            <div className="inline-flex items-center gap-1 rounded-md bg-[#eae8e3] px-2.5 py-1 text-xs text-[#59452b] border border-[#d1c4b9]">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate max-w-[120px]">Cust: {filterCustomerId}</span>
            </div>
          )}

          {/* View Mode Toggle Button */}
          <div className="flex items-center rounded-md border border-[#d1c4b9] bg-[#f0eee9] p-0.5" role="group" aria-label="Chart view mode">
            <button
              type="button"
              onClick={() => setViewMode('visual')}
              className={clsx(
                'flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
                viewMode === 'visual'
                  ? 'bg-[#ffffff] text-[#59452b] shadow-xs'
                  : 'text-[#4e453d] hover:text-[#1b1c19]'
              )}
              aria-label="Visual view"
              aria-pressed={viewMode === 'visual'}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Visual</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={clsx(
                'flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
                viewMode === 'table'
                  ? 'bg-[#ffffff] text-[#59452b] shadow-xs'
                  : 'text-[#4e453d] hover:text-[#1b1c19]'
              )}
              aria-label="Table view"
              aria-pressed={viewMode === 'table'}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Table</span>
            </button>
          </div>

          {/* Export Dropdown / Button */}
          {onExport && (
            <button
              type="button"
              onClick={() => onExport('csv')}
              className="inline-flex items-center gap-1 rounded-md border border-[#d1c4b9] bg-[#ffffff] px-2.5 py-1 text-xs font-medium text-[#4e453d] hover:bg-[#f5f3ee] hover:text-[#1b1c19] transition-colors"
              aria-label="Export AR aging data"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={isLoading}
            className="inline-flex items-center gap-1 rounded-md bg-[#59452b] px-3 py-1 text-xs font-medium text-[#ffffff] hover:bg-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#59452b] focus:ring-offset-1 disabled:opacity-50 transition-colors"
            aria-label="Refresh AR aging metrics"
          >
            <RotateCw className={clsx('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Message Alert */}
      {errorMessage && (
        <div
          className="mb-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900"
          role="alert"
          data-testid="ar-aging-error"
        >
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold">Unable to load AR aging metrics</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={handleRefreshClick}
            className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div
          className="space-y-4 animate-pulse"
          data-testid="ar-aging-loading-skeleton"
          aria-live="polite"
          aria-busy="true"
        >
          {/* Summary KPIs Skeleton */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-md bg-[#eae8e3]" />
            ))}
          </div>

          {/* Stacked Progress Bar Skeleton */}
          <div className="h-6 w-full rounded-md bg-[#eae8e3]" />

          {/* Bucket Cards Grid Skeleton */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-36 rounded-md bg-[#eae8e3]" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Top KPI Metrics Overview */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="ar-aging-kpis">
            {/* Total Outstanding */}
            <div className="rounded-md border border-[#d1c4b9] bg-[#ffffff] p-3 shadow-2xs">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#4e453d] block">
                Total Outstanding
              </span>
              <span className="mt-1 block font-serif text-lg sm:text-xl font-normal text-[#1b1c19]">
                {formatCurrency(totalOutstanding)}
              </span>
              <span className="mt-0.5 block text-[11px] text-[#80756b]">
                {totalInvoices} outstanding {totalInvoices === 1 ? 'invoice' : 'invoices'}
              </span>
            </div>

            {/* Current % (0-30 days) */}
            <div className="rounded-md border border-[#d1c4b9] bg-[#ffffff] p-3 shadow-2xs">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#4e453d] block">
                Current Rate (0-30d)
              </span>
              <span className="mt-1 block font-serif text-lg sm:text-xl font-normal text-emerald-800">
                {formatPercentage(currentRatio)}
              </span>
              <span className="mt-0.5 block text-[11px] text-[#80756b]">
                {formatCurrency(summaryData?.bucket_0_30?.total_amount ?? 0)} current
              </span>
            </div>

            {/* Critical Overdue (60+ days) */}
            <div className="rounded-md border border-[#d1c4b9] bg-[#ffffff] p-3 shadow-2xs">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#4e453d] block">
                Severe Overdue (60d+)
              </span>
              <span className={clsx(
                'mt-1 block font-serif text-lg sm:text-xl font-normal',
                highRiskTotal > 0 ? 'text-red-700' : 'text-[#1b1c19]'
              )}>
                {formatCurrency(highRiskTotal)}
              </span>
              <span className="mt-0.5 block text-[11px] text-[#80756b]">
                61-90d & 90+ buckets
              </span>
            </div>

            {/* Total Invoices Count */}
            <div className="rounded-md border border-[#d1c4b9] bg-[#ffffff] p-3 shadow-2xs">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#4e453d] block">
                Active Invoices
              </span>
              <span className="mt-1 block font-serif text-lg sm:text-xl font-normal text-[#1b1c19]">
                {totalInvoices}
              </span>
              <span className="mt-0.5 block text-[11px] text-[#80756b]">
                Across all 4 duration buckets
              </span>
            </div>
          </div>

          {/* Zero-Data Empty State Banner */}
          {emptyState && (
            <div
              className="mb-5 flex flex-col items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50/50 p-6 text-center shadow-2xs"
              data-testid="ar-aging-empty-state"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mb-3">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="font-serif text-lg font-normal text-emerald-950">
                No Outstanding Accounts Receivable
              </h3>
              <p className="mt-1 max-w-md text-xs text-emerald-800">
                All customer accounts are up to date with zero outstanding balances ($0.00) across all aging duration buckets.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshClick}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-[#ffffff] hover:bg-emerald-800 transition-colors"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>Refresh Data</span>
                </button>
              </div>
            </div>
          )}

          {/* Segmented Proportion Bar (Visual Stacked AR Aging Distribution Bar) */}
          <div className="mb-6 rounded-md border border-[#d1c4b9] bg-[#ffffff] p-4 shadow-2xs">
            <div className="mb-2 flex items-center justify-between text-xs text-[#4e453d]">
              <span className="font-medium uppercase tracking-wider text-[11px]">
                AR Aging Proportion Distribution
              </span>
              <span>Total: <strong>{formatCurrency(totalOutstanding)}</strong></span>
            </div>

            {/* Proportion Bar Track */}
            <div
              className="flex h-5 w-full overflow-hidden rounded-md bg-[#eae8e3] p-0.5"
              role="progressbar"
              aria-label="AR aging duration bucket distribution"
              aria-valuenow={Math.round(totalOutstanding)}
              aria-valuemin={0}
              aria-valuemax={Math.max(1, totalOutstanding)}
            >
              {emptyState ? (
                <div className="flex h-full w-full items-center justify-center bg-[#e4e2dd] text-[10px] text-[#80756b]">
                  0.0% Outstanding Across Buckets
                </div>
              ) : (
                processedBuckets.map((bucket) => {
                  if (bucket.percentage <= 0) return null;
                  return (
                    <div
                      key={bucket.key}
                      style={{ width: `${bucket.percentage}%` }}
                      className={clsx(
                        'h-full transition-all duration-300 first:rounded-l-sm last:rounded-r-sm',
                        bucket.meta.barColor
                      )}
                      title={`${bucket.meta.title}: ${formatCurrency(bucket.amount)} (${formatPercentage(bucket.percentage)})`}
                    />
                  );
                })
              )}
            </div>

            {/* Legend Below Proportion Bar */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              {processedBuckets.map((bucket) => (
                <div key={bucket.key} className="flex items-center gap-1.5">
                  <span
                    className={clsx('h-2.5 w-2.5 rounded-full', bucket.meta.barColor)}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-[#1b1c19]">{bucket.meta.title}:</span>
                  <span className="text-[#4e453d]">
                    {formatCurrency(bucket.amount)} ({formatPercentage(bucket.percentage)})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Render Mode: Visual Duration Bucket Cards vs Table View */}
          {viewMode === 'visual' ? (
            /* 4-Duration Bucket Cards Grid [FR-4: 0-30, 31-60, 61-90, 90+] */
            <div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
              data-testid="ar-aging-bucket-grid"
            >
              {processedBuckets.map((bucket) => {
                const isSelected = selectedBucketKey === bucket.key;

                return (
                  <div
                    key={bucket.key}
                    onClick={() => handleBucketClick(bucket)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleBucketClick(bucket);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`AR Aging Bucket ${bucket.meta.title}, Total ${formatCurrency(bucket.amount)}, ${bucket.count} invoices`}
                    aria-pressed={isSelected}
                    data-testid={`ar-aging-bucket-${bucket.key}`}
                    className={clsx(
                      'group relative flex flex-col justify-between rounded-lg border p-4 transition-all duration-200 cursor-pointer outline-none focus:ring-2 focus:ring-[#59452b]',
                      bucket.meta.bgClass,
                      bucket.meta.borderClass,
                      isSelected ? 'ring-2 ring-[#59452b] shadow-md' : 'hover:shadow-sm'
                    )}
                  >
                    {/* Card Top Header */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-serif text-base font-medium text-[#1b1c19]">
                          {bucket.meta.title}
                        </span>
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border',
                            bucket.meta.badgeClass
                          )}
                        >
                          {bucket.meta.riskLabel}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-[#4e453d] line-clamp-1 mb-3">
                        {bucket.meta.description}
                      </p>

                      {/* Main Outstanding Amount */}
                      <div className="mb-2">
                        <span className="text-xs text-[#80756b] block">Outstanding Amount</span>
                        <span
                          className={clsx(
                            'font-serif text-2xl font-normal tracking-tight',
                            bucket.meta.textClass
                          )}
                        >
                          {formatCurrency(bucket.amount)}
                        </span>
                      </div>
                    </div>

                    {/* Card Bottom Progress & Counts */}
                    <div className="mt-4 border-t border-black/5 pt-3">
                      <div className="flex items-center justify-between text-xs text-[#4e453d] mb-1.5">
                        <span>{bucket.count} {bucket.count === 1 ? 'invoice' : 'invoices'}</span>
                        <span className="font-semibold text-[#1b1c19]">
                          {formatPercentage(bucket.percentage)}
                        </span>
                      </div>

                      {/* Individual Bucket Progress Bar */}
                      <div className={clsx('h-2 w-full overflow-hidden rounded-full', bucket.meta.barBgColor)}>
                        <div
                          style={{ width: `${Math.max(0, Math.min(100, bucket.percentage))}%` }}
                          className={clsx('h-full rounded-full transition-all duration-300', bucket.meta.barColor)}
                          role="progressbar"
                          aria-valuenow={Math.round(bucket.percentage)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${bucket.meta.title} percentage of total AR`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View Breakdown */
            <div className="overflow-x-auto rounded-lg border border-[#d1c4b9] bg-[#ffffff] shadow-2xs" data-testid="ar-aging-table-view">
              <table className="w-full text-left text-xs text-[#1b1c19]">
                <thead className="bg-[#f0eee9] text-[11px] font-medium uppercase tracking-wider text-[#4e453d] border-b border-[#d1c4b9]">
                  <tr>
                    <th scope="col" className="px-4 py-3">Aging Duration Bucket</th>
                    <th scope="col" className="px-4 py-3">Risk Tier</th>
                    <th scope="col" className="px-4 py-3 text-right">Invoice Count</th>
                    <th scope="col" className="px-4 py-3 text-right">Outstanding Amount</th>
                    <th scope="col" className="px-4 py-3 text-right">% of Total AR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eae8e3]">
                  {processedBuckets.map((bucket) => (
                    <tr
                      key={bucket.key}
                      onClick={() => handleBucketClick(bucket)}
                      className="hover:bg-[#f5f3ee] cursor-pointer transition-colors"
                      data-testid={`ar-aging-row-${bucket.key}`}
                    >
                      <td className="px-4 py-3 font-medium text-[#1b1c19]">
                        <div className="flex items-center gap-2">
                          <span className={clsx('h-2.5 w-2.5 rounded-full', bucket.meta.barColor)} aria-hidden="true" />
                          <span>{bucket.meta.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border', bucket.meta.badgeClass)}>
                          {bucket.meta.riskLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#4e453d]">
                        {bucket.count}
                      </td>
                      <td className="px-4 py-3 text-right font-serif font-medium text-[#1b1c19]">
                        {formatCurrency(bucket.amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#4e453d]">
                        {formatPercentage(bucket.percentage)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#f5f3ee] font-semibold border-t border-[#d1c4b9]">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-[#1b1c19]">Total Accounts Receivable</td>
                    <td className="px-4 py-3 text-right font-mono text-[#1b1c19]">{totalInvoices}</td>
                    <td className="px-4 py-3 text-right font-serif text-[#1b1c19]">{formatCurrency(totalOutstanding)}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#1b1c19]">100.0%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ARAgingChart;
