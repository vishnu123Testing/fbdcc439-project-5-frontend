import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getAcquisitionReport,
  getConversionFunnel,
  getCampaignTrendComparison,
  getTerritoryHeatmap,
  createReportAuditLog,
  deleteReportConfiguration,
  createDatasetExport,
  getCalendarMeetings,
  updateMeetingNotes,
  analyticsService,
  AcquisitionReportParams,
  FunnelQueryParams,
  CampaignCompareParams,
  TerritoryHeatmapParams,
  AuditLogCreateRequest,
  ExportCreateRequest,
  CalendarQueryParams,
  MeetingNotesRequest,
} from '../../src/services/analytics';
import { setToken } from '../../src/services/apiClient';

describe('analytics service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAcquisitionReport [FR-001]', () => {
    it('fetches acquisition report items without parameters', async () => {
      const mockResponse = [
        {
          channel_id: '11111111-1111-1111-1111-111111111111',
          channel_name: 'Paid Search',
          lead_count: 150,
          quality_score: 85.5,
          spend_amount: 5000.0,
          revenue_amount: 25000.0,
          roi: '400.00%',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await getAcquisitionReport();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/analytics/acquisition'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockResponse);
    });

    it('builds query parameters correctly when provided', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      const params: AcquisitionReportParams = {
        start_date_val: '2026-01-01T00:00:00Z',
        end_date_val: '2026-01-31T23:59:59Z',
        channel_id: 'chan-123',
        sort_by: 'roi',
        sort_order: 'desc',
      };

      await getAcquisitionReport(params);

      const calledUrl = (fetch as unknown as { mock: { calls: [string[]] } }).mock.calls[0][0];
      expect(calledUrl).toContain('start_date_val=2026-01-01T00%3A00%3A00Z');
      expect(calledUrl).toContain('end_date_val=2026-01-31T23%3A59%3A59Z');
      expect(calledUrl).toContain('channel_id=chan-123');
      expect(calledUrl).toContain('sort_by=roi');
      expect(calledUrl).toContain('sort_order=desc');
    });
  });

  describe('getConversionFunnel [FR-004]', () => {
    it('fetches conversion funnel stage metrics', async () => {
      const mockResponse = [
        {
          stage_name: 'Lead',
          count: 500,
          lead_count: 500,
          conversion_rate: 100.0,
          dropoff_rate: 0.0,
          is_bottleneck: false,
          threshold_percent: 40.0,
          overall_conversion_rate: 100.0,
        },
        {
          stage_name: 'Qualified',
          count: 200,
          lead_count: 200,
          conversion_rate: 40.0,
          dropoff_rate: 60.0,
          is_bottleneck: true,
          threshold_percent: 40.0,
          overall_conversion_rate: 40.0,
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const params: FunnelQueryParams = {
        funnel_id: 'default_funnel',
        default_threshold: 40.0,
        stages: ['Lead', 'Qualified'],
      };

      const result = await getConversionFunnel(params);

      expect(fetch).toHaveBeenCalled();
      const calledUrl = (fetch as unknown as { mock: { calls: [string[]] } }).mock.calls[0][0];
      expect(calledUrl).toContain('/api/v1/analytics/funnel');
      expect(calledUrl).toContain('funnel_id=default_funnel');
      expect(calledUrl).toContain('default_threshold=40');
      expect(calledUrl).toContain('stages=Lead%2CQualified');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getCampaignTrendComparison [FR-006]', () => {
    it('fetches multi-campaign trend comparison metrics', async () => {
      const mockResponse = {
        start_date_val: '2026-01-01T00:00:00Z',
        end_date_val: '2026-01-31T23:59:59Z',
        campaigns: [
          {
            campaign_id: 'camp-1',
            campaign_name: 'Q1 Launch',
            budget: 10000,
            total_leads: 300,
            overall_cpl: 33.33,
            overall_engagement_rate: 12.5,
            trend_points: [
              {
                period_val: '2026-01-01',
                lead_count: 10,
                cost_per_lead: 30.0,
                engagement_rate: 10.0,
              },
            ],
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const params: CampaignCompareParams = {
        campaign_ids: ['camp-1', 'camp-2'],
      };

      const result = await getCampaignTrendComparison(params);

      const calledUrl = (fetch as unknown as { mock: { calls: [string[]] } }).mock.calls[0][0];
      expect(calledUrl).toContain('/api/v1/analytics/campaigns/compare');
      expect(calledUrl).toContain('campaign_ids=camp-1%2Ccamp-2');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getTerritoryHeatmap [FR-007]', () => {
    it('fetches territory heat map density and unassigned drawer data', async () => {
      const mockResponse = {
        territories: [
          {
            territory_id: 'terr-1',
            territory_code: 'NE-US',
            territory_name: 'North East US',
            lead_count: 120,
            opportunity_count: 45,
            total_deal_value: 450000,
            average_deal_value: 10000,
            postal_code_breakdown: { '10001': 30, '10002': 25 },
          },
        ],
        unassigned_drawer: {
          total_unassigned_leads: 5,
          total_unassigned_value: 15000,
          unassigned_items: [
            {
              lead_id: 'lead-99',
              postal_code: null,
              stage_name: 'New',
              deal_value: 3000,
              event_timestamp: '2026-01-10T10:00:00Z',
              reason: 'Unmapped postal code',
            },
          ],
        },
        total_leads: 125,
        total_value: 465000,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const params: TerritoryHeatmapParams = {
        lead_status: 'Qualified',
        min_deal_value: 1000,
        include_unassigned: true,
      };

      const result = await getTerritoryHeatmap(params);

      const calledUrl = (fetch as unknown as { mock: { calls: [string[]] } }).mock.calls[0][0];
      expect(calledUrl).toContain('/api/v1/analytics/territory/heatmap');
      expect(calledUrl).toContain('lead_status=Qualified');
      expect(calledUrl).toContain('min_deal_value=1000');
      expect(calledUrl).toContain('include_unassigned=true');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('createReportAuditLog & deleteReportConfiguration [FR-011]', () => {
    it('submits audit log creation request', async () => {
      const mockResponse = {
        id: 'audit-123',
        user_id: 'user-456',
        action_type: 'UPDATE_THRESHOLD',
        config_delta: '{"bottleneck_threshold": 35.0}',
        created_on: '2026-01-15T12:00:00Z',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const payload: AuditLogCreateRequest = {
        action_type: 'UPDATE_THRESHOLD',
        config_delta: '{"bottleneck_threshold": 35.0}',
      };

      const result = await createReportAuditLog(payload);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/analytics/config/audit'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('sends DELETE request for report configuration', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => null,
      } as Response);

      await deleteReportConfiguration('config-789');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/analytics/config/config-789'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('createDatasetExport [FR-012]', () => {
    it('submits async dataset export task request', async () => {
      const mockResponse = {
        task_id: 'task-abc',
        status: 'PENDING',
        report_type: 'acquisition',
        export_format: 'csv',
        created_at: '2026-01-15T14:00:00Z',
        file_path: null,
        file_name: null,
        file_size_bytes: 0,
        row_count: 0,
        user_id: 'user-456',
        correlation_id: 'corr-111',
        error_detail: null,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => mockResponse,
      } as Response);

      const payload: ExportCreateRequest = {
        report_type: 'acquisition',
        export_format: 'csv',
        start_date_val: '2026-01-01T00:00:00Z',
      };

      const result = await createDatasetExport(payload);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/analytics/exports'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getCalendarMeetings & updateMeetingNotes [FR-009, FR-010]', () => {
    it('queries calendar meetings', async () => {
      const mockResponse = [
        {
          id: 'meet-1',
          lead_id: 'lead-1',
          scheduled_time: '2026-01-20T15:00:00Z',
          prep_notes: 'Key decision maker present',
          meeting_notes: null,
          created_on: '2026-01-10T09:00:00Z',
          followup_tasks: [],
          lead_status: 'Qualified',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const params: CalendarQueryParams = {
        user_id: 'user-456',
      };

      const result = await getCalendarMeetings(params);

      const calledUrl = (fetch as unknown as { mock: { calls: [string[]] } }).mock.calls[0][0];
      expect(calledUrl).toContain('/api/v1/marketing/calendar/meetings');
      expect(calledUrl).toContain('user_id=user-456');
      expect(result).toEqual(mockResponse);
    });

    it('updates meeting notes and creates follow-up tasks', async () => {
      const mockResponse = {
        id: 'meet-1',
        lead_id: 'lead-1',
        scheduled_time: '2026-01-20T15:00:00Z',
        prep_notes: 'Key decision maker present',
        meeting_notes: 'Agreed on proposal timeline',
        created_on: '2026-01-10T09:00:00Z',
        followup_tasks: [
          {
            id: 'task-1',
            meeting_id: 'meet-1',
            lead_id: 'lead-1',
            assigned_user_id: 'user-456',
            due_date_val: '2026-01-25T17:00:00Z',
            is_completed: false,
            task_description: 'Send formal quote',
            created_on: '2026-01-20T16:00:00Z',
          },
        ],
        lead_status: 'Proposal Sent',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const payload: MeetingNotesRequest = {
        meeting_notes: 'Agreed on proposal timeline',
        lead_status: 'Proposal Sent',
        tasks: [
          {
            task_description: 'Send formal quote',
            assigned_user_id: 'user-456',
            due_date_val: '2026-01-25T17:00:00Z',
          },
        ],
      };

      const result = await updateMeetingNotes('meet-1', payload);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/marketing/calendar/meetings/meet-1/notes'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('analyticsService object export', () => {
    it('exports all API methods on analyticsService object', () => {
      expect(analyticsService.getAcquisitionReport).toBe(getAcquisitionReport);
      expect(analyticsService.getConversionFunnel).toBe(getConversionFunnel);
      expect(analyticsService.getCampaignTrendComparison).toBe(getCampaignTrendComparison);
      expect(analyticsService.getTerritoryHeatmap).toBe(getTerritoryHeatmap);
      expect(analyticsService.createReportAuditLog).toBe(createReportAuditLog);
      expect(analyticsService.deleteReportConfiguration).toBe(deleteReportConfiguration);
      expect(analyticsService.createDatasetExport).toBe(createDatasetExport);
      expect(analyticsService.getCalendarMeetings).toBe(getCalendarMeetings);
      expect(analyticsService.updateMeetingNotes).toBe(updateMeetingNotes);
    });
  });
});
