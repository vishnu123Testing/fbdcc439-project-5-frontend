'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Calendar as CalendarIcon,
  Clock,
  FileText,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  X,
  Filter,
  RotateCw,
  Download,
  AlertCircle,
  Search,
  ChevronRight,
  UserCheck,
  CheckCircle2,
  Edit3,
  CalendarDays,
  List,
  Grid,
  Info,
  Sparkles,
  ArrowRight,
  User,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import {
  getCalendarMeetings,
  updateMeetingNotes,
  MeetingCalendarResponse,
  CalendarQueryParams,
  MeetingNotesRequest,
  FollowupTaskCreate,
  FollowupTaskResponse,
} from '../../services/analytics';

export type DatePreset = '7d' | '30d' | '90d' | 'ytd' | 'custom' | 'all';
export type ViewMode = 'grid' | 'list';
export type TimeframeFilter = 'all' | 'upcoming' | 'past' | 'today';
export type TaskStatusFilter = 'all' | 'pending' | 'completed' | 'has_tasks' | 'no_tasks';

export interface CalendarFilterOptions {
  searchQuery?: string;
  leadId?: string;
  userId?: string;
  leadStatus?: string;
  timeframe?: TimeframeFilter;
  taskStatus?: TaskStatusFilter;
  datePreset?: DatePreset;
  start_date_val?: string;
  end_date_val?: string;
}

export interface MeetingCalendarSummary {
  totalMeetings: number;
  upcomingMeetings: number;
  pastMeetings: number;
  meetingsWithPrep: number;
  meetingsWithNotes: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
}

export interface MeetingCalendarProps {
  /**
   * Optional pre-fetched list of meeting calendar records
   */
  initialData?: MeetingCalendarResponse[] | null;
  /**
   * Optional initial calendar query parameters
   */
  initialParams?: CalendarQueryParams;
  /**
   * Optional loading state override from parent component
   */
  loading?: boolean;
  /**
   * Optional error message override from parent component
   */
  error?: string | null;
  /**
   * Callback fired when parameters change or user clicks refresh
   */
  onRefresh?: (params: CalendarQueryParams) => void;
  /**
   * Callback fired when user requests CSV or PDF export
   */
  onExport?: (format: 'csv' | 'pdf') => void;
  /**
   * Callback fired when a meeting card or row is selected
   */
  onMeetingSelect?: (meeting: MeetingCalendarResponse) => void;
  /**
   * Callback fired when meeting prep/notes/tasks are saved
   */
  onSaveNotes?: (meetingId: string, payload: MeetingNotesRequest) => Promise<MeetingCalendarResponse> | void;
  /**
   * Whether to automatically fetch data on mount if initialData is not provided
   */
  autoFetch?: boolean;
  /**
   * Additional CSS class name
   */
  className?: string;
}

/**
 * Standard Lead Status Stage options
 */
export const LEAD_STATUS_OPTIONS = [
  'New',
  'Contacted',
  'Qualified',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
] as const;

/**
 * Format ISO datetime string into human readable representation.
 */
export function formatDateTime(dateTimeStr?: string | null): string {
  if (!dateTimeStr) return 'N/A';
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'N/A';
  }
}

/**
 * Format ISO date string into short date string.
 */
