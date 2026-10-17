import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AttachmentUploader, formatFileSize } from '../../../src/components/support/AttachmentUploader';
import { AttachmentResponse } from '../../../src/services/support';

describe('formatFileSize helper', () => {
  it('formats zero and negative bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(-100)).toBe('0 B');
  });

  it('formats bytes into KB and MB', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1048576)).toBe('1 MB');
    expect(formatFileSize(10485760)).toBe('10 MB');
  });
});

describe('AttachmentUploader Component', () => {
  const mockOnFilesSelected = vi.fn();
  const mockOnUpload = vi.fn();
  const mockOnRemoveExisting = vi.fn();
  const mockOnDownloadExisting = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL and revokeObjectURL
    if (!global.URL.createObjectURL) {
      global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/fake-image');
    }
    if (!global.URL.revokeObjectURL) {
      global.URL.revokeObjectURL = vi.fn();
    }
  });

  it('renders dropzone with help text and file constraints', () => {
    render(<AttachmentUploader />);

    expect(screen.getByTestId('attachment-dropzone')).toBeInDocument();
    expect(screen.getByText(/Click to browse/i)).toBeInDocument();
    expect(screen.getByText(/drag & drop files here/i)).toBeInDocument();
    expect(screen.getByText(/\.pdf, \.docx, \.doc, \.txt, \.png, \.jpg, \.jpeg/i)).toBeInDocument();
    expect(screen.getByText(/Max 10 MB per file, up to 5 files/i)).toBeInDocument();
  });

  it('handles valid file selection via file input', async () => {
    render(<AttachmentUploader onFilesSelected={mockOnFilesSelected} />);

    const fileInput = screen.getByTestId('attachment-file-input');
    const validPdf = new File(['dummy content'], 'document.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [validPdf] } });

    await waitFor(() => {
      expect(mockOnFilesSelected).toHaveBeenCalledWith([validPdf]);
    });

    expect(screen.getByTestId('staged-files-container')).toBeInDocument();
    expect(screen.getByText('document.pdf')).toBeInDocument();
    expect(screen.getByText('Ready')).toBeInDocument();
  });

  it('rejects files exceeding maximum file size limit', async () => {
    const smallLimitBytes = 100; // 100 bytes limit
    render(
      <AttachmentUploader
        maxSizeBytes={smallLimitBytes}
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    // File size 500 bytes exceeds 100 bytes limit
    const oversizedFile = new File(['a'.repeat(500)], 'large_document.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    await waitFor(() => {
      const errorBanner = screen.getByTestId('attachment-error-banner');
      expect(errorBanner).toBeInDocument();
      expect(errorBanner).toHaveTextContent(/exceeds maximum size limit/i);
    });

    expect(mockOnFilesSelected).not.toHaveBeenCalled();
    expect(screen.queryByTestId('staged-files-container')).not.toBeInDocument();
  });

  it('rejects files with unsupported extension or MIME type', async () => {
    render(
      <AttachmentUploader
        allowedExtensions={['.pdf']}
        allowedMimeTypes={['application/pdf']}
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const invalidExe = new File(['binary content'], 'script.exe', {
      type: 'application/x-msdownload',
    });

    fireEvent.change(fileInput, { target: { files: [invalidExe] } });

    await waitFor(() => {
      const errorBanner = screen.getByTestId('attachment-error-banner');
      expect(errorBanner).toBeInDocument();
      expect(errorBanner).toHaveTextContent(/unsupported type/i);
    });

    expect(mockOnFilesSelected).not.toHaveBeenCalled();
  });

  it('enforces maximum file count limit', async () => {
    render(<AttachmentUploader maxFiles={1} onFilesSelected={mockOnFilesSelected} />);

    const fileInput = screen.getByTestId('attachment-file-input');
    const file1 = new File(['content1'], 'file1.pdf', { type: 'application/pdf' });
    const file2 = new File(['content2'], 'file2.pdf', { type: 'application/pdf' });

    // Try adding two files when maxFiles = 1
    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getByTestId('attachment-error-banner')).toHaveTextContent(
        /Limit of 1 files reached/i
      );
    });

    // Only file1 should be staged
    expect(mockOnFilesSelected).toHaveBeenCalledWith([file1]);
    expect(screen.getByText('file1.pdf')).toBeInDocument();
    expect(screen.queryByText('file2.pdf')).not.toBeInDocument();
  });

  it('handles dragover, dragleave, and drop events', async () => {
    render(<AttachmentUploader onFilesSelected={mockOnFilesSelected} />);

    const dropzone = screen.getByTestId('attachment-dropzone');

    // Dragover
    fireEvent.dragOver(dropzone);
    expect(dropzone).toHaveClass('border-[#735C41]');

    // Dragleave
    fireEvent.dragLeave(dropzone);
    expect(dropzone).not.toHaveClass('border-[#735C41]');

    // Drop
    const droppedFile = new File(['image bytes'], 'photo.png', { type: 'image/png' });
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [droppedFile],
      },
    });

    await waitFor(() => {
      expect(mockOnFilesSelected).toHaveBeenCalledWith([droppedFile]);
    });
    expect(screen.getByText('photo.png')).toBeInDocument();
  });

  it('allows removing a staged file from the pending list', async () => {
    render(<AttachmentUploader onFilesSelected={mockOnFilesSelected} />);

    const fileInput = screen.getByTestId('attachment-file-input');
    const pdf = new File(['doc'], 'sample.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [pdf] } });

    await waitFor(() => {
      expect(screen.getByText('sample.pdf')).toBeInDocument();
    });

    const removeBtn = screen.getByLabelText(/Remove file sample.pdf/i);
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText('sample.pdf')).not.toBeInDocument();
    });

    expect(mockOnFilesSelected).toHaveBeenLastCalledWith([]);
  });

  it('executes manual upload submit when onUpload is provided', async () => {
    mockOnUpload.mockResolvedValueOnce(undefined);

    render(
      <AttachmentUploader
        onUpload={mockOnUpload}
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const doc = new File(['data'], 'report.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    fireEvent.change(fileInput, { target: { files: [doc] } });

    await waitFor(() => {
      expect(screen.getByTestId('upload-submit-btn')).toBeInDocument();
    });

    const submitBtn = screen.getByTestId('upload-submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith([doc]);
    });

    expect(screen.getByTestId('attachment-success-banner')).toHaveTextContent(
      /Files uploaded successfully/i
    );
    expect(screen.queryByTestId('staged-files-container')).not.toBeInDocument();
  });

  it('triggers autoUpload immediately when autoUpload is true', async () => {
    mockOnUpload.mockResolvedValueOnce(undefined);

    render(
      <AttachmentUploader
        autoUpload={true}
        onUpload={mockOnUpload}
        onFilesSelected={mockOnFilesSelected}
      />
    );

    const fileInput = screen.getByTestId('attachment-file-input');
    const txt = new File(['hello'], 'notes.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [txt] } });

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith([txt]);
    });

    expect(screen.getByTestId('attachment-success-banner')).toBeInDocument();
  });

  it('displays existing server attachments and handles download/delete actions', async () => {
    const existing: AttachmentResponse[] = [
      {
        id: 'att-101',
        message_id: 'msg-01',
        filename: 'server_contract.pdf',
        file_size_bytes: 2048576,
        mime_type: 'application/pdf',
        storage_key: 'tickets/att-101.pdf',
        uploaded_at: '2026-10-06T10:00:00Z',
      },
    ];

    render(
      <AttachmentUploader
        existingAttachments={existing}
        onDownloadExistingAttachment={mockOnDownloadExisting}
        onRemoveExistingAttachment={mockOnRemoveExisting}
      />
    );

    expect(screen.getByTestId('existing-attachments-container')).toBeInDocument();
    expect(screen.getByText('server_contract.pdf')).toBeInDocument();
    expect(screen.getByText('2 MB')).toBeInDocument();

    // Click download
    const downloadBtn = screen.getByTestId('download-existing-att-att-101');
    fireEvent.click(downloadBtn);
    expect(mockOnDownloadExisting).toHaveBeenCalledWith(existing[0]);

    // Click delete
    mockOnRemoveExisting.mockResolvedValueOnce(undefined);
    const deleteBtn = screen.getByTestId('delete-existing-att-att-101');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockOnRemoveExisting).toHaveBeenCalledWith('att-101');
    });
  });

  it('respects disabled prop and prevents file input interaction', () => {
    render(<AttachmentUploader disabled={true} />);

    const dropzone = screen.getByTestId('attachment-dropzone');
    expect(dropzone).toHaveAttribute('aria-disabled', 'true');
    expect(dropzone).toHaveClass('opacity-60');

    const fileInput = screen.getByTestId('attachment-file-input');
    expect(fileInput).toBeDisabled();
  });
});
