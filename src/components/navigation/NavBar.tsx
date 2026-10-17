'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  LineChart,
  FileText,
  Headphones,
  DollarSign,
  BookOpen,
  Briefcase,
  Menu,
  X,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { apiClient, NavItem, UserMeResponse } from '../../services/apiClient';

export interface NavBarProps {
  /**
   * Pre-loaded or custom navigation menu items. If provided, overrides API fetching.
   */
  items?: NavItem[];
  /**
   * Optional custom brand title. Defaults to "PairFront".
   */
  brandName?: string;
  /**
   * Active route path override (primarily for testing or static rendering).
   */
  currentPath?: string;
  /**
   * User profile/identity object if already available.
   */
  user?: UserMeResponse | null;
  /**
   * Custom logout callback. Defaults to clearing token and redirecting to /login.
   */
  onLogout?: () => void;
  /**
   * Additional container CSS class names.
   */
  className?: string;
}

export const DEFAULT_NAV_ITEMS: NavItem[] = [
  {
    title: 'Dashboard',
    path: '/dashboard',
    is_accessible: true,
    icon_id: 'dashboard',
  },
  {
    title: 'Pipeline',
    path: '/pipeline',
    is_accessible: true,
    icon_id: 'pipeline',
  },
  {
    title: 'Performance',
    path: '/performance',
    is_accessible: true,
    icon_id: 'performance',
  },
  {
    title: 'Contracts',
    path: '/contracts',
    is_accessible: true,
    icon_id: 'contracts',
  },
  {
    title: 'Support',
    path: '/support',
    is_accessible: true,
    icon_id: 'support',
  },
  {
    title: 'Financials',
    path: '/financials',
    is_accessible: true,
    icon_id: 'financials',
  },
  {
    title: 'Knowledge Base',
    path: '/knowledge',
    is_accessible: true,
    icon_id: 'knowledge',
  },
];

/**
 * Returns icon element for given icon_id matching Linen & Logic design guidelines.
 */
export function getNavIcon(iconId?: string): React.ReactNode {
  switch (iconId) {
    case 'dashboard':
      return <LayoutDashboard className="w-4 h-4 mr-2 shrink-0" aria-hidden="true" />;
    case 'pipeline':
      return <Briefcase className="w-4 h-4 mr-2 shrink-0" aria-hidden="true" />;
    case 'performance':
      return <LineChart className="w-4 h-4 mr-2 shrink-0" aria-hidden="true" />;
    case 'contracts':
      return <FileText className="w-4 h-4 mr-2 shrink-0" aria-hidden="true" />;
    case 'support':
      return <Headphones className="w-4 h-4 mr-2 shrink-0" aria-hidden="true" />;
    case 'financials':
      return <DollarSign className="w-4 h-4 mr-2 shrink-0" aria-hidden="true" />;
    case 'knowledge':
      return <BookOpen className="w-4 h-4 mr-2 shrink-0" aria-hidden="true" />;
    default:
      return null;
  }
}

/**
 * Helper to determine whether a navigation route is active.
 */
