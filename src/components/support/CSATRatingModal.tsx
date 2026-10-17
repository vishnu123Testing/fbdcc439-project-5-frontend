'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Star,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageSquare,
  Smile,
  Frown,
  Meh,
  ThumbsUp,
  Heart,
} from 'lucide-react';
import {
  CSATRatingResponse,
  CSATRating,
  CSATRatingCreateRequest,
  supportService,
  sanitizeString,
} from '../../services/support';

/**
 * Returns a human-readable descriptive label for a CSAT score (1 to 5) [FR-9].
 */
export function getCSATScoreLabel(score: number): string {
  switch (score) {
    case 1:
      return '1 - Very Dissatisfied';
    case 2:
      return '2 - Dissatisfied';
    case 3:
      return '3 - Neutral';
    case 4:
      return '4 - Satisfied';
    case 5:
      return '5 - Very Satisfied';
    default:
      return 'Select a rating (1 to 5 stars)';
  }
}

/**
 * Validation result object for CSAT survey ratings [FR-9, NFR-2].
 */
export interface CSATValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Validates CSAT rating score and feedback text constraints [FR-9, NFR-2].
 */
export function validateCSATSubmission(
  score: number,
  feedbackText?: string
): CSATValidationResult {
  if (!score || score < 1 || score > 5) {
    return {
      isValid: false,
      errorMessage: 'Please select a rating score between 1 and 5 stars.',
    };
  }
  if (feedbackText && feedbackText.length > 1000) {
    return {
      isValid: false,
      errorMessage: 'Feedback comment cannot exceed 1000 characters.',
    };
  }
  return { isValid: true };
}

/**
 * Properties for the CSATRatingModal component [FR-9, NFR-2, NFR-4].
 */
export interface CSATRatingModalProps {
  /**
   * Controls modal visibility state.
   */
  isOpen: boolean;
  /**
   * Unique ID of the resolved support ticket being rated [FR-9].
   */
  ticketId?: string;
  /**
   * Subject line or title of the ticket for user context.
   */
  ticketSubject?: string;
  /**
   * Callback fired when modal is closed or dismissed.
   */
  onClose: () => void;
  /**
   * Optional custom submission handler. Invoked with score (1-5) and sanitized feedback [FR-9].
   */
  onSubmit?: (score: number, feedbackText?: string) => Promise<void> | void;
  /**
   * Callback fired upon successful CSAT rating submission [FR-9].
   */
  onSubmitSuccess?: (rating: CSATRatingResponse) => void;
  /**
   * Initial or existing CSAT rating record if ticket was previously rated [FR-9].
   */
  initialRating?: CSATRatingResponse | CSATRating | null;
  /**
   * Pre-selected rating score (1-5) for prefilling.
   */
  initialScore?: number;
  /**
   * Pre-filled feedback comment text.
   */
  initialFeedback?: string;
  /**
   * Read-only display mode for submitted survey results.
   */
  readOnly?: boolean;
  /**
   * Whether component controls are disabled.
   */
  disabled?: boolean;
  /**
   * Additional custom CSS class names.
   */
  className?: string;
}

/**
 * Interactive CSAT survey rating modal component [FR-9].
 * Enables clients to rate resolved support tickets on a 1–5 star scale with feedback.
 */
