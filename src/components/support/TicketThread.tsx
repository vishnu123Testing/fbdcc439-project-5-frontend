'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  User,
  Headphones,
  Bot,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Send,
  X,
  AlertCircle,
  Loader2,
  Download,
  CheckCircle2,
  Clock,
  MessageSquare,
} from 'lucide-react';
import {
  TicketMessage,
  MessageResponse,
  AttachmentResponse,
  SenderType,
  TicketStatus,
  validateFileAttachment,
  getAttachmentUrl,
  downloadAttachment,
  supportService,
} from '../../services/support';

/**
 * Properties for the TicketThread component [FR-2, FR-3, FR-7].
 */
export interface TicketThreadProps {
  /**
   * Unique support ticket UUID [FR-1, FR-2].
   */
  ticketId?: string;
  /**
   * Sequential array of message records in thread history [FR-2].
   */
  messages?: (TicketMessage | MessageResponse)[];
  /**
   * Root ticket description, shown as initial opening post if present.
   */
  ticketDescription?: string;
  /**
   * Ticket subject/title header context.
   */
  ticketSubject?: string;
  /**
   * Ticket creation timestamp string [FR-7].
   */
  createdAt?: string;
  /**
   * Overall ticket status ('open' | 'pending' | 'resolved' | 'closed') [FR-1].
   */
  status?: TicketStatus | string;
  /**
   * Current authenticated user identity UUID.
   */
  currentUserId?: string;
  /**
   * Current user sender classification ('client' | 'agent' | 'system').
   */
  currentUserType?: SenderType | string;
  /**
   * Callback fired when user submits a new reply message in thread [FR-2].
   */
  onSendMessage?: (body: string, files?: File[]) => Promise<void>;
  /**
   * Custom handler for attachment downloads [FR-3].
   */
  onDownloadAttachment?: (attachment: AttachmentResponse) => Promise<void> | void;
  /**
   * Whether ticket messages are currently loading.
   */
  isLoading?: boolean;
  /**
   * Whether ticket is closed/resolved or in read-only mode.
   */
  isReadOnly?: boolean;
  /**
   * Additional custom CSS classes.
   */
  className?: string;
}

/**
 * Format bytes into human-readable file size string (e.g., 1.2 MB, 340 KB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format ISO timestamp into localized human-friendly date string [FR-7].
 */
