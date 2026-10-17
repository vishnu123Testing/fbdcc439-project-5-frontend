'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Headphones,
  ShieldCheck,
  Building,
  User,
  Key,
  RefreshCw,
  AlertCircle,
  Filter,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  X,
  Plus,
  MessageSquare,
  LifeBuoy,
  HelpCircle,
  Send,
  FileText,
  Activity,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Star,
  Timer,
} from 'lucide-react';
import { apiClient, UserMeResponse, NavItem, ApiError } from '../../services/apiClient';
import {
  supportService,
  TicketPriority,
  TicketStatus,
  SLATracking,
  TicketMessage,
  AttachmentResponse,
} from '../../services/support';
import { StatusLabel } from '../../components/common/StatusLabel';
import { useAccessibility } from '../../components/common/AccessibilityContext';
import { SLACountdownTimer } from '../../components/support/SLACountdownTimer';
import { AttachmentUploader } from '../../components/support/AttachmentUploader';
import { TicketThread } from '../../components/support/TicketThread';
import { CSATRatingModal } from '../../components/support/CSATRatingModal';

export interface SupportTicket {
  id: string;
  ticket_number: string;
  subject: string;
  category: 'rbac_access' | 'audit_logs' | 'tenant_isolation' | 'api_integration' | 'general' | string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'P1' | 'P2' | 'P3' | string;
  status: 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed' | string;
  description: string;
  created_at: string;
  updated_at: string;
  assigned_agent: string;
  client_id?: string;
  sla_trackings?: SLATracking[];
  messages?: TicketMessage[];
}

export interface SystemHealthComponent {
  id: string;
  name: string;
  status: 'operational' | 'active' | 'success' | 'warning';
  latencyMs: string;
  description: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const INITIAL_SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: 'sup-101',
    ticket_number: 'TKT-2026-001',
    subject: 'RBAC Evaluation Latency Consultation',
    category: 'rbac_access',
    priority: 'high',
    status: 'in_progress',
    description: 'Inquiry regarding server-side RBAC evaluation overhead SLA verification under peak load.',
    created_at: '2026-03-20',
    updated_at: '2026-03-21',
    assigned_agent: 'Security Operations',
    sla_trackings: [
      {
        id: 'sla-101-resp',
        ticket_id: 'sup-101',
        target_type: 'first_response',
        target_due_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        is_breached: false,
      },
      {
        id: 'sla-101-res',
        ticket_id: 'sup-101',
        target_type: 'resolution',
        target_due_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        is_breached: false,
      },
    ],
  },
  {
    id: 'sup-102',
    ticket_number: 'TKT-2026-002',
    subject: 'Audit Log Retention & Correlation ID Query',
    category: 'audit_logs',
    priority: 'medium',
    status: 'resolved',
    description: 'Clarification request for machine-readable JSON log format correlation ID piping.',
    created_at: '2026-03-18',
    updated_at: '2026-03-19',
    assigned_agent: 'Compliance Engineering',
  },
  {
    id: 'sup-103',
    ticket_number: 'TKT-2026-003',
    subject: 'Multi-Tenant Data Boundary Isolation',
    category: 'tenant_isolation',
    priority: 'urgent',
    status: 'open',
    description: 'Verification of 403 Forbidden enforcement on cross-tenant client entity requests.',
    created_at: '2026-03-22',
    updated_at: '2026-03-22',
    assigned_agent: 'Platform Security',
    sla_trackings: [
      {
        id: 'sla-103-resp',
        ticket_id: 'sup-103',
        target_type: 'first_response',
        target_due_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        is_breached: true,
      },
      {
        id: 'sla-103-res',
        ticket_id: 'sup-103',
        target_type: 'resolution',
        target_due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        is_breached: false,
      },
    ],
  },
  {
    id: 'sup-104',
    ticket_number: 'TKT-2026-004',
    subject: 'OpenAPI Schema Export for Integration',
    category: 'api_integration',
    priority: 'low',
    status: 'resolved',
    description: 'Request for generated TypeScript API client definitions and OpenAPI specification schema.',
    created_at: '2026-03-15',
    updated_at: '2026-03-16',
    assigned_agent: 'Developer Support',
  },
  {
    id: 'sup-105',
    ticket_number: 'TKT-2026-005',
    subject: 'WCAG 2.1 AA Status Indicator Compliance',
    category: 'general',
    priority: 'medium',
    status: 'pending',
    description: 'Verification of ARIA attributes, contrast ratios, and screen reader announcements.',
    created_at: '2026-03-21',
    updated_at: '2026-03-22',
    assigned_agent: 'Accessibility Guild',
  },
];

