'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/useToast';
import { useI18n } from '@/context/I18nContext';
import SectionHeader from '@/components/common/SectionHeader';
import { Lock, Unlock, Loader2, AlertTriangle } from 'lucide-react';
import PageLoading from '@/components/common/PageLoading';

export default function PermissionsManagementPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const {
    roles,
    menuItems,
    loading,
    error,
    hasPermission,
    togglePermission,
  } = usePermissions();
  const { t } = useI18n();

  if (!user || user.role !== 'superadmin') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">{t('auth.accessDenied')}</h2>
          <p className="text-sm text-indusia-textMuted mb-6">{t('admin.onlySuperAdmin')}</p>
          <button onClick={() => router.back()} className="px-6 py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity">{t('buttons.goBack')}</button>
        </div>
      </div>
    );
  }

  const handleToggle = async (roleId, menuId) => {
    try {
      await togglePermission(roleId, menuId);
    } catch {
      showToast(t('admin.failedToUpdate'));
    }
  };

  if (loading) {
    return (
      <div>
        <SectionHeader title={t('admin.permissionsMatrix')} description={t('admin.permissionsMatrixDesc')} />
        <PageLoading message={t('admin.loadingPermissions')} compact />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title={t('admin.permissionsMatrix')} description={t('admin.permissionsMatrixDesc')} />
        <div className="bg-phosphor-red/10 border border-phosphor-red/30 rounded-lg px-4 py-3 mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-phosphor-red flex-shrink-0" />
          <p className="text-sm text-text-primary">{t('admin.failedToLoadPermissions')}: {error}</p>
        </div>
      </div>
    );
  }

  // Order roles with superadmin at the end
  const displayRoles = roles.filter(r => r.id !== 'role_superadmin');
  const superAdminRole = roles.find(r => r.id === 'role_superadmin');
  const orderedRoles = [...displayRoles, ...(superAdminRole ? [superAdminRole] : [])];

  // Hide menu items that don't have corresponding pages yet
  const hiddenMenuNames = ['Datasets', 'Engineering Console', 'Event Log', 'Reports', 'System Health', 'System Settings', 'Training'];
  const visibleMenuItems = menuItems.filter(item => !hiddenMenuNames.includes(item.name));

  return (
    <div>
      <SectionHeader title={t('admin.permissionsMatrix')} description={t('admin.permissionsMatrixDesc')} />

      <p className="text-xs text-text-tertiary mb-4 font-mono">
        {t('admin.changesSavedAuto')}
      </p>

      <div className="bg-indusia-surface rounded-lg border border-indusia-border overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-indusia-border bg-indusia-surfaceMuted">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase sticky left-0 bg-indusia-surfaceMuted">{t('admin.menuItem')}</th>
              {orderedRoles.map(role => (
                <th key={role.id} className="text-center px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">
                  {role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleMenuItems.map(menuItem => (
              <tr key={menuItem.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-indusia-text sticky left-0 bg-indusia-surface">
                  {menuItem.name}
                </td>
                {orderedRoles.map(role => {
                  const hasAccess = hasPermission(role.id, menuItem.id);

                  return (
                    <td key={role.id} className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggle(role.id, menuItem.id)}
                        className="p-2 rounded-lg transition-colors hover:bg-indusia-surfaceMuted"
                        title={hasAccess ? t('admin.clickToRevoke') : t('admin.clickToGrant')}
                      >
                        {hasAccess ? (
                          <Unlock className="w-5 h-5 text-indusia-pass" />
                        ) : (
                          <Lock className="w-5 h-5 text-indusia-textMuted" />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-indusia-surfaceMuted rounded-lg border border-indusia-border p-4">
        <h4 className="text-sm font-semibold text-indusia-text mb-2">{t('admin.legend')}</h4>
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <Unlock className="w-4 h-4 text-indusia-pass" />
            <span className="text-indusia-textMuted">{t('admin.accessGranted')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-indusia-textMuted" />
            <span className="text-indusia-textMuted">{t('admin.accessDeniedLabel')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
