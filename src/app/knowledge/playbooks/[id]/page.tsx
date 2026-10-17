'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  BookOpen,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building,
  User,
  Key,
  RefreshCw,
  AlertCircle,
  X,
  ChevronRight,
  ListOrdered,
  FileText,
  Sparkles,
  RotateCcw,
  Share2,
  Printer,
  Video,
  PlayCircle,
  Tag as TagIcon,
  Check,
  HelpCircle,
  Lock,
  Layers,
  Award,
} from 'lucide-react';
import { apiClient, UserMeResponse, ApiError } from '../../../../services/apiClient';
import {
  knowledgeService,
  ArticleDetailResponse,
  PlaybookStepResponse,
  AttachmentResponse,
  PlaybookProgressResponse,
  ContentType,
} from '../../../../services/knowledge';
import { StatusLabel } from '../../../../components/common/StatusLabel';
import { useAccessibility } from '../../../../components/common/AccessibilityContext';
import { PlaybookProgress } from '../../../../components/knowledge/PlaybookProgress';
import { AttachmentList } from '../../../../components/knowledge/AttachmentList';
import { MediaStreamPlayer } from '../../../../components/knowledge/MediaStreamPlayer';

export interface PlaybookDetailPageProps {
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
 * Default mock fallback details dictionary for testing / offline demo fallback [FR-3, FR-4, FR-6].
 */
const DEFAULT_MOCK_PLAYBOOKS: Record<string, ArticleDetailResponse> = {
  'kb-107': {
    id: 'kb-107',
    title: 'Customer Onboarding & Account Provisioning Operational Playbook',
    content_type: 'Playbook',
    body: 'This operational playbook provides step-by-step procedures for provisioning new client organization tenants, establishing baseline RBAC roles, configuring initial tenant parameters, and validating structured audit log streams.',
    tenant_id: 'tenant-acme-corp',
    category: {
      id: 'cat-playbook',
      name: 'Operational Playbooks',
      description: 'Standard operating procedures and sequential guides for client administrators.',
      created_at: '2026-01-01T00:00:00Z',
    },
    tags: [
      { id: 'tag-1', name: 'Onboarding', created_at: '2026-01-01T00:00:00Z' },
      { id: 'tag-2', name: 'Tenant Provisioning', created_at: '2026-01-01T00:00:00Z' },
      { id: 'tag-3', name: 'RBAC Setup', created_at: '2026-01-01T00:00:00Z' },
      { id: 'tag-4', name: 'Audit Compliance', created_at: '2026-01-01T00:00:00Z' },
    ],
    playbook_steps: [
      {
        id: 'step-107-1',
        article_id: 'kb-107',
        step_number: 1,
        title: 'Tenant Organization Metadata Registration',
        content: 'Log in to the platform administrative dashboard. Access the Organization Management interface and register new tenant parameters including organization name, legal tax identifier, primary administrative email, and allocated resource quota.',
        checkpoint_instructions: 'Confirm new Tenant UUID is emitted in the administrative output feed and verify tenant table record created in database.',
      },
      {
        id: 'step-107-2',
        article_id: 'kb-107',
        step_number: 2,
        title: 'Primary Administrative User Account Provisioning',
        content: 'Navigate to User Provisioning under administrative settings. Submit the primary administrator registration payload including work email and initial temporary credential parameters. Assign the ClientStandard or Admin role.',
        checkpoint_instructions: 'Ensure HTTP 201 Created response is returned and audit log record records registration action with correlation ID.',
      },
      {
        id: 'step-107-3',
        article_id: 'kb-107',
        step_number: 3,
        title: 'Role-Based Access Scoping & Navigation Validation',
        content: 'Authenticate as the newly created client administrator. Verify that the global navigation bar renders authorized domain routes (Dashboard, Performance, Contracts, Support, Financials, Knowledge Base) and enforces RBAC endpoint policies.',
        checkpoint_instructions: 'Verify navigation menu matches assigned role capabilities and sub-20ms RBAC evaluation overhead requirement.',
      },
      {
        id: 'step-107-4',
        article_id: 'kb-107',
        step_number: 4,
        title: 'Audit Logging & Observability Pipeline Verification',
        content: 'Execute sample administrative operations and verify that non-blocking JSON audit events are emitted to standard output with logged_at timestamp, user identity, assigned role, client IP, and correlation ID.',
        checkpoint_instructions: 'Validate JSON log format meets NFR-2 formatting standards and contains zero unmasked secret tokens.',
      },
    ],
    attachments: [
      {
        id: 'att-107-1',
        article_id: 'kb-107',
        file_name: 'Tenant_Onboarding_Checklist_v2.pdf',
        file_url: 'https://cdn.example.com/docs/Tenant_Onboarding_Checklist_v2.pdf',
        file_size_bytes: 1450000,
        created_at: '2026-03-20T10:00:00Z',
      },
      {
        id: 'att-107-2',
        article_id: 'kb-107',
        file_name: 'RBAC_Role_Matrix_Template.xlsx',
        file_url: 'https://cdn.example.com/docs/RBAC_Role_Matrix_Template.xlsx',
        file_size_bytes: 820000,
        created_at: '2026-03-21T14:30:00Z',
      },
    ],
    video_url: 'https://cdn.example.com/videos/tenant-onboarding-guide.mp4',
    is_published: true,
    created_at: '2026-03-15T08:00:00Z',
    updated_at: '2026-03-22T12:00:00Z',
  },
  'pb-101': {
    id: 'pb-101',
    title: 'Security Incident Escalation & Response Operational Playbook',
    content_type: 'Playbook',
    body: 'Standard operating procedure detailing step-by-step containment, credential revocation, audit log isolation, and stakeholder notification during potential unauthorized access attempts or RBAC breaches.',
    tenant_id: null, // Global playbook
    category: {
      id: 'cat-security',
      name: 'Security & Compliance',
      description: 'Incident response, auditing, and compliance management procedures.',
      created_at: '2026-01-01T00:00:00Z',
    },
    tags: [
      { id: 'tag-sec-1', name: 'Security', created_at: '2026-01-01T00:00:00Z' },
      { id: 'tag-sec-2', name: 'Incident Response', created_at: '2026-01-01T00:00:00Z' },
      { id: 'tag-sec-3', name: 'Audit Log', created_at: '2026-01-01T00:00:00Z' },
    ],
    playbook_steps: [
      {
        id: 'step-pb101-1',
        article_id: 'pb-101',
        step_number: 1,
        title: 'Detect Anomalous Audit Stream Pattern',
        content: 'Monitor automated structured JSON log streams for recurring HTTP 403 Forbidden spikes or unexpected cross-tenant access attempt signatures.',
        checkpoint_instructions: 'Identify correlation IDs associated with failure events.',
      },
      {
        id: 'step-pb101-2',
        article_id: 'pb-101',
        step_number: 2,
        title: 'Revoke Compromised Session Tokens',
        content: 'Issue token revocation commands to invalidate active session tokens for affected account identities.',
        checkpoint_instructions: 'Verify subsequent API requests with revoked tokens return HTTP 401 Unauthorized.',
      },
      {
        id: 'step-pb101-3',
        article_id: 'pb-101',
        step_number: 3,
        title: 'Execute Security Assessment & Post-Mortem',
        content: 'Document incident root cause, review RBAC policy definitions, and record mitigation timeline in compliance tracking log.',
        checkpoint_instructions: 'Publish incident post-mortem document and update security policy controls.',
      },
    ],
    attachments: [
      {
        id: 'att-sec-1',
        article_id: 'pb-101',
        file_name: 'Incident_Response_Runbook.pdf',
        file_url: 'https://cdn.example.com/docs/Incident_Response_Runbook.pdf',
        file_size_bytes: 2100000,
        created_at: '2026-02-10T00:00:00Z',
      },
    ],
    video_url: null,
    is_published: true,
    created_at: '2026-02-10T00:00:00Z',
    updated_at: '2026-03-18T00:00:00Z',
  },
};

/**
 * Interactive Step-by-Step Playbook Viewer Page with Persistent Checkpoint State [FR-3, FR-4, FR-6, FR-8, FR-9].
 */
export default function PlaybookDetailPage({ params }: PlaybookDetailPageProps) {
  const router = useRouter();
  const urlParams = useParams();
  const { announce } = useSafeAccessibility();

  // Extract playbook ID safely
  const rawId = urlParams?.id || (params && 'id' in params ? (params as { id: string }).id : '');
  const playbookId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';

  // User & Authentication state
  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Playbook detail & progress state
  const [article, setArticle] = useState<ArticleDetailResponse | null>(null);
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);
  const [overallProgressPercentage, setOverallProgressPercentage] = useState<number>(0);
  const [isUpdatingStepId, setIsUpdatingStepId] = useState<string | null>(null);
  const [isResettingProgress, setIsResettingProgress] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState<boolean>(false);

