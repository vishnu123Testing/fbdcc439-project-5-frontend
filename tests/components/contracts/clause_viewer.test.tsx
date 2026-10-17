import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ClauseViewer } from '../../../src/components/contracts/clause_viewer';
import {
  ClauseResponse,
  SLAResponse,
  SLAEvaluationResponse,
} from '../../../src/services/contract_api';

describe('ClauseViewer Component [FR-1]', () => {
  const sampleClauses: ClauseResponse[] = [
    {
      id: 'cls-001',
      contract_id: 'cnt-101',
      clause_type: 'Indemnification',
      title: 'Mutual Intellectual Property Indemnification',
      body_text:
        'Each party shall defend, indemnify, and hold harmless the other party against third-party claims alleging patent or copyright infringement.',
      is_highlighted: true,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'cls-002',
      contract_id: 'cnt-101',
      clause_type: 'Limitation of Liability',
      title: 'Cap on Direct Damages',
      body_text:
        'Aggregate liability under this Agreement shall not exceed the total fees paid in the preceding twelve (12) month period.',
      is_highlighted: false,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'cls-003',
      contract_id: 'cnt-101',
      clause_type: 'Confidentiality',
      title: 'Protection of Proprietary Information',
      body_text:
        'Receiving party shall protect disclosing party confidential information using at least reasonable degree of care for five (5) years.',
      is_highlighted: true,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  const sampleSLAs: SLAResponse[] = [
    {
      id: 'sla-001',
      contract_id: 'cnt-101',
      metric_name: 'Monthly Uptime Guarantee',
      target_value: '99.9% Uptime',
      penalty_terms: '10% service credit for each 0.1% breach below target threshold',
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'sla-002',
      contract_id: 'cnt-101',
      metric_name: 'Support Response Time SLA',
      target_value: 'Sub-15 minute initial response for P1 critical incidents',
      penalty_terms: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  it('renders active contract title, status badge, clauses, and SLAs', () => {
    render(
      <ClauseViewer
        contractId="cnt-101"
        contractTitle="Master Enterprise Services Agreement"
        contractStatus="ACTIVE"
        counterparty="Acme Corp"
        clauses={sampleClauses}
        slas={sampleSLAs}
      />
    );

    expect(screen.getByTestId('clause-viewer')).toBeInDocument();
    expect(screen.getByText('Master Enterprise Services Agreement')).toBeInDocument();
    expect(screen.getByText('Acme Corp')).toBeInDocument();
    expect(screen.getByText('ACTIVE')).toBeInDocument();

    // Check highlighted terms section
    expect(screen.getByTestId('highlighted-clauses-section')).toBeInDocument();
    expect(screen.getByText('Mutual Intellectual Property Indemnification')).toBeInDocument();
    expect(screen.getByText('Protection of Proprietary Information')).toBeInDocument();

    // Check all clauses section
    expect(screen.getByTestId('all-clauses-section')).toBeInDocument();
    expect(screen.getByText('Cap on Direct Damages')).toBeInDocument();

    // Check SLAs section
    expect(screen.getByTestId('active-slas-section')).toBeInDocument();
    expect(screen.getByText('Monthly Uptime Guarantee')).toBeInDocument();
    expect(screen.getByText('99.9% Uptime')).toBeInDocument();
  });

  it('denies access and displays unauthorized warning state when isUnauthorized is true [FR-1]', () => {
    render(
      <ClauseViewer
        contractId="cnt-101"
        contractTitle="Restricted Financial Agreement"
        isUnauthorized={true}
        unauthorizedReason="Role 'ClientViewer' lacks permission to view financial clause specifics."
      />
    );

    expect(screen.getByTestId('clause-viewer')).toBeInDocument();
    expect(screen.getByTestId('unauthorized-message')).toBeInDocument();
    expect(screen.getByText('403 Forbidden')).toBeInDocument();
    expect(
      screen.getByText('Role \'ClientViewer\' lacks permission to view financial clause specifics.')
    ).toBeInDocument();

    // Ensure clauses and SLAs are not rendered when unauthorized
    expect(screen.queryByTestId('highlighted-clauses-section')).not.toBeInDocument();
    expect(screen.queryByTestId('active-slas-section')).not.toBeInDocument();
  });

  it('filters clauses by search query correctly', async () => {
    render(
      <ClauseViewer
        contractId="cnt-101"
        clauses={sampleClauses}
        slas={sampleSLAs}
      />
    );

    const searchInput = screen.getByTestId('search-clauses-input');
    fireEvent.change(searchInput, { target: { value: 'Infringement' } });

    expect(screen.getByText('Mutual Intellectual Property Indemnification')).toBeInDocument();
    expect(screen.queryByText('Cap on Direct Damages')).not.toBeInDocument();
  });

  it('filters clauses by clause type dropdown selector', () => {
    render(
      <ClauseViewer
        contractId="cnt-101"
        clauses={sampleClauses}
        slas={sampleSLAs}
      />
    );

    const typeFilter = screen.getByTestId('clause-type-filter');
    fireEvent.change(typeFilter, { target: { value: 'Limitation of Liability' } });

    expect(screen.getByText('Cap on Direct Damages')).toBeInDocument();
    expect(screen.queryByText('Protection of Proprietary Information')).not.toBeInDocument();
  });

  it('expands full clause text when View Full / toggle button is clicked', () => {
    render(
      <ClauseViewer
        contractId="cnt-101"
        clauses={sampleClauses}
      />
    );

    const viewFullBtn = screen.getByLabelText('Expand details for clause Cap on Direct Damages');
    fireEvent.click(viewFullBtn);

    expect(screen.getByText('Full Clause Provision')).toBeInDocument();
    expect(
      screen.getByText(
        'Aggregate liability under this Agreement shall not exceed the total fees paid in the preceding twelve (12) month period.'
      )
    ).toBeInDocument();
  });

  it('triggers onEvaluateSLAs callback when Evaluate SLAs button is clicked', async () => {
    const handleEvaluate = vi.fn().mockResolvedValue({
      contract_id: 'cnt-101',
      status: 'SUCCESS',
      total_slas: 2,
      breached_slas: 0,
      highlighted_clause_count: 2,
      evaluated_at: '2026-10-06T08:00:00Z',
      slas: [],
      highlighted_clauses: [],
    } as SLAEvaluationResponse);

    render(
      <ClauseViewer
        contractId="cnt-101"
        slas={sampleSLAs}
        onEvaluateSLAs={handleEvaluate}
      />
    );

    const evalBtn = screen.getByTestId('evaluate-slas-button');
    fireEvent.click(evalBtn);

    expect(handleEvaluate).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(
        screen.getByText(/SLA evaluation complete: 2 SLAs evaluated/i)
      ).toBeInDocument();
    });
  });

  it('allows opening Add Clause modal and submitting a new clause', async () => {
    const handleAddClause = vi.fn().mockResolvedValue(undefined);

    render(
      <ClauseViewer
        contractId="cnt-101"
        clauses={sampleClauses}
        onAddClause={handleAddClause}
      />
    );

    const addClauseBtn = screen.getByText('Add Clause');
    fireEvent.click(addClauseBtn);

    expect(screen.getByText('Add Agreement Clause')).toBeInDocument();

    const titleInput = screen.getByLabelText('Clause Title');
    const bodyInput = screen.getByLabelText('Full Provision Body Text');

    fireEvent.change(titleInput, { target: { value: 'New Security Compliance Clause' } });
    fireEvent.change(bodyInput, { target: { value: 'Vendor shall undergo annual SOC 2 Type II audits.' } });

    const submitBtn = screen.getByRole('button', { name: 'Add Clause' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleAddClause).toHaveBeenCalledWith({
        clause_type: 'Indemnification',
        title: 'New Security Compliance Clause',
        body_text: 'Vendor shall undergo annual SOC 2 Type II audits.',
        is_highlighted: false,
      });
      expect(screen.getByText('Clause "New Security Compliance Clause" added successfully.')).toBeInDocument();
    });
  });

  it('allows opening Add SLA modal and submitting a new SLA metric', async () => {
    const handleAddSLA = vi.fn().mockResolvedValue(undefined);

    render(
      <ClauseViewer
        contractId="cnt-101"
        slas={sampleSLAs}
        onAddSLA={handleAddSLA}
      />
    );

    const addSlaBtn = screen.getByText('Add SLA');
    fireEvent.click(addSlaBtn);

    expect(screen.getByText('Add Service Level Agreement (SLA)')).toBeInDocument();

    const metricInput = screen.getByLabelText('Metric Name');
    const targetInput = screen.getByLabelText('Target Threshold Value');
    const penaltyInput = screen.getByLabelText('Penalty Terms (Optional)');

    fireEvent.change(metricInput, { target: { value: 'API Latency SLA' } });
    fireEvent.change(targetInput, { target: { value: 'P99 Latency < 50ms' } });
    fireEvent.change(penaltyInput, { target: { value: '5% credit for p99 > 100ms' } });

    const submitBtn = screen.getByRole('button', { name: 'Add SLA Target' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleAddSLA).toHaveBeenCalledWith({
        metric_name: 'API Latency SLA',
        target_value: 'P99 Latency < 50ms',
        penalty_terms: '5% credit for p99 > 100ms',
      });
      expect(screen.getByText('SLA metric "API Latency SLA" added successfully.')).toBeInDocument();
    });
  });

  it('renders loading spinner when loading is true', () => {
    render(<ClauseViewer loading={true} />);

    expect(screen.getByRole('status')).toBeInDocument();
    expect(screen.getByText('Loading active agreement clauses, key terms, and SLAs...')).toBeInDocument();
  });
});