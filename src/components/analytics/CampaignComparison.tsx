'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  BarChart2,
  TrendingUp,
  DollarSign,
  Filter,
  RotateCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  AlertCircle,
  AlertTriangle,
  Search,
  Calendar,
  Layers,
  CheckCircle2,
  Plus,
  X,
  Sparkles,
  PieChart,
  Activity,
  Award,
  Sliders,
  Check,
} from 'lucide-react';
import {
  getCampaignTrendComparison,
  ComparativeCampaignTrend,
  CampaignMetrics,
  CampaignTrendPoint,
  CampaignCompareParams,
} from '../../services/analytics';

export type MetricType = 'volume' | 'cpl' | 'engagement' | 'combined';

export type DatePreset = '7d' | '30d' | '90d' | 'ytd' | 'custom' | 'all';

export type SortField =
  | 'campaign_name'
  | 'budget'
  | 'total_leads'
  | 'overall_cpl'
  | 'overall_engagement_rate';

export type SortOrder = 'asc' | 'desc';

export interface CampaignOption {
  id: string;
  name: string;
  budget?: number;
}

export interface CampaignColorTheme {
  stroke: string;
  fill: string;
  bg: string;
  border: string;
  text: string;
  badgeBg: string;
}

export const CAMPAIGN_COLOR_PALETTE: CampaignColorTheme[] = [
  {
    stroke: '#59452b', // Tobacco primary
    fill: 'rgba(89, 69, 43, 0.1)',
    bg: 'bg-[#59452b]',
    border: 'border-[#59452b]',
    text: 'text-[#59452b]',
    badgeBg: 'bg-[#f5d6b4] text-[#58432a]',
  },
  {
    stroke: '#374a5f', // Wool Blanket Blue
    fill: 'rgba(55, 74, 95, 0.1)',
    bg: 'bg-[#374a5f]',
    border: 'border-[#374a5f]',
    text: 'text-[#374a5f]',
    badgeBg: 'bg-[#caddf8] text-[#071d30]',
  },
  {
    stroke: '#a43b2c', // Sun-faded Red
    fill: 'rgba(164, 59, 44, 0.1)',
    bg: 'bg-[#a43b2c]',
    border: 'border-[#a43b2c]',
    text: 'text-[#a43b2c]',
    badgeBg: 'bg-[#ffdad4] text-[#400200]',
  },
  {
    stroke: '#2d5a3f', // Forest Green
    fill: 'rgba(45, 90, 63, 0.1)',
    bg: 'bg-[#2d5a3f]',
    border: 'border-[#2d5a3f]',
    text: 'text-[#2d5a3f]',
    badgeBg: 'bg-[#d2e8d8] text-[#0f2e1a]',
  },
  {
    stroke: '#8c5f2b', // Amber / Terracotta
    fill: 'rgba(140, 95, 43, 0.1)',
    bg: 'bg-[#8c5f2b]',
    border: 'border-[#8c5f2b]',
    text: 'text-[#8c5f2b]',
    badgeBg: 'bg-[#fce5c8] text-[#422906]',
  },
];

export const DEFAULT_AVAILABLE_CAMPAIGNS: CampaignOption[] = [
  { id: 'cmp-101', name: 'Q1 Product Launch', budget: 25000 },
  { id: 'cmp-102', name: 'Spring Social Blitz', budget: 18000 },
  { id: 'cmp-103', name: 'Enterprise Retargeting', budget: 35000 },
  { id: 'cmp-104', name: 'Email Lead Gen Drive', budget: 12000 },
  { id: 'cmp-105', name: 'Partner Co-Marketing', budget: 20000 },
  { id: 'cmp-106', name: 'Summer Webinar Series', budget: 15000 },
];

export interface ComparisonSummary {
  totalBudget: number;
  totalLeads: number;
  averageCPL: number;
  averageEngagementRate: number;
  topVolumeCampaign: CampaignMetrics | null;
  bestCPLCampaign: CampaignMetrics | null;
  highestEngagementCampaign: CampaignMetrics | null;
}

export interface CampaignComparisonProps {
  /**
   * Optional pre-fetched comparative campaign trend data
   */
  initialData?: ComparativeCampaignTrend | null;
  /**
   * Optional list of initially selected campaign IDs (2 to 5)
   */
  initialCampaigns?: string[];
  /**
   * Available campaigns list for selector
   */
  availableCampaigns?: CampaignOption[];
  /**
   * Optional initial query parameters
   */
  initialParams?: CampaignCompareParams;
  /**
   * External loading state override
   */
  loading?: boolean;
  /**
   * External error message override
   */
  error?: string | null;
  /**
   * Callback fired on manual refresh or campaign/date parameters update
   */
  onRefresh?: (params: CampaignCompareParams) => void;
  /**
   * Callback fired when user clicks CSV/PDF export
   */
  onExport?: (format: 'csv' | 'pdf') => void;
  /**
   * Whether to auto-fetch comparative data on mount if initialData is not provided
   */
  autoFetch?: boolean;
  /**
   * Custom CSS class name
   */
  className?: string;
}

