'use client';

import React, { useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DollarSign, Clock, Target, Tag } from 'lucide-react';
import { DealResponse, Deal } from '../../services/deals';
import { StatusLabel } from '../common/StatusLabel';

export interface DealCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /**
   * Deal object containing deal details [FR-002]
   */
  deal?: DealResponse | Deal;
  /**
   * Optional ID override
   */
  id?: string;
  /**
   * Optional title override
   */
  title?: string;
  /**
   * Optional deal value override
   */
  dealValue?: number;
  /**
   * Optional milestone stage override
   */
  milestoneStage?: string;
  /**
   * Optional win probability score override (0.0 to 1.0 or 0 to 100)
   */
  winProbability?: number;
  /**
   * Optional deal age in days override
   */
  ageInDays?: number;
  /**
   * Optional callback triggered when user clicks/selects the deal card
   */
  onSelect?: (deal: DealResponse) => void;
  /**
   * Visual indication if the card is currently being dragged
   */
  isDragging?: boolean;
  /**
   * Additional CSS class names
   */
  className?: string;
}

/**
 * Helper to format numeric deal value into USD currency format ($50,000 or $0).
 */
export function formatDealValue(val?: number | null): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '$0';
  }
  const rounded = Math.round(val * 100) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: rounded % 1 === 0 ? 0 : 2,
  }).format(rounded);
}

/**
 * Helper to format age in days into human readable string ("15 days", "1 day", "0 days").
 */
