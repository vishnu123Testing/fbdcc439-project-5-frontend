import { request, RequestOptions } from './apiClient';

/**
 * Comparative period timeframe options.
 */
export type Timeframe = '7d' | '30d' | '90d';

/**
 * Core domain identifiers for quick-view drilldown.
 */
export type DomainIdentifier = 'lead_gen' | 'sales_pipeline' | 'support' | 'financials';

/**
 * Operational metric classification states.
 */
export type MetricStatus = 'VALID' | 'ZERO' | 'UNAVAILABLE';

/**
 * Consolidated summary aggregation operational status.
 */
export type AggregationStatus = 'COMPLETE' | 'PARTIAL' | 'FAILED';

/**
 * Domain quick-view operational status.
 */
export type DomainStatus = 'COMPLETE' | 'UNAVAILABLE';

/**
 * Display unit types for metric values.
 */
export type MetricUnit = 'currency' | 'count' | 'percentage' | 'ratio' | string;

/**
 * Interface representing an individual KPI metric card response payload.
 */
export interface MetricResponse {
  domain: string;
  metric_key: string;
  display_name: string;
  formatted_value: string;
  raw_value: number | null;
  baseline_value: number | null;
  percentage_change: number | null;
  status: MetricStatus;
  unit: MetricUnit;
  error_detail: string | null;
}

export type Metric = MetricResponse;

/**
 * Interface representing a distribution segment breakdown item.
 */
export interface BreakdownItemResponse {
  label: string;
  value: number;
}

export type BreakdownItem = BreakdownItemResponse;

/**
 * Response schema for consolidated multi-domain dashboard summary.
 */
export interface SummaryAggregationResponse {
  status: AggregationStatus;
  generated_at: string;
  metrics: MetricResponse[];
}

/**
 * Response schema for domain quick-view drilldown panel.
 */
export interface DomainQuickViewResponse {
  domain: string;
  status: DomainStatus;
  detailed_metrics: MetricResponse[];
  breakdown_items: BreakdownItemResponse[];
  error_detail: string | null;
}

/**
 * Sanitize raw string input or response property by stripping HTML tags,
 * escaping special entities, and removing control characters (FR-10).
 */
export function sanitizeString(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  let str = String(val).trim();
  if (!str) {
    return '';
  }
  // Strip HTML and script tags
  str = str.replace(/<[^>]*>/g, '');
  // Escape remaining unsafe HTML entity characters
  str = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  // Strip control characters
  str = str.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');
  return str;
}

/**
 * Validate and sanitize comparative timeframe parameter, defaulting to '30d'.
 */
export function validateTimeframe(timeframe?: unknown): Timeframe {
  if (typeof timeframe === 'string') {
    const cleaned = timeframe.trim().toLowerCase();
    if (cleaned === '7d' || cleaned === '30d' || cleaned === '90d') {
      return cleaned as Timeframe;
    }
  }
  return '30d';
}

/**
 * Validate domain identifier parameter against allowed domain keys.
 */
export function validateDomainId(domainId: unknown): DomainIdentifier {
  if (typeof domainId === 'string') {
    const cleaned = domainId.trim().toLowerCase();
    if (
      cleaned === 'lead_gen' ||
      cleaned === 'sales_pipeline' ||
      cleaned === 'support' ||
      cleaned === 'financials'
    ) {
      return cleaned as DomainIdentifier;
    }
  }
  const sanitized = sanitizeString(domainId);
  throw new Error(
    `Invalid domain_id parameter '${sanitized}'. Allowed domains: 'lead_gen', 'sales_pipeline', 'support', 'financials'.`
  );
}

/**
 * Sanitize and validate individual KPI metric card payload object (FR-10).
 */
export function sanitizeMetric(raw: unknown): MetricResponse {
  if (!raw || typeof raw !== 'object') {
    return {
      domain: '',
      metric_key: '',
      display_name: 'Unknown Metric',
      formatted_value: 'Unavailable',
      raw_value: null,
      baseline_value: null,
      percentage_change: null,
      status: 'UNAVAILABLE',
      unit: 'count',
      error_detail: 'Invalid metric payload',
    };
  }

  const obj = raw as Record<string, unknown>;

  const statusStr = typeof obj.status === 'string' ? obj.status.toUpperCase() : '';
  let status: MetricStatus = 'UNAVAILABLE';
  if (statusStr === 'VALID' || statusStr === 'ZERO' || statusStr === 'UNAVAILABLE') {
    status = statusStr as MetricStatus;
  }

  const rawVal =
    typeof obj.raw_value === 'number' && !Number.isNaN(obj.raw_value) ? obj.raw_value : null;
  const baseVal =
    typeof obj.baseline_value === 'number' && !Number.isNaN(obj.baseline_value)
      ? obj.baseline_value
      : null;
  const pctChange =
    typeof obj.percentage_change === 'number' && !Number.isNaN(obj.percentage_change)
      ? obj.percentage_change
      : null;

  return {
    domain: sanitizeString(obj.domain),
    metric_key: sanitizeString(obj.metric_key),
    display_name: sanitizeString(obj.display_name) || 'Unnamed Metric',
    formatted_value: sanitizeString(obj.formatted_value) || 'Unavailable',
    raw_value: rawVal,
    baseline_value: baseVal,
    percentage_change: pctChange,
    status,
    unit: sanitizeString(obj.unit) || 'count',
    error_detail:
      obj.error_detail !== undefined && obj.error_detail !== null
        ? sanitizeString(obj.error_detail)
        : null,
  };
}

