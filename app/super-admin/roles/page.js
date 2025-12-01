'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useRoles } from '@/hooks/useRoles';
import { useUsers } from '@/hooks/useUsers';
import { useToast } from '@/hooks/useToast';
import SectionHeader from '@/components/common/SectionHeader';
import StatusBadge from '@/components/common/StatusBadge';
import { Plus, Edit, Trash2, Shield } from 'lucide-react';

export default function RolesManagementPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { roles } = useRoles();
  const { users } = useUsers();

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

  const getUserCount = (roleId) => users.filter(u => u.role === roleId).length;

  return (
    <div>
      <SectionHeader title="Role Management" description="Manage system roles and their definitions" />

      <div className="bg-indusia-surface rounded-lg border border-indusia-border overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-indusia-border bg-indusia-surfaceMuted">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Role</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Description</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Users</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Type</th>
            </tr>
          </thead>
          <tbody>
            {roles.map(role => (
              <tr key={role.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indusia-primary" />
                    <span className="text-sm font-medium text-indusia-text">{role.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-indusia-textMuted">{role.description}</td>
                <td className="px-6 py-4 text-sm text-indusia-text">{getUserCount(role.id)}</td>
                <td className="px-6 py-4">
                  <StatusBadge status={role.isSystem ? 'warning' : 'pass'} label={role.isSystem ? 'System' : 'Custom'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
