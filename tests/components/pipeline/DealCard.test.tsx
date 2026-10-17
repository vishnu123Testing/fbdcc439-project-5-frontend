import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  DealCard,
  formatDealValue,
  formatAgeInDays,
  formatWinProbability,
  getProbabilityVariant,
} from '../../../src/components/pipeline/DealCard';
import { DealResponse } from '../../../src/services/deals';

describe('DealCard Component [FR-002]', () => {
  const sampleDeal: DealResponse = {
    id: 'deal-123',
    title: 'Acme Enterprise SaaS Expansion',
    deal_value: 150000,
    milestone_stage: 'Proposal',
    win_probability: 0.75,
    age_in_days: 18,
    created_on: '2026-09-01T00:00:00Z',
    updated_on: '2026-09-18T00:00:00Z',
  };

  describe('Formatting Helpers', () => {
    it('formats numeric deal value correctly as USD currency', () => {
      expect(formatDealValue(150000)).toBe('$150,000');
      expect(formatDealValue(1250.5)).toBe('$1,250.50');
      expect(formatDealValue(0)).toBe('$0');
      expect(formatDealValue(null)).toBe('$0');
      expect(formatDealValue(undefined)).toBe('$0');
    });

    it('formats deal age in days correctly with singular/plural text', () => {
      expect(formatAgeInDays(18)).toBe('18 days');
      expect(formatAgeInDays(1)).toBe('1 day');
      expect(formatAgeInDays(0)).toBe('0 days');
      expect(formatAgeInDays(14.8)).toBe('15 days');
      expect(formatAgeInDays(null)).toBe('0 days');
    });

    it('formats win probability score correctly as percentage string', () => {
      expect(formatWinProbability(0.75)).toBe('75%');
      expect(formatWinProbability(75)).toBe('75%');
      expect(formatWinProbability(1.0)).toBe('100%');
      expect(formatWinProbability(0)).toBe('0%');
      expect(formatWinProbability(null)).toBe('0%');
    });

    it('returns appropriate WCAG status variant based on probability score', () => {
      expect(getProbabilityVariant(0.85)).toBe('success');
      expect(getProbabilityVariant(0.5)).toBe('warning');
      expect(getProbabilityVariant(0.2)).toBe('neutral');
      expect(getProbabilityVariant(null)).toBe('neutral');
    });
  });

  describe('Component Rendering', () => {
    it('renders deal title, deal value, age in days, and win probability score [FR-002 Scenario 1.1]', () => {
      render(<DealCard deal={sampleDeal} />);

      expect(screen.getByTestId('deal-card')).toBeInDocument();
      expect(screen.getByTestId('deal-title')).toHaveTextContent('Acme Enterprise SaaS Expansion');
      expect(screen.getByTestId('deal-value')).toHaveTextContent('$150,000');
      expect(screen.getByTestId('deal-age')).toHaveTextContent('18 days');
      expect(screen.getByTestId('deal-probability')).toHaveTextContent('Score: 75%');
      expect(screen.getByTestId('deal-stage')).toHaveTextContent('Proposal');
    });

    it('renders with explicit prop overrides when deal object is not fully provided', () => {
      render(
        <DealCard
          id="custom-456"
          title="Globex Logistics Renewal"
          dealValue={45000}
          milestoneStage="Negotiation"
          winProbability={0.6}
          ageInDays={7}
        />
      );

      expect(screen.getByTestId('deal-title')).toHaveTextContent('Globex Logistics Renewal');
      expect(screen.getByTestId('deal-value')).toHaveTextContent('$45,000');
      expect(screen.getByTestId('deal-age')).toHaveTextContent('7 days');
      expect(screen.getByTestId('deal-probability')).toHaveTextContent('Score: 60%');
      expect(screen.getByTestId('deal-stage')).toHaveTextContent('Negotiation');
    });

    it('triggers onSelect callback when card is clicked or keyboard navigated', () => {
      const handleSelect = vi.fn();
      render(<DealCard deal={sampleDeal} onSelect={handleSelect} />);

      const card = screen.getByTestId('deal-card');
      expect(card).toHaveAttribute('role', 'button');
      expect(card).toHaveAttribute('tabIndex', '0');

      fireEvent.click(card);
      expect(handleSelect).toHaveBeenCalledTimes(1);
      expect(handleSelect).toHaveBeenCalledWith(sampleDeal);

      fireEvent.keyDown(card, { key: 'Enter' });
      expect(handleSelect).toHaveBeenCalledTimes(2);

      fireEvent.keyDown(card, { key: ' ' });
      expect(handleSelect).toHaveBeenCalledTimes(3);
    });

    it('applies dragging visual style classes when isDragging is true', () => {
      render(<DealCard deal={sampleDeal} isDragging={true} />);

      const card = screen.getByTestId('deal-card');
      expect(card.className).toContain('opacity-50');
      expect(card.className).toContain('border-dashed');
    });
  });
});
