'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Search,
  Filter,
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
  Eye,
  FileText,
  ThumbsUp,
  Tag,
  HelpCircle,
  Lock,
  Share2,
  Layers,
  Sparkles,
  PlayCircle,
  Video,
} from 'lucide-react';
import { apiClient, UserMeResponse, NavItem, ApiError } from '../../services/apiClient';
import { knowledgeService, ContentType } from '../../services/knowledge';
import { StatusLabel } from '../../components/common/StatusLabel';
import { useAccessibility } from '../../components/common/AccessibilityContext';

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: 'rbac' | 'architecture' | 'audit' | 'api' | 'compliance' | 'playbook' | 'video' | string;
  categoryLabel: string;
  summary: string;
  content: string;
  contentType?: ContentType | string;
  lastUpdated: string;
  readTime: string;
  requiredRole: 'ClientViewer' | 'ClientStandard' | 'Admin' | string;
  tags: string[];
  featured?: boolean;
  videoUrl?: string | null;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const KNOWLEDGE_CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'rbac', label: 'RBAC & Access Control' },
  { id: 'architecture', label: 'Multi-Tenant Architecture' },
  { id: 'audit', label: 'Audit Logging & Security' },
  { id: 'api', label: 'API Contracts & Integration' },
  { id: 'compliance', label: 'Compliance & WCAG 2.1 AA' },
  { id: 'playbook', label: 'Operational Playbooks' },
  { id: 'video', label: 'Training Videos' },
];

const CONTENT_TYPE_TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'All Types' },
  { id: 'FAQ', label: 'FAQs' },
  { id: 'Playbook', label: 'Playbooks' },
  { id: 'BestPractice', label: 'Best Practices' },
  { id: 'TrainingVideo', label: 'Training Videos' },
];

