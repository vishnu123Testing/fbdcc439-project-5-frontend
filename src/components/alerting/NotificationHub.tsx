'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Bell,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  RotateCw,
  Plus,
  Trash2,
  Edit2,
  X,
  Search,
  Filter,
  Check,
  Zap,
  Mail,
  MessageSquare,
  Smartphone,
  Sparkles,
  RefreshCw,
  Layers,
  Lock,
  UserCheck,
} from 'lucide-react';
import {
  InAppAlert,
  AlertTrigger,
  NotificationPreference,
  AlertUrgency,
  NotificationChannel,
  DeliveryStatus,
  TriggerCreateRequest,
  TriggerUpdateRequest,
  PreferenceUpdateRequest,
  listInAppAlerts,
  markInAppAlertRead,
  listTriggerRules,
  createTriggerRule,
  updateTriggerRule,
  deleteTriggerRule,
  listNotificationPreferences,
  updateNotificationPreferences,
} from '../../services/alerting';

/**
 * Tab options available in the Notification Hub [FR-5, FR-6, FR-7].
 */
export type NotificationHubTab = 'alerts' | 'triggers' | 'preferences';

/**
 * Format currency amounts into USD formatted strings.
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

/**
 * Format ISO datetime strings into readable localized date and time.
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) {
    return 'N/A';
  }
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return isoString;
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(isoString);
  }
}

/**
 * Get visual variant style mappings for alert urgency levels [FR-5].
 */
export function getUrgencyVariant(urgency: string | null | undefined): 'info' | 'warning' | 'error' | 'neutral' {
  if (!urgency) return 'neutral';
  const normalized = String(urgency).trim().toLowerCase();
  switch (normalized) {
    case 'high':
    case 'critical':
      return 'error';
    case 'medium':
    case 'moderate':
      return 'warning';
    case 'low':
    case 'info':
      return 'info';
    default:
      return 'neutral';
  }
}

/**
 * Client-side validation for trigger rule creation/update payloads [FR-6].
 */
