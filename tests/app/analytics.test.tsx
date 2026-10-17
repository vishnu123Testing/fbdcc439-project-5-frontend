import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnalyticsPage from '../../src/app/analytics/page';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';
import * as analyticsService from '../../src/services/analytics';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/analytics',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock analytics API client calls
vi.mock('../../src/services/analytics', async () => {
  const actual = await vi.importActual('../../src/services/analytics');
  return {
    ...actual,
    getAcquisitionReport: vi.fn().mockResolvedValue([]),
    getConversionFunnel: vi.fn().mockResolvedValue([]),
    getCampaignTrendComparison: vi.fn().mockResolvedValue({ start_date_val: null, end_date_val: null, campaigns: [] }),
    getTerritoryHeatmap: vi.fn().mockResolvedValue({ territories: [], unassigned_drawer: { total_unassigned_leads: 0, total_unassigned_value: 0, unassigned_items: [] }, total_leads: 0, total_value: 0 }),
    getCalendarMeetings: vi.fn().mockResolvedValue([]),
    createDatasetExport: vi.fn().mockResolvedValue({
      task_id: 'task-exp-999',
      status: 'PENDING',
      report_type: 'acquisition',
      export_format: 'csv',
      created_at: new Date().toISOString(),
      file_size_bytes: 0,
      row_count: 100,
    }),
  };
});

describe('AnalyticsPage Integration Component [FR-001, FR-004, FR-006, FR-007, FR-009, FR-012]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderAnalyticsPage = () => {
    return render(
      <AccessibilityProvider>
        <AnalyticsPage />
      </AccessibilityProvider>
    );
  };

  it('renders analytics page header, title, and default overview view [FR-001]', async () => {
    renderAnalyticsPage();

    expect(
      screen.getByRole('heading', { level: 1, name: /Lead Acquisition & Marketing Analytics/i })
    ).toBeInTheDocument();

    expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
    expect(screen.getByTestId('tab-acquisition')).toBeInTheDocument();
    expect(screen.getByTestId('tab-funnel')).toBeInTheDocument();
    expect(screen.getByTestId('tab-campaigns')).toBeInTheDocument();
    expect(screen.getByTestId('tab-territory')).toBeInTheDocument();
    expect(screen.getByTestId('tab-calendar')).toBeInTheDocument();

    expect(screen.getByTestId('overview-view')).toBeInTheDocument();
  });

  it('switches navigation tabs when tab buttons are clicked', async () => {
    renderAnalyticsPage();

    // Click Acquisition tab
    const acquisitionTab = screen.getByTestId('tab-acquisition');
    fireEvent.click(acquisitionTab);

    await waitFor(() => {
      expect(screen.getByTestId('acquisition-tab-view')).toBeInTheDocument();
    });

    // Click Funnel tab
    const funnelTab = screen.getByTestId('tab-funnel');
    fireEvent.click(funnelTab);

    await waitFor(() => {
      expect(screen.getByTestId('funnel-tab-view')).toBeInTheDocument();
    });

    // Click Campaign Trends tab
    const campaignsTab = screen.getByTestId('tab-campaigns');
    fireEvent.click(campaignsTab);

    await waitFor(() => {
      expect(screen.getByTestId('campaigns-tab-view')).toBeInTheDocument();
    });

    // Click Territory Heat Map tab
    const territoryTab = screen.getByTestId('tab-territory');
    fireEvent.click(territoryTab);

    await waitFor(() => {
      expect(screen.getByTestId('territory-tab-view')).toBeInTheDocument();
    });

    // Click Meeting Calendar tab
    const calendarTab = screen.getByTestId('tab-calendar');
    fireEvent.click(calendarTab);

    await waitFor(() => {
      expect(screen.getByTestId('calendar-tab-view')).toBeInTheDocument();
    });
  });

  it('opens export dataset modal and submits export task [FR-012]', async () => {
    renderAnalyticsPage();

    const openExportModalBtn = screen.getByTestId('global-export-modal-btn');
    fireEvent.click(openExportModalBtn);

    expect(screen.getByTestId('export-modal')).toBeInTheDocument();

    // Select PDF format
    const pdfFormatBtn = screen.getByTestId('export-format-pdf');
    fireEvent.click(pdfFormatBtn);

    // Click Submit Export
    const submitBtn = screen.getByTestId('submit-export-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(analyticsService.createDatasetExport).toHaveBeenCalledWith({
        report_type: 'acquisition',
        export_format: 'pdf',
      });
    });

    // Notification banner should appear with task ID
    await waitFor(() => {
      expect(screen.getByTestId('export-notifications-container')).toBeInTheDocument();
      expect(screen.getByText(/task-exp-999/i)).toBeInTheDocument();
    });
  });
});
