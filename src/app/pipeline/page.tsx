'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Layers,
  Briefcase,
  Calendar,
  TrendingUp,
  Sparkles,
  Users,
  CheckSquare,
  AlertCircle,
  Plus,
  Trash2,
  Check,
  Clock,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Target,
  ShieldAlert,
  ArrowRight,
  X,
  Info,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import {
  DealResponse,
  PipelineBoardResponse,
  ActionItemResponse,
  ActionItemCreateRequest,
  getPipelineBoard,
  updateDealStage,
  getActionItems,
  createActionItem,
  completeActionItem,
  deleteActionItem,
  formatDealValue,
  formatAgeInDays,
  formatWinProbability,
} from '../../services/deals';
import { Board, DEFAULT_STAGES, getStageColorConfig } from '../../components/pipeline/Board';
import { DealCard } from '../../components/pipeline/DealCard';
import { StakeholderMap } from '../../components/pipeline/StakeholderMap';
import { ForecastWidget } from '../../components/pipeline/ForecastWidget';
import { StatusLabel } from '../../components/common/StatusLabel';
import { useAccessibility } from '../../components/common/AccessibilityContext';

/**
 * Fallback sample deals for visual demonstration when API data is sparse or unpopulated.
 */
const DEMO_DEALS: DealResponse[] = [
  {
    id: 'deal-101',
    title: 'Acme Corp Cloud Infrastructure Renewal',
    deal_value: 150000,
    milestone_stage: 'Qualification',
    win_probability: 0.25,
    age_in_days: 12,
    created_on: new Date(Date.now() - 12 * 86400000).toISOString(),
    updated_on: new Date().toISOString(),
  },
  {
    id: 'deal-102',
    title: 'Globex Enterprise Analytics Upgrade',
    deal_value: 320000,
    milestone_stage: 'Needs Analysis',
    win_probability: 0.45,
    age_in_days: 28,
    created_on: new Date(Date.now() - 28 * 86400000).toISOString(),
    updated_on: new Date().toISOString(),
  },
  {
    id: 'deal-103',
    title: 'Initech Security Compliance Suite',
    deal_value: 85000,
    milestone_stage: 'Proposal',
    win_probability: 0.65,
    age_in_days: 19,
    created_on: new Date(Date.now() - 19 * 86400000).toISOString(),
    updated_on: new Date().toISOString(),
  },
  {
    id: 'deal-104',
    title: 'Stark Industries AI Platform Expansion',
    deal_value: 500000,
    milestone_stage: 'Negotiation',
    win_probability: 0.85,
    age_in_days: 42,
    created_on: new Date(Date.now() - 42 * 86400000).toISOString(),
    updated_on: new Date().toISOString(),
  },
  {
    id: 'deal-105',
    title: 'Wayne Enterprises Global License',
    deal_value: 750000,
    milestone_stage: 'Closed Won',
    win_probability: 1.0,
    age_in_days: 60,
    created_on: new Date(Date.now() - 60 * 86400000).toISOString(),
    updated_on: new Date().toISOString(),
  },
];

export type InspectorTab = 'all' | 'forecast' | 'action_items' | 'stakeholders';

