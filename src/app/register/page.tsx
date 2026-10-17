'use client';

import React, { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  UserPlus,
  ShieldCheck,
  FileText,
  Headphones,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { RegisterForm } from '../../components/auth/RegisterForm';
import { useAccessibility } from '../../components/common/AccessibilityContext';

function RegisterContent() {
  const searchParams = useSearchParams();
  const { announce } = useAccessibility();

  const emailParam = searchParams.get('email') || '';
  const tenantParam = searchParams.get('tenant') || searchParams.get('tenant_id') || undefined;
  const redirectParam = searchParams.get('redirect') || '/login?registered=true';

  useEffect(() => {
    announce('Registration page loaded. Please enter your details to create an account.', 'polite');
  }, [announce]);

  return (
    <div className="w-full max-w-4xl mx-auto py-4 sm:py-8 px-4">
      {/* Page Editorial Header */}
      <div className="text-center mb-8 max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center p-2.5 bg-[#f5f3ee] rounded-full border border-[#d1c4b9]/50 mb-4 shadow-sm">
          <UserPlus className="w-6 h-6 text-[#59452b]" aria-hidden="true" />
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#1b1c19] tracking-tight">
          Create Platform Account
        </h1>
        <p className="text-sm sm:text-base text-[#4e453d] mt-2.5 leading-relaxed">
          Register for a new PairFront account to access multi-tenant workspaces with role-based access control and default ClientViewer privileges.
        </p>
      </div>

      {/* Main Register Form Container */}
      <div className="mb-12">
        <RegisterForm
          defaultEmail={emailParam}
          tenantId={tenantParam}
          redirectPath={redirectParam}
          onSuccess={() => {
            announce('Account registered successfully. Redirecting to sign in...', 'assertive');
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
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              <h3 className="font-serif text-sm font-medium text-[#1b1c19]">ClientViewer Role</h3>
            </div>
            <p className="text-xs text-[#4e453d] leading-relaxed">
              New accounts receive read-only ClientViewer permissions by default for maximum tenant security.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-white border border-[#d1c4b9]/60 shadow-xs hover:border-[#735c41]/40 transition-colors">
            <div className="flex items-center gap-2 mb-2 text-[#59452b]">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <h3 className="font-serif text-sm font-medium text-[#1b1c19]">Tenant Isolation</h3>
            </div>
            <p className="text-xs text-[#4e453d] leading-relaxed">
              Automated row-level security isolates account data strictly within authorized tenant boundaries.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-white border border-[#d1c4b9]/60 shadow-xs hover:border-[#735c41]/40 transition-colors">
            <div className="flex items-center gap-2 mb-2 text-[#59452b]">
              <FileText className="w-4 h-4" aria-hidden="true" />
              <h3 className="font-serif text-sm font-medium text-[#1b1c19]">Audit Logged</h3>
            </div>
            <p className="text-xs text-[#4e453d] leading-relaxed">
              Registration attempts generate structured, non-blocking JSON audit events with correlation tracking.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation & Help Links */}
      <div className="mt-8 text-center text-xs text-[#80756b] flex items-center justify-center gap-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-[#59452b] hover:underline focus:outline-none focus:ring-1 focus:ring-[#735c41] rounded px-1"
        >
          <span>Already registered? Sign In</span>
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
        <span>•</span>
        <Link
          href="/knowledge"
          className="inline-flex items-center gap-1 text-[#59452b] hover:underline focus:outline-none focus:ring-1 focus:ring-[#735c41] rounded px-1"
        >
          <span>Documentation</span>
        </Link>
        <span>•</span>
        <Link
          href="/support"
          className="inline-flex items-center gap-1 text-[#59452b] hover:underline focus:outline-none focus:ring-1 focus:ring-[#735c41] rounded px-1"
        >
          <span>Support</span>
          <Headphones className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
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
          <p className="text-sm font-medium text-[#1b1c19]">Loading Registration Portal...</p>
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
