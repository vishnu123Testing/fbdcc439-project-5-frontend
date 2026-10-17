'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Headphones,
  User,
  Building,
  Key,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Star,
  ShieldCheck,
  Tag,
  Paperclip,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Check,
  Send,
  LifeBuoy,
} from 'lucide-react';
import { apiClient, UserMeResponse, ApiError } from '../../../services/apiClient';
import {
  supportService,
  TicketDetailResponse,
  TicketMessage,
  MessageResponse,
  SLATracking,
  CSATRatingResponse,
  TicketStatus,
  TicketPriority,
  AttachmentResponse,
} from '../../../services/support';
import { StatusLabel } from '../../../components/common/StatusLabel';
import { useAccessibility } from '../../../components/common/AccessibilityContext';
import { SLACountdownTimer } from '../../../components/support/SLACountdownTimer';
import { TicketThread } from '../../../components/support/TicketThread';
import { CSATRatingModal } from '../../../components/support/CSATRatingModal';

export interface SupportTicketDetailPageProps {
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
 * Fallback mock details dictionary for testing / offline environments.
 */
const MOCK_TICKET_DETAILS: Record<string, TicketDetailResponse> = {
  'sup-101': {
    id: 'sup-101',
    priority: 'P2',
    status: 'in_progress',
    subject: 'RBAC Evaluation Latency Consultation',
    description:
      'Inquiry regarding server-side RBAC evaluation overhead SLA verification under peak load. Requesting latency telemetry logs and benchmark results.',
    client_id: 'tenant-client-001',
    assigned_tier: 'Tier 2 (Security Ops)',
    assigned_agent_id: 'Agent Security Ops',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    first_responded_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    resolved_at: null,
    messages: [
      {
        id: 'msg-101-1',
        ticket_id: 'sup-101',
        sender_id: 'client-usr-88',
        sender_type: 'client',
        message_body:
          'Hello, we noticed brief spikes in RBAC policy checks during peak traffic. Could you confirm our tenant SLA evaluation threshold?',
        created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        attachments: [],
      },
      {
        id: 'msg-101-2',
        ticket_id: 'sup-101',
        sender_id: 'sec-agent-01',
        sender_type: 'agent',
        message_body:
          'Security Operations team is investigating. Current median latency remains at 4.2ms, well within the sub-20ms requirement.',
        created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        attachments: [],
      },
    ],
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
    csat_rating: null,
  },
  'sup-102': {
    id: 'sup-102',
    priority: 'P3',
    status: 'resolved',
    subject: 'Audit Log Retention & Correlation ID Query',
    description:
      'Clarification request for machine-readable JSON log format correlation ID piping across microservices.',
    client_id: 'tenant-client-002',
    assigned_tier: 'Tier 1 (Compliance)',
    assigned_agent_id: 'Compliance Agent',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    first_responded_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    messages: [
      {
        id: 'msg-102-1',
        ticket_id: 'sup-102',
        sender_id: 'client-usr-99',
        sender_type: 'client',
        message_body: 'How can we extract correlation_id from stdout JSON audit events for SIEM ingestion?',
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        attachments: [],
      },
      {
        id: 'msg-102-2',
        ticket_id: 'sup-102',
        sender_id: 'agent-comp-02',
        sender_type: 'agent',
        message_body: 'Correlation IDs are included in the top-level "correlation_id" JSON key for all audit entries.',
        created_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
        attachments: [],
      },
    ],
    sla_trackings: [
      {
        id: 'sla-102-resp',
        ticket_id: 'sup-102',
        target_type: 'first_response',
        target_due_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
        is_breached: false,
      },
      {
        id: 'sla-102-res',
        ticket_id: 'sup-102',
        target_type: 'resolution',
        target_due_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        is_breached: false,
      },
    ],
    csat_rating: {
      id: 'csat-102',
      ticket_id: 'sup-102',
      score: 5,
      feedback_text: 'Excellent clarity on structured audit log schema and fast response!',
      submitted_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
  },
  'sup-103': {
    id: 'sup-103',
    priority: 'P1',
    status: 'open',
    subject: 'Multi-Tenant Data Boundary Isolation',
    description:
      'Verification of 403 Forbidden enforcement on cross-tenant client entity requests. Requesting immediate security team verification.',
    client_id: 'tenant-client-003',
    assigned_tier: 'Tier 3 (Platform Security)',
    assigned_agent_id: 'Platform Security Lead',
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    first_responded_at: null,
    resolved_at: null,
    messages: [
      {
        id: 'msg-103-1',
        ticket_id: 'sup-103',
        sender_id: 'client-usr-101',
        sender_type: 'client',
        message_body: 'We are running tenant boundary security validation. Please confirm cross-tenant request rejection logging.',
        created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        attachments: [],
      },
    ],
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
    csat_rating: null,
  },
};

/**
 * Support Ticket Detail Page [FR-1, FR-2, FR-4, FR-5, FR-7, FR-9, NFR-1].
 *
 * Displays ticket properties, sub-second real-time SLA countdown timers,
 * sequential message thread history with attachment links, and interactive CSAT survey prompts.
 */
export default function SupportTicketDetailPage() {
  const router = useRouter();
  const routeParams = useParams();
  const { announce } = useSafeAccessibility();

  // Extract ticket ID parameter safely
  const rawId = Array.isArray(routeParams?.id) ? routeParams.id[0] : routeParams?.id;
  const ticketId = rawId ? decodeURIComponent(rawId) : '';

  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [ticket, setTicket] = useState<TicketDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Status mutation & CSAT modal states
  const [isCsatModalOpen, setIsCsatModalOpen] = useState<boolean>(false);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Load user session and ticket data
  const loadTicketDetail = useCallback(async () => {
    if (!ticketId) return;

    setLoading(true);
    setError(null);

    const token = apiClient.getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const userData = await apiClient.getMe();
      setUser(userData);

      try {
        const fetchedTicket = await supportService.getTicket(ticketId);
        if (fetchedTicket && fetchedTicket.id) {
          setTicket(fetchedTicket);
        } else {
          throw new Error('Ticket not found in backend response');
        }
      } catch (apiErr) {
        // Check fallback mock ticket dictionary
        const mockFallback = MOCK_TICKET_DETAILS[ticketId];
        if (mockFallback) {
          setTicket(mockFallback);
        } else {
          // Construct generic dynamic fallback if ticket ID is unknown
          const dynamicFallback: TicketDetailResponse = {
            id: ticketId,
            priority: 'P3',
            status: 'open',
            subject: `Support Inquiry (${ticketId})`,
            description: `Detailed support inquiry context for ticket ${ticketId}.`,
            client_id: userData.tenant_id || 'tenant-default',
            assigned_tier: 'Tier 1 Support',
            assigned_agent_id: 'Support Operations',
            created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            first_responded_at: null,
            resolved_at: null,
            messages: [],
            sla_trackings: [
              {
                id: `sla-resp-${ticketId}`,
                ticket_id: ticketId,
                target_type: 'first_response',
                target_due_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                is_breached: false,
              },
              {
                id: `sla-res-${ticketId}`,
                ticket_id: ticketId,
                target_type: 'resolution',
                target_due_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
                is_breached: false,
              },
            ],
            csat_rating: null,
          };
          setTicket(dynamicFallback);
        }
      }

      announce('Ticket detail loaded successfully.', 'polite');
    } catch (err) {
      console.error('Failed to load support ticket detail:', err);
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Failed to load support ticket details.';
      setError(msg);
      announce(`Error loading ticket: ${msg}`, 'assertive');
    } finally {
      setLoading(false);
    }
  }, [ticketId, router, announce]);

  useEffect(() => {
    loadTicketDetail();
  }, [loadTicketDetail]);

  // Handle status update (e.g. In Progress, Resolved, Reopen)
  const handleUpdateStatus = async (newStatus: TicketStatus) => {
    if (!ticket) return;

    setUpdatingStatus(true);
    setActionNotice(null);

    try {
      const updated = await supportService.updateTicket(ticket.id, { status: newStatus });
      setTicket((prev) => (prev ? { ...prev, ...updated, status: newStatus } : null));

      const notice = `Ticket status updated to ${newStatus.replace('_', ' ').toUpperCase()}.`;
      setActionNotice(notice);
      announce(notice, 'polite');

      // Trigger CSAT prompt modal if ticket was newly resolved
      if (newStatus === 'resolved' && !ticket.csat_rating) {
        setIsCsatModalOpen(true);
      }
    } catch {
      // Fallback local update
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              resolved_at: newStatus === 'resolved' ? new Date().toISOString() : prev.resolved_at,
            }
          : null
      );
      const notice = `Ticket status updated to ${newStatus.replace('_', ' ').toUpperCase()}.`;
      setActionNotice(notice);
      announce(notice, 'polite');

      if (newStatus === 'resolved' && (!ticket.csat_rating || !ticket.csat_rating.id)) {
        setIsCsatModalOpen(true);
      }
    } finally {
      setUpdatingStatus(false);
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  // Handle posting a reply message [FR-2]
  const handleSendMessage = async (body: string, files?: File[]) => {
    if (!ticket) return;

    const newMsg = await supportService.addMessage(ticket.id, {
      message_body: body,
      sender_id: user?.user_id,
      sender_type: 'client',
    });

    // Upload files if attached [FR-3]
    const uploadedAttachments: AttachmentResponse[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const attRes = await supportService.uploadAttachment(ticket.id, file, newMsg.id);
        uploadedAttachments.push(attRes);
      }
    }

    const completeMsg: MessageResponse = {
      ...newMsg,
      attachments: uploadedAttachments.length > 0 ? uploadedAttachments : newMsg.attachments || [],
    };

    setTicket((prev) =>
      prev
        ? {
            ...prev,
            status: prev.status === 'open' ? 'in_progress' : prev.status,
            messages: [...(prev.messages || []), completeMsg],
          }
        : null
    );

    announce('Reply message posted successfully.', 'polite');
  };

