import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  AttachmentList,
  AttachmentListProps,
  formatFileSize,
} from '../../../src/components/knowledge/AttachmentList';
import { Attachment } from '../../../src/services/knowledge';

describe('AttachmentList Component', () => {
  const mockAttachments: Attachment[] = [
    {
      id: 'att-1',
      article_id: 'art-1',
      file_name: 'API_Documentation.pdf',
      file_url: 'https://cdn.example.com/docs/API_Documentation.pdf',
      file_size_bytes: 2097152, // 2 MB
      created_at: '2026-01-01',
    },
    {
      id: 'att-2',
      article_id: 'art-1',
      file_name: 'Setup_Script.sh',
      file_url: 'https://cdn.example.com/docs/Setup_Script.sh',
      file_size_bytes: 5120, // 5 KB
      created_at: '2026-01-01',
    },
  ];

  it('formats raw file size bytes correctly into KB and MB strings', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1572864)).toBe('1.5 MB');
    expect(formatFileSize(1073741824)).toBe('1 GB');
  });

  it('renders list of technical documentation attachments with file names, formatted sizes, and download links', () => {
    render(<AttachmentList attachments={mockAttachments} />);

    expect(screen.getByTestId('attachment-list')).toBeInDocument();
    expect(screen.getByTestId('attachment-item-att-1')).toBeInDocument();
    expect(screen.getByTestId('file-name-att-1')).toHaveTextContent('API_Documentation.pdf');
    expect(screen.getByTestId('download-attachment-att-1')).toHaveAttribute(
      'href',
      'https://cdn.example.com/docs/API_Documentation.pdf'
    );

    expect(screen.getByTestId('attachment-item-att-2')).toBeInDocument();
    expect(screen.getByTestId('file-name-att-2')).toHaveTextContent('Setup_Script.sh');
  });

  it('renders empty notice when attachments list is empty', () => {
    render(<AttachmentList attachments={[]} />);

    expect(screen.getByTestId('attachment-list-empty')).toHaveTextContent(
      'No technical documentation attached to this resource.'
    );
  });
});
