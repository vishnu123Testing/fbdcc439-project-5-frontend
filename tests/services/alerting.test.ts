import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
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
  alertingService,
  InAppAlertQueryParams,
  TriggerQueryParams,
  TriggerCreateRequest,
  TriggerUpdateRequest,
  PreferenceQueryParams,
  PreferenceUpdateRequest,
} from '../../src/services/alerting';
import { ApiError } from '../../src/services/apiClient';

describe('alerting service [FR-5, FR-6, FR-7]', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('In-App Alerts [FR-5]', () => {
    it('fetches in-app alerts list without query parameters', async () => {
      const mockAlerts = [
        {
          notification_id: 'n1111111-1111-1111-1111-111111111111',
          recipient_id: 'u1111111-1111-1111-1111-111111111111',
          trigger_id: 't1111111-1111-1111-1111-111111111111',
          urgency: 'Medium',
          channel: 'InApp',
          delivery_status: 'Sent',
          message: 'Past-due invoice alert threshold exceeded',
          read_status: false,
          dispatched_at: '2026-03-01T10:00:00Z',
          correlation_id: 'corr-12345',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAlerts,
      } as Response);

      const result = await listInAppAlerts();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/in-app'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockAlerts);
    });

    it('builds query parameters for unread_only and recipient_id correctly', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      const params: InAppAlertQueryParams = {
        unread_only: true,
        recipient_id: 'user-777',
      };

      await getInAppAlerts(params);

      const calledUrl = (fetch as unknown as { mock: { calls: [string[]] } }).mock.calls[0][0];
      expect(calledUrl).toContain('unread_only=true');
      expect(calledUrl).toContain('recipient_id=user-777');
    });

    it('marks an in-app alert as read via PATCH', async () => {
      const mockUpdatedAlert = {
        notification_id: 'notif-123',
        recipient_id: 'user-777',
        trigger_id: 'trig-100',
        urgency: 'Low',
        channel: 'InApp',
        delivery_status: 'Sent',
        message: 'Notification body',
        read_status: true,
        dispatched_at: '2026-03-01T10:00:00Z',
        correlation_id: 'corr-999',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpdatedAlert,
      } as Response);

      const result = await markInAppAlertRead('notif-123');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/in-app/notif-123/read'),
        expect.objectContaining({ method: 'PATCH' })
      );
      expect(result).toEqual(mockUpdatedAlert);
    });

    it('alias markAlertAsRead behaves identically', async () => {
      const mockAlert = {
        notification_id: 'notif-456',
        read_status: true,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAlert,
      } as Response);

      const result = await markAlertAsRead('notif-456');
      expect(result).toEqual(mockAlert);
    });
  });

  describe('Alert Trigger Rules [FR-6]', () => {
    it('fetches alert trigger rules list without parameters', async () => {
      const mockTriggers = [
        {
          trigger_id: 'trig-100',
          rule_name: 'High Outstanding AR Balance',
          financial_criteria: 'past_due_invoices',
          threshold_amount: 50000.0,
          urgency: 'High',
          is_active: true,
          created_at: '2026-02-01T00:00:00Z',
          updated_at: '2026-02-01T00:00:00Z',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTriggers,
      } as Response);

      const result = await listTriggerRules();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/triggers'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockTriggers);
    });

    it('filters trigger rules by is_active boolean parameter', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      const params: TriggerQueryParams = { is_active: true };
      await getTriggers(params);

      const calledUrl = (fetch as unknown as { mock: { calls: [string[]] } }).mock.calls[0][0];
      expect(calledUrl).toContain('is_active=true');
    });

    it('fetches a single trigger rule by ID', async () => {
      const mockTrigger = {
        trigger_id: 'trig-100',
        rule_name: 'High Outstanding AR Balance',
        financial_criteria: 'past_due_invoices',
        threshold_amount: 50000.0,
        urgency: 'High',
        is_active: true,
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTrigger,
      } as Response);

      const result = await getTriggerRule('trig-100');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/triggers/trig-100'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockTrigger);
    });

    it('creates a new custom alert trigger rule via POST', async () => {
      const payload: TriggerCreateRequest = {
        rule_name: 'Unpaid Invoice Alert',
        financial_criteria: 'unpaid_balance',
        threshold_amount: 10000.0,
        urgency: 'Medium',
        is_active: true,
      };

      const mockCreated = {
        trigger_id: 'trig-200',
        ...payload,
        created_at: '2026-03-01T12:00:00Z',
        updated_at: '2026-03-01T12:00:00Z',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockCreated,
      } as Response);

      const result = await createTriggerRule(payload);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/triggers'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
      expect(result).toEqual(mockCreated);
    });

    it('updates an existing trigger rule via PUT', async () => {
      const updatePayload: TriggerUpdateRequest = {
        threshold_amount: 15000.0,
        urgency: 'High',
      };

      const mockUpdated = {
        trigger_id: 'trig-200',
        rule_name: 'Unpaid Invoice Alert',
        financial_criteria: 'unpaid_balance',
        threshold_amount: 15000.0,
        urgency: 'High',
        is_active: true,
        created_at: '2026-03-01T12:00:00Z',
        updated_at: '2026-03-02T12:00:00Z',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpdated,
      } as Response);

      const result = await updateTriggerRule('trig-200', updatePayload);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/triggers/trig-200'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updatePayload),
        })
      );
      expect(result).toEqual(mockUpdated);
    });

    it('deletes a trigger rule returning 204 No Content', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => null,
      } as Response);

      const result = await deleteTriggerRule('trig-200');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/triggers/trig-200'),
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toBeNull();
    });
  });

  describe('Role Notification Preferences [FR-7]', () => {
    it('fetches notification preferences list with role_name and event_type filters', async () => {
      const mockPreferences = [
        {
          preference_id: 'pref-100',
          role_name: 'Admin',
          event_type: 'invoice_past_due',
          urgency: 'High',
          channels_json: ['InApp', 'Email', 'SMS'],
          version: 1,
          created_at: '2026-02-01T00:00:00Z',
          updated_at: '2026-02-01T00:00:00Z',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockPreferences,
      } as Response);

      const params: PreferenceQueryParams = {
        role_name: 'Admin',
        event_type: 'invoice_past_due',
      };

      const result = await listNotificationPreferences(params);

      const calledUrl = (fetch as unknown as { mock: { calls: [string[]] } }).mock.calls[0][0];
      expect(calledUrl).toContain('/api/v1/notifications/preferences');
      expect(calledUrl).toContain('role_name=Admin');
      expect(calledUrl).toContain('event_type=invoice_past_due');
      expect(result).toEqual(mockPreferences);
    });

    it('updates notification preferences using optimistic locking via version matching', async () => {
      const payload: PreferenceUpdateRequest = {
        role_name: 'Admin',
        event_type: 'invoice_past_due',
        urgency: 'High',
        channels_json: ['InApp', 'Email'],
        version: 1,
      };

      const mockUpdatedPref = {
        preference_id: 'pref-100',
        role_name: 'Admin',
        event_type: 'invoice_past_due',
        urgency: 'High',
        channels_json: ['InApp', 'Email'],
        version: 2,
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-03-01T10:00:00Z',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpdatedPref,
      } as Response);

      const result = await updateNotificationPreferences(payload);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/preferences'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      );
      expect(result).toEqual(mockUpdatedPref);
    });

    it('throws ApiError with 409 status on optimistic lock conflict', async () => {
      const payload: PreferenceUpdateRequest = {
        role_name: 'Admin',
        event_type: 'invoice_past_due',
        urgency: 'High',
        channels_json: ['InApp'],
        version: 1, // Stale version
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          detail: 'Optimistic lock conflict: expected version 2, received version 1.',
        }),
      } as Response);

      await expect(updateNotificationPreferences(payload)).rejects.toThrow(ApiError);
    });
  });

  describe('alertingService bundled export', () => {
    it('contains all alerting API functions', () => {
      expect(alertingService.listInAppAlerts).toBe(listInAppAlerts);
      expect(alertingService.getInAppAlerts).toBe(getInAppAlerts);
      expect(alertingService.markInAppAlertRead).toBe(markInAppAlertRead);
      expect(alertingService.markAlertAsRead).toBe(markAlertAsRead);
      expect(alertingService.listTriggerRules).toBe(listTriggerRules);
      expect(alertingService.getTriggerRules).toBe(getTriggerRules);
      expect(alertingService.getTriggers).toBe(getTriggers);
      expect(alertingService.listTriggers).toBe(listTriggers);
      expect(alertingService.getTriggerRule).toBe(getTriggerRule);
      expect(alertingService.getTriggerById).toBe(getTriggerById);
      expect(alertingService.createTriggerRule).toBe(createTriggerRule);
      expect(alertingService.createTrigger).toBe(createTrigger);
      expect(alertingService.updateTriggerRule).toBe(updateTriggerRule);
      expect(alertingService.updateTrigger).toBe(updateTrigger);
      expect(alertingService.deleteTriggerRule).toBe(deleteTriggerRule);
      expect(alertingService.deleteTrigger).toBe(deleteTrigger);
      expect(alertingService.listNotificationPreferences).toBe(listNotificationPreferences);
      expect(alertingService.getNotificationPreferences).toBe(getNotificationPreferences);
      expect(alertingService.getPreferences).toBe(getPreferences);
      expect(alertingService.updateNotificationPreferences).toBe(updateNotificationPreferences);
      expect(alertingService.updateNotificationPreference).toBe(updateNotificationPreference);
      expect(alertingService.updatePreference).toBe(updatePreference);
    });
  });
});
