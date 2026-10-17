import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RegisterPage from '../../src/app/register/page';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';
import { apiClient, ApiError, RegisterResponse } from '../../src/services/apiClient';

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: () => '/register',
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('../../src/services/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/apiClient')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      register: vi.fn(),
    },
  };
});

describe('RegisterPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('renders page header, title, and create account form correctly', () => {
    render(
      <AccessibilityProvider>
        <RegisterPage />
      </AccessibilityProvider>
    );

    expect(
      screen.getByRole('heading', { level: 1, name: /create platform account/i })
    ).toBeInDocument();

    expect(
      screen.getByText(/register for a new pairfront account to access multi-tenant workspaces/i)
    ).toBeInDocument();

    expect(screen.getByRole('heading', { level: 1, name: /create account/i })).toBeInDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInDocument();
    expect(screen.getByLabelText(/password/i)).toBeInDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInDocument();
  });

  it('populates default email from query params if email param is provided', () => {
    mockSearchParams = new URLSearchParams('email=newuser@example.com');

    render(
      <AccessibilityProvider>
        <RegisterPage />
      </AccessibilityProvider>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toHaveValue('newuser@example.com');
  });

  it('passes tenant_id from query params to register call', async () => {
    mockSearchParams = new URLSearchParams('tenant_id=ten-12345');

    const mockResponse: RegisterResponse = {
      user_id: 'usr-101',
      email: 'tenantuser@example.com',
      tenant_id: 'ten-12345',
    };

    vi.mocked(apiClient.register).mockResolvedValue(mockResponse);

    render(
      <AccessibilityProvider>
        <RegisterPage />
      </AccessibilityProvider>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(emailInput, { target: { value: 'tenantuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecretPass123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient.register).toHaveBeenCalledWith({
        email: 'tenantuser@example.com',
        password: 'SecretPass123!',
        tenant_id: 'ten-12345',
      });
    });
  });

  it('renders security foundation cards and navigation links', () => {
    render(
      <AccessibilityProvider>
        <RegisterPage />
      </AccessibilityProvider>
    );

    expect(screen.getByText(/security & access foundation/i)).toBeInDocument();
    expect(screen.getByText(/clientviewer role/i)).toBeInDocument();
    expect(screen.getByText(/tenant isolation/i)).toBeInDocument();
    expect(screen.getByText(/audit logged/i)).toBeInDocument();

    const loginLink = screen.getByRole('link', { name: /already registered\? sign in/i });
    expect(loginLink).toHaveAttribute('href', '/login');

    const docLink = screen.getByRole('link', { name: /documentation/i });
    expect(docLink).toHaveAttribute('href', '/knowledge');

    const supportLink = screen.getByRole('link', { name: /support/i });
    expect(supportLink).toHaveAttribute('href', '/support');
  });

  it('executes successful registration flow and redirects to login path', async () => {
    mockSearchParams = new URLSearchParams('redirect=/login?registered=true');

    const mockResponse: RegisterResponse = {
      user_id: 'usr-202',
      email: 'newuser@example.com',
      tenant_id: 'ten-default',
    };

    vi.mocked(apiClient.register).mockResolvedValue(mockResponse);

    render(
      <AccessibilityProvider>
        <RegisterPage />
      </AccessibilityProvider>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecretPass123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient.register).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'SecretPass123!',
      });
      expect(mockPush).toHaveBeenCalledWith('/login?registered=true');
    });
  });

  it('displays duplicate email error when register API returns 409 Conflict', async () => {
    const error409 = new ApiError(409, 'User with this email already exists.');
    vi.mocked(apiClient.register).mockRejectedValue(error409);

    render(
      <AccessibilityProvider>
        <RegisterPage />
      </AccessibilityProvider>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecretPass123!' } });
    fireEvent.click(submitButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInDocument();
    expect(alert).toHaveTextContent(/user with this email already exists/i);
  });
});
