'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck,
  AlertCircle,
  Cloud,
  Database,
  Shield,
  Users,
  Lock,
  ScrollText,
  ChevronRight,
  ChevronLeft,
  Activity,
  Cpu,
  Radio,
  PanelLeftClose,
  PanelLeft,
  Zap
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';
import { useSidebar } from '@/context/SidebarContext';
import { cn } from '@/lib/utils';

/**
 * Extract simple role name from various formats
 */
function normalizeRole(roleValue) {
  if (!roleValue) return null;
  return roleValue.replace(/^role_/i, '').toLowerCase();
}

export default function SideNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isOperator, activeLineId, activeLineName, hasActiveLine } = useAuth();
  const { t } = useI18n();
  const { isCollapsed, isHidden, toggleCollapse } = useSidebar();
  const [currentTime, setCurrentTime] = useState('');
  const [systemUptime, setSystemUptime] = useState('00:00:00');

  // Real-time clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simulate system uptime
  useEffect(() => {
    let seconds = Math.floor(Math.random() * 86400);
    const interval = setInterval(() => {
      seconds++;
      const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
      const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
      const s = (seconds % 60).toString().padStart(2, '0');
      setSystemUptime(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const userRole = normalizeRole(user?.role || user?.roleId || user?.role_id);

  // Custom HMI click handler - operators go directly to active line
  const handleHMIClick = useCallback((e) => {
    e.preventDefault();
    if (isOperator && hasActiveLine && activeLineId) {
      // Operator has active session - go directly to live inspection
      router.push(`/inspection/live/${activeLineId}`);
    } else {
      // No active session or non-operator - go to line selection
      router.push('/inspection/select-line');
    }
  }, [isOperator, hasActiveLine, activeLineId, router]);

  const navItems = [
    {
      labelKey: 'nav.hmi',
      href: '/inspection/select-line',
      icon: ClipboardCheck,
      roles: ['operator', 'manager', 'engineer', 'superadmin'],
      code: 'HMI',
      isHMI: true, // Special flag for HMI item
    },
    {
      labelKey: 'nav.managerQueue',
      href: '/inspection/overrides',
      icon: AlertCircle,
      roles: ['manager', 'superadmin'],
      code: 'MGR',
    },
    {
      labelKey: 'nav.masterData',
      href: '/engineering/master-data',
      icon: Database,
      roles: ['engineer', 'superadmin'],
      code: 'ENG',
    },
    {
      labelKey: 'nav.sync',
      href: '/settings/sync',
      icon: Cloud,
      roles: ['manager', 'engineer', 'superadmin'],
      code: 'SYN',
    },
    {
      labelKey: 'nav.eventLog',
      href: '/event-log',
      icon: ScrollText,
      roles: ['manager', 'engineer', 'superadmin'],
      code: 'LOG',
    },
  ];

  const superAdminItems = [
    {
      labelKey: 'nav.users',
      href: '/super-admin/users',
      icon: Users,
      code: 'USR',
    },
    {
      labelKey: 'nav.roles',
      href: '/super-admin/roles',
      icon: Shield,
      code: 'ROL',
    },
    {
      labelKey: 'nav.permissions',
      href: '/super-admin/permissions',
      icon: Lock,
      code: 'PRM',
    },
  ];

  const isActive = (href) => {
    return pathname.startsWith(href.split('/').slice(0, 3).join('/'));
  };

  // Check if HMI route is active (includes live inspection)
  const isHMIActive = pathname.startsWith('/inspection/live') || 
                      pathname.startsWith('/inspection/select-line');

  const visibleItems = navItems.filter((item) =>
    user && userRole && item.roles.includes(userRole)
  );

  const isSuperAdmin = userRole === 'superadmin';
  const displayRole = userRole ? userRole.toUpperCase() : 'UNKNOWN';

  // Don't render if hidden
  if (isHidden) return null;

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-full bg-panel border-r border-surface-border flex flex-col transition-all duration-300 z-50",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* System Header */}
      <div className="px-3 py-4 border-b border-surface-border bg-terminal">
        {/* Logo */}
        <div className={cn("flex items-center gap-3 mb-4", isCollapsed && "justify-center")}>
          <div className="w-10 h-10 border border-phosphor-amber flex items-center justify-center bg-void relative flex-shrink-0">
            <span className="font-display font-bold text-lg text-phosphor-amber">IN</span>
            <div className="absolute -top-px -right-px w-2 h-2 bg-phosphor-green animate-pulse-glow" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-display font-bold text-xl tracking-wider text-text-primary">
                INDUSIA
              </h1>
              <p className="font-mono text-xxs text-phosphor-amber tracking-widest">
                HMI CONSOLE
              </p>
            </div>
          )}
        </div>

        {/* System Status - only show when expanded */}
        {!isCollapsed && (
          <div className="bg-void border border-surface-border p-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-phosphor-green" />
                <span className="font-mono text-xxs text-phosphor-green">SYSTEM OK</span>
              </div>
              <span className="font-mono text-xxs text-text-tertiary">{currentTime}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xxs text-text-tertiary">UPTIME</span>
              <span className="font-mono text-xxs text-phosphor-amber">{systemUptime}</span>
            </div>
          </div>
        )}

        {/* Collapse Toggle Button */}
        <button
          onClick={toggleCollapse}
          className={cn(
            "mt-3 w-full py-2 flex items-center justify-center gap-2 border border-surface-border bg-void",
            "hover:border-phosphor-amber hover:text-phosphor-amber transition-colors",
            "text-text-tertiary"
          )}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? (
            <PanelLeft className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span className="font-mono text-xxs">COLLAPSE</span>
            </>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-brutalist">
        {/* Section Label */}
        {!isCollapsed && (
          <div className="px-4 mb-2">
            <div className="flex items-center gap-2">
              <Radio className="w-3 h-3 text-phosphor-amber" />
              <span className="font-display text-xxs font-semibold tracking-widest text-phosphor-amber">
                NAVIGATION
              </span>
            </div>
          </div>
        )}

        {/* Nav Items */}
        <div className="space-y-0.5 px-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = item.isHMI ? isHMIActive : isActive(item.href);
            
            // Check if this is HMI item with active session
            const isHMIWithSession = item.isHMI && isOperator && hasActiveLine;

            // Render HMI item with special handling
            if (item.isHMI) {
              return (
                <button
                  key={item.href}
                  onClick={handleHMIClick}
                  title={isCollapsed ? t(item.labelKey) : undefined}
                  className={cn(
                    "group w-full flex items-center gap-3 px-3 py-2.5 border-l-2 transition-all duration-150 text-left relative",
                    isCollapsed && "justify-center px-2",
                    active
                      ? isHMIWithSession 
                        ? 'bg-phosphor-green/10 border-phosphor-green text-phosphor-green'
                        : 'bg-phosphor-amber/10 border-phosphor-amber text-phosphor-amber'
                      : 'border-transparent text-text-secondary hover:text-phosphor-amber hover:bg-phosphor-amber/5 hover:border-phosphor-amber/50'
                  )}
                >
                  {/* Code badge - hide when collapsed */}
                  {!isCollapsed && (
                    <span className={cn(
                      "font-mono text-xxs px-1.5 py-0.5 border",
                      active
                        ? isHMIWithSession
                          ? 'border-phosphor-green/50 bg-phosphor-green/20 text-phosphor-green'
                          : 'border-phosphor-amber/50 bg-phosphor-amber/20 text-phosphor-amber'
                        : 'border-surface-border bg-void text-text-tertiary group-hover:border-phosphor-amber/30 group-hover:text-phosphor-amber'
                    )}>
                      {item.code}
                    </span>
                  )}

                  {/* Icon */}
                  <Icon className="w-4 h-4 flex-shrink-0" />

                  {/* Label - hide when collapsed */}
                  {!isCollapsed && (
                    <>
                      <span className="font-display text-sm tracking-wide flex-1">
                        {t(item.labelKey)}
                      </span>
                      
                      {/* Active session indicator */}
                      {isHMIWithSession && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-phosphor-green animate-pulse rounded-full" />
                          <span className="font-mono text-xxs text-phosphor-green">ACTIVE</span>
                        </div>
                      )}
                      
                      {active && !isHMIWithSession && <ChevronRight className="w-3 h-3 opacity-60" />}
                    </>
                  )}
                  
                  {/* Collapsed active indicator */}
                  {isCollapsed && isHMIWithSession && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-phosphor-green animate-pulse rounded-full" />
                  )}
                </button>
              );
            }

            // Regular nav item
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? t(item.labelKey) : undefined}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 border-l-2 transition-all duration-150",
                  isCollapsed && "justify-center px-2",
                  active
                    ? 'bg-phosphor-amber/10 border-phosphor-amber text-phosphor-amber'
                    : 'border-transparent text-text-secondary hover:text-phosphor-amber hover:bg-phosphor-amber/5 hover:border-phosphor-amber/50'
                )}
              >
                {/* Code badge - hide when collapsed */}
                {!isCollapsed && (
                  <span className={cn(
                    "font-mono text-xxs px-1.5 py-0.5 border",
                    active
                      ? 'border-phosphor-amber/50 bg-phosphor-amber/20 text-phosphor-amber'
                      : 'border-surface-border bg-void text-text-tertiary group-hover:border-phosphor-amber/30 group-hover:text-phosphor-amber'
                  )}>
                    {item.code}
                  </span>
                )}

                {/* Icon */}
                <Icon className="w-4 h-4 flex-shrink-0" />

                {/* Label - hide when collapsed */}
                {!isCollapsed && (
                  <>
                    <span className="font-display text-sm tracking-wide flex-1">
                      {t(item.labelKey)}
                    </span>
                    {active && <ChevronRight className="w-3 h-3 opacity-60" />}
                  </>
                )}
              </Link>
            );
          })}
        </div>

        {/* Super Admin Section */}
        {isSuperAdmin && (
          <>
            <div className={cn("my-4 mx-4 divider-technical", isCollapsed && "mx-2")} />

            {!isCollapsed && (
              <div className="px-4 mb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-3 h-3 text-phosphor-red" />
                  <span className="font-display text-xxs font-semibold tracking-widest text-phosphor-red">
                    {t('admin.panel')}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-0.5 px-2">
              {superAdminItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={isCollapsed ? t(item.labelKey) : undefined}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2.5 border-l-2 transition-all duration-150",
                      isCollapsed && "justify-center px-2",
                      active
                        ? 'bg-phosphor-red/10 border-phosphor-red text-phosphor-red'
                        : 'border-transparent text-text-secondary hover:text-phosphor-red hover:bg-phosphor-red/5 hover:border-phosphor-red/50'
                    )}
                  >
                    {!isCollapsed && (
                      <span className={cn(
                        "font-mono text-xxs px-1.5 py-0.5 border",
                        active
                          ? 'border-phosphor-red/50 bg-phosphor-red/20 text-phosphor-red'
                          : 'border-surface-border bg-void text-text-tertiary group-hover:border-phosphor-red/30 group-hover:text-phosphor-red'
                      )}>
                        {item.code}
                      </span>
                    )}
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="font-display text-sm tracking-wide flex-1">
                          {t(item.labelKey)}
                        </span>
                        {active && <ChevronRight className="w-3 h-3 opacity-60" />}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* Active Session Banner - show when operator has active line */}
      {isOperator && hasActiveLine && !isCollapsed && (
        <div className="mx-2 mb-2 p-3 bg-phosphor-green/10 border border-phosphor-green/30">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-phosphor-green" />
            <span className="font-display text-xs font-bold text-phosphor-green">
              SESSION ACTIVE
            </span>
          </div>
          <p className="font-mono text-xs text-text-secondary">
            {activeLineName || `Line ${activeLineId}`}
          </p>
        </div>
      )}

      {/* User Panel */}
      {user && (
        <div className="border-t border-surface-border bg-terminal">
          {/* User Info */}
          <div className={cn("px-4 py-3 border-b border-surface-border", isCollapsed && "px-2")}>
            <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
              {/* Avatar */}
              <div className="w-8 h-8 border border-phosphor-amber/50 bg-void flex items-center justify-center flex-shrink-0">
                <span className="font-mono text-xs text-phosphor-amber">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>

              {/* Details - hide when collapsed */}
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm text-text-primary truncate">
                    {user.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-amber">
                      {displayRole}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* System Info - hide when collapsed */}
          {!isCollapsed && (
            <div className="px-4 py-3">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-void border border-surface-border p-2">
                  <p className="font-mono text-xxs text-text-tertiary">VERSION</p>
                  <p className="font-mono text-xs text-phosphor-amber">v1.0.0</p>
                </div>
                <div className="bg-void border border-surface-border p-2">
                  <p className="font-mono text-xxs text-text-tertiary">BUILD</p>
                  <p className="font-mono text-xs text-phosphor-amber">2024.01</p>
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={logout}
                className="w-full py-2 btn-ghost font-display text-xs tracking-widest hover:border-phosphor-red hover:text-phosphor-red"
              >
                TERMINATE SESSION
              </button>
            </div>
          )}

          {/* Collapsed logout button */}
          {isCollapsed && (
            <div className="px-2 py-3">
              <button
                onClick={logout}
                className="w-full py-2 btn-ghost font-display text-xs hover:border-phosphor-red hover:text-phosphor-red"
                title="Logout"
              >
                <ChevronLeft className="w-4 h-4 mx-auto" />
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
