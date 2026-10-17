'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Search,
  Filter,
  Check,
  Zap,
  Mail,
  Smartphone,
  Sparkles,
  Layers,
  Lock,
  UserCheck,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Activity,
  FileText,
  Clock,
} from 'lucide-react';
import { apiClient, UserMeResponse, NavItem, ApiError } from '../../services/apiClient';
import {
  listInAppAlerts,
  listTriggerRules,
  listNotificationPreferences,
  InAppAlert,
  AlertTrigger,
  NotificationPreference,
  InAppAlertResponse,
  TriggerResponse,
  PreferenceResponse,
} from '../../services/alerting';
import { NotificationHub, NotificationHubTab } from '../../components/alerting/NotificationHub';
import { StatusLabel } from '../../components/common/StatusLabel';
import { useAccessibility } from '../../components/common/AccessibilityContext';

/**
 * Fallback initial demo alerts for multi-channel notification center [FR-5].
 */
const INITIAL_DEMO_ALERTS: InAppAlert[] = [
  {
    notification_id: 'n1111111-1111-1111-1111-111111111111',
    recipient_id: 'usr-101',
    trigger_id: 't1111111-1111-1111-1111-111111111111',
    urgency: 'Medium',
    channel: 'InApp',
    delivery_status: 'Sent',
    message: 'Past-due invoice alert: Account ACME Corp exceeds $10,000 threshold ($12,500.00 outstanding).',
    read_status: false,
    dispatched_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    correlation_id: 'corr-alert-9901-a1',
  },
  {
    notification_id: 'n2222222-2222-2222-2222-222222222222',
    recipient_id: 'usr-101',
    trigger_id: 't2222222-2222-2222-2222-222222222222',
    urgency: 'High',
    channel: 'InApp',
    delivery_status: 'Sent',
    message: 'Critical threshold breach: Quote Q-2026-001 expiration risk for Contract Corp ($125,000.00).',
    read_status: false,
    dispatched_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    correlation_id: 'corr-alert-9902-b2',
  },
  {
    notification_id: 'n3333333-3333-3333-3333-333333333333',
    recipient_id: 'usr-101',
    trigger_id: 't3333333-3333-3333-3333-333333333333',
    urgency: 'Low',
    channel: 'InApp',
    delivery_status: 'Sent',
    message: 'Routine financial update: Monthly Accounts Receivable aging calculations completed successfully.',
    read_status: true,
    dispatched_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    correlation_id: 'corr-alert-9903-c3',
  },
  {
    notification_id: 'n4444444-4444-4444-4444-444444444444',
    recipient_id: 'usr-101',
    trigger_id: 't1111111-1111-1111-1111-111111111111',
    urgency: 'Medium',
    channel: 'InApp',
    delivery_status: 'Sent',
    message: 'Past-due invoice alert: Apex Systems LLC invoice INV-2026-102 is 45 days past due.',
    read_status: true,
    dispatched_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    correlation_id: 'corr-alert-9904-d4',
  },
];

/**
 * Fallback initial demo trigger rules [FR-6].
 */
const INITIAL_DEMO_TRIGGERS: AlertTrigger[] = [
  {
    trigger_id: 't1111111-1111-1111-1111-111111111111',
    rule_name: 'Past-Due Invoices > $10,000',
    financial_criteria: 'past_due_invoices',
    threshold_amount: 10000,
    urgency: 'Medium',
    is_active: true,
    created_at: '2026-01-10T08:00:00Z',
    updated_at: '2026-01-10T08:00:00Z',
  },
  {
    trigger_id: 't2222222-2222-2222-2222-222222222222',
    rule_name: 'High Value Quote Expiration Risk',
    financial_criteria: 'quote_expiration',
    threshold_amount: 50000,
    urgency: 'High',
    is_active: true,
    created_at: '2026-01-15T09:30:00Z',
    updated_at: '2026-01-15T09:30:00Z',
  },
  {
    trigger_id: 't3333333-3333-3333-3333-333333333333',
    rule_name: 'Large Payment Threshold Alert',
    financial_criteria: 'large_payments',
    threshold_amount: 25000,
    urgency: 'Low',
    is_active: false,
    created_at: '2026-02-01T11:00:00Z',
    updated_at: '2026-02-01T11:00:00Z',
  },
];

