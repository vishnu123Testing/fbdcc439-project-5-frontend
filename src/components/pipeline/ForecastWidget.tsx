'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Sparkles,
  TrendingUp,
  Calendar,
  AlertCircle,
  Clock,
  RefreshCw,
  HelpCircle,
  DatabaseZap,
  CheckCircle2,
  Info,
  ShieldAlert,
} from 'lucide-react';
import {
  ForecastResponse,
  ForecastStatus,
  getForecast,
  recalculateForecast,
  sanitizeForecast,
} from '../../services/deals';
import { StatusLabel } from '../common/StatusLabel';

export interface ForecastWidgetProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onError'> {
  /**
   * The deal ID for which the completion forecast is rendered [FR-8, FR-9]
   */
  dealId: string;
  /**
   * Optional initial or pre-loaded forecast data payload
   */
  initialData?: ForecastResponse | null;
  /**
   * Custom widget heading title (defaults to "AI Completion Forecast")
   */
  title?: string;
  /**
   * Whether to fetch forecast automatically on mount or dealId change (defaults to true)
   */
  autoFetch?: boolean;
  /**
   * Whether to render the recalculate action button (defaults to true)
   */
  showRecalculateButton?: boolean;
  /**
   * Compact view layout mode for small card containers
   */
  compact?: boolean;
  /**
   * Callback triggered when forecast dataset is updated or recalculated
   */
  onUpdate?: (forecast: ForecastResponse) => void;
  /**
   * Callback triggered when an API error occurs
   */
  onError?: (error: Error) => void;
  /**
   * Additional CSS class names
   */
  className?: string;
}

export interface ConfidenceRating {
  label: string;
  variant: 'success' | 'warning' | 'info' | 'neutral' | 'error';
  ratingLevel: 'High' | 'Moderate' | 'Low' | 'Insufficient';
  barColorClass: string;
  badgeBgClass: string;
  badgeTextClass: string;
}

export interface ForecastStatusMeta {
  title: string;
  description: string;
  badgeLabel: string;
  variant: 'success' | 'warning' | 'info' | 'neutral' | 'error';
  isReady: boolean;
  isSparse: boolean;
  isComputing: boolean;
  isFailed: boolean;
}

/**
 * Helper to format estimated completion/close date into a readable string [FR-8].
 */
export function formatEstimatedCloseDate(dateVal?: string | null): string {
  if (!dateVal || typeof dateVal !== 'string' || !dateVal.trim()) {
    return 'Not estimated';
  }
  const cleanStr = dateVal.trim();
  const dateObj = new Date(cleanStr);
  if (isNaN(dateObj.getTime())) {
    return 'Not estimated';
  }
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Helper to format confidence percentage score into clean display string [FR-9].
 */
export function formatConfidenceScore(scorePct?: number | null): string {
  if (scorePct === null || scorePct === undefined || isNaN(scorePct)) {
    return 'N/A';
  }
  const rounded = Math.min(100, Math.max(0, Math.round(scorePct * 10) / 10));
  return `${rounded}%`;
}

/**
 * Helper to determine confidence level rating and WCAG compliant badge styling [FR-9].
 */
export function getConfidenceRating(
  scorePct?: number | null,
  statusCode?: string
): ConfidenceRating {
  const code = (statusCode || '').trim().toUpperCase();
  if (
    code === 'INSUFFICIENT_DATA' ||
    scorePct === null ||
    scorePct === undefined ||
    isNaN(scorePct)
  ) {
    return {
      label: 'Insufficient Data',
      variant: 'neutral',
      ratingLevel: 'Insufficient',
      barColorClass: 'bg-stone-300',
      badgeBgClass: 'bg-stone-100',
      badgeTextClass: 'text-stone-700',
    };
  }

  const score = Math.max(0, Math.min(100, scorePct));

  if (score >= 75) {
    return {
      label: 'High Confidence',
      variant: 'success',
      ratingLevel: 'High',
      barColorClass: 'bg-emerald-600',
      badgeBgClass: 'bg-emerald-50/90',
      badgeTextClass: 'text-emerald-900',
    };
  } else if (score >= 50) {
    return {
      label: 'Moderate Confidence',
      variant: 'warning',
      ratingLevel: 'Moderate',
      barColorClass: 'bg-amber-500',
      badgeBgClass: 'bg-amber-50/90',
      badgeTextClass: 'text-amber-900',
    };
  } else {
    return {
      label: 'Low Confidence',
      variant: 'error',
      ratingLevel: 'Low',
      barColorClass: 'bg-rose-500',
      badgeBgClass: 'bg-rose-50/90',
      badgeTextClass: 'text-rose-900',
    };
  }
}

/**
 * Helper to format last calculated timestamp into human readable relative duration.
 */
export function formatLastCalculated(timestampStr?: string | null): string {
  if (!timestampStr || typeof timestampStr !== 'string' || !timestampStr.trim()) {
    return 'Never calculated';
  }
  const dateObj = new Date(timestampStr.trim());
  if (isNaN(dateObj.getTime())) {
    return 'Never calculated';
  }
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (diffSec < 10) {
    return 'Just now';
  } else if (diffSec < 60) {
    return `${diffSec}s ago`;
  } else if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return `${mins}m ago`;
  } else if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `${hours}h ago`;
  }

  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Helper to categorize status metadata for AI forecast states [FR-8, FR-9].
 */
