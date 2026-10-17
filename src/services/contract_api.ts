import {
  request,
  RequestOptions,
  getToken,
  buildUrl,
  removeToken,
  ApiError,
} from './apiClient';

/**
 * Supported contract categories [FR-3].
 */
export type ContractCategory = 'Contract' | 'SOW' | 'NDA' | 'Exhibit';

/**
 * Contract lifecycle status states [FR-6, FR-9].
 */
export type ContractStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'ACTIVE'
  | 'AMENDED'
  | 'TERMINATED'
  | 'EXPIRED';

/**
 * E-signature request status states [FR-5, FR-6].
 */
export type SignatureStatus = 'PENDING' | 'EXECUTED' | 'REJECTED';

/**
 * Clause creation request payload [FR-1].
 */
export interface ClauseCreateRequest {
  clause_type: string;
  title: string;
  body_text: string;
  is_highlighted?: boolean;
}

/**
 * Clause response payload [FR-1].
 */
export interface ClauseResponse {
  id: string;
  contract_id: string;
  clause_type: string;
  title: string;
  body_text: string;
  is_highlighted: boolean;
  created_at: string;
}

/**
 * SLA creation request payload [FR-1].
 */
export interface SLACreateRequest {
  metric_name: string;
  target_value: string;
  penalty_terms?: string | null;
}

/**
 * SLA response payload [FR-1].
 */
export interface SLAResponse {
  id: string;
  contract_id: string;
  metric_name: string;
  target_value: string;
  penalty_terms?: string | null;
  created_at: string;
}

/**
 * Contract creation request payload [FR-3, FR-10].
 */
export interface ContractCreateRequest {
  title: string;
  category: ContractCategory;
  counterparty: string;
  start_on?: string | null;
  expires_on?: string | null;
  parent_contract_id?: string | null;
  clauses?: ClauseCreateRequest[];
  slas?: SLACreateRequest[];
}

/**
 * Contract update request payload.
 */
export interface ContractUpdateRequest {
  title?: string;
  category?: ContractCategory;
  counterparty?: string;
  status?: ContractStatus;
  start_on?: string | null;
  expires_on?: string | null;
}

/**
 * Document version response payload [FR-4].
 */
export interface DocumentVersionResponse {
  id: string;
  contract_id: string;
  category_type: string;
  version_number: number;
  file_path: string;
  checksum: string;
  uploaded_by_id?: string | null;
  created_at: string;
}

/**
 * Amendment creation request payload [FR-7].
 */
export interface AmendmentCreateRequest {
  summary: string;
}

/**
 * Amendment detail response payload [FR-7, FR-8].
 */
export interface AmendmentDetailResponse {
  id: string;
  contract_id: string;
  sequence_number: number;
  summary: string;
  author_id?: string | null;
  created_at: string;
}

/**
 * Amendment list response wrapper [FR-7, FR-8].
 */
export interface AmendmentListResponse {
  items: AmendmentDetailResponse[];
  total_count: number;
}

/**
 * E-signature creation request payload [FR-5].
 */
export interface SignatureCreateRequest {
  signatory_id?: string | null;
}

/**
 * E-signature request response payload [FR-5, FR-6].
 */
export interface SignatureRequestResponse {
  id: string;
  contract_id: string;
  signatory_id?: string | null;
  status: SignatureStatus | string;
  signature_digest?: string | null;
  executed_at?: string | null;
  created_at: string;
}

/**
 * Pending e-signature list response [FR-5].
 */
export interface SignatureListResponse {
  items: SignatureRequestResponse[];
  total_count: number;
}

/**
 * E-signature execution request payload [FR-6].
 */
export interface SignatureExecuteRequest {
  signature_digest: string;
}

/**
 * E-signature execution response payload [FR-6].
 */
export interface SignatureExecuteResponse {
  request_id: string;
  contract_id: string;
  status: SignatureStatus | string;
  executed_at: string;
  signature_digest: string;
}

/**
 * Summary contract response item for repository list view [FR-11].
 */
export interface ContractSummaryResponse {
  id: string;
  title: string;
  category: ContractCategory | string;
  status: ContractStatus | string;
  counterparty: string;
  start_on?: string | null;
  expires_on?: string | null;
  parent_contract_id?: string | null;
  created_at: string;
  updated_at: string;
  sla_count: number;
  active_slas_breached: boolean;
}

/**
 * Paginated contract list query parameters [FR-11].
 */
export interface ContractListQueryParams {
  category?: string;
  status?: string;
  counterparty?: string;
  expires_before?: string;
  expires_after?: string;
  search_query?: string;
  parent_contract_id?: string;
  page?: number;
  limit?: number;
}

