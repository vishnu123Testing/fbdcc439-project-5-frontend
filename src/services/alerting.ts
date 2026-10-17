import { request, RequestOptions } from './apiClient';

/**
 * ---------------------------------------------------------------------------
 * Enums & Type Definitions [FR-5, FR-6, FR-7]
 * ---------------------------------------------------------------------------
 */

export type AlertUrgency = 'Low' | 'Medium' | 'High';
export type NotificationChannel = 'InApp' | 'Email' | 'SMS';
export type DeliveryStatus = 'Sent' | 'Failed' | 'Fallback';

/**
 * ---------------------------------------------------------------------------
 * In-App Alerts Interfaces & Types [FR-5]
 * ---------------------------------------------------------------------------
 */

/**
 * Query parameters for filtering in-app alerts [FR-5].
 */
export interface InAppAlertQueryParams {
  unread_only?: boolean;
  recipient_id?: string;
}

/**
 * Response schema representing an in-app alert notification [FR-5].
 */
export interface InAppAlertResponse {
  notification_id: string;
  recipient_id?: string | null;
  trigger_id?: string | null;
  urgency: AlertUrgency | string;
  channel: NotificationChannel | string;
  delivery_status: DeliveryStatus | string;
  message?: string | null;
  read_status: boolean;
  dispatched_at: string;
  correlation_id: string;
}

export type InAppAlert = InAppAlertResponse;

/**
 * ---------------------------------------------------------------------------
 * Alert Trigger Rules Interfaces & Types [FR-6]
 * ---------------------------------------------------------------------------
 */

/**
 * Query parameters for filtering trigger rules [FR-6].
 */
export interface TriggerQueryParams {
  is_active?: boolean;
}

/**
 * Request payload for creating a custom financial alert trigger rule [FR-6].
 */
export interface TriggerCreateRequest {
  rule_name: string;
  financial_criteria: string;
  threshold_amount: number;
  urgency?: AlertUrgency | string;
  is_active?: boolean;
}

/**
 * Request payload for updating an existing financial alert trigger rule [FR-6].
 */
export interface TriggerUpdateRequest {
  rule_name?: string;
  financial_criteria?: string;
  threshold_amount?: number;
  urgency?: AlertUrgency | string;
  is_active?: boolean;
}

/**
 * Response schema representing a financial alert trigger rule [FR-6].
 */