export function formatTimestamp(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Select icon component based on file MIME type or filename extension.
 */
export function getAttachmentIcon(mimeType?: string, filename?: string): React.ElementType {
  const mime = (mimeType || '').toLowerCase();
  const name = (filename || '').toLowerCase();

  if (mime.includes('image') || /\.(png|jpg|jpeg|gif|webp)$/.test(name)) {
    return ImageIcon;
  }
  if (mime.includes('pdf') || name.endsWith('.pdf')) {
    return FileText;
  }
  return Paperclip;
}

/**
 * Metadata and styling for sender types ('client' | 'agent' | 'system').
 */
export function getSenderMeta(senderType?: string): {
  label: string;
  badgeColor: string;
  cardColor: string;
  icon: React.ElementType;
} {
  const type = (senderType || 'client').toLowerCase();
  switch (type) {
    case 'agent':
      return {
        label: 'Support Agent',
        badgeColor:
          'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
        cardColor:
          'bg-amber-50/70 border-amber-200/90 dark:bg-amber-950/30 dark:border-amber-900/50',
        icon: Headphones,
      };
    case 'system':
      return {
        label: 'System Notification',
        badgeColor:
          'bg-stone-200 text-stone-800 border-stone-300 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
        cardColor:
          'bg-stone-100/80 border-stone-300 text-center dark:bg-stone-900/60 dark:border-stone-800',
        icon: Bot,
      };
    case 'client':
    default:
      return {
        label: 'Client User',
        badgeColor:
          'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
        cardColor:
          'bg-stone-50 border-stone-200/90 dark:bg-stone-900/40 dark:border-stone-800',
        icon: User,
      };
  }
}

/**
 * Sequential ticket message thread component with file attachment links [FR-2, FR-3, FR-7].
 *
 * Renders chronological message history with sender badges, timestamping, file attachment downloads,
 * client-side boundary validation, and a reply form.
 */
export function TicketThread({
  ticketId,
  messages = [],
  ticketDescription,
  ticketSubject,
  createdAt,
  status = 'open',
  currentUserId,
  currentUserType = 'client',
  onSendMessage,
  onDownloadAttachment,
  isLoading = false,
  isReadOnly: isReadOnlyProp = false,
  className = '',
}: TicketThreadProps): React.JSX.Element {
  const [replyText, setReplyText] = useState<string>('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isResolvedOrClosed = useMemo(() => {
    const s = (status || '').toLowerCase();
    return isReadOnlyProp || s === 'resolved' || s === 'closed';
  }, [status, isReadOnlyProp]);

  // Chronologically sorted messages
  const sortedMessages = useMemo(() => {
    const list = [...messages];
    return list.sort((a, b) => {
      const tA = new Date(a.created_at || 0).getTime();
      const tB = new Date(b.created_at || 0).getTime();
      return tA - tB;
    });
  }, [messages]);

  // Handle file selection with boundary validation [FR-3, NFR-2]
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFileError(null);
      if (!e.target.files || e.target.files.length === 0) return;

      const selectedFiles = Array.from(e.target.files);
      const validFiles: File[] = [];

      for (const file of selectedFiles) {
        const valRes = validateFileAttachment(file);
        if (!valRes.is_valid) {
          setFileError(valRes.error_message || `File '${file.name}' is invalid.`);
          // Clear input element
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
        validFiles.push(file);
      }

      setPendingFiles((prev) => [...prev, ...validFiles]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    []
  );

  const handleRemovePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  }, []);

  // Handle attachment download action
  const handleDownloadAttachment = useCallback(
    async (att: AttachmentResponse) => {
      if (onDownloadAttachment) {
        await onDownloadAttachment(att);
        return;
      }

      setDownloadingId(att.id);
      try {
        const blob = await downloadAttachment(att.id, ticketId || att.message_id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = att.filename || 'attachment';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // Fallback to direct URL opening
        const directUrl = getAttachmentUrl(att.id, ticketId);
        window.open(directUrl, '_blank');
      } finally {
        setDownloadingId(null);
      }
    },
    [onDownloadAttachment, ticketId]
  );

  // Submit reply message [FR-2]
  const handleSubmitReply = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      const trimmedBody = replyText.trim();
      if (!trimmedBody && pendingFiles.length === 0) {
        setSubmitError('Please enter a message or attach a file before sending.');
        return;
      }

      setIsSubmitting(true);
      try {
        if (onSendMessage) {
          await onSendMessage(trimmedBody, pendingFiles);
        } else if (ticketId) {
          const msg = await supportService.addMessage(ticketId, {
            message_body: trimmedBody,
            sender_id: currentUserId,
            sender_type: currentUserType,
          });

          // Upload pending files if present
          for (const file of pendingFiles) {
            await supportService.uploadAttachment(ticketId, file, msg.id);
          }
        }

        setReplyText('');
        setPendingFiles([]);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to post message reply. Please try again.';
        setSubmitError(msg);
      } finally {
        setIsSubmitting(false);
      }
    },
    [replyText, pendingFiles, onSendMessage, ticketId, currentUserId, currentUserType]
  );

  return (
    <section
      aria-label="Ticket message thread"
      className={twMerge('flex flex-col gap-6 w-full', className)}
    >
      {/* Header Summary */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-stone-600 dark:text-stone-400" aria-hidden="true" />
          <h2 className="text-lg font-serif font-medium tracking-tight text-stone-900 dark:text-stone-100">
            {ticketSubject ? `Conversation: ${ticketSubject}` : 'Ticket Thread History'}
          </h2>
        </div>
        <span className="text-xs font-mono font-medium text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-full border border-stone-200 dark:border-stone-700">
          {sortedMessages.length + (ticketDescription ? 1 : 0)}{' '}
          {sortedMessages.length + (ticketDescription ? 1 : 0) === 1 ? 'Message' : 'Messages'}
        </span>
      </div>

      {/* Loading state indicator */}
      {isLoading && (
        <div className="flex items-center justify-center p-8 text-stone-500" role="status">
          <Loader2 className="w-6 h-6 animate-spin mr-2" aria-hidden="true" />
          <span className="text-sm font-medium">Loading conversation messages...</span>
        </div>
      )}

      {/* Sequential Message Stream [FR-2] */}
      {!isLoading && (
        <ol
          role="log"
          aria-live="polite"
          aria-label="Sequential message history"
          className="flex flex-col gap-4 list-none m-0 p-0"
        >
          {/* Initial Ticket Description as Opening Message if provided */}
          {ticketDescription && (
            <li key="ticket-root-description" className="w-full">
              <div className="p-4 rounded-xl border shadow-2xs transition-all bg-stone-50 border-stone-200/90 dark:bg-stone-900/40 dark:border-stone-800">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-stone-200/60 dark:border-stone-800/60">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                      <User className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <div>
                      <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                        Client User
                      </span>
                      <span className="ml-2 text-xs font-mono px-2 py-0.5 rounded bg-stone-200/70 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                        Original Description
                      </span>
                    </div>
                  </div>
                  {createdAt && (
                    <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400 font-mono">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      <time dateTime={new Date(createdAt).toISOString()}>
                        {formatTimestamp(createdAt)}
                      </time>
                    </div>
                  )}
                </div>

                <div className="text-sm text-stone-800 dark:text-stone-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {ticketDescription}
                </div>
              </div>
            </li>
          )}

          {/* Empty state if no messages exist */}
          {!ticketDescription && sortedMessages.length === 0 && (
            <li className="text-center p-8 rounded-xl border border-dashed border-stone-300 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/20">
              <MessageSquare className="w-8 h-8 text-stone-400 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm font-medium text-stone-600 dark:text-stone-400">
                No messages in this ticket thread yet.
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Use the reply form below to post the first message.
              </p>
            </li>
          )}

          {/* Messages list */}
          {sortedMessages.map((msg) => {
            const senderType = (msg.sender_type || 'client').toLowerCase();
            const meta = getSenderMeta(senderType);
            const IconComponent = meta.icon;
            const isSystem = senderType === 'system';

            if (isSystem) {
              return (
                <li key={msg.id || `msg-${msg.created_at}`} className="w-full my-1">
                  <div className="flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-mono bg-stone-100/90 border-stone-300/80 text-stone-700 dark:bg-stone-900/70 dark:border-stone-800 dark:text-stone-300">
                    <Bot className="w-4 h-4 flex-shrink-0 text-stone-500" aria-hidden="true" />
                    <span className="font-semibold">{msg.message_body}</span>
                    <span className="text-stone-400 dark:text-stone-500">
                      • {formatTimestamp(msg.created_at)}
                    </span>
                  </div>
                </li>
              );
            }

            return (
              <li key={msg.id || `msg-${msg.created_at}`} className="w-full">
                <article
                  aria-label={`Message from ${meta.label} at ${formatTimestamp(msg.created_at)}`}
                  className={twMerge('p-4 rounded-xl border shadow-2xs transition-all', meta.cardColor)}
                >
                  {/* Message Meta Info */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-stone-200/60 dark:border-stone-800/60">
                    <div className="flex items-center gap-2">
                      <span className={clsx('p-1.5 rounded-lg border', meta.badgeColor)}>
                        <IconComponent className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <div>
                        <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                          {meta.label}
                        </span>
                        {msg.sender_id && (
                          <span className="ml-2 text-xs font-mono text-stone-500 dark:text-stone-400">
                            ({msg.sender_id.slice(0, 8)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400 font-mono">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      <time dateTime={msg.created_at ? new Date(msg.created_at).toISOString() : undefined}>
                        {formatTimestamp(msg.created_at)}
                      </time>
                    </div>
                  </div>

                  {/* Message Body */}
                  <div className="text-sm text-stone-800 dark:text-stone-200 leading-relaxed whitespace-pre-wrap font-sans mb-3">
                    {msg.message_body}
                  </div>

                  {/* File Attachments List [FR-2, FR-3] */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-stone-200/80 dark:border-stone-800/80">
                      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2 flex items-center gap-1">
                        <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
                        Attachments ({msg.attachments.length})
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {msg.attachments.map((att) => {
                          const AttIcon = getAttachmentIcon(att.mime_type, att.filename);
                          const isDownloading = downloadingId === att.id;

                          return (
                            <div
                              key={att.id || att.filename}
                              className="flex items-center gap-2 p-2 px-3 rounded-lg border border-stone-300/80 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs shadow-2xs hover:border-stone-400 transition-colors"
                            >
                              <AttIcon className="w-4 h-4 text-stone-600 dark:text-stone-400 flex-shrink-0" aria-hidden="true" />
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium text-stone-800 dark:text-stone-200 truncate max-w-[180px]">
                                  {att.filename}
                                </span>
                                <span className="text-[10px] text-stone-500 font-mono">
                                  {formatFileSize(att.file_size_bytes)}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDownloadAttachment(att)}
                                disabled={isDownloading}
                                aria-label={`Download file attachment ${att.filename}`}
                                className="ml-1 p-1 text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors"
                              >
                                {isDownloading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-600" aria-hidden="true" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}

      {/* Reply Message Composer Form [FR-2, FR-3] */}
      <div className="mt-2 pt-4 border-t border-stone-200 dark:border-stone-800">
        {isResolvedOrClosed ? (
          <div className="p-4 rounded-xl border border-stone-300 dark:border-stone-800 bg-stone-100/70 dark:bg-stone-900/50 text-center text-sm text-stone-600 dark:text-stone-400">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" aria-hidden="true" />
            <p className="font-medium">This ticket is currently marked as resolved or closed.</p>
            <p className="text-xs text-stone-500 mt-0.5">
              New replies are disabled. Re-open the ticket if further support is required.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitReply} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="ticket-reply-body"
                className="text-sm font-semibold text-stone-800 dark:text-stone-200 tracking-tight"
              >
                Post a Reply
              </label>
              <span className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                Supports attachments up to 10 MB (.pdf, .docx, .png, .jpg)
              </span>
            </div>

            <textarea
              id="ticket-reply-body"
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your response or additional details here..."
              disabled={isSubmitting}
              className="w-full p-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-600 outline-none transition-all placeholder:text-stone-400"
            />

            {/* Error alerts */}
            {fileError && (
              <div
                role="alert"
                className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-medium"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span>{fileError}</span>
              </div>
            )}

            {submitError && (
              <div
                role="alert"
                className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-medium"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Pending Attached Files list */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/30">
                <p className="w-full text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
                  Attached files ({pendingFiles.length}):
                </p>
                {pendingFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center gap-2 p-1.5 px-2.5 rounded bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-stone-500" aria-hidden="true" />
                    <span className="truncate max-w-[160px] font-medium">{file.name}</span>
                    <span className="text-[10px] text-stone-500 font-mono">
                      ({formatFileSize(file.size)})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePendingFile(idx)}
                      aria-label={`Remove pending file ${file.name}`}
                      className="p-0.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between mt-1">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="ticket-file-input"
                  multiple
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
                >
                  <Paperclip className="w-4 h-4 text-stone-500" aria-hidden="true" />
                  <span>Attach File</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || (!replyText.trim() && pendingFiles.length === 0)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200 transition-colors disabled:opacity-50 shadow-2xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Posting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" aria-hidden="true" />
                    <span>Send Reply</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

export default TicketThread;