import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  AcquisitionReport,
  formatCurrency,
  formatROI,
  getQualityScoreMeta,
  calculateSummaryMetrics,
  sortAcquisitionItems,
  getDatePresetRange,
} from '../../../src/components/analytics/AcquisitionReport';
import * as analyticsService from '../../../src/services/analytics';
import { AcquisitionReportItem } from '../../../src/services/analytics';

describe('AcquisitionReport Component [FR-001, FR-002, FR-003, NFR-001]', () => {
  const mockChannels: AcquisitionReportItem[] = [
    {
      channel_id: 'chan-1',
      channel_name: 'Paid Search',
      lead_count: 150,
      quality_score: 85.5,
      spend_amount: 5000.0,
      revenue_amount: 25000.0,
      roi: '400.00%',
    },
    {
      channel_id: 'chan-2',
      channel_name: 'Organic Social',
      lead_count: 300,
      quality_score: 92.0,
      spend_amount: 0.0, // Zero spend [FR-003]
      revenue_amount: 12000.0,
      roi: 'N/A',
    },
    {
      channel_id: 'chan-3',
      channel_name: 'Display Ads',
      lead_count: 80,
      quality_score: 45.0,
      spend_amount: 3000.0,
      revenue_amount: 0.0, // Zero revenue [FR-003]
      roi: 'N/A',
    },
    {
      channel_id: 'chan-4',
      channel_name: 'Email Marketing',
      lead_count: 220,
      quality_score: 78.0,
      spend_amount: 1500.0,
      revenue_amount: 9000.0,
      roi: '500.00%',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Helper Functions [FR-001, FR-002, FR-003]', () => {
    it('formatCurrency formats numbers into USD currency strings', () => {
      expect(formatCurrency(5000)).toBe('$5,000.00');
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(null)).toBe('$0.00');
      expect(formatCurrency(undefined)).toBe('$0.00');
      expect(formatCurrency(NaN)).toBe('$0.00');
    });

    it('formatROI calculates safe ROI or returns N/A for zero spend/revenue [FR-003]', () => {
      // Zero spend -> N/A
      expect(formatROI('400%', 0, 1000)).toBe('N/A');
      expect(formatROI('400%', null, 1000)).toBe('N/A');

      // Zero revenue -> N/A
      expect(formatROI('400%', 1000, 0)).toBe('N/A');
      expect(formatROI('400%', 1000, null)).toBe('N/A');

      // Explicit N/A
      expect(formatROI('N/A', 0, 0)).toBe('N/A');
      expect(formatROI(null, 100, 200)).toBe('N/A');

      // Valid ROI formatting
      expect(formatROI('400.00%', 1000, 5000)).toBe('400.00%');
      expect(formatROI('150.5', 1000, 2505)).toBe('150.50%');
    });

    it('getQualityScoreMeta returns correct badges, labels, and bar styles [FR-002]', () => {
      const high = getQualityScoreMeta(85.5);
      expect(high.label).toBe('High Quality');
      expect(high.tier).toBe('high');
      expect(high.badgeClass).toContain('emerald');

      const medium = getQualityScoreMeta(65.0);
      expect(medium.label).toBe('Moderate Quality');
      expect(medium.tier).toBe('medium');
      expect(medium.badgeClass).toContain('amber');

      const low = getQualityScoreMeta(40.0);
      expect(low.label).toBe('Low Quality');
      expect(low.tier).toBe('low');
      expect(low.badgeClass).toContain('rose');

      const unrated = getQualityScoreMeta(0);
      expect(unrated.label).toBe('Unrated');
      expect(unrated.tier).toBe('unrated');
    });

    it('calculateSummaryMetrics aggregates totals and average quality scores correctly', () => {
      const summary = calculateSummaryMetrics(mockChannels);
      expect(summary.totalLeads).toBe(750); // 150 + 300 + 80 + 220
      expect(summary.totalSpend).toBe(9500); // 5000 + 0 + 3000 + 1500
      expect(summary.totalRevenue).toBe(46000); // 25000 + 12000 + 0 + 9000
      expect(summary.averageQualityScore).toBe(75.1); // (85.5 + 92 + 45 + 78) / 4
      expect(summary.overallROI).toContain('%');
    });

    it('sortAcquisitionItems sorts items by quality score descending by default [FR-002]', () => {
      const sorted = sortAcquisitionItems(mockChannels, 'quality_score', 'desc');
      expect(sorted[0].channel_name).toBe('Organic Social'); // 92.0
      expect(sorted[1].channel_name).toBe('Paid Search'); // 85.5
      expect(sorted[2].channel_name).toBe('Email Marketing'); // 78.0
      expect(sorted[3].channel_name).toBe('Display Ads'); // 45.0
    });

    it('sortAcquisitionItems handles sorting by ROI with N/A values [FR-003]', () => {
      const sorted = sortAcquisitionItems(mockChannels, 'roi', 'desc');
      expect(sorted[0].channel_name).toBe('Email Marketing'); // 500%
      expect(sorted[1].channel_name).toBe('Paid Search'); // 400%
      // N/A items placed at bottom in desc sort
      expect(['Organic Social', 'Display Ads']).toContain(sorted[2].channel_name);
    });

    it('getDatePresetRange generates valid ISO date strings for preset ranges', () => {
      const range7d = getDatePresetRange('7d');
      expect(range7d.start_date_val).toBeTruthy();
      expect(range7d.end_date_val).toBeTruthy();

      const rangeAll = getDatePresetRange('all');
      expect(rangeAll.start_date_val).toBeUndefined();
      expect(rangeAll.end_date_val).toBeUndefined();
    });
  });

  describe('Component Rendering & User Interactions [FR-001, FR-002, FR-003]', () => {
    it('renders report header, KPI summary cards, and channel table with initial data', () => {
      render(
        <AcquisitionReport
          initialData={mockChannels}
          autoFetch={false}
        />
      );

      expect(screen.getByText('Channel Acquisition & ROI Report')).toBeInTheDocument();
      expect(screen.getByTestId('summary-total-leads')).toHaveTextContent('750');
      expect(screen.getByTestId('summary-total-spend')).toHaveTextContent('$9,500.00');
      expect(screen.getByTestId('summary-total-revenue')).toHaveTextContent('$46,000.00');

      // Check rendered channels
      expect(screen.getByText('Paid Search')).toBeInTheDocument();
      expect(screen.getByText('Organic Social')).toBeInTheDocument();
      expect(screen.getByText('Display Ads')).toBeInTheDocument();
      expect(screen.getByText('Email Marketing')).toBeInTheDocument();
    });

    it('displays "N/A" for channels with zero spend or zero revenue without crashing [FR-003]', () => {
      render(
        <AcquisitionReport
          initialData={mockChannels}
          autoFetch={false}
        />
      );

      const organicSocialRoi = screen.getByTestId('roi-value-chan-2');
      expect(organicSocialRoi).toHaveTextContent('N/A');

      const displayAdsRoi = screen.getByTestId('roi-value-chan-3');
      expect(displayAdsRoi).toHaveTextContent('N/A');
    });

    it('sorts acquisition channels by lead quality score descending [FR-002]', () => {
      render(
        <AcquisitionReport
          initialData={mockChannels}
          autoFetch={false}
        />
      );

      // Default sort in component is quality_score desc
      const rows = screen.getAllByTestId(/^channel-row-/);
      expect(rows[0]).toHaveTextContent('Organic Social'); // Score 92.0
      expect(rows[1]).toHaveTextContent('Paid Search'); // Score 85.5
      expect(rows[2]).toHaveTextContent('Email Marketing'); // Score 78.0
      expect(rows[3]).toHaveTextContent('Display Ads'); // Score 45.0
    });

    it('toggles column sort when clicking quality score column header [FR-002]', () => {
      render(
        <AcquisitionReport
          initialData={mockChannels}
          autoFetch={false}
        />
      );

      const qualityHeader = screen.getByTestId('header-quality-score');
      // Click quality score header to toggle from desc to asc
      fireEvent.click(qualityHeader);

      const rowsAsc = screen.getAllByTestId(/^channel-row-/);
      expect(rowsAsc[0]).toHaveTextContent('Display Ads'); // Lowest score 45.0 first
      expect(rowsAsc[3]).toHaveTextContent('Organic Social'); // Highest score 92.0 last
    });

    it('filters channel rows by search query input [FR-001]', () => {
      render(
        <AcquisitionReport
          initialData={mockChannels}
          autoFetch={false}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search channel...');
      fireEvent.change(searchInput, { target: { value: 'email' } });

      expect(screen.getByText('Email Marketing')).toBeInTheDocument();
      expect(screen.queryByText('Paid Search')).not.toBeInTheDocument();
    });

    it('fetches report data automatically on mount when autoFetch is true', async () => {
      vi.spyOn(analyticsService, 'getAcquisitionReport').mockResolvedValueOnce(mockChannels);

      render(<AcquisitionReport autoFetch={true} />);

      expect(screen.getByTestId('acquisition-loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByTestId('acquisition-loading')).not.toBeInTheDocument();
      });

      expect(analyticsService.getAcquisitionReport).toHaveBeenCalled();
      expect(screen.getByText('Paid Search')).toBeInTheDocument();
    });

    it('displays error state and retries fetch on retry button click', async () => {
      vi.spyOn(analyticsService, 'getAcquisitionReport').mockRejectedValueOnce(
        new Error('Database connection timeout')
      );

      render(<AcquisitionReport autoFetch={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('acquisition-error')).toBeInTheDocument();
      });

      expect(screen.getByText('Database connection timeout')).toBeInTheDocument();

      // Mock success for retry
      vi.spyOn(analyticsService, 'getAcquisitionReport').mockResolvedValueOnce(mockChannels);

      const retryBtn = screen.getByText('Retry');
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('acquisition-error')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Paid Search')).toBeInTheDocument();
    });

    it('triggers onExport callback when export buttons are clicked', () => {
      const mockExport = vi.fn();
      render(
        <AcquisitionReport
          initialData={mockChannels}
          autoFetch={false}
          onExport={mockExport}
        />
      );

      const csvBtn = screen.getByText('CSV');
      fireEvent.click(csvBtn);
      expect(mockExport).toHaveBeenCalledWith('csv');

      const pdfBtn = screen.getByText('PDF');
      fireEvent.click(pdfBtn);
      expect(mockExport).toHaveBeenCalledWith('pdf');
    });

    it('handles empty data state cleanly', () => {
      render(
        <AcquisitionReport
          initialData={[]}
          autoFetch={false}
        />
      );

      expect(
        screen.getByText('No acquisition channel records found matching the current filters.')
      ).toBeInTheDocument();
    });
  });
});
