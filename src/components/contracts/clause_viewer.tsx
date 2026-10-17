'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  FileText,
  ShieldCheck,
  AlertCircle,
  Search,
  Filter,
  Lock,
  Plus,
  CheckCircle2,
  Zap,
  ChevronDown,
  ChevronUp,
  Star,
  RefreshCw,
  AlertTriangle,
  X,
  Tag,
  Sparkles,
  Info,
  Award,
} from 'lucide-react';
import { StatusLabel } from '../common/StatusLabel';
import {
  ClauseResponse,
  SLAResponse,
  ClauseCreateRequest,
  SLACreateRequest,
  SLAEvaluationResponse,
  sanitizeString,
} from '../../services/contract_api';

export interface ClauseViewerProps {
  /**
   * Unique contract identifier [FR-1]
   */
  contractId?: string;
  /**
   * Contract title
   */
  contractTitle?: string;
  /**
   * Contract lifecycle status ('ACTIVE', 'AMENDED', 'DRAFT', 'PENDING_SIGNATURE', 'TERMINATED', 'EXPIRED')
   */
  contractStatus?: string;
  /**
   * Counterparty organization name
   */
  counterparty?: string;
  /**
   * Complete list of contract clauses
   */
  clauses?: ClauseResponse[];
  /**
   * Highlighted key clauses list. Defaults to clauses with is_highlighted = true.
   */
  highlightedClauses?: ClauseResponse[];
  /**
   * Active Service Level Agreement metric targets
   */
  slas?: SLAResponse[];
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
   * Callback to evaluate active SLAs and key clause integrity
   */
  onEvaluateSLAs?: () => Promise<SLAEvaluationResponse | void> | void;
  /**
   * Callback to append a new clause
   */
  onAddClause?: (payload: ClauseCreateRequest) => Promise<void> | void;
  /**
   * Callback to append a new SLA metric
   */
  onAddSLA?: (payload: SLACreateRequest) => Promise<void> | void;
  /**
   * Refresh callback
   */
  onRefresh?: () => Promise<void> | void;
  /**
   * Custom CSS class names
   */
  className?: string;
}