export const CSATRatingModal: React.FC<CSATRatingModalProps> = ({
  isOpen,
  ticketId,
  ticketSubject,
  onClose,
  onSubmit,
  onSubmitSuccess,
  initialRating,
  initialScore,
  initialFeedback,
  readOnly = false,
  disabled = false,
  className,
}) => {
  const [score, setScore] = useState<number>(() => {
    if (initialRating?.score && initialRating.score >= 1 && initialRating.score <= 5) {
      return initialRating.score;
    }
    if (initialScore && initialScore >= 1 && initialScore <= 5) {
      return initialScore;
    }
    return 0;
  });

  const [hoverScore, setHoverScore] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState<string>(() => {
    return initialRating?.feedback_text || initialFeedback || '';
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [submittedRating, setSubmittedRating] = useState<CSATRatingResponse | null>(
    (initialRating as CSATRatingResponse) || null
  );

  // Sync state when modal opens or initial props change
  useEffect(() => {
    if (isOpen) {
      const initS = initialRating?.score || initialScore || 0;
      setScore(initS >= 1 && initS <= 5 ? initS : 0);
      setHoverScore(0);
      setFeedbackText(initialRating?.feedback_text || initialFeedback || '');
      setSubmitError(null);
      setSubmitSuccess(Boolean(initialRating && readOnly));
      setSubmittedRating((initialRating as CSATRatingResponse) || null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialRating, initialScore, initialFeedback, readOnly]);

  // Handle Escape key navigation for accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const activeDisplayScore = hoverScore > 0 ? hoverScore : score;

  const scoreLabelText = useMemo(() => {
    return getCSATScoreLabel(activeDisplayScore);
  }, [activeDisplayScore]);

  const isFormDisabled = disabled || isSubmitting || readOnly || submitSuccess;

  const handleStarClick = (selected: number) => {
    if (isFormDisabled) return;
    setScore(selected);
    setSubmitError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (isFormDisabled) return;

    const validation = validateCSATSubmission(score, feedbackText);
    if (!validation.isValid) {
      setSubmitError(validation.errorMessage || 'Invalid submission.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const cleanFeedback = sanitizeString(feedbackText);

    try {
      let ratingResult: CSATRatingResponse;

      if (onSubmit) {
        await onSubmit(score, cleanFeedback);
        ratingResult = {
          id: `csat-${Date.now()}`,
          ticket_id: ticketId || '',
          score,
          feedback_text: cleanFeedback || null,
          submitted_at: new Date().toISOString(),
        };
      } else if (ticketId) {
        ratingResult = await supportService.submitCSATRating(ticketId, {
          score,
          feedback_text: cleanFeedback,
        });
      } else {
        ratingResult = {
          id: `csat-${Date.now()}`,
          ticket_id: 'standalone',
          score,
          feedback_text: cleanFeedback || null,
          submitted_at: new Date().toISOString(),
        };
      }

      setSubmittedRating(ratingResult);
      setSubmitSuccess(true);
      if (onSubmitSuccess) {
        onSubmitSuccess(ratingResult);
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to submit survey rating. Please try again.';
      setSubmitError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      data-testid="csat-rating-modal"
      className={twMerge(
        'fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/50 backdrop-blur-xs transition-opacity duration-200',
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="csat-modal-title"
      aria-describedby="csat-modal-description"
    >
      {/* Modal Backdrop overlay */}
      <div
        data-testid="csat-modal-backdrop"
        className="fixed inset-0"
        onClick={() => {
          if (!isSubmitting) {
            onClose();
          }
        }}
      />

      {/* Modal Container Card */}
      <div
        data-testid="csat-modal-card"
        className="relative z-10 w-full max-w-lg rounded-xl bg-[#fbf9f4] border border-[#d1c4b9] shadow-xl overflow-hidden transition-all text-[#1b1c19]"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 sm:p-6 border-b border-[#e4e2dd] bg-[#f5f3ee]">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-[#59452b]/10 text-[#59452b]">
                <Heart className="w-5 h-5 fill-[#59452b]/20" />
              </span>
              <h2
                id="csat-modal-title"
                data-testid="csat-modal-title"
                className="text-xl font-serif font-medium text-[#1b1c19]"
              >
                {readOnly ? 'Customer Satisfaction Survey' : 'Rate Your Experience'}
              </h2>
            </div>
            <p
              id="csat-modal-description"
              data-testid="csat-modal-subtitle"
              className="mt-1 text-sm text-[#4e453d]"
            >
              {ticketSubject ? (
                <span>
                  Ticket Context: <strong className="font-medium text-[#1b1c19]">{ticketSubject}</strong>
                </span>
              ) : (
                'How satisfied were you with the support resolution provided?'
              )}
            </p>
          </div>

          <button
            type="button"
            data-testid="csat-modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close CSAT modal"
            className="p-1.5 rounded-lg text-[#80756b] hover:text-[#1b1c19] hover:bg-[#eae8e3] transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#59452b]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* Error Banner */}
          {submitError && (
            <div
              data-testid="csat-error-banner"
              className="p-3.5 rounded-lg bg-[#ffdad6] text-[#93000a] text-sm flex items-start gap-2.5 border border-[#ba1a1a]/20"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 shrink-0 text-[#ba1a1a] mt-0.5" />
              <span className="font-medium">{submitError}</span>
            </div>
          )}

          {/* Success View */}
          {submitSuccess ? (
            <div
              data-testid="csat-success-view"
              className="text-center py-4 space-y-4"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-[#59452b]/10 flex items-center justify-center text-[#59452b]">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg font-medium text-[#1b1c19]">
                  Thank You for Your Feedback!
                </h3>
                <p className="text-sm text-[#4e453d] mt-1">
                  Your rating helps us continuously improve our service quality.
                </p>
              </div>

              {/* Submitted Score Summary */}
              <div className="p-4 rounded-lg bg-[#f0eee9] border border-[#e4e2dd] inline-block w-full text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider font-semibold text-[#80756b]">
                    Submitted Rating
                  </span>
                  {submittedRating?.submitted_at && (
                    <span className="text-xs text-[#80756b]">
                      {new Date(submittedRating.submitted_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center text-amber-500">
                    {[1, 2, 3, 4, 5].map((starVal) => (
                      <Star
                        key={starVal}
                        className={clsx(
                          'w-5 h-5',
                          starVal <= (submittedRating?.score || score)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-gray-300'
                        )}
                      />
                    ))}
                  </div>
                  <span
                    data-testid="csat-readonly-badge"
                    className="text-sm font-semibold text-[#1b1c19]"
                  >
                    {submittedRating?.score || score} / 5 Stars
                  </span>
                </div>

                <p className="text-xs font-medium text-[#59452b]">
                  {getCSATScoreLabel(submittedRating?.score || score)}
                </p>

                {(submittedRating?.feedback_text || feedbackText) && (
                  <div className="mt-2 pt-2 border-t border-[#d1c4b9]/50">
                    <span className="text-xs text-[#80756b] block">Feedback Comment:</span>
                    <p className="text-sm text-[#1b1c19] italic mt-0.5">
                      "{submittedRating?.feedback_text || feedbackText}"
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  data-testid="csat-success-close-btn"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#59452b] text-white font-medium hover:bg-[#735c41] transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#59452b] focus:ring-offset-2"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* CSAT Rating Entry Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Star Rating Selector */}
              <div className="space-y-2 text-center">
                <label className="block text-sm font-medium text-[#1b1c19]">
                  Overall Rating <span className="text-[#ba1a1a]">*</span>
                </label>

                <div
                  data-testid="csat-star-picker"
                  className="flex items-center justify-center gap-2 py-2"
                  onMouseLeave={() => setHoverScore(0)}
                >
                  {[1, 2, 3, 4, 5].map((starIndex) => {
                    const isFilled = starIndex <= activeDisplayScore;
                    return (
                      <button
                        key={starIndex}
                        type="button"
                        data-testid={`csat-star-button-${starIndex}`}
                        onClick={() => handleStarClick(starIndex)}
                        onMouseEnter={() => !isFormDisabled && setHoverScore(starIndex)}
                        disabled={isFormDisabled}
                        aria-label={`Rate ${starIndex} star${starIndex > 1 ? 's' : ''} - ${getCSATScoreLabel(starIndex)}`}
                        aria-pressed={score === starIndex}
                        className={clsx(
                          'p-1.5 rounded-lg transition-all focus:outline-hidden focus:ring-2 focus:ring-[#59452b]',
                          isFormDisabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:scale-110'
                        )}
                      >
                        <Star
                          className={clsx(
                            'w-8 h-8 transition-colors',
                            isFilled
                              ? 'fill-amber-400 text-amber-400 drop-shadow-xs'
                              : 'text-[#d1c4b9] hover:text-amber-300'
                          )}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Score Description Label */}
                <div
                  data-testid="csat-score-label"
                  className="text-sm font-medium h-5 text-[#59452b]"
                >
                  {scoreLabelText}
                </div>
              </div>

              {/* Feedback Comment Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="csat-feedback-input"
                    className="block text-xs uppercase tracking-wider font-semibold text-[#80756b]"
                  >
                    Additional Comments (Optional)
                  </label>
                  <span
                    data-testid="csat-char-counter"
                    className={clsx(
                      'text-xs',
                      feedbackText.length > 1000 ? 'text-[#ba1a1a] font-semibold' : 'text-[#80756b]'
                    )}
                  >
                    {feedbackText.length} / 1000
                  </span>
                </div>

                <textarea
                  id="csat-feedback-input"
                  data-testid="csat-feedback-textarea"
                  rows={4}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  disabled={isFormDisabled}
                  maxLength={1000}
                  placeholder="Share details on your support experience, promptness, or resolution quality..."
                  className={clsx(
                    'w-full p-3 rounded-lg border text-sm bg-white text-[#1b1c19] placeholder-[#80756b]/60 focus:outline-hidden transition-all',
                    'border-[#d1c4b9] focus:border-[#59452b] focus:ring-1 focus:ring-[#59452b]',
                    isFormDisabled && 'bg-[#f5f3ee] cursor-not-allowed text-[#80756b]'
                  )}
                />
              </div>

              {/* Action Buttons Footer */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#e4e2dd]">
                <button
                  type="button"
                  data-testid="csat-cancel-btn"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg border border-[#d1c4b9] text-[#59452b] font-medium hover:bg-[#f0eee9] transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#59452b]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  data-testid="csat-submit-btn"
                  disabled={isFormDisabled || score === 0}
                  className={clsx(
                    'px-5 py-2 rounded-lg bg-[#59452b] text-white font-medium flex items-center justify-center gap-2 transition-colors',
                    'focus:outline-hidden focus:ring-2 focus:ring-[#59452b] focus:ring-offset-2',
                    (isFormDisabled || score === 0)
                      ? 'opacity-50 cursor-not-allowed bg-[#80756b]'
                      : 'hover:bg-[#735c41]'
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Rating</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CSATRatingModal;
