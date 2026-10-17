import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AmendmentTimeline } from '../../../src/components/contracts/amendment_timeline';
import { AmendmentDetailResponse } from '../../../src/services/contract_api';

// Mock contract_api service calls
vi.mock('../../../src/services/contract_api', async () => {
  const actual = await vi.importActual('../../../src/services/contract_api');
  return {
    ...actual,
    createAmendment: vi.fn().mockResolvedValue({
      id: 'amd-003',
      contract_id: 'cnt-101',
      sequence_number: 3,
      summary: 'New mock amendment created',
      author_id: 'usr-legal-01',
      created_at: '2026-01-20T10:00:00Z',
    }),
    updateAmendmentBlocked: vi.fn().mockRejectedValue({
      status: 403,
      message: 'Operation rejected: Amendment audit entries are immutable [FR-8]',
    }),
    deleteAmendmentBlocked: vi.fn().mockRejectedValue({
      status: 403,
      message: 'Operation rejected: Amendment audit entries cannot be deleted [FR-8]',
    }),
  };
});

describe('AmendmentTimeline Component [FR-7, FR-8]', () => {
  const sampleAmendments: AmendmentDetailResponse[] = [
    {
      id: 'amd-001',
      contract_id: 'cnt-101',
      sequence_number: 1,
      summary: 'Extended agreement duration by 12 months through December 31, 2027.',
      author_id: 'usr-legal-01',
      created_at: '2026-01-05T09:00:00Z',
    },
    {
      id: 'amd-002',
      contract_id: 'cnt-101',
      sequence_number: 2,
      summary: 'Adjusted monthly cloud hosting tier pricing and added 99.9% uptime SLA guarantee.',
      author_id: 'usr-legal-02',
      created_at: '2026-01-15T14:30:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders amendment timeline component header, contract details, and immutable audit banner [FR-7, FR-8]', () => {
    render(
      <AmendmentTimeline
        contractId="cnt-101"
        contractTitle="Master Cloud Services Agreement"
        contractStatus="ACTIVE"
        amendments={sampleAmendments}
      />
    );

    expect(screen.getByTestId('amendment-timeline')).toBeInDocument();
    expect(screen.getByText('Amendment Audit Trail')).toBeInDocument();
    expect(screen.getByText('Master Cloud Services Agreement')).toBeInDocument();
    expect(screen.getByText('(cnt-101)')).toBeInDocument();

    // Check immutable banner [FR-8]
    expect(screen.getByTestId('immutable-audit-banner')).toBeInDocument();
    expect(
      screen.getByText(/Append-Only Non-Mutable Ledger \(FR-7, FR-8\)/i)
    ).toBeInDocument();
  });

  it('renders chronological amendment entries with sequence badges, timestamps, author IDs, and lock icons [FR-7]', () => {
    render(
      <AmendmentTimeline
        contractId="cnt-101"
        amendments={sampleAmendments}
      />
    );

    // Verify amendment items
    expect(screen.getByTestId('amendment-item-amd-001')).toBeInDocument();
    expect(screen.getByTestId('amendment-item-amd-002')).toBeInDocument();

    // Sequence numbers
    expect(screen.getByTestId('amendment-sequence-1')).toBeInDocument();
    expect(screen.getByTestId('amendment-sequence-2')).toBeInDocument();

    // Summaries
    expect(
      screen.getByText(/Extended agreement duration by 12 months/i)
    ).toBeInDocument();
    expect(
      screen.getByText(/Adjusted monthly cloud hosting tier pricing/i)
    ).toBeInDocument();

    // Authors
    expect(screen.getByTestId('amendment-author-amd-001')).toHaveTextContent('usr-legal-01');
    expect(screen.getByTestId('amendment-author-amd-002')).toHaveTextContent('usr-legal-02');

    // Locked badges [FR-8]
    expect(screen.getByTestId('amendment-locked-badge-amd-001')).toBeInDocument();
    expect(screen.getByTestId('amendment-locked-badge-amd-002')).toBeInDocument();
  });

  it('filters amendment records using the search input', () => {
    render(
      <AmendmentTimeline
        contractId="cnt-101"
        amendments={sampleAmendments}
      />
    );

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'hosting' } });

    expect(screen.queryByTestId('amendment-item-amd-001')).not.toBeInDocument();
    expect(screen.getByTestId('amendment-item-amd-002')).toBeInDocument();
    expect(screen.getByTestId('amendment-count')).toHaveTextContent('Showing 1 of 2 entries');
  });

  it('toggles chronological sorting order between Oldest First and Newest First', () => {
    render(
      <AmendmentTimeline
        contractId="cnt-101"
        amendments={sampleAmendments}
      />
    );

    const sortToggle = screen.getByTestId('sort-toggle');
    expect(sortToggle).toHaveTextContent('Oldest First (1 → N)');

    fireEvent.click(sortToggle);
    expect(sortToggle).toHaveTextContent('Newest First (N → 1)');
  });

  it('opens append amendment form and commits a new amendment record [FR-7]', async () => {
    const handleCreate = vi.fn().mockResolvedValue(undefined);
    const handleRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <AmendmentTimeline
        contractId="cnt-101"
        amendments={sampleAmendments}
        onCreateAmendment={handleCreate}
        onRefresh={handleRefresh}
      />
    );

    const addButton = screen.getByTestId('add-amendment-button');
    fireEvent.click(addButton);

    expect(screen.getByTestId('append-amendment-form')).toBeInDocument();

    const summaryInput = screen.getByTestId('amendment-summary-input');
    fireEvent.change(summaryInput, {
      target: { value: 'Added disaster recovery SLA response window of 1 hour.' },
    });

    const submitButton = screen.getByTestId('submit-amendment-button');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(handleCreate).toHaveBeenCalledWith(
        'Added disaster recovery SLA response window of 1 hour.'
      );
      expect(handleRefresh).toHaveBeenCalled();
      expect(screen.getByTestId('form-success-banner')).toBeInDocument();
    });
  });

  it('rejects attempt to edit or delete an existing amendment audit entry [FR-8]', async () => {
    render(
      <AmendmentTimeline
        contractId="cnt-101"
        amendments={sampleAmendments}
      />
    );

    // Attempt edit on amendment #1
    const editButton = screen.getByTestId('attempt-edit-button-amd-001');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByTestId('immutability-blocked-alert')).toBeInDocument();
      expect(screen.getByText(/HTTP 403 Forbidden: Amendment #1 is immutable/i)).toBeInDocument();
    });

    // Attempt delete on amendment #2
    const deleteButton = screen.getByTestId('attempt-delete-button-amd-002');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByTestId('immutability-blocked-alert')).toBeInDocument();
      expect(screen.getByText(/HTTP 403 Forbidden: Amendment #2 is immutable/i)).toBeInDocument();
    });
  });

  it('renders 403 unauthorized state when user lacks RBAC permissions [FR-1, FR-[#9]]', () => {
    render(
      <AmendmentTimeline
        contractId="cnt-101"
        isUnauthorized={true}
        unauthorizedReason="User role does not permit viewing amendment history."
      />
    );

    expect(screen.getByTestId('unauthorized-state')).toBeInDocument();
    expect(screen.getByText('403 Forbidden - Access Restricted')).toBeInDocument();
    expect(
      screen.getByText('User role does not permit viewing amendment history.')
    ).toBeInDocument();
  });

  it('renders empty state when no amendments are recorded', () => {
    render(
      <AmendmentTimeline
        contractId="cnt-101"
        amendments={[]}
      />
    );

    expect(screen.getByTestId('empty-state')).toBeInDocument();
    expect(screen.getByText('No Amendment Records')).toBeInDocument();
    expect(screen.getByTestId('empty-add-amendment-button')).toBeInDocument();
  });

  it('renders loading state when loading prop is true', () => {
    render(
      <AmendmentTimeline
        contractId="cnt-101"
        loading={true}
      />
    );

    expect(screen.getByTestId('loading-state')).toBeInDocument();
    expect(screen.getByText('Loading amendment audit log records...')).toBeInDocument();
  });

  it('renders error state when error prop is provided', () => {
    render(
      <AmendmentTimeline
        contractId="cnt-101"
        error="Failed to load amendment audit log from backend."
      />
    );

    expect(screen.getByTestId('error-state')).toBeInDocument();
    expect(
      screen.getByText('Failed to load amendment audit log from backend.')
    ).toBeInDocument();
  });
});
