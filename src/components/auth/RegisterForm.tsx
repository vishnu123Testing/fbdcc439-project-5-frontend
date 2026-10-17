'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Lock, Mail } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import {
  apiClient,
  RegisterPayload,
  RegisterResponse,
  ApiError,
} from '../../services/apiClient';

export interface RegisterFormProps {
  /**
   * Optional callback invoked upon successful registration.
   */
  onSuccess?: (response: RegisterResponse) => void;
  /**
   * Optional callback invoked upon registration failure.
   */
  onError?: (error: Error) => void;
  /**
   * Automatically redirect on success. Defaults to true.
   */
  redirectOnSuccess?: boolean;
  /**
   * Destination path on success redirect. Defaults to '/login'.
   */
  redirectPath?: string;
  /**
   * Initial pre-filled email value.
   */
  defaultEmail?: string;
  /**
   * Optional tenant ID to assign during registration.
   */
  tenantId?: string;
  /**
   * Additional container CSS classes.
   */
  className?: string;
  /**
   * Custom register API call function (primarily for dependency injection / testing).
   */
  registerFn?: (payload: RegisterPayload) => Promise<RegisterResponse>;
}

export function RegisterForm({
  onSuccess,
  onError,
  redirectOnSuccess = true,
  redirectPath = '/login',
  defaultEmail = '',
  tenantId,
  className,
  registerFn = apiClient.register,
}: RegisterFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      const msg = 'Please enter your email address.';
      setError(msg);
      onError?.(new Error(msg));
      return;
    }

    if (!password) {
      const msg = 'Please enter your password.';
      setError(msg);
      onError?.(new Error(msg));
      return;
    }

    setIsLoading(true);

    try {
      const response = await registerFn({
        email: trimmedEmail,
        password,
        ...(tenantId ? { tenant_id: tenantId } : {}),
      });

      onSuccess?.(response);

      if (redirectOnSuccess) {
        try {
          router.push(redirectPath);
        } catch {
          if (typeof window !== 'undefined') {
            window.location.href = redirectPath;
          }
        }
      }
    } catch (err: unknown) {
      let errorMessage = 'Registration failed. Please try again.';
      if (err instanceof ApiError) {
        if (err.status === 409) {
          errorMessage = err.message || 'User with this email already exists.';
        } else {
          errorMessage = err.message || errorMessage;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message || errorMessage;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={twMerge(
        'w-full max-w-md mx-auto bg-white rounded-lg border border-[#d1c4b9] shadow-sm p-6 sm:p-8',
        className
      )}
    >
      <div className="mb-6 text-center sm:text-left">
        <h1 className="font-serif text-2xl font-normal text-[#1b1c19] tracking-tight">
          Create Account
        </h1>
        <p className="text-sm text-[#4e453d] mt-1">
          Enter your details to create a new account
        </p>
      </div>

      {error && (
        <div
          id="register-error"
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="mb-6 p-4 rounded border border-[#ba1a1a]/30 bg-[#ffdad6] text-[#93000a] text-sm flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-[#ba1a1a] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate aria-label="Registration form">
        <div className="mb-4">
          <label
            htmlFor="email"
            className="block text-xs font-medium uppercase tracking-wider text-[#4e453d] mb-2"
          >
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#80756b]">
              <Mail className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-required="true"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'register-error' : undefined}
              autoComplete="email"
              placeholder="name@company.com"
              disabled={isLoading}
              className="w-full pl-10 pr-3 py-2.5 border border-[#d1c4b9] rounded text-[#1b1c19] bg-white placeholder-[#80756b] focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:border-transparent disabled:opacity-50 disabled:bg-[#f5f3ee] text-sm transition-colors"
            />
          </div>
        </div>

        <div className="mb-6">
          <label
            htmlFor="password"
            className="block text-xs font-medium uppercase tracking-wider text-[#4e453d] mb-2"
          >
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#80756b]">
              <Lock className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'register-error' : undefined}
              autoComplete="new-password"
              placeholder="••••••••"
              disabled={isLoading}
              className="w-full pl-10 pr-3 py-2.5 border border-[#d1c4b9] rounded text-[#1b1c19] bg-white placeholder-[#80756b] focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:border-transparent disabled:opacity-50 disabled:bg-[#f5f3ee] text-sm transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="w-full py-3 px-4 bg-[#59452b] hover:bg-[#3f311f] active:bg-[#281804] text-white font-medium rounded text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#735c41] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Creating account...</span>
            </>
          ) : (
            <span>Create Account</span>
          )}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-[#e4e2dd] text-center text-xs text-[#4e453d]">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-[#59452b] font-medium hover:underline focus:outline-none focus:ring-1 focus:ring-[#735c41] rounded px-0.5"
        >
          Sign in here
        </Link>
      </div>
    </div>
  );
}

export default RegisterForm;
