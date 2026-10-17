'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Filter,
  RotateCw,
  Download,
  AlertCircle,
  AlertTriangle,
  Search,
  Calendar,
  Layers,
  ArrowDown,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Table as TableIcon,
  BarChart2,
  Sliders,
  ShieldAlert,
  ArrowRightLeft,
} from 'lucide-react';
import {
  getConversionFunnel,
  FunnelStage,
  FunnelQueryParams,
} from '../../services/analytics';

export type DatePreset = '7d' | '30d' | '90d' | 'ytd' | 'all';
export type ViewMode = 'visual' | 'table';

export interface FunnelSummary {
  totalInitialLeads: number;
  totalFinalLeads: number;
  overallConversionRate: number;
  totalDropoffRate: number;
  bottleneckCount: number;
  totalStages: number;
  averageStepConversionRate: number;
}

export interface BottleneckMeta {
  isBottleneck: boolean;
  excessPercent: number;
  severityClass: string;
  badgeClass: string;
  textClass: string;
  label: string;
}

export interface ConversionFunnelProps {
  /**
   * Pre-fetched conversion funnel stage data
   */
  initialData?: FunnelStage[] | null;
  /**
   * Initial query parameters
   */
  initialParams?: FunnelQueryParams;
  /**
   * External loading state override
   */
  loading?: boolean;
  /**
   * External error message override
   */
  error?: string | null;
  /**
   * Callback triggered on manual refresh or parameter updates
   */
  onRefresh?: (params: FunnelQueryParams) => void;
  /**
   * Callback triggered on CSV or PDF export click
   */
  onExport?: (format: 'csv' | 'pdf') => void;
  /**
   * Whether to auto-fetch data on mount when initialData is missing
   */
  autoFetch?: boolean;
  /**
   * Custom CSS class name
   */
  className?: string;
}

/**
 * Format raw decimal numbers to percentage strings (e.g. 75.0%).
 */
export function formatPercentage(value?: number | null): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.0%';
  }
  const clamped = Math.max(0, value);
  return `${clamped.toFixed(1)}%`;
}

/**
 * Format raw numbers with thousand separators (e.g. 1,250).
 */
export function formatStageCount(count?: number | null): string {
  if (count === null || count === undefined || isNaN(count)) {
    return '0';
  }
  return new Intl.NumberFormat('en-US').format(Math.max(0, count));
}

/**
 * Calculate relative visual bar width percentage for funnel visualization.
 */
export function getStageWidth(stageCount: number, initialStageCount: number): number {
  if (!initialStageCount || initialStageCount <= 0 || !stageCount || stageCount <= 0) {
    return 10; // Minimum visual bar width for zero or tiny stages
  }
  const ratio = (stageCount / initialStageCount) * 100;
  return Math.max(10, Math.min(100, Math.round(ratio)));
}

/**
 * Assess drop-off severity and return styling and bottleneck badge labels [FR-005].
 */
export function getBottleneckSeverity(
  dropoffRate: number,
  thresholdPercent: number,
  isBottleneckOverride?: boolean
): BottleneckMeta {
  const isBottleneck =
    isBottleneckOverride !== undefined
      ? isBottleneckOverride
      : dropoffRate >= thresholdPercent && dropoffRate > 0;

  const excess = Math.max(0, dropoffRate - thresholdPercent);

  if (!isBottleneck) {
    return {
      isBottleneck: false,
      excessPercent: 0,
      severityClass: 'bg-emerald-50/80 text-emerald-900 border-emerald-200',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      textClass: 'text-emerald-700',
      label: 'Normal Flow',
    };
  }

  if (excess >= 15) {
    return {
      isBottleneck: true,
      excessPercent: Math.round(excess * 10) / 10,
      severityClass: 'bg-rose-50/90 text-rose-900 border-rose-300 ring-1 ring-rose-200',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 font-semibold',
      textClass: 'text-rose-700',
      label: 'Critical Bottleneck',
    };
  }

  return {
    isBottleneck: true,
    excessPercent: Math.round(excess * 10) / 10,
    severityClass: 'bg-amber-50/90 text-amber-900 border-amber-300 ring-1 ring-amber-200',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-semibold',
    textClass: 'text-amber-700',
    label: 'Bottleneck Detected',
  };
}

