import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  Dashboard,
  formatCurrency,
  formatDate,
  normalizeStateString,
  getQuoteApprovalBadge,
  getInvoiceStatusBadge,
  filterQuotes,
  filterInvoices,
  filterPayments,
  calculateFinancialSummary,
} from '../../../src/components/financial/Dashboard';
import * as financialService from '../../../src/services/financial';
import {
  QuoteResponse,
  InvoiceResponse,
  PaymentResponse,
} from '../../../src/services/financial';

// Mock financial service calls
vi.mock('../../../src/services/financial', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/financial')>();
  return {
    ...actual,
    listQuotes: vi.fn(),
    listInvoices: vi.fn(),
    listPayments: vi.fn(),
  };
});

describe('Consolidated Financial Dashboard Component [FR-1, FR-2, FR-3]', () => {
  const mockQuotes: QuoteResponse[] = [
    {
      quote_id: 'Q-1001',
      customer_id: 'CUST-001',
      approval_state: 'Approved',
      expiration_date_time: '2026-12-31T23:59:59Z',
      total_amount: 15000.0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      is_expired: false,
    },
    {
      quote_id: 'Q-1002',
      customer_id: 'CUST-002',
      approval_state: 'Pending_Approval',
      expiration_date_time: '2026-06-30T23:59:59Z',
      total_amount: 8500.0,
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
      is_expired: false,
    },
    {
      quote_id: 'Q-1003',
      customer_id: 'CUST-001',
      approval_state: 'Expired',
      expiration_date_time: '2025-12-31T23:59:59Z',
      total_amount: 4200.0,
      created_at: '2025-11-01T00:00:00Z',
      updated_at: '2025-12-31T00:00:00Z',
      is_expired: true,
    },
  ];

  const mockInvoices: InvoiceResponse[] = [
    {
      invoice_id: 'INV-2001',
      quote_id: 'Q-1001',
      customer_id: 'CUST-001',
      status: 'Current',
      issue_date_time: '2026-03-01T00:00:00Z',
      due_date_time: '2026-04-01T00:00:00Z',
      total_amount: 15000.0,
      outstanding_amount: 5000.0,
      days_overdue: 0,
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    },
    {
      invoice_id: 'INV-2002',
      quote_id: null,
      customer_id: 'CUST-002',
      status: 'Past_Due',
      issue_date_time: '2026-01-01T00:00:00Z',
      due_date_time: '2026-02-01T00:00:00Z',
      total_amount: 8500.0,
      outstanding_amount: 8500.0,
      days_overdue: 45,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
    },
    {
      invoice_id: 'INV-2003',
      quote_id: 'Q-1003',
      customer_id: 'CUST-001',
      status: 'Paid',
      issue_date_time: '2025-12-01T00:00:00Z',
      due_date_time: '2026-01-01T00:00:00Z',
      total_amount: 4200.0,
      outstanding_amount: 0.0,
      days_overdue: 0,
      created_at: '2025-12-01T00:00:00Z',
      updated_at: '2025-12-20T00:00:00Z',
    },
  ];

  const mockPayments: PaymentResponse[] = [
    {
      payment_id: 'PAY-3001',
      invoice_id: 'INV-2001',
      payment_date_time: '2026-03-15T00:00:00Z',
      amount_paid: 10000.0,
      payment_method: 'Wire Transfer',
      created_at: '2026-03-15T00:00:00Z',
    },
    {
      payment_id: 'PAY-3002',
      invoice_id: 'INV-2003',
      payment_date_time: '2025-12-20T00:00:00Z',
      amount_paid: 4200.0,
      payment_method: 'Credit Card',
      created_at: '2025-12-20T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Pure Helper Functions [FR-1, FR-2, FR-3]', () => {
    it('formatCurrency formats raw numbers into USD string representation', () => {
      expect(formatCurrency(15000)).toBe('$15,000.00');
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(null)).toBe('$0.00');
      expect(formatCurrency(undefined)).toBe('$0.00');
      expect(formatCurrency(NaN)).toBe('$0.00');
    });

    it('formatDate formats ISO dates cleanly', () => {
      expect(formatDate('2026-12-31T23:59:59Z')).toBe('Dec 31, 2026');
      expect(formatDate(null)).toBe('N/A');
      expect(formatDate(undefined)).toBe('N/A');
    });

    it('normalizeStateString converts underscores to spaces', () => {
      expect(normalizeStateString('Pending_Approval')).toBe('Pending Approval');
      expect(normalizeStateString('Past_Due')).toBe('Past Due');
      expect(normalizeStateString('Approved')).toBe('Approved');
      expect(normalizeStateString('')).toBe('');
    });

    it('getQuoteApprovalBadge maps state to style metadata [FR-1]', () => {
      expect(getQuoteApprovalBadge('Approved').label).toBe('Approved');
      expect(getQuoteApprovalBadge('Pending_Approval').label).toBe('Pending Approval');
      expect(getQuoteApprovalBadge('Expired').label).toBe('Expired');
      expect(getQuoteApprovalBadge('Draft').label).toBe('Draft');
    });

    it('getInvoiceStatusBadge maps status to style metadata [FR-2]', () => {
      expect(getInvoiceStatusBadge('Paid').label).toBe('Paid');
      expect(getInvoiceStatusBadge('Current').label).toBe('Current');
      expect(getInvoiceStatusBadge('Pending').label).toBe('Pending');
      expect(getInvoiceStatusBadge('Past_Due').label).toBe('Past Due');
    });

    it('filterQuotes filters quotes by state and search string [FR-1]', () => {
      const approved = filterQuotes(mockQuotes, 'Approved', '');
      expect(approved).toHaveLength(1);
      expect(approved[0].quote_id).toBe('Q-1001');

      const searched = filterQuotes(mockQuotes, 'all', 'CUST-001');
      expect(searched).toHaveLength(2);

      const emptyResult = filterQuotes(mockQuotes, 'Draft', '');
      expect(emptyResult).toHaveLength(0);
    });

    it('filterInvoices filters invoices by status and search string [FR-2]', () => {
      const pastDue = filterInvoices(mockInvoices, 'Past Due', '');
      expect(pastDue).toHaveLength(1);
      expect(pastDue[0].invoice_id).toBe('INV-2002');

      const searched = filterInvoices(mockInvoices, 'all', 'INV-2001');
      expect(searched).toHaveLength(1);
    });

    it('filterPayments filters payments by invoice ID and search string [FR-3]', () => {
      const filteredByInvoice = filterPayments(mockPayments, 'INV-2001', '');
      expect(filteredByInvoice).toHaveLength(1);
      expect(filteredByInvoice[0].payment_id).toBe('PAY-3001');

      const searched = filterPayments(mockPayments, 'all', 'Wire');
      expect(searched).toHaveLength(1);
    });

    it('calculateFinancialSummary computes aggregate metrics accurately', () => {
      const summary = calculateFinancialSummary(mockQuotes, mockInvoices, mockPayments);
      expect(summary.quotesCount).toBe(3);
      expect(summary.totalQuoteValue).toBe(27700.0);
      expect(summary.approvedQuotesCount).toBe(1);

      expect(summary.invoicesCount).toBe(3);
      expect(summary.totalInvoiceValue).toBe(27700.0);
      expect(summary.totalOutstandingBalance).toBe(13500.0);
      expect(summary.pastDueInvoicesCount).toBe(1);

      expect(summary.paymentsCount).toBe(2);
      expect(summary.totalPaymentsCollected).toBe(14200.0);
    });
  });

  describe('Component Rendering & Tab Navigation', () => {
    it('renders top header and executive summary KPI cards', () => {
      render(
        <Dashboard
          initialQuotes={mockQuotes}
          initialInvoices={mockInvoices}
          initialPayments={mockPayments}
        />
      );

      expect(
        screen.getByRole('heading', { level: 1, name: /financial transparency dashboard/i })
      ).toBeInDocument();

      // Check summary card values
      expect(screen.getByText('$27,700.00')).toBeInDocument(); // Total quotes value / invoice volume
      expect(screen.getByText('$13,500.00')).toBeInDocument(); // Total outstanding balance
      expect(screen.getByText('$14,200.00')).toBeInDocument(); // Total payments collected
      expect(screen.getByText('1 past due')).toBeInDocument();
    });

    it('switches between tabs on click', () => {
      render(
        <Dashboard
          initialQuotes={mockQuotes}
          initialInvoices={mockInvoices}
          initialPayments={mockPayments}
        />
      );

      // Default is overview
      expect(screen.getByRole('tab', { name: /consolidated overview/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Switch to Quotes tab [FR-1]
      const quotesTab = screen.getByRole('tab', { name: /quotes & approval states/i });
      fireEvent.click(quotesTab);
      expect(quotesTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('table', { name: /authorized quotes list/i })).toBeInDocument();

      // Switch to Invoices tab [FR-2]
      const invoicesTab = screen.getByRole('tab', { name: /invoices ledger/i });
      fireEvent.click(invoicesTab);
      expect(invoicesTab).toHaveAttribute('aria-selected', 'true');
      expect(
        screen.getByRole('table', { name: /status-filtered invoices ledger/i })
      ).toBeInDocument();

      // Switch to Payments tab [FR-3]
      const paymentsTab = screen.getByRole('tab', { name: /payment histories/i });
      fireEvent.click(paymentsTab);
      expect(paymentsTab).toHaveAttribute('aria-selected', 'true');
      expect(
        screen.getByRole('table', { name: /complete payment histories linked to invoices/i })
      ).toBeInDocument();
    });
  });

  describe('Quotes View [FR-1]', () => {
    it('displays authorized quotes with approval states and explicit expiration dates', () => {
      render(
        <Dashboard
          initialQuotes={mockQuotes}
          initialInvoices={mockInvoices}
          initialPayments={mockPayments}
          defaultTab="quotes"
        />
      );

      expect(screen.getByText('Q-1001')).toBeInDocument();
      expect(screen.getByText('Q-1002')).toBeInDocument();
      expect(screen.getByText('Q-1003')).toBeInDocument();

      expect(screen.getByText('Approved')).toBeInDocument();
      expect(screen.getByText('Pending Approval')).toBeInDocument();
      expect(screen.getByText('Expired')).toBeInDocument();

      expect(screen.getByText('EXPIRED')).toBeInDocument(); // Badge for expired quote
      expect(screen.getByText('Dec 31, 2026')).toBeInDocument();
    });

    it('filters quotes by approval state button click', () => {
      render(
        <Dashboard
          initialQuotes={mockQuotes}
          initialInvoices={mockInvoices}
          initialPayments={mockPayments}
          defaultTab="quotes"
        />
      );

      const approvedButton = screen.getByRole('button', { name: /approved/i });
      fireEvent.click(approvedButton);

      expect(screen.getByText('Q-1001')).toBeInDocument();
      expect(screen.queryByText('Q-1002')).not.toBeInDocument();
      expect(screen.queryByText('Q-1003')).not.toBeInDocument();
    });

    it('displays empty state when no quotes match search', () => {
      render(
        <Dashboard
          initialQuotes={mockQuotes}
          initialInvoices={mockInvoices}
          initialPayments={mockPayments}
          defaultTab="quotes"
        />
      );

      const searchInput = screen.getByLabelText(/search authorized quotes/i);
      fireEvent.change(searchInput, { target: { value: 'NON_EXISTENT_QUOTE' } });

      expect(screen.getByText('No authorized quotes found')).toBeInDocument();
    });
  });

  describe('Invoices View [FR-2]', () => {
    it('displays current, pending, and historical invoices with status filters', () => {
      render(
        <Dashboard
          initialQuotes={mockQuotes}
          initialInvoices={mockInvoices}
          initialPayments={mockPayments}
          defaultTab="invoices"
        />
      );

      expect(screen.getByText('INV-2001')).toBeInDocument();
      expect(screen.getByText('INV-2002')).toBeInDocument();
      expect(screen.getByText('INV-2003')).toBeInDocument();

      expect(screen.getByText('Current')).toBeInDocument();
      expect(screen.getByText('Past Due')).toBeInDocument();
      expect(screen.getByText('Paid')).toBeInDocument();

      expect(screen.getByText('45 days overdue')).toBeInDocument();
    });

    it('filters invoices by status filter buttons', () => {
      render(
        <Dashboard
          initialQuotes={mockQuotes}
          initialInvoices={mockInvoices}
          initialPayments={mockPayments}
          defaultTab="invoices"
        />
      );

      const pastDueBtn = screen.getByRole('button', { name: /past due/i });
      fireEvent.click(pastDueBtn);

      expect(screen.getByText('INV-2002')).toBeInDocument();
      expect(screen.queryByText('INV-2001')).not.toBeInDocument();
      expect(screen.queryByText('INV-2003')).not.toBeInDocument();
    });

    it('clicking Payments button on an invoice switches to Payments tab filtered by that invoice ID [FR-3]', () => {
      render(
        <Dashboard
          initialQuotes={mockQuotes}
          initialInvoices={mockInvoices}
          initialPayments={mockPayments}
          defaultTab="invoices"
        />
      );

      const viewPaymentsBtn = screen.getByRole('button', {
        name: /view payments for invoice inv-2001/i,
      });
      fireEvent.click(viewPaymentsBtn);

      // Verify active tab switched to Payments
      expect(screen.getByRole('tab', { name: /payment histories/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByText('PAY-3001')).toBeInDocument();
      expect(screen.queryByText('PAY-3002')).not.toBeInDocument();
    });
  });

  describe('Payment Histories View [FR-3]', () => {
    it('displays complete payment history records linked to corresponding invoices', () => {
      render(
        <Dashboard
          initialQuotes={mockQuotes}
          initialInvoices={mockInvoices}
          initialPayments={mockPayments}
          defaultTab="payments"
        />
      );

      expect(screen.getByText('PAY-3001')).toBeInDocument();
      expect(screen.getByText('PAY-3002')).toBeInDocument();

      expect(screen.getByText('INV-2001')).toBeInDocument();
      expect(screen.getByText('INV-2003')).toBeInDocument();

      expect(screen.getByText('Wire Transfer')).toBeInDocument();
      expect(screen.getByText('Credit Card')).toBeInDocument();
      expect(screen.getByText('$10,000.00')).toBeInDocument();
      expect(screen.getByText('$4,200.00')).toBeInDocument();
    });

    it('filters payment history records using the linked invoice dropdown', () => {
      render(
        <Dashboard
          initialQuotes={mockQuotes}
          initialInvoices={mockInvoices}
          initialPayments={mockPayments}
          defaultTab="payments"
        />
      );

      const select = screen.getByLabelText(/filter payments by linked invoice id/i);
      fireEvent.change(select, { target: { value: 'INV-2003' } });

      expect(screen.getByText('PAY-3002')).toBeInDocument();
      expect(screen.queryByText('PAY-3001')).not.toBeInDocument();
    });
  });

  describe('Async Auto-fetching & Error Handling', () => {
    it('automatically calls listQuotes, listInvoices, listPayments when initial data is null', async () => {
      vi.mocked(financialService.listQuotes).mockResolvedValue(mockQuotes);
      vi.mocked(financialService.listInvoices).mockResolvedValue(mockInvoices);
      vi.mocked(financialService.listPayments).mockResolvedValue(mockPayments);

      render(<Dashboard customerId="CUST-777" />);

      await waitFor(() => {
        expect(financialService.listQuotes).toHaveBeenCalledWith({ customer_id: 'CUST-777' });
        expect(financialService.listInvoices).toHaveBeenCalledWith({ customer_id: 'CUST-777' });
        expect(financialService.listPayments).toHaveBeenCalledWith({ customer_id: 'CUST-777' });
      });

      expect(screen.getByText('$27,700.00')).toBeInDocument();
    });

    it('renders error alert banner on API failure and handles retry', async () => {
      vi.mocked(financialService.listQuotes).mockRejectedValue(
        new Error('Network error loading quotes')
      );
      vi.mocked(financialService.listInvoices).mockResolvedValue([]);
      vi.mocked(financialService.listPayments).mockResolvedValue([]);

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInDocument();
        expect(screen.getByText('Network error loading quotes')).toBeInDocument();
      });

      // Click retry
      vi.mocked(financialService.listQuotes).mockResolvedValue(mockQuotes);
      const retryBtn = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInDocument();
      });
    });
  });
});
