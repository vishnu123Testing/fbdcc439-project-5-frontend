import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SupportTicketDetailPage from '../../src/app/support/[id]/page';
import { apiClient, ApiError } from '../../src/services/apiClient';
import { supportService } from '../../src/services/support';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';

const mockPush = vi.fn();

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/support/sup-101',
  useParams: () => ({ id: 'sup-101' }),
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
      getTicket: vi.fn(),
      updateTicket: vi.fn(),
      addMessage: vi.fn(),
      uploadAttachment: vi.fn(),
      submitCSATRating: vi.fn(),
    },
  };
});

describe('SupportTicketDetailPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login if unauthenticated', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue(null);

    render(
      <AccessibilityProvider>
        <SupportTicketDetailPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders loading state initially while loading ticket', () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockReturnValue(new Promise(() => {})); // pending

    render(
      <AccessibilityProvider>
        <SupportTicketDetailPage />
      </AccessibilityProvider>
    );

    expect(screen.getByRole('status', { name: /loading support ticket detail view/i })).toBeInDocument();
  });

  it('renders support ticket detail page with SLA timers and message thread', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-client-10',
      email: 'client@example.com',
      tenant_id: 'tenant-client-001',
      roles: ['ClientStandard'],
    });

    vi.mocked(supportService.getTicket).mockResolvedValue({
      id: 'sup-101',
      priority: 'P2',
      status: 'in_progress',
      subject: 'RBAC Evaluation Latency Consultation',
      description: 'Inquiry regarding server-side RBAC evaluation overhead SLA verification under peak load.',
      client_id: 'tenant-client-001',
      assigned_tier: 'Tier 2 (Security Ops)',
      assigned_agent_id: 'Agent Security Ops',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      first_responded_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      resolved_at: null,
      messages: [
        {
          id: 'msg-1',
          ticket_id: 'sup-101',
          sender_id: 'usr-client-10',
          sender_type: 'client',
          message_body: 'We noticed latency spikes in policy checks.',
          created_at: new Date(Date.now() - 100 * 60 * 1000).toISOString(),
          attachments: [],
        },
      ],
      sla_trackings: [
        {
          id: 'sla-resp-1',
          ticket_id: 'sup-101',
          target_type: 'first_response',
          target_due_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          is_breached: false,
        },
        {
          id: 'sla-res-1',
          ticket_id: 'sup-101',
          target_type: 'resolution',
          target_due_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          is_breached: false,
        },
      ],
      csat_rating: null,
    });

    render(
      <AccessibilityProvider>
        <SupportTicketDetailPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /rbac evaluation latency consultation/i })).toBeInDocument();
    });

    // Verify SLA Timers heading
    expect(screen.getByText('Real-Time SLA Compliance Countdown')).toBeInDocument();
    expect(screen.getByText('First Agent Response SLA')).toBeInDocument();
    expect(screen.getByText('Ticket Resolution SLA')).toBeInDocument();

    // Verify Ticket Thread description and message
    expect(screen.getByText(/Inquiry regarding server-side RBAC evaluation overhead SLA verification/i)).toBeInDocument();
    expect(screen.getByText('We noticed latency spikes in policy checks.')).toBeInDocument();
  });

  it('allows updating ticket status to resolved and opens CSAT rating modal', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-client-10',
      email: 'client@example.com',
      tenant_id: 'tenant-client-001',
      roles: ['ClientStandard'],
    });

    vi.mocked(supportService.getTicket).mockResolvedValue({
      id: 'sup-101',
      priority: 'P2',
      status: 'in_progress',
      subject: 'RBAC Evaluation Latency Consultation',
      description: 'Inquiry regarding server-side RBAC evaluation overhead.',
      client_id: 'tenant-client-001',
      assigned_tier: 'Tier 2',
      assigned_agent_id: 'Agent SecOps',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      first_responded_at: new Date().toISOString(),
      resolved_at: null,
      messages: [],
      sla_trackings: [],
      csat_rating: null,
    });

    vi.mocked(supportService.updateTicket).mockResolvedValue({
      id: 'sup-101',
      priority: 'P2',
      status: 'resolved',
      subject: 'RBAC Evaluation Latency Consultation',
      description: 'Inquiry regarding server-side RBAC evaluation overhead.',
      client_id: 'tenant-client-001',
      assigned_tier: 'Tier 2',
      assigned_agent_id: 'Agent SecOps',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      first_responded_at: new Date().toISOString(),
      resolved_at: new Date().toISOString(),
      messages: [],
      sla_trackings: [],
      csat_rating: null,
    });

    render(
      <AccessibilityProvider>
        <SupportTicketDetailPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /mark as resolved/i })).toBeInDocument();
    });

    // Click Mark as Resolved
    fireEvent.click(screen.getByRole('button', { name: /mark as resolved/i }));

    await waitFor(() => {
      expect(supportService.updateTicket).toHaveBeenCalledWith('sup-101', { status: 'resolved' });
    });

    // CSAT Modal should open
    expect(screen.getByTestId('csat-rating-modal')).toBeInDocument();
    expect(screen.getByText('Rate Your Experience')).toBeInDocument();
  });

  it('allows posting a new reply message in the ticket thread', async () => {
    vi.mocked(apiClient.getToken).mockReturnValue('valid-token');
    vi.mocked(apiClient.getMe).mockResolvedValue({
      user_id: 'usr-client-10',
      email: 'client@example.com',
      tenant_id: 'tenant-client-001',
      roles: ['ClientStandard'],
    });

    vi.mocked(supportService.getTicket).mockResolvedValue({
      id: 'sup-101',
      priority: 'P2',
      status: 'in_progress',
      subject: 'RBAC Evaluation Latency Consultation',
      description: 'Inquiry regarding server-side RBAC evaluation overhead.',
      client_id: 'tenant-client-001',
      assigned_tier: 'Tier 2',
      assigned_agent_id: 'Agent SecOps',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [],
      sla_trackings: [],
      csat_rating: null,
    });

    vi.mocked(supportService.addMessage).mockResolvedValue({
      id: 'msg-reply-1',
      ticket_id: 'sup-101',
      sender_id: 'usr-client-10',
      sender_type: 'client',
      message_body: 'Thank you for the updates.',
      created_at: new Date().toISOString(),
      attachments: [],
    });

    render(
      <AccessibilityProvider>
        <SupportTicketDetailPage />
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/post a reply/i)).toBeInDocument();
    });

    const replyInput = screen.getByPlaceholderText(/type your response or additional details here/i);
    fireEvent.change(replyInput, { target: { value: 'Thank you for the updates.' } });

    const sendButton = screen.getByRole('button', { name: /send reply/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(supportService.addMessage).toHaveBeenCalledWith('sup-101', {
        message_body: 'Thank you for the updates.',
        sender_id: 'usr-client-10',
        sender_type: 'client',
      });
    });

    expect(screen.getByText('Thank you for the updates.')).toBeInDocument();
  });
});