/**
 * Compute overall funnel summary metrics across stages [FR-004].
 */
export function calculateOverallFunnelMetrics(stages: FunnelStage[]): FunnelSummary {
  if (!stages || stages.length === 0) {
    return {
      totalInitialLeads: 0,
      totalFinalLeads: 0,
      overallConversionRate: 0,
      totalDropoffRate: 0,
      bottleneckCount: 0,
      totalStages: 0,
      averageStepConversionRate: 0,
    };
  }

  const firstStage = stages[0];
  const lastStage = stages[stages.length - 1];

  const totalInitialLeads = firstStage.count ?? firstStage.lead_count ?? 0;
  const totalFinalLeads = lastStage.count ?? lastStage.lead_count ?? 0;

  let overallConversionRate = 0;
  if (totalInitialLeads > 0) {
    overallConversionRate = Math.round((totalFinalLeads / totalInitialLeads) * 1000) / 10;
  }

  const totalDropoffRate =
    totalInitialLeads > 0 ? Math.round((100 - overallConversionRate) * 10) / 10 : 0;

  // Count bottlenecks
  const bottleneckCount = stages.filter((stage, index) => {
    if (stage.is_bottleneck) return true;
    if (index > 0 && stage.dropoff_rate >= stage.threshold_percent) return true;
    return false;
  }).length;

  // Average step conversion rate (excluding initial stage if stage count > 1)
  const transitionStages = stages.slice(1);
  const averageStepConversionRate =
    transitionStages.length > 0
      ? Math.round(
          (transitionStages.reduce((sum, s) => sum + (s.conversion_rate || 0), 0) /
            transitionStages.length) *
            10
        ) / 10
      : stages.length === 1
      ? 100
      : 0;

  return {
    totalInitialLeads,
    totalFinalLeads,
    overallConversionRate,
    totalDropoffRate,
    bottleneckCount,
    totalStages: stages.length,
    averageStepConversionRate,
  };
}

/**
 * Filter funnel stages by stage name search query.
 */
export function filterFunnelStages(stages: FunnelStage[], searchQuery?: string): FunnelStage[] {
  if (!stages || stages.length === 0) return [];
  if (!searchQuery || !searchQuery.trim()) return stages;

  const query = searchQuery.trim().toLowerCase();
  return stages.filter((s) => s.stage_name.toLowerCase().includes(query));
}