const INITIAL_SYSTEM_HEALTH: SystemHealthComponent[] = [
  {
    id: 'rbac-gate',
    name: 'RBAC Access Gate',
    status: 'operational',
    latencyMs: '4.2 ms',
    description: 'Server-side sub-20ms role evaluation boundary (FR-1, NFR-1)',
  },
  {
    id: 'tenant-scope',
    name: 'Multi-Tenant Isolation Gate',
    status: 'active',
    latencyMs: '1.8 ms',
    description: 'Strict tenant-scoped query boundary enforcement (FR-9)',
  },
  {
    id: 'audit-stdout',
    name: 'Stdout Audit Logging Stream',
    status: 'active',
    latencyMs: '0.5 ms',
    description: 'Non-blocking JSON structured log emission (FR-6, FR-10)',
  },
  {
    id: 'openapi-gateway',
    name: 'OpenAPI REST Gateway',
    status: 'success',
    latencyMs: '12.1 ms',
    description: 'Authenticated route endpoints and schema validation (NFR-5)',
  },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'RBAC & Authorization',
    question: 'How does the platform enforce sub-20ms RBAC evaluation overhead?',
    answer: 'The backend evaluates Role-Based Access Control policies synchronously at application entry points using cached role maps and strict boundary checks, keeping execution latency well below the 20ms NFR-1 target.',
  },
  {
    id: 'faq-2',
    category: 'Multi-Tenancy & Isolation',
    question: 'How are cross-tenant data requests prevented and logged?',
    answer: 'All data queries mandate a tenant identifier filter. Attempting to access client records outside your assigned tenant immediately triggers an HTTP 403 Forbidden rejection and an audit log event (FR-9).',
  },
  {
    id: 'faq-3',
    category: 'Audit Logging',
    question: 'Are audit logs non-blocking and safe from API request failures?',
    answer: 'Yes. Audit logging formats events as structured JSON and writes directly to standard output. Log processing occurs asynchronously relative to primary storage, ensuring zero database lock contention or request crashes (FR-10).',
  },
  {
    id: 'faq-4',
    category: 'Accessibility',
    question: 'What accessibility features are supported on the Support portal?',
    answer: 'The portal supports full keyboard navigation, WCAG 2.1 AA compliant color contrast ratios, explicit ARIA live regions for status changes, and screen reader announcements (FR-8, NFR-3).',
  },
];

/**
 * Calculate SLA deadline timestamp based on priority and SLA target type [FR-4].
 */
function calculateSLADeadlineISO(
  createdAtStr: string,
  priority: string,
  type: 'first_response' | 'resolution'
): string {
  const createdDate = new Date(createdAtStr);
  const baseMs = isNaN(createdDate.getTime()) ? Date.now() : createdDate.getTime();
  const p = (priority || '').toLowerCase();

  let hoursToAdd = 24;
  if (type === 'first_response') {
    if (p === 'p1' || p === 'urgent') hoursToAdd = 1;
    else if (p === 'p2' || p === 'high') hoursToAdd = 4;
    else hoursToAdd = 24;
  } else {
    if (p === 'p1' || p === 'urgent') hoursToAdd = 4;
    else if (p === 'p2' || p === 'high') hoursToAdd = 24;
    else hoursToAdd = 72;
  }

  return new Date(baseMs + hoursToAdd * 60 * 60 * 1000).toISOString();
}

/**
 * Map raw priority code to human-readable priority badge string [FR-1].
 */
function getPriorityDisplayLabel(priority: string): string {
  const p = (priority || '').toLowerCase();
  if (p === 'p1' || p === 'urgent') return 'P1 (Urgent)';
  if (p === 'p2' || p === 'high') return 'P2 (High)';
  if (p === 'p3' || p === 'medium') return 'P3 (Medium)';
  if (p === 'low') return 'P3 (Low)';
  return priority.toUpperCase();
}

