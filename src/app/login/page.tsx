'use client';

import React, { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  FileText,
  Headphones,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { LoginForm } from '../../components/auth/LoginForm';
import { useAccessibility } from '../../components/common/AccessibilityContext';

function LoginContent() {
  const searchParams = useSearchParams();
  const { announce } = useAccessibility();

  const redirectParam = searchParams.get('redirect') || '/dashboard';
  const emailParam = searchParams.get('email') || '';
  const isRegistered = searchParams.get('registered') === 'true';

  useEffect(() => {
    announce('Login page loaded. Please enter your credentials.', 'polite');
  }, [announce]);

  return (
    <div className="w-full max-w-4xl mx-auto py-4 sm:py-8 px-4">
      {/* Page Editorial Header */}
      <div className="text-center mb-8 max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center p-2.5 bg-[#f5f3ee] rounded-full border border-[#d1c4b9]/50 mb-4 shadow-sm">
          <ShieldCheck className="w-6 h-6 text-[#59452b]" aria-hidden="true" />
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#1b1c19] tracking-tight">
          Platform Access Portal
        </h1>
        <p className="text-sm sm:text-base text-[#4e453d] mt-2.5 leading-relaxed">
          Sign in to your PairFront account to access multi-tenant workspaces, view active contracts, and monitor sub-20ms system telemetry.
        </p>
      </div>

      {/* Registration Success Notification Banner */}
      {isRegistered && (
        <div
          role="status"
          aria-live="polite"
          className="max-w-md mx-auto mb-6 p-4 rounded-lg bg-[#f0eee9] border border-[#735c41]/30 text-[#1b1c19] text-sm flex items-start gap-3 shadow-sm"
        >
          <CheckCircle2 className="w-5 h-5 text-[#59452b] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold text-[#59452b]">Account Created Successfully</p>
            <p className="text-xs text-[#4e453d] mt-0.5">
              Your user account has been registered with default <span className="font-medium">ClientViewer</span> access. Please sign in below.
            </p>
          </div>
        </div>
      )}

      {/* Main Login Form Container */}
      <div className="mb-12">
        <LoginForm
          redirectPath={redirectParam}
          defaultEmail={emailParam}
          onSuccess={() => {
            announce('Authentication successful. Redirecting to workspace...', 'assertive');
          }}
        />
      </div>

      {/* Security & Access Foundation Cards */}
      <div className="mt-12 pt-8 border-t border-[#d1c4b9]/40">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#80756b] text-center mb-6">
          Security & Access Foundation
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="p-4 rounded-lg bg-white border border-[#d1c4b9]/60 shadow-xs hover:border-[#735c41]/40 transition-colors">
            <div className="flex items-center gap-2 mb-2 text-[#59452b]">
              <Lock className="w-4 h-4" aria-hidden="true" />
              <h3 className="font-serif text-sm font-medium text-[#1b1c19]">Sub-20ms RBAC</h3>
            </div>
            <p className="text-xs text-[#4e453d] leading-relaxed">
              Synchronous server-side role evaluation enforced on every API request boundary.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-white border border-[#d1c4b9]/60 shadow-xs hover:border-[#735c41]/40 transition-colors">
            <div className="flex items-center gap-2 mb-2 text-[#59452b]">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <h3 className="font-serif text-sm font-medium text-[#1b1c19]">Tenant Isolation</h3>
            </div>
            <p className="text-xs text-[#4e453d] leading-relaxed">
              Row-level data filtering strictly isolates client records by tenant identifier.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-white border border-[#d1c4b9]/60 shadow-xs hover:border-[#735c41]/40 transition-colors">
            <div className="flex items-center gap-2 mb-2 text-[#59452b]">
              <FileText className="w-4 h-4" aria-hidden="true" />
              <h3 className="font-serif text-sm font-medium text-[#1b1c19]">Structured Audit</h3>
            </div>
            <p className="text-xs text-[#4e453d] leading-relaxed">
              Non-blocking JSON audit logging to stdout with unique correlation IDs.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation & Help Links */}
      <div className="mt-8 text-center text-xs text-[#80756b] flex items-center justify-center gap-4">
        <Link
          href="/knowledge"
          className="inline-flex items-center gap-1 text-[#59452b] hover:underline focus:outline-none focus:ring-1 focus:ring-[#735c41] rounded px-1"
        >
          <span>Access Control Documentation</span>
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
        <span>•</span>
        <Link
          href="/support"
          className="inline-flex items-center gap-1 text-[#59452b] hover:underline focus:outline-none focus:ring-1 focus:ring-[#735c41] rounded px-1"
        >
          <span>System Health & Support</span>
          <Headphones className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center"
        >
          <div className="w-8 h-8 border-2 border-[#59452b] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium text-[#1b1c19]">Loading Access Portal...</p>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
