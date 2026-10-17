'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Paperclip,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  Download,
  File as FileIcon,
} from 'lucide-react';
import {
  Attachment,
  AttachmentResponse,
  MAX_ATTACHMENT_SIZE_BYTES,
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ALLOWED_ATTACHMENT_MIME_TYPES,
  validateFileAttachment,
} from '../../services/support';

/**
 * Helper function to format raw file size in bytes into human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Staged file record wrapper containing optional preview data URL.
 */
export interface StagedFile {
  id: string;
  file: File;
  previewUrl?: string;
  error?: string;
}

/**
 * Properties for the AttachmentUploader component [FR-3, NFR-2].
 */
export interface AttachmentUploaderProps {
  /**
   * Callback fired when staged valid files list changes [FR-3].
   */
  onFilesSelected?: (files: File[]) => void;
  /**
   * Optional upload handler invoked automatically or on upload button click [FR-3].
   */
  onUpload?: (files: File[]) => Promise<void> | void;
  /**
   * Maximum allowed files count limit (default: 5).
   */
  maxFiles?: number;
  /**
   * Maximum file size limit in bytes (default: 10MB / MAX_ATTACHMENT_SIZE_BYTES).
   */
  maxSizeBytes?: number;
  /**
   * Array of allowed file extension strings (e.g. ['.pdf', '.jpg']).
   */
  allowedExtensions?: string[];
  /**
   * Array of allowed MIME type strings (e.g. ['application/pdf']).
   */
  allowedMimeTypes?: string[];
  /**
   * Whether interactions are disabled.
   */
  disabled?: boolean;
  /**
   * Whether to automatically invoke onUpload immediately when files are dropped or selected.
   */
  autoUpload?: boolean;
  /**
   * List of existing server-persisted attachments [FR-2].
   */
  existingAttachments?: (Attachment | AttachmentResponse)[];
  /**
   * Callback fired when user removes an existing server attachment.
   */
  onRemoveExistingAttachment?: (attachmentId: string) => Promise<void> | void;
  /**
   * Callback fired when user clicks to download an existing attachment.
   */
  onDownloadExistingAttachment?: (attachment: Attachment | AttachmentResponse) => void;
  /**
   * Additional custom CSS classes.
   */
  className?: string;
  /**
   * Render in compact mode suitable for inline forms or reply textareas.
   */
  compact?: boolean;
  /**
   * Whether to generate and display image previews for image files (default: true).
   */
  showPreview?: boolean;
}

/**
 * AttachmentUploader Component [FR-3, NFR-2]
 *
 * Provides drag-and-drop file upload capabilities with client-side boundary
 * type and file size validation, preview generation, and accessibility support.
 */
