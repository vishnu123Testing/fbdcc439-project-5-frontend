import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  ARAgingChart,
  formatCurrency,
  formatPercentage,
  calculateBucketPercentage,
  isSummaryEmpty,
  getBucketMeta,
  getBucketsList,
} from '../../../src/components/financial/ARAgingChart';
import * as financialService from '../../../src/services/financial';
import { ARAgingSummaryResponse } from '../../../src/services/financial';

describe('ARAgingChart Component [FR-4]', () => {
  const mockSummaryData: ARAgingSummaryResponse = {
    customer_id: 'cust-uuid-101',
    as_of_date_time: '2026-03-31T00:00:00Z',
    total_outstanding: 75000.0,
    total_invoices: 6,
    bucket_0_30: {
      bucket_name: '0-30',
      total_amount: 45000.0, // 60%
      invoice_count: 3,
    },
    bucket_31_60: {
      bucket_name: '31-60',
      total_amount: 15000.0, // 20%
      invoice_count: 1,
    },
    bucket_61_90: {
      bucket_name: '61-90',
      total_amount: 10000.0, // 13.33%
      invoice_count: 1,
    },
    bucket_90_plus: {
      bucket_name: '90+',
      total_amount: 5000.0, // 6.67%
      invoice_count: 1,
    },
  };

  const emptySummaryData: ARAgingSummaryResponse = {
    customer_id: 'cust-uuid-102',
    as_of_date_time: '2026-03-31T00:00:00Z',
    total_outstanding: 0.0,
    total_invoices: 0,
    bucket_0_30: { bucket_name: '0-30', total_amount: 0.0, invoice_count: 0 },
    bucket_31_60: { bucket_name: '31-60', total_amount: 0.0, invoice_count: 0 },
    bucket_61_90: { bucket_name: '61-90', total_amount: 0.0, invoice_count: 0 },
    bucket_90_plus: { bucket_name: '90+', total_amount: 0.0, invoice_count: 0 },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Helper Functions [FR-4]', () => {
    it('formatCurrency formats raw numbers into USD currency strings', () => {
      expect(formatCurrency(45000)).toBe('$45,000.00');
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(null)).toBe('$0.00');
      expect(formatCurrency(undefined)).toBe('$0.00');
      expect(formatCurrency(NaN)).toBe('$0.00');
    });

    it('formatPercentage formats numbers as percentage strings', () => {
      expect(formatPercentage(60.0)).toBe('60.0%');
      expect(formatPercentage(13.333)).toBe('13.3%');
      expect(formatPercentage(0)).toBe('0.0%');
      expect(formatPercentage(null)).toBe('0.0%');
      expect(formatPercentage(undefined)).toBe('0.0%');
    });

    it('calculateBucketPercentage handles division by zero safely', () => {
      expect(calculateBucketPercentage(45000, 75000)).toBe(60.0);
      expect(calculateBucketPercentage(0, 75000)).toBe(0);
      expect(calculateBucketPercentage(100, 0)).toBe(0);
      expect(calculateBucketPercentage(null, 75000)).toBe(0);
    });

    it('isSummaryEmpty correctly identifies zero-data empty state', () => {
      expect(isSummaryEmpty(emptySummaryData)).toBe(true);
      expect(isSummaryEmpty(mockSummaryData)).toBe(false);
      expect(isSummaryEmpty(null)).toBe(true);
      expect(isSummaryEmpty(undefined)).toBe(true);
    });

    it('getBucketMeta returns correct metadata and styling for each duration bucket', () => {
      const meta0_30 = getBucketMeta('0-30');
      expect(meta0_30.title).toBe('0-30 Days');
      expect(meta0_30.tier).toBe('low');

      const meta31_60 = getBucketMeta('31-60');
      expect(meta31_60.title).toBe('31-60 Days');
      expect(meta31_60.tier).toBe('moderate');

      const meta61_90 = getBucketMeta('61-90');
      expect(meta61_90.title).toBe('61-90 Days');
      expect(meta61_90.tier).toBe('high');

      const meta90 = getBucketMeta('90+');
      expect(meta90.title).toBe('90+ Days');
      expect(meta90.tier).toBe('critical');
    });

    it('getBucketsList transforms summary into 4 processed buckets', () => {
      const buckets = getBucketsList(mockSummaryData);
      expect(buckets).toHaveLength(4);
      expect(buckets[0].key).toBe('0-30');
      expect(buckets[0].amount).toBe(45000);
      expect(buckets[0].percentage).toBe(60);
      expect(buckets[3].key).toBe('90+');
      expect(buckets[3].amount).toBe(5000);
    });
  });

  describe('Component Rendering & Behavior [FR-4]', () => {
    it('renders visual AR aging chart with initial data for 0-30, 31-60, 61-90, 90+ duration buckets', () => {
      render(<ARAgingChart initialData={mockSummaryData} autoFetch={false} />);

      expect(screen.getByTestId('ar-aging-chart')).toBeInTheDocument();
      expect(screen.getByText('Accounts Receivable (AR) Aging')).toBeInTheDocument();

      // KPIs
      expect(screen.getByText('$75,000.00')).toBeInTheDocument(); // Total outstanding
      expect(screen.getByText('60.0%')).toBeInTheDocument(); // Current rate

      // 4 duration buckets
      expect(screen.getByTestId('ar-aging-bucket-0-30')).toBeInTheDocument();
      expect(screen.getByTestId('ar-aging-bucket-31-60')).toBeInTheDocument();
      expect(screen.getByTestId('ar-aging-bucket-61-90')).toBeInTheDocument();
      expect(screen.getByTestId('ar-aging-bucket-90+')).toBeInTheDocument();

      // Check amounts
      expect(screen.getByText('$45,000.00')).toBeInTheDocument();
      expect(screen.getByText('$15,000.00')).toBeInTheDocument();
      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
      expect(screen.getByText('$5,000.00')).toBeInTheDocument();
    });

    it('renders zero-data empty state when AR balances are empty [FR-4]', () => {
      render(<ARAgingChart initialData={emptySummaryData} autoFetch={false} />);

      expect(screen.getByTestId('ar-aging-empty-state')).toBeInTheDocument();
      expect(screen.getByText('No Outstanding Accounts Receivable')).toBeInTheDocument();

      // Bucket cards still render with $0.00
      expect(screen.getByTestId('ar-aging-bucket-0-30')).toBeInTheDocument();
      expect(screen.getByTestId('ar-aging-bucket-31-60')).toBeInTheDocument();
      expect(screen.getByTestId('ar-aging-bucket-61-90')).toBeInTheDocument();
      expect(screen.getByTestId('ar-aging-bucket-90+')).toBeInTheDocument();
    });

    it('allows toggling between visual chart view and table view', () => {
      render(<ARAgingChart initialData={mockSummaryData} autoFetch={false} />);

      const tableBtn = screen.getByLabelText('Table view');
      fireEvent.click(tableBtn);

      expect(screen.getByTestId('ar-aging-table-view')).toBeInTheDocument();
      expect(screen.getByText('Aging Duration Bucket')).toBeInTheDocument();

      const visualBtn = screen.getByLabelText('Visual view');
      fireEvent.click(visualBtn);

      expect(screen.getByTestId('ar-aging-bucket-grid')).toBeInTheDocument();
    });

    it('fires onSelectBucket callback when user clicks a duration bucket card', () => {
      const handleSelect = vi.fn();
      render(
        <ARAgingChart
          initialData={mockSummaryData}
          autoFetch={false}
          onSelectBucket={handleSelect}
        />
      );

      const bucket0_30Card = screen.getByTestId('ar-aging-bucket-0-30');
      fireEvent.click(bucket0_30Card);

      expect(handleSelect).toHaveBeenCalledWith(
        '0-30',
        expect.objectContaining({
          bucket_name: '0-30',
          total_amount: 45000.0,
          invoice_count: 3,
        })
      );
    });

    it('auto-fetches AR aging metrics when initialData is missing and autoFetch is true', async () => {
      const getARAgingSpy = vi
        .spyOn(financialService, 'getARAgingMetrics')
        .mockResolvedValueOnce(mockSummaryData);

      render(<ARAgingChart autoFetch={true} customerId="cust-123" />);

      await waitFor(() => {
        expect(getARAgingSpy).toHaveBeenCalledWith(
          expect.objectContaining({ customer_id: 'cust-123' })
        );
      });

      expect(screen.getByText('$75,000.00')).toBeInTheDocument();
    });

    it('handles manual refresh button clicks', async () => {
      const handleRefresh = vi.fn();
      const getARAgingSpy = vi
        .spyOn(financialService, 'getARAgingMetrics')
        .mockResolvedValueOnce(mockSummaryData);

      render(
        <ARAgingChart
          initialData={mockSummaryData}
          autoFetch={false}
          onRefresh={handleRefresh}
        />
      );

      const refreshBtn = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshBtn);

      expect(handleRefresh).toHaveBeenCalled();
      await waitFor(() => {
        expect(getARAgingSpy).toHaveBeenCalled();
      });
    });

    it('displays error state when fetching fails or error prop is passed', () => {
      render(
        <ARAgingChart
          initialData={null}
          autoFetch={false}
          error="Network error fetching financial metrics"
        />
      );

      expect(screen.getByTestId('ar-aging-error')).toBeInTheDocument();
      expect(
        screen.getByText('Network error fetching financial metrics')
      ).toBeInTheDocument();
    });
  });
});
