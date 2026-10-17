'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  FileText,
  Upload,
  Download,
  Filter,
  Search,
  Lock,
  Plus,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Tag,
  Paperclip,
  Clock,
  ShieldCheck,
  Layers,
  FileCheck,
  RefreshCw,
  FolderTree,
  ChevronRight,
  Info,
  X,
  FileCode,
} from 'lucide-react';
import { StatusLabel } from '../common/StatusLabel';
import {
  DocumentVersionResponse,
  ContractCategory,
  ContractSummaryResponse,
  uploadContractDocument,
  downloadContractDocument,
  sanitizeString,
} from '../../services/contract_api';

export interface AttachedSupportingDocument {
  id: string;
  title: string;
  category: ContractCategory | string;
  version_number?: number;
  created_at?: string;
  file_path?: string;
  parent_contract_id?: string | null;
}

export interface VersionHistoryProps {
  /**
   * Parent contract identifier [FR-10]
   */
  contractId?: string;
  /**
   * Parent contract title
   */
  contractTitle?: string;
  /**
   * Parent contract category ('Contract' | 'SOW' | 'NDA' | 'Exhibit') [FR-3]
   */
  contractCategory?: ContractCategory | string;
  /**
   * Complete list of document versions for the contract [FR-4]
   */
  documentVersions?: DocumentVersionResponse[];
  /**
   * Active / current version response object [FR-4]
   */
  activeVersion?: DocumentVersionResponse | null;
  /**
   * List of attached supporting documents (e.g. SOWs, Exhibits) [FR-10]
   */
  attachedDocuments?: (AttachedSupportingDocument | ContractSummaryResponse)[];
  /**
   * List of child contract IDs linked to this parent contract [FR-10]
   */
  childContractIds?: string[];
  /**
   * Access control flag. When true, renders unauthorized access error state [FR-1].
   */
  isUnauthorized?: boolean;
  /**
   * Custom access denial explanation message
   */
  unauthorizedReason?: string;
  /**
   * Loading indicator state
   */
  loading?: boolean;
  /**
   * Error message string
   */
  error?: string | null;
  /**
   * Callback invoked when uploading a new document version or document [FR-3, FR-4]
   */
  onUploadVersion?: (file: File, categoryType: string) => Promise<void> | void;
  /**
   * Callback invoked when downloading a specific document version [FR-4]
   */
  onDownloadVersion?: (versionId: string, filePath: string) => Promise<void> | void;
  /**
   * Callback invoked when attaching a supporting document (SOW/Exhibit) to parent [FR-10]
   */
  onAttachSupportingDocument?: (
    file: File,
    categoryType: string,
    title?: string
  ) => Promise<void> | void;
  /**
   * Refresh callback
   */
  onRefresh?: () => Promise<void> | void;
  /**
   * Custom CSS class names
   */
  className?: string;
}

