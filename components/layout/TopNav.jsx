'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, User, HelpCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useHelpOverlay } from '@/hooks/useHelpOverlay';
import { useI18n } from '@/hooks/useI18n';
import { customers, lines } from '@/data/masterData';
import StatusBadge from '../common/StatusBadge';
import NotificationBell from '../notifications/NotificationBell';
import LanguageSwitcher from '../common/LanguageSwitcher';
import { SyncIndicator } from '../sync';

export default function TopNav() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { openHelp } = useHelpOverlay();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const customer = useMemo(() => {
    if (!user?.selectedCustomerId) return null;
    return customers.find((c) => c.id === user.selectedCustomerId);
  }, [user?.selectedCustomerId]);

  const line = useMemo(() => {
    if (!user?.selectedLineId) return null;
    return lines.find((l) => l.id === user.selectedLineId);
  }, [user?.selectedLineId]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 bg-indusia-surface/95 backdrop-blur-sm border-b border-indusia-border">
      <div className="flex items-center justify-between px-8 py-4">
        <div>
          <h2 className="text-xl font-semibold text-indusia-text">
            {t('app.name')}
          </h2>
        </div>

        <div className="flex items-center gap-6">
          {user && (user.role === 'operator' || user.role === 'manager') && customer && line && (
            <div className="text-right">
              <p className="text-xs text-indusia-textMuted leading-tight">
                <span className="font-medium">{customer.name}</span>
                {' • '}
                <span>{line.name}</span>
              </p>
            </div>
          )}

          {user && user.role === 'engineer' && (
            <div className="text-right">
              <p className="text-xs text-indusia-textMuted">
                {t('auth.engineeringMode')}
              </p>
            </div>
          )}

          <StatusBadge status="pass" label={t('auth.online')} />

          <SyncIndicator />

          <NotificationBell />

          <LanguageSwitcher />

          <button
            onClick={() => openHelp('shortcuts')}
            className="p-2 rounded-lg text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-bg transition-colors"
            title={t('nav.help')}
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-3 px-4 py-2 rounded-lg bg-indusia-surfaceMuted hover:bg-indusia-border transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-indusia-primary flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-indusia-text">
                  {user.name}
                </p>
                <p className="text-xs text-indusia-textMuted capitalize">
                  {user.role}
                </p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-indusia-textMuted transition-transform ${
                  menuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-indusia-surface rounded-lg shadow-xl border border-indusia-border overflow-hidden z-[70]">
                <div className="px-4 py-3 border-b border-indusia-border">
                  <p className="text-sm font-medium text-indusia-text">
                    {user.name}
                  </p>
                  <p className="text-xs text-indusia-textMuted mt-1 capitalize">
                    {user.role}
                  </p>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-indusia-surfaceMuted transition-colors text-left"
                >
                  <LogOut className="w-4 h-4 text-indusia-textMuted" />
                  <span className="text-sm text-indusia-text">{t('auth.logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
