import { request, RequestOptions } from './apiClient';

/**
 * ---------------------------------------------------------------------------
 * Allowed Content Types for Knowledge Articles [FR-1, FR-7]
 * ---------------------------------------------------------------------------
 */
export type ContentType = 'FAQ' | 'Playbook' | 'BestPractice' | 'TrainingVideo';

/**
 * ---------------------------------------------------------------------------
 * Response Interfaces [FR-1, FR-2, FR-3, FR-5, FR-6, FR-7, FR-9]
 * ---------------------------------------------------------------------------
 */

/**
 * Schema representing a tag in response payloads [FR-1, FR-7].
 */
export interface TagResponse {
  id: string;
  name: string;
  created_at: string;
}

export type Tag = TagResponse;

/**
 * Schema representing a category in response payloads [FR-1, FR-7].
 */
export interface CategoryResponse {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

export type Category = CategoryResponse;

/**
 * Schema representing a document attachment in response payloads [FR-6].
 */
export interface AttachmentResponse {
  id: string;
  article_id: string;
  file_name: string;
  file_url: string;
  file_size_bytes: number;
  created_at: string;
}

export type Attachment = AttachmentResponse;

/**
 * Schema representing an operational playbook step in response payloads [FR-3].
 */
export interface PlaybookStepResponse {
  id: string;
  article_id: string;
  step_number: number;
  title: string;
  content: string;
  checkpoint_instructions?: string | null;
}

export type PlaybookStep = PlaybookStepResponse;

/**
 * Schema representing a lightweight article summary card [FR-1, FR-2, FR-7].
 */
export interface ArticleSummaryResponse {
  id: string;
  title: string;
  content_type: ContentType | string;
  body_snippet: string;
  tenant_id?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  tags: TagResponse[];
  video_url?: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type ArticleSummary = ArticleSummaryResponse;

/**
 * Schema representing full detailed article contents [FR-1, FR-2, FR-3, FR-5, FR-6, FR-9].
 */
export interface ArticleDetailResponse {
  id: string;
  title: string;
  content_type: ContentType | string;
  body: string;
  tenant_id?: string | null;
  category?: CategoryResponse | null;
  tags: TagResponse[];
  playbook_steps: PlaybookStepResponse[];
  attachments: AttachmentResponse[];
  video_url?: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type ArticleDetail = ArticleDetailResponse;

/**
 * Schema representing paginated search results for knowledge articles [FR-1, FR-2, NFR-1, NFR-3].
 */
export interface ArticleSearchResponse {
  items: ArticleSummaryResponse[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export type ArticleSearchResult = ArticleSearchResponse;

/**
 * Query parameters for searching knowledge articles [FR-1, FR-2, FR-7, FR-8].
 */
export interface ArticleSearchParams {
  query?: string;
  category_id?: string;
  tag_ids?: string | string[];
  content_type?: ContentType | string;
  page?: number;
  limit?: number;
}

/**
 * Request payload for toggling step completion status [FR-4, NFR-3].
 */
export interface PlaybookStepProgressRequest {
  is_completed: boolean;
}

/**
 * Response payload for toggling step completion progress [FR-3, FR-4].
 */
export interface PlaybookStepProgressResponse {
  step_id: string;
  is_completed: boolean;
  completed_at?: string | null;
  overall_playbook_progress_percentage: number;
}

/**
 * Response payload for user overall playbook completion progress summary [FR-3, FR-4].
 */
export interface PlaybookProgressResponse {
  article_id: string;
  completed_step_ids: string[];
  total_completed: number;
  total_steps: number;
  overall_playbook_progress_percentage: number;
}

/**
 * ---------------------------------------------------------------------------
 * Input Sanitization & Helper Functions [NFR-3]
 * ---------------------------------------------------------------------------
 */

/**
 * Sanitize raw input strings by stripping script/HTML tags, escaping HTML entities,
 * removing control characters, and trimming whitespace [NFR-3].
 */
export function sanitizeString(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val).trim();
  if (!str) {
    return '';
  }
  // Strip HTML/script tags
  const noTags = str.replace(/<[^>]*>/g, '');
  // Escape HTML entities
  const escaped = noTags
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  // Strip control characters
  return escaped.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');
}

/**
 * Sanitize URL values by stripping invalid schemes (e.g. javascript:), script tags, and control characters,
 * while preserving valid URL structure and slashes [NFR-3].
 */
export function sanitizeUrl(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val).trim();
  if (!str) {
    return '';
  }
  if (/^(javascript|data|vbscript):/i.test(str)) {
    return '';
  }
  return str.replace(/<[^>]*>/g, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');
}

/**
 * Construct URL query parameter string from a key-value params record.
 */
export function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) {
    return '';
  }
  const queryParts: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== '') {
          queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
        }
      }
    } else {
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }

  return queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
}

