import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
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
  financialService,
  QuoteQueryParams,
  QuoteCreateRequest,
  InvoiceQueryParams,
  InvoiceCreateRequest,
  PaymentQueryParams,
  PaymentRecordRequest,
  ARAgingQueryParams,
} from '../../src/services/financial';

describe('financial service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Quotes [FR-1]', () => {
    it('fetches quotes list without parameters', async () => {
      const mockQuotes = [
        {
          quote_id: '11111111-1111-1111-1111-111111111111',
          customer_id: '22222222-2222-2222-2222-222222222222',
          approval_state: 'Approved',
          expiration_date_time: '2026-12-31T23:59:59Z',
          total_amount: 15000.0,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          is_expired: false,
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockQuotes,
      } as Response);

      const result = await listQuotes();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/financial/quotes'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockQuotes);
    });

    it('builds query parameters for quotes correctly', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      const params: QuoteQueryParams = {
        approval_state: 'Pending_Approval',
        customer_id: 'cust-123',
      };

      await getQuotes(params);

      const calledUrl = (fetch as unknown as { mock: { calls: [string[]] } }).mock.calls[0][0];
      expect(calledUrl).toContain('approval_state=Pending_Approval');
      expect(calledUrl).toContain('customer_id=cust-123');
    });

    it('fetches single quote by ID', async () => {
      const mockQuote = {
        quote_id: 'q-123',
        customer_id: 'cust-123',
        approval_state: 'Draft',
        expiration_date_time: '2026-06-30T23:59:59Z',
        total_amount: 5000.0,
        created_at: '2026-01-10T10:00:00Z',
        updated_at: '2026-01-10T10:00:00Z',
        is_expired: false,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockQuote,
      } as Response);

      const result = await getQuoteById('q-123');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/financial/quotes/q-123'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockQuote);
    });

    it('creates a quote record', async () => {
      const payload: QuoteCreateRequest = {
        customer_id: 'cust-123',
        expiration_date_time: '2026-12-31T23:59:59Z',
        total_amount: 25000.0,
        approval_state: 'Approved',
      };

      const mockCreated = {
        quote_id: 'q-999',
        ...payload,
        created_at: '2026-01-15T00:00:00Z',
        updated_at: '2026-01-15T00:00:00Z',
        is_expired: false,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockCreated,
      } as Response);

      const result = await createQuote(payload);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/financial/quotes'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
      expect(result).toEqual(mockCreated);
    });
  });

  describe('Invoices [FR-2]', () => {
    it('fetches invoices list with status filter', async () => {
      const mockInvoices = [
        {
          invoice_id: 'inv-100',
          quote_id: 'q-100',
          customer_id: 'cust-100',
          status: 'Past_Due',
          issue_date_time: '2026-01-01T00:00:00Z',
          due_date_time: '2026-01-15T00:00:00Z',
          total_amount: 10000.0,
          outstanding_amount: 5000.0,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          days_overdue: 15,
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInvoices,
      } as Response);

      const params: InvoiceQueryParams = { status: 'Past_Due', customer_id: 'cust-100' };
      const result = await getInvoices(params);

      const calledUrl = (fetch as unknown as { mock: { calls: [string[]] } }).mock.calls[0][0];
      expect(calledUrl).toContain('/api/v1/financial/invoices');
      expect(calledUrl).toContain('status=Past_Due');
      expect(calledUrl).toContain('customer_id=cust-100');
      expect(result).toEqual(mockInvoices);
    });

    it('fetches single invoice by ID', async () => {
      const mockInvoice = {
        invoice_id: 'inv-123',
        quote_id: null,
        customer_id: 'cust-123',
        status: 'Current',
        issue_date_time: '2026-02-01T00:00:00Z',
        due_date_time: '2026-03-01T00:00:00Z',
        total_amount: 8000.0,
        outstanding_amount: 8000.0,
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
        days_overdue: 0,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockInvoice,
      } as Response);

      const result = await getInvoiceById('inv-123');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/financial/invoices/inv-123'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockInvoice);
    });

    it('creates an invoice record', async () => {
      const payload: InvoiceCreateRequest = {
        customer_id: 'cust-123',
        issue_date_time: '2026-02-01T00:00:00Z',
        due_date_time: '2026-03-01T00:00:00Z',
        total_amount: 12000.0,
        status: 'Current',
      };

      const mockCreated = {
        invoice_id: 'inv-999',
        quote_id: null,
        ...payload,
        outstanding_amount: 12000.0,
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
        days_overdue: 0,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockCreated,
      } as Response);

      const result = await createInvoice(payload);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/financial/invoices'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
      expect(result).toEqual(mockCreated);
    });
  });

  describe('Payments [FR-3]', () => {
    it('fetches payment history list for invoice', async () => {
      const mockPayments = [
        {
          payment_id: 'pay-100',
          invoice_id: 'inv-100',
          payment_date_time: '2026-01-10T00:00:00Z',
          amount_paid: 5000.0,
          payment_method: 'Credit Card',
          created_at: '2026-01-10T00:00:00Z',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockPayments,
      } as Response);

      const params: PaymentQueryParams = { invoice_id: 'inv-100' };
      const result = await getPayments(params);

      const calledUrl = (fetch as unknown as { mock: { calls: [string[]] } }).mock.calls[0][0];
      expect(calledUrl).toContain('/api/v1/financial/payments');
      expect(calledUrl).toContain('invoice_id=inv-100');
      expect(result).toEqual(mockPayments);
    });

    it('records a payment linked to an invoice', async () => {
      const payload: PaymentRecordRequest = {
        invoice_id: 'inv-100',
        amount_paid: 2500.0,
        payment_method: 'ACH Transfer',
      };

      const mockRecorded = {
        payment_id: 'pay-200',
        invoice_id: 'inv-100',
        amount_paid: 2500.0,
        payment_method: 'ACH Transfer',
        payment_date_time: '2026-02-01T12:00:00Z',
        created_at: '2026-02-01T12:00:00Z',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockRecorded,
      } as Response);

      const result = await recordPayment(payload);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/financial/payments'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
      expect(result).toEqual(mockRecorded);
    });
  });

  describe('AR Aging Metrics [FR-4]', () => {
    it('fetches AR aging duration buckets summary', async () => {
      const mockSummary = {
        customer_id: 'cust-123',
        as_of_date_time: '2026-02-15T00:00:00Z',
        total_outstanding: 45000.0,
        total_invoices: 4,
        bucket_0_30: { bucket_name: '0-30', total_amount: 20000.0, invoice_count: 2 },
        bucket_31_60: { bucket_name: '31-60', total_amount: 15000.0, invoice_count: 1 },
        bucket_61_90: { bucket_name: '61-90', total_amount: 10000.0, invoice_count: 1 },
        bucket_90_plus: { bucket_name: '90+', total_amount: 0.0, invoice_count: 0 },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSummary,
      } as Response);

      const params: ARAgingQueryParams = {
        customer_id: 'cust-123',
        as_of_date_time: '2026-02-15T00:00:00Z',
      };

      const result = await getARAgingSummary(params);

      const calledUrl = (fetch as unknown as { mock: { calls: [string[]] } }).mock.calls[0][0];
      expect(calledUrl).toContain('/api/v1/financial/ar-aging');
      expect(calledUrl).toContain('customer_id=cust-123');
      expect(calledUrl).toContain('as_of_date_time=2026-02-15T00%3A00%3A00Z');
      expect(result).toEqual(mockSummary);
    });
  });

  describe('financialService bundled export', () => {
    it('contains all financial API functions', () => {
      expect(financialService.listQuotes).toBe(listQuotes);
      expect(financialService.getQuotes).toBe(getQuotes);
      expect(financialService.getQuoteById).toBe(getQuoteById);
      expect(financialService.createQuote).toBe(createQuote);
      expect(financialService.listInvoices).toBe(listInvoices);
      expect(financialService.getInvoices).toBe(getInvoices);
      expect(financialService.getInvoiceById).toBe(getInvoiceById);
      expect(financialService.createInvoice).toBe(createInvoice);
      expect(financialService.listPayments).toBe(listPayments);
      expect(financialService.getPayments).toBe(getPayments);
      expect(financialService.recordPayment).toBe(recordPayment);
      expect(financialService.getARAgingMetrics).toBe(getARAgingMetrics);
      expect(financialService.getARAgingSummary).toBe(getARAgingSummary);
    });
  });
});
