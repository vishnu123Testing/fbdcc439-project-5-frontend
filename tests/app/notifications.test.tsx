import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationsPage, {
  INITIAL_DEMO_ALERTS,
  INITIAL_DEMO_TRIGGERS,
  INITIAL_DEMO_PREFERENCES,
} from '../../src/app/notifications/page';
import { apiClient, ApiError } from '../../src/services/apiClient';
import * as alertingService from '../../src/services/alerting';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';

const mockPush = vi.fn();

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/notifications',
  useRouter: () => ({
    push: mockPush,
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
      getNavigationMenu: vi.fn(),
    },
  };
});

// Mock alertingService
vi.mock('../../src/services/alerting', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/alerting')>();
  return {
    ...actual,
    listInAppAlerts: vi.fn(),
    listTriggerRules: vi.fn(),
    listNotificationPreferences: vi.fn(),
    markInAppAlertRead: vi.fn(),
    createTriggerRule: vi.fn(),
    updateTriggerRule: vi.fn(),
    deleteTriggerRule: vi.fn(),
    updateNotificationPreferences: vi.fn(),
  };
});

describe('NotificationsPage Route Component (/notifications) [FR-5, FR-6, FR-7]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects unauthenticated users to /login if no authentication token is present', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue(null);

    render(
      <AccessibilityProvider>
        <NotificationsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders loading state initially while authenticating user context', () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token-123');
    vi.mocked(apiClient.getMe).mockReturnValue(new Promise(() => {})); // pending promise

    render(
      <AccessibilityProvider>
        <NotificationsPage />
      </AccessibilityProvider>
    );

    const loadingContainer = screen.getByRole('status', {
      name: /loading multi-channel notification center/i,
    });
    expect(loadingContainer).toBeInDocument();
    expect(loadingContainer).toHaveAttribute('aria-busy', 'true');
    expect(
      screen.getByText('Loading Multi-Channel Notification Center...')
    ).toBeInDocument();
  });

  it('renders error banner and retry button when user authentication fails with non-401 error', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token-123');
    vi.mocked(apiClient.getMe).mockRejectedValue(new Error('Network connection timeout'));

    render(
      <AccessibilityProvider>
        <NotificationsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInDocument();
    });

    expect(screen.getByText('Failed to Load Notification Center')).toBeInDocument();
    expect(screen.getByText('Network connection timeout')).toBeInDocument();

    const retryButton = screen.getByRole('button', { name: /retry loading/i });
    expect(retryButton).toBeInDocument();
  });

  it('redirects to /login when getMe returns HTTP 401 Unauthorized error', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('expired-token');
    vi.mocked(apiClient.getMe).mockRejectedValue(new ApiError('Unauthorized token', 401));

    render(
      <AccessibilityProvider>
        <NotificationsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders the page header, executive overview cards, and NotificationHub when authenticated', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token-123');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-101',
      email: 'financial.admin@example.com',
      tenant_id: 'tenant-001',
      roles: ['Admin', 'ClientStandard'],
    });
    vi.mocked(apiClient.getNavigationMenu).mockResolvedValue({
      items: [{ title: 'Notification Center', path: '/notifications', is_accessible: true }],
    });

    vi.mocked(alertingService.listInAppAlerts).mockResolvedValue(INITIAL_DEMO_ALERTS);
    vi.mocked(alertingService.listTriggerRules).mockResolvedValue(INITIAL_DEMO_TRIGGERS);
    vi.mocked(alertingService.listNotificationPreferences).mockResolvedValue(
      INITIAL_DEMO_PREFERENCES
    );

    render(
      <AccessibilityProvider>
        <NotificationsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /multi-channel notification hub/i })).toBeInDocument();
    });

    // Check KPI Overview Cards
    expect(screen.getByText('In-App Alerts')).toBeInDocument();
    expect(screen.getByText('Trigger Rules')).toBeInDocument();
    expect(screen.getByText('Role Preferences')).toBeInDocument();
    expect(screen.getByText('Channel Gateways')).toBeInDocument();

    // Verify NotificationHub tabs render
    expect(screen.getByRole('tab', { name: /in-app alerts/i })).toBeInDocument();
    expect(screen.getByRole('tab', { name: /trigger rules/i })).toBeInDocument();
    expect(screen.getByRole('tab', { name: /role preferences/i })).toBeInDocument();
  });

  it('allows clicking top summary KPI cards to switch active tabs in NotificationHub', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token-123');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-101',
      email: 'financial.admin@example.com',
      tenant_id: 'tenant-001',
      roles: ['Admin'],
    });

    vi.mocked(alertingService.listInAppAlerts).mockResolvedValue(INITIAL_DEMO_ALERTS);
    vi.mocked(alertingService.listTriggerRules).mockResolvedValue(INITIAL_DEMO_TRIGGERS);
    vi.mocked(alertingService.listNotificationPreferences).mockResolvedValue(
      INITIAL_DEMO_PREFERENCES
    );

    render(
      <AccessibilityProvider>
        <NotificationsPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    // Click Trigger Rules overview card
    const triggerCard = screen.getByText('Trigger Rules').closest('div');
    if (triggerCard) {
      fireEvent.click(triggerCard);
    }

    await waitFor(() => {
      const triggerTab = screen.getByRole('tab', { name: /trigger rules/i });
      expect(triggerTab).toHaveAttribute('aria-selected', 'true');
    });

    // Click Role Preferences overview card
    const prefCard = screen.getByText('Role Preferences').closest('div');
    if (prefCard) {
      fireEvent.click(prefCard);
    }

    await waitFor(() => {
      const prefTab = screen.getByRole('tab', { name: /role preferences/i });
      expect(prefTab).toHaveAttribute('aria-selected', 'true');
    });
  });
});
