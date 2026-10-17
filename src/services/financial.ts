import { request, RequestOptions } from './apiClient';

/**
 * ---------------------------------------------------------------------------
 * Financial Quotes Interfaces & Types [FR-1]
 * ---------------------------------------------------------------------------
 */

/**
 * Quote approval states [FR-1].
 */
export type QuoteApprovalState =
  | 'Draft'
  | 'Pending_Approval'
  | 'Pending Approval'
  | 'Approved'
  | 'Expired';

/**
 * Query parameters for filtering quote lists [FR-1].
 */
export interface QuoteQueryParams {
  approval_state?: string;
  customer_id?: string;
}

/**
 * Request payload for creating a new quote record [FR-1].
 */
export interface QuoteCreateRequest {
  customer_id: string;
  expiration_date_time: string;
  total_amount: number;
  approval_state?: string;
}

/**
 * Quote details response payload [FR-1].
 */
export interface QuoteResponse {
  quote_id: string;
  customer_id: string;
  approval_state: string;
  expiration_date_time: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  is_expired: boolean;
}

export type Quote = QuoteResponse;

/**
 * ---------------------------------------------------------------------------
 * Financial Invoices Interfaces & Types [FR-2]
 * ---------------------------------------------------------------------------
 */

/**
 * Invoice status classifications [FR-2].
 */
export type InvoiceStatus =
  | 'Current'
  | 'Pending'
  | 'Past_Due'
  | 'Past Due'
  | 'Paid';

/**
 * Query parameters for filtering invoice lists [FR-2].
 */
export interface InvoiceQueryParams {
  status?: string;
  customer_id?: string;
}

/**
 * Request payload for creating a new invoice record [FR-2].
 */
export interface InvoiceCreateRequest {
  customer_id: string;
  issue_date_time: string;
  due_date_time: string;
  total_amount: number;
  quote_id?: string | null;
  status?: string;
  outstanding_amount?: number | null;
}

/**
 * Invoice details response payload with overdue tracking metadata [FR-2].
 */
export interface InvoiceResponse {
  invoice_id: string;
  quote_id?: string | null;
  customer_id: string;
  status: string;
  issue_date_time: string;
  due_date_time: string;
  total_amount: number;
  outstanding_amount: number;
  created_at: string;
  updated_at: string;
  days_overdue: number;
}

export type Invoice = InvoiceResponse;

/**
 * ---------------------------------------------------------------------------
 * Payment Records Interfaces & Types [FR-3]
 * ---------------------------------------------------------------------------
 */

/**
 * Query parameters for filtering payment history records [FR-3].
 */
export interface PaymentQueryParams {
  invoice_id?: string;
  customer_id?: string;
}

/**
 * Request payload for recording a payment linked to an invoice [FR-3].
 */
export interface PaymentRecordRequest {
  invoice_id: string;
  amount_paid: number;
  payment_method: string;
  payment_date_time?: string | null;
}

/**
 * Payment history record response payload [FR-3].
 */
export interface PaymentResponse {
  payment_id: string;
  invoice_id: string;
  payment_date_time: string;
  amount_paid: number;
  payment_method: string;
  created_at: string;
}

export type Payment = PaymentResponse;

/**
 * ---------------------------------------------------------------------------
 * Accounts Receivable (AR) Aging Interfaces & Types [FR-4]
 * ---------------------------------------------------------------------------
 */

/**
 * Query parameters for requesting AR aging duration buckets [FR-4].
 */
export interface ARAgingQueryParams {
  customer_id?: string;
  as_of_date_time?: string;
}

/**
 * Individual AR aging duration bucket metrics [FR-4].
 */
export interface ARAgingBucketResponse {
  bucket_name: string; // "0-30", "31-60", "61-90", "90+"
  total_amount: number;
  invoice_count: number;
}

export type ARAgingBucket = ARAgingBucketResponse;

/**
 * Accounts Receivable (AR) aging summary duration buckets payload [FR-4].
 */
export interface ARAgingSummaryResponse {
  customer_id?: string | null;
  as_of_date_time: string;
  total_outstanding: number;
  total_invoices: number;
  bucket_0_30: ARAgingBucketResponse;
  bucket_31_60: ARAgingBucketResponse;
  bucket_61_90: ARAgingBucketResponse;
  bucket_90_plus: ARAgingBucketResponse;
}

export type ARAgingSummary = ARAgingSummaryResponse;

