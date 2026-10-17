import { request, RequestOptions, buildUrl, getToken } from './apiClient';

/**
 * Priority codes for support tickets [FR-1].
 */
export type TicketPriority = 'P1' | 'P2' | 'P3';

/**
 * Status codes for support tickets [FR-1].
 */
export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';

/**
 * Sender types for message thread history [FR-2].
 */
export type SenderType = 'client' | 'agent' | 'system';

/**
 * SLA target type classifications [FR-4].
 */
export type SLATargetType = 'first_response' | 'resolution';

// ---------------------------------------------------------------------------
// File Attachment Validation Constants & Interfaces [FR-3, NFR-2]
// ---------------------------------------------------------------------------

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.doc',
  '.txt',
  '.png',
  '.jpg',
  '.jpeg',
];
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
];

/**
 * File attachment metadata payload [FR-2, FR-3].
 */
export interface AttachmentResponse {
  id: string;
  message_id: string;
  filename: string;
  file_size_bytes: number;
  mime_type: string;
  storage_key: string;
  uploaded_at: string;
}

export type Attachment = AttachmentResponse;

/**
 * File attachment inline content payload.
 */
export interface AttachmentData {
  filename: string;
  content: string; // Base64 or plain string payload
  mime_type?: string;
}

// ---------------------------------------------------------------------------
// Message Thread Interfaces [FR-2, FR-7]
// ---------------------------------------------------------------------------

/**
 * Sequential message thread record [FR-2].
 */
export interface MessageResponse {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: SenderType | string;
  message_body: string;
  created_at: string;
  attachments: AttachmentResponse[];
}

export type TicketMessage = MessageResponse;

/**
 * Request payload for appending a message to a ticket thread [FR-2].
 */
export interface MessageCreateRequest {
  message_body: string;
  sender_id?: string;
  sender_type?: SenderType | string;
  attachments?: AttachmentData[];
}

// ---------------------------------------------------------------------------
// SLA Tracking Interfaces [FR-4, FR-5, FR-6]
// ---------------------------------------------------------------------------

/**
 * SLA compliance countdown tracking record [FR-4].
 */
export interface SLATrackingResponse {
  id: string;
  ticket_id: string;
  target_type: SLATargetType | string;
  target_due_at: string;
  warning_sent_at?: string | null;
  breached_at?: string | null;
  is_breached: boolean;
}

export type SLATracking = SLATrackingResponse;

// ---------------------------------------------------------------------------
// CSAT Rating Interfaces [FR-9]
// ---------------------------------------------------------------------------

/**
 * Customer satisfaction rating record [FR-9].
 */
export interface CSATRatingResponse {
  id: string;
  ticket_id: string;
  score: number; // 1 to 5
  feedback_text?: string | null;
  submitted_at: string;
}

export type CSATRating = CSATRatingResponse;

/**
 * Request payload for submitting CSAT survey feedback [FR-9].
 */
export interface CSATRatingCreateRequest {
  score: number; // 1 to 5
  feedback_text?: string | null;
}

// ---------------------------------------------------------------------------
// Ticket Interfaces [FR-1, FR-7]
// ---------------------------------------------------------------------------

/**
 * Request payload for creating a support ticket [FR-1].
 */
export interface TicketCreateRequest {
  subject: string;
  description: string;
  client_id: string;
  priority?: TicketPriority | string;
  assigned_tier?: string;
  assigned_agent_id?: string | null;
}

/**
 * Request payload for updating support ticket properties [FR-1].
 */
export interface TicketUpdateRequest {
  status?: TicketStatus | string | null;
  priority?: TicketPriority | string | null;
  assigned_tier?: string | null;
  assigned_agent_id?: string | null;
  subject?: string | null;
  description?: string | null;
}

/**
 * Support ticket summary item in list responses [FR-1].
 */
export interface TicketSummaryResponse {
  id: string;
  priority: TicketPriority | string;
  status: TicketStatus | string;
  subject: string;
  description: string;
  client_id: string;
  assigned_tier: string;
  assigned_agent_id?: string | null;
  created_at: string;
  updated_at: string;
  first_responded_at?: string | null;
  resolved_at?: string | null;
  sla_trackings: SLATrackingResponse[];
}

export type TicketSummary = TicketSummaryResponse;

/**
 * Full details for a support ticket including messages and SLA targets [FR-1, FR-2, FR-4].
 */