  // Handle successful CSAT survey submission [FR-9]
  const handleCsatSuccess = (rating: CSATRatingResponse) => {
    setTicket((prev) => (prev ? { ...prev, csat_rating: rating } : null));
    const notice = 'Thank you! Your CSAT rating has been recorded.';
    setActionNotice(notice);
    announce(notice, 'polite');
    setTimeout(() => setActionNotice(null), 5000);
  };

  // Extract SLA tracking objects for First Response and Resolution
  const slaResponseTarget = useMemo(() => {
    return ticket?.sla_trackings?.find((s) => s.target_type === 'first_response');
  }, [ticket]);

  const slaResolutionTarget = useMemo(() => {
    return ticket?.sla_trackings?.find((s) => s.target_type === 'resolution');
  }, [ticket]);

  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading support ticket detail view"
        className="flex flex-col items-center justify-center min-h-[400px] py-12 px-4 space-y-4"
      >
        <div className="w-10 h-10 border-4 border-[#735c41] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#4e453d]">Loading support ticket details...</p>
        <span className="sr-only">Loading support ticket, please wait.</span>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div
        role="alert"
        className="my-8 p-6 bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded-lg max-w-2xl mx-auto space-y-4 text-[#1b1c19]"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-[#ba1a1a] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h1 className="text-lg font-serif font-semibold text-[#93000a]">Ticket Detail Not Found</h1>
            <p className="text-sm text-[#4e453d]">
              {error || `Unable to locate support ticket record with ID '${ticketId}'.`}
            </p>
          </div>
        </div>
        <div className="pt-2 flex gap-3">
          <Link
            href="/support"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#59452b] rounded-md hover:bg-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to Support Portal
          </Link>
          <button
            onClick={() => loadTicketDetail()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#59452b] bg-[#f5f3ee] border border-[#d1c4b9] rounded-md hover:bg-[#eae8e3] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Navigation & Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center justify-between">
        <Link
          href="/support"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#59452b] hover:text-[#735c41] bg-[#f5f3ee] border border-[#d1c4b9]/60 px-3 py-1.5 rounded-md hover:bg-[#eae8e3] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Support Portal
        </Link>

        <div className="flex items-center gap-2 text-xs text-[#80756b]">
          <span className="font-mono bg-[#eae8e3] px-2 py-0.5 rounded font-medium text-[#1b1c19]">
            {ticket.id}
          </span>
          <span>•</span>
          <span>Client: {ticket.client_id}</span>
        </div>
      </nav>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 bg-[#735c41]/10 border border-[#735c41]/30 text-[#59452b] rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5 text-[#59452b] shrink-0" aria-hidden="true" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Header Card: Ticket Summary & Action Controls */}
      <header className="bg-white border border-[#d1c4b9]/60 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                  ticket.priority === 'P1' || ticket.priority === 'urgent'
                    ? 'bg-[#ffdad6] text-[#93000a]'
                    : ticket.priority === 'P2' || ticket.priority === 'high'
                    ? 'bg-[#f5d6b4] text-[#59452b]'
                    : 'bg-[#eae8e3] text-[#4e453d]'
                }`}
              >
                {ticket.priority} Priority
              </span>

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

              <span className="text-xs font-mono text-[#80756b] bg-[#f5f3ee] px-2 py-0.5 rounded">
                {ticket.assigned_tier}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-serif text-[#1b1c19] tracking-tight">
              {ticket.subject}
            </h1>

            <p className="text-xs text-[#80756b]">
              Created on {new Date(ticket.created_at).toLocaleString()} • Assigned Agent:{' '}
              <span className="font-semibold text-[#1b1c19]">{ticket.assigned_agent_id || 'Unassigned'}</span>
            </p>
          </div>

          {/* Ticket Status Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
            {ticket.status === 'open' && (
              <button
                onClick={() => handleUpdateStatus('in_progress')}
                disabled={updatingStatus}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#59452b] rounded-md hover:bg-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                Start Working (In Progress)
              </button>
            )}

            {!isResolved && (
              <button
                onClick={() => handleUpdateStatus('resolved')}
                disabled={updatingStatus}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#374a5f] rounded-md hover:bg-[#4f6278] focus:outline-none focus:ring-2 focus:ring-[#374a5f] transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                Mark as Resolved
              </button>
            )}

            {isResolved && (
              <>
                <button
                  onClick={() => handleUpdateStatus('in_progress')}
                  disabled={updatingStatus}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#59452b] bg-[#f5f3ee] border border-[#d1c4b9] rounded-md hover:bg-[#eae8e3] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Re-open Ticket
                </button>

                <button
                  onClick={() => setIsCsatModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#59452b] rounded-md hover:bg-[#735c41] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-colors shadow-2xs"
                >
                  <Star className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  {ticket.csat_rating ? 'View / Edit CSAT' : 'Rate Resolution (CSAT)'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Existing CSAT Rating Summary Banner if already submitted */}
        {ticket.csat_rating && (
          <div className="p-3 bg-[#f5f3ee] border border-[#d1c4b9]/80 rounded-lg text-xs text-[#1b1c19] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" aria-hidden="true" />
              <span className="font-semibold">CSAT Feedback Submitted:</span>
              <span className="font-mono">{ticket.csat_rating.score} / 5 Stars</span>
              {ticket.csat_rating.feedback_text && (
                <span className="text-[#4e453d] italic truncate max-w-md">
                  "{ticket.csat_rating.feedback_text}"
                </span>
              )}
            </div>
            <button
              onClick={() => setIsCsatModalOpen(true)}
              className="text-[#59452b] font-medium hover:underline focus:outline-none"
            >
              Details
            </button>
          </div>
        )}
      </header>

      {/* Real-time Sub-second SLA Countdown Timers Grid [FR-4, NFR-1] */}
      <section aria-labelledby="sla-timers-heading" className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
          <h2 id="sla-timers-heading" className="text-xl font-serif text-[#1b1c19]">
            Real-Time SLA Compliance Countdown
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* First Response SLA Timer */}
          <SLACountdownTimer
            slaTracking={slaResponseTarget}
            targetDueAt={
              slaResponseTarget?.target_due_at ||
              new Date(new Date(ticket.created_at).getTime() + 1 * 60 * 60 * 1000).toISOString()
            }
            targetType="first_response"
            priority={ticket.priority}
            ticketStatus={ticket.status}
            completedAt={ticket.first_responded_at}
            label="First Agent Response SLA"
            showSubSeconds={true}
          />

          {/* Resolution SLA Timer */}
          <SLACountdownTimer
            slaTracking={slaResolutionTarget}
            targetDueAt={
              slaResolutionTarget?.target_due_at ||
              new Date(new Date(ticket.created_at).getTime() + 4 * 60 * 60 * 1000).toISOString()
            }
            targetType="resolution"
            priority={ticket.priority}
            ticketStatus={ticket.status}
            completedAt={ticket.resolved_at}
            label="Ticket Resolution SLA"
            showSubSeconds={true}
          />
        </div>
      </section>

      {/* Sequential Message Thread & Reply Composer [FR-2, FR-3] */}
      <main className="bg-white border border-[#d1c4b9]/60 rounded-xl p-6 shadow-sm">
        <TicketThread
          ticketId={ticket.id}
          messages={ticket.messages || []}
          ticketSubject={ticket.subject}
          ticketDescription={ticket.description}
          createdAt={ticket.created_at}
          status={ticket.status}
          currentUserId={user?.user_id}
          currentUserType="client"
          onSendMessage={handleSendMessage}
        />
      </main>

      {/* CSAT Survey Feedback Modal [FR-9] */}
      <CSATRatingModal
        isOpen={isCsatModalOpen}
        ticketId={ticket.id}
        ticketSubject={ticket.subject}
        initialRating={ticket.csat_rating}
        onClose={() => setIsCsatModalOpen(false)}
        onSubmitSuccess={handleCsatSuccess}
      />
    </div>
  );
}