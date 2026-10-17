'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  MapPin,
  Globe,
  Filter,
  RotateCw,
  Download,
  AlertCircle,
  Search,
  Calendar,
  X,
  ChevronRight,
  Sliders,
  Eye,
  HelpCircle,
  Info,
  Layers,
  Table as TableIcon,
  LayoutGrid,
  DollarSign,
  Users,
  TrendingUp,
  CheckCircle2,
  Inbox,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react';
import {
  getTerritoryHeatmap,
  TerritoryHeatMap as TerritoryHeatMapData,
  TerritoryDensity,
  TerritoryHeatmapParams,
  UnassignedDrawer,
  UnassignedLead,
} from '../../services/analytics';

export type DatePreset = '7d' | '30d' | '90d' | 'ytd' | 'all';
export type ViewMode = 'grid' | 'table' | 'breakdown';

export interface TerritoryHeatMapProps {
  /**
   * Optional pre-fetched territory heat map data
   */
  initialData?: TerritoryHeatMapData | null;
  /**
   * Optional initial filter parameters
   */
  initialParams?: TerritoryHeatmapParams;
  /**
   * Optional loading state override from parent
   */
  loading?: boolean;
  /**
   * Optional error message override from parent
   */
  error?: string | null;
  /**
   * Callback fired when parameters change or user clicks refresh
   */
  onRefresh?: (params: TerritoryHeatmapParams) => void;
  /**
   * Callback fired when user clicks CSV or PDF export
   */
  onExport?: (format: 'csv' | 'pdf') => void;
  /**
   * Callback fired when a territory card or row is selected
   */
  onSelectTerritory?: (territory: TerritoryDensity) => void;
  /**
   * Whether to automatically fetch data on mount and parameter changes
   */
  autoFetch?: boolean;
  /**
   * Additional CSS class name
   */
  className?: string;
}

export interface HeatIntensity {
  level: 'high' | 'medium' | 'low' | 'zero';
  percent: number;
  bgClass: string;
  textClass: string;
  borderClass: string;
  badgeClass: string;
  label: string;
}

export interface TerritorySummary {
  totalLeads: number;
  totalValue: number;
  totalOpportunities: number;
  activeTerritoriesCount: number;
  unassignedLeadsCount: number;
  unassignedValue: number;
  averageDealValue: number;
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
 * Format raw numbers with thousand separators (e.g. 1,250).
 */
export function formatNumber(value?: number | null): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return new Intl.NumberFormat('en-US').format(Math.max(0, value));
}

/**
 * Calculate heat intensity classification and visual color styling for a territory.
 */
export function calculateHeatIntensity(
  leadCount: number,
  maxLeadCount: number,
  dealValue: number = 0,
  maxDealValue: number = 0
): HeatIntensity {
  if (leadCount <= 0 && dealValue <= 0) {
    return {
      level: 'zero',
      percent: 0,
      bgClass: 'bg-stone-100',
      textClass: 'text-stone-600',
      borderClass: 'border-stone-200',
      badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
      label: 'Zero Activity',
    };
  }

  const leadRatio = maxLeadCount > 0 ? leadCount / maxLeadCount : 0;
  const valueRatio = maxDealValue > 0 ? dealValue / maxDealValue : 0;

  // Composite density score weighting lead count (60%) and deal value (40%)
  const densityScore = Math.min(1, leadRatio * 0.6 + valueRatio * 0.4);
  const percent = Math.round(densityScore * 100);

  if (densityScore >= 0.66) {
    return {
      level: 'high',
      percent,
      bgClass: 'bg-amber-100',
      textClass: 'text-amber-900',
      borderClass: 'border-amber-300',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      label: 'High Density',
    };
  }

  if (densityScore >= 0.33) {
    return {
      level: 'medium',
      percent,
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-800',
      borderClass: 'border-amber-200',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      label: 'Medium Density',
    };
  }

  return {
    level: 'low',
    percent: Math.max(5, percent),
    bgClass: 'bg-stone-50',
    textClass: 'text-stone-800',
    borderClass: 'border-stone-200',
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
    label: 'Low Density',
  };
}

/**
 * Calculate overall summary metrics across territories and unassigned drawer.
 */
