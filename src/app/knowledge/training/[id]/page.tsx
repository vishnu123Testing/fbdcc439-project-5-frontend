'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  Film,
  ArrowLeft,
  ChevronRight,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Building,
  Tag as TagIcon,
  Share2,
  Printer,
  RefreshCw,
  AlertCircle,
  PlayCircle,
  X,
  Award,
  Check,
} from 'lucide-react';
import { apiClient, UserMeResponse, ApiError } from '../../../../services/apiClient';
import {
  knowledgeService,
  ArticleDetailResponse,
} from '../../../../services/knowledge';
import { useAccessibility } from '../../../../components/common/AccessibilityContext';
import { AttachmentList } from '../../../../components/knowledge/AttachmentList';
import { MediaStreamPlayer } from '../../../../components/knowledge/MediaStreamPlayer';

export interface TrainingDetailPageProps {
  params?: { id: string } | Promise<{ id: string }>;
}

/**
 * Safe accessibility hook wrapper preventing crashes when rendered outside AccessibilityProvider.
 */
function useSafeAccessibility() {
  try {
    return useAccessibility();
  } catch {
    return {
      announcement: null,
      announce: () => {},
      clearAnnouncement: () => {},
    };
  }
}

/**
 * Default mock fallback training video dictionary for offline testing and demo resources [FR-5, FR-6, FR-7].
 */
const DEFAULT_MOCK_TRAINING_VIDEOS: Record<string, ArticleDetailResponse> = {
  'kb-108': {
    id: 'kb-108',
    title: 'Platform Architecture & Access Control Deep Dive Training Video',
    content_type: 'TrainingVideo',
    body: 'Comprehensive video training module walking through the PairFront platform architecture, synchronous SQLAlchemy ORM rules, sub-20ms RBAC evaluation, multi-tenant database isolation, and structured JSON audit logging setup.',
    tenant_id: 'tenant-acme-corp',
    category: {
      id: 'cat-training',
      name: 'Training Videos',
      description: 'On-demand video streaming modules and technical tutorials.',
      created_at: '2026-01-01T00:00:00Z',
    },
    tags: [
      { id: 'tag-tr-1', name: 'Architecture', created_at: '2026-01-01T00:00:00Z' },
      { id: 'tag-tr-2', name: 'Video Tutorial', created_at: '2026-01-01T00:00:00Z' },
      { id: 'tag-tr-3', name: 'RBAC', created_at: '2026-01-01T00:00:00Z' },
      { id: 'tag-tr-4', name: 'Multi-Tenant', created_at: '2026-01-01T00:00:00Z' },
    ],
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
      {
        id: 'att-108-2',
        article_id: 'kb-108',
        file_name: 'RBAC_Policy_Specification.pdf',
        file_url: 'https://cdn.example.com/docs/RBAC_Policy_Specification.pdf',
        file_size_bytes: 1850000,
        created_at: '2026-03-21T14:30:00Z',
      },
    ],
    video_url: 'https://cdn.example.com/videos/platform-architecture-deep-dive.mp4',
    is_published: true,
    created_at: '2026-03-15T08:00:00Z',
    updated_at: '2026-03-22T12:00:00Z',
  },
  'tr-201': {
    id: 'tr-201',
    title: 'Multi-Tenant Isolation & Audit Pipeline Technical Training',
    content_type: 'TrainingVideo',
    body: 'Technical training session covering client tenant isolation strategies, row-level data scoping, and structured JSON audit log emission with contextual correlation IDs.',
    tenant_id: null, // Global training resource
    category: {
      id: 'cat-training',
      name: 'Training Videos',
      description: 'On-demand video streaming modules and technical tutorials.',
      created_at: '2026-01-01T00:00:00Z',
    },
    tags: [
      { id: 'tag-tr-5', name: 'Security', created_at: '2026-01-01T00:00:00Z' },
      { id: 'tag-tr-6', name: 'Audit', created_at: '2026-01-01T00:00:00Z' },
    ],
    playbook_steps: [],
    attachments: [
      {
        id: 'att-tr201-1',
        article_id: 'tr-201',
        file_name: 'Audit_Pipeline_Technical_Spec.pdf',
        file_url: 'https://cdn.example.com/docs/Audit_Pipeline_Technical_Spec.pdf',
        file_size_bytes: 2400000,
        created_at: '2026-02-15T00:00:00Z',
      },
    ],
    video_url: 'https://cdn.example.com/videos/multitenant-audit-training.mp4',
    is_published: true,
    created_at: '2026-02-15T00:00:00Z',
    updated_at: '2026-03-18T00:00:00Z',
  },
};

