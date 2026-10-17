'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Users,
  BarChart3,
  Headphones,
  CreditCard,
  RotateCw,
  AlertTriangle,
  X,
  PieChart,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import {
  DomainIdentifier,
  DomainQuickViewResponse,
  MetricResponse,
  BreakdownItemResponse,
  Timeframe,
  MetricStatus,
  MetricUnit,
} from '../../services/dashboard';
import { MetricCard, formatDomainName } from './MetricCard';
import { StatusLabel } from '../common/StatusLabel';

export interface DomainOptionMeta {
  id: DomainIdentifier;
  title: string;
  shortTitle: string;
  description: string;
  keyMetricsText: string;
  icon: React.ReactNode;
}

export const DOMAIN_OPTIONS: DomainOptionMeta[] = [
  {
    id: 'lead_gen',
    title: 'Lead Generation',
    shortTitle: 'Lead Gen',
    description: 'Volume, conversion rates, and acquisition channel breakdowns.',
    keyMetricsText: 'Lead Volume, Conversion Rates',
    icon: <Users className="w-5 h-5" aria-hidden="true" />,
  },
  {
    id: 'sales_pipeline',
    title: 'Sales Pipeline',
    shortTitle: 'Sales',
    description: 'Deal values, stage distribution, and win rates.',
    keyMetricsText: 'Deal Values, Stage Distribution',
    icon: <BarChart3 className="w-5 h-5" aria-hidden="true" />,
  },
  {
    id: 'support',
    title: 'Support Ticketing',
    shortTitle: 'Support',
    description: 'Open tickets, resolution times, and SLA compliance.',
    keyMetricsText: 'Open Tickets, Resolution Times, SLA Compliance',
    icon: <Headphones className="w-5 h-5" aria-hidden="true" />,
  },
  {
    id: 'financials',
    title: 'Financial Summaries',
    shortTitle: 'Financials',
    description: 'Recurring revenue, outstanding invoices, and billing ledgers.',
    keyMetricsText: 'Recurring Revenue, Outstanding Invoices',
    icon: <CreditCard className="w-5 h-5" aria-hidden="true" />,
  },
];

export interface QuickViewPanelProps {
  /**
   * Active domain identifier ('lead_gen' | 'sales_pipeline' | 'support' | 'financials')
   */
  domain?: DomainIdentifier | string;
  /**
   * Domain quick-view drilldown response payload
   */
  data?: DomainQuickViewResponse | null;
  /**
   * Loading state flag during asynchronous drilldown fetch
   */
  loading?: boolean;
  /**
   * Error message if domain drilldown fetch failed
   */
  error?: string | null;
  /**
   * Comparative period timeframe ('7d' | '30d' | '90d')
   */
  timeframe?: Timeframe | string;
  /**
   * Callback triggered when timeframe changes
   */
  onTimeframeChange?: (timeframe: any) => void;
  /**
   * Callback triggered when user switches domain tab
   */
  onDomainChange?: (domain: DomainIdentifier) => void;
  /**
   * Callback triggered when user clicks the retry button on domain error state
   */
  onRetry?: (domain?: string) => void;
  /**
   * Callback triggered when user clicks retry on an individual unavailable metric card
   */
  onMetricRetry?: (metricKey: string) => void;
  /**
   * Callback triggered when user clicks close button
   */
  onClose?: () => void;
  /**
   * Whether the panel is expanded (default: true)
   */
  isExpanded?: boolean;
  /**
   * Additional custom CSS class names
   */
  className?: string;
}

/**
 * Format numerical breakdown values according to domain context or label.
 */
