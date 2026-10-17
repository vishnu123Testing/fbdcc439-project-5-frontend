import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LoginForm } from '../../../src/components/auth/LoginForm';
import { ApiError, LoginResponse } from '../../../src/services/apiClient';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

describe('LoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders accessible email and password inputs with proper WCAG labels and attributes', () => {
    render(<LoginForm defaultEmail="test@example.com" />);

    const form = screen.getByRole('form', { name: /sign in form/i });
    expect(form).toBeInDocument();

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toBeInDocument();
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('required');
    expect(emailInput).toHaveAttribute('aria-required', 'true');
    expect(emailInput).toHaveValue('test@example.com');

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toBeInDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('aria-required', 'true');

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    expect(submitButton).toBeInDocument();
    expect(submitButton).toHaveAttribute('type', 'submit');

    const registerLink = screen.getByRole('link', { name: /register here/i });
    expect(registerLink).toBeInDocument();
    expect(registerLink).toHaveAttribute('href', '/register');
  });

  it('shows error when submitting empty email', async () => {
    const onError = vi.fn();
    render(<LoginForm onError={onError} />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInDocument();
    expect(alert).toHaveTextContent(/please enter your email address/i);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput).toHaveAttribute('aria-describedby', 'login-error');
  });

  it('shows error when submitting empty password', async () => {
    render(<LoginForm defaultEmail="user@example.com" />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInDocument();
    expect(alert).toHaveTextContent(/please enter your password/i);

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).toHaveAttribute('aria-describedby', 'login-error');
  });

  it('handles successful login flow, calls onSuccess, and redirects to dashboard', async () => {
    const mockSuccessResponse: LoginResponse = {
      access_token: 'fake-jwt-token',
      token_type: 'bearer',
      user_id: 'usr-123',
      tenant_id: 'ten-456',
    };

    const loginFn = vi.fn().mockResolvedValue(mockSuccessResponse);
    const onSuccess = vi.fn();

    render(<LoginForm loginFn={loginFn} onSuccess={onSuccess} redirectPath="/dashboard" />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'user@domain.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecretPass123!' } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(loginFn).toHaveBeenCalledWith({
        email: 'user@domain.com',
        password: 'SecretPass123!',
      });
    });

    expect(onSuccess).toHaveBeenCalledWith(mockSuccessResponse);
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('displays API error message on login failure and invokes onError', async () => {
    const apiError = new ApiError(401, 'Invalid email or password');
    const loginFn = vi.fn().mockRejectedValue(apiError);
    const onError = vi.fn();

    render(<LoginForm loginFn={loginFn} onError={onError} />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'wrong@domain.com' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongPassword' } });

    fireEvent.click(submitButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInDocument();
    expect(alert).toHaveTextContent('Invalid email or password');

    expect(onError).toHaveBeenCalledWith(apiError);

    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables inputs and button during loading state', async () => {
    let resolveLogin: (res: LoginResponse) => void = () => {};
    const pendingPromise = new Promise<LoginResponse>((resolve) => {
      resolveLogin = resolve;
    });

    const loginFn = vi.fn().mockReturnValue(pendingPromise);

    render(<LoginForm loginFn={loginFn} />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'user@domain.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    fireEvent.click(submitButton);

    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(/signing in\.\.\./i)).toBeInDocument();
    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();

    // Resolve pending promise to clean up
    resolveLogin({
      access_token: 'tok',
      token_type: 'bearer',
      user_id: 'u1',
      tenant_id: 't1',
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });
});