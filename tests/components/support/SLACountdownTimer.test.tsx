import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  SLACountdownTimer,
  calculateTimeRemaining,
  getSLATargetLabel,
  getSLAStateMeta,
} from '../../../src/components/support/SLACountdownTimer';
import { SLATracking } from '../../../src/services/support';

describe('SLACountdownTimer Component & Helpers [FR-4, NFR-1]', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Helper Functions [NFR-1]', () => {
    it('getSLATargetLabel formats first_response and resolution target types', () => {
      expect(getSLATargetLabel('first_response')).toBe('First Response SLA');
      expect(getSLATargetLabel('resolution')).toBe('Resolution SLA');
      expect(getSLATargetLabel('custom_target')).toBe('Custom Target');
      expect(getSLATargetLabel(null, 'Custom Override')).toBe('Custom Override');
      expect(getSLATargetLabel(null)).toBe('SLA Target');
    });

    it('calculateTimeRemaining accurately calculates sub-second time remaining for future targets', () => {
      const now = new Date('2026-10-10T12:00:00.000Z').getTime();
      const target = '2026-10-10T13:15:30.500Z'; // 1 hour 15 mins 30.5 sec

      const result = calculateTimeRemaining(target, now, null, true);

      expect(result.isBreached).toBe(false);
      expect(result.hours).toBe(1);
      expect(result.minutes).toBe(15);
      expect(result.seconds).toBe(30);
      expect(result.subSeconds).toBe(5);
      expect(result.formattedTime).toBe('01:15:30.5');
      expect(result.formattedVerbose).toContain('1h 15m 30.5s remaining');
    });

    it('calculateTimeRemaining accurately formats negative time and sub-seconds for breached targets', () => {
      const now = new Date('2026-10-10T12:00:00.000Z').getTime();
      const target = '2026-10-10T11:55:00.300Z'; // 4 mins 59.7 sec overdue

      const result = calculateTimeRemaining(target, now, null, true);

      expect(result.isBreached).toBe(true);
      expect(result.minutes).toBe(4);
      expect(result.formattedTime).toBe('-04:59.7');
      expect(result.formattedVerbose).toContain('4m 59.7s overdue');
    });

    it('calculateTimeRemaining respects showSubSeconds flag = false', () => {
      const now = new Date('2026-10-10T12:00:00.000Z').getTime();
      const target = '2026-10-10T12:10:05.400Z';

      const result = calculateTimeRemaining(target, now, null, false);

      expect(result.formattedTime).toBe('10:05');
      expect(result.formattedVerbose).toContain('10m 5s remaining');
    });

    it('calculateTimeRemaining returns completed state when completedAt is provided', () => {
      const now = new Date('2026-10-10T12:00:00.000Z').getTime();
      const target = '2026-10-10T13:00:00.000Z';
      const completed = '2026-10-10T12:30:00.000Z';

      const result = calculateTimeRemaining(target, now, completed, true);

      expect(result.formattedVerbose).toBe('Completed');
      expect(result.formattedTime).toBe('00:00:00.0');
    });

    it('calculateTimeRemaining handles missing or invalid target dates gracefully', () => {
      const resultNull = calculateTimeRemaining(null);
      expect(resultNull.formattedTime).toBe('--:--:--.-');
      expect(resultNull.formattedVerbose).toBe('No deadline');

      const resultInvalid = calculateTimeRemaining('invalid-date-string');
      expect(resultInvalid.formattedTime).toBe('--:--:--.-');
      expect(resultInvalid.formattedVerbose).toBe('Invalid date');
    });

    it('getSLAStateMeta provides correct variants, badges, and icons for each SLA state', () => {
      const normalMeta = getSLAStateMeta('normal', false);
      expect(normalMeta.badgeLabel).toBe('On Track');
      expect(normalMeta.badgeVariant).toBe('info');
      expect(normalMeta.ariaLive).toBe('polite');

      const warningMeta = getSLAStateMeta('warning', false);
      expect(warningMeta.badgeLabel).toBe('At Risk');
      expect(warningMeta.badgeVariant).toBe('warning');

      const breachedMeta = getSLAStateMeta('breached', true);
      expect(breachedMeta.badgeLabel).toBe('Breached');
      expect(breachedMeta.badgeVariant).toBe('error');
      expect(breachedMeta.ariaLive).toBe('assertive');

      const completedMeta = getSLAStateMeta('completed', false);
      expect(completedMeta.badgeLabel).toBe('SLA Met');
      expect(completedMeta.badgeVariant).toBe('success');
    });
  });

  describe('Component Rendering & Live Timer [FR-4, NFR-1]', () => {
    it('renders normal "On Track" SLA countdown timer using slaTracking object', () => {
      const mockSLA: SLATracking = {
        id: 'sla-1',
        ticket_id: 't-100',
        target_type: 'first_response',
        target_due_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1h in future
        is_breached: false,
      };

      render(<SLACountdownTimer slaTracking={mockSLA} priority="P1" />);

      expect(screen.getByRole('timer')).toBeInTheDocument();
      expect(screen.getByText('First Response SLA')).toBeInTheDocument();
      expect(screen.getByText('P1')).toBeInTheDocument();
      expect(screen.getByText('On Track')).toBeInTheDocument();
    });

    it('updates timer value in sub-second increments over time', () => {
      const nowMs = Date.now();
      const targetDueAt = new Date(nowMs + 60 * 1000).toISOString(); // 1 minute from now

      render(<SLACountdownTimer targetDueAt={targetDueAt} targetType="resolution" updateIntervalMs={100} />);

      expect(screen.getByText('Resolution SLA')).toBeInTheDocument();

      // Fast forward 500ms
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Timer should still be rendered and updated
      expect(screen.getByRole('timer')).toBeInTheDocument();
    });

    it('renders "At Risk" warning state when warningSentAt is set or deadline is under 15 minutes', () => {
      const targetDueAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins remaining (< 15 mins)

      render(<SLACountdownTimer targetDueAt={targetDueAt} targetType="first_response" />);

      expect(screen.getByText('At Risk')).toBeInTheDocument();
    });

    it('renders "Breached" state when isBreached is true or deadline has passed', () => {
      const mockSLA: SLATracking = {
        id: 'sla-2',
        ticket_id: 't-101',
        target_type: 'resolution',
        target_due_at: new Date(Date.now() - 300 * 1000).toISOString(), // 5 mins ago
        is_breached: true,
        breached_at: new Date(Date.now() - 300 * 1000).toISOString(),
      };

      render(<SLACountdownTimer slaTracking={mockSLA} />);

      expect(screen.getByText('Breached')).toBeInTheDocument();
      expect(screen.getByText('Overdue Time')).toBeInTheDocument();
    });

    it('renders "SLA Met" completed state when completedAt is provided or ticket is resolved', () => {
      render(
        <SLACountdownTimer
          targetDueAt={new Date(Date.now() + 3600 * 1000).toISOString()}
          targetType="resolution"
          ticketStatus="resolved"
        />
      );

      expect(screen.getByText('SLA Met')).toBeInTheDocument();
    });

    it('renders compact layout when compact prop is true', () => {
      render(
        <SLACountdownTimer
          targetDueAt={new Date(Date.now() + 1800 * 1000).toISOString()}
          targetType="first_response"
          compact={true}
        />
      );

      expect(screen.getByRole('timer')).toBeInTheDocument();
      expect(screen.getByText('First Response SLA')).toBeInTheDocument();
      expect(screen.getByText('On Track')).toBeInTheDocument();
    });

    it('renders inline pill layout when inline prop is true', () => {
      render(
        <SLACountdownTimer
          targetDueAt={new Date(Date.now() + 1800 * 1000).toISOString()}
          targetType="resolution"
          inline={true}
        />
      );

      const timerSpan = screen.getByRole('timer');
      expect(timerSpan).toBeInTheDocument();
      expect(timerSpan).toHaveClass('inline-flex');
    });

    it('triggers onBreach and onWarning callbacks when state transitions occur', () => {
      const onBreachMock = vi.fn();
      const onWarningMock = vi.fn();

      const { rerender } = render(
        <SLACountdownTimer
          targetDueAt={new Date(Date.now() + 3600 * 1000).toISOString()}
          targetType="first_response"
          onBreach={onBreachMock}
          onWarning={onWarningMock}
        />
      );

      // Re-render in warning state (< 15 mins)
      rerender(
        <SLACountdownTimer
          targetDueAt={new Date(Date.now() + 5 * 60 * 1000).toISOString()}
          targetType="first_response"
          onBreach={onBreachMock}
          onWarning={onWarningMock}
        />
      );

      expect(onWarningMock).toHaveBeenCalledTimes(1);

      // Re-render in breached state
      rerender(
        <SLACountdownTimer
          targetDueAt={new Date(Date.now() - 10 * 1000).toISOString()}
          targetType="first_response"
          isBreached={true}
          onBreach={onBreachMock}
          onWarning={onWarningMock}
        />
      );

      expect(onBreachMock).toHaveBeenCalledTimes(1);
    });
  });
});