/**
 * Paginated contract list response payload [FR-11].
 */
export interface ContractListResponse {
  items: ContractSummaryResponse[];
  total_count: number;
  page: number;
  limit: number;
}

/**
 * Detailed contract inspection response model [FR-1, FR-10].
 */
export interface ContractDetailResponse {
  id: string;
  title: string;
  category: ContractCategory | string;
  status: ContractStatus | string;
  counterparty: string;
  start_on?: string | null;
  expires_on?: string | null;
  parent_contract_id?: string | null;
  created_at: string;
  updated_at: string;
  clauses: ClauseResponse[];
  highlighted_clauses: ClauseResponse[];
  slas: SLAResponse[];
  document_versions: DocumentVersionResponse[];
  active_version?: DocumentVersionResponse | null;
  amendments: AmendmentDetailResponse[];
  signature_requests: SignatureRequestResponse[];
  child_contract_ids: string[];
}

/**
 * SLA evaluation response schema [FR-1].
 */
export interface SLAEvaluationResponse {
  contract_id: string;
  status: string;
  total_slas: number;
  breached_slas: number;
  highlighted_clause_count: number;
  evaluated_at: string;
  slas: Array<Record<string, unknown>>;
  highlighted_clauses: ClauseResponse[];
}

/**
 * Sanitize raw string input or response property by stripping HTML tags,
 * escaping special entities, and removing control characters (NFR-2).
 */
export function sanitizeString(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  let str = String(val).trim();
  if (!str) {
    return '';
  }
  // Strip HTML and script tags
  str = str.replace(/<[^>]*>/g, '');
  // Escape remaining unsafe HTML entity characters
  str = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  // Remove control characters
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return str;
}

/**
 * Multi-criteria repository search and filtering across category, status,
 * expiration date, counterparty, and parent contract ID [FR-1, FR-11].
 */
export async function listContracts(
  params?: ContractListQueryParams,
  options?: RequestOptions
): Promise<ContractListResponse> {
  const queryParts: string[] = [];
  if (params) {
    if (params.category) {
      queryParts.push(`category=${encodeURIComponent(params.category.trim())}`);
    }
    if (params.status) {
      queryParts.push(`status=${encodeURIComponent(params.status.trim())}`);
    }
    if (params.counterparty) {
      queryParts.push(`counterparty=${encodeURIComponent(params.counterparty.trim())}`);
    }
    if (params.expires_before) {
      queryParts.push(`expires_before=${encodeURIComponent(params.expires_before.trim())}`);
    }
    if (params.expires_after) {
      queryParts.push(`expires_after=${encodeURIComponent(params.expires_after.trim())}`);
    }
    if (params.search_query) {
      queryParts.push(`search_query=${encodeURIComponent(params.search_query.trim())}`);
    }
    if (params.parent_contract_id) {
      queryParts.push(`parent_contract_id=${encodeURIComponent(params.parent_contract_id.trim())}`);
    }
    if (params.page !== undefined && params.page > 0) {
      queryParts.push(`page=${params.page}`);
    }
    if (params.limit !== undefined && params.limit > 0) {
      queryParts.push(`limit=${params.limit}`);
    }
  }

  const queryStr = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  return request<ContractListResponse>(`/contracts${queryStr}`, options);
}

/**
 * Create a new contract agreement record [FR-3, FR-10].
 */
export async function createContract(
  payload: ContractCreateRequest,
  options?: RequestOptions
): Promise<ContractDetailResponse> {
  const sanitizedPayload: ContractCreateRequest = {
    ...payload,
    title: sanitizeString(payload.title),
    counterparty: sanitizeString(payload.counterparty),
    category: payload.category,
    start_on: payload.start_on ? sanitizeString(payload.start_on) : null,
    expires_on: payload.expires_on ? sanitizeString(payload.expires_on) : null,
    parent_contract_id: payload.parent_contract_id ? sanitizeString(payload.parent_contract_id) : null,
    clauses: payload.clauses?.map((c) => ({
      ...c,
      title: sanitizeString(c.title),
      clause_type: sanitizeString(c.clause_type),
      body_text: sanitizeString(c.body_text),
    })),
    slas: payload.slas?.map((s) => ({
      ...s,
      metric_name: sanitizeString(s.metric_name),
      target_value: sanitizeString(s.target_value),
      penalty_terms: s.penalty_terms ? sanitizeString(s.penalty_terms) : null,
    })),
  };

  return request<ContractDetailResponse>('/contracts', {
    method: 'POST',
    body: JSON.stringify(sanitizedPayload),
    ...options,
  });
}

