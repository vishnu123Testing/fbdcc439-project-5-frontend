import type { Metadata, Viewport } from 'next';
import React from 'react';
import { NavBar } from '../components/navigation/NavBar';
import { AccessibilityProvider } from '../components/common/AccessibilityContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'PairFront Platform',
  description: 'Platform Access Control System Foundation',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#fbf9f4] text-[#1b1c19] antialiased flex flex-col font-sans">
        <AccessibilityProvider>
          {/* WCAG 2.1 AA Skip Link for Keyboard Navigation */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#59452b] focus:text-white focus:rounded focus:outline-none focus:ring-2 focus:ring-[#735c41]"
          >
            Skip to main content
          </a>

          {/* Persistent Navigation Bar */}
          <NavBar />

          {/* Main Viewport Container */}
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 focus:outline-none"
          >
            {children}
          </main>

          {/* Persistent Footer Landmark */}
          <footer className="border-t border-[#d1c4b9]/30 bg-[#f5f3ee] py-4 px-6 text-center text-xs text-[#80756b]">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
              <span>&copy; {new Date().getFullYear()} PairFront Platform. All rights reserved.</span>
              <span>WCAG 2.1 AA Compliant Access Control System</span>
            </div>
          </footer>
        </AccessibilityProvider>
      </body>
    </html>
  );
}
