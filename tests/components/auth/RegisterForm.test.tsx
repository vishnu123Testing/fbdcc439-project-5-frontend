import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RegisterForm } from '../../../src/components/auth/RegisterForm';
import { ApiError, RegisterResponse } from '../../../src/services/apiClient';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

describe('RegisterForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders accessible email and password inputs with proper WCAG labels and attributes', () => {
    render(<RegisterForm defaultEmail="newuser@example.com" />);

    const form = screen.getByRole('form', { name: /registration form/i });
    expect(form).toBeInDocument();

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toBeInDocument();
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('required');
    expect(emailInput).toHaveAttribute('aria-required', 'true');
    expect(emailInput).toHaveValue('newuser@example.com');

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toBeInDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('aria-required', 'true');

    const submitButton = screen.getByRole('button', { name: /create account/i });
    expect(submitButton).toBeInDocument();
    expect(submitButton).toHaveAttribute('type', 'submit');

    const loginLink = screen.getByRole('link', { name: /sign in here/i });
    expect(loginLink).toBeInDocument();
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  it('shows error when submitting empty email', async () => {
    const onError = vi.fn();
    render(<RegisterForm onError={onError} />);

    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInDocument();
    expect(alert).toHaveTextContent(/please enter your email address/i);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput).toHaveAttribute('aria-describedby', 'register-error');
  });

  it('shows error when submitting empty password', async () => {
    render(<RegisterForm defaultEmail="user@example.com" />);

    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInDocument();
    expect(alert).toHaveTextContent(/please enter your password/i);

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).toHaveAttribute('aria-describedby', 'register-error');
  });

  it('handles successful registration flow, calls onSuccess, and redirects to login', async () => {
    const mockRegisterResponse: RegisterResponse = {
      user_id: 'usr-999',
      email: 'newuser@domain.com',
      tenant_id: 'ten-888',
    };

    const registerFn = vi.fn().mockResolvedValue(mockRegisterResponse);
    const onSuccess = vi.fn();

    render(<RegisterForm registerFn={registerFn} onSuccess={onSuccess} redirectPath="/login" />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(emailInput, { target: { value: 'newuser@domain.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePassword123!' } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(registerFn).toHaveBeenCalledWith({
        email: 'newuser@domain.com',
        password: 'SecurePassword123!',
      });
    });

    expect(onSuccess).toHaveBeenCalledWith(mockRegisterResponse);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('passes tenantId to registerFn when provided', async () => {
    const mockRegisterResponse: RegisterResponse = {
      user_id: 'usr-100',
      email: 'tenantuser@domain.com',
      tenant_id: 'ten-custom-123',
    };

    const registerFn = vi.fn().mockResolvedValue(mockRegisterResponse);

    render(
      <RegisterForm
        registerFn={registerFn}
        tenantId="ten-custom-123"
        defaultEmail="tenantuser@domain.com"
      />
    );

    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(passwordInput, { target: { value: 'MyPassword123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(registerFn).toHaveBeenCalledWith({
        email: 'tenantuser@domain.com',
        password: 'MyPassword123',
        tenant_id: 'ten-custom-123',
      });
    });
  });

  it('displays duplicate email error when API returns 409 conflict and invokes onError', async () => {
    const apiError = new ApiError(409, 'User with this email already exists.');
    const registerFn = vi.fn().mockRejectedValue(apiError);
    const onError = vi.fn();

    render(<RegisterForm registerFn={registerFn} onError={onError} />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(emailInput, { target: { value: 'existing@domain.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });

    fireEvent.click(submitButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInDocument();
    expect(alert).toHaveTextContent('User with this email already exists.');

    expect(onError).toHaveBeenCalledWith(apiError);

    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('displays generic error message on API failure', async () => {
    const apiError = new ApiError(500, 'Internal Server Error');
    const registerFn = vi.fn().mockRejectedValue(apiError);

    render(<RegisterForm registerFn={registerFn} />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(emailInput, { target: { value: 'test@domain.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });

    fireEvent.click(submitButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInDocument();
    expect(alert).toHaveTextContent('Internal Server Error');
  });

  it('disables inputs and button during loading state', async () => {
    let resolveRegister: (res: RegisterResponse) => void = () => {};
    const pendingPromise = new Promise<RegisterResponse>((resolve) => {
      resolveRegister = resolve;
    });

    const registerFn = vi.fn().mockReturnValue(pendingPromise);

    render(<RegisterForm registerFn={registerFn} />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    fireEvent.change(emailInput, { target: { value: 'user@domain.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    fireEvent.click(submitButton);

    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(/creating account\.\.\./i)).toBeInDocument();
    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();

    // Resolve pending promise to clean up
    resolveRegister({
      user_id: 'u1',
      email: 'user@domain.com',
      tenant_id: 't1',
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });
});