/**
 * Fallback initial demo notification preferences [FR-7].
 */
const INITIAL_DEMO_PREFERENCES: NotificationPreference[] = [
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
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    preference_id: 'p3333333-3333-3333-3333-333333333333',
    role_name: 'ClientViewer',
    event_type: 'payment_received',
    urgency: 'Low',
    channels_json: ['InApp'],
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

/**
 * Next.js route page component for assembling the multi-channel notification center at `/notifications`
 * [FR-5, FR-6, FR-7].
 */
export default function NotificationsPage() {
  const router = useRouter();
  const accessibility = useAccessibility ? useAccessibility() : null;

  // User and Auth State
  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Data States
  const [alerts, setAlerts] = useState<InAppAlert[]>(INITIAL_DEMO_ALERTS);
  const [triggers, setTriggers] = useState<AlertTrigger[]>(INITIAL_DEMO_TRIGGERS);
  const [preferences, setPreferences] = useState<NotificationPreference[]>(INITIAL_DEMO_PREFERENCES);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Active tab state
  const [activeTab, setActiveTab] = useState<NotificationHubTab>('alerts');

  // Load User Authentication & Navigation
  const loadUserAndNavigation = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);

    const token = apiClient.getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const meResponse = await apiClient.getMe();
      setUser(meResponse);

      try {
        const navResponse = await apiClient.getNavigationMenu();
        if (navResponse && navResponse.items) {
          setNavItems(navResponse.items);
        }
      } catch {
        // Navigation failure is non-critical fallback
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Failed to authenticate user context.';
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  }, [router]);

  // Load Notification Hub Datasets [FR-5, FR-6, FR-7]
  const loadNotificationData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);

    let fetchedAlerts = false;
    let fetchedTriggers = false;
    let fetchedPreferences = false;

    try {
      const alertsData = await listInAppAlerts();
      if (Array.isArray(alertsData) && alertsData.length > 0) {
        setAlerts(alertsData);
        fetchedAlerts = true;
      }
    } catch {
      // Retain demo alerts fallback
    }

    try {
      const triggersData = await listTriggerRules();
      if (Array.isArray(triggersData) && triggersData.length > 0) {
        setTriggers(triggersData);
        fetchedTriggers = true;
      }
    } catch {
      // Retain demo triggers fallback
    }

    try {
      const prefsData = await listNotificationPreferences();
      if (Array.isArray(prefsData) && prefsData.length > 0) {
        setPreferences(prefsData);
        fetchedPreferences = true;
      }
    } catch {
      // Retain demo preferences fallback
    }

    // Set error only if all endpoints failed and we have no data
    if (!fetchedAlerts && !fetchedTriggers && !fetchedPreferences && alerts.length === 0) {
      setDataError('Could not sync live notification data. Displaying pre-loaded hub records.');
    }

    setDataLoading(false);
  }, [alerts.length]);

  // Initial load on mount
  useEffect(() => {
    loadUserAndNavigation();
  }, [loadUserAndNavigation]);

  useEffect(() => {
    if (!authLoading && user) {
      loadNotificationData();
    }
  }, [authLoading, user, loadNotificationData]);

  // User primary role
  const primaryRole = useMemo(() => {
    if (user && user.roles && user.roles.length > 0) {
      return user.roles[0];
    }
    return 'Admin';
  }, [user]);

  // KPI Calculations
  const totalAlertsCount = alerts.length;
  const unreadAlertsCount = useMemo(() => alerts.filter((a) => !a.read_status).length, [alerts]);
  const activeTriggersCount = useMemo(() => triggers.filter((t) => t.is_active).length, [triggers]);
  const totalTriggersCount = triggers.length;
  const totalPreferencesCount = preferences.length;

  // Handlers for NotificationHub Callbacks
  const handleRefresh = useCallback(() => {
    loadNotificationData();
  }, [loadNotificationData]);

  const handleAlertRead = useCallback((updatedAlert: InAppAlert) => {
    setAlerts((prev) =>
      prev.map((a) => (a.notification_id === updatedAlert.notification_id ? { ...a, read_status: true } : a))
    );
  }, []);

  const handleTriggerCreated = useCallback((newTrigger: AlertTrigger) => {
    setTriggers((prev) => [newTrigger, ...prev]);
  }, []);

  const handleTriggerUpdated = useCallback((updatedTrigger: AlertTrigger) => {
    setTriggers((prev) =>
      prev.map((t) => (t.trigger_id === updatedTrigger.trigger_id ? updatedTrigger : t))
    );
  }, []);

  const handleTriggerDeleted = useCallback((deletedId: string) => {
    setTriggers((prev) => prev.filter((t) => t.trigger_id !== deletedId));
  }, []);

  const handlePreferenceUpdated = useCallback((updatedPref: NotificationPreference) => {
    setPreferences((prev) =>
      prev.map((p) =>
        p.preference_id === updatedPref.preference_id ||
        (p.role_name === updatedPref.role_name && p.event_type === updatedPref.event_type)
          ? updatedPref
          : p
      )
    );
  }, []);

  // Loading view
  if (authLoading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading multi-channel notification center"
        className="min-h-screen bg-[#fbf9f4] flex flex-col justify-center items-center p-6 text-center"
      >
        <div className="w-16 h-16 border-4 border-[#735c41]/20 border-t-[#59452b] rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-serif text-[#1b1c19] mb-1">
          Loading Multi-Channel Notification Center...
        </h2>
        <p className="text-sm text-[#4e453d]">
          Authenticating security context and retrieving hub preferences...
        </p>
      </div>
    );
  }

  // Error view
  if (authError) {
    return (
      <div className="min-h-screen bg-[#fbf9f4] p-8 flex justify-center items-center">
        <div role="alert" className="max-w-md w-full bg-white rounded-lg p-6 shadow-sm border border-[#e3ded1] text-center">
          <div className="inline-flex p-3 bg-red-50 text-red-600 rounded-full mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-serif text-[#1b1c19] mb-2">
            Failed to Load Notification Center
          </h2>
          <p className="text-sm text-[#4e453d] mb-6">
            {authError}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => loadUserAndNavigation()}
              className="px-4 py-2 bg-[#59452b] hover:bg-[#735c41] text-white rounded text-sm font-medium transition-colors inline-flex items-center gap-2"
              aria-label="Retry loading"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Loading
            </button>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-[#e3ded1] hover:bg-[#d1c4b9] text-[#1b1c19] rounded text-sm font-medium transition-colors inline-flex items-center gap-2"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main id="main-content" className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] pb-16">
      {/* Top Header & Breadcrumbs Banner */}
      <header className="bg-white border-b border-[#e3ded1] shadow-xs sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#715a3f] mb-1">
              <Link href="/dashboard" className="hover:underline flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                Platform
              </Link>
              <span>/</span>
              <span className="font-semibold text-[#1b1c19]">Notification Center</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-serif font-normal text-[#1b1c19] flex items-center gap-2.5">
              <Bell className="w-7 h-7 text-[#59452b]" />
              Multi-Channel Notification Hub
            </h1>
            <p className="text-sm text-[#4e453d] mt-0.5">
              Centralized hub for system alerts, custom financial trigger rules, and role-based channel preferences.
            </p>
          </div>

          {/* Quick Info & User Context */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="px-3 py-1.5 bg-[#f5f3ee] border border-[#e3ded1] rounded text-xs text-[#4e453d] flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#59452b]" />
              <span>
                Role: <strong className="text-[#1b1c19]">{primaryRole}</strong>
              </span>
            </div>
            <Link
              href="/financial"
              className="px-3.5 py-1.5 bg-white border border-[#80756b] hover:bg-[#f5f3ee] text-[#1b1c19] text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5"
            >
              <DollarSign className="w-3.5 h-3.5 text-[#59452b]" />
              Financial Dashboard
            </Link>
            <button
              onClick={() => {
                loadNotificationData();
              }}
              disabled={dataLoading}
              className="p-2 text-[#4e453d] hover:text-[#1b1c19] bg-white border border-[#e3ded1] rounded hover:bg-[#f5f3ee] transition-colors"
              title="Refresh All Hub Data"
              aria-label="Refresh notification hub data"
            >
              <RefreshCw className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Data Sync Error Banner */}
        {dataError && (
          <div role="alert" className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-amber-800 text-sm">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>{dataError}</span>
            </div>
            <button
              onClick={loadNotificationData}
              className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-xs font-medium transition-colors"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* Executive Summary Cards / Key Metrics Bar */}
        <section aria-label="Notification Overview Metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: In-App Alerts */}
          <div
            onClick={() => setActiveTab('alerts')}
            className="cursor-pointer bg-white border border-[#e3ded1] hover:border-[#80756b] rounded-lg p-5 transition-all shadow-xs group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[#4e453d]">
                In-App Alerts
              </span>
              <div className="p-2 bg-[#f5f3ee] group-hover:bg-[#e3ded1] text-[#59452b] rounded-full transition-colors">
                <Bell className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-serif font-semibold text-[#1b1c19]">
                {totalAlertsCount}
              </span>
              {unreadAlertsCount > 0 ? (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  {unreadAlertsCount} Unread
                </span>
              ) : (
                <span className="text-xs text-emerald-700 font-medium">All Read</span>
              )}
            </div>
            <p className="text-xs text-[#4e453d] mt-2 flex items-center gap-1">
              <span>View in-app alerts feed</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </div>

          {/* Card 2: Active Trigger Rules */}
          <div
            onClick={() => setActiveTab('triggers')}
            className="cursor-pointer bg-white border border-[#e3ded1] hover:border-[#80756b] rounded-lg p-5 transition-all shadow-xs group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[#4e453d]">
                Trigger Rules
              </span>
              <div className="p-2 bg-[#f5f3ee] group-hover:bg-[#e3ded1] text-[#59452b] rounded-full transition-colors">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-serif font-semibold text-[#1b1c19]">
                {activeTriggersCount}
              </span>
              <span className="text-xs text-[#4e453d]">
                / {totalTriggersCount} Active Rules
              </span>
            </div>
            <p className="text-xs text-[#4e453d] mt-2 flex items-center gap-1">
              <span>Manage threshold rules</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </div>

          {/* Card 3: Role Preferences */}
          <div
            onClick={() => setActiveTab('preferences')}
            className="cursor-pointer bg-white border border-[#e3ded1] hover:border-[#80756b] rounded-lg p-5 transition-all shadow-xs group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[#4e453d]">
                Role Preferences
              </span>
              <div className="p-2 bg-[#f5f3ee] group-hover:bg-[#e3ded1] text-[#59452b] rounded-full transition-colors">
                <Sliders className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-serif font-semibold text-[#1b1c19]">
                {totalPreferencesCount}
              </span>
              <span className="text-xs text-[#4e453d]">
                Configured Rules
              </span>
            </div>
            <p className="text-xs text-[#4e453d] mt-2 flex items-center gap-1">
              <span>Channel matrix per urgency</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </div>

          {/* Card 4: Multi-Channel Gateway Status */}
          <div className="bg-white border border-[#e3ded1] rounded-lg p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[#4e453d]">
                Channel Gateways
              </span>
              <div className="p-2 bg-[#f5f3ee] text-[#59452b] rounded-full">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <Bell className="w-3 h-3" /> In-App
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <Mail className="w-3 h-3" /> Email
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-[#59452b] bg-[#f5f3ee] px-2 py-0.5 rounded border border-[#e3ded1]">
                <Smartphone className="w-3 h-3" /> SMS
              </div>
            </div>
            <p className="text-xs text-[#4e453d] mt-2.5">
              Active multi-channel fallbacks enabled
            </p>
          </div>
        </section>

        {/* Assembled Notification Hub Core Component [FR-5, FR-6, FR-7] */}
        <section aria-label="Centralized Notification Hub Interface">
          <NotificationHub
            initialAlerts={alerts}
            initialTriggers={triggers}
            initialPreferences={preferences}
            defaultTab={activeTab}
            currentRole={primaryRole}
            loading={dataLoading}
            error={dataError}
            onRefresh={handleRefresh}
            onAlertRead={handleAlertRead}
            onTriggerCreated={handleTriggerCreated}
            onTriggerUpdated={handleTriggerUpdated}
            onTriggerDeleted={handleTriggerDeleted}
            onPreferenceUpdated={handlePreferenceUpdated}
          />
        </section>
      </div>
    </main>
  );
}
