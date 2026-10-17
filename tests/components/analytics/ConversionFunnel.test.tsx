import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  ConversionFunnel,
  formatPercentage,
  formatStageCount,
  getStageWidth,
  getBottleneckSeverity,
  calculateOverallFunnelMetrics,
  filterFunnelStages,
  getDatePresetRange,
} from '../../../src/components/analytics/ConversionFunnel';
import * as analyticsService from '../../../src/services/analytics';
import { FunnelStage } from '../../../src/services/analytics';

describe('ConversionFunnel Component [FR-004, FR-005, NFR-001]', () => {
  const mockFunnelStages: FunnelStage[] = [
    {
      stage_name: 'Lead',
      count: 1000,
      lead_count: 1000,
      conversion_rate: 100.0,
      dropoff_rate: 0.0,
      is_bottleneck: false,
      threshold_percent: 30.0,
      overall_conversion_rate: 100.0,
    },
    {
      stage_name: 'MQL',
      count: 750,
      lead_count: 750,
      conversion_rate: 75.0,
      dropoff_rate: 25.0,
      is_bottleneck: false,
      threshold_percent: 30.0,
      overall_conversion_rate: 75.0,
    },
    {
      stage_name: 'SQL',
      count: 300,
      lead_count: 300,
      conversion_rate: 40.0,
      dropoff_rate: 60.0, // Exceeds threshold 30% [FR-005]
      is_bottleneck: true,
      threshold_percent: 30.0,
      overall_conversion_rate: 30.0,
    },
    {
      stage_name: 'Opportunity',
      count: 200,
      lead_count: 200,
      conversion_rate: 66.7,
      dropoff_rate: 33.3,
      is_bottleneck: false,
      threshold_percent: 35.0,
      overall_conversion_rate: 20.0,
    },
    {
      stage_name: 'Customer',
      count: 100,
      lead_count: 100,
      conversion_rate: 50.0,
      dropoff_rate: 50.0,
      is_bottleneck: false,
      threshold_percent: 60.0,
      overall_conversion_rate: 10.0,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Helper Functions [FR-004, FR-005]', () => {
    it('formatPercentage formats numbers to 1 decimal percentage string', () => {
      expect(formatPercentage(75)).toBe('75.0%');
      expect(formatPercentage(33.333)).toBe('33.3%');
      expect(formatPercentage(0)).toBe('0.0%');
      expect(formatPercentage(null)).toBe('0.0%');
      expect(formatPercentage(undefined)).toBe('0.0%');
      expect(formatPercentage(NaN)).toBe('0.0%');
    });

    it('formatStageCount formats numbers with comma separators', () => {
      expect(formatStageCount(1000)).toBe('1,000');
      expect(formatStageCount(1250500)).toBe('1,250,500');
      expect(formatStageCount(0)).toBe('0');
      expect(formatStageCount(null)).toBe('0');
      expect(formatStageCount(undefined)).toBe('0');
    });

    it('getStageWidth calculates visual bar ratio with 10% minimum threshold', () => {
      expect(getStageWidth(1000, 1000)).toBe(100);
      expect(getStageWidth(500, 1000)).toBe(50);
      expect(getStageWidth(20, 1000)).toBe(10); // Minimum bar width
      expect(getStageWidth(0, 1000)).toBe(10);
      expect(getStageWidth(500, 0)).toBe(10);
    });

    it('getBottleneckSeverity determines bottleneck flags, severity tags, and excess percent [FR-005]', () => {
      // Normal flow
      const normal = getBottleneckSeverity(20, 30, false);
      expect(normal.isBottleneck).toBe(false);
      expect(normal.label).toBe('Normal Flow');
      expect(normal.severityClass).toContain('emerald');

      // Moderate bottleneck
      const moderate = getBottleneckSeverity(40, 30, true);
      expect(moderate.isBottleneck).toBe(true);
      expect(moderate.excessPercent).toBe(10);
      expect(moderate.label).toBe('Bottleneck Detected');
      expect(moderate.severityClass).toContain('amber');

      // Critical bottleneck (excess >= 15%)
      const critical = getBottleneckSeverity(60, 30, true);
      expect(critical.isBottleneck).toBe(true);
      expect(critical.excessPercent).toBe(30);
      expect(critical.label).toBe('Critical Bottleneck');
      expect(critical.severityClass).toContain('rose');
    });

    it('calculateOverallFunnelMetrics summarizes initial/final leads and conversion rates [FR-004]', () => {
      const summary = calculateOverallFunnelMetrics(mockFunnelStages);

      expect(summary.totalInitialLeads).toBe(1000);
      expect(summary.totalFinalLeads).toBe(100);
      expect(summary.overallConversionRate).toBe(10.0);
      expect(summary.totalDropoffRate).toBe(90.0);
      expect(summary.bottleneckCount).toBe(1); // SQL is_bottleneck=true
      expect(summary.totalStages).toBe(5);

      // Empty stages array handling
      const emptySummary = calculateOverallFunnelMetrics([]);
      expect(emptySummary.totalInitialLeads).toBe(0);
      expect(emptySummary.overallConversionRate).toBe(0);
      expect(emptySummary.bottleneckCount).toBe(0);
    });

    it('filterFunnelStages filters stages by stage_name query', () => {
      const filtered = filterFunnelStages(mockFunnelStages, 'mql');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].stage_name).toBe('MQL');

      const all = filterFunnelStages(mockFunnelStages, '');
      expect(all).toHaveLength(5);
    });

    it('getDatePresetRange returns valid start and end dates', () => {
      const p30d = getDatePresetRange('30d');
      expect(p30d.start_date_val).toBeDefined();
      expect(p30d.end_date_val).toBeDefined();

      const pAll = getDatePresetRange('all');
      expect(pAll.start_date_val).toBeUndefined();
      expect(pAll.end_date_val).toBeUndefined();
    });
  });

  describe('Component Rendering & User Interactions [FR-004, FR-005, NFR-001]', () => {
    it('renders header, KPI summary cards, and stage flow cards with initialData [FR-004]', () => {
      render(
        <ConversionFunnel initialData={mockFunnelStages} autoFetch={false} />
      );

      // Header
      expect(screen.getByText('Conversion Funnel')).toBeInPrimaryAttribute || expect(screen.getByText('Conversion Funnel')).toBeInTheDocument();

      // KPI Summary cards
      expect(screen.getByText('1,000')).toBeInTheDocument(); // Top of Funnel
      expect(screen.getByText('100')).toBeInTheDocument(); // Converted
      expect(screen.getByText('10.0%')).toBeInTheDocument(); // Overall Conversion
      expect(screen.getByText('90.0%')).toBeInTheDocument(); // Total Drop-off

      // Stage names rendered
      expect(screen.getByText('Lead')).toBeInTheDocument();
      expect(screen.getByText('MQL')).toBeInTheDocument();
      expect(screen.getByText('SQL')).toBeInTheDocument();
      expect(screen.getByText('Opportunity')).toBeInTheDocument();
      expect(screen.getByText('Customer')).toBeInTheDocument();
    });

    it('displays bottleneck alert banner when a stage bottleneck is detected [FR-005]', () => {
      render(
        <ConversionFunnel initialData={mockFunnelStages} autoFetch={false} />
      );

      // Alert banner header
      expect(screen.getByText(/1 Conversion Bottleneck Detected/i)).toBeInTheDocument();
      expect(screen.getByText(/SQL/i)).toBeInTheDocument();
      expect(screen.getByText(/60.0% drop-off/i)).toBeInTheDocument();
    });

    it('toggles view mode between Funnel Flow and Data Table View', () => {
      render(
        <ConversionFunnel initialData={mockFunnelStages} autoFetch={false} />
      );

      // Click Data Table View button
      const tableBtn = screen.getByRole('button', { name: /Data Table/i });
      fireEvent.click(tableBtn);

      // Table headers rendered
      expect(screen.getByText('Stage Name')).toBeInTheDocument();
      expect(screen.getByText('Lead Count')).toBeInTheDocument();
      expect(screen.getByText('Step Conversion')).toBeInTheDocument();
      expect(screen.getByText('Drop-off Rate')).toBeInTheDocument();
      expect(screen.getByText('Max Threshold')).toBeInTheDocument();

      // Click Funnel Flow button
      const flowBtn = screen.getByRole('button', { name: /Funnel Flow/i });
      fireEvent.click(flowBtn);

      // Back to Funnel Flow
      expect(screen.getByText('Cumulative Lead Loss')).toBeInTheDocument();
    });

    it('filters stages using search query input', () => {
      render(
        <ConversionFunnel initialData={mockFunnelStages} autoFetch={false} />
      );

      const searchInput = screen.getByPlaceholderText('Search stage...');
      fireEvent.change(searchInput, { target: { value: 'MQL' } });

      expect(screen.getByText('MQL')).toBeInTheDocument();
      expect(screen.queryByText('Customer')).not.toBeInTheDocument();
    });

    it('calls API service function when user clicks Refresh button', async () => {
      const getFunnelSpy = vi
        .spyOn(analyticsService, 'getConversionFunnel')
        .mockResolvedValue(mockFunnelStages);

      const onRefreshMock = vi.fn();

      render(
        <ConversionFunnel
          initialData={mockFunnelStages}
          onRefresh={onRefreshMock}
          autoFetch={false}
        />
      );

      const refreshBtn = screen.getByRole('button', { name: /Refresh/i });
      fireEvent.click(refreshBtn);

      await waitFor(() => {
        expect(getFunnelSpy).toHaveBeenCalled();
        expect(onRefreshMock).toHaveBeenCalled();
      });
    });

    it('triggers onExport callback when CSV or PDF export buttons are clicked', () => {
      const onExportMock = vi.fn();

      render(
        <ConversionFunnel
          initialData={mockFunnelStages}
          onExport={onExportMock}
          autoFetch={false}
        />
      );

      const csvBtn = screen.getByRole('button', { name: /Export CSV/i });
      fireEvent.click(csvBtn);
      expect(onExportMock).toHaveBeenCalledWith('csv');

      const pdfBtn = screen.getByRole('button', { name: /PDF/i });
      fireEvent.click(pdfBtn);
      expect(onExportMock).toHaveBeenCalledWith('pdf');
    });

    it('renders loading state when loading prop is true', () => {
      render(<ConversionFunnel loading={true} autoFetch={false} />);

      expect(screen.getByText(/Loading conversion funnel data/i)).toBeInTheDocument();
    });

    it('renders error alert message and retry button when error prop is passed', () => {
      render(
        <ConversionFunnel
          error="Network connection failure"
          autoFetch={false}
        />
      );

      expect(screen.getByText(/Error Loading Conversion Funnel/i)).toBeInTheDocument();
      expect(screen.getByText(/Network connection failure/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });

    it('renders empty state when stages data is empty', () => {
      render(<ConversionFunnel initialData={[]} autoFetch={false} />);

      expect(screen.getByText(/No Funnel Stages Found/i)).toBeInTheDocument();
    });
  });
});