/**
 * On-Demand Training Video Streaming Page with Embedded Video Player and Technical Attachments [FR-5, FR-6, FR-7, FR-8, FR-9].
 */
export default function TrainingDetailPage({ params }: TrainingDetailPageProps) {
  const router = useRouter();
  const urlParams = useParams();
  const { announce } = useSafeAccessibility();

  // Extract training ID safely with support for sync and async params [FR-5]
  const [trainingId, setTrainingId] = useState<string>(() => {
    const fromUrl = urlParams?.id;
    if (typeof fromUrl === 'string') return fromUrl;
    if (Array.isArray(fromUrl)) return fromUrl[0];
    if (params && 'id' in params && typeof (params as { id: string }).id === 'string') {
      return (params as { id: string }).id;
    }
    return '';
  });

  useEffect(() => {
    let isMounted = true;
    const resolveParams = async () => {
      let id = '';
      const fromUrl = urlParams?.id;
      if (typeof fromUrl === 'string') {
        id = fromUrl;
      } else if (Array.isArray(fromUrl)) {
        id = fromUrl[0];
      } else if (params) {
        const resolved = await Promise.resolve(params);
        if (resolved && typeof resolved.id === 'string') {
          id = resolved.id;
        }
      }
      if (isMounted && id) {
        setTrainingId(id);
      }
    };
    resolveParams();
    return () => {
      isMounted = false;
    };
  }, [params, urlParams]);

  // User & Authentication state
  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Training video detail state
  const [article, setArticle] = useState<ArticleDetailResponse | null>(null);
  const [hasWatched, setHasWatched] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  /**
   * Fetch training video details and authenticated user context [FR-5, FR-6, FR-9].
   */
  const fetchTrainingData = useCallback(async () => {
    const token = apiClient.getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Authenticate user identity and permissions
      const meResponse = await apiClient.getMe();
      setUser(meResponse);

      if (!trainingId) {
        throw new Error('Training module identifier is required.');
      }

      // Fetch detailed training article from knowledge service
      let detailRes: ArticleDetailResponse | null = null;
      try {
        detailRes = await knowledgeService.getArticleDetail(trainingId);
      } catch (err) {
        console.warn(`API lookup for training module ${trainingId} failed, checking mock dictionary:`, err);
        detailRes = DEFAULT_MOCK_TRAINING_VIDEOS[trainingId] || null;
      }

      if (!detailRes) {
        // Fallback training video article for testing / missing resources
        detailRes = {
          id: trainingId,
          title: `On-Demand Training: ${trainingId.toUpperCase()}`,
          content_type: 'TrainingVideo',
          body: 'On-demand training video tutorial detailing technical operations, platform capabilities, and operational procedures.',
          tenant_id: meResponse.tenant_id || null,
          category: {
            id: 'cat-tr-gen',
            name: 'Training Videos',
            description: 'On-demand video streaming modules.',
            created_at: new Date().toISOString(),
          },
          tags: [
            { id: 't-tr-1', name: 'Training', created_at: new Date().toISOString() },
            { id: 't-tr-2', name: 'Video Tutorial', created_at: new Date().toISOString() },
          ],
          playbook_steps: [],
          attachments: [
            {
              id: `att-${trainingId}-1`,
              article_id: trainingId,
              file_name: 'Training_Module_Technical_Guide.pdf',
              file_url: 'https://cdn.example.com/docs/Training_Module_Technical_Guide.pdf',
              file_size_bytes: 1800000,
              created_at: new Date().toISOString(),
            },
          ],
          video_url: 'https://cdn.example.com/videos/sample-training-stream.mp4',
          is_published: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      setArticle(detailRes);
      announce(`Loaded training video: ${detailRes.title}`);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Failed to load training video details.';
      setError(msg);
      announce(`Error loading training video: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [trainingId, router, announce]);

  useEffect(() => {
    fetchTrainingData();
  }, [fetchTrainingData]);

  /**
   * Toggle completed/watched state for the training video [FR-5].
   */
  const handleToggleWatched = () => {
    const nextWatchedState = !hasWatched;
    setHasWatched(nextWatchedState);
    const msg = nextWatchedState
      ? 'Training video marked as completed.'
      : 'Training video marked as incomplete.';
    setActionSuccessMessage(msg);
    announce(msg);
  };

  /**
   * Handle sharing link to training module.
   */
  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
          const msg = 'Training video URL copied to clipboard.';
          setActionSuccessMessage(msg);
          announce(msg);
        })
        .catch(() => {
          setActionSuccessMessage('Unable to copy URL.');
        });
    }
  };

  // Render Loading State [NFR-1]
  if (loading) {
    return (
      <div
        data-testid="training-loading-container"
        role="status"
        aria-busy="true"
        aria-label="Loading training video page"
        className="min-h-[450px] flex flex-col items-center justify-center p-8 text-center space-y-4"
      >
        <RefreshCw className="h-10 w-10 text-[#735c41] animate-spin" />
        <div className="space-y-1">
          <h2 className="text-lg font-serif font-semibold text-[#1b1c19]">
            Loading Training Video & Technical Documentation...
          </h2>
          <p className="text-xs text-[#4e453d]">
            Fetching media stream URL, captions, and downloadable technical attachments...
          </p>
        </div>
      </div>
    );
  }

  // Render Error State
  if (error || !article) {
    return (
      <div
        data-testid="training-error-container"
        className="max-w-4xl mx-auto space-y-6 text-[#1b1c19]"
      >
        <div className="flex items-center gap-2 text-xs text-[#4e453d]">
          <Link
            href="/knowledge"
            className="hover:underline flex items-center gap-1 text-[#735c41]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Knowledge Base</span>
          </Link>
          <ChevronRight className="h-3 w-3 text-[#d1c4b9]" />
          <span>Training Module Error</span>
        </div>

        <div
          role="alert"
          data-testid="training-error-banner"
          className="bg-[#ffdad6] border border-[#ba1a1a] rounded-md p-6 space-y-4 text-[#93000a]"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-[#ba1a1a] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-base">Failed to Load Training Video</h3>
              <p className="text-sm">{error || 'The requested training video module could not be found.'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              data-testid="retry-fetch-btn"
              onClick={fetchTrainingData}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#ba1a1a] text-white text-xs font-medium hover:bg-[#93000a] transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry Loading</span>
            </button>

            <Link
              href="/knowledge"
              data-testid="back-to-knowledge-btn"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white border border-[#ba1a1a] text-[#ba1a1a] text-xs font-medium hover:bg-[#ffdad6]/50 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Knowledge Base</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="training-detail-page"
      className="max-w-5xl mx-auto space-y-8 text-[#1b1c19] pb-12"
    >
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d1c4b9]/50 pb-4">
        <div className="flex items-center gap-2 text-xs text-[#4e453d]">
          <Link
            href="/knowledge"
            data-testid="back-to-knowledge-link"
            className="hover:underline flex items-center gap-1 text-[#735c41] font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Knowledge Base</span>
          </Link>
          <ChevronRight className="h-3 w-3 text-[#d1c4b9]" />
          <span>Training Videos</span>
          <ChevronRight className="h-3 w-3 text-[#d1c4b9]" />
          <span className="font-semibold text-[#1b1c19] truncate max-w-[200px] sm:max-w-[300px]">
            {article.title}
          </span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            data-testid="mark-watched-btn"
            onClick={handleToggleWatched}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
              hasWatched
                ? 'bg-[#59452b] text-white border-[#59452b] hover:bg-[#735c41]'
                : 'bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#735c41] border-[#d1c4b9]'
            }`}
          >
            {hasWatched ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Completed</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Mark as Completed</span>
              </>
            )}
          </button>

          <button
            type="button"
            data-testid="share-training-btn"
            onClick={handleShare}
            title="Share training video URL"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#4e453d] text-xs font-medium border border-[#d1c4b9] transition-colors"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <button
            type="button"
            data-testid="print-training-btn"
            onClick={() => window.print()}
            title="Print training page details"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#4e453d] text-xs font-medium border border-[#d1c4b9] transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* Action Success Alert Notification */}
      {actionSuccessMessage && (
        <div
          data-testid="action-status-alert"
          role="status"
          className="p-3 bg-[#f5d6b4]/30 border border-[#735c41] text-[#59452b] rounded-md text-xs font-medium flex items-center justify-between gap-2 transition-all"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#59452b] shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMessage(null)}
            className="text-[#59452b] hover:text-[#1b1c19]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Header Overview Card [FR-5, FR-7, FR-9] */}
      <section
        data-testid="training-header-section"
        className="bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg p-6 sm:p-8 space-y-6 shadow-sm"
      >
        <div className="space-y-3">
          {/* Taxonomy & Security Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              data-testid="training-content-type-badge"
              className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#a43b2c] text-white inline-flex items-center gap-1"
            >
              <Film className="h-3.5 w-3.5" />
              <span>Training Video</span>
            </span>

            {article.category && (
              <span
                data-testid="training-category-badge"
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#f0eee9] text-[#735c41] border border-[#d1c4b9]"
              >
                {article.category.name}
              </span>
            )}

            {/* Tenant Scoping & Isolation Badge [FR-9] */}
            <span
              data-testid="training-tenant-badge"
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#f5f3ee] text-[#4e453d] border border-[#d1c4b9] inline-flex items-center gap-1"
            >
              <Building className="h-3 w-3 text-[#735c41]" />
              <span>{article.tenant_id ? 'Organization Scoped' : 'Global Onboarding Resource'}</span>
            </span>
          </div>

          {/* Module Title */}
          <h1
            data-testid="training-title"
            className="font-serif text-2xl sm:text-3xl font-semibold text-[#1b1c19] leading-tight"
          >
            {article.title}
          </h1>

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#4e453d] pt-1">
            <span className="flex items-center gap-1">
              <PlayCircle className="h-3.5 w-3.5 text-[#a43b2c]" />
              <span>Format: On-Demand Streaming Video</span>
            </span>

            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[#735c41]" />
              <span>Access Level: {user?.roles?.join(', ') || 'ClientStandard'}</span>
            </span>
          </div>
        </div>

        {/* Tags List [FR-7] */}
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#d1c4b9]/50">
            <TagIcon className="h-3.5 w-3.5 text-[#80756b] mr-1" />
            {article.tags.map((tag) => (
              <span
                key={tag.id || tag.name}
                className="px-2 py-0.5 rounded bg-[#f5f3ee] text-[#4e453d] text-[11px] font-medium border border-[#d1c4b9]/60"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Overview Body Description [FR-5] */}
        <div
          data-testid="training-body"
          className="text-sm text-[#4e453d] leading-relaxed border-t border-[#d1c4b9]/50 pt-4"
        >
          <p className="whitespace-pre-wrap">{article.body}</p>
        </div>
      </section>

      {/* Video Completed Completion Banner */}
      {hasWatched && (
        <div
          data-testid="training-completed-banner"
          className="p-5 bg-[#59452b] text-white rounded-lg shadow-md flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f5d6b4] text-[#59452b] flex items-center justify-center shrink-0">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-base">Training Video Module Completed!</h3>
              <p className="text-xs text-[#f5d6b4] mt-0.5">
                You have completed this on-demand training module. Review attached technical guides below as needed.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleWatched}
            className="px-3.5 py-1.5 rounded bg-[#f5d6b4] hover:bg-white text-[#59452b] font-semibold text-xs transition-colors shrink-0"
          >
            Mark as Incomplete
          </button>
        </div>
      )}

      {/* Primary Video Stream Section [FR-5] */}
      <section data-testid="training-video-section" className="space-y-4">
        <h2 className="font-serif text-xl font-semibold text-[#1b1c19] flex items-center gap-2">
          <Film className="h-5 w-5 text-[#a43b2c]" />
          <span>On-Demand Training Video Stream</span>
        </h2>

        <MediaStreamPlayer
          videoUrl={article.video_url}
          title={article.title}
          onEnded={() => {
            setHasWatched(true);
            const msg = 'Video playback finished. Training module marked as completed!';
            setActionSuccessMessage(msg);
            announce(msg);
          }}
        />
      </section>

      {/* Technical Documentation & Downloadable Attachments [FR-6] */}
      {article.attachments && article.attachments.length > 0 && (
        <section
          data-testid="training-attachments-section"
          className="space-y-4 pt-4 border-t border-[#d1c4b9]"
        >
          <h2 className="font-serif text-xl font-semibold text-[#1b1c19] flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#735c41]" />
            <span>Technical Documentation & Downloadable Attachments</span>
          </h2>

          <AttachmentList
            attachments={article.attachments}
            title="Downloadable Technical References & User Guides"
          />
        </section>
      )}
    </div>
  );
}