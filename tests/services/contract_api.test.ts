import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  contractApi,
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
  ContractCreateRequest,
  ContractUpdateRequest,
  ClauseCreateRequest,
  SLACreateRequest,
  AmendmentCreateRequest,
  SignatureExecuteRequest,
} from '../../src/services/contract_api';
import { setToken, ApiError } from '../../src/services/apiClient';

describe('contractApi service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeString', () => {
    it('returns empty string for null, undefined, or empty values', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
      expect(sanitizeString('   ')).toBe('');
    });

    it('strips script and HTML markup tags', () => {
      const input = '<script>alert("xss")</script>Agreement <b>Title</b>';
      const result = sanitizeString(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('<b>');
      expect(result).toContain('Agreement Title');
    });

    it('escapes special HTML entity characters', () => {
      const input = 'Terms & Conditions <SLA> "Version 1.0" \'Draft\'';
      const result = sanitizeString(input);
      expect(result).toBe('Terms &amp; Conditions &lt;SLA&gt; &quot;Version 1.0&quot; &#x27;Draft&#x27;');
    });

    it('removes control characters', () => {
      const input = 'Valid\x00Contract\x07Text';
      expect(sanitizeString(input)).toBe('ValidContractText');
    });
  });

  describe('listContracts', () => {
    it('fetches contract list with all query parameters', async () => {
      setToken('mock-auth-token');

      const mockResponse = {
        items: [
          {
            id: 'cnt-101',
            title: 'Master Service Agreement',
            category: 'Contract',
            status: 'ACTIVE',
            counterparty: 'Acme Corp',
            start_on: '2026-01-01',
            expires_on: '2027-01-01',
            parent_contract_id: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            sla_count: 2,
            active_slas_breached: false,
          },
        ],
        total_count: 1,
        page: 1,
        limit: 20,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await listContracts({
        category: 'Contract',
        status: 'ACTIVE',
        counterparty: 'Acme Corp',
        expires_before: '2027-12-31',
        expires_after: '2026-01-01',
        search_query: 'Master',
        parent_contract_id: 'parent-123',
        page: 1,
        limit: 10,
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/v1/contracts?');
      expect(url).toContain('category=Contract');
      expect(url).toContain('status=ACTIVE');
      expect(url).toContain('counterparty=Acme%20Corp');
      expect(url).toContain('expires_before=2027-12-31');
      expect(url).toContain('expires_after=2026-01-01');
      expect(url).toContain('search_query=Master');
      expect(url).toContain('parent_contract_id=parent-123');
      expect(url).toContain('page=1');
      expect(url).toContain('limit=10');
      expect(options.headers.get('Authorization')).toBe('Bearer mock-auth-token');
    });

    it('fetches contract list without parameters', async () => {
      const mockResponse = { items: [], total_count: 0, page: 1, limit: 20 };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await listContracts();
      expect(result).toEqual(mockResponse);
      expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/contracts');
    });
  });

  describe('createContract', () => {
    it('sends POST request with sanitized contract creation payload', async () => {
      setToken('mock-auth-token');

      const payload: ContractCreateRequest = {
        title: '<b>Master Agreement</b>',
        category: 'Contract',
        counterparty: 'Global Tech',
        start_on: '2026-01-01',
        expires_on: '2027-01-01',
        clauses: [
          {
            clause_type: 'Liability',
            title: 'Limitation of Liability',
            body_text: 'Liability capped at 100k.',
            is_highlighted: true,
          },
        ],
        slas: [
          {
            metric_name: 'Uptime',
            target_value: '99.9%',
            penalty_terms: '10% credit',
          },
        ],
      };

      const mockResponse = {
        id: 'cnt-200',
        title: 'Master Agreement',
        category: 'Contract',
        status: 'DRAFT',
        counterparty: 'Global Tech',
        start_on: '2026-01-01',
        expires_on: '2027-01-01',
        parent_contract_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        clauses: [],
        highlighted_clauses: [],
        slas: [],
        document_versions: [],
        active_version: null,
        amendments: [],
        signature_requests: [],
        child_contract_ids: [],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await createContract(payload);

      expect(res).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/contracts');
      expect(options.method).toBe('POST');

      const bodyObj = JSON.parse(options.body as string);
      expect(bodyObj.title).toBe('Master Agreement');
      expect(bodyObj.counterparty).toBe('Global Tech');
      expect(bodyObj.clauses[0].title).toBe('Limitation of Liability');
    });
  });

  describe('getContractDetail', () => {
    it('fetches detailed contract by ID', async () => {
      const mockResponse = {
        id: 'cnt-101',
        title: 'MSA',
        category: 'Contract',
        status: 'ACTIVE',
        counterparty: 'Acme',
        start_on: '2026-01-01',
        expires_on: '2027-01-01',
        parent_contract_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        clauses: [],
        highlighted_clauses: [],
        slas: [],
        document_versions: [],
        active_version: null,
        amendments: [],
        signature_requests: [],
        child_contract_ids: [],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await getContractDetail('cnt-101');
      expect(res).toEqual(mockResponse);
      expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/contracts/cnt-101');
    });
  });

  describe('updateContract', () => {
    it('sends PUT request with sanitized update payload', async () => {
      const payload: ContractUpdateRequest = {
        title: 'Updated Agreement Title',
        status: 'ACTIVE',
      };

      const mockResponse = { id: 'cnt-101', title: 'Updated Agreement Title', status: 'ACTIVE' };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await updateContract('cnt-101', payload);

      expect(res).toEqual(mockResponse);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/contracts/cnt-101');
      expect(options.method).toBe('PUT');
      const sentBody = JSON.parse(options.body as string);
      expect(sentBody.title).toBe('Updated Agreement Title');
    });
  });

  describe('deleteContract', () => {
    it('sends DELETE request and handles 204 No Content', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(deleteContract('cnt-101')).resolves.toBeNull();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/contracts/cnt-101');
      expect(options.method).toBe('DELETE');
    });
  });

  describe('uploadContractDocument', () => {
    it('posts FormData payload to contract documents endpoint', async () => {
      const mockDocResponse = {
        id: 'doc-1',
        contract_id: 'cnt-101',
        category_type: 'Contract',
        version_number: 1,
        file_path: '/uploads/contract_v1.pdf',
        checksum: 'abc123sha256',
        created_at: '2026-01-01T00:00:00Z',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockDocResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      const file = new Blob(['pdf content'], { type: 'application/pdf' });
      const res = await uploadContractDocument('cnt-101', file, 'Contract');

      expect(res).toEqual(mockDocResponse);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/contracts/cnt-101/documents');
      expect(options.method).toBe('POST');
      expect(options.body).toBeInstanceOf(FormData);
    });
  });

  describe('downloadContractDocument', () => {
    it('downloads blob payload with authorization header', async () => {
      setToken('auth-download-token');

      const mockBlob = new Blob(['dummy content'], { type: 'application/pdf' });
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: async () => mockBlob,
      });
      vi.stubGlobal('fetch', mockFetch);

      const blob = await downloadContractDocument('cnt-101', 'doc-ver-1');

      expect(blob).toEqual(mockBlob);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/contracts/cnt-101/documents/doc-ver-1');
      expect(options.headers.get('Authorization')).toBe('Bearer auth-download-token');
    });

    it('throws ApiError on HTTP error response during download', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Document version 'doc-missing' not found." }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(downloadContractDocument('cnt-101', 'doc-missing')).rejects.toThrow(
        "Document version 'doc-missing' not found."
      );
    });
  });

  describe('addContractClause & addContractSLA', () => {
    it('adds clause to contract', async () => {
      const clauseReq: ClauseCreateRequest = {
        clause_type: 'Confidentiality',
        title: 'Non-Disclosure',
        body_text: 'Strict secrecy maintained.',
        is_highlighted: true,
      };

      const mockClauseResponse = { id: 'cl-1', contract_id: 'cnt-101', ...clauseReq, created_at: '2026-01-01T00:00:00Z' };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockClauseResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await addContractClause('cnt-101', clauseReq);
      expect(res).toEqual(mockClauseResponse);
      expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/contracts/cnt-101/clauses');
    });

    it('adds SLA metric to contract', async () => {
      const slaReq: SLACreateRequest = {
        metric_name: 'Response Time',
        target_value: '< 15 mins',
        penalty_terms: '5% penalty',
      };

      const mockSlaResponse = { id: 'sla-1', contract_id: 'cnt-101', ...slaReq, created_at: '2026-01-01T00:00:00Z' };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockSlaResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await addContractSLA('cnt-101', slaReq);
      expect(res).toEqual(mockSlaResponse);
      expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/contracts/cnt-101/slas');
    });

    it('evaluates contract SLAs', async () => {
      const mockEvalResponse = {
        contract_id: 'cnt-101',
        status: 'COMPLIANT',
        total_slas: 1,
        breached_slas: 0,
        highlighted_clause_count: 1,
        evaluated_at: '2026-01-01T00:00:00Z',
        slas: [],
        highlighted_clauses: [],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockEvalResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await evaluateContractSLAs('cnt-101');
      expect(res).toEqual(mockEvalResponse);
      expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/contracts/cnt-101/slas/evaluate');
    });
  });

  describe('Amendments API', () => {
    it('creates amendment and lists amendments', async () => {
      const amdReq: AmendmentCreateRequest = { summary: 'Added Exhibit A.' };
      const mockAmdDetail = {
        id: 'amd-1',
        contract_id: 'cnt-101',
        sequence_number: 1,
        summary: 'Added Exhibit A.',
        author_id: 'usr-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockAmdDetail,
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await createAmendment('cnt-101', amdReq);
      expect(res).toEqual(mockAmdDetail);

      const mockList = { items: [mockAmdDetail], total_count: 1 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockList,
      });

      const listRes = await listAmendments('cnt-101');
      expect(listRes).toEqual(mockList);
    });

    it('throws ApiError 403 when invoking update or delete on immutable amendments', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ detail: 'Contract amendment records are immutable.' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(updateAmendmentBlocked('cnt-101', 'amd-1')).rejects.toThrow(
        'Contract amendment records are immutable.'
      );
      await expect(deleteAmendmentBlocked('cnt-101', 'amd-1')).rejects.toThrow(
        'Contract amendment records are immutable.'
      );
    });
  });

  describe('Signatures Hub API', () => {
    it('lists pending signatures', async () => {
      const mockSigList = {
        items: [
          {
            id: 'sig-1',
            contract_id: 'cnt-101',
            signatory_id: 'usr-1',
            status: 'PENDING',
            signature_digest: null,
            executed_at: null,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        total_count: 1,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSigList,
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await listPendingSignatures({ signatory_id: 'usr-1', contract_id: 'cnt-101' });
      expect(res).toEqual(mockSigList);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/v1/signatures/pending?');
      expect(url).toContain('signatory_id=usr-1');
      expect(url).toContain('contract_id=cnt-101');
    });

    it('requests, executes, and rejects signatures', async () => {
      const mockSigReq = {
        id: 'sig-1',
        contract_id: 'cnt-101',
        signatory_id: 'usr-1',
        status: 'PENDING',
        created_at: '2026-01-01T00:00:00Z',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockSigReq,
      });
      vi.stubGlobal('fetch', mockFetch);

      const reqRes = await requestSignature('cnt-101', { signatory_id: 'usr-1' });
      expect(reqRes).toEqual(mockSigReq);

      // Execute signature
      const execReq: SignatureExecuteRequest = { signature_digest: 'sha256-signature-digest' };
      const mockExecRes = {
        request_id: 'sig-1',
        contract_id: 'cnt-101',
        status: 'EXECUTED',
        executed_at: '2026-01-01T00:01:00Z',
        signature_digest: 'sha256-signature-digest',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockExecRes,
      });

      const execRes = await executeSignature('sig-1', execReq);
      expect(execRes).toEqual(mockExecRes);

      // Reject signature
      const mockRejectRes = { ...mockSigReq, status: 'REJECTED' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRejectRes,
      });

      const rejectRes = await rejectSignature('sig-1', 'Terms unacceptable');
      expect(rejectRes).toEqual(mockRejectRes);
      expect(mockFetch.mock.calls[2][0]).toContain('/api/v1/signatures/sig-1/reject?reason=Terms%20unacceptable');
    });
  });

  describe('contractApi default export object', () => {
    it('exposes all wrapper functions', () => {
      expect(typeof contractApi.listContracts).toBe('function');
      expect(typeof contractApi.createContract).toBe('function');
      expect(typeof contractApi.getContractDetail).toBe('function');
      expect(typeof contractApi.updateContract).toBe('function');
      expect(typeof contractApi.deleteContract).toBe('function');
      expect(typeof contractApi.uploadContractDocument).toBe('function');
      expect(typeof contractApi.downloadContractDocument).toBe('function');
      expect(typeof contractApi.addContractClause).toBe('function');
      expect(typeof contractApi.addContractSLA).toBe('function');
      expect(typeof contractApi.evaluateContractSLAs).toBe('function');
      expect(typeof contractApi.createAmendment).toBe('function');
      expect(typeof contractApi.listAmendments).toBe('function');
      expect(typeof contractApi.updateAmendmentBlocked).toBe('function');
      expect(typeof contractApi.deleteAmendmentBlocked).toBe('function');
      expect(typeof contractApi.listPendingSignatures).toBe('function');
      expect(typeof contractApi.requestSignature).toBe('function');
      expect(typeof contractApi.executeSignature).toBe('function');
      expect(typeof contractApi.rejectSignature).toBe('function');
      expect(typeof contractApi.sanitizeString).toBe('function');
    });
  });
});
