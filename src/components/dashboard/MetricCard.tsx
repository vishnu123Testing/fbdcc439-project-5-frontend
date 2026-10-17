'use client';

import React, { useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TrendingUp, TrendingDown, Minus, RotateCw } from 'lucide-react';
import { MetricResponse, MetricStatus, MetricUnit } from '../../services/dashboard';
import { StatusLabel } from '../common/StatusLabel';

export interface MetricCardProps {
  /**
   * Metric response object conforming to MetricResponse / Metric interface
   */
  metric?: MetricResponse;
  /**
   * Optional domain override / fallback
   */
  domain?: string;
  /**
   * Optional metric_key override / fallback
   */
  metricKey?: string;
  /**
   * Optional display_name override / fallback
   */
  displayName?: string;
  /**
   * Optional formatted_value override / fallback
   */
  formattedValue?: string;
  /**
   * Optional raw_value override / fallback
   */
  rawValue?: number | null;
  /**
   * Internal/legacy raw value property
   */
  _rawValue?: number | null;
  /**
   * Optional baseline_value override / fallback
   */
  baselineValue?: number | null;
  /**
   * Optional percentage_change override / fallback
   */
  percentageChange?: number | null;
  /**
   * Optional status override / fallback
   */
  status?: MetricStatus;
  /**
   * Optional unit override / fallback
   */
  unit?: MetricUnit;
  /**
   * Optional error_detail override / fallback
   */
  errorDetail?: string | null;
  /**
   * Optional callback triggered when user clicks the Retry button on an UNAVAILABLE card
   */
  onRetry?: (metricKey: string) => void;
  /**
   * Optional callback triggered when user clicks the card (e.g. for domain quick-view selection)
   */
  onSelect?: (domain: string, metricKey: string) => void;
  /**
   * Additional CSS class names
   */
  className?: string;
}

/**
 * Helper to format raw domain strings into clean, human-readable titles.
 */
export function formatDomainName(domain?: string | null): string {
  if (!domain) return '';
  const normalized = domain.trim().toLowerCase();
  switch (normalized) {
    case 'lead_gen':
      return 'Lead Gen';
    case 'sales_pipeline':
      return 'Sales Pipeline';
    case 'support':
      return 'Support';
    case 'financials':
      return 'Financials';
    default:
      return domain
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
  }
}

/**
 * Helper to format numeric percentage change value into clean string (+12.5%, -3.0%, 0%).
 */
export function formatPercentageChange(val?: number | null): string | null {
  if (val === null || val === undefined || isNaN(val)) {
    return null;
  }
  const absVal = Math.abs(val);
  const formatted = absVal % 1 === 0 ? absVal.toFixed(0) : absVal.toFixed(1);
  if (val > 0) {
    return `+${formatted}%`;
  }
  if (val < 0) {
    return `-${formatted}%`;
  }
  return `0%`;
}

/**
 * Helper to format explicit zero metric values ("0", "$0", "0%") based on unit type.
 */
export function formatZeroMetricValue(unit?: MetricUnit): string {
  if (unit === 'currency') {
    return '$0';
  }
  if (unit === 'percentage') {
    return '0%';
  }
  return '0';
}

/**
 * Helper to format baseline values cleanly based on unit type.
 */
export function formatBaselineValue(
  val?: number | null,
  unit?: MetricUnit,
  _formattedVal?: string
): string | null {
  if (val === null || val === undefined || isNaN(val)) {
    return null;
  }
  if (unit === 'currency') {
    return `$${val.toLocaleString('en-US')}`;
  }
  if (unit === 'percentage') {
    return `${val}%`;
  }
  return val.toLocaleString('en-US');
}

/**
 * MetricCard component renders active operational KPI values, comparative
 * baseline indicators, zero states, and unavailable states with retry capabilities.
 */
