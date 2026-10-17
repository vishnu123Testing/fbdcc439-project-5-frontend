'use client';

import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  HelpCircle,
  ListOrdered,
  Loader2,
  Check,
} from 'lucide-react';
import { PlaybookStep } from '../../services/knowledge';

/**
 * Properties for the PlaybookProgress component [FR-3, FR-4].
 */
export interface PlaybookProgressProps {
  /**
   * Optional title heading for the operational playbook [FR-3].
   */
  playbookTitle?: string;
  /**
   * Ordered array of playbook steps [FR-3].
   */
  steps: PlaybookStep[];
  /**
   * Array of IDs of steps that have been marked completed by the user [FR-3, FR-4].
   */
  completedStepIds?: string[];
  /**
   * Pre-calculated overall progress percentage (0 to 100) [FR-3, FR-4].
   * If omitted, calculated dynamically from completedStepIds and steps length.
   */
  overallProgressPercentage?: number;
  /**
   * Callback fired when user clicks to mark or unmark a step as completed [FR-4].
   */
  onToggleStep?: (stepId: string, currentCompleted: boolean) => Promise<void> | void;
  /**
   * ID of the step currently undergoing network progress state mutation [NFR-1].
   */
  isUpdatingStepId?: string | null;
  /**
   * Whether user interactions are disabled [FR-4].
   */
  disabled?: boolean;
  /**
   * Additional CSS class names.
   */
  className?: string;
}

/**
 * Reusable Visual Playbook Progress & Step Guide Component [FR-3, FR-4].
 *
 * Renders step-by-step operational guides with sequential navigation, progress bar,
 * checkpoint verification criteria, and step completion state toggles.
 */
