import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  apiClient,
  getToken,
  setToken,
  removeToken,
  request,
  login,
  register,
  getMe,
  getNavigationMenu,
  buildUrl,
  ApiError,
  TOKEN_STORAGE_KEY,
} from '../../src/services/apiClient';

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Token storage helpers', () => {
    it('stores, retrieves, and removes auth token', () => {
      expect(getToken()).toBeNull();

      setToken('test-token-123');
      expect(getToken()).toBe('test-token-123');
      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('test-token-123');

      removeToken();
      expect(getToken()).toBeNull();
      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });
  });

  describe('buildUrl', () => {
    it('returns full URLs unchanged', () => {
      expect(buildUrl('http://example.com/api/v1/test')).toBe('http://example.com/api/v1/test');
      expect(buildUrl('https://example.com/api/v1/test')).toBe('https://example.com/api/v1/test');
    });

    it('appends relative endpoints to default base URL', () => {
      expect(buildUrl('/auth/login')).toBe('/api/v1/auth/login');
      expect(buildUrl('auth/login')).toBe('/api/v1/auth/login');
    });

    it('handles endpoints that already include api/v1', () => {
      expect(buildUrl('/api/v1/auth/login')).toBe('/api/v1/auth/login');
      expect(buildUrl('api/v1/auth/login')).toBe('/api/v1/auth/login');
    });
  });

  describe('request helper', () => {
    it('attaches Bearer token header when token is stored and skipAuth is false', async () => {
      setToken('my-secret-token');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await request<{ success: boolean }>('/test-endpoint');

      expect(res).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/test-endpoint');
      expect(options.headers.get('Authorization')).toBe('Bearer my-secret-token');
    });

    it('does not attach Bearer token when skipAuth is true', async () => {
      setToken('my-secret-token');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await request<{ success: boolean }>('/public-endpoint', { skipAuth: true });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.get('Authorization')).toBeNull();
    });

    it('handles 401 response by removing token, redirecting to /login, and throwing ApiError', async () => {
      setToken('expired-token');

      // Mock window.location
      const originalLocation = window.location;
      delete (window as unknown as { location?: unknown }).location;
      window.location = { ...originalLocation, href: 'http://localhost/dashboard', pathname: '/dashboard' } as Location;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Authentication credentials were not provided or are invalid.' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(request('/protected')).rejects.toThrow(ApiError);
      expect(getToken()).toBeNull();
      expect(window.location.href).toBe('/login');

      window.location = originalLocation;
    });

    it('throws ApiError on HTTP non-200 responses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ detail: 'User with this email already exists.' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      try {
        await request('/auth/register', { method: 'POST', body: '{}' });
        expect.fail('Should have thrown ApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(409);
        expect(apiErr.message).toBe('User with this email already exists.');
      }
    });

    it('returns null on 204 No Content response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await request('/item', { method: 'DELETE' });
      expect(result).toBeNull();
    });
  });

  describe('API endpoints', () => {
    it('login calls POST /auth/login and stores access_token on success', async () => {
      const mockLoginResponse = {
        access_token: 'new-jwt-token',
        token_type: 'bearer',
        user_id: 'user-123',
        tenant_id: 'tenant-456',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockLoginResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await login({ email: 'test@example.com', password: 'secretpassword' });

      expect(result).toEqual(mockLoginResponse);
      expect(getToken()).toBe('new-jwt-token');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/auth/login');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ email: 'test@example.com', password: 'secretpassword' });
    });

    it('register calls POST /auth/register', async () => {
      const mockRegisterResponse = {
        user_id: 'user-789',
        email: 'newuser@example.com',
        tenant_id: 'tenant-456',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockRegisterResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await register({ email: 'newuser@example.com', password: 'password123' });

      expect(result).toEqual(mockRegisterResponse);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/auth/register');
      expect(options.method).toBe('POST');
    });

    it('getMe calls GET /auth/me', async () => {
      setToken('valid-token');
      const mockMeResponse = {
        user_id: 'user-123',
        email: 'user@example.com',
        tenant_id: 'tenant-456',
        roles: ['ClientViewer'],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockMeResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await getMe();

      expect(result).toEqual(mockMeResponse);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/auth/me');
      expect(options.method).toBe('GET');
      expect(options.headers.get('Authorization')).toBe('Bearer valid-token');
    });

    it('getNavigationMenu calls GET /navigation/menu', async () => {
      setToken('valid-token');
      const mockNavResponse = {
        items: [
          { title: 'Dashboard', path: '/dashboard', is_accessible: true, icon_id: 'layout-dashboard' },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockNavResponse,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await getNavigationMenu();

      expect(result).toEqual(mockNavResponse);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/navigation/menu');
      expect(options.method).toBe('GET');
    });

    it('exposes apiClient object with expected methods', () => {
      expect(apiClient.getToken).toBe(getToken);
      expect(apiClient.setToken).toBe(setToken);
      expect(apiClient.removeToken).toBe(removeToken);
      expect(apiClient.request).toBe(request);
      expect(apiClient.login).toBe(login);
      expect(apiClient.register).toBe(register);
      expect(apiClient.getMe).toBe(getMe);
      expect(apiClient.getNavigationMenu).toBe(getNavigationMenu);
    });
  });
});