export function formatBreakdownValue(
  val: number,
  domainId?: string,
  label?: string
): string {
  if (val === null || val === undefined || isNaN(val)) return '0';

  const labelLower = (label || '').toLowerCase();
  const domainLower = (domainId || '').toLowerCase();

  // If currency domain or label
  if (
    domainLower === 'financials' ||
    labelLower.includes('revenue') ||
    labelLower.includes('invoice') ||
    labelLower.includes('deal value') ||
    labelLower.includes('arr') ||
    labelLower.includes('mrr') ||
    labelLower.includes('amount') ||
    labelLower.includes('paid') ||
    labelLower.includes('pending') ||
    labelLower.includes('overdue')
  ) {
    if (val === 0) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: val % 1 === 0 ? 0 : 2,
    }).format(val);
  }

  // If percentage
  if (
    labelLower.includes('rate') ||
    labelLower.includes('percentage') ||
    labelLower.includes('sla') ||
    labelLower.includes('conversion')
  ) {
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}%`;
  }

  // Standard integer count formatting
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(val);
}

/**
 * Calculate distribution percentage relative to total breakdown sum.
 */
export function calculateBreakdownPercentage(
  val: number,
  items: BreakdownItemResponse[]
): number {
  if (!items || items.length === 0 || val === null || val === undefined || isNaN(val)) {
    return 0;
  }
  const total = items.reduce((acc, curr) => {
    const v = curr && typeof curr.value === 'number' && !isNaN(curr.value) ? curr.value : 0;
    return acc + v;
  }, 0);

  if (total === 0) return 0;
  const pct = (val / total) * 100;
  return Math.max(0, Math.min(100, pct));
}

/**
 * QuickViewPanel component for expanded domain metrics and distribution breakdowns (FR-6, FR-7, FR-8, FR-9).
 */
export function QuickViewPanel({
  domain,
  data,
  loading = false,
  error = null,
  timeframe = '30d',
  onDomainChange,
  onRetry,
  onMetricRetry,
  onClose,
  isExpanded = true,
  className,
}: QuickViewPanelProps) {
  // Normalize domain identifier
  const initialDomain: DomainIdentifier = useMemo(() => {
    if (typeof domain === 'string' && domain.trim()) {
      const cleaned = domain.trim().toLowerCase();
      if (
        cleaned === 'lead_gen' ||
        cleaned === 'sales_pipeline' ||
        cleaned === 'support' ||
        cleaned === 'financials'
      ) {
        return cleaned as DomainIdentifier;
      }
    }
    return 'lead_gen';
  }, [domain]);

  const [internalDomain, setInternalDomain] = useState<DomainIdentifier>(initialDomain);

  // Sync internal domain state if domain prop changes
  React.useEffect(() => {
    if (domain) {
      const cleaned = String(domain).trim().toLowerCase();
      if (
        cleaned === 'lead_gen' ||
        cleaned === 'sales_pipeline' ||
        cleaned === 'support' ||
        cleaned === 'financials'
      ) {
        setInternalDomain(cleaned as DomainIdentifier);
      }
    }
  }, [domain]);

  const activeDomain = domain ? initialDomain : internalDomain;

  const activeMeta = useMemo(() => {
    return (
      DOMAIN_OPTIONS.find((opt) => opt.id === activeDomain) || DOMAIN_OPTIONS[0]
    );
  }, [activeDomain]);

  const handleTabClick = useCallback(
    (domainId: DomainIdentifier) => {
      setInternalDomain(domainId);
      if (onDomainChange) {
        onDomainChange(domainId);
      }
    },
    [onDomainChange]
  );

  const handleRetryClick = useCallback(() => {
    if (onRetry) {
      onRetry(activeDomain);
    }
  }, [onRetry, activeDomain]);

  if (!isExpanded) {
    return null;
  }

  const isUnavailable =
    !loading &&
    (Boolean(error) ||
      data?.status === 'UNAVAILABLE' ||
      (data && data.status !== 'COMPLETE' && (!data.detailed_metrics || data.detailed_metrics.length === 0)));

  const detailedMetrics = data?.detailed_metrics || [];
  const breakdownItems = data?.breakdown_items || [];

  return (
    <section
      data-testid="quickview-panel"
      aria-label={`${activeMeta.title} Quick-View`}
      className={twMerge(
        'w-full bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg shadow-sm p-5 md:p-6 transition-all duration-200',
        className
      )}
    >
      {/* Domain Navigation Tabs */}
      <div
        data-testid="quickview-domain-tabs"
        role="tablist"
        aria-label="Domain quick-view selection"
        className="flex flex-wrap items-center gap-2 pb-4 mb-5 border-b border-[#d1c4b9]/60"
      >
        {DOMAIN_OPTIONS.map((opt) => {
          const isActive = activeDomain === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              data-testid={`quickview-tab-${opt.id}`}
              id={`quickview-tab-${opt.id}`}
              aria-selected={isActive}
              aria-controls={`quickview-content-${opt.id}`}
              onClick={() => handleTabClick(opt.id)}
              className={clsx(
                'inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:ring-offset-1',
                isActive
                  ? 'bg-[#59452b] text-white shadow-sm'
                  : 'bg-[#f5f3ee] text-[#4e453d] hover:bg-[#eae8e3] hover:text-[#1b1c19]'
              )}
            >
              <span className={clsx(isActive ? 'text-white' : 'text-[#59452b]')}>
                {opt.icon}
              </span>
              <span>{opt.shortTitle}</span>
            </button>
          );
        })}

        {onClose && (
          <button
            type="button"
            data-testid="quickview-close-btn"
            onClick={onClose}
            aria-label="Close Quick-View panel"
            className="ml-auto p-1.5 text-[#4e453d] hover:text-[#1b1c19] hover:bg-[#eae8e3] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Domain Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-[#f0eee9] text-[#59452b] rounded-lg border border-[#d1c4b9]/50">
            {activeMeta.icon}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2
                data-testid="quickview-title"
                className="text-xl font-serif font-normal text-[#1b1c19]"
              >
                {activeMeta.title}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-[#f5f3ee] text-[#4e453d] border border-[#d1c4b9]/60">
                {timeframe} Window
              </span>
            </div>
            <p
              data-testid="quickview-subtitle"
              className="text-sm text-[#4e453d] mt-0.5"
            >
              {activeMeta.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {loading ? (
            <StatusLabel status="pending" label="Fetching Data" />
          ) : isUnavailable ? (
            <StatusLabel status="failed" label="Domain Unavailable" />
          ) : (
            <StatusLabel status="active" label="Operational" />
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div
        id={`quickview-content-${activeDomain}`}
        role="tabpanel"
        aria-labelledby={`quickview-tab-${activeDomain}`}
      >
        {/* State 1: Loading */}
        {loading && (
          <div
            data-testid="quickview-loading"
            role="status"
            aria-busy="true"
            aria-live="polite"
            className="flex flex-col items-center justify-center py-12 px-4 bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg text-center"
          >
            <RotateCw className="w-8 h-8 text-[#735c41] animate-spin mb-3" aria-hidden="true" />
            <p className="text-base font-medium text-[#1b1c19]">
              Loading quick-view metrics for {activeMeta.title}...
            </p>
            <p className="text-xs text-[#4e453d] mt-1">
              Retrieving detailed domain telemetry and distribution breakdowns.
            </p>
          </div>
        )}

        {/* State 2: Error / Unavailable */}
        {!loading && isUnavailable && (
          <div
            data-testid="quickview-unavailable"
            role="alert"
            className="flex flex-col items-center justify-center p-6 bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded-lg text-center"
          >
            <AlertTriangle className="w-9 h-9 text-[#ba1a1a] mb-2" aria-hidden="true" />
            <h3 className="text-base font-semibold text-[#93000a]">
              {activeMeta.title} Quick-View Unavailable
            </h3>
            <p
              data-testid="quickview-error-detail"
              className="text-sm text-[#4e453d] max-w-md my-2"
            >
              {error ||
                data?.error_detail ||
                'Downstream connector service timed out or failed to return domain metrics.'}
            </p>
            {onRetry && (
              <button
                type="button"
                data-testid="quickview-retry-btn"
                onClick={handleRetryClick}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-[#59452b] hover:bg-[#735c41] text-white text-sm font-medium rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:ring-offset-1"
              >
                <RotateCw className="w-4 h-4" aria-hidden="true" />
                <span>Retry Domain Drilldown</span>
              </button>
            )}
          </div>
        )}

        {/* State 3: Complete Data Display */}
        {!loading && !isUnavailable && (
          <div className="space-y-6">
            {/* Section A: Key Metrics Cards Grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium tracking-wide uppercase text-[#59452b] font-sans">
                  Key Domain Metrics
                </h3>
                <span className="text-xs text-[#4e453d]">
                  {detailedMetrics.length} {detailedMetrics.length === 1 ? 'Metric' : 'Metrics'} Tracked
                </span>
              </div>

              {detailedMetrics.length > 0 ? (
                <div
                  data-testid="quickview-metrics-grid"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {detailedMetrics.map((metric, idx) => (
                    <div
                      key={metric.metric_key || `metric-${idx}`}
                      data-testid={`quickview-metric-card-${metric.metric_key || idx}`}
                    >
                      <MetricCard
                        metric={metric}
                        domain={activeDomain}
                        onRetry={onMetricRetry}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-md text-sm text-[#4e453d]">
                  No detailed metrics returned for {activeMeta.title}.
                </div>
              )}
            </div>

            {/* Section B: Distribution Breakdown */}
            <div data-testid="quickview-breakdown-section" className="pt-2 border-t border-[#d1c4b9]/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
                  <h3 className="text-sm font-medium tracking-wide uppercase text-[#59452b] font-sans">
                    Distribution Breakdown
                  </h3>
                </div>
                <span className="text-xs text-[#4e453d]">
                  Segment Totals &amp; Ratios
                </span>
              </div>

              {breakdownItems.length > 0 ? (
                <div className="space-y-3 bg-[#f5f3ee] border border-[#d1c4b9]/60 p-4 rounded-lg">
                  {breakdownItems.map((item, index) => {
                    const percentage = calculateBreakdownPercentage(item.value, breakdownItems);
                    const formattedVal = formatBreakdownValue(
                      item.value,
                      activeDomain,
                      item.label
                    );

                    return (
                      <div
                        key={`${item.label}-${index}`}
                        data-testid={`quickview-breakdown-item-${index}`}
                        className="space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span
                            data-testid="quickview-breakdown-label"
                            className="font-medium text-[#1b1c19] truncate pr-2"
                          >
                            {item.label}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              data-testid="quickview-breakdown-value"
                              className="font-mono text-xs font-semibold text-[#1b1c19]"
                            >
                              {formattedVal}
                            </span>
                            <span
                              data-testid="quickview-breakdown-percentage"
                              className="text-xs text-[#4e453d] font-mono min-w-[3rem] text-right"
                            >
                              {percentage % 1 === 0 ? percentage.toFixed(0) : percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Distribution Visual Bar */}
                        <div className="w-full h-2 bg-[#eae8e3] rounded-full overflow-hidden border border-[#d1c4b9]/30">
                          <div
                            data-testid="quickview-breakdown-bar"
                            className="h-full bg-[#735c41] rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${percentage}%` }}
                            role="progressbar"
                            aria-valuenow={percentage}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${item.label}: ${formattedVal} (${percentage.toFixed(1)}%)`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  data-testid="quickview-breakdown-empty"
                  className="p-4 bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-md text-sm text-[#4e453d]"
                >
                  No distribution breakdown data available for {activeMeta.title}.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default QuickViewPanel;