export function getForecastStatusMeta(
  statusCode?: string,
  isSparseFlag?: boolean
): ForecastStatusMeta {
  const code = (statusCode || '').trim().toUpperCase();

  if (code === 'INSUFFICIENT_DATA' || isSparseFlag) {
    return {
      title: 'Insufficient Data',
      description:
        'This deal lacks sufficient historical stage transitions and activity history to compute an AI completion forecast.',
      badgeLabel: 'Insufficient Data',
      variant: 'neutral',
      isReady: false,
      isSparse: true,
      isComputing: false,
      isFailed: false,
    };
  }

  if (code === 'COMPUTING') {
    return {
      title: 'Computing Forecast...',
      description: 'Evaluating CRM stage velocity and stakeholder activity signals.',
      badgeLabel: 'Computing',
      variant: 'info',
      isReady: false,
      isSparse: false,
      isComputing: true,
      isFailed: false,
    };
  }

  if (code === 'FAILED') {
    return {
      title: 'Calculation Failed',
      description: 'Unable to calculate AI forecast model. Please try recalculating.',
      badgeLabel: 'Failed',
      variant: 'error',
      isReady: false,
      isSparse: false,
      isComputing: false,
      isFailed: true,
    };
  }

  return {
    title: 'AI Forecast Ready',
    description: 'AI model estimated completion date and confidence score calculated successfully.',
    badgeLabel: 'Forecast Ready',
    variant: 'success',
    isReady: true,
    isSparse: false,
    isComputing: false,
    isFailed: false,
  };
}

/**
 * ForecastWidget component displaying AI-driven estimated close date, confidence score percentage,
 * or graceful insufficient data fallback status [FR-8, FR-9, NFR-2].
 */