export function VersionHistory({
  contractId,
  contractTitle,
  contractCategory = 'Contract',
  documentVersions = [],
  activeVersion,
  attachedDocuments = [],
  childContractIds = [],
  isUnauthorized = false,
  unauthorizedReason = 'You do not have required permissions to view contract version history.',
  loading = false,
  error = null,
  onUploadVersion,
  onDownloadVersion,
  onAttachSupportingDocument,
  onRefresh,
  className = '',
}: VersionHistoryProps) {
  // State variables
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);

  // Upload new version form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>(contractCategory || 'Contract');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);

  // Attach supporting document form state [FR-10]
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachCategory, setAttachCategory] = useState<string>('Exhibit');
  const [attachTitle, setAttachTitle] = useState<string>('');
  const [isAttaching, setIsAttaching] = useState<boolean>(false);
  const [attachSuccessMsg, setAttachSuccessMsg] = useState<string | null>(null);
  const [attachErrorMsg, setAttachErrorMsg] = useState<string | null>(null);

  // Download loading state map
  const [downloadingVersionId, setDownloadingVersionId] = useState<string | null>(null);

  // Active tab state: 'versions' vs 'attachments'
  const [activeTab, setActiveTab] = useState<'versions' | 'attachments'>('versions');

  // Available categories [FR-3]
  const categories: ContractCategory[] = ['Contract', 'SOW', 'NDA', 'Exhibit'];

  // Category badge styling helper
  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'Contract':
        return 'bg-[#f0eee9] text-[#59452b] border-[#d1c4b9] font-medium';
      case 'SOW':
        return 'bg-[#eaf0f8] text-[#374a5f] border-[#caddf8] font-medium';
      case 'NDA':
        return 'bg-[#fdf0ee] text-[#a43b2c] border-[#fd7d69] font-medium';
      case 'Exhibit':
        return 'bg-[#f5f3ee] text-[#4e453d] border-[#d1c4b9] font-medium';
      default:
        return 'bg-[#f0eee9] text-[#1b1c19] border-[#d1c4b9] font-medium';
    }
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: documentVersions.length,
      Contract: 0,
      SOW: 0,
      NDA: 0,
      Exhibit: 0,
    };
    documentVersions.forEach((ver) => {
      if (counts[ver.category_type] !== undefined) {
        counts[ver.category_type] += 1;
      }
    });
    return counts;
  }, [documentVersions]);

  // Determine active/latest version if not explicitly passed
  const currentActiveVersion = useMemo(() => {
    if (activeVersion) return activeVersion;
    if (documentVersions.length === 0) return null;
    return [...documentVersions].sort((a, b) => b.version_number - a.version_number)[0];
  }, [activeVersion, documentVersions]);

  // Filtered and sorted document versions
  const filteredVersions = useMemo(() => {
    let list = [...documentVersions];

    if (selectedCategory !== 'ALL') {
      list = list.filter((v) => v.category_type === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (v) =>
          v.file_path.toLowerCase().includes(q) ||
          v.category_type.toLowerCase().includes(q) ||
          v.checksum.toLowerCase().includes(q) ||
          String(v.version_number).includes(q) ||
          (v.uploaded_by_id && v.uploaded_by_id.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      return sortOrder === 'desc'
        ? b.version_number - a.version_number
        : a.version_number - b.version_number;
    });

    return list;
  }, [documentVersions, selectedCategory, searchQuery, sortOrder]);

  // Copy checksum handler
  const handleCopyChecksum = (checksum: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(checksum);
      setCopiedChecksum(checksum);
      setTimeout(() => setCopiedChecksum(null), 2000);
    }
  };

  // Handle upload version form submission [FR-3, FR-4]
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadSuccessMsg(null);
    setUploadErrorMsg(null);

    if (!uploadFile) {
      setUploadErrorMsg('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    try {
      if (onUploadVersion) {
        await onUploadVersion(uploadFile, uploadCategory);
      } else if (contractId) {
        await uploadContractDocument(contractId, uploadFile, uploadCategory);
      } else {
        throw new Error('No target contract ID or upload callback provided.');
      }

      setUploadSuccessMsg(
        `Successfully uploaded new ${uploadCategory} version for "${uploadFile.name}".`
      );
      setUploadFile(null);
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload document version.';
      setUploadErrorMsg(sanitizeString(msg));
    } finally {
      setIsUploading(false);
    }
  };

  // Handle attach supporting document form submission [FR-10]
  const handleAttachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttachSuccessMsg(null);
    setAttachErrorMsg(null);

    if (!attachFile) {
      setAttachErrorMsg('Please select a file to attach.');
      return;
    }

    setIsAttaching(true);
    try {
      const title = attachTitle.trim() || attachFile.name;
      if (onAttachSupportingDocument) {
        await onAttachSupportingDocument(attachFile, attachCategory, title);
      } else if (onUploadVersion) {
        await onUploadVersion(attachFile, attachCategory);
      } else if (contractId) {
        await uploadContractDocument(contractId, attachFile, attachCategory);
      } else {
        throw new Error('No target contract ID or attachment callback provided.');
      }

      setAttachSuccessMsg(
        `Successfully attached supporting ${attachCategory} document "${title}".`
      );
      setAttachFile(null);
      setAttachTitle('');
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to attach supporting document.';
      setAttachErrorMsg(sanitizeString(msg));
    } finally {
      setIsAttaching(false);
    }
  };

  // Handle download version file payload [FR-4]
  const handleDownload = async (versionId: string, filePath: string) => {
    setDownloadingVersionId(versionId);
    try {
      if (onDownloadVersion) {
        await onDownloadVersion(versionId, filePath);
      } else if (contractId) {
        const blob = await downloadContractDocument(contractId, versionId);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = filePath.split('/').pop() || `document_version_${versionId}`;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('Download function unavailable.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to download document version.';
      alert(`Download error: ${sanitizeString(msg)}`);
    } finally {
      setDownloadingVersionId(null);
    }
  };

  // Render unauthorized access state [FR-1]
  if (isUnauthorized) {
    return (
      <div
        data-testid="unauthorized-message"
        className={`bg-[#fbf9f4] border border-[#a43b2c]/30 rounded-lg p-6 text-center text-[#1b1c19] my-4 shadow-sm ${className}`}
      >
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-full bg-[#fdf0ee] flex items-center justify-center text-[#a43b2c]">
            <Lock className="w-6 h-6" />
          </div>
        </div>
        <h3 className="font-serif text-xl font-normal text-[#1b1c19] mb-2">
          Access Restricted
        </h3>
        <p className="text-sm text-[#4e453d] max-w-md mx-auto mb-4">
          {sanitizeString(unauthorizedReason)}
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#f5f3ee] text-[#59452b] text-xs font-medium border border-[#d1c4b9]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Role-Based Access Control (RBAC) Enforced</span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="version-history"
      className={`bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg shadow-sm text-[#1b1c19] overflow-hidden ${className}`}
    >
      {/* Header section */}
      <div className="border-b border-[#d1c4b9] bg-[#f5f3ee] px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-widest text-[#59452b] font-semibold">
              Repository & Version Control
            </span>
            {contractCategory && (
              <span
                className={`text-xs px-2 py-0.5 rounded border ${getCategoryBadgeClass(
                  contractCategory
                )}`}
              >
                {contractCategory}
              </span>
            )}
          </div>
          <h2 className="font-serif text-2xl text-[#1b1c19] tracking-tight">
            {contractTitle ? sanitizeString(contractTitle) : 'Document Version History'}
          </h2>
          {contractId && (
            <p className="text-xs text-[#4e453d] mt-0.5 font-mono">
              Contract ID: {sanitizeString(contractId)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh version history"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#f0eee9] hover:bg-[#e3ded1] text-[#59452b] border border-[#d1c4b9] rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Navigation Tabs [Versions vs Supporting Attachments] [FR-4, FR-10] */}
      <div className="border-b border-[#d1c4b9] bg-[#fbf9f4] px-6 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('versions')}
          role="tab"
          aria-selected={activeTab === 'versions'}
          className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'versions'
              ? 'border-[#59452b] text-[#59452b]'
              : 'border-transparent text-[#4e453d] hover:text-[#1b1c19]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Sequential Versions</span>
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-[#f0eee9] text-[#59452b] border border-[#d1c4b9]">
            {documentVersions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('attachments')}
          role="tab"
          aria-selected={activeTab === 'attachments'}
          data-testid="tab-attachments"
          className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'attachments'
              ? 'border-[#59452b] text-[#59452b]'
              : 'border-transparent text-[#4e453d] hover:text-[#1b1c19]'
          }`}
        >
          <Paperclip className="w-4 h-4" />
          <span>Attached Exhibits & SOWs</span>
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-[#f0eee9] text-[#59452b] border border-[#d1c4b9]">
            {attachedDocuments.length || childContractIds.length}
          </span>
        </button>
      </div>

      {/* Global Error Notice */}
      {error && (
        <div className="m-6 p-4 rounded bg-[#fdf0ee] border border-[#a43b2c]/40 text-[#a43b2c] flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{sanitizeString(error)}</span>
        </div>
      )}

      {/* Active Version Highlight Banner [FR-4] */}
      {currentActiveVersion && (
        <div
          data-testid="active-version-banner"
          className="mx-6 mt-6 p-4 rounded-lg bg-[#f5f3ee] border border-[#59452b]/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-[#59452b] text-white">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#59452b]">
                  Active Document Version
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-[#59452b] text-white font-mono font-medium">
                  v{currentActiveVersion.version_number}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded border ${getCategoryBadgeClass(
                    currentActiveVersion.category_type
                  )}`}
                >
                  {currentActiveVersion.category_type}
                </span>
              </div>
              <p className="text-sm font-medium text-[#1b1c19] mt-1 font-mono break-all">
                {currentActiveVersion.file_path}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-[#4e453d] mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Uploaded: {new Date(currentActiveVersion.created_at).toLocaleString()}
                </span>
                <span className="flex items-center gap-1 font-mono">
                  SHA-256: {currentActiveVersion.checksum.substring(0, 16)}...
                </span>
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={() =>
                handleDownload(currentActiveVersion.id, currentActiveVersion.file_path)
              }
              disabled={downloadingVersionId === currentActiveVersion.id}
              data-testid={`download-button-${currentActiveVersion.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#59452b] hover:bg-[#40311e] text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>
                {downloadingVersionId === currentActiveVersion.id
                  ? 'Downloading...'
                  : 'Download Active Version'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN TAB CONTENT: VERSIONS */}
      {activeTab === 'versions' && (
        <div className="p-6 space-y-6">
          {/* Category Filter Pills [FR-3] */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d1c4b9] pb-4">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Category filters">
              <span className="text-xs text-[#4e453d] font-medium mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter Category:
              </span>
              <button
                onClick={() => setSelectedCategory('ALL')}
                data-testid="category-filter-all"
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  selectedCategory === 'ALL'
                    ? 'bg-[#59452b] text-white border-[#59452b]'
                    : 'bg-[#f5f3ee] text-[#4e453d] border-[#d1c4b9] hover:bg-[#e3ded1]'
                }`}
              >
                All ({categoryCounts.ALL})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  data-testid={`category-filter-${cat.toLowerCase()}`}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#59452b] text-white border-[#59452b]'
                      : 'bg-[#f5f3ee] text-[#4e453d] border-[#d1c4b9] hover:bg-[#e3ded1]'
                  }`}
                >
                  {cat} ({categoryCounts[cat] || 0})
                </button>
              ))}
            </div>

            {/* Search and Sort controls */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#80756b]" />
                <input
                  type="text"
                  placeholder="Search file, version, hash..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-[#ffffff] border border-[#d1c4b9] rounded text-xs text-[#1b1c19] placeholder-[#80756b] focus:outline-none focus:border-[#59452b]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#80756b] hover:text-[#1b1c19]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                title="Toggle Sort Order"
                className="px-3 py-1.5 text-xs bg-[#f5f3ee] hover:bg-[#e3ded1] text-[#59452b] border border-[#d1c4b9] rounded transition-colors"
              >
                Sort: {sortOrder === 'desc' ? 'Newest v↓' : 'Oldest v↑'}
              </button>
            </div>
          </div>

          {/* Upload New Version Section [FR-3, FR-4] */}
          <div
            data-testid="upload-version-section"
            className="p-5 rounded-lg border border-[#d1c4b9] bg-[#f5f3ee]"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#59452b]" />
                <h3 className="font-serif text-lg text-[#1b1c19]">
                  Upload New Sequential Version [FR-4]
                </h3>
              </div>
              <span className="text-xs text-[#4e453d]">
                Assigns incremental version number automatically
              </span>
            </div>

            {uploadSuccessMsg && (
              <div className="mb-4 p-3 rounded bg-[#eaf0f8] border border-[#374a5f]/30 text-[#374a5f] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{uploadSuccessMsg}</span>
              </div>
            )}

            {uploadErrorMsg && (
              <div className="mb-4 p-3 rounded bg-[#fdf0ee] border border-[#a43b2c]/30 text-[#a43b2c] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{uploadErrorMsg}</span>
              </div>
            )}

            <form
              onSubmit={handleUploadSubmit}
              data-testid="upload-version-form"
              className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
            >
              {/* Category selector [FR-3] */}
              <div className="md:col-span-4">
                <label className="block text-xs font-semibold uppercase text-[#59452b] mb-1">
                  Document Category [FR-3]
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  data-testid="category-select"
                  className="w-full px-3 py-2 bg-[#ffffff] border border-[#d1c4b9] rounded text-sm text-[#1b1c19] focus:outline-none focus:border-[#59452b]"
                >
                  <option value="Contract">Contract</option>
                  <option value="SOW">SOW (Statement of Work)</option>
                  <option value="NDA">NDA (Non-Disclosure Agreement)</option>
                  <option value="Exhibit">Exhibit / Annex</option>
                </select>
              </div>

              {/* File picker */}
              <div className="md:col-span-5">
                <label className="block text-xs font-semibold uppercase text-[#59452b] mb-1">
                  Select File Payload
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  data-testid="upload-file-input"
                  className="w-full text-xs text-[#4e453d] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-[#59452b] file:text-white hover:file:bg-[#40311e] cursor-pointer"
                />
              </div>

              {/* Upload submit button */}
              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={isUploading || !uploadFile}
                  data-testid="upload-button"
                  className="w-full py-2 px-4 bg-[#59452b] hover:bg-[#40311e] text-white text-xs font-semibold rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? 'Uploading...' : 'Upload Revision'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Sequential Versions List [FR-4] */}
          <div className="space-y-3">
            <h3 className="font-serif text-xl text-[#1b1c19] flex items-center justify-between">
              <span>Document Version History</span>
              <span className="text-xs font-sans font-normal text-[#4e453d]">
                Showing {filteredVersions.length} of {documentVersions.length} versions
              </span>
            </h3>

            {loading && documentVersions.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#4e453d]">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#59452b]" />
                <span>Loading document versions...</span>
              </div>
            ) : filteredVersions.length === 0 ? (
              <div
                data-testid="empty-versions-state"
                className="p-8 border border-dashed border-[#d1c4b9] rounded-lg text-center bg-[#f5f3ee]"
              >
                <FileText className="w-8 h-8 text-[#80756b] mx-auto mb-2" />
                <p className="text-sm text-[#1b1c19] font-medium">No document versions found</p>
                <p className="text-xs text-[#4e453d] mt-1">
                  {searchQuery || selectedCategory !== 'ALL'
                    ? 'Try adjusting your search query or category filter.'
                    : 'Upload the initial document version above to begin version control.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3" role="list" aria-label="Sequential Document Versions">
                {filteredVersions.map((ver) => {
                  const isActive = currentActiveVersion?.id === ver.id;
                  return (
                    <div
                      key={ver.id}
                      data-testid={`version-item-${ver.id}`}
                      className={`p-4 rounded-lg border transition-all ${
                        isActive
                          ? 'border-[#59452b] bg-[#ffffff] shadow-sm ring-1 ring-[#59452b]/20'
                          : 'border-[#d1c4b9] bg-[#ffffff] hover:border-[#80756b]'
                      }`}
                      role="listitem"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Left version info */}
                        <div className="flex items-start gap-3">
                          <div
                            className={`px-2.5 py-1 rounded font-mono text-xs font-bold ${
                              isActive
                                ? 'bg-[#59452b] text-white'
                                : 'bg-[#f0eee9] text-[#59452b] border border-[#d1c4b9]'
                            }`}
                          >
                            v{ver.version_number}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-xs px-2 py-0.5 rounded border ${getCategoryBadgeClass(
                                  ver.category_type
                                )}`}
                              >
                                {ver.category_type}
                              </span>

                              {isActive && (
                                <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Active Version
                                </span>
                              )}
                            </div>

                            <p className="text-sm font-medium text-[#1b1c19] font-mono mt-1 break-all">
                              {ver.file_path}
                            </p>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#4e453d] mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-[#80756b]" />
                                {new Date(ver.created_at).toLocaleString()}
                              </span>

                              {ver.uploaded_by_id && (
                                <span>Uploaded by: {sanitizeString(ver.uploaded_by_id)}</span>
                              )}

                              <div className="flex items-center gap-1 font-mono text-xs text-[#4e453d]">
                                <span>Hash: {ver.checksum.substring(0, 12)}...</span>
                                <button
                                  onClick={() => handleCopyChecksum(ver.checksum)}
                                  title="Copy SHA-256 checksum"
                                  className="p-1 hover:text-[#59452b] transition-colors"
                                >
                                  {copiedChecksum === ver.checksum ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right action button */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownload(ver.id, ver.file_path)}
                            disabled={downloadingVersionId === ver.id}
                            data-testid={`download-button-${ver.id}`}
                            className="px-3 py-1.5 bg-[#f5f3ee] hover:bg-[#e3ded1] text-[#59452b] border border-[#d1c4b9] text-xs font-medium rounded transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>
                              {downloadingVersionId === ver.id ? 'Downloading...' : 'Download'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAIN TAB CONTENT: ATTACHED EXHIBITS & SOWs [FR-10] */}
      {activeTab === 'attachments' && (
        <div data-testid="attached-documents-section" className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#d1c4b9] pb-4">
            <div>
              <h3 className="font-serif text-xl text-[#1b1c19]">
                Parent-Child Supporting Attachments [FR-10]
              </h3>
              <p className="text-xs text-[#4e453d] mt-0.5">
                Supporting SOWs, Exhibits, and NDAs directly attached to parent contract record
              </p>
            </div>
          </div>

          {/* Attach supporting document form [FR-10] */}
          <div className="p-5 rounded-lg border border-[#d1c4b9] bg-[#f5f3ee]">
            <div className="flex items-center gap-2 mb-3">
              <Paperclip className="w-4 h-4 text-[#59452b]" />
              <h4 className="font-serif text-base text-[#1b1c19]">
                Attach Supporting SOW or Exhibit to Parent [FR-10]
              </h4>
            </div>

            {attachSuccessMsg && (
              <div className="mb-4 p-3 rounded bg-[#eaf0f8] border border-[#374a5f]/30 text-[#374a5f] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{attachSuccessMsg}</span>
              </div>
            )}

            {attachErrorMsg && (
              <div className="mb-4 p-3 rounded bg-[#fdf0ee] border border-[#a43b2c]/30 text-[#a43b2c] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{attachErrorMsg}</span>
              </div>
            )}

            <form
              onSubmit={handleAttachSubmit}
              data-testid="attach-document-form"
              className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
            >
              {/* Document Title / Name */}
              <div className="md:col-span-4">
                <label className="block text-xs font-semibold uppercase text-[#59452b] mb-1">
                  Attachment Title / Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Schedule A - SLA Exhibit"
                  value={attachTitle}
                  onChange={(e) => setAttachTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#ffffff] border border-[#d1c4b9] rounded text-sm text-[#1b1c19] focus:outline-none focus:border-[#59452b]"
                />
              </div>

              {/* Attachment Category [FR-10] */}
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold uppercase text-[#59452b] mb-1">
                  Category [FR-10]
                </label>
                <select
                  value={attachCategory}
                  onChange={(e) => setAttachCategory(e.target.value)}
                  data-testid="attach-category-select"
                  className="w-full px-3 py-2 bg-[#ffffff] border border-[#d1c4b9] rounded text-sm text-[#1b1c19] focus:outline-none focus:border-[#59452b]"
                >
                  <option value="Exhibit">Exhibit</option>
                  <option value="SOW">SOW</option>
                  <option value="NDA">NDA</option>
                  <option value="Contract">Sub-Contract</option>
                </select>
              </div>

              {/* Attachment File */}
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold uppercase text-[#59452b] mb-1">
                  File Attachment
                </label>
                <input
                  type="file"
                  onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
                  data-testid="attach-file-input"
                  className="w-full text-xs text-[#4e453d] file:mr-2 file:py-1.5 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-medium file:bg-[#59452b] file:text-white hover:file:bg-[#40311e] cursor-pointer"
                />
              </div>

              {/* Attach button */}
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={isAttaching || !attachFile}
                  data-testid="attach-button"
                  className="w-full py-2 px-3 bg-[#59452b] hover:bg-[#40311e] text-white text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>{isAttaching ? 'Attaching...' : 'Attach'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Attached Supporting Documents List */}
          <div className="space-y-3">
            <h4 className="font-serif text-lg text-[#1b1c19]">
              Attached Supporting Records ({attachedDocuments.length})
            </h4>

            {attachedDocuments.length === 0 ? (
              <div className="p-8 border border-dashed border-[#d1c4b9] rounded-lg text-center bg-[#f5f3ee]">
                <Paperclip className="w-8 h-8 text-[#80756b] mx-auto mb-2" />
                <p className="text-sm text-[#1b1c19] font-medium">
                  No supporting exhibits or SOWs attached
                </p>
                <p className="text-xs text-[#4e453d] mt-1">
                  Use the form above to link supporting exhibits, SOWs, or annexes directly to this
                  parent contract.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {attachedDocuments.map((docItem, idx) => {
                  const doc = docItem as any;
                  const docTitle = doc.title || doc.id || 'Supporting Document';
                  const docCategory = doc.category || 'Exhibit';
                  return (
                    <div
                      key={doc.id || idx}
                      data-testid={`attached-doc-item-${doc.id || idx}`}
                      className="p-4 rounded-lg border border-[#d1c4b9] bg-[#ffffff] flex items-start justify-between gap-3 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded bg-[#f5f3ee] text-[#59452b]">
                          <Paperclip className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded border ${getCategoryBadgeClass(
                                docCategory
                              )}`}
                            >
                              {docCategory}
                            </span>
                            <span className="text-xs text-[#4e453d] font-mono">
                              ID: {doc.id.substring(0, 8)}...
                            </span>
                          </div>
                          <h5 className="text-sm font-semibold text-[#1b1c19] mt-1">
                            {sanitizeString(docTitle)}
                          </h5>
                          {'created_at' in doc && doc.created_at && (
                            <p className="text-xs text-[#4e453d] mt-1">
                              Attached: {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default VersionHistory;