export function ClauseViewer({
  contractId = '',
  contractTitle = 'Contract Agreement',
  contractStatus = 'ACTIVE',
  counterparty = '',
  clauses = [],
  highlightedClauses,
  slas = [],
  isUnauthorized = false,
  unauthorizedReason,
  loading = false,
  error = null,
  onEvaluateSLAs,
  onAddClause,
  onAddSLA,
  onRefresh,
  className = '',
}: ClauseViewerProps) {
  // Navigation & Filtering State
  const [activeTab, setActiveTab] = useState<'ALL' | 'HIGHLIGHTED' | 'SLAS'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClauseType, setSelectedClauseType] = useState<string>('ALL');
  const [expandedClauseIds, setExpandedClauseIds] = useState<Record<string, boolean>>({});

  // Interactive Action States
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluationResult, setEvaluationResult] = useState<SLAEvaluationResponse | null>(null);

  // Modal / Form States
  const [showAddClauseModal, setShowAddClauseModal] = useState<boolean>(false);
  const [showAddSLAModal, setShowAddSLAModal] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Add Clause Form Fields
  const [clauseTypeInput, setClauseTypeInput] = useState<string>('Indemnification');
  const [clauseTitleInput, setClauseTitleInput] = useState<string>('');
  const [clauseBodyInput, setClauseBodyInput] = useState<string>('');
  const [clauseIsHighlightedInput, setClauseIsHighlightedInput] = useState<boolean>(false);

  // Add SLA Form Fields
  const [slaMetricNameInput, setSlaMetricNameInput] = useState<string>('');
  const [slaTargetValueInput, setSlaTargetValueInput] = useState<string>('');
  const [slaPenaltyTermsInput, setSlaPenaltyTermsInput] = useState<string>('');

  // Derive highlighted clauses if not explicitly provided
  const effectiveHighlightedClauses = useMemo(() => {
    if (highlightedClauses && highlightedClauses.length > 0) {
      return highlightedClauses;
    }
    return clauses.filter((c) => c.is_highlighted);
  }, [clauses, highlightedClauses]);

  // Extract unique clause types for dropdown filter
  const availableClauseTypes = useMemo(() => {
    const typesSet = new Set<string>();
    clauses.forEach((c) => {
      if (c.clause_type) typesSet.add(c.clause_type);
    });
    return Array.from(typesSet);
  }, [clauses]);

  // Filter clauses based on tab, search query, and selected clause type
  const filteredClauses = useMemo(() => {
    return clauses.filter((clause) => {
      // Tab filter
      if (activeTab === 'HIGHLIGHTED' && !clause.is_highlighted) {
        return false;
      }
      // Type filter
      if (selectedClauseType !== 'ALL' && clause.clause_type !== selectedClauseType) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = clause.title.toLowerCase().includes(q);
        const matchesBody = clause.body_text.toLowerCase().includes(q);
        const matchesType = clause.clause_type.toLowerCase().includes(q);
        if (!matchesTitle && !matchesBody && !matchesType) {
          return false;
        }
      }
      return true;
    });
  }, [clauses, activeTab, selectedClauseType, searchQuery]);

  // Filter SLAs based on search query
  const filteredSLAs = useMemo(() => {
    if (!searchQuery.trim()) return slas;
    const q = searchQuery.toLowerCase().trim();
    return slas.filter(
      (sla) =>
        sla.metric_name.toLowerCase().includes(q) ||
        sla.target_value.toLowerCase().includes(q) ||
        (sla.penalty_terms && sla.penalty_terms.toLowerCase().includes(q))
    );
  }, [slas, searchQuery]);

  // Expand/collapse single clause text view
  const toggleClauseExpanded = useCallback((id: string) => {
    setExpandedClauseIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  // Expand all or collapse all
  const toggleAllClauses = useCallback(
    (expand: boolean) => {
      const nextState: Record<string, boolean> = {};
      filteredClauses.forEach((c) => {
        nextState[c.id] = expand;
      });
      setExpandedClauseIds(nextState);
    },
    [filteredClauses]
  );

  // SLA Evaluation Handler
  const handleEvaluateSLAs = async () => {
    if (!onEvaluateSLAs) return;
    setIsEvaluating(true);
    setNoticeMessage(null);
    try {
      const result = await onEvaluateSLAs();
      if (result) {
        setEvaluationResult(result);
        setNoticeMessage(
          `SLA evaluation complete: ${result.total_slas} SLAs evaluated (${result.breached_slas} breaches flagged, ${result.highlighted_clause_count} key terms verified).`
        );
      } else {
        setNoticeMessage('SLA evaluation completed successfully.');
      }
    } catch (err) {
      console.error('SLA evaluation failed:', err);
      setNoticeMessage(
        `SLA evaluation error: ${err instanceof Error ? err.message : 'Failed to evaluate SLAs'}`
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  // Clause Submission Handler
  const handleCreateClause = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clauseTitleInput.trim() || !clauseBodyInput.trim()) {
      setFormError('Clause title and body text are required.');
      return;
    }
    setFormError(null);
    setFormSubmitting(true);
    try {
      const payload: ClauseCreateRequest = {
        clause_type: sanitizeString(clauseTypeInput),
        title: sanitizeString(clauseTitleInput),
        body_text: sanitizeString(clauseBodyInput),
        is_highlighted: clauseIsHighlightedInput,
      };
      if (onAddClause) {
        await onAddClause(payload);
      }
      setNoticeMessage(`Clause "${payload.title}" added successfully.`);
      setShowAddClauseModal(false);
      setClauseTitleInput('');
      setClauseBodyInput('');
      setClauseIsHighlightedInput(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add clause.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // SLA Submission Handler
  const handleCreateSLA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slaMetricNameInput.trim() || !slaTargetValueInput.trim()) {
      setFormError('SLA metric name and target value are required.');
      return;
    }
    setFormError(null);
    setFormSubmitting(true);
    try {
      const payload: SLACreateRequest = {
        metric_name: sanitizeString(slaMetricNameInput),
        target_value: sanitizeString(slaTargetValueInput),
        penalty_terms: slaPenaltyTermsInput.trim() ? sanitizeString(slaPenaltyTermsInput) : null,
      };
      if (onAddSLA) {
        await onAddSLA(payload);
      }
      setNoticeMessage(`SLA metric "${payload.metric_name}" added successfully.`);
      setShowAddSLAModal(false);
      setSlaMetricNameInput('');
      setSlaTargetValueInput('');
      setSlaPenaltyTermsInput('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add SLA target.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 1. UNAUTHORIZED ACCESS STATE [FR-1]
  // ---------------------------------------------------------------------------
  if (isUnauthorized) {
    const defaultDenialMsg =
      unauthorizedReason ||
      'Access Denied: You do not have sufficient role permissions to inspect agreement clauses, key terms, or active SLAs for this contract.';

    return (
      <div
        data-testid="clause-viewer"
        className={`bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg p-6 sm:p-8 space-y-6 ${className}`}
      >
        <div
          data-testid="unauthorized-message"
          role="alert"
          aria-live="assertive"
          className="bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded-lg p-6 text-[#1b1c19] space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#ffdad6] rounded-full shrink-0">
              <Lock className="w-6 h-6 text-[#93000a]" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <StatusLabel status="error" label="403 Forbidden" />
                <span className="text-xs font-mono font-semibold text-[#93000a] uppercase tracking-wider">
                  Access Restricted
                </span>
              </div>
              <h2 className="text-xl font-serif font-bold text-[#93000a]">
                Unauthorized Clause & SLA Inspection
              </h2>
              <p className="text-sm text-[#4e453d] leading-relaxed">{defaultDenialMsg}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-[#ba1a1a]/20 flex flex-wrap items-center justify-between gap-3 text-xs text-[#80756b]">
            <p>
              To request agreement viewing authorization, contact your organization admin or legal scope manager.
            </p>
            {onRefresh && (
              <button
                type="button"
                onClick={() => onRefresh()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#59452b] bg-[#f5f3ee] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                Re-check Access
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. LOADING STATE
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div
        data-testid="clause-viewer"
        role="status"
        aria-busy="true"
        aria-label="Loading contract clauses and SLAs"
        className={`bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg p-8 text-center space-y-4 ${className}`}
      >
        <div className="w-8 h-8 border-3 border-[#735c41] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-[#4e453d]">
          Loading active agreement clauses, key terms, and SLAs...
        </p>
        <span className="sr-only">Loading clauses content, please wait.</span>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 3. MAIN CLAUSE VIEWER INTERFACE [FR-1]
  // ---------------------------------------------------------------------------
  return (
    <div
      data-testid="clause-viewer"
      className={`bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg p-5 sm:p-6 shadow-sm space-y-6 ${className}`}
    >
      {/* Header Banner */}
      <header className="border-b border-[#d1c4b9]/50 pb-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#59452b]" aria-hidden="true" />
              <h2 className="text-2xl font-serif font-semibold text-[#1b1c19] tracking-tight">
                {contractTitle}
              </h2>
            </div>
            {counterparty && (
              <p className="text-xs text-[#4e453d]">
                Agreement with <span className="font-semibold text-[#1b1c19]">{counterparty}</span>
                {contractId && (
                  <span className="ml-2 font-mono text-[11px] text-[#80756b]">({contractId})</span>
                )}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <StatusLabel
              status={
                contractStatus === 'ACTIVE'
                  ? 'active'
                  : contractStatus === 'AMENDED'
                  ? 'info'
                  : contractStatus === 'PENDING_SIGNATURE'
                  ? 'pending'
                  : 'neutral'
              }
              label={contractStatus}
            />
            {onRefresh && (
              <button
                type="button"
                onClick={() => onRefresh()}
                className="p-1.5 text-[#59452b] bg-[#f5f3ee] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                aria-label="Refresh contract clauses and SLAs"
                title="Refresh clauses"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Contract Non-Active Status Warning */}
        {contractStatus !== 'ACTIVE' && contractStatus !== 'AMENDED' && (
          <div className="p-3 bg-[#f0eee9] border border-[#d1c4b9]/60 rounded-md text-xs text-[#4e453d] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#735c41] shrink-0" aria-hidden="true" />
            <span>
              This contract is currently in <strong className="text-[#1b1c19]">{contractStatus}</strong> status. Clauses and SLAs reflect terms pending final execution.
            </span>
          </div>
        )}

        {/* Global Error Banner if present */}
        {error && (
          <div role="alert" className="p-3 bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded-md text-xs text-[#93000a] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#ba1a1a] shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Action Notice Banner */}
        {noticeMessage && (
          <div
            role="status"
            className="p-3 bg-[#f0eee9] border border-[#735c41]/30 rounded-md text-xs font-medium text-[#59452b] flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
              <span>{noticeMessage}</span>
            </div>
            <button
              onClick={() => setNoticeMessage(null)}
              className="text-[#80756b] hover:text-[#1b1c19]"
              aria-label="Dismiss message"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </header>

      {/* Overview Stat Counters */}
      <section aria-label="Clauses and SLAs portfolio overview" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-md p-3 space-y-1">
          <span className="text-[11px] font-medium text-[#80756b] uppercase tracking-wider block">
            Total Clauses
          </span>
          <p className="text-xl font-serif font-bold text-[#1b1c19]">{clauses.length}</p>
        </div>

        <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-md p-3 space-y-1">
          <span className="text-[11px] font-medium text-[#80756b] uppercase tracking-wider block">
            Highlighted Terms
          </span>
          <div className="flex items-center justify-between">
            <p className="text-xl font-serif font-bold text-[#59452b]">
              {effectiveHighlightedClauses.length}
            </p>
            <Sparkles className="w-4 h-4 text-[#735c41]" aria-hidden="true" />
          </div>
        </div>

        <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-md p-3 space-y-1">
          <span className="text-[11px] font-medium text-[#80756b] uppercase tracking-wider block">
            Active SLAs
          </span>
          <div className="flex items-center justify-between">
            <p className="text-xl font-serif font-bold text-[#1b1c19]">{slas.length}</p>
            <Zap className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
          </div>
        </div>

        <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-md p-3 space-y-1">
          <span className="text-[11px] font-medium text-[#80756b] uppercase tracking-wider block">
            SLA Evaluation
          </span>
          <div className="pt-0.5">
            <StatusLabel
              status={
                evaluationResult
                  ? evaluationResult.breached_slas > 0
                    ? 'warning'
                    : 'active'
                  : slas.length > 0
                  ? 'operational'
                  : 'neutral'
              }
              label={
                evaluationResult
                  ? evaluationResult.breached_slas > 0
                    ? `${evaluationResult.breached_slas} Breached`
                    : 'All Met'
                  : 'Ready'
              }
            />
          </div>
        </div>
      </section>

      {/* Navigation Tabs & Search Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d1c4b9]/40 pb-3">
          {/* Main Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0" role="tablist" aria-label="Clause viewer section tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ALL'}
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41] ${
                activeTab === 'ALL'
                  ? 'bg-[#59452b] text-white shadow-sm'
                  : 'bg-[#f5f3ee] text-[#4e453d] hover:bg-[#eae8e3] border border-[#d1c4b9]/50'
              }`}
            >
              All Clauses ({clauses.length})
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'HIGHLIGHTED'}
              onClick={() => setActiveTab('HIGHLIGHTED')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41] ${
                activeTab === 'HIGHLIGHTED'
                  ? 'bg-[#59452b] text-white shadow-sm'
                  : 'bg-[#f5f3ee] text-[#4e453d] hover:bg-[#eae8e3] border border-[#d1c4b9]/50'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-[#f5d6b4]" aria-hidden="true" />
              Highlighted Terms ({effectiveHighlightedClauses.length})
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'SLAS'}
              onClick={() => setActiveTab('SLAS')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41] ${
                activeTab === 'SLAS'
                  ? 'bg-[#59452b] text-white shadow-sm'
                  : 'bg-[#f5f3ee] text-[#4e453d] hover:bg-[#eae8e3] border border-[#d1c4b9]/50'
              }`}
            >
              <Zap className="w-3.5 h-3.5" aria-hidden="true" />
              Active SLAs ({slas.length})
            </button>
          </div>

          {/* Action Buttons: Add Clause / Add SLA / Evaluate */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onEvaluateSLAs && (
              <button
                type="button"
                data-testid="evaluate-slas-button"
                onClick={handleEvaluateSLAs}
                disabled={isEvaluating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#59452b] bg-[#f5f3ee] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41] disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-bounce' : ''}`} aria-hidden="true" />
                <span>{isEvaluating ? 'Evaluating...' : 'Evaluate SLAs'}</span>
              </button>
            )}

            {onAddClause && (
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setShowAddClauseModal(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#59452b] hover:bg-[#735c41] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Clause</span>
              </button>
            )}

            {onAddSLA && (
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setShowAddSLAModal(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#59452b] bg-[#f0eee9] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add SLA</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Clause Type Filters Bar */}
        <div className="bg-[#f0eee9] p-3 rounded-md border border-[#d1c4b9]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Search Input */}
          <div className="relative flex-1">
            <label htmlFor="clause-search-input" className="sr-only">
              Search contract clauses or SLAs
            </label>
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-[#80756b]" aria-hidden="true" />
            </div>
            <input
              id="clause-search-input"
              data-testid="search-clauses-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clauses by title, body, or category..."
              className="block w-full pl-8 pr-3 py-1.5 text-xs bg-[#f5f3ee] border border-[#d1c4b9] rounded text-[#1b1c19] placeholder-[#80756b] focus:outline-none focus:ring-1 focus:ring-[#735c41]"
            />
          </div>

          {/* Clause Type Filter (When not in SLAs tab) */}
          {activeTab !== 'SLAS' && availableClauseTypes.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="clause-type-filter" className="font-semibold text-[#4e453d] flex items-center gap-1">
                <Filter className="w-3 h-3 text-[#59452b]" aria-hidden="true" />
                Type:
              </label>
              <select
                id="clause-type-filter"
                data-testid="clause-type-filter"
                value={selectedClauseType}
                onChange={(e) => setSelectedClauseType(e.target.value)}
                className="py-1 px-2.5 bg-[#f5f3ee] border border-[#d1c4b9] rounded text-xs text-[#1b1c19] focus:outline-none focus:ring-1 focus:ring-[#735c41]"
              >
                <option value="ALL">All Clause Types ({clauses.length})</option>
                {availableClauseTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Expand / Collapse All Helpers */}
          {activeTab !== 'SLAS' && filteredClauses.length > 0 && (
            <div className="flex items-center gap-2 shrink-0 text-[11px] text-[#59452b]">
              <button
                type="button"
                onClick={() => toggleAllClauses(true)}
                className="hover:underline font-medium focus:outline-none"
              >
                Expand All
              </button>
              <span>|</span>
              <button
                type="button"
                onClick={() => toggleAllClauses(false)}
                className="hover:underline font-medium focus:outline-none"
              >
                Collapse All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------------- */}
      {/* 4. HIGHLIGHTED CLAUSES SECTION [FR-1] */}
      {/* ----------------------------------------------------------------------- */}
      {(activeTab === 'HIGHLIGHTED' || (activeTab === 'ALL' && effectiveHighlightedClauses.length > 0 && !searchQuery)) && (
        <section
          data-testid="highlighted-clauses-section"
          aria-labelledby="highlighted-clauses-title"
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#735c41]" aria-hidden="true" />
              <h3 id="highlighted-clauses-title" className="text-base font-serif font-semibold text-[#1b1c19]">
                Highlighted Key Terms & Critical Clauses
              </h3>
            </div>
            <span className="text-xs text-[#80756b]">
              {effectiveHighlightedClauses.length} critical terms
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {effectiveHighlightedClauses.map((clause) => (
              <div
                key={`hl-${clause.id}`}
                data-testid={`clause-card-${clause.id}`}
                className="bg-[#f5f3ee] border-2 border-[#735c41]/40 rounded-lg p-4 space-y-3 shadow-xs relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-[#735c41] text-[#f5d6b4] text-[10px] font-mono font-bold px-2 py-0.5 rounded-bl">
                  KEY TERM
                </div>

                <div className="flex items-start justify-between gap-3 pr-16">
                  <div className="space-y-1">
                    <span className="inline-block bg-[#f0eee9] text-[#59452b] border border-[#d1c4b9]/60 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
                      {clause.clause_type}
                    </span>
                    <h4 className="font-serif font-semibold text-[#1b1c19] text-sm leading-snug">
                      {clause.title}
                    </h4>
                  </div>
                </div>

                <p className="text-xs text-[#4e453d] leading-relaxed line-clamp-3 bg-[#f0eee9]/60 p-2.5 rounded border border-[#d1c4b9]/30">
                  {clause.body_text}
                </p>

                <div className="flex items-center justify-between text-[11px] text-[#80756b] pt-1">
                  <span className="flex items-center gap-1 text-[#59452b] font-medium">
                    <Star className="w-3 h-3 text-[#735c41] fill-[#735c41]" aria-hidden="true" />
                    Enforced Key Provision
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleClauseExpanded(clause.id)}
                    className="text-[#59452b] hover:underline font-semibold focus:outline-none"
                  >
                    {expandedClauseIds[clause.id] ? 'Hide Full' : 'View Full'}
                  </button>
                </div>

                {expandedClauseIds[clause.id] && (
                  <div className="mt-3 pt-3 border-t border-[#d1c4b9]/50 text-xs text-[#1b1c19] bg-[#ffffff] p-3 rounded border border-[#d1c4b9]/40 space-y-2">
                    <span className="text-[10px] uppercase tracking-wider text-[#80756b] font-bold block">
                      Full Clause Wording
                    </span>
                    <p className="whitespace-pre-wrap font-sans leading-relaxed">{clause.body_text}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* 5. ALL CLAUSES SECTION */}
      {/* ----------------------------------------------------------------------- */}
      {activeTab !== 'SLAS' && (
        <section
          data-testid="all-clauses-section"
          aria-labelledby="all-clauses-title"
          className="space-y-3 pt-2"
        >
          <div className="flex items-center justify-between">
            <h3 id="all-clauses-title" className="text-base font-serif font-semibold text-[#1b1c19]">
              {activeTab === 'HIGHLIGHTED' ? 'Filtered Key Terms' : 'Contract Clauses'}
            </h3>
            <span className="text-xs text-[#80756b]">
              Showing {filteredClauses.length} of {clauses.length}
            </span>
          </div>

          {filteredClauses.length === 0 ? (
            <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-6 text-center space-y-2">
              <FileText className="w-8 h-8 text-[#80756b] mx-auto" aria-hidden="true" />
              <p className="text-sm font-semibold text-[#1b1c19]">No clauses match your current filter</p>
              <p className="text-xs text-[#4e453d]">
                Try clearing your search query or selecting a different clause category.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedClauseType('ALL');
                  setActiveTab('ALL');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-[#59452b] bg-[#f0eee9] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded transition-colors"
              >
                Reset Clause Filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClauses.map((clause) => {
                const isExpanded = !!expandedClauseIds[clause.id];
                return (
                  <article
                    key={clause.id}
                    data-testid={`clause-card-${clause.id}`}
                    className={`bg-[#f5f3ee] border rounded-lg p-4 transition-colors ${
                      clause.is_highlighted
                        ? 'border-[#735c41]/50 bg-[#f5f3ee]'
                        : 'border-[#d1c4b9]/50 hover:border-[#d1c4b9]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-[#f0eee9] text-[#59452b] border border-[#d1c4b9]/60 px-2 py-0.5 rounded text-[11px] font-mono font-semibold">
                            {clause.clause_type}
                          </span>
                          {clause.is_highlighted && (
                            <span className="inline-flex items-center gap-1 bg-[#f5d6b4]/40 text-[#59452b] border border-[#735c41]/30 px-2 py-0.5 rounded text-[11px] font-semibold">
                              <Star className="w-3 h-3 text-[#735c41] fill-[#735c41]" aria-hidden="true" />
                              Key Term
                            </span>
                          )}
                        </div>

                        <h4 className="font-serif font-semibold text-[#1b1c19] text-sm sm:text-base">
                          {clause.title}
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleClauseExpanded(clause.id)}
                        className="p-1.5 text-[#59452b] bg-[#f0eee9] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for clause ${clause.title}`}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    <div className="mt-3">
                      {isExpanded ? (
                        <div className="bg-[#ffffff] p-4 rounded border border-[#d1c4b9]/40 text-xs text-[#1b1c19] whitespace-pre-wrap leading-relaxed space-y-2">
                          <span className="text-[10px] uppercase tracking-wider text-[#80756b] font-bold block">
                            Full Clause Provision
                          </span>
                          <p>{clause.body_text}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-[#4e453d] line-clamp-2 leading-relaxed bg-[#f0eee9]/40 p-2.5 rounded border border-[#d1c4b9]/20">
                          {clause.body_text}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* 6. ACTIVE SLAS SECTION [FR-1] */}
      {/* ----------------------------------------------------------------------- */}
      {(activeTab === 'SLAS' || activeTab === 'ALL') && (
        <section
          data-testid="active-slas-section"
          aria-labelledby="active-slas-title"
          className="space-y-4 pt-4 border-t border-[#d1c4b9]/50"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#59452b]" aria-hidden="true" />
                <h3 id="active-slas-title" className="text-lg font-serif font-semibold text-[#1b1c19]">
                  Active Service Level Agreements (SLAs)
                </h3>
              </div>
              <p className="text-xs text-[#4e453d] mt-0.5">
                Contractual performance metrics, availability targets, and breach penalty conditions.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <StatusLabel
                status={slas.length > 0 ? 'operational' : 'neutral'}
                label={slas.length > 0 ? `${slas.length} Active SLA Targets` : 'No SLAs Defined'}
              />
            </div>
          </div>

          {/* SLA Cards Grid */}
          {filteredSLAs.length === 0 ? (
            <div className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-6 text-center space-y-2">
              <Zap className="w-8 h-8 text-[#80756b] mx-auto" aria-hidden="true" />
              <p className="text-sm font-semibold text-[#1b1c19]">No Service Level Agreements defined</p>
              <p className="text-xs text-[#4e453d]">
                No active SLA targets exist for this agreement, or search filters yielded zero matches.
              </p>
              {onAddSLA && (
                <button
                  type="button"
                  onClick={() => setShowAddSLAModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#59452b] hover:bg-[#735c41] rounded-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Define First SLA Target
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSLAs.map((sla) => {
                // Determine breach status from evaluation if available
                const isBreached = evaluationResult?.slas?.some(
                  (ev) => String(ev.metric_name) === sla.metric_name && ev.is_breached === true
                );

                return (
                  <div
                    key={sla.id}
                    data-testid={`sla-card-${sla.id}`}
                    className={`bg-[#f5f3ee] border rounded-lg p-4 space-y-3 shadow-xs relative ${
                      isBreached ? 'border-[#ba1a1a] bg-[#ffdad6]/20' : 'border-[#d1c4b9]/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
                          <h4 className="font-serif font-semibold text-[#1b1c19] text-base">
                            {sla.metric_name}
                          </h4>
                        </div>
                      </div>

                      <StatusLabel
                        status={isBreached ? 'error' : 'operational'}
                        label={isBreached ? 'BREACHED' : 'ACTIVE'}
                      />
                    </div>

                    <div className="p-3 bg-[#f0eee9] border border-[#d1c4b9]/40 rounded space-y-1">
                      <span className="text-[11px] font-semibold text-[#80756b] uppercase tracking-wider block">
                        Target Performance Threshold
                      </span>
                      <p className="text-lg font-mono font-bold text-[#59452b]">{sla.target_value}</p>
                    </div>

                    {sla.penalty_terms ? (
                      <div className="p-2.5 bg-[#f5f3ee] border border-[#d1c4b9]/30 rounded text-xs space-y-1">
                        <span className="text-[11px] font-semibold text-[#80756b] uppercase tracking-wider flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-[#735c41]" aria-hidden="true" />
                          Non-Compliance Penalty Terms
                        </span>
                        <p className="text-[#4e453d] leading-normal">{sla.penalty_terms}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-[#80756b] italic">No explicit financial penalty terms specified.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* 7. ADD CLAUSE MODAL */}
      {/* ----------------------------------------------------------------------- */}
      {showAddClauseModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-clause-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        >
          <div className="bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg max-w-lg w-full p-6 shadow-xl space-y-5 relative text-[#1b1c19]">
            <div className="flex items-center justify-between border-b border-[#d1c4b9]/50 pb-3">
              <h3 id="add-clause-modal-title" className="text-lg font-serif font-semibold text-[#1b1c19]">
                Add Agreement Clause
              </h3>
              <button
                type="button"
                onClick={() => setShowAddClauseModal(false)}
                className="text-[#80756b] hover:text-[#1b1c19]"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {formError && (
              <div role="alert" className="p-3 bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded text-xs text-[#93000a]">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateClause} className="space-y-4 text-xs">
              <div>
                <label htmlFor="clause-type-input" className="block font-semibold text-[#4e453d] mb-1">
                  Clause Type / Category
                </label>
                <input
                  id="clause-type-input"
                  type="text"
                  value={clauseTypeInput}
                  onChange={(e) => setClauseTypeInput(e.target.value)}
                  placeholder="e.g. Indemnification, SLA, Termination, Confidentiality"
                  className="w-full px-3 py-2 bg-[#f5f3ee] border border-[#d1c4b9] rounded focus:outline-none focus:ring-1 focus:ring-[#735c41]"
                  required
                />
              </div>

              <div>
                <label htmlFor="clause-title-input" className="block font-semibold text-[#4e453d] mb-1">
                  Clause Title
                </label>
                <input
                  id="clause-title-input"
                  type="text"
                  value={clauseTitleInput}
                  onChange={(e) => setClauseTitleInput(e.target.value)}
                  placeholder="e.g. Mutual Indemnification for Intellectual Property Claims"
                  className="w-full px-3 py-2 bg-[#f5f3ee] border border-[#d1c4b9] rounded focus:outline-none focus:ring-1 focus:ring-[#735c41]"
                  required
                />
              </div>

              <div>
                <label htmlFor="clause-body-input" className="block font-semibold text-[#4e453d] mb-1">
                  Full Provision Body Text
                </label>
                <textarea
                  id="clause-body-input"
                  rows={5}
                  value={clauseBodyInput}
                  onChange={(e) => setClauseBodyInput(e.target.value)}
                  placeholder="Enter full contractual text..."
                  className="w-full px-3 py-2 bg-[#f5f3ee] border border-[#d1c4b9] rounded focus:outline-none focus:ring-1 focus:ring-[#735c41]"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="clause-highlighted-checkbox"
                  type="checkbox"
                  checked={clauseIsHighlightedInput}
                  onChange={(e) => setClauseIsHighlightedInput(e.target.checked)}
                  className="rounded text-[#59452b] focus:ring-[#735c41]"
                />
                <label htmlFor="clause-highlighted-checkbox" className="font-semibold text-[#1b1c19]">
                  Mark as Highlighted Key Term
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#d1c4b9]/50">
                <button
                  type="button"
                  onClick={() => setShowAddClauseModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#59452b] bg-[#f5f3ee] border border-[#d1c4b9] rounded hover:bg-[#eae8e3]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#59452b] rounded hover:bg-[#735c41] disabled:opacity-50"
                >
                  {formSubmitting ? 'Adding...' : 'Add Clause'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* 8. ADD SLA MODAL */}
      {/* ----------------------------------------------------------------------- */}
      {showAddSLAModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-sla-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        >
          <div className="bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg max-w-lg w-full p-6 shadow-xl space-y-5 relative text-[#1b1c19]">
            <div className="flex items-center justify-between border-b border-[#d1c4b9]/50 pb-3">
              <h3 id="add-sla-modal-title" className="text-lg font-serif font-semibold text-[#1b1c19]">
                Add Service Level Agreement (SLA)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddSLAModal(false)}
                className="text-[#80756b] hover:text-[#1b1c19]"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {formError && (
              <div role="alert" className="p-3 bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded text-xs text-[#93000a]">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSLA} className="space-y-4 text-xs">
              <div>
                <label htmlFor="sla-metric-input" className="block font-semibold text-[#4e453d] mb-1">
                  Metric Name
                </label>
                <input
                  id="sla-metric-input"
                  type="text"
                  value={slaMetricNameInput}
                  onChange={(e) => setSlaMetricNameInput(e.target.value)}
                  placeholder="e.g. Uptime Guarantee, First Response Time, Latency SLA"
                  className="w-full px-3 py-2 bg-[#f5f3ee] border border-[#d1c4b9] rounded focus:outline-none focus:ring-1 focus:ring-[#735c41]"
                  required
                />
              </div>

              <div>
                <label htmlFor="sla-target-input" className="block font-semibold text-[#4e453d] mb-1">
                  Target Threshold Value
                </label>
                <input
                  id="sla-target-input"
                  type="text"
                  value={slaTargetValueInput}
                  onChange={(e) => setSlaTargetValueInput(e.target.value)}
                  placeholder="e.g. 99.9% uptime per calendar month"
                  className="w-full px-3 py-2 bg-[#f5f3ee] border border-[#d1c4b9] rounded focus:outline-none focus:ring-1 focus:ring-[#735c41]"
                  required
                />
              </div>

              <div>
                <label htmlFor="sla-penalty-input" className="block font-semibold text-[#4e453d] mb-1">
                  Penalty Terms (Optional)
                </label>
                <textarea
                  id="sla-penalty-input"
                  rows={3}
                  value={slaPenaltyTermsInput}
                  onChange={(e) => setSlaPenaltyTermsInput(e.target.value)}
                  placeholder="e.g. 10% monthly service credit for each 0.1% breach threshold"
                  className="w-full px-3 py-2 bg-[#f5f3ee] border border-[#d1c4b9] rounded focus:outline-none focus:ring-1 focus:ring-[#735c41]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#d1c4b9]/50">
                <button
                  type="button"
                  onClick={() => setShowAddSLAModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#59452b] bg-[#f5f3ee] border border-[#d1c4b9] rounded hover:bg-[#eae8e3]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#59452b] rounded hover:bg-[#735c41] disabled:opacity-50"
                >
                  {formSubmitting ? 'Adding...' : 'Add SLA Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClauseViewer;