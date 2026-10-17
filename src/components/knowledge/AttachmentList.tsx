'use client';

import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FileText, Download, Paperclip, ExternalLink } from 'lucide-react';
import { Attachment } from '../../services/knowledge';

/**
 * Format raw file size in bytes to human readable format (KB, MB, GB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const formatted = (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1);
  return `${formatted} ${sizes[i]}`;
}

/**
 * Properties for the AttachmentList component [FR-6].
 */
export interface AttachmentListProps {
  /**
   * List of document attachments [FR-6].
   */
  attachments?: Attachment[];
  /**
   * Heading title for the attachment section [FR-6].
   */
  title?: string;
  /**
   * Render dense compact list without card wrapping [FR-6].
   */
  compact?: boolean;
  /**
   * Additional CSS class names.
   */
  className?: string;
}

/**
 * Reusable Attachment & Technical Documentation List Component [FR-6].
 *
 * Displays downloadable technical documents, user guides, and reference files
 * linked directly to onboarding modules and playbooks.
 */
export const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments = [],
  title = 'Technical Documentation & Attachments',
  compact = false,
  className,
}) => {
  if (attachments.length === 0) {
    return (
      <div
        data-testid="attachment-list-empty"
        className={twMerge(
          'p-4 bg-[#fbf9f4] border border-[#d1c4b9] rounded-md text-xs text-[#80756b] flex items-center gap-2',
          className
        )}
      >
        <Paperclip className="h-4 w-4 text-[#80756b]" />
        <span>No technical documentation attached to this resource.</span>
      </div>
    );
  }

  return (
    <div
      data-testid="attachment-list"
      className={twMerge(
        compact
          ? 'space-y-2 text-[#1b1c19]'
          : 'bg-[#fbf9f4] border border-[#d1c4b9] rounded-md p-5 space-y-4 shadow-sm text-[#1b1c19]',
        className
      )}
    >
      {title && (
        <h4 className="text-sm font-semibold text-[#1b1c19] flex items-center gap-2 border-b border-[#d1c4b9] pb-2">
          <Paperclip className="h-4 w-4 text-[#735c41]" />
          <span>{title}</span>
          <span className="text-xs font-normal text-[#80756b]">({attachments.length})</span>
        </h4>
      )}

      <ul className="space-y-2" role="list">
        {attachments.map((file) => (
          <li
            key={file.id}
            data-testid={`attachment-item-${file.id}`}
            className="flex items-center justify-between p-3 bg-[#ffffff] border border-[#d1c4b9] rounded-md hover:bg-[#f5f3ee] transition-colors gap-3"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 bg-[#f0eee9] rounded text-[#735c41] shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs font-medium text-[#1b1c19] truncate"
                  title={file.file_name}
                  data-testid={`file-name-${file.id}`}
                >
                  {file.file_name}
                </p>
                <p className="text-[11px] text-[#80756b]">
                  {formatFileSize(file.file_size_bytes)}
                </p>
              </div>
            </div>

            <a
              href={file.file_url}
              download={file.file_name}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`download-attachment-${file.id}`}
              aria-label={`Download ${file.file_name}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#735c41] border border-[#d1c4b9] rounded text-xs font-medium transition-colors shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AttachmentList;
