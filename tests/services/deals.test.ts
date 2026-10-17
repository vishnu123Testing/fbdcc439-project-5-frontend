import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  dealsService,
  sanitizeString,
  sanitizeDeal,
  sanitizePipelineBoard,
  sanitizeActionItem,
  sanitizeStakeholder,
  sanitizeActivity,
  sanitizeStakeholderMap,
  sanitizeForecast,
  getPipelineBoard,
  createDeal,
  getDeal,
  updateDealStage,
  createActionItem,
  getActionItems,
  completeActionItem,
  deleteActionItem,
  getStakeholders,
  createStakeholder,
  addStakeholderActivity,
  getForecast,
  recalculateForecast,
  DealCreateRequest,
  DealStageUpdateRequest,
  ActionItemCreateRequest,
  StakeholderCreateRequest,
  ActivityCreateRequest,
} from '../../src/services/deals';
import { setToken } from '../../src/services/apiClient';

describe('deals service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeString & helper functions', () => {
    it('returns empty string for null, undefined, or empty values', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
      expect(sanitizeString('   ')).toBe('');
    });

    it('strips script and HTML markup tags', () => {
      const input = '<script>alert("xss")</script>Deal <b>Title</b>';
      const result = sanitizeString(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('<b>');
      expect(result).toContain('Deal Title');
    });

    it('escapes special HTML entity characters', () => {
      const input = 'Value & Stage <Target> "Enterprise" \'Tier 1\' / Lead';
      const result = sanitizeString(input);
      expect(result).toBe('Value &amp; Stage &lt;Target&gt; &quot;Enterprise&quot; &#x27;Tier 1&#x27; &#x2F; Lead');
    });

    it('removes control characters', () => {
      const input = 'Clean\x00Deal\x07Text';
      expect(sanitizeString(input)).toBe('CleanDealText');
    });

    it('sanitizeDeal handles null or invalid object fallback', () => {
      const fallback = sanitizeDeal(null);
      expect(fallback.id).toBe('');
      expect(fallback.title).toBe('');
      expect(fallback.deal_value).toBe(0);
      expect(fallback.milestone_stage).toBe('');
      expect(fallback.win_probability).toBe(0);
      expect(fallback.age_in_days).toBe(0);
    });

    it('sanitizePipelineBoard handles empty or invalid object fallback', () => {
      const fallback = sanitizePipelineBoard(undefined);
      expect(fallback.stages).toEqual([]);
      expect(fallback.total_pipeline_value).toBe(0);
      expect(fallback.total_deal_count).toBe(0);
      expect(fallback.deals).toEqual([]);
    });

    it('sanitizeActionItem handles invalid input fallback', () => {
      const fallback = sanitizeActionItem(123);
      expect(fallback.id).toBe('');
      expect(fallback.sla_threshold_hours).toBe(24);
      expect(fallback.is_completed).toBe(false);
      expect(fallback.is_overdue).toBe(false);
    });

    it('sanitizeStakeholder handles invalid input fallback', () => {
      const fallback = sanitizeStakeholder('invalid');
      expect(fallback.id).toBe('');
      expect(fallback.influence_level).toBe('Medium');
      expect(fallback.is_active).toBe(true);
    });

    it('sanitizeActivity handles invalid input fallback', () => {
      const fallback = sanitizeActivity(null);
      expect(fallback.activity_type).toBe('Note');
      expect(fallback.summary).toBe('');
    });

    it('sanitizeForecast handles invalid input fallback', () => {
      const fallback = sanitizeForecast(null);
      expect(fallback.status_code).toBe('INSUFFICIENT_DATA');
      expect(fallback.estimated_completion_date).toBeNull();
      expect(fallback.confidence_score_pct).toBeNull();
      expect(fallback.is_sparse).toBe(true);
    });
  });

  describe('getPipelineBoard [FR-1, FR-2]', () => {
    it('fetches complete visual deal pipeline board without filter', async () => {
      setToken('mock-auth-token');

      const mockBoard = {
        stages: [
          {
            milestone_stage: 'Qualification',
            total_value: 150000.0,
            deal_count: 1,
            deals: [
              {
                id: 'deal-101',
                title: 'Acme Corp Software License',
                deal_value: 150000.0,
                milestone_stage: 'Qualification',
                win_probability: 0.25,
                age_in_days: 12.5,
                created_on: '2026-03-01T10:00:00Z',
                updated_on: '2026-03-05T12:00:00Z',
              },
            ],
          },
        ],
        total_pipeline_value: 150000.0,
        total_deal_count: 1,
        deals: [
          {
            id: 'deal-101',
            title: 'Acme Corp Software License',
            deal_value: 150000.0,
            milestone_stage: 'Qualification',
            win_probability: 0.25,
            age_in_days: 12.5,
            created_on: '2026-03-01T10:00:00Z',
            updated_on: '2026-03-05T12:00:00Z',
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockBoard,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await getPipelineBoard();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/deals/pipeline',
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Headers),
        })
      );

      expect(result.total_pipeline_value).toBe(150000.0);
      expect(result.total_deal_count).toBe(1);
      expect(result.stages[0].milestone_stage).toBe('Qualification');
      expect(result.stages[0].deals[0].title).toBe('Acme Corp Software License');
      expect(result.stages[0].deals[0].age_in_days).toBe(12.5);
      expect(result.stages[0].deals[0].win_probability).toBe(0.25);
    });

    it('passes stage filter parameter when provided', async () => {
      setToken('mock-auth-token');

      const mockBoard = {
        stages: [
          {
            milestone_stage: 'Proposal',
            total_value: 200000.0,
            deal_count: 1,
            deals: [],
          },
        ],
        total_pipeline_value: 200000.0,
        total_deal_count: 1,
        deals: [],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockBoard,
      });
      vi.stubGlobal('fetch', mockFetch);

      await getPipelineBoard('Proposal');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/deals/pipeline?stage=Proposal',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('createDeal & getDeal', () => {
    it('creates a new deal and sanitizes payload', async () => {
      setToken('mock-token');

      const mockCreated = {
        id: 'deal-102',
        title: 'Beta Project Expansion',
        deal_value: 50000.0,
        milestone_stage: 'Prospecting',
        win_probability: 0.1,
        age_in_days: 0.0,
        created_on: '2026-03-10T08:00:00Z',
        updated_on: '2026-03-10T08:00:00Z',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockCreated,
      });
      vi.stubGlobal('fetch', mockFetch);

      const payload: DealCreateRequest = {
        title: '<b>Beta Project Expansion</b>',
        deal_value: 50000.0,
        milestone_stage: 'Prospecting',
        win_probability: 0.1,
      };

      const result = await createDeal(payload);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/deals',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            title: 'Beta Project Expansion',
            deal_value: 50000.0,
            milestone_stage: 'Prospecting',
            win_probability: 0.1,
          }),
        })
      );

      expect(result.id).toBe('deal-102');
      expect(result.title).toBe('Beta Project Expansion');
    });

    it('retrieves details for a specific deal ID', async () => {
      setToken('mock-token');

      const mockDeal = {
        id: 'deal-102',
        title: 'Beta Project Expansion',
        deal_value: 50000.0,
        milestone_stage: 'Prospecting',
        win_probability: 0.1,
        age_in_days: 2.1,
        created_on: '2026-03-10T08:00:00Z',
        updated_on: '2026-03-12T10:00:00Z',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockDeal,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await getDeal('deal-102');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/deals/deal-102',
        expect.objectContaining({ method: 'GET' })
      );

      expect(result.id).toBe('deal-102');
      expect(result.age_in_days).toBe(2.1);
    });
  });

  describe('updateDealStage [FR-3]', () => {
    it('updates milestone stage progression and returns recalculated metrics', async () => {
      setToken('mock-token');

      const mockUpdated = {
        id: 'deal-101',
        title: 'Acme Corp Software License',
        deal_value: 150000.0,
        milestone_stage: 'Closed Won',
        win_probability: 1.0,
        age_in_days: 15.0,
        created_on: '2026-03-01T10:00:00Z',
        updated_on: '2026-03-16T10:00:00Z',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUpdated,
      });
      vi.stubGlobal('fetch', mockFetch);

      const updatePayload: DealStageUpdateRequest = {
        milestone_stage: 'Closed Won',
        win_probability: 1.0,
      };

      const result = await updateDealStage('deal-101', updatePayload);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/deals/deal-101/stage',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            milestone_stage: 'Closed Won',
            win_probability: 1.0,
          }),
        })
      );

      expect(result.milestone_stage).toBe('Closed Won');
      expect(result.win_probability).toBe(1.0);
    });
  });

  describe('action items [FR-4]', () => {
    it('creates an action item assigned to a deal', async () => {
      setToken('mock-token');

      const mockActionItem = {
        id: 'item-201',
        deal_id: 'deal-101',
        title: 'Send Revised Proposal',
        assigned_owner_id: 'usr-99',
        target_due_date: '2026-03-20T17:00:00Z',
        sla_threshold_hours: 24,
        is_completed: false,
        completed_on: null,
        is_escalated: false,
        escalated_on: null,
        created_on: '2026-03-15T12:00:00Z',
        is_overdue: false,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockActionItem,
      });
      vi.stubGlobal('fetch', mockFetch);

      const payload: ActionItemCreateRequest = {
        title: 'Send Revised Proposal',
        assigned_owner_id: 'usr-99',
        target_due_date: '2026-03-20T17:00:00Z',
        sla_threshold_hours: 24,
      };

      const result = await createActionItem('deal-101', payload);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/deals/deal-101/action-items',
        expect.objectContaining({
          method: 'POST',
        })
      );

      expect(result.id).toBe('item-201');
      expect(result.assigned_owner_id).toBe('usr-99');
    });

    it('fetches action items list for a deal', async () => {
      setToken('mock-token');

      const mockItems = [
        {
          id: 'item-201',
          deal_id: 'deal-101',
          title: 'Send Revised Proposal',
          assigned_owner_id: 'usr-99',
          target_due_date: '2026-03-20T17:00:00Z',
          sla_threshold_hours: 24,
          is_completed: false,
          completed_on: null,
          is_escalated: false,
          escalated_on: null,
          created_on: '2026-03-15T12:00:00Z',
          is_overdue: false,
        },
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockItems,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await getActionItems('deal-101', true);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/deals/deal-101/action-items?include_completed=true',
        expect.objectContaining({ method: 'GET' })
      );

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Send Revised Proposal');
    });

    it('marks an action item as completed', async () => {
      setToken('mock-token');

      const mockCompletedItem = {
        id: 'item-201',
        deal_id: 'deal-101',
        title: 'Send Revised Proposal',
        assigned_owner_id: 'usr-99',
        target_due_date: '2026-03-20T17:00:00Z',
        sla_threshold_hours: 24,
        is_completed: true,
        completed_on: '2026-03-16T09:30:00Z',
        is_escalated: false,
        escalated_on: null,
        created_on: '2026-03-15T12:00:00Z',
        is_overdue: false,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockCompletedItem,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await completeActionItem('deal-101', 'item-201');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/deals/deal-101/action-items/item-201/complete',
        expect.objectContaining({
          method: 'PATCH',
        })
      );

      expect(result.is_completed).toBe(true);
      expect(result.completed_on).toBe('2026-03-16T09:30:00Z');
    });

    it('deletes an action item record returning 204 No Content', async () => {
      setToken('mock-token');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      vi.stubGlobal('fetch', mockFetch);

      await deleteActionItem('deal-101', 'item-201');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/deals/deal-101/action-items/item-201',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('stakeholders & activities [FR-6]', () => {
    it('retrieves stakeholder map and activity feed for a deal', async () => {
      setToken('mock-token');

      const mockMap = {
        deal_id: 'deal-101',
        stakeholders: [
          {
            id: 'sh-301',
            deal_id: 'deal-101',
            full_name: 'Jane Doe',
            email: 'jane@acme.com',
            org_role: 'VP Engineering',
            influence_level: 'High',
            is_active: true,
            created_on: '2026-03-02T10:00:00Z',
          },
        ],
        recent_activities: [
          {
            id: 'act-401',
            stakeholder_id: 'sh-301',
            deal_id: 'deal-101',
            activity_type: 'Meeting',
            summary: 'Technical architecture review call',
            occurred_on: '2026-03-05T14:00:00Z',
            created_on: '2026-03-05T14:30:00Z',
            stakeholder_name: 'Jane Doe',
          },
        ],
        total_stakeholders: 1,
        total_activities: 1,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockMap,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await getStakeholders('deal-101', false);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/deals/deal-101/stakeholders?active_only=false',
        expect.objectContaining({ method: 'GET' })
      );

      expect(result.deal_id).toBe('deal-101');
      expect(result.stakeholders[0].full_name).toBe('Jane Doe');
      expect(result.stakeholders[0].influence_level).toBe('High');
      expect(result.recent_activities[0].activity_type).toBe('Meeting');
    });

    it('creates a stakeholder contact mapped to a deal', async () => {
      setToken('mock-token');

      const mockCreated = {
        id: 'sh-302',
        deal_id: 'deal-101',
        full_name: 'John Smith',
        email: 'john@acme.com',
        org_role: 'Procurement Officer',
        influence_level: 'Medium',
        is_active: true,
        created_on: '2026-03-12T11:00:00Z',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockCreated,
      });
      vi.stubGlobal('fetch', mockFetch);

      const payload: StakeholderCreateRequest = {
        full_name: 'John Smith',
        email: 'john@acme.com',
        org_role: 'Procurement Officer',
        influence_level: 'Medium',
      };

      const result = await createStakeholder('deal-101', payload);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/deals/deal-101/stakeholders',
        expect.objectContaining({
          method: 'POST',
        })
      );

      expect(result.id).toBe('sh-302');
      expect(result.full_name).toBe('John Smith');
    });

    it('logs a stakeholder interaction activity', async () => {
      setToken('mock-token');

      const mockActivity = {
        id: 'act-402',
        stakeholder_id: 'sh-302',
        deal_id: 'deal-101',
        activity_type: 'Email',
        summary: 'Sent updated pricing proposal',
        occurred_on: '2026-03-14T09:00:00Z',
        created_on: '2026-03-14T09:05:00Z',
        stakeholder_name: 'John Smith',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockActivity,
      });
      vi.stubGlobal('fetch', mockFetch);

      const payload: ActivityCreateRequest = {
        stakeholder_id: 'sh-302',
        activity_type: 'Email',
        summary: 'Sent updated pricing proposal',
      };

      const result = await addStakeholderActivity('deal-101', payload);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/deals/deal-101/stakeholders/activities',
        expect.objectContaining({
          method: 'POST',
        })
      );

      expect(result.id).toBe('act-402');
      expect(result.summary).toBe('Sent updated pricing proposal');
    });
  });

  describe('AI completion forecast [FR-8]', () => {
    it('retrieves AI forecast details for a deal', async () => {
      setToken('mock-token');

      const mockForecast = {
        id: 'fct-501',
        deal_id: 'deal-101',
        estimated_completion_date: '2026-04-15T00:00:00Z',
        confidence_score_pct: 85.5,
        status_code: 'READY',
        calculated_on: '2026-03-15T12:00:00Z',
        error_detail: null,
        is_sparse: false,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockForecast,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await getForecast('deal-101');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/deals/deal-101/forecast',
        expect.objectContaining({ method: 'GET' })
      );

      expect(result.status_code).toBe('READY');
      expect(result.estimated_completion_date).toBe('2026-04-15T00:00:00Z');
      expect(result.confidence_score_pct).toBe(85.5);
      expect(result.is_sparse).toBe(false);
    });

    it('triggers forecast recalculation', async () => {
      setToken('mock-token');

      const mockForecast = {
        id: 'fct-501',
        deal_id: 'deal-101',
        estimated_completion_date: '2026-04-20T00:00:00Z',
        confidence_score_pct: 88.0,
        status_code: 'READY',
        calculated_on: '2026-03-16T15:00:00Z',
        error_detail: null,
        is_sparse: false,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockForecast,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await recalculateForecast('deal-101');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/deals/deal-101/forecast/recalculate',
        expect.objectContaining({ method: 'POST' })
      );

      expect(result.confidence_score_pct).toBe(88.0);
    });
  });

  describe('dealsService namespace', () => {
    it('exports all expected API methods and helpers', () => {
      expect(typeof dealsService.getPipelineBoard).toBe('function');
      expect(typeof dealsService.createDeal).toBe('function');
      expect(typeof dealsService.getDeal).toBe('function');
      expect(typeof dealsService.updateDealStage).toBe('function');
      expect(typeof dealsService.createActionItem).toBe('function');
      expect(typeof dealsService.getActionItems).toBe('function');
      expect(typeof dealsService.completeActionItem).toBe('function');
      expect(typeof dealsService.deleteActionItem).toBe('function');
      expect(typeof dealsService.getStakeholders).toBe('function');
      expect(typeof dealsService.createStakeholder).toBe('function');
      expect(typeof dealsService.addStakeholderActivity).toBe('function');
      expect(typeof dealsService.getForecast).toBe('function');
      expect(typeof dealsService.recalculateForecast).toBe('function');
      expect(typeof dealsService.sanitizeString).toBe('function');
    });
  });
});
