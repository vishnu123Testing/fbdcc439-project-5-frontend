import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  Board,
  DEFAULT_STAGES,
  getStageColorConfig,
  calculateDealsTotals,
} from '../../../src/components/pipeline/Board';
import {
  DealResponse,
  PipelineBoardResponse,
  updateDealStage,
} from '../../../src/services/deals';

// Mock updateDealStage API service function
vi.mock('../../../src/services/deals', async () => {
  const actual = await vi.importActual('../../../src/services/deals');
  return {
    ...actual,
    updateDealStage: vi.fn(),
  };
});

describe('Board Component [FR-001, FR-003, NFR-001]', () => {
  const sampleDeals: DealResponse[] = [
    {
      id: 'deal-1',
      title: 'Acme SaaS Enterprise Renewal',
      deal_value: 120000,
      milestone_stage: 'Qualification',
      win_probability: 0.2,
      age_in_days: 5,
      created_on: '2026-09-01T00:00:00Z',
      updated_on: '2026-09-05T00:00:00Z',
    },
    {
      id: 'deal-2',
      title: 'Globex Cloud Migration',
      deal_value: 250000,
      milestone_stage: 'Proposal',
      win_probability: 0.6,
      age_in_days: 14,
      created_on: '2026-08-20T00:00:00Z',
      updated_on: '2026-09-03T00:00:00Z',
    },
    {
      id: 'deal-3',
      title: 'Initech Security Expansion',
      deal_value: 80000,
      milestone_stage: 'Proposal',
      win_probability: 0.65,
      age_in_days: 21,
      created_on: '2026-08-10T00:00:00Z',
      updated_on: '2026-08-31T00:00:00Z',
    },
    {
      id: 'deal-4',
      title: 'Stark Industries AI Platform',
      deal_value: 500000,
      milestone_stage: 'Negotiation',
      win_probability: 0.8,
      age_in_days: 30,
      created_on: '2026-08-01T00:00:00Z',
      updated_on: '2026-08-30T00:00:00Z',
    },
  ];

  const sampleBoardResponse: PipelineBoardResponse = {
    stages: [
      {
        milestone_stage: 'Qualification',
        total_value: 120000,
        deal_count: 1,
        deals: [sampleDeals[0]],
      },
      {
        milestone_stage: 'Needs Analysis',
        total_value: 0,
        deal_count: 0,
        deals: [],
      },
      {
        milestone_stage: 'Proposal',
        total_value: 330000,
        deal_count: 2,
        deals: [sampleDeals[1], sampleDeals[2]],
      },
      {
        milestone_stage: 'Negotiation',
        total_value: 500000,
        deal_count: 1,
        deals: [sampleDeals[3]],
      },
      {
        milestone_stage: 'Closed Won',
        total_value: 0,
        deal_count: 0,
        deals: [],
      },
      {
        milestone_stage: 'Closed Lost',
        total_value: 0,
        deal_count: 0,
        deals: [],
      },
    ],
    total_pipeline_value: 950000,
    total_deal_count: 4,
    deals: sampleDeals,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Helper Functions', () => {
    it('returns appropriate color configuration for milestone stages [FR-1]', () => {
      expect(getStageColorConfig('Qualification').dotColor).toContain('blue');
      expect(getStageColorConfig('Needs Analysis').dotColor).toContain('amber');
      expect(getStageColorConfig('Proposal').dotColor).toContain('purple');
      expect(getStageColorConfig('Negotiation').dotColor).toContain('orange');
      expect(getStageColorConfig('Closed Won').dotColor).toContain('emerald');
      expect(getStageColorConfig('Closed Lost').dotColor).toContain('rose');
      expect(getStageColorConfig('Unknown Stage').dotColor).toBeDefined();
    });

    it('calculates total value and deal count for a list of deals', () => {
      const totals = calculateDealsTotals([sampleDeals[1], sampleDeals[2]]);
      expect(totals.totalValue).toBe(330000);
      expect(totals.dealCount).toBe(2);
    });
  });

  describe('Component Rendering [FR-1]', () => {
    it('renders visual board container with milestone columns and total summary [FR-1 Scenario 1.1]', () => {
      render(<Board initialBoard={sampleBoardResponse} />);

      expect(screen.getByTestId('pipeline-board')).toBeInDocument();
      expect(screen.getByTestId('pipeline-summary-total-value')).toHaveTextContent('$950,000');
      expect(screen.getByTestId('pipeline-summary-deal-count')).toHaveTextContent('4');

      const stageColumns = screen.getAllByTestId('stage-column');
      expect(stageColumns.length).toBe(6);

      // Verify column titles
      const titles = screen.getAllByTestId('column-title').map((el) => el.textContent);
      expect(titles).toEqual(DEFAULT_STAGES);
    });

    it('groups deals accurately into color-coded stage columns with stage value totals [FR-1 Scenario 1.1]', () => {
      render(<Board deals={sampleDeals} />);

      const proposalColumn = screen.getByTestId('stage-column', { name: /Milestone column Proposal/i });
      expect(proposalColumn).toBeInDocument();

      // Qualification column should have 1 deal ($120,000)
      const qualColumn = screen.getByTestId('stage-column', { name: /Milestone column Qualification/i });
      expect(qualColumn).toHaveTextContent('Acme SaaS Enterprise Renewal');

      // Proposal column should have 2 deals ($330,000)
      expect(screen.getByText('Globex Cloud Migration')).toBeInDocument();
      expect(screen.getByText('Initech Security Expansion')).toBeInDocument();
    });

    it('renders empty column placeholders for stages with zero deals', () => {
      render(<Board deals={sampleDeals} />);

      const placeholders = screen.getAllByTestId('empty-column-placeholder');
      expect(placeholders.length).toBeGreaterThan(0);
    });

    it('renders loading skeleton state when isLoading prop is true', () => {
      render(<Board isLoading={true} />);

      expect(screen.getByTestId('board-loading-skeleton')).toBeInDocument();
    });
  });

  describe('Stage Transitions & Updates [FR-3, NFR-1]', () => {
    it('updates deal stage visually when changed via quick move selector [FR-3 Scenario 1.2]', async () => {
      const mockUpdatedDeal: DealResponse = {
        ...sampleDeals[0],
        milestone_stage: 'Proposal',
        updated_on: new Date().toISOString(),
      };

      vi.mocked(updateDealStage).mockResolvedValueOnce(mockUpdatedDeal);

      const handleStageChange = vi.fn();
      render(<Board deals={sampleDeals} onStageChange={handleStageChange} />);

      // Deal 1 is currently in Qualification
      const qualColumn = screen.getByTestId('stage-column', { name: /Milestone column Qualification/i });
      expect(qualColumn).toHaveTextContent('Acme SaaS Enterprise Renewal');

      // Find quick move select for deal-1
      const stageSelects = screen.getAllByTestId('stage-select');
      const deal1Select = stageSelects.find((s) => s.getAttribute('data-deal-id') === 'deal-1');
      expect(deal1Select).toBeDefined();

      // Change stage to Proposal
      fireEvent.change(deal1Select!, { target: { value: 'Proposal' } });

      // Verify updateDealStage API service call
      expect(updateDealStage).toHaveBeenCalledWith('deal-1', { milestone_stage: 'Proposal' });

      // Wait for async update to settle
      await waitFor(() => {
        expect(handleStageChange).toHaveBeenCalledWith('deal-1', 'Proposal', mockUpdatedDeal);
      });

      // Verify Deal 1 moved to Proposal column
      const proposalColumn = screen.getByTestId('stage-column', { name: /Milestone column Proposal/i });
      expect(proposalColumn).toHaveTextContent('Acme SaaS Enterprise Renewal');
    });

    it('handles drag-and-drop stage transition on column drop [FR-3 Scenario 1.2]', async () => {
      const mockUpdatedDeal: DealResponse = {
        ...sampleDeals[0],
        milestone_stage: 'Negotiation',
        updated_on: new Date().toISOString(),
      };

      vi.mocked(updateDealStage).mockResolvedValueOnce(mockUpdatedDeal);

      render(<Board deals={sampleDeals} />);

      const negotiationColumn = screen.getByTestId('stage-column', { name: /Milestone column Negotiation/i });

      // Simulate drop event onto Negotiation column
      fireEvent.drop(negotiationColumn, {
        dataTransfer: {
          getData: (format: string) => {
            if (format === 'application/json') {
              return JSON.stringify({ dealId: 'deal-1', sourceStage: 'Qualification' });
            }
            return 'deal-1';
          },
        },
      });

      expect(updateDealStage).toHaveBeenCalledWith('deal-1', { milestone_stage: 'Negotiation' });

      await waitFor(() => {
        expect(negotiationColumn).toHaveTextContent('Acme SaaS Enterprise Renewal');
      });
    });

    it('reverts deal stage and displays error banner if stage update API fails', async () => {
      vi.mocked(updateDealStage).mockRejectedValueOnce(new Error('Network timeout updating deal stage'));

      render(<Board deals={sampleDeals} />);

      const stageSelects = screen.getAllByTestId('stage-select');
      const deal1Select = stageSelects.find((s) => s.getAttribute('data-deal-id') === 'deal-1');

      fireEvent.change(deal1Select!, { target: { value: 'Closed Won' } });

      await waitFor(() => {
        expect(screen.getByTestId('board-error-banner')).toHaveTextContent(
          'Network timeout updating deal stage'
        );
      });

      // Deal 1 should be reverted back to Qualification
      const qualColumn = screen.getByTestId('stage-column', { name: /Milestone column Qualification/i });
      expect(qualColumn).toHaveTextContent('Acme SaaS Enterprise Renewal');
    });
  });

  describe('Interactivity and Custom Callbacks', () => {
    it('triggers onSelectDeal callback when a deal card is clicked', () => {
      const handleSelect = vi.fn();
      render(<Board deals={sampleDeals} onSelectDeal={handleSelect} />);

      const acmeCard = screen.getByText('Acme SaaS Enterprise Renewal');
      fireEvent.click(acmeCard);

      expect(handleSelect).toHaveBeenCalledWith(sampleDeals[0]);
    });

    it('triggers onRefresh callback when refresh button is clicked', () => {
      const handleRefresh = vi.fn();
      render(<Board deals={sampleDeals} onRefresh={handleRefresh} />);

      const refreshBtn = screen.getByTestId('board-refresh-button');
      fireEvent.click(refreshBtn);

      expect(handleRefresh).toHaveBeenCalledTimes(1);
    });
  });
});