export const ForecastWidget: React.FC<ForecastWidgetProps> = ({
  dealId,
  initialData = null,
  title = 'AI Completion Forecast',
  autoFetch = true,
  showRecalculateButton = true,
  compact = false,
  onUpdate,
  onError,
  className,
  ...restProps
}) => {
  const [forecast, setForecast] = useState<ForecastResponse | null>(() =>
    initialData ? sanitizeForecast(initialData) : null
  );
  const [isLoading, setIsLoading] = useState<boolean>(!initialData && autoFetch);
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [recalcTimeMs, setRecalcTimeMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync initialData prop if it changes
  useEffect(() => {
    if (initialData) {
      setForecast(sanitizeForecast(initialData));
    }
  }, [initialData]);

  // Fetch forecast data
  const fetchForecastData = useCallback(async () => {
    if (!dealId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getForecast(dealId);
      const sanitized = sanitizeForecast(data);
      setForecast(sanitized);
      if (onUpdate) {
        onUpdate(sanitized);
      }
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setErrorMessage(errorObj.message || 'Failed to load deal forecast data');
      if (onError) {
        onError(errorObj);
      }
    } finally {
      setIsLoading(false);
    }
  }, [dealId, onUpdate, onError]);

  // Initial fetch effect
  useEffect(() => {
    if (autoFetch && !initialData) {
      fetchForecastData();
    }
  }, [autoFetch, dealId, fetchForecastData, initialData]);

  // Recalculate forecast trigger [NFR-2]
  const handleRecalculate = async () => {
    if (!dealId || isRecalculating) return;
    setIsRecalculating(true);
    setErrorMessage(null);
    const startTimestamp = performance.now();
    try {
      const updated = await recalculateForecast(dealId);
      const elapsedMs = Math.round(performance.now() - startTimestamp);
      const sanitized = sanitizeForecast(updated);
      setForecast(sanitized);
      setRecalcTimeMs(elapsedMs);
      if (onUpdate) {
        onUpdate(sanitized);
      }
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setErrorMessage(errorObj.message || 'Forecast recalculation failed');
      if (onError) {
        onError(errorObj);
      }
    } finally {
      setIsRecalculating(false);
    }
  };

  // Derive status metadata and confidence rating
  const statusMeta = useMemo(() => {
    return getForecastStatusMeta(forecast?.status_code, forecast?.is_sparse);
  }, [forecast?.status_code, forecast?.is_sparse]);

  const confidenceRating = useMemo(() => {
    return getConfidenceRating(forecast?.confidence_score_pct, forecast?.status_code);
  }, [forecast?.confidence_score_pct, forecast?.status_code]);

  const closeDateFormatted = useMemo(() => {
    return formatEstimatedCloseDate(forecast?.estimated_completion_date);
  }, [forecast?.estimated_completion_date]);

  const confidenceScoreFormatted = useMemo(() => {
    return formatConfidenceScore(forecast?.confidence_score_pct);
  }, [forecast?.confidence_score_pct]);

  const lastCalculatedFormatted = useMemo(() => {
    return formatLastCalculated(forecast?.calculated_on);
  }, [forecast?.calculated_on]);

  // Container styling following Linen & Logic design system
  const containerClasses = twMerge(
    'relative overflow-hidden rounded-lg border border-[#c2b9a7]/60 bg-[#fbf9f4] p-5 shadow-sm transition-all duration-200 hover:border-[#735c41]/50',
    compact && 'p-3 text-sm',
    className
  );

  return (
    <div
      className={containerClasses}
      data-testid="forecast-widget"
      data-deal-id={dealId}
      {...restProps}
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#e3ded1] gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center p-2 rounded-md bg-[#f0eee9] text-[#59452b] border border-[#c2b9a7]/40 shrink-0">
            <Sparkles className="w-4 h-4 text-[#735c41]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="font-serif font-normal text-base text-[#1b1c19] truncate tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-[#4e453d] truncate">
              CRM sales intelligence predictive model
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {forecast && (
            <StatusLabel
              status={statusMeta.variant}
              label={confidenceRating.label}
              variant={statusMeta.variant}
            />
          )}

          {showRecalculateButton && (
            <button
              type="button"
              onClick={handleRecalculate}
              disabled={isLoading || isRecalculating}
              aria-label="Recalculate forecast"
              title="Recalculate AI forecast using latest CRM data [NFR-2]"
              className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[#c2b9a7]/60 bg-[#f5f3ee] text-[#59452b] transition-colors hover:bg-[#e3ded1] hover:text-[#1b1c19] focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
                isRecalculating && 'animate-pulse'
              )}
            >
              <RefreshCw
                className={clsx('w-3.5 h-3.5', isRecalculating && 'animate-spin text-[#735c41]')}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">
                {isRecalculating ? 'Calculating...' : 'Recalculate'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeleton State */}
      {isLoading && !forecast && (
        <div className="py-6 space-y-4 animate-pulse" data-testid="forecast-loading">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-[#e3ded1] rounded w-1/3"></div>
            <div className="h-4 bg-[#e3ded1] rounded w-1/4"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="h-20 bg-[#f0eee9] rounded-md border border-[#e3ded1]"></div>
            <div className="h-20 bg-[#f0eee9] rounded-md border border-[#e3ded1]"></div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="my-3 p-3 rounded-md bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-900 text-xs"
          data-testid="forecast-error"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-red-800">Forecast Error</p>
            <p className="mt-0.5 text-red-700 leading-relaxed">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={fetchForecastData}
            className="text-xs font-semibold text-red-800 underline hover:text-red-900 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {!isLoading && forecast && (
        <div className="pt-4 space-y-4" data-testid="forecast-content">
          {/* Sparse Data / Insufficient Data Graceful Banner [FR-9] */}
          {(statusMeta.isSparse || forecast.status_code === 'INSUFFICIENT_DATA') && (
            <div
              className="p-4 rounded-md border border-[#d1c4b9] bg-[#f5f3ee] text-[#1b1c19] space-y-3"
              data-testid="insufficient-data-view"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-[#e3ded1] text-[#735c41] shrink-0">
                  <DatabaseZap className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
                </div>
                <div>
                  <h4 className="font-medium text-sm text-[#1b1c19] flex items-center gap-1.5">
                    Insufficient Historical Data
                    <span className="inline-block px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded bg-[#e3ded1] text-[#4e453d]">
                      Sparse Record
                    </span>
                  </h4>
                  <p className="mt-1 text-xs text-[#4e453d] leading-relaxed">
                    {forecast.error_detail || statusMeta.description}
                  </p>
                </div>
              </div>

              {/* Metric Cards Placeholders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded border border-[#e3ded1] bg-white/60">
                  <span className="block text-[11px] font-medium tracking-wider uppercase text-[#80756b]">
                    Estimated Close Date
                  </span>
                  <span className="block mt-1 font-serif text-lg font-normal text-[#80756b]">
                    --
                  </span>
                  <span className="block mt-0.5 text-[10px] text-[#80756b]">
                    Awaiting CRM stage history
                  </span>
                </div>

                <div className="p-3 rounded border border-[#e3ded1] bg-white/60">
                  <span className="block text-[11px] font-medium tracking-wider uppercase text-[#80756b]">
                    Confidence Score
                  </span>
                  <span className="block mt-1 font-serif text-lg font-normal text-[#80756b]">
                    --
                  </span>
                  <span className="block mt-0.5 text-[10px] text-[#80756b]">
                    Minimum activity signals required
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-[#4e453d] pt-1">
                <Info className="w-3.5 h-3.5 text-[#735c41] shrink-0" aria-hidden="true" />
                <span>
                  Log stakeholder interactions or advance deal milestone stages to calculate AI close date.
                </span>
              </div>
            </div>
          )}

          {/* AI Forecast Ready Metrics Display [FR-8, FR-9] */}
          {statusMeta.isReady && (
            <div className="space-y-3" data-testid="forecast-ready-view">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Estimated Close Date Card [FR-8] */}
                <div
                  className="p-3.5 rounded-md border border-[#e3ded1] bg-white/80 shadow-2xs hover:border-[#735c41]/40 transition-colors"
                  data-testid="close-date-card"
                >
                  <div className="flex items-center justify-between text-[#80756b] mb-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[#4e453d]">
                      Estimated Close Date
                    </span>
                    <Calendar className="w-4 h-4 text-[#735c41]" aria-hidden="true" />
                  </div>
                  <div className="font-serif text-xl font-normal text-[#1b1c19] tracking-tight">
                    {closeDateFormatted}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-[#4e453d]">
                    <Clock className="w-3 h-3 text-[#80756b]" aria-hidden="true" />
                    <span>AI timeline projection</span>
                  </div>
                </div>

                {/* Confidence Percentage Card [FR-9] */}
                <div
                  className="p-3.5 rounded-md border border-[#e3ded1] bg-white/80 shadow-2xs hover:border-[#735c41]/40 transition-colors"
                  data-testid="confidence-card"
                >
                  <div className="flex items-center justify-between text-[#80756b] mb-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[#4e453d]">
                      Confidence Score
                    </span>
                    <TrendingUp className="w-4 h-4 text-[#735c41]" aria-hidden="true" />
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-serif text-xl font-normal text-[#1b1c19] tracking-tight">
                      {confidenceScoreFormatted}
                    </span>
                    <span
                      className={clsx(
                        'inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded border',
                        confidenceRating.badgeBgClass,
                        confidenceRating.badgeTextClass
                      )}
                    >
                      {confidenceRating.label}
                    </span>
                  </div>

                  {/* Confidence Percentage Progress Bar */}
                  <div className="mt-2.5 w-full bg-[#f0eee9] h-2 rounded-full overflow-hidden border border-[#e3ded1]">
                    <div
                      className={clsx('h-full transition-all duration-500', confidenceRating.barColorClass)}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, forecast.confidence_score_pct || 0)
                        )}%`,
                      }}
                      role="progressbar"
                      aria-valuenow={forecast.confidence_score_pct || 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Confidence score percentage"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Computing / Recalculating Active Banner */}
          {statusMeta.isComputing && (
            <div
              className="p-4 rounded-md border border-blue-200 bg-blue-50/70 text-blue-900 flex items-center gap-3 text-xs"
              data-testid="computing-view"
            >
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-blue-900">Calculating AI Forecast Model...</p>
                <p className="text-blue-700 mt-0.5">
                  Analyzing stage transitions and CRM history.
                </p>
              </div>
            </div>
          )}

          {/* Footer Metadata & Recalculate Benchmarking [NFR-2] */}
          <div className="pt-2 border-t border-[#e3ded1] flex items-center justify-between text-[11px] text-[#80756b]">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#80756b]" aria-hidden="true" />
              <span>Calculated: {lastCalculatedFormatted}</span>
            </div>

            {recalcTimeMs !== null && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#f0eee9] text-[#59452b] border border-[#c2b9a7]/40"
                title="AI forecast calculation execution time [NFR-2 target < 3s]"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                {recalcTimeMs}ms
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ForecastWidget;