const INITIAL_KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'kb-101',
    title: 'Server-Side RBAC Enforcement & Sub-20ms Evaluation SLA',
    category: 'rbac',
    categoryLabel: 'RBAC & Access Control',
    summary: 'Architectural overview of server-side role evaluation at boundary entry points with sub-20ms latency guarantees.',
    content:
      'The platform enforces Role-Based Access Control (RBAC) at every server-side API boundary prior to executing downstream business logic. Role evaluations run synchronously in less than 20 milliseconds under peak system load (NFR-1). Standard platform roles include Admin, ClientStandard, and ClientViewer. Requests failing role authorization are rejected with standard HTTP 403 Forbidden responses without executing lower-level operations.',
    contentType: 'BestPractice',
    lastUpdated: '2026-03-22',
    readTime: '4 min read',
    requiredRole: 'ClientViewer',
    tags: ['RBAC', 'Latency', 'NFR-1', 'Security'],
    featured: true,
  },
  {
    id: 'kb-102',
    title: 'Multi-Tenant Isolation & Row-Level Data Filtering',
    category: 'architecture',
    categoryLabel: 'Multi-Tenant Architecture',
    summary: 'Detailed guide on how multi-tenant queries isolate client records strictly by tenant identifier across all database models.',
    content:
      'All relational data persistence models strictly bind client records to a unique tenant identifier (tenant_id). Backend database queries explicitly scope data retrieval using the tenant_id resolved from the authenticated user token. Any unauthorized cross-tenant data access attempt is denied at the server boundary with HTTP 403 Forbidden, preventing tenant data leakage and cross-client record exposure.',
    contentType: 'BestPractice',
    lastUpdated: '2026-03-20',
    readTime: '5 min read',
    requiredRole: 'ClientViewer',
    tags: ['Multi-Tenant', 'Tenant ID', 'FR-9', 'Isolation'],
    featured: true,
  },
  {
    id: 'kb-103',
    title: 'Non-Blocking Machine-Readable Audit Logging Pipeline',
    category: 'audit',
    categoryLabel: 'Audit Logging & Security',
    summary: 'Technical specification for structured JSON audit events emitted to standard output with unique correlation IDs.',
    content:
      'The audit logging system captures all authentication events, access decisions, role evaluation failures, and data mutations. Each audit log entry is formatted as a structured JSON object containing logged_at timestamp, user_id, assigned_role, tenant_id, action, client_ip, outcome_status, and a unique correlation_id. Log emission is non-blocking and fail-safe to guarantee zero impact on API latency.',
    contentType: 'FAQ',
    lastUpdated: '2026-03-21',
    readTime: '6 min read',
    requiredRole: 'ClientStandard',
    tags: ['Audit Logging', 'JSON', 'Correlation ID', 'FR-6', 'FR-10'],
    featured: false,
  },
  {
    id: 'kb-104',
    title: 'OpenAPI 3.1 Contract Generation & Client Synchronisation',
    category: 'api',
    categoryLabel: 'API Contracts & Integration',
    summary: 'End-to-end workflow for updating backend routes, generating TypeScript clients, and maintaining zero contract drift.',
    content:
      'The API contract between the frontend and backend is strictly defined using OpenAPI 3.1 under contracts/. Modifying a FastAPI endpoint requires regenerating contract definitions via pnpm gen:api, updating the client service in frontend/src/services/apiClient.ts. DELETE endpoints return HTTP 204 No Content with response_model=None and empty response bodies.',
    contentType: 'BestPractice',
    lastUpdated: '2026-03-19',
    readTime: '3 min read',
    requiredRole: 'ClientStandard',
    tags: ['OpenAPI', 'TypeScript', 'HTTP 204', 'API Contracts'],
    featured: false,
  },
  {
    id: 'kb-105',
    title: 'WCAG 2.1 Level AA Accessibility Standards & Keyboard Navigation',
    category: 'compliance',
    categoryLabel: 'Compliance & WCAG 2.1 AA',
    summary: 'Frontend accessibility standards for ARIA live regions, focus management, keyboard navigation, and visual contrast.',
    content:
      'The user interface conforms to Linen & Logic design guidelines and WCAG 2.1 AA accessibility standards. All interactive controls support full keyboard navigation and high-contrast focus indicators. Status labels provide screen reader prefixes (srPrefix) and dynamic ARIA live regions for realtime feedback without visual bias.',
    contentType: 'FAQ',
    lastUpdated: '2026-03-18',
    readTime: '5 min read',
    requiredRole: 'ClientViewer',
    tags: ['WCAG 2.1 AA', 'Accessibility', 'A11y', 'Linen & Logic'],
    featured: false,
  },
  {
    id: 'kb-106',
    title: 'Admin Role Management & Security Governance Protocols',
    category: 'rbac',
    categoryLabel: 'RBAC & Access Control',
    summary: 'Privileged operations, role assignment workflows, and security governance oversight for platform administrators.',
    content:
      'Administrative operations require the explicit Admin role assigned in user context. Administrators possess full visibility over multi-tenant telemetry, system health metrics, and security audit streams. Administrative actions trigger priority audit log entries with correlation tracking for compliance auditing.',
    contentType: 'BestPractice',
    lastUpdated: '2026-03-15',
    readTime: '7 min read',
    requiredRole: 'Admin',
    tags: ['Admin', 'Governance', 'RBAC', 'Privileged Operations'],
    featured: false,
  },
  {
    id: 'kb-107',
    title: 'Customer Onboarding & Account Provisioning Operational Playbook',
    category: 'playbook',
    categoryLabel: 'Operational Playbooks',
    summary: 'Step-by-step process guide for provisioning new client organization tenants, assigning roles, and configuring audit logging.',
    content:
      'This operational playbook walks through initial tenant creation, client administrator account registration, baseline RBAC permission scoping, and security policy activation.',
    contentType: 'Playbook',
    lastUpdated: '2026-03-22',
    readTime: '8 min guide',
    requiredRole: 'ClientStandard',
    tags: ['Onboarding', 'Playbook', 'FR-3', 'FR-4', 'Tenant Provisioning'],
    featured: false,
  },
  {
    id: 'kb-108',
    title: 'Multi-Tenant Security & API Integration Training Module',
    category: 'video',
    categoryLabel: 'Training Videos',
    summary: 'On-demand video stream covering multi-tenant architecture, boundary sanitization, and OpenAPI client generation.',
    content:
      'Watch this interactive training video to understand row-level tenant isolation, sub-20ms RBAC policy checks, and automated OpenAPI client generation workflows.',
    contentType: 'TrainingVideo',
    lastUpdated: '2026-03-21',
    readTime: '15 min video',
    requiredRole: 'ClientViewer',
    tags: ['Training', 'Video', 'FR-5', 'FR-6', 'Architecture'],
    videoUrl: 'https://cdn.example.com/videos/multi-tenant-security.mp4',
    featured: false,
  },
];

