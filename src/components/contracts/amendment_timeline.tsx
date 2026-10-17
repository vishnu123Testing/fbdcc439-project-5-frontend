'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Lock,
  ShieldCheck,
  History,
  Plus,
  Search,
  Clock,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit3,
  AlertTriangle,
  ArrowUpDown,
  Check,
  ShieldAlert,
  Info,
  Calendar,
  FileDiff,
  Shield,
} from 'lucide-react';
import { StatusLabel } from '../common/StatusLabel';
import {
  AmendmentDetailResponse,
  AmendmentCreateRequest,
  createAmendment,
  updateAmendmentBlocked,
  deleteAmendmentBlocked,
  sanitizeString,
} from '../../services/contract_api';

export interface AmendmentTimelineProps {
  /**
   * Parent contract identifier [FR-7]
   */
  contractId?: string;
  /**
   * Contract title
   */
  contractTitle?: string;
  /**
   * Contract lifecycle status ('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'AMENDED', 'TERMINATED', 'EXPIRED')
   */
  contractStatus?: string;
  /**
   * Chronological list of contract amendment audit log entries [FR-7, FR-8]
   */
  amendments?: AmendmentDetailResponse[];
  /**
   * Flag indicating whether the audit trail is read-only (always true for committed entries)
   */
  readOnly?: boolean;
  /**
   * Flag permitting creation of new amendments (e.g. for active or amended contracts)
   */
  canAddAmendment?: boolean;
  /**
   * Access control flag. When true, renders unauthorized access error state [FR-1, FR-9].
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
   * Callback invoked when creating/appending a new amendment [FR-7]
   */
  onCreateAmendment?: (summary: string) => Promise<void> | void;
  /**
   * Refresh callback
   */
  onRefresh?: () => Promise<void> | void;
  /**
   * Custom CSS class names
   */
  className?: string;
}

/**
 * Format ISO timestamp string into a readable date-time representation.
 */
function formatDate(isoStr?: string | null): string {
  if (!isoStr) return 'N/A';
  try {
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return String(isoStr);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return String(isoStr);
  }
}