export function formatDate(dateTimeStr?: string | null): string {
  if (!dateTimeStr) return 'N/A';
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

/**
 * Get date range preset bounds in ISO format.
 */
export function getDatePresetRange(preset: DatePreset): { start_date_val?: string; end_date_val?: string } {
  const now = new Date();
  if (preset === 'all') {
    return {};
  }

  const start = new Date(now);
  if (preset === '7d') {
    start.setDate(now.getDate() - 7);
  } else if (preset === '30d') {
    start.setDate(now.getDate() - 30);
  } else if (preset === '90d') {
    start.setDate(now.getDate() - 90);
  } else if (preset === 'ytd') {
    return {
      start_date_val: new Date(now.getFullYear(), 0, 1).toISOString(),
      end_date_val: now.toISOString(),
    };
  } else {
    return {};
  }

  return {
    start_date_val: start.toISOString(),
    end_date_val: now.toISOString(),
  };
}

/**
 * Calculate aggregate summary statistics for meeting calendar records.
 */
export function calculateCalendarSummary(meetings: MeetingCalendarResponse[]): MeetingCalendarSummary {
  if (!Array.isArray(meetings) || meetings.length === 0) {
    return {
      totalMeetings: 0,
      upcomingMeetings: 0,
      pastMeetings: 0,
      meetingsWithPrep: 0,
      meetingsWithNotes: 0,
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
    };
  }

  const now = new Date().getTime();

  let upcomingMeetings = 0;
  let pastMeetings = 0;
  let meetingsWithPrep = 0;
  let meetingsWithNotes = 0;
  let totalTasks = 0;
  let completedTasks = 0;
  let pendingTasks = 0;

  meetings.forEach((m) => {
    const scheduledTime = new Date(m.scheduled_time).getTime();
    if (!isNaN(scheduledTime)) {
      if (scheduledTime >= now) {
        upcomingMeetings += 1;
      } else {
        pastMeetings += 1;
      }
    }

    if (m.prep_notes && m.prep_notes.trim().length > 0) {
      meetingsWithPrep += 1;
    }

    if (m.meeting_notes && m.meeting_notes.trim().length > 0) {
      meetingsWithNotes += 1;
    }

    if (Array.isArray(m.followup_tasks)) {
      totalTasks += m.followup_tasks.length;
      m.followup_tasks.forEach((t) => {
        if (t.is_completed) {
          completedTasks += 1;
        } else {
          pendingTasks += 1;
        }
      });
    }
  });

  return {
    totalMeetings: meetings.length,
    upcomingMeetings,
    pastMeetings,
    meetingsWithPrep,
    meetingsWithNotes,
    totalTasks,
    completedTasks,
    pendingTasks,
  };
}

/**
 * Filter meeting records by search terms, date ranges, and status flags.
 */
export function filterMeetings(
  meetings: MeetingCalendarResponse[],
  filters: CalendarFilterOptions
): MeetingCalendarResponse[] {
  if (!Array.isArray(meetings)) return [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 86400000 - 1;

  return meetings.filter((m) => {
    // Search query filter
    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const q = filters.searchQuery.toLowerCase().trim();
      const leadMatch = m.lead_id?.toLowerCase().includes(q);
      const prepMatch = m.prep_notes?.toLowerCase().includes(q);
      const notesMatch = m.meeting_notes?.toLowerCase().includes(q);
      const statusMatch = m.lead_status?.toLowerCase().includes(q);
      const taskMatch = m.followup_tasks?.some(
        (t) =>
          t.task_description?.toLowerCase().includes(q) ||
          t.assigned_user_id?.toLowerCase().includes(q)
      );

      if (!leadMatch && !prepMatch && !notesMatch && !statusMatch && !taskMatch) {
        return false;
      }
    }

    // Lead ID filter
    if (filters.leadId && filters.leadId.trim() !== '') {
      if (m.lead_id?.toLowerCase() !== filters.leadId.toLowerCase().trim()) {
        return false;
      }
    }

    // Lead status filter
    if (filters.leadStatus && filters.leadStatus !== 'all' && filters.leadStatus.trim() !== '') {
      if (m.lead_status?.toLowerCase() !== filters.leadStatus.toLowerCase().trim()) {
        return false;
      }
    }

    // Timeframe filter
    const scheduledTime = new Date(m.scheduled_time).getTime();
    if (!isNaN(scheduledTime)) {
      if (filters.timeframe === 'upcoming' && scheduledTime < now.getTime()) {
        return false;
      }
      if (filters.timeframe === 'past' && scheduledTime >= now.getTime()) {
        return false;
      }
      if (filters.timeframe === 'today') {
        if (scheduledTime < startOfToday || scheduledTime > endOfToday) {
          return false;
        }
      }
    }

    // Task status filter
    if (filters.taskStatus && filters.taskStatus !== 'all') {
      const tasks = m.followup_tasks || [];
      if (filters.taskStatus === 'has_tasks' && tasks.length === 0) {
        return false;
      }
      if (filters.taskStatus === 'no_tasks' && tasks.length > 0) {
        return false;
      }
      if (filters.taskStatus === 'pending') {
        const hasPending = tasks.some((t) => !t.is_completed);
        if (!hasPending) return false;
      }
      if (filters.taskStatus === 'completed') {
        const hasCompleted = tasks.some((t) => t.is_completed);
        if (!hasCompleted) return false;
      }
    }

    // Custom date range filter
    if (filters.start_date_val) {
      const startDate = new Date(filters.start_date_val).getTime();
      if (!isNaN(startDate) && !isNaN(scheduledTime) && scheduledTime < startDate) {
        return false;
      }
    }
    if (filters.end_date_val) {
      const endDate = new Date(filters.end_date_val).getTime();
      if (!isNaN(endDate) && !isNaN(scheduledTime) && scheduledTime > endDate) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Validate task input payload before submission.
 */
export function validateTaskInput(task: FollowupTaskCreate): { isValid: boolean; error?: string } {
  if (!task.task_description || task.task_description.trim() === '') {
    return {
      isValid: false,
      error: 'Task description is required',
    };
  }
  return { isValid: true };
}

/**
 * Meeting Prep & Follow-Up Calendar Component [FR-009, FR-010]
 */
export const MeetingCalendar: React.FC<MeetingCalendarProps> = ({
  initialData,
  initialParams,
  loading: externalLoading,
  error: externalError,
  onRefresh,
  onExport,
  onMeetingSelect,
  onSaveNotes,
  autoFetch = true,
  className,
}) => {
  // Data and API states
  const [meetings, setMeetings] = useState<MeetingCalendarResponse[]>(initialData || []);
  const [loading, setLoading] = useState<boolean>(externalLoading || false);
  const [error, setError] = useState<string | null>(externalError || null);
  const [savingNotes, setSavingNotes] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Filters state
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all');
  const [taskStatus, setTaskStatus] = useState<TaskStatusFilter>('all');
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Selected meeting for Modal / Drawer note entry form [FR-010]
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingCalendarResponse | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState<boolean>(false);

  // Note entry form inputs state
  const [prepNotesInput, setPrepNotesInput] = useState<string>('');
  const [meetingNotesInput, setMeetingNotesInput] = useState<string>('');
  const [leadStatusInput, setLeadStatusInput] = useState<string>('');
  const [existingTasks, setExistingTasks] = useState<FollowupTaskResponse[]>([]);
  const [newTasks, setNewTasks] = useState<FollowupTaskCreate[]>([]);

  // Individual new task draft input
  const [newTaskDesc, setNewTaskDesc] = useState<string>('');
  const [newTaskUserId, setNewTaskUserId] = useState<string>('');
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>('');
  const [taskFormError, setTaskFormError] = useState<string | null>(null);

  // Sync external props
  useEffect(() => {
    if (initialData !== undefined && initialData !== null) {
      setMeetings(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    if (externalLoading !== undefined) {
      setLoading(externalLoading);
    }
  }, [externalLoading]);

  useEffect(() => {
    if (externalError !== undefined) {
      setError(externalError);
    }
  }, [externalError]);

  // Fetch data function
  const fetchData = useCallback(
    async (params?: CalendarQueryParams) => {
      setLoading(true);
      setError(null);
      try {
        const queryParams: CalendarQueryParams = {
          ...initialParams,
          ...params,
        };

        const range = getDatePresetRange(datePreset);
        if (range.start_date_val) queryParams.start_date_val = range.start_date_val;
        if (range.end_date_val) queryParams.end_date_val = range.end_date_val;

        const data = await getCalendarMeetings(queryParams);
        setMeetings(data);
        if (onRefresh) {
          onRefresh(queryParams);
        }
      } catch (err: any) {
        const msg = err?.message || 'Failed to fetch calendar meetings';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [initialParams, datePreset, onRefresh]
  );

  // Initial fetch on mount if autoFetch is enabled and no initialData provided
  useEffect(() => {
    if (autoFetch && (!initialData || initialData.length === 0)) {
      fetchData();
    }
  }, [autoFetch, fetchData, initialData]);

  // Handle refresh click
  const handleRefreshClick = () => {
    fetchData();
  };

  // Filter meetings using current options
  const filterOptions = useMemo<CalendarFilterOptions>(() => {
    const range = getDatePresetRange(datePreset);
    return {
      searchQuery,
      leadStatus: leadStatusFilter,
      timeframe,
      taskStatus,
      datePreset,
      start_date_val: range.start_date_val,
      end_date_val: range.end_date_val,
    };
  }, [searchQuery, leadStatusFilter, timeframe, taskStatus, datePreset]);

  const filteredMeetings = useMemo(() => {
    return filterMeetings(meetings, filterOptions);
  }, [meetings, filterOptions]);

  // Summary calculations
  const summary = useMemo(() => {
    return calculateCalendarSummary(filteredMeetings);
  }, [filteredMeetings]);

  // Handle open meeting for prep & note logging modal
  const handleOpenMeetingModal = (meeting: MeetingCalendarResponse) => {
    setSelectedMeeting(meeting);
    setPrepNotesInput(meeting.prep_notes || '');
    setMeetingNotesInput(meeting.meeting_notes || '');
    setLeadStatusInput(meeting.lead_status || 'New');
    setExistingTasks(meeting.followup_tasks || []);
    setNewTasks([]);
    setNewTaskDesc('');
    setNewTaskUserId('');
    setNewTaskDueDate('');
    setTaskFormError(null);
    setSaveSuccessMessage(null);
    setIsNoteModalOpen(true);

    if (onMeetingSelect) {
      onMeetingSelect(meeting);
    }
  };

  const handleCloseNoteModal = () => {
    setIsNoteModalOpen(false);
    setSelectedMeeting(null);
    setTaskFormError(null);
  };

  // Add draft task to newTasks staging list [FR-010]
  const handleAddTaskDraft = () => {
    setTaskFormError(null);
    const draftTask: FollowupTaskCreate = {
      task_description: newTaskDesc,
      assigned_user_id: newTaskUserId.trim() !== '' ? newTaskUserId.trim() : null,
      due_date_val: newTaskDueDate.trim() !== '' ? new Date(newTaskDueDate).toISOString() : null,
      is_completed: false,
    };

    const validation = validateTaskInput(draftTask);
    if (!validation.isValid) {
      setTaskFormError(validation.error || 'Invalid task input');
      return;
    }

    setNewTasks((prev) => [...prev, draftTask]);
    setNewTaskDesc('');
    setNewTaskUserId('');
    setNewTaskDueDate('');
  };

  // Remove draft task from staging list
  const handleRemoveDraftTask = (index: number) => {
    setNewTasks((prev) => prev.filter((_, i) => i !== index));
  };

  // Save notes & tasks form submission [FR-010]
  const handleSaveMeetingNotes = async () => {
    if (!selectedMeeting) return;

    setSavingNotes(true);
    setTaskFormError(null);
    setSaveSuccessMessage(null);

    const payload: MeetingNotesRequest = {
      prep_notes: prepNotesInput.trim() !== '' ? prepNotesInput : null,
      meeting_notes: meetingNotesInput.trim() !== '' ? meetingNotesInput : null,
      lead_status: leadStatusInput || null,
      tasks: newTasks.length > 0 ? newTasks : null,
    };

    try {
      let updatedMeeting: MeetingCalendarResponse | void;

      if (onSaveNotes) {
        updatedMeeting = await onSaveNotes(selectedMeeting.id, payload);
      } else {
        updatedMeeting = await updateMeetingNotes(selectedMeeting.id, payload);
      }

      if (updatedMeeting) {
        // Update local meetings list with response
        setMeetings((prev) =>
          prev.map((m) => (m.id === updatedMeeting.id ? updatedMeeting : m))
        );
        setSelectedMeeting(updatedMeeting);
        setExistingTasks(updatedMeeting.followup_tasks || []);
        setNewTasks([]);
      } else {
        // Optimistic refresh if no returned meeting object
        fetchData();
      }

      setSaveSuccessMessage('Meeting notes and follow-up tasks saved successfully!');
      setTimeout(() => {
        setSaveSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      const msg = err?.message || 'Failed to save meeting notes and tasks';
      setTaskFormError(msg);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div
      className={twMerge(
        'w-full bg-[#fbf9f4] text-[#1b1c19] p-6 rounded-lg border border-[#d1c4b9]/50 shadow-sm space-y-6',
        className
      )}
      data-testid="meeting-calendar-container"
    >
      {/* Component Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#d1c4b9]/40">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-[#59452b]" />
            <h2 className="text-2xl font-serif font-normal text-[#1b1c19]">
              Meeting Prep & Follow-Up Calendar
            </h2>
          </div>
          <p className="text-sm text-[#4e453d] mt-1">
            Track upcoming lead meetings, review prep briefings, log post-meeting notes, and assign follow-up tasks [FR-009, FR-010].
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {onExport && (
            <div className="flex items-center gap-1 bg-[#f5f3ee] p-1 rounded border border-[#d1c4b9]">
              <button
                type="button"
                onClick={() => onExport('csv')}
                className="px-2.5 py-1 text-xs font-medium text-[#4e453d] hover:text-[#1b1c19] hover:bg-[#eae8e3] rounded transition-colors flex items-center gap-1"
                title="Export Calendar Meetings to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                type="button"
                onClick={() => onExport('pdf')}
                className="px-2.5 py-1 text-xs font-medium text-[#4e453d] hover:text-[#1b1c19] hover:bg-[#eae8e3] rounded transition-colors flex items-center gap-1"
                title="Export Calendar Meetings to PDF"
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium bg-[#f0eee9] hover:bg-[#eae8e3] text-[#1b1c19] border border-[#d1c4b9] rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Refresh Meeting Calendar Data"
          >
            <RotateCw className={clsx('w-3.5 h-3.5 text-[#59452b]', loading && 'animate-spin')} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div
          className="p-4 bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]/30 rounded-md flex items-start justify-between gap-3"
          role="alert"
          data-testid="calendar-error-banner"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-[#ba1a1a] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Calendar Data Error</p>
              <p className="text-xs text-[#93000a] mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefreshClick}
            className="px-2.5 py-1 text-xs font-medium bg-[#ba1a1a] text-white rounded hover:bg-[#93000a] transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary KPI Cards Overview [FR-009] */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#f5f3ee] p-4 rounded-md border border-[#d1c4b9]/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#4e453d] uppercase tracking-wider">Total Meetings</p>
            <p className="text-2xl font-semibold text-[#1b1c19] mt-1" data-testid="summary-total-meetings">
              {summary.totalMeetings}
            </p>
            <p className="text-xs text-[#80756b] mt-0.5">
              {summary.upcomingMeetings} upcoming • {summary.pastMeetings} past
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#f0eee9] border border-[#d1c4b9] flex items-center justify-center text-[#59452b]">
            <CalendarIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#f5f3ee] p-4 rounded-md border border-[#d1c4b9]/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#4e453d] uppercase tracking-wider">Upcoming Briefings</p>
            <p className="text-2xl font-semibold text-[#1b1c19] mt-1" data-testid="summary-upcoming-meetings">
              {summary.upcomingMeetings}
            </p>
            <p className="text-xs text-[#80756b] mt-0.5">
              {summary.meetingsWithPrep} with prep notes
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#f0eee9] border border-[#d1c4b9] flex items-center justify-center text-[#374a5f]">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#f5f3ee] p-4 rounded-md border border-[#d1c4b9]/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#4e453d] uppercase tracking-wider">Logged Notes</p>
            <p className="text-2xl font-semibold text-[#1b1c19] mt-1" data-testid="summary-[#meetings-with-notes]">
              {summary.meetingsWithNotes}
            </p>
            <p className="text-xs text-[#80756b] mt-0.5">
              {summary.totalMeetings - summary.meetingsWithNotes} pending notes
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#f0eee9] border border-[#d1c4b9] flex items-center justify-center text-[#59452b]">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#f5f3ee] p-4 rounded-md border border-[#d1c4b9]/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#4e453d] uppercase tracking-wider">Follow-Up Tasks</p>
            <p className="text-2xl font-semibold text-[#1b1c19] mt-1" data-testid="summary-total-tasks">
              {summary.pendingTasks}
            </p>
            <p className="text-xs text-[#80756b] mt-0.5">
              {summary.completedTasks} completed / {summary.totalTasks} total
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#f0eee9] border border-[#d1c4b9] flex items-center justify-center text-[#a43b2c]">
            <CheckSquare className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and View Controls Bar */}
      <div className="bg-[#f0eee9] p-3.5 rounded-md border border-[#d1c4b9]/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-grow">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-grow md:flex-grow-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#80756b]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search meetings or tasks..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#d1c4b9] rounded focus:outline-none focus:border-[#59452b] text-[#1b1c19]"
              data-testid="calendar-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#80756b] hover:text-[#1b1c19]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Timeframe Filter */}
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as TimeframeFilter)}
            className="py-1.5 px-2.5 text-xs bg-white border border-[#d1c4b9] rounded focus:outline-none focus:border-[#59452b] text-[#1b1c19]"
            data-testid="timeframe-select"
          >
            <option value="all">All Schedule Timeframes</option>
            <option value="upcoming">Upcoming Meetings</option>
            <option value="past">Past Meetings</option>
            <option value="today">Scheduled Today</option>
          </select>

          {/* Lead Status Filter */}
          <select
            value={leadStatusFilter}
            onChange={(e) => setLeadStatusFilter(e.target.value)}
            className="py-1.5 px-2.5 text-xs bg-white border border-[#d1c4b9] rounded focus:outline-none focus:border-[#59452b] text-[#1b1c19]"
            data-testid="lead-status-filter"
          >
            <option value="all">All Lead Stages</option>
            {LEAD_STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* Task Status Filter */}
          <select
            value={taskStatus}
            onChange={(e) => setTaskStatus(e.target.value as TaskStatusFilter)}
            className="py-1.5 px-2.5 text-xs bg-white border border-[#d1c4b9] rounded focus:outline-none focus:border-[#59452b] text-[#1b1c19]"
            data-testid="task-status-select"
          >
            <option value="all">All Task States</option>
            <option value="pending">With Pending Tasks</option>
            <option value="completed">With Completed Tasks</option>
            <option value="has_tasks">With Any Tasks</option>
            <option value="no_tasks">No Tasks Linked</option>
          </select>

          {/* Date Preset Selector */}
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            className="py-1.5 px-2.5 text-xs bg-white border border-[#d1c4b9] rounded focus:outline-none focus:border-[#59452b] text-[#1b1c19]"
            data-testid="date-preset-select"
          >
            <option value="all">All Dates</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="ytd">Year To Date</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-white p-1 rounded border border-[#d1c4b9]">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={clsx(
              'p-1 rounded text-xs transition-colors',
              viewMode === 'grid'
                ? 'bg-[#59452b] text-white'
                : 'text-[#4e453d] hover:bg-[#f0eee9]'
            )}
            title="Grid View"
            data-testid="view-grid-btn"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={clsx(
              'p-1 rounded text-xs transition-colors',
              viewMode === 'list'
                ? 'bg-[#59452b] text-white'
                : 'text-[#4e453d] hover:bg-[#f0eee9]'
            )}
            title="List View"
            data-testid="view-list-btn"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Loading Skeleton Indicator */}
      {loading && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3" data-testid="calendar-loading-skeleton">
          <RotateCw className="w-8 h-8 text-[#59452b] animate-spin" />
          <p className="text-xs font-medium text-[#80756b]">Loading meeting calendar entries...</p>
        </div>
      )}

      {/* Empty State when no meetings match filters */}
      {!loading && filteredMeetings.length === 0 && (
        <div className="py-12 bg-[#f5f3ee] border border-dashed border-[#d1c4b9] rounded-md text-center p-6 space-y-3" data-testid="calendar-empty-state">
          <CalendarDays className="w-10 h-10 text-[#80756b] mx-auto opacity-60" />
          <p className="text-sm font-medium text-[#1b1c19]">No meeting calendar entries found</p>
          <p className="text-xs text-[#4e453d] max-w-md mx-auto">
            No meetings matched your current timeframe, stage, or search criteria. Try clearing search or resetting date filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setTimeframe('all');
              setTaskStatus('all');
              setLeadStatusFilter('all');
              setDatePreset('all');
            }}
            className="px-3 py-1.5 text-xs font-medium bg-[#59452b] text-white rounded hover:bg-[#735c41] transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Grid View Mode [FR-009] */}
      {!loading && filteredMeetings.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="calendar-grid-view">
          {filteredMeetings.map((meeting) => {
            const isPast = new Date(meeting.scheduled_time).getTime() < Date.now();
            const tasks = meeting.followup_tasks || [];
            const completedCount = tasks.filter((t) => t.is_completed).length;

            return (
              <div
                key={meeting.id}
                className="bg-white border border-[#d1c4b9] hover:border-[#59452b] rounded-md p-4 transition-all shadow-sm hover:shadow flex flex-col justify-between space-y-3"
                data-testid={`meeting-card-${meeting.id}`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#f0eee9]">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#59452b]" />
                        <span className="text-xs font-semibold text-[#1b1c19]">
                          Lead: {meeting.lead_id}
                        </span>
                      </div>
                      <p className="text-xs text-[#4e453d] mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#80756b]" />
                        {formatDateTime(meeting.scheduled_time)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={clsx(
                          'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                          isPast
                            ? 'bg-[#f0eee9] text-[#4e453d] border-[#d1c4b9]'
                            : 'bg-[#caddf8] text-[#071d30] border-[#374a5f]/30'
                        )}
                      >
                        {isPast ? 'Past' : 'Upcoming'}
                      </span>

                      {meeting.lead_status && (
                        <span className="text-[10px] font-semibold bg-[#f5d6b4] text-[#58432a] px-2 py-0.5 rounded border border-[#715a3f]/20">
                          {meeting.lead_status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Prep Briefing Section [FR-009] */}
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold text-[#4e453d] uppercase tracking-wider flex items-center gap-1">
                      <FileText className="w-3 h-3 text-[#374a5f]" />
                      Prep Briefing
                    </p>
                    <p className="text-xs text-[#1b1c19] mt-1 bg-[#f5f3ee] p-2 rounded border border-[#d1c4b9]/50 line-clamp-2">
                      {meeting.prep_notes && meeting.prep_notes.trim() !== ''
                        ? meeting.prep_notes
                        : 'No prep briefing notes recorded.'}
                    </p>
                  </div>

                  {/* Meeting Notes Section [FR-010] */}
                  <div className="mt-2.5">
                    <p className="text-[11px] font-semibold text-[#4e453d] uppercase tracking-wider flex items-center gap-1">
                      <Edit3 className="w-3 h-3 text-[#59452b]" />
                      Meeting Notes
                    </p>
                    <p className="text-xs text-[#1b1c19] mt-1 bg-[#fbf9f4] p-2 rounded border border-[#d1c4b9]/50 line-clamp-2 italic">
                      {meeting.meeting_notes && meeting.meeting_notes.trim() !== ''
                        ? meeting.meeting_notes
                        : 'No post-meeting summary logged.'}
                    </p>
                  </div>

                  {/* Follow-up Tasks Preview [FR-009, FR-010] */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-[#4e453d] mb-1">
                      <span className="font-semibold uppercase tracking-wider flex items-center gap-1">
                        <CheckSquare className="w-3 h-3 text-[#a43b2c]" />
                        Tasks ({tasks.length})
                      </span>
                      {tasks.length > 0 && (
                        <span className="text-[10px] text-[#80756b]">
                          {completedCount}/{tasks.length} Done
                        </span>
                      )}
                    </div>

                    {tasks.length > 0 ? (
                      <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                        {tasks.map((task) => (
                          <div
                            key={task.id}
                            className="text-xs p-1.5 rounded bg-[#f5f3ee] border border-[#d1c4b9]/40 flex items-start gap-1.5"
                          >
                            {task.is_completed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#2d5a3f] flex-shrink-0 mt-0.5" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-[#80756b] flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-grow min-w-0">
                              <p
                                className={clsx(
                                  'text-xs truncate',
                                  task.is_completed && 'line-through text-[#80756b]'
                                )}
                              >
                                {task.task_description}
                              </p>
                              {task.due_date_val && (
                                <p className="text-[10px] text-[#80756b]">
                                  Due: {formatDate(task.due_date_val)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#80756b] italic">No follow-up tasks linked.</p>
                    )}
                  </div>
                </div>

                {/* Card Action Button */}
                <div className="pt-3 border-t border-[#f0eee9]">
                  <button
                    type="button"
                    onClick={() => handleOpenMeetingModal(meeting)}
                    className="w-full py-1.5 px-3 bg-[#59452b] hover:bg-[#735c41] text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                    data-testid={`open-prep-modal-btn-${meeting.id}`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Prep Briefing & Log Notes</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View Mode [FR-009] */}
      {!loading && filteredMeetings.length > 0 && viewMode === 'list' && (
        <div className="bg-white border border-[#d1c4b9] rounded-md overflow-hidden shadow-sm" data-testid="calendar-list-view">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1b1c19]">
              <thead className="bg-[#f0eee9] text-[#4e453d] font-semibold border-b border-[#d1c4b9]">
                <tr>
                  <th className="py-2.5 px-3">Lead ID</th>
                  <th className="py-2.5 px-3">Scheduled Time</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Prep Briefing</th>
                  <th className="py-2.5 px-3">Logged Notes</th>
                  <th className="py-2.5 px-3">Tasks</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0eee9]">
                {filteredMeetings.map((meeting) => {
                  const isPast = new Date(meeting.scheduled_time).getTime() < Date.now();
                  const tasks = meeting.followup_tasks || [];
                  const completedCount = tasks.filter((t) => t.is_completed).length;

                  return (
                    <tr
                      key={meeting.id}
                      className="hover:bg-[#f5f3ee]/60 transition-colors"
                      data-testid={`meeting-row-${meeting.id}`}
                    >
                      <td className="py-3 px-3 font-semibold text-[#1b1c19]">
                        {meeting.lead_id}
                      </td>
                      <td className="py-3 px-3 text-[#4e453d]">
                        {formatDateTime(meeting.scheduled_time)}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block bg-[#f5d6b4] text-[#58432a] px-2 py-0.5 rounded text-[10px] font-semibold">
                          {meeting.lead_status || 'New'}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate text-[#1b1c19]">
                        {meeting.prep_notes || <span className="text-[#80756b] italic">None</span>}
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate text-[#1b1c19]">
                        {meeting.meeting_notes || <span className="text-[#80756b] italic">None</span>}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs text-[#4e453d]">
                          {tasks.length} task{tasks.length !== 1 ? 's' : ''} ({completedCount} done)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenMeetingModal(meeting)}
                          className="px-2.5 py-1 text-xs font-medium bg-[#59452b] text-white rounded hover:bg-[#735c41] transition-colors inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Notes</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Note Entry Form & Prep Briefing Modal / Drawer [FR-010] */}
      {isNoteModalOpen && selectedMeeting && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="note-modal-title"
          data-testid="meeting-note-modal"
        >
          <div className="bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-[#f0eee9] border-b border-[#d1c4b9] flex items-center justify-between">
              <div>
                <h3 id="note-modal-title" className="text-lg font-serif font-semibold text-[#1b1c19]">
                  Meeting Prep & Note Entry
                </h3>
                <p className="text-xs text-[#4e453d] mt-0.5">
                  Lead ID: <span className="font-medium text-[#1b1c19]">{selectedMeeting.lead_id}</span> • Scheduled:{' '}
                  <span>{formatDateTime(selectedMeeting.scheduled_time)}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseNoteModal}
                className="text-[#80756b] hover:text-[#1b1c19] p-1 rounded hover:bg-[#eae8e3]"
                aria-label="Close Note Entry Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form Controls */}
            <div className="p-5 overflow-y-auto space-y-5 flex-grow">
              {/* Save Success Alert */}
              {saveSuccessMessage && (
                <div
                  className="p-3 bg-[#d2e8d8] text-[#0f2e1a] border border-[#2d5a3f]/30 rounded text-xs flex items-center gap-2"
                  data-testid="save-success-alert"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#2d5a3f] flex-shrink-0" />
                  <span>{saveSuccessMessage}</span>
                </div>
              )}

              {/* Form Validation Error Alert */}
              {taskFormError && (
                <div
                  className="p-3 bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]/30 rounded text-xs flex items-center gap-2"
                  data-testid="task-form-error-alert"
                >
                  <AlertCircle className="w-4 h-4 text-[#ba1a1a] flex-shrink-0" />
                  <span>{taskFormError}</span>
                </div>
              )}

              {/* Lead Stage Transition Dropdown [FR-010] */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#4e453d] uppercase tracking-wider">
                  Lead Stage Status Transition
                </label>
                <select
                  value={leadStatusInput}
                  onChange={(e) => setLeadStatusInput(e.target.value)}
                  className="w-full p-2 text-xs bg-white border border-[#d1c4b9] rounded focus:outline-none focus:border-[#59452b] text-[#1b1c19]"
                  data-testid="lead-status-input"
                >
                  {LEAD_STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#80756b]">
                  Updating lead status triggers an event progression update on backend [FR-010].
                </p>
              </div>

              {/* Prep Briefing Notes Textarea [FR-009] */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#4e453d] uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-[#374a5f]" />
                  Pre-Meeting Prep Briefing / Agenda Notes
                </label>
                <textarea
                  value={prepNotesInput}
                  onChange={(e) => setPrepNotesInput(e.target.value)}
                  placeholder="Record pre-meeting background, strategic objectives, or target agenda items..."
                  rows={3}
                  className="w-full p-2.5 text-xs bg-white border border-[#d1c4b9] rounded focus:outline-none focus:border-[#59452b] text-[#1b1c19]"
                  data-testid="prep-notes-textarea"
                />
              </div>

              {/* Post-Meeting Summary Notes Textarea [FR-010] */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#4e453d] uppercase tracking-wider flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5 text-[#59452b]" />
                  Post-Meeting Summary & Outcome Notes
                </label>
                <textarea
                  value={meetingNotesInput}
                  onChange={(e) => setMeetingNotesInput(e.target.value)}
                  placeholder="Log post-meeting takeaways, key decisions, objections raised, and agreed next steps..."
                  rows={4}
                  className="w-full p-2.5 text-xs bg-white border border-[#d1c4b9] rounded focus:outline-none focus:border-[#59452b] text-[#1b1c19]"
                  data-testid="meeting-notes-textarea"
                />
              </div>

              {/* Task Creation & Controls Section [FR-010] */}
              <div className="p-3.5 bg-[#f5f3ee] border border-[#d1c4b9] rounded-md space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[#1b1c19] uppercase tracking-wider flex items-center gap-1">
                    <CheckSquare className="w-3.5 h-3.5 text-[#a43b2c]" />
                    Follow-Up Task Assignment Controls [FR-010]
                  </h4>
                  <span className="text-[11px] text-[#80756b]">
                    {existingTasks.length + newTasks.length} task(s)
                  </span>
                </div>

                {/* Existing Linked Tasks List */}
                {existingTasks.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-[#4e453d]">Existing Follow-Up Tasks:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {existingTasks.map((t) => (
                        <div
                          key={t.id}
                          className="p-2 text-xs bg-white border border-[#d1c4b9]/60 rounded flex items-start justify-between gap-2"
                        >
                          <div className="flex items-start gap-1.5">
                            {t.is_completed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#2d5a3f] mt-0.5" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-[#80756b] mt-0.5" />
                            )}
                            <div>
                              <p className={clsx('font-medium', t.is_completed && 'line-through text-[#80756b]')}>
                                {t.task_description}
                              </p>
                              <p className="text-[10px] text-[#80756b]">
                                Assigned to: {t.assigned_user_id || 'Unassigned'} • Due:{' '}
                                {formatDate(t.due_date_val)}
                              </p>
                            </div>
                          </div>
                          <span
                            className={clsx(
                              'text-[10px] px-1.5 py-0.5 rounded font-medium',
                              t.is_completed ? 'bg-[#d2e8d8] text-[#0f2e1a]' : 'bg-[#f5d6b4] text-[#58432a]'
                            )}
                          >
                            {t.is_completed ? 'Completed' : 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Draft Tasks Staging List */}
                {newTasks.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-[#59452b]">New Tasks to Create on Save:</p>
                    <div className="space-y-1">
                      {newTasks.map((t, idx) => (
                        <div
                          key={idx}
                          className="p-2 text-xs bg-white border border-[#59452b]/40 rounded flex items-center justify-between gap-2"
                          data-testid={`new-task-item-${idx}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5 text-[#59452b]" />
                            <div>
                              <p className="font-medium text-[#1b1c19]">{t.task_description}</p>
                              <p className="text-[10px] text-[#80756b]">
                                User: {t.assigned_user_id || 'Unassigned'} • Due:{' '}
                                {t.due_date_val ? formatDate(t.due_date_val) : 'None'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftTask(idx)}
                            className="text-[#a43b2c] hover:text-[#ba1a1a] p-1"
                            title="Remove Task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Task Entry Controls */}
                <div className="p-2.5 bg-white border border-[#d1c4b9] rounded space-y-2">
                  <p className="text-[11px] font-semibold text-[#1b1c19]">Add New Follow-Up Task</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={newTaskDesc}
                        onChange={(e) => setNewTaskDesc(e.target.value)}
                        placeholder="Task description (required)..."
                        className="w-full p-1.5 text-xs bg-[#fbf9f4] border border-[#d1c4b9] rounded focus:outline-none focus:border-[#59452b] text-[#1b1c19]"
                        data-testid="new-task-desc-input"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={newTaskUserId}
                        onChange={(e) => setNewTaskUserId(e.target.value)}
                        placeholder="Assigned User ID (optional)..."
                        className="w-full p-1.5 text-xs bg-[#fbf9f4] border border-[#d1c4b9] rounded focus:outline-none focus:border-[#59452b] text-[#1b1c19]"
                        data-testid="new-task-user-input"
                      />
                    </div>
                    <div>
                      <input
                        type="date"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        className="w-full p-1.5 text-xs bg-[#fbf9f4] border border-[#d1c4b9] rounded focus:outline-none focus:border-[#59452b] text-[#1b1c19]"
                        data-testid="new-task-due-date-input"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddTaskDraft}
                    className="mt-1 px-3 py-1 text-xs font-medium bg-[#f0eee9] hover:bg-[#eae8e3] text-[#1b1c19] border border-[#d1c4b9] rounded transition-colors flex items-center gap-1"
                    data-testid="add-task-btn"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#59452b]" />
                    <span>Add Task to List</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#f0eee9] border-t border-[#d1c4b9] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseNoteModal}
                className="px-3.5 py-1.5 text-xs font-medium text-[#4e453d] hover:text-[#1b1c19] bg-white border border-[#d1c4b9] rounded hover:bg-[#eae8e3] transition-colors"
                data-testid="cancel-modal-btn"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveMeetingNotes}
                disabled={savingNotes}
                className="px-4 py-1.5 text-xs font-medium text-white bg-[#59452b] hover:bg-[#735c41] rounded transition-colors flex items-center gap-1.5 disabled:opacity-50"
                data-testid="save-notes-btn"
              >
                {savingNotes ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save Meeting Notes & Tasks</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingCalendar;
