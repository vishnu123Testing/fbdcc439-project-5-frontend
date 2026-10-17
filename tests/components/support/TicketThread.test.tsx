import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  TicketThread,
  formatFileSize,
  formatTimestamp,
  getAttachmentIcon,
  getSenderMeta,
} from '../../../src/components/support/TicketThread';
import { MessageResponse, AttachmentResponse } from '../../../src/services/support';

// Mock supportService
vi.mock('../../../src/services/support', async () => {
  const actual = await vi.importActual<typeof import('../../../src/services/support')>(
    '../../../src/services/support'
  );
  return {
    ...actual,
    downloadAttachment: vi.fn().mockResolvedValue(new Blob(['test content'])),
    getAttachmentUrl: vi.fn().mockReturnValue('/api/tickets/t-123/attachments/att-1'),
    supportService: {
      ...actual.supportService,
      addMessage: vi.fn().mockResolvedValue({
        id: 'msg-new',
        ticket_id: 't-123',
        sender_id: 'u-1',
        sender_type: 'client',
        message_body: 'New reply message from mock',
        created_at: new Date().toISOString(),
        attachments: [],
      }),
      uploadAttachment: vi.fn().mockResolvedValue({
        id: 'att-uploaded',
        message_id: 'msg-new',
        filename: 'document.pdf',
        file_size_bytes: 1024,
        mime_type: 'application/pdf',
        storage_key: 'key-1',
        uploaded_at: new Date().toISOString(),
      }),
    },
  };
});

