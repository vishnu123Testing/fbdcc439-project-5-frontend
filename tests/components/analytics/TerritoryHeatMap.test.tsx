import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  TerritoryHeatMap,
  formatCurrency,
  formatNumber,
  calculateHeatIntensity,
  calculateTerritorySummary,
  filterTerritories,
  getDatePresetRange,
} from '../../../src/components/analytics/TerritoryHeatMap';
import * as analyticsService from '../../../src/services/analytics';
import { TerritoryHeatMap as TerritoryHeatMapData, TerritoryDensity } from '../../../src/services/analytics';

describe('TerritoryHeatMap Component [FR-007, FR-008]', () => {
  const mockHeatmapData: TerritoryHeatMapData = {
    total_leads: 650,
    total_value: 320000.0,
    territories: [
      {
        territory_id: 'terr-1',
        territory_code: 'NA-WEST',
        territory_name: 'North America West',
        lead_count: 350,
        opportunity_count: 85,
        total_deal_value: 180000.0,
        average_deal_value: 2117.65,
        postal_code_breakdown: {
          '90210': 120,
          '94102': 150,
          '98101': 80,
        },
      },
      {
        territory_id: 'terr-2',
        territory_code: 'NA-EAST',
        territory_name: 'North America East',
        lead_count: 200,
        opportunity_count: 45,
        total_deal_value: 100000.0,
        average_deal_value: 2222.22,
        postal_code_breakdown: {
          '10001': 110,
          '02108': 90,
        },
      },
      {
        territory_id: 'terr-3',
        territory_code: 'EMEA-UK',
        territory_name: 'United Kingdom',
        lead_count: 60,
        opportunity_count: 12,
        total_deal_value: 30000.0,
        average_deal_value: 2500.0,
        postal_code_breakdown: {
          'EC1A': 40,
          'W1A': 20,
        },
      },
    ],
    unassigned_drawer: {
      total_unassigned_leads: 40,
      total_unassigned_value: 10000.0,
      unassigned_items: [
        {
          lead_id: 'lead-unassigned-1',
          postal_code: null,
          stage_name: 'New',
          deal_value: 5000.0,
          event_timestamp: '2025-10-01T12:00:00Z',
          reason: 'Missing postal code',
        },
        {
          lead_id: 'lead-unassigned-2',
          postal_code: '99999',
          stage_name: 'Qualified',
          deal_value: 5000.0,
          event_timestamp: '2025-10-02T14:30:00Z',
          reason: 'Unrecognized postal code region',
        },
      ],
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Helper Functions [FR-007, FR-008]', () => {
    it('formatCurrency formats numbers into USD currency strings', () => {
      expect(formatCurrency(180000)).toBe('$180,000.00');
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(null)).toBe('$0.00');
      expect(formatCurrency(undefined)).toBe('$0.00');
      expect(formatCurrency(NaN)).toBe('$0.00');
    });

    it('formatNumber formats numbers with thousand separators', () => {
      expect(formatNumber(1250)).toBe('1,250');
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(null)).toBe('0');
      expect(formatNumber(undefined)).toBe('0');
    });

    it('calculateHeatIntensity evaluates relative density levels', () => {
      const high = calculateHeatIntensity(350, 350, 180000, 180000);
      expect(high.level).toBe('high');
      expect(high.label).toBe('High Density');

      const low = calculateHeatIntensity(20, 350, 5000, 180000);
      expect(low.level).toBe('low');
      expect(low.label).toBe('Low Density');

      const zero = calculateHeatIntensity(0, 350, 0, 180000);
      expect(zero.level).toBe('zero');
      expect(zero.label).toBe('Zero Activity');
    });

    it('calculateTerritorySummary computes total metrics across territories and drawer', () => {
      const summary = calculateTerritorySummary(mockHeatmapData);
      expect(summary.totalLeads).toBe(650);
      expect(summary.totalValue).toBe(320000.0);
      expect(summary.totalOpportunities).toBe(142);
      expect(summary.activeTerritoriesCount).toBe(3);
      expect(summary.unassignedLeadsCount).toBe(40);
      expect(summary.unassignedValue).toBe(10000.0);
    });

    it('filterTerritories filters by search query and deal value constraints', () => {
      const territories = mockHeatmapData.territories;

      // Filter by name
      const searchWest = filterTerritories(territories, 'West');
      expect(searchWest).toHaveLength(1);
      expect(searchWest[0].territory_code).toBe('NA-WEST');

      // Filter by postal code
      const searchZip = filterTerritories(territories, '10001');
      expect(searchZip).toHaveLength(1);
      expect(searchZip[0].territory_code).toBe('NA-EAST');

      // Filter by deal value
      const highValue = filterTerritories(territories, '', 150000);
      expect(highValue).toHaveLength(1);
      expect(highValue[0].territory_code).toBe('NA-WEST');
    });

    it('getDatePresetRange converts date presets to ISO date bounds', () => {
      const range7d = getDatePresetRange('7d');
      expect(range7d.start_date_val).toBeDefined();
      expect(range7d.end_date_val).toBeDefined();

      const rangeAll = getDatePresetRange('all');
      expect(rangeAll.start_date_val).toBeUndefined();
      expect(rangeAll.end_date_val).toBeUndefined();
    });
  });

  describe('Component Rendering & Interactive Features [FR-007, FR-008]', () => {
    it('renders heat map with pre-fetched initialData', () => {
      render(<TerritoryHeatMap initialData={mockHeatmapData} autoFetch={false} />);

      expect(screen.getByText('Geographic Territory Heat Map')).toBeInTheDocument();
      expect(screen.getByText('North America West')).toBeInTheDocument();
      expect(screen.getByText('North America East')).toBeInTheDocument();
      expect(screen.getByText('United Kingdom')).toBeInTheDocument();

      // Check summary stats
      expect(screen.getByText('650')).toBeInTheDocument(); // Total leads
      expect(screen.getByText('$320,000.00')).toBeInTheDocument(); // Total value
    });

    it('opens Unassigned Territory Drawer on button click [FR-007 Edge Cases]', async () => {
      render(<TerritoryHeatMap initialData={mockHeatmapData} autoFetch={false} />);

      const drawerBtn = screen.getByRole('button', { name: /Open Unassigned Territory Drawer/i });
      fireEvent.click(drawerBtn);

      expect(screen.getByText('Unassigned Territory Drawer')).toBeInTheDocument();
      expect(screen.getByText('lead-unassigned-1')).toBeInTheDocument();
      expect(screen.getByText('Missing postal code')).toBeInTheDocument();

      // Close drawer
      const closeBtn = screen.getByRole('button', { name: /Close Unassigned Drawer/i });
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByText('Unassigned Territory Drawer')).not.toBeInTheDocument();
      });
    });

    it('filters territories interactively via search input [FR-008]', () => {
      render(<TerritoryHeatMap initialData={mockHeatmapData} autoFetch={false} />);

      const searchInput = screen.getByPlaceholderText(/Search territory name, code, or postal code/i);
      fireEvent.change(searchInput, { target: { value: 'UK' } });

      expect(screen.getByText('United Kingdom')).toBeInTheDocument();
      expect(screen.queryByText('North America West')).not.toBeInTheDocument();
    });

    it('switches view modes between Grid, Table, and Zip Breakdown', () => {
      render(<TerritoryHeatMap initialData={mockHeatmapData} autoFetch={false} />);

      // Switch to Table view
      const tableBtn = screen.getByRole('button', { name: /Territory Table View/i });
      fireEvent.click(tableBtn);

      expect(screen.getByText('Territory Code')).toBeInTheDocument();
      expect(screen.getByText('Territory Name')).toBeInTheDocument();

      // Switch to Breakdown view
      const breakdownBtn = screen.getByRole('button', { name: /Postal Code Breakdown View/i });
      fireEvent.click(breakdownBtn);

      expect(screen.getByText(/Postal code data mapped for this territory/i, { exact: false })).toBeInTheDocument();
    });

    it('auto-fetches data when initialData is missing and autoFetch is true', async () => {
      const getTerritoryHeatmapSpy = vi
        .spyOn(analyticsService, 'getTerritoryHeatmap')
        .mockResolvedValue(mockHeatmapData);

      render(<TerritoryHeatMap autoFetch={true} />);

      await waitFor(() => {
        expect(getTerritoryHeatmapSpy).toHaveBeenCalled();
        expect(screen.getByText('North America West')).toBeInTheDocument();
      });
    });

    it('invokes onExport callback when CSV or PDF export buttons are clicked', () => {
      const onExportMock = vi.fn();
      render(
        <TerritoryHeatMap
          initialData={mockHeatmapData}
          autoFetch={false}
          onExport={onExportMock}
        />
      );

      const csvBtn = screen.getByRole('button', { name: /CSV/i });
      fireEvent.click(csvBtn);
      expect(onExportMock).toHaveBeenCalledWith('csv');

      const pdfBtn = screen.getByRole('button', { name: /PDF/i });
      fireEvent.click(pdfBtn);
      expect(onExportMock).toHaveBeenCalledWith('pdf');
    });

    it('invokes onSelectTerritory callback when a territory card is clicked', () => {
      const onSelectMock = vi.fn();
      render(
        <TerritoryHeatMap
          initialData={mockHeatmapData}
          autoFetch={false}
          onSelectTerritory={onSelectMock}
        />
      );

      const card = screen.getByText('North America West');
      fireEvent.click(card);

      expect(onSelectMock).toHaveBeenCalledWith(mockHeatmapData.territories[0]);
    });

    it('displays error message and handles retry button click', async () => {
      const getTerritoryHeatmapSpy = vi
        .spyOn(analyticsService, 'getTerritoryHeatmap')
        .mockRejectedValue(new Error('Network response failure'));

      render(<TerritoryHeatMap autoFetch={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Network response failure/i)).toBeInTheDocument();
      });

      const retryBtn = screen.getByRole('button', { name: /Retry/i });
      getTerritoryHeatmapSpy.mockResolvedValueOnce(mockHeatmapData);

      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText('North America West')).toBeInTheDocument();
      });
    });
  });
});
