'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Users,
  User,
  UserPlus,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Activity,
  Plus,
  RefreshCw,
  AlertCircle,
  X,
  Filter,
  Briefcase,
  Check,
  ShieldAlert,
} from 'lucide-react';
import {
  StakeholderMapResponse,
  StakeholderResponse,
  StakeholderActivityResponse,
  InfluenceLevel,
  ActivityType,
  getStakeholders,
  createStakeholder,
  addStakeholderActivity,
  sanitizeString,
} from '../../services/deals';
import { StatusLabel } from '../common/StatusLabel';

export interface StakeholderMapProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onError'> {
  /**
   * The deal ID for which stakeholders and activity feed are rendered [FR-6, FR-7]
   */
  dealId: string;
  /**
   * Optional initial or pre-loaded stakeholder map data
   */
  initialData?: StakeholderMapResponse;
  /**
   * Optional title override for the component
   */
  title?: string;
  /**
   * Optional callback triggered when stakeholder map data updates
   */
  onUpdate?: (data: StakeholderMapResponse) => void;
  /**
   * Callback when an error occurs
   */
  onError?: (error: Error) => void;
  /**
   * Whether to show active stakeholders only by default
   */
  activeOnly?: boolean;
  /**
   * Additional CSS class names
   */
  className?: string;
}

export interface InfluenceBadgeConfig {
  label: string;
  variant: 'error' | 'warning' | 'info' | 'neutral' | 'success';
  bgClass: string;
  textClass: string;
  borderClass: string;
}

/**
 * Helper to determine badge styling and label based on influence level [FR-6].
 */
export function formatInfluenceLevel(influence?: string | null): InfluenceBadgeConfig {
  const norm = (influence || '').trim().toLowerCase();
  switch (norm) {
    case 'high':
      return {
        label: 'High Influence',
        variant: 'warning',
        bgClass: 'bg-amber-100/90',
        textClass: 'text-amber-900',
        borderClass: 'border-amber-300',
      };
    case 'medium':
      return {
        label: 'Medium Influence',
        variant: 'info',
        bgClass: 'bg-blue-100/90',
        textClass: 'text-blue-900',
        borderClass: 'border-blue-300',
      };
    case 'low':
      return {
        label: 'Low Influence',
        variant: 'neutral',
        bgClass: 'bg-stone-100',
        textClass: 'text-stone-700',
        borderClass: 'border-stone-300',
      };
    default:
      return {
        label: influence ? sanitizeString(influence) : 'Medium Influence',
        variant: 'info',
        bgClass: 'bg-blue-100/90',
        textClass: 'text-blue-900',
        borderClass: 'border-blue-300',
      };
  }
}

/**
 * Helper to format ISO date/time string into clean human-readable date [FR-7].
 */
export function formatActivityDate(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) {
    return 'N/A';
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return sanitizeString(dateStr);
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return sanitizeString(dateStr);
  }
}

/**
 * Helper to pick Lucide icon and color classes for activity type [FR-7].
 */
export function getActivityTypeMeta(activityType?: string | null): {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  bgClass: string;
  textClass: string;
} {
  const norm = (activityType || '').trim().toLowerCase();
  switch (norm) {
    case 'email':
      return {
        icon: Mail,
        label: 'Email',
        bgClass: 'bg-sky-100',
        textClass: 'text-sky-800',
      };
    case 'meeting':
      return {
        icon: Calendar,
        label: 'Meeting',
        bgClass: 'bg-purple-100',
        textClass: 'text-purple-800',
      };
    case 'call':
      return {
        icon: Phone,
        label: 'Call',
        bgClass: 'bg-emerald-100',
        textClass: 'text-emerald-800',
      };
    case 'note':
    default:
      return {
        icon: MessageSquare,
        label: 'Note',
        bgClass: 'bg-amber-100',
        textClass: 'text-amber-800',
      };
  }
}

/**
 * StakeholderMap component rendering mapped deal contacts, influence levels,
 * and a chronological feed of recent CRM activity interactions [FR-6, FR-7].
 */