export function isRouteActive(currentPath: string, itemPath: string): boolean {
  if (!currentPath || !itemPath) return false;
  if (itemPath === '/') {
    return currentPath === '/';
  }
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

/**
 * Global responsive navigation bar component.
 * Highlights active routes, enforces role-restricted section visibility,
 * and provides responsive mobile navigation and WCAG 2.1 AA accessibility.
 */
export function NavBar({
  items,
  brandName = 'PairFront',
  currentPath,
  user,
  onLogout,
  className,
}: NavBarProps) {
  const routerPathname = usePathname();
  const activePath = currentPath ?? (routerPathname || '');

  const [navItems, setNavItems] = useState<NavItem[]>(items || DEFAULT_NAV_ITEMS);
  const [currentUser, setCurrentUser] = useState<UserMeResponse | null>(user || null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync menu items if items prop changes
  useEffect(() => {
    if (items) {
      setNavItems(items);
    }
  }, [items]);

  // Sync user if user prop changes
  useEffect(() => {
    if (user !== undefined) {
      setCurrentUser(user);
    }
  }, [user]);

  // Fetch authorized navigation items when not provided explicitly via props
  useEffect(() => {
    if (items) return;

    let isMounted = true;
    apiClient
      .getNavigationMenu()
      .then((res) => {
        if (isMounted && res && Array.isArray(res.items)) {
          setNavItems(res.items);
        }
      })
      .catch(() => {
        // Fall back gracefully to DEFAULT_NAV_ITEMS if endpoint is unavailable
      });

    return () => {
      isMounted = false;
    };
  }, [items]);

  // Fetch current user identity if not provided
  useEffect(() => {
    if (user !== undefined) return;

    let isMounted = true;
    apiClient
      .getMe()
      .then((res) => {
        if (isMounted && res) {
          setCurrentUser(res);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCurrentUser(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }
    apiClient.removeToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  // Filter out inaccessible routes per FR-4 / FR-5
  const visibleNavItems = navItems.filter((item) => item.is_accessible !== false);

  return (
    <header className={twMerge('w-full bg-[#fbf9f4] border-b border-[#d1c4b9] sticky top-0 z-50', className)}>
      <nav
        aria-label="Global Navigation"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="flex items-center justify-between h-16">
          {/* Brand & Logo */}
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-xl font-serif font-normal text-[#59452b] hover:text-[#735c41] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#735c41] focus-visible:ring-offset-2 rounded px-1 transition-colors"
              onClick={closeMobileMenu}
            >
              {brandName}
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center space-x-1 lg:space-x-2" role="menubar">
              {visibleNavItems.map((item) => {
                const active = isRouteActive(activePath, item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    role="menuitem"
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'inline-flex items-center px-3 py-2 rounded-md text-sm font-sans transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#735c41] focus-visible:ring-offset-2',
                      active
                        ? 'bg-[#eae8e3] text-[#59452b] font-medium border-b-2 border-[#59452b]'
                        : 'text-[#4e453d] hover:bg-[#f0eee9] hover:text-[#59452b]'
                    )}
                  >
                    {getNavIcon(item.icon_id)}
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side user menu & mobile toggle */}
          <div className="flex items-center gap-3">
            {/* User details badge (desktop) */}
            {currentUser && (
              <div className="hidden lg:flex items-center gap-2 text-xs text-[#4e453d] bg-[#f0eee9] px-3 py-1.5 rounded-full border border-[#d1c4b9]">
                <UserIcon className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
                <span className="font-medium text-[#1b1c19]">{currentUser.email}</span>
                {currentUser.roles && currentUser.roles.length > 0 && (
                  <span className="text-[#80756b] uppercase text-[10px] tracking-wider ml-1">
                    ({currentUser.roles.join(', ')})
                  </span>
                )}
              </div>
            )}

            {/* Logout / Login button */}
            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium text-[#59452b] bg-[#f5f3ee] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#735c41] focus-visible:ring-offset-2"
              aria-label="Log out of application"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Logout</span>
            </button>

            {/* Mobile menu toggle button */}
            <button
              type="button"
              onClick={toggleMobileMenu}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-[#4e453d] hover:text-[#59452b] hover:bg-[#f0eee9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#735c41] focus-visible:ring-offset-2"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" aria-hidden="true" />
              ) : (
                <Menu className="w-6 h-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown Menu */}
        {mobileMenuOpen && (
          <div
            id="mobile-navigation-menu"
            className="md:hidden border-t border-[#d1c4b9] py-3 px-2 space-y-1 bg-[#fbf9f4]"
            data-testid="mobile-navigation-menu"
          >
            {visibleNavItems.map((item) => {
              const active = isRouteActive(activePath, item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={closeMobileMenu}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'flex items-center px-3 py-2.5 rounded-md text-base font-sans transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#735c41] focus-visible:ring-offset-2',
                    active
                      ? 'bg-[#eae8e3] text-[#59452b] font-medium border-l-4 border-[#59452b]'
                      : 'text-[#4e453d] hover:bg-[#f0eee9] hover:text-[#59452b]'
                  )}
                >
                  {getNavIcon(item.icon_id)}
                  <span>{item.title}</span>
                </Link>
              );
            })}

            {/* Mobile user info & logout */}
            <div className="pt-3 mt-3 border-t border-[#d1c4b9] space-y-2 px-3">
              {currentUser && (
                <div className="flex items-center gap-2 text-xs text-[#4e453d]">
                  <UserIcon className="w-3.5 h-3.5 text-[#59452b]" aria-hidden="true" />
                  <span className="font-medium text-[#1b1c19] truncate">{currentUser.email}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  handleLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-sans font-medium text-[#59452b] bg-[#f5f3ee] hover:bg-[#eae8e3] border border-[#d1c4b9] rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#735c41]"
                aria-label="Log out of application"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

export default NavBar;
