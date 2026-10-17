import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PipelinePage, { DEMO_DEALS } from '../../src/app/pipeline/page';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';
import * as dealsService from '../../src/services/deals';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/pipeline',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock deals service
vi.mock('../../src/services/deals', async () => {
  const actual = await vi.importActual('../../src/services/deals');
  return {
    ...actual,
    getPipelineBoard: vi.fn(),
    updateDealStage: vi.fn(),
    getActionItems: vi.fn(),
    createActionItem: vi.fn(),
    completeActionItem: vi.fn(),
    deleteActionItem: vi.fn(),
    getStakeholders: vi.fn(),
    createStakeholder: vi.fn(),
    addStakeholderActivity: vi.fn(),
    getForecast: vi.fn(),
    recalculateForecast: vi.fn(),
  };
});

describe('PipelinePage Component [FR-001, FR-003, Story 1, Story 2, Story 3, Story 4]', () => {
  const mockBoardResponse: dealsService.PipelineBoardResponse = {
    stages: [
      {
        milestone_stage: 'Qualification',
        total_value: 150000,
        deal_count: 1,
        deals: [DEMO_DEALS[0]],
      },
      {
        milestone_stage: 'Needs Analysis',
        total_value: 320000,
        deal_count: 1,
        deals: [DEMO_DEALS[1]],
      },
      {
        milestone_stage: 'Proposal',
        total_value: 85000,
        deal_count: 1,
        deals: [DEMO_DEALS[2]],
      },
      {
        milestone_stage: 'Negotiation',
        total_value: 500000,
        deal_count: 1,
        deals: [DEMO_DEALS[3]],
      },
      {
        milestone_stage: 'Closed Won',
        total_value: 750000,
        deal_count: 1,
        deals: [DEMO_DEALS[4]],
      },
    ],
    total_pipeline_value: 1805000,
    total_deal_count: 5,
    deals: DEMO_DEALS,
  };

  const mockActionItems: dealsService.ActionItemResponse[] = [
    {
      id: 'item-1',
      deal_id: 'deal-101',
      title: 'Submit Security Questionnaire',
      assigned_owner_id: 'owner.alice@example.com',
      target_due_date: new Date(Date.now() + 86400000).toISOString(),
      sla_threshold_hours: 24,
      is_completed: false,
      is_escalated: false,
      is_overdue: false,
      created_on: new Date().toISOString(),
    },
    {
      id: 'item-2',
      deal_id: 'deal-101',
      title: 'Schedule Technical Architecture Review',
      assigned_owner_id: 'owner.bob@example.com',
      target_due_date: new Date(Date.now() - 86400000).toISOString(),
      sla_threshold_hours: 24,
      is_completed: false,
      is_escalated: true,
      is_overdue: true,
      created_on: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ];

  const mockStakeholderMap: dealsService.StakeholderMapResponse = {
    deal_id: 'deal-101',
    stakeholders: [
      {
        id: 'sh-1',
        deal_id: 'deal-101',
        full_name: 'Jane Doe',
        email: 'jane.doe@acme.com',
        org_role: 'VP Engineering',
        influence_level: 'High',
        is_active: true,
        created_on: new Date().toISOString(),
      },
    ],
    recent_activities: [
      {
        id: 'act-1',
        stakeholder_id: 'sh-1',
        deal_id: 'deal-101',
        activity_type: 'Meeting',
        summary: 'Architecture Review Meeting',
        occurred_on: new Date().toISOString(),
        created_on: new Date().toISOString(),
        stakeholder_name: 'Jane Doe',
      },
    ],
    total_stakeholders: 1,
    total_activities: 1,
  };

  const mockForecast: dealsService.ForecastResponse = {
    id: 'fc-1',
    deal_id: 'deal-101',
    estimated_completion_date: '2026-11-15T00:00:00Z',
    confidence_score_pct: 82.5,
    status_code: 'READY',
    calculated_on: new Date().toISOString(),
    is_sparse: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(dealsService.getPipelineBoard).mockResolvedValue(mockBoardResponse);
    vi.mocked(dealsService.getActionItems).mockResolvedValue(mockActionItems);
    vi.mocked(dealsService.getStakeholders).mockResolvedValue(mockStakeholderMap);
    vi.mocked(dealsService.getForecast).mockResolvedValue(mockForecast);
    vi.mocked(dealsService.updateDealStage).mockResolvedValue({
      ...DEMO_DEALS[0],
      milestone_stage: 'Proposal',
    });
  });

  it('renders pipeline page header, board, search input, stage filter, and stats summary', async () => {
    render(
      <AccessibilityProvider>
        <PipelinePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('pipeline-page')).toBeInDocument();
    });

    expect(screen.getByText('Visual Deal Pipeline')).toBeInDocument();
    expect(screen.getByTestId('pipeline-search-input')).toBeInDocument();
    expect(screen.getByTestId('pipeline-stage-filter-select')).toBeInDocument();
    expect(screen.getByTestId('pipeline-refresh-button')).toBeInDocument();
    expect(screen.getByTestId('pipeline-board')).toBeInDocument();
  });

  it('filters deals on typing into search input', async () => {
    render(
      <AccessibilityProvider>
        <PipelinePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('pipeline-page')).toBeInDocument();
    });

    const searchInput = screen.getByTestId('pipeline-search-input');
    fireEvent.change(searchInput, { target: { value: 'Acme Corp' } });

    await waitFor(() => {
      expect(screen.getByText('Acme Corp Cloud Infrastructure Renewal')).toBeInDocument();
    });
  });

  it('switches inspector tabs and loads selected deal intelligence details', async () => {
    render(
      <AccessibilityProvider>
        <PipelinePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('deal-inspector-section')).toBeInDocument();
    });

    // Check tabs
    const tabForecast = screen.getByTestId('tab-forecast');
    const tabActionItems = screen.getByTestId('tab-action-items');
    const tabStakeholders = screen.getByTestId('tab-stakeholders');

    expect(tabForecast).toBeInDocument();
    expect(tabActionItems).toBeInDocument();
    expect(tabStakeholders).toBeInDocument();

    // Switch to Action Items tab
    fireEvent.click(tabActionItems);

    await waitFor(() => {
      expect(screen.getByTestId('action-items-section-container')).toBeInDocument();
      expect(screen.getByText('Submit Security Questionnaire')).toBeInDocument();
      expect(screen.getByText('Schedule Technical Architecture Review')).toBeInDocument();
    });
  });

  it('allows creating a new action item via form submission', async () => {
    const createdItem: dealsService.ActionItemResponse = {
      id: 'item-3',
      deal_id: 'deal-101',
      title: 'Send Revised Contract Draft',
      assigned_owner_id: 'sales.rep@example.com',
      target_due_date: new Date(Date.now() + 86400000).toISOString(),
      sla_threshold_hours: 24,
      is_completed: false,
      is_escalated: false,
      is_overdue: false,
      created_on: new Date().toISOString(),
    };

    vi.mocked(dealsService.createActionItem).mockResolvedValue(createdItem);

    render(
      <AccessibilityProvider>
        <PipelinePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('tab-action-items')).toBeInDocument();
    });

    fireEvent.click(screen.getByTestId('tab-action-items'));

    await waitFor(() => {
      expect(screen.getByTestId('toggle-add-action-button')).toBeInDocument();
    });

    // Open form
    fireEvent.click(screen.getByTestId('toggle-add-action-button'));

    expect(screen.getByTestId('add-action-item-form')).toBeInDocument();

    // Fill form
    fireEvent.change(screen.getByTestId('action-title-input'), {
      target: { value: 'Send Revised Contract Draft' },
    });
    fireEvent.change(screen.getByTestId('action-owner-input'), {
      target: { value: 'sales.rep@example.com' },
    });

    // Submit form
    fireEvent.click(screen.getByTestId('submit-action-item-button'));

    await waitFor(() => {
      expect(dealsService.createActionItem).toHaveBeenCalledWith('deal-101', expect.objectContaining({
        title: 'Send Revised Contract Draft',
        assigned_owner_id: 'sales.rep@example.com',
      }));
      expect(screen.getByText('Send Revised Contract Draft')).toBeInDocument();
    });
  });

  it('completes an existing action item when complete button is clicked', async () => {
    const completedItem: dealsService.ActionItemResponse = {
      ...mockActionItems[0],
      is_completed: true,
      completed_on: new Date().toISOString(),
    };

    vi.mocked(dealsService.completeActionItem).mockResolvedValue(completedItem);

    render(
      <AccessibilityProvider>
        <PipelinePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('tab-action-items')).toBeInDocument();
    });

    fireEvent.click(screen.getByTestId('tab-action-items'));

    await waitFor(() => {
      expect(screen.getByTestId(`complete-action-button-${mockActionItems[0].id}`)).toBeInDocument();
    });

    fireEvent.click(screen.getByTestId(`complete-action-button-${mockActionItems[0].id}`));

    await waitFor(() => {
      expect(dealsService.completeActionItem).toHaveBeenCalledWith('deal-101', 'item-1');
    });
  });

  it('deletes an action item when delete button is clicked', async () => {
    vi.mocked(dealsService.deleteActionItem).mockResolvedValue();

    render(
      <AccessibilityProvider>
        <PipelinePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('tab-action-items')).toBeInDocument();
    });

    fireEvent.click(screen.getByTestId('tab-action-items'));

    await waitFor(() => {
      expect(screen.getByTestId(`delete-action-button-${mockActionItems[0].id}`)).toBeInDocument();
    });

    fireEvent.click(screen.getByTestId(`delete-action-button-${mockActionItems[0].id}`));

    await waitFor(() => {
      expect(dealsService.deleteActionItem).toHaveBeenCalledWith('deal-101', 'item-1');
    });
  });

  it('updates deal stage directly from quick stage dropdown selector', async () => {
    render(
      <AccessibilityProvider>
        <PipelinePage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('quick-stage-select')).toBeInDocument();
    });

    fireEvent.change(screen.getByTestId('quick-stage-select'), {
      target: { value: 'Proposal' },
    });

    await waitFor(() => {
      expect(dealsService.updateDealStage).toHaveBeenCalledWith('deal-101', {
        milestone_stage: 'Proposal',
      });
    });
  });
});
