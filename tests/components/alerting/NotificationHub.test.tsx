import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  NotificationHub,
  formatCurrency,
  formatDateTime,
  getUrgencyVariant,
  validateTriggerRuleForm,
  validatePreferenceChannels,
} from '../../../src/components/alerting/NotificationHub';
import * as alertingService from '../../../src/services/alerting';
import {
  InAppAlert,
  AlertTrigger,
  NotificationPreference,
} from '../../../src/services/alerting';

describe('NotificationHub Component [FR-5, FR-6, FR-7]', () => {
  const mockAlerts: InAppAlert[] = [
    {
      notification_id: 'n1111111-1111-1111-1111-111111111111',
      recipient_id: 'u1111111-1111-1111-1111-111111111111',
      trigger_id: 't1111111-1111-1111-1111-111111111111',
      urgency: 'Medium',
      channel: 'InApp',
      delivery_status: 'Sent',
      message: 'Past-due invoice alert threshold exceeded for Client ACME',
      read_status: false,
      dispatched_at: '2026-03-01T10:00:00Z',
      correlation_id: 'corr-12345',
    },
    {
      notification_id: 'n2222222-2222-2222-2222-222222222222',
      recipient_id: 'u1111111-1111-1111-1111-111111111111',
      trigger_id: 't2222222-2222-2222-2222-222222222222',
      urgency: 'High',
      channel: 'InApp',
      delivery_status: 'Sent',
      message: 'High urgency quote expiration risk for Contract Corp',
      read_status: true,
      dispatched_at: '2026-03-02T12:30:00Z',
      correlation_id: 'corr-67890',
    },
  ];

  const mockTriggers: AlertTrigger[] = [
    {
      trigger_id: 't1111111-1111-1111-1111-111111111111',
      rule_name: 'Past-Due Invoices > $10k',
      financial_criteria: 'past_due_invoices',
      threshold_amount: 10000,
      urgency: 'Medium',
      is_active: true,
      created_at: '2026-02-15T08:00:00Z',
      updated_at: '2026-02-15T08:00:00Z',
    },
    {
      trigger_id: 't2222222-2222-2222-2222-222222222222',
      rule_name: 'Large Payment Threshold',
      financial_criteria: 'large_payments',
      threshold_amount: 50000,
      urgency: 'High',
      is_active: false,
      created_at: '2026-02-16T09:00:00Z',
      updated_at: '2026-02-16T09:00:00Z',
    },
  ];

  const mockPreferences: NotificationPreference[] = [
    {
      preference_id: 'p1111111-1111-1111-1111-111111111111',
      role_name: 'Admin',
      event_type: 'past_due_invoice',
      urgency: 'High',
      channels_json: ['InApp', 'Email', 'SMS'],
      version: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      preference_id: 'p2222222-2222-2222-2222-222222222222',
      role_name: 'FinancialManager',
      event_type: 'quote_expired',
      urgency: 'Medium',
      channels_json: ['InApp', 'Email'],
      version: 2,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(alertingService, 'listInAppAlerts').mockResolvedValue(mockAlerts);
    vi.spyOn(alertingService, 'markInAppAlertRead').mockResolvedValue({
      ...mockAlerts[0],
      read_status: true,
    });
    vi.spyOn(alertingService, 'listTriggerRules').mockResolvedValue(mockTriggers);
    vi.spyOn(alertingService, 'createTriggerRule').mockImplementation(async (payload) => ({
      trigger_id: 't3333333-3333-3333-3333-333333333333',
      rule_name: payload.rule_name,
      financial_criteria: payload.financial_criteria,
      threshold_amount: payload.threshold_amount,
      urgency: payload.urgency || 'Medium',
      is_active: payload.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    vi.spyOn(alertingService, 'updateTriggerRule').mockImplementation(async (id, payload) => {
      const existing = mockTriggers.find((t) => t.trigger_id === id) || mockTriggers[0];
      return {
        ...existing,
        ...payload,
        updated_at: new Date().toISOString(),
      };
    });
    vi.spyOn(alertingService, 'deleteTriggerRule').mockResolvedValue(null);
    vi.spyOn(alertingService, 'listNotificationPreferences').mockResolvedValue(mockPreferences);
    vi.spyOn(alertingService, 'updateNotificationPreferences').mockImplementation(async (payload) => {
      const existing = mockPreferences.find((p) => p.role_name === payload.role_name && p.event_type === payload.event_type) || mockPreferences[0];
      return {
        ...existing,
        channels_json: payload.channels_json,
        urgency: payload.urgency || existing.urgency,
        version: payload.version + 1,
        updated_at: new Date().toISOString(),
      };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Helper Functions', () => {
    it('formatCurrency correctly formats USD currency values', () => {
      expect(formatCurrency(10000)).toBe('$10,000.00');
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(null)).toBe('$0.00');
      expect(formatCurrency(undefined)).toBe('$0.00');
      expect(formatCurrency(NaN)).toBe('$0.00');
    });

    it('formatDateTime formats ISO date strings or falls back safely', () => {
      expect(formatDateTime(null)).toBe('N/A');
      expect(formatDateTime(undefined)).toBe('N/A');
      expect(formatDateTime('invalid-date')).toBe('invalid-date');
      const formatted = formatDateTime('2026-03-01T10:00:00Z');
      expect(formatted).toContain('2026');
    });

    it('getUrgencyVariant returns correct color classification variants', () => {
      expect(getUrgencyVariant('High')).toBe('error');
      expect(getUrgencyVariant('critical')).toBe('error');
      expect(getUrgencyVariant('Medium')).toBe('warning');
      expect(getUrgencyVariant('Low')).toBe('info');
      expect(getUrgencyVariant(null)).toBe('neutral');
    });

    it('validateTriggerRuleForm validates trigger rule inputs', () => {
      const valid = validateTriggerRuleForm('Rule 1', 'past_due_invoices', 5000);
      expect(valid.isValid).toBe(true);
      expect(valid.errors).toEqual({});

      const invalidName = validateTriggerRuleForm('', 'past_due_invoices', 5000);
      expect(invalidName.isValid).toBe(false);
      expect(invalidName.errors.rule_name).toContain('required');

      const invalidThreshold = validateTriggerRuleForm('Rule 1', 'past_due_invoices', -100);
      expect(invalidThreshold.isValid).toBe(false);
      expect(invalidThreshold.errors.threshold_amount).toContain('greater than or equal to 0');
    });

    it('validatePreferenceChannels verifies at least one channel selection', () => {
      expect(validatePreferenceChannels(['InApp']).isValid).toBe(true);
      expect(validatePreferenceChannels([]).isValid).toBe(false);
      expect(validatePreferenceChannels([]).errorMessage).toContain('At least one notification channel');
    });
  });

  describe('Tab Navigation & Layout [FR-5, FR-6, FR-7]', () => {
    it('renders header, title, and default In-App Alerts tab', () => {
      render(
        <NotificationHub
          initialAlerts={mockAlerts}
          initialTriggers={mockTriggers}
          initialPreferences={mockPreferences}
        />
      );

      expect(screen.getByText('Notification & Alert Hub')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /In-App Alerts/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Financial Trigger Rules/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Role Preferences/i })).toBeInTheDocument();

      expect(screen.getByTestId('tab-panel-alerts')).toBeInTheDocument();
    });

    it('switches between tabs when clicking tab buttons', () => {
      render(
        <NotificationHub
          initialAlerts={mockAlerts}
          initialTriggers={mockTriggers}
          initialPreferences={mockPreferences}
        />
      );

      // Switch to Triggers tab
      const triggerTab = screen.getByRole('tab', { name: /Financial Trigger Rules/i });
      fireEvent.click(triggerTab);
      expect(screen.getByTestId('tab-panel-triggers')).toBeInTheDocument();

      // Switch to Preferences tab
      const prefTab = screen.getByRole('tab', { name: /Role Preferences/i });
      fireEvent.click(prefTab);
      expect(screen.getByTestId('tab-panel-preferences')).toBeInTheDocument();
    });
  });

  describe('In-App Alerts Tab [FR-5]', () => {
    it('displays list of in-app alerts with unread badge and status details', () => {
      render(
        <NotificationHub
          initialAlerts={mockAlerts}
          initialTriggers={mockTriggers}
          initialPreferences={mockPreferences}
        />
      );

      expect(screen.getByText('Past-due invoice alert threshold exceeded for Client ACME')).toBeInTheDocument();
      expect(screen.getByText('High urgency quote expiration risk for Contract Corp')).toBeInTheDocument();
      expect(screen.getByText('1 Unread')).toBeInTheDocument();
    });

    it('filters alerts when "Unread only" checkbox is checked', () => {
      render(
        <NotificationHub
          initialAlerts={mockAlerts}
          initialTriggers={mockTriggers}
          initialPreferences={mockPreferences}
        />
      );

      const unreadCheckbox = screen.getByLabelText(/Unread only/i);
      fireEvent.click(unreadCheckbox);

      expect(screen.getByText('Past-due invoice alert threshold exceeded for Client ACME')).toBeInTheDocument();
      expect(screen.queryByText('High urgency quote expiration risk for Contract Corp')).not.toBeInTheDocument();
    });

    it('marks an individual alert as read when "Mark Read" button is clicked', async () => {
      const onAlertReadMock = vi.fn();
      render(
        <NotificationHub
          initialAlerts={mockAlerts}
          initialTriggers={mockTriggers}
          initialPreferences={mockPreferences}
          onAlertRead={onAlertReadMock}
        />
      );

      const markReadBtn = screen.getByRole('button', {
        name: /Mark alert "Past-due invoice alert threshold exceeded for Client ACME" as read/i,
      });
      fireEvent.click(markReadBtn);

      await waitFor(() => {
        expect(alertingService.markInAppAlertRead).toHaveBeenCalledWith('n1111111-1111-1111-1111-111111111111');
        expect(onAlertReadMock).toHaveBeenCalled();
      });
    });

    it('marks all unread alerts as read when "Mark All as Read" button is clicked', async () => {
      render(
        <NotificationHub
          initialAlerts={mockAlerts}
          initialTriggers={mockTriggers}
          initialPreferences={mockPreferences}
        />
      );

      const markAllBtn = screen.getByRole('button', { name: /Mark All as Read/i });
      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(alertingService.markInAppAlertRead).toHaveBeenCalledWith('n1111111-1111-1111-1111-111111111111');
      });
    });

    it('displays empty state when no alerts match filter', () => {
      render(
        <NotificationHub
          initialAlerts={[]}
          initialTriggers={mockTriggers}
          initialPreferences={mockPreferences}
        />
      );

      expect(screen.getByText('No notification alerts found')).toBeInTheDocument();
    });
  });

  describe('Financial Trigger Rules Tab [FR-6]', () => {
    it('displays trigger rules with threshold amounts and urgency badges', () => {
      render(
        <NotificationHub
          initialAlerts={mockAlerts}
          initialTriggers={mockTriggers}
          initialPreferences={mockPreferences}
          defaultTab="triggers"
        />
      );

      expect(screen.getByText('Past-Due Invoices > $10k')).toBeInTheDocument();
      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
      expect(screen.getByText('Large Payment Threshold')).toBeInTheDocument();
      expect(screen.getByText('$50,000.00')).toBeInTheDocument();
    });

    it('opens create trigger rule modal and submits new rule', async () => {
      const onCreatedMock = vi.fn();
      render(
        <NotificationHub
          initialAlerts={mockAlerts}
          initialTriggers={mockTriggers}
          initialPreferences={mockPreferences}
          defaultTab="triggers"
          onTriggerCreated={onCreatedMock}
        />
      );

      const createBtn = screen.getByRole('button', { name: /Create Trigger Rule/i });
      fireEvent.click(createBtn);

      expect(screen.getByText('Create Custom Financial Trigger Rule')).toBeInTheDocument();

      const nameInput = screen.getByLabelText(/Rule Name \*/i);
      const thresholdInput = screen.getByLabelText(/Threshold Amount \(\$\) \*/i);

      fireEvent.change(nameInput, { target: { value: 'New Test Trigger Rule' } });
      fireEvent.change(thresholdInput, { target: { value: '25000' } });

      const submitBtn = screen.getByRole('button', { name: /Save Trigger Rule/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(alertingService.createTriggerRule).toHaveBeenCalledWith({
          rule_name: 'New Test Trigger Rule',
          financial_criteria: 'past_due_invoices',
          threshold_amount: 25000,
          urgency: 'Medium',
          is_active: true,
        });
        expect(onCreatedMock).toHaveBeenCalled();
      });
    });

    it('toggles trigger rule active state when status badge is clicked', async () => {
      render(
        <NotificationHub
          initialAlerts={mockAlerts}
          initialTriggers={mockTriggers}
          initialPreferences={mockPreferences}
          defaultTab="triggers"
        />
      );

      const toggleActiveBtn = screen.getByRole('button', {
        name: /Toggle active state for trigger rule Past-Due Invoices > \$10k/i,
      });
      fireEvent.click(toggleActiveBtn);

      await waitFor(() => {
        expect(alertingService.updateTriggerRule).toHaveBeenCalledWith(
          't1111111-1111-1111-1111-111111111111',
          { is_active: false }
        );
      });
    });

    it('deletes a trigger rule when delete button is clicked', async () => {
      const onDeleteMock = vi.fn();
      render(
        <NotificationHub
          initialAlerts={mockAlerts}
          initialTriggers={mockTriggers}
          initialPreferences={mockPreferences}
          defaultTab="triggers"
          onTriggerDeleted={onDeleteMock}
        />
      );

      const deleteBtn = screen.getByRole('button', {
        name: /Delete trigger rule Past-Due Invoices > \$10k/i,
      });
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(alertingService.deleteTriggerRule).toHaveBeenCalledWith('t1111111-1111-1111-1111-111111111111');
        expect(onDeleteMock).toHaveBeenCalledWith('t1111111-1111-1111-1111-111111111111');
      });
    });
  });

  describe('Role Notification Preferences Tab [FR-7]', () => {
    it('displays preferences list by role and event type with channels', () => {
      render(
        <NotificationHub
          initialAlerts={mockAlerts}
          initialTriggers={mockTriggers}
          initialPreferences={mockPreferences}
          defaultTab="preferences"
        />
      );

      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('FinancialManager')).toBeInTheDocument();
      expect(screen.getByText('v1')).toBeInTheDocument();
      expect(screen.getByText('v2')).toBeInTheDocument();
    });

    it('saves preference updates with optimistic locking version', async () => {
      const onPreferenceUpdatedMock = vi.fn();
      render(
        <NotificationHub
          initialAlerts={mockAlerts}
          initialTriggers={mockTriggers}
          initialPreferences={mockPreferences}
          defaultTab="preferences"
          onPreferenceUpdated={onPreferenceUpdatedMock}
        />
      );

      const saveButtons = screen.getAllByRole('button', { name: /Save Preferences/i });
      fireEvent.click(saveButtons[0]);

      await waitFor(() => {
        expect(alertingService.updateNotificationPreferences).toHaveBeenCalledWith({
          role_name: 'Admin',
          event_type: 'past_due_invoice',
          urgency: 'High',
          channels_json: ['InApp', 'Email', 'SMS'],
          version: 1, // Optimistic lock version passed in payload
        });
        expect(onPreferenceUpdatedMock).toHaveBeenCalled();
      });
    });

    it('handles optimistic locking 409 conflict error gracefully', async () => {
      vi.spyOn(alertingService, 'updateNotificationPreferences').mockRejectedValueOnce({
        status: 409,
        message: 'Conflict error',
      });

      render(
        <NotificationHub
          initialAlerts={mockAlerts}
          initialTriggers={mockTriggers}
          initialPreferences={mockPreferences}
          defaultTab="preferences"
        />
      );

      const saveButtons = screen.getAllByRole('button', { name: /Save Preferences/i });
      fireEvent.click(saveButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Conflict Error \(409\): Preference was updated by another user/i)).toBeInTheDocument();
      });
    });
  });
});