/**
 * Fetch detailed contract record including highlighted clauses, key terms,
 * active SLAs, document versions, amendments, and signature requests [FR-1].
 */
export async function getContractDetail(
  id: string,
  options?: RequestOptions
): Promise<ContractDetailResponse> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  return request<ContractDetailResponse>(`/contracts/${cleanId}`, {
    method: 'GET',
    ...options,
  });
}

/**
 * Update contract attributes and lifecycle status transitions [FR-1].
 */
export async function updateContract(
  id: string,
  payload: ContractUpdateRequest,
  options?: RequestOptions
): Promise<ContractDetailResponse> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  const sanitizedPayload: ContractUpdateRequest = { ...payload };
  if (payload.title) {
    sanitizedPayload.title = sanitizeString(payload.title);
  }
  if (payload.counterparty) {
    sanitizedPayload.counterparty = sanitizeString(payload.counterparty);
  }
  if (payload.start_on) {
    sanitizedPayload.start_on = sanitizeString(payload.start_on);
  }
  if (payload.expires_on) {
    sanitizedPayload.expires_on = sanitizeString(payload.expires_on);
  }

  return request<ContractDetailResponse>(`/contracts/${cleanId}`, {
    method: 'PUT',
    body: JSON.stringify(sanitizedPayload),
    ...options,
  });
}

/**
 * Delete a contract record and associated stored documents (204 No Content) [Architecture §5].
 */
export async function deleteContract(
  id: string,
  options?: RequestOptions
): Promise<void> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  return request<void>(`/contracts/${cleanId}`, {
    method: 'DELETE',
    ...options,
  });
}

/**
 * Upload a document file payload, incrementing version number sequentially [FR-3, FR-4, FR-10].
 */
export async function uploadContractDocument(
  id: string,
  file: File | Blob,
  categoryType: string,
  options?: RequestOptions
): Promise<DocumentVersionResponse> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category_type', sanitizeString(categoryType));

  return request<DocumentVersionResponse>(`/contracts/${cleanId}/documents`, {
    method: 'POST',
    body: formData,
    ...options,
  });
}

/**
 * Download document version file payload stream [FR-4].
 */
export async function downloadContractDocument(
  id: string,
  versionId: string,
  options?: RequestOptions
): Promise<Blob> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  const cleanVersionId = encodeURIComponent(sanitizeString(versionId));
  const url = buildUrl(`/contracts/${cleanId}/documents/${cleanVersionId}`);

  const { skipAuth = false, headers: customHeaders, ...restOptions } = options || {};
  const headers = new Headers(customHeaders);

  if (!skipAuth) {
    const token = getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    ...restOptions,
    method: 'GET',
    headers,
  });

  if (response.status === 401) {
    removeToken();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData && typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
      }
    } catch {
      // Ignore non-JSON error
    }
    throw new ApiError(response.status, errorMessage);
  }

  return response.blob();
}

/**
 * Add a clause entry to a contract [FR-1].
 */
export async function addContractClause(
  id: string,
  payload: ClauseCreateRequest,
  options?: RequestOptions
): Promise<ClauseResponse> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  const sanitizedPayload: ClauseCreateRequest = {
    ...payload,
    clause_type: sanitizeString(payload.clause_type),
    title: sanitizeString(payload.title),
    body_text: sanitizeString(payload.body_text),
  };

  return request<ClauseResponse>(`/contracts/${cleanId}/clauses`, {
    method: 'POST',
    body: JSON.stringify(sanitizedPayload),
    ...options,
  });
}

/**
 * Add a Service Level Agreement metric target to a contract [FR-1].
 */
export async function addContractSLA(
  id: string,
  payload: SLACreateRequest,
  options?: RequestOptions
): Promise<SLAResponse> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  const sanitizedPayload: SLACreateRequest = {
    ...payload,
    metric_name: sanitizeString(payload.metric_name),
    target_value: sanitizeString(payload.target_value),
    penalty_terms: payload.penalty_terms ? sanitizeString(payload.penalty_terms) : null,
  };

  return request<SLAResponse>(`/contracts/${cleanId}/slas`, {
    method: 'POST',
    body: JSON.stringify(sanitizedPayload),
    ...options,
  });
}

/**
 * Evaluate active SLAs, highlighted clauses, and key terms for an agreement [FR-1].
 */
export async function evaluateContractSLAs(
  id: string,
  options?: RequestOptions
): Promise<SLAEvaluationResponse> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  return request<SLAEvaluationResponse>(`/contracts/${cleanId}/slas/evaluate`, {
    method: 'GET',
    ...options,
  });
}

/**
 * Append a new amendment to a contract's immutable audit trail [FR-7].
 */
