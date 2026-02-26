'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useRoles } from '@/hooks/useRoles';
import { useUsers } from '@/hooks/useUsers';
import { useToast } from '@/hooks/useToast';
import SectionHeader from '@/components/common/SectionHeader';
import StatusBadge from '@/components/common/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Plus, Edit, Trash2, Shield, X, Loader2 } from 'lucide-react';
import PageLoading from '@/components/common/PageLoading';

export default function RolesManagementPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { roles, loading, create, update, remove } = useRoles();
  const { users } = useUsers();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, roleId: null, roleName: '' });

  const [formData, setFormData] = useState({ id: '', name: '', description: '' });
  const [formErrors, setFormErrors] = useState({});

  if (authLoading || loading) return <PageLoading />;

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

  const getUserCount = (roleId) => users.filter(u => u.roleId === roleId).length;

  const resetForm = () => {
    setFormData({ id: '', name: '', description: '' });
    setFormErrors({});
    setSubmitError('');
    setSelectedRole(null);
  };

  const validateForm = (isEdit = false) => {
    const errors = {};
    if (!isEdit) {
      if (!formData.id.trim()) errors.id = 'Role ID is required';
      else if (!/^[a-z0-9-]+$/.test(formData.id)) errors.id = 'Only lowercase letters, numbers, and dashes';
      else if (formData.id.length > 50) errors.id = 'Max 50 characters';
      else if (roles.some(r => r.id === formData.id)) errors.id = 'Role ID already exists';
    }
    if (!formData.name.trim()) errors.name = 'Name is required';
    else if (formData.name.trim().length < 2) errors.name = 'At least 2 characters';
    else if (formData.name.length > 100) errors.name = 'Max 100 characters';
    if (formData.description.length > 500) errors.description = 'Max 500 characters';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (role) => {
    setSelectedRole(role);
    setFormData({ id: role.id, name: role.name, description: role.description || '' });
    setFormErrors({});
    setSubmitError('');
    setIsEditModalOpen(true);
  };

  const handleCreate = async () => {
    if (!validateForm(false)) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      await create({ id: formData.id, name: formData.name.trim(), description: formData.description.trim() || undefined });
      showToast({ title: 'Role created successfully', variant: 'success' });
      setIsAddModalOpen(false);
      resetForm();
    } catch (err) {
      setSubmitError(err.message || 'Failed to create role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!validateForm(true)) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const updates = { name: formData.name.trim() };
      if (formData.description.trim()) updates.description = formData.description.trim();
      await update(selectedRole.id, updates);
      showToast({ title: 'Role updated successfully', variant: 'success' });
      setIsEditModalOpen(false);
      resetForm();
    } catch (err) {
      setSubmitError(err.message || 'Failed to update role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const { roleId } = confirmDialog;
    setConfirmDialog({ isOpen: false, roleId: null, roleName: '' });
    try {
      await remove(roleId);
      showToast({ title: 'Role deleted successfully', variant: 'success' });
    } catch (err) {
      showToast({ title: 'Failed to delete role', description: err.message, variant: 'error' });
    }
  };

  return (
    <div>
      <SectionHeader title="Role Management" description="Manage system roles and their definitions" />

      <div className="bg-indusia-surface rounded-lg border border-indusia-border p-4 mb-6 flex items-center justify-end">
        <button
          onClick={openAddModal}
          className="px-6 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Role
        </button>
      </div>

      <div className="bg-indusia-surface rounded-lg border border-indusia-border overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-indusia-border bg-indusia-surfaceMuted">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Role</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Description</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Users</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Type</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-indusia-textMuted">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Loading roles...
                </td>
              </tr>
            ) : roles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-indusia-textMuted">
                  No roles found. Click "Add Role" to create one.
                </td>
              </tr>
            ) : (
              roles.map(role => {
                const userCount = getUserCount(role.id);
                return (
                  <tr key={role.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-indusia-primary" />
                        <span className="text-sm font-medium text-indusia-text">{role.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-indusia-textMuted">{role.description}</td>
                    <td className="px-6 py-4 text-sm text-indusia-text">{userCount}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={role.isSystem ? 'warning' : 'pass'} label={role.isSystem ? 'System' : 'Custom'} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(role)}
                          className="p-1.5 text-indusia-textMuted hover:text-indusia-primary transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {!role.isSystem && (
                          <button
                            onClick={() => setConfirmDialog({ isOpen: true, roleId: role.id, roleName: role.name })}
                            disabled={userCount > 0}
                            className="p-1.5 text-indusia-textMuted hover:text-indusia-fail transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={userCount > 0 ? `Cannot delete: ${userCount} user(s) assigned` : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setIsAddModalOpen(false); resetForm(); }} />
          <div className="relative bg-indusia-surface rounded-xl shadow-2xl border border-indusia-border w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-indusia-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-indusia-text">Add New Role</h3>
              <button onClick={() => { setIsAddModalOpen(false); resetForm(); }} className="text-indusia-textMuted hover:text-indusia-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-6 space-y-4">
              {submitError && (
                <div className="p-3 rounded-lg bg-indusia-fail/10 border border-indusia-fail text-sm text-indusia-fail">
                  {submitError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Role ID</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="e.g. quality-lead"
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text text-sm focus:outline-none focus:ring-2 focus:ring-indusia-primary font-mono"
                />
                <p className="text-xs text-indusia-textMuted mt-1">Lowercase letters, numbers, and dashes only</p>
                {formErrors.id && <p className="text-xs text-indusia-fail mt-1">{formErrors.id}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Quality Lead"
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text text-sm focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                />
                {formErrors.name && <p className="text-xs text-indusia-fail mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this role's responsibilities..."
                  rows={3}
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text text-sm focus:outline-none focus:ring-2 focus:ring-indusia-primary resize-none"
                />
                {formErrors.description && <p className="text-xs text-indusia-fail mt-1">{formErrors.description}</p>}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-indusia-border flex justify-end gap-3">
              <button onClick={() => { setIsAddModalOpen(false); resetForm(); }} className="px-4 py-2 text-sm font-medium text-indusia-textMuted hover:text-indusia-text">Cancel</button>
              <button onClick={handleCreate} disabled={submitting} className="px-6 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Role
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setIsEditModalOpen(false); resetForm(); }} />
          <div className="relative bg-indusia-surface rounded-xl shadow-2xl border border-indusia-border w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-indusia-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-indusia-text">Edit Role</h3>
              <button onClick={() => { setIsEditModalOpen(false); resetForm(); }} className="text-indusia-textMuted hover:text-indusia-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-6 space-y-4">
              {submitError && (
                <div className="p-3 rounded-lg bg-indusia-fail/10 border border-indusia-fail text-sm text-indusia-fail">
                  {submitError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Role ID</label>
                <div className="px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-textMuted text-sm font-mono">
                  {formData.id}
                </div>
                <p className="text-xs text-indusia-textMuted mt-1">Role ID cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Quality Lead"
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text text-sm focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                />
                {formErrors.name && <p className="text-xs text-indusia-fail mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this role's responsibilities..."
                  rows={3}
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text text-sm focus:outline-none focus:ring-2 focus:ring-indusia-primary resize-none"
                />
                {formErrors.description && <p className="text-xs text-indusia-fail mt-1">{formErrors.description}</p>}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-indusia-border flex justify-end gap-3">
              <button onClick={() => { setIsEditModalOpen(false); resetForm(); }} className="px-4 py-2 text-sm font-medium text-indusia-textMuted hover:text-indusia-text">Cancel</button>
              <button onClick={handleUpdate} disabled={submitting} className="px-6 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Delete Role"
        message={`Are you sure you want to delete the role "${confirmDialog.roleName}"? This action cannot be undone.`}
        variant="danger"
        confirmText="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDialog({ isOpen: false, roleId: null, roleName: '' })}
      />
    </div>
  );
}
