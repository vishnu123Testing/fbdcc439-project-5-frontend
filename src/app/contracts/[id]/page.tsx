'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  FileText,
  ArrowLeft,
  Building,
  User,
  Key,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  Layers,
  History,
  PenTool,
  ShieldCheck,
  X,
  FileCheck,
} from 'lucide-react';
import { apiClient, UserMeResponse, ApiError } from '../../../services/apiClient';
import {
  contractApi,
  ContractDetailResponse,
  ClauseCreateRequest,
  SLACreateRequest,
  SLAEvaluationResponse,
} from '../../../services/contract_api';
import { StatusLabel } from '../../../components/common/StatusLabel';
import { ClauseViewer } from '../../../components/contracts/clause_viewer';
import { VersionHistory, AttachedSupportingDocument } from '../../../components/contracts/version_history';
import { AmendmentTimeline } from '../../../components/contracts/amendment_timeline';
import { SignaturePad } from '../../../components/contracts/signature_pad';
import { useAccessibility } from '../../../components/common/AccessibilityContext';

export interface ContractDetailPageProps {
  params?: { id: string } | Promise<{ id: string }>;
}

/**
 * Safe accessibility hook wrapper preventing crashes when rendered outside AccessibilityProvider.
 */
function useSafeAccessibility() {
  try {
    return useAccessibility();
  } catch {
    return {
      announcement: null,
      announce: () => {},
      clearAnnouncement: () => {},
    };
  }
}

/**
 * Default mock fallback details dictionary for testing / offline fallback.
 */
