'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  AlertCircle,
  Cloud,
  Database,
  Shield,
  Users,
  Lock,
  ScrollText,
  Monitor,
  ChevronRight,
  Activity,
  Cpu,
  Radio
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';

/**
 * Extract simple role name from various formats
 */
function normalizeRole(roleValue) {
  if (!roleValue) return null;
  return roleValue.replace(/^role_/i, '').toLowerCase();
}

export default function SideNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useI18n();
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

  const navItems = [
    {
      labelKey: 'nav.hmi',
      href: '/inspection/result/current',
      icon: ClipboardCheck,
      roles: ['operator', 'manager', 'superadmin'],
      code: 'INS',
    },
    {
      labelKey: 'nav.operatorView',
      href: '/inspection/operator',
      icon: Monitor,
      roles: ['operator', 'manager', 'engineer', 'superadmin'],
      code: 'OPR',
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

  const visibleItems = navItems.filter((item) =>
    user && userRole && item.roles.includes(userRole)
  );

  const isSuperAdmin = userRole === 'superadmin';
  const displayRole = userRole ? userRole.toUpperCase() : 'UNKNOWN';

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-panel border-r border-surface-border flex flex-col">
      {/* System Header */}
      <div className="px-4 py-4 border-b border-surface-border bg-terminal">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 border border-phosphor-amber flex items-center justify-center bg-void relative">
            <span className="font-display font-bold text-lg text-phosphor-amber">IN</span>
            <div className="absolute -top-px -right-px w-2 h-2 bg-phosphor-green animate-pulse-glow" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl tracking-wider text-text-primary">
              INDUSIA
            </h1>
            <p className="font-mono text-xxs text-phosphor-amber tracking-widest">
              HMI CONSOLE
            </p>
          </div>
        </div>

        {/* System Status */}
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
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-brutalist">
        {/* Section Label */}
        <div className="px-4 mb-2">
          <div className="flex items-center gap-2">
            <Radio className="w-3 h-3 text-phosphor-amber" />
            <span className="font-display text-xxs font-semibold tracking-widest text-phosphor-amber">
              NAVIGATION
            </span>
          </div>
        </div>

        {/* Nav Items */}
        <div className="space-y-0.5 px-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  group flex items-center gap-3 px-3 py-2.5 border-l-2 transition-all duration-150
                  ${
                    active
                      ? 'bg-phosphor-amber/10 border-phosphor-amber text-phosphor-amber'
                      : 'border-transparent text-text-secondary hover:text-phosphor-amber hover:bg-phosphor-amber/5 hover:border-phosphor-amber/50'
                  }
                `}
              >
                {/* Code badge */}
                <span className={`
                  font-mono text-xxs px-1.5 py-0.5 border
                  ${active
                    ? 'border-phosphor-amber/50 bg-phosphor-amber/20 text-phosphor-amber'
                    : 'border-surface-border bg-void text-text-tertiary group-hover:border-phosphor-amber/30 group-hover:text-phosphor-amber'
                  }
                `}>
                  {item.code}
                </span>

                {/* Icon */}
                <Icon className="w-4 h-4 flex-shrink-0" />

                {/* Label */}
                <span className="font-display text-sm tracking-wide flex-1">
                  {t(item.labelKey)}
                </span>

                {/* Active indicator */}
                {active && (
                  <ChevronRight className="w-3 h-3 opacity-60" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Super Admin Section */}
        {isSuperAdmin && (
          <>
            <div className="my-4 mx-4 divider-technical" />

            <div className="px-4 mb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-3 h-3 text-phosphor-red" />
                <span className="font-display text-xxs font-semibold tracking-widest text-phosphor-red">
                  {t('admin.panel')}
                </span>
              </div>
            </div>

            <div className="space-y-0.5 px-2">
              {superAdminItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      group flex items-center gap-3 px-3 py-2.5 border-l-2 transition-all duration-150
                      ${
                        active
                          ? 'bg-phosphor-red/10 border-phosphor-red text-phosphor-red'
                          : 'border-transparent text-text-secondary hover:text-phosphor-red hover:bg-phosphor-red/5 hover:border-phosphor-red/50'
                      }
                    `}
                  >
                    <span className={`
                      font-mono text-xxs px-1.5 py-0.5 border
                      ${active
                        ? 'border-phosphor-red/50 bg-phosphor-red/20 text-phosphor-red'
                        : 'border-surface-border bg-void text-text-tertiary group-hover:border-phosphor-red/30 group-hover:text-phosphor-red'
                      }
                    `}>
                      {item.code}
                    </span>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="font-display text-sm tracking-wide flex-1">
                      {t(item.labelKey)}
                    </span>
                    {active && (
                      <ChevronRight className="w-3 h-3 opacity-60" />
                    )}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* User Panel */}
      {user && (
        <div className="border-t border-surface-border bg-terminal">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-surface-border">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-8 h-8 border border-phosphor-amber/50 bg-void flex items-center justify-center">
                <span className="font-mono text-xs text-phosphor-amber">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>

              {/* Details */}
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
            </div>
          </div>

          {/* System Info */}
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
        </div>
      )}
    </aside>
  );
}