/**
 * Convert date preset to start and end date string parameters.
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

export function ConversionFunnel({
  initialData = null,
  initialParams,
  loading: externalLoading,
  error: externalError,
  onRefresh,
  onExport,
  autoFetch = true,
  className,
}: ConversionFunnelProps) {
  const [stagesData, setStagesData] = useState<FunnelStage[]>(initialData || []);
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Filter & Query States
  const [funnelId, setFunnelId] = useState<string>(initialParams?.funnel_id || '');
  const [startDate, setStartDate] = useState<string>(initialParams?.start_date_val || '');
  const [endDate, setEndDate] = useState<string>(initialParams?.end_date_val || '');
  const [channelId, setChannelId] = useState<string>(initialParams?.channel_id || '');
  const [campaignId, setCampaignId] = useState<string>(initialParams?.campaign_id || '');
  const [defaultThreshold, setDefaultThreshold] = useState<number>(
    initialParams?.default_threshold ?? 30
  );

  const [activePreset, setActivePreset] = useState<DatePreset | null>('30d');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('visual');

  const isLoading = externalLoading ?? internalLoading;
  const errorMessage = externalError ?? internalError;

  // Sync external initialData if provided
  useEffect(() => {
    if (initialData) {
      setStagesData(initialData);
    }
  }, [initialData]);

  // Fetch conversion funnel data from API service [FR-004]
  const fetchData = useCallback(
    async (overrideParams?: FunnelQueryParams) => {
      setInternalLoading(true);
      setInternalError(null);

      const params: FunnelQueryParams = overrideParams || {
        funnel_id: funnelId || undefined,
        start_date_val: startDate || undefined,
        end_date_val: endDate || undefined,
        channel_id: channelId || undefined,
        campaign_id: campaignId || undefined,
        default_threshold: defaultThreshold,
      };

      try {
        const result = await getConversionFunnel(params);
        setStagesData(result);
        if (onRefresh) {
          onRefresh(params);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch conversion funnel';
        setInternalError(msg);
      } finally {
        setInternalLoading(false);
      }
    },
    [funnelId, startDate, endDate, channelId, campaignId, defaultThreshold, onRefresh]
  );

  // Auto-fetch on mount if enabled and initialData absent
  useEffect(() => {
    if (autoFetch && !initialData) {
      fetchData();
    }
  }, [autoFetch, initialData, fetchData]);

  // Preset filter click handler
  const handlePresetChange = (preset: DatePreset) => {
    setActivePreset(preset);
    const range = getDatePresetRange(preset);
    setStartDate(range.start_date_val || '');
    setEndDate(range.end_date_val || '');

    if (autoFetch) {
      fetchData({
        funnel_id: funnelId || undefined,
        start_date_val: range.start_date_val,
        end_date_val: range.end_date_val,
        channel_id: channelId || undefined,
        campaign_id: campaignId || undefined,
        default_threshold: defaultThreshold,
      });
    }
  };

  // Filter stages by search query
  const filteredStages = useMemo(() => {
    return filterFunnelStages(stagesData, searchQuery);
  }, [stagesData, searchQuery]);

  // Overall summary metrics calculation [FR-004]
  const summary = useMemo(() => {
    return calculateOverallFunnelMetrics(stagesData);
  }, [stagesData]);

  // List of bottleneck stages for alert banner [FR-005]
  const bottleneckStages = useMemo(() => {
    return stagesData.filter((stage, index) => {
      if (stage.is_bottleneck) return true;
      if (index > 0 && stage.dropoff_rate >= stage.threshold_percent) return true;
      return false;
    });
  }, [stagesData]);

  return (
    <div
      role="region"
      aria-label="Conversion Funnel Analytics"
      className={twMerge('space-y-6 text-stone-900 font-sans', className)}
    >
      {/* Component Header & Action Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-stone-100 text-stone-800">
              <Layers className="w-5 h-5 text-amber-900" />
            </span>
            <h2 className="text-2xl font-serif font-normal text-stone-900 tracking-tight">
              Conversion Funnel
            </h2>
          </div>
          <p className="text-sm text-stone-600 mt-1">
            Real-time stage progression counts, step conversion rates, and automated drop-off bottleneck detection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-stone-100 rounded-lg border border-stone-200">
            <button
              type="button"
              onClick={() => setViewMode('visual')}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5',
                viewMode === 'visual'
                  ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900'
              )}
            >
              <BarChart2 className="w-3.5 h-3.5 text-amber-900" />
              <span>Funnel Flow</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5',
                viewMode === 'table'
                  ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900'
              )}
            >
              <TableIcon className="w-3.5 h-3.5 text-amber-900" />
              <span>Data Table</span>
            </button>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => fetchData()}
            disabled={isLoading}
            className="px-3 py-2 text-xs font-medium bg-white hover:bg-stone-50 border border-stone-300 rounded-lg text-stone-700 shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
            aria-label="Refresh conversion funnel data"
          >
            <RotateCw className={clsx('w-3.5 h-3.5 text-stone-600', isLoading && 'animate-spin')} />
            <span>Refresh</span>
          </button>

          {/* Export buttons */}
          {onExport && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onExport('csv')}
                className="px-3 py-2 text-xs font-medium bg-amber-900 hover:bg-amber-950 text-amber-50 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() => onExport('pdf')}
                className="px-3 py-2 text-xs font-medium bg-stone-800 hover:bg-stone-900 text-stone-100 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Cards Grid [FR-004] */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Top of Funnel Card */}
        <div className="p-4 bg-stone-50/80 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium uppercase tracking-wider">
            <span>Top of Funnel</span>
            <Layers className="w-4 h-4 text-amber-800" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-serif text-stone-900">
              {formatStageCount(summary.totalInitialLeads)}
            </span>
            <span className="text-xs text-stone-500 block mt-0.5">Total Initial Leads</span>
          </div>
        </div>

        {/* Bottom of Funnel Card */}
        <div className="p-4 bg-stone-50/80 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium uppercase tracking-wider">
            <span>Converted</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-serif text-stone-900">
              {formatStageCount(summary.totalFinalLeads)}
            </span>
            <span className="text-xs text-stone-500 block mt-0.5">Final Converted Leads</span>
          </div>
        </div>

        {/* Overall Conversion Rate Card */}
        <div className="p-4 bg-stone-50/80 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium uppercase tracking-wider">
            <span>Overall Conversion</span>
            <TrendingUp className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-serif text-stone-900">
              {formatPercentage(summary.overallConversionRate)}
            </span>
            <span className="text-xs text-stone-500 block mt-0.5">Initial to Final Stage</span>
          </div>
        </div>

        {/* Total Drop-off Rate Card */}
        <div className="p-4 bg-stone-50/80 rounded-xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium uppercase tracking-wider">
            <span>Total Drop-off</span>
            <TrendingDown className="w-4 h-4 text-stone-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-serif text-stone-900">
              {formatPercentage(summary.totalDropoffRate)}
            </span>
            <span className="text-xs text-stone-500 block mt-0.5">Cumulative Lead Loss</span>
          </div>
        </div>

        {/* Bottlenecks Card [FR-005] */}
        <div
          className={clsx(
            'p-4 rounded-xl border shadow-sm flex flex-col justify-between transition-colors',
            summary.bottleneckCount > 0
              ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-200'
              : 'bg-stone-50/80 border-stone-200'
          )}
        >
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider">
            <span className={summary.bottleneckCount > 0 ? 'text-rose-900' : 'text-stone-500'}>
              Bottlenecks
            </span>
            <AlertCircle
              className={clsx(
                'w-4 h-4',
                summary.bottleneckCount > 0 ? 'text-rose-700' : 'text-stone-400'
              )}
            />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span
                className={clsx(
                  'text-2xl font-serif font-medium',
                  summary.bottleneckCount > 0 ? 'text-rose-950' : 'text-stone-900'
                )}
              >
                {summary.bottleneckCount}
              </span>
              <span className="text-xs text-stone-600">
                {summary.bottleneckCount === 1 ? 'Stage' : 'Stages'}
              </span>
            </div>
            <span className="text-xs text-stone-500 block mt-0.5">Exceeding Thresholds</span>
          </div>
        </div>
      </div>

      {/* Automated Bottlenecks Alert Banner [FR-005] */}
      {bottleneckStages.length > 0 && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50/90 border border-rose-300 text-rose-950 shadow-sm space-y-2"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" />
            <h3 className="font-serif font-medium text-base text-rose-950">
              {bottleneckStages.length} Conversion {bottleneckStages.length === 1 ? 'Bottleneck' : 'Bottlenecks'} Detected
            </h3>
          </div>
          <p className="text-xs text-rose-900 pl-7">
            The following stage transitions exhibit drop-off rates exceeding configured threshold targets ({defaultThreshold}% max allowed).
          </p>
          <div className="pl-7 flex flex-wrap gap-2 pt-1">
            {bottleneckStages.map((stg) => {
              const meta = getBottleneckSeverity(stg.dropoff_rate, stg.threshold_percent || defaultThreshold, stg.is_bottleneck);
              return (
                <div
                  key={stg.stage_name}
                  className="px-2.5 py-1 rounded-md bg-white/80 border border-rose-300 text-xs text-rose-950 flex items-center gap-2 shadow-2xs"
                >
                  <span className="font-semibold text-stone-900">{stg.stage_name}</span>
                  <span className="text-rose-800 font-mono">
                    {formatPercentage(stg.dropoff_rate)} drop-off
                  </span>
                  <span className="text-rose-600/80 text-[11px]">
                    (Threshold: {formatPercentage(stg.threshold_percent || defaultThreshold)})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-stone-600 flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5 text-stone-500" />
              Timeframe:
            </span>
            {(['7d', '30d', '90d', 'ytd', 'all'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetChange(preset)}
                className={clsx(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                  activePreset === preset
                    ? 'bg-amber-900 text-amber-50 shadow-2xs'
                    : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
                )}
              >
                {preset.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Search Stage Input */}
          <div className="relative w-full lg:w-64">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search stage..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-900 text-stone-900 placeholder:text-stone-400"
            />
          </div>
        </div>

        {/* Custom Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-stone-200/80">
          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-medium text-stone-600 uppercase tracking-wider mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePreset(null);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-900"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-medium text-stone-600 uppercase tracking-wider mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePreset(null);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-900"
            />
          </div>

          {/* Funnel ID / Target */}
          <div>
            <label className="block text-[11px] font-medium text-stone-600 uppercase tracking-wider mb-1">
              Funnel ID
            </label>
            <input
              type="text"
              placeholder="e.g. main-funnel"
              value={funnelId}
              onChange={(e) => setFunnelId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-900 placeholder:text-stone-400"
            />
          </div>

          {/* Default Bottleneck Threshold % */}
          <div>
            <label className="block text-[11px] font-medium text-stone-600 uppercase tracking-wider mb-1">
              Max Drop-off Threshold ({defaultThreshold}%)
            </label>
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <input
                type="range"
                min={5}
                max={95}
                step={5}
                value={defaultThreshold}
                onChange={(e) => setDefaultThreshold(Number(e.target.value))}
                className="w-full accent-amber-900 cursor-pointer"
              />
              <span className="text-xs font-mono font-medium text-stone-700 w-8 text-right">
                {defaultThreshold}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message Alert */}
      {errorMessage && (
        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <span className="font-semibold block text-sm">Error Loading Conversion Funnel</span>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-3 py-1 bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 text-xs font-medium rounded-md shadow-2xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div role="status" aria-live="polite" className="p-8 space-y-6 bg-white rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex justify-center items-center gap-2 text-stone-500 text-xs">
            <RotateCw className="w-4 h-4 animate-spin text-amber-900" />
            <span>Loading conversion funnel data...</span>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-stone-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : filteredStages.length === 0 ? (
        /* Empty State */
        <div className="p-12 text-center bg-stone-50/50 rounded-xl border border-dashed border-stone-300 space-y-3">
          <Layers className="w-8 h-8 text-stone-400 mx-auto" />
          <h3 className="text-base font-serif text-stone-800">No Funnel Stages Found</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            No conversion stage data matches the specified date parameters or search filter.
          </p>
        </div>
      ) : viewMode === 'visual' ? (
        /* Visual Funnel Flow View [FR-004, FR-005] */
        <div className="space-y-4">
          {filteredStages.map((stage, index) => {
            const countVal = stage.lead_count ?? stage.count ?? 0;
            const threshold = stage.threshold_percent || defaultThreshold;
            const severity = getBottleneckSeverity(stage.dropoff_rate, threshold, stage.is_bottleneck);
            const barWidthPercent = getStageWidth(countVal, summary.totalInitialLeads);

            // Transition lost leads
            const nextStage = filteredStages[index + 1];
            const nextCount = nextStage ? (nextStage.lead_count ?? nextStage.count ?? 0) : null;
            const leadsLost = nextCount !== null ? Math.max(0, countVal - nextCount) : null;

            return (
              <React.Fragment key={stage.stage_name}>
                {/* Stage Flow Card */}
                <div
                  className={clsx(
                    'p-5 rounded-xl border shadow-2xs transition-all relative overflow-hidden bg-white',
                    severity.isBottleneck
                      ? 'border-rose-300 bg-rose-50/30'
                      : 'border-stone-200 hover:border-stone-300'
                  )}
                >
                  {/* Top Header of Stage Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-stone-100">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-800 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                        0{index + 1}
                      </span>
                      <h4 className="text-lg font-serif font-medium text-stone-900 tracking-tight">
                        {stage.stage_name}
                      </h4>
                      {severity.isBottleneck ? (
                        <span
                          className={clsx(
                            'px-2.5 py-0.5 text-[11px] rounded-full border flex items-center gap-1.5',
                            severity.badgeClass
                          )}
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{severity.label}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[11px] rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Normal</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs font-medium text-stone-600">
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase">Step Conversion</span>
                        <span className="text-stone-900 font-serif text-sm">
                          {formatPercentage(stage.conversion_rate)}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-stone-200" />
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase">Drop-off Rate</span>
                        <span
                          className={clsx(
                            'font-serif text-sm',
                            severity.isBottleneck ? 'text-rose-700 font-semibold' : 'text-stone-900'
                          )}
                        >
                          {formatPercentage(stage.dropoff_rate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stage Metrics & Visual Bar Section */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline text-xs text-stone-600">
                      <div>
                        <span className="text-xl font-serif text-stone-900 font-medium mr-1.5">
                          {formatStageCount(countVal)}
                        </span>
                        <span className="text-stone-500">Leads</span>
                      </div>
                      <div className="text-stone-500 text-[11px]">
                        Overall conversion: <span className="font-semibold text-stone-800">{formatPercentage(stage.overall_conversion_rate)}</span>
                      </div>
                    </div>

                    {/* Proportional Funnel Bar Track */}
                    <div className="w-full bg-stone-100 rounded-lg h-3.5 p-0.5 relative overflow-hidden border border-stone-200/80">
                      <div
                        style={{ width: `${barWidthPercent}%` }}
                        className={clsx(
                          'h-full rounded-md transition-all duration-500',
                          severity.isBottleneck
                            ? 'bg-rose-600'
                            : 'bg-gradient-to-r from-amber-900 to-stone-800'
                        )}
                      />
                    </div>
                  </div>

                  {/* Bottleneck Warning Callout inside Card [FR-005] */}
                  {severity.isBottleneck && (
                    <div className="mt-3 p-2.5 rounded-lg bg-rose-100/70 border border-rose-300 text-rose-900 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                      <span>
                        Stage drop-off of <strong className="font-semibold">{formatPercentage(stage.dropoff_rate)}</strong> exceeds threshold target of <strong className="font-semibold">{formatPercentage(threshold)}</strong> (+{severity.excessPercent}% excess loss).
                      </span>
                    </div>
                  )}
                </div>

                {/* Transition Drop-off Connector */}
                {index < filteredStages.length - 1 && (
                  <div className="flex flex-col items-center justify-center my-1 py-1 text-xs text-stone-500">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-stone-600 shadow-2xs">
                      <ArrowDown className="w-3.5 h-3.5 text-stone-500" />
                      {leadsLost !== null && (
                        <span>
                          <strong className="font-semibold text-stone-800">{formatStageCount(leadsLost)}</strong> leads lost
                        </span>
                      )}
                      <span className="text-stone-400">|</span>
                      <span>
                        Next stage conversion: <strong className="text-stone-800">{formatPercentage(nextStage?.conversion_rate)}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        /* Detailed Data Table View [FR-004] */
        <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-800">
              <thead className="bg-stone-100/80 border-b border-stone-200 text-stone-600 font-medium uppercase tracking-wider text-[11px]">
                <tr>
                  <th scope="col" className="py-3 px-4">#</th>
                  <th scope="col" className="py-3 px-4">Stage Name</th>
                  <th scope="col" className="py-3 px-4 text-right">Lead Count</th>
                  <th scope="col" className="py-3 px-4 text-right">Step Conversion</th>
                  <th scope="col" className="py-3 px-4 text-right">Drop-off Rate</th>
                  <th scope="col" className="py-3 px-4 text-right">Overall Conv.</th>
                  <th scope="col" className="py-3 px-4 text-right">Max Threshold</th>
                  <th scope="col" className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/80">
                {filteredStages.map((stage, idx) => {
                  const threshold = stage.threshold_percent || defaultThreshold;
                  const severity = getBottleneckSeverity(stage.dropoff_rate, threshold, stage.is_bottleneck);
                  const countVal = stage.lead_count ?? stage.count ?? 0;

                  return (
                    <tr
                      key={stage.stage_name}
                      className={clsx(
                        'hover:bg-stone-50/80 transition-colors',
                        severity.isBottleneck && 'bg-rose-50/40'
                      )}
                    >
                      <td className="py-3.5 px-4 font-mono text-stone-500">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-serif font-medium text-stone-900 text-sm">
                        {stage.stage_name}
                      </td>
                      <td className="py-3.5 px-4 text-right font-serif text-sm font-medium text-stone-900">
                        {formatStageCount(countVal)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-stone-800">
                        {formatPercentage(stage.conversion_rate)}
                      </td>
                      <td
                        className={clsx(
                          'py-3.5 px-4 text-right font-medium',
                          severity.isBottleneck ? 'text-rose-700' : 'text-stone-800'
                        )}
                      >
                        {formatPercentage(stage.dropoff_rate)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-stone-700">
                        {formatPercentage(stage.overall_conversion_rate)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-stone-500 font-mono">
                        {formatPercentage(threshold)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {severity.isBottleneck ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-800 border border-rose-300">
                            <AlertCircle className="w-3 h-3" />
                            <span>Bottleneck</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Normal</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
