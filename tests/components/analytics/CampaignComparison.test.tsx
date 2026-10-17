import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  CampaignComparison,
  formatCurrency,
  formatCPL,
  formatPercentage,
  getDatePresetRange,
  getCampaignColor,
  validateCampaignSelection,
  calculateComparisonSummary,
  sortCampaigns,
  generateFallbackComparisonData,
} from '../../../src/components/analytics/CampaignComparison';
import * as analyticsService from '../../../src/services/analytics';
import { ComparativeCampaignTrend } from '../../../src/services/analytics';

describe('CampaignComparison Component [FR-006]', () => {
  const mockTrendData: ComparativeCampaignTrend = {
    start_date_val: '2026-03-01',
    end_date_val: '2026-03-30',
    campaigns: [
      {
        campaign_id: 'cmp-101',
        campaign_name: 'Q1 Product Launch',
        budget: 25000,
        total_leads: 350,
        overall_cpl: 28.5,
        overall_engagement_rate: 18.2,
        trend_points: [
          { period_val: '2026-03-01', lead_count: 50, cost_per_lead: 30.0, engagement_rate: 15.0 },
          { period_val: '2026-03-15', lead_count: 120, cost_per_lead: 27.5, engagement_rate: 19.5 },
          { period_val: '2026-03-30', lead_count: 180, cost_per_lead: 28.0, engagement_rate: 20.1 },
        ],
      },
      {
        campaign_id: 'cmp-102',
        campaign_name: 'Spring Social Blitz',
        budget: 18000,
        total_leads: 280,
        overall_cpl: 35.0,
        overall_engagement_rate: 22.5,
        trend_points: [
          { period_val: '2026-03-01', lead_count: 40, cost_per_lead: 38.0, engagement_rate: 20.0 },
          { period_val: '2026-03-15', lead_count: 100, cost_per_lead: 34.0, engagement_rate: 23.0 },
          { period_val: '2026-03-30', lead_count: 140, cost_per_lead: 33.0, engagement_rate: 24.5 },
        ],
      },
      {
        campaign_id: 'cmp-103',
        campaign_name: 'Enterprise Retargeting',
        budget: 35000,
        total_leads: 190,
        overall_cpl: 65.0,
        overall_engagement_rate: 12.0,
        trend_points: [
          { period_val: '2026-03-01', lead_count: 30, cost_per_lead: 70.0, engagement_rate: 10.0 },
          { period_val: '2026-03-15', lead_count: 70, cost_per_lead: 65.0, engagement_rate: 12.5 },
          { period_val: '2026-03-30', lead_count: 90, cost_per_lead: 60.0, engagement_rate: 13.5 },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Helper Functions [FR-006]', () => {
    it('formatCurrency formats raw numbers into USD currency string', () => {
      expect(formatCurrency(25000)).toBe('$25,000.00');
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(null)).toBe('$0.00');
      expect(formatCurrency(undefined)).toBe('$0.00');
      expect(formatCurrency(NaN)).toBe('$0.00');
    });

    it('formatCPL formats cost per lead into USD currency string', () => {
      expect(formatCPL(28.5)).toBe('$28.50');
      expect(formatCPL(0)).toBe('$0.00');
      expect(formatCPL(null)).toBe('$0.00');
      expect(formatCPL(undefined)).toBe('$0.00');
    });

    it('formatPercentage formats numbers to 1 decimal percentage string', () => {
      expect(formatPercentage(18.2)).toBe('18.2%');
      expect(formatPercentage(0)).toBe('0.0%');
      expect(formatPercentage(null)).toBe('0.0%');
      expect(formatPercentage(undefined)).toBe('0.0%');
    });

    it('getDatePresetRange calculates valid ISO start/end date pairs', () => {
      const p30 = getDatePresetRange('30d');
      expect(p30.start_date_val).toBeDefined();
      expect(p30.end_date_val).toBeDefined();
      expect(p30.start_date_val < p30.end_date_val).toBe(true);

      const p7 = getDatePresetRange('7d');
      expect(p7.start_date_val < p7.end_date_val).toBe(true);
    });

    it('getCampaignColor returns themed color metadata', () => {
      const c0 = getCampaignColor(0);
      expect(c0.stroke).toBe('#59452b');
      const c1 = getCampaignColor(1);
      expect(c1.stroke).toBe('#374a5f');
      // Wraps around palette length
      const c5 = getCampaignColor(5);
      expect(c5.stroke).toBe('#59452b');
    });

    it('validateCampaignSelection enforces 2 to 5 campaign bounds [FR-006]', () => {
      // Less than 2 campaigns -> Invalid
      const invalidLess = validateCampaignSelection(['cmp-101']);
      expect(invalidLess.isValid).toBe(false);
      expect(invalidLess.message).toContain('at least 2 campaigns');

      // 2 to 5 campaigns -> Valid
      const validTwo = validateCampaignSelection(['cmp-101', 'cmp-102']);
      expect(validTwo.isValid).toBe(true);
      expect(validTwo.message).toBeNull();

      const validFive = validateCampaignSelection([
        'cmp-101',
        'cmp-102',
        'cmp-103',
        'cmp-104',
        'cmp-105',
      ]);
      expect(validFive.isValid).toBe(true);

      // More than 5 campaigns -> Invalid
      const invalidMore = validateCampaignSelection([
        'cmp-101',
        'cmp-102',
        'cmp-103',
        'cmp-104',
        'cmp-105',
        'cmp-106',
      ]);
      expect(invalidMore.isValid).toBe(false);
      expect(invalidMore.message).toContain('Maximum 5 campaigns');
    });

    it('calculateComparisonSummary calculates aggregate totals and top performers', () => {
      const summary = calculateComparisonSummary(mockTrendData.campaigns);
      expect(summary.totalBudget).toBe(78000); // 25k + 18k + 35k
      expect(summary.totalLeads).toBe(820); // 350 + 280 + 190
      expect(summary.topVolumeCampaign?.campaign_id).toBe('cmp-101'); // 350 leads
      expect(summary.bestCPLCampaign?.campaign_id).toBe('cmp-101'); // $28.50 CPL
      expect(summary.highestEngagementCampaign?.campaign_id).toBe('cmp-102'); // 22.5%
    });

    it('sortCampaigns re-orders campaign metrics by field and order', () => {
      // Sort by leads desc
      const sortedLeadsDesc = sortCampaigns(mockTrendData.campaigns, 'total_leads', 'desc');
      expect(sortedLeadsDesc[0].campaign_id).toBe('cmp-101'); // 350
      expect(sortedLeadsDesc[1].campaign_id).toBe('cmp-102'); // 280
      expect(sortedLeadsDesc[2].campaign_id).toBe('cmp-103'); // 190

      // Sort by CPL asc
      const sortedCplAsc = sortCampaigns(mockTrendData.campaigns, 'overall_cpl', 'asc');
      expect(sortedCplAsc[0].campaign_id).toBe('cmp-101'); // 28.5
      expect(sortedCplAsc[1].campaign_id).toBe('cmp-102'); // 35.0
      expect(sortedCplAsc[2].campaign_id).toBe('cmp-103'); // 65.0
    });

    it('generateFallbackComparisonData produces structured trend data', () => {
      const fallback = generateFallbackComparisonData(['cmp-101', 'cmp-102']);
      expect(fallback.campaigns.length).toBe(2);
      expect(fallback.campaigns[0].trend_points.length).toBeGreaterThan(0);
    });
  });

  describe('Component Behavior & User Interactions [FR-006]', () => {
    it('renders campaign comparison title and container', () => {
      render(<CampaignComparison initialData={mockTrendData} />);
      expect(screen.getByText('Campaign Trend Comparison')).toBeInText();
      expect(screen.getByTestId('campaign-comparison-container')).toBeInText();
    });

    it('renders active campaign badges for selected campaigns', () => {
      render(
        <CampaignComparison
          initialData={mockTrendData}
          initialCampaigns={['cmp-101', 'cmp-102']}
        />
      );
      expect(screen.getByTestId('campaign-badge-cmp-101')).toBeInText();
      expect(screen.getByTestId('campaign-badge-cmp-102')).toBeInText();
    });

    it('shows validation warning when fewer than 2 campaigns are selected [FR-006]', () => {
      render(
        <CampaignComparison
          initialData={mockTrendData}
          initialCampaigns={['cmp-101']} // Only 1 selected
        />
      );
      expect(screen.getByTestId('campaign-validation-warning')).toBeInText();
      expect(
        screen.getByText(/Select at least 2 campaigns to perform multi-campaign comparison/i)
      ).toBeInText();
    });

    it('allows removing a campaign when clicking badge remove button', () => {
      render(
        <CampaignComparison
          initialData={mockTrendData}
          initialCampaigns={['cmp-101', 'cmp-102', 'cmp-103']}
        />
      );

      const removeBtn = screen.getByLabelText('Remove Q1 Product Launch');
      fireEvent.click(removeBtn);

      expect(screen.queryByTestId('campaign-badge-cmp-101')).not.toBeInText();
      expect(screen.getByTestId('campaign-badge-cmp-102')).toBeInText();
      expect(screen.getByTestId('campaign-badge-cmp-103')).toBeInText();
    });

    it('allows adding a new campaign from selection dropdown', async () => {
      render(
        <CampaignComparison
          initialData={mockTrendData}
          initialCampaigns={['cmp-101', 'cmp-102']}
        />
      );

      const addBtn = screen.getByLabelText('Add campaign to comparison');
      fireEvent.click(addBtn);

      // Dropdown should be open
      expect(screen.getByLabelText('Campaign Selection Dropdown')).toBeInText();

      // Click an unselected campaign
      const newCampaignOption = screen.getByText('Enterprise Retargeting');
      fireEvent.click(newCampaignOption);

      // Now 3 campaign badges should be present
      expect(screen.getByTestId('campaign-badge-cmp-101')).toBeInText();
      expect(screen.getByTestId('campaign-badge-cmp-102')).toBeInText();
      expect(screen.getByTestId('campaign-badge-cmp-103')).toBeInText();
    });

    it('allows switching metric view tabs (Volume, CPL, Engagement, All Metrics)', () => {
      render(<CampaignComparison initialData={mockTrendData} />);

      const cplTab = screen.getByRole('button', { name: 'Cost Per Lead (CPL)' });
      fireEvent.click(cplTab);
      expect(screen.getByText(/Viewing Cost Per Lead \(USD\) trend points/i)).toBeInText();

      const engTab = screen.getByRole('button', { name: 'Engagement Rate' });
      fireEvent.click(engTab);
      expect(screen.getByText(/Viewing Engagement Rate \(%\) trend points/i)).toBeInText();

      const volTab = screen.getByRole('button', { name: 'Volume (Leads)' });
      fireEvent.click(volTab);
      expect(screen.getByText(/Viewing Acquisition Volume \(Leads\) trend points/i)).toBeInText();
    });

    it('renders overlay trend chart path elements for each campaign [FR-006]', () => {
      render(<CampaignComparison initialData={mockTrendData} />);

      expect(screen.getByTestId('campaign-trend-path-cmp-101')).toBeInText();
      expect(screen.getByTestId('campaign-trend-path-cmp-102')).toBeInText();
      expect(screen.getByTestId('campaign-trend-path-cmp-103')).toBeInText();
    });

    it('renders comparison table and supports column sorting', () => {
      render(<CampaignComparison initialData={mockTrendData} />);

      const table = screen.getByTestId('campaign-comparison-table');
      expect(table).toBeInText();

      // Table rows for campaigns
      expect(screen.getByTestId('campaign-row-cmp-101')).toBeInText();
      expect(screen.getByTestId('campaign-row-cmp-102')).toBeInText();
      expect(screen.getByTestId('campaign-row-cmp-103')).toBeInText();

      // Click column header to sort by Budget
      const budgetHeader = screen.getByText('Budget');
      fireEvent.click(budgetHeader);

      // Enterprise Retargeting ($35,000) should be first when sorted desc
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Enterprise Retargeting');
    });

    it('triggers export callbacks when CSV and PDF buttons are clicked', () => {
      const onExportMock = vi.fn();
      render(<CampaignComparison initialData={mockTrendData} onExport={onExportMock} />);

      const csvBtn = screen.getByLabelText('Export CSV');
      fireEvent.click(csvBtn);
      expect(onExportMock).toHaveBeenCalledWith('csv');

      const pdfBtn = screen.getByLabelText('Export PDF');
      fireEvent.click(pdfBtn);
      expect(onExportMock).toHaveBeenCalledWith('pdf');
    });

    it('calls analyticsService.getCampaignTrendComparison on refresh or autoFetch', async () => {
      const spyGetCompare = vi
        .spyOn(analyticsService, 'getCampaignTrendComparison')
        .mockResolvedValue(mockTrendData);

      render(<CampaignComparison autoFetch={true} initialCampaigns={['cmp-101', 'cmp-102']} />);

      await waitFor(() => {
        expect(spyGetCompare).toHaveBeenCalledWith(
          expect.objectContaining({
            campaign_ids: ['cmp-101', 'cmp-102'],
          })
        );
      });
    });
  });
});
