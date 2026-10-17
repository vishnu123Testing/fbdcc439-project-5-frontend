import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  MetricCard,
  formatDomainName,
  formatPercentageChange,
  formatBaselineValue,
  formatZeroMetricValue,
} from '../../src/components/dashboard/MetricCard';
import { MetricResponse } from '../../src/services/dashboard';

describe('MetricCard Component', () => {
  const sampleValidMetric: MetricResponse = {
    domain: 'lead_gen',
    metric_key: 'qualified_leads',
    display_name: 'Qualified Leads',
    formatted_value: '1,250',
    raw_value: 1250,
    baseline_value: 1000,
    percentage_change: 25.0,
    status: 'VALID',
    unit: 'count',
    error_detail: null,
  };

  const sampleZeroMetric: MetricResponse = {
    domain: 'financials',
    metric_key: 'churned_revenue',
    display_name: 'Churned Revenue',
    formatted_value: '$0',
    raw_value: 0,
    baseline_value: 0,
    percentage_change: 0,
    status: 'ZERO',
    unit: 'currency',
    error_detail: null,
  };

  const sampleUnavailableMetric: MetricResponse = {
    domain: 'support',
    metric_key: 'open_tickets',
    display_name: 'Open Tickets',
    formatted_value: 'Unavailable',
    raw_value: null,
    baseline_value: null,
    percentage_change: null,
    status: 'UNAVAILABLE',
    unit: 'count',
    error_detail: 'Support desk connector timeout after 5000ms',
  };

  it('renders active metric values and comparative percentage indicators for VALID state', () => {
    render(<MetricCard metric={sampleValidMetric} />);

    expect(screen.getByTestId('metric-card')).toBeInDocument();
    expect(screen.getByTestId('metric-domain')).toHaveTextContent('Lead Gen');
    expect(screen.getByTestId('metric-title')).toHaveTextContent('Qualified Leads');
    expect(screen.getByTestId('metric-value')).toHaveTextContent('1,250');
    expect(screen.getByTestId('metric-change')).toHaveTextContent('+25%');
    expect(screen.getByTestId('metric-baseline')).toHaveTextContent('vs prior (1,000)');
  });

  it('renders negative percentage change indicator with appropriate styling', () => {
    const negativeMetric: MetricResponse = {
      ...sampleValidMetric,
      percentage_change: -12.4,
    };

    render(<MetricCard metric={negativeMetric} />);

    const changeBadge = screen.getByTestId('metric-change');
    expect(changeBadge).toHaveTextContent('-12.4%');
  });

  it('renders explicit zero metric values for ZERO state without error styling', () => {
    render(<MetricCard metric={sampleZeroMetric} />);

    expect(screen.getByTestId('metric-value')).toHaveTextContent('$0');
    expect(screen.getByTestId('metric-domain')).toHaveTextContent('Financials');
    expect(screen.getByTestId('metric-title')).toHaveTextContent('Churned Revenue');

    const valueEl = screen.getByTestId('metric-value');
    expect(valueEl).not.toHaveClass('italic');
    expect(valueEl).toHaveClass('text-[#1b1c19]');
  });

  it('formats missing formatted_value explicitly as "$0", "0%", or "0" based on unit for zero state', () => {
    const zeroCurrencyMetric: MetricResponse = {
      domain: 'financials',
      metric_key: 'refunds',
      display_name: 'Refunds',
      formatted_value: '',
      raw_value: 0,
      baseline_value: 0,
      percentage_change: 0,
      status: 'ZERO',
      unit: 'currency',
      error_detail: null,
    };
    const { unmount: unmount1 } = render(<MetricCard metric={zeroCurrencyMetric} />);
    expect(screen.getByTestId('metric-value')).toHaveTextContent('$0');
    unmount1();

    const zeroPercentageMetric: MetricResponse = {
      domain: 'lead_gen',
      metric_key: 'bounce_rate',
      display_name: 'Bounce Rate',
      formatted_value: '',
      raw_value: 0,
      baseline_value: 0,
      percentage_change: 0,
      status: 'ZERO',
      unit: 'percentage',
      error_detail: null,
    };
    const { unmount: unmount2 } = render(<MetricCard metric={zeroPercentageMetric} />);
    expect(screen.getByTestId('metric-value')).toHaveTextContent('0%');
    unmount2();

    const zeroCountMetric: MetricResponse = {
      domain: 'support',
      metric_key: 'escalations',
      display_name: 'Escalations',
      formatted_value: '',
      raw_value: 0,
      baseline_value: 0,
      percentage_change: 0,
      status: 'ZERO',
      unit: 'count',
      error_detail: null,
    };
    render(<MetricCard metric={zeroCountMetric} />);
    expect(screen.getByTestId('metric-value')).toHaveTextContent('0');
  });

  it('renders unavailable card state with error detail for UNAVAILABLE state', () => {
    render(<MetricCard metric={sampleUnavailableMetric} />);

    expect(screen.getByTestId('metric-value')).toHaveTextContent('Unavailable');
    const valueEl = screen.getByTestId('metric-value');
    expect(valueEl).toHaveClass('italic');
    expect(screen.getByTestId('metric-error-detail')).toHaveTextContent(
      'Support desk connector timeout after 5000ms'
    );
  });

  it('defaults error detail to "Service unavailable" when unavailable metric error_detail is missing', () => {
    const noDetailMetric: MetricResponse = {
      ...sampleUnavailableMetric,
      error_detail: null,
    };
    render(<MetricCard metric={noDetailMetric} />);

    expect(screen.getByTestId('metric-error-detail')).toHaveTextContent('Service unavailable');
  });

  it('executes onRetry callback when Retry button is clicked on an UNAVAILABLE card', () => {
    const handleRetry = vi.fn();
    render(<MetricCard metric={sampleUnavailableMetric} onRetry={handleRetry} />);

    const retryBtn = screen.getByTestId('retry-button');
    expect(retryBtn).toBeInDocument();

    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
    expect(handleRetry).toHaveBeenCalledWith('open_tickets');
  });

  it('executes onSelect callback when card is clicked', () => {
    const handleSelect = vi.fn();
    render(<MetricCard metric={sampleValidMetric} onSelect={handleSelect} />);

    const card = screen.getByTestId('metric-card');
    fireEvent.click(card);

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith('lead_gen', 'qualified_leads');
  });

  it('prevents onSelect bubbling when clicking retry button on UNAVAILABLE card', () => {
    const handleRetry = vi.fn();
    const handleSelect = vi.fn();

    render(
      <MetricCard
        metric={sampleUnavailableMetric}
        onRetry={handleRetry}
        onSelect={handleSelect}
      />
    );

    const retryBtn = screen.getByTestId('retry-button');
    fireEvent.click(retryBtn);

    expect(handleRetry).toHaveBeenCalledWith('open_tickets');
    expect(handleSelect).not.toHaveBeenCalled();
  });

  it('supports fallback props when metric object is not supplied', () => {
    render(
      <MetricCard
        domain="sales_pipeline"
        metricKey="pipeline_value"
        displayName="Pipeline Value"
        formattedValue="$500,000"
        percentageChange={8.5}
        baselineValue={460830}
        unit="currency"
        status="VALID"
      />
    );

    expect(screen.getByTestId('metric-domain')).toHaveTextContent('Sales Pipeline');
    expect(screen.getByTestId('metric-title')).toHaveTextContent('Pipeline Value');
    expect(screen.getByTestId('metric-value')).toHaveTextContent('$500,000');
    expect(screen.getByTestId('metric-change')).toHaveTextContent('+8.5%');
  });

  it('executes onSelect callback when Enter or Space key is pressed on interactive card', () => {
    const handleSelect = vi.fn();
    render(<MetricCard metric={sampleValidMetric} onSelect={handleSelect} />);

    const card = screen.getByTestId('metric-card');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith('lead_gen', 'qualified_leads');

    fireEvent.keyDown(card, { key: ' ' });
    expect(handleSelect).toHaveBeenCalledTimes(2);
  });

  describe('Utility Helper Functions', () => {
    it('formatZeroMetricValue returns appropriate zero representation per unit', () => {
      expect(formatZeroMetricValue('currency')).toBe('$0');
      expect(formatZeroMetricValue('percentage')).toBe('0%');
      expect(formatZeroMetricValue('count')).toBe('0');
      expect(formatZeroMetricValue(undefined)).toBe('0');
    });
    it('formatDomainName formats known domain slugs correctly', () => {
      expect(formatDomainName('lead_gen')).toBe('Lead Gen');
      expect(formatDomainName('sales_pipeline')).toBe('Sales Pipeline');
      expect(formatDomainName('support')).toBe('Support');
      expect(formatDomainName('financials')).toBe('Financials');
      expect(formatDomainName('custom_domain')).toBe('Custom Domain');
      expect(formatDomainName('')).toBe('');
    });

    it('formatPercentageChange formats positive, negative, and zero values', () => {
      expect(formatPercentageChange(15)).toBe('+15%');
      expect(formatPercentageChange(-3.5)).toBe('-3.5%');
      expect(formatPercentageChange(0)).toBe('0%');
      expect(formatPercentageChange(null)).toBeNull();
    });

    it('formatBaselineValue formats numeric values per unit', () => {
      expect(formatBaselineValue(10000, 'currency')).toBe('$10,000');
      expect(formatBaselineValue(85.5, 'percentage')).toBe('85.5%');
      expect(formatBaselineValue(150, 'count')).toBe('150');
      expect(formatBaselineValue(null)).toBeNull();
    });
  });
});
