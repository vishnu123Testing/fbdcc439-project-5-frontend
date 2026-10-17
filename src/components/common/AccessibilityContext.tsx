'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface Announcement {
  message: string;
  priority: 'polite' | 'assertive';
  id: number;
}

export interface AccessibilityContextType {
  announcement: Announcement | null;
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  clearAnnouncement: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export interface AccessibilityProviderProps {
  children: React.ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    setAnnouncement({
      message,
      priority,
      id: Date.now(),
    });
  }, []);

  const clearAnnouncement = useCallback(() => {
    setAnnouncement(null);
  }, []);

  return (
    <AccessibilityContext.Provider value={{ announcement, announce, clearAnnouncement }}>
      {children}
      {/* Dynamic ARIA Live Region for Screen Reader Announcements */}
      <div
        id="a11y-announcer"
        aria-live={announcement?.priority || 'polite'}
        aria-atomic="true"
        aria-relevant="additions text"
        className="sr-only"
        data-testid="a11y-announcer"
      >
        {announcement?.message || ''}
      </div>
    </AccessibilityContext.Provider>
  );
};

export function useAccessibility(): AccessibilityContextType {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}