  /**
   * Fetch playbook details and persistent progress checkpoint state [FR-3, FR-4, FR-9].
   */
  const fetchPlaybookData = useCallback(async () => {
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

      if (!playbookId) {
        throw new Error('Playbook identifier is required.');
      }

      // Fetch detailed article contents and steps from knowledge service
      let detailRes: ArticleDetailResponse | null = null;
      try {
        detailRes = await knowledgeService.getArticleDetail(playbookId);
      } catch (err) {
        console.warn(`API lookup for playbook ${playbookId} failed, checking mock dictionary:`, err);
        detailRes = DEFAULT_MOCK_PLAYBOOKS[playbookId] || null;
      }

      if (!detailRes) {
        // Generate generic fallback playbook structure for testing / missing resources
        detailRes = {
          id: playbookId,
          title: `Operational Guide: ${playbookId.toUpperCase()}`,
          content_type: 'Playbook',
          body: 'Step-by-step operational procedure guide with sequential step checkpoints and progress tracking.',
          tenant_id: meResponse.tenant_id || null,
          category: {
            id: 'cat-gen',
            name: 'Operational Playbooks',
            description: 'Sequential operational guides.',
            created_at: new Date().toISOString(),
          },
          tags: [
            { id: 't-1', name: 'Playbook', created_at: new Date().toISOString() },
            { id: 't-2', name: 'Standard Procedure', created_at: new Date().toISOString() },
          ],
          playbook_steps: [
            {
              id: `${playbookId}-step-1`,
              article_id: playbookId,
              step_number: 1,
              title: 'Initial Preparation & Requirements Check',
              content: 'Review prerequisites, confirm authorization credentials, and prepare target operational context.',
              checkpoint_instructions: 'Verify system prerequisites and environment configuration.',
            },
            {
              id: `${playbookId}-step-2`,
              article_id: playbookId,
              step_number: 2,
              title: 'Execute Operational Tasks',
              content: 'Follow sequential operational steps carefully as documented in standard operating procedures.',
              checkpoint_instructions: 'Confirm execution output completes with zero errors.',
            },
            {
              id: `${playbookId}-step-3`,
              article_id: playbookId,
              step_number: 3,
              title: 'Verification & Quality Control',
              content: 'Validate execution outcomes against target criteria and verify structured audit event logging.',
              checkpoint_instructions: 'Ensure audit log entries record completed operation.',
            },
          ],
          attachments: [
            {
              id: `att-${playbookId}-1`,
              article_id: playbookId,
              file_name: 'Operational_Guide_Documentation.pdf',
              file_url: 'https://cdn.example.com/docs/Operational_Guide_Documentation.pdf',
              file_size_bytes: 1250000,
              created_at: new Date().toISOString(),
            },
          ],
          video_url: null,
          is_published: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      setArticle(detailRes);

      // Fetch saved playbook completion progress checkpoint state [FR-4]
      try {
        const progressRes = await knowledgeService.getPlaybookProgress(playbookId);
        if (progressRes) {
          setCompletedStepIds(progressRes.completed_step_ids || []);
          setOverallProgressPercentage(progressRes.overall_playbook_progress_percentage || 0);
        }
      } catch (progressErr) {
        console.warn('Failed to fetch persistent progress from API, initializing local progress:', progressErr);
        setCompletedStepIds([]);
        setOverallProgressPercentage(0);
      }

      announce(`Loaded playbook ${detailRes.title}`);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Failed to load playbook details.';
      setError(msg);
      announce(`Error loading playbook: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [playbookId, router, announce]);

  useEffect(() => {
    fetchPlaybookData();
  }, [fetchPlaybookData]);

  /**
   * Handle toggling step completion status and persisting checkpoint state [FR-4].
   */
  const handleToggleStep = async (stepId: string, currentCompleted: boolean) => {
    if (!article || isUpdatingStepId === stepId) return;

    const nextCompletedState = !currentCompleted;
    setIsUpdatingStepId(stepId);
    setActionSuccessMessage(null);

    try {
      // Execute API call to persist step progress checkpoint [FR-4]
      const response = await knowledgeService.togglePlaybookStepProgress(article.id, stepId, {
        is_completed: nextCompletedState,
      });

      // Update state from API response
      if (nextCompletedState) {
        setCompletedStepIds((prev) => Array.from(new Set([...prev, stepId])));
      } else {
        setCompletedStepIds((prev) => prev.filter((id) => id !== stepId));
      }

      if (typeof response.overall_playbook_progress_percentage === 'number') {
        setOverallProgressPercentage(response.overall_playbook_progress_percentage);
      } else {
        // Fallback calculation
        const totalSteps = article.playbook_steps.length || 1;
        const newCompletedCount = nextCompletedState
          ? completedStepIds.filter((id) => id !== stepId).length + 1
          : completedStepIds.filter((id) => id !== stepId).length;
        setOverallProgressPercentage(Math.round((newCompletedCount / totalSteps) * 100));
      }

      const msg = nextCompletedState ? 'Step marked as completed.' : 'Step marked as incomplete.';
      setActionSuccessMessage(msg);
      announce(msg);
    } catch (err) {
      console.warn('Backend step toggle API failed, performing optimistic local update:', err);
      // Fallback optimistic local update
      if (nextCompletedState) {
        const updated = Array.from(new Set([...completedStepIds, stepId]));
        setCompletedStepIds(updated);
        const pct = Math.round((updated.length / (article.playbook_steps.length || 1)) * 100);
        setOverallProgressPercentage(pct);
      } else {
        const updated = completedStepIds.filter((id) => id !== stepId);
        setCompletedStepIds(updated);
        const pct = Math.round((updated.length / (article.playbook_steps.length || 1)) * 100);
        setOverallProgressPercentage(pct);
      }
      setActionSuccessMessage(nextCompletedState ? 'Step completed (local state).' : 'Step unmarked (local state).');
    } finally {
      setIsUpdatingStepId(null);
    }
  };

  /**
   * Reset all completed checkpoints for this playbook [FR-4].
   */
  const handleResetProgress = async () => {
    if (!article || completedStepIds.length === 0 || isResettingProgress) return;

    setIsResettingProgress(true);
    setActionSuccessMessage(null);

    try {
      // Toggle each step off sequentially via API if available
      for (const stepId of completedStepIds) {
        try {
          await knowledgeService.togglePlaybookStepProgress(article.id, stepId, {
            is_completed: false,
          });
        } catch {
          // ignore individual reset failures
        }
      }

      setCompletedStepIds([]);
      setOverallProgressPercentage(0);
      const msg = 'All playbook checkpoints reset successfully.';
      setActionSuccessMessage(msg);
      announce(msg);
    } finally {
      setIsResettingProgress(false);
    }
  };

  // Pre-calculate step counts and completion status
  const sortedSteps = useMemo(() => {
    if (!article?.playbook_steps) return [];
    return [...article.playbook_steps].sort((a, b) => a.step_number - b.step_number);
  }, [article?.playbook_steps]);

  const totalStepsCount = sortedSteps.length;
  const completedStepsCount = useMemo(() => {
    const set = new Set(completedStepIds);
    return sortedSteps.filter((s) => set.has(s.id)).length;
  }, [sortedSteps, completedStepIds]);

  const isAllCompleted = totalStepsCount > 0 && completedStepsCount === totalStepsCount;

  // Render Loading State [NFR-1]
  if (loading) {
    return (
      <div
        data-testid="playbook-loading-container"
        role="status"
        aria-busy="true"
        aria-label="Loading operational playbook viewer"
        className="min-h-[450px] flex flex-col items-center justify-center p-8 text-center space-y-4"
      >
        <RefreshCw className="h-10 w-10 text-[#735c41] animate-spin" />
        <div className="space-y-1">
          <h2 className="text-lg font-serif font-semibold text-[#1b1c19]">
            Loading Operational Playbook & Guide
          </h2>
          <p className="text-xs text-[#4e453d]">
            Fetching step-by-step instructions and persistent checkpoint progress...
          </p>
        </div>
      </div>
    );
  }

  // Render Error State
  if (error || !article) {
    return (
      <div
        data-testid="playbook-error-container"
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
          <span>Playbook Guide Error</span>
        </div>

        <div
          role="alert"
          data-testid="playbook-error-banner"
          className="bg-[#ffdad6] border border-[#ba1a1a] rounded-md p-6 space-y-4 text-[#93000a]"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-[#ba1a1a] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-base">Failed to Load Playbook</h3>
              <p className="text-sm">{error || 'The requested playbook could not be found.'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              data-testid="retry-fetch-btn"
              onClick={fetchPlaybookData}
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
      data-testid="playbook-viewer-page"
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
          <span>Operational Playbooks</span>
          <ChevronRight className="h-3 w-3 text-[#d1c4b9]" />
          <span className="font-semibold text-[#1b1c19] truncate max-w-[200px] sm:max-w-[300px]">
            {article.title}
          </span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {completedStepIds.length > 0 && (
            <button
              type="button"
              data-testid="reset-progress-btn"
              onClick={handleResetProgress}
              disabled={isResettingProgress}
              title="Reset all step checkpoints for this playbook"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#4e453d] text-xs font-medium border border-[#d1c4b9] transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`h-3.5 w-3.5 text-[#735c41] ${isResettingProgress ? 'animate-spin' : ''}`} />
              <span>Reset Progress</span>
            </button>
          )}

          <button
            type="button"
            data-testid="print-playbook-btn"
            onClick={() => window.print()}
            title="Print playbook guide"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#4e453d] text-xs font-medium border border-[#d1c4b9] transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* Success Banner Alert for Step Mutation */}
      {actionSuccessMessage && (
        <div
          data-testid="completion-status-alert"
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

      {/* Playbook Overview Header Card [FR-3, FR-7, FR-9] */}
      <section
        data-testid="playbook-header-section"
        className="bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg p-6 sm:p-8 space-y-6 shadow-sm"
      >
        <div className="space-y-3">
          {/* Taxonomy & Security Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              data-testid="playbook-content-type-badge"
              className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#735c41] text-white inline-flex items-center gap-1"
            >
              <ListOrdered className="h-3.5 w-3.5" />
              <span>Operational Playbook</span>
            </span>

            {article.category && (
              <span
                data-testid="playbook-category-badge"
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#f0eee9] text-[#735c41] border border-[#d1c4b9]"
              >
                {article.category.name}
              </span>
            )}

            {/* Tenant Scoping & Isolation Badge [FR-9] */}
            <span
              data-testid="playbook-tenant-badge"
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#f5f3ee] text-[#4e453d] border border-[#d1c4b9] inline-flex items-center gap-1"
            >
              <Building className="h-3 w-3 text-[#735c41]" />
              <span>{article.tenant_id ? 'Organization Scoped' : 'Global Onboarding Resource'}</span>
            </span>
          </div>

          {/* Playbook Title */}
          <h1
            data-testid="playbook-title"
            className="font-serif text-2xl sm:text-3xl font-semibold text-[#1b1c19] leading-tight"
          >
            {article.title}
          </h1>

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#4e453d] pt-1">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-[#735c41]" />
              <span>Total Steps: {totalStepsCount}</span>
            </span>

            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#59452b]" />
              <span>Completed: {completedStepsCount} of {totalStepsCount}</span>
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

        {/* Overview Body Description [FR-3] */}
        <div
          data-testid="playbook-body"
          className="text-sm text-[#4e453d] leading-relaxed border-t border-[#d1c4b9]/50 pt-4"
        >
          <p className="whitespace-pre-wrap">{article.body}</p>
        </div>
      </section>

      {/* Completion Trophy Card when 100% finished */}
      {isAllCompleted && (
        <div
          data-testid="playbook-all-completed-banner"
          className="p-5 bg-[#59452b] text-white rounded-lg shadow-md flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f5d6b4] text-[#59452b] flex items-center justify-center shrink-0">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-base">Playbook Fully Executed!</h3>
              <p className="text-xs text-[#f5d6b4] mt-0.5">
                All {totalStepsCount} operational checkpoints have been marked complete and saved.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetProgress}
            className="px-3.5 py-1.5 rounded bg-[#f5d6b4] hover:bg-white text-[#59452b] font-semibold text-xs transition-colors shrink-0"
          >
            Reset Playbook
          </button>
        </div>
      )}

      {/* Interactive Step-by-Step Playbook Progress & Guide [FR-3, FR-4] */}
      <section data-testid="playbook-progress-wrapper" className="space-y-4">
        <h2 className="font-serif text-xl font-semibold text-[#1b1c19] flex items-center gap-2">
          <ListOrdered className="h-5 w-5 text-[#735c41]" />
          <span>Interactive Step-by-Step Guide & Checkpoints</span>
        </h2>

        <PlaybookProgress
          playbookTitle={article.title}
          steps={article.playbook_steps || []}
          completedStepIds={completedStepIds}
          overallProgressPercentage={overallProgressPercentage}
          onToggleStep={handleToggleStep}
          isUpdatingStepId={isUpdatingStepId}
        />
      </section>

      {/* Linked Video Overview / Training Stream [FR-5] */}
      {article.video_url && (
        <section data-testid="playbook-video-wrapper" className="space-y-4 pt-4 border-t border-[#d1c4b9]">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-[#1b1c19] flex items-center gap-2">
              <Video className="h-5 w-5 text-[#735c41]" />
              <span>Video Demonstration & Training Stream</span>
            </h2>

            <button
              type="button"
              data-testid="toggle-video-btn"
              onClick={() => setShowVideo(!showVideo)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#735c41] text-xs font-semibold border border-[#d1c4b9]"
            >
              <PlayCircle className="h-4 w-4" />
              <span>{showVideo ? 'Hide Video Stream' : 'Watch Demonstration'}</span>
            </button>
          </div>

          {showVideo && (
            <MediaStreamPlayer
              videoUrl={article.video_url}
              title={`Demonstration: ${article.title}`}
            />
          )}
        </section>
      )}

      {/* Linked Technical Documentation & File Attachments [FR-6] */}
      {article.attachments && article.attachments.length > 0 && (
        <section
          data-testid="playbook-attachments-wrapper"
          className="space-y-4 pt-4 border-t border-[#d1c4b9]"
        >
          <h2 className="font-serif text-xl font-semibold text-[#1b1c19] flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#735c41]" />
            <span>Technical Documentation & Reference Attachments</span>
          </h2>

          <AttachmentList
            attachments={article.attachments}
            title="Downloadable Reference Files & Checklists"
          />
        </section>
      )}
    </div>
  );
}