export interface TriggerValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateTriggerRuleForm(
  ruleName: string,
  financialCriteria: string,
  thresholdAmount: number | string
): TriggerValidationResult {
  const errors: Record<string, string> = {};

  if (!ruleName || !ruleName.trim()) {
    errors.rule_name = 'Rule name is required.';
  } else if (ruleName.trim().length > 100) {
    errors.rule_name = 'Rule name must not exceed 100 characters.';
  }

  if (!financialCriteria || !financialCriteria.trim()) {
    errors.financial_criteria = 'Financial criteria is required.';
  } else if (financialCriteria.trim().length > 50) {
    errors.financial_criteria = 'Financial criteria must not exceed 50 characters.';
  }

  const numThreshold = Number(thresholdAmount);
  if (thresholdAmount === '' || thresholdAmount === null || thresholdAmount === undefined || isNaN(numThreshold)) {
    errors.threshold_amount = 'Threshold amount must be a valid number.';
  } else if (numThreshold < 0) {
    errors.threshold_amount = 'Threshold amount must be greater than or equal to 0.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate that at least one notification channel is selected [FR-7].
 */
export function validatePreferenceChannels(channels: string[]): { isValid: boolean; errorMessage?: string } {
  if (!channels || channels.length === 0) {
    return {
      isValid: false,
      errorMessage: 'At least one notification channel (e.g. InApp, Email, SMS) must be selected.',
    };
  }
  return { isValid: true };
}

/**
 * Props for the NotificationHub component [FR-5, FR-6, FR-7].
 */
export interface NotificationHubProps {
  /**
   * Initial pre-loaded in-app alerts [FR-5]
   */
  initialAlerts?: InAppAlert[] | null;
  /**
   * Initial pre-loaded alert trigger rules [FR-6]
   */
  initialTriggers?: AlertTrigger[] | null;
  /**
   * Initial pre-loaded notification preferences [FR-7]
   */
  initialPreferences?: NotificationPreference[] | null;
  /**
   * Default selected tab ('alerts' | 'triggers' | 'preferences')
   */
  defaultTab?: NotificationHubTab;
  /**
   * Current authenticated user role name
   */
  currentRole?: string;
  /**
   * External loading state override
   */
  loading?: boolean;
  /**
   * External error state override
   */
  error?: string | null;
  /**
   * Callback fired when data refresh is requested
   */
  onRefresh?: () => void;
  /**
   * Callback fired when an in-app alert is marked as read [FR-5]
   */
  onAlertRead?: (alert: InAppAlert) => void;
  /**
   * Callback fired when a new trigger rule is created [FR-6]
   */
  onTriggerCreated?: (trigger: AlertTrigger) => void;
  /**
   * Callback fired when a trigger rule is updated [FR-6]
   */
  onTriggerUpdated?: (trigger: AlertTrigger) => void;
  /**
   * Callback fired when a trigger rule is deleted [FR-6]
   */
  onTriggerDeleted?: (triggerId: string) => void;
  /**
   * Callback fired when notification preferences are updated [FR-7]
   */
  onPreferenceUpdated?: (preference: NotificationPreference) => void;
  /**
   * Additional custom CSS classes
   */
  className?: string;
}

export function NotificationHub({
  initialAlerts = null,
  initialTriggers = null,
  initialPreferences = null,
  defaultTab = 'alerts',
  currentRole = 'Admin',
  loading: externalLoading = false,
  error: externalError = null,
  onRefresh,
  onAlertRead,
  onTriggerCreated,
  onTriggerUpdated,
  onTriggerDeleted,
  onPreferenceUpdated,
  className,
}: NotificationHubProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<NotificationHubTab>(defaultTab);

  // In-App Alerts state [FR-5]
  const [alerts, setAlerts] = useState<InAppAlert[]>(initialAlerts || []);
  const [alertsLoading, setAlertsLoading] = useState<boolean>(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [alertSearch, setAlertSearch] = useState<string>('');
  const [alertUrgencyFilter, setAlertUrgencyFilter] = useState<string>('ALL');

  // Trigger Rules state [FR-6]
  const [triggers, setTriggers] = useState<AlertTrigger[]>(initialTriggers || []);
  const [triggersLoading, setTriggersLoading] = useState<boolean>(false);
  const [triggersError, setTriggersError] = useState<string | null>(null);
  const [triggerSearch, setTriggerSearch] = useState<string>('');
  const [triggerActiveFilter, setTriggerActiveFilter] = useState<string>('ALL');

  // Trigger Modal / Form state
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState<boolean>(false);
  const [editingTrigger, setEditingTrigger] = useState<AlertTrigger | null>(null);
  const [triggerRuleName, setTriggerRuleName] = useState<string>('');
  const [triggerFinancialCriteria, setTriggerFinancialCriteria] = useState<string>('past_due_invoices');
  const [triggerThresholdAmount, setTriggerThresholdAmount] = useState<string>('10000');
  const [triggerUrgency, setTriggerUrgency] = useState<AlertUrgency | string>('Medium');
  const [triggerIsActive, setTriggerIsActive] = useState<boolean>(true);
  const [triggerFormErrors, setTriggerFormErrors] = useState<Record<string, string>>({});
  const [triggerSubmitLoading, setTriggerSubmitLoading] = useState<boolean>(false);

  // Role Preferences state [FR-7]
  const [preferences, setPreferences] = useState<NotificationPreference[]>(initialPreferences || []);
  const [preferencesLoading, setPreferencesLoading] = useState<boolean>(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [preferenceSaveStatus, setPreferenceSaveStatus] = useState<Record<string, string>>({});

  // Global feedback messages
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Synchronize initial props
  useEffect(() => {
    if (initialAlerts) setAlerts(initialAlerts);
  }, [initialAlerts]);

  useEffect(() => {
    if (initialTriggers) setTriggers(initialTriggers);
  }, [initialTriggers]);

  useEffect(() => {
    if (initialPreferences) setPreferences(initialPreferences);
  }, [initialPreferences]);

  // Fetch In-App Alerts [FR-5]
  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError(null);
    try {
      const data = await listInAppAlerts({ unread_only: unreadOnly });
      setAlerts(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch in-app alerts.';
      setAlertsError(msg);
    } finally {
      setAlertsLoading(false);
    }
  }, [unreadOnly]);

  // Fetch Trigger Rules [FR-6]
  const fetchTriggers = useCallback(async () => {
    setTriggersLoading(true);
    setTriggersError(null);
    try {
      const data = await listTriggerRules();
      setTriggers(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch trigger rules.';
      setTriggersError(msg);
    } finally {
      setTriggersLoading(false);
    }
  }, []);

  // Fetch Notification Preferences [FR-7]
  const fetchPreferences = useCallback(async () => {
    setPreferencesLoading(true);
    setPreferencesError(null);
    try {
      const data = await listNotificationPreferences();
      setPreferences(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch notification preferences.';
      setPreferencesError(msg);
    } finally {
      setPreferencesLoading(false);
    }
  }, []);

  // Fetch initial data on mount if not provided via props
  useEffect(() => {
    if (!initialAlerts || initialAlerts.length === 0) {
      fetchAlerts();
    }
    if (!initialTriggers || initialTriggers.length === 0) {
      fetchTriggers();
    }
    if (!initialPreferences || initialPreferences.length === 0) {
      fetchPreferences();
    }
  }, []); // Run once on mount

  // Refetch alerts when unread filter changes
  useEffect(() => {
    fetchAlerts();
  }, [unreadOnly, fetchAlerts]);

  // Handle Mark Single Alert as Read [FR-5]
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const updated = await markInAppAlertRead(notificationId);
      setAlerts((prev) =>
        prev.map((a) => (a.notification_id === notificationId ? { ...a, read_status: true } : a))
      );
      if (onAlertRead) {
        onAlertRead(updated || { ...alerts.find((a) => a.notification_id === notificationId)!, read_status: true });
      }
    } catch (err: unknown) {
      // Optimistic update fallback if API call fails
      setAlerts((prev) =>
        prev.map((a) => (a.notification_id === notificationId ? { ...a, read_status: true } : a))
      );
    }
  };

  // Handle Mark All Alerts as Read [FR-5]
  const handleMarkAllAsRead = async () => {
    const unreadAlerts = alerts.filter((a) => !a.read_status);
    if (unreadAlerts.length === 0) return;

    for (const alert of unreadAlerts) {
      try {
        await markInAppAlertRead(alert.notification_id);
      } catch {
        // Continue processing batch
      }
    }

    setAlerts((prev) => prev.map((a) => ({ ...a, read_status: true })));
    setSuccessBanner('All in-app alerts marked as read.');
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  // Open modal for creating trigger [FR-6]
  const handleOpenCreateTriggerModal = () => {
    setEditingTrigger(null);
    setTriggerRuleName('');
    setTriggerFinancialCriteria('past_due_invoices');
    setTriggerThresholdAmount('10000');
    setTriggerUrgency('Medium');
    setTriggerIsActive(true);
    setTriggerFormErrors({});
    setIsTriggerModalOpen(true);
  };

  // Open modal for editing trigger [FR-6]
  const handleOpenEditTriggerModal = (trigger: AlertTrigger) => {
    setEditingTrigger(trigger);
    setTriggerRuleName(trigger.rule_name);
    setTriggerFinancialCriteria(trigger.financial_criteria);
    setTriggerThresholdAmount(String(trigger.threshold_amount));
    setTriggerUrgency(trigger.urgency);
    setTriggerIsActive(trigger.is_active);
    setTriggerFormErrors({});
    setIsTriggerModalOpen(true);
  };

  // Submit Trigger Rule Form (Create/Update) [FR-6]
  const handleSaveTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateTriggerRuleForm(triggerRuleName, triggerFinancialCriteria, triggerThresholdAmount);
    if (!validation.isValid) {
      setTriggerFormErrors(validation.errors);
      return;
    }

    setTriggerSubmitLoading(true);
    setTriggerFormErrors({});

    try {
      if (editingTrigger) {
        const updatePayload: TriggerUpdateRequest = {
          rule_name: triggerRuleName.trim(),
          financial_criteria: triggerFinancialCriteria.trim(),
          threshold_amount: Number(triggerThresholdAmount),
          urgency: triggerUrgency,
          is_active: triggerIsActive,
        };
        const updated = await updateTriggerRule(editingTrigger.trigger_id, updatePayload);
        setTriggers((prev) =>
          prev.map((t) => (t.trigger_id === editingTrigger.trigger_id ? updated : t))
        );
        if (onTriggerUpdated) onTriggerUpdated(updated);
        setSuccessBanner(`Trigger rule "${updated.rule_name}" updated successfully.`);
      } else {
        const createPayload: TriggerCreateRequest = {
          rule_name: triggerRuleName.trim(),
          financial_criteria: triggerFinancialCriteria.trim(),
          threshold_amount: Number(triggerThresholdAmount),
          urgency: triggerUrgency,
          is_active: triggerIsActive,
        };
        const created = await createTriggerRule(createPayload);
        setTriggers((prev) => [created, ...prev]);
        if (onTriggerCreated) onTriggerCreated(created);
        setSuccessBanner(`Trigger rule "${created.rule_name}" created successfully.`);
      }

      setIsTriggerModalOpen(false);
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save trigger rule.';
      setTriggerFormErrors({ submit: msg });
    } finally {
      setTriggerSubmitLoading(false);
    }
  };

  // Toggle active status directly [FR-6]
  const handleToggleTriggerActive = async (trigger: AlertTrigger) => {
    const updatedStatus = !trigger.is_active;
    try {
      const updated = await updateTriggerRule(trigger.trigger_id, { is_active: updatedStatus });
      setTriggers((prev) =>
        prev.map((t) => (t.trigger_id === trigger.trigger_id ? updated : t))
      );
      if (onTriggerUpdated) onTriggerUpdated(updated);
    } catch (err: unknown) {
      // Optimistic toggle fallback
      setTriggers((prev) =>
        prev.map((t) => (t.trigger_id === trigger.trigger_id ? { ...t, is_active: updatedStatus } : t))
      );
    }
  };

  // Delete Trigger Rule [FR-6]
  const handleDeleteTrigger = async (triggerId: string) => {
    try {
      await deleteTriggerRule(triggerId);
      setTriggers((prev) => prev.filter((t) => t.trigger_id !== triggerId));
      if (onTriggerDeleted) onTriggerDeleted(triggerId);
      setSuccessBanner('Trigger rule deleted successfully.');
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err: unknown) {
      // Optimistic deletion fallback
      setTriggers((prev) => prev.filter((t) => t.trigger_id !== triggerId));
      if (onTriggerDeleted) onTriggerDeleted(triggerId);
    }
  };

  // Toggle Channel in Notification Preference [FR-7]
  const handleToggleChannel = (prefId: string, channel: string) => {
    setPreferences((prev) =>
      prev.map((p) => {
        if (p.preference_id === prefId) {
          const currentChannels = p.channels_json || [];
          const exists = currentChannels.includes(channel);
          const nextChannels = exists
            ? currentChannels.filter((c) => c !== channel)
            : [...currentChannels, channel];
          return { ...p, channels_json: nextChannels };
        }
        return p;
      })
    );
  };

  // Save Notification Preference with Optimistic Locking [FR-7]
  const handleSavePreference = async (pref: NotificationPreference) => {
    const valResult = validatePreferenceChannels(pref.channels_json);
    if (!valResult.isValid) {
      setPreferenceSaveStatus({ [pref.preference_id]: valResult.errorMessage || 'Select at least one channel.' });
      return;
    }

    setPreferenceSaveStatus({ [pref.preference_id]: 'saving' });
    try {
      const payload: PreferenceUpdateRequest = {
        role_name: pref.role_name,
        event_type: pref.event_type,
        urgency: pref.urgency,
        channels_json: pref.channels_json,
        version: pref.version, // Required for optimistic locking
      };

      const updated = await updateNotificationPreferences(payload);
      setPreferences((prev) =>
        prev.map((p) => (p.preference_id === pref.preference_id ? updated : p))
      );
      if (onPreferenceUpdated) onPreferenceUpdated(updated);

      setPreferenceSaveStatus({ [pref.preference_id]: 'success' });
      setSuccessBanner(`Preferences saved for role "${updated.role_name}" (${updated.event_type}).`);
      setTimeout(() => {
        setPreferenceSaveStatus((s) => ({ ...s, [pref.preference_id]: '' }));
        setSuccessBanner(null);
      }, 4000);
    } catch (err: unknown) {
      const isConflict =
        (err as { status?: number })?.status === 409 ||
        (err instanceof Error && err.message.includes('409'));

      if (isConflict) {
        setPreferenceSaveStatus({
          [pref.preference_id]:
            'Conflict Error (409): Preference was updated by another user. Please refresh and try again.',
        });
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to save preferences.';
        setPreferenceSaveStatus({ [pref.preference_id]: msg });
      }
    }
  };

  // Filtered Alerts calculation [FR-5]
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (unreadOnly && alert.read_status) {
        return false;
      }
      if (alertUrgencyFilter !== 'ALL' && String(alert.urgency).toUpperCase() !== alertUrgencyFilter.toUpperCase()) {
        return false;
      }
      if (alertSearch.trim()) {
        const q = alertSearch.toLowerCase();
        const msg = (alert.message || '').toLowerCase();
        const corr = (alert.correlation_id || '').toLowerCase();
        return msg.includes(q) || corr.includes(q);
      }
      return true;
    });
  }, [alerts, unreadOnly, alertUrgencyFilter, alertSearch]);

  // Filtered Triggers calculation [FR-6]
  const filteredTriggers = useMemo(() => {
    return triggers.filter((trigger) => {
      if (triggerActiveFilter === 'ACTIVE' && !trigger.is_active) return false;
      if (triggerActiveFilter === 'INACTIVE' && trigger.is_active) return false;
      if (triggerSearch.trim()) {
        const q = triggerSearch.toLowerCase();
        const name = trigger.rule_name.toLowerCase();
        const criteria = trigger.financial_criteria.toLowerCase();
        return name.includes(q) || criteria.includes(q);
      }
      return true;
    });
  }, [triggers, triggerActiveFilter, triggerSearch]);

  // Filtered Preferences calculation [FR-7]
  const filteredPreferences = useMemo(() => {
    return preferences.filter((pref) => {
      if (roleFilter !== 'ALL' && pref.role_name.toUpperCase() !== roleFilter.toUpperCase()) {
        return false;
      }
      return true;
    });
  }, [preferences, roleFilter]);

  // Unique roles list for preference filter dropdown
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    preferences.forEach((p) => set.add(p.role_name));
    return Array.from(set);
  }, [preferences]);

  const unreadCount = useMemo(() => alerts.filter((a) => !a.read_status).length, [alerts]);

  const handleGlobalRefresh = () => {
    fetchAlerts();
    fetchTriggers();
    fetchPreferences();
    if (onRefresh) onRefresh();
  };

  const isLoading = externalLoading || alertsLoading || triggersLoading || preferencesLoading;
  const globalError = externalError || alertsError || triggersError || preferencesError;

  return (
    <div
      className={twMerge('w-full space-y-6 font-sans text-[#1b1c19]', className)}
      data-testid="notification-hub"
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#d1c4b9]/50 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-[#59452b]">
              Notification & Alert Hub
            </h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ba1a1a] text-white">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="text-sm text-[#4e453d] mt-1">
            Centralized notification center for in-app alerts, financial trigger rules, and role preferences.
          </p>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGlobalRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium border border-[#d1c4b9] text-[#59452b] bg-[#fbf9f4] hover:bg-[#eae8e3] transition-colors focus:outline-none focus:ring-2 focus:ring-[#59452b]"
            aria-label="Refresh notification hub data"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Global Banners */}
      {successBanner && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between p-3.5 rounded-md bg-[#e3ded1]/60 border border-[#80756b]/30 text-[#281804] text-xs sm:text-sm"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#59452b] shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-[#59452b] hover:text-[#1b1c19] p-1"
            aria-label="Close message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {globalError && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between p-3.5 rounded-md bg-[#ffdad6] border border-[#ba1a1a]/30 text-[#93000a] text-xs sm:text-sm"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#ba1a1a] shrink-0" />
            <span>{globalError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setAlertsError(null);
              setTriggersError(null);
              setPreferencesError(null);
            }}
            className="text-[#ba1a1a] hover:text-[#93000a] p-1"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-[#d1c4b9]/40 bg-[#fbf9f4] px-1 pt-1 rounded-t-lg">
        <nav className="flex space-x-2 sm:space-x-6" aria-label="Notification Hub Tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'alerts'}
            aria-controls="panel-alerts"
            id="tab-alerts"
            onClick={() => setActiveTab('alerts')}
            className={clsx(
              'flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 transition-all focus:outline-none',
              activeTab === 'alerts'
                ? 'border-[#59452b] text-[#59452b] font-semibold'
                : 'border-transparent text-[#4e453d] hover:text-[#1b1c19] hover:border-[#d1c4b9]'
            )}
          >
            <Bell className="w-4 h-4" />
            In-App Alerts
            {unreadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-[#ba1a1a] text-white text-[10px] rounded-full font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'triggers'}
            aria-controls="panel-triggers"
            id="tab-triggers"
            onClick={() => setActiveTab('triggers')}
            className={clsx(
              'flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 transition-all focus:outline-none',
              activeTab === 'triggers'
                ? 'border-[#59452b] text-[#59452b] font-semibold'
                : 'border-transparent text-[#4e453d] hover:text-[#1b1c19] hover:border-[#d1c4b9]'
            )}
          >
            <Zap className="w-4 h-4" />
            Financial Trigger Rules
            <span className="ml-1 px-1.5 py-0.2 bg-[#e3ded1] text-[#59452b] text-[10px] rounded-full font-semibold">
              {triggers.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'preferences'}
            aria-controls="panel-preferences"
            id="tab-preferences"
            onClick={() => setActiveTab('preferences')}
            className={clsx(
              'flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 transition-all focus:outline-none',
              activeTab === 'preferences'
                ? 'border-[#59452b] text-[#59452b] font-semibold'
                : 'border-transparent text-[#4e453d] hover:text-[#1b1c19] hover:border-[#d1c4b9]'
            )}
          >
            <Sliders className="w-4 h-4" />
            Role Preferences
          </button>
        </nav>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: In-App Alerts [FR-5]                                                */}
      {/* ========================================================================= */}
      {activeTab === 'alerts' && (
        <section
          id="panel-alerts"
          role="tabpanel"
          aria-labelledby="tab-alerts"
          className="space-y-4"
          data-testid="tab-panel-alerts"
        >
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-[#f5f3ee] p-3.5 rounded-lg border border-[#d1c4b9]/40">
            {/* Search & Urgency Filter */}
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#80756b]" />
                <input
                  type="text"
                  placeholder="Search alert message or correlation ID..."
                  value={alertSearch}
                  onChange={(e) => setAlertSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-[#d1c4b9] rounded-md focus:outline-none focus:ring-1 focus:ring-[#59452b]"
                  aria-label="Filter in-app alerts by keyword"
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="urgency-filter" className="text-xs font-medium text-[#4e453d] shrink-0">
                  Urgency:
                </label>
                <select
                  id="urgency-filter"
                  value={alertUrgencyFilter}
                  onChange={(e) => setAlertUrgencyFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs sm:text-sm bg-white border border-[#d1c4b9] rounded-md focus:outline-none focus:ring-1 focus:ring-[#59452b]"
                >
                  <option value="ALL">All Urgencies</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            {/* Unread Checkbox & Mark All Read */}
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-[#d1c4b9]/30">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-[#4e453d]">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                  className="rounded border-[#d1c4b9] text-[#59452b] focus:ring-[#59452b] h-3.5 w-3.5"
                />
                Unread only
              </label>

              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={unreadCount === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#e3ded1] text-[#59452b] hover:bg-[#d1c4b9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark All as Read
              </button>
            </div>
          </div>

          {/* Alerts List */}
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 px-4 bg-[#fbf9f4] border border-dashed border-[#d1c4b9] rounded-lg space-y-3">
              <Bell className="w-8 h-8 mx-auto text-[#80756b]/60" />
              <h3 className="text-base font-serif font-medium text-[#59452b]">No notification alerts found</h3>
              <p className="text-xs text-[#4e453d] max-w-sm mx-auto">
                {unreadOnly
                  ? "You're all caught up! There are no unread in-app alerts at this time."
                  : 'No alert notifications match your search or filter criteria.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3" role="feed" aria-label="In-App Notification Alerts Feed">
              {filteredAlerts.map((alert) => {
                const isUnread = !alert.read_status;
                const urgencyVar = getUrgencyVariant(alert.urgency);

                return (
                  <div
                    key={alert.notification_id}
                    className={clsx(
                      'p-4 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4',
                      isUnread
                        ? 'bg-white border-[#735c41]/30 shadow-sm'
                        : 'bg-[#fbf9f4]/80 border-[#d1c4b9]/50 opacity-90'
                    )}
                    data-testid={`alert-item-${alert.notification_id}`}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      {/* Read status indicator */}
                      <div className="pt-1 shrink-0">
                        {isUnread ? (
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full bg-[#ba1a1a]"
                            title="Unread alert"
                            aria-label="Unread alert indicator"
                          />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-[#80756b]/50" />
                        )}
                      </div>

                      <div className="space-y-1.5 flex-1">
                        {/* Header Badges */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {/* Urgency Badge */}
                          <span
                            className={clsx(
                              'px-2 py-0.5 rounded-full font-medium border text-[11px]',
                              urgencyVar === 'error' && 'bg-[#ffdad6] text-[#93000a] border-[#ffdad6]',
                              urgencyVar === 'warning' && 'bg-[#f5d6b4] text-[#71160b] border-[#f5d6b4]',
                              urgencyVar === 'info' && 'bg-[#caddf8] text-[#071d30] border-[#caddf8]',
                              urgencyVar === 'neutral' && 'bg-[#e4e2dd] text-[#1b1c19] border-[#e4e2dd]'
                            )}
                          >
                            {alert.urgency} Urgency
                          </span>

                          {/* Channel Badge */}
                          <span className="px-2 py-0.5 rounded bg-[#f0eee9] text-[#4e453d] font-mono text-[10px] border border-[#d1c4b9]/40">
                            {alert.channel || 'InApp'}
                          </span>

                          {/* Delivery Status */}
                          <span className="text-[11px] text-[#80756b]">
                            Status: <strong className="font-semibold text-[#1b1c19]">{alert.delivery_status}</strong>
                          </span>

                          {/* Timestamp */}
                          <span className="text-[11px] text-[#80756b] ml-auto">
                            {formatDateTime(alert.dispatched_at)}
                          </span>
                        </div>

                        {/* Message text */}
                        <p className={clsx('text-xs sm:text-sm leading-relaxed', isUnread ? 'font-medium text-[#1b1c19]' : 'text-[#4e453d]')}>
                          {alert.message || 'System Notification Alert'}
                        </p>

                        {/* Metadata Footer */}
                        <div className="text-[10px] text-[#80756b] font-mono flex flex-wrap gap-x-4 gap-y-1 pt-1">
                          <span>Correlation ID: {alert.correlation_id}</span>
                          {alert.trigger_id && <span>Trigger ID: {alert.trigger_id}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Action button */}
                    {isUnread && (
                      <div className="sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(alert.notification_id)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#59452b] text-white hover:bg-[#433320] transition-colors focus:outline-none focus:ring-1 focus:ring-[#59452b]"
                          aria-label={`Mark alert "${alert.message}" as read`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Mark Read
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Financial Trigger Rules [FR-6]                                      */}
      {/* ========================================================================= */}
      {activeTab === 'triggers' && (
        <section
          id="panel-triggers"
          role="tabpanel"
          aria-labelledby="tab-triggers"
          className="space-y-4"
          data-testid="tab-panel-triggers"
        >
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-[#f5f3ee] p-3.5 rounded-lg border border-[#d1c4b9]/40">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#80756b]" />
                <input
                  type="text"
                  placeholder="Search rule name or criteria..."
                  value={triggerSearch}
                  onChange={(e) => setTriggerSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-[#d1c4b9] rounded-md focus:outline-none focus:ring-1 focus:ring-[#59452b]"
                  aria-label="Search financial trigger rules"
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="active-filter" className="text-xs font-medium text-[#4e453d] shrink-0">
                  Status:
                </label>
                <select
                  id="active-filter"
                  value={triggerActiveFilter}
                  onChange={(e) => setTriggerActiveFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs sm:text-sm bg-white border border-[#d1c4b9] rounded-md focus:outline-none focus:ring-1 focus:ring-[#59452b]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>
            </div>

            {/* Create Trigger Rule Button */}
            <div>
              <button
                type="button"
                onClick={handleOpenCreateTriggerModal}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-md text-xs sm:text-sm font-medium bg-[#59452b] text-white hover:bg-[#433320] transition-colors focus:outline-none focus:ring-2 focus:ring-[#59452b]"
              >
                <Plus className="w-4 h-4" />
                Create Trigger Rule
              </button>
            </div>
          </div>

          {/* Triggers Table / Cards */}
          {filteredTriggers.length === 0 ? (
            <div className="text-center py-12 px-4 bg-[#fbf9f4] border border-dashed border-[#d1c4b9] rounded-lg space-y-3">
              <Zap className="w-8 h-8 mx-auto text-[#80756b]/60" />
              <h3 className="text-base font-serif font-medium text-[#59452b]">No trigger rules configured</h3>
              <p className="text-xs text-[#4e453d] max-w-sm mx-auto">
                Define custom alert triggers based on financial criteria (e.g. past-due invoices, quote expirations, threshold amounts).
              </p>
              <button
                type="button"
                onClick={handleOpenCreateTriggerModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium bg-[#59452b] text-white hover:bg-[#433320]"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Rule Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTriggers.map((trigger) => {
                const urgencyVar = getUrgencyVariant(trigger.urgency);

                return (
                  <div
                    key={trigger.trigger_id}
                    className="p-4 rounded-lg bg-white border border-[#d1c4b9]/60 shadow-sm space-y-3 flex flex-col justify-between"
                    data-testid={`trigger-card-${trigger.trigger_id}`}
                  >
                    <div className="space-y-2">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-semibold text-[#1b1c19]">{trigger.rule_name}</h4>
                          <span className="inline-block font-mono text-[11px] text-[#80756b] bg-[#f0eee9] px-2 py-0.5 rounded">
                            {trigger.financial_criteria}
                          </span>
                        </div>

                        {/* Active Toggle Switch Badge */}
                        <button
                          type="button"
                          onClick={() => handleToggleTriggerActive(trigger)}
                          className={clsx(
                            'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors',
                            trigger.is_active
                              ? 'bg-[#e3ded1] text-[#59452b] hover:bg-[#d1c4b9]'
                              : 'bg-[#e4e2dd] text-[#80756b] hover:bg-[#d1c4b9]'
                          )}
                          title="Click to toggle active status"
                          aria-label={`Toggle active state for trigger rule ${trigger.rule_name}`}
                        >
                          {trigger.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </div>

                      {/* Threshold & Urgency Row */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#d1c4b9]/30 text-xs">
                        <div>
                          <span className="text-[#80756b] block text-[11px]">Threshold Amount:</span>
                          <span className="font-semibold text-[#59452b]">
                            {formatCurrency(trigger.threshold_amount)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[#80756b] block text-[11px]">Urgency Level:</span>
                          <span
                            className={clsx(
                              'inline-block px-2 py-0.5 rounded-full font-medium text-[11px] border mt-0.5',
                              urgencyVar === 'error' && 'bg-[#ffdad6] text-[#93000a] border-[#ffdad6]',
                              urgencyVar === 'warning' && 'bg-[#f5d6b4] text-[#71160b] border-[#f5d6b4]',
                              urgencyVar === 'info' && 'bg-[#caddf8] text-[#071d30] border-[#caddf8]',
                              urgencyVar === 'neutral' && 'bg-[#e4e2dd] text-[#1b1c19] border-[#e4e2dd]'
                            )}
                          >
                            {trigger.urgency}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="pt-3 border-t border-[#d1c4b9]/30 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-[#80756b]">
                        Updated: {formatDateTime(trigger.updated_at || trigger.created_at)}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditTriggerModal(trigger)}
                          className="p-1.5 text-[#59452b] hover:bg-[#f0eee9] rounded transition-colors"
                          title="Edit rule parameters"
                          aria-label={`Edit trigger rule ${trigger.rule_name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteTrigger(trigger.trigger_id)}
                          className="p-1.5 text-[#ba1a1a] hover:bg-[#ffdad6]/50 rounded transition-colors"
                          title="Delete trigger rule"
                          aria-label={`Delete trigger rule ${trigger.rule_name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Trigger Rule Modal (Create/Edit) */}
          {isTriggerModalOpen && (
            <div
              className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs"
              role="dialog"
              aria-modal="true"
              aria-labelledby="trigger-modal-title"
            >
              <div className="bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg shadow-lg w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#d1c4b9]/40 pb-3">
                  <h3 id="trigger-modal-title" className="text-lg font-serif font-medium text-[#59452b]">
                    {editingTrigger ? 'Edit Trigger Rule' : 'Create Custom Financial Trigger Rule'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsTriggerModalOpen(false)}
                    className="text-[#80756b] hover:text-[#1b1c19] p-1 rounded"
                    aria-label="Close modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveTrigger} className="space-y-4">
                  {triggerFormErrors.submit && (
                    <div className="p-3 bg-[#ffdad6] text-[#93000a] text-xs rounded border border-[#ba1a1a]/30">
                      {triggerFormErrors.submit}
                    </div>
                  )}

                  {/* Rule Name */}
                  <div>
                    <label htmlFor="form-rule-name" className="block text-xs font-semibold text-[#4e453d] mb-1">
                      Rule Name *
                    </label>
                    <input
                      id="form-rule-name"
                      type="text"
                      placeholder="e.g. Past-Due Invoices Over $10k"
                      value={triggerRuleName}
                      onChange={(e) => setTriggerRuleName(e.target.value)}
                      className={clsx(
                        'w-full px-3 py-1.5 text-xs sm:text-sm bg-white border rounded-md focus:outline-none focus:ring-1 focus:ring-[#59452b]',
                        triggerFormErrors.rule_name ? 'border-[#ba1a1a]' : 'border-[#d1c4b9]'
                      )}
                    />
                    {triggerFormErrors.rule_name && (
                      <span className="text-[11px] text-[#ba1a1a] mt-0.5 block">{triggerFormErrors.rule_name}</span>
                    )}
                  </div>

                  {/* Financial Criteria */}
                  <div>
                    <label htmlFor="form-criteria" className="block text-xs font-semibold text-[#4e453d] mb-1">
                      Financial Criteria *
                    </label>
                    <input
                      id="form-criteria"
                      type="text"
                      list="criteria-presets"
                      placeholder="e.g. past_due_invoices"
                      value={triggerFinancialCriteria}
                      onChange={(e) => setTriggerFinancialCriteria(e.target.value)}
                      className={clsx(
                        'w-full px-3 py-1.5 text-xs sm:text-sm bg-white border rounded-md focus:outline-none focus:ring-1 focus:ring-[#59452b]',
                        triggerFormErrors.financial_criteria ? 'border-[#ba1a1a]' : 'border-[#d1c4b9]'
                      )}
                    />
                    <datalist id="criteria-presets">
                      <option value="past_due_invoices" />
                      <option value="quote_expirations" />
                      <option value="large_payments" />
                      <option value="overdue_balance" />
                      <option value="ar_threshold_exceeded" />
                    </datalist>
                    {triggerFormErrors.financial_criteria && (
                      <span className="text-[11px] text-[#ba1a1a] mt-0.5 block">{triggerFormErrors.financial_criteria}</span>
                    )}
                  </div>

                  {/* Threshold Amount */}
                  <div>
                    <label htmlFor="form-threshold" className="block text-xs font-semibold text-[#4e453d] mb-1">
                      Threshold Amount ($) *
                    </label>
                    <input
                      id="form-threshold"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="10000"
                      value={triggerThresholdAmount}
                      onChange={(e) => setTriggerThresholdAmount(e.target.value)}
                      className={clsx(
                        'w-full px-3 py-1.5 text-xs sm:text-sm bg-white border rounded-md focus:outline-none focus:ring-1 focus:ring-[#59452b]',
                        triggerFormErrors.threshold_amount ? 'border-[#ba1a1a]' : 'border-[#d1c4b9]'
                      )}
                    />
                    {triggerFormErrors.threshold_amount && (
                      <span className="text-[11px] text-[#ba1a1a] mt-0.5 block">{triggerFormErrors.threshold_amount}</span>
                    )}
                  </div>

                  {/* Urgency */}
                  <div>
                    <label htmlFor="form-urgency" className="block text-xs font-semibold text-[#4e453d] mb-1">
                      Urgency Level *
                    </label>
                    <select
                      id="form-urgency"
                      value={triggerUrgency}
                      onChange={(e) => setTriggerUrgency(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-[#d1c4b9] rounded-md focus:outline-none focus:ring-1 focus:ring-[#59452b]"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>

                  {/* Is Active */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="form-is-active"
                      checked={triggerIsActive}
                      onChange={(e) => setTriggerIsActive(e.target.checked)}
                      className="rounded border-[#d1c4b9] text-[#59452b] focus:ring-[#59452b] h-4 w-4"
                    />
                    <label htmlFor="form-is-active" className="text-xs font-medium text-[#4e453d] cursor-pointer">
                      Enable trigger rule immediately
                    </label>
                  </div>

                  {/* Modal Action Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#d1c4b9]/40">
                    <button
                      type="button"
                      onClick={() => setIsTriggerModalOpen(false)}
                      className="px-4 py-2 text-xs font-medium border border-[#d1c4b9] text-[#59452b] bg-white hover:bg-[#f0eee9] rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={triggerSubmitLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#59452b] text-white hover:bg-[#433320] rounded-md transition-colors disabled:opacity-50"
                    >
                      {triggerSubmitLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {editingTrigger ? 'Update Trigger Rule' : 'Save Trigger Rule'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Role-Based Notification Preferences [FR-7]                          */}
      {/* ========================================================================= */}
      {activeTab === 'preferences' && (
        <section
          id="panel-preferences"
          role="tabpanel"
          aria-labelledby="tab-preferences"
          className="space-y-4"
          data-testid="tab-panel-preferences"
        >
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#f5f3ee] p-3.5 rounded-lg border border-[#d1c4b9]/40">
            <div className="flex items-center gap-3">
              <label htmlFor="preference-role-filter" className="text-xs font-semibold text-[#4e453d] shrink-0">
                Filter by Role:
              </label>
              <select
                id="preference-role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 text-xs sm:text-sm bg-white border border-[#d1c4b9] rounded-md focus:outline-none focus:ring-1 focus:ring-[#59452b]"
              >
                <option value="ALL">All System Roles</option>
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-[#80756b]">
              Optimistic locking versioning active <Lock className="w-3.5 h-3.5 inline ml-1" />
            </div>
          </div>

          {/* Preferences Table / List */}
          {filteredPreferences.length === 0 ? (
            <div className="text-center py-12 px-4 bg-[#fbf9f4] border border-dashed border-[#d1c4b9] rounded-lg space-y-3">
              <Sliders className="w-8 h-8 mx-auto text-[#80756b]/60" />
              <h3 className="text-base font-serif font-medium text-[#59452b]">No notification preferences found</h3>
              <p className="text-xs text-[#4e453d] max-w-sm mx-auto">
                Role notification preferences configure delivery channels (InApp, Email, SMS) per event type and urgency level.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPreferences.map((pref) => {
                const statusMsg = preferenceSaveStatus[pref.preference_id];
                const isSaving = statusMsg === 'saving';
                const isError = statusMsg && statusMsg !== 'saving' && statusMsg !== 'success';

                return (
                  <div
                    key={pref.preference_id}
                    className="p-4 rounded-lg bg-white border border-[#d1c4b9]/60 shadow-sm space-y-3"
                    data-testid={`preference-item-${pref.preference_id}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#d1c4b9]/30 pb-2">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-[#59452b]" />
                        <span className="text-sm font-semibold text-[#1b1c19]">{pref.role_name}</span>
                        <span className="text-xs text-[#80756b]">• Event: <strong className="text-[#4e453d]">{pref.event_type}</strong></span>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#80756b]">Urgency:</span>
                        <span className="px-2 py-0.5 bg-[#f0eee9] text-[#59452b] rounded font-medium border border-[#d1c4b9]/40">
                          {pref.urgency}
                        </span>
                        <span className="px-2 py-0.5 bg-[#e3ded1]/60 text-[#281804] rounded font-mono text-[10px]">
                          v{pref.version}
                        </span>
                      </div>
                    </div>

                    {/* Channels Selection Checkboxes */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-[#4e453d] block">
                          Supported Delivery Channels:
                        </span>
                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-[#1b1c19]">
                            <input
                              type="checkbox"
                              checked={(pref.channels_json || []).includes('InApp')}
                              onChange={() => handleToggleChannel(pref.preference_id, 'InApp')}
                              className="rounded border-[#d1c4b9] text-[#59452b] focus:ring-[#59452b] h-3.5 w-3.5"
                            />
                            <MessageSquare className="w-3.5 h-3.5 text-[#59452b]" />
                            In-App Hub
                          </label>

                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-[#1b1c19]">
                            <input
                              type="checkbox"
                              checked={(pref.channels_json || []).includes('Email')}
                              onChange={() => handleToggleChannel(pref.preference_id, 'Email')}
                              className="rounded border-[#d1c4b9] text-[#59452b] focus:ring-[#59452b] h-3.5 w-3.5"
                            />
                            <Mail className="w-3.5 h-3.5 text-[#59452b]" />
                            Email
                          </label>

                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-[#1b1c19]">
                            <input
                              type="checkbox"
                              checked={(pref.channels_json || []).includes('SMS')}
                              onChange={() => handleToggleChannel(pref.preference_id, 'SMS')}
                              className="rounded border-[#d1c4b9] text-[#59452b] focus:ring-[#59452b] h-3.5 w-3.5"
                            />
                            <Smartphone className="w-3.5 h-3.5 text-[#59452b]" />
                            SMS Gateway
                          </label>
                        </div>
                      </div>

                      {/* Save Preference Button */}
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSavePreference(pref)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md bg-[#59452b] text-white hover:bg-[#433320] transition-colors focus:outline-none focus:ring-1 focus:ring-[#59452b] disabled:opacity-50"
                        >
                          {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                          Save Preferences
                        </button>
                      </div>
                    </div>

                    {/* Preference Item Status / Error Message */}
                    {isError && (
                      <div className="p-2.5 rounded bg-[#ffdad6] text-[#93000a] text-xs flex items-center gap-2 border border-[#ba1a1a]/30">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#ba1a1a]" />
                        <span>{statusMsg}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default NotificationHub;