export interface TriggerResponse {
  trigger_id: string;
  rule_name: string;
  financial_criteria: string;
  threshold_amount: number;
  urgency: AlertUrgency | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type AlertTrigger = TriggerResponse;

/**
 * ---------------------------------------------------------------------------
 * Role-Based Notification Preferences Interfaces & Types [FR-7]
 * ---------------------------------------------------------------------------
 */

/**
 * Query parameters for filtering role-based notification preferences [FR-7].
 */
export interface PreferenceQueryParams {
  role_name?: string;
  event_type?: string;
}

/**
 * Request payload for updating notification preferences with optimistic locking [FR-7].
 */
export interface PreferenceUpdateRequest {
  role_name: string;
  event_type: string;
  urgency?: AlertUrgency | string;
  channels_json: string[];
  version: number;
}

/**
 * Response schema representing role-based notification preferences [FR-7].
 */
export interface PreferenceResponse {
  preference_id: string;
  role_name: string;
  event_type: string;
  urgency: AlertUrgency | string;
  channels_json: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

export type NotificationPreference = PreferenceResponse;

/**
 * ---------------------------------------------------------------------------
 * Helper Functions
 * ---------------------------------------------------------------------------
 */

/**
 * Helper function to build query strings from parameter objects.
 */
function buildQueryString(params: Record<string, unknown>): string {
  const queryParts: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) {
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
 * Centralized Notification Hub API Service Functions
 * ---------------------------------------------------------------------------
 */

/**
 * Retrieve in-app notification alerts with optional unread_only and recipient filters [FR-5].
 */
export async function listInAppAlerts(
  params?: InAppAlertQueryParams,
  options?: RequestOptions
): Promise<InAppAlertResponse[]> {
  const queryStr = params ? buildQueryString(params as Record<string, unknown>) : '';
  const endpoint = `/notifications/in-app${queryStr}`;
  return request<InAppAlertResponse[]>(endpoint, {
    method: 'GET',
    ...options,
  });
}

export const getInAppAlerts = listInAppAlerts;

/**
 * Update the read status flag on a specific in-app notification alert [FR-5].
 */
export async function markInAppAlertRead(
  notificationId: string,
  options?: RequestOptions
): Promise<InAppAlertResponse> {
  const endpoint = `/notifications/in-app/${encodeURIComponent(notificationId)}/read`;
  return request<InAppAlertResponse>(endpoint, {
    method: 'PATCH',
    ...options,
  });
}

export const markAlertAsRead = markInAppAlertRead;

/**
 * Retrieve configured financial alert trigger rules with optional is_active filter [FR-6].
 */
export async function listTriggerRules(
  params?: TriggerQueryParams,
  options?: RequestOptions
): Promise<TriggerResponse[]> {
  const queryStr = params ? buildQueryString(params as Record<string, unknown>) : '';
  const endpoint = `/notifications/triggers${queryStr}`;
  return request<TriggerResponse[]>(endpoint, {
    method: 'GET',
    ...options,
  });
}

export const getTriggerRules = listTriggerRules;
export const getTriggers = listTriggerRules;
export const listTriggers = listTriggerRules;

/**
 * Fetch a single alert trigger rule by its unique UUID [FR-6].
 */
export async function getTriggerRule(
  triggerId: string,
  options?: RequestOptions
): Promise<TriggerResponse> {
  const endpoint = `/notifications/triggers/${encodeURIComponent(triggerId)}`;
  return request<TriggerResponse>(endpoint, {
    method: 'GET',
    ...options,
  });
}

export const getTriggerById = getTriggerRule;

/**
 * Create a new custom financial alert trigger rule [FR-6].
 */
export async function createTriggerRule(
  payload: TriggerCreateRequest,
  options?: RequestOptions
): Promise<TriggerResponse> {
  const endpoint = '/notifications/triggers';
  return request<TriggerResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
  });
}

export const createTrigger = createTriggerRule;

/**
 * Update parameters of an existing alert trigger rule [FR-6].
 */
export async function updateTriggerRule(
  triggerId: string,
  payload: TriggerUpdateRequest,
  options?: RequestOptions
): Promise<TriggerResponse> {
  const endpoint = `/notifications/triggers/${encodeURIComponent(triggerId)}`;
  return request<TriggerResponse>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(payload),
    ...options,
  });
}

export const updateTrigger = updateTriggerRule;

/**
 * Delete a configured financial alert trigger rule by ID [FR-6].
 */
export async function deleteTriggerRule(
  triggerId: string,
  options?: RequestOptions
): Promise<void | null> {
  const endpoint = `/notifications/triggers/${encodeURIComponent(triggerId)}`;
  return request<void | null>(endpoint, {
    method: 'DELETE',
    ...options,
  });
}

export const deleteTrigger = deleteTriggerRule;

/**
 * Retrieve configured role-based notification preferences with optional filters [FR-7].
 */
export async function listNotificationPreferences(
  params?: PreferenceQueryParams,
  options?: RequestOptions
): Promise<PreferenceResponse[]> {
  const queryStr = params ? buildQueryString(params as Record<string, unknown>) : '';
  const endpoint = `/notifications/preferences${queryStr}`;
  return request<PreferenceResponse[]>(endpoint, {
    method: 'GET',
    ...options,
  });
}

export const getNotificationPreferences = listNotificationPreferences;
export const getPreferences = listNotificationPreferences;

/**
 * Update role-based notification preferences using optimistic locking via version matching [FR-7].
 */
export async function updateNotificationPreferences(
  payload: PreferenceUpdateRequest,
  options?: RequestOptions
): Promise<PreferenceResponse> {
  const endpoint = '/notifications/preferences';
  return request<PreferenceResponse>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(payload),
    ...options,
  });
}

export const updateNotificationPreference = updateNotificationPreferences;
export const updatePreference = updateNotificationPreferences;

/**
 * Bundled Alerting Service API client object.
 */
export const alertingService = {
  listInAppAlerts,
  getInAppAlerts,
  markInAppAlertRead,
  markAlertAsRead,
  listTriggerRules,
  getTriggerRules,
  getTriggers,
  listTriggers,
  getTriggerRule,
  getTriggerById,
  createTriggerRule,
  createTrigger,
  updateTriggerRule,
  updateTrigger,
  deleteTriggerRule,
  deleteTrigger,
  listNotificationPreferences,
  getNotificationPreferences,
  getPreferences,
  updateNotificationPreferences,
  updateNotificationPreference,
  updatePreference,
};

export default alertingService;