export const AmendmentTimeline: React.FC<AmendmentTimelineProps> = ({
  contractId,
  contractTitle,
  contractStatus,
  amendments = [],
  readOnly = true,
  canAddAmendment = true,
  isUnauthorized = false,
  unauthorizedReason,
  loading = false,
  error = null,
  onCreateAmendment,
  onRefresh,
  className = '',
}) => {
  // Search and sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAscending, setSortAscending] = useState(true); // default chronological sequence #1, #2...

  // New amendment form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [summaryInput, setSummaryInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Immutability rejection banner / modal state for FR-8 verification
  const [blockedNotice, setBlockedNotice] = useState<{
    amendmentId: string;
    action: 'edit' | 'delete';
    message: string;
  } | null>(null);

  // Expanded amendment cards state
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Filter and sort amendments
  const filteredAmendments = useMemo(() => {
    let items = [...amendments];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(
        (a) =>
          a.summary.toLowerCase().includes(q) ||
          String(a.sequence_number).includes(q) ||
          (a.author_id && a.author_id.toLowerCase().includes(q)) ||
          a.id.toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => {
      const seqA = a.sequence_number ?? 0;
      const seqB = b.sequence_number ?? 0;
      if (seqA !== seqB) {
        return sortAscending ? seqA - seqB : seqB - seqA;
      }
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return sortAscending ? timeA - timeB : timeB - timeA;
    });

    return items;
  }, [amendments, searchQuery, sortAscending]);

  // Handle new amendment creation submission [FR-7]
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanSummary = sanitizeString(summaryInput);
    if (!cleanSummary) {
      setFormError('Amendment summary is required and cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (onCreateAmendment) {
        await onCreateAmendment(cleanSummary);
      } else if (contractId) {
        await createAmendment(contractId, { summary: cleanSummary });
      } else {
        throw new Error('Contract ID is missing.');
      }

      setFormSuccess('Amendment successfully recorded to the immutable audit log.');
      setSummaryInput('');
      setIsFormOpen(false);

      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Failed to create amendment audit record. Please check permissions and try again.';
      setFormError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Attempt edit entry -> Blocked by Policy [FR-8]
  const handleAttemptEdit = async (amendment: AmendmentDetailResponse) => {
    try {
      if (contractId) {
        // Attempt backend API call which throws 403 Forbidden
        await updateAmendmentBlocked(contractId, amendment.id);
      }
    } catch {
      // Expected 403 response or client-side enforcement
    } finally {
      setBlockedNotice({
        amendmentId: amendment.id,
        action: 'edit',
        message: `HTTP 403 Forbidden: Amendment #${amendment.sequence_number} is immutable. Edit and update operations are strictly prohibited on historical audit records [FR-8].`,
      });
    }
  };

  // Attempt delete entry -> Blocked by Policy [FR-8]
  const handleAttemptDelete = async (amendment: AmendmentDetailResponse) => {
    try {
      if (contractId) {
        // Attempt backend API call which throws 403 Forbidden
        await deleteAmendmentBlocked(contractId, amendment.id);
      }
    } catch {
      // Expected 403 response or client-side enforcement
    } finally {
      setBlockedNotice({
        amendmentId: amendment.id,
        action: 'delete',
        message: `HTTP 403 Forbidden: Amendment #${amendment.sequence_number} is immutable. Deletion operations are strictly prohibited on audit trail entries [FR-8].`,
      });
    }
  };

  // Render 403 Unauthorized state [FR-1, FR-9]
  if (isUnauthorized) {
    return (
      <div
        className={`bg-[#fbf9f4] border border-red-200 rounded-lg p-6 text-center text-stone-800 ${className}`}
        data-testid="unauthorized-state"
      >
        <div className="flex justify-center mb-3 text-red-700">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h3 className="text-lg font-semibold text-red-900 mb-1">
          403 Forbidden - Access Restricted
        </h3>
        <p className="text-sm text-stone-600 max-w-md mx-auto mb-4">
          {unauthorizedReason ||
            'You do not have the required permissions to view or inspect the amendment audit trail for this contract.'}
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 border border-red-200 rounded text-xs font-mono text-red-800">
          <Lock className="w-3.5 h-3.5" />
          <span>RBAC Policy Enforcement Active</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg p-6 shadow-sm font-sans text-[#1b1c19] ${className}`}
      data-testid="amendment-timeline"
    >
      {/* Component Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 mb-4 border-b border-[#e4e2dd] gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <History className="w-5 h-5 text-[#59452b]" />
            <h2 className="text-xl font-serif text-[#59452b] font-medium tracking-tight">
              Amendment Audit Trail
            </h2>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300"
              title="Immutable append-only audit trail [FR-7, FR-8]"
              data-testid="immutable-badge-header"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              Immutable Log
            </span>
          </div>
          <p className="text-xs text-[#4e453d]">
            {contractTitle ? (
              <span className="font-medium text-stone-800">{contractTitle} </span>
            ) : null}
            {contractId ? (
              <span className="font-mono text-stone-500">({contractId})</span>
            ) : null}
            {contractStatus ? (
              <span className="ml-2">
                <StatusLabel status={contractStatus} />
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#4e453d] bg-[#f0eee9] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded transition-colors disabled:opacity-50"
              data-testid="refresh-button"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}

          {canAddAmendment && (
            <button
              onClick={() => {
                setIsFormOpen(!isFormOpen);
                setFormError(null);
                setFormSuccess(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#59452b] hover:bg-[#735c41] rounded shadow-sm transition-colors"
              data-testid="add-amendment-button"
            >
              {isFormOpen ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Append Amendment
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Global Immutable Trail Information Banner [FR-8] */}
      <div
        className="mb-5 p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-md flex items-start gap-3"
        data-testid="immutable-audit-banner"
      >
        <Lock className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <span className="font-semibold block mb-0.5">
            Append-Only Non-Mutable Ledger (FR-7, FR-8)
          </span>
          All contract amendments are recorded in a permanent, time-stamped audit log.
          Historical contract terms and prior amendment entries are immutable and cannot be
          edited, overwritten, or deleted under any circumstances.
        </div>
      </div>

      {/* Error state alert */}
      {error && (
        <div
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center justify-between"
          data-testid="error-state"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="underline font-medium hover:text-red-900 ml-2"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Blocked Edit/Delete Operation Warning Notice Modal / Toast [FR-8] */}
      {blockedNotice && (
        <div
          className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-md shadow-sm flex items-start justify-between gap-3"
          data-testid="immutability-blocked-alert"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-900 uppercase tracking-wider mb-1">
                Security Policy Enforcement - Operation Rejected [FR-8]
              </p>
              <p className="text-xs text-red-800 leading-relaxed">
                {blockedNotice.message}
              </p>
            </div>
          </div>
          <button
            onClick={() => setBlockedNotice(null)}
            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-100"
            data-testid="close-blocked-notice"
            aria-label="Close immutability notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success banner for newly created amendment */}
      {formSuccess && (
        <div
          className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2"
          data-testid="form-success-banner"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* Append New Amendment Form Panel [FR-7] */}
      {isFormOpen && (
        <form
          onSubmit={handleCreateSubmit}
          className="mb-6 p-4 bg-[#f0eee9] border border-[#d1c4b9] rounded-md shadow-inner"
          data-testid="append-amendment-form"
        >
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#e4e2dd]">
            <FileDiff className="w-4 h-4 text-[#59452b]" />
            <h3 className="text-sm font-semibold text-[#59452b]">
              Record New Contract Amendment
            </h3>
            <span className="text-[10px] font-mono uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
              Seq #{amendments.length + 1}
            </span>
          </div>

          <p className="text-xs text-[#4e453d] mb-3">
            Provide a clear, descriptive summary of the terms, scope, pricing, or duration being
            amended. Once submitted, this entry will be permanently appended to the audit log.
          </p>

          {formError && (
            <div
              className="mb-3 p-2 bg-red-100 border border-red-300 text-xs text-red-800 rounded"
              data-testid="form-error-message"
            >
              {formError}
            </div>
          )}

          <div className="mb-3">
            <label
              htmlFor="amendment-summary"
              className="block text-xs font-medium text-stone-700 mb-1"
            >
              Amendment Summary & Modified Terms <span className="text-red-600">*</span>
            </label>
            <textarea
              id="amendment-summary"
              rows={3}
              value={summaryInput}
              onChange={(e) => setSummaryInput(e.target.value)}
              placeholder="e.g. Extended contract expiration date by 12 months, updated SLA uptime guarantee from 99.5% to 99.9%, and revised monthly billing schedule..."
              className="w-full text-xs p-2.5 border border-[#80756b] rounded bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#59452b]"
              data-testid="amendment-summary-input"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setFormError(null);
              }}
              className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900 bg-stone-200 hover:bg-stone-300 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !summaryInput.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-[#59452b] hover:bg-[#735c41] rounded disabled:opacity-50 transition-colors shadow-sm"
              data-testid="submit-amendment-button"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Commit Amendment Record
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search amendments..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#80756b] rounded bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#59452b]"
            data-testid="search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-stone-400 hover:text-stone-600"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-stone-600">
          <span data-testid="amendment-count">
            Showing <strong className="text-stone-900">{filteredAmendments.length}</strong> of{' '}
            <strong className="text-stone-900">{amendments.length}</strong> entries
          </span>

          <button
            onClick={() => setSortAscending(!sortAscending)}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#f0eee9] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded text-stone-700 transition-colors font-medium"
            data-testid="sort-toggle"
            title="Toggle chronological ordering"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[#59452b]" />
            <span>{sortAscending ? 'Oldest First (1 → N)' : 'Newest First (N → 1)'}</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton / Indicator */}
      {loading && (
        <div className="py-8 text-center text-stone-500" data-testid="loading-state">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#59452b]" />
          <p className="text-xs">Loading amendment audit log records...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredAmendments.length === 0 && (
        <div
          className="py-10 px-4 text-center border-2 border-dashed border-[#d1c4b9] rounded-lg bg-[#f0eee9]/50"
          data-testid="empty-state"
        >
          <History className="w-10 h-10 text-stone-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-stone-700 mb-1">
            {searchQuery ? 'No matching amendment entries' : 'No Amendment Records'}
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto mb-4">
            {searchQuery
              ? `No amendment entries found matching "${searchQuery}". Try clearing your search query.`
              : 'This contract has not been amended. All original agreement clauses and SLA terms remain active in their baseline form.'}
          </p>

          {canAddAmendment && !searchQuery && (
            <button
              onClick={() => {
                setIsFormOpen(true);
                setFormError(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#59452b] hover:bg-[#735c41] rounded shadow-sm"
              data-testid="empty-add-amendment-button"
            >
              <Plus className="w-3.5 h-3.5" />
              Record First Amendment
            </button>
          )}
        </div>
      )}

      {/* Timeline Audit Log View [FR-7, FR-8] */}
      {!loading && filteredAmendments.length > 0 && (
        <div className="relative pl-4 sm:pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#d1c4b9]">
          {filteredAmendments.map((amendment, index) => {
            const isExpanded = expandedIds[amendment.id] ?? true;
            const seq = amendment.sequence_number ?? index + 1;

            return (
              <div
                key={amendment.id}
                className="relative pl-6 sm:pl-8 group"
                data-testid={`amendment-item-${amendment.id}`}
              >
                {/* Timeline node icon */}
                <div
                  className="absolute -left-1 sm:left-0 top-1 w-7 h-7 rounded-full bg-[#fbf9f4] border-2 border-[#59452b] text-[#59452b] flex items-center justify-center font-mono text-[10px] font-bold shadow-sm z-10"
                  data-testid={`amendment-sequence-${seq}`}
                >
                  #{seq}
                </div>

                {/* Audit Card */}
                <div className="bg-white border border-[#d1c4b9] rounded-lg shadow-sm hover:shadow transition-shadow overflow-hidden">
                  {/* Card Header */}
                  <div className="p-3 sm:p-4 bg-[#f5f3ee] border-b border-[#e4e2dd] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#59452b] font-mono">
                        Amendment #{seq}
                      </span>

                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200"
                        data-testid={`amendment-locked-badge-${amendment.id}`}
                        title="This historical record is immutable and permanently locked [FR-8]"
                      >
                        <Lock className="w-3 h-3 text-amber-700" />
                        <span>Locked Record</span>
                      </span>

                      <span className="text-xs text-stone-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-stone-400" />
                        <time
                          dateTime={amendment.created_at}
                          data-testid={`amendment-timestamp-${amendment.id}`}
                        >
                          {formatDate(amendment.created_at)}
                        </time>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {amendment.author_id && (
                        <span
                          className="text-xs text-stone-600 flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded border border-stone-200"
                          data-testid={`amendment-author-${amendment.id}`}
                        >
                          <User className="w-3 h-3 text-stone-500" />
                          <span>{amendment.author_id}</span>
                        </span>
                      )}

                      <button
                        onClick={() => toggleExpand(amendment.id)}
                        className="text-stone-500 hover:text-stone-800 p-1 rounded hover:bg-[#eae8e3]"
                        aria-label={isExpanded ? 'Collapse entry' : 'Expand entry'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Card Content */}
                  {isExpanded && (
                    <div className="p-4 bg-white">
                      <div className="mb-3">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                          Summary of Modified Terms
                        </h4>
                        <p
                          className="text-xs text-stone-800 whitespace-pre-wrap leading-relaxed font-sans bg-[#fbf9f4] p-3 rounded border border-stone-200"
                          data-testid={`amendment-summary-${amendment.id}`}
                        >
                          {sanitizeString(amendment.summary)}
                        </p>
                      </div>

                      {/* Footer Actions demonstrating Immutability Blockers [FR-8] */}
                      <div className="pt-2 border-t border-[#f0eee9] flex items-center justify-between flex-wrap gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 text-stone-500">
                          <Shield className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Immutable Audit Log Entry • Non-Modifiable</span>
                        </div>

                        {/* Interactive edit/delete attempt buttons triggering 403 Forbidden check */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAttemptEdit(amendment)}
                            className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-800 hover:bg-stone-100 px-2 py-1 rounded transition-colors"
                            data-testid={`attempt-edit-button-${amendment.id}`}
                            title="Attempt to edit this record (will be blocked by FR-8 immutability rule)"
                          >
                            <Edit3 className="w-3 h-3 text-stone-400" />
                            <span>Edit (Blocked)</span>
                          </button>

                          <button
                            onClick={() => handleAttemptDelete(amendment)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                            data-testid={`attempt-delete-button-${amendment.id}`}
                            title="Attempt to delete this record (will be blocked by FR-8 immutability rule)"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                            <span>Delete (Blocked)</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AmendmentTimeline;