export function MetricCard({
  metric,
  domain,
  metricKey,
  displayName,
  formattedValue,
  rawValue,
  _rawValue,
  baselineValue,
  percentageChange,
  status,
  unit,
  errorDetail,
  onRetry,
  onSelect,
  className,
}: MetricCardProps) {
  // Resolve values from metric object or individual fallback props
  const resolvedMetricKey = metric?.metric_key ?? metricKey ?? '';
  const resolvedDomain = metric?.domain ?? domain ?? '';
  const resolvedDisplayName = metric?.display_name ?? displayName ?? resolvedMetricKey ?? 'Metric';
  const resolvedStatus: MetricStatus = metric?.status ?? status ?? 'VALID';
  const resolvedFormattedValue = metric?.formatted_value ?? formattedValue ?? '';
  const resolvedRawValue = metric?.raw_value ?? rawValue ?? _rawValue ?? null;
  const resolvedPercentageChange = metric?.percentage_change ?? percentageChange ?? null;
  const resolvedBaselineValue = metric?.baseline_value ?? baselineValue ?? null;
  const resolvedUnit = metric?.unit ?? unit ?? '';
  const resolvedErrorDetail = metric?.error_detail ?? errorDetail ?? null;

  const formattedDomain = formatDomainName(resolvedDomain);
  const formattedChangeStr = formatPercentageChange(resolvedPercentageChange);
  const formattedBaselineStr = formatBaselineValue(
    resolvedBaselineValue,
    resolvedUnit,
    resolvedFormattedValue
  );

  // Derive displayed value text based on status and raw value
  let displayValueText = resolvedFormattedValue;
  if (resolvedStatus === 'UNAVAILABLE') {
    displayValueText =
      resolvedFormattedValue && resolvedFormattedValue.trim() !== ''
        ? resolvedFormattedValue
        : 'Unavailable';
  } else if (resolvedStatus === 'ZERO' || resolvedRawValue === 0) {
    if (!displayValueText || displayValueText.trim() === '') {
      displayValueText = formatZeroMetricValue(resolvedUnit);
    }
  } else if (!displayValueText || displayValueText.trim() === '') {
    if (resolvedRawValue !== null && resolvedRawValue !== undefined && !isNaN(resolvedRawValue)) {
      if (resolvedUnit === 'currency') {
        displayValueText = `$${resolvedRawValue.toLocaleString('en-US')}`;
      } else if (resolvedUnit === 'percentage') {
        displayValueText = `${resolvedRawValue}%`;
      } else {
        displayValueText = resolvedRawValue.toLocaleString('en-US');
      }
    }
  }

  const handleCardClick = useCallback(() => {
    if (onSelect && resolvedDomain && resolvedMetricKey) {
      onSelect(resolvedDomain, resolvedMetricKey);
    }
  }, [onSelect, resolvedDomain, resolvedMetricKey]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && onSelect) {
        e.preventDefault();
        handleCardClick();
      }
    },
    [handleCardClick, onSelect]
  );

  const handleRetryClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onRetry) {
        onRetry(resolvedMetricKey);
      }
    },
    [onRetry, resolvedMetricKey]
  );

  const isInteractive = Boolean(onSelect);

  return (
    <article
      data-testid="metric-card"
      data-metric-key={resolvedMetricKey}
      data-status={resolvedStatus}
      tabIndex={isInteractive ? 0 : undefined}
      role={isInteractive ? 'button' : 'region'}
      aria-label={`${formattedDomain ? `${formattedDomain} - ` : ''}${resolvedDisplayName}: ${displayValueText}`}
      onClick={isInteractive ? handleCardClick : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      className={twMerge(
        clsx(
          'relative flex flex-col justify-between p-5 rounded-lg border transition-all duration-200 shadow-sm',
          {
            // Valid State
            'bg-[#fbf9f4] border-[#d1c4b9]/60 hover:border-[#715a3f]/40':
              resolvedStatus === 'VALID',
            // Zero State (standard active styling)
            'bg-[#fbf9f4] border-[#d1c4b9]/60': resolvedStatus === 'ZERO',
            // Unavailable State (dimmed / error styling)
            'bg-[#e4e2dd]/40 border-dashed border-[#d1c4b9] text-[#4e453d] opacity-90':
              resolvedStatus === 'UNAVAILABLE',
            // Interactive styling
            'cursor-pointer hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#715a3f]':
              isInteractive,
          },
          className
        )
      )}
    >
      {/* Header Row: Domain Badge, Display Name, Status Label */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-col">
          {formattedDomain && (
            <span
              data-testid="metric-domain"
              className="text-[11px] font-semibold tracking-wider uppercase text-[#80756b]"
            >
              {formattedDomain}
            </span>
          )}
          <h3
            data-testid="metric-title"
            className="text-sm font-semibold text-[#1b1c19] line-clamp-1 mt-0.5"
          >
            {resolvedDisplayName}
          </h3>
        </div>

        {/* Status Indicator */}
        <div data-testid="metric-status">
          {resolvedStatus === 'VALID' && (
            <StatusLabel
              status="active"
              label="Valid"
              variant="success"
              showIcon={false}
              className="text-[10px] px-1.5 py-0.5"
            />
          )}
          {resolvedStatus === 'ZERO' && (
            <StatusLabel
              status="neutral"
              label="Zero"
              variant="neutral"
              showIcon={false}
              className="text-[10px] px-1.5 py-0.5"
            />
          )}
          {resolvedStatus === 'UNAVAILABLE' && (
            <StatusLabel
              status="error"
              label="Unavailable"
              variant="error"
              showIcon={true}
              className="text-[10px] px-1.5 py-0.5"
            />
          )}
        </div>
      </div>

      {/* Main Metric Value */}
      <div className="my-2">
        <div
          data-testid="metric-value"
          className={clsx('text-3xl font-bold tracking-tight', {
            'text-[#1b1c19]': resolvedStatus === 'VALID' || resolvedStatus === 'ZERO',
            'text-[#80756b] italic font-medium text-2xl': resolvedStatus === 'UNAVAILABLE',
          })}
        >
          {displayValueText}
        </div>
      </div>

      {/* Footer / Comparative Indicators */}
      <div className="mt-2 pt-2 border-t border-[#d1c4b9]/30 flex items-center justify-between gap-2 text-xs">
        {resolvedStatus !== 'UNAVAILABLE' ? (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Comparative Percentage Indicator */}
            {resolvedPercentageChange !== null && resolvedPercentageChange !== undefined && (
              <span
                data-testid="metric-change"
                aria-label={`Percentage change: ${formattedChangeStr}`}
                className={clsx(
                  'inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded text-xs',
                  {
                    'bg-emerald-100/90 text-emerald-800 border border-emerald-200/50':
                      resolvedPercentageChange > 0,
                    'bg-rose-100/90 text-rose-800 border border-rose-200/50':
                      resolvedPercentageChange < 0,
                    'bg-neutral-100 text-neutral-700 border border-neutral-200':
                      resolvedPercentageChange === 0,
                  }
                )}
              >
                {resolvedPercentageChange > 0 && <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />}
                {resolvedPercentageChange < 0 && <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />}
                {resolvedPercentageChange === 0 && <Minus className="w-3.5 h-3.5" aria-hidden="true" />}
                <span>{formattedChangeStr}</span>
              </span>
            )}

            {/* Baseline Figure / Context */}
            {formattedBaselineStr && (
              <span
                data-testid="metric-baseline"
                className="text-[#80756b] font-normal"
              >
                vs prior ({formattedBaselineStr})
              </span>
            )}
          </div>
        ) : (
          /* Unavailable State Error Detail & Retry Action */
          <div className="flex items-center justify-between w-full gap-2">
            <span
              data-testid="metric-error-detail"
              className="text-rose-700 text-xs font-normal line-clamp-1"
              title={resolvedErrorDetail ?? 'Service unavailable'}
            >
              {resolvedErrorDetail ?? 'Service unavailable'}
            </span>

            {onRetry && (
              <button
                type="button"
                data-testid="retry-button"
                onClick={handleRetryClick}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#59452b] bg-[#f0eee9] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#715a3f]"
                aria-label={`Retry fetching ${resolvedDisplayName}`}
              >
                <RotateCw className="w-3 h-3" aria-hidden="true" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default MetricCard;
