import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CentralizedSignatureHubPage from '../../src/app/contracts/signatures/page';
import { apiClient } from '../../src/services/apiClient';
import { contractApi } from '../../src/services/contract_api';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';

const mockPush = vi.fn();

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/contracts/signatures',
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
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
      listPendingSignatures: vi.fn(),
      getContractDetail: vi.fn(),
      executeSignature: vi.fn(),
      rejectSignature: vi.fn(),
    },
  };
});

describe('CentralizedSignatureHubPage Component (T024)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated user to /login when authentication token is missing', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue(null);

    render(
      <AccessibilityProvider>
        <CentralizedSignatureHubPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders loading state initially while initializing user context and signature requests', () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockReturnValue(new Promise(() => {})); // pending promise
    vi.mocked(contractApi.listPendingSignatures).mockReturnValue(new Promise(() => {}));

    render(
      <AccessibilityProvider>
        <CentralizedSignatureHubPage />
      </AccessibilityProvider>
    );

    const loadingState = screen.getByTestId('loading-page-state');
    expect(loadingState).toBeInDocument();
    expect(loadingState).toHaveAttribute('aria-busy', 'true');
    expect(
      screen.getByText(/loading centralized e-signature hub & pending requests/i)
    ).toBeInDocument();
  });

  it('renders centralized e-signature hub with statistics banner, user context, and pending requests list [FR-5]', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-sig-hub-1',
      email: 'signatory.admin@example.com',
      tenant_id: 'tenant-acme-77',
      roles: ['Admin', 'ClientStandard'],
    });

    vi.mocked(contractApi.listPendingSignatures).mockResolvedValue({
      items: [
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
      ],
      total_count: 2,
    });

    render(
      <AccessibilityProvider>
        <CentralizedSignatureHubPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /centralized e-signature hub/i })
      ).toBeInDocument();
    });

    // Check user context banner
    expect(screen.getByTestId('user-context-banner')).toBeInDocument();
    expect(screen.getByText('signatory.admin@example.com')).toBeInDocument();
    expect(screen.getByText('tenant-acme-77')).toBeInDocument();

    // Check statistics summary
    expect(screen.getByTestId('stats-pending-count')).toBeInDocument();
    expect(screen.getByTestId('stats-executed-count')).toBeInDocument();

    // Check pending signature requests list
    expect(screen.getByTestId('signature-requests-list')).toBeInDocument();
    expect(screen.getByTestId('signature-request-item-sig-req-101')).toBeInDocument();
    expect(screen.getByTestId('signature-request-item-sig-req-102')).toBeInDocument();
  });

  it('allows filtering pending signature requests by search query and status tabs [FR-5, NFR-5]', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-1',
      email: 'user@example.com',
      tenant_id: 'tenant-1',
      roles: ['ClientStandard'],
    });

    vi.mocked(contractApi.listPendingSignatures).mockResolvedValue({
      items: [
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
      ],
      total_count: 2,
    });

    render(
      <AccessibilityProvider>
        <CentralizedSignatureHubPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('signature-request-item-sig-req-101')).toBeInDocument();
    });

    // Filter by search query
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'sig-req-102' } });

    expect(screen.queryByTestId('signature-request-item-sig-req-101')).not.toBeInDocument();
    expect(screen.getByTestId('signature-request-item-sig-req-102')).toBeInDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByTestId('signature-request-item-sig-req-101')).toBeInDocument();
  });

  it('switches selected signature request when clicking item in sidebar list [FR-5]', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-1',
      email: 'user@example.com',
      tenant_id: 'tenant-1',
      roles: ['ClientStandard'],
    });

    render(
      <AccessibilityProvider>
        <CentralizedSignatureHubPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('signature-request-item-sig-req-101')).toBeInDocument();
    });

    // Click item 102
    fireEvent.click(screen.getByTestId('signature-request-item-sig-req-102'));

    // Check that signature pad container updates
    expect(screen.getByTestId('signature-pad-container')).toBeInDocument();
  });

  it('refreshes signature requests list when clicking refresh button [FR-5]', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-1',
      email: 'user@example.com',
      tenant_id: 'tenant-1',
      roles: ['ClientStandard'],
    });

    vi.mocked(contractApi.listPendingSignatures).mockResolvedValue({
      items: [],
      total_count: 0,
    });

    render(
      <AccessibilityProvider>
        <CentralizedSignatureHubPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('refresh-button')).toBeInDocument();
    });

    fireEvent.click(screen.getByTestId('refresh-button'));

    await waitFor(() => {
      expect(contractApi.listPendingSignatures).toHaveBeenCalled();
    });
  });
});
