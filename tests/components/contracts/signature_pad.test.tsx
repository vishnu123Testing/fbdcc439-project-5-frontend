import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SignaturePad } from '../../../src/components/contracts/signature_pad';
import { SignatureRequestResponse, SignatureExecuteResponse } from '../../../src/services/contract_api';

// Mock contract_api service calls
vi.mock('../../../src/services/contract_api', async () => {
  const actual = await vi.importActual('../../../src/services/contract_api');
  return {
    ...actual,
    executeSignature: vi.fn().mockResolvedValue({
      request_id: 'sig-001',
      contract_id: 'cnt-101',
      status: 'EXECUTED',
      executed_at: '2026-01-20T12:00:00Z',
      signature_digest: 'sig_digest_mock_sha256_hash_1234567890',
    } as SignatureExecuteResponse),
    rejectSignature: vi.fn().mockResolvedValue({
      id: 'sig-001',
      contract_id: 'cnt-101',
      status: 'REJECTED',
      created_at: '2026-01-15T10:00:00Z',
    } as SignatureRequestResponse),
  };
});

describe('SignaturePad Component [FR-6]', () => {
  const samplePendingRequests: SignatureRequestResponse[] = [
    {
      id: 'sig-req-101',
      contract_id: 'cnt-101',
      signatory_id: 'usr-exec-01',
      status: 'PENDING',
      created_at: '2026-01-15T09:00:00Z',
    },
    {
      id: 'sig-req-102',
      contract_id: 'cnt-102',
      signatory_id: 'usr-exec-02',
      status: 'PENDING',
      created_at: '2026-01-16T10:30:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders signature pad header, contract title, category, status, and signatory form [FR-6]', () => {
    render(
      <SignaturePad
        signatureRequestId="sig-001"
        contractId="cnt-101"
        contractTitle="Master Cloud Services Agreement"
        contractCategory="Contract"
        contractStatus="PENDING_SIGNATURE"
        counterparty="Acme Corp"
        signatoryName="Jane Doe"
        signatoryEmail="jane.doe@acme.com"
      />
    );

    expect(screen.getByTestId('signature-pad')).toBeInDocument();
    expect(screen.getByText('Digital Signature Execution')).toBeInDocument();
    expect(screen.getByTestId('contract-title-display')).toHaveTextContent('Master Cloud Services Agreement');
    expect(screen.getByTestId('contract-id-display')).toHaveTextContent('(cnt-101)');
    expect(screen.getByText('Acme Corp')).toBeInDocument();
    expect(screen.getByTestId('contract-status-badge')).toHaveTextContent('PENDING_SIGNATURE');

    // Signatory Inputs
    expect(screen.getByTestId('signatory-name-input')).toHaveValue('Jane Doe');
    expect(screen.getByTestId('signatory-email-input')).toHaveValue('jane.doe@acme.com');
  });

  it('switches between Draw Signature and Type Signature capture modes', () => {
    render(
      <SignaturePad
        signatureRequestId="sig-001"
        contractId="cnt-101"
        signatoryName="Jane Doe"
      />
    );

    // Default Draw mode canvas
    expect(screen.getByTestId('signature-canvas')).toBeInDocument();

    // Switch to Type mode
    fireEvent.click(screen.getByTestId('mode-toggle-type'));
    expect(screen.queryByTestId('signature-canvas')).not.toBeInDocument();
    expect(screen.getByTestId('typed-signature-input')).toBeInDocument();
    expect(screen.getByTestId('typed-signature-preview')).toHaveTextContent('Jane Doe');

    // Switch back to Draw mode
    fireEvent.click(screen.getByTestId('mode-toggle-draw'));
    expect(screen.getByTestId('signature-canvas')).toBeInDocument();
  });

  it('keeps execute button disabled when legal consent checkbox is unchecked', () => {
    render(
      <SignaturePad
        signatureRequestId="sig-001"
        contractId="cnt-101"
        signatoryName="Jane Doe"
      />
    );

    // Switch to type mode so text is present
    fireEvent.click(screen.getByTestId('mode-toggle-type'));

    const executeBtn = screen.getByTestId('execute-signature-btn');
    expect(executeBtn).toBeDisabled();

    // Check legal consent checkbox
    const consentCheckbox = screen.getByTestId('legal-consent-checkbox');
    fireEvent.click(consentCheckbox);

    // Now execute button should be enabled
    expect(executeBtn).not.toBeDisabled();
  });

  it('executes digital signature, transitions contract status, and displays notification badge [FR-6]', async () => {
    const handleSuccess = vi.fn();
    const handleExecuteProp = vi.fn().mockResolvedValue({
      request_id: 'sig-001',
      contract_id: 'cnt-101',
      status: 'EXECUTED',
      executed_at: '2026-01-20T12:00:00Z',
      signature_digest: 'sig_digest_mock_sha256_hash_1234567890',
    });

    render(
      <SignaturePad
        signatureRequestId="sig-001"
        contractId="cnt-101"
        contractTitle="Master Cloud Services Agreement"
        contractStatus="PENDING_SIGNATURE"
        signatoryName="Jane Doe"
        onExecute={handleExecuteProp}
        onSuccess={handleSuccess}
      />
    );

    // Switch to type signature
    fireEvent.click(screen.getByTestId('mode-toggle-type'));

    // Check legal consent
    fireEvent.click(screen.getByTestId('legal-consent-checkbox'));

    // Click execute signature button
    fireEvent.click(screen.getByTestId('execute-signature-btn'));

    await waitFor(() => {
      expect(handleExecuteProp).toHaveBeenCalledWith(
        'sig-001',
        expect.stringContaining('sig_typed_')
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('signature-success-banner')).toBeInDocument();
      expect(screen.getByTestId('executed-signature-badge')).toBeInDocument();
      expect(screen.getByTestId('transitioned-status-text')).toHaveTextContent('ACTIVE');
      expect(screen.getByTestId('parties-notified-badge')).toBeInDocument();
      expect(screen.getByText(/Notification Dispatched: All Parties Notified \[FR-6\]/i)).toBeInDocument();
      expect(handleSuccess).toHaveBeenCalled();
    });
  });

  it('renders executed signature view when initial status is EXECUTED', () => {
    render(
      <SignaturePad
        signatureRequestId="sig-001"
        contractId="cnt-101"
        signatureStatus="EXECUTED"
        contractStatus="ACTIVE"
        signatureDigest="sig_digest_executed_abcdef"
        executedAt="2026-01-19T10:00:00Z"
      />
    );

    expect(screen.getByTestId('executed-signature-view')).toBeInDocument();
    expect(screen.getByTestId('executed-signature-badge')).toBeInDocument();
    expect(screen.getByTestId('executed-at-timestamp')).toBeInDocument();
    expect(screen.getByTestId('signature-digest-display')).toBeInDocument();
    expect(screen.getByTestId('parties-notified-badge')).toBeInDocument();
  });

  it('handles rejection flow via rejection modal', async () => {
    const handleRejectProp = vi.fn().mockResolvedValue({
      id: 'sig-001',
      contract_id: 'cnt-101',
      status: 'REJECTED',
      created_at: '2026-01-15T10:00:00Z',
    });

    render(
      <SignaturePad
        signatureRequestId="sig-001"
        contractId="cnt-101"
        onReject={handleRejectProp}
      />
    );

    // Click reject button
    fireEvent.click(screen.getByTestId('reject-signature-btn'));

    // Modal should be visible
    expect(screen.getByTestId('rejection-modal')).toBeInDocument();

    // Type rejection reason
    fireEvent.change(screen.getByTestId('rejection-reason-input'), {
      target: { value: 'Clause 3 requires revision before signing.' },
    });

    // Confirm rejection
    fireEvent.click(screen.getByTestId('confirm-reject-btn'));

    await waitFor(() => {
      expect(handleRejectProp).toHaveBeenCalledWith(
        'sig-001',
        'Clause 3 requires revision before signing.'
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('rejected-signature-view')).toBeInDocument();
    });
  });

  it('renders unauthorized view when isUnauthorized is true [FR-1]', () => {
    render(
      <SignaturePad
        signatureRequestId="sig-001"
        isUnauthorized={true}
        unauthorizedReason="Signatory role required for digital signature execution."
      />
    );

    expect(screen.getByTestId('unauthorized-access-container')).toBeInDocument();
    expect(screen.getByText(/Signature Access Restricted \[FR-1\]/i)).toBeInDocument();
    expect(
      screen.getByText(/Signatory role required for digital signature execution./i)
    ).toBeInDocument();
  });

  it('renders pending signature request hub list when pendingRequests is provided [FR-5]', () => {
    const handleSelect = vi.fn();

    render(
      <SignaturePad
        signatureRequestId="sig-req-101"
        pendingRequests={samplePendingRequests}
        onSelectRequest={handleSelect}
      />
    );

    expect(screen.getByTestId('pending-requests-list')).toBeInDocument();
    expect(screen.getByTestId('pending-request-item-sig-req-101')).toBeInDocument();
    expect(screen.getByTestId('pending-request-item-sig-req-102')).toBeInDocument();

    // Click second pending request
    fireEvent.click(screen.getByTestId('pending-request-item-sig-req-102'));
    expect(handleSelect).toHaveBeenCalledWith(samplePendingRequests[1]);
  });
});