/**
 * Sanitize and validate breakdown item distribution object (FR-10).
 */
export function sanitizeBreakdownItem(raw: unknown): BreakdownItemResponse {
  if (!raw || typeof raw !== 'object') {
    return {
      label: 'Unknown',
      value: 0,
    };
  }

  const obj = raw as Record<string, unknown>;
  const val = typeof obj.value === 'number' && !Number.isNaN(obj.value) ? obj.value : 0;

  return {
    label: sanitizeString(obj.label) || 'Unknown',
    value: val,
  };
}

/**
 * Sanitize and validate consolidated summary aggregation response payload (FR-10).
 */
export function sanitizeSummaryResponse(raw: unknown): SummaryAggregationResponse {
  if (!raw || typeof raw !== 'object') {
    return {
      status: 'FAILED',
      generated_at: new Date().toISOString(),
      metrics: [],
    };
  }

  const obj = raw as Record<string, unknown>;

  const statusStr = typeof obj.status === 'string' ? obj.status.toUpperCase() : '';
  let status: AggregationStatus = 'FAILED';
  if (statusStr === 'COMPLETE' || statusStr === 'PARTIAL' || statusStr === 'FAILED') {
    status = statusStr as AggregationStatus;
  }

  const metricsArr = Array.isArray(obj.metrics) ? obj.metrics.map(sanitizeMetric) : [];
  const generatedAtStr =
    typeof obj.generated_at === 'string' && obj.generated_at.trim()
      ? sanitizeString(obj.generated_at)
      : new Date().toISOString();

  return {
    status,
    generated_at: generatedAtStr,
    metrics: metricsArr,
  };
}

/**
 * Sanitize and validate domain quick-view response payload (FR-10).
 */
export function sanitizeDomainQuickViewResponse(raw: unknown): DomainQuickViewResponse {
  if (!raw || typeof raw !== 'object') {
    return {
      domain: '',
      status: 'UNAVAILABLE',
      detailed_metrics: [],
      breakdown_items: [],
      error_detail: 'Invalid domain response payload',
    };
  }

  const obj = raw as Record<string, unknown>;

  const statusStr = typeof obj.status === 'string' ? obj.status.toUpperCase() : '';
  let status: DomainStatus = 'UNAVAILABLE';
  if (statusStr === 'COMPLETE' || statusStr === 'UNAVAILABLE') {
    status = statusStr as DomainStatus;
  }

  const detailedMetrics = Array.isArray(obj.detailed_metrics)
    ? obj.detailed_metrics.map(sanitizeMetric)
    : [];
  const breakdownItems = Array.isArray(obj.breakdown_items)
    ? obj.breakdown_items.map(sanitizeBreakdownItem)
    : [];

  return {
    domain: sanitizeString(obj.domain),
    status,
    detailed_metrics: detailedMetrics,
    breakdown_items: breakdownItems,
    error_detail:
      obj.error_detail !== undefined && obj.error_detail !== null
        ? sanitizeString(obj.error_detail)
        : null,
  };
}

/**
 * Retrieve consolidated executive dashboard KPI summary cards across operational domains (FR-1).
 */
export async function getDashboardSummary(
  timeframe?: string,
  options?: RequestOptions
): Promise<SummaryAggregationResponse> {
  const validTimeframe = validateTimeframe(timeframe);
  const endpoint = `/dashboard/summary?timeframe=${encodeURIComponent(validTimeframe)}`;
  const response = await request<SummaryAggregationResponse>(endpoint, options);
  return sanitizeSummaryResponse(response);
}

/**
 * Retrieve quick-view drilldown metrics and breakdowns for a specific domain (FR-1).
 */
export async function getDomainDrilldown(
  domainId: string,
  timeframe?: string,
  options?: RequestOptions
): Promise<DomainQuickViewResponse> {
  const validDomain = validateDomainId(domainId);
  const validTimeframe = validateTimeframe(timeframe);
  const endpoint = `/dashboard/domains/${encodeURIComponent(validDomain)}?timeframe=${encodeURIComponent(validTimeframe)}`;
  const response = await request<DomainQuickViewResponse>(endpoint, options);
  return sanitizeDomainQuickViewResponse(response);
}

export const dashboardService = {
  getDashboardSummary,
  getDomainDrilldown,
  validateTimeframe,
  validateDomainId,
  sanitizeString,
  sanitizeMetric,
  sanitizeBreakdownItem,
  sanitizeSummaryResponse,
  sanitizeDomainQuickViewResponse,
};

export default dashboardService;
