import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  QuickViewPanel,
  formatBreakdownValue,
  calculateBreakdownPercentage,
  DOMAIN_OPTIONS,
} from '../../src/components/dashboard/QuickViewPanel';
import { DomainQuickViewResponse } from '../../src/services/dashboard';

describe('QuickViewPanel Component', () => {
  const sampleLeadGenData: DomainQuickViewResponse = {
    domain: 'lead_gen',
    status: 'COMPLETE',
    detailed_metrics: [
      {
        domain: 'lead_gen',
        metric_key: 'lead_volume',
        display_name: 'Lead Volume',
        formatted_value: '1,450',
        raw_value: 1450,
        baseline_value: 1200,
        percentage_change: 20.83,
        status: 'VALID',
        unit: 'count',
        error_detail: null,
      },
      {
        domain: 'lead_gen',
        metric_key: 'conversion_rate',
        display_name: 'Conversion Rate',
        formatted_value: '4.2%',
        raw_value: 4.2,
        baseline_value: 3.5,
        percentage_change: 20.0,
        status: 'VALID',
        unit: 'percentage',
        error_detail: null,
      },
    ],
    breakdown_items: [
      { label: 'Organic Search', value: 600 },
      { label: 'Paid Search', value: 400 },
      { label: 'Referral', value: 300 },
      { label: 'Social Media', value: 150 },
    ],
    error_detail: null,
  };

  const sampleSalesData: DomainQuickViewResponse = {
    domain: 'sales_pipeline',
    status: 'COMPLETE',
    detailed_metrics: [
      {
        domain: 'sales_pipeline',
        metric_key: 'total_deal_value',
        display_name: 'Total Deal Value',
        formatted_value: '$1,250,000',
        raw_value: 1250000,
        baseline_value: 1000000,
        percentage_change: 25.0,
        status: 'VALID',
        unit: 'currency',
        error_detail: null,
      },
    ],
    breakdown_items: [
      { label: 'Discovery', value: 250000 },
      { label: 'Proposal', value: 500000 },
      { label: 'Negotiation', value: 500000 },
    ],
    error_detail: null,
  };

  const sampleSupportData: DomainQuickViewResponse = {
    domain: 'support',
    status: 'COMPLETE',
    detailed_metrics: [
      {
        domain: 'support',
        metric_key: 'open_tickets',
        display_name: 'Open Tickets',
        formatted_value: '42',
        raw_value: 42,
        baseline_value: 50,
        percentage_change: -16.0,
        status: 'VALID',
        unit: 'count',
        error_detail: null,
      },
      {
        domain: 'support',
        metric_key: 'avg_resolution_time',
        display_name: 'Resolution Time',
        formatted_value: '3.5 hrs',
        raw_value: 3.5,
        baseline_value: 4.0,
        percentage_change: -12.5,
        status: 'VALID',
        unit: 'ratio',
        error_detail: null,
      },
      {
        domain: 'support',
        metric_key: 'sla_compliance',
        display_name: 'SLA Compliance',
        formatted_value: '98.5%',
        raw_value: 98.5,
        baseline_value: 95.0,
        percentage_change: 3.68,
        status: 'VALID',
        unit: 'percentage',
        error_detail: null,
      },
    ],
    breakdown_items: [
      { label: 'Critical', value: 5 },
      { label: 'High', value: 12 },
      { label: 'Medium', value: 15 },
      { label: 'Low', value: 10 },
    ],
    error_detail: null,
  };

  const sampleFinancialsData: DomainQuickViewResponse = {
    domain: 'financials',
    status: 'COMPLETE',
    detailed_metrics: [
      {
        domain: 'financials',
        metric_key: 'recurring_revenue',
        display_name: 'Recurring Revenue',
        formatted_value: '$340,000',
        raw_value: 340000,
        baseline_value: 300000,
        percentage_change: 13.33,
        status: 'VALID',
        unit: 'currency',
        error_detail: null,
      },
      {
        domain: 'financials',
        metric_key: 'outstanding_invoices',
        display_name: 'Outstanding Invoices',
        formatted_value: '$15,000',
        raw_value: 15000,
        baseline_value: 20000,
        percentage_change: -25.0,
        status: 'VALID',
        unit: 'currency',
        error_detail: null,
      },
    ],
    breakdown_items: [
      { label: 'Subscriptions', value: 280000 },
      { label: 'Professional Services', value: 60000 },
      { label: 'Overdue Invoices', value: 0 },
    ],
    error_detail: null,
  };

  const sampleUnavailableData: DomainQuickViewResponse = {
    domain: 'support',
    status: 'UNAVAILABLE',
    detailed_metrics: [],
    breakdown_items: [],
    error_detail: 'Support service connector timed out after 5000ms',
  };

  it('renders dedicated quick-view section for Lead Generation metrics (FR-6)', () => {
    render(<QuickViewPanel domain="lead_gen" data={sampleLeadGenData} />);

    expect(screen.getByTestId('quickview-panel')).toBeInDocument();
    expect(screen.getByTestId('quickview-title')).toHaveTextContent('Lead Generation');
    expect(screen.getByTestId('quickview-subtitle')).toHaveTextContent(
      'Volume, conversion rates, and acquisition channel breakdowns.'
    );

    // Verify key metrics cards
    expect(screen.getByText('Lead Volume')).toBeInDocument();
    expect(screen.getByText('1,450')).toBeInDocument();
    expect(screen.getByText('Conversion Rate')).toBeInDocument();
    expect(screen.getByText('4.2%')).toBeInDocument();

    // Verify distribution breakdown items
    expect(screen.getByText('Organic Search')).toBeInDocument();
    expect(screen.getByText('Paid Search')).toBeInDocument();
  });

  it('renders dedicated quick-view section for Sales Pipeline metrics (FR-7)', () => {
    render(<QuickViewPanel domain="sales_pipeline" data={sampleSalesData} />);

    expect(screen.getByTestId('quickview-title')).toHaveTextContent('Sales Pipeline');
    expect(screen.getByText('Total Deal Value')).toBeInDocument();
    expect(screen.getByText('$1,250,000')).toBeInDocument();
    expect(screen.getByText('Discovery')).toBeInDocument();
    expect(screen.getByText('Proposal')).toBeInDocument();
  });

  it('renders dedicated quick-view section for Support Ticketing metrics (FR-8)', () => {
    render(<QuickViewPanel domain="support" data={sampleSupportData} />);

    expect(screen.getByTestId('quickview-title')).toHaveTextContent('Support Ticketing');
    expect(screen.getByText('Open Tickets')).toBeInDocument();
    expect(screen.getByText('42')).toBeInDocument();
    expect(screen.getByText('Resolution Time')).toBeInDocument();
    expect(screen.getByText('SLA Compliance')).toBeInDocument();
    expect(screen.getByText('Critical')).toBeInDocument();
  });

  it('renders dedicated quick-view section for Financial Summaries (FR-9)', () => {
    render(<QuickViewPanel domain="financials" data={sampleFinancialsData} />);

    expect(screen.getByTestId('quickview-title')).toHaveTextContent('Financial Summaries');
    expect(screen.getByText('Recurring Revenue')).toBeInDocument();
    expect(screen.getByText('$340,000')).toBeInDocument();
    expect(screen.getByText('Outstanding Invoices')).toBeInDocument();
    expect(screen.getByText('$15,000')).toBeInDocument();
    expect(screen.getByText('Overdue Invoices')).toBeInDocument();
    expect(screen.getByText('$0')).toBeInDocument();
  });

  it('renders loading state indicator when loading prop is true', () => {
    render(<QuickViewPanel domain="lead_gen" loading={true} />);

    expect(screen.getByTestId('quickview-loading')).toBeInDocument();
    expect(screen.getByText(/Loading quick-view metrics for Lead Generation/i)).toBeInDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders unavailable state and triggers onRetry callback when domain call fails', () => {
    const handleRetry = vi.fn();
    render(
      <QuickViewPanel
        domain="support"
        data={sampleUnavailableData}
        onRetry={handleRetry}
      />
    );

    expect(screen.getByTestId('quickview-unavailable')).toBeInDocument();
    expect(screen.getByTestId('quickview-error-detail')).toHaveTextContent(
      'Support service connector timed out after 5000ms'
    );

    const retryBtn = screen.getByTestId('quickview-retry-btn');
    expect(retryBtn).toBeInDocument();

    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledWith('support');
  });

  it('allows switching domain via tab buttons and triggers onDomainChange', () => {
    const handleDomainChange = vi.fn();
    render(
      <QuickViewPanel
        domain="lead_gen"
        data={sampleLeadGenData}
        onDomainChange={handleDomainChange}
      />
    );

    const financialsTab = screen.getByTestId('quickview-tab-financials');
    expect(financialsTab).toBeInDocument();

    fireEvent.click(financialsTab);
    expect(handleDomainChange).toHaveBeenCalledWith('financials');
  });

  it('renders empty breakdown state when breakdown_items is empty', () => {
    const emptyBreakdownData: DomainQuickViewResponse = {
      ...sampleLeadGenData,
      breakdown_items: [],
    };

    render(<QuickViewPanel domain="lead_gen" data={emptyBreakdownData} />);

    expect(screen.getByTestId('quickview-breakdown-empty')).toBeInDocument();
    expect(screen.getByTestId('quickview-breakdown-empty')).toHaveTextContent(
      'No distribution breakdown data available for Lead Generation.'
    );
  });

  it('does not render when isExpanded is false', () => {
    render(<QuickViewPanel domain="lead_gen" data={sampleLeadGenData} isExpanded={false} />);

    expect(screen.queryByTestId('quickview-panel')).not.toBeInDocument();
  });

  it('correctly calculates breakdown percentages and handles zero totals', () => {
    const items = [
      { label: 'A', value: 100 },
      { label: 'B', value: 300 },
    ];
    expect(calculateBreakdownPercentage(100, items)).toBe(25);
    expect(calculateBreakdownPercentage(300, items)).toBe(75);

    // Zero values
    const zeroItems = [
      { label: 'A', value: 0 },
      { label: 'B', value: 0 },
    ];
    expect(calculateBreakdownPercentage(0, zeroItems)).toBe(0);
    expect(calculateBreakdownPercentage(0, [])).toBe(0);
  });

  it('correctly formats breakdown values for currency, percentage, and counts', () => {
    expect(formatBreakdownValue(0, 'financials', 'Revenue')).toBe('$0');
    expect(formatBreakdownValue(15000, 'financials', 'Outstanding Invoices')).toBe('$15,000');
    expect(formatBreakdownValue(4.5, 'lead_gen', 'Conversion Rate')).toBe('4.5%');
    expect(formatBreakdownValue(125, 'support', 'Ticket Count')).toBe('125');
  });
});