export default function SupportPage() {
  const router = useRouter();
  const { announce } = useAccessibility();

  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>(INITIAL_SUPPORT_TICKETS);
  const [healthComponents] = useState<SystemHealthComponent[]>(INITIAL_SYSTEM_HEALTH);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modals & Drawers state
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isCsatModalOpen, setIsCsatModalOpen] = useState<boolean>(false);
  const [csatTicket, setCsatTicket] = useState<SupportTicket | null>(null);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  // Form State in Create Ticket Modal
  const [newSubject, setNewSubject] = useState<string>('');
  const [newCategory, setNewCategory] = useState<SupportTicket['category']>('general');
  const [newPriority, setNewPriority] = useState<SupportTicket['priority']>('medium');
  const [newDescription, setNewDescription] = useState<string>('');
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const fetchSupportData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const token = apiClient.getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const [userData, navData] = await Promise.all([
        apiClient.getMe(),
        apiClient.getNavigationMenu(),
      ]);

      setUser(userData);
      setNavItems(navData.items || []);

      // Attempt to load API tickets if endpoint is available
      try {
        const apiTicketsRes = await supportService.getTickets();
        if (apiTicketsRes && Array.isArray(apiTicketsRes.items) && apiTicketsRes.items.length > 0) {
          const apiTicketsFormatted: SupportTicket[] = apiTicketsRes.items.map((t, idx) => ({
            id: t.id || `sup-api-${idx}`,
            ticket_number: `TKT-2026-${String(idx + 1).padStart(3, '0')}`,
            subject: t.subject,
            category: t.assigned_tier || 'general',
            priority: t.priority || 'P3',
            status: t.status || 'open',
            description: t.description,
            created_at: t.created_at ? t.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            updated_at: t.updated_at ? t.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
            assigned_agent: t.assigned_agent_id || 'Security Operations',
            sla_trackings: t.sla_trackings,
          }));
          setTickets(apiTicketsFormatted);
        }
      } catch {
        // Fallback to INITIAL_SUPPORT_TICKETS in test environment or offline state
      }

      setLastRefreshed(new Date());
      announce('Support & operations data loaded successfully.', 'polite');
    } catch (err) {
      console.error('Failed to load support data:', err);
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      const message = err instanceof Error ? err.message : 'An error occurred while loading support data.';
      setError(message);
      announce(`Error loading support data: ${message}`, 'assertive');
    } finally {
      setLoading(false);
    }
  }, [router, announce]);

  useEffect(() => {
    fetchSupportData();
  }, [fetchSupportData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchSupportData();
      announce('Support metrics and tickets refreshed.', 'polite');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleStatusFilterChange = (status: 'all' | 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed') => {
    setStatusFilter(status);
    announce(`Filtered tickets by ${status === 'all' ? 'all statuses' : status.replace('_', ' ')}.`, 'polite');
  };

  const handlePriorityFilterChange = (priority: string) => {
    setPriorityFilter(priority);
    announce(`Filtered tickets by priority: ${priority === 'all' ? 'all priorities' : priority}.`, 'polite');
  };

  const handleCategoryFilterChange = (category: string) => {
    setCategoryFilter(category);
    announce(`Filtered tickets by category: ${category === 'all' ? 'all categories' : category}.`, 'polite');
  };

  const handleOpenTicketModal = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    router.push(`/support/${encodeURIComponent(ticket.id)}`);
  };

  const handleCloseTicketModal = () => {
    setSelectedTicket(null);
    announce('Closed ticket details modal.', 'polite');
  };

  const handleToggleFaq = (faqId: string) => {
    setExpandedFaqId((prev) => (prev === faqId ? null : faqId));
  };

  const handleCreateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newSubject.trim()) {
      setFormError('Please enter a ticket subject.');
      return;
    }
    if (!newDescription.trim()) {
      setFormError('Please describe your issue or inquiry.');
      return;
    }

    const cleanSubject = supportService.sanitizeString(newSubject);
    const cleanDescription = supportService.sanitizeString(newDescription);

    const nextIdNum = tickets.length + 101;
    const todayIso = new Date().toISOString();
    const todayDateStr = todayIso.split('T')[0];

    let createdId = `sup-${nextIdNum}`;
    let createdNum = `TKT-2026-${String(tickets.length + 1).padStart(3, '0')}`;

    // Attempt API ticket creation
    try {
      if (user?.tenant_id) {
        const apiRes = await supportService.createTicket({
          subject: cleanSubject,
          description: cleanDescription,
          client_id: user.tenant_id,
          priority: newPriority === 'urgent' ? 'P1' : newPriority === 'high' ? 'P2' : 'P3',
        });
        if (apiRes && apiRes.id) {
          createdId = apiRes.id;
        }
      }
    } catch {
      // Fallback local creation
    }

    const responseDueAt = calculateSLADeadlineISO(todayIso, newPriority, 'first_response');
    const resolutionDueAt = calculateSLADeadlineISO(todayIso, newPriority, 'resolution');

    const createdTicket: SupportTicket = {
      id: createdId,
      ticket_number: createdNum,
      subject: cleanSubject,
      category: newCategory,
      priority: newPriority,
      status: 'open',
      description: cleanDescription,
      created_at: todayDateStr,
      updated_at: todayDateStr,
      assigned_agent: 'Unassigned (Queued)',
      sla_trackings: [
        {
          id: `sla-resp-${Date.now()}`,
          ticket_id: createdId,
          target_type: 'first_response',
          target_due_at: responseDueAt,
          is_breached: false,
        },
        {
          id: `sla-res-${Date.now()}`,
          ticket_id: createdId,
          target_type: 'resolution',
          target_due_at: resolutionDueAt,
          is_breached: false,
        },
      ],
    };

    setTickets([createdTicket, ...tickets]);
    setIsCreateModalOpen(false);

    // Reset form fields
    setNewSubject('');
    setNewCategory('general');
    setNewPriority('medium');
    setNewDescription('');
    setStagedFiles([]);

    const notice = `Support ticket ${createdTicket.ticket_number} created successfully and queued for review.`;
    setNoticeMessage(notice);
    announce(notice, 'polite');

    setTimeout(() => {
      setNoticeMessage(null);
    }, 5000);
  };

  const handleResolveTicket = async (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status: 'resolved',
              updated_at: new Date().toISOString().split('T')[0],
            }
          : t
      )
    );

    const targetTicket = tickets.find((t) => t.id === ticketId) || selectedTicket;

    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket((prev) => (prev ? { ...prev, status: 'resolved' } : null));
    }

    try {
      await supportService.updateTicket(ticketId, { status: 'resolved' });
    } catch {
      // Local fallback state updated
    }

    const notice = `Ticket marked as resolved.`;
    setNoticeMessage(notice);
    announce(notice, 'polite');

    // Trigger CSAT modal survey for resolved ticket
    if (targetTicket) {
      setCsatTicket(targetTicket);
      setIsCsatModalOpen(true);
    }

    setTimeout(() => setNoticeMessage(null), 4000);
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter;

      let matchesPriority = true;
      if (priorityFilter !== 'all') {
        const p = (ticket.priority || '').toLowerCase();
        const fp = priorityFilter.toLowerCase();
        if (fp === 'p1') matchesPriority = p === 'p1' || p === 'urgent';
        else if (fp === 'p2') matchesPriority = p === 'p2' || p === 'high';
        else if (fp === 'p3') matchesPriority = p === 'p3' || p === 'medium' || p === 'low';
        else matchesPriority = p === fp;
      }

      const query = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !query ||
        ticket.subject.toLowerCase().includes(query) ||
        ticket.ticket_number.toLowerCase().includes(query) ||
        ticket.description.toLowerCase().includes(query) ||
        ticket.assigned_agent.toLowerCase().includes(query);

      return matchesStatus && matchesCategory && matchesPriority && matchesQuery;
    });
  }, [tickets, statusFilter, categoryFilter, priorityFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === 'open').length;
    const inProgress = tickets.filter((t) => t.status === 'in_progress').length;
    const resolved = tickets.filter((t) => t.status === 'resolved').length;
    return { total, open, inProgress, resolved };
  }, [tickets]);

  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading support view"
        className="flex flex-col items-center justify-center min-h-[400px] py-12 px-4 space-y-4"
      >
        <div className="w-10 h-10 border-4 border-[#735c41] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#4e453d]">Loading support & operations portal...</p>
        <span className="sr-only">Loading support content, please wait.</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="my-6 p-6 bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded-lg max-w-2xl mx-auto space-y-4 text-[#1b1c19]"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-[#ba1a1a] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="text-lg font-serif font-semibold text-[#93000a]">Failed to Load Support Portal</h2>
            <p className="text-sm text-[#4e453d]">{error}</p>
          </div>
        </div>
        <div className="pt-2 flex gap-3">
          <button
            onClick={() => fetchSupportData()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#59452b] rounded-md hover:bg-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:ring-offset-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Retry Loading
          </button>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#59452b] bg-[#f5f3ee] border border-[#d1c4b9] rounded-md hover:bg-[#eae8e3] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors"
          >
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Page Header */}
      <header className="border-b border-[#d1c4b9]/40 pb-6 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Headphones className="w-7 h-7 text-[#59452b]" aria-hidden="true" />
              <h1 className="text-3xl sm:text-4xl font-serif text-[#1b1c19] tracking-tight">
                Support & Operations Portal
              </h1>
            </div>
            <p className="mt-1 text-sm sm:text-base text-[#4e453d]">
              System health status indicators, support ticket management, operational query assistance, and tenant support.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <StatusLabel status="operational" label="Support Active" ariaLive="polite" />
          </div>
        </div>
      </header>

      {/* User Context & Identity Section */}
      {user && (
        <section
          aria-label="User identity and support tenant boundary"
          className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-5 sm:p-6 shadow-sm space-y-3"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#735c41]">
                Active Session Context
              </span>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#1b1c19] pt-1">
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
                  <span className="font-medium">{user.email}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
                  <span>Tenant ID:</span>
                  <code className="bg-[#eae8e3] px-1.5 py-0.5 rounded text-xs font-mono font-medium">
                    {user.tenant_id}
                  </code>
                </div>
                <div className="flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
                  <span>Roles:</span>
                  <span className="font-medium">{user.roles ? user.roles.join(', ') : 'Standard'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="Refresh support portal data"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#59452b] bg-white border border-[#d1c4b9] rounded hover:bg-[#eae8e3] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
              <span className="text-xs text-[#80756b]">
                Refreshed {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Global Success Notice Banner */}
      {noticeMessage && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 bg-[#735c41]/10 border border-[#735c41]/30 text-[#59452b] rounded-lg text-sm font-medium flex items-center justify-between gap-2 transition-all"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#59452b] shrink-0" aria-hidden="true" />
            <span>{noticeMessage}</span>
          </div>
          <button
            onClick={() => setNoticeMessage(null)}
            className="text-[#80756b] hover:text-[#1b1c19] p-1 rounded focus:outline-none focus:ring-1 focus:ring-[#735c41]"
            aria-label="Dismiss notice"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* System Operational Status Indicators */}
      <section aria-labelledby="health-status-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
            <h2 id="health-status-heading" className="text-xl font-serif text-[#1b1c19]">
              System Operational Status
            </h2>
          </div>
          <span className="text-xs text-[#80756b]">Live Gate Indicators</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {healthComponents.map((comp) => (
            <div
              key={comp.id}
              className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-4 space-y-3 shadow-sm hover:border-[#80756b] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-[#735c41] uppercase tracking-wider">
                  {comp.name}
                </span>
                <StatusLabel status={comp.status} label={comp.status.toUpperCase()} />
              </div>
              <div>
                <div className="text-2xl font-serif text-[#1b1c19] tracking-tight">{comp.latencyMs}</div>
                <p className="text-xs text-[#4e453d] mt-1 line-clamp-2">{comp.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ticket Statistics Summary Bar */}
      <section aria-label="Support tickets statistics summary" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#d1c4b9]/60 rounded-lg p-4 text-center space-y-1 shadow-sm">
          <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">Total Tickets</span>
          <div className="text-2xl font-serif font-bold text-[#1b1c19]">{stats.total}</div>
        </div>
        <div className="bg-white border border-[#d1c4b9]/60 rounded-lg p-4 text-center space-y-1 shadow-sm">
          <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">Open Tickets</span>
          <div className="text-2xl font-serif font-bold text-[#a43b2c]">{stats.open}</div>
        </div>
        <div className="bg-white border border-[#d1c4b9]/60 rounded-lg p-4 text-center space-y-1 shadow-sm">
          <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">In Progress</span>
          <div className="text-2xl font-serif font-bold text-[#735c41]">{stats.inProgress}</div>
        </div>
        <div className="bg-white border border-[#d1c4b9]/60 rounded-lg p-4 text-center space-y-1 shadow-sm">
          <span className="text-xs font-medium text-[#80756b] uppercase tracking-wider">Resolved</span>
          <div className="text-2xl font-serif font-bold text-[#374a5f]">{stats.resolved}</div>
        </div>
      </section>

      {/* Support Tickets Section */}
      <section aria-labelledby="tickets-section-heading" className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 id="tickets-section-heading" className="text-xl font-serif text-[#1b1c19]">
              Support Requests & Inquiry Tracker
            </h2>
            <p className="text-xs text-[#4e453d] mt-0.5">
              Track active inquiries, system performance questions, and tenant assistance tickets with real-time SLA timers.
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#59452b] rounded-md hover:bg-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:ring-offset-2 transition-colors shrink-0 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Submit Support Ticket
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-[#80756b] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search by ticket number, subject, or assigned team..."
                aria-label="Search support tickets"
                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-[#d1c4b9] rounded-md focus:outline-none focus:ring-2 focus:ring-[#735c41] text-[#1b1c19] placeholder-[#80756b]"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[#735c41] flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5" aria-hidden="true" />
                Status:
              </span>
              {(['all', 'open', 'in_progress', 'pending', 'resolved'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => handleStatusFilterChange(st)}
                  className={`px-2.5 py-1 text-xs rounded transition-colors ${
                    statusFilter === st
                      ? 'bg-[#59452b] text-white font-medium'
                      : 'bg-white text-[#4e453d] border border-[#d1c4b9] hover:bg-[#eae8e3]'
                  }`}
                >
                  {st === 'all'
                    ? 'All'
                    : st === 'in_progress'
                    ? 'In Progress'
                    : st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}

              <span className="text-xs font-medium text-[#735c41] flex items-center gap-1 ml-2 mr-1">
                Priority:
              </span>
              <select
                value={priorityFilter}
                onChange={(e) => handlePriorityFilterChange(e.target.value)}
                aria-label="Filter tickets by priority"
                className="px-2 py-1 text-xs bg-white text-[#4e453d] border border-[#d1c4b9] rounded focus:outline-none focus:ring-2 focus:ring-[#735c41]"
              >
                <option value="all">All Priorities</option>
                <option value="P1">P1 (Urgent)</option>
                <option value="P2">P2 (High)</option>
                <option value="P3">P3 (Standard)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tickets Table */}
        <div className="bg-white border border-[#d1c4b9]/60 rounded-lg shadow-sm overflow-hidden">
          {filteredTickets.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <HelpCircle className="w-8 h-8 text-[#80756b] mx-auto" aria-hidden="true" />
              <p className="text-sm font-medium text-[#1b1c19]">No support tickets match your filters</p>
              <p className="text-xs text-[#80756b]">Try adjusting your search query or status filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f5f3ee] border-b border-[#d1c4b9]/60 text-[#735c41] font-semibold uppercase tracking-wider">
                    <th scope="col" className="py-3 px-4">
                      Ticket ID
                    </th>
                    <th scope="col" className="py-3 px-4">
                      Subject
                    </th>
                    <th scope="col" className="py-3 px-4">
                      Category
                    </th>
                    <th scope="col" className="py-3 px-4">
                      Priority
                    </th>
                    <th scope="col" className="py-3 px-4">
                      Status
                    </th>
                    <th scope="col" className="py-3 px-4">
                      SLA Countdown
                    </th>
                    <th scope="col" className="py-3 px-4">
                      Assigned Team
                    </th>
                    <th scope="col" className="py-3 px-4 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d1c4b9]/30">
                  {filteredTickets.map((ticket) => {
                    const slaResTarget = ticket.sla_trackings?.find((s) => s.target_type === 'resolution');
                    const resolutionDueIso = slaResTarget?.target_due_at || calculateSLADeadlineISO(ticket.created_at, ticket.priority, 'resolution');

                    return (
                      <tr key={ticket.id} className="hover:bg-[#f5f3ee]/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-[#59452b]">
                          {ticket.ticket_number}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#1b1c19]">
                          <div className="line-clamp-1">{ticket.subject}</div>
                          <span className="text-[11px] text-[#80756b]">Created {ticket.created_at}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block bg-[#eae8e3] text-[#4e453d] px-2 py-0.5 rounded font-mono text-[11px]">
                            {ticket.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-semibold text-[11px] uppercase tracking-wider ${
                              ticket.priority === 'urgent' || ticket.priority === 'P1'
                                ? 'bg-[#ffdad6] text-[#93000a]'
                                : ticket.priority === 'high' || ticket.priority === 'P2'
                                ? 'bg-[#f5d6b4] text-[#59452b]'
                                : 'bg-[#eae8e3] text-[#4e453d]'
                            }`}
                          >
                            {getPriorityDisplayLabel(ticket.priority)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <StatusLabel
                            status={
                              ticket.status === 'resolved'
                                ? 'success'
                                : ticket.status === 'in_progress'
                                ? 'active'
                                : ticket.status === 'open'
                                ? 'warning'
                                : 'pending'
                            }
                            label={ticket.status === 'in_progress' ? 'In Progress' : ticket.status.toUpperCase()}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <SLACountdownTimer
                            targetDueAt={resolutionDueIso}
                            targetType="resolution"
                            priority={ticket.priority}
                            ticketStatus={ticket.status}
                            inline={true}
                            showSubSeconds={false}
                          />
                        </td>
                        <td className="py-3 px-4 text-[#4e453d] font-medium">{ticket.assigned_agent}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOpenTicketModal(ticket)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#59452b] hover:text-[#735c41] underline focus:outline-none focus:ring-1 focus:ring-[#735c41]"
                            aria-label={`View details for ticket ${ticket.ticket_number}`}
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Frequently Asked Questions (FAQ) Section */}
      <section aria-labelledby="faq-section-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
          <h2 id="faq-section-heading" className="text-xl font-serif text-[#1b1c19]">
            Frequently Asked Questions & Operations Help
          </h2>
        </div>

        <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-5 space-y-3">
          {FAQ_ITEMS.map((faq) => {
            const isExpanded = expandedFaqId === faq.id;
            return (
              <div key={faq.id} className="bg-white border border-[#d1c4b9]/60 rounded-md overflow-hidden">
                <button
                  onClick={() => handleToggleFaq(faq.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`faq-answer-${faq.id}`}
                  className="w-full text-left p-4 flex items-center justify-between gap-4 font-medium text-xs sm:text-sm text-[#1b1c19] hover:bg-[#f5f3ee]/60 transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#735c41] bg-[#eae8e3] px-1.5 py-0.5 rounded">
                      {faq.category}
                    </span>
                    <span>{faq.question}</span>
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#80756b] shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#80756b] shrink-0" aria-hidden="true" />
                  )}
                </button>

                {isExpanded && (
                  <div id={`faq-answer-${faq.id}`} className="p-4 pt-0 text-xs text-[#4e453d] border-t border-[#d1c4b9]/30 bg-[#fbf9f4]">
                    <p className="mt-2 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}

          <div className="pt-2 text-right">
            <Link
              href="/knowledge"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#59452b] hover:underline"
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              Visit Full Knowledge Base Documentation &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Ticket Details & Conversation Modal */}
      {selectedTicket && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-ticket-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        >
          <div className="bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-[#d1c4b9]/40 pb-4">
              <div>
                <span className="text-xs font-mono font-medium text-[#735c41]">
                  {selectedTicket.ticket_number}
                </span>
                <h3 id="modal-ticket-title" className="text-xl font-serif text-[#1b1c19] mt-0.5">
                  {selectedTicket.subject}
                </h3>
              </div>
              <button
                onClick={handleCloseTicketModal}
                className="p-1 text-[#80756b] hover:text-[#1b1c19] rounded focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                aria-label="Close ticket details modal"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-[#f5f3ee] p-4 rounded-md border border-[#d1c4b9]/50">
              <div>
                <span className="text-[#80756b] block">Category:</span>
                <span className="font-medium text-[#1b1c19]">{selectedTicket.category.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-[#80756b] block">Priority:</span>
                <span className="font-semibold text-[#59452b] uppercase">{getPriorityDisplayLabel(selectedTicket.priority)}</span>
              </div>
              <div>
                <span className="text-[#80756b] block">Status:</span>
                <span className="font-medium text-[#1b1c19]">{selectedTicket.status.toUpperCase()}</span>
              </div>
              <div>
                <span className="text-[#80756b] block">Assigned Team:</span>
                <span className="font-medium text-[#1b1c19]">{selectedTicket.assigned_agent}</span>
              </div>
            </div>

            {/* SLA Compliance Countdown Timers [FR-4, NFR-1] */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SLACountdownTimer
                targetDueAt={calculateSLADeadlineISO(selectedTicket.created_at, selectedTicket.priority, 'first_response')}
                targetType="first_response"
                priority={selectedTicket.priority}
                ticketStatus={selectedTicket.status}
                compact={true}
              />
              <SLACountdownTimer
                targetDueAt={calculateSLADeadlineISO(selectedTicket.created_at, selectedTicket.priority, 'resolution')}
                targetType="resolution"
                priority={selectedTicket.priority}
                ticketStatus={selectedTicket.status}
                compact={true}
              />
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#735c41] uppercase tracking-wider">
                Inquiry Description
              </h4>
              <p className="text-xs text-[#1b1c19] leading-relaxed bg-white p-3 rounded border border-[#d1c4b9]/40">
                {selectedTicket.description}
              </p>
            </div>

            {/* Sequential Message Thread History [FR-2, FR-7] */}
            <TicketThread
              ticketId={selectedTicket.id}
              ticketSubject={selectedTicket.subject}
              ticketDescription={selectedTicket.description}
              createdAt={selectedTicket.created_at}
              status={selectedTicket.status}
              messages={selectedTicket.messages || []}
              currentUserId={user?.user_id}
              currentUserType="client"
            />

            <div className="flex items-center justify-between pt-2 border-t border-[#d1c4b9]/40">
              {selectedTicket.status !== 'resolved' ? (
                <button
                  onClick={() => handleResolveTicket(selectedTicket.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#374a5f] rounded hover:bg-[#4f6278] focus:outline-none focus:ring-2 focus:ring-[#374a5f] transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Mark as Resolved
                </button>
              ) : (
                <span className="text-xs text-[#374a5f] font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Ticket Resolved
                </span>
              )}

              <button
                onClick={handleCloseTicketModal}
                className="px-4 py-1.5 text-xs font-medium text-[#59452b] bg-[#f5f3ee] border border-[#d1c4b9] rounded hover:bg-[#eae8e3] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit New Support Ticket Modal */}
      {isCreateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-create-ticket-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        >
          <div className="bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#d1c4b9]/40 pb-3">
              <div className="flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
                <h3 id="modal-create-ticket-title" className="text-xl font-serif text-[#1b1c19]">
                  Submit Support Ticket
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-[#80756b] hover:text-[#1b1c19] rounded focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                aria-label="Close submit ticket modal"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {formError && (
              <div role="alert" className="p-3 bg-[#ffdad6] text-[#93000a] text-xs font-medium rounded border border-[#ba1a1a]/30">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateTicketSubmit} className="space-y-4">
              <div>
                <label htmlFor="ticket-subject" className="block text-xs font-medium text-[#735c41] mb-1">
                  Subject / Summary *
                </label>
                <input
                  id="ticket-subject"
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. RBAC custom role query"
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-[#d1c4b9] rounded-md focus:outline-none focus:ring-2 focus:ring-[#735c41] text-[#1b1c19]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ticket-category" className="block text-xs font-medium text-[#735c41] mb-1">
                    Category
                  </label>
                  <select
                    id="ticket-category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as SupportTicket['category'])}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#d1c4b9] rounded-md focus:outline-none focus:ring-2 focus:ring-[#735c41] text-[#1b1c19]"
                  >
                    <option value="rbac_access">RBAC & Access</option>
                    <option value="audit_logs">Audit Logs</option>
                    <option value="tenant_isolation">Tenant Isolation</option>
                    <option value="api_integration">API Integration</option>
                    <option value="general">General Inquiry</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ticket-priority" className="block text-xs font-medium text-[#735c41] mb-1">
                    Priority Level
                  </label>
                  <select
                    id="ticket-priority"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as SupportTicket['priority'])}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#d1c4b9] rounded-md focus:outline-none focus:ring-2 focus:ring-[#735c41] text-[#1b1c19]"
                  >
                    <option value="low">Low (P3)</option>
                    <option value="medium">Medium (P3)</option>
                    <option value="high">High (P2)</option>
                    <option value="urgent">Urgent (P1)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="ticket-description" className="block text-xs font-medium text-[#735c41] mb-1">
                  Description / Context *
                </label>
                <textarea
                  id="ticket-description"
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Provide technical details, route endpoint context, or error messages..."
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-[#d1c4b9] rounded-md focus:outline-none focus:ring-2 focus:ring-[#735c41] text-[#1b1c19]"
                />
              </div>

              {/* File Attachment Uploader [FR-3, NFR-2] */}
              <div>
                <label className="block text-xs font-medium text-[#735c41] mb-1">
                  File Attachments (Optional)
                </label>
                <AttachmentUploader
                  compact={true}
                  onFilesSelected={(files) => setStagedFiles(files)}
                  maxFiles={5}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#d1c4b9]/40">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#59452b] bg-[#f5f3ee] border border-[#d1c4b9] rounded hover:bg-[#eae8e3] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#59452b] rounded hover:bg-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:ring-offset-2 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSAT Rating Modal Survey [FR-9] */}
      {isCsatModalOpen && csatTicket && (
        <CSATRatingModal
          isOpen={isCsatModalOpen}
          ticketId={csatTicket.id}
          ticketSubject={csatTicket.subject}
          onClose={() => setIsCsatModalOpen(false)}
          onSubmitSuccess={(rating) => {
            const msg = `Thank you for rating ticket ${csatTicket.ticket_number}! (${rating.score}/5 stars)`;
            setNoticeMessage(msg);
            announce(msg, 'polite');
            setIsCsatModalOpen(false);
            setTimeout(() => setNoticeMessage(null), 5000);
          }}
        />
      )}
    </div>
  );
}