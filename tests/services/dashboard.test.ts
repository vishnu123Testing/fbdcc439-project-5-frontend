import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getDashboardSummary,
  getDomainDrilldown,
  validateTimeframe,
  validateDomainId,
  sanitizeString,
  sanitizeMetric,
  sanitizeBreakdownItem,
  sanitizeSummaryResponse,
  sanitizeDomainQuickViewResponse,
  dashboardService,
} from '../../src/services/dashboard';
import { setToken } from '../../src/services/apiClient';

describe('dashboard service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Validation & Sanitization Helpers (FR-10)', () => {
    describe('validateTimeframe', () => {
      it('accepts valid timeframe durations', () => {
        expect(validateTimeframe('7d')).toBe('7d');
        expect(validateTimeframe('30d')).toBe('30d');
        expect(validateTimeframe('90d')).toBe('90d');
        expect(validateTimeframe(' 7D ')).toBe('7d');
      });

      it('defaults to 30d for invalid or missing timeframe parameter', () => {
        expect(validateTimeframe(undefined)).toBe('30d');
        expect(validateTimeframe('')).toBe('30d');
        expect(validateTimeframe('invalid')).toBe('30d');
        expect(validateTimeframe(123)).toBe('30d');
      });
    });

    describe('validateDomainId', () => {
      it('accepts supported domain identifiers', () => {
        expect(validateDomainId('lead_gen')).toBe('lead_gen');
        expect(validateDomainId('sales_pipeline')).toBe('sales_pipeline');
        expect(validateDomainId('support')).toBe('support');
        expect(validateDomainId('financials')).toBe('financials');
        expect(validateDomainId(' SUPPORT ')).toBe('support');
      });

      it('throws Error when an invalid domain ID is provided', () => {
        expect(() => validateDomainId('unsupported_domain')).toThrow(
          "Invalid domain_id parameter 'unsupported_domain'"
        );
        expect(() => validateDomainId('')).toThrow('Invalid domain_id parameter');
        expect(() => validateDomainId(null)).toThrow('Invalid domain_id parameter');
      });
    });

    describe('sanitizeString', () => {
      it('returns empty string for null, undefined, or whitespace', () => {
        expect(sanitizeString(null)).toBe('');
        expect(sanitizeString(undefined)).toBe('');
        expect(sanitizeString('   ')).toBe('');
      });

      it('strips script and HTML markup tags', () => {
        const raw = '<script>alert("xss")</script>Hello <b>World</b>';
        const sanitized = sanitizeString(raw);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('<b>');
        expect(sanitized).toContain('Hello World');
      });

      it('escapes special HTML entity characters', () => {
        const raw = '1 < 2 & 3 > 2 "test" \'single\'';
        const sanitized = sanitizeString(raw);
        expect(sanitized).toBe('1 &lt; 2 &amp; 3 &gt; 2 &quot;test&quot; &#x27;single&#x27;');
      });

      it('removes harmful control characters', () => {
        const raw = 'Clean\x00String\x07Text';
        expect(sanitizeString(raw)).toBe('CleanStringText');
      });
    });

    describe('sanitizeMetric', () => {
      it('handles null or non-object payloads with fallback values', () => {
        const result = sanitizeMetric(null);
        expect(result.display_name).toBe('Unknown Metric');
        expect(result.status).toBe('UNAVAILABLE');
        expect(result.formatted_value).toBe('Unavailable');
      });

      it('sanitizes valid metric objects and normalizes status enums', () => {
        const raw = {
          domain: 'sales_pipeline',
          metric_key: 'open_deals',
          display_name: '<b>Open Deals</b>',
          formatted_value: '$100,000',
          raw_value: 100000,
          baseline_value: 80000,
          percentage_change: 25.0,
          status: 'valid',
          unit: 'currency',
          error_detail: null,
        };

        const sanitized = sanitizeMetric(raw);
        expect(sanitized.domain).toBe('sales_pipeline');
        expect(sanitized.display_name).toBe('&lt;b&gt;Open Deals&lt;/b&gt;');
        expect(sanitized.status).toBe('VALID');
        expect(sanitized.raw_value).toBe(100000);
        expect(sanitized.percentage_change).toBe(25.0);
      });

      it('falls back to UNAVAILABLE when status is unrecognized or invalid', () => {
        const raw = {
          status: 'UNKNOWN_STATUS',
          raw_value: NaN,
        };
        const sanitized = sanitizeMetric(raw);
        expect(sanitized.status).toBe('UNAVAILABLE');
        expect(sanitized.raw_value).toBeNull();
      });
    });

    describe('sanitizeBreakdownItem', () => {
      it('sanitizes label and handles invalid numeric values', () => {
        const item1 = sanitizeBreakdownItem({ label: '<em>Source</em>', value: 150 });
        expect(item1.label).toBe('&lt;em&gt;Source&lt;/em&gt;');
        expect(item1.value).toBe(150);

        const item2 = sanitizeBreakdownItem({ label: null, value: NaN });
        expect(item2.label).toBe('Unknown');
        expect(item2.value).toBe(0);
      });
    });

    describe('sanitizeSummaryResponse', () => {
      it('returns fallback structure when given invalid input', () => {
        const res = sanitizeSummaryResponse(undefined);
        expect(res.status).toBe('FAILED');
        expect(res.metrics).toEqual([]);
        expect(res.generated_at).toBeDefined();
      });

      it('sanitizes summary response with valid metrics list', () => {
        const raw = {
          status: 'complete',
          generated_at: '2026-10-06T08:00:00Z',
          metrics: [
            {
              domain: 'lead_gen',
              metric_key: 'leads',
              display_name: 'Leads',
              formatted_value: '50',
              status: 'VALID',
            },
          ],
        };
        const res = sanitizeSummaryResponse(raw);
        expect(res.status).toBe('COMPLETE');
        expect(res.generated_at).toBe('2026-10-06T08:00:00Z');
        expect(res.metrics).toHaveLength(1);
        expect(res.metrics[0].domain).toBe('lead_gen');
      });
    });

    describe('sanitizeDomainQuickViewResponse', () => {
      it('sanitizes domain drilldown response payload', () => {
        const raw = {
          domain: 'financials',
          status: 'complete',
          detailed_metrics: [
            {
              domain: 'financials',
              metric_key: 'arr',
              display_name: 'ARR',
              formatted_value: '$1,000,000',
              status: 'VALID',
            },
          ],
          breakdown_items: [
            {
              label: 'Subscriptions',
              value: 800000,
            },
          ],
          error_detail: null,
        };

        const res = sanitizeDomainQuickViewResponse(raw);
        expect(res.domain).toBe('financials');
        expect(res.status).toBe('COMPLETE');
        expect(res.detailed_metrics).toHaveLength(1);
        expect(res.breakdown_items).toHaveLength(1);
        expect(res.breakdown_items[0].label).toBe('Subscriptions');
      });
    });
  });

  describe('API Client Endpoints (FR-1)', () => {
    it('getDashboardSummary calls GET /api/v1/dashboard/summary with validated timeframe', async () => {
      setToken('test-auth-token');

      const mockApiResponse = {
        status: 'COMPLETE',
        generated_at: '2026-10-06T10:00:00Z',
        metrics: [
          {
            domain: 'lead_gen',
            metric_key: 'mql_volume',
            display_name: 'MQL Volume',
            formatted_value: '350',
            raw_value: 350,
            baseline_value: 300,
            percentage_change: 16.67,
            status: 'VALID',
            unit: 'count',
            error_detail: null,
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockApiResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await getDashboardSummary('7d');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/dashboard/summary?timeframe=7d');
      expect(options.method).toBe('GET');
      expect(options.headers.get('Authorization')).toBe('Bearer test-auth-token');

      expect(result.status).toBe('COMPLETE');
      expect(result.metrics).toHaveLength(1);
      expect(result.metrics[0].metric_key).toBe('mql_volume');
    });

    it('getDashboardSummary defaults to 30d timeframe when none is supplied', async () => {
      const mockApiResponse = {
        status: 'COMPLETE',
        generated_at: '2026-10-06T10:00:00Z',
        metrics: [],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockApiResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      await getDashboardSummary();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/dashboard/summary?timeframe=30d');
    });

    it('getDomainDrilldown calls GET /api/v1/dashboard/domains/{domain_id}', async () => {
      setToken('test-auth-token');

      const mockApiResponse = {
        domain: 'support',
        status: 'COMPLETE',
        detailed_metrics: [
          {
            domain: 'support',
            metric_key: 'open_tickets',
            display_name: 'Open Tickets',
            formatted_value: '12',
            raw_value: 12,
            baseline_value: 15,
            percentage_change: -20.0,
            status: 'VALID',
            unit: 'count',
            error_detail: null,
          },
        ],
        breakdown_items: [
          {
            label: 'Priority: High',
            value: 4,
          },
        ],
        error_detail: null,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockApiResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await getDomainDrilldown('support', '90d');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/dashboard/domains/support?timeframe=90d');
      expect(options.method).toBe('GET');
      expect(options.headers.get('Authorization')).toBe('Bearer test-auth-token');

      expect(result.domain).toBe('support');
      expect(result.status).toBe('COMPLETE');
      expect(result.detailed_metrics).toHaveLength(1);
      expect(result.breakdown_items).toHaveLength(1);
    });

    it('getDomainDrilldown validates domainId before making HTTP request', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      await expect(getDomainDrilldown('invalid_domain_name')).rejects.toThrow(
        "Invalid domain_id parameter 'invalid_domain_name'"
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('exports dashboardService default and named methods', () => {
      expect(dashboardService.getDashboardSummary).toBe(getDashboardSummary);
      expect(dashboardService.getDomainDrilldown).toBe(getDomainDrilldown);
      expect(dashboardService.validateTimeframe).toBe(validateTimeframe);
      expect(dashboardService.validateDomainId).toBe(validateDomainId);
      expect(dashboardService.sanitizeString).toBe(sanitizeString);
      expect(dashboardService.sanitizeMetric).toBe(sanitizeMetric);
      expect(dashboardService.sanitizeBreakdownItem).toBe(sanitizeBreakdownItem);
      expect(dashboardService.sanitizeSummaryResponse).toBe(sanitizeSummaryResponse);
      expect(dashboardService.sanitizeDomainQuickViewResponse).toBe(sanitizeDomainQuickViewResponse);
    });
  });
});
