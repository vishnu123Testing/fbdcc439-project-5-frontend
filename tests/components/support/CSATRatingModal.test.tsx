import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  CSATRatingModal,
  getCSATScoreLabel,
  validateCSATSubmission,
} from '../../../src/components/support/CSATRatingModal';
import { supportService, CSATRatingResponse } from '../../../src/services/support';

describe('CSATRatingModal Helper Functions [FR-9]', () => {
  describe('getCSATScoreLabel', () => {
    it('returns correct rating descriptive labels for 1-5 scores', () => {
      expect(getCSATScoreLabel(1)).toBe('1 - Very Dissatisfied');
      expect(getCSATScoreLabel(2)).toBe('2 - Dissatisfied');
      expect(getCSATScoreLabel(3)).toBe('3 - Neutral');
      expect(getCSATScoreLabel(4)).toBe('4 - Satisfied');
      expect(getCSATScoreLabel(5)).toBe('5 - Very Satisfied');
      expect(getCSATScoreLabel(0)).toBe('Select a rating (1 to 5 stars)');
      expect(getCSATScoreLabel(6)).toBe('Select a rating (1 to 5 stars)');
    });
  });

  describe('validateCSATSubmission', () => {
    it('rejects missing or out-of-bounds scores', () => {
      expect(validateCSATSubmission(0).isValid).toBe(false);
      expect(validateCSATSubmission(0).errorMessage).toContain('between 1 and 5 stars');

      expect(validateCSATSubmission(-1).isValid).toBe(false);
      expect(validateCSATSubmission(6).isValid).toBe(false);
    });

    it('rejects feedback comments exceeding 1000 characters', () => {
      const longFeedback = 'a'.repeat(1001);
      const res = validateCSATSubmission(5, longFeedback);
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toContain('cannot exceed 1000 characters');
    });

    it('accepts valid score and optional feedback', () => {
      expect(validateCSATSubmission(5).isValid).toBe(true);
      expect(validateCSATSubmission(4, 'Great support service!').isValid).toBe(true);
    });
  });
});