const KNOWLEDGE_FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'rbac',
    question: 'How are user roles evaluated during API requests?',
    answer:
      'Every request passes through server-side FastAPI dependencies that parse the Bearer token, extract role context, and compare assigned permissions against endpoint route policies in under 20ms.',
  },
  {
    id: 'faq-2',
    category: 'architecture',
    question: 'What happens if a user attempts to access another tenant’s data?',
    answer:
      'The backend checks the tenant_id in the request context against the entity owner ID. If mismatched, the server rejects the request with HTTP 403 Forbidden and logs an audit failure event.',
  },
  {
    id: 'faq-3',
    category: 'audit',
    question: 'Where are audit logs stored and processed?',
    answer:
      'Audit logs are formatted as structured JSON and printed directly to standard output (stdout), allowing external log aggregation tools to ingest events without blocking main request threads.',
  },
  {
    id: 'faq-4',
    category: 'compliance',
    question: 'How does the platform ensure WCAG 2.1 AA compliance?',
    answer:
      'All color combinations maintain a contrast ratio of at least 4.5:1. Screen readers receive live status announcements, skip links allow jumping to main content, and all controls are keyboard operable.',
  },
];

export default function KnowledgePage() {
  const router = useRouter();
  const { announce } = useAccessibility();

  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Articles & Filter state
  const [articles, setArticles] = useState<KnowledgeArticle[]>(INITIAL_KNOWLEDGE_ARTICLES);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedContentType, setSelectedContentType] = useState<string>('all');
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
  const [articleFeedback, setArticleFeedback] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchKnowledgeData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const token = apiClient.getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const [userData, navData, searchResults] = await Promise.all([
        apiClient.getMe(),
        apiClient.getNavigationMenu().catch(() => ({ items: [] })),
        knowledgeService.searchArticles({ limit: 50 }).catch(() => null),
      ]);

      setUser(userData);
      setNavItems(navData.items || []);

      if (searchResults && searchResults.items && searchResults.items.length > 0) {
        const fetchedArticles: KnowledgeArticle[] = searchResults.items.map((item) => ({
          id: item.id,
          title: item.title,
          category:
            item.category_id ||
            (item.content_type?.toLowerCase() === 'playbook'
              ? 'playbook'
              : item.content_type?.toLowerCase() === 'trainingvideo'
              ? 'video'
              : 'rbac'),
          categoryLabel: item.category_name || item.content_type || 'General',
          summary: item.body_snippet || '',
          content: item.body_snippet || '',
          contentType: item.content_type,
          lastUpdated: item.updated_at ? item.updated_at.split('T')[0] : '2026-03-22',
          readTime: '4 min read',
          requiredRole: 'ClientViewer',
          tags: item.tags ? item.tags.map((t) => t.name) : [],
          featured: false,
          videoUrl: item.video_url,
        }));

        setArticles((prev) => {
          const fetchedIds = new Set(fetchedArticles.map((a) => a.id));
          const uniqueInitial = prev.filter((a) => !fetchedIds.has(a.id));
          return [...fetchedArticles, ...uniqueInitial];
        });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to load knowledge base resources.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchKnowledgeData();
  }, [fetchKnowledgeData]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedArticle) {
        setSelectedArticle(null);
        announce('Article details modal closed', 'polite');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedArticle, announce]);

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
      const matchesContentType =
        selectedContentType === 'all' ||
        !selectedContentType ||
        article.contentType === selectedContentType ||
        (selectedContentType === 'Playbook' &&
          (article.category === 'playbook' || article.title.toLowerCase().includes('playbook'))) ||
        (selectedContentType === 'TrainingVideo' &&
          (article.category === 'video' || Boolean(article.videoUrl) || article.title.toLowerCase().includes('video')));

      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        article.title.toLowerCase().includes(query) ||
        article.summary.toLowerCase().includes(query) ||
        article.content.toLowerCase().includes(query) ||
        article.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        article.categoryLabel.toLowerCase().includes(query);

      return matchesCategory && matchesContentType && matchesQuery;
    });
  }, [articles, searchQuery, selectedCategory, selectedContentType]);

  // Featured articles
  const featuredArticles = useMemo(() => {
    return articles.filter((a) => a.featured);
  }, [articles]);

  const handleHelpfulClick = (articleId: string) => {
    setArticleFeedback((prev) => {
      const updated = { ...prev, [articleId]: !prev[articleId] };
      const isHelpful = updated[articleId];
      announce(
        isHelpful
          ? 'Thank you for your feedback! Marked as helpful.'
          : 'Feedback removed.',
        'polite'
      );
      return updated;
    });
  };

  const handleShareArticle = (article: KnowledgeArticle) => {
    setCopiedId(article.id);
    announce(`Article link copied to clipboard for: ${article.title}`, 'polite');
    setTimeout(() => {
      setCopiedId(null);
    }, 2500);
  };

  const handleViewArticle = async (article: KnowledgeArticle) => {
    setSelectedArticle(article);
    announce(`Opened details for article: ${article.title}`, 'polite');

    try {
      const detail = await knowledgeService.getArticleDetail(article.id);
      if (detail && detail.body) {
        setSelectedArticle((prev) =>
          prev && prev.id === article.id
            ? {
                ...prev,
                content: detail.body,
                categoryLabel: detail.category?.name || prev.categoryLabel,
                tags: detail.tags ? detail.tags.map((t) => t.name) : prev.tags,
                contentType: detail.content_type || prev.contentType,
              }
            : prev
        );
      }
    } catch (_err) {
      // Keep existing article data
    }
  };

  const isRoleAuthorized = (requiredRole: string): boolean => {
    if (!user || !user.roles) return true;
    if (user.roles.includes('Admin')) return true;
    if (requiredRole === 'ClientViewer') return true;
    if (requiredRole === 'ClientStandard') {
      return user.roles.includes('ClientStandard') || user.roles.includes('Admin');
    }
    return false;
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading knowledge base view"
        className="min-h-[500px] flex flex-col items-center justify-center p-8 text-center"
      >
        <RefreshCw className="w-10 h-10 text-[#59452b] animate-spin mb-4" aria-hidden="true" />
        <h2 className="text-xl font-serif text-[#59452b] mb-2">Loading Knowledge Base & Documentation</h2>
        <p className="text-sm text-[#4e453d] max-w-md">
          Retrieving security architecture guides, access control specifications, and multi-tenant documentation...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4" role="region" aria-label="Knowledge Base Error">
        <div
          role="alert"
          aria-live="assertive"
          className="bg-[#ffdad6] border border-[#ba1a1a]/30 rounded-lg p-6 text-[#93000a] flex flex-col sm:flex-row items-start gap-4 shadow-sm"
        >
          <AlertCircle className="w-6 h-6 shrink-0 mt-0.5 text-[#ba1a1a]" aria-hidden="true" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold mb-1">Failed to Load Knowledge Base</h2>
            <p className="text-sm text-[#93000a]/90 mb-4">{error}</p>
            <button
              onClick={fetchKnowledgeData}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#ba1a1a] text-white text-sm font-medium rounded hover:bg-[#93000a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ba1a1a] transition-colors"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Retry Loading
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header & User Identity Block */}
      <header className="bg-[#f0eee9] border border-[#d1c4b9]/50 rounded-lg p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2 bg-[#59452b]/10 text-[#59452b] rounded-md">
                <BookOpen className="w-6 h-6" aria-hidden="true" />
              </span>
              <span className="text-xs font-semibold tracking-wider uppercase text-[#80756b]">
                Platform Documentation & Guides
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif text-[#1b1c19] tracking-tight">
              Knowledge Base
            </h1>
            <p className="text-sm sm:text-base text-[#4e453d] mt-2 max-w-2xl leading-relaxed">
              Explore RBAC access control guides, multi-tenant isolation specifications, audit logging architecture, and OpenAPI contract integration standards.
            </p>
          </div>

          {/* User Context & Policy Status Card */}
          {user && (
            <div className="bg-[#fbf9f4] border border-[#d1c4b9]/60 rounded-md p-4 min-w-[280px] shadow-sm text-xs space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-[#d1c4b9]/40">
                <span className="text-[#80756b] font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
                  Authenticated User
                </span>
                <StatusLabel status="operational" label="Active Token" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[#4e453d]">
                  <span className="font-medium text-[#80756b]">Email:</span>
                  <span className="font-mono text-[#1b1c19] truncate max-w-[170px]" title={user.email}>
                    {user.email}
                  </span>
                </div>
                <div className="flex justify-between text-[#4e453d]">
                  <span className="font-medium text-[#80756b]">Tenant Scope:</span>
                  <span className="font-mono text-[#1b1c19] truncate max-w-[170px]" title={user.tenant_id}>
                    {user.tenant_id}
                  </span>
                </div>
                <div className="flex justify-between text-[#4e453d]">
                  <span className="font-medium text-[#80756b]">Assigned Roles:</span>
                  <span className="font-medium text-[#59452b]">{user.roles?.join(', ') || 'ClientViewer'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Overview Metrics Cards */}
      <section aria-label="Knowledge Base Quick Metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#f0eee9] border border-[#d1c4b9]/50 rounded-lg p-5 flex items-center gap-4">
          <div className="p-3 bg-[#59452b]/10 text-[#59452b] rounded-lg">
            <FileText className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-[#1b1c19]">{INITIAL_KNOWLEDGE_ARTICLES.length}</div>
            <div className="text-xs text-[#4e453d] font-medium">Published Guides & Docs</div>
          </div>
        </div>

        <div className="bg-[#f0eee9] border border-[#d1c4b9]/50 rounded-lg p-5 flex items-center gap-4">
          <div className="p-3 bg-[#59452b]/10 text-[#59452b] rounded-lg">
            <ShieldCheck className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-[#1b1c19]">Sub-20ms</div>
            <div className="text-xs text-[#4e453d] font-medium">RBAC Latency SLA</div>
          </div>
        </div>

        <div className="bg-[#f0eee9] border border-[#d1c4b9]/50 rounded-lg p-5 flex items-center gap-4">
          <div className="p-3 bg-[#59452b]/10 text-[#59452b] rounded-lg">
            <Building className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-[#1b1c19]">100% Isolated</div>
            <div className="text-xs text-[#4e453d] font-medium">Multi-Tenant Boundaries</div>
          </div>
        </div>

        <div className="bg-[#f0eee9] border border-[#d1c4b9]/50 rounded-lg p-5 flex items-center gap-4">
          <div className="p-3 bg-[#59452b]/10 text-[#59452b] rounded-lg">
            <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-[#1b1c19]">WCAG 2.1 AA</div>
            <div className="text-xs text-[#4e453d] font-medium">Accessibility Compliant</div>
          </div>
        </div>
      </section>

      {/* Featured Architecture Guides */}
      {featuredArticles.length > 0 && !searchQuery && selectedCategory === 'all' && (
        <section aria-label="Featured Platform Guides" className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
            <h2 className="text-xl font-serif text-[#1b1c19]">Featured Platform Guides</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {featuredArticles.map((article) => (
              <article
                key={article.id}
                className="bg-[#f5f3ee] border border-[#d1c4b9]/60 rounded-lg p-6 flex flex-col justify-between hover:border-[#59452b]/50 transition-all shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 bg-[#59452b]/10 text-[#59452b] text-xs font-medium rounded-full">
                      {article.categoryLabel}
                    </span>
                    <span className="text-xs text-[#80756b] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      {article.readTime}
                    </span>
                  </div>

                  <h3 className="text-lg font-serif text-[#1b1c19] mb-2 leading-snug">
                    {article.title}
                  </h3>

                  <p className="text-sm text-[#4e453d] mb-4 leading-relaxed line-clamp-3">
                    {article.summary}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#d1c4b9]/40 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {article.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[11px] px-2 py-0.5 bg-[#e3ded1] text-[#4e453d] rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedArticle(article);
                      announce(`Opened details for article: ${article.title}`, 'polite');
                    }}
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#59452b] hover:text-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#735c41] rounded px-2 py-1"
                  >
                    Read Guide
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Search and Category Filter Toolbar */}
      <section aria-label="Knowledge Base Controls" className="bg-[#f0eee9] border border-[#d1c4b9]/50 rounded-lg p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Field */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#80756b]">
              <Search className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search knowledge base by title, topic, or tag..."
              aria-label="Search articles by title, tag, or content"
              className="w-full pl-10 pr-10 py-2.5 bg-[#fbf9f4] border border-[#d1c4b9] rounded-md text-sm text-[#1b1c19] placeholder-[#80756b] focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:border-[#735c41] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                type="button"
                aria-label="Clear search query"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#80756b] hover:text-[#1b1c19]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Category Dropdown Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#80756b] shrink-0" aria-hidden="true" />
            <label htmlFor="category-select" className="sr-only">
              Filter articles by category
            </label>
            <select
              id="category-select"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                const categoryObj = KNOWLEDGE_CATEGORIES.find((c) => c.id === e.target.value);
                announce(`Filtered by category: ${categoryObj?.label || e.target.value}`, 'polite');
              }}
              className="bg-[#fbf9f4] border border-[#d1c4b9] text-[#1b1c19] text-sm rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors"
            >
              {KNOWLEDGE_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Type Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#d1c4b9]/40">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#80756b] mr-1">
            Content Type:
          </span>
          {CONTENT_TYPE_TABS.map((tab) => {
            const isActive = selectedContentType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedContentType(tab.id);
                  announce(`Filtered by content type: ${tab.label}`, 'polite');
                }}
                type="button"
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-[#735c41] ${
                  isActive
                    ? 'bg-[#735c41] text-white shadow-sm font-semibold'
                    : 'bg-[#fbf9f4] text-[#4e453d] border border-[#d1c4b9] hover:bg-[#e3ded1]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Category Pill Tabs */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-[#d1c4b9]/40">
          {KNOWLEDGE_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  announce(`Selected category: ${cat.label}`, 'polite');
                }}
                type="button"
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#735c41] ${
                  isActive
                    ? 'bg-[#59452b] text-white shadow-sm'
                    : 'bg-[#fbf9f4] text-[#4e453d] border border-[#d1c4b9] hover:bg-[#e3ded1]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Knowledge Base Articles Grid */}
      <section aria-label="Knowledge Base Articles" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-serif text-[#1b1c19]">
            {selectedCategory === 'all'
              ? 'All Documentation & Articles'
              : KNOWLEDGE_CATEGORIES.find((c) => c.id === selectedCategory)?.label}
          </h2>
          <span className="text-xs text-[#80756b] font-medium">
            Showing {filteredArticles.length} of {INITIAL_KNOWLEDGE_ARTICLES.length} items
          </span>
        </div>

        {filteredArticles.length === 0 ? (
          <div className="bg-[#f0eee9] border border-[#d1c4b9]/50 rounded-lg p-12 text-center space-y-3">
            <HelpCircle className="w-10 h-10 text-[#80756b] mx-auto" aria-hidden="true" />
            <h3 className="text-lg font-serif text-[#1b1c19]">No Articles Match Your Search</h3>
            <p className="text-sm text-[#4e453d] max-w-md mx-auto">
              We couldn’t find any documentation matching &quot;{searchQuery}&quot; in the selected category. Try adjusting your search query or selecting a different category filter.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                announce('Cleared search query and category filters', 'polite');
              }}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#59452b] text-white text-xs font-medium rounded hover:bg-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article) => {
              const authorized = isRoleAuthorized(article.requiredRole);
              const isHelpful = !!articleFeedback[article.id];

              return (
                <article
                  key={article.id}
                  className="bg-[#fbf9f4] border border-[#d1c4b9]/60 rounded-lg p-6 flex flex-col justify-between hover:shadow-md transition-all relative group"
                >
                  <div>
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-2.5 py-0.5 bg-[#e3ded1] text-[#59452b] text-[11px] font-semibold rounded-full">
                        {article.categoryLabel}
                      </span>

                      <div className="flex items-center gap-2">
                        {article.requiredRole === 'Admin' ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#ba1a1a] bg-[#ffdad6] px-2 py-0.5 rounded"
                            title="Requires Admin role"
                          >
                            <Lock className="w-3 h-3" aria-hidden="true" />
                            Admin
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#80756b] font-medium">
                            {article.readTime}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Article Title */}
                    <h3 className="text-base font-serif text-[#1b1c19] mb-2 font-semibold leading-snug group-hover:text-[#59452b] transition-colors">
                      {article.title}
                    </h3>

                    {/* Summary */}
                    <p className="text-xs text-[#4e453d] mb-4 leading-relaxed line-clamp-3">
                      {article.summary}
                    </p>
                  </div>

                  <div>
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {article.tags.map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 bg-[#f0eee9] text-[#80756b] rounded border border-[#d1c4b9]/40">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {/* Actions Row */}
                    <div className="pt-3 border-t border-[#d1c4b9]/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <button
                        onClick={() => handleHelpfulClick(article.id)}
                        type="button"
                        aria-label={`Mark article "${article.title}" as helpful`}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41] ${
                          isHelpful
                            ? 'bg-[#59452b] text-white'
                            : 'text-[#80756b] hover:bg-[#e3ded1] hover:text-[#1b1c19]'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
                        {isHelpful ? 'Helpful' : 'Helpful?'}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleViewArticle(article)}
                          type="button"
                          aria-label={`View full details for ${article.title}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#59452b] text-white text-xs font-medium rounded hover:bg-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          View Article
                        </button>

                        {(article.contentType === 'Playbook' || article.category === 'playbook' || article.id.includes('playbook') || article.title.toLowerCase().includes('playbook')) && (
                          <Link
                            href={`/knowledge/playbooks/${article.id}`}
                            aria-label={`Open step-by-step playbook guide for ${article.title}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#735c41] text-white text-xs font-medium rounded hover:bg-[#59452b] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors"
                          >
                            <PlayCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            Playbook
                          </Link>
                        )}

                        {(article.contentType === 'TrainingVideo' || article.category === 'video' || Boolean(article.videoUrl) || article.title.toLowerCase().includes('video')) && (
                          <Link
                            href={`/knowledge/training/${article.id}`}
                            aria-label={`Watch training video module for ${article.title}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#374a5f] text-white text-xs font-medium rounded hover:bg-[#4f6278] focus:outline-none focus:ring-2 focus:ring-[#4f6278] transition-colors"
                          >
                            <Video className="w-3.5 h-3.5" aria-hidden="true" />
                            Watch Video
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Frequently Asked Questions Section */}
      <section aria-label="Frequently Asked Questions" className="bg-[#f0eee9] border border-[#d1c4b9]/50 rounded-lg p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <span className="p-2 bg-[#59452b]/10 text-[#59452b] rounded-md">
            <HelpCircle className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-serif text-[#1b1c19]">Architecture & Governance FAQ</h2>
            <p className="text-xs text-[#4e453d]">Common questions regarding platform RBAC evaluation, multi-tenancy, and compliance.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {KNOWLEDGE_FAQS.map((faq) => (
            <div key={faq.id} className="bg-[#fbf9f4] border border-[#d1c4b9]/50 rounded-md p-5 space-y-2 shadow-sm">
              <h3 className="text-sm font-semibold text-[#1b1c19] flex items-start gap-2">
                <span className="text-[#59452b] font-mono text-xs">Q:</span>
                {faq.question}
              </h3>
              <p className="text-xs text-[#4e453d] leading-relaxed pl-5 border-l-2 border-[#59452b]/30">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Article Detail View Modal */}
      {selectedArticle && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-article-title"
          aria-describedby="modal-article-summary"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <div className="bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-xl space-y-6 animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#d1c4b9]/50 pb-4">
              <div>
                <span className="px-2.5 py-0.5 bg-[#e3ded1] text-[#59452b] text-xs font-semibold rounded-full inline-block mb-2">
                  {selectedArticle.categoryLabel}
                </span>
                <h2 id="modal-article-title" className="text-2xl font-serif text-[#1b1c19] leading-snug">
                  {selectedArticle.title}
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedArticle(null);
                  announce('Article detail modal closed', 'polite');
                }}
                type="button"
                aria-label="Close article modal"
                className="p-1.5 text-[#80756b] hover:text-[#1b1c19] hover:bg-[#e3ded1] rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              <div id="modal-article-summary" className="p-4 bg-[#f5f3ee] border-l-4 border-[#59452b] rounded-r text-sm text-[#4e453d] leading-relaxed font-medium">
                {selectedArticle.summary}
              </div>

              <div className="text-sm text-[#1b1c19] leading-relaxed whitespace-pre-line font-sans space-y-3">
                <p>{selectedArticle.content}</p>
              </div>

              {/* Specification Meta Box */}
              <div className="bg-[#f0eee9] border border-[#d1c4b9]/60 rounded-md p-4 text-xs space-y-2">
                <div className="font-semibold text-[#59452b] uppercase tracking-wider text-[11px]">
                  Technical Specification Context
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[#4e453d]">
                  <div>
                    <span className="block text-[#80756b] font-medium">Required Role:</span>
                    <span className="font-mono text-[#1b1c19]">{selectedArticle.requiredRole}</span>
                  </div>
                  <div>
                    <span className="block text-[#80756b] font-medium">Last Updated:</span>
                    <span className="font-mono text-[#1b1c19]">{selectedArticle.lastUpdated}</span>
                  </div>
                  <div>
                    <span className="block text-[#80756b] font-medium">Read Duration:</span>
                    <span className="font-mono text-[#1b1c19]">{selectedArticle.readTime}</span>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 pt-2">
                {selectedArticle.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2.5 py-1 bg-[#e3ded1] text-[#4e453d] rounded font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#d1c4b9]/50">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleShareArticle(selectedArticle)}
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#59452b] hover:text-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#735c41] rounded px-2 py-1"
                >
                  <Share2 className="w-4 h-4" aria-hidden="true" />
                  {copiedId === selectedArticle.id ? 'Copied Link!' : 'Copy Reference'}
                </button>

                {(selectedArticle.contentType === 'Playbook' || selectedArticle.category === 'playbook' || selectedArticle.title.toLowerCase().includes('playbook')) && (
                  <Link
                    href={`/knowledge/playbooks/${selectedArticle.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#735c41] text-white text-xs font-medium rounded hover:bg-[#59452b] transition-colors"
                  >
                    <PlayCircle className="w-4 h-4" aria-hidden="true" />
                    Open Playbook Guide
                  </Link>
                )}

                {(selectedArticle.contentType === 'TrainingVideo' || selectedArticle.category === 'video' || Boolean(selectedArticle.videoUrl) || selectedArticle.title.toLowerCase().includes('video')) && (
                  <Link
                    href={`/knowledge/training/${selectedArticle.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#374a5f] text-white text-xs font-medium rounded hover:bg-[#4f6278] transition-colors"
                  >
                    <Video className="w-4 h-4" aria-hidden="true" />
                    Stream Video Module
                  </Link>
                )}
              </div>

              <button
                onClick={() => {
                  setSelectedArticle(null);
                  announce('Article detail modal closed', 'polite');
                }}
                type="button"
                className="px-4 py-2 bg-[#59452b] text-white text-xs font-medium rounded hover:bg-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors"
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
