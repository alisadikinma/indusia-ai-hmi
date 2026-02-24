'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, User, HelpCircle, Cloud, Sun, Moon, KeyRound } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useHelpOverlay } from '@/hooks/useHelpOverlay';
import { useI18n } from '@/hooks/useI18n';
import { useSystemHealthContext } from '@/context/SystemHealthContext';
import { customers, lines } from '@/data/masterData';
import NotificationBell from '../notifications/NotificationBell';
import LanguageSwitcher from '../common/LanguageSwitcher';
import ChangePasswordModal from '../common/ChangePasswordModal';

export default function TopNav() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { openHelp } = useHelpOverlay();
  const { t } = useI18n();
  const { isDark, toggleTheme } = useTheme();
  const { statuses } = useSystemHealthContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const menuRef = useRef(null);

  // Use sync data from SystemHealthContext (no separate API call needed)
  const lastSync = statuses?.lastSync?.lastUpdated && statuses.lastSync.state !== 'unknown'
    ? statuses.lastSync.lastUpdated
    : null;

  // Format timestamp for display
  const formatSyncTime = (timestamp) => {
    if (!timestamp) return t('time.never');
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return t('time.justNow');
    if (diffMins < 60) return t('time.minutesAgoShort', { n: diffMins });
    if (diffHours < 24) return t('time.hoursAgoShort', { n: diffHours });

    // Show date if older than 24h
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
    <>
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

          {/* Last Sync Indicator */}
          <button
            onClick={() => router.push('/settings/sync')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indusia-bg hover:bg-indusia-border transition-colors cursor-pointer"
            title={lastSync ? t('header.lastSyncedTitle', { time: new Date(lastSync).toLocaleString() }) : t('header.noSyncYet')}
          >
            <Cloud className={`w-4 h-4 ${lastSync ? 'text-indusia-pass' : 'text-indusia-textMuted'}`} />
            <span className="text-xs font-medium text-indusia-textMuted">
              {t('header.syncLabel')} <span className={lastSync ? 'text-indusia-text' : 'text-indusia-warning'}>{formatSyncTime(lastSync)}</span>
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-indusia-surfaceMuted hover:bg-indusia-border transition-colors text-indusia-textMuted hover:text-indusia-text"
            title={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notification Bell - next to user profile */}
          <NotificationBell />

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

                <div className="px-4 py-3 border-b border-indusia-border">
                  <LanguageSwitcher />
                </div>

                <button
                  onClick={() => { toggleTheme(); setMenuOpen(false); }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-indusia-surfaceMuted transition-colors text-left border-b border-indusia-border"
                >
                  {isDark ? <Sun className="w-4 h-4 text-indusia-textMuted" /> : <Moon className="w-4 h-4 text-indusia-textMuted" />}
                  <span className="text-sm text-indusia-text">
                    {isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
                  </span>
                </button>

                <button
                  onClick={() => { setPasswordModalOpen(true); setMenuOpen(false); }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-indusia-surfaceMuted transition-colors text-left border-b border-indusia-border"
                >
                  <KeyRound className="w-4 h-4 text-indusia-textMuted" />
                  <span className="text-sm text-indusia-text">{t('password.changePassword')}</span>
                </button>

                <button
                  onClick={() => { openHelp('shortcuts'); setMenuOpen(false); }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-indusia-surfaceMuted transition-colors text-left border-b border-indusia-border"
                >
                  <HelpCircle className="w-4 h-4 text-indusia-textMuted" />
                  <span className="text-sm text-indusia-text">{t('nav.help')}</span>
                </button>

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

    <ChangePasswordModal
      isOpen={passwordModalOpen}
      onClose={() => setPasswordModalOpen(false)}
    />
    </>
  );
}
