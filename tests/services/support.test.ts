import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  supportService,
  sanitizeString,
  validateFileAttachment,
  sanitizeAttachment,
  sanitizeMessage,
  sanitizeSLATracking,
  sanitizeCSATRating,
  sanitizeTicketSummary,
  sanitizeTicketDetail,
  sanitizeSupportAnalytics,
  createTicket,
  getTickets,
  getTicket,
  updateTicket,
  deleteTicket,
  addMessage,
  getTicketMessages,
  uploadAttachment,
  getAttachmentUrl,
  downloadAttachment,
  submitCSATRating,
  getCSATRating,
  getSupportAnalytics,
  MAX_ATTACHMENT_SIZE_BYTES,
  TicketCreateRequest,
  TicketUpdateRequest,
  MessageCreateRequest,
  CSATRatingCreateRequest,
  TicketFilterParams,
  AnalyticsFilterParams,
} from '../../src/services/support';
import { setToken } from '../../src/services/apiClient';

describe('support service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeString & helper functions [NFR-2]', () => {
    it('returns empty string for null, undefined, or whitespace values', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
      expect(sanitizeString('   ')).toBe('');
    });

    it('strips script and HTML markup tags', () => {
      const input = '<script>alert("xss")</script>Support <b>Issue</b>';
      const result = sanitizeString(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('<b>');
      expect(result).toContain('Support Issue');
    });

    it('escapes special HTML entity characters', () => {
      const input = 'Issue & Resolution <Target> "P1" \'Tier 1\' / Ticket';
      const result = sanitizeString(input);
      expect(result).toBe('Issue &amp; Resolution &lt;Target&gt; &quot;P1&quot; &#x27;Tier 1&#x27; &#x2F; Ticket');
    });

    it('removes control characters', () => {
      const input = 'Clean\x00Ticket\x07Text';
      expect(sanitizeString(input)).toBe('CleanTicketText');
    });
  });

  describe('validateFileAttachment [FR-3, NFR-2]', () => {
    it('rejects invalid or null file objects', () => {
      const res = validateFileAttachment(null as unknown as File);
      expect(res.is_valid).toBe(false);
      expect(res.error_message).toContain('Invalid file');
    });

    it('rejects empty files with 0 bytes', () => {
      const file = { name: 'empty.pdf', size: 0, type: 'application/pdf' };
      const res = validateFileAttachment(file);
      expect(res.is_valid).toBe(false);
      expect(res.error_message).toContain('cannot be empty');
    });

    it('rejects files exceeding maximum size limit', () => {
      const file = { name: 'large.pdf', size: MAX_ATTACHMENT_SIZE_BYTES + 100, type: 'application/pdf' };
      const res = validateFileAttachment(file);
      expect(res.is_valid).toBe(false);
      expect(res.error_message).toContain('exceeds maximum allowable limit');
    });

    it('rejects unsupported file extensions or MIME types', () => {
      const file = { name: 'executable.exe', size: 1024, type: 'application/x-msdownload' };
      const res = validateFileAttachment(file);
      expect(res.is_valid).toBe(false);
      expect(res.error_message).toContain('Unsupported file type');
    });

    it('accepts valid PDF, DOCX, TXT, PNG, and JPEG files', () => {
      const validFiles = [
        { name: 'document.pdf', size: 5000, type: 'application/pdf' },
        { name: 'report.docx', size: 12000, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { name: 'notes.txt', size: 500, type: 'text/plain' },
        { name: 'screenshot.png', size: 45000, type: 'image/png' },
        { name: 'photo.jpg', size: 30000, type: 'image/jpeg' },
      ];

      for (const f of validFiles) {
        const res = validateFileAttachment(f);
        expect(res.is_valid).toBe(true);
      }
    });
  });

  describe('fallback sanitizers [NFR-2]', () => {
    it('sanitizeAttachment handles null or invalid input', () => {
      const fallback = sanitizeAttachment(null);
      expect(fallback.id).toBe('');
      expect(fallback.filename).toBe('');
      expect(fallback.file_size_bytes).toBe(0);
      expect(fallback.mime_type).toBe('application/octet-stream');
    });

    it('sanitizeMessage handles null or invalid input', () => {
      const fallback = sanitizeMessage(undefined);
      expect(fallback.id).toBe('');
      expect(fallback.sender_type).toBe('client');
      expect(fallback.attachments).toEqual([]);
    });

    it('sanitizeSLATracking handles null or invalid input', () => {
      const fallback = sanitizeSLATracking(null);
      expect(fallback.id).toBe('');
      expect(fallback.target_type).toBe('resolution');
      expect(fallback.is_breached).toBe(false);
    });

    it('sanitizeCSATRating handles null or invalid input and score bounds', () => {
      const fallback = sanitizeCSATRating({ score: 10 });
      expect(fallback.score).toBe(5);
      const fallbackLow = sanitizeCSATRating({ score: -2 });
      expect(fallbackLow.score).toBe(1);
    });

    it('sanitizeTicketSummary handles invalid input fallback', () => {
      const fallback = sanitizeTicketSummary(null);
      expect(fallback.id).toBe('');
      expect(fallback.priority).toBe('P3');
      expect(fallback.status).toBe('open');
      expect(fallback.assigned_tier).toBe('Tier 1');
    });

    it('sanitizeTicketDetail handles invalid input fallback', () => {
      const fallback = sanitizeTicketDetail({});
      expect(fallback.id).toBe('');
      expect(fallback.messages).toEqual([]);
      expect(fallback.sla_trackings).toEqual([]);
      expect(fallback.csat_rating).toBeNull();
    });

    it('sanitizeSupportAnalytics handles invalid input fallback', () => {
      const fallback = sanitizeSupportAnalytics(null);
      expect(fallback.total_tickets).toBe(0);
      expect(fallback.average_first_response_time_seconds).toBe(0);
      expect(fallback.priority_breakdown).toEqual({ P1: 0, P2: 0, P3: 0 });
    });
  });

  describe('createTicket [FR-1, FR-4, FR-7]', () => {
    it('posts ticket creation payload successfully', async () => {
      const mockTicket = {
        id: '11111111-1111-1111-1111-111111111111',
        priority: 'P1',
        status: 'open',
        subject: 'System Outage',
        description: 'Critical database connection issue',
        client_id: 'client-100',
        assigned_tier: 'Tier 1',
        assigned_agent_id: null,
        created_at: '2026-03-30T10:00:00Z',
        updated_at: '2026-03-30T10:00:00Z',
        messages: [],
        sla_trackings: [
          {
            id: '22222222-2222-2222-2222-222222222222',
            ticket_id: '11111111-1111-1111-1111-111111111111',
            target_type: 'first_response',
            target_due_at: '2026-03-30T11:00:00Z',
            is_breached: false,
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockTicket,
      } as Response);

      const payload: TicketCreateRequest = {
        subject: 'System Outage',
        description: 'Critical database connection issue',
        client_id: 'client-100',
        priority: 'P1',
      };

      const result = await createTicket(payload);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/tickets'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            subject: 'System Outage',
            description: 'Critical database connection issue',
            client_id: 'client-100',
            priority: 'P1',
            assigned_tier: 'Tier 1',
            assigned_agent_id: null,
          }),
        })
      );
      expect(result.id).toBe(mockTicket.id);
      expect(result.priority).toBe('P1');
      expect(result.sla_trackings).toHaveLength(1);
    });
  });

  describe('getTickets [FR-1]', () => {
    it('fetches tickets list without parameters', async () => {
      const mockList = {
        items: [
          {
            id: 'ticket-1',
            priority: 'P2',
            status: 'open',
            subject: 'Billing Inquiry',
            description: 'Invoice discrepancy',
            client_id: 'client-100',
            assigned_tier: 'Tier 1',
            created_at: '2026-03-30T10:00:00Z',
            updated_at: '2026-03-30T10:00:00Z',
            sla_trackings: [],
          },
        ],
        total_count: 1,
        limit: 50,
        offset: 0,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockList,
      } as Response);

      const result = await getTickets();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/tickets'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.items).toHaveLength(1);
      expect(result.total_count).toBe(1);
    });

    it('builds query parameters correctly when filtering', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [], total_count: 0, limit: 10, offset: 0 }),
      } as Response);

      const params: TicketFilterParams = {
        client_id: 'client-100',
        priority: 'P1',
        status: 'open',
        search: 'outage',
        limit: 10,
        offset: 0,
      };

      await getTickets(params);

      const calledUrl = (fetch as unknown as { mock: { calls: [string[]] } }).mock.calls[0][0];
      expect(calledUrl).toContain('client_id=client-100');
      expect(calledUrl).toContain('priority=P1');
      expect(calledUrl).toContain('status=open');
      expect(calledUrl).toContain('search=outage');
      expect(calledUrl).toContain('limit=10');
      expect(calledUrl).toContain('offset=0');
    });
  });

  describe('getTicket & updateTicket & deleteTicket [FR-1]', () => {
    it('getTicket fetches details for a ticket ID', async () => {
      const mockTicket = {
        id: 'ticket-123',
        priority: 'P2',
        status: 'open',
        subject: 'Test Subject',
        description: 'Test Desc',
        client_id: 'client-1',
        assigned_tier: 'Tier 1',
        created_at: '2026-03-30T10:00:00Z',
        updated_at: '2026-03-30T10:00:00Z',
        messages: [],
        sla_trackings: [],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTicket,
      } as Response);

      const result = await getTicket('ticket-123');
      expect(result.id).toBe('ticket-123');
    });

    it('updateTicket sends PATCH payload and returns updated ticket', async () => {
      const mockUpdated = {
        id: 'ticket-123',
        priority: 'P1',
        status: 'resolved',
        subject: 'Test Subject',
        description: 'Test Desc',
        client_id: 'client-1',
        assigned_tier: 'Tier 2',
        created_at: '2026-03-30T10:00:00Z',
        updated_at: '2026-03-30T10:30:00Z',
        messages: [],
        sla_trackings: [],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpdated,
      } as Response);

      const payload: TicketUpdateRequest = {
        status: 'resolved',
        priority: 'P1',
        assigned_tier: 'Tier 2',
      };

      const result = await updateTicket('ticket-123', payload);
      expect(result.status).toBe('resolved');
      expect(result.priority).toBe('P1');
    });

    it('deleteTicket sends DELETE request', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => null,
      } as Response);

      await deleteTicket('ticket-123');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/tickets/ticket-123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('messages & attachments [FR-2, FR-3]', () => {
    it('addMessage posts message payload to ticket thread', async () => {
      const mockMsg = {
        id: 'msg-1',
        ticket_id: 'ticket-123',
        sender_id: 'agent-1',
        sender_type: 'agent',
        message_body: 'Investigating issue',
        created_at: '2026-03-30T10:15:00Z',
        attachments: [],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockMsg,
      } as Response);

      const payload: MessageCreateRequest = {
        message_body: 'Investigating issue',
        sender_type: 'agent',
      };

      const result = await addMessage('ticket-123', payload);
      expect(result.id).toBe('msg-1');
      expect(result.sender_type).toBe('agent');
    });

    it('getTicketMessages fetches thread messages', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 'msg-1',
            ticket_id: 'ticket-123',
            sender_id: 'client-1',
            sender_type: 'client',
            message_body: 'Initial issue',
            created_at: '2026-03-30T10:00:00Z',
            attachments: [],
          },
        ],
      } as Response);

      const msgs = await getTicketMessages('ticket-123');
      expect(msgs).toHaveLength(1);
    });

    it('uploadAttachment validates file before uploading', async () => {
      const invalidFile = new File([''], 'empty.exe', { type: 'application/x-msdownload' });

      await expect(uploadAttachment('ticket-123', invalidFile)).rejects.toThrow('Unsupported file type');
    });

    it('uploadAttachment sends FormData for valid file', async () => {
      const validFile = new File(['hello world'], 'log.txt', { type: 'text/plain' });

      const mockAttachment = {
        id: 'att-1',
        message_id: 'msg-1',
        filename: 'log.txt',
        file_size_bytes: 11,
        mime_type: 'text/plain',
        storage_key: 'attachments/log.txt',
        uploaded_at: '2026-03-30T10:20:00Z',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockAttachment,
      } as Response);

      const result = await uploadAttachment('ticket-123', validFile, 'msg-1');
      expect(result.id).toBe('att-1');
      expect(result.filename).toBe('log.txt');
    });

    it('getAttachmentUrl builds valid URL', () => {
      const url = getAttachmentUrl('att-1', 'ticket-123');
      expect(url).toContain('/api/v1/tickets/ticket-123/attachments/att-1');
    });

    it('downloadAttachment fetches blob payload', async () => {
      setToken('mock-bearer-token');
      const blobData = new Blob(['attachment content'], { type: 'text/plain' });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: async () => blobData,
      } as Response);

      const result = await downloadAttachment('att-1', 'ticket-123');
      expect(result).toBe(blobData);
    });
  });

  describe('CSAT ratings [FR-9]', () => {
    it('submitCSATRating submits score and feedback', async () => {
      const mockCsat = {
        id: 'csat-1',
        ticket_id: 'ticket-123',
        score: 5,
        feedback_text: 'Excellent support!',
        submitted_at: '2026-03-30T11:00:00Z',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockCsat,
      } as Response);

      const payload: CSATRatingCreateRequest = {
        score: 5,
        feedback_text: 'Excellent support!',
      };

      const result = await submitCSATRating('ticket-123', payload);
      expect(result.id).toBe('csat-1');
      expect(result.score).toBe(5);
    });

    it('getCSATRating retrieves feedback rating', async () => {
      const mockCsat = {
        id: 'csat-1',
        ticket_id: 'ticket-123',
        score: 4,
        feedback_text: 'Good job',
        submitted_at: '2026-03-30T11:00:00Z',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCsat,
      } as Response);

      const result = await getCSATRating('ticket-123');
      expect(result.score).toBe(4);
    });
  });

  describe('getSupportAnalytics [FR-8]', () => {
    it('fetches support analytics with filters', async () => {
      const mockAnalytics = {
        start_time: '2026-03-01T00:00:00Z',
        end_time: '2026-03-31T23:59:59Z',
        total_tickets: 50,
        open_tickets: 5,
        pending_tickets: 10,
        resolved_tickets: 35,
        average_first_response_time_seconds: 1800,
        mean_time_to_resolution_seconds: 14400,
        total_sla_targets: 100,
        breached_sla_targets: 5,
        sla_breach_rate_percent: 5.0,
        average_csat_score: 4.8,
        csat_response_count: 25,
        priority_breakdown: { P1: 5, P2: 15, P3: 30 },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAnalytics,
      } as Response);

      const filters: AnalyticsFilterParams = {
        start_time: '2026-03-01T00:00:00Z',
        end_time: '2026-03-31T23:59:59Z',
        priority: 'P1',
      };

      const result = await getSupportAnalytics(filters);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/support/analytics'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.total_tickets).toBe(50);
      expect(result.average_csat_score).toBe(4.8);
      expect(result.priority_breakdown.P1).toBe(5);
    });
  });

  describe('supportService object export', () => {
    it('exports all API methods and utilities', () => {
      expect(supportService.createTicket).toBe(createTicket);
      expect(supportService.getTickets).toBe(getTickets);
      expect(supportService.getTicket).toBe(getTicket);
      expect(supportService.updateTicket).toBe(updateTicket);
      expect(supportService.deleteTicket).toBe(deleteTicket);
      expect(supportService.addMessage).toBe(addMessage);
      expect(supportService.getTicketMessages).toBe(getTicketMessages);
      expect(supportService.uploadAttachment).toBe(uploadAttachment);
      expect(supportService.getAttachmentUrl).toBe(getAttachmentUrl);
      expect(supportService.downloadAttachment).toBe(downloadAttachment);
      expect(supportService.submitCSATRating).toBe(submitCSATRating);
      expect(supportService.getCSATRating).toBe(getCSATRating);
      expect(supportService.getSupportAnalytics).toBe(getSupportAnalytics);
      expect(supportService.validateFileAttachment).toBe(validateFileAttachment);
      expect(supportService.sanitizeString).toBe(sanitizeString);
    });
  });
});