/**
 * Sanitize tag object properties with fallback defaults.
 */
export function sanitizeTag(data: unknown): TagResponse {
  if (!data || typeof data !== 'object') {
    return {
      id: '',
      name: '',
      created_at: '',
    };
  }
  const obj = data as Record<string, unknown>;
  return {
    id: sanitizeString(obj.id),
    name: sanitizeString(obj.name),
    created_at: sanitizeString(obj.created_at),
  };
}

/**
 * Sanitize category object properties with fallback defaults.
 */
export function sanitizeCategory(data: unknown): CategoryResponse {
  if (!data || typeof data !== 'object') {
    return {
      id: '',
      name: '',
      description: null,
      created_at: '',
    };
  }
  const obj = data as Record<string, unknown>;
  return {
    id: sanitizeString(obj.id),
    name: sanitizeString(obj.name),
    description: obj.description ? sanitizeString(obj.description) : null,
    created_at: sanitizeString(obj.created_at),
  };
}

/**
 * Sanitize attachment object properties with fallback defaults.
 */
export function sanitizeAttachment(data: unknown): AttachmentResponse {
  if (!data || typeof data !== 'object') {
    return {
      id: '',
      article_id: '',
      file_name: '',
      file_url: '',
      file_size_bytes: 0,
      created_at: '',
    };
  }
  const obj = data as Record<string, unknown>;
  return {
    id: sanitizeString(obj.id),
    article_id: sanitizeString(obj.article_id),
    file_name: sanitizeString(obj.file_name),
    file_url: sanitizeUrl(obj.file_url),
    file_size_bytes: typeof obj.file_size_bytes === 'number' ? obj.file_size_bytes : 0,
    created_at: sanitizeString(obj.created_at),
  };
}

/**
 * Sanitize playbook step object properties with fallback defaults.
 */
export function sanitizePlaybookStep(data: unknown): PlaybookStepResponse {
  if (!data || typeof data !== 'object') {
    return {
      id: '',
      article_id: '',
      step_number: 0,
      title: '',
      content: '',
      checkpoint_instructions: null,
    };
  }
  const obj = data as Record<string, unknown>;
  return {
    id: sanitizeString(obj.id),
    article_id: sanitizeString(obj.article_id),
    step_number: typeof obj.step_number === 'number' ? obj.step_number : 0,
    title: sanitizeString(obj.title),
    content: sanitizeString(obj.content),
    checkpoint_instructions: obj.checkpoint_instructions ? sanitizeString(obj.checkpoint_instructions) : null,
  };
}

/**
 * Sanitize article summary card object properties with fallback defaults.
 */
export function sanitizeArticleSummary(data: unknown): ArticleSummaryResponse {
  if (!data || typeof data !== 'object') {
    return {
      id: '',
      title: '',
      content_type: 'FAQ',
      body_snippet: '',
      tenant_id: null,
      category_id: null,
      category_name: null,
      tags: [],
      video_url: null,
      is_published: true,
      created_at: '',
      updated_at: '',
    };
  }
  const obj = data as Record<string, unknown>;
  const rawTags = Array.isArray(obj.tags) ? obj.tags : [];
  return {
    id: sanitizeString(obj.id),
    title: sanitizeString(obj.title),
    content_type: sanitizeString(obj.content_type) || 'FAQ',
    body_snippet: sanitizeString(obj.body_snippet),
    tenant_id: obj.tenant_id ? sanitizeString(obj.tenant_id) : null,
    category_id: obj.category_id ? sanitizeString(obj.category_id) : null,
    category_name: obj.category_name ? sanitizeString(obj.category_name) : null,
    tags: rawTags.map(sanitizeTag),
    video_url: obj.video_url ? sanitizeUrl(obj.video_url) : null,
    is_published: typeof obj.is_published === 'boolean' ? obj.is_published : true,
    created_at: sanitizeString(obj.created_at),
    updated_at: sanitizeString(obj.updated_at),
  };
}

