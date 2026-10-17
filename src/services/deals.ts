import { request, RequestOptions } from './apiClient';

/**
 * Allowed stakeholder influence levels [FR-6].
 */
export type InfluenceLevel = 'High' | 'Medium' | 'Low';

/**
 * Allowed stakeholder interaction activity types [FR-6].
 */
export type ActivityType = 'Email' | 'Meeting' | 'Call' | 'Note';

/**
 * AI Forecast status codes [FR-8].
 */
export type ForecastStatus = 'READY' | 'INSUFFICIENT_DATA' | 'COMPUTING' | 'FAILED';

/**
 * Helper to format numeric deal value into USD currency format ($50,000 or $0).
 */
export function formatDealValue(val?: number | null): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '$0';
  }
  const rounded = Math.round(val * 100) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: rounded % 1 === 0 ? 0 : 2,
  }).format(rounded);
}

/**
 * Helper to format age in days into human readable string ("15 days", "1 day", "0 days").
 */
export function formatAgeInDays(age?: number | null): string {
  if (age === null || age === undefined || isNaN(age)) {
    return '0 days';
  }
  const days = Math.max(0, Math.round(age));
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/**
 * Helper to format win probability float (0.0 - 1.0 or 0 - 100) into clean percentage ("75%").
 */
export function formatWinProbability(prob?: number | null): string {
  if (prob === null || prob === undefined || isNaN(prob)) {
    return '0%';
  }
  let pct = prob;
  if (prob <= 1.0 && prob >= 0) {
    pct = prob * 100;
  }
  const rounded = Math.min(100, Math.max(0, Math.round(pct)));
  return `${rounded}%`;
}

// ---------------------------------------------------------------------------
// Deal Interfaces
// ---------------------------------------------------------------------------

/**
 * Deal creation request payload.
 */
export interface DealCreateRequest {
  title: string;
  deal_value: number;
  milestone_stage: string;
  win_probability?: number | null;
}

/**
 * Deal milestone stage update request payload [FR-3].
 */
export interface DealStageUpdateRequest {
  milestone_stage: string;
  win_probability?: number | null;
}

/**
 * Deal card and detail response payload [FR-1, FR-2].
 */
export interface DealResponse {
  id: string;
  title: string;
  deal_value: number;
  milestone_stage: string;
  win_probability: number;
  age_in_days: number;
  created_on: string;
  updated_on: string;
}

export type Deal = DealResponse;

/**
 * Pipeline stage group column on visual board [FR-1].
 */
export interface PipelineStageGroupResponse {
  milestone_stage: string;
  total_value: number;
  deal_count: number;
  deals: DealResponse[];
}

export type PipelineStageGroup = PipelineStageGroupResponse;

/**
 * Complete visual pipeline board dataset [FR-1].
 */
export interface PipelineBoardResponse {
  stages: PipelineStageGroupResponse[];
  total_pipeline_value: number;
  total_deal_count: number;
  deals: DealResponse[];
}

export type PipelineBoard = PipelineBoardResponse;

// ---------------------------------------------------------------------------
// Action Item Interfaces
// ---------------------------------------------------------------------------

/**
 * Action item creation request payload [FR-4].
 */
export interface ActionItemCreateRequest {
  title: string;
  assigned_owner_id: string;
  target_due_date: string;
  sla_threshold_hours?: number | null;
}

/**
 * Action item response payload [FR-4].
 */
export interface ActionItemResponse {
  id: string;
  deal_id: string;
  title: string;
  assigned_owner_id: string;
  target_due_date: string;
  sla_threshold_hours: number;
  is_completed: boolean;
  completed_on?: string | null;
  is_escalated: boolean;
  escalated_on?: string | null;
  created_on: string;
  is_overdue: boolean;
}

export type ActionItem = ActionItemResponse;

// ---------------------------------------------------------------------------
// Stakeholder Interfaces
// ---------------------------------------------------------------------------

/**
 * Stakeholder contact creation request payload [FR-6].
 */
export interface StakeholderCreateRequest {
  full_name: string;
  email: string;
  org_role: string;
  influence_level?: InfluenceLevel | string;
  is_active?: boolean;
}

/**
 * Stakeholder response payload [FR-6].
 */
export interface StakeholderResponse {
  id: string;
  deal_id: string;
  full_name: string;
  email: string;
  org_role: string;
  influence_level: string;
  is_active: boolean;
  created_on: string;
}

export type Stakeholder = StakeholderResponse;

/**
 * Stakeholder activity creation request payload [FR-6].
 */
export interface ActivityCreateRequest {
  stakeholder_id: string;
  activity_type?: ActivityType | string;
  summary: string;
  occurred_on?: string | null;
}

/**
 * Stakeholder activity response payload [FR-6].
 */
export interface StakeholderActivityResponse {
  id: string;
  stakeholder_id: string;
  deal_id: string;
  activity_type: string;
  summary: string;
  occurred_on: string;
  created_on: string;
  stakeholder_name?: string | null;
}

export type StakeholderActivity = StakeholderActivityResponse;

/**
 * Stakeholder map and chronological activity feed for a deal [FR-6].
 */
export interface StakeholderMapResponse {
  deal_id: string;
  stakeholders: StakeholderResponse[];
  recent_activities: StakeholderActivityResponse[];
  total_stakeholders: number;
  total_activities: number;
}

export type StakeholderMap = StakeholderMapResponse;

// ---------------------------------------------------------------------------
// AI Forecast Interfaces
// ---------------------------------------------------------------------------

/**
 * AI estimated completion forecast response payload [FR-8].
 */
export interface ForecastResponse {
  id?: string | null;
  deal_id: string;
  estimated_completion_date?: string | null;
  confidence_score_pct?: number | null;
  status_code: ForecastStatus | string;
  calculated_on: string;
  error_detail?: string | null;
  is_sparse?: boolean;
}

export type Forecast = ForecastResponse;

// ---------------------------------------------------------------------------
// Input Sanitization & Helper Functions
// ---------------------------------------------------------------------------

/**
 * Sanitize raw string input or response property by stripping HTML tags,
 * escaping special entities, and removing control characters.
 */
export function sanitizeString(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  let str = String(val).trim();
  if (!str) {
    return '';
  }
  str = str.replace(/<[^>]*>/g, '');
  str = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  return str;
}

/**
 * Sanitize deal response object with default fallbacks.
 */
export function sanitizeDeal(deal: unknown): DealResponse {
  if (!deal || typeof deal !== 'object') {
    return {
      id: '',
      title: '',
      deal_value: 0,
      milestone_stage: '',
      win_probability: 0,
      age_in_days: 0,
      created_on: new Date().toISOString(),
      updated_on: new Date().toISOString(),
    };
  }
  const obj = deal as Record<string, unknown>;
  return {
    id: String(obj.id || ''),
    title: sanitizeString(obj.title),
    deal_value: typeof obj.deal_value === 'number' ? obj.deal_value : Number(obj.deal_value) || 0,
    milestone_stage: sanitizeString(obj.milestone_stage),
    win_probability:
      typeof obj.win_probability === 'number' ? obj.win_probability : Number(obj.win_probability) || 0,
    age_in_days: typeof obj.age_in_days === 'number' ? obj.age_in_days : Number(obj.age_in_days) || 0,
    created_on: String(obj.created_on || ''),
    updated_on: String(obj.updated_on || ''),
  };
}

/**
 * Sanitize pipeline board response structure.
 */
export function sanitizePipelineBoard(board: unknown): PipelineBoardResponse {
  if (!board || typeof board !== 'object') {
    return {
      stages: [],
      total_pipeline_value: 0,
      total_deal_count: 0,
      deals: [],
    };
  }
  const obj = board as Record<string, unknown>;
  const rawStages = Array.isArray(obj.stages) ? obj.stages : [];
  const stages: PipelineStageGroupResponse[] = rawStages.map((s: unknown) => {
    const stageObj = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    const rawDeals = Array.isArray(stageObj.deals) ? stageObj.deals : [];
    return {
      milestone_stage: sanitizeString(stageObj.milestone_stage),
      total_value: Number(stageObj.total_value) || 0,
      deal_count: Number(stageObj.deal_count) || 0,
      deals: rawDeals.map(sanitizeDeal),
    };
  });

  const rawDeals = Array.isArray(obj.deals) ? obj.deals : [];
  const deals = rawDeals.map(sanitizeDeal);

  return {
    stages,
    total_pipeline_value: Number(obj.total_pipeline_value) || 0,
    total_deal_count: Number(obj.total_deal_count) || 0,
    deals,
  };
}

/**
 * Sanitize action item response object.
 */
export function sanitizeActionItem(item: unknown): ActionItemResponse {
  if (!item || typeof item !== 'object') {
    return {
      id: '',
      deal_id: '',
      title: '',
      assigned_owner_id: '',
      target_due_date: new Date().toISOString(),
      sla_threshold_hours: 24,
      is_completed: false,
      completed_on: null,
      is_escalated: false,
      escalated_on: null,
      created_on: new Date().toISOString(),
      is_overdue: false,
    };
  }
  const obj = item as Record<string, unknown>;
  return {
    id: String(obj.id || ''),
    deal_id: String(obj.deal_id || ''),
    title: sanitizeString(obj.title),
    assigned_owner_id: sanitizeString(obj.assigned_owner_id),
    target_due_date: String(obj.target_due_date || ''),
    sla_threshold_hours: Number(obj.sla_threshold_hours) || 24,
    is_completed: Boolean(obj.is_completed),
    completed_on: obj.completed_on ? String(obj.completed_on) : null,
    is_escalated: Boolean(obj.is_escalated),
    escalated_on: obj.escalated_on ? String(obj.escalated_on) : null,
    created_on: String(obj.created_on || ''),
    is_overdue: Boolean(obj.is_overdue),
  };
}

/**
 * Sanitize stakeholder response object.
 */
export function sanitizeStakeholder(s: unknown): StakeholderResponse {
  if (!s || typeof s !== 'object') {
    return {
      id: '',
      deal_id: '',
      full_name: '',
      email: '',
      org_role: '',
      influence_level: 'Medium',
      is_active: true,
      created_on: new Date().toISOString(),
    };
  }
  const obj = s as Record<string, unknown>;
  return {
    id: String(obj.id || ''),
    deal_id: String(obj.deal_id || ''),
    full_name: sanitizeString(obj.full_name),
    email: sanitizeString(obj.email),
    org_role: sanitizeString(obj.org_role),
    influence_level: sanitizeString(obj.influence_level) || 'Medium',
    is_active: obj.is_active !== undefined ? Boolean(obj.is_active) : true,
    created_on: String(obj.created_on || ''),
  };
}

/**
 * Sanitize stakeholder activity log entry object.
 */
export function sanitizeActivity(a: unknown): StakeholderActivityResponse {
  if (!a || typeof a !== 'object') {
    return {
      id: '',
      stakeholder_id: '',
      deal_id: '',
      activity_type: 'Note',
      summary: '',
      occurred_on: new Date().toISOString(),
      created_on: new Date().toISOString(),
      stakeholder_name: null,
    };
  }
  const obj = a as Record<string, unknown>;
  return {
    id: String(obj.id || ''),
    stakeholder_id: String(obj.stakeholder_id || ''),
    deal_id: String(obj.deal_id || ''),
    activity_type: sanitizeString(obj.activity_type) || 'Note',
    summary: sanitizeString(obj.summary),
    occurred_on: String(obj.occurred_on || ''),
    created_on: String(obj.created_on || ''),
    stakeholder_name: obj.stakeholder_name ? sanitizeString(obj.stakeholder_name) : null,
  };
}

/**
 * Sanitize stakeholder map response object.
 */
export function sanitizeStakeholderMap(map: unknown): StakeholderMapResponse {
  if (!map || typeof map !== 'object') {
    return {
      deal_id: '',
      stakeholders: [],
      recent_activities: [],
      total_stakeholders: 0,
      total_activities: 0,
    };
  }
  const obj = map as Record<string, unknown>;
  const rawStakeholders = Array.isArray(obj.stakeholders) ? obj.stakeholders : [];
  const rawActivities = Array.isArray(obj.recent_activities) ? obj.recent_activities : [];

  return {
    deal_id: String(obj.deal_id || ''),
    stakeholders: rawStakeholders.map(sanitizeStakeholder),
    recent_activities: rawActivities.map(sanitizeActivity),
    total_stakeholders: Number(obj.total_stakeholders) || 0,
    total_activities: Number(obj.total_activities) || 0,
  };
}

/**
 * Sanitize AI completion forecast response object.
 */
export function sanitizeForecast(f: unknown): ForecastResponse {
  if (!f || typeof f !== 'object') {
    return {
      id: null,
      deal_id: '',
      estimated_completion_date: null,
      confidence_score_pct: null,
      status_code: 'INSUFFICIENT_DATA',
      calculated_on: new Date().toISOString(),
      error_detail: null,
      is_sparse: true,
    };
  }
  const obj = f as Record<string, unknown>;
  return {
    id: obj.id ? String(obj.id) : null,
    deal_id: String(obj.deal_id || ''),
    estimated_completion_date: obj.estimated_completion_date ? String(obj.estimated_completion_date) : null,
    confidence_score_pct:
      obj.confidence_score_pct !== null && obj.confidence_score_pct !== undefined
        ? Number(obj.confidence_score_pct)
        : null,
    status_code: sanitizeString(obj.status_code) || 'INSUFFICIENT_DATA',
    calculated_on: String(obj.calculated_on || ''),
    error_detail: obj.error_detail ? sanitizeString(obj.error_detail) : null,
    is_sparse: Boolean(obj.is_sparse),
  };
}

// ---------------------------------------------------------------------------
// API Client Functions
// ---------------------------------------------------------------------------

/**
 * Retrieve interactive visual deal pipeline board grouped by milestone stages [FR-1, FR-2].
 */
export async function getPipelineBoard(
  stage?: string,
  options?: RequestOptions
): Promise<PipelineBoardResponse> {
  let endpoint = '/deals/pipeline';
  if (stage && stage.trim()) {
    const cleanStage = encodeURIComponent(stage.trim());
    endpoint += `?stage=${cleanStage}`;
  }
  const data = await request<PipelineBoardResponse>(endpoint, {
    method: 'GET',
    ...options,
  });
  return sanitizePipelineBoard(data);
}

/**
 * Create a new deal record and dispatch initial AI forecast calculation event [FR-1, FR-2].
 */
export async function createDeal(
  payload: DealCreateRequest,
  options?: RequestOptions
): Promise<DealResponse> {
  const sanitizedPayload: DealCreateRequest = {
    title: sanitizeString(payload.title),
    deal_value: Number(payload.deal_value) || 0,
    milestone_stage: sanitizeString(payload.milestone_stage),
    win_probability:
      payload.win_probability !== undefined && payload.win_probability !== null
        ? Number(payload.win_probability)
        : null,
  };
  const data = await request<DealResponse>('/deals', {
    method: 'POST',
    body: JSON.stringify(sanitizedPayload),
    ...options,
  });
  return sanitizeDeal(data);
}

/**
 * Retrieve deal details, age in days, and win probability by deal ID [FR-1, FR-2].
 */
export async function getDeal(
  dealId: string,
  options?: RequestOptions
): Promise<DealResponse> {
  const cleanId = encodeURIComponent(sanitizeString(dealId));
  const data = await request<DealResponse>(`/deals/${cleanId}`, {
    method: 'GET',
    ...options,
  });
  return sanitizeDeal(data);
}

/**
 * Update deal milestone stage progression directly from visual pipeline interface [FR-3].
 */
export async function updateDealStage(
  dealId: string,
  payload: DealStageUpdateRequest,
  options?: RequestOptions
): Promise<DealResponse> {
  const cleanId = encodeURIComponent(sanitizeString(dealId));
  const sanitizedPayload: DealStageUpdateRequest = {
    milestone_stage: sanitizeString(payload.milestone_stage),
    win_probability:
      payload.win_probability !== undefined && payload.win_probability !== null
        ? Number(payload.win_probability)
        : null,
  };
  const data = await request<DealResponse>(`/deals/${cleanId}/stage`, {
    method: 'PATCH',
    body: JSON.stringify(sanitizedPayload),
    ...options,
  });
  return sanitizeDeal(data);
}

/**
 * Create an action item assigned to a deal with owner and SLA configuration [FR-4].
 */
export async function createActionItem(
  dealId: string,
  payload: ActionItemCreateRequest,
  options?: RequestOptions
): Promise<ActionItemResponse> {
  const cleanId = encodeURIComponent(sanitizeString(dealId));
  const sanitizedPayload: ActionItemCreateRequest = {
    title: sanitizeString(payload.title),
    assigned_owner_id: sanitizeString(payload.assigned_owner_id),
    target_due_date: sanitizeString(payload.target_due_date),
    sla_threshold_hours:
      payload.sla_threshold_hours !== undefined && payload.sla_threshold_hours !== null
        ? Number(payload.sla_threshold_hours)
        : 24,
  };
  const data = await request<ActionItemResponse>(`/deals/${cleanId}/action-items`, {
    method: 'POST',
    body: JSON.stringify(sanitizedPayload),
    ...options,
  });
  return sanitizeActionItem(data);
}

/**
 * Retrieve action items assigned to a deal with optional inclusion of completed items [FR-4].
 */
export async function getActionItems(
  dealId: string,
  includeCompleted: boolean = true,
  options?: RequestOptions
): Promise<ActionItemResponse[]> {
  const cleanId = encodeURIComponent(sanitizeString(dealId));
  const endpoint = `/deals/${cleanId}/action-items?include_completed=${includeCompleted}`;
  const data = await request<ActionItemResponse[]>(endpoint, {
    method: 'GET',
    ...options,
  });
  return Array.isArray(data) ? data.map(sanitizeActionItem) : [];
}

/**
 * Mark an action item as completed and clear its SLA escalation state [FR-4].
 */
export async function completeActionItem(
  dealId: string,
  itemId: string,
  options?: RequestOptions
): Promise<ActionItemResponse> {
  const cleanDealId = encodeURIComponent(sanitizeString(dealId));
  const cleanItemId = encodeURIComponent(sanitizeString(itemId));
  const data = await request<ActionItemResponse>(
    `/deals/${cleanDealId}/action-items/${cleanItemId}/complete`,
    {
      method: 'PATCH',
      body: JSON.stringify({}),
      ...options,
    }
  );
  return sanitizeActionItem(data);
}

/**
 * Delete an action item record (204 No Content response) [FR-4, ARCHITECTURE §5].
 */
export async function deleteActionItem(
  dealId: string,
  itemId: string,
  options?: RequestOptions
): Promise<void> {
  const cleanDealId = encodeURIComponent(sanitizeString(dealId));
  const cleanItemId = encodeURIComponent(sanitizeString(itemId));
  return request<void>(`/deals/${cleanDealId}/action-items/${cleanItemId}`, {
    method: 'DELETE',
    ...options,
  });
}

/**
 * Retrieve stakeholder contacts and chronological CRM interaction activity feed for a deal [FR-6].
 */
export async function getStakeholders(
  dealId: string,
  activeOnly: boolean = false,
  options?: RequestOptions
): Promise<StakeholderMapResponse> {
  const cleanId = encodeURIComponent(sanitizeString(dealId));
  const endpoint = `/deals/${cleanId}/stakeholders?active_only=${activeOnly}`;
  const data = await request<StakeholderMapResponse>(endpoint, {
    method: 'GET',
    ...options,
  });
  return sanitizeStakeholderMap(data);
}

/**
 * Map a new stakeholder contact with role and influence level to a deal [FR-6].
 */
export async function createStakeholder(
  dealId: string,
  payload: StakeholderCreateRequest,
  options?: RequestOptions
): Promise<StakeholderResponse> {
  const cleanId = encodeURIComponent(sanitizeString(dealId));
  const sanitizedPayload: StakeholderCreateRequest = {
    full_name: sanitizeString(payload.full_name),
    email: sanitizeString(payload.email),
    org_role: sanitizeString(payload.org_role),
    influence_level: payload.influence_level ? sanitizeString(payload.influence_level) : 'Medium',
    is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
  };
  const data = await request<StakeholderResponse>(`/deals/${cleanId}/stakeholders`, {
    method: 'POST',
    body: JSON.stringify(sanitizedPayload),
    ...options,
  });
  return sanitizeStakeholder(data);
}

/**
 * Log a stakeholder CRM interaction activity (Email, Meeting, Call, Note) [FR-6].
 */
export async function addStakeholderActivity(
  dealId: string,
  payload: ActivityCreateRequest,
  options?: RequestOptions
): Promise<StakeholderActivityResponse> {
  const cleanId = encodeURIComponent(sanitizeString(dealId));
  const sanitizedPayload: ActivityCreateRequest = {
    stakeholder_id: sanitizeString(payload.stakeholder_id),
    activity_type: payload.activity_type ? sanitizeString(payload.activity_type) : 'Note',
    summary: sanitizeString(payload.summary),
    occurred_on: payload.occurred_on ? sanitizeString(payload.occurred_on) : null,
  };
  const data = await request<StakeholderActivityResponse>(
    `/deals/${cleanId}/stakeholders/activities`,
    {
      method: 'POST',
      body: JSON.stringify(sanitizedPayload),
      ...options,
    }
  );
  return sanitizeActivity(data);
}

/**
 * Retrieve AI completion timeline forecast for a deal [FR-8].
 */
export async function getForecast(
  dealId: string,
  options?: RequestOptions
): Promise<ForecastResponse> {
  const cleanId = encodeURIComponent(sanitizeString(dealId));
  const data = await request<ForecastResponse>(`/deals/${cleanId}/forecast`, {
    method: 'GET',
    ...options,
  });
  return sanitizeForecast(data);
}

/**
 * Trigger explicit recalculation of AI completion timeline forecast for a deal [FR-8].
 */
export async function recalculateForecast(
  dealId: string,
  options?: RequestOptions
): Promise<ForecastResponse> {
  const cleanId = encodeURIComponent(sanitizeString(dealId));
  const data = await request<ForecastResponse>(`/deals/${cleanId}/forecast/recalculate`, {
    method: 'POST',
    ...options,
  });
  return sanitizeForecast(data);
}

/**
 * Deals API service object aggregation.
 */
export const dealsService = {
  getPipelineBoard,
  createDeal,
  getDeal,
  updateDealStage,
  createActionItem,
  getActionItems,
  completeActionItem,
  deleteActionItem,
  getStakeholders,
  createStakeholder,
  addStakeholderActivity,
  getForecast,
  recalculateForecast,
  sanitizeString,
  sanitizeDeal,
  sanitizePipelineBoard,
  sanitizeActionItem,
  sanitizeStakeholder,
  sanitizeActivity,
  sanitizeStakeholderMap,
  sanitizeForecast,
};

export default dealsService;
