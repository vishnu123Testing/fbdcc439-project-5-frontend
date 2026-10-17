/**
 * API Client wrapper for managing authentication, token storage, request execution,
 * and standard API endpoints.
 */

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  tenant_id: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  tenant_id?: string;
}

export interface RegisterResponse {
  user_id: string;
  email: string;
  tenant_id: string;
}

export interface UserMeResponse {
  user_id: string;
  email: string;
  tenant_id: string;
  roles: string[];
}

export interface NavItem {
  title: string;
  path: string;
  is_accessible: boolean;
  icon_id: string;
}

export interface NavigationMenuResponse {
  items: NavItem[];
}

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const TOKEN_STORAGE_KEY = 'auth_token';

/**
 * Retrieve current bearer token from storage.
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (err) {
    console.error('Error reading auth token from localStorage', err);
    return null;
  }
}

/**
 * Store bearer token in storage.
 */
export function setToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch (err) {
    console.error('Error setting auth token in localStorage', err);
  }
}

/**
 * Remove bearer token from storage.
 */
export function removeToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (err) {
    console.error('Error removing auth token from localStorage', err);
  }
}

export interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

/**
 * Construct full URL for given endpoint path.
 */
export function buildUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanBase = API_BASE_URL.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');

  if (cleanEndpoint.startsWith('api/v1/')) {
    return `/${cleanEndpoint}`;
  }
  return `${cleanBase}/${cleanEndpoint}`;
}

/**
 * Generic fetch wrapper with token injection, JSON parsing, error handling,
 * and 401 redirect logic.
 */
export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipAuth = false, headers: customHeaders, ...restOptions } = options;
  const url = buildUrl(endpoint);

  const headers = new Headers(customHeaders);

  if (!headers.has('Content-Type') && restOptions.body && typeof restOptions.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuth) {
    const token = getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    ...restOptions,
    headers,
  });

  if (response.status === 401) {
    removeToken();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    let errorDetail = 'Unauthorized';
    try {
      const errorJson = await response.json();
      if (typeof errorJson.detail === 'string') {
        errorDetail = errorJson.detail;
      } else if (Array.isArray(errorJson.detail)) {
        errorDetail = errorJson.detail
          .map((d: { msg?: string }) => d.msg || JSON.stringify(d))
          .join(', ');
      }
    } catch {
      // Ignore JSON parse failure
    }
    throw new ApiError(401, errorDetail);
  }

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;
    let errorData: unknown = null;
    try {
      errorData = await response.json();
      if (errorData && typeof errorData === 'object') {
        const dataObj = errorData as Record<string, unknown>;
        if (typeof dataObj.detail === 'string') {
          errorMessage = dataObj.detail;
        } else if (Array.isArray(dataObj.detail)) {
          errorMessage = dataObj.detail
            .map((d: { msg?: string }) => d.msg || JSON.stringify(d))
            .join(', ');
        } else if (typeof dataObj.message === 'string') {
          errorMessage = dataObj.message;
        }
      }
    } catch {
      // Response might not be JSON
    }
    throw new ApiError(response.status, errorMessage, errorData);
  }

  if (response.status === 204) {
    return null as unknown as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Authenticate user with email and password, store returned token on success.
 */
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const response = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
    skipAuth: true,
  });
  if (response && response.access_token) {
    setToken(response.access_token);
  }
  return response;
}

/**
 * Register a new user with email, password, and optional tenant_id.
 */
export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
  return request<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}

/**
 * Fetch active identity and roles for the logged-in user.
 */
export async function getMe(): Promise<UserMeResponse> {
  return request<UserMeResponse>('/auth/me', {
    method: 'GET',
  });
}

/**
 * Fetch authorized global navigation items for current user roles.
 */
export async function getNavigationMenu(): Promise<NavigationMenuResponse> {
  return request<NavigationMenuResponse>('/navigation/menu', {
    method: 'GET',
  });
}

export const apiClient = {
  getToken,
  setToken,
  removeToken,
  request,
  login,
  register,
  getMe,
  getNavigationMenu,
};

export default apiClient;