/**
 * Sanitize article detail object properties with fallback defaults.
 */
export function sanitizeArticleDetail(data: unknown): ArticleDetailResponse {
  if (!data || typeof data !== 'object') {
    return {
      id: '',
      title: '',
      content_type: 'FAQ',
      body: '',
      tenant_id: null,
      category: null,
      tags: [],
      playbook_steps: [],
      attachments: [],
      video_url: null,
      is_published: true,
      created_at: '',
      updated_at: '',
    };
  }
  const obj = data as Record<string, unknown>;
  const rawTags = Array.isArray(obj.tags) ? obj.tags : [];
  const rawSteps = Array.isArray(obj.playbook_steps) ? obj.playbook_steps : [];
  const rawAttachments = Array.isArray(obj.attachments) ? obj.attachments : [];

  return {
    id: sanitizeString(obj.id),
    title: sanitizeString(obj.title),
    content_type: sanitizeString(obj.content_type) || 'FAQ',
    body: sanitizeString(obj.body),
    tenant_id: obj.tenant_id ? sanitizeString(obj.tenant_id) : null,
    category: obj.category ? sanitizeCategory(obj.category) : null,
    tags: rawTags.map(sanitizeTag),
    playbook_steps: rawSteps.map(sanitizePlaybookStep),
    attachments: rawAttachments.map(sanitizeAttachment),
    video_url: obj.video_url ? sanitizeUrl(obj.video_url) : null,
    is_published: typeof obj.is_published === 'boolean' ? obj.is_published : true,
    created_at: sanitizeString(obj.created_at),
    updated_at: sanitizeString(obj.updated_at),
  };
}

/**
 * Sanitize article search results with fallback defaults.
 */
export function sanitizeArticleSearchResult(data: unknown): ArticleSearchResponse {
  if (!data || typeof data !== 'object') {
    return {
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      total_pages: 0,
    };
  }
  const obj = data as Record<string, unknown>;
  const rawItems = Array.isArray(obj.items) ? obj.items : [];

  return {
    items: rawItems.map(sanitizeArticleSummary),
    total: typeof obj.total === 'number' ? obj.total : 0,
    page: typeof obj.page === 'number' ? obj.page : 1,
    limit: typeof obj.limit === 'number' ? obj.limit : 20,
    total_pages: typeof obj.total_pages === 'number' ? obj.total_pages : 0,
  };
}

/**
 * Sanitize step completion progress response payload.
 */
export function sanitizePlaybookStepProgress(data: unknown): PlaybookStepProgressResponse {
  if (!data || typeof data !== 'object') {
    return {
      step_id: '',
      is_completed: false,
      completed_at: null,
      overall_playbook_progress_percentage: 0,
    };
  }
  const obj = data as Record<string, unknown>;
  return {
    step_id: sanitizeString(obj.step_id),
    is_completed: Boolean(obj.is_completed),
    completed_at: obj.completed_at ? sanitizeString(obj.completed_at) : null,
    overall_playbook_progress_percentage:
      typeof obj.overall_playbook_progress_percentage === 'number'
        ? obj.overall_playbook_progress_percentage
        : 0,
  };
}

/**
 * Sanitize user overall playbook completion progress summary.
 */
