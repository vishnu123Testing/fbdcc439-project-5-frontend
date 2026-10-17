import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  MeetingCalendar,
  formatDateTime,
  formatDate,
  getDatePresetRange,
  calculateCalendarSummary,
  filterMeetings,
  validateTaskInput,
} from '../../../src/components/analytics/MeetingCalendar';
import * as analyticsService from '../../../src/services/analytics';
import { MeetingCalendarResponse } from '../../../src/services/analytics';

describe('MeetingCalendar Component [FR-009, FR-010]', () => {
  const futureDate = new Date(Date.now() + 86400000 * 2).toISOString(); // 2 days in future
  const pastDate = new Date(Date.now() - 86400000 * 2).toISOString(); // 2 days in past

  const mockMeetings: MeetingCalendarResponse[] = [
    {
      id: 'meeting-1',
      lead_id: 'lead-101',
      scheduled_time: futureDate,
      prep_notes: 'Discuss Q4 enterprise pricing and SLAs',
      meeting_notes: null,
      created_on: '2025-10-01T10:00:00Z',
      lead_status: 'Qualified',
      followup_tasks: [
        {
          id: 'task-1',
          meeting_id: 'meeting-1',
          lead_id: 'lead-101',
          assigned_user_id: 'user-sales-1',
          due_date_val: futureDate,
          is_completed: false,
          task_description: 'Send custom MSA proposal draft',
          created_on: '2025-10-01T10:05:00Z',
        },
      ],
    },
    {
      id: 'meeting-2',
      lead_id: 'lead-102',
      scheduled_time: pastDate,
      prep_notes: 'Review technical architecture requirements',
      meeting_notes: 'Client confirmed budget and technical stack choice.',
      created_on: '2025-09-20T14:00:00Z',
      lead_status: 'Proposal',
      followup_tasks: [
        {
          id: 'task-2',
          meeting_id: 'meeting-2',
          lead_id: 'lead-102',
          assigned_user_id: 'user-se-1',
          due_date_val: pastDate,
          is_completed: true,
          task_description: 'Deliver security audit compliance whitepaper',
          created_on: '2025-09-20T14:30:00Z',
        },
      ],
    },
    {
      id: 'meeting-3',
      lead_id: 'lead-103',
      scheduled_time: futureDate,
      prep_notes: null,
      meeting_notes: null,
      created_on: '2025-10-05T09:00:00Z',
      lead_status: 'New',
      followup_tasks: [],
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Helper Functions [FR-009, FR-010]', () => {
    it('formatDateTime formats ISO date strings accurately or handles invalid strings', () => {
      const formatted = formatDateTime('2025-10-15T14:30:00Z');
      expect(formatted).not.toBe('N/A');
      expect(formatDateTime(null)).toBe('N/A');
      expect(formatDateTime(undefined)).toBe('N/A');
      expect(formatDateTime('invalid-date')).toBe('N/A');
    });

    it('formatDate formats short date strings', () => {
      const formatted = formatDate('2025-10-15T14:30:00Z');
      expect(formatted).not.toBe('N/A');
      expect(formatDate(null)).toBe('N/A');
      expect(formatDate(undefined)).toBe('N/A');
      expect(formatDate('invalid-date')).toBe('N/A');
    });

    it('getDatePresetRange generates valid ISO date bounds', () => {
      const preset7d = getDatePresetRange('7d');
      expect(preset7d.start_date_val).toBeDefined();
      expect(preset7d.end_date_val).toBeDefined();

      const presetAll = getDatePresetRange('all');
      expect(presetAll.start_date_val).toBeUndefined();
      expect(presetAll.end_date_val).toBeUndefined();
    });

    it('calculateCalendarSummary calculates aggregate metrics correctly', () => {
      const summary = calculateCalendarSummary(mockMeetings);
      expect(summary.totalMeetings).toBe(3);
      expect(summary.upcomingMeetings).toBe(2);
      expect(summary.pastMeetings).toBe(1);
      expect(summary.meetingsWithPrep).toBe(2);
      expect(summary.meetingsWithNotes).toBe(1);
      expect(summary.totalTasks).toBe(2);
      expect(summary.completedTasks).toBe(1);
      expect(summary.pendingTasks).toBe(1);
    });

    it('filterMeetings filters by search query, lead status, timeframe, and tasks', () => {
      // Search query filter
      const searchLead = filterMeetings(mockMeetings, { searchQuery: 'lead-101' });
      expect(searchLead).toHaveLength(1);
      expect(searchLead[0].id).toBe('meeting-1');

      // Search notes text
      const searchNotes = filterMeetings(mockMeetings, { searchQuery: 'confirmed budget' });
      expect(searchNotes).toHaveLength(1);
      expect(searchNotes[0].id).toBe('meeting-2');

      // Lead status filter
      const statusFilter = filterMeetings(mockMeetings, { leadStatus: 'Proposal' });
      expect(statusFilter).toHaveLength(1);
      expect(statusFilter[0].id).toBe('meeting-2');

      // Timeframe filter
      const upcomingFilter = filterMeetings(mockMeetings, { timeframe: 'upcoming' });
      expect(upcomingFilter).toHaveLength(2);

      const pastFilter = filterMeetings(mockMeetings, { timeframe: 'past' });
      expect(pastFilter).toHaveLength(1);

      // Task status filter
      const pendingTaskFilter = filterMeetings(mockMeetings, { taskStatus: 'pending' });
      expect(pendingTaskFilter).toHaveLength(1);
      expect(pendingTaskFilter[0].id).toBe('meeting-1');
    });

    it('validateTaskInput validates task description', () => {
      const valid = validateTaskInput({ task_description: 'Prepare demo deck' });
      expect(valid.isValid).toBe(true);

      const invalid = validateTaskInput({ task_description: '   ' });
      expect(invalid.isValid).toBe(false);
      expect(invalid.error).toBe('Task description is required');
    });
  });

  describe('Component Rendering & View Modes [FR-009]', () => {
    it('renders meeting calendar with pre-fetched initialData', () => {
      render(<MeetingCalendar initialData={mockMeetings} autoFetch={false} />);

      expect(screen.getByText('Meeting Prep & Follow-Up Calendar')).toBeInTheDocument();
      expect(screen.getByTestId('summary-total-meetings')).toHaveTextContent('3');
      expect(screen.getByTestId('summary-upcoming-meetings')).toHaveTextContent('2');

      // Check card display for lead-101
      expect(screen.getByText('Lead: lead-101')).toBeInTheDocument();
      expect(screen.getByText('Discuss Q4 enterprise pricing and SLAs')).toBeInTheDocument();
      expect(screen.getByText('Send custom MSA proposal draft')).toBeInTheDocument();
    });

    it('toggles between Grid and List view modes [FR-009]', () => {
      render(<MeetingCalendar initialData={mockMeetings} autoFetch={false} />);

      expect(screen.getByTestId('calendar-grid-view')).toBeInTheDocument();

      const listBtn = screen.getByTestId('view-list-btn');
      fireEvent.click(listBtn);

      expect(screen.getByTestId('calendar-list-view')).toBeInTheDocument();
      expect(screen.getByText('lead-101')).toBeInTheDocument();
      expect(screen.getByText('lead-102')).toBeInTheDocument();

      const gridBtn = screen.getByTestId('view-grid-btn');
      fireEvent.click(gridBtn);

      expect(screen.getByTestId('calendar-grid-view')).toBeInTheDocument();
    });

    it('filters meetings interactively via search and filters', () => {
      render(<MeetingCalendar initialData={mockMeetings} autoFetch={false} />);

      const searchInput = screen.getByTestId('calendar-search-input');
      fireEvent.change(searchInput, { target: { value: 'lead-102' } });

      expect(screen.getByText('Lead: lead-102')).toBeInTheDocument();
      expect(screen.queryByText('Lead: lead-101')).not.toBeInTheDocument();

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(screen.getByText('Lead: lead-101')).toBeInTheDocument();
    });

    it('shows empty state when filters match no meetings', () => {
      render(<MeetingCalendar initialData={mockMeetings} autoFetch={false} />);

      const searchInput = screen.getByTestId('calendar-search-input');
      fireEvent.change(searchInput, { target: { value: 'non-existent-lead' } });

      expect(screen.getByTestId('calendar-empty-state')).toBeInTheDocument();
      expect(screen.getByText('No meeting calendar entries found')).toBeInTheDocument();

      // Click clear filters button
      const clearBtn = screen.getByRole('button', { name: /Clear All Filters/i });
      fireEvent.click(clearBtn);

      expect(screen.getByText('Lead: lead-101')).toBeInTheDocument();
    });
  });

  describe('Meeting Note Entry & Task Creation Modal [FR-010]', () => {
    it('opens note entry modal on clicking card button', () => {
      render(<MeetingCalendar initialData={mockMeetings} autoFetch={false} />);

      const openBtn = screen.getByTestId('open-prep-modal-btn-meeting-1');
      fireEvent.click(openBtn);

      expect(screen.getByTestId('meeting-note-modal')).toBeInTheDocument();
      expect(screen.getByText('Meeting Prep & Note Entry')).toBeInTheDocument();
      expect(screen.getByTestId('prep-notes-textarea')).toHaveValue('Discuss Q4 enterprise pricing and SLAs');
    });

    it('adds new follow-up tasks in modal and submits updated notes and tasks [FR-010]', async () => {
      const mockUpdateNotes = vi.spyOn(analyticsService, 'updateMeetingNotes').mockResolvedValue({
        id: 'meeting-1',
        lead_id: 'lead-101',
        scheduled_time: futureDate,
        prep_notes: 'Updated prep briefing notes',
        meeting_notes: 'Client agreed to proceed with proposal.',
        created_on: '2025-10-01T10:00:00Z',
        lead_status: 'Proposal',
        followup_tasks: [
          {
            id: 'task-1',
            meeting_id: 'meeting-1',
            lead_id: 'lead-101',
            assigned_user_id: 'user-sales-1',
            due_date_val: futureDate,
            is_completed: false,
            task_description: 'Send custom MSA proposal draft',
            created_on: '2025-10-01T10:05:00Z',
          },
          {
            id: 'task-new-1',
            meeting_id: 'meeting-1',
            lead_id: 'lead-101',
            assigned_user_id: 'user-mgr-1',
            due_date_val: futureDate,
            is_completed: false,
            task_description: 'Schedule follow-up executive review meeting',
            created_on: '2025-10-06T12:00:00Z',
          },
        ],
      });

      render(<MeetingCalendar initialData={mockMeetings} autoFetch={false} />);

      // Open modal for meeting-1
      const openBtn = screen.getByTestId('open-prep-modal-btn-meeting-1');
      fireEvent.click(openBtn);

      // Change lead status dropdown
      const statusSelect = screen.getByTestId('lead-status-input');
      fireEvent.change(statusSelect, { target: { value: 'Proposal' } });

      // Update meeting notes textarea
      const notesTextarea = screen.getByTestId('meeting-notes-textarea');
      fireEvent.change(notesTextarea, { target: { value: 'Client agreed to proceed with proposal.' } });

      // Add a new follow-up task
      const descInput = screen.getByTestId('new-task-desc-input');
      const userInput = screen.getByTestId('new-task-user-input');
      const dueDateInput = screen.getByTestId('new-task-due-date-input');
      const addTaskBtn = screen.getByTestId('add-task-btn');

      fireEvent.change(descInput, { target: { value: 'Schedule follow-up executive review meeting' } });
      fireEvent.change(userInput, { target: { value: 'user-mgr-1' } });
      fireEvent.change(dueDateInput, { target: { value: '2025-10-20' } });
      fireEvent.click(addTaskBtn);

      // Verify draft task added to list
      expect(screen.getByTestId('new-task-item-0')).toBeInTheDocument();
      expect(screen.getByText('Schedule follow-up executive review meeting')).toBeInTheDocument();

      // Submit form
      const saveBtn = screen.getByTestId('save-notes-btn');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockUpdateNotes).toHaveBeenCalledWith('meeting-1', {
          prep_notes: 'Discuss Q4 enterprise pricing and SLAs',
          meeting_notes: 'Client agreed to proceed with proposal.',
          lead_status: 'Proposal',
          tasks: [
            {
              task_description: 'Schedule follow-up executive review meeting',
              assigned_user_id: 'user-mgr-1',
              due_date_val: expect.any(String),
              is_completed: false,
            },
          ],
        });
      });

      expect(screen.getByTestId('save-success-alert')).toBeInTheDocument();
      expect(screen.getByText('Meeting notes and follow-up tasks saved successfully!')).toBeInTheDocument();
    });

    it('shows error message if adding a task with empty description', () => {
      render(<MeetingCalendar initialData={mockMeetings} autoFetch={false} />);

      const openBtn = screen.getByTestId('open-prep-modal-btn-meeting-1');
      fireEvent.click(openBtn);

      const addTaskBtn = screen.getByTestId('add-task-btn');
      fireEvent.click(addTaskBtn);

      expect(screen.getByTestId('task-form-error-alert')).toBeInTheDocument();
      expect(screen.getByText('Task description is required')).toBeInTheDocument();
    });
  });

  describe('Error, Loading, and Export States', () => {
    it('displays error banner and handles retry button', async () => {
      const mockFetch = vi.spyOn(analyticsService, 'getCalendarMeetings').mockRejectedValue(new Error('API connection timeout'));

      render(<MeetingCalendar autoFetch={true} error="Initial loading failed" />);

      expect(screen.getByTestId('calendar-error-banner')).toBeInTheDocument();
      expect(screen.getByText('Initial loading failed')).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /Retry/i });
      fireEvent.click(retryBtn);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('handles CSV and PDF export callbacks', () => {
      const onExportMock = vi.fn();
      render(<MeetingCalendar initialData={mockMeetings} autoFetch={false} onExport={onExportMock} />);

      const csvBtn = screen.getByTitle('Export Calendar Meetings to CSV');
      fireEvent.click(csvBtn);
      expect(onExportMock).toHaveBeenCalledWith('csv');

      const pdfBtn = screen.getByTitle('Export Calendar Meetings to PDF');
      fireEvent.click(pdfBtn);
      expect(onExportMock).toHaveBeenCalledWith('pdf');
    });
  });
});