export function calculateTerritorySummary(data?: TerritoryHeatMapData | null): TerritorySummary {
  if (!data) {
    return {
      totalLeads: 0,
      totalValue: 0,
      totalOpportunities: 0,
      activeTerritoriesCount: 0,
      unassignedLeadsCount: 0,
      unassignedValue: 0,
      averageDealValue: 0,
    };
  }

  const territories = data.territories || [];
  const unassigned = data.unassigned_drawer || {
    total_unassigned_leads: 0,
    total_unassigned_value: 0,
    unassigned_items: [],
  };

  const totalOpportunities = territories.reduce(
    (acc, t) => acc + (t.opportunity_count || 0),
    0
  );

  const totalLeads =
    data.total_leads !== undefined
      ? data.total_leads
      : territories.reduce((acc, t) => acc + (t.lead_count || 0), 0) +
        (unassigned.total_unassigned_leads || 0);

  const totalValue =
    data.total_value !== undefined
      ? data.total_value
      : territories.reduce((acc, t) => acc + (t.total_deal_value || 0), 0) +
        (unassigned.total_unassigned_value || 0);

  const activeTerritoriesCount = territories.filter(
    (t) => (t.lead_count || 0) > 0 || (t.total_deal_value || 0) > 0
  ).length;

  const averageDealValue = totalLeads > 0 ? totalValue / totalLeads : 0;

  return {
    totalLeads,
    totalValue,
    totalOpportunities,
    activeTerritoriesCount,
    unassignedLeadsCount: unassigned.total_unassigned_leads || 0,
    unassignedValue: unassigned.total_unassigned_value || 0,
    averageDealValue,
  };
}

/**
 * Filter territory list based on search string and deal value constraints.
 */
export function filterTerritories(
  territories: TerritoryDensity[],
  search: string,
  minDealValue?: number,
  maxDealValue?: number
): TerritoryDensity[] {
  if (!territories) return [];

  const normalizedSearch = search.trim().toLowerCase();

  return territories.filter((territory) => {
    // Search match on territory name or code or postal code breakdown
    let matchesSearch = true;
    if (normalizedSearch) {
      const nameMatch = territory.territory_name.toLowerCase().includes(normalizedSearch);
      const codeMatch = territory.territory_code.toLowerCase().includes(normalizedSearch);
      const postalMatch =
        territory.postal_code_breakdown &&
        Object.keys(territory.postal_code_breakdown).some((zip) =>
          zip.toLowerCase().includes(normalizedSearch)
        );

      matchesSearch = nameMatch || codeMatch || postalMatch;
    }

    // Deal value match
    let matchesMinVal = true;
    if (minDealValue !== undefined && minDealValue !== null) {
      matchesMinVal = territory.total_deal_value >= minDealValue;
    }

    let matchesMaxVal = true;
    if (maxDealValue !== undefined && maxDealValue !== null) {
      matchesMaxVal = territory.total_deal_value <= maxDealValue;
    }

    return matchesSearch && matchesMinVal && matchesMaxVal;
  });
}

/**
 * Compute start and end ISO dates from standard preset identifiers.
 */
export function getDatePresetRange(preset: DatePreset): {
  start_date_val?: string;
  end_date_val?: string;
} {
  if (preset === 'all') {
    return {};
  }

  const now = new Date();
  const endDate = now.toISOString().split('T')[0];

  const startDateObj = new Date(now);

  switch (preset) {
    case '7d':
      startDateObj.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDateObj.setDate(now.getDate() - 30);
      break;
    case '90d':
      startDateObj.setDate(now.getDate() - 90);
      break;
    case 'ytd':
      startDateObj.setMonth(0, 1);
      break;
  }

  const startDate = startDateObj.toISOString().split('T')[0];
  return { start_date_val: startDate, end_date_val: endDate };
}

/**
 * Geographic Territory Heat Map UI Component [FR-007, FR-008]
 */