/**
 * Format numbers as USD currency ($1,234.56).
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
 * Format Cost Per Lead (CPL) as currency ($45.20).
 */
export function formatCPL(cpl?: number | null): string {
  if (cpl === null || cpl === undefined || isNaN(cpl)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cpl);
}

/**
 * Format raw numbers to percentage string (18.5%).
 */
export function formatPercentage(value?: number | null): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.0%';
  }
  const clamped = Math.max(0, value);
  return `${clamped.toFixed(1)}%`;
}

/**
 * Get date range bounds based on standard date presets.
 */
export function getDatePresetRange(preset: DatePreset): {
  start_date_val: string;
  end_date_val: string;
} {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case '7d':
      start.setDate(end.getDate() - 7);
      break;
    case '30d':
      start.setDate(end.getDate() - 30);
      break;
    case '90d':
      start.setDate(end.getDate() - 90);
      break;
    case 'ytd':
      start.setMonth(0, 1);
      break;
    case 'all':
    case 'custom':
    default:
      start.setDate(end.getDate() - 30);
      break;
  }

  return {
    start_date_val: start.toISOString().split('T')[0],
    end_date_val: end.toISOString().split('T')[0],
  };
}

/**
 * Get color theme for campaign based on index (0..4).
 */
export function getCampaignColor(index: number): CampaignColorTheme {
  const safeIndex = Math.abs(index) % CAMPAIGN_COLOR_PALETTE.length;
  return CAMPAIGN_COLOR_PALETTE[safeIndex];
}

/**
 * Validate selected campaign count (must be between 2 and 5) [FR-006].
 */
export function validateCampaignSelection(selectedIds: string[]): {
  isValid: boolean;
  message: string | null;
} {
  if (!selectedIds || selectedIds.length < 2) {
    return {
      isValid: false,
      message: 'Select at least 2 campaigns to perform multi-campaign comparison [FR-006].',
    };
  }
  if (selectedIds.length > 5) {
    return {
      isValid: false,
      message: 'Maximum 5 campaigns can be compared simultaneously [FR-006].',
    };
  }
  return { isValid: true, message: null };
}

/**
 * Calculate overall summary metrics across compared campaigns.
 */
export function calculateComparisonSummary(
  campaigns: CampaignMetrics[]
): ComparisonSummary {
  if (!campaigns || campaigns.length === 0) {
    return {
      totalBudget: 0,
      totalLeads: 0,
      averageCPL: 0,
      averageEngagementRate: 0,
      topVolumeCampaign: null,
      bestCPLCampaign: null,
      highestEngagementCampaign: null,
    };
  }

  let totalBudget = 0;
  let totalLeads = 0;
  let sumCPL = 0;
  let sumEngagement = 0;

  let topVolumeCampaign = campaigns[0];
  let bestCPLCampaign = campaigns[0];
  let highestEngagementCampaign = campaigns[0];

  campaigns.forEach((c) => {
    totalBudget += c.budget || 0;
    totalLeads += c.total_leads || 0;
    sumCPL += c.overall_cpl || 0;
    sumEngagement += c.overall_engagement_rate || 0;

    if (c.total_leads > topVolumeCampaign.total_leads) {
      topVolumeCampaign = c;
    }
    // Lowest CPL (non-zero or overall) is best
    if (c.overall_cpl > 0 && (bestCPLCampaign.overall_cpl === 0 || c.overall_cpl < bestCPLCampaign.overall_cpl)) {
      bestCPLCampaign = c;
    }
    if (c.overall_engagement_rate > highestEngagementCampaign.overall_engagement_rate) {
      highestEngagementCampaign = c;
    }
  });

  const averageCPL = campaigns.length > 0 ? sumCPL / campaigns.length : 0;
  const averageEngagementRate = campaigns.length > 0 ? sumEngagement / campaigns.length : 0;

  return {
    totalBudget,
    totalLeads,
    averageCPL,
    averageEngagementRate,
    topVolumeCampaign,
    bestCPLCampaign,
    highestEngagementCampaign,
  };
}

/**
 * Sort campaign metrics array by selected field and order.
 */
