'use client';

import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export type StatusType =
  | 'success'
  | 'active'
  | 'operational'
  | 'online'
  | 'ok'
  | 'warning'
  | 'pending'
  | 'degraded'
  | 'maintenance'
  | 'error'
  | 'critical'
  | 'failed'
  | 'offline'
  | 'inactive'
  | 'info'
  | 'initializing'
  | 'loading'
  | 'neutral'
  | (string & {});

export interface StatusLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Status identifier or custom status text (e.g. 'active', 'initializing', 'error', 'pending')
   */
  status: StatusType;
  /**
   * Optional display text override. Defaults to capitalized status string.
   */
  label?: string;
  /**
   * Explicit variant override for visual styling.
   */
  variant?: StatusVariant;
  /**
   * ARIA live region setting ('polite' | 'assertive' | 'off').
   * Defaults to 'assertive' for error/critical statuses, and 'polite' for other statuses.
   */
  ariaLive?: 'polite' | 'assertive' | 'off';
  /**
   * Whether to display visual status dot indicator. Defaults to true.
   */
  showIcon?: boolean;
  /**
   * Custom prefix for screen reader users. Defaults to 'Status: '.
   */
  srPrefix?: string;
  /**
   * Additional CSS class names.
   */
  className?: string;
}

/**
 * Maps a status string to one of the 5 canonical WCAG 2.1 AA compliant status variants.
 */
export function getStatusVariant(status: string): StatusVariant {
  const normalized = status.trim().toLowerCase();
  switch (normalized) {
    case 'success':
    case 'active':
    case 'operational':
    case 'online':
    case 'ok':
      return 'success';

    case 'warning':
    case 'pending':
    case 'degraded':
    case 'maintenance':
      return 'warning';

    case 'error':
    case 'critical':
    case 'failed':
    case 'offline':
    case 'inactive':
      return 'error';

    case 'info':
    case 'initializing':
    case 'loading':
      return 'info';

    case 'neutral':
    case 'default':
    default:
      return 'neutral';
  }
}

/**
 * Capitalizes the status string for default display label.
 */
function formatDefaultLabel(status: string): string {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Configuration for WCAG 2.1 AA compliant styles per status variant.
 * All color combinations guarantee >= 4.5:1 contrast for text and >= 3:1 for visual indicators.
 */
const VARIANT_CONFIG: Record<
  StatusVariant,
  {
    classes: string;
    dotClasses: string;
    inlineStyle: React.CSSProperties;
    dotInlineStyle: React.CSSProperties;
    defaultAriaLive: 'polite' | 'assertive';
  }
> = {
  success: {
    // Green theme: text-emerald-900 (#14532d) on bg-emerald-100 (#dcfce7) -> contrast ratio > 8:1
    classes: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    dotClasses: 'bg-emerald-600',
    inlineStyle: {
      backgroundColor: '#dcfce7',
      color: '#14532d',
      borderColor: '#86efac',
    },
    dotInlineStyle: {
      backgroundColor: '#16a34a',
    },
    defaultAriaLive: 'polite',
  },
  warning: {
    // Amber theme: text-amber-950 (#451a03) on bg-amber-100 (#fef3c7) -> contrast ratio > 10:1
    classes: 'bg-amber-100 text-amber-950 border-amber-300',
    dotClasses: 'bg-amber-600',
    inlineStyle: {
      backgroundColor: '#fef3c7',
      color: '#451a03',
      borderColor: '#fde68a',
    },
    dotInlineStyle: {
      backgroundColor: '#d97706',
    },
    defaultAriaLive: 'polite',
  },
  error: {
    // Red theme: text-red-950 (#450a0a) on bg-red-100 (#fee2e2) -> contrast ratio > 11:1
    classes: 'bg-red-100 text-red-950 border-red-300',
    dotClasses: 'bg-red-600',
    inlineStyle: {
      backgroundColor: '#fee2e2',
      color: '#450a0a',
      borderColor: '#fca5a5',
    },
    dotInlineStyle: {
      backgroundColor: '#dc2626',
    },
    defaultAriaLive: 'assertive',
  },
  info: {
    // Blue theme: text-sky-950 (#082f49) on bg-sky-100 (#e0f2fe) -> contrast ratio > 10:1
    classes: 'bg-sky-100 text-sky-950 border-sky-300',
    dotClasses: 'bg-sky-600',
    inlineStyle: {
      backgroundColor: '#e0f2fe',
      color: '#082f49',
      borderColor: '#7dd3fc',
    },
    dotInlineStyle: {
      backgroundColor: '#0284c7',
    },
    defaultAriaLive: 'polite',
  },
  neutral: {
    // Slate theme: text-slate-900 (#0f172a) on bg-slate-100 (#f1f5f9) -> contrast ratio > 12:1
    classes: 'bg-slate-100 text-slate-900 border-slate-300',
    dotClasses: 'bg-slate-600',
    inlineStyle: {
      backgroundColor: '#f1f5f9',
      color: '#0f172a',
      borderColor: '#cbd5e1',
    },
    dotInlineStyle: {
      backgroundColor: '#475569',
    },
    defaultAriaLive: 'polite',
  },
};

const SR_ONLY_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: '0',
};

export const StatusLabel = React.forwardRef<HTMLSpanElement, StatusLabelProps>(
  (
    {
      status,
      label,
      variant,
      ariaLive,
      showIcon = true,
      srPrefix = 'Status: ',
      className,
      style,
      ...props
    },
    ref
  ) => {
    const resolvedVariant = variant || getStatusVariant(status);
    const config = VARIANT_CONFIG[resolvedVariant] || VARIANT_CONFIG.neutral;
    const displayText = label || formatDefaultLabel(status);
    const resolvedAriaLive = ariaLive || config.defaultAriaLive;

    const baseClasses =
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400';

    const mergedClassName = twMerge(
      clsx(baseClasses, config.classes, className)
    );

    const mergedStyle: React.CSSProperties = {
      ...config.inlineStyle,
      ...style,
    };

    return (
      <span
        ref={ref}
        role="status"
        aria-live={resolvedAriaLive}
        aria-atomic="true"
        className={mergedClassName}
        style={mergedStyle}
        data-status={status}
        data-variant={resolvedVariant}
        {...props}
      >
        <span style={SR_ONLY_STYLE} className="sr-only">
          {srPrefix}
        </span>
        {showIcon && (
          <span
            className={clsx('mr-1.5 h-2 w-2 rounded-full inline-block', config.dotClasses)}
            style={config.dotInlineStyle}
            aria-hidden="true"
            data-testid="status-dot"
          />
        )}
        <span>{displayText}</span>
      </span>
    );
  }
);

StatusLabel.displayName = 'StatusLabel';
