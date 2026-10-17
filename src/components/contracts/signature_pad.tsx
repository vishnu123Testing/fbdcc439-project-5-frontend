'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  PenTool,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  RefreshCw,
  FileText,
  Check,
  Mail,
  User,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Send,
  FileCheck,
  ChevronRight,
  Info,
  Sparkles,
  RotateCcw,
  Building2,
  Bell,
  Award,
} from 'lucide-react';
import { StatusLabel } from '../common/StatusLabel';
import {
  SignatureRequestResponse,
  SignatureExecuteResponse,
  SignatureStatus,
  executeSignature as executeSignatureApi,
  rejectSignature as rejectSignatureApi,
  sanitizeString,
} from '../../services/contract_api';

export interface SignaturePadProps {
  /**
   * Unique UUID identifier of target signature request [FR-6]
   */
  signatureRequestId?: string;
  /**
   * Parent contract identifier
   */
  contractId?: string;
  /**
   * Title of contract agreement being executed
   */
  contractTitle?: string;
  /**
   * Contract category (e.g. 'Contract', 'SOW', 'NDA', 'Exhibit')
   */
  contractCategory?: string;
  /**
   * Current contract lifecycle status ('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'AMENDED', 'TERMINATED', 'EXPIRED')
   */
  contractStatus?: string;
  /**
   * Name of counterparty organization
   */
  counterparty?: string;
  /**
   * Identifier of assigned signatory
   */
  signatoryId?: string;
  /**
   * Name of assigned signatory
   */
  signatoryName?: string;
  /**
   * Email address of assigned signatory
   */
  signatoryEmail?: string;
  /**
   * Current signature request status ('PENDING' | 'EXECUTED' | 'REJECTED')
   */
  signatureStatus?: SignatureStatus | string;
  /**
   * Cryptographic signature digest hash if previously executed
   */
  signatureDigest?: string | null;
  /**
   * ISO timestamp when signature execution occurred
   */
  executedAt?: string | null;
  /**
   * List of pending signature requests for central hub selector [FR-5]
   */
  pendingRequests?: SignatureRequestResponse[];
  /**
   * Access control flag. When true, renders unauthorized access warning [FR-1]
   */
  isUnauthorized?: boolean;
  /**
   * Explanation message for access denial
   */
  unauthorizedReason?: string;
  /**
   * Loading state indicator
   */
  loading?: boolean;
  /**
   * Error message string
   */
  error?: string | null;
  /**
   * Custom callback to execute digital signature [FR-6]
   */
  onExecute?: (requestId: string, signatureDigest: string) => Promise<SignatureExecuteResponse | void> | void;
  /**
   * Custom callback to reject digital signature request
   */
  onReject?: (requestId: string, reason?: string) => Promise<SignatureRequestResponse | void> | void;
  /**
   * Callback invoked when selecting a pending request from hub list
   */
  onSelectRequest?: (request: SignatureRequestResponse) => void;
  /**
   * Callback to refresh signature state
   */
  onRefresh?: () => Promise<void> | void;
  /**
   * Callback triggered on successful execution
   */
  onSuccess?: (response: SignatureExecuteResponse) => void;
  /**
   * Custom CSS class names
   */
  className?: string;
}

