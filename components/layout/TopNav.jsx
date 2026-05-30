'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, User, HelpCircle, Cloud, Sun, Moon, KeyRound, Camera, Building2, Trash2 } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useHelpOverlay } from '@/hooks/useHelpOverlay';
import { useI18n } from '@/hooks/useI18n';
import { useSystemHealthContext } from '@/context/SystemHealthContext';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { authFetch } from '@/lib/utils/authFetch';
import { customers, lines } from '@/data/masterData';
import NotificationBell from '../notifications/NotificationBell';
import LanguageSwitcher from '../common/LanguageSwitcher';
import ChangePasswordModal from '../common/ChangePasswordModal';
import CompanyProfileModal from '../common/CompanyProfileModal';

export default function TopNav() {
  const router = useRouter();
  const { user, logout, isSuperAdmin } = useAuth();
  const { openHelp } = useHelpOverlay();
  const { t } = useI18n();
  const { isDark, toggleTheme } = useTheme();
  const { statuses } = useSystemHealthContext();
  const { companyLogo, companyName } = useSystemSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [companyProfileOpen, setCompanyProfileOpen] = useState(false);
  const [userAvatar, setUserAvatar] = useState(null);
  const photoInputRef = useRef(null);
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

  // Fetch user avatar on mount
  useEffect(() => {
    if (!user?.id) return;
    authFetch(`/api/users/${user.id}`)
      .then(res => res.json())
      .then(json => {
        if (json.success && (json.data?.avatarBase64 || json.data?.avatar_base64)) {
          setUserAvatar(json.data.avatarBase64 || json.data.avatar_base64);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  // Handle user photo file selection (non-superadmin)
  const handlePhotoSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 200 * 1024) {
      alert(t('profile.fileTooLarge'));
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert(t('profile.invalidFormat'));
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      try {
        const res = await authFetch('/api/users/me/avatar', {
          method: 'PUT',
          body: JSON.stringify({ avatar_base64: base64 }),
        });
        const json = await res.json();
        if (json.success) {
          setUserAvatar(base64);
        } else {
          alert(json.error || 'Failed');
        }
      } catch (err) {
        alert(err.message);
      }
    };
    reader.readAsDataURL(file);
  }, [t]);

  // Handle remove user photo (non-superadmin)
  const handleRemovePhoto = useCallback(async () => {
    try {
      const res = await authFetch('/api/users/me/avatar', { method: 'DELETE' });
      const json = await res.json();
      if (json.success) setUserAvatar(null);
    } catch (_) {}
  }, []);

  // Determine which image to show: personal avatar first, then company logo as fallback
  const avatarImage = userAvatar || companyLogo;
  const isCompanyLogo = !userAvatar && !!companyLogo;

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
              <div className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden ${isCompanyLogo ? 'bg-white p-0.5' : 'bg-indusia-primary'}`}>
                {avatarImage ? (
                  <img src={avatarImage} alt="" className={`w-full h-full ${isCompanyLogo ? 'object-contain' : 'object-cover'}`} />
                ) : (
                  <User className="w-4 h-4 text-white" />
                )}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-indusia-text">
                  {user.name}
                </p>
                <p className="text-xs text-indusia-textMuted capitalize">
                  {companyName || user.role}
                </p>
              </div>
              {companyLogo && userAvatar && (
                <div className="w-6 h-6 rounded bg-white p-0.5 flex items-center justify-center shrink-0 ml-1">
                  <img src={companyLogo} alt="" className="w-full h-full object-contain" />
                </div>
              )}
              <ChevronDown
                className={`w-4 h-4 text-indusia-textMuted transition-transform ${
                  menuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-indusia-surface rounded-lg shadow-xl border border-indusia-border overflow-hidden z-[70]">
                {/* Profile header — same design for ALL roles */}
                <div className="px-4 py-3 border-b border-indusia-border">
                  <div className="flex items-center gap-3">
                    <div className="relative group shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden ${isCompanyLogo ? 'bg-white p-1' : 'bg-indusia-primary'}`}>
                        {avatarImage ? (
                          <img src={avatarImage} alt="" className={`w-full h-full ${isCompanyLogo ? 'object-contain' : 'object-cover'}`} />
                        ) : (
                          <User className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); photoInputRef.current?.click(); }}
                        className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title={userAvatar ? t('profile.changePhoto') : t('profile.uploadPhoto')}
                      >
                        <Camera className="w-4 h-4 text-white" />
                      </button>
                      {userAvatar && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRemovePhoto(); }}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title={t('profile.removePhoto')}
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-indusia-text truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-indusia-textMuted capitalize">
                        {user.role}
                      </p>
                      {companyName && (
                        <p className="text-[10px] text-phosphor-teal/70 mt-0.5 truncate">
                          {companyName}
                        </p>
                      )}
                      <p className="text-[10px] text-indusia-textMuted mt-0.5">
                        {userAvatar ? t('profile.changePhoto') : t('profile.uploadPhoto')}
                      </p>
                    </div>
                  </div>
                  {/* Hidden file input for photo upload */}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </div>

                <div className="px-4 py-3 border-b border-indusia-border">
                  <LanguageSwitcher />
                </div>

                {/* Super admin: Company Profile menu item */}
                {isSuperAdmin && (
                  <button
                    onClick={() => { setCompanyProfileOpen(true); setMenuOpen(false); }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-indusia-surfaceMuted transition-colors text-left border-b border-indusia-border"
                  >
                    <Building2 className="w-4 h-4 text-indusia-textMuted" />
                    <span className="text-sm text-indusia-text">{t('profile.companyProfile')}</span>
                  </button>
                )}

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

                {/* Company branding footer — visible to ALL roles */}
                {companyName && (
                  <div className="px-4 py-2 border-t border-indusia-border bg-indusia-bg/50 flex items-center gap-2">
                    {companyLogo && (
                      <div className="w-5 h-5 rounded bg-white p-0.5 flex items-center justify-center shrink-0">
                        <img src={companyLogo} alt="" className="w-full h-full object-contain" />
                      </div>
                    )}
                    <span className="text-[10px] text-indusia-textMuted font-mono truncate">{companyName}</span>
                  </div>
                )}
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

    {isSuperAdmin && (
      <CompanyProfileModal
        isOpen={companyProfileOpen}
        onClose={() => setCompanyProfileOpen(false)}
      />
    )}
    </>
  );
}