export async function createAmendment(
  id: string,
  payload: AmendmentCreateRequest,
  options?: RequestOptions
): Promise<AmendmentDetailResponse> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  const sanitizedPayload: AmendmentCreateRequest = {
    summary: sanitizeString(payload.summary),
  };

  return request<AmendmentDetailResponse>(`/contracts/${cleanId}/amendments`, {
    method: 'POST',
    body: JSON.stringify(sanitizedPayload),
    ...options,
  });
}

/**
 * Retrieve chronological read-only amendment audit entries for a contract [FR-7, FR-8].
 */
export async function listAmendments(
  id: string,
  options?: RequestOptions
): Promise<AmendmentListResponse> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  return request<AmendmentListResponse>(`/contracts/${cleanId}/amendments`, {
    method: 'GET',
    ...options,
  });
}

/**
 * Block and reject any attempt to modify an existing amendment audit entry [FR-8, NFR-4].
 */
export async function updateAmendmentBlocked(
  id: string,
  amendmentId: string,
  options?: RequestOptions
): Promise<never> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  const cleanAmendmentId = encodeURIComponent(sanitizeString(amendmentId));
  return request<never>(`/contracts/${cleanId}/amendments/${cleanAmendmentId}`, {
    method: 'PUT',
    ...options,
  });
}

/**
 * Block and reject any attempt to delete an existing amendment audit entry [FR-8, NFR-4].
 */
export async function deleteAmendmentBlocked(
  id: string,
  amendmentId: string,
  options?: RequestOptions
): Promise<never> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  const cleanAmendmentId = encodeURIComponent(sanitizeString(amendmentId));
  return request<never>(`/contracts/${cleanId}/amendments/${cleanAmendmentId}`, {
    method: 'DELETE',
    ...options,
  });
}

/**
 * Retrieve all e-signature requests currently in PENDING status for central hub [FR-5].
 */
export async function listPendingSignatures(
  params?: { signatory_id?: string; contract_id?: string },
  options?: RequestOptions
): Promise<SignatureListResponse> {
  const queryParts: string[] = [];
  if (params) {
    if (params.signatory_id) {
      queryParts.push(`signatory_id=${encodeURIComponent(params.signatory_id.trim())}`);
    }
    if (params.contract_id) {
      queryParts.push(`contract_id=${encodeURIComponent(params.contract_id.trim())}`);
    }
  }

  const queryStr = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  return request<SignatureListResponse>(`/signatures/pending${queryStr}`, options);
}

/**
 * Initiate an e-signature request for a contract [FR-5].
 */
export async function requestSignature(
  id: string,
  payload?: SignatureCreateRequest,
  options?: RequestOptions
): Promise<SignatureRequestResponse> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  const sanitizedPayload = payload
    ? {
        signatory_id: payload.signatory_id ? sanitizeString(payload.signatory_id) : null,
      }
    : undefined;

  return request<SignatureRequestResponse>(`/contracts/${cleanId}/signatures/request`, {
    method: 'POST',
    body: sanitizedPayload ? JSON.stringify(sanitizedPayload) : undefined,
    ...options,
  });
}

/**
 * Capture digital signature execution, transition contract status to ACTIVE, notify parties [FR-6].
 */
export async function executeSignature(
  id: string,
  payload: SignatureExecuteRequest,
  options?: RequestOptions
): Promise<SignatureExecuteResponse> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  const sanitizedPayload: SignatureExecuteRequest = {
    signature_digest: sanitizeString(payload.signature_digest),
  };

  return request<SignatureExecuteResponse>(`/signatures/${cleanId}/execute`, {
    method: 'POST',
    body: JSON.stringify(sanitizedPayload),
    ...options,
  });
}

/**
 * Reject an e-signature request and transition status to REJECTED.
 */
export async function rejectSignature(
  id: string,
  reason?: string,
  options?: RequestOptions
): Promise<SignatureRequestResponse> {
  const cleanId = encodeURIComponent(sanitizeString(id));
  const query = reason ? `?reason=${encodeURIComponent(sanitizeString(reason))}` : '';

  return request<SignatureRequestResponse>(`/signatures/${cleanId}/reject${query}`, {
    method: 'POST',
    ...options,
  });
}

export const contractApi = {
  sanitizeString,
  listContracts,
  createContract,
  getContractDetail,
  updateContract,
  deleteContract,
  uploadContractDocument,
  downloadContractDocument,
  addContractClause,
  addContractSLA,
  evaluateContractSLAs,
  createAmendment,
  listAmendments,
  updateAmendmentBlocked,
  deleteAmendmentBlocked,
  listPendingSignatures,
  requestSignature,
  executeSignature,
  rejectSignature,
};

export default contractApi;