export function sanitizePlaybookProgress(data: unknown): PlaybookProgressResponse {
  if (!data || typeof data !== 'object') {
    return {
      article_id: '',
      completed_step_ids: [],
      total_completed: 0,
      total_steps: 0,
      overall_playbook_progress_percentage: 0,
    };
  }
  const obj = data as Record<string, unknown>;
  const rawStepIds = Array.isArray(obj.completed_step_ids) ? obj.completed_step_ids : [];

  return {
    article_id: sanitizeString(obj.article_id),
    completed_step_ids: rawStepIds.map((item) => sanitizeString(item)),
    total_completed: typeof obj.total_completed === 'number' ? obj.total_completed : 0,
    total_steps: typeof obj.total_steps === 'number' ? obj.total_steps : 0,
    overall_playbook_progress_percentage:
      typeof obj.overall_playbook_progress_percentage === 'number'
        ? obj.overall_playbook_progress_percentage
        : 0,
  };
}

/**
 * ---------------------------------------------------------------------------
 * API Client Functions [FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9]
 * ---------------------------------------------------------------------------
 */

/**
 * Search and filter knowledge articles catalog with input validation and pagination [FR-1, FR-2, FR-7, FR-8, NFR-1].
 */
export async function searchArticles(
  params?: ArticleSearchParams,
  options?: RequestOptions
): Promise<ArticleSearchResponse> {
  const queryStr = buildQueryString(params as Record<string, unknown>);
  const endpoint = `/knowledge/articles${queryStr}`;
  const response = await request<ArticleSearchResponse>(endpoint, {
    method: 'GET',
    ...options,
  });
  return sanitizeArticleSearchResult(response);
}

/**
 * Retrieve detailed knowledge article by ID with category, tags, steps, and attachments [FR-1, FR-2, FR-3, FR-5, FR-6, FR-9].
 */
export async function getArticleDetail(
  id: string,
  options?: RequestOptions
): Promise<ArticleDetailResponse> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  const endpoint = `/knowledge/articles/${cleanId}`;
  const response = await request<ArticleDetailResponse>(endpoint, {
    method: 'GET',
    ...options,
  });
  return sanitizeArticleDetail(response);
}

/**
 * Permanently delete a knowledge article and its child resources by ID [FR-1, FR-9, REST rule].
 */
export async function deleteArticle(
  id: string,
  options?: RequestOptions
): Promise<void> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  const endpoint = `/knowledge/articles/${cleanId}`;
  await request<void>(endpoint, {
    method: 'DELETE',
    ...options,
  });
}

/**
 * Toggle playbook step completion status and return updated progress summary [FR-3, FR-4, FR-8].
 */
export async function togglePlaybookStepProgress(
  id: string,
  stepId: string,
  payload: PlaybookStepProgressRequest,
  options?: RequestOptions
): Promise<PlaybookStepProgressResponse> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  const cleanStepId = encodeURIComponent(sanitizeString(stepId));
  const endpoint = `/knowledge/playbooks/${cleanId}/steps/${cleanStepId}/progress`;
  const response = await request<PlaybookStepProgressResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      is_completed: Boolean(payload.is_completed),
    }),
    ...options,
  });
  return sanitizePlaybookStepProgress(response);
}

/**
 * Retrieve overall playbook progress summary for the authenticated user [FR-3, FR-4].
 */
export async function getPlaybookProgress(
  id: string,
  options?: RequestOptions
): Promise<PlaybookProgressResponse> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  const endpoint = `/knowledge/playbooks/${cleanId}/progress`;
  const response = await request<PlaybookProgressResponse>(endpoint, {
    method: 'GET',
    ...options,
  });
  return sanitizePlaybookProgress(response);
}

/**
 * Bundled knowledge service API client object.
 */
export const knowledgeService = {
  searchArticles,
  getArticleDetail,
  deleteArticle,
  togglePlaybookStepProgress,
  getPlaybookProgress,
  sanitizeString,
  sanitizeUrl,
  sanitizeTag,
  sanitizeCategory,
  sanitizeAttachment,
  sanitizePlaybookStep,
  sanitizeArticleSummary,
  sanitizeArticleDetail,
  sanitizeArticleSearchResult,
  sanitizePlaybookStepProgress,
  sanitizePlaybookProgress,
};

export default knowledgeService;