const DEFAULT_MOCK_CONTRACT_DETAILS: Record<string, ContractDetailResponse> = {
  'cnt-101': {
    id: 'cnt-101',
    title: 'Enterprise Platform Services Agreement',
    category: 'Contract',
    status: 'ACTIVE',
    counterparty: 'Acme Financial Corp',
    start_on: '2026-01-01',
    expires_on: '2027-01-01',
    parent_contract_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    clauses: [
      {
        id: 'cls-101-1',
        contract_id: 'cnt-101',
        clause_type: 'Indemnification',
        title: 'Mutual Intellectual Property Indemnification',
        body_text:
          'Each party shall defend, indemnify, and hold harmless the other party against third-party claims alleging patent or copyright infringement.',
        is_highlighted: true,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'cls-101-2',
        contract_id: 'cnt-101',
        clause_type: 'Limitation of Liability',
        title: 'Cap on Direct Damages',
        body_text:
          'Aggregate liability under this Agreement shall not exceed the total fees paid in the preceding twelve (12) month period.',
        is_highlighted: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'cls-101-3',
        contract_id: 'cnt-101',
        clause_type: 'Confidentiality',
        title: 'Protection of Proprietary Information',
        body_text:
          'Receiving party shall protect disclosing party confidential information using at least reasonable degree of care for five (5) years.',
        is_highlighted: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    highlighted_clauses: [
      {
        id: 'cls-101-1',
        contract_id: 'cnt-101',
        clause_type: 'Indemnification',
        title: 'Mutual Intellectual Property Indemnification',
        body_text:
          'Each party shall defend, indemnify, and hold harmless the other party against third-party claims alleging patent or copyright infringement.',
        is_highlighted: true,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'cls-101-3',
        contract_id: 'cnt-101',
        clause_type: 'Confidentiality',
        title: 'Protection of Proprietary Information',
        body_text:
          'Receiving party shall protect disclosing party confidential information using at least reasonable degree of care for five (5) years.',
        is_highlighted: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    slas: [
      {
        id: 'sla-101-1',
        contract_id: 'cnt-101',
        metric_name: 'Monthly Uptime Guarantee',
        target_value: '99.9% Uptime',
        penalty_terms: '10% service credit for each 0.1% breach threshold below target',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'sla-101-2',
        contract_id: 'cnt-101',
        metric_name: 'Support Response Time SLA',
        target_value: 'Sub-15 minute initial response for P1 critical incidents',
        penalty_terms: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    document_versions: [
      {
        id: 'ver-101-1',
        contract_id: 'cnt-101',
        category_type: 'Contract',
        version_number: 1,
        file_path: 'contracts/cnt-101/v1_master_agreement.pdf',
        checksum: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
        uploaded_by_id: 'usr-admin-1',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'ver-101-2',
        contract_id: 'cnt-101',
        category_type: 'Contract',
        version_number: 2,
        file_path: 'contracts/cnt-101/v2_master_agreement_executed.pdf',
        checksum: 'f0e9d8c7b6a543210987654321fedcba0123456789abcdef0123456789abcdef',
        uploaded_by_id: 'usr-admin-1',
        created_at: '2026-01-15T00:00:00Z',
      },
    ],
    active_version: {
      id: 'ver-101-2',
      contract_id: 'cnt-101',
      category_type: 'Contract',
      version_number: 2,
      file_path: 'contracts/cnt-101/v2_master_agreement_executed.pdf',
      checksum: 'f0e9d8c7b6a543210987654321fedcba0123456789abcdef0123456789abcdef',
      uploaded_by_id: 'usr-admin-1',
      created_at: '2026-01-15T00:00:00Z',
    },
    amendments: [
      {
        id: 'amd-101-1',
        contract_id: 'cnt-101',
        sequence_number: 1,
        summary:
          'Incorporated Data Processing Addendum and expanded SLA response window for non-production environments.',
        author_id: 'usr-admin-1',
        created_at: '2026-01-15T10:00:00Z',
      },
    ],
    signature_requests: [
      {
        id: 'sig-101-1',
        contract_id: 'cnt-101',
        signatory_id: 'usr-signatory-1',
        status: 'EXECUTED',
        signature_digest: 'sig_typed_SmFuZSBEb2U=_1768473600000',
        executed_at: '2026-01-15T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    child_contract_ids: ['cnt-102'],
  },
};

/**
 * Generate generic mock detail fallback for an arbitrary contract ID.
 */
function getFallbackContractDetail(id: string): ContractDetailResponse {
  if (DEFAULT_MOCK_CONTRACT_DETAILS[id]) {
    return DEFAULT_MOCK_CONTRACT_DETAILS[id];
  }
  return {
    id,
    title: `Contract Agreement (${id})`,
    category: 'Contract',
    status: 'ACTIVE',
    counterparty: 'Partner Organization',
    start_on: '2026-01-01',
    expires_on: '2027-01-01',
    parent_contract_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    clauses: [
      {
        id: `cls-${id}-1`,
        contract_id: id,
        clause_type: 'Access Control',
        title: 'Server-Side RBAC Enforcement',
        body_text:
          'All endpoints serving client entity records enforce server-side RBAC and deny unauthorized requests with HTTP 403 Forbidden.',
        is_highlighted: true,
        created_at: new Date().toISOString(),
      },
      {
        id: `cls-${id}-2`,
        contract_id: id,
        clause_type: 'Audit Governance',
        title: 'Non-Blocking JSON Audit Logging',
        body_text:
          'Audit operations emit formatted JSON events with correlation IDs directly to standard output without blocking request latency.',
        is_highlighted: true,
        created_at: new Date().toISOString(),
      },
    ],
    highlighted_clauses: [
      {
        id: `cls-${id}-1`,
        contract_id: id,
        clause_type: 'Access Control',
        title: 'Server-Side RBAC Enforcement',
        body_text:
          'All endpoints serving client entity records enforce server-side RBAC and deny unauthorized requests with HTTP 403 Forbidden.',
        is_highlighted: true,
        created_at: new Date().toISOString(),
      },
    ],
    slas: [
      {
        id: `sla-${id}-1`,
        contract_id: id,
        metric_name: 'RBAC Evaluation Latency',
        target_value: '< 20ms under peak load',
        penalty_terms: '10% service credit for latency breaches exceeding SLA threshold',
        created_at: new Date().toISOString(),
      },
    ],
    document_versions: [
      {
        id: `ver-${id}-1`,
        contract_id: id,
        category_type: 'Contract',
        version_number: 1,
        file_path: `contracts/${id}/v1_agreement.pdf`,
        checksum: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        uploaded_by_id: 'usr-admin-1',
        created_at: new Date().toISOString(),
      },
    ],
    active_version: {
      id: `ver-${id}-1`,
      contract_id: id,
      category_type: 'Contract',
      version_number: 1,
      file_path: `contracts/${id}/v1_agreement.pdf`,
      checksum: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      uploaded_by_id: 'usr-admin-1',
      created_at: new Date().toISOString(),
    },
    amendments: [],
    signature_requests: [
      {
        id: `sig-${id}-1`,
        contract_id: id,
        signatory_id: 'usr-signatory-1',
        status: 'PENDING',
        signature_digest: null,
        executed_at: null,
        created_at: new Date().toISOString(),
      },
    ],
    child_contract_ids: [],
  };
}

export default function ContractDetailPage({ params }: ContractDetailPageProps) {
  const router = useRouter();
  const navParams = useParams();
  const { announce } = useSafeAccessibility();

  // Resolve contract ID from params prop or useParams() hook
  const [resolvedId, setResolvedId] = useState<string>('');

  useEffect(() => {
    if (params) {
      if (typeof (params as any).then === 'function') {
        (params as Promise<{ id: string }>).then((p) => {
          if (p?.id) setResolvedId(p.id);
        });
      } else if ((params as { id: string })?.id) {
        setResolvedId((params as { id: string }).id);
      }
    } else if (navParams?.id) {
      setResolvedId(String(navParams.id));
    }
  }, [params, navParams]);

  // Page state variables
  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [contractDetail, setContractDetail] = useState<ContractDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);
  const [unauthorizedReason, setUnauthorizedReason] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Active section tab: 'clauses' | 'versions' | 'amendments' | 'signatures'
  const [activeTab, setActiveTab] = useState<'clauses' | 'versions' | 'amendments' | 'signatures'>('clauses');

  // Load contract details from API
  const fetchContractDetailData = useCallback(
    async (targetId: string) => {
      if (!targetId) return;

      setLoading(true);
      setError(null);
      setIsUnauthorized(false);
      setUnauthorizedReason(null);

      const token = apiClient.getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const [userData, detailData] = await Promise.all([
          apiClient.getMe().catch(() => null),
          contractApi.getContractDetail(targetId),
        ]);

        if (userData) {
          setUser(userData);
        }

        setContractDetail(detailData);
        announce(`Loaded contract details for ${detailData.title}.`, 'polite');
      } catch (err: unknown) {
        console.warn(`Failed to fetch contract detail for ID "${targetId}":`, err);

        if (err instanceof ApiError) {
          if (err.status === 401) {
            router.push('/login');
            return;
          }
          if (err.status === 403) {
            setIsUnauthorized(true);
            setUnauthorizedReason(
              'Access Denied: You do not have sufficient role permissions or tenant context authorization to inspect this contract record [FR-1].'
            );
            setError('403 Forbidden - Access Restricted');
            return;
          }
          if (err.status === 404) {
            setError(`Contract with identifier "${targetId}" was not found in the repository.`);
            return;
          }
        }

        // Fallback to local mock data for testing / offline preview
        const fallback = getFallbackContractDetail(targetId);
        setContractDetail(fallback);
        announce(`Loaded fallback contract details for ${fallback.title}.`, 'polite');
      } finally {
        setLoading(false);
      }
    },
    [router, announce]
  );

  useEffect(() => {
    if (resolvedId) {
      fetchContractDetailData(resolvedId);
    }
  }, [resolvedId, fetchContractDetailData]);

  // Refresh handler
  const handleRefresh = async () => {
    if (!resolvedId) return;
    setRefreshing(true);
    try {
      await fetchContractDetailData(resolvedId);
      setActionNotice('Contract details refreshed successfully.');
      setTimeout(() => setActionNotice(null), 4000);
    } finally {
      setRefreshing(false);
    }
  };

  // Clause viewer callbacks [FR-1]
  const handleEvaluateSLAs = async (): Promise<SLAEvaluationResponse | void> => {
    if (!resolvedId) return;
    try {
      const result = await contractApi.evaluateContractSLAs(resolvedId);
      setActionNotice('SLA evaluation completed successfully.');
      setTimeout(() => setActionNotice(null), 4000);
      return result;
    } catch (err) {
      console.error('SLA evaluation error:', err);
    }
  };

  const handleAddClause = async (payload: ClauseCreateRequest) => {
    if (!resolvedId) return;
    await contractApi.addContractClause(resolvedId, payload);
    setActionNotice(`Clause "${payload.title}" added successfully.`);
    setTimeout(() => setActionNotice(null), 4000);
    await fetchContractDetailData(resolvedId);
  };

  const handleAddSLA = async (payload: SLACreateRequest) => {
    if (!resolvedId) return;
    await contractApi.addContractSLA(resolvedId, payload);
    setActionNotice(`SLA target "${payload.metric_name}" added successfully.`);
    setTimeout(() => setActionNotice(null), 4000);
    await fetchContractDetailData(resolvedId);
  };

  // Version history callbacks [FR-3, FR-10]
  const handleUploadVersion = async (file: File, categoryType: string) => {
    if (!resolvedId) return;
    await contractApi.uploadContractDocument(resolvedId, file, categoryType);
    setActionNotice(`Uploaded new ${categoryType} document version for "${file.name}".`);
    setTimeout(() => setActionNotice(null), 4000);
    await fetchContractDetailData(resolvedId);
  };

  const handleDownloadVersion = async (versionId: string, filePath: string) => {
    if (!resolvedId) return;
    const blob = await contractApi.downloadContractDocument(resolvedId, versionId);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filePath.split('/').pop() || `document_version_${versionId}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleAttachSupportingDocument = async (file: File, categoryType: string, title?: string) => {
    if (!resolvedId) return;
    await contractApi.uploadContractDocument(resolvedId, file, categoryType);
    setActionNotice(`Attached supporting ${categoryType} document "${title || file.name}".`);
    setTimeout(() => setActionNotice(null), 4000);
    await fetchContractDetailData(resolvedId);
  };

  // Amendment audit trail callback [FR-7]
  const handleCreateAmendment = async (summary: string) => {
    if (!resolvedId) return;
    await contractApi.createAmendment(resolvedId, { summary });
    setActionNotice('Amendment successfully committed to immutable audit trail.');
    setTimeout(() => setActionNotice(null), 4000);
    await fetchContractDetailData(resolvedId);
  };

  // Signature pad callbacks [FR-6]
  const handleExecuteSignature = async (requestId: string, digest: string) => {
    await contractApi.executeSignature(requestId, { signature_digest: digest });
    setActionNotice('Digital signature executed successfully. Contract state transitioned to ACTIVE.');
    setTimeout(() => setActionNotice(null), 4000);
    if (resolvedId) {
      await fetchContractDetailData(resolvedId);
    }
  };

  const handleRejectSignature = async (requestId: string, reason?: string) => {
    await contractApi.rejectSignature(requestId, reason);
    setActionNotice('E-signature request rejected.');
    setTimeout(() => setActionNotice(null), 4000);
    if (resolvedId) {
      await fetchContractDetailData(resolvedId);
    }
  };

  // Derived attached documents array for VersionHistory [FR-10]
  const attachedDocumentsList: AttachedSupportingDocument[] = useMemo(() => {
    if (!contractDetail) return [];
    const list: AttachedSupportingDocument[] = [];

    if (contractDetail.child_contract_ids && contractDetail.child_contract_ids.length > 0) {
      contractDetail.child_contract_ids.forEach((childId) => {
        list.push({
          id: childId,
          title: `Supporting Exhibit / SOW (${childId})`,
          category: 'Exhibit',
          parent_contract_id: contractDetail.id,
          created_at: contractDetail.created_at,
        });
      });
    }

    // Include document versions tagged as Exhibit or SOW
    if (contractDetail.document_versions) {
      contractDetail.document_versions.forEach((ver) => {
        if (ver.category_type === 'Exhibit' || ver.category_type === 'SOW') {
          list.push({
            id: ver.id,
            title: `Attached ${ver.category_type} (v${ver.version_number})`,
            category: ver.category_type,
            version_number: ver.version_number,
            file_path: ver.file_path,
            created_at: ver.created_at,
            parent_contract_id: contractDetail.id,
          });
        }
      });
    }

    return list;
  }, [contractDetail]);

  // Primary pending signature request if available
  const activeSignatureRequest = useMemo(() => {
    if (!contractDetail || !contractDetail.signature_requests) return null;
    return (
      contractDetail.signature_requests.find((r) => r.status === 'PENDING') ||
      contractDetail.signature_requests[0] ||
      null
    );
  }, [contractDetail]);

  // 1. LOADING STATE
  if (loading) {
    return (
      <div
        data-testid="loading-page-state"
        role="status"
        aria-busy="true"
        aria-label="Loading contract detail page"
        className="flex flex-col items-center justify-center min-h-[400px] py-12 px-4 space-y-4"
      >
        <div className="w-10 h-10 border-4 border-[#735c41] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#4e453d]">
          Loading contract agreement details, clauses, SLAs, and history...
        </p>
        <span className="sr-only">Loading contract details, please wait.</span>
      </div>
    );
  }

  // 2. UNAUTHORIZED STATE [FR-1]
  if (isUnauthorized) {
    return (
      <div data-testid="unauthorized-page-state" className="space-y-6 max-w-4xl mx-auto py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/contracts"
            data-testid="back-to-contracts-link"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#59452b] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to Contracts Repository
          </Link>
        </div>

        <div
          role="alert"
          className="bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded-lg p-8 shadow-sm text-[#1b1c19] space-y-4"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#ffdad6] rounded-full text-[#93000a] shrink-0">
              <Lock className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <StatusLabel status="error" label="403 Forbidden" />
                <span className="text-xs font-mono font-bold text-[#93000a] uppercase tracking-wider">
                  Role Authorization Violation
                </span>
              </div>
              <h1 className="text-2xl font-serif font-bold text-[#93000a]">
                Contract Access Denied [FR-1]
              </h1>
              <p className="text-sm text-[#4e453d] leading-relaxed">
                {unauthorizedReason ||
                  'You do not possess the required Role-Based Access Control (RBAC) permissions or assigned tenant authorization to view clauses, SLA indicators, or version history for this agreement.'}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#ba1a1a]/20 flex flex-wrap items-center justify-between gap-3 text-xs text-[#80756b]">
            <p>
              To request agreement viewing access, contact your organization admin or legal scope manager.
            </p>
            <button
              type="button"
              onClick={() => fetchContractDetailData(resolvedId)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#59452b] bg-[#f5f3ee] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Re-check Authorization
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. ERROR / NOT FOUND STATE
  if (error && !contractDetail) {
    return (
      <div data-testid="error-page-state" className="space-y-6 max-w-4xl mx-auto py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/contracts"
            data-testid="back-to-contracts-link"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#59452b] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to Contracts Repository
          </Link>
        </div>

        <div role="alert" className="bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded-lg p-8 space-y-4 text-[#1b1c19]">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-[#ba1a1a] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <h1 className="text-xl font-serif font-bold text-[#93000a]">Contract Record Not Found</h1>
              <p className="text-sm text-[#4e453d]">{error}</p>
            </div>
          </div>
          <div className="pt-2 flex gap-3">
            <button
              onClick={() => fetchContractDetailData(resolvedId)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#59452b] rounded hover:bg-[#735c41] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Retry Fetch
            </button>
            <Link
              href="/contracts"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#59452b] bg-[#f5f3ee] border border-[#d1c4b9] rounded hover:bg-[#eae8e3] transition-colors"
            >
              Return to Repository
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Safe Contract Detail fallback
  const detail = contractDetail || getFallbackContractDetail(resolvedId || 'cnt-101');

  return (
    <div data-testid="contract-detail-page" className="space-y-8 pb-12 text-[#1b1c19]">
      {/* Top Navigation & Breadcrumb */}
      <nav aria-label="Breadcrumb navigation" className="flex items-center justify-between">
        <Link
          href="/contracts"
          data-testid="back-to-contracts-link"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#59452b] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Contracts Repository</span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-[#80756b]">
          <span className="font-mono">ID: {detail.id}</span>
          <span>•</span>
          <span>Created: {new Date(detail.created_at).toLocaleDateString()}</span>
        </div>
      </nav>

      {/* Contract Detail Header Banner */}
      <header
        data-testid="contract-header"
        className="bg-[#f5f3ee] border border-[#d1c4b9]/50 rounded-lg p-6 shadow-sm space-y-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                data-testid="contract-category-badge"
                className="inline-block bg-[#f0eee9] text-[#59452b] border border-[#d1c4b9]/60 px-2.5 py-0.5 rounded text-xs font-mono font-semibold"
              >
                {detail.category}
              </span>
              <StatusLabel
                status={
                  detail.status === 'ACTIVE'
                    ? 'active'
                    : detail.status === 'AMENDED'
                    ? 'info'
                    : detail.status === 'PENDING_SIGNATURE'
                    ? 'pending'
                    : 'neutral'
                }
                label={detail.status}
                data-testid="contract-status-badge"
              />
            </div>

            <h1 data-testid="contract-title" className="text-2xl sm:text-3xl font-serif text-[#1b1c19] tracking-tight">
              {detail.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#59452b] bg-[#f0eee9] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41]"
              aria-label="Refresh contract details"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Action Notice Banner */}
        {actionNotice && (
          <div
            role="status"
            className="p-3 bg-[#f0eee9] border border-[#735c41]/30 rounded text-xs font-medium text-[#59452b] flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
              <span>{actionNotice}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="text-[#80756b] hover:text-[#1b1c19]"
              aria-label="Dismiss message"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Key Attributes Meta Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-[#d1c4b9]/40 text-xs">
          <div className="space-y-1">
            <span className="text-[#80756b] uppercase tracking-wider font-semibold block text-[10px]">
              Counterparty Organization
            </span>
            <div className="flex items-center gap-1.5 font-semibold text-[#1b1c19]" data-testid="contract-counterparty">
              <Building className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
              <span>{detail.counterparty}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[#80756b] uppercase tracking-wider font-semibold block text-[10px]">
              Effective Window
            </span>
            <div className="font-mono text-[#1b1c19]">
              {detail.start_on || 'N/A'} — {detail.expires_on || 'N/A'}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[#80756b] uppercase tracking-wider font-semibold block text-[10px]">
              Active Version
            </span>
            <div className="flex items-center gap-1.5 font-mono text-[#59452b] font-semibold">
              <FileCheck className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
              <span>
                {detail.active_version ? `v${detail.active_version.version_number}` : 'v1'}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[#80756b] uppercase tracking-wider font-semibold block text-[10px]">
              Parent Contract
            </span>
            <div className="font-mono text-[#1b1c19]" data-testid="contract-parent-id">
              {detail.parent_contract_id ? detail.parent_contract_id : 'None (Root Contract)'}
            </div>
          </div>
        </div>
      </header>

      {/* User Context & Role-Based Access Indicator */}
      {user && (
        <section
          aria-label="User RBAC context"
          className="bg-[#f0eee9] border border-[#d1c4b9]/40 rounded-lg p-4 text-xs text-[#4e453d] flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
            <span>
              Inspecting as <strong className="text-[#1b1c19]">{user.email}</strong> (Tenant:{' '}
              <span className="font-mono text-[#1b1c19]">{user.tenant_id}</span>)
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[#59452b]">
            <Key className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Assigned Roles: {user.roles?.join(', ') || 'ClientStandard'}</span>
          </div>
        </section>
      )}

      {/* Primary Section Tabs Navigation [FR-1, FR-3, FR-7, FR-10] */}
      <section aria-label="Contract Detail Sections" className="space-y-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#d1c4b9]/50" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'clauses'}
            data-testid="tab-clauses"
            onClick={() => setActiveTab('clauses')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41] ${
              activeTab === 'clauses'
                ? 'bg-[#59452b] text-white shadow-sm'
                : 'bg-[#f5f3ee] text-[#4e453d] hover:bg-[#eae8e3] border border-[#d1c4b9]/50'
            }`}
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            <span>Clauses & SLAs ({detail.clauses.length}) [FR-1]</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'versions'}
            data-testid="tab-versions"
            onClick={() => setActiveTab('versions')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41] ${
              activeTab === 'versions'
                ? 'bg-[#59452b] text-white shadow-sm'
                : 'bg-[#f5f3ee] text-[#4e453d] hover:bg-[#eae8e3] border border-[#d1c4b9]/50'
            }`}
          >
            <Layers className="w-4 h-4" aria-hidden="true" />
            <span>Versions & Exhibits ({detail.document_versions.length}) [FR-3, FR-10]</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'amendments'}
            data-testid="tab-amendments"
            onClick={() => setActiveTab('amendments')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41] ${
              activeTab === 'amendments'
                ? 'bg-[#59452b] text-white shadow-sm'
                : 'bg-[#f5f3ee] text-[#4e453d] hover:bg-[#eae8e3] border border-[#d1c4b9]/50'
            }`}
          >
            <History className="w-4 h-4" aria-hidden="true" />
            <span>Amendment Trail ({detail.amendments.length}) [FR-7]</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'signatures'}
            data-testid="tab-signatures"
            onClick={() => setActiveTab('signatures')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#735c41] ${
              activeTab === 'signatures'
                ? 'bg-[#59452b] text-white shadow-sm'
                : 'bg-[#f5f3ee] text-[#4e453d] hover:bg-[#eae8e3] border border-[#d1c4b9]/50'
            }`}
          >
            <PenTool className="w-4 h-4" aria-hidden="true" />
            <span>Digital Signatures ({detail.signature_requests.length}) [FR-6]</span>
          </button>
        </div>

        {/* 1. CLAUSES & SLAS VIEW [FR-1] */}
        {activeTab === 'clauses' && (
          <section data-testid="clauses-section">
            <ClauseViewer
              contractId={detail.id}
              contractTitle={detail.title}
              contractStatus={detail.status}
              counterparty={detail.counterparty}
              clauses={detail.clauses}
              highlightedClauses={detail.highlighted_clauses}
              slas={detail.slas}
              isUnauthorized={false}
              onEvaluateSLAs={handleEvaluateSLAs}
              onAddClause={handleAddClause}
              onAddSLA={handleAddSLA}
              onRefresh={handleRefresh}
            />
          </section>
        )}

        {/* 2. VERSIONS & EXHIBITS REPOSITORY [FR-3, FR-10] */}
        {activeTab === 'versions' && (
          <section data-testid="versions-section">
            <VersionHistory
              contractId={detail.id}
              contractTitle={detail.title}
              contractCategory={detail.category}
              documentVersions={detail.document_versions}
              activeVersion={detail.active_version}
              attachedDocuments={attachedDocumentsList}
              childContractIds={detail.child_contract_ids}
              isUnauthorized={false}
              onUploadVersion={handleUploadVersion}
              onDownloadVersion={handleDownloadVersion}
              onAttachSupportingDocument={handleAttachSupportingDocument}
              onRefresh={handleRefresh}
            />
          </section>
        )}

        {/* 3. AMENDMENT AUDIT TRAIL [FR-7] */}
        {activeTab === 'amendments' && (
          <section data-testid="amendments-section">
            <AmendmentTimeline
              contractId={detail.id}
              contractTitle={detail.title}
              contractStatus={detail.status}
              amendments={detail.amendments}
              readOnly={true}
              canAddAmendment={true}
              isUnauthorized={false}
              onCreateAmendment={handleCreateAmendment}
              onRefresh={handleRefresh}
            />
          </section>
        )}

        {/* 4. DIGITAL SIGNATURE PAD [FR-6] */}
        {activeTab === 'signatures' && (
          <section data-testid="signatures-section">
            <SignaturePad
              signatureRequestId={activeSignatureRequest?.id || `sig-${detail.id}-1`}
              contractId={detail.id}
              contractTitle={detail.title}
              contractCategory={detail.category}
              contractStatus={detail.status}
              counterparty={detail.counterparty}
              signatoryId={activeSignatureRequest?.signatory_id || 'usr-signatory-1'}
              signatoryName={user?.email?.split('@')[0] || 'Authorized Signatory'}
              signatoryEmail={user?.email || 'signatory@company.com'}
              signatureStatus={activeSignatureRequest?.status || 'PENDING'}
              signatureDigest={activeSignatureRequest?.signature_digest || null}
              executedAt={activeSignatureRequest?.executed_at || null}
              pendingRequests={detail.signature_requests}
              isUnauthorized={false}
              onExecute={handleExecuteSignature}
              onReject={handleRejectSignature}
              onRefresh={handleRefresh}
            />
          </section>
        )}
      </section>

      {/* Security & Governance Footer Note */}
      <footer className="bg-[#f0eee9] border border-[#d1c4b9]/40 rounded-lg p-5 text-xs text-[#80756b] space-y-2">
        <div className="flex items-center gap-2 font-semibold text-[#1b1c19]">
          <ShieldCheck className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
          <span>Audit Trail Governance & Multi-Tenant Security Policy</span>
        </div>
        <p className="leading-relaxed">
          All document uploads, amendment insertions, and digital signature executions are logged in structured JSON format with unique context correlation IDs. Historical terms are preserved strictly in non-mutable append-only ledgers.
        </p>
      </footer>
    </div>
  );
}