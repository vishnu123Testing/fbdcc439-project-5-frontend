import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  ForecastWidget,
  formatEstimatedCloseDate,
  formatConfidenceScore,
  getConfidenceRating,
  formatLastCalculated,
  getForecastStatusMeta,
} from '../../../src/components/pipeline/ForecastWidget';
import * as dealsService from '../../../src/services/deals';
import { ForecastResponse } from '../../../src/services/deals';

describe('ForecastWidget Component [FR-8, FR-9, NFR-2]', () => {
  const mockDealId = 'deal-999';

  const readyForecast: ForecastResponse = {
    id: 'f-1',
    deal_id: mockDealId,
    estimated_completion_date: '2026-11-15T00:00:00Z',
    confidence_score_pct: 85.5,
    status_code: 'READY',
    calculated_on: '2026-10-10T12:00:00Z',
    is_sparse: false,
    error_detail: null,
  };

  const sparseForecast: ForecastResponse = {
    id: 'f-2',
    deal_id: mockDealId,
    estimated_completion_date: null,
    confidence_score_pct: null,
    status_code: 'INSUFFICIENT_DATA',
    calculated_on: '2026-10-10T12:00:00Z',
    is_sparse: true,
    error_detail: 'Insufficient historical deal stage transitions in CRM.',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Formatting & Rating Helper Functions', () => {
    it('formatEstimatedCloseDate handles valid ISO date strings and nulls correctly [FR-8]', () => {
      expect(formatEstimatedCloseDate('2026-11-15T00:00:00Z')).toContain('2026');
      expect(formatEstimatedCloseDate('2026-11-15T00:00:00Z')).toContain('Nov');
      expect(formatEstimatedCloseDate(null)).toBe('Not estimated');
      expect(formatEstimatedCloseDate('')).toBe('Not estimated');
      expect(formatEstimatedCloseDate('invalid-date')).toBe('Not estimated');
    });

    it('formatConfidenceScore formats percentage values and handles missing scores [FR-9]', () => {
      expect(formatConfidenceScore(85.5)).toBe('85.5%');
      expect(formatConfidenceScore(90)).toBe('90%');
      expect(formatConfidenceScore(0)).toBe('0%');
      expect(formatConfidenceScore(null)).toBe('N/A');
      expect(formatConfidenceScore(undefined)).toBe('N/A');
    });

    it('getConfidenceRating categorizes score levels into High, Moderate, Low, and Insufficient [FR-9]', () => {
      const high = getConfidenceRating(85, 'READY');
      expect(high.label).toBe('High Confidence');
      expect(high.ratingLevel).toBe('High');
      expect(high.variant).toBe('success');

      const moderate = getConfidenceRating(60, 'READY');
      expect(moderate.label).toBe('Moderate Confidence');
      expect(moderate.ratingLevel).toBe('Moderate');
      expect(moderate.variant).toBe('warning');

      const low = getConfidenceRating(30, 'READY');
      expect(low.label).toBe('Low Confidence');
      expect(low.ratingLevel).toBe('Low');
      expect(low.variant).toBe('error');

      const insufficient = getConfidenceRating(null, 'INSUFFICIENT_DATA');
      expect(insufficient.label).toBe('Insufficient Data');
      expect(insufficient.ratingLevel).toBe('Insufficient');
      expect(insufficient.variant).toBe('neutral');
    });

    it('formatLastCalculated handles valid timestamps and empty strings', () => {
      expect(formatLastCalculated('2026-10-10T12:00:00Z')).toBeTruthy();
      expect(formatLastCalculated(null)).toBe('Never calculated');
      expect(formatLastCalculated('')).toBe('Never calculated');
    });

    it('getForecastStatusMeta maps READY, INSUFFICIENT_DATA, COMPUTING, and FAILED status codes', () => {
      const readyMeta = getForecastStatusMeta('READY', false);
      expect(readyMeta.isReady).toBe(true);
      expect(readyMeta.variant).toBe('success');

      const sparseMeta = getForecastStatusMeta('INSUFFICIENT_DATA', true);
      expect(sparseMeta.isSparse).toBe(true);
      expect(sparseMeta.variant).toBe('neutral');

      const computingMeta = getForecastStatusMeta('COMPUTING', false);
      expect(computingMeta.isComputing).toBe(true);
      expect(computingMeta.variant).toBe('info');

      const failedMeta = getForecastStatusMeta('FAILED', false);
      expect(failedMeta.isFailed).toBe(true);
      expect(failedMeta.variant).toBe('error');
    });
  });

  describe('Component Rendering with Pre-loaded Data', () => {
    it('renders READY forecast with estimated close date and confidence percentage score [FR-8, FR-9]', () => {
      render(
        <ForecastWidget
          dealId={mockDealId}
          initialData={readyForecast}
          autoFetch={false}
        />
      );

      expect(screen.getByTestId('forecast-widget')).toBeInTheDocument();
      expect(screen.getByText('AI Completion Forecast')).toBeInTheDocument();
      expect(screen.getByTestId('forecast-ready-view')).toBeInTheDocument();

      // Estimated Close Date Card
      const dateCard = screen.getByTestId('close-date-card');
      expect(dateCard).toBeInTheDocument();
      expect(dateCard).toHaveTextContent(/Nov 15, 2026|2026/);

      // Confidence Card
      const confidenceCard = screen.getByTestId('confidence-card');
      expect(confidenceCard).toBeInTheDocument();
      expect(confidenceCard).toHaveTextContent('85.5%');
      expect(screen.getByText('High Confidence')).toBeInTheDocument();
    });

    it('renders INSUFFICIENT_DATA forecast with sparse placeholders gracefully [FR-9]', () => {
      render(
        <ForecastWidget
          dealId={mockDealId}
          initialData={sparseForecast}
          autoFetch={false}
        />
      );

      expect(screen.getByTestId('insufficient-data-view')).toBeInTheDocument();
      expect(screen.getByText('Insufficient Historical Data')).toBeInTheDocument();

      // Check placeholder indicators
      const placeholders = screen.getAllByText('--');
      expect(placeholders.length).toBeGreaterThanOrEqual(2);

      expect(
        screen.getByText(/Insufficient historical deal stage transitions in CRM/)
      ).toBeInTheDocument();
    });
  });

  describe('Auto-Fetch and Recalculate Interactions [NFR-2]', () => {
    it('fetches forecast automatically on mount when autoFetch is true', async () => {
      const getForecastSpy = vi
        .spyOn(dealsService, 'getForecast')
        .mockResolvedValue(readyForecast);

      render(<ForecastWidget dealId={mockDealId} autoFetch={true} />);

      expect(screen.getByTestId('forecast-loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(getForecastSpy).toHaveBeenCalledWith(mockDealId);
        expect(screen.getByTestId('forecast-ready-view')).toBeInTheDocument();
      });
    });

    it('triggers forecast recalculation and updates metrics when Recalculate button is clicked [NFR-2]', async () => {
      const updatedForecast: ForecastResponse = {
        ...readyForecast,
        confidence_score_pct: 92.0,
        estimated_completion_date: '2026-11-20T00:00:00Z',
      };

      const recalculateSpy = vi
        .spyOn(dealsService, 'recalculateForecast')
        .mockResolvedValue(updatedForecast);

      const onUpdateMock = vi.fn();

      render(
        <ForecastWidget
          dealId={mockDealId}
          initialData={readyForecast}
          autoFetch={false}
          onUpdate={onUpdateMock}
        />
      );

      const recalcBtn = screen.getByRole('button', { name: /Recalculate forecast/i });
      expect(recalcBtn).toBeInTheDocument();

      fireEvent.click(recalcBtn);

      await waitFor(() => {
        expect(recalculateSpy).toHaveBeenCalledWith(mockDealId);
        expect(screen.getByText('92%')).toBeInTheDocument();
        expect(onUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
          confidence_score_pct: 92.0,
        }));
      });
    });

    it('displays error alert and retry button when fetch fails', async () => {
      const getForecastSpy = vi
        .spyOn(dealsService, 'getForecast')
        .mockRejectedValue(new Error('Network connection error'));

      render(<ForecastWidget dealId={mockDealId} autoFetch={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('forecast-error')).toBeInTheDocument();
        expect(screen.getByText('Network connection error')).toBeInTheDocument();
      });

      // Mock recovery on retry
      getForecastSpy.mockResolvedValue(readyForecast);

      const retryBtn = screen.getByRole('button', { name: /Retry/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByTestId('forecast-ready-view')).toBeInTheDocument();
      });
    });
  });
});