export const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  onFilesSelected,
  onUpload,
  maxFiles = 5,
  maxSizeBytes = MAX_ATTACHMENT_SIZE_BYTES,
  allowedExtensions = ALLOWED_ATTACHMENT_EXTENSIONS,
  allowedMimeTypes = ALLOWED_ATTACHMENT_MIME_TYPES,
  disabled = false,
  autoUpload = false,
  existingAttachments = [],
  onRemoveExistingAttachment,
  onDownloadExistingAttachment,
  className,
  compact = false,
  showPreview = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [deletingAttachmentIds, setDeletingAttachmentIds] = useState<string[]>([]);

  // Format accept string for native file picker dialog
  const acceptAttribute = useMemo(() => {
    return allowedExtensions.join(',');
  }, [allowedExtensions]);

  // Human readable limit text
  const maxMbText = useMemo(() => {
    return `${(maxSizeBytes / (1024 * 1024)).toFixed(0)} MB`;
  }, [maxSizeBytes]);

  /**
   * Validate individual file against limits and constraints [FR-3, NFR-2].
   */
  const validateSingleFile = useCallback(
    (file: File): { isValid: boolean; error?: string } => {
      if (!file) {
        return { isValid: false, error: 'Invalid file provided.' };
      }

      if (file.size <= 0) {
        return { isValid: false, error: `File "${file.name}" is empty.` };
      }

      if (file.size > maxSizeBytes) {
        return {
          isValid: false,
          error: `File "${file.name}" exceeds maximum size limit of ${maxMbText}.`,
        };
      }

      const filename = file.name || '';
      const extMatch = filename.match(/\.[0-9a-z]+$/i);
      const ext = extMatch ? extMatch[0].toLowerCase() : '';

      const isExtAllowed = allowedExtensions.some(
        (allowed) => allowed.toLowerCase() === ext
      );
      const isMimeAllowed = file.type
        ? allowedMimeTypes.some(
            (allowed) => allowed.toLowerCase() === file.type.toLowerCase()
          )
        : false;

      if (!isExtAllowed && !isMimeAllowed) {
        return {
          isValid: false,
          error: `File "${file.name}" has unsupported type (${ext || file.type || 'unknown'}). Allowed formats: ${allowedExtensions.join(', ')}`,
        };
      }

      // Also call support service validator if defaults match
      if (
        maxSizeBytes === MAX_ATTACHMENT_SIZE_BYTES &&
        allowedExtensions === ALLOWED_ATTACHMENT_EXTENSIONS
      ) {
        const serviceVal = validateFileAttachment(file);
        if (!serviceVal.is_valid) {
          return { isValid: false, error: serviceVal.error_message };
        }
      }

      return { isValid: true };
    },
    [maxSizeBytes, maxMbText, allowedExtensions, allowedMimeTypes]
  );

  /**
   * Process raw files list from input or drop event.
   */
  const processIncomingFiles = useCallback(
    async (incomingFiles: File[]) => {
      if (disabled || incomingFiles.length === 0) return;

      setValidationErrors([]);
      setUploadSuccessMessage(null);

      const newErrors: string[] = [];
      const validNewStagedFiles: StagedFile[] = [];

      const currentTotalCount = stagedFiles.length + existingAttachments.length;
      if (currentTotalCount >= maxFiles) {
        setValidationErrors([`Maximum attachment limit of ${maxFiles} files reached.`]);
        return;
      }

      for (const file of incomingFiles) {
        if (stagedFiles.length + validNewStagedFiles.length + existingAttachments.length >= maxFiles) {
          newErrors.push(`Limit of ${maxFiles} files reached; some files were ignored.`);
          break;
        }

        // Check for duplicate in currently staged files
        const isDuplicate = stagedFiles.some(
          (s) => s.file.name === file.name && s.file.size === file.size
        );
        if (isDuplicate) {
          newErrors.push(`File "${file.name}" is already attached.`);
          continue;
        }

        const validation = validateSingleFile(file);
        if (!validation.isValid) {
          if (validation.error) {
            newErrors.push(validation.error);
          }
          continue;
        }

        // Generate thumbnail preview URL if image
        let previewUrl: string | undefined = undefined;
        if (showPreview && file.type.startsWith('image/')) {
          try {
            previewUrl = URL.createObjectURL(file);
          } catch {
            // ignore object URL generation failure
          }
        }

        const stagedFile: StagedFile = {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          file,
          previewUrl,
        };

        validNewStagedFiles.push(stagedFile);
      }

      if (newErrors.length > 0) {
        setValidationErrors(newErrors);
      }

      if (validNewStagedFiles.length > 0) {
        const updatedStaged = [...stagedFiles, ...validNewStagedFiles];
        setStagedFiles(updatedStaged);

        const rawFiles = updatedStaged.map((s) => s.file);
        if (onFilesSelected) {
          onFilesSelected(rawFiles);
        }

        if (autoUpload && onUpload) {
          try {
            setIsUploading(true);
            await onUpload(validNewStagedFiles.map((s) => s.file));
            setUploadSuccessMessage('Files uploaded successfully.');
            // Clear staged files on successful auto upload
            setStagedFiles([]);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
            setValidationErrors((prev) => [...prev, msg]);
          } finally {
            setIsUploading(false);
          }
        }
      }
    },
    [
      disabled,
      stagedFiles,
      existingAttachments.length,
      maxFiles,
      validateSingleFile,
      showPreview,
      onFilesSelected,
      autoUpload,
      onUpload,
    ]
  );

  /**
   * Handle file selection from standard HTML file input.
   */
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      processIncomingFiles(filesArray);
      // Reset input value so re-selecting same file triggers onChange
      e.target.value = '';
    }
  };

  /**
   * Handle drag over dropzone.
   */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isDragging) {
      setIsDragging(true);
    }
  };

  /**
   * Handle drag leave dropzone.
   */
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDragging) {
      setIsDragging(false);
    }
  };

  /**
   * Handle file drop onto dropzone.
   */
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      processIncomingFiles(droppedFiles);
    }
  };

  /**
   * Remove a staged file from the pending upload list.
   */
  const handleRemoveStagedFile = (idToRemove: string) => {
    if (disabled || isUploading) return;

    const target = stagedFiles.find((s) => s.id === idToRemove);
    if (target?.previewUrl) {
      URL.revokeObjectURL(target.previewUrl);
    }

    const updated = stagedFiles.filter((s) => s.id !== idToRemove);
    setStagedFiles(updated);

    if (onFilesSelected) {
      onFilesSelected(updated.map((s) => s.file));
    }
  };

  /**
   * Trigger explicit upload for staged files if onUpload prop provided.
   */
  const handleUploadSubmit = async () => {
    if (disabled || isUploading || stagedFiles.length === 0 || !onUpload) return;

    try {
      setIsUploading(true);
      setValidationErrors([]);
      setUploadSuccessMessage(null);

      const filesToUpload = stagedFiles.map((s) => s.file);
      await onUpload(filesToUpload);

      setUploadSuccessMessage('Files uploaded successfully.');
      // Cleanup object URLs
      stagedFiles.forEach((s) => {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      });
      setStagedFiles([]);
      if (onFilesSelected) {
        onFilesSelected([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setValidationErrors([msg]);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Handle removing an existing server attachment.
   */
  const handleRemoveExisting = async (attachmentId: string) => {
    if (!onRemoveExistingAttachment || disabled) return;

    try {
      setDeletingAttachmentIds((prev) => [...prev, attachmentId]);
      await onRemoveExistingAttachment(attachmentId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove attachment.';
      setValidationErrors([msg]);
    } finally {
      setDeletingAttachmentIds((prev) => prev.filter((id) => id !== attachmentId));
    }
  };

  /**
   * Open native file browser dialog.
   */
  const handleTriggerFilePicker = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  /**
   * Keyboard accessible dropzone trigger (Enter / Space).
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTriggerFilePicker();
    }
  };

  /**
   * Get matching icon for file type.
   */
  const getFileIcon = (mimeTypeOrName: string) => {
    const lower = mimeTypeOrName.toLowerCase();
    if (lower.includes('image') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(lower)) {
      return <ImageIcon className="w-4 h-4 text-amber-700" />;
    }
    if (
      lower.includes('pdf') ||
      lower.includes('word') ||
      lower.includes('text') ||
      /\.(pdf|doc|docx|txt)$/i.test(lower)
    ) {
      return <FileText className="w-4 h-4 text-stone-700" />;
    }
    return <FileIcon className="w-4 h-4 text-stone-500" />;
  };

  return (
    <div className={twMerge('w-full space-y-3', className)}>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        accept={acceptAttribute}
        disabled={disabled || isUploading}
        className="hidden"
        aria-label="Upload file attachment"
        data-testid="attachment-file-input"
      />

      {/* Drag & Drop Zone Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleTriggerFilePicker}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-disabled={disabled || isUploading}
        aria-label="File attachment dropzone"
        data-testid="attachment-dropzone"
        className={clsx(
          'relative border-2 border-dashed rounded-md transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#735C41] focus:ring-offset-1',
          compact ? 'p-3' : 'p-5 sm:p-6 text-center',
          isDragging
            ? 'border-[#735C41] bg-[#f5f3ee] scale-[1.005]'
            : 'border-stone-300 hover:border-[#735C41] bg-[#fbf9f4] hover:bg-[#f5f3ee]',
          disabled && 'opacity-60 cursor-not-allowed hover:bg-[#fbf9f4] hover:border-stone-300'
        )}
      >
        <div
          className={clsx(
            'flex items-center justify-center gap-3',
            compact ? 'flex-row' : 'flex-col sm:flex-row sm:gap-4'
          )}
        >
          <div
            className={clsx(
              'p-2.5 rounded-full bg-[#eae8e3] text-[#59452b] flex items-center justify-center shrink-0',
              isDragging && 'bg-[#f5d6b4] text-[#735c41]'
            )}
          >
            <Upload className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
          </div>

          <div className={compact ? 'text-left text-xs' : 'text-center sm:text-left'}>
            <p className="text-sm font-medium text-[#1b1c19]">
              <span className="text-[#735C41] underline underline-offset-2 font-semibold">
                Click to browse
              </span>{' '}
              or drag & drop files here
            </p>
            <p className="text-xs text-stone-500 mt-0.5">
              Allowed: {allowedExtensions.join(', ')} (Max {maxMbText} per file, up to {maxFiles} files)
            </p>
          </div>
        </div>
      </div>

      {/* Validation Errors Alert Banner */}
      {validationErrors.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="attachment-error-banner"
          className="p-3 bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-md text-[#93000a] text-xs space-y-1"
        >
          <div className="flex items-center gap-1.5 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#ba1a1a]" />
            <span>Attachment validation error:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 pl-1 text-[#ba1a1a]">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload Success Message Banner */}
      {uploadSuccessMessage && (
        <div
          role="status"
          data-testid="attachment-success-banner"
          className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{uploadSuccessMessage}</span>
        </div>
      )}

      {/* Staged Pending Files List */}
      {stagedFiles.length > 0 && (
        <div className="space-y-2" data-testid="staged-files-container">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
            <span>Staged Attachments ({stagedFiles.length})</span>
            {onUpload && !autoUpload && (
              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={disabled || isUploading}
                data-testid="upload-submit-btn"
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#59452b] hover:bg-[#735c41] text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload {stagedFiles.length} {stagedFiles.length === 1 ? 'file' : 'files'}</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {stagedFiles.map((staged) => (
              <div
                key={staged.id}
                data-testid={`staged-file-${staged.id}`}
                className="flex items-center justify-between p-2 sm:px-3 sm:py-2 bg-stone-50 border border-stone-200 rounded-md text-xs group hover:border-stone-300 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  {staged.previewUrl ? (
                    // eslint-disable-next-next/no-img-element
                    <img
                      src={staged.previewUrl}
                      alt={staged.file.name}
                      className="w-8 h-8 object-cover rounded border border-stone-200 shrink-0"
                    />
                  ) : (
                    <div className="p-1.5 bg-stone-100 rounded text-stone-600 shrink-0">
                      {getFileIcon(staged.file.type || staged.file.name)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="font-medium text-stone-800 truncate" title={staged.file.name}>
                      {staged.file.name}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {formatFileSize(staged.file.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded">
                    Ready
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveStagedFile(staged.id)}
                    disabled={disabled || isUploading}
                    aria-label={`Remove file ${staged.file.name}`}
                    title="Remove file"
                    data-testid={`remove-staged-file-${staged.id}`}
                    className="p-1 text-stone-400 hover:text-red-600 hover:bg-stone-200 rounded transition-colors disabled:opacity-40"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Server Attachments List */}
      {existingAttachments.length > 0 && (
        <div className="space-y-1.5 pt-1" data-testid="existing-attachments-container">
          <p className="text-xs font-semibold text-stone-700">
            Attached Files ({existingAttachments.length})
          </p>

          <div className="space-y-1.5">
            {existingAttachments.map((att) => {
              const isDeleting = deletingAttachmentIds.includes(att.id);
              return (
                <div
                  key={att.id}
                  data-testid={`existing-attachment-${att.id}`}
                  className="flex items-center justify-between p-2 sm:px-3 sm:py-2 bg-stone-100/80 border border-stone-200 rounded-md text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="p-1.5 bg-white rounded text-stone-600 shrink-0 border border-stone-200">
                      {getFileIcon(att.mime_type || att.filename)}
                    </div>

                    <div className="min-w-0">
                      <p className="font-medium text-stone-800 truncate" title={att.filename}>
                        {att.filename}
                      </p>
                      <p className="text-[11px] text-stone-500">
                        {formatFileSize(att.file_size_bytes)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {onDownloadExistingAttachment && (
                      <button
                        type="button"
                        onClick={() => onDownloadExistingAttachment(att)}
                        aria-label={`Download ${att.filename}`}
                        title="Download attachment"
                        data-testid={`download-existing-att-${att.id}`}
                        className="p-1 text-stone-500 hover:text-[#59452b] hover:bg-stone-200 rounded transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}

                    {onRemoveExistingAttachment && (
                      <button
                        type="button"
                        onClick={() => handleRemoveExisting(att.id)}
                        disabled={disabled || isDeleting}
                        aria-label={`Delete attachment ${att.filename}`}
                        title="Delete attachment"
                        data-testid={`delete-existing-att-${att.id}`}
                        className="p-1 text-stone-400 hover:text-red-600 hover:bg-stone-200 rounded transition-colors disabled:opacity-40"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttachmentUploader;