export const TerritoryHeatMap: React.FC<TerritoryHeatMapProps> = ({
  initialData = null,
  initialParams = {},
  loading: externalLoading,
  error: externalError,
  onRefresh,
  onExport,
  onSelectTerritory,
  autoFetch = true,
  className,
}) => {
  // State management
  const [data, setData] = useState<TerritoryHeatMapData | null>(initialData);
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Filter state [FR-008]
  const [leadStatus, setLeadStatus] = useState<string>(initialParams.lead_status || '');
  const [minDealValue, setMinDealValue] = useState<string>(
    initialParams.min_deal_value !== undefined ? String(initialParams.min_deal_value) : ''
  );
  const [maxDealValue, setMaxDealValue] = useState<string>(
    initialParams.max_deal_value !== undefined ? String(initialParams.max_deal_value) : ''
  );
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string>(
    initialParams.territory_id || ''
  );
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [customStartDate, setCustomStartDate] = useState<string>(
    initialParams.start_date_val || ''
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    initialParams.end_date_val || ''
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [includeUnassigned, setIncludeUnassigned] = useState<boolean>(
    initialParams.include_unassigned !== false
  );

  // View mode and interactive UI state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [unassignedSearch, setUnassignedSearch] = useState<string>('');
  const [expandedTerritoryId, setExpandedTerritoryId] = useState<string | null>(null);
  const [activeTerritoryCard, setActiveTerritoryCard] = useState<TerritoryDensity | null>(null);

  const isLoading = externalLoading !== undefined ? externalLoading : internalLoading;
  const errorMsg = externalError !== undefined ? externalError : internalError;

  // Build current parameters
  const currentParams = useMemo<TerritoryHeatmapParams>(() => {
    let dateParams: { start_date_val?: string; end_date_val?: string } = {};
    if (customStartDate || customEndDate) {
      dateParams = {
        start_date_val: customStartDate || undefined,
        end_date_val: customEndDate || undefined,
      };
    } else {
      dateParams = getDatePresetRange(datePreset);
    }

    return {
      lead_status: leadStatus || undefined,
      min_deal_value: minDealValue ? Number(minDealValue) : undefined,
      max_deal_value: maxDealValue ? Number(maxDealValue) : undefined,
      territory_id: selectedTerritoryId || undefined,
      include_unassigned: includeUnassigned,
      ...dateParams,
    };
  }, [
    leadStatus,
    minDealValue,
    maxDealValue,
    selectedTerritoryId,
    includeUnassigned,
    customStartDate,
    customEndDate,
    datePreset,
  ]);

  // Fetch heat map metrics from backend API [FR-007]
  const fetchData = useCallback(
    async (paramsToFetch: TerritoryHeatmapParams) => {
      setInternalLoading(true);
      setInternalError(null);
      try {
        const response = await getTerritoryHeatmap(paramsToFetch);
        setData(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load territory heat map data.';
        setInternalError(message);
      } finally {
        setInternalLoading(false);
      }
    },
    []
  );

  // Sync with initialData changes
  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  // Auto fetch on mount or parameter changes
  useEffect(() => {
    if (autoFetch && !initialData) {
      fetchData(currentParams);
    }
  }, [autoFetch, initialData, currentParams, fetchData]);

  // Handle manual refresh click
  const handleRefreshClick = () => {
    if (onRefresh) {
      onRefresh(currentParams);
    }
    fetchData(currentParams);
  };

  // Handle filter preset reset
  const handleResetFilters = () => {
    setLeadStatus('');
    setMinDealValue('');
    setMaxDealValue('');
    setSelectedTerritoryId('');
    setDatePreset('30d');
    setCustomStartDate('');
    setCustomEndDate('');
    setSearchQuery('');
    setIncludeUnassigned(true);
    const defaultParams = getDatePresetRange('30d');
    if (onRefresh) {
      onRefresh(defaultParams);
    }
    if (autoFetch) {
      fetchData(defaultParams);
    }
  };

  // Summary statistics calculation
  const summary = useMemo(() => calculateTerritorySummary(data), [data]);

  // Max bounds for intensity scaling
  const maxMetrics = useMemo(() => {
    if (!data || !data.territories || data.territories.length === 0) {
      return { maxLeadCount: 0, maxDealValue: 0 };
    }
    const maxLeadCount = Math.max(...data.territories.map((t) => t.lead_count || 0));
    const maxDealValue = Math.max(...data.territories.map((t) => t.total_deal_value || 0));
    return { maxLeadCount, maxDealValue };
  }, [data]);

  // Filtered territory list
  const filteredTerritories = useMemo(() => {
    if (!data || !data.territories) return [];
    const minVal = minDealValue ? Number(minDealValue) : undefined;
    const maxVal = maxDealValue ? Number(maxDealValue) : undefined;
    return filterTerritories(data.territories, searchQuery, minVal, maxVal);
  }, [data, searchQuery, minDealValue, maxDealValue]);

  // Filtered unassigned leads list
  const filteredUnassignedItems = useMemo(() => {
    if (!data?.unassigned_drawer?.unassigned_items) return [];
    if (!unassignedSearch.trim()) return data.unassigned_drawer.unassigned_items;

    const term = unassignedSearch.toLowerCase();
    return data.unassigned_drawer.unassigned_items.filter(
      (item) =>
        item.lead_id.toLowerCase().includes(term) ||
        (item.postal_code && item.postal_code.toLowerCase().includes(term)) ||
        item.stage_name.toLowerCase().includes(term) ||
        item.reason.toLowerCase().includes(term)
    );
  }, [data, unassignedSearch]);

  const handleCardClick = (territory: TerritoryDensity) => {
    setActiveTerritoryCard(territory);
    if (onSelectTerritory) {
      onSelectTerritory(territory);
    }
  };

  return (
    <div className={twMerge('w-full space-y-6 text-[#1b1c19]', className)}>
      {/* Component Header & Top Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-[#d1c4b9]/40 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-[#735c41]" />
            <h2 className="font-serif text-2xl font-normal text-[#1b1c19]">
              Geographic Territory Heat Map
            </h2>
          </div>
          <p className="mt-1 text-sm text-[#4e453d]">
            Lead and opportunity density analysis across sales territories, regions, and postal codes [FR-007, FR-008].
          </p>
        </div>

        {/* Global Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Unassigned Territory Drawer Toggle Button [FR-007 Edge Cases] */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open Unassigned Territory Drawer"
            className={clsx(
              'relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors border shadow-xs',
              summary.unassignedLeadsCount > 0
                ? 'bg-[#f0eee9] text-[#59452b] border-[#d1c4b9] hover:bg-[#eae8e3]'
                : 'bg-white text-[#4e453d] border-stone-200 hover:bg-stone-50'
            )}
          >
            <Inbox className="h-4 w-4 text-[#735c41]" />
            <span>Unassigned Drawer</span>
            {summary.unassignedLeadsCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-[#a43b2c] px-2 py-0.5 text-[11px] font-semibold text-white">
                {formatNumber(summary.unassignedLeadsCount)}
              </span>
            )}
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#d1c4b9] bg-white px-3 py-2 text-xs font-medium text-[#1b1c19] shadow-xs hover:bg-[#f5f3ee] disabled:opacity-50 transition-colors"
          >
            <RotateCw className={clsx('h-3.5 w-3.5 text-[#59452b]', isLoading && 'animate-spin')} />
            <span>Refresh</span>
          </button>

          {/* Export CSV / PDF Buttons */}
          {onExport && (
            <div className="inline-flex rounded-md shadow-xs border border-[#d1c4b9]">
              <button
                type="button"
                onClick={() => onExport('csv')}
                className="inline-flex items-center gap-1 rounded-l-md bg-white px-2.5 py-2 text-xs font-medium text-[#1b1c19] hover:bg-[#f5f3ee] transition-colors border-r border-[#d1c4b9]"
              >
                <Download className="h-3.5 w-3.5 text-[#735c41]" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => onExport('pdf')}
                className="inline-flex items-center gap-1 rounded-r-md bg-white px-2.5 py-2 text-xs font-medium text-[#1b1c19] hover:bg-[#f5f3ee] transition-colors"
              >
                <Download className="h-3.5 w-3.5 text-[#735c41]" />
                <span>PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Mapped Leads */}
        <div className="rounded-lg border border-[#d1c4b9]/50 bg-[#fbf9f4] p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#80756b]">
              Total Leads
            </span>
            <Users className="h-4 w-4 text-[#735c41]" />
          </div>
          <div className="mt-2 text-2xl font-serif text-[#1b1c19]">
            {formatNumber(summary.totalLeads)}
          </div>
          <p className="mt-1 text-xs text-[#4e453d]">
            Across {summary.activeTerritoriesCount} active territories
          </p>
        </div>

        {/* Total Opportunity Value */}
        <div className="rounded-lg border border-[#d1c4b9]/50 bg-[#fbf9f4] p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#80756b]">
              Total Deal Value
            </span>
            <DollarSign className="h-4 w-4 text-[#735c41]" />
          </div>
          <div className="mt-2 text-2xl font-serif text-[#1b1c19]">
            {formatCurrency(summary.totalValue)}
          </div>
          <p className="mt-1 text-xs text-[#4e453d]">
            Avg {formatCurrency(summary.averageDealValue)} / lead
          </p>
        </div>

        {/* Active Territories Count */}
        <div className="rounded-lg border border-[#d1c4b9]/50 bg-[#fbf9f4] p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#80756b]">
              Active Regions
            </span>
            <MapPin className="h-4 w-4 text-[#735c41]" />
          </div>
          <div className="mt-2 text-2xl font-serif text-[#1b1c19]">
            {formatNumber(summary.activeTerritoriesCount)}
          </div>
          <p className="mt-1 text-xs text-[#4e453d]">
            {summary.totalOpportunities} active opportunities
          </p>
        </div>

        {/* Unassigned Territory Drawer Banner */}
        <div className="rounded-lg border border-amber-300/80 bg-amber-50/60 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-amber-900">
              Unassigned Leads
            </span>
            <AlertCircle className="h-4 w-4 text-amber-700" />
          </div>
          <div className="mt-2 text-2xl font-serif text-amber-950">
            {formatNumber(summary.unassignedLeadsCount)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-amber-800">
            <span>{formatCurrency(summary.unassignedValue)} unmapped</span>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="font-medium underline hover:text-amber-950"
            >
              View Drawer
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Filter Control Panel [FR-008] */}
      <div className="rounded-lg border border-[#d1c4b9] bg-[#f0eee9]/60 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-[#d1c4b9]/40 pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#59452b]">
            <Filter className="h-4 w-4 text-[#735c41]" />
            <span>Interactive Heat Map Filters</span>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs text-[#735c41] underline hover:text-[#1b1c19] transition-colors"
          >
            Reset All Filters
          </button>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Lead Status Filter */}
          <div>
            <label htmlFor="lead-status-select" className="block font-medium text-[#4e453d] mb-1">
              Lead Status
            </label>
            <select
              id="lead-status-select"
              value={leadStatus}
              onChange={(e) => setLeadStatus(e.target.value)}
              className="w-full rounded-md border border-[#d1c4b9] bg-white px-2.5 py-1.5 text-xs text-[#1b1c19] focus:border-[#735c41] focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="New">New</option>
              <option value="Qualified">Qualified</option>
              <option value="In Discussion">In Discussion</option>
              <option value="Proposal">Proposal</option>
              <option value="Closed Won">Closed Won</option>
              <option value="Closed Lost">Closed Lost</option>
            </select>
          </div>

          {/* Deal Value Range Inputs */}
          <div>
            <label className="block font-medium text-[#4e453d] mb-1">
              Deal Value Range ($)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Min $"
                value={minDealValue}
                onChange={(e) => setMinDealValue(e.target.value)}
                className="w-full rounded-md border border-[#d1c4b9] bg-white px-2 py-1.5 text-xs text-[#1b1c19] focus:border-[#735c41] focus:outline-none"
              />
              <span className="text-[#80756b]">-</span>
              <input
                type="number"
                placeholder="Max $"
                value={maxDealValue}
                onChange={(e) => setMaxDealValue(e.target.value)}
                className="w-full rounded-md border border-[#d1c4b9] bg-white px-2 py-1.5 text-xs text-[#1b1c19] focus:border-[#735c41] focus:outline-none"
              />
            </div>
          </div>

          {/* Territory Boundary Filter */}
          <div>
            <label htmlFor="territory-select" className="block font-medium text-[#4e453d] mb-1">
              Territory Boundary
            </label>
            <select
              id="territory-select"
              value={selectedTerritoryId}
              onChange={(e) => setSelectedTerritoryId(e.target.value)}
              className="w-full rounded-md border border-[#d1c4b9] bg-white px-2.5 py-1.5 text-xs text-[#1b1c19] focus:border-[#735c41] focus:outline-none"
            >
              <option value="">All Authorized Regions</option>
              {data?.territories?.map((t) => (
                <option key={t.territory_id} value={t.territory_id}>
                  {t.territory_name} ({t.territory_code})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Presets */}
          <div>
            <label className="block font-medium text-[#4e453d] mb-1">
              Date Period
            </label>
            <div className="flex rounded-md shadow-2xs">
              {(['7d', '30d', '90d', 'all'] as DatePreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setDatePreset(preset);
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className={clsx(
                    'flex-1 py-1.5 text-[11px] font-medium transition-colors border-y border-r first:rounded-l-md first:border-l last:rounded-r-md border-[#d1c4b9]',
                    datePreset === preset && !customStartDate
                      ? 'bg-[#59452b] text-white'
                      : 'bg-white text-[#4e453d] hover:bg-[#f5f3ee]'
                  )}
                >
                  {preset.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Secondary Filter Line & Search Input */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#d1c4b9]/30">
          {/* Territory Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#80756b]" />
            <input
              type="text"
              placeholder="Search territory name, code, or postal code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-[#d1c4b9] bg-white pl-8 pr-3 py-1.5 text-xs text-[#1b1c19] focus:border-[#735c41] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-[#80756b] hover:text-[#1b1c19]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Include Unassigned Checkbox Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="include-unassigned-check"
              checked={includeUnassigned}
              onChange={(e) => setIncludeUnassigned(e.target.checked)}
              className="rounded border-[#d1c4b9] text-[#59452b] focus:ring-[#735c41]"
            />
            <label htmlFor="include-unassigned-check" className="text-xs text-[#4e453d]">
              Include unassigned drawer records in summary counts
            </label>
          </div>
        </div>
      </div>

      {/* Error Message Banner */}
      {errorMsg && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-xs text-red-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Error Loading Heat Map Data</p>
            <p className="mt-0.5">{errorMsg}</p>
          </div>
          <button
            type="button"
            onClick={handleRefreshClick}
            className="rounded bg-red-100 px-2 py-1 font-medium text-red-900 hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content Area - View Switcher & Data Grid */}
      <div className="space-y-4">
        {/* View Mode Switcher Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-[#4e453d]">
            <span>Displaying {filteredTerritories.length} territories</span>
            {searchQuery && (
              <span className="rounded-full bg-[#e4e2dd] px-2 py-0.5 text-[11px] text-[#1b1c19]">
                Filter: &quot;{searchQuery}&quot;
              </span>
            )}
          </div>

          {/* View Toggle Buttons */}
          <div className="flex rounded-md border border-[#d1c4b9] bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Density Grid View"
              className={clsx(
                'inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                viewMode === 'grid'
                  ? 'bg-[#59452b] text-white'
                  : 'text-[#4e453d] hover:bg-[#f5f3ee]'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-label="Territory Table View"
              className={clsx(
                'inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                viewMode === 'table'
                  ? 'bg-[#59452b] text-white'
                  : 'text-[#4e453d] hover:bg-[#f5f3ee]'
              )}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('breakdown')}
              aria-label="Postal Code Breakdown View"
              className={clsx(
                'inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                viewMode === 'breakdown'
                  ? 'bg-[#59452b] text-white'
                  : 'text-[#4e453d] hover:bg-[#f5f3ee]'
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Zip Breakdown</span>
            </button>
          </div>
        </div>

        {/* Loading Skeleton */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg border border-[#d1c4b9]/40 bg-[#f5f3ee] p-5 h-48"
              />
            ))}
          </div>
        ) : filteredTerritories.length === 0 ? (
          /* Empty State */
          <div className="rounded-lg border border-dashed border-[#d1c4b9] p-8 text-center bg-[#fbf9f4]">
            <MapPin className="mx-auto h-8 w-8 text-[#80756b]" />
            <h3 className="mt-2 text-sm font-medium text-[#1b1c19]">No Territory Data Found</h3>
            <p className="mt-1 text-xs text-[#4e453d]">
              No territories match your current search and filter settings. Try adjusting the deal value or status filters.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 rounded-md bg-[#59452b] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#735c41]"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW MODE [FR-007] */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTerritories.map((territory) => {
              const intensity = calculateHeatIntensity(
                territory.lead_count,
                maxMetrics.maxLeadCount,
                territory.total_deal_value,
                maxMetrics.maxDealValue
              );

              const isExpanded = expandedTerritoryId === territory.territory_id;
              const isSelected = activeTerritoryCard?.territory_id === territory.territory_id;

              return (
                <div
                  key={territory.territory_id}
                  onClick={() => handleCardClick(territory)}
                  className={clsx(
                    'rounded-lg border bg-[#fbf9f4] p-5 shadow-xs transition-all cursor-pointer hover:shadow-md flex flex-col justify-between',
                    isSelected ? 'border-[#735c41] ring-1 ring-[#735c41]' : 'border-[#d1c4b9]'
                  )}
                >
                  <div>
                    {/* Card Top: Code & Intensity Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono font-semibold uppercase text-[#80756b]">
                          {territory.territory_code}
                        </span>
                        <h3 className="text-base font-serif font-normal text-[#1b1c19]">
                          {territory.territory_name}
                        </h3>
                      </div>
                      <span
                        className={clsx(
                          'rounded-full px-2.5 py-0.5 text-[10px] font-medium border shrink-0',
                          intensity.badgeClass
                        )}
                      >
                        {intensity.label}
                      </span>
                    </div>

                    {/* Heat Intensity Progress Indicator */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] text-[#4e453d] mb-1">
                        <span>Density Volume Share</span>
                        <span className="font-medium">{intensity.percent}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#e4e2dd] overflow-hidden">
                        <div
                          className="h-full bg-[#735c41] transition-all duration-500"
                          style={{ width: `${intensity.percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t border-[#d1c4b9]/30 pt-3">
                      <div>
                        <span className="text-[#80756b] block text-[10px] uppercase tracking-wide">
                          Leads Count
                        </span>
                        <span className="font-serif text-sm font-medium text-[#1b1c19]">
                          {formatNumber(territory.lead_count)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#80756b] block text-[10px] uppercase tracking-wide">
                          Opportunities
                        </span>
                        <span className="font-serif text-sm font-medium text-[#1b1c19]">
                          {formatNumber(territory.opportunity_count)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#80756b] block text-[10px] uppercase tracking-wide">
                          Total Deal Value
                        </span>
                        <span className="font-serif text-sm font-medium text-[#1b1c19]">
                          {formatCurrency(territory.total_deal_value)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#80756b] block text-[10px] uppercase tracking-wide">
                          Avg Deal Size
                        </span>
                        <span className="font-serif text-sm font-medium text-[#1b1c19]">
                          {formatCurrency(territory.average_deal_value)}
                        </span>
                      </div>
                    </div>

                    {/* Postal Code Breakdown Pill List */}
                    {territory.postal_code_breakdown &&
                      Object.keys(territory.postal_code_breakdown).length > 0 && (
                        <div className="mt-3 border-t border-[#d1c4b9]/30 pt-2">
                          <span className="text-[10px] font-medium text-[#80756b] block mb-1">
                            Postal Codes Density:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(territory.postal_code_breakdown)
                              .slice(0, isExpanded ? undefined : 3)
                              .map(([zip, count]) => (
                                <span
                                  key={zip}
                                  className="rounded bg-[#f0eee9] px-2 py-0.5 text-[10px] text-[#4e453d] border border-[#d1c4b9]/40"
                                >
                                  {zip}: <strong className="text-[#1b1c19]">{count}</strong>
                                </span>
                              ))}

                            {Object.keys(territory.postal_code_breakdown).length > 3 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedTerritoryId(isExpanded ? null : territory.territory_id);
                                }}
                                className="text-[10px] text-[#735c41] underline hover:text-[#1b1c19] self-center ml-1"
                              >
                                {isExpanded
                                  ? 'Show Less'
                                  : `+${Object.keys(territory.postal_code_breakdown).length - 3} more`}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'table' ? (
          /* TABLE VIEW MODE */
          <div className="overflow-x-auto rounded-lg border border-[#d1c4b9] bg-white shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#d1c4b9] bg-[#f0eee9] font-medium text-[#59452b]">
                  <th className="px-4 py-3">Territory Code</th>
                  <th className="px-4 py-3">Territory Name</th>
                  <th className="px-4 py-3">Density Level</th>
                  <th className="px-4 py-3 text-right">Lead Count</th>
                  <th className="px-4 py-3 text-right">Opportunities</th>
                  <th className="px-4 py-3 text-right">Total Deal Value</th>
                  <th className="px-4 py-3 text-right">Avg Deal Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1c4b9]/40 text-[#1b1c19]">
                {filteredTerritories.map((territory) => {
                  const intensity = calculateHeatIntensity(
                    territory.lead_count,
                    maxMetrics.maxLeadCount,
                    territory.total_deal_value,
                    maxMetrics.maxDealValue
                  );

                  return (
                    <tr
                      key={territory.territory_id}
                      onClick={() => handleCardClick(territory)}
                      className="hover:bg-[#f5f3ee] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#80756b]">
                        {territory.territory_code}
                      </td>
                      <td className="px-4 py-3 font-serif font-medium">{territory.territory_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium border',
                            intensity.badgeClass
                          )}
                        >
                          {intensity.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-serif">{formatNumber(territory.lead_count)}</td>
                      <td className="px-4 py-3 text-right font-serif">{formatNumber(territory.opportunity_count)}</td>
                      <td className="px-4 py-3 text-right font-serif font-medium">
                        {formatCurrency(territory.total_deal_value)}
                      </td>
                      <td className="px-4 py-3 text-right font-serif text-[#4e453d]">
                        {formatCurrency(territory.average_deal_value)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* POSTAL CODE BREAKDOWN VIEW MODE */
          <div className="space-y-4">
            {filteredTerritories.map((territory) => (
              <div
                key={territory.territory_id}
                className="rounded-lg border border-[#d1c4b9] bg-[#fbf9f4] p-4 shadow-xs"
              >
                <div className="flex items-center justify-between border-b border-[#d1c4b9]/30 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#735c41]" />
                    <h4 className="font-serif text-sm font-medium text-[#1b1c19]">
                      {territory.territory_name} ({territory.territory_code})
                    </h4>
                  </div>
                  <span className="text-xs text-[#4e453d]">
                    Total Leads: {formatNumber(territory.lead_count)} | Value: {formatCurrency(territory.total_deal_value)}
                  </span>
                </div>

                {territory.postal_code_breakdown &&
                Object.keys(territory.postal_code_breakdown).length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {Object.entries(territory.postal_code_breakdown).map(([zip, count]) => (
                      <div
                        key={zip}
                        className="rounded border border-[#d1c4b9]/50 bg-white p-2 text-center text-xs"
                      >
                        <span className="block font-mono text-[11px] font-semibold text-[#59452b]">
                          {zip}
                        </span>
                        <span className="block font-serif text-sm text-[#1b1c19] font-medium">
                          {count} leads
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#80756b] italic">No postal code data mapped for this territory.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* UNASSIGNED TERRITORY DRAWER OVERLAY [FR-007, Edge Cases] */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs transition-opacity"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unassigned-drawer-title"
        >
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-[#fbf9f4] border-l border-[#d1c4b9] shadow-2xl flex flex-col">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-[#d1c4b9] p-4 bg-[#f0eee9]">
                <div className="flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-[#735c41]" />
                  <div>
                    <h3 id="unassigned-drawer-title" className="font-serif text-base font-normal text-[#1b1c19]">
                      Unassigned Territory Drawer
                    </h3>
                    <p className="text-[11px] text-[#4e453d]">
                      Unmapped, missing, or incomplete address records [FR-007]
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  aria-label="Close Unassigned Drawer"
                  className="rounded-md p-1 text-[#80756b] hover:bg-[#e4e2dd] hover:text-[#1b1c19] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Summary Banner */}
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>Unmapped Lead Count:</span>
                    <span className="font-serif text-sm">{formatNumber(summary.unassignedLeadsCount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Unmapped Deal Value:</span>
                    <span className="font-serif text-sm">{formatCurrency(summary.unassignedValue)}</span>
                  </div>
                  <p className="text-[11px] text-amber-800 pt-1 border-t border-amber-200">
                    Lead records without valid postal codes or matching territory rules fall here to protect heat map density accuracy.
                  </p>
                </div>

                {/* Drawer Search Filter */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#80756b]" />
                  <input
                    type="text"
                    placeholder="Search unassigned leads or reasons..."
                    value={unassignedSearch}
                    onChange={(e) => setUnassignedSearch(e.target.value)}
                    className="w-full rounded-md border border-[#d1c4b9] bg-white pl-8 pr-3 py-1.5 text-xs text-[#1b1c19] focus:border-[#735c41] focus:outline-none"
                  />
                  {unassignedSearch && (
                    <button
                      type="button"
                      onClick={() => setUnassignedSearch('')}
                      className="absolute right-2.5 top-2.5 text-[#80756b] hover:text-[#1b1c19]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Unassigned Items List */}
                <div className="space-y-2">
                  {filteredUnassignedItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#80756b] border border-dashed border-[#d1c4b9] rounded-lg">
                      No unassigned items match your search.
                    </div>
                  ) : (
                    filteredUnassignedItems.map((item) => (
                      <div
                        key={item.lead_id}
                        className="rounded-md border border-[#d1c4b9]/60 bg-white p-3 text-xs space-y-1.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-[11px] text-[#59452b]">
                            Lead: {item.lead_id}
                          </span>
                          <span className="rounded bg-[#f0eee9] px-2 py-0.5 text-[10px] font-medium text-[#4e453d]">
                            {item.stage_name}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-[11px] text-[#4e453d]">
                          <div>
                            Postal Code:{' '}
                            <strong className="text-[#1b1c19]">
                              {item.postal_code || 'Missing / Incomplete'}
                            </strong>
                          </div>
                          <div className="text-right">
                            Value:{' '}
                            <strong className="text-[#1b1c19]">
                              {formatCurrency(item.deal_value)}
                            </strong>
                          </div>
                        </div>

                        <div className="text-[10px] text-red-800 bg-red-50 rounded px-2 py-1 border border-red-200">
                          <strong>Reason:</strong> {item.reason}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="border-t border-[#d1c4b9] p-4 bg-[#f0eee9] flex items-center justify-between">
                <span className="text-xs text-[#4e453d]">
                  {filteredUnassignedItems.length} records shown
                </span>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-md bg-[#59452b] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#735c41] transition-colors"
                >
                  Close Drawer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TerritoryHeatMap;