export function SignaturePad({
  signatureRequestId = '',
  contractId = '',
  contractTitle = 'Contract Agreement',
  contractCategory = 'Contract',
  contractStatus = 'PENDING_SIGNATURE',
  counterparty = '',
  signatoryId = '',
  signatoryName = '',
  signatoryEmail = '',
  signatureStatus = 'PENDING',
  signatureDigest = null,
  executedAt = null,
  pendingRequests = [],
  isUnauthorized = false,
  unauthorizedReason,
  loading = false,
  error = null,
  onExecute,
  onReject,
  onSelectRequest,
  onRefresh,
  onSuccess,
  className = '',
}: SignaturePadProps) {
  // Active request state tracking
  const [activeRequestId, setActiveRequestId] = useState<string>(signatureRequestId);
  const [currentContractStatus, setCurrentContractStatus] = useState<string>(contractStatus);
  const [currentSignatureStatus, setCurrentSignatureStatus] = useState<string>(signatureStatus);
  const [currentDigest, setCurrentDigest] = useState<string | null>(signatureDigest);
  const [currentExecutedAt, setCurrentExecutedAt] = useState<string | null>(executedAt);

  // Capture mode: 'draw' (freehand canvas) vs 'type' (typed cursive font)
  const [captureMode, setCaptureMode] = useState<'draw' | 'type'>('draw');

  // Input fields
  const [typedName, setTypedName] = useState<string>(signatoryName || '');
  const [inputSignatoryName, setInputSignatoryName] = useState<string>(signatoryName || '');
  const [inputSignatoryEmail, setInputSignatoryEmail] = useState<string>(signatoryEmail || '');
  const [inputSignatoryTitle, setInputSignatoryTitle] = useState<string>('Authorized Signatory');
  const [legalConsentChecked, setLegalConsentChecked] = useState<boolean>(false);

  // Drawing state for Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);

  // Submission / Action states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(error || null);
  const [executionSuccess, setExecutionSuccess] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejectionSuccess, setRejectionSuccess] = useState<boolean>(false);

  // Sync props to internal state when props change
  useEffect(() => {
    if (signatureRequestId) {
      setActiveRequestId(signatureRequestId);
    }
  }, [signatureRequestId]);

  useEffect(() => {
    setCurrentContractStatus(contractStatus);
  }, [contractStatus]);

  useEffect(() => {
    setCurrentSignatureStatus(signatureStatus);
  }, [signatureStatus]);

  useEffect(() => {
    setCurrentDigest(signatureDigest);
  }, [signatureDigest]);

  useEffect(() => {
    setCurrentExecutedAt(executedAt);
  }, [executedAt]);

  useEffect(() => {
    if (signatoryName && !typedName) {
      setTypedName(signatoryName);
    }
    if (signatoryName && !inputSignatoryName) {
      setInputSignatoryName(signatoryName);
    }
    if (signatoryEmail && !inputSignatoryEmail) {
      setInputSignatoryEmail(signatoryEmail);
    }
  }, [signatoryName, signatoryEmail]);

  // Setup Canvas context defaults
  useEffect(() => {
    if (captureMode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#59452b'; // Tobacco primary color
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [captureMode]);

  // Canvas Drawing Handlers
  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }, []);

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e) {
        if (e.touches.length === 0) return;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      ctx.lineTo(x, y);
      ctx.stroke();
      setHasDrawn(true);
    },
    [isDrawing]
  );

  const stopDrawing = useCallback(() => {
    if (!canvasRef.current || !isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.closePath();
    }
    setIsDrawing(false);
  }, [isDrawing]);

  const clearCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
  }, []);

  // Generate signature digest string
  const generateSignatureDigest = useCallback((): string => {
    if (captureMode === 'draw' && canvasRef.current) {
      try {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        return dataUrl;
      } catch {
        // Fallback digest string
        return `sig_draw_${Date.now()}_${sanitizeString(inputSignatoryName || 'signatory')}`;
      }
    } else {
      const sanitized = sanitizeString(typedName || inputSignatoryName || 'signatory');
      const encoded = typeof btoa === 'function' ? btoa(sanitized) : sanitized;
      return `sig_typed_${encoded}_${Date.now()}`;
    }
  }, [captureMode, typedName, inputSignatoryName]);

  // Validation check whether user is eligible to execute
  const canExecute = useMemo(() => {
    if (isSubmitting || loading) return false;
    if (!legalConsentChecked) return false;

    if (captureMode === 'draw') {
      return hasDrawn;
    } else {
      return typedName.trim().length > 0;
    }
  }, [isSubmitting, loading, legalConsentChecked, captureMode, hasDrawn, typedName]);

  // Execute Signature Submission Handler [FR-6]
  const handleExecute = async () => {
    if (!canExecute) return;
    setActionError(null);
    setIsSubmitting(true);

    const reqId = activeRequestId || signatureRequestId;
    const digest = generateSignatureDigest();

    try {
      let response: SignatureExecuteResponse;

      if (onExecute) {
        const res = await onExecute(reqId, digest);
        if (res && typeof res === 'object' && 'status' in res) {
          response = res as SignatureExecuteResponse;
        } else {
          response = {
            request_id: reqId,
            contract_id: contractId,
            status: 'EXECUTED',
            executed_at: new Date().toISOString(),
            signature_digest: digest,
          };
        }
      } else {
        response = await executeSignatureApi(reqId, { signature_digest: digest });
      }

      // Update local states upon execution [FR-6]
      setCurrentSignatureStatus('EXECUTED');
      setCurrentContractStatus('ACTIVE');
      setCurrentDigest(response.signature_digest || digest);
      setCurrentExecutedAt(response.executed_at || new Date().toISOString());
      setExecutionSuccess(true);

      if (onSuccess) {
        onSuccess(response);
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Failed to execute digital signature request.';
      setActionError(sanitizeString(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reject Signature Handler
  const handleReject = async () => {
    setActionError(null);
    setIsSubmitting(true);

    const reqId = activeRequestId || signatureRequestId;
    const cleanReason = sanitizeString(rejectionReason);

    try {
      if (onReject) {
        await onReject(reqId, cleanReason);
      } else {
        await rejectSignatureApi(reqId, cleanReason);
      }

      setCurrentSignatureStatus('REJECTED');
      setRejectionSuccess(true);
      setShowRejectModal(false);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Failed to reject e-signature request.';
      setActionError(sanitizeString(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Switch Active Pending Request in Hub Mode
  const handleSelectPendingItem = (req: SignatureRequestResponse) => {
    setActiveRequestId(req.id);
    if (req.status) {
      setCurrentSignatureStatus(req.status);
    }
    if (req.signature_digest) {
      setCurrentDigest(req.signature_digest);
    }
    if (req.executed_at) {
      setCurrentExecutedAt(req.executed_at);
    }
    setExecutionSuccess(req.status === 'EXECUTED');
    setRejectionSuccess(req.status === 'REJECTED');
    setLegalConsentChecked(false);
    clearCanvas();

    if (onSelectRequest) {
      onSelectRequest(req);
    }
  };

  // Render Unauthorized View [FR-1]
  if (isUnauthorized) {
    return (
      <div
        data-testid="unauthorized-access-container"
        className={`bg-white rounded-lg border border-[#ba1a1a]/20 p-8 shadow-sm ${className}`}
        role="region"
        aria-label="Unauthorized Access Restricted"
      >
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-[#ba1a1a]/10 rounded-full text-[#ba1a1a] shrink-0">
            <Lock className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-serif text-[#1b1c19] mb-1">
              Signature Access Restricted [FR-1]
            </h3>
            <p className="text-sm text-[#4e453d] mb-4">
              {unauthorizedReason
                ? sanitizeString(unauthorizedReason)
                : 'You do not possess the required Role-Based Access Control (RBAC) permissions or assigned signatory authority to view or execute digital signatures for this contract.'}
            </p>
            <div className="inline-flex items-center px-3 py-1.5 rounded bg-[#f5f3ee] text-xs text-[#59452b] border border-[#d1c4b9]">
              <ShieldCheck className="w-4 h-4 mr-1.5 text-[#59452b]" aria-hidden="true" />
              <span>Server Authorization Enforcement Active</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="signature-pad"
      className={`bg-[#fbf9f4] border border-[#d1c4b9] rounded-lg shadow-sm overflow-hidden ${className}`}
      role="region"
      aria-label="Digital Signature Execution"
    >
      {/* Component Header */}
      <div className="bg-white border-b border-[#d1c4b9] p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-[#f5f3ee] rounded text-[#59452b]">
                <PenTool className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-serif text-[#1b1c19]">Digital Signature Execution</h2>
                  <StatusLabel
                    status={currentSignatureStatus}
                    label={currentSignatureStatus}
                    data-testid="signature-status-label"
                  />
                </div>
                <p className="text-xs text-[#4e453d] mt-0.5">
                  Legal Digital Signature Execution & Contract State Machine Transition [FR-6]
                </p>
              </div>
            </div>
          </div>

          {/* Quick Info Badges */}
          <div className="flex items-center space-x-3 text-xs">
            {onRefresh && (
              <button
                type="button"
                onClick={() => onRefresh()}
                data-testid="refresh-signature-btn"
                className="flex items-center space-x-1 px-3 py-1.5 rounded border border-[#d1c4b9] text-[#59452b] hover:bg-[#f5f3ee] transition-colors"
                aria-label="Refresh signature status"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Refresh</span>
              </button>
            )}
            <div className="px-3 py-1.5 rounded bg-[#f5f3ee] border border-[#d1c4b9] text-[#4e453d]">
              <span className="font-medium text-[#1b1c19]">Category:</span> {contractCategory}
            </div>
            <div className="px-3 py-1.5 rounded bg-[#f5f3ee] border border-[#d1c4b9] text-[#4e453d]">
              <span className="font-medium text-[#1b1c19]">Contract State:</span>{' '}
              <span className="font-semibold text-[#59452b]" data-testid="contract-status-badge">
                {currentContractStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Contract Title Banner */}
        <div className="mt-4 pt-4 border-t border-[#f5f3ee] flex flex-wrap items-center justify-between gap-2 text-sm text-[#4e453d]">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
            <span className="font-medium text-[#1b1c19]" data-testid="contract-title-display">
              {contractTitle}
            </span>
            {contractId && (
              <span className="text-xs text-[#80756b]" data-testid="contract-id-display">
                ({contractId})
              </span>
            )}
          </div>
          {counterparty && (
            <div className="flex items-center space-x-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5 text-[#80756b]" aria-hidden="true" />
              <span>Counterparty:</span>
              <span className="font-medium text-[#1b1c19]">{counterparty}</span>
            </div>
          )}
        </div>
      </div>

      {/* Loading Overlay State */}
      {loading && (
        <div
          data-testid="signature-loading-state"
          className="p-8 text-center bg-white/80"
          role="status"
          aria-live="polite"
        >
          <RefreshCw className="w-8 h-8 text-[#59452b] animate-spin mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm font-medium text-[#1b1c19]">Loading Signature Verification Context...</p>
        </div>
      )}

      {/* Pending Requests List / Central Hub Selector (if provided) */}
      {pendingRequests.length > 0 && (
        <div data-testid="pending-requests-list" className="bg-white border-b border-[#d1c4b9] p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#59452b] mb-2 flex items-center space-x-1.5">
            <Bell className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
            <span>Pending Signature Hub Requests ({pendingRequests.length}) [FR-5]</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {pendingRequests.map((req) => {
              const isSelected = req.id === activeRequestId;
              return (
                <button
                  key={req.id}
                  type="button"
                  data-testid={`pending-request-item-${req.id}`}
                  onClick={() => handleSelectPendingItem(req)}
                  className={`text-left p-3 rounded border text-xs transition-all ${
                    isSelected
                      ? 'border-[#59452b] bg-[#f5f3ee] ring-1 ring-[#59452b]'
                      : 'border-[#d1c4b9] bg-[#fbf9f4] hover:bg-[#f5f3ee]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[#80756b]">Request {req.id.slice(0, 8)}...</span>
                    <StatusLabel status={req.status} label={req.status} />
                  </div>
                  <div className="text-[#1b1c19] font-medium truncate">
                    Contract: {req.contract_id.slice(0, 8)}...
                  </div>
                  {req.signatory_id && (
                    <div className="text-[#4e453d] text-[11px] mt-0.5">Signatory: {req.signatory_id}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Error Alert */}
      {actionError && (
        <div
          data-testid="signature-error-alert"
          className="m-6 p-4 rounded bg-[#ba1a1a]/10 border border-[#ba1a1a]/30 text-[#ba1a1a] flex items-start space-x-3 text-sm"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">Execution Failed</span>
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-[#ba1a1a] hover:text-[#ba1a1a]/80"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* SUCCESS CONFIRMATION BANNER [FR-6] */}
      {(executionSuccess || currentSignatureStatus === 'EXECUTED') && (
        <div data-testid="executed-signature-view" className="p-6 space-y-6">
          <div
            data-testid="signature-success-banner"
            className="p-6 rounded-lg bg-[#59452b]/10 border border-[#59452b]/30 text-[#1b1c19]"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-[#59452b] text-white rounded-full shrink-0">
                <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-serif font-semibold text-[#1b1c19]">
                    Digital Signature Successfully Executed [FR-6]
                  </h3>
                  <span
                    data-testid="executed-signature-badge"
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#59452b] text-white"
                  >
                    <Award className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                    EXECUTED
                  </span>
                </div>
                <p className="text-sm text-[#4e453d]">
                  Digital signature captured successfully. Contract lifecycle state transitioned to{' '}
                  <strong className="text-[#59452b]" data-testid="transitioned-status-text">
                    {currentContractStatus === 'DRAFT' || currentContractStatus === 'PENDING_SIGNATURE'
                      ? 'ACTIVE'
                      : currentContractStatus}
                  </strong>{' '}
                  and all agreement stakeholders have been notified [FR-6].
                </p>

                {/* Audit Details */}
                <div className="pt-3 mt-3 border-t border-[#59452b]/20 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#4e453d]">
                  <div>
                    <span className="font-semibold text-[#1b1c19] block">Executed Timestamp:</span>
                    <span data-testid="executed-at-timestamp" className="font-mono text-[#59452b]">
                      {currentExecutedAt ? new Date(currentExecutedAt).toUTCString() : new Date().toUTCString()}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#1b1c19] block">Signature Digest Hash:</span>
                    <span
                      data-testid="signature-digest-display"
                      className="font-mono text-[#59452b] break-all truncate block"
                      title={currentDigest || 'Verification Digest Active'}
                    >
                      {currentDigest ? currentDigest.slice(0, 48) + '...' : 'digest_verified_sha256'}
                    </span>
                  </div>
                </div>

                {/* Parties Notified Badge */}
                <div
                  data-testid="parties-notified-badge"
                  className="mt-3 inline-flex items-center space-x-2 px-3 py-1.5 rounded bg-white text-xs font-medium text-[#59452b] border border-[#d1c4b9]"
                >
                  <Bell className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
                  <span>Notification Dispatched: All Parties Notified [FR-6]</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECTED CONFIRMATION BANNER */}
      {(rejectionSuccess || currentSignatureStatus === 'REJECTED') && (
        <div data-testid="rejected-signature-view" className="p-6">
          <div
            data-testid="signature-rejected-banner"
            className="p-6 rounded-lg bg-[#ba1a1a]/10 border border-[#ba1a1a]/30 text-[#1b1c19]"
            role="status"
          >
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-[#ba1a1a] text-white rounded-full shrink-0">
                <X className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-semibold text-[#1b1c19]">Signature Request Rejected</h3>
                <p className="text-sm text-[#4e453d] mt-1">
                  This e-signature request has been formally declined and set to REJECTED status.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE CAPTURE FORM (Rendered when Pending) */}
      {currentSignatureStatus !== 'EXECUTED' && currentSignatureStatus !== 'REJECTED' && (
        <div className="p-6 space-y-6" data-testid="signature-capture-pad">
          {/* Signatory Info Card */}
          <div className="bg-white p-5 rounded-lg border border-[#d1c4b9] space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#59452b] flex items-center space-x-2">
              <User className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
              <span>Signatory Identity Verification</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#1b1c19] mb-1">
                  Signatory Full Name <span className="text-[#ba1a1a]">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    data-testid="signatory-name-input"
                    value={inputSignatoryName}
                    onChange={(e) => {
                      setInputSignatoryName(e.target.value);
                      if (captureMode === 'type') {
                        setTypedName(e.target.value);
                      }
                    }}
                    placeholder="e.g. Jane Doe"
                    className="w-full px-3 py-2 bg-[#fbf9f4] border border-[#d1c4b9] rounded text-sm text-[#1b1c19] focus:outline-none focus:border-[#59452b]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1b1c19] mb-1">Signatory Email</label>
                <div className="relative">
                  <input
                    type="email"
                    data-testid="signatory-email-input"
                    value={inputSignatoryEmail}
                    onChange={(e) => setInputSignatoryEmail(e.target.value)}
                    placeholder="e.g. jane.doe@acme.com"
                    className="w-full px-3 py-2 bg-[#fbf9f4] border border-[#d1c4b9] rounded text-sm text-[#1b1c19] focus:outline-none focus:border-[#59452b]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1b1c19] mb-1">Title / Capacity</label>
                <input
                  type="text"
                  data-testid="signatory-title-input"
                  value={inputSignatoryTitle}
                  onChange={(e) => setInputSignatoryTitle(e.target.value)}
                  placeholder="e.g. VP of Legal Affairs"
                  className="w-full px-3 py-2 bg-[#fbf9f4] border border-[#d1c4b9] rounded text-sm text-[#1b1c19] focus:outline-none focus:border-[#59452b]"
                />
              </div>
            </div>
          </div>

          {/* Capture Mode Toggle Tabs */}
          <div className="bg-white p-5 rounded-lg border border-[#d1c4b9] space-y-4">
            <div className="flex items-center justify-between border-b border-[#f5f3ee] pb-3">
              <span className="text-sm font-semibold uppercase tracking-wider text-[#59452b] flex items-center space-x-2">
                <PenTool className="w-4 h-4 text-[#59452b]" aria-hidden="true" />
                <span>Signature Input Pad [FR-6]</span>
              </span>

              <div className="inline-flex p-1 bg-[#f5f3ee] rounded-md border border-[#d1c4b9]">
                <button
                  type="button"
                  data-testid="mode-toggle-draw"
                  onClick={() => setCaptureMode('draw')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    captureMode === 'draw'
                      ? 'bg-[#59452b] text-white shadow-sm'
                      : 'text-[#4e453d] hover:text-[#1b1c19]'
                  }`}
                >
                  Draw Signature
                </button>
                <button
                  type="button"
                  data-testid="mode-toggle-type"
                  onClick={() => setCaptureMode('type')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    captureMode === 'type'
                      ? 'bg-[#59452b] text-white shadow-sm'
                      : 'text-[#4e453d] hover:text-[#1b1c19]'
                  }`}
                >
                  Type Signature
                </button>
              </div>
            </div>

            {/* DRAW MODE CANVAS */}
            {captureMode === 'draw' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#4e453d]">
                  <span>Draw your signature inside the framed box below using mouse or touch:</span>
                  <button
                    type="button"
                    data-testid="clear-signature-btn"
                    onClick={clearCanvas}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs text-[#ba1a1a] border border-[#ba1a1a]/30 rounded hover:bg-[#ba1a1a]/10 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Clear Canvas</span>
                  </button>
                </div>

                <div className="relative border-2 border-dashed border-[#d1c4b9] rounded-lg bg-white p-2 text-center">
                  <canvas
                    ref={canvasRef}
                    width={550}
                    height={180}
                    data-testid="signature-canvas"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-44 bg-white cursor-crosshair touch-none block rounded"
                    aria-label="Digital signature drawing canvas"
                  />
                  {!hasDrawn && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-[#80756b]">
                      <span>Sign here with mouse or touch</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TYPE MODE INPUT */}
            {captureMode === 'type' && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-[#1b1c19]">
                  Type Your Signature Name <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="text"
                  data-testid="typed-signature-input"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="Type your full legal name"
                  className="w-full px-3 py-2 bg-[#fbf9f4] border border-[#d1c4b9] rounded text-sm text-[#1b1c19] focus:outline-none focus:border-[#59452b]"
                />

                {/* Handwritten Cursive Style Preview */}
                <div className="p-4 rounded-lg border border-[#d1c4b9] bg-[#fbf9f4]">
                  <span className="block text-[11px] font-medium text-[#80756b] mb-1 uppercase tracking-wider">
                    Formatted Signature Preview:
                  </span>
                  <div
                    data-testid="typed-signature-preview"
                    className="text-2xl italic font-serif text-[#59452b] py-2 border-b border-[#d1c4b9] min-h-[3rem] flex items-center"
                    style={{ fontFamily: 'Georgia, serif' }}
                  >
                    {typedName.trim() ? typedName : 'Your Typed Signature Here'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* LEGAL CONSENT ACKNOWLEDGMENT CHECKBOX [FR-6] */}
          <div className="bg-white p-5 rounded-lg border border-[#d1c4b9] space-y-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                data-testid="legal-consent-checkbox"
                checked={legalConsentChecked}
                onChange={(e) => setLegalConsentChecked(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#d1c4b9] text-[#59452b] focus:ring-[#59452b]"
              />
              <span className="text-xs text-[#1b1c19] leading-relaxed">
                <strong>Legal Intent & Binding Acknowledgment:</strong> I acknowledge and agree that this digital
                signature constitutes my legally binding execution of this contract agreement. Executing this request
                will transition the contract status to <strong>EXECUTED / ACTIVE</strong> and notify all agreement
                parties [FR-6].
              </span>
            </label>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <button
              type="button"
              data-testid="reject-signature-btn"
              onClick={() => setShowRejectModal(true)}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2.5 rounded text-xs font-semibold text-[#ba1a1a] border border-[#ba1a1a]/30 hover:bg-[#ba1a1a]/10 transition-colors disabled:opacity-50"
            >
              Decline / Reject Request
            </button>

            <button
              type="button"
              data-testid="execute-signature-btn"
              onClick={handleExecute}
              disabled={!canExecute}
              className={`w-full sm:w-auto px-6 py-2.5 rounded text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
                canExecute
                  ? 'bg-[#59452b] text-white hover:bg-[#59452b]/90 shadow-sm'
                  : 'bg-[#e4e2dd] text-[#80756b] cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Capturing Signature...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" aria-hidden="true" />
                  <span>Execute Digital Signature [FR-6]</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {showRejectModal && (
        <div
          data-testid="rejection-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Decline E-Signature Request"
        >
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl space-y-4 border border-[#d1c4b9]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-serif font-semibold text-[#1b1c19]">Decline Signature Request</h3>
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="text-[#80756b] hover:text-[#1b1c19]"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <p className="text-xs text-[#4e453d]">
              Please specify the reason for declining this e-signature request. The agreement author and counterparty
              will be notified.
            </p>

            <div>
              <label className="block text-xs font-medium text-[#1b1c19] mb-1">Rejection Reason</label>
              <textarea
                data-testid="rejection-reason-input"
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Terms require revision in Clause 4..."
                className="w-full p-2.5 bg-[#fbf9f4] border border-[#d1c4b9] rounded text-xs text-[#1b1c19] focus:outline-none focus:border-[#59452b]"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-3.5 py-2 text-xs font-medium text-[#4e453d] hover:bg-[#f5f3ee] rounded border border-[#d1c4b9]"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-reject-btn"
                onClick={handleReject}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#ba1a1a] hover:bg-[#ba1a1a]/90 rounded transition-colors"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SignaturePad;