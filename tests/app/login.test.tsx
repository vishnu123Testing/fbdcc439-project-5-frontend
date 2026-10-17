import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoginPage from '../../src/app/login/page';
import { AccessibilityProvider } from '../../src/components/common/AccessibilityContext';
import { apiClient, LoginResponse } from '../../src/services/apiClient';

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: () => '/login',
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
      login: vi.fn(),
    },
  };
});

describe('LoginPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('renders page header, title, and sign in form correctly', () => {
    render(
      <AccessibilityProvider>
        <LoginPage />
      </AccessibilityProvider>
    );

    expect(
      screen.getByRole('heading', { level: 1, name: /platform access portal/i })
    ).toBeInDocument();

    expect(
      screen.getByText(/sign in to your pairfront account to access multi-tenant workspaces/i)
    ).toBeInDocument();

    expect(screen.getByRole('heading', { level: 1, name: /sign in/i })).toBeInDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInDocument();
    expect(screen.getByLabelText(/password/i)).toBeInDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInDocument();
  });

  it('renders registration banner when registered query param is present', () => {
    mockSearchParams = new URLSearchParams('registered=true');

    render(
      <AccessibilityProvider>
        <LoginPage />
      </AccessibilityProvider>
    );

    const banner = screen.getByRole('status');
    expect(banner).toBeInDocument();
    expect(screen.getByText(/account created successfully/i)).toBeInDocument();
    expect(
      screen.getByText(/registered with default clientviewer access/i)
    ).toBeInDocument();
  });

  it('populates default email from query params if email param is provided', () => {
    mockSearchParams = new URLSearchParams('email=newuser@example.com');

    render(
      <AccessibilityProvider>
        <LoginPage />
      </AccessibilityProvider>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toHaveValue('newuser@example.com');
  });

  it('renders security foundation cards and navigation links', () => {
    render(
      <AccessibilityProvider>
        <LoginPage />
      </AccessibilityProvider>
    );

    expect(screen.getByText(/security & access foundation/i)).toBeInDocument();
    expect(screen.getByText(/sub-20ms rbac/i)).toBeInDocument();
    expect(screen.getByText(/tenant isolation/i)).toBeInDocument();
    expect(screen.getByText(/structured audit/i)).toBeInDocument();

    const docLink = screen.getByRole('link', { name: /access control documentation/i });
    expect(docLink).toHaveAttribute('href', '/knowledge');

    const supportLink = screen.getByRole('link', { name: /system health & support/i });
    expect(supportLink).toHaveAttribute('href', '/support');
  });

  it('executes successful login flow and redirects to destination path', async () => {
    mockSearchParams = new URLSearchParams('redirect=/contracts');

    const mockResponse: LoginResponse = {
      access_token: 'valid-jwt-token-789',
      token_type: 'bearer',
      user_id: 'usr-999',
      tenant_id: 'ten-888',
    };

    vi.mocked(apiClient.login).mockResolvedValue(mockResponse);

    render(
      <AccessibilityProvider>
        <LoginPage />
      </AccessibilityProvider>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test.user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecretPass123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient.login).toHaveBeenCalledWith({
        email: 'test.user@example.com',
        password: 'SecretPass123!',
      });
      expect(mockPush).toHaveBeenCalledWith('/contracts');
    });
  });
});
