'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/useToast';
import { roles } from '@/data/masterData';
import SectionHeader from '@/components/common/SectionHeader';
import { Lock, Unlock, Save } from 'lucide-react';

export default function PermissionsManagementPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions, getMenuItems, hasPermission, togglePermission } = usePermissions();

  const [hasChanges, setHasChanges] = useState(false);

  if (!user || user.role !== 'superadmin') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">Access Denied</h2>
          <p className="text-sm text-indusia-textMuted mb-6">Only super admins can access this page.</p>
          <button onClick={() => router.back()} className="px-6 py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity">Go Back</button>
        </div>
      </div>
    );
  }

  const menuItems = getMenuItems();

  const handleToggle = (roleId, menuId) => {
    if (roleId === 'superadmin') {
      showToast('Super Admin permissions cannot be modified');
      return;
    }
    togglePermission(roleId, menuId);
    setHasChanges(true);
  };

  const handleSave = () => {
    showToast('Permissions saved successfully');
    setHasChanges(false);
  };

  return (
    <div>
      <SectionHeader title="Permissions Matrix" description="Configure menu access permissions per role" />

      {hasChanges && (
        <div className="bg-indusia-primary/10 border border-indusia-primary rounded-lg px-4 py-3 mb-6 flex items-center justify-between">
          <p className="text-sm text-indusia-text">You have unsaved changes</p>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      )}

      <div className="bg-indusia-surface rounded-lg border border-indusia-border overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-indusia-border bg-indusia-surfaceMuted">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase sticky left-0 bg-indusia-surfaceMuted">Menu Item</th>
              {roles.map(role => (
                <th key={role.id} className="text-center px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">
                  {role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {menuItems.map(menuItem => (
              <tr key={menuItem.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-indusia-text sticky left-0 bg-indusia-surface">
                  {menuItem.name}
                </td>
                {roles.map(role => {
                  const hasAccess = hasPermission(role.id, menuItem.id);
                  const isSuperAdmin = role.id === 'superadmin';

                  return (
                    <td key={role.id} className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggle(role.id, menuItem.id)}
                        disabled={isSuperAdmin}
                        className={`p-2 rounded-lg transition-colors ${
                          isSuperAdmin
                            ? 'cursor-not-allowed opacity-50'
                            : 'hover:bg-indusia-surfaceMuted'
                        }`}
                        title={isSuperAdmin ? 'Super Admin permissions are locked' : hasAccess ? 'Click to revoke' : 'Click to grant'}
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
        <h4 className="text-sm font-semibold text-indusia-text mb-2">Legend</h4>
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <Unlock className="w-4 h-4 text-indusia-pass" />
            <span className="text-indusia-textMuted">Access Granted</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-indusia-textMuted" />
            <span className="text-indusia-textMuted">Access Denied</span>
          </div>
        </div>
      </div>
    </div>
  );
}
