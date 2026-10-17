import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TrainingDetailPage from '../../src/app/knowledge/training/[id]/page';
import { apiClient } from '../../src/services/apiClient';
import { knowledgeService } from '../../src/services/knowledge';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';

const mockPush = vi.fn();

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/knowledge/training/kb-108',
  useParams: () => ({ id: 'kb-108' }),
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
    },
  };
});

describe('TrainingDetailPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login if no authentication token is present', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue(null);

    render(
      <AccessibilityProvider>
        <TrainingDetailPage params={{ id: 'kb-108' }} />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders loading state initially while fetching training video data', () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockReturnValue(new Promise(() => {})); // pending
    vi.mocked(knowledgeService.getArticleDetail).mockReturnValue(new Promise(() => {}));

    render(
      <AccessibilityProvider>
        <TrainingDetailPage params={{ id: 'kb-108' }} />
      </AccessibilityProvider>
    );

    const loadingContainer = screen.getByTestId('training-loading-container');
    expect(loadingContainer).toBeInDocument();
    expect(loadingContainer).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(/Loading Training Video & Technical Documentation/i)).toBeInDocument();
  });

  it('renders error banner and retry button when data fetching fails', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockRejectedValue(new Error('Network request failed'));

    render(
      <AccessibilityProvider>
        <TrainingDetailPage params={{ id: 'kb-108' }} />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('training-error-banner')).toBeInDocument();
    });

    expect(screen.getByText('Failed to Load Training Video')).toBeInDocument();
    expect(screen.getByText('Network request failed')).toBeInDocument();

    const retryButton = screen.getByTestId('retry-fetch-btn');
    expect(retryButton).toBeInDocument();
  });

  it('renders training video title, embedded player, attachments, and metadata when loaded successfully', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-tr-1',
      email: 'engineer@acme.com',
      tenant_id: 'tenant-acme-corp',
      roles: ['Admin'],
    });

    vi.mocked(knowledgeService.getArticleDetail).mockResolvedValue({
      id: 'kb-108',
      title: 'Platform Architecture & Access Control Deep Dive Training Video',
      content_type: 'TrainingVideo',
      body: 'Comprehensive video training module walking through platform architecture.',
      tenant_id: 'tenant-acme-corp',
      category: {
        id: 'cat-tr',
        name: 'Training Videos',
        description: 'On-demand video streaming modules.',
        created_at: '2026-01-01T00:00:00Z',
      },
      tags: [{ id: 't-1', name: 'Architecture', created_at: '2026-01-01T00:00:00Z' }],
      playbook_steps: [],
      attachments: [
        {
          id: 'att-108-1',
          article_id: 'kb-108',
          file_name: 'Platform_Architecture_Reference_Guide.pdf',
          file_url: 'https://cdn.example.com/docs/Platform_Architecture_Reference_Guide.pdf',
          file_size_bytes: 3200000,
          created_at: '2026-03-20T10:00:00Z',
        },
      ],
      video_url: 'https://cdn.example.com/videos/platform-architecture-deep-dive.mp4',
      is_published: true,
      created_at: '2026-03-15T08:00:00Z',
      updated_at: '2026-03-22T12:00:00Z',
    });

    render(
      <AccessibilityProvider>
        <TrainingDetailPage params={{ id: 'kb-108' }} />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('training-detail-page')).toBeInDocument();
    });

    expect(screen.getByTestId('training-title')).toHaveTextContent(
      'Platform Architecture & Access Control Deep Dive Training Video'
    );
    expect(screen.getByTestId('training-content-type-badge')).toHaveTextContent('Training Video');
    expect(screen.getByTestId('training-category-badge')).toHaveTextContent('Training Videos');
    expect(screen.getByTestId('training-video-section')).toBeInDocument();
    expect(screen.getByTestId('training-attachments-section')).toBeInDocument();
    expect(screen.getByText('Platform_Architecture_Reference_Guide.pdf')).toBeInDocument();
  });

  it('allows toggling training completion status with completion banner', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-tr-1',
      email: 'engineer@acme.com',
      tenant_id: 'tenant-acme-corp',
      roles: ['Admin'],
    });

    vi.mocked(knowledgeService.getArticleDetail).mockResolvedValue({
      id: 'kb-108',
      title: 'Platform Architecture Training',
      content_type: 'TrainingVideo',
      body: 'Video training body text.',
      tenant_id: 'tenant-acme-corp',
      category: { id: 'cat-1', name: 'Training Videos', created_at: '2026-01-01T00:00:00Z' },
      tags: [],
      playbook_steps: [],
      attachments: [],
      video_url: 'https://cdn.example.com/videos/test.mp4',
      is_published: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    render(
      <AccessibilityProvider>
        <TrainingDetailPage params={{ id: 'kb-108' }} />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('training-detail-page')).toBeInDocument();
    });

    const markWatchedBtn = screen.getByTestId('mark-watched-btn');
    fireEvent.click(markWatchedBtn);

    expect(screen.getByTestId('training-completed-banner')).toBeInDocument();
    expect(screen.getByText('Training Video Module Completed!')).toBeInDocument();
    expect(screen.getByTestId('action-status-alert')).toHaveTextContent('Training video marked as completed.');
  });
});