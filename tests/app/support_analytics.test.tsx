import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SupportAnalyticsPage from '../../src/app/support/analytics/page';
import { apiClient } from '../../src/services/apiClient';
import { supportService, SupportAnalyticsResponse } from '../../src/services/support';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/support/analytics',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock apiClient
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

// Mock supportService
vi.mock('../../src/services/support', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/support')>();
  return {
    ...actual,
    supportService: {
      ...actual.supportService,
      getSupportAnalytics: vi.fn(),
    },
  };
});

const mockAnalyticsData: SupportAnalyticsResponse = {
  start_time: '2026-02-20T00:00:00Z',
  end_time: '2026-03-22T00:00:00Z',
  total_tickets: 42,
  open_tickets: 10,
  pending_tickets: 5,
  resolved_tickets: 27,
  average_first_response_time_seconds: 1200, // 20m
  mean_time_to_resolution_seconds: 14400, // 4h
  total_sla_targets: 84,
  breached_sla_targets: 4,
  sla_breach_rate_percent: 4.76,
  average_csat_score: 4.8,
  csat_response_count: 22,
  priority_breakdown: {
    P1: 6,
    P2: 16,
    P3: 20,
  },
};

describe('SupportAnalyticsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders support analytics title and fetches analytics metrics on mount', async () => {
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-123',
      email: 'agent@example.com',
      tenant_id: 'tnt-456',
      roles: ['Agent'],
    });
    vi.mocked(supportService.getSupportAnalytics).mockResolvedValue(mockAnalyticsData);

    render(
      <AccessibilityProvider>
        <SupportAnalyticsPage />
      </AccessibilityProvider>
    );

    expect(screen.getByText('Operational Support Analytics')).toBeInDocument();

    await waitFor(() => {
      expect(supportService.getSupportAnalytics).toHaveBeenCalled();
    });

    // Check KPI Cards
    expect(screen.getByText('42')).toBeInDocument(); // Total Volume
    expect(screen.getByText('20m')).toBeInDocument(); // Avg First Response (1200s)
    expect(screen.getByText('4h')).toBeInDocument(); // MTTR (14400s)
    expect(screen.getByText('95.2%')).toBeInDocument(); // Compliance Rate (100 - 4.76)
    expect(screen.getByText('4.8')).toBeInDocument(); // CSAT Rating
  });

  it('filters analytics data when changing time window preset', async () => {
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-123',
      email: 'agent@example.com',
      tenant_id: 'tnt-456',
      roles: ['Agent'],
    });
    vi.mocked(supportService.getSupportAnalytics).mockResolvedValue(mockAnalyticsData);

    render(
      <AccessibilityProvider>
        <SupportAnalyticsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(supportService.getSupportAnalytics).toHaveBeenCalled();
    });

    const preset24hBtn = screen.getByRole('button', { name: /last 24 hours/i });
    fireEvent.click(preset24hBtn);

    await waitFor(() => {
      expect(supportService.getSupportAnalytics).toHaveBeenCalledTimes(2);
    });
  });

  it('renders error alert when fetching analytics metrics fails', async () => {
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-123',
      email: 'agent@example.com',
      tenant_id: 'tnt-456',
      roles: ['Agent'],
    });
    vi.mocked(supportService.getSupportAnalytics).mockRejectedValue(new Error('Backend service unavailable'));

    render(
      <AccessibilityProvider>
        <SupportAnalyticsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInDocument();
    });

    expect(screen.getByText('Failed to load analytics data')).toBeInDocument();
    expect(screen.getByText('Backend service unavailable')).toBeInDocument();
  });
});