/**
 * Helper function to build query strings from parameter objects.
 */
function buildQueryString(params: Record<string, unknown>): string {
  const queryParts: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value.join(','))}`);
      }
    } else {
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }

  return queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
}

/**
 * ---------------------------------------------------------------------------
 * Financial Service API Client Wrapper Functions
 * ---------------------------------------------------------------------------
 */

/**
 * Retrieve authorized quotes with optional approval state and customer filters [FR-1].
 */
export async function listQuotes(
  params?: QuoteQueryParams,
  options?: RequestOptions
): Promise<QuoteResponse[]> {
  const queryStr = params ? buildQueryString(params as Record<string, unknown>) : '';
  const endpoint = `/financial/quotes${queryStr}`;
  return request<QuoteResponse[]>(endpoint, {
    method: 'GET',
    ...options,
  });
}

export const getQuotes = listQuotes;

/**
 * Fetch a single quote record by its unique UUID [FR-1].
 */
export async function getQuoteById(
  quoteId: string,
  options?: RequestOptions
): Promise<QuoteResponse> {
  const endpoint = `/financial/quotes/${encodeURIComponent(quoteId)}`;
  return request<QuoteResponse>(endpoint, {
    method: 'GET',
    ...options,
  });
}

/**
 * Create a new quote record [FR-1].
 */
export async function createQuote(
  payload: QuoteCreateRequest,
  options?: RequestOptions
): Promise<QuoteResponse> {
  const endpoint = '/financial/quotes';
  return request<QuoteResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
  });
}

/**
 * Retrieve current, pending, and historical invoices with optional status filters [FR-2].
 */
export async function listInvoices(
  params?: InvoiceQueryParams,
  options?: RequestOptions
): Promise<InvoiceResponse[]> {
  const queryStr = params ? buildQueryString(params as Record<string, unknown>) : '';
  const endpoint = `/financial/invoices${queryStr}`;
  return request<InvoiceResponse[]>(endpoint, {
    method: 'GET',
    ...options,
  });
}

export const getInvoices = listInvoices;

/**
 * Fetch a single invoice record by its unique UUID [FR-2].
 */
export async function getInvoiceById(
  invoiceId: string,
  options?: RequestOptions
): Promise<InvoiceResponse> {
  const endpoint = `/financial/invoices/${encodeURIComponent(invoiceId)}`;
  return request<InvoiceResponse>(endpoint, {
    method: 'GET',
    ...options,
  });
}

/**
 * Create a new invoice record [FR-2].
 */
export async function createInvoice(
  payload: InvoiceCreateRequest,
  options?: RequestOptions
): Promise<InvoiceResponse> {
  const endpoint = '/financial/invoices';
  return request<InvoiceResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
  });
}

/**
 * Retrieve complete payment history records linked to invoices [FR-3].
 */
export async function listPayments(
  params?: PaymentQueryParams,
  options?: RequestOptions
): Promise<PaymentResponse[]> {
  const queryStr = params ? buildQueryString(params as Record<string, unknown>) : '';
  const endpoint = `/financial/payments${queryStr}`;
  return request<PaymentResponse[]>(endpoint, {
    method: 'GET',
    ...options,
  });
}

export const getPayments = listPayments;

/**
 * Record a payment linked to an invoice [FR-3].
 */
export async function recordPayment(
  payload: PaymentRecordRequest,
  options?: RequestOptions
): Promise<PaymentResponse> {
  const endpoint = '/financial/payments';
  return request<PaymentResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
  });
}

/**
 * Request visual Accounts Receivable (AR) aging duration bucket metrics [FR-4].
 */
export async function getARAgingMetrics(
  params?: ARAgingQueryParams,
  options?: RequestOptions
): Promise<ARAgingSummaryResponse> {
  const queryStr = params ? buildQueryString(params as Record<string, unknown>) : '';
  const endpoint = `/financial/ar-aging${queryStr}`;
  return request<ARAgingSummaryResponse>(endpoint, {
    method: 'GET',
    ...options,
  });
}

export const getARAgingSummary = getARAgingMetrics;

/**
 * Bundled Financial Service API client object.
 */
export const financialService = {
  listQuotes,
  getQuotes,
  getQuoteById,
  createQuote,
  listInvoices,
  getInvoices,
  getInvoiceById,
  createInvoice,
  listPayments,
  getPayments,
  recordPayment,
  getARAgingMetrics,
  getARAgingSummary,
};

export default financialService;