export const PlaybookProgress: React.FC<PlaybookProgressProps> = ({
  playbookTitle,
  steps = [],
  completedStepIds = [],
  overallProgressPercentage,
  onToggleStep,
  isUpdatingStepId = null,
  disabled = false,
  className,
}) => {
  // Sort steps sequentially by step_number [FR-3]
  const sortedSteps = useMemo(() => {
    return [...steps].sort((a, b) => a.step_number - b.step_number);
  }, [steps]);

  // Set of completed step IDs for fast lookup
  const completedSet = useMemo(() => {
    return new Set(completedStepIds);
  }, [completedStepIds]);

  // Calculate completion statistics [FR-3, FR-4]
  const totalSteps = sortedSteps.length;
  const completedCount = sortedSteps.filter((s) => completedSet.has(s.id)).length;
  const calculatedPercentage = useMemo(() => {
    if (typeof overallProgressPercentage === 'number') {
      return Math.min(100, Math.max(0, Math.round(overallProgressPercentage)));
    }
    if (totalSteps === 0) return 0;
    return Math.round((completedCount / totalSteps) * 100);
  }, [overallProgressPercentage, completedCount, totalSteps]);

  // Track currently expanded / selected step index for sequential step-by-step navigation
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  // Navigate to previous step
  const handlePrevStep = () => {
    setActiveStepIndex((prev) => Math.max(0, prev - 1));
  };

  // Navigate to next step
  const handleNextStep = () => {
    setActiveStepIndex((prev) => Math.min(totalSteps - 1, prev + 1));
  };

  // Handle step completion checkmark click [FR-4]
  const handleStepToggleClick = async (stepId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !onToggleStep || isUpdatingStepId === stepId) {
      return;
    }
    const isCompleted = completedSet.has(stepId);
    await onToggleStep(stepId, isCompleted);
  };

  if (totalSteps === 0) {
    return (
      <div
        data-testid="playbook-progress-empty"
        className={twMerge(
          'p-6 bg-[#fbf9f4] border border-[#d1c4b9] rounded-md text-center text-[#4e453d]',
          className
        )}
      >
        <ListOrdered className="h-8 w-8 text-[#80756b] mx-auto mb-2" />
        <p className="text-sm font-medium">No playbook steps available for this guide.</p>
      </div>
    );
  }

  return (
    <div
      data-testid="playbook-progress-container"
      className={twMerge('space-y-6 text-[#1b1c19]', className)}
    >
      {/* Playbook Header & Progress Overview Card [FR-3, FR-4] */}
      <div
        data-testid="playbook-header-card"
        className="bg-[#fbf9f4] border border-[#d1c4b9] rounded-md p-5 space-y-4 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            {playbookTitle && (
              <h3 className="font-serif text-lg font-semibold text-[#1b1c19]">
                {playbookTitle}
              </h3>
            )}
            <p className="text-xs text-[#4e453d] flex items-center gap-1.5 mt-0.5">
              <ListOrdered className="h-3.5 w-3.5 text-[#735c41]" />
              <span>
                Sequential Operational Guide ({completedCount} of {totalSteps} steps completed)
              </span>
            </p>
          </div>

          <div
            data-testid="progress-badge"
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-semibold self-start sm:self-auto flex items-center gap-1.5',
              calculatedPercentage === 100
                ? 'bg-[#59452b] text-[#ffffff]'
                : 'bg-[#f0eee9] text-[#735c41] border border-[#d1c4b9]'
            )}
          >
            {calculatedPercentage === 100 ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            <span>{calculatedPercentage}% Completed</span>
          </div>
        </div>

        {/* Visual Completion Progress Bar [FR-3] */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium text-[#4e453d]">
            <span>Progress Indicator</span>
            <span>{calculatedPercentage}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={calculatedPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Playbook step completion progress"
            data-testid="playbook-progress-bar"
            className="w-full h-3 bg-[#e4e2dd] rounded-full overflow-hidden p-0.5 border border-[#d1c4b9]"
          >
            <div
              className="h-full bg-[#735c41] rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${calculatedPercentage}%` }}
            />
          </div>
        </div>

        {/* Step Jump Navigation Bar [FR-3] */}
        <div className="flex items-center justify-between pt-2 border-t border-[#d1c4b9] text-xs">
          <button
            type="button"
            data-testid="prev-step-btn"
            onClick={handlePrevStep}
            disabled={activeStepIndex === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#4e453d] disabled:opacity-40 disabled:cursor-not-allowed border border-[#d1c4b9] transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Previous Step</span>
          </button>

          <span className="text-xs font-medium text-[#4e453d]" data-testid="step-counter-text">
            Step {activeStepIndex + 1} of {totalSteps}
          </span>

          <button
            type="button"
            data-testid="next-step-btn"
            onClick={handleNextStep}
            disabled={activeStepIndex === totalSteps - 1}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#4e453d] disabled:opacity-40 disabled:cursor-not-allowed border border-[#d1c4b9] transition-colors"
          >
            <span>Next Step</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Sequential Step List View [FR-3, FR-4] */}
      <div className="space-y-4" data-testid="steps-list">
        {sortedSteps.map((step, idx) => {
          const isCompleted = completedSet.has(step.id);
          const isActive = idx === activeStepIndex;
          const isUpdating = isUpdatingStepId === step.id;

          return (
            <div
              key={step.id}
              data-testid={`step-item-${step.id}`}
              onClick={() => setActiveStepIndex(idx)}
              className={clsx(
                'rounded-md border p-4 sm:p-5 transition-all duration-200 cursor-pointer',
                isActive
                  ? 'bg-[#ffffff] border-[#735c41] ring-1 ring-[#735c41] shadow-md'
                  : 'bg-[#fbf9f4] border-[#d1c4b9] hover:bg-[#f5f3ee]'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Step Header */}
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      isCompleted
                        ? 'bg-[#59452b] text-[#ffffff]'
                        : isActive
                        ? 'bg-[#735c41] text-[#ffffff]'
                        : 'bg-[#e4e2dd] text-[#4e453d]'
                    )}
                  >
                    {step.step_number}
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-[#1b1c19] flex items-center gap-2">
                      <span>{step.title}</span>
                      {isCompleted && (
                        <span
                          data-testid={`step-completed-badge-${step.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#59452b] bg-[#f5d6b4] px-2 py-0.5 rounded-full"
                        >
                          <Check className="h-3 w-3" /> Completed
                        </span>
                      )}
                    </h4>
                  </div>
                </div>

                {/* Step Completion Toggle Button [FR-4] */}
                <button
                  type="button"
                  data-testid={`step-toggle-${step.id}`}
                  onClick={(e) => handleStepToggleClick(step.id, e)}
                  disabled={disabled || isUpdating}
                  aria-label={
                    isCompleted
                      ? `Mark step ${step.step_number} as incomplete`
                      : `Mark step ${step.step_number} as complete`
                  }
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0 border',
                    isCompleted
                      ? 'bg-[#f0eee9] hover:bg-[#eae8e3] text-[#59452b] border-[#d1c4b9]'
                      : 'bg-[#735c41] hover:bg-[#59452b] text-[#ffffff] border-transparent shadow-sm',
                    (disabled || isUpdating) && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#735c41]" />
                  ) : isCompleted ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-[#59452b]" />
                      <span>Completed</span>
                    </>
                  ) : (
                    <>
                      <Circle className="h-4 w-4" />
                      <span>Mark Complete</span>
                    </>
                  )}
                </button>
              </div>

              {/* Step Content / Body Instructions [FR-3] */}
              <div className="mt-3 text-sm text-[#4e453d] leading-relaxed pl-10 space-y-3">
                <div className="whitespace-pre-wrap">{step.content}</div>

                {/* Checkpoint Verification Instructions [FR-3] */}
                {step.checkpoint_instructions && (
                  <div
                    data-testid={`checkpoint-${step.id}`}
                    className="p-3 bg-[#f5f3ee] border-l-4 border-[#735c41] rounded-r text-xs text-[#1b1c19] space-y-1"
                  >
                    <div className="font-semibold text-[#735c41] flex items-center gap-1">
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>Checkpoint Verification:</span>
                    </div>
                    <p className="text-[#4e453d]">{step.checkpoint_instructions}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlaybookProgress;
