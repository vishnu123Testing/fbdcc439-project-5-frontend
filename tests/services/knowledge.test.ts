import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  knowledgeService,
  sanitizeString,
  buildQueryString,
  sanitizeTag,
  sanitizeCategory,
  sanitizeAttachment,
  sanitizePlaybookStep,
  sanitizeArticleSummary,
  sanitizeArticleDetail,
  sanitizeArticleSearchResult,
  sanitizePlaybookStepProgress,
  sanitizePlaybookProgress,
  searchArticles,
  getArticleDetail,
  deleteArticle,
  togglePlaybookStepProgress,
  getPlaybookProgress,
  ArticleSearchParams,
  PlaybookStepProgressRequest,
} from '../../src/services/knowledge';
import { setToken } from '../../src/services/apiClient';

describe('knowledge service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sanitizeString & helper functions [NFR-3]', () => {
    it('returns empty string for null, undefined, or empty values', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
      expect(sanitizeString('   ')).toBe('');
    });

    it('strips script and HTML markup tags', () => {
      const input = '<script>alert("xss")</script>Knowledge <b>Article</b>';
      const result = sanitizeString(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('<b>');
      expect(result).toContain('Knowledge Article');
    });

    it('escapes special HTML entity characters', () => {
      const input = 'Title & Category <Tag> "Playbook" \'FAQ\' / Guide';
      const result = sanitizeString(input);
      expect(result).toBe('Title &amp; Category &lt;Tag&gt; &quot;Playbook&quot; &#x27;FAQ&#x27; &#x2F; Guide');
    });

    it('removes control characters', () => {
      const input = 'Clean\x00Knowledge\x07Text';
      expect(sanitizeString(input)).toBe('CleanKnowledgeText');
    });
  });

  describe('buildQueryString helper', () => {
    it('returns empty string when no params are provided', () => {
      expect(buildQueryString(undefined)).toBe('');
      expect(buildQueryString({})).toBe('');
    });

    it('ignores null, undefined, or empty string values', () => {
      const result = buildQueryString({
        query: 'onboarding',
        category_id: null,
        tag_ids: undefined,
        content_type: '',
      });
      expect(result).toBe('?query=onboarding');
    });

    it('handles single and array values properly', () => {
      const params: ArticleSearchParams = {
        query: 'playbook',
        category_id: 'cat-123',
        tag_ids: ['tag-1', 'tag-2'],
        content_type: 'Playbook',
        page: 1,
        limit: 20,
      };
      const result = buildQueryString(params as Record<string, unknown>);
      expect(result).toContain('query=playbook');
      expect(result).toContain('category_id=cat-123');
      expect(result).toContain('tag_ids=tag-1');
      expect(result).toContain('tag_ids=tag-2');
      expect(result).toContain('content_type=Playbook');
      expect(result).toContain('page=1');
      expect(result).toContain('limit=20');
    });
  });

  describe('sanitizers fallback and sanitization', () => {
    it('sanitizeTag handles invalid data', () => {
      const result = sanitizeTag(null);
      expect(result).toEqual({ id: '', name: '', created_at: '' });
    });

    it('sanitizeCategory handles invalid data', () => {
      const result = sanitizeCategory(undefined);
      expect(result).toEqual({ id: '', name: '', description: null, created_at: '' });
    });

    it('sanitizeAttachment handles invalid data', () => {
      const result = sanitizeAttachment('invalid');
      expect(result).toEqual({
        id: '',
        article_id: '',
        file_name: '',
        file_url: '',
        file_size_bytes: 0,
        created_at: '',
      });
    });

    it('sanitizePlaybookStep handles invalid data', () => {
      const result = sanitizePlaybookStep(12345);
      expect(result).toEqual({
        id: '',
        article_id: '',
        step_number: 0,
        title: '',
        content: '',
        checkpoint_instructions: null,
      });
    });

    it('sanitizeArticleSummary handles raw data', () => {
      const raw = {
        id: 'art-001',
        title: '<script>alert("title")</script>Onboarding Guide',
        content_type: 'Playbook',
        body_snippet: 'Snippet text',
        tenant_id: 'tenant-1',
        category_id: 'cat-1',
        category_name: 'Guides',
        tags: [{ id: 't1', name: '<b>Tag1</b>', created_at: '2026-03-22T00:00:00Z' }],
        video_url: 'https://example.com/video.mp4',
        is_published: true,
        created_at: '2026-03-22T00:00:00Z',
        updated_at: '2026-03-22T00:00:00Z',
      };
      const result = sanitizeArticleSummary(raw);
      expect(result.id).toBe('art-001');
      expect(result.title).not.toContain('<script>');
      expect(result.tags[0].name).not.toContain('<b>');
      expect(result.content_type).toBe('Playbook');
      expect(result.is_published).toBe(true);
    });

    it('sanitizeArticleDetail handles raw data', () => {
      const raw = {
        id: 'art-002',
        title: 'Detail Title',
        content_type: 'TrainingVideo',
        body: 'Full body content',
        category: { id: 'c1', name: 'Category 1', created_at: '2026-03-22' },
        tags: [],
        playbook_steps: [
          {
            id: 's1',
            article_id: 'art-002',
            step_number: 1,
            title: 'Step 1',
            content: 'Step content',
          },
        ],
        attachments: [
          {
            id: 'att-1',
            article_id: 'art-002',
            file_name: 'doc.pdf',
            file_url: 'https://example.com/doc.pdf',
            file_size_bytes: 2048,
            created_at: '2026-03-22',
          },
        ],
        video_url: 'https://example.com/stream.mp4',
        is_published: true,
        created_at: '2026-03-22',
        updated_at: '2026-03-22',
      };

      const result = sanitizeArticleDetail(raw);
      expect(result.id).toBe('art-002');
      expect(result.category?.name).toBe('Category 1');
      expect(result.playbook_steps.length).toBe(1);
      expect(result.playbook_steps[0].title).toBe('Step 1');
      expect(result.attachments.length).toBe(1);
      expect(result.attachments[0].file_size_bytes).toBe(2048);
    });

    it('sanitizeArticleSearchResult handles raw data', () => {
      const result = sanitizeArticleSearchResult(null);
      expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20, total_pages: 0 });
    });

    it('sanitizePlaybookStepProgress handles raw data', () => {
      const raw = {
        step_id: 'step-101',
        is_completed: true,
        completed_at: '2026-03-22T10:00:00Z',
        overall_playbook_progress_percentage: 50.0,
      };
      const result = sanitizePlaybookStepProgress(raw);
      expect(result.step_id).toBe('step-101');
      expect(result.is_completed).toBe(true);
      expect(result.overall_playbook_progress_percentage).toBe(50.0);
    });

    it('sanitizePlaybookProgress handles raw data', () => {
      const raw = {
        article_id: 'art-100',
        completed_step_ids: ['step-1', 'step-2'],
        total_completed: 2,
        total_steps: 4,
        overall_playbook_progress_percentage: 50.0,
      };
      const result = sanitizePlaybookProgress(raw);
      expect(result.article_id).toBe('art-100');
      expect(result.completed_step_ids).toEqual(['step-1', 'step-2']);
      expect(result.total_completed).toBe(2);
      expect(result.total_steps).toBe(4);
      expect(result.overall_playbook_progress_percentage).toBe(50.0);
    });
  });

  describe('API service client methods [FR-1 - FR-9]', () => {
    it('searchArticles calls GET /knowledge/articles with correct search params', async () => {
      setToken('mock-jwt-token');

      const mockResponse = {
        items: [
          {
            id: 'art-001',
            title: 'FAQ Article',
            content_type: 'FAQ',
            body_snippet: 'FAQ snippet',
            tenant_id: null,
            category_id: 'cat-1',
            category_name: 'General',
            tags: [],
            video_url: null,
            is_published: true,
            created_at: '2026-03-22T00:00:00Z',
            updated_at: '2026-03-22T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        total_pages: 1,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await searchArticles({ query: 'FAQ', page: 1, limit: 20 });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toContain('/knowledge/articles?query=FAQ&page=1&limit=20');
      expect(init?.method).toBe('GET');
      expect((init?.headers as Headers).get('Authorization')).toBe('Bearer mock-jwt-token');
      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe('art-001');
    });

    it('getArticleDetail calls GET /knowledge/articles/{id}', async () => {
      setToken('mock-jwt-token');

      const mockDetail = {
        id: 'art-101',
        title: 'Playbook Guide',
        content_type: 'Playbook',
        body: 'Step 1 instructions',
        tenant_id: 'tenant-100',
        category: null,
        tags: [],
        playbook_steps: [],
        attachments: [],
        video_url: null,
        is_published: true,
        created_at: '2026-03-22T00:00:00Z',
        updated_at: '2026-03-22T00:00:00Z',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockDetail,
      } as Response);

      const result = await getArticleDetail('art-101');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toContain('/knowledge/articles/art-101');
      expect(init?.method).toBe('GET');
      expect(result.id).toBe('art-101');
      expect(result.content_type).toBe('Playbook');
    });

    it('deleteArticle calls DELETE /knowledge/articles/{id}', async () => {
      setToken('mock-jwt-token');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      await deleteArticle('art-101');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toContain('/knowledge/articles/art-101');
      expect(init?.method).toBe('DELETE');
    });

    it('togglePlaybookStepProgress calls POST /knowledge/playbooks/{id}/steps/{step_id}/progress', async () => {
      setToken('mock-jwt-token');

      const mockProgress = {
        step_id: 'step-01',
        is_completed: true,
        completed_at: '2026-03-22T10:00:00Z',
        overall_playbook_progress_percentage: 100.0,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockProgress,
      } as Response);

      const payload: PlaybookStepProgressRequest = { is_completed: true };
      const result = await togglePlaybookStepProgress('art-101', 'step-01', payload);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toContain('/knowledge/playbooks/art-101/steps/step-01/progress');
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe(JSON.stringify({ is_completed: true }));
      expect(result.step_id).toBe('step-01');
      expect(result.is_completed).toBe(true);
      expect(result.overall_playbook_progress_percentage).toBe(100.0);
    });

    it('getPlaybookProgress calls GET /knowledge/playbooks/{id}/progress', async () => {
      setToken('mock-jwt-token');

      const mockSummary = {
        article_id: 'art-101',
        completed_step_ids: ['step-01'],
        total_completed: 1,
        total_steps: 2,
        overall_playbook_progress_percentage: 50.0,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSummary,
      } as Response);

      const result = await getPlaybookProgress('art-101');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toContain('/knowledge/playbooks/art-101/progress');
      expect(init?.method).toBe('GET');
      expect(result.article_id).toBe('art-101');
      expect(result.total_completed).toBe(1);
      expect(result.total_steps).toBe(2);
      expect(result.overall_playbook_progress_percentage).toBe(50.0);
    });

    it('handles knowledgeService bundled object methods', async () => {
      setToken('mock-jwt-token');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      await knowledgeService.deleteArticle('art-999');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toContain('/knowledge/articles/art-999');
      expect(init?.method).toBe('DELETE');
    });
  });
});