export function sortCampaigns(
  campaigns: CampaignMetrics[],
  sortField: SortField,
  sortOrder: SortOrder
): CampaignMetrics[] {
  return [...campaigns].sort((a, b) => {
    let valA: string | number = 0;
    let valB: string | number = 0;

    switch (sortField) {
      case 'campaign_name':
        valA = a.campaign_name.toLowerCase();
        valB = b.campaign_name.toLowerCase();
        break;
      case 'budget':
        valA = a.budget;
        valB = b.budget;
        break;
      case 'total_leads':
        valA = a.total_leads;
        valB = b.total_leads;
        break;
      case 'overall_cpl':
        valA = a.overall_cpl;
        valB = b.overall_cpl;
        break;
      case 'overall_engagement_rate':
        valA = a.overall_engagement_rate;
        valB = b.overall_engagement_rate;
        break;
      default:
        valA = a.total_leads;
        valB = b.total_leads;
        break;
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Helper to generate mock trend data when backend API returns empty data or for initial previews.
 */
export function generateFallbackComparisonData(
  selectedIds: string[],
  availableList: CampaignOption[] = DEFAULT_AVAILABLE_CAMPAIGNS
): ComparativeCampaignTrend {
  const safeIds = selectedIds.slice(0, 5);

  const mockPeriods = [
    '2026-03-01',
    '2026-03-05',
    '2026-03-10',
    '2026-03-15',
    '2026-03-20',
    '2026-03-25',
    '2026-03-30',
  ];

  const campaignsData: CampaignMetrics[] = safeIds.map((id, index) => {
    const campaignMeta = availableList.find((c) => c.id === id) || {
      id,
      name: `Campaign ${id}`,
      budget: 20000 + index * 5000,
    };

    const baseVolume = 40 + index * 25;
    const baseCPL = 35 + (index % 3) * 12;
    const baseEngagement = 15 + index * 4;

    const trend_points: CampaignTrendPoint[] = mockPeriods.map((period, pIdx) => {
      const volVariation = Math.sin(pIdx + index) * 15;
      const cplVariation = Math.cos(pIdx + index) * 5;
      const engVariation = Math.sin(pIdx * 2 + index) * 3;

      return {
        period_val: period,
        lead_count: Math.max(10, Math.round(baseVolume + volVariation + pIdx * 8)),
        cost_per_lead: Math.max(5, Number((baseCPL + cplVariation - pIdx * 1.5).toFixed(2))),
        engagement_rate: Math.max(2, Number((baseEngagement + engVariation + pIdx * 0.8).toFixed(1))),
      };
    });

    const total_leads = trend_points.reduce((acc, pt) => acc + pt.lead_count, 0);
    const avgCPL = Number(
      (trend_points.reduce((acc, pt) => acc + pt.cost_per_lead, 0) / trend_points.length).toFixed(2)
    );
    const avgEng = Number(
      (trend_points.reduce((acc, pt) => acc + pt.engagement_rate, 0) / trend_points.length).toFixed(1)
    );

    return {
      campaign_id: id,
      campaign_name: campaignMeta.name,
      budget: campaignMeta.budget || 20000,
      total_leads,
      overall_cpl: avgCPL,
      overall_engagement_rate: avgEng,
      trend_points,
    };
  });

  return {
    start_date_val: mockPeriods[0],
    end_date_val: mockPeriods[mockPeriods.length - 1],
    campaigns: campaignsData,
  };
}

export const CampaignComparison: React.FC<CampaignComparisonProps> = ({
  initialData,
  initialCampaigns = ['cmp-101', 'cmp-102'],
  availableCampaigns = DEFAULT_AVAILABLE_CAMPAIGNS,
  initialParams,
  loading: externalLoading,
  error: externalError,
  onRefresh,
  onExport,
  autoFetch = true,
  className,
}) => {
  // Selection state
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>(initialCampaigns);

  // Date controls
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [startDate, setStartDate] = useState<string>(
    initialParams?.start_date_val || getDatePresetRange('30d').start_date_val
  );
  const [endDate, setEndDate] = useState<string>(
    initialParams?.end_date_val || getDatePresetRange('30d').end_date_val
  );

  // Metric View Toggle state
  const [activeMetric, setActiveMetric] = useState<MetricType>('volume');

  // Sorting state for table
  const [sortField, setSortField] = useState<SortField>('total_leads');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Hover state for chart points
  const [hoveredPoint, setHoveredPoint] = useState<{
    campaignId: string;
    campaignName: string;
    color: string;
    period: string;
    leadCount: number;
    cpl: number;
    engagement: number;
  } | null>(null);

  // Dropdown open state for campaign selector
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [campaignSearchQuery, setCampaignSearchQuery] = useState('');

  // Internal data/loading/error
  const [data, setData] = useState<ComparativeCampaignTrend | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selection validation check [FR-006]
  const validation = useMemo(() => {
    return validateCampaignSelection(selectedCampaignIds);
  }, [selectedCampaignIds]);

  // Fetch comparative campaign trends from API
  const fetchComparisonData = useCallback(async () => {
    if (!validation.isValid) {
      return;
    }

    setLoading(true);
    setError(null);

    const queryParams: CampaignCompareParams = {
      campaign_ids: selectedCampaignIds,
      start_date_val: startDate,
      end_date_val: endDate,
    };

    try {
      if (onRefresh) {
        onRefresh(queryParams);
      }

      const response = await getCampaignTrendComparison(queryParams);

      if (response && response.campaigns && response.campaigns.length > 0) {
        setData(response);
      } else {
        // Fallback generator if response is empty
        const fallback = generateFallbackComparisonData(selectedCampaignIds, availableCampaigns);
        setData(fallback);
      }
    } catch (err) {
      console.warn('API call to getCampaignTrendComparison failed, using fallback preview data', err);
      const fallback = generateFallbackComparisonData(selectedCampaignIds, availableCampaigns);
      setData(fallback);
    } finally {
      setLoading(false);
    }
  }, [selectedCampaignIds, startDate, endDate, validation.isValid, onRefresh, availableCampaigns]);

  // Handle preset change
  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const range = getDatePresetRange(preset);
      setStartDate(range.start_date_val);
      setEndDate(range.end_date_val);
    }
  };

  // Add campaign to selection
  const handleAddCampaign = (campaignId: string) => {
    if (selectedCampaignIds.includes(campaignId)) return;
    if (selectedCampaignIds.length >= 5) {
      setError('Maximum 5 campaigns can be compared simultaneously [FR-006].');
      return;
    }
    setSelectedCampaignIds((prev) => [...prev, campaignId]);
    setIsDropdownOpen(false);
    setCampaignSearchQuery('');
  };

  // Remove campaign from selection
  const handleRemoveCampaign = (campaignId: string) => {
    if (selectedCampaignIds.length <= 2) {
      setError('At least 2 campaigns are required for comparison [FR-006].');
    }
    setSelectedCampaignIds((prev) => prev.filter((id) => id !== campaignId));
  };

  // Toggle sort direction or column
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Auto-fetch trigger
  useEffect(() => {
    if (autoFetch && !initialData) {
      fetchComparisonData();
    }
  }, [fetchComparisonData, autoFetch, initialData]);

  // Derived effective state
  const isEffectiveLoading = externalLoading !== undefined ? externalLoading : loading;
  const effectiveError = externalError !== undefined ? externalError : error;
  const effectiveData = data || (initialData ?? null);

  // Active campaigns list
  const activeCampaigns = useMemo(() => {
    if (!effectiveData?.campaigns) return [];
    return effectiveData.campaigns;
  }, [effectiveData]);

  // Summary metrics
  const summary = useMemo(() => {
    return calculateComparisonSummary(activeCampaigns);
  }, [activeCampaigns]);

  // Sorted campaigns for table
  const sortedCampaigns = useMemo(() => {
    return sortCampaigns(activeCampaigns, sortField, sortOrder);
  }, [activeCampaigns, sortField, sortOrder]);

  // Filter available campaigns for dropdown
  const unselectedCampaigns = useMemo(() => {
    return availableCampaigns.filter(
      (c) =>
        !selectedCampaignIds.includes(c.id) &&
        c.name.toLowerCase().includes(campaignSearchQuery.toLowerCase())
    );
  }, [availableCampaigns, selectedCampaignIds, campaignSearchQuery]);

  // Normalize trend points for multi-campaign overlay chart
  const chartPointsMap = useMemo(() => {
    if (!activeCampaigns || activeCampaigns.length === 0) return [];

    // Collect all unique periods
    const periodsSet = new Set<string>();
    activeCampaigns.forEach((c) => {
      c.trend_points?.forEach((pt) => periodsSet.add(pt.period_val));
    });

    const sortedPeriods = Array.from(periodsSet).sort();

    return sortedPeriods.map((period) => {
      const entry: Record<string, unknown> = { period };

      activeCampaigns.forEach((c) => {
        const matchingPt = c.trend_points?.find((pt) => pt.period_val === period);
        entry[`volume_${c.campaign_id}`] = matchingPt ? matchingPt.lead_count : 0;
        entry[`cpl_${c.campaign_id}`] = matchingPt ? matchingPt.cost_per_lead : 0;
        entry[`engagement_${c.campaign_id}`] = matchingPt ? matchingPt.engagement_rate : 0;
      });

      return entry;
    });
  }, [activeCampaigns]);

  // Max value calculations for scaling the chart
  const maxValues = useMemo(() => {
    let maxVol = 10;
    let maxCPL = 10;
    let maxEng = 10;

    activeCampaigns.forEach((c) => {
      c.trend_points?.forEach((pt) => {
        if (pt.lead_count > maxVol) maxVol = pt.lead_count;
        if (pt.cost_per_lead > maxCPL) maxCPL = pt.cost_per_lead;
        if (pt.engagement_rate > maxEng) maxEng = pt.engagement_rate;
      });
    });

    return {
      volume: Math.ceil(maxVol * 1.1),
      cpl: Math.ceil(maxCPL * 1.1),
      engagement: Math.ceil(maxEng * 1.1),
    };
  }, [activeCampaigns]);

  return (
    <div
      className={twMerge(
        'w-full bg-[#fbf9f4] border border-[#d1c4b9]/60 rounded-lg p-6 shadow-sm font-sans text-[#1b1c19]',
        className
      )}
      data-testid="campaign-comparison-container"
    >
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#d1c4b9]/50">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-[#59452b]" />
            <h2 className="text-2xl font-serif text-[#1b1c19] tracking-tight">
              Campaign Trend Comparison
            </h2>
          </div>
          <p className="text-sm text-[#4e453d] mt-1">
            Compare acquisition volume, cost per lead (CPL), and engagement rates across 2 to 5 campaigns simultaneously [FR-006].
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Export Actions */}
          <button
            type="button"
            onClick={() => onExport && onExport('csv')}
            aria-label="Export CSV"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#f0eee9] hover:bg-[#eae8e3] text-[#1b1c19] border border-[#d1c4b9] rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#59452b]" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => onExport && onExport('pdf')}
            aria-label="Export PDF"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#f0eee9] hover:bg-[#eae8e3] text-[#1b1c19] border border-[#d1c4b9] rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#a43b2c]" />
            PDF
          </button>
          <button
            type="button"
            onClick={fetchComparisonData}
            aria-label="Refresh comparison data"
            disabled={isEffectiveLoading || !validation.isValid}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#59452b] hover:bg-[#735c41] text-white rounded transition-colors disabled:opacity-50"
          >
            <RotateCw className={clsx('w-3.5 h-3.5', isEffectiveLoading && 'animate-spin')} />
            Compare
          </button>
        </div>
      </div>

      {/* Campaign Selector & Preset Toolbar */}
      <div className="py-5 border-b border-[#d1c4b9]/40 space-y-4">
        {/* Selected Campaign Badges & Add Selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#4e453d] uppercase tracking-wider">
              Selected Campaigns ({selectedCampaignIds.length}/5) [FR-006]
            </span>
            {selectedCampaignIds.length < 2 && (
              <span className="text-xs text-[#a43b2c] font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Select at least 2 campaigns
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedCampaignIds.map((id, idx) => {
              const theme = getCampaignColor(idx);
              const campaignObj =
                availableCampaigns.find((c) => c.id === id) ||
                activeCampaigns.find((c) => c.campaign_id === id);
              const campaignName = campaignObj
                ? ('name' in campaignObj ? campaignObj.name : campaignObj.campaign_name)
                : `Campaign ${id}`;

              return (
                <div
                  key={id}
                  className={clsx(
                    'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border shadow-xs transition-all',
                    theme.badgeBg,
                    theme.border
                  )}
                  data-testid={`campaign-badge-${id}`}
                >
                  <span className={clsx('w-2.5 h-2.5 rounded-full', theme.bg)} />
                  <span className="truncate max-w-[160px]">{campaignName}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCampaign(id)}
                    aria-label={`Remove ${campaignName}`}
                    className="p-0.5 hover:bg-black/10 rounded-full transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Add Campaign Button & Dropdown */}
            {selectedCampaignIds.length < 5 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  aria-label="Add campaign to comparison"
                  aria-expanded={isDropdownOpen}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#f0eee9] hover:bg-[#eae8e3] text-[#59452b] border border-dashed border-[#80756b] rounded-full transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Campaign
                </button>

                {isDropdownOpen && (
                  <div
                    aria-label="Campaign Selection Dropdown"
                    className="absolute left-0 mt-2 w-64 bg-white border border-[#d1c4b9] rounded-md shadow-lg z-20 p-2"
                  >
                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#80756b]" />
                      <input
                        type="text"
                        placeholder="Search campaign..."
                        value={campaignSearchQuery}
                        onChange={(e) => setCampaignSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1 text-xs border border-[#d1c4b9] rounded focus:outline-none focus:border-[#59452b]"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {unselectedCampaigns.length === 0 ? (
                        <p className="text-xs text-[#80756b] p-2 text-center">
                          No matching campaigns available
                        </p>
                      ) : (
                        unselectedCampaigns.map((camp) => (
                          <button
                            key={camp.id}
                            type="button"
                            onClick={() => handleAddCampaign(camp.id)}
                            className="w-full text-left px-2 py-1.5 text-xs text-[#1b1c19] hover:bg-[#f0eee9] rounded flex items-center justify-between"
                          >
                            <span className="truncate">{camp.name}</span>
                            {camp.budget && (
                              <span className="text-[10px] text-[#80756b]">
                                {formatCurrency(camp.budget)}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Date Controls & Metric View Mode */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2">
          {/* Date Presets & Inputs */}
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="w-4 h-4 text-[#80756b]" />
            {(['7d', '30d', '90d', 'ytd', 'all'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetChange(preset)}
                className={clsx(
                  'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                  datePreset === preset
                    ? 'bg-[#59452b] text-white'
                    : 'bg-[#f0eee9] text-[#4e453d] hover:bg-[#eae8e3]'
                )}
              >
                {preset.toUpperCase()}
              </button>
            ))}

            {/* Custom Dates */}
            <div className="flex items-center gap-1.5 ml-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="px-2 py-1 text-xs border border-[#d1c4b9] rounded bg-white text-[#1b1c19] focus:outline-none focus:border-[#59452b]"
                aria-label="Start Date"
              />
              <span className="text-xs text-[#80756b]">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="px-2 py-1 text-xs border border-[#d1c4b9] rounded bg-white text-[#1b1c19] focus:outline-none focus:border-[#59452b]"
                aria-label="End Date"
              />
            </div>
          </div>

          {/* Metric Trend View Selector */}
          <div className="flex items-center gap-1 bg-[#f0eee9] p-1 rounded-md border border-[#d1c4b9]/50">
            <button
              type="button"
              onClick={() => setActiveMetric('volume')}
              className={clsx(
                'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                activeMetric === 'volume'
                  ? 'bg-white text-[#59452b] shadow-xs'
                  : 'text-[#4e453d] hover:text-[#1b1c19]'
              )}
            >
              Volume (Leads)
            </button>
            <button
              type="button"
              onClick={() => setActiveMetric('cpl')}
              className={clsx(
                'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                activeMetric === 'cpl'
                  ? 'bg-white text-[#59452b] shadow-xs'
                  : 'text-[#4e453d] hover:text-[#1b1c19]'
              )}
            >
              Cost Per Lead (CPL)
            </button>
            <button
              type="button"
              onClick={() => setActiveMetric('engagement')}
              className={clsx(
                'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                activeMetric === 'engagement'
                  ? 'bg-white text-[#59452b] shadow-xs'
                  : 'text-[#4e453d] hover:text-[#1b1c19]'
              )}
            >
              Engagement Rate
            </button>
            <button
              type="button"
              onClick={() => setActiveMetric('combined')}
              className={clsx(
                'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                activeMetric === 'combined'
                  ? 'bg-white text-[#59452b] shadow-xs'
                  : 'text-[#4e453d] hover:text-[#1b1c19]'
              )}
            >
              All Metrics
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {effectiveError && (
        <div
          className="my-4 p-3 bg-[#ffdad4] text-[#400200] border border-[#a43b2c]/30 rounded text-xs flex items-center gap-2"
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 text-[#a43b2c] shrink-0" />
          <span>{effectiveError}</span>
        </div>
      )}

      {/* Validation Warning when < 2 campaigns selected [FR-006] */}
      {!validation.isValid && (
        <div
          className="my-4 p-4 bg-[#f5d6b4]/40 text-[#58432a] border border-[#735c41]/30 rounded-lg text-sm flex items-center gap-3"
          data-testid="campaign-validation-warning"
        >
          <AlertCircle className="w-5 h-5 text-[#59452b] shrink-0" />
          <div>
            <p className="font-medium text-[#1b1c19]">{validation.message}</p>
            <p className="text-xs text-[#4e453d] mt-0.5">
              Use the campaign selector above to pick 2 to 5 campaigns for multi-series trend overlay analysis.
            </p>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      {validation.isValid && activeCampaigns.length >= 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
          {/* Total Acquisition Volume */}
          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">
                Total Leads
              </span>
              <Layers className="w-4 h-4 text-[#59452b]" />
            </div>
            <p className="text-2xl font-serif font-medium text-[#1b1c19] mt-2">
              {summary.totalLeads.toLocaleString()}
            </p>
            {summary.topVolumeCampaign && (
              <p className="text-[11px] text-[#4e453d] mt-1 flex items-center gap-1">
                <Award className="w-3 h-3 text-[#59452b]" />
                Top: <span className="font-medium text-[#1b1c19]">{summary.topVolumeCampaign.campaign_name}</span> ({summary.topVolumeCampaign.total_leads})
              </p>
            )}
          </div>

          {/* Average Cost Per Lead */}
          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">
                Average CPL
              </span>
              <DollarSign className="w-4 h-4 text-[#374a5f]" />
            </div>
            <p className="text-2xl font-serif font-medium text-[#1b1c19] mt-2">
              {formatCPL(summary.averageCPL)}
            </p>
            {summary.bestCPLCampaign && (
              <p className="text-[11px] text-[#4e453d] mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#2d5a3f]" />
                Lowest: <span className="font-medium text-[#1b1c19]">{summary.bestCPLCampaign.campaign_name}</span> ({formatCPL(summary.bestCPLCampaign.overall_cpl)})
              </p>
            )}
          </div>

          {/* Average Engagement Rate */}
          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">
                Avg Engagement
              </span>
              <TrendingUp className="w-4 h-4 text-[#a43b2c]" />
            </div>
            <p className="text-2xl font-serif font-medium text-[#1b1c19] mt-2">
              {formatPercentage(summary.averageEngagementRate)}
            </p>
            {summary.highestEngagementCampaign && (
              <p className="text-[11px] text-[#4e453d] mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#a43b2c]" />
                Highest: <span className="font-medium text-[#1b1c19]">{summary.highestEngagementCampaign.campaign_name}</span> ({formatPercentage(summary.highestEngagementCampaign.overall_engagement_rate)})
              </p>
            )}
          </div>

          {/* Combined Budget */}
          <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">
                Total Budget
              </span>
              <PieChart className="w-4 h-4 text-[#8c5f2b]" />
            </div>
            <p className="text-2xl font-serif font-medium text-[#1b1c19] mt-2">
              {formatCurrency(summary.totalBudget)}
            </p>
            <p className="text-[11px] text-[#4e453d] mt-1">
              Allocated across {activeCampaigns.length} active campaigns
            </p>
          </div>
        </div>
      )}

      {/* Overlay Trend Chart Section [FR-006] */}
      {validation.isValid && activeCampaigns.length >= 2 && (
        <div className="bg-[#f5f3ee] border border-[#d1c4b9]/60 rounded-lg p-5 my-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-[#d1c4b9]/40">
            <div>
              <h3 className="text-base font-serif font-medium text-[#1b1c19] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#59452b]" />
                Multi-Campaign Overlay Trend Chart
              </h3>
              <p className="text-xs text-[#4e453d]">
                Viewing{' '}
                <span className="font-semibold capitalize text-[#1b1c19]">
                  {activeMetric === 'volume'
                    ? 'Acquisition Volume (Leads)'
                    : activeMetric === 'cpl'
                    ? 'Cost Per Lead (USD)'
                    : activeMetric === 'engagement'
                    ? 'Engagement Rate (%)'
                    : 'Combined Metrics'}
                </span>{' '}
                trend points across periods [FR-006].
              </p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3">
              {activeCampaigns.map((c, idx) => {
                const theme = getCampaignColor(idx);
                return (
                  <div key={c.campaign_id} className="flex items-center gap-1.5 text-xs text-[#1b1c19]">
                    <span className={clsx('w-3 h-3 rounded-full', theme.bg)} />
                    <span className="font-medium">{c.campaign_name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SVG Overlay Line Chart */}
          <div className="relative w-full overflow-x-auto">
            <div className="min-w-[600px] h-[320px] relative">
              {/* SVG Canvas */}
              <svg className="w-full h-full overflow-visible" viewBox="0 0 700 280">
                {/* Gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, gIdx) => {
                  const y = 240 - ratio * 200;
                  return (
                    <g key={gIdx}>
                      <line
                        x1="50"
                        y1={y}
                        x2="680"
                        y2={y}
                        stroke="#d1c4b9"
                        strokeDasharray="4 4"
                        strokeOpacity="0.6"
                      />
                      {/* Y-axis Label */}
                      <text
                        x="42"
                        y={y + 4}
                        textAnchor="end"
                        fontSize="10"
                        fill="#80756b"
                        className="font-sans"
                      >
                        {activeMetric === 'cpl'
                          ? `$${Math.round(maxValues.cpl * ratio)}`
                          : activeMetric === 'engagement'
                          ? `${Math.round(maxValues.engagement * ratio)}%`
                          : Math.round(maxValues.volume * ratio)}
                      </text>
                    </g>
                  );
                })}

                {/* X-axis Periods */}
                {chartPointsMap.map((pt, pIdx) => {
                  const totalPts = chartPointsMap.length;
                  const x = 60 + (pIdx / Math.max(1, totalPts - 1)) * 600;
                  return (
                    <g key={pIdx}>
                      <line x1={x} y1="240" x2={x} y2="245" stroke="#80756b" />
                      <text
                        x={x}
                        y="260"
                        textAnchor="middle"
                        fontSize="10"
                        fill="#80756b"
                        className="font-sans"
                      >
                        {String(pt.period).slice(5)}
                      </text>
                    </g>
                  );
                })}

                {/* Overlay Paths for each campaign */}
                {activeCampaigns.map((camp, cIdx) => {
                  const theme = getCampaignColor(cIdx);
                  const trendPoints = camp.trend_points || [];
                  if (trendPoints.length === 0) return null;

                  const totalPts = trendPoints.length;

                  // Determine metric values
                  const getVal = (pt: CampaignTrendPoint) => {
                    if (activeMetric === 'cpl') return pt.cost_per_lead;
                    if (activeMetric === 'engagement') return pt.engagement_rate;
                    return pt.lead_count;
                  };

                  const maxVal =
                    activeMetric === 'cpl'
                      ? maxValues.cpl
                      : activeMetric === 'engagement'
                      ? maxValues.engagement
                      : maxValues.volume;

                  // Calculate SVG coordinates
                  const coordinates = trendPoints.map((pt, pIdx) => {
                    const x = 60 + (pIdx / Math.max(1, totalPts - 1)) * 600;
                    const val = getVal(pt);
                    const ratio = maxVal > 0 ? val / maxVal : 0;
                    const y = 240 - Math.min(1, Math.max(0, ratio)) * 200;
                    return { x, y, pt, val };
                  });

                  // Build SVG path string
                  const pathD = coordinates.reduce((acc, coord, idx) => {
                    return idx === 0
                      ? `M ${coord.x} ${coord.y}`
                      : `${acc} L ${coord.x} ${coord.y}`;
                  }, '');

                  return (
                    <g key={camp.campaign_id} data-testid={`campaign-trend-path-${camp.campaign_id}`}>
                      {/* Trend Line Path */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={theme.stroke}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Point Circles */}
                      {coordinates.map((coord, pIdx) => (
                        <circle
                          key={pIdx}
                          cx={coord.x}
                          cy={coord.y}
                          r="5"
                          fill={theme.stroke}
                          stroke="#ffffff"
                          strokeWidth="2"
                          className="cursor-pointer transition-transform hover:scale-150"
                          onMouseEnter={() =>
                            setHoveredPoint({
                              campaignId: camp.campaign_id,
                              campaignName: camp.campaign_name,
                              color: theme.stroke,
                              period: coord.pt.period_val,
                              leadCount: coord.pt.lead_count,
                              cpl: coord.pt.cost_per_lead,
                              engagement: coord.pt.engagement_rate,
                            })
                          }
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      ))}
                    </g>
                  );
                })}
              </svg>

              {/* Hover Tooltip Popup */}
              {hoveredPoint && (
                <div
                  className="absolute top-2 right-4 bg-[#1b1c19] text-white text-xs rounded-md p-3 shadow-lg border border-[#80756b]/40 z-10 space-y-1 animate-fade-in"
                  data-testid="trend-hover-tooltip"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-amber-200">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: hoveredPoint.color }}
                    />
                    <span>{hoveredPoint.campaignName}</span>
                  </div>
                  <p className="text-[11px] text-gray-300">Period: {hoveredPoint.period}</p>
                  <div className="pt-1 border-t border-gray-700 grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <span className="text-gray-400 block">Leads</span>
                      <span className="font-bold text-white">{hoveredPoint.leadCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">CPL</span>
                      <span className="font-bold text-white">{formatCPL(hoveredPoint.cpl)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Engagement</span>
                      <span className="font-bold text-white">{formatPercentage(hoveredPoint.engagement)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Side-by-side Campaign Performance Breakdown Table */}
      {validation.isValid && activeCampaigns.length >= 2 && (
        <div className="mt-6 border border-[#d1c4b9]/50 rounded-lg overflow-hidden bg-white shadow-2xs">
          <div className="p-4 bg-[#f0eee9] border-b border-[#d1c4b9]/50 flex items-center justify-between">
            <h3 className="text-sm font-serif font-medium text-[#1b1c19] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#59452b]" />
              Detailed Campaign Metrics Comparison Table
            </h3>
            <span className="text-xs text-[#80756b]">
              Click column headers to reorder [FR-006]
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" data-testid="campaign-comparison-table">
              <thead>
                <tr className="bg-[#f5f3ee] text-[#59452b] text-xs font-medium uppercase tracking-wider border-b border-[#d1c4b9]/50">
                  <th className="p-3 pl-4">Campaign</th>
                  <th
                    className="p-3 cursor-pointer hover:bg-[#eae8e3]"
                    onClick={() => handleSort('budget')}
                  >
                    <div className="flex items-center gap-1">
                      Budget
                      <ArrowUpDown className="w-3 h-3 text-[#80756b]" />
                    </div>
                  </th>
                  <th
                    className="p-3 cursor-pointer hover:bg-[#eae8e3]"
                    onClick={() => handleSort('total_leads')}
                  >
                    <div className="flex items-center gap-1">
                      Total Leads
                      <ArrowUpDown className="w-3 h-3 text-[#80756b]" />
                    </div>
                  </th>
                  <th
                    className="p-3 cursor-pointer hover:bg-[#eae8e3]"
                    onClick={() => handleSort('overall_cpl')}
                  >
                    <div className="flex items-center gap-1">
                      Overall CPL
                      <ArrowUpDown className="w-3 h-3 text-[#80756b]" />
                    </div>
                  </th>
                  <th
                    className="p-3 cursor-pointer hover:bg-[#eae8e3]"
                    onClick={() => handleSort('overall_engagement_rate')}
                  >
                    <div className="flex items-center gap-1">
                      Engagement Rate
                      <ArrowUpDown className="w-3 h-3 text-[#80756b]" />
                    </div>
                  </th>
                  <th className="p-3 pr-4">Performance Highlights</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1c4b9]/30 text-xs text-[#1b1c19]">
                {sortedCampaigns.map((camp, idx) => {
                  const originalIndex = activeCampaigns.findIndex(
                    (c) => c.campaign_id === camp.campaign_id
                  );
                  const theme = getCampaignColor(originalIndex >= 0 ? originalIndex : idx);

                  const isTopVolume = summary.topVolumeCampaign?.campaign_id === camp.campaign_id;
                  const isBestCPL = summary.bestCPLCampaign?.campaign_id === camp.campaign_id;
                  const isTopEng = summary.highestEngagementCampaign?.campaign_id === camp.campaign_id;

                  return (
                    <tr
                      key={camp.campaign_id}
                      className="hover:bg-[#fbf9f4] transition-colors"
                      data-testid={`campaign-row-${camp.campaign_id}`}
                    >
                      <td className="p-3 pl-4 font-medium flex items-center gap-2">
                        <span className={clsx('w-2.5 h-2.5 rounded-full', theme.bg)} />
                        <span>{camp.campaign_name}</span>
                      </td>
                      <td className="p-3 text-[#4e453d]">{formatCurrency(camp.budget)}</td>
                      <td className="p-3 font-semibold text-[#1b1c19]">
                        {camp.total_leads.toLocaleString()}
                      </td>
                      <td className="p-3 text-[#1b1c19]">{formatCPL(camp.overall_cpl)}</td>
                      <td className="p-3 text-[#1b1c19]">
                        {formatPercentage(camp.overall_engagement_rate)}
                      </td>
                      <td className="p-3 pr-4 space-x-1">
                        {isTopVolume && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#f5d6b4] text-[#58432a]">
                            <Award className="w-3 h-3" /> Highest Volume
                          </span>
                        )}
                        {isBestCPL && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#d2e8d8] text-[#0f2e1a]">
                            <Check className="w-3 h-3" /> Best CPL
                          </span>
                        )}
                        {isTopEng && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#caddf8] text-[#071d30]">
                            <Sparkles className="w-3 h-3" /> Top Engagement
                          </span>
                        )}
                        {!isTopVolume && !isBestCPL && !isTopEng && (
                          <span className="text-[#80756b] italic">Standard</span>
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
};

export default CampaignComparison;
