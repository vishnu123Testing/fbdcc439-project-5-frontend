'use client';

import React, { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  BarChart2,
  TrendingUp,
  Layers,
  Globe,
  CalendarDays,
  Download,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sliders,
  Sparkles,
  X,
  Info,
  Filter,
} from 'lucide-react';
import {
  createDatasetExport,
  ExportCreateRequest,
  ExportTaskResponse,
} from '../../services/analytics';
import { AcquisitionReport } from '../../components/analytics/AcquisitionReport';
import { ConversionFunnel } from '../../components/analytics/ConversionFunnel';
import { CampaignComparison } from '../../components/analytics/CampaignComparison';
import { TerritoryHeatMap } from '../../components/analytics/TerritoryHeatMap';
import { MeetingCalendar } from '../../components/analytics/MeetingCalendar';
import { useAccessibility } from '../../components/common/AccessibilityContext';

export type AnalyticsTab =
  | 'overview'
  | 'acquisition'
  | 'funnel'
  | 'campaigns'
  | 'territory'
  | 'calendar';

export interface ExportNotification {
  id: string;
  reportType: string;
  format: string;
  taskId: string;
  status: string;
  message: string;
  timestamp: string;
}

export default function AnalyticsPage() {
  const { announce } = useAccessibility();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');

  // Asynchronous export state
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [selectedReportType, setSelectedReportType] = useState<string>('acquisition');
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'pdf'>('csv');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportNotifications, setExportNotifications] = useState<ExportNotification[]>([]);

  // Tab change handler with screen reader accessibility announcement
  const handleTabChange = (tab: AnalyticsTab) => {
    setActiveTab(tab);
    const tabLabels: Record<AnalyticsTab, string> = {
      overview: 'Overview - All Analytics Modules',
      acquisition: 'Channel Acquisition & ROI Report',
      funnel: 'Conversion Funnel Analytics',
      campaigns: 'Campaign Trend Comparison',
      territory: 'Geographic Territory Heat Map',
      calendar: 'Meeting Prep & Calendar',
    };
    announce(`Switched to ${tabLabels[tab]} tab.`, 'polite');
  };

  // Trigger dataset export via backend Celery worker [FR-012]
  const handleTriggerExport = useCallback(
    async (reportType: string, format: 'csv' | 'pdf') => {
      setIsExporting(true);
      setExportError(null);

      const requestPayload: ExportCreateRequest = {
        report_type: reportType,
        export_format: format,
      };

      try {
        const response: ExportTaskResponse = await createDatasetExport(requestPayload);

        const newNotification: ExportNotification = {
          id: response.task_id || `export-${Date.now()}`,
          reportType,
          format: format.toUpperCase(),
          taskId: response.task_id,
          status: response.status || 'PENDING',
          message: `Dataset export queued successfully for ${reportType.toUpperCase()} (${format.toUpperCase()}). Task ID: ${response.task_id}`,
          timestamp: new Date().toLocaleTimeString(),
        };

        setExportNotifications((prev) => [newNotification, ...prev.slice(0, 4)]);
        announce(
          `Export job submitted for ${reportType} in ${format.toUpperCase()} format. Task ID: ${response.task_id}`,
          'polite'
        );
        setExportModalOpen(false);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to submit dataset export task.';
        setExportError(errorMsg);
        announce(`Export failed: ${errorMsg}`, 'assertive');
      } finally {
        setIsExporting(false);
      }
    },
    [announce]
  );

  const dismissNotification = (id: string) => {
    setExportNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="space-y-6 font-sans text-[#1b1c19] pb-12" data-testid="analytics-page">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[#d1c4b9]/50">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-[#59452b]" aria-hidden="true" />
            <h1 className="text-3xl font-serif font-normal text-[#1b1c19] tracking-tight">
              Lead Acquisition & Marketing Analytics
            </h1>
          </div>
          <p className="text-sm text-[#4e453d] mt-1 max-w-3xl">
            Integrated performance suite covering channel ROI, real-time conversion funnels, multi-campaign trend overlays, geographic territory heat maps, and meeting prep calendars [FR-001, FR-004, FR-006, FR-007, FR-009, FR-012].
          </p>
        </div>

        {/* Global Dataset Export Trigger Button [FR-012] */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#59452b] hover:bg-[#735c41] text-white text-xs font-medium rounded-md shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#735c41]"
            data-testid="global-export-modal-btn"
          >
            <Download className="w-4 h-4" />
            <span>Export Report Dataset</span>
          </button>
        </div>
      </div>

      {/* Export Task Feedback Notifications [FR-012] */}
      {exportNotifications.length > 0 && (
        <div className="space-y-2" data-testid="export-notifications-container">
          {exportNotifications.map((notification) => (
            <div
              key={notification.id}
              className="p-3 bg-[#f5f3ee] border border-[#715a3f]/30 rounded-md text-xs text-[#1b1c19] flex items-center justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2d5a3f] shrink-0" />
                <span>
                  <strong className="font-semibold text-[#59452b]">{notification.message}</strong>
                  <span className="text-[#80756b] ml-2">({notification.timestamp})</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => dismissNotification(notification.id)}
                className="text-[#80756b] hover:text-[#1b1c19] p-1"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Navigation Tabs Bar [FR-001, FR-004, FR-006, FR-007, FR-009] */}
      <div className="bg-[#f0eee9] p-1.5 rounded-lg border border-[#d1c4b9]/60 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => handleTabChange('overview')}
          className={clsx(
            'px-3.5 py-2 text-xs font-medium rounded-md transition flex items-center gap-1.5',
            activeTab === 'overview'
              ? 'bg-white text-[#59452b] shadow-xs border border-[#d1c4b9]'
              : 'text-[#4e453d] hover:text-[#1b1c19] hover:bg-white/50'
          )}
          data-testid="tab-overview"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#59452b]" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('acquisition')}
          className={clsx(
            'px-3.5 py-2 text-xs font-medium rounded-md transition flex items-center gap-1.5',
            activeTab === 'acquisition'
              ? 'bg-white text-[#59452b] shadow-xs border border-[#d1c4b9]'
              : 'text-[#4e453d] hover:text-[#1b1c19] hover:bg-white/50'
          )}
          data-testid="tab-acquisition"
        >
          <TrendingUp className="w-3.5 h-3.5 text-[#59452b]" />
          <span>Acquisition & ROI</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('funnel')}
          className={clsx(
            'px-3.5 py-2 text-xs font-medium rounded-md transition flex items-center gap-1.5',
            activeTab === 'funnel'
              ? 'bg-white text-[#59452b] shadow-xs border border-[#d1c4b9]'
              : 'text-[#4e453d] hover:text-[#1b1c19] hover:bg-white/50'
          )}
          data-testid="tab-funnel"
        >
          <Layers className="w-3.5 h-3.5 text-[#59452b]" />
          <span>Conversion Funnel</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('campaigns')}
          className={clsx(
            'px-3.5 py-2 text-xs font-medium rounded-md transition flex items-center gap-1.5',
            activeTab === 'campaigns'
              ? 'bg-white text-[#59452b] shadow-xs border border-[#d1c4b9]'
              : 'text-[#4e453d] hover:text-[#1b1c19] hover:bg-white/50'
          )}
          data-testid="tab-campaigns"
        >
          <Sliders className="w-3.5 h-3.5 text-[#59452b]" />
          <span>Campaign Trends</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('territory')}
          className={clsx(
            'px-3.5 py-2 text-xs font-medium rounded-md transition flex items-center gap-1.5',
            activeTab === 'territory'
              ? 'bg-white text-[#59452b] shadow-xs border border-[#d1c4b9]'
              : 'text-[#4e453d] hover:text-[#1b1c19] hover:bg-white/50'
          )}
          data-testid="tab-territory"
        >
          <Globe className="w-3.5 h-3.5 text-[#59452b]" />
          <span>Territory Heat Map</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('calendar')}
          className={clsx(
            'px-3.5 py-2 text-xs font-medium rounded-md transition flex items-center gap-1.5',
            activeTab === 'calendar'
              ? 'bg-white text-[#59452b] shadow-xs border border-[#d1c4b9]'
              : 'text-[#4e453d] hover:text-[#1b1c19] hover:bg-white/50'
          )}
          data-testid="tab-calendar"
        >
          <CalendarDays className="w-3.5 h-3.5 text-[#59452b]" />
          <span>Meeting Calendar</span>
        </button>
      </div>

      {/* Module Content Views */}

      {/* OVERVIEW TAB: Displays all modules stacked in integrated layout */}
      {activeTab === 'overview' && (
        <div className="space-y-10" data-testid="overview-view">
          {/* Section 1: Acquisition & ROI */}
          <section className="space-y-3">
            <AcquisitionReport
              onExport={(fmt) => handleTriggerExport('acquisition', fmt)}
            />
          </section>

          {/* Section 2: Conversion Funnel */}
          <section className="space-y-3">
            <ConversionFunnel
              onExport={(fmt) => handleTriggerExport('funnel', fmt)}
            />
          </section>

          {/* Section 3: Campaign Comparison */}
          <section className="space-y-3">
            <CampaignComparison
              onExport={(fmt) => handleTriggerExport('campaigns', fmt)}
            />
          </section>

          {/* Section 4: Territory Heat Map */}
          <section className="space-y-3">
            <TerritoryHeatMap
              onExport={(fmt) => handleTriggerExport('territory', fmt)}
            />
          </section>

          {/* Section 5: Meeting Calendar */}
          <section className="space-y-3">
            <MeetingCalendar
              onExport={(fmt) => handleTriggerExport('calendar', fmt)}
            />
          </section>
        </div>
      )}

      {/* ACQUISITION TAB [FR-001] */}
      {activeTab === 'acquisition' && (
        <div data-testid="acquisition-tab-view">
          <AcquisitionReport
            onExport={(fmt) => handleTriggerExport('acquisition', fmt)}
          />
        </div>
      )}

      {/* FUNNEL TAB [FR-004] */}
      {activeTab === 'funnel' && (
        <div data-testid="funnel-tab-view">
          <ConversionFunnel
            onExport={(fmt) => handleTriggerExport('funnel', fmt)}
          />
        </div>
      )}

      {/* CAMPAIGN COMPARISON TAB [FR-006] */}
      {activeTab === 'campaigns' && (
        <div data-testid="campaigns-tab-view">
          <CampaignComparison
            onExport={(fmt) => handleTriggerExport('campaigns', fmt)}
          />
        </div>
      )}

      {/* TERRITORY HEAT MAP TAB [FR-007] */}
      {activeTab === 'territory' && (
        <div data-testid="territory-tab-view">
          <TerritoryHeatMap
            onExport={(fmt) => handleTriggerExport('territory', fmt)}
          />
        </div>
      )}

      {/* MEETING CALENDAR TAB [FR-009] */}
      {activeTab === 'calendar' && (
        <div data-testid="calendar-tab-view">
          <MeetingCalendar
            onExport={(fmt) => handleTriggerExport('calendar', fmt)}
          />
        </div>
      )}

      {/* Global Dataset Export Modal [FR-012] */}
      {exportModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-modal-title"
          data-testid="export-modal"
        >
          <div className="bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 bg-[#f0eee9] border-b border-[#d1c4b9] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-[#59452b]" />
                <h3 id="export-modal-title" className="font-serif text-base font-semibold text-[#1b1c19]">
                  Export Dataset Report
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="p-1 text-[#80756b] hover:text-[#1b1c19] rounded"
                aria-label="Close Export Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {exportError && (
                <div className="p-3 bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]/30 rounded flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{exportError}</span>
                </div>
              )}

              {/* Report Type Selector */}
              <div className="space-y-1">
                <label className="block font-semibold text-[#4e453d] uppercase tracking-wider">
                  Report Dataset
                </label>
                <select
                  value={selectedReportType}
                  onChange={(e) => setSelectedReportType(e.target.value)}
                  className="w-full p-2 bg-white border border-[#d1c4b9] rounded focus:outline-none focus:border-[#59452b] text-[#1b1c19]"
                  data-testid="export-type-select"
                >
                  <option value="acquisition">Channel Acquisition & ROI (FR-001)</option>
                  <option value="funnel">Conversion Funnel Drop-off (FR-004)</option>
                  <option value="campaigns">Multi-Campaign Trend Comparison (FR-006)</option>
                  <option value="territory">Geographic Territory Density (FR-007)</option>
                  <option value="calendar">Meeting Calendar & Prep Briefings (FR-009)</option>
                </select>
              </div>

              {/* Format Selector */}
              <div className="space-y-1">
                <label className="block font-semibold text-[#4e453d] uppercase tracking-wider">
                  Export File Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFormat('csv')}
                    className={clsx(
                      'p-2.5 rounded border text-center font-medium transition',
                      selectedFormat === 'csv'
                        ? 'bg-[#59452b] text-white border-[#59452b]'
                        : 'bg-white text-[#1b1c19] border-[#d1c4b9] hover:bg-[#f5f3ee]'
                    )}
                    data-testid="export-format-csv"
                  >
                    CSV File (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFormat('pdf')}
                    className={clsx(
                      'p-2.5 rounded border text-center font-medium transition',
                      selectedFormat === 'pdf'
                        ? 'bg-[#59452b] text-white border-[#59452b]'
                        : 'bg-white text-[#1b1c19] border-[#d1c4b9] hover:bg-[#f5f3ee]'
                    )}
                    data-testid="export-format-pdf"
                  >
                    PDF Document (.pdf)
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-[#80756b] bg-[#f5f3ee] p-2.5 rounded border border-[#d1c4b9]/50">
                Exports execute asynchronously via background Celery workers. Large dataset outputs will emit a status event when ready [FR-012].
              </p>
            </div>

            <div className="p-4 bg-[#f0eee9] border-t border-[#d1c4b9] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-[#4e453d] hover:text-[#1b1c19] bg-white border border-[#d1c4b9] rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleTriggerExport(selectedReportType, selectedFormat)}
                disabled={isExporting}
                className="px-4 py-1.5 text-xs font-medium text-white bg-[#59452b] hover:bg-[#735c41] rounded transition flex items-center gap-1.5 disabled:opacity-50"
                data-testid="submit-export-btn"
              >
                {isExporting ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting Job...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Generate Export</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
