'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Layers,
  Briefcase,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  DealResponse,
  PipelineBoardResponse,
  PipelineStageGroupResponse,
  updateDealStage,
} from '../../services/deals';
import { DealCard, formatDealValue } from './DealCard';

export const DEFAULT_STAGES = [
  'Qualification',
  'Needs Analysis',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
];

export interface StageColorConfig {
  border: string;
  bg: string;
  headerBg: string;
  headerText: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
}

/**
 * Helper to get color configuration based on milestone stage name [FR-1].
 */
export function getStageColorConfig(stageName: string): StageColorConfig {
  const normalized = (stageName || '').trim().toLowerCase();

  switch (normalized) {
    case 'qualification':
      return {
        border: 'border-blue-300',
        bg: 'bg-blue-50/50',
        headerBg: 'bg-blue-100/80',
        headerText: 'text-blue-900',
        badgeBg: 'bg-blue-200/70',
        badgeText: 'text-blue-800',
        dotColor: 'bg-blue-500',
      };
    case 'needs analysis':
    case 'discovery':
      return {
        border: 'border-amber-300',
        bg: 'bg-amber-50/50',
        headerBg: 'bg-amber-100/80',
        headerText: 'text-amber-900',
        badgeBg: 'bg-amber-200/70',
        badgeText: 'text-amber-800',
        dotColor: 'bg-amber-500',
      };
    case 'proposal':
      return {
        border: 'border-purple-300',
        bg: 'bg-purple-50/50',
        headerBg: 'bg-purple-100/80',
        headerText: 'text-purple-900',
        badgeBg: 'bg-purple-200/70',
        badgeText: 'text-purple-800',
        dotColor: 'bg-purple-500',
      };
    case 'negotiation':
      return {
        border: 'border-orange-300',
        bg: 'bg-orange-50/50',
        headerBg: 'bg-orange-100/80',
        headerText: 'text-orange-900',
        badgeBg: 'bg-orange-200/70',
        badgeText: 'text-orange-800',
        dotColor: 'bg-orange-500',
      };
    case 'closed won':
    case 'won':
      return {
        border: 'border-emerald-300',
        bg: 'bg-emerald-50/50',
        headerBg: 'bg-emerald-100/80',
        headerText: 'text-emerald-900',
        badgeBg: 'bg-emerald-200/70',
        badgeText: 'text-emerald-800',
        dotColor: 'bg-emerald-500',
      };
    case 'closed lost':
    case 'lost':
      return {
        border: 'border-rose-300',
        bg: 'bg-rose-50/50',
        headerBg: 'bg-rose-100/80',
        headerText: 'text-rose-900',
        badgeBg: 'bg-rose-200/70',
        badgeText: 'text-rose-800',
        dotColor: 'bg-rose-500',
      };
    default:
      return {
        border: 'border-[#d1c4b9]',
        bg: 'bg-[#f5f3ee]/50',
        headerBg: 'bg-[#eae8e3]',
        headerText: 'text-[#1b1c19]',
        badgeBg: 'bg-[#e4e2dd]',
        badgeText: 'text-[#4e453d]',
        dotColor: 'bg-[#80756b]',
      };
  }
}

/**
 * Calculate totals for a collection of deal objects.
 */
export function calculateDealsTotals(deals: DealResponse[]): { totalValue: number; dealCount: number } {
  const totalValue = deals.reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0);
  return {
    totalValue,
    dealCount: deals.length,
  };
}

export interface BoardProps {
  /**
   * Initial board dataset containing pre-grouped stages and deals [FR-1]
   */
  initialBoard?: PipelineBoardResponse;
  /**
   * Un-grouped flat deal list to group into milestone stage columns
   */
  deals?: DealResponse[];
  /**
   * Custom stage order list (defaults to DEFAULT_STAGES)
   */
  stages?: string[];
  /**
   * Callback invoked when a deal is moved to a new milestone stage [FR-3]
   */
  onStageChange?: (dealId: string, newStage: string, updatedDeal?: DealResponse) => void | Promise<void>;
  /**
   * Callback when a deal card is selected/clicked
   */
  onSelectDeal?: (deal: DealResponse) => void;
  /**
   * External loading state
   */
  isLoading?: boolean;
  /**
   * External error state message
   */
  error?: string | null;
  /**
   * Refresh trigger callback
   */
  onRefresh?: () => void | Promise<void>;
  /**
   * Optional custom CSS class name
   */
  className?: string;
}