export function formatAgeInDays(age?: number | null): string {
  if (age === null || age === undefined || isNaN(age)) {
    return '0 days';
  }
  const days = Math.max(0, Math.round(age));
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/**
 * Helper to format win probability float (0.0 - 1.0 or 0 - 100) into clean percentage ("75%").
 */
export function formatWinProbability(prob?: number | null): string {
  if (prob === null || prob === undefined || isNaN(prob)) {
    return '0%';
  }
  let pct = prob;
  if (prob <= 1.0 && prob >= 0) {
    pct = prob * 100;
  }
  const rounded = Math.min(100, Math.max(0, Math.round(pct)));
  return `${rounded}%`;
}

/**
 * Helper to determine WCAG compliant status variant for win probability.
 */
export function getProbabilityVariant(prob?: number | null): 'success' | 'warning' | 'neutral' {
  if (prob === null || prob === undefined || isNaN(prob)) {
    return 'neutral';
  }
  let pct = prob;
  if (prob <= 1.0 && prob >= 0) {
    pct = prob * 100;
  }
  if (pct >= 70) return 'success';
  if (pct >= 40) return 'warning';
  return 'neutral';
}

/**
 * DealCard component rendering visual cards with deal value, age in days, and win probability score [FR-002].
 */
export const DealCard: React.FC<DealCardProps> = ({
  deal,
  id: propId,
  title: propTitle,
  dealValue: propDealValue,
  milestoneStage: propMilestoneStage,
  winProbability: propWinProbability,
  ageInDays: propAgeInDays,
  onSelect,
  isDragging = false,
  className,
  onClick,
  onKeyDown,
  ...restProps
}) => {
  // Resolve values from deal object or explicit props
  const resolvedId = propId ?? deal?.id ?? 'deal-card';
  const resolvedTitle = propTitle ?? deal?.title ?? 'Untitled Deal';
  const resolvedValue = propDealValue ?? deal?.deal_value ?? 0;
  const resolvedStage = propMilestoneStage ?? deal?.milestone_stage ?? 'Lead';
  const resolvedProbability = propWinProbability ?? deal?.win_probability ?? 0;
  const resolvedAge = propAgeInDays ?? deal?.age_in_days ?? 0;

  const formattedValue = formatDealValue(resolvedValue);
  const formattedAge = formatAgeInDays(resolvedAge);
  const formattedProbability = formatWinProbability(resolvedProbability);
  const probabilityVariant = getProbabilityVariant(resolvedProbability);

  const resolvedDealResponse: DealResponse = {
    id: resolvedId,
    title: resolvedTitle,
    deal_value: resolvedValue,
    milestone_stage: resolvedStage,
    win_probability: resolvedProbability,
    age_in_days: resolvedAge,
    created_on: deal?.created_on ?? new Date().toISOString(),
    updated_on: deal?.updated_on ?? new Date().toISOString(),
  };

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (onClick) {
        onClick(e);
      }
      if (onSelect) {
        onSelect(resolvedDealResponse);
      }
    },
    [onClick, onSelect, resolvedDealResponse]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (onKeyDown) {
        onKeyDown(e);
      }
      if ((e.key === 'Enter' || e.key === ' ') && onSelect) {
        e.preventDefault();
        onSelect(resolvedDealResponse);
      }
    },
    [onKeyDown, onSelect, resolvedDealResponse]
  );

  const isInteractive = Boolean(onSelect || onClick);

  return (
    <div
      data-testid="deal-card"
      data-deal-id={resolvedId}
      role={isInteractive ? 'button' : 'article'}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={`Deal: ${resolvedTitle}, Value: ${formattedValue}, Age: ${formattedAge}, Win Probability: ${formattedProbability}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={twMerge(
        clsx(
          'group relative flex flex-col justify-between p-4 rounded-lg bg-white border border-[#d1c4b9] shadow-sm transition-all duration-200',
          isInteractive && 'cursor-pointer hover:border-[#80756b] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:ring-offset-2',
          isDragging && 'opacity-50 border-dashed border-[#735c41] shadow-lg scale-95',
          className
        )
      )}
      {...restProps}
    >
      {/* Header: Title and Stage Tag */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h4
          data-testid="deal-title"
          className="font-medium text-[#1b1c19] text-base leading-snug line-clamp-2 group-hover:text-[#59452b] transition-colors"
        >
          {resolvedTitle}
        </h4>
        {resolvedStage && (
          <span
            data-testid="deal-stage"
            className="inline-flex items-center gap-1 text-[11px] font-medium tracking-wider uppercase px-2 py-0.5 rounded bg-[#f5f3ee] text-[#4e453d] whitespace-nowrap border border-[#e4e2dd]"
          >
            <Tag className="w-3 h-3 text-[#80756b]" aria-hidden="true" />
            {resolvedStage}
          </span>
        )}
      </div>

      {/* Main Metric: Deal Value [FR-002] */}
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wider text-[#4e453d] font-medium mb-0.5 flex items-center gap-1">
          <DollarSign className="w-3 h-3 text-[#735c41]" aria-hidden="true" />
          <span>Value</span>
        </div>
        <div
          data-testid="deal-value"
          className="text-xl font-bold text-[#59452b] tracking-tight"
        >
          {formattedValue}
        </div>
      </div>

      {/* Card Footer: Age in Days & Win Probability [FR-002] */}
      <div className="pt-3 border-t border-[#f0eee9] flex items-center justify-between gap-2 text-xs">
        {/* Deal Age */}
        <div
          data-testid="deal-age"
          className="flex items-center gap-1.5 text-[#4e453d] bg-[#f5f3ee] px-2.5 py-1 rounded-md border border-[#e4e2dd]"
          title={`Deal age: ${formattedAge}`}
        >
          <Clock className="w-3.5 h-3.5 text-[#80756b]" aria-hidden="true" />
          <span className="font-medium">{formattedAge}</span>
        </div>

        {/* Win Probability Score */}
        <div
          data-testid="deal-probability"
          className="flex items-center gap-1"
          title={`Win probability: ${formattedProbability}`}
        >
          <StatusLabel
            status={probabilityVariant}
            label={`Score: ${formattedProbability}`}
            variant={probabilityVariant}
            showIcon={true}
          />
        </div>
      </div>
    </div>
  );
};

export default DealCard;
