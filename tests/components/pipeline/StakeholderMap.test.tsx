import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  StakeholderMap,
  formatInfluenceLevel,
  formatActivityDate,
  getActivityTypeMeta,
} from '../../../src/components/pipeline/StakeholderMap';
import * as dealsService from '../../../src/services/deals';
import { StakeholderMapResponse } from '../../../src/services/deals';

describe('StakeholderMap Component [FR-6, FR-7]', () => {
  const sampleMapData: StakeholderMapResponse = {
    deal_id: 'deal-888',
    total_stakeholders: 3,
    total_activities: 3,
    stakeholders: [
      {
        id: 'stk-1',
        deal_id: 'deal-888',
        full_name: 'Sarah Connor',
        email: 'sarah.connor@cyberdyne.com',
        org_role: 'Chief Technology Officer',
        influence_level: 'High',
        is_active: true,
        created_on: '2026-09-01T10:00:00Z',
      },
      {
        id: 'stk-2',
        deal_id: 'deal-888',
        full_name: 'Miles Dyson',
        email: 'miles.dyson@cyberdyne.com',
        org_role: 'Lead Architect',
        influence_level: 'Medium',
        is_active: true,
        created_on: '2026-09-02T11:00:00Z',
      },
      {
        id: 'stk-3',
        deal_id: 'deal-888',
        full_name: 'John Connor',
        email: 'john.connor@cyberdyne.com',
        org_role: 'Operations Director',
        influence_level: 'Low',
        is_active: false,
        created_on: '2026-09-03T12:00:00Z',
      },
    ],
    recent_activities: [
      {
        id: 'act-1',
        stakeholder_id: 'stk-1',
        deal_id: 'deal-888',
        activity_type: 'Meeting',
        summary: 'Executive alignment meeting on SaaS contract terms and compliance SLA.',
        occurred_on: '2026-09-18T14:30:00Z',
        created_on: '2026-09-18T14:30:00Z',
        stakeholder_name: 'Sarah Connor',
      },
      {
        id: 'act-2',
        stakeholder_id: 'stk-2',
        deal_id: 'deal-888',
        activity_type: 'Email',
        summary: 'Sent updated technical security architecture proposal.',
        occurred_on: '2026-09-17T09:15:00Z',
        created_on: '2026-09-17T09:15:00Z',
        stakeholder_name: 'Miles Dyson',
      },
      {
        id: 'act-3',
        stakeholder_id: 'stk-1',
        deal_id: 'deal-888',
        activity_type: 'Call',
        summary: 'Phone discovery call regarding budget approval milestone.',
        occurred_on: '2026-09-15T16:00:00Z',
        created_on: '2026-09-15T16:00:00Z',
        stakeholder_name: 'Sarah Connor',
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Formatting Helpers', () => {
    it('formatInfluenceLevel provides correct label and badge config for High, Medium, and Low', () => {
      const high = formatInfluenceLevel('High');
      expect(high.label).toBe('High Influence');
      expect(high.variant).toBe('warning');

      const medium = formatInfluenceLevel('Medium');
      expect(medium.label).toBe('Medium Influence');
      expect(medium.variant).toBe('info');

      const low = formatInfluenceLevel('Low');
      expect(low.label).toBe('Low Influence');
      expect(low.variant).toBe('neutral');

      const custom = formatInfluenceLevel('Custom Level');
      expect(custom.label).toBe('Custom Level');
    });

    it('formatActivityDate formats ISO timestamp into human readable date', () => {
      const formatted = formatActivityDate('2026-09-18T14:30:00Z');
      expect(formatted).toContain('2026');
      expect(formatActivityDate('')).toBe('N/A');
      expect(formatActivityDate(null)).toBe('N/A');
    });

    it('getActivityTypeMeta returns icon and color attributes for activity types', () => {
      const emailMeta = getActivityTypeMeta('Email');
      expect(emailMeta.label).toBe('Email');

      const meetingMeta = getActivityTypeMeta('Meeting');
      expect(meetingMeta.label).toBe('Meeting');

      const callMeta = getActivityTypeMeta('Call');
      expect(callMeta.label).toBe('Call');

      const noteMeta = getActivityTypeMeta('Note');
      expect(noteMeta.label).toBe('Note');
    });
  });

  describe('Component Rendering with Initial Data [FR-6, FR-7]', () => {
    it('renders mapped contacts with roles and influence level badges [FR-6 Scenario 3.1]', () => {
      render(<StakeholderMap dealId="deal-888" initialData={sampleMapData} />);

      expect(screen.getByTestId('stakeholder-map-container')).toBeInDocument();
      expect(screen.getByTestId('stakeholders-count')).toHaveTextContent('3');

      // Sarah Connor (High Influence)
      expect(screen.getByTestId('stakeholder-name-stk-1')).toHaveTextContent('Sarah Connor');
      expect(screen.getByTestId('stakeholder-role-stk-1')).toHaveTextContent('Chief Technology Officer');
      expect(screen.getByTestId('stakeholder-influence-stk-1')).toHaveTextContent('High Influence');
      expect(screen.getByTestId('stakeholder-email-stk-1')).toHaveTextContent('sarah.connor@cyberdyne.com');

      // Miles Dyson (Medium Influence)
      expect(screen.getByTestId('stakeholder-name-stk-2')).toHaveTextContent('Miles Dyson');
      expect(screen.getByTestId('stakeholder-role-stk-2')).toHaveTextContent('Lead Architect');
      expect(screen.getByTestId('stakeholder-influence-stk-2')).toHaveTextContent('Medium Influence');

      // John Connor (Low Influence, Inactive)
      expect(screen.getByTestId('stakeholder-name-stk-3')).toHaveTextContent('John Connor');
      expect(screen.getByTestId('stakeholder-status-stk-3')).toHaveTextContent('Inactive in CRM');
    });

    it('renders chronological feed of recent CRM activities [FR-7 Scenario 3.1]', () => {
      render(<StakeholderMap dealId="deal-888" initialData={sampleMapData} />);

      expect(screen.getByTestId('activity-feed-section')).toBeInDocument();

      // Meeting activity
      expect(screen.getByTestId('activity-item-act-1')).toBeInDocument();
      expect(screen.getByTestId('activity-type-act-1')).toHaveTextContent('MEETING');
      expect(screen.getByTestId('activity-stakeholder-act-1')).toHaveTextContent('Sarah Connor');
      expect(screen.getByTestId('activity-summary-act-1')).toHaveTextContent(
        'Executive alignment meeting on SaaS contract terms and compliance SLA.'
      );

      // Email activity
      expect(screen.getByTestId('activity-item-act-2')).toBeInDocument();
      expect(screen.getByTestId('activity-type-act-2')).toHaveTextContent('EMAIL');
      expect(screen.getByTestId('activity-stakeholder-act-2')).toHaveTextContent('Miles Dyson');

      // Call activity
      expect(screen.getByTestId('activity-item-act-3')).toBeInDocument();
      expect(screen.getByTestId('activity-type-act-3')).toHaveTextContent('CALL');
    });

    it('filters activity feed when activity type filter tabs are clicked', () => {
      render(<StakeholderMap dealId="deal-888" initialData={sampleMapData} />);

      // Filter by Email
      fireEvent.click(screen.getByTestId('activity-filter-email'));
      expect(screen.getByTestId('activity-item-act-2')).toBeInDocument();
      expect(screen.queryByTestId('activity-item-act-1')).not.toBeInDocument();

      // Filter by Meeting
      fireEvent.click(screen.getByTestId('activity-filter-meeting'));
      expect(screen.getByTestId('activity-item-act-1')).toBeInDocument();
      expect(screen.queryByTestId('activity-item-act-2')).not.toBeInDocument();

      // Filter back to ALL
      fireEvent.click(screen.getByTestId('activity-filter-all'));
      expect(screen.getByTestId('activity-item-act-1')).toBeInDocument();
      expect(screen.getByTestId('activity-item-act-2')).toBeInDocument();
      expect(screen.getByTestId('activity-item-act-3')).toBeInDocument();
    });
  });

  describe('API Data Fetching and User Interactions', () => {
    it('fetches data on mount when initialData is not supplied', async () => {
      vi.spyOn(dealsService, 'getStakeholders').mockResolvedValue(sampleMapData);

      render(<StakeholderMap dealId="deal-888" />);

      expect(screen.getByTestId('stakeholder-map-loading')).toBeInDocument();

      await waitFor(() => {
        expect(screen.getByTestId('stakeholder-name-stk-1')).toHaveTextContent('Sarah Connor');
      });

      expect(dealsService.getStakeholders).toHaveBeenCalledWith('deal-888', false);
    });

    it('renders empty states when stakeholders or activities lists are empty', () => {
      const emptyData: StakeholderMapResponse = {
        deal_id: 'deal-empty',
        total_stakeholders: 0,
        total_activities: 0,
        stakeholders: [],
        recent_activities: [],
      };

      render(<StakeholderMap dealId="deal-empty" initialData={emptyData} />);

      expect(screen.getByTestId('empty-stakeholders-message')).toHaveTextContent(
        'No stakeholders mapped for this deal yet.'
      );
      expect(screen.getByTestId('empty-activities-message')).toHaveTextContent(
        'No recent CRM interaction activity recorded.'
      );
    });

    it('toggles active-only contacts filter', async () => {
      const activeOnlyData: StakeholderMapResponse = {
        ...sampleMapData,
        stakeholders: sampleMapData.stakeholders.filter((s) => s.is_active),
      };
      vi.spyOn(dealsService, 'getStakeholders').mockResolvedValue(activeOnlyData);

      render(<StakeholderMap dealId="deal-888" initialData={sampleMapData} />);

      const toggle = screen.getByTestId('active-only-toggle');
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(dealsService.getStakeholders).toHaveBeenCalledWith('deal-888', true);
      });
    });

    it('opens add stakeholder modal and submits new contact [FR-6]', async () => {
      vi.spyOn(dealsService, 'getStakeholders').mockResolvedValue(sampleMapData);
      vi.spyOn(dealsService, 'createStakeholder').mockResolvedValue({
        id: 'stk-4',
        deal_id: 'deal-888',
        full_name: 'Kyle Reese',
        email: 'kyle.reese@cyberdyne.com',
        org_role: 'Security Consultant',
        influence_level: 'High',
        is_active: true,
        created_on: '2026-09-19T08:00:00Z',
      });

      render(<StakeholderMap dealId="deal-888" initialData={sampleMapData} />);

      // Click Add Stakeholder
      fireEvent.click(screen.getByTestId('add-stakeholder-button'));
      expect(screen.getByTestId('add-stakeholder-modal')).toBeInDocument();

      // Fill out form
      fireEvent.change(screen.getByTestId('stakeholder-name-input'), {
        target: { value: 'Kyle Reese' },
      });
      fireEvent.change(screen.getByTestId('stakeholder-email-input'), {
        target: { value: 'kyle.reese@cyberdyne.com' },
      });
      fireEvent.change(screen.getByTestId('stakeholder-role-input'), {
        target: { value: 'Security Consultant' },
      });
      fireEvent.change(screen.getByTestId('stakeholder-influence-select'), {
        target: { value: 'High' },
      });

      // Submit
      fireEvent.click(screen.getByTestId('submit-stakeholder-button'));

      await waitFor(() => {
        expect(dealsService.createStakeholder).toHaveBeenCalledWith('deal-888', {
          full_name: 'Kyle Reese',
          email: 'kyle.reese@cyberdyne.com',
          org_role: 'Security Consultant',
          influence_level: 'High',
        });
      });
    });

    it('opens log activity modal and submits new interaction [FR-7]', async () => {
      vi.spyOn(dealsService, 'getStakeholders').mockResolvedValue(sampleMapData);
      vi.spyOn(dealsService, 'addStakeholderActivity').mockResolvedValue({
        id: 'act-4',
        stakeholder_id: 'stk-1',
        deal_id: 'deal-888',
        activity_type: 'Note',
        summary: 'Followed up on implementation timeline agreement.',
        occurred_on: '2026-09-19T10:00:00Z',
        created_on: '2026-09-19T10:00:00Z',
        stakeholder_name: 'Sarah Connor',
      });

      render(<StakeholderMap dealId="deal-888" initialData={sampleMapData} />);

      // Click Log Activity
      fireEvent.click(screen.getByTestId('add-activity-button'));
      expect(screen.getByTestId('add-activity-modal')).toBeInDocument();

      // Fill form
      fireEvent.change(screen.getByTestId('activity-stakeholder-select'), {
        target: { value: 'stk-1' },
      });
      fireEvent.change(screen.getByTestId('activity-type-select'), {
        target: { value: 'Note' },
      });
      fireEvent.change(screen.getByTestId('activity-summary-input'), {
        target: { value: 'Followed up on implementation timeline agreement.' },
      });

      // Submit
      fireEvent.click(screen.getByTestId('submit-activity-button'));

      await waitFor(() => {
        expect(dealsService.addStakeholderActivity).toHaveBeenCalledWith('deal-888', {
          stakeholder_id: 'stk-1',
          activity_type: 'Note',
          summary: 'Followed up on implementation timeline agreement.',
          occurred_on: null,
        });
      });
    });

    it('renders error state and retries on failure', async () => {
      vi.spyOn(dealsService, 'getStakeholders').mockRejectedValue(
        new Error('Network connection timeout')
      );

      render(<StakeholderMap dealId="deal-888" />);

      await waitFor(() => {
        expect(screen.getByTestId('stakeholder-map-error')).toBeInDocument();
      });

      expect(screen.getByTestId('stakeholder-map-error')).toHaveTextContent(
        'Network connection timeout'
      );

      // Retry
      vi.spyOn(dealsService, 'getStakeholders').mockResolvedValue(sampleMapData);
      fireEvent.click(screen.getByTestId('stakeholder-map-retry'));

      await waitFor(() => {
        expect(screen.getByTestId('stakeholder-name-stk-1')).toHaveTextContent('Sarah Connor');
      });
    });
  });
});
