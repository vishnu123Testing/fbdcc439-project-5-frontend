import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlaybookDetailPage from '../../src/app/knowledge/playbooks/[id]/page';
import { apiClient, ApiError } from '../../src/services/apiClient';
import { knowledgeService } from '../../src/services/knowledge';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';

const mockPush = vi.fn();

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/knowledge/playbooks/kb-107',
  useParams: () => ({ id: 'kb-107' }),
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

// Mock apiClient and knowledgeService
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

vi.mock('../../src/services/knowledge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/knowledge')>();
  return {
    ...actual,
    knowledgeService: {
      ...actual.knowledgeService,
      getArticleDetail: vi.fn(),
      getPlaybookProgress: vi.fn(),
      togglePlaybookStepProgress: vi.fn(),
    },
  };
});

describe('PlaybookDetailPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login if no authentication token is present', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue(null);

    render(
      <AccessibilityProvider>
        <PlaybookDetailPage params={{ id: 'kb-107' }} />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders loading state initially while fetching playbook data', () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockReturnValue(new Promise(() => {})); // pending
    vi.mocked(knowledgeService.getArticleDetail).mockReturnValue(new Promise(() => {}));

    render(
      <AccessibilityProvider>
        <PlaybookDetailPage params={{ id: 'kb-107' }} />
      </AccessibilityProvider>
    );

    const loadingContainer = screen.getByTestId('playbook-loading-container');
    expect(loadingContainer).toBeInDocument();
    expect(loadingContainer).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading Operational Playbook & Guide')).toBeInDocument();
  });

  it('renders error banner and retry button when data fetching fails', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockRejectedValue(new Error('Database connection failed'));

    render(
      <AccessibilityProvider>
        <PlaybookDetailPage params={{ id: 'kb-107' }} />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('playbook-error-banner')).toBeInDocument();
    });

    expect(screen.getByText('Failed to Load Playbook')).toBeInDocument();
    expect(screen.getByText('Database connection failed')).toBeInDocument();

    const retryButton = screen.getByTestId('retry-fetch-btn');
    expect(retryButton).toBeInDocument();
  });

  it('renders playbook title, steps list, attachments, and progress bar when playbook loads successfully', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-1',
      email: 'admin@acme.com',
      tenant_id: 'tenant-1',
      roles: ['Admin'],
    });

    vi.mocked(knowledgeService.getArticleDetail).mockResolvedValue({
      id: 'kb-107',
      title: 'Customer Onboarding & Account Provisioning Operational Playbook',
      content_type: 'Playbook',
      body: 'Overview of tenant onboarding procedures.',
      tenant_id: 'tenant-1',
      category: { id: 'cat-1', name: 'Operational Playbooks', created_at: '2026-01-01T00:00:00Z' },
      tags: [{ id: 't-1', name: 'Onboarding', created_at: '2026-01-01T00:00:00Z' }],
      playbook_steps: [
        {
          id: 'step-1',
          article_id: 'kb-107',
          step_number: 1,
          title: 'Tenant Registration',
          content: 'Register new tenant details.',
          checkpoint_instructions: 'Check database record exists.',
        },
        {
          id: 'step-2',
          article_id: 'kb-107',
          step_number: 2,
          title: 'User Creation',
          content: 'Create initial admin user.',
          checkpoint_instructions: null,
        },
      ],
      attachments: [
        {
          id: 'att-1',
          article_id: 'kb-107',
          file_name: 'Onboarding_Checklist.pdf',
          file_url: 'https://cdn.example.com/docs/Onboarding_Checklist.pdf',
          file_size_bytes: 500000,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      video_url: null,
      is_published: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    vi.mocked(knowledgeService.getPlaybookProgress).mockResolvedValue({
      article_id: 'kb-107',
      completed_step_ids: ['step-1'],
      total_completed: 1,
      total_steps: 2,
      overall_playbook_progress_percentage: 50,
    });

    render(
      <AccessibilityProvider>
        <PlaybookDetailPage params={{ id: 'kb-107' }} />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('playbook-viewer-page')).toBeInDocument();
    });

    expect(screen.getByTestId('playbook-title')).toHaveTextContent(
      'Customer Onboarding & Account Provisioning Operational Playbook'
    );
    expect(screen.getByTestId('playbook-category-badge')).toHaveTextContent('Operational Playbooks');
    expect(screen.getByTestId('playbook-progress-wrapper')).toBeInDocument();
    expect(screen.getByTestId('step-completed-badge-step-1')).toBeInDocument();
    expect(screen.getByTestId('playbook-attachments-wrapper')).toBeInDocument();
    expect(screen.getByText('Onboarding_Checklist.pdf')).toBeInDocument();
  });

  it('toggles step completion when user clicks step toggle button', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-1',
      email: 'admin@acme.com',
      tenant_id: 'tenant-1',
      roles: ['Admin'],
    });

    vi.mocked(knowledgeService.getArticleDetail).mockResolvedValue({
      id: 'kb-107',
      title: 'Customer Onboarding Playbook',
      content_type: 'Playbook',
      body: 'Overview text.',
      tenant_id: 'tenant-1',
      category: { id: 'cat-1', name: 'Operational Playbooks', created_at: '2026-01-01T00:00:00Z' },
      tags: [],
      playbook_steps: [
        {
          id: 'step-1',
          article_id: 'kb-107',
          step_number: 1,
          title: 'Step One Title',
          content: 'Step One Content',
          checkpoint_instructions: null,
        },
      ],
      attachments: [],
      video_url: null,
      is_published: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    vi.mocked(knowledgeService.getPlaybookProgress).mockResolvedValue({
      article_id: 'kb-107',
      completed_step_ids: [],
      total_completed: 0,
      total_steps: 1,
      overall_playbook_progress_percentage: 0,
    });

    vi.mocked(knowledgeService.togglePlaybookStepProgress).mockResolvedValue({
      step_id: 'step-1',
      is_completed: true,
      completed_at: '2026-03-23T10:00:00Z',
      overall_playbook_progress_percentage: 100,
    });

    render(
      <AccessibilityProvider>
        <PlaybookDetailPage params={{ id: 'kb-107' }} />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('playbook-viewer-page')).toBeInDocument();
    });

    const stepToggleBtn = screen.getByTestId('step-toggle-step-1');
    fireEvent.click(stepToggleBtn);

    await waitFor(() => {
      expect(knowledgeService.togglePlaybookStepProgress).toHaveBeenCalledWith('kb-107', 'step-1', {
        is_completed: true,
      });
    });

    expect(screen.getByTestId('completion-status-alert')).toBeInDocument();
  });
});