export const StakeholderMap: React.FC<StakeholderMapProps> = ({
  dealId,
  initialData,
  title = 'Stakeholder Map & Interactions',
  onUpdate,
  onError,
  activeOnly: defaultActiveOnly = false,
  className,
  ...restProps
}) => {
  const [data, setData] = useState<StakeholderMapResponse | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [activeOnlyFilter, setActiveOnlyFilter] = useState<boolean>(defaultActiveOnly);
  const [selectedActivityFilter, setSelectedActivityFilter] = useState<string>('ALL');

  // Modal forms open state
  const [isAddStakeholderOpen, setIsAddStakeholderOpen] = useState<boolean>(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState<boolean>(false);

  // Form states for adding stakeholder
  const [newFullName, setNewFullName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newOrgRole, setNewOrgRole] = useState<string>('');
  const [newInfluenceLevel, setNewInfluenceLevel] = useState<InfluenceLevel>('Medium');
  const [submittingStakeholder, setSubmittingStakeholder] = useState<boolean>(false);
  const [stakeholderFormError, setStakeholderFormError] = useState<string | null>(null);

  // Form states for logging activity
  const [newActivityStakeholderId, setNewActivityStakeholderId] = useState<string>('');
  const [newActivityType, setNewActivityType] = useState<ActivityType>('Note');
  const [newActivitySummary, setNewActivitySummary] = useState<string>('');
  const [newActivityOccurredOn, setNewActivityOccurredOn] = useState<string>('');
  const [submittingActivity, setSubmittingActivity] = useState<boolean>(false);
  const [activityFormError, setActivityFormError] = useState<string | null>(null);

  /**
   * Fetch stakeholder map and activity feed from API [FR-6, FR-7].
   */
  const fetchData = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getStakeholders(dealId, activeOnlyFilter);
      setData(res);
      if (onUpdate) {
        onUpdate(res);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load stakeholder map data';
      setError(msg);
      if (onError) {
        onError(err instanceof Error ? err : new Error(msg));
      }
    } finally {
      setLoading(false);
    }
  }, [dealId, activeOnlyFilter, onUpdate, onError]);

  useEffect(() => {
    if (!initialData) {
      fetchData();
    }
  }, [fetchData, initialData]);

  // Handle activeOnly filter changes
  const handleActiveOnlyToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setActiveOnlyFilter(checked);
    if (dealId) {
      setLoading(true);
      getStakeholders(dealId, checked)
        .then((res) => {
          setData(res);
          if (onUpdate) onUpdate(res);
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : 'Failed to update filter';
          setError(msg);
          if (onError) onError(err instanceof Error ? err : new Error(msg));
        })
        .finally(() => setLoading(false));
    }
  };

  /**
   * Submit new stakeholder form [FR-6].
   */
  const handleCreateStakeholder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newEmail.trim() || !newOrgRole.trim()) {
      setStakeholderFormError('Full name, email, and org role are required.');
      return;
    }
    setSubmittingStakeholder(true);
    setStakeholderFormError(null);
    try {
      await createStakeholder(dealId, {
        full_name: newFullName.trim(),
        email: newEmail.trim(),
        org_role: newOrgRole.trim(),
        influence_level: newInfluenceLevel,
      });
      // Reset form
      setNewFullName('');
      setNewEmail('');
      setNewOrgRole('');
      setNewInfluenceLevel('Medium');
      setIsAddStakeholderOpen(false);

      // Refresh data
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add stakeholder contact.';
      setStakeholderFormError(msg);
    } finally {
      setSubmittingStakeholder(false);
    }
  };

  /**
   * Submit new activity log form [FR-7].
   */
  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityStakeholderId) {
      setActivityFormError('Please select a stakeholder for this activity.');
      return;
    }
    if (!newActivitySummary.trim()) {
      setActivityFormError('Activity summary is required.');
      return;
    }
    setSubmittingActivity(true);
    setActivityFormError(null);
    try {
      await addStakeholderActivity(dealId, {
        stakeholder_id: newActivityStakeholderId,
        activity_type: newActivityType,
        summary: newActivitySummary.trim(),
        occurred_on: newActivityOccurredOn ? new Date(newActivityOccurredOn).toISOString() : null,
      });
      // Reset form
      setNewActivityStakeholderId('');
      setNewActivityType('Note');
      setNewActivitySummary('');
      setNewActivityOccurredOn('');
      setIsAddActivityOpen(false);

      // Refresh data
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to log stakeholder activity.';
      setActivityFormError(msg);
    } finally {
      setSubmittingActivity(false);
    }
  };

  // Filter activities by selected activity type tab
  const filteredActivities = useMemo(() => {
    if (!data?.recent_activities) return [];
    if (selectedActivityFilter === 'ALL') return data.recent_activities;
    return data.recent_activities.filter(
      (a) => (a.activity_type || '').toUpperCase() === selectedActivityFilter.toUpperCase()
    );
  }, [data?.recent_activities, selectedActivityFilter]);

  // Lookup map for stakeholder names by ID
  const stakeholderNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (data?.stakeholders) {
      data.stakeholders.forEach((s) => {
        map.set(s.id, s.full_name);
      });
    }
    return map;
  }, [data?.stakeholders]);

  return (
    <div
      data-testid="stakeholder-map-container"
      className={twMerge(
        'w-full bg-[#fbf9f4] border border-[#d1c4b9]/80 rounded-lg shadow-sm p-6 space-y-6 text-[#1b1c19]',
        className
      )}
      {...restProps}
    >
      {/* Header bar */}
      <div
        data-testid="stakeholder-map-header"
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#d1c4b9]/60"
      >
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#735c41]/10 rounded-md text-[#59452b]">
            <Users className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2
              data-testid="stakeholder-map-title"
              className="font-serif text-xl font-normal text-[#1b1c19]"
            >
              {title}
            </h2>
            <p className="text-xs text-[#4e453d]">
              Mapped contacts, influence matrix, and chronological interaction timeline [FR-6, FR-7]
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="refresh-stakeholders-button"
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-[#4e453d] bg-[#f0eee9] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded-md transition-colors disabled:opacity-50"
            aria-label="Refresh stakeholder map"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            data-testid="add-stakeholder-button"
            onClick={() => {
              setIsAddStakeholderOpen(true);
              setStakeholderFormError(null);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#59452b] hover:bg-[#735c41] rounded-md transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#735c41]"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Stakeholder</span>
          </button>

          <button
            type="button"
            data-testid="add-activity-button"
            onClick={() => {
              setIsAddActivityOpen(true);
              setActivityFormError(null);
              if (!newActivityStakeholderId && data?.stakeholders && data.stakeholders.length > 0) {
                setNewActivityStakeholderId(data.stakeholders[0].id);
              }
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-medium text-[#1b1c19] bg-[#e4e2dd] hover:bg-[#dbdad5] border border-[#80756b]/40 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Activity</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && !data && (
        <div
          data-testid="stakeholder-map-loading"
          className="flex flex-col items-center justify-center py-12 space-y-3 bg-[#f5f3ee] rounded-md border border-dashed border-[#d1c4b9]"
        >
          <RefreshCw className="w-6 h-6 text-[#735c41] animate-spin" />
          <p className="text-sm font-medium text-[#4e453d]">
            Loading mapped contacts and activity feed...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          data-testid="stakeholder-map-error"
          className="p-4 bg-red-50 border border-red-200 rounded-md flex items-start space-x-3 text-red-900"
        >
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs space-y-1">
            <p className="font-medium text-sm">Failed to load stakeholder map</p>
            <p className="text-red-700">{error}</p>
            <button
              type="button"
              data-testid="stakeholder-map-retry"
              onClick={fetchData}
              className="mt-2 text-xs font-semibold text-red-800 hover:text-red-950 underline"
            >
              Retry loading
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Stakeholder Contact Matrix (FR-6) */}
          <div data-testid="stakeholders-section" className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#d1c4b9]/40">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-[#59452b]" />
                <h3 className="font-serif text-base font-normal text-[#1b1c19]">
                  Mapped Contacts
                </h3>
                <span
                  data-testid="stakeholders-count"
                  className="px-2 py-0.5 text-xs font-medium bg-[#eae8e3] text-[#4e453d] rounded-full"
                >
                  {data.stakeholders.length}
                </span>
              </div>

              {/* Active Only Filter Toggle */}
              <label className="inline-flex items-center space-x-2 text-xs text-[#4e453d] cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="active-only-toggle"
                  checked={activeOnlyFilter}
                  onChange={handleActiveOnlyToggle}
                  className="w-3.5 h-3.5 text-[#59452b] rounded border-[#80756b] focus:ring-[#735c41]"
                />
                <span>Active contacts only</span>
              </label>
            </div>

            {/* Empty Stakeholders Message */}
            {data.stakeholders.length === 0 ? (
              <div
                data-testid="empty-stakeholders-message"
                className="p-8 text-center bg-[#f5f3ee] border border-dashed border-[#d1c4b9] rounded-md space-y-3"
              >
                <Users className="w-8 h-8 text-[#80756b] mx-auto" />
                <p className="text-xs font-medium text-[#4e453d]">
                  No stakeholders mapped for this deal yet.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddStakeholderOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[#59452b] hover:bg-[#735c41] rounded transition-colors"
                >
                  Map First Contact
                </button>
              </div>
            ) : (
              <div data-testid="stakeholders-list" className="space-y-3">
                {data.stakeholders.map((s: StakeholderResponse) => {
                  const influenceMeta = formatInfluenceLevel(s.influence_level);
                  return (
                    <div
                      key={s.id}
                      data-testid={`stakeholder-card-${s.id}`}
                      className={clsx(
                        'p-4 bg-white border rounded-md shadow-xs transition-all flex flex-col space-y-2',
                        s.is_active ? 'border-[#d1c4b9]/80' : 'border-amber-200 bg-amber-50/20 opacity-80'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4
                              data-testid={`stakeholder-name-${s.id}`}
                              className="font-medium text-sm text-[#1b1c19]"
                            >
                              {s.full_name}
                            </h4>

                            {!s.is_active && (
                              <StatusLabel
                                data-testid={`stakeholder-status-${s.id}`}
                                status="inactive"
                                label="Inactive in CRM"
                                variant="error"
                                className="text-[10px] py-0 px-1.5"
                              />
                            )}
                          </div>

                          <p
                            data-testid={`stakeholder-role-${s.id}`}
                            className="text-xs text-[#4e453d] font-mono mt-0.5"
                          >
                            {s.org_role}
                          </p>
                        </div>

                        {/* Influence Level Badge [FR-6] */}
                        <span
                          data-testid={`stakeholder-influence-${s.id}`}
                          className={clsx(
                            'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border',
                            influenceMeta.bgClass,
                            influenceMeta.textClass,
                            influenceMeta.borderClass
                          )}
                        >
                          {influenceMeta.label}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-[#4e453d]">
                        <div className="flex items-center space-x-1.5">
                          <Mail className="w-3.5 h-3.5 text-[#80756b]" />
                          <span data-testid={`stakeholder-email-${s.id}`}>{s.email}</span>
                        </div>

                        <span className="text-[11px] text-[#80756b]">
                          Added {formatActivityDate(s.created_on)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Chronological Activity Feed (FR-7) */}
          <div data-testid="activity-feed-section" className="lg:col-span-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-[#d1c4b9]/40 gap-2">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-[#59452b]" />
                <h3 className="font-serif text-base font-normal text-[#1b1c19]">
                  Recent Activity Feed
                </h3>
                <span className="px-2 py-0.5 text-xs font-medium bg-[#eae8e3] text-[#4e453d] rounded-full">
                  {filteredActivities.length}
                </span>
              </div>

              {/* Activity Type Filters */}
              <div className="flex items-center space-x-1 bg-[#f0eee9] p-0.5 rounded border border-[#d1c4b9]/50 text-xs">
                {['ALL', 'Email', 'Meeting', 'Call', 'Note'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    data-testid={`activity-filter-${type.toLowerCase()}`}
                    onClick={() => setSelectedActivityFilter(type)}
                    className={clsx(
                      'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                      selectedActivityFilter.toUpperCase() === type.toUpperCase()
                        ? 'bg-white text-[#59452b] shadow-xs font-semibold'
                        : 'text-[#4e453d] hover:text-[#1b1c19]'
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Empty Activity Feed Message */}
            {filteredActivities.length === 0 ? (
              <div
                data-testid="empty-activities-message"
                className="p-8 text-center bg-[#f5f3ee] border border-dashed border-[#d1c4b9] rounded-md space-y-3"
              >
                <Activity className="w-8 h-8 text-[#80756b] mx-auto" />
                <p className="text-xs font-medium text-[#4e453d]">
                  No recent CRM interaction activity recorded.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddActivityOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium text-[#1b1c19] bg-[#e4e2dd] hover:bg-[#dbdad5] border border-[#80756b]/40 rounded transition-colors"
                >
                  Log First Activity
                </button>
              </div>
            ) : (
              <div data-testid="activity-feed-list" className="space-y-3 relative">
                {/* Timeline vertical connector line */}
                <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-[#d1c4b9]/50 pointer-events-none" />

                {filteredActivities.map((act: StakeholderActivityResponse) => {
                  const meta = getActivityTypeMeta(act.activity_type);
                  const Icon = meta.icon;
                  const stakeholderName =
                    act.stakeholder_name ||
                    stakeholderNameMap.get(act.stakeholder_id) ||
                    'Stakeholder';

                  return (
                    <div
                      key={act.id}
                      data-testid={`activity-item-${act.id}`}
                      className="relative pl-9 pr-4 py-3 bg-white border border-[#d1c4b9]/80 rounded-md shadow-xs space-y-1.5"
                    >
                      {/* Timeline Dot Icon */}
                      <div
                        className={clsx(
                          'absolute left-2.5 top-3.5 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center border border-white shadow-xs',
                          meta.bgClass,
                          meta.textClass
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span
                            data-testid={`activity-type-${act.id}`}
                            className={clsx(
                              'px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider',
                              meta.bgClass,
                              meta.textClass
                            )}
                          >
                            {meta.label}
                          </span>
                          <span
                            data-testid={`activity-stakeholder-${act.id}`}
                            className="text-xs font-medium text-[#1b1c19]"
                          >
                            {stakeholderName}
                          </span>
                        </div>

                        <span
                          data-testid={`activity-date-${act.id}`}
                          className="text-[11px] text-[#80756b]"
                        >
                          {formatActivityDate(act.occurred_on || act.created_on)}
                        </span>
                      </div>

                      <p
                        data-testid={`activity-summary-${act.id}`}
                        className="text-xs text-[#4e453d] whitespace-pre-wrap leading-relaxed"
                      >
                        {act.summary}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Stakeholder Modal / Form [FR-6] */}
      {isAddStakeholderOpen && (
        <div
          data-testid="add-stakeholder-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-white border border-[#d1c4b9] rounded-lg shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#d1c4b9]/50">
              <h3 className="font-serif text-lg font-normal text-[#1b1c19]">
                Map Deal Stakeholder
              </h3>
              <button
                type="button"
                data-testid="cancel-stakeholder-button"
                onClick={() => setIsAddStakeholderOpen(false)}
                className="text-[#80756b] hover:text-[#1b1c19]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {stakeholderFormError && (
              <div className="p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded">
                {stakeholderFormError}
              </div>
            )}

            <form
              data-testid="add-stakeholder-form"
              onSubmit={handleCreateStakeholder}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-[#4e453d] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  data-testid="stakeholder-name-input"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-3 py-2 text-xs border border-[#d1c4b9] rounded focus:outline-none focus:border-[#735c41]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4e453d] mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  data-testid="stakeholder-email-input"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. jane.doe@acme.com"
                  className="w-full px-3 py-2 text-xs border border-[#d1c4b9] rounded focus:outline-none focus:border-[#735c41]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4e453d] mb-1">
                  Organizational Role *
                </label>
                <input
                  type="text"
                  data-testid="stakeholder-role-input"
                  required
                  value={newOrgRole}
                  onChange={(e) => setNewOrgRole(e.target.value)}
                  placeholder="e.g. VP of Procurement"
                  className="w-full px-3 py-2 text-xs border border-[#d1c4b9] rounded focus:outline-none focus:border-[#735c41]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4e453d] mb-1">
                  Influence Level
                </label>
                <select
                  data-testid="stakeholder-influence-select"
                  value={newInfluenceLevel}
                  onChange={(e) => setNewInfluenceLevel(e.target.value as InfluenceLevel)}
                  className="w-full px-3 py-2 text-xs border border-[#d1c4b9] rounded focus:outline-none focus:border-[#735c41]"
                >
                  <option value="High">High Influence</option>
                  <option value="Medium">Medium Influence</option>
                  <option value="Low">Low Influence</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddStakeholderOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#4e453d] hover:bg-[#f0eee9] border border-[#d1c4b9] rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-stakeholder-button"
                  disabled={submittingStakeholder}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#59452b] hover:bg-[#735c41] rounded transition-colors disabled:opacity-50"
                >
                  {submittingStakeholder ? 'Saving...' : 'Save Stakeholder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Activity Modal / Form [FR-7] */}
      {isAddActivityOpen && (
        <div
          data-testid="add-activity-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-white border border-[#d1c4b9] rounded-lg shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#d1c4b9]/50">
              <h3 className="font-serif text-lg font-normal text-[#1b1c19]">
                Log Interaction Activity
              </h3>
              <button
                type="button"
                data-testid="cancel-activity-button"
                onClick={() => setIsAddActivityOpen(false)}
                className="text-[#80756b] hover:text-[#1b1c19]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activityFormError && (
              <div className="p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded">
                {activityFormError}
              </div>
            )}

            <form
              data-testid="add-activity-form"
              onSubmit={handleCreateActivity}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-[#4e453d] mb-1">
                  Stakeholder *
                </label>
                <select
                  data-testid="activity-stakeholder-select"
                  required
                  value={newActivityStakeholderId}
                  onChange={(e) => setNewActivityStakeholderId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#d1c4b9] rounded focus:outline-none focus:border-[#735c41]"
                >
                  <option value="">-- Select Mapped Contact --</option>
                  {data?.stakeholders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.org_role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4e453d] mb-1">
                  Activity Type
                </label>
                <select
                  data-testid="activity-type-select"
                  value={newActivityType}
                  onChange={(e) => setNewActivityType(e.target.value as ActivityType)}
                  className="w-full px-3 py-2 text-xs border border-[#d1c4b9] rounded focus:outline-none focus:border-[#735c41]"
                >
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Call">Call</option>
                  <option value="Note">Note</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4e453d] mb-1">
                  Activity Summary *
                </label>
                <textarea
                  data-testid="activity-summary-input"
                  required
                  rows={3}
                  value={newActivitySummary}
                  onChange={(e) => setNewActivitySummary(e.target.value)}
                  placeholder="Details of interaction or meeting notes..."
                  className="w-full px-3 py-2 text-xs border border-[#d1c4b9] rounded focus:outline-none focus:border-[#735c41]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4e453d] mb-1">
                  Occurred On (Optional)
                </label>
                <input
                  type="datetime-local"
                  data-testid="activity-date-input"
                  value={newActivityOccurredOn}
                  onChange={(e) => setNewActivityOccurredOn(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#d1c4b9] rounded focus:outline-none focus:border-[#735c41]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddActivityOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#4e453d] hover:bg-[#f0eee9] border border-[#d1c4b9] rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-activity-button"
                  disabled={submittingActivity}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#59452b] hover:bg-[#735c41] rounded transition-colors disabled:opacity-50"
                >
                  {submittingActivity ? 'Saving...' : 'Log Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StakeholderMap;
