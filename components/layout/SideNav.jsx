'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck, AlertCircle, Cloud, Database, Shield, Users, Lock, ScrollText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/hooks/useI18n';

/**
 * Extract simple role name from various formats
 * - 'superadmin' -> 'superadmin'
 * - 'role_superadmin' -> 'superadmin'
 * - 'Role_superadmin' -> 'superadmin'
 */
function normalizeRole(roleValue) {
  if (!roleValue) return null;
  // Remove 'role_' or 'Role_' prefix if present
  return roleValue.replace(/^role_/i, '').toLowerCase();
}

export default function SideNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useI18n();

  // Get normalized role - prefer 'role' field, fallback to role_id/roleId
  const userRole = normalizeRole(user?.role || user?.roleId || user?.role_id);

  // DEBUG: Log user data
  console.log('[SideNav] user:', user);
  console.log('[SideNav] normalized role:', userRole);

  const navItems = [
    {
      labelKey: 'nav.hmi',
      href: '/inspection/result/current',
      icon: ClipboardCheck,
      roles: ['operator', 'manager', 'superadmin'],
    },
    {
      labelKey: 'nav.managerQueue',
      href: '/inspection/overrides',
      icon: AlertCircle,
      roles: ['manager', 'superadmin'],
    },
    {
      labelKey: 'nav.masterData',
      href: '/engineering/master-data',
      icon: Database,
      roles: ['engineer', 'superadmin'],
    },
    {
      labelKey: 'nav.sync',
      href: '/settings/sync',
      icon: Cloud,
      roles: ['manager', 'engineer', 'superadmin'],
    },
    {
      labelKey: 'nav.eventLog',
      href: '/event-log',
      icon: ScrollText,
      roles: ['manager', 'engineer', 'superadmin'],
    },
  ];

  const superAdminItems = [
    {
      labelKey: 'nav.users',
      href: '/super-admin/users',
      icon: Users,
    },
    {
      labelKey: 'nav.roles',
      href: '/super-admin/roles',
      icon: Shield,
    },
    {
      labelKey: 'nav.permissions',
      href: '/super-admin/permissions',
      icon: Lock,
    },
  ];

  const isActive = (href) => {
    return pathname.startsWith(href.split('/').slice(0, 3).join('/'));
  };

  const visibleItems = navItems.filter((item) =>
    user && userRole && item.roles.includes(userRole)
  );

  const isSuperAdmin = userRole === 'superadmin';

  // Format role for display (capitalize first letter)
  const displayRole = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'Unknown';

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-indusia-surface border-r border-indusia-border flex flex-col">
      <div className="px-6 py-8 border-b border-indusia-border">
        <h1 className="text-2xl font-bold text-indusia-primary tracking-tight">
          INDUSIA AI
        </h1>
        <p className="text-xs text-indusia-textMuted mt-1">
          Visual Inspection HMI
        </p>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg
                transition-all duration-200
                ${
                  active
                    ? 'bg-indusia-bg border-l-4 border-indusia-primary text-indusia-text font-medium'
                    : 'text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-bg/50'
                }
              `}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{t(item.labelKey)}</span>
            </Link>
          );
        })}

        {isSuperAdmin && (
          <>
            <div className="px-4 py-2 mt-6">
              <p className="text-xs font-semibold text-indusia-textMuted uppercase tracking-wide">
                {t('admin.panel')}
              </p>
            </div>
            {superAdminItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${
                      active
                        ? 'bg-indusia-bg border-l-4 border-indusia-primary text-indusia-text font-medium'
                        : 'text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-bg/50'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {user && (
        <div className="px-6 py-4 border-t border-indusia-border space-y-2">
          <p className="text-xs text-indusia-textMuted">
            Signed in as: <span className="text-indusia-text font-medium">{user.name}</span>
          </p>
          <p className="text-xs text-indusia-textMuted">
            Role: <span className="text-indusia-text font-medium">{displayRole}</span>
          </p>
          <p className="text-xs text-indusia-textMuted mt-3 pt-3 border-t border-indusia-border">
            Version 1.0.0
          </p>
        </div>
      )}
    </aside>
  );
}