export const Board: React.FC<BoardProps> = ({
  initialBoard,
  deals: propDeals,
  stages: customStages,
  onStageChange,
  onSelectDeal,
  isLoading: propIsLoading = false,
  error: propError = null,
  onRefresh,
  className,
}) => {
  // Resolve stage names list
  const activeStages = useMemo(() => {
    if (customStages && customStages.length > 0) {
      return customStages;
    }
    if (initialBoard?.stages && initialBoard.stages.length > 0) {
      const stagesFromBoard = initialBoard.stages.map((s) => s.milestone_stage);
      const stageSet = new Set(stagesFromBoard);
      const combined = [...stagesFromBoard];
      for (const st of DEFAULT_STAGES) {
        if (!stageSet.has(st)) {
          combined.push(st);
        }
      }
      return combined;
    }
    return DEFAULT_STAGES;
  }, [customStages, initialBoard]);

  // Internal state for deals list (for optimistic stage transitions)
  const [dealsList, setDealsList] = useState<DealResponse[]>(() => {
    if (propDeals && propDeals.length > 0) {
      return propDeals;
    }
    if (initialBoard?.deals && initialBoard.deals.length > 0) {
      return initialBoard.deals;
    }
    if (initialBoard?.stages) {
      return initialBoard.stages.flatMap((s) => s.deals || []);
    }
    return [];
  });

  // Drag and drop tracking state
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [updatingDealId, setUpdatingDealId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(propError);

  // Sync internal deals list if props change externally
  useEffect(() => {
    if (propDeals && propDeals.length > 0) {
      setDealsList(propDeals);
    } else if (initialBoard?.deals && initialBoard.deals.length > 0) {
      setDealsList(initialBoard.deals);
    } else if (initialBoard?.stages) {
      const extracted = initialBoard.stages.flatMap((s) => s.deals || []);
      if (extracted.length > 0) {
        setDealsList(extracted);
      }
    }
  }, [propDeals, initialBoard]);

  useEffect(() => {
    setErrorMessage(propError);
  }, [propError]);

  // Group deals by stage column
  const groupedColumns = useMemo(() => {
    const map = new Map<string, DealResponse[]>();
    for (const stage of activeStages) {
      map.set(stage.toLowerCase(), []);
    }

    for (const deal of dealsList) {
      const stageKey = (deal.milestone_stage || '').trim().toLowerCase();
      if (!map.has(stageKey)) {
        map.set(stageKey, []);
      }
      map.get(stageKey)!.push(deal);
    }

    const stageGroups: PipelineStageGroupResponse[] = [];
    for (const stage of activeStages) {
      const stageKey = stage.toLowerCase();
      const stageDeals = map.get(stageKey) || [];
      const { totalValue, dealCount } = calculateDealsTotals(stageDeals);
      stageGroups.push({
        milestone_stage: stage,
        total_value: totalValue,
        deal_count: dealCount,
        deals: stageDeals,
      });
    }

    return stageGroups;
  }, [activeStages, dealsList]);

  // Total board summary calculations
  const totalPipelineValue = useMemo(() => {
    return dealsList.reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0);
  }, [dealsList]);

  const totalDealCount = dealsList.length;

  /**
   * Handle updating deal milestone stage (optimistically and via API) [FR-3, NFR-1]
   */
  const handleStageTransition = useCallback(
    async (dealId: string, targetStage: string) => {
      if (!dealId || !targetStage) return;

      const currentDeal = dealsList.find((d) => d.id === dealId);
      if (!currentDeal) return;

      if (currentDeal.milestone_stage.toLowerCase() === targetStage.toLowerCase()) {
        return; // No change needed
      }

      setUpdatingDealId(dealId);
      setErrorMessage(null);

      // Optimistic update: move deal to new stage immediately (< 2s latency)
      const now = new Date().toISOString();
      const updatedDealOptimistic: DealResponse = {
        ...currentDeal,
        milestone_stage: targetStage,
        updated_on: now,
      };

      setDealsList((prevDeals) =>
        prevDeals.map((d) => (d.id === dealId ? updatedDealOptimistic : d))
      );

      try {
        // Dispatch API request to update stage on backend
        const serverUpdatedDeal = await updateDealStage(dealId, {
          milestone_stage: targetStage,
        });

        // Re-sync with server response
        setDealsList((prevDeals) =>
          prevDeals.map((d) => (d.id === dealId ? serverUpdatedDeal : d))
        );

        if (onStageChange) {
          await onStageChange(dealId, targetStage, serverUpdatedDeal);
        }
      } catch (err: unknown) {
        // Revert optimistic update on failure
        setDealsList((prevDeals) =>
          prevDeals.map((d) => (d.id === dealId ? currentDeal : d))
        );
        const errStr = err instanceof Error ? err.message : 'Failed to update deal stage';
        setErrorMessage(errStr);
      } finally {
        setUpdatingDealId(null);
      }
    },
    [dealsList, onStageChange]
  );

  // Drag Event Handlers
  const handleDragStart = useCallback((e: React.DragEvent, deal: DealResponse) => {
    setDraggingDealId(deal.id);
    e.dataTransfer.setData('text/plain', deal.id);
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ dealId: deal.id, sourceStage: deal.milestone_stage })
    );
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingDealId(null);
    setDragOverStage(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stageName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageName);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, stageName: string) => {
    e.preventDefault();
    setDragOverStage((prev) => (prev === stageName ? null : prev));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetStage: string) => {
      e.preventDefault();
      setDragOverStage(null);

      let droppedDealId = draggingDealId;
      if (!droppedDealId) {
        const rawJson = e.dataTransfer.getData('application/json');
        if (rawJson) {
          try {
            const parsed = JSON.parse(rawJson);
            droppedDealId = parsed.dealId;
          } catch {
            // fallback
          }
        }
        if (!droppedDealId) {
          droppedDealId = e.dataTransfer.getData('text/plain');
        }
      }

      if (droppedDealId) {
        handleStageTransition(droppedDealId, targetStage);
      }
      setDraggingDealId(null);
    },
    [draggingDealId, handleStageTransition]
  );

  return (
    <div
      data-testid="pipeline-board"
      role="region"
      aria-label="Visual Deal Pipeline Board"
      className={twMerge('flex flex-col gap-6 w-full text-[#1b1c19]', className)}
    >
      {/* Board Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white border border-[#d1c4b9] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#f5f3ee] border border-[#e4e2dd] text-[#59452b]">
            <Layers className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#1b1c19]">
              Deal Pipeline Board
            </h2>
            <p className="text-xs text-[#4e453d]">
              Interactive visual milestone progression and drag-and-drop stage transitions
            </p>
          </div>
        </div>

        {/* Board Totals Bar */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#4e453d] uppercase tracking-wider font-medium">
              Total Pipeline:
            </span>
            <span
              data-testid="pipeline-summary-total-value"
              className="text-base font-bold text-[#59452b]"
            >
              {formatDealValue(totalPipelineValue)}
            </span>
          </div>

          <div className="h-4 w-px bg-[#d1c4b9]" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#4e453d] uppercase tracking-wider font-medium">
              Total Deals:
            </span>
            <span
              data-testid="pipeline-summary-deal-count"
              className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#f5f3ee] text-[#4e453d] border border-[#e4e2dd]"
            >
              {totalDealCount}
            </span>
          </div>

          {onRefresh && (
            <button
              type="button"
              data-testid="board-refresh-button"
              onClick={onRefresh}
              disabled={propIsLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#f5f3ee] hover:bg-[#eae8e3] text-[#4e453d] border border-[#d1c4b9] transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]"
            >
              <RefreshCw
                className={clsx('w-3.5 h-3.5', propIsLoading && 'animate-spin')}
                aria-hidden="true"
              />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div
          data-testid="board-error-banner"
          className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
          <span className="flex-1">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold underline hover:text-rose-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading Skeleton View */}
      {propIsLoading && dealsList.length === 0 && (
        <div data-testid="board-loading-skeleton" className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-pulse">
          {DEFAULT_STAGES.map((st) => (
            <div key={st} className="h-96 rounded-xl bg-[#f5f3ee] border border-[#e4e2dd] p-4 flex flex-col gap-4">
              <div className="h-6 bg-[#e4e2dd] rounded w-3/4" />
              <div className="h-24 bg-[#e4e2dd] rounded-lg" />
              <div className="h-24 bg-[#e4e2dd] rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Milestone Columns Container */}
      <div
        data-testid="stage-columns-container"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start min-h-[500px]"
      >
        {groupedColumns.map((col) => {
          const colorConfig = getStageColorConfig(col.milestone_stage);
          const isTargetDragOver = dragOverStage === col.milestone_stage;

          return (
            <div
              key={col.milestone_stage}
              data-testid="stage-column"
              data-stage={col.milestone_stage}
              role="region"
              aria-label={`Milestone column ${col.milestone_stage}, Total Value: ${formatDealValue(col.total_value)}, Deals: ${col.deal_count}`}
              onDragOver={(e) => handleDragOver(e, col.milestone_stage)}
              onDragLeave={(e) => handleDragLeave(e, col.milestone_stage)}
              onDrop={(e) => handleDrop(e, col.milestone_stage)}
              className={twMerge(
                clsx(
                  'flex flex-col gap-3 rounded-xl p-3 border transition-all duration-200 min-h-[450px]',
                  colorConfig.bg,
                  colorConfig.border,
                  isTargetDragOver && 'ring-2 ring-[#735c41] ring-offset-2 border-dashed bg-white shadow-md scale-[1.01]'
                )
              )}
            >
              {/* Column Header */}
              <div
                className={clsx(
                  'flex flex-col gap-1 p-2.5 rounded-lg border border-black/5 shadow-2xs',
                  colorConfig.headerBg
                )}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span
                      className={clsx('w-2 h-2 rounded-full shrink-0', colorConfig.dotColor)}
                      aria-hidden="true"
                    />
                    <h3
                      data-testid="column-title"
                      className={clsx('font-bold text-sm truncate', colorConfig.headerText)}
                    >
                      {col.milestone_stage}
                    </h3>
                  </div>

                  <span
                    data-testid="column-deal-count"
                    className={clsx(
                      'px-2 py-0.5 rounded-full text-xs font-bold shrink-0',
                      colorConfig.badgeBg,
                      colorConfig.badgeText
                    )}
                  >
                    {col.deal_count}
                  </span>
                </div>

                {/* Column Financial Total */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-black/5">
                  <span className="text-[#4e453d] font-medium">Stage Value:</span>
                  <span
                    data-testid="column-total-value"
                    className="font-bold text-[#59452b]"
                  >
                    {formatDealValue(col.total_value)}
                  </span>
                </div>
              </div>

              {/* Deal Cards Column Body */}
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[700px] p-0.5">
                {col.deals.map((deal) => {
                  const isBeingDragged = draggingDealId === deal.id;
                  const isUpdating = updatingDealId === deal.id;

                  return (
                    <div
                      key={deal.id}
                      draggable={!isUpdating}
                      onDragStart={(e) => handleDragStart(e, deal)}
                      onDragEnd={handleDragEnd}
                      className="group/card relative"
                    >
                      <DealCard
                        deal={deal}
                        isDragging={isBeingDragged}
                        onSelect={onSelectDeal}
                        className={clsx(
                          isUpdating && 'opacity-60 pointer-events-none animate-pulse'
                        )}
                      />

                      {/* Accessible Stage Quick Move Selector [FR-3] */}
                      <div className="mt-1 flex items-center justify-between px-1 text-[11px] text-[#4e453d]">
                        <label
                          htmlFor={`stage-select-${deal.id}`}
                          className="sr-only"
                        >
                          Move deal stage for {deal.title}
                        </label>
                        <span className="text-[10px] text-[#80756b] uppercase tracking-wider font-medium">
                          Move to:
                        </span>
                        <select
                          id={`stage-select-${deal.id}`}
                          data-testid="stage-select"
                          data-deal-id={deal.id}
                          value={deal.milestone_stage}
                          onChange={(e) => handleStageTransition(deal.id, e.target.value)}
                          disabled={isUpdating}
                          className="text-[11px] py-0.5 px-1.5 rounded border border-[#d1c4b9] bg-white text-[#1b1c19] focus:ring-1 focus:ring-[#735c41] focus:outline-none cursor-pointer"
                        >
                          {activeStages.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}

                {col.deals.length === 0 && (
                  <div
                    data-testid="empty-column-placeholder"
                    className="flex flex-col items-center justify-center py-8 px-2 rounded-lg border border-dashed border-[#d1c4b9] text-center text-xs text-[#80756b] bg-white/40"
                  >
                    <Briefcase className="w-5 h-5 mb-1 text-[#80756b]" aria-hidden="true" />
                    <span>No deals in this stage</span>
                    <span className="text-[10px] text-[#80756b]">Drag cards here to transition</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Board;