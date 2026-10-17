import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContractDetailPage from '../../src/app/contracts/[id]/page';
import { apiClient, ApiError } from '../../src/services/apiClient';
import { contractApi } from '../../src/services/contract_api';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';

const mockPush = vi.fn();

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/contracts/cnt-101',
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useParams: () => ({ id: 'cnt-101' }),
}));

// Mock apiClient and contractApi
vi.mock('../../src/services/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/apiClient')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getToken: vi.fn(),
      getMe: vi.fn(),
    },
  };
});

vi.mock('../../src/services/contract_api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/contract_api')>();
  return {
    ...actual,
    contractApi: {
      ...actual.contractApi,
      getContractDetail: vi.fn(),
      addContractClause: vi.fn(),
      addContractSLA: vi.fn(),
      evaluateContractSLAs: vi.fn(),
      uploadContractDocument: vi.fn(),
      downloadContractDocument: vi.fn(),
      createAmendment: vi.fn(),
      executeSignature: vi.fn(),
      rejectSignature: vi.fn(),
    },
  };
});

describe('ContractDetailPage Component (T023)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated user to /login when token is missing', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue(null);

    render(
      <AccessibilityProvider>
        <ContractDetailPage params={{ id: 'cnt-101' }} />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders loading state initially while fetching contract details', () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockReturnValue(new Promise(() => {}));
    vi.mocked(contractApi.getContractDetail).mockReturnValue(new Promise(() => {}));

    render(
      <AccessibilityProvider>
        <ContractDetailPage params={{ id: 'cnt-101' }} />
      </AccessibilityProvider>
    );

    const loadingContainer = screen.getByTestId('loading-page-state');
    expect(loadingContainer).toBeInDocument();
    expect(loadingContainer).toHaveAttribute('aria-busy', 'true');
    expect(
      screen.getByText(/loading contract agreement details, clauses, slas, and history/i)
    ).toBeInDocument();
  });

  it('renders contract header and detail sections on successful API response [FR-1, FR-3, FR-7, FR-10]', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-1',
      email: 'legal.admin@example.com',
      tenant_id: 'tenant-acme-1',
      roles: ['Admin'],
    });

    vi.mocked(contractApi.getContractDetail).mockResolvedValue({
      id: 'cnt-101',
      title: 'Enterprise Master Platform Agreement',
      category: 'Contract',
      status: 'ACTIVE',
      counterparty: 'Acme Financial Systems',
      start_on: '2026-01-01',
      expires_on: '2027-01-01',
      parent_contract_id: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
      clauses: [
        {
          id: 'cls-1',
          contract_id: 'cnt-101',
          clause_type: 'Indemnification',
          title: 'IP Infringement Protection',
          body_text: 'Full mutual indemnification for intellectual property claims.',
          is_highlighted: true,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      highlighted_clauses: [
        {
          id: 'cls-1',
          contract_id: 'cnt-101',
          clause_type: 'Indemnification',
          title: 'IP Infringement Protection',
          body_text: 'Full mutual indemnification for intellectual property claims.',
          is_highlighted: true,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      slas: [
        {
          id: 'sla-1',
          contract_id: 'cnt-101',
          metric_name: 'Monthly Uptime',
          target_value: '99.9% Uptime',
          penalty_terms: '10% monthly service credit',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      document_versions: [
        {
          id: 'ver-1',
          contract_id: 'cnt-101',
          category_type: 'Contract',
          version_number: 1,
          file_path: 'contracts/cnt-101/v1_master.pdf',
          checksum: 'hash1234567890abcdef1234567890abcdef',
          uploaded_by_id: 'usr-1',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      active_version: {
        id: 'ver-1',
        contract_id: 'cnt-101',
        category_type: 'Contract',
        version_number: 1,
        file_path: 'contracts/cnt-101/v1_master.pdf',
        checksum: 'hash1234567890abcdef1234567890abcdef',
        uploaded_by_id: 'usr-1',
        created_at: '2026-01-01T00:00:00Z',
      },
      amendments: [
        {
          id: 'amd-1',
          contract_id: 'cnt-101',
          sequence_number: 1,
          summary: 'Initial amendment extending SLA scope.',
          author_id: 'usr-1',
          created_at: '2026-01-05T00:00:00Z',
        },
      ],
      signature_requests: [
        {
          id: 'sig-1',
          contract_id: 'cnt-101',
          signatory_id: 'usr-1',
          status: 'EXECUTED',
          signature_digest: 'digest_sha256_xxx',
          executed_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      child_contract_ids: ['cnt-102'],
    });

    render(
      <AccessibilityProvider>
        <ContractDetailPage params={{ id: 'cnt-101' }} />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('contract-detail-page')).toBeInDocument();
    });

    expect(screen.getByTestId('contract-title')).toHaveTextContent(
      'Enterprise Master Platform Agreement'
    );
    expect(screen.getByTestId('contract-counterparty')).toHaveTextContent(
      'Acme Financial Systems'
    );
    expect(screen.getByTestId('contract-category-badge')).toHaveTextContent('Contract');
    expect(screen.getByTestId('contract-status-badge')).toHaveTextContent('ACTIVE');

    // Default tab is clauses [FR-1]
    expect(screen.getByTestId('clauses-section')).toBeInDocument();
    expect(screen.getByText('IP Infringement Protection')).toBeInDocument();
    expect(screen.getByText('Monthly Uptime')).toBeInDocument();
  });

  it('switches between detail tabs: Versions [FR-3, FR-10], Amendments [FR-7], and Signatures', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-1',
      email: 'legal.admin@example.com',
      tenant_id: 'tenant-acme-1',
      roles: ['Admin'],
    });

    vi.mocked(contractApi.getContractDetail).mockResolvedValue({
      id: 'cnt-101',
      title: 'Enterprise Master Platform Agreement',
      category: 'Contract',
      status: 'ACTIVE',
      counterparty: 'Acme Financial Systems',
      start_on: '2026-01-01',
      expires_on: '2027-01-01',
      parent_contract_id: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
      clauses: [],
      highlighted_clauses: [],
      slas: [],
      document_versions: [
        {
          id: 'ver-1',
          contract_id: 'cnt-101',
          category_type: 'Contract',
          version_number: 1,
          file_path: 'contracts/cnt-101/v1_master.pdf',
          checksum: 'hash1234567890abcdef1234567890abcdef',
          uploaded_by_id: 'usr-1',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      active_version: null,
      amendments: [
        {
          id: 'amd-1',
          contract_id: 'cnt-101',
          sequence_number: 1,
          summary: 'Amended liability clause.',
          author_id: 'usr-1',
          created_at: '2026-01-05T00:00:00Z',
        },
      ],
      signature_requests: [],
      child_contract_ids: [],
    });

    render(
      <AccessibilityProvider>
        <ContractDetailPage params={{ id: 'cnt-101' }} />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('contract-title')).toBeInDocument();
    });

    // Switch to Versions tab [FR-3, FR-10]
    fireEvent.click(screen.getByTestId('tab-versions'));
    expect(screen.getByTestId('versions-section')).toBeInDocument();
    expect(screen.getByTestId('version-history')).toBeInDocument();

    // Switch to Amendments tab [FR-7]
    fireEvent.click(screen.getByTestId('tab-amendments'));
    expect(screen.getByTestId('amendments-section')).toBeInDocument();
    expect(screen.getByTestId('amendment-timeline')).toBeInDocument();
    expect(screen.getByText('Amended liability clause.')).toBeInDocument();

    // Switch to Signatures tab
    fireEvent.click(screen.getByTestId('tab-signatures'));
    expect(screen.getByTestId('signatures-section')).toBeInDocument();
    expect(screen.getByTestId('signature-pad')).toBeInDocument();
  });

  it('handles 403 Forbidden unauthorized access error state gracefully [FR-1]', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-unauth',
      email: 'restricted@example.com',
      tenant_id: 'tenant-other',
      roles: ['RestrictedRole'],
    });

    vi.mocked(contractApi.getContractDetail).mockRejectedValue(
      new ApiError(403, 'Access Denied')
    );

    render(
      <AccessibilityProvider>
        <ContractDetailPage params={{ id: 'cnt-forbidden' }} />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('unauthorized-page-state')).toBeInDocument();
    });

    expect(screen.getByText('Contract Access Denied [FR-1]')).toBeInDocument();
    expect(screen.getByText(/role authorization violation/i)).toBeInDocument();
  });

  it('renders error page state when contract is not found (404)', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-1',
      email: 'admin@example.com',
      tenant_id: 'tenant-1',
      roles: ['Admin'],
    });

    vi.mocked(contractApi.getContractDetail).mockRejectedValue(
      new ApiError(404, 'Contract not found')
    );

    render(
      <AccessibilityProvider>
        <ContractDetailPage params={{ id: 'cnt-missing' }} />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('error-page-state')).toBeInDocument();
    });

    expect(screen.getByText('Contract Record Not Found')).toBeInDocument();
  });
});