describe('CSATRatingModal Component [FR-9, NFR-2, NFR-4]', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnSubmitSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render modal overlay when isOpen is false', () => {
    render(<CSATRatingModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByTestId('csat-rating-modal')).not.toBeInDocument();
  });

  it('renders modal overlay, header, stars, and controls when isOpen is true', () => {
    render(
      <CSATRatingModal
        isOpen={true}
        ticketId="sup-101"
        ticketSubject="RBAC Latency Query"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByTestId('csat-rating-modal')).toBeInDocument();
    expect(screen.getByTestId('csat-modal-title')).toHaveTextContent('Rate Your Experience');
    expect(screen.getByTestId('csat-modal-subtitle')).toHaveTextContent('RBAC Latency Query');
    expect(screen.getByTestId('csat-star-picker')).toBeInDocument();

    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`csat-star-button-${i}`)).toBeInDocument();
    }

    expect(screen.getByTestId('csat-score-label')).toHaveTextContent(
      'Select a rating (1 to 5 stars)'
    );
    expect(screen.getByTestId('csat-feedback-textarea')).toBeInDocument();
    expect(screen.getByTestId('csat-char-counter')).toHaveTextContent('0 / 1000');
    expect(screen.getByTestId('csat-cancel-btn')).toBeInDocument();
    expect(screen.getByTestId('csat-submit-btn')).toBeDisabled();
  });

  it('updates score selection and active score label on star button click', () => {
    render(<CSATRatingModal isOpen={true} onClose={mockOnClose} />);

    const star4 = screen.getByTestId('csat-star-button-4');
    fireEvent.click(star4);

    expect(screen.getByTestId('csat-score-label')).toHaveTextContent('4 - Satisfied');
    expect(screen.getByTestId('csat-submit-btn')).not.toBeDisabled();
  });

  it('previews hover score label on star mouse enter and resets on mouse leave', () => {
    render(<CSATRatingModal isOpen={true} onClose={mockOnClose} />);

    const star5 = screen.getByTestId('csat-star-button-5');
    fireEvent.mouseEnter(star5);

    expect(screen.getByTestId('csat-score-label')).toHaveTextContent('5 - Very Satisfied');

    const picker = screen.getByTestId('csat-star-picker');
    fireEvent.mouseLeave(picker);

    expect(screen.getByTestId('csat-score-label')).toHaveTextContent(
      'Select a rating (1 to 5 stars)'
    );
  });

  it('updates character count when typing feedback comment', () => {
    render(<CSATRatingModal isOpen={true} onClose={mockOnClose} />);

    const textarea = screen.getByTestId('csat-feedback-textarea');
    fireEvent.change(textarea, { target: { value: 'Quick and helpful support response!' } });

    expect(screen.getByTestId('csat-char-counter')).toHaveTextContent('36 / 1000');
  });

  it('submits rating via custom onSubmit prop and shows success screen', async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);

    render(
      <CSATRatingModal
        isOpen={true}
        ticketId="sup-101"
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onSubmitSuccess={mockOnSubmitSuccess}
      />
    );

    // Select 5 stars
    fireEvent.click(screen.getByTestId('csat-star-button-5'));

    // Enter feedback
    fireEvent.change(screen.getByTestId('csat-feedback-textarea'), {
      target: { value: 'Excellent support agent!' },
    });

    // Submit form
    fireEvent.click(screen.getByTestId('csat-submit-btn'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(5, 'Excellent support agent!');
      expect(mockOnSubmitSuccess).toHaveBeenCalled();
    });

    expect(screen.getByTestId('csat-success-view')).toBeInDocument();
    expect(screen.getByText('Thank You for Your Feedback!')).toBeInDocument();
    expect(screen.getByTestId('csat-readonly-badge')).toHaveTextContent('5 / 5 Stars');

    // Click done button
    fireEvent.click(screen.getByTestId('csat-success-close-btn'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('submits rating via supportService.submitCSATRating when onSubmit is not provided', async () => {
    const mockRatingRes: CSATRatingResponse = {
      id: 'csat-999',
      ticket_id: 'sup-102',
      score: 4,
      feedback_text: 'Good resolution timing.',
      submitted_at: new Date().toISOString(),
    };

    vi.spyOn(supportService, 'submitCSATRating').mockResolvedValueOnce(mockRatingRes);

    render(
      <CSATRatingModal
        isOpen={true}
        ticketId="sup-102"
        onClose={mockOnClose}
        onSubmitSuccess={mockOnSubmitSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('csat-star-button-4'));
    fireEvent.change(screen.getByTestId('csat-feedback-textarea'), {
      target: { value: 'Good resolution timing.' },
    });

    fireEvent.click(screen.getByTestId('csat-submit-btn'));

    await waitFor(() => {
      expect(supportService.submitCSATRating).toHaveBeenCalledWith('sup-102', {
        score: 4,
        feedback_text: 'Good resolution timing.',
      });
      expect(mockOnSubmitSuccess).toHaveBeenCalledWith(mockRatingRes);
    });

    expect(screen.getByTestId('csat-success-view')).toBeInDocument();
  });

  it('displays error banner when submission fails', async () => {
    mockOnSubmit.mockRejectedValueOnce(new Error('Network error submitting survey'));

    render(
      <CSATRatingModal
        isOpen={true}
        ticketId="sup-103"
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    fireEvent.click(screen.getByTestId('csat-star-button-3'));
    fireEvent.click(screen.getByTestId('csat-submit-btn'));

    await waitFor(() => {
      const errorBanner = screen.getByTestId('csat-error-banner');
      expect(errorBanner).toBeInDocument();
      expect(errorBanner).toHaveTextContent('Network error submitting survey');
    });

    expect(screen.queryByTestId('csat-success-view')).not.toBeInDocument();
  });

  it('renders existing submitted rating in read-only mode', () => {
    const existingRating: CSATRatingResponse = {
      id: 'csat-101',
      ticket_id: 'sup-101',
      score: 5,
      feedback_text: 'Outstanding turn-around time on ticket resolution.',
      submitted_at: '2026-03-22T10:00:00.000Z',
    };

    render(
      <CSATRatingModal
        isOpen={true}
        ticketId="sup-101"
        initialRating={existingRating}
        readOnly={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByTestId('csat-success-view')).toBeInDocument();
    expect(screen.getByTestId('csat-readonly-badge')).toHaveTextContent('5 / 5 Stars');
    expect(
      screen.getByText(/Outstanding turn-around time on ticket resolution/i)
    ).toBeInDocument();
  });

  it('closes modal when Escape key is pressed', () => {
    render(<CSATRatingModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when close icon button or cancel button is clicked', () => {
    render(<CSATRatingModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByTestId('csat-modal-close-btn'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('csat-cancel-btn'));
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });
});