export default function PipelinePage() {
  const { announce } = useAccessibility();

  // Primary board and deals state
  const [boardData, setBoardData] = useState<PipelineBoardResponse | null>(null);
  const [deals, setDeals] = useState<DealResponse[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<DealResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('ALL');

  // Inspector Tab State
  const [activeTab, setActiveTab] = useState<InspectorTab>('all');

  // Action Items state for selected deal
  const [actionItems, setActionItems] = useState<ActionItemResponse[]>([]);
  const [isLoadingActionItems, setIsLoadingActionItems] = useState<boolean>(false);
  const [actionItemError, setActionItemError] = useState<string | null>(null);
  const [showAddActionForm, setShowAddActionForm] = useState<boolean>(false);

  // Action Item Creation Form fields
  const [newActionTitle, setNewActionTitle] = useState<string>('');
  const [newActionOwner, setNewActionOwner] = useState<string>('');
  const [newActionDueDate, setNewActionDueDate] = useState<string>('');
  const [newActionSlaHours, setNewActionSlaHours] = useState<number>(24);
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  /**
   * Fetch pipeline board data from API backend [FR-1, FR-2].
   */
  const loadPipelineBoard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const stageParam = selectedStageFilter !== 'ALL' ? selectedStageFilter : undefined;
      const data = await getPipelineBoard(stageParam);
      setBoardData(data);

      let loadedDeals: DealResponse[] = [];
      if (data.deals && data.deals.length > 0) {
        loadedDeals = data.deals;
      } else if (data.stages && data.stages.length > 0) {
        loadedDeals = data.stages.flatMap((s) => s.deals || []);
      }

      // Use demo deals fallback if API returned no records
      if (loadedDeals.length === 0) {
        loadedDeals = DEMO_DEALS;
      }

      setDeals(loadedDeals);

      // Auto-select first deal if no deal is selected or if current selection is stale
      setSelectedDeal((currentSelected) => {
        if (!currentSelected) {
          return loadedDeals[0] || null;
        }
        const updatedMatching = loadedDeals.find((d) => d.id === currentSelected.id);
        return updatedMatching || loadedDeals[0] || null;
      });

      announce(`Deal pipeline board updated with ${loadedDeals.length} deals.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load deal pipeline board';
      setError(msg);
      // Fallback to demo deals on error
      setDeals(DEMO_DEALS);
      if (!selectedDeal) {
        setSelectedDeal(DEMO_DEALS[0]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedStageFilter, announce, selectedDeal]);

  useEffect(() => {
    loadPipelineBoard();
  }, [selectedStageFilter]);

  /**
   * Fetch action items when selected deal changes [FR-4].
   */
  const loadActionItems = useCallback(async (dealId: string) => {
    if (!dealId) return;
    setIsLoadingActionItems(true);
    setActionItemError(null);
    try {
      const items = await getActionItems(dealId, true);
      setActionItems(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load action items';
      setActionItemError(msg);
      setActionItems([]);
    } finally {
      setIsLoadingActionItems(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDeal?.id) {
      loadActionItems(selectedDeal.id);
      setShowAddActionForm(false);
    } else {
      setActionItems([]);
    }
  }, [selectedDeal?.id, loadActionItems]);

  /**
   * Filtered deals based on search query and stage filter.
   */
  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      const matchesSearch =
        !searchQuery.trim() ||
        deal.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        deal.milestone_stage.toLowerCase().includes(searchQuery.trim().toLowerCase());

      const matchesStage =
        selectedStageFilter === 'ALL' ||
        deal.milestone_stage.toLowerCase() === selectedStageFilter.toLowerCase();

      return matchesSearch && matchesStage;
    });
  }, [deals, searchQuery, selectedStageFilter]);

  /**
   * Pipeline total summary statistics.
   */
  const summaryStats = useMemo(() => {
    const totalVal = deals.reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0);
    const count = deals.length;
    const highProbCount = deals.filter((d) => (d.win_probability || 0) >= 0.7).length;
    const avgAge = count > 0 ? Math.round(deals.reduce((s, d) => s + (d.age_in_days || 0), 0) / count) : 0;

    return {
      totalValue: totalVal,
      totalCount: count,
      highProbCount,
      avgAge,
    };
  }, [deals]);

  /**
   * Handle card selection on board or list [FR-1].
   */
  const handleSelectDeal = useCallback(
    (deal: DealResponse) => {
      setSelectedDeal(deal);
      announce(`Selected deal ${deal.title}.`);
    },
    [announce]
  );

  /**
   * Handle milestone stage update transition [FR-3].
   */
  const handleStageChange = useCallback(
    async (dealId: string, newStage: string, updatedDeal?: DealResponse) => {
      setDeals((prevDeals) =>
        prevDeals.map((d) => {
          if (d.id === dealId) {
            return updatedDeal || { ...d, milestone_stage: newStage, updated_on: new Date().toISOString() };
          }
          return d;
        })
      );

      if (selectedDeal?.id === dealId) {
        setSelectedDeal((prev) =>
          prev
            ? updatedDeal || { ...prev, milestone_stage: newStage, updated_on: new Date().toISOString() }
            : null
        );
      }

      announce(`Updated deal stage to ${newStage}.`);
    },
    [selectedDeal?.id, announce]
  );

  /**
   * Handle creating action item for selected deal [FR-4].
   */
  const handleCreateActionItem = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedDeal?.id) return;
      if (!newActionTitle.trim() || !newActionOwner.trim()) {
        setActionItemError('Please provide an action title and assigned owner ID.');
        return;
      }

      setIsSubmittingAction(true);
      setActionItemError(null);

      try {
        const payload: ActionItemCreateRequest = {
          title: newActionTitle.trim(),
          assigned_owner_id: newActionOwner.trim(),
          target_due_date: newActionDueDate
            ? new Date(newActionDueDate).toISOString()
            : new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          sla_threshold_hours: newActionSlaHours || 24,
        };

        const created = await createActionItem(selectedDeal.id, payload);
        setActionItems((prev) => [created, ...prev]);

        setNewActionTitle('');
        setNewActionOwner('');
        setNewActionDueDate('');
        setNewActionSlaHours(24);
        setShowAddActionForm(false);

        announce(`Created action item ${created.title}.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create action item';
        setActionItemError(msg);
      } finally {
        setIsSubmittingAction(false);
      }
    },
    [
      selectedDeal?.id,
      newActionTitle,
      newActionOwner,
      newActionDueDate,
      newActionSlaHours,
      announce,
    ]
  );

  /**
   * Handle completing action item [FR-4].
   */
  const handleCompleteActionItem = useCallback(
    async (itemId: string) => {
      if (!selectedDeal?.id || !itemId) return;
      try {
        const updated = await completeActionItem(selectedDeal.id, itemId);
        setActionItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
        announce('Action item marked as completed.');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to complete action item';
        setActionItemError(msg);
      }
    },
    [selectedDeal?.id, announce]
  );

  /**
   * Handle deleting action item [FR-4].
   */
  const handleDeleteActionItem = useCallback(
    async (itemId: string) => {
      if (!selectedDeal?.id || !itemId) return;
      try {
        await deleteActionItem(selectedDeal.id, itemId);
        setActionItems((prev) => prev.filter((item) => item.id !== itemId));
        announce('Action item deleted.');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete action item';
        setActionItemError(msg);
      }
    },
    [selectedDeal?.id, announce]
  );

  // Action items breakdown counts
  const actionItemsSummary = useMemo(() => {
    const total = actionItems.length;
    const completed = actionItems.filter((i) => i.is_completed).length;
    const escalated = actionItems.filter((i) => i.is_escalated && !i.is_completed).length;
    const overdue = actionItems.filter((i) => i.is_overdue && !i.is_completed).length;
    const active = total - completed;

    return { total, completed, escalated, overdue, active };
  }, [actionItems]);

  return (
    <div
      data-testid="pipeline-page"
      className="space-y-8 pb-12 text-[#1b1c19] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
    >
      {/* Visual Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#d1c4b9]/50 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#735c41] uppercase">
            <Briefcase className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
            <span>Sales Intelligence & Pipeline</span>
          </div>
          <h1 className="text-3-5xl font-serif font-normal text-[#1b1c19] tracking-tight">
            Visual Deal Pipeline
          </h1>
          <p className="text-sm text-[#4e453d] max-w-3xl">
            Interactive milestone stage management, AI-driven completion timeline forecasts, SLA action item tracking, and stakeholder influence feeds.
          </p>
        </div>

        {/* Global Stats Overview Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-3 rounded-xl bg-white border border-[#d1c4b9] shadow-sm flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#f5f3ee] text-[#59452b]">
              <DollarSign className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#4e453d] uppercase tracking-wider">
                Total Value
              </div>
              <div
                data-testid="page-summary-total-value"
                className="text-base font-bold text-[#59452b]"
              >
                {formatDealValue(summaryStats.totalValue)}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white border border-[#d1c4b9] shadow-sm flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#f5f3ee] text-[#59452b]">
              <Layers className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#4e453d] uppercase tracking-wider">
                Active Deals
              </div>
              <div
                data-testid="page-summary-deal-count"
                className="text-base font-bold text-[#1b1c19]"
              >
                {summaryStats.totalCount}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white border border-[#d1c4b9] shadow-sm flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#f5f3ee] text-[#59452b]">
              <Clock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#4e453d] uppercase tracking-wider">
                Avg Deal Age
              </div>
              <div className="text-base font-bold text-[#1b1c19]">
                {formatAgeInDays(summaryStats.avgAge)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Toolbar: Search, Stage Filter & Refresh */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-[#d1c4b9] shadow-sm">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#80756b]"
            aria-hidden="true"
          />
          <input
            type="text"
            data-testid="pipeline-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deals by title or stage..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[#d1c4b9] bg-[#fbf9f4] text-[#1b1c19] placeholder:text-[#80756b] focus:outline-none focus:ring-2 focus:ring-[#735c41] transition-all"
            aria-label="Search deals by title or stage"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#80756b] hover:text-[#1b1c19]"
              aria-label="Clear search query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Stage Filter Dropdown & Refresh */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
            <label htmlFor="stage-filter" className="text-xs font-medium text-[#4e453d] uppercase">
              Filter Stage:
            </label>
            <select
              id="stage-filter"
              data-testid="pipeline-stage-filter-select"
              value={selectedStageFilter}
              onChange={(e) => setSelectedStageFilter(e.target.value)}
              className="py-1.5 px-3 text-sm rounded-lg border border-[#d1c4b9] bg-[#fbf9f4] text-[#1b1c19] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
            >
              <option value="ALL">All Stages</option>
              {DEFAULT_STAGES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            data-testid="pipeline-refresh-button"
            onClick={loadPipelineBoard}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#1b1c19] border border-[#d1c4b9] transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]"
          >
            <RefreshCw
              className={isLoading ? 'w-4 h-4 animate-spin text-[#59452b]' : 'w-4 h-4 text-[#59452b]'}
              aria-hidden="true"
            />
            <span>Refresh Board</span>
          </button>
        </div>
      </div>

      {/* Global Page Error Alert */}
      {error && (
        <div
          data-testid="pipeline-error-alert"
          className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" aria-hidden="true" />
          <span className="flex-1 font-medium">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs font-bold underline hover:text-rose-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Interactive Visual Deal Pipeline Board Section [FR-1, FR-3]          */}
      {/* ------------------------------------------------------------------- */}
      <section aria-label="Visual Deal Pipeline Board">
        <Board
          initialBoard={boardData || undefined}
          deals={filteredDeals}
          isLoading={isLoading}
          error={error}
          onRefresh={loadPipelineBoard}
          onSelectDeal={handleSelectDeal}
          onStageChange={handleStageChange}
        />
      </section>

      {/* ------------------------------------------------------------------- */}
      {/* Selected Deal Intelligence Inspector Workspace                      */}
      {/* (Combines ForecastWidget, Action Items SLA, StakeholderMap)         */}
      {/* ------------------------------------------------------------------- */}
      {selectedDeal ? (
        <section
          data-testid="deal-inspector-section"
          className="rounded-2xl bg-white border border-[#d1c4b9] shadow-md p-6 space-y-6"
          aria-label={`Deal Details Inspector for ${selectedDeal.title}`}
        >
          {/* Selected Deal Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e4e2dd] pb-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f5f3ee] text-[#4e453d] border border-[#e4e2dd]">
                  ID: {selectedDeal.id}
                </span>
                <StatusLabel status="info" label={selectedDeal.milestone_stage} />
                <span className="text-xs font-semibold text-[#59452b] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Win Prob: {formatWinProbability(selectedDeal.win_probability)}
                </span>
              </div>
              <h2 className="text-2xl font-serif font-bold text-[#1b1c19] tracking-tight">
                {selectedDeal.title}
              </h2>
              <div className="flex items-center gap-4 text-xs text-[#4e453d]">
                <span>
                  Value:{' '}
                  <strong className="text-[#59452b] font-semibold">
                    {formatDealValue(selectedDeal.deal_value)}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Age:{' '}
                  <strong className="text-[#1b1c19] font-medium">
                    {formatAgeInDays(selectedDeal.age_in_days)}
                  </strong>
                </span>
                <span>•</span>
                <span>Updated: {new Date(selectedDeal.updated_on).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Quick Stage Change Control */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="quick-stage-select"
                className="text-xs font-semibold text-[#4e453d] uppercase tracking-wider"
              >
                Change Stage:
              </label>
              <select
                id="quick-stage-select"
                data-testid="quick-stage-select"
                value={selectedDeal.milestone_stage}
                onChange={(e) => handleStageChange(selectedDeal.id, e.target.value)}
                className="py-1.5 px-3 text-sm rounded-lg border border-[#d1c4b9] bg-[#fbf9f4] font-medium text-[#1b1c19] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
              >
                {DEFAULT_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Inspector View Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-[#e4e2dd] overflow-x-auto pb-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'all'}
              data-testid="tab-all"
              onClick={() => setActiveTab('all')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#735c41] ${
                activeTab === 'all'
                  ? 'border-[#59452b] text-[#59452b] bg-[#f5f3ee]/80 font-bold'
                  : 'border-transparent text-[#4e453d] hover:text-[#1b1c19] hover:bg-[#f5f3ee]/40'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Full Intelligence Overview</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'forecast'}
              data-testid="tab-forecast"
              onClick={() => setActiveTab('forecast')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#735c41] ${
                activeTab === 'forecast'
                  ? 'border-[#59452b] text-[#59452b] bg-[#f5f3ee]/80 font-bold'
                  : 'border-transparent text-[#4e453d] hover:text-[#1b1c19] hover:bg-[#f5f3ee]/40'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span>AI Completion Forecast</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'action_items'}
              data-testid="tab-action-items"
              onClick={() => setActiveTab('action_items')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#735c41] ${
                activeTab === 'action_items'
                  ? 'border-[#59452b] text-[#59452b] bg-[#f5f3ee]/80 font-bold'
                  : 'border-transparent text-[#4e453d] hover:text-[#1b1c19] hover:bg-[#f5f3ee]/40'
              }`}
            >
              <CheckSquare className="w-4 h-4 shrink-0 text-blue-600" aria-hidden="true" />
              <span>SLA Action Items</span>
              {actionItemsSummary.total > 0 && (
                <span
                  data-testid="action-items-count-badge"
                  className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 font-semibold"
                >
                  {actionItemsSummary.total}
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'stakeholders'}
              data-testid="tab-stakeholders"
              onClick={() => setActiveTab('stakeholders')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#735c41] ${
                activeTab === 'stakeholders'
                  ? 'border-[#59452b] text-[#59452b] bg-[#f5f3ee]/80 font-bold'
                  : 'border-transparent text-[#4e453d] hover:text-[#1b1c19] hover:bg-[#f5f3ee]/40'
              }`}
            >
              <Users className="w-4 h-4 shrink-0 text-purple-600" aria-hidden="true" />
              <span>Stakeholder Map & Feed</span>
            </button>
          </div>

          {/* Tab Content Panels */}
          <div className="space-y-6 pt-2">
            {/* --------------------------------------------------------------- */}
            {/* FORECAST PANEL                                                   */}
            {/* --------------------------------------------------------------- */}
            {(activeTab === 'all' || activeTab === 'forecast') && (
              <div data-testid="forecast-section-container" className="space-y-3">
                {activeTab === 'all' && (
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#735c41]">
                    <Sparkles className="w-4 h-4 text-amber-600" aria-hidden="true" />
                    <span>AI Completion Timeline Forecast</span>
                  </div>
                )}
                <ForecastWidget dealId={selectedDeal.id} />
              </div>
            )}

            {/* --------------------------------------------------------------- */}
            {/* ACTION ITEMS SLA PANEL                                          */}
            {/* --------------------------------------------------------------- */}
            {(activeTab === 'all' || activeTab === 'action_items') && (
              <div
                data-testid="action-items-section-container"
                className="p-5 rounded-xl bg-[#fbf9f4] border border-[#d1c4b9] space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e4e2dd] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                      <CheckSquare className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1b1c19]">
                        Deal Action Items & SLA Tracking
                      </h3>
                      <p className="text-xs text-[#4e453d]">
                        Task assignments, target due dates, and SLA breach escalation management
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="toggle-add-action-button"
                      onClick={() => setShowAddActionForm((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#59452b] text-white hover:bg-[#735c41] transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Add Action Item</span>
                    </button>
                  </div>
                </div>

                {/* Action Items Error Banner */}
                {actionItemError && (
                  <div
                    data-testid="action-item-error-banner"
                    className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between"
                  >
                    <span>{actionItemError}</span>
                    <button
                      type="button"
                      onClick={() => setActionItemError(null)}
                      className="font-bold underline text-rose-900"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Inline Action Item Creation Form */}
                {showAddActionForm && (
                  <form
                    data-testid="add-action-item-form"
                    onSubmit={handleCreateActionItem}
                    className="p-4 rounded-xl bg-white border border-[#d1c4b9] space-y-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-[#e4e2dd] pb-2">
                      <h4 className="text-sm font-bold text-[#1b1c19]">
                        Assign New Action Item
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowAddActionForm(false)}
                        className="text-[#80756b] hover:text-[#1b1c19]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <label htmlFor="action-title" className="font-medium text-[#4e453d]">
                          Action Title *
                        </label>
                        <input
                          id="action-title"
                          type="text"
                          data-testid="action-title-input"
                          value={newActionTitle}
                          onChange={(e) => setNewActionTitle(e.target.value)}
                          placeholder="e.g., Deliver Security Architecture Whitepaper"
                          required
                          className="w-full p-2 rounded-lg border border-[#d1c4b9] bg-[#fbf9f4] text-[#1b1c19] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="action-owner" className="font-medium text-[#4e453d]">
                          Assigned Owner ID / Email *
                        </label>
                        <input
                          id="action-owner"
                          type="text"
                          data-testid="action-owner-input"
                          value={newActionOwner}
                          onChange={(e) => setNewActionOwner(e.target.value)}
                          placeholder="e.g., sales.rep@company.com"
                          required
                          className="w-full p-2 rounded-lg border border-[#d1c4b9] bg-[#fbf9f4] text-[#1b1c19] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="action-due-date" className="font-medium text-[#4e453d]">
                          Target Due Date
                        </label>
                        <input
                          id="action-due-date"
                          type="datetime-local"
                          data-testid="action-due-date-input"
                          value={newActionDueDate}
                          onChange={(e) => setNewActionDueDate(e.target.value)}
                          className="w-full p-2 rounded-lg border border-[#d1c4b9] bg-[#fbf9f4] text-[#1b1c19] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="action-sla-hours" className="font-medium text-[#4e453d]">
                          SLA Threshold (Hours)
                        </label>
                        <input
                          id="action-sla-hours"
                          type="number"
                          data-testid="action-sla-hours-input"
                          value={newActionSlaHours}
                          onChange={(e) => setNewActionSlaHours(Number(e.target.value) || 24)}
                          min={1}
                          max={168}
                          className="w-full p-2 rounded-lg border border-[#d1c4b9] bg-[#fbf9f4] text-[#1b1c19] focus:outline-none focus:ring-2 focus:ring-[#735c41]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddActionForm(false)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-[#d1c4b9] text-[#4e453d] hover:bg-[#f5f3ee]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        data-testid="submit-action-item-button"
                        disabled={isSubmittingAction}
                        className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#59452b] text-white hover:bg-[#735c41] transition-colors"
                      >
                        {isSubmittingAction ? 'Assigning...' : 'Save Action Item'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Action Items List */}
                {isLoadingActionItems ? (
                  <div
                    data-testid="action-items-loading-skeleton"
                    className="p-4 text-center text-xs text-[#80756b] animate-pulse"
                  >
                    Loading deal action items...
                  </div>
                ) : actionItems.length === 0 ? (
                  <div
                    data-testid="action-items-empty-state"
                    className="p-6 text-center rounded-xl bg-white border border-[#e4e2dd] space-y-2"
                  >
                    <CheckSquare className="w-8 h-8 text-[#80756b] mx-auto" aria-hidden="true" />
                    <p className="text-sm font-medium text-[#1b1c19]">
                      No action items assigned to this deal yet.
                    </p>
                    <p className="text-xs text-[#4e453d]">
                      Click &quot;Add Action Item&quot; above to create and track owner SLA commitments.
                    </p>
                  </div>
                ) : (
                  <div
                    data-testid="action-items-list"
                    className="space-y-3 max-h-96 overflow-y-auto pr-1"
                  >
                    {actionItems.map((item) => {
                      return (
                        <div
                          key={item.id}
                          data-testid={`action-item-card-${item.id}`}
                          className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            item.is_completed
                              ? 'bg-emerald-50/40 border-emerald-200 text-[#4e453d]'
                              : item.is_escalated
                              ? 'bg-rose-50/70 border-rose-300'
                              : item.is_overdue
                              ? 'bg-amber-50/70 border-amber-300'
                              : 'bg-white border-[#d1c4b9]'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5
                                className={`text-sm font-bold ${
                                  item.is_completed ? 'line-through text-[#80756b]' : 'text-[#1b1c19]'
                                }`}
                              >
                                {item.title}
                              </h5>

                              {item.is_completed && (
                                <StatusLabel status="success" label="Completed" />
                              )}
                              {item.is_escalated && !item.is_completed && (
                                <StatusLabel status="error" label="SLA Escalated" />
                              )}
                              {item.is_overdue && !item.is_escalated && !item.is_completed && (
                                <StatusLabel status="warning" label="Overdue" />
                              )}
                              {!item.is_completed && !item.is_escalated && !item.is_overdue && (
                                <StatusLabel status="info" label="Active" />
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-[#4e453d]">
                              <span>Owner: {item.assigned_owner_id}</span>
                              <span>•</span>
                              <span>
                                Due: {new Date(item.target_due_date).toLocaleDateString()}
                              </span>
                              <span>•</span>
                              <span>SLA: {item.sla_threshold_hours}h</span>
                            </div>
                          </div>

                          {/* Action Item Controls */}
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {!item.is_completed && (
                              <button
                                type="button"
                                data-testid={`complete-action-button-${item.id}`}
                                onClick={() => handleCompleteActionItem(item.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-100 text-emerald-900 hover:bg-emerald-200 border border-emerald-300 transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Complete</span>
                              </button>
                            )}

                            <button
                              type="button"
                              data-testid={`delete-action-button-${item.id}`}
                              onClick={() => handleDeleteActionItem(item.id)}
                              className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-100 transition-colors"
                              title="Delete action item"
                              aria-label={`Delete action item ${item.title}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* --------------------------------------------------------------- */}
            {/* STAKEHOLDER MAP & CRM ACTIVITY FEED PANEL [FR-6, FR-7]           */}
            {/* --------------------------------------------------------------- */}
            {(activeTab === 'all' || activeTab === 'stakeholders') && (
              <div data-testid="stakeholder-map-section-container">
                <StakeholderMap dealId={selectedDeal.id} />
              </div>
            )}
          </div>
        </section>
      ) : (
        /* Empty Deal Selection State */
        <div
          data-testid="no-deal-selected-state"
          className="p-12 text-center rounded-2xl bg-white border border-[#d1c4b9] space-y-3"
        >
          <Briefcase className="w-12 h-12 text-[#80756b] mx-auto" aria-hidden="true" />
          <h3 className="text-lg font-bold text-[#1b1c19]">No Deal Selected</h3>
          <p className="text-sm text-[#4e453d] max-w-md mx-auto">
            Select any deal card from the visual pipeline board above to inspect AI completion timeline forecasts, manage SLA action items, and view mapped stakeholders.
          </p>
        </div>
      )}
    </div>
  );
}
