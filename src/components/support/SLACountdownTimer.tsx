'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Clock, AlertTriangle, AlertCircle, CheckCircle2, Timer } from 'lucide-react';
import {
  SLATracking,
  SLATargetType,
  TicketPriority,
  TicketStatus,
} from '../../services/support';

/**
 * Visual SLA timer status classification [FR-4, NFR-1].
 */
export type SLAState = 'normal' | 'warning' | 'breached' | 'completed';

/**
 * Calculated sub-second time breakdown [NFR-1].
 */
export interface TimeRemaining {
  /** Total milliseconds difference (negative if breached) */
  totalMs: number;
  /** Whether deadline has passed or SLA is marked breached */
  isBreached: boolean;
  /** Hours remaining or overdue */
  hours: number;
  /** Minutes remaining or overdue */
  minutes: number;
  /** Seconds remaining or overdue */
  seconds: number;
  /** Tenths of a second (0-9) for sub-second precision */
  subSeconds: number;
  /** Formatted digital clock string e.g. "01:23:45.6" or "-00:05:12.3" */
  formattedTime: string;
  /** Verbose human readable string e.g. "1h 23m 45.6s remaining" */
  formattedVerbose: string;
}

/**
 * Properties for the SLACountdownTimer component [FR-4, NFR-1].
 */
export interface SLACountdownTimerProps {
  /**
   * SLA tracking record object from backend API or service wrapper [FR-4].
   */
  slaTracking?: SLATracking | null;
  /**
   * Target deadline timestamp as ISO string or Date object.
   */
  targetDueAt?: string | Date | null;
  /**
   * Classification of SLA target ('first_response' | 'resolution' or custom).
   */
  targetType?: SLATargetType | string;
  /**
   * Explicit breach status flag.
   */
  isBreached?: boolean;
  /**
   * Timestamp when warning alert was triggered/sent.
   */
  warningSentAt?: string | Date | null;
  /**
   * Timestamp when breach occurred.
   */
  breachedAt?: string | Date | null;
  /**
   * Timestamp when SLA target was fulfilled/completed.
   */
  completedAt?: string | Date | null;
  /**
   * Priority level of ticket (P1, P2, P3).
   */
  priority?: TicketPriority | string;
  /**
   * Overall ticket status (open, pending, resolved, closed).
   */
  ticketStatus?: TicketStatus | string;
  /**
   * Custom headline label override (e.g. "First Response Deadline").
   */
  label?: string;
  /**
   * Timer interval update frequency in milliseconds (default: 100ms for sub-second accuracy).
   */
  updateIntervalMs?: number;
  /**
   * Whether to render sub-second decimal precision (.s / tenths). Default: true.
   */
  showSubSeconds?: boolean;
  /**
   * Compact layout for dense lists or card tables. Default: false.
   */
  compact?: boolean;
  /**
   * Inline pill layout without box card wrapper. Default: false.
   */
  inline?: boolean;
  /**
   * Custom CSS class names.
   */
  className?: string;
  /**
   * Callback fired when timer crosses 0 / breaches deadline.
   */
  onBreach?: () => void;
  /**
   * Callback fired when warning threshold is entered.
   */
  onWarning?: () => void;
}

/**
 * Format integer with leading zero padding.
 */
function pad(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

/**
 * Map SLA target type enum to human-friendly display title.
 */
export function getSLATargetLabel(targetType?: string | null, customLabel?: string): string {
  if (customLabel) return customLabel;
  if (!targetType) return 'SLA Target';
  const normalized = targetType.trim().toLowerCase();
  switch (normalized) {
    case 'first_response':
      return 'First Response SLA';
    case 'resolution':
      return 'Resolution SLA';
    default:
      return targetType
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

/**
 * Calculate sub-second time remaining until deadline [NFR-1].
 *
 * @param targetDueAt Target deadline ISO string or Date
 * @param nowMs Reference timestamp in ms (defaults to Date.now())
 * @param completedAt Optional completion timestamp if target was fulfilled
 * @param showSubSeconds Whether to format sub-seconds
 */
export function calculateTimeRemaining(
  targetDueAt?: string | Date | null,
  nowMs: number = Date.now(),
  completedAt?: string | Date | number | null,
  showSubSeconds = true
): TimeRemaining {
  if (completedAt) {
    return {
      totalMs: 0,
      isBreached: false,
      hours: 0,
      minutes: 0,
      seconds: 0,
      subSeconds: 0,
      formattedTime: showSubSeconds ? '00:00:00.0' : '00:00:00',
      formattedVerbose: 'Completed',
    };
  }

  if (!targetDueAt) {
    return {
      totalMs: 0,
      isBreached: false,
      hours: 0,
      minutes: 0,
      seconds: 0,
      subSeconds: 0,
      formattedTime: showSubSeconds ? '--:--:--.-' : '--:--:--',
      formattedVerbose: 'No deadline',
    };
  }

  const dueMs = typeof targetDueAt === 'string' ? new Date(targetDueAt).getTime() : targetDueAt.getTime();
  if (isNaN(dueMs)) {
    return {
      totalMs: 0,
      isBreached: false,
      hours: 0,
      minutes: 0,
      seconds: 0,
      subSeconds: 0,
      formattedTime: showSubSeconds ? '--:--:--.-' : '--:--:--',
      formattedVerbose: 'Invalid date',
    };
  }

  const diffMs = dueMs - nowMs;
  const isBreached = diffMs < 0;
  const absMs = Math.abs(diffMs);

  const hours = Math.floor(absMs / (1000 * 60 * 60));
  const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((absMs % (1000 * 60)) / 1000);
  const subSeconds = Math.floor((absMs % 1000) / 100);

  const subSecString = showSubSeconds ? `.${subSeconds}` : '';

  let formattedTime = '';
  if (hours > 0) {
    formattedTime = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${subSecString}`;
  } else {
    formattedTime = `${pad(minutes)}:${pad(seconds)}${subSecString}`;
  }

  if (isBreached) {
    formattedTime = `-${formattedTime}`;
  }

  let formattedVerbose = '';
  const timeUnits: string[] = [];
  if (hours > 0) timeUnits.push(`${hours}h`);
  if (minutes > 0 || hours > 0) timeUnits.push(`${minutes}m`);
  timeUnits.push(`${seconds}${subSecString}s`);

  if (isBreached) {
    formattedVerbose = `${timeUnits.join(' ')} overdue`;
  } else {
    formattedVerbose = `${timeUnits.join(' ')} remaining`;
  }

  return {
    totalMs: diffMs,
    isBreached,
    hours,
    minutes,
    seconds,
    subSeconds,
    formattedTime,
    formattedVerbose,
  };
}

/**
 * Metadata for visual styling and ARIA attributes based on SLA state.
 */
export function getSLAStateMeta(
  state: SLAState,
  isBreached: boolean
): {
  badgeLabel: string;
  badgeVariant: string;
  containerClasses: string;
  textClasses: string;
  badgeClasses: string;
  ariaLive: 'polite' | 'assertive';
  icon: React.ElementType;
} {
  switch (state) {
    case 'completed':
      return {
        badgeLabel: 'SLA Met',
        badgeVariant: 'success',
        containerClasses: 'bg-stone-50 border-stone-200 text-stone-800 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-200',
        textClasses: 'text-stone-700 dark:text-stone-300',
        badgeClasses: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300',
        ariaLive: 'polite',
        icon: CheckCircle2,
      };

    case 'breached':
      return {
        badgeLabel: 'Breached',
        badgeVariant: 'error',
        containerClasses: 'bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/80 dark:border-rose-800 dark:text-rose-100',
        textClasses: 'text-rose-800 font-bold dark:text-rose-200',
        badgeClasses: 'bg-rose-600 text-white border-rose-700 animate-pulse',
        ariaLive: 'assertive',
        icon: AlertCircle,
      };

    case 'warning':
      return {
        badgeLabel: 'At Risk',
        badgeVariant: 'warning',
        containerClasses: 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/70 dark:border-amber-800 dark:text-amber-100',
        textClasses: 'text-amber-800 font-semibold dark:text-amber-200',
        badgeClasses: 'bg-amber-500 text-white border-amber-600',
        ariaLive: 'assertive',
        icon: AlertTriangle,
      };

    case 'normal':
    default:
      return {
        badgeLabel: 'On Track',
        badgeVariant: 'info',
        containerClasses: 'bg-emerald-50/80 border-emerald-200 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-100',
        textClasses: 'text-emerald-800 dark:text-emerald-200',
        badgeClasses: 'bg-emerald-600 text-white border-emerald-700',
        ariaLive: 'polite',
        icon: Clock,
      };
  }
}

/**
 * Real-time Sub-second SLA Countdown Timer Component [FR-4, NFR-1].
 *
 * Displays a live updating sub-second timer for response and resolution SLAs
 * with dynamic color transitions (Green -> Yellow -> Red).
 */
export function SLACountdownTimer({
  slaTracking,
  targetDueAt: targetDueAtProp,
  targetType: targetTypeProp,
  isBreached: isBreachedProp,
  warningSentAt: warningSentAtProp,
  breachedAt: breachedAtProp,
  completedAt: completedAtProp,
  priority,
  ticketStatus,
  label: labelProp,
  updateIntervalMs = 100,
  showSubSeconds = true,
  compact = false,
  inline = false,
  className = '',
  onBreach,
  onWarning,
}: SLACountdownTimerProps): React.JSX.Element {
  // Extract consolidated values from slaTracking object or individual props
  const targetDueAt = slaTracking?.target_due_at ?? targetDueAtProp;
  const targetType = slaTracking?.target_type ?? targetTypeProp;
  const isBreachedFlag = slaTracking?.is_breached ?? isBreachedProp;
  const warningSentAt = slaTracking?.warning_sent_at ?? warningSentAtProp;
  const breachedAt = slaTracking?.breached_at ?? breachedAtProp;
  const completedAt = completedAtProp;

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const prevBreachRef = useRef<boolean>(false);
  const prevWarningRef = useRef<boolean>(false);

  const isCompleted = useMemo(() => {
    if (completedAt) return true;
    if (ticketStatus && ['resolved', 'closed'].includes(ticketStatus.toLowerCase())) {
      // If resolution SLA or ticket is resolved without breach flag set prior
      if (targetType === 'resolution') return true;
    }
    return false;
  }, [completedAt, ticketStatus, targetType]);

  // Live countdown state refreshed at updateIntervalMs
  useEffect(() => {
    if (isCompleted) return;

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, updateIntervalMs);

    return () => clearInterval(timer);
  }, [isCompleted, updateIntervalMs]);

  // Calculate current time remaining breakdown
  const timeInfo = useMemo(() => {
    return calculateTimeRemaining(targetDueAt, nowMs, isCompleted ? nowMs : null, showSubSeconds);
  }, [targetDueAt, nowMs, isCompleted, showSubSeconds]);

  // Determine SLA State
  const state: SLAState = useMemo(() => {
    if (isCompleted) return 'completed';
    if (isBreachedFlag || timeInfo.isBreached || Boolean(breachedAt)) return 'breached';

    // Warning state trigger: warningSentAt is present OR < 15 mins remaining
    const isWarningTriggered =
      Boolean(warningSentAt) ||
      (timeInfo.totalMs > 0 && timeInfo.totalMs <= 15 * 60 * 1000);

    if (isWarningTriggered) return 'warning';
    return 'normal';
  }, [isCompleted, isBreachedFlag, timeInfo.isBreached, breachedAt, warningSentAt, timeInfo.totalMs]);

  // Trigger event callbacks on state transitions
  useEffect(() => {
    if (state === 'breached' && !prevBreachRef.current) {
      prevBreachRef.current = true;
      if (onBreach) onBreach();
    }
    if (state === 'warning' && !prevWarningRef.current) {
      prevWarningRef.current = true;
      if (onWarning) onWarning();
    }
  }, [state, onBreach, onWarning]);

  const displayLabel = getSLATargetLabel(targetType, labelProp);
  const meta = getSLAStateMeta(state, timeInfo.isBreached);
  const IconComponent = meta.icon;

  if (inline) {
    return (
      <span
        role="timer"
        aria-live={meta.ariaLive}
        aria-label={`${displayLabel}: ${timeInfo.formattedVerbose}`}
        className={twMerge(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition-colors',
          meta.containerClasses,
          className
        )}
      >
        <IconComponent className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
        <span className="font-semibold">{displayLabel}:</span>
        <span className={meta.textClasses}>{timeInfo.formattedTime}</span>
      </span>
    );
  }

  if (compact) {
    return (
      <div
        role="timer"
        aria-live={meta.ariaLive}
        aria-label={`${displayLabel}: ${timeInfo.formattedVerbose}`}
        className={twMerge(
          'flex items-center justify-between gap-2 p-2 rounded-lg border text-sm transition-colors',
          meta.containerClasses,
          className
        )}
      >
        <div className="flex items-center gap-2">
          <IconComponent className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span className="font-medium text-xs text-stone-700 dark:text-stone-300">
            {displayLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx('font-mono font-bold text-sm tracking-tight', meta.textClasses)}>
            {timeInfo.formattedTime}
          </span>
          <span
            className={clsx(
              'px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded border',
              meta.badgeClasses
            )}
          >
            {meta.badgeLabel}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="timer"
      aria-live={meta.ariaLive}
      aria-label={`${displayLabel}: ${timeInfo.formattedVerbose}`}
      className={twMerge(
        'p-4 rounded-xl border shadow-sm transition-all duration-200',
        meta.containerClasses,
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <IconComponent className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span className="font-serif font-medium text-base tracking-tight">
            {displayLabel}
          </span>
          {priority && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-stone-200/80 text-stone-800 dark:bg-stone-800 dark:text-stone-200">
              {priority}
            </span>
          )}
        </div>
        <span
          className={clsx(
            'px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-md border shadow-2xs',
            meta.badgeClasses
          )}
        >
          {meta.badgeLabel}
        </span>
      </div>

      <div className="flex items-baseline justify-between mt-3">
        <div>
          <p className="text-xs text-stone-500 dark:text-stone-400 font-sans uppercase tracking-widest text-[10px] mb-0.5">
            {state === 'breached' ? 'Overdue Time' : state === 'completed' ? 'Status' : 'Time Remaining'}
          </p>
          <div
            className={clsx(
              'font-mono text-2xl font-extrabold tracking-tight',
              meta.textClasses
            )}
          >
            {timeInfo.formattedTime}
          </div>
        </div>

        {targetDueAt && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Deadline Target
            </p>
            <p className="text-xs font-medium text-stone-700 dark:text-stone-300 font-mono">
              {new Date(targetDueAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SLACountdownTimer;