describe('TicketThread Component & Helper Functions [FR-2, FR-3, FR-7]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Helper Functions [FR-3, FR-7]', () => {
    it('formatFileSize correctly formats bytes into KB and MB strings', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(-50)).toBe('0 B');
      expect(formatFileSize(512)).toBe('512 B');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
    });

    it('formatTimestamp formats ISO strings and dates into human readable strings', () => {
      expect(formatTimestamp(null)).toBe('');
      expect(formatTimestamp(undefined)).toBe('');
      expect(formatTimestamp('invalid-date')).toBe('invalid-date');

      const formatted = formatTimestamp('2026-10-24T10:15:00.000Z');
      expect(formatted).toContain('2026');
      expect(formatted).toMatch(/Oct/i);
    });

    it('getSenderMeta returns correct labels, badges, and icons for sender types', () => {
      const clientMeta = getSenderMeta('client');
      expect(clientMeta.label).toBe('Client User');

      const agentMeta = getSenderMeta('agent');
      expect(agentMeta.label).toBe('Support Agent');

      const systemMeta = getSenderMeta('system');
      expect(systemMeta.label).toBe('System Notification');
    });

    it('getAttachmentIcon returns appropriate icon for images, PDFs, and general files', () => {
      expect(getAttachmentIcon('image/png', 'photo.png')).toBeDefined();
      expect(getAttachmentIcon('application/pdf', 'doc.pdf')).toBeDefined();
      expect(getAttachmentIcon('text/plain', 'note.txt')).toBeDefined();
    });
  });

  describe('Thread Component Rendering [FR-2, FR-7]', () => {
    const mockMessages: MessageResponse[] = [
      {
        id: 'msg-1',
        ticket_id: 't-100',
        sender_id: 'usr-client-1',
        sender_type: 'client',
        message_body: 'Hello, I need help with RBAC permissions.',
        created_at: '2026-10-20T10:00:00.000Z',
        attachments: [
          {
            id: 'att-1',
            message_id: 'msg-1',
            filename: 'screenshot.png',
            file_size_bytes: 204800,
            mime_type: 'image/png',
            storage_key: 'st-1',
            uploaded_at: '2026-10-20T10:00:00.000Z',
          },
        ],
      },
      {
        id: 'msg-2',
        ticket_id: 't-100',
        sender_id: 'agent-99',
        sender_type: 'agent',
        message_body: 'Thank you for reaching out. We are inspecting your tenant claims.',
        created_at: '2026-10-20T10:15:00.000Z',
        attachments: [],
      },
      {
        id: 'msg-3',
        ticket_id: 't-100',
        sender_id: 'system',
        sender_type: 'system',
        message_body: 'Ticket escalated to Tier 2 Support Operations.',
        created_at: '2026-10-20T10:20:00.000Z',
        attachments: [],
      },
    ];

    it('renders sequential message history with client, agent, and system badges', () => {
      render(
        <TicketThread
          ticketId="t-100"
          messages={mockMessages}
          ticketSubject="RBAC Access Inquiry"
        />
      );

      expect(screen.getByText('Conversation: RBAC Access Inquiry')).toBeInTheDocument();
      expect(screen.getByText('Hello, I need help with RBAC permissions.')).toBeInTheDocument();
      expect(
        screen.getByText('Thank you for reaching out. We are inspecting your tenant claims.')
      ).toBeInTheDocument();
      expect(screen.getByText('Ticket escalated to Tier 2 Support Operations.')).toBeInTheDocument();

      expect(screen.getByText('Client User')).toBeInTheDocument();
      expect(screen.getByText('Support Agent')).toBeInTheDocument();
    });

    it('renders opening ticket description when ticketDescription is provided', () => {
      render(
        <TicketThread
          ticketId="t-100"
          ticketDescription="Initial root ticket description provided by user."
          createdAt="2026-10-20T09:30:00.000Z"
          messages={[]}
        />
      );

      expect(
        screen.getByText('Initial root ticket description provided by user.')
      ).toBeInTheDocument();
      expect(screen.getByText('Original Description')).toBeInTheDocument();
    });

    it('renders empty state message when no messages or description exist', () => {
      render(<TicketThread ticketId="t-100" messages={[]} />);

      expect(screen.getByText('No messages in this ticket thread yet.')).toBeInTheDocument();
    });

    it('renders loading indicator when isLoading prop is true', () => {
      render(<TicketThread ticketId="t-100" isLoading={true} />);

      expect(screen.getByText('Loading conversation messages...')).toBeInTheDocument();
    });
  });

  describe('File Attachment Links & Boundary Validation [FR-3, NFR-2]', () => {
    const mockMessagesWithAttachments: MessageResponse[] = [
      {
        id: 'msg-att-1',
        ticket_id: 't-200',
        sender_id: 'usr-1',
        sender_type: 'client',
        message_body: 'Here is the requested log file.',
        created_at: new Date().toISOString(),
        attachments: [
          {
            id: 'att-pdf-1',
            message_id: 'msg-att-1',
            filename: 'audit_report.pdf',
            file_size_bytes: 1048576, // 1 MB
            mime_type: 'application/pdf',
            storage_key: 'key-pdf',
            uploaded_at: new Date().toISOString(),
          },
        ],
      },
    ];

    it('displays attachment filename and formatted size inside message card', () => {
      render(<TicketThread ticketId="t-200" messages={mockMessagesWithAttachments} />);

      expect(screen.getByText('audit_report.pdf')).toBeInTheDocument();
      expect(screen.getByText('1 MB')).toBeInTheDocument();
    });

    it('invokes custom onDownloadAttachment callback when download button is clicked', async () => {
      const mockDownload = vi.fn();
      render(
        <TicketThread
          ticketId="t-200"
          messages={mockMessagesWithAttachments}
          onDownloadAttachment={mockDownload}
        />
      );

      const downloadButton = screen.getByLabelText('Download file attachment audit_report.pdf');
      fireEvent.click(downloadButton);

      expect(mockDownload).toHaveBeenCalledWith(mockMessagesWithAttachments[0].attachments[0]);
    });

    it('validates file size limit on file attachment input (rejects files > 10 MB)', async () => {
      render(<TicketThread ticketId="t-200" messages={[]} />);

      const fileInput = screen.getByLabelText('Attach files', { exact: false }) || screen.getByTestId?.('file-input');

      // Create fake file exceeding 10 MB (11 MB)
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large_log.pdf', {
        type: 'application/pdf',
      });

      const fileInputElem = document.getElementById('ticket-file-input') as HTMLInputElement;
      expect(fileInputElem).toBeInTheDocument();

      fireEvent.change(fileInputElem, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/exceeds maximum allowable limit/i)).toBeInTheDocument();
      });
    });

    it('validates unsupported file extension on attachment input', async () => {
      render(<TicketThread ticketId="t-200" messages={[]} />);

      const fileInputElem = document.getElementById('ticket-file-input') as HTMLInputElement;

      const invalidFile = new File(['exe binary content'], 'executable.exe', {
        type: 'application/x-msdownload',
      });

      fireEvent.change(fileInputElem, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
      });
    });

    it('accepts valid file attachments (.pdf, .png, .jpg) and lists them in pending attachments', async () => {
      render(<TicketThread ticketId="t-200" messages={[]} />);

      const fileInputElem = document.getElementById('ticket-file-input') as HTMLInputElement;

      const validPdf = new File(['pdf content'], 'valid_doc.pdf', {
        type: 'application/pdf',
      });

      fireEvent.change(fileInputElem, { target: { files: [validPdf] } });

      await waitFor(() => {
        expect(screen.getByText('valid_doc.pdf')).toBeInTheDocument();
        expect(screen.getByText(/Attached files/)).toBeInTheDocument();
      });
    });
  });

  describe('Reply Form Submission & Read-Only Modes [FR-2]', () => {
    it('submits reply message using onSendMessage callback and resets form', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);

      render(
        <TicketThread
          ticketId="t-300"
          messages={[]}
          onSendMessage={mockSendMessage}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type your response/i);
      fireEvent.change(textarea, { target: { value: 'This is my reply message.' } });

      const submitButton = screen.getByText('Send Reply');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('This is my reply message.', []);
        expect(textarea).toHaveValue('');
      });
    });

    it('disables replies and shows notification banner when ticket status is resolved or closed', () => {
      render(<TicketThread ticketId="t-400" status="resolved" messages={[]} />);

      expect(
        screen.getByText('This ticket is currently marked as resolved or closed.')
      ).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/Type your response/i)).not.toBeInTheDocument();
    });

    it('disables replies when isReadOnly prop is true', () => {
      render(<TicketThread ticketId="t-500" isReadOnly={true} messages={[]} />);

      expect(
        screen.getByText('This ticket is currently marked as resolved or closed.')
      ).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/Type your response/i)).not.toBeInTheDocument();
    });
  });
});