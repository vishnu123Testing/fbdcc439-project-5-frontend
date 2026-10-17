import { request, RequestOptions } from './apiClient';

/**
 * ---------------------------------------------------------------------------
 * Acquisition Analytics Interfaces [FR-001]
 * ---------------------------------------------------------------------------
 */

/**
 * Query parameters for fetching channel acquisition report.
 */
export interface AcquisitionReportParams {
  start_date_val?: string;
  end_date_val?: string;
  channel_id?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

/**
 * Acquisition channel performance and ROI metrics item.
 */
export interface AcquisitionReportItem {
  channel_id: string;
  channel_name: string;
  lead_count: number;
  quality_score: number;
  spend_amount: number;
  revenue_amount: number;
  roi: string;
}

/**
 * ---------------------------------------------------------------------------
 * Conversion Funnel Analytics Interfaces [FR-004]
 * ---------------------------------------------------------------------------
 */

/**
 * Query parameters for retrieving conversion funnel stages.
 */
export interface FunnelQueryParams {
  funnel_id?: string;
  start_date_val?: string;
  end_date_val?: string;
  channel_id?: string;
  campaign_id?: string;
  stages?: string | string[];
  default_threshold?: number;
}

/**
 * Conversion funnel stage metrics and drop-off bottleneck flags.
 */
export interface FunnelStage {
  stage_name: string;
  count: number;
  lead_count: number;
  conversion_rate: number;
  dropoff_rate: number;
  is_bottleneck: boolean;
  threshold_percent: number;
  overall_conversion_rate: number;
}

/**
 * ---------------------------------------------------------------------------
 * Campaign Comparison Analytics Interfaces [FR-006]
 * ---------------------------------------------------------------------------
 */

/**
 * Query parameters for comparing campaign trends (2 to 5 campaigns).
 */
export interface CampaignCompareParams {
  campaign_ids?: string | string[];
  start_date_val?: string;
  end_date_val?: string;
}

/**
 * Daily or periodic time-series trend metrics for a campaign.
 */
export interface CampaignTrendPoint {
  period_val: string;
  lead_count: number;
  cost_per_lead: number;
  engagement_rate: number;
}

/**
 * Summary and time-series metrics for an individual campaign in a comparison.
 */
export interface CampaignMetrics {
  campaign_id: string;
  campaign_name: string;
  budget: number;
  total_leads: number;
  overall_cpl: number;
  overall_engagement_rate: number;
  trend_points: CampaignTrendPoint[];
}

/**
 * Comparative campaign trend analysis response payload.
 */
export interface ComparativeCampaignTrend {
  start_date_val: string | null;
  end_date_val: string | null;
  campaigns: CampaignMetrics[];
}

/**
 * ---------------------------------------------------------------------------
 * Geographic Territory Heat Map Interfaces [FR-007]
 * ---------------------------------------------------------------------------
 */

/**
 * Query parameters for territory heat map density visualization.
 */
export interface TerritoryHeatmapParams {
  lead_status?: string;
  min_deal_value?: number;
  max_deal_value?: number;
  territory_id?: string;
  start_date_val?: string;
  end_date_val?: string;
  user_authorized_territories?: string | string[];
  include_unassigned?: boolean;
}

/**
 * Detail item for an unassigned lead or opportunity event.
 */
export interface UnassignedLead {
  lead_id: string;
  postal_code: string | null;
  stage_name: string;
  deal_value: number | null;
  event_timestamp: string;
  reason: string;
}

/**
 * Breakdown drawer data for unassigned leads and opportunities.
 */
export interface UnassignedDrawer {
  total_unassigned_leads: number;
  total_unassigned_value: number;
  unassigned_items: UnassignedLead[];
}

/**
 * Territory lead and opportunity density metrics.
 */
export interface TerritoryDensity {
  territory_id: string;
  territory_code: string;
  territory_name: string;
  lead_count: number;
  opportunity_count: number;
  total_deal_value: number;
  average_deal_value: number;
  postal_code_breakdown: Record<string, number>;
}

/**
 * Geographic territory heat map response payload.
 */
export interface TerritoryHeatMap {
  territories: TerritoryDensity[];
  unassigned_drawer: UnassignedDrawer;
  total_leads: number;
  total_value: number;
}

/**
 * ---------------------------------------------------------------------------
 * Configuration & Audit Trail Interfaces [FR-011]
 * ---------------------------------------------------------------------------
 */

/**
 * Request payload for creating a reporting audit log record.
 */
export interface AuditLogCreateRequest {
  action_type: string;
  config_delta?: string | null;
}

/**
 * Audit log response payload.
 */
export interface AuditLogResponse {
  id: string;
  user_id: string | null;
  action_type: string;
  config_delta: string | null;
  created_on: string;
}

/**
 * ---------------------------------------------------------------------------
 * Dataset Export Interfaces [FR-012]
 * ---------------------------------------------------------------------------
 */

/**
 * Request payload for submitting an asynchronous dataset export task.
 */
export interface ExportCreateRequest {
  report_type: 'acquisition' | 'funnel' | 'campaigns' | 'territory' | string;
  export_format: 'csv' | 'pdf' | string;
  start_date_val?: string | null;
  end_date_val?: string | null;
  channel_id?: string | null;
  campaign_id?: string | null;
  campaign_ids?: string[] | null;
  territory_id?: string | null;
  lead_status?: string | null;
  min_deal_value?: number | null;
  max_deal_value?: number | null;
  user_authorized_territories?: string[] | null;
  filters?: Record<string, unknown> | null;
  output_dir?: string | null;
  custom_filename?: string | null;
}

/**
 * Asynchronous dataset export task status response payload.
 */
export interface ExportTaskResponse {
  task_id: string;
  status: string;
  report_type: string;
  export_format: string;
  created_at: string;
  file_path?: string | null;
  file_name?: string | null;
  file_size_bytes: number;
  row_count: number;
  user_id?: string | null;
  correlation_id?: string | null;
  error_detail?: string | null;
}

/**
 * ---------------------------------------------------------------------------
 * Meeting Calendar & Prep Interfaces [FR-009, FR-010]
 * ---------------------------------------------------------------------------
 */

/**
 * Query parameters for querying calendar meetings.
 */
export interface CalendarQueryParams {
  user_id?: string;
  start_date_val?: string;
  end_date_val?: string;
  lead_id?: string;
}

/**
 * Follow-up task creation payload within meeting notes.
 */
export interface FollowupTaskCreate {
  task_description: string;
  assigned_user_id?: string | null;
  due_date_val?: string | null;
  is_completed?: boolean;
}

/**
 * Linked follow-up task response payload.
 */
export interface FollowupTaskResponse {
  id: string;
  meeting_id?: string | null;
  lead_id: string;
  assigned_user_id?: string | null;
  due_date_val?: string | null;
  is_completed: boolean;
  task_description: string;
  created_on: string;
}

export type FollowupTask = FollowupTaskResponse;

/**
 * Meeting notes, prep briefing, and lead status update payload.
 */
export interface MeetingNotesRequest {
  meeting_notes?: string | null;
  prep_notes?: string | null;
  lead_status?: string | null;
  tasks?: FollowupTaskCreate[] | null;
}

/**
 * Meeting calendar entry response payload.
 */
export interface MeetingCalendarResponse {
  id: string;
  lead_id: string;
  scheduled_time: string;
  prep_notes?: string | null;
  meeting_notes?: string | null;
  created_on: string;
  followup_tasks: FollowupTaskResponse[];
  lead_status?: string | null;
}

export type MeetingCalendar = MeetingCalendarResponse;

/**
 * Helper to construct URL search query strings from parameter objects.
 */
function buildQueryString(params: Record<string, unknown>): string {
  const queryParts: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) {
        // Pass arrays as comma-separated or repeated values
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value.join(','))}`);
      }
    } else {
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }

  return queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
}

/**
 * ---------------------------------------------------------------------------
 * Analytics API Client Service Functions
 * ---------------------------------------------------------------------------
 */

/**
 * Retrieve channel acquisition performance metrics, quality scores, spend, revenue, and ROI [FR-001].
 */
export async function getAcquisitionReport(
  params?: AcquisitionReportParams,
  options?: RequestOptions
): Promise<AcquisitionReportItem[]> {
  const queryStr = params ? buildQueryString(params as Record<string, unknown>) : '';
  const endpoint = `/analytics/acquisition${queryStr}`;
  return request<AcquisitionReportItem[]>(endpoint, {
    method: 'GET',
    ...options,
  });
}

/**
 * Retrieve conversion funnel stages, step conversion rates, and drop-off bottleneck flags [FR-004].
 */
export async function getConversionFunnel(
  params?: FunnelQueryParams,
  options?: RequestOptions
): Promise<FunnelStage[]> {
  const queryStr = params ? buildQueryString(params as Record<string, unknown>) : '';
  const endpoint = `/analytics/funnel${queryStr}`;
  return request<FunnelStage[]>(endpoint, {
    method: 'GET',
    ...options,
  });
}

/**
 * Compare trend metrics across 2 to 5 campaigns simultaneously [FR-006].
 */
export async function getCampaignTrendComparison(
  params?: CampaignCompareParams,
  options?: RequestOptions
): Promise<ComparativeCampaignTrend> {
  const queryStr = params ? buildQueryString(params as Record<string, unknown>) : '';
  const endpoint = `/analytics/campaigns/compare${queryStr}`;
  return request<ComparativeCampaignTrend>(endpoint, {
    method: 'GET',
    ...options,
  });
}

/**
 * Retrieve geographic territory heat map metrics and unassigned lead breakdown drawer [FR-007].
 */
export async function getTerritoryHeatmap(
  params?: TerritoryHeatmapParams,
  options?: RequestOptions
): Promise<TerritoryHeatMap> {
  const queryStr = params ? buildQueryString(params as Record<string, unknown>) : '';
  const endpoint = `/analytics/territory/heatmap${queryStr}`;
  return request<TerritoryHeatMap>(endpoint, {
    method: 'GET',
    ...options,
  });
}

/**
 * Create an administrative reporting configuration audit log entry [FR-011].
 */
export async function createReportAuditLog(
  payload: AuditLogCreateRequest,
  options?: RequestOptions
): Promise<AuditLogResponse> {
  const endpoint = '/analytics/config/audit';
  return request<AuditLogResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
  });
}

/**
 * Delete a reporting configuration or threshold definition [FR-011, REST rule].
 */
export async function deleteReportConfiguration(
  configId: string,
  options?: RequestOptions
): Promise<void> {
  const endpoint = `/analytics/config/${encodeURIComponent(configId)}`;
  await request<void>(endpoint, {
    method: 'DELETE',
    ...options,
  });
}

/**
 * Submit an asynchronous dataset export task (CSV or PDF) [FR-012].
 */
export async function createDatasetExport(
  payload: ExportCreateRequest,
  options?: RequestOptions
): Promise<ExportTaskResponse> {
  const endpoint = '/analytics/exports';
  return request<ExportTaskResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
  });
}

/**
 * Query upcoming and historical lead meetings, prep briefings, and linked tasks [FR-009].
 */
export async function getCalendarMeetings(
  params?: CalendarQueryParams,
  options?: RequestOptions
): Promise<MeetingCalendarResponse[]> {
  const queryStr = params ? buildQueryString(params as Record<string, unknown>) : '';
  const endpoint = `/marketing/calendar/meetings${queryStr}`;
  return request<MeetingCalendarResponse[]>(endpoint, {
    method: 'GET',
    ...options,
  });
}

/**
 * Log meeting summary notes, update prep notes, trigger lead status transition,
 * and create follow-up tracking tasks [FR-010].
 */
export async function updateMeetingNotes(
  meetingId: string,
  payload: MeetingNotesRequest,
  options?: RequestOptions
): Promise<MeetingCalendarResponse> {
  const endpoint = `/marketing/calendar/meetings/${encodeURIComponent(meetingId)}/notes`;
  return request<MeetingCalendarResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
  });
}

/**
 * Bundled analytics service API client object.
 */
export const analyticsService = {
  getAcquisitionReport,
  getConversionFunnel,
  getCampaignTrendComparison,
  getTerritoryHeatmap,
  createReportAuditLog,
  deleteReportConfiguration,
  createDatasetExport,
  getCalendarMeetings,
  updateMeetingNotes,
};

export default analyticsService;