export interface TicketDetailResponse {
  id: string;
  priority: TicketPriority | string;
  status: TicketStatus | string;
  subject: string;
  description: string;
  client_id: string;
  assigned_tier: string;
  assigned_agent_id?: string | null;
  created_at: string;
  updated_at: string;
  first_responded_at?: string | null;
  resolved_at?: string | null;
  messages: MessageResponse[];
  sla_trackings: SLATrackingResponse[];
  csat_rating?: CSATRatingResponse | null;
}

export type TicketDetail = TicketDetailResponse;
export type SupportTicket = TicketDetailResponse;

/**
 * Paginated list response payload for support tickets [FR-1].
 */
export interface TicketListResponse {
  items: TicketSummaryResponse[];
  total_count: number;
  limit: number;
  offset: number;
}

/**
 * Filter parameters for querying support tickets [FR-1].
 */
export interface TicketFilterParams {
  client_id?: string;
  priority?: TicketPriority | string;
  status?: TicketStatus | string;
  assigned_tier?: string;
  assigned_agent_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Support Analytics Interfaces [FR-8]
// ---------------------------------------------------------------------------

export interface PriorityBreakdown {
  P1: number;
  P2: number;
  P3: number;
}

/**
 * Operational support performance analytics metrics [FR-8].
 */
export interface SupportAnalyticsResponse {
  start_time?: string | null;
  end_time?: string | null;
  total_tickets: number;
  open_tickets: number;
  pending_tickets: number;
  resolved_tickets: number;
  average_first_response_time_seconds: number;
  mean_time_to_resolution_seconds: number;
  total_sla_targets: number;
  breached_sla_targets: number;
  sla_breach_rate_percent: number;
  average_csat_score: number;
  csat_response_count: number;
  priority_breakdown: PriorityBreakdown;
}

export type SupportAnalytics = SupportAnalyticsResponse;

/**
 * Query filter parameters for support analytics [FR-8].
 */
export interface AnalyticsFilterParams {
  start_time?: string;
  end_time?: string;
  priority?: TicketPriority | string;
  client_id?: string;
}

// ---------------------------------------------------------------------------
// Helper & Sanitization Functions [FR-3, NFR-2]
// ---------------------------------------------------------------------------

/**
 * Sanitize raw string input by stripping script and HTML markup,
 * escaping special entities, and removing control characters [NFR-2].
 */
export function sanitizeString(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  let str = String(val).trim();
  if (!str) {
    return '';
  }
  // Strip HTML and script tags
  str = str.replace(/<[^>]*>/g, '');
  // Escape remaining special entity characters
  str = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  // Remove control characters except space, tab, newline
  str = str.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');
  return str;
}

/**
 * Validate file attachment size and MIME/extension type prior to upload [FR-3, NFR-2].
 */
export function validateFileAttachment(file: {
  name: string;
  size: number;
  type?: string;
}): { is_valid: boolean; error_message?: string } {
  if (!file || typeof file !== 'object') {
    return { is_valid: false, error_message: 'Invalid file object provided.' };
  }

  if (file.size <= 0) {
    return { is_valid: false, error_message: 'File attachment cannot be empty.' };
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    const sizeMb = (MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    return {
      is_valid: false,
      error_message: `File size exceeds maximum allowable limit of ${sizeMb} MB.`,
    };
  }

  const filename = file.name || '';
  const extMatch = filename.match(/\.[0-9a-z]+$/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : '';

  const isExtAllowed = ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext);
  const isMimeAllowed = file.type ? ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type.toLowerCase()) : false;

  if (!isExtAllowed && !isMimeAllowed) {
    return {
      is_valid: false,
      error_message: `Unsupported file type '${ext || file.type}'. Allowed extensions: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(', ')}`,
    };
  }

  return { is_valid: true };
}

/**
 * Fallback sanitizer for file attachment response objects.
 */
export function sanitizeAttachment(obj: unknown): AttachmentResponse {
  if (!obj || typeof obj !== 'object') {
    return {
      id: '',
      message_id: '',
      filename: '',
      file_size_bytes: 0,
      mime_type: 'application/octet-stream',
      storage_key: '',
      uploaded_at: new Date().toISOString(),
    };
  }
  const raw = obj as Record<string, unknown>;
  return {
    id: sanitizeString(raw.id),
    message_id: sanitizeString(raw.message_id),
    filename: sanitizeString(raw.filename),
    file_size_bytes: typeof raw.file_size_bytes === 'number' ? raw.file_size_bytes : 0,
    mime_type: sanitizeString(raw.mime_type) || 'application/octet-stream',
    storage_key: sanitizeString(raw.storage_key),
    uploaded_at: sanitizeString(raw.uploaded_at) || new Date().toISOString(),
  };
}

/**
 * Fallback sanitizer for ticket message response objects.
 */
export function sanitizeMessage(obj: unknown): MessageResponse {
  if (!obj || typeof obj !== 'object') {
    return {
      id: '',
      ticket_id: '',
      sender_id: '',
      sender_type: 'client',
      message_body: '',
      created_at: new Date().toISOString(),
      attachments: [],
    };
  }
  const raw = obj as Record<string, unknown>;
  const rawAtts = Array.isArray(raw.attachments) ? raw.attachments : [];
  return {
    id: sanitizeString(raw.id),
    ticket_id: sanitizeString(raw.ticket_id),
    sender_id: sanitizeString(raw.sender_id),
    sender_type: sanitizeString(raw.sender_type) || 'client',
    message_body: sanitizeString(raw.message_body),
    created_at: sanitizeString(raw.created_at) || new Date().toISOString(),
    attachments: rawAtts.map(sanitizeAttachment),
  };
}

/**
 * Fallback sanitizer for SLA tracking response objects.
 */
export function sanitizeSLATracking(obj: unknown): SLATrackingResponse {
  if (!obj || typeof obj !== 'object') {
    return {
      id: '',
      ticket_id: '',
      target_type: 'resolution',
      target_due_at: new Date().toISOString(),
      warning_sent_at: null,
      breached_at: null,
      is_breached: false,
    };
  }
  const raw = obj as Record<string, unknown>;
  return {
    id: sanitizeString(raw.id),
    ticket_id: sanitizeString(raw.ticket_id),
    target_type: sanitizeString(raw.target_type) || 'resolution',
    target_due_at: sanitizeString(raw.target_due_at) || new Date().toISOString(),
    warning_sent_at: raw.warning_sent_at ? sanitizeString(raw.warning_sent_at) : null,
    breached_at: raw.breached_at ? sanitizeString(raw.breached_at) : null,
    is_breached: Boolean(raw.is_breached),
  };
}

/**
 * Fallback sanitizer for CSAT rating response objects.
 */
export function sanitizeCSATRating(obj: unknown): CSATRatingResponse {
  if (!obj || typeof obj !== 'object') {
    return {
      id: '',
      ticket_id: '',
      score: 5,
      feedback_text: null,
      submitted_at: new Date().toISOString(),
    };
  }
  const raw = obj as Record<string, unknown>;
  const scoreVal = typeof raw.score === 'number' ? Math.max(1, Math.min(5, raw.score)) : 5;
  return {
    id: sanitizeString(raw.id),
    ticket_id: sanitizeString(raw.ticket_id),
    score: scoreVal,
    feedback_text: raw.feedback_text ? sanitizeString(raw.feedback_text) : null,
    submitted_at: sanitizeString(raw.submitted_at) || new Date().toISOString(),
  };
}

/**
 * Fallback sanitizer for ticket summary response objects.
 */
export function sanitizeTicketSummary(obj: unknown): TicketSummaryResponse {
  if (!obj || typeof obj !== 'object') {
    return {
      id: '',
      priority: 'P3',
      status: 'open',
      subject: '',
      description: '',
      client_id: '',
      assigned_tier: 'Tier 1',
      assigned_agent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      first_responded_at: null,
      resolved_at: null,
      sla_trackings: [],
    };
  }
  const raw = obj as Record<string, unknown>;
  const rawSla = Array.isArray(raw.sla_trackings) ? raw.sla_trackings : [];
  return {
    id: sanitizeString(raw.id),
    priority: (sanitizeString(raw.priority) as TicketPriority) || 'P3',
    status: (sanitizeString(raw.status) as TicketStatus) || 'open',
    subject: sanitizeString(raw.subject),
    description: sanitizeString(raw.description),
    client_id: sanitizeString(raw.client_id),
    assigned_tier: sanitizeString(raw.assigned_tier) || 'Tier 1',
    assigned_agent_id: raw.assigned_agent_id ? sanitizeString(raw.assigned_agent_id) : null,
    created_at: sanitizeString(raw.created_at) || new Date().toISOString(),
    updated_at: sanitizeString(raw.updated_at) || new Date().toISOString(),
    first_responded_at: raw.first_responded_at ? sanitizeString(raw.first_responded_at) : null,
    resolved_at: raw.resolved_at ? sanitizeString(raw.resolved_at) : null,
    sla_trackings: rawSla.map(sanitizeSLATracking),
  };
}

/**
 * Fallback sanitizer for ticket detail response objects.
 */
export function sanitizeTicketDetail(obj: unknown): TicketDetailResponse {
  if (!obj || typeof obj !== 'object') {
    return {
      id: '',
      priority: 'P3',
      status: 'open',
      subject: '',
      description: '',
      client_id: '',
      assigned_tier: 'Tier 1',
      assigned_agent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      first_responded_at: null,
      resolved_at: null,
      messages: [],
      sla_trackings: [],
      csat_rating: null,
    };
  }
  const raw = obj as Record<string, unknown>;
  const rawMsgs = Array.isArray(raw.messages) ? raw.messages : [];
  const rawSla = Array.isArray(raw.sla_trackings) ? raw.sla_trackings : [];
  return {
    id: sanitizeString(raw.id),
    priority: (sanitizeString(raw.priority) as TicketPriority) || 'P3',
    status: (sanitizeString(raw.status) as TicketStatus) || 'open',
    subject: sanitizeString(raw.subject),
    description: sanitizeString(raw.description),
    client_id: sanitizeString(raw.client_id),
    assigned_tier: sanitizeString(raw.assigned_tier) || 'Tier 1',
    assigned_agent_id: raw.assigned_agent_id ? sanitizeString(raw.assigned_agent_id) : null,
    created_at: sanitizeString(raw.created_at) || new Date().toISOString(),
    updated_at: sanitizeString(raw.updated_at) || new Date().toISOString(),
    first_responded_at: raw.first_responded_at ? sanitizeString(raw.first_responded_at) : null,
    resolved_at: raw.resolved_at ? sanitizeString(raw.resolved_at) : null,
    messages: rawMsgs.map(sanitizeMessage),
    sla_trackings: rawSla.map(sanitizeSLATracking),
    csat_rating: raw.csat_rating ? sanitizeCSATRating(raw.csat_rating) : null,
  };
}

/**
 * Fallback sanitizer for support analytics metrics response objects.
 */
export function sanitizeSupportAnalytics(obj: unknown): SupportAnalyticsResponse {
  if (!obj || typeof obj !== 'object') {
    return {
      start_time: null,
      end_time: null,
      total_tickets: 0,
      open_tickets: 0,
      pending_tickets: 0,
      resolved_tickets: 0,
      average_first_response_time_seconds: 0,
      mean_time_to_resolution_seconds: 0,
      total_sla_targets: 0,
      breached_sla_targets: 0,
      sla_breach_rate_percent: 0,
      average_csat_score: 0,
      csat_response_count: 0,
      priority_breakdown: { P1: 0, P2: 0, P3: 0 },
    };
  }
  const raw = obj as Record<string, unknown>;
  const rawPb = (raw.priority_breakdown || {}) as Record<string, unknown>;
  return {
    start_time: raw.start_time ? sanitizeString(raw.start_time) : null,
    end_time: raw.end_time ? sanitizeString(raw.end_time) : null,
    total_tickets: typeof raw.total_tickets === 'number' ? raw.total_tickets : 0,
    open_tickets: typeof raw.open_tickets === 'number' ? raw.open_tickets : 0,
    pending_tickets: typeof raw.pending_tickets === 'number' ? raw.pending_tickets : 0,
    resolved_tickets: typeof raw.resolved_tickets === 'number' ? raw.resolved_tickets : 0,
    average_first_response_time_seconds:
      typeof raw.average_first_response_time_seconds === 'number'
        ? raw.average_first_response_time_seconds
        : 0,
    mean_time_to_resolution_seconds:
      typeof raw.mean_time_to_resolution_seconds === 'number'
        ? raw.mean_time_to_resolution_seconds
        : 0,
    total_sla_targets: typeof raw.total_sla_targets === 'number' ? raw.total_sla_targets : 0,
    breached_sla_targets: typeof raw.breached_sla_targets === 'number' ? raw.breached_sla_targets : 0,
    sla_breach_rate_percent:
      typeof raw.sla_breach_rate_percent === 'number' ? raw.sla_breach_rate_percent : 0,
    average_csat_score: typeof raw.average_csat_score === 'number' ? raw.average_csat_score : 0,
    csat_response_count: typeof raw.csat_response_count === 'number' ? raw.csat_response_count : 0,
    priority_breakdown: {
      P1: typeof rawPb.P1 === 'number' ? rawPb.P1 : 0,
      P2: typeof rawPb.P2 === 'number' ? rawPb.P2 : 0,
      P3: typeof rawPb.P3 === 'number' ? rawPb.P3 : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// API Methods [FR-1, FR-2, FR-3, FR-4, FR-8, FR-9]
// ---------------------------------------------------------------------------

/**
 * Create a new support ticket and initialize SLA countdown targets [FR-1, FR-4, FR-7].
 */
export async function createTicket(
  payload: TicketCreateRequest,
  options?: RequestOptions
): Promise<TicketDetailResponse> {
  const response = await request<TicketDetailResponse>('/tickets', {
    method: 'POST',
    body: JSON.stringify({
      subject: payload.subject,
      description: payload.description,
      client_id: payload.client_id,
      priority: payload.priority || 'P3',
      assigned_tier: payload.assigned_tier || 'Tier 1',
      assigned_agent_id: payload.assigned_agent_id || null,
    }),
    ...options,
  });
  return sanitizeTicketDetail(response);
}

/**
 * List and filter support tickets with pagination [FR-1].
 */
export async function getTickets(
  params?: TicketFilterParams,
  options?: RequestOptions
): Promise<TicketListResponse> {
  const query = new URLSearchParams();
  if (params) {
    if (params.client_id) query.set('client_id', params.client_id);
    if (params.priority) query.set('priority', params.priority);
    if (params.status) query.set('status', params.status);
    if (params.assigned_tier) query.set('assigned_tier', params.assigned_tier);
    if (params.assigned_agent_id) query.set('assigned_agent_id', params.assigned_agent_id);
    if (params.search) query.set('search', params.search);
    if (typeof params.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params.offset === 'number') query.set('offset', String(params.offset));
  }

  const queryString = query.toString();
  const endpoint = `/tickets${queryString ? `?${queryString}` : ''}`;

  const response = await request<TicketListResponse>(endpoint, {
    method: 'GET',
    ...options,
  });

  if (!response || typeof response !== 'object') {
    return { items: [], total_count: 0, limit: params?.limit || 50, offset: params?.offset || 0 };
  }

  const items = Array.isArray(response.items) ? response.items.map(sanitizeTicketSummary) : [];
  return {
    items,
    total_count: typeof response.total_count === 'number' ? response.total_count : items.length,
    limit: typeof response.limit === 'number' ? response.limit : params?.limit || 50,
    offset: typeof response.offset === 'number' ? response.offset : params?.offset || 0,
  };
}

/**
 * Retrieve detailed support ticket record by UUID [FR-1, FR-4].
 */
export async function getTicket(
  ticketId: string,
  options?: RequestOptions
): Promise<TicketDetailResponse> {
  const response = await request<TicketDetailResponse>(`/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'GET',
    ...options,
  });
  return sanitizeTicketDetail(response);
}

/**
 * Update support ticket properties (status, priority, tier, agent) [FR-1, FR-7].
 */
export async function updateTicket(
  ticketId: string,
  payload: TicketUpdateRequest,
  options?: RequestOptions
): Promise<TicketDetailResponse> {
  const response = await request<TicketDetailResponse>(`/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    ...options,
  });
  return sanitizeTicketDetail(response);
}

/**
 * Delete a support ticket record and child entities [FR-1].
 */
export async function deleteTicket(
  ticketId: string,
  options?: RequestOptions
): Promise<void> {
  await request<void>(`/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'DELETE',
    ...options,
  });
}

/**
 * Append a message to a support ticket thread [FR-2, FR-7].
 */
export async function addMessage(
  ticketId: string,
  payload: MessageCreateRequest,
  options?: RequestOptions
): Promise<MessageResponse> {
  const response = await request<MessageResponse>(`/tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
  });
  return sanitizeMessage(response);
}

/**
 * Retrieve sequential message thread history for a ticket [FR-2].
 */
export async function getTicketMessages(
  ticketId: string,
  options?: RequestOptions
): Promise<MessageResponse[]> {
  const response = await request<MessageResponse[]>(`/tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: 'GET',
    ...options,
  });
  if (!Array.isArray(response)) {
    return [];
  }
  return response.map(sanitizeMessage);
}

/**
 * Upload a binary file attachment for a ticket and message [FR-3, NFR-2].
 */
export async function uploadAttachment(
  ticketId: string,
  file: File,
  messageId?: string,
  options?: RequestOptions
): Promise<AttachmentResponse> {
  const valRes = validateFileAttachment(file);
  if (!valRes.is_valid) {
    throw new Error(valRes.error_message || 'File attachment validation failed.');
  }

  const formData = new FormData();
  formData.append('file', file);
  if (messageId) {
    formData.append('message_id', messageId);
  }

  const endpoint = `/tickets/${encodeURIComponent(ticketId)}/attachments`;

  const response = await request<AttachmentResponse>(endpoint, {
    method: 'POST',
    body: formData,
    ...options,
  });

  return sanitizeAttachment(response);
}

/**
 * Construct URL string for downloading/viewing a file attachment [FR-3].
 */
export function getAttachmentUrl(attachmentId: string, ticketId?: string): string {
  if (ticketId) {
    return buildUrl(`/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachmentId)}`);
  }
  return buildUrl(`/tickets/attachments/${encodeURIComponent(attachmentId)}`);
}

/**
 * Fetch raw binary blob payload for a file attachment [FR-3].
 */
export async function downloadAttachment(
  attachmentId: string,
  ticketId?: string,
  options?: RequestOptions
): Promise<Blob> {
  const url = getAttachmentUrl(attachmentId, ticketId);
  const token = getToken();

  const headers = new Headers(options?.headers);
  if (token && !headers.has('Authorization') && !options?.skipAuth) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    method: 'GET',
    ...options,
    headers,
  });

  if (!res.ok) {
    throw new Error(`Failed to download attachment (HTTP ${res.status})`);
  }

  return res.blob();
}

/**
 * Submit CSAT rating score and feedback for a resolved ticket [FR-9].
 */
export async function submitCSATRating(
  ticketId: string,
  payload: CSATRatingCreateRequest,
  options?: RequestOptions
): Promise<CSATRatingResponse> {
  const response = await request<CSATRatingResponse>(`/tickets/${encodeURIComponent(ticketId)}/csat`, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
  });
  return sanitizeCSATRating(response);
}

/**
 * Retrieve submitted CSAT rating feedback for a support ticket [FR-9].
 */
export async function getCSATRating(
  ticketId: string,
  options?: RequestOptions
): Promise<CSATRatingResponse> {
  const response = await request<CSATRatingResponse>(`/tickets/${encodeURIComponent(ticketId)}/csat`, {
    method: 'GET',
    ...options,
  });
  return sanitizeCSATRating(response);
}

/**
 * Retrieve aggregated operational support performance metrics [FR-8].
 */
export async function getSupportAnalytics(
  params?: AnalyticsFilterParams,
  options?: RequestOptions
): Promise<SupportAnalyticsResponse> {
  const query = new URLSearchParams();
  if (params) {
    if (params.start_time) query.set('start_time', params.start_time);
    if (params.end_time) query.set('end_time', params.end_time);
    if (params.priority) query.set('priority', params.priority);
    if (params.client_id) query.set('client_id', params.client_id);
  }

  const queryString = query.toString();
  const endpoint = `/support/analytics${queryString ? `?${queryString}` : ''}`;

  const response = await request<SupportAnalyticsResponse>(endpoint, {
    method: 'GET',
    ...options,
  });

  return sanitizeSupportAnalytics(response);
}

// ---------------------------------------------------------------------------
// Support Service Object Export
// ---------------------------------------------------------------------------

export const supportService = {
  sanitizeString,
  validateFileAttachment,
  sanitizeAttachment,
  sanitizeMessage,
  sanitizeSLATracking,
  sanitizeCSATRating,
  sanitizeTicketSummary,
  sanitizeTicketDetail,
  sanitizeSupportAnalytics,
  createTicket,
  getTickets,
  getTicket,
  updateTicket,
  deleteTicket,
  addMessage,
  getTicketMessages,
  uploadAttachment,
  getAttachmentUrl,
  downloadAttachment,
  submitCSATRating,
  getCSATRating,
  getSupportAnalytics,
};

export default supportService;
