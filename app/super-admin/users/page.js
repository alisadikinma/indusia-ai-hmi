'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useUsers } from '@/hooks/useUsers';
import { useToast } from '@/hooks/useToast';
import { useSections } from '@/hooks/useSections';
import { useRoles } from '@/hooks/useRoles';
import SectionHeader from '@/components/common/SectionHeader';
import StatusBadge from '@/components/common/StatusBadge';
import Drawer from '@/components/Drawer';
import ConfirmDialog from '@/components/ConfirmDialog';
import PageLoading from '@/components/common/PageLoading';
import { Search, Plus, Edit, Trash2, RefreshCw, Ban, CheckCircle, Eye, EyeOff, X, Loader2 } from 'lucide-react';

export default function UsersManagementPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { users, loading: usersLoading, create, update, remove, disable, enable, resetPassword } = useUsers();
  const { sections, loading: sectionsLoading } = useSections();
  const { roles } = useRoles();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, action: null, userId: null });
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role_id: '',
    sections: [],
    whatsapp: '',
    notificationPreferences: {
      email: true,
      whatsapp: false,
    },
  });
  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.roleId === roleFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  if (usersLoading || sectionsLoading) {
    return <PageLoading message="Loading users..." />;
  }

  if (!user || user.role !== 'superadmin') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">Access Denied</h2>
          <p className="text-sm text-indusia-textMuted mb-6">Only super admins can access this page.</p>
          <button onClick={() => router.back()} className="px-6 py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!validateEmail(formData.email)) errors.email = 'Invalid email address';
    if (!isEditDrawerOpen && !formData.password.trim()) errors.password = 'Password is required';
    if (!formData.role_id) errors.role_id = 'Role is required';
    if (formData.sections.length === 0) errors.sections = 'At least one section required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddUser = async () => {
    if (!validateForm()) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      await create(formData);
      showToast({ title: 'User created successfully', variant: 'success' });
      setIsAddModalOpen(false);
      resetForm();
    } catch (err) {
      setSubmitError(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!validateForm()) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const updatePayload = {
        name: formData.name,
        email: formData.email,
        sections: formData.sections,
        whatsapp: formData.whatsapp,
      };
      if (formData.role_id !== (selectedUser.roleId || '')) {
        updatePayload.role_id = formData.role_id;
      }
      await update(selectedUser.id, updatePayload);
      showToast({ title: 'User updated successfully', variant: 'success' });
      setIsEditDrawerOpen(false);
      resetForm();
    } catch (err) {
      setSubmitError(err.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (userId) => {
    setConfirmDialog({ isOpen: false, action: null, userId: null });
    try {
      const tempPassword = await resetPassword(userId);
      showToast({ title: 'Password reset', description: `Temporary password: ${tempPassword}`, variant: 'success' });
    } catch (err) {
      showToast({ title: 'Failed to reset password', description: err.message, variant: 'error' });
    }
  };

  const handleDisableUser = async (userId) => {
    setConfirmDialog({ isOpen: false, action: null, userId: null });
    try {
      await disable(userId);
      showToast({ title: 'User disabled successfully', variant: 'success' });
    } catch (err) {
      showToast({ title: 'Failed to disable user', description: err.message, variant: 'error' });
    }
  };

  const handleEnableUser = async (userId) => {
    try {
      await enable(userId);
      showToast({ title: 'User enabled successfully', variant: 'success' });
    } catch (err) {
      showToast({ title: 'Failed to enable user', description: err.message, variant: 'error' });
    }
  };

  const handleDeleteUser = async (userId) => {
    setConfirmDialog({ isOpen: false, action: null, userId: null });
    try {
      await remove(userId);
      showToast({ title: 'User deleted successfully', variant: 'success' });
    } catch (err) {
      showToast({ title: 'Failed to delete user', description: err.message, variant: 'error' });
    }
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditDrawer = (usr) => {
    setSelectedUser(usr);
    setFormData({
      name: usr.name,
      email: usr.email,
      password: '',
      role_id: usr.roleId || '',
      sections: usr.sections || [],
      whatsapp: usr.whatsapp || '',
      notificationPreferences: usr.notificationPreferences || { email: true, whatsapp: false },
    });
    setFormErrors({});
    setSubmitError('');
    setIsEditDrawerOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role_id: '',
      sections: [],
      whatsapp: '',
      notificationPreferences: { email: true, whatsapp: false },
    });
    setFormErrors({});
    setSubmitError('');
    setSelectedUser(null);
  };

  const toggleSection = (sectionId) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections.includes(sectionId)
        ? prev.sections.filter(id => id !== sectionId)
        : [...prev.sections, sectionId]
    }));
  };

  return (
    <div>
      <SectionHeader title="User Management" description="Manage system users, roles, and permissions" />

      <div className="bg-indusia-surface rounded-lg border border-indusia-border p-6 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-indusia-textMuted" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary focus:border-transparent"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary focus:border-transparent"
            >
              <option value="all">All Roles</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <button
            onClick={openAddModal}
            className="px-6 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add User
          </button>
        </div>
      </div>

      <div className="bg-indusia-surface rounded-lg border border-indusia-border overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-indusia-border bg-indusia-surfaceMuted">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Name</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Email</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Role</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Sections</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Status</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(usr => (
              <tr key={usr.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-indusia-text">{usr.name}</td>
                <td className="px-6 py-4 text-sm text-indusia-textMuted">{usr.email}</td>
                <td className="px-6 py-4 text-sm text-indusia-text capitalize">{roles.find(r => r.id === usr.roleId)?.name || usr.roleId}</td>
                <td className="px-6 py-4 text-sm text-indusia-textMuted">
                  {usr.sections.map(s => sections.find(sec => sec.id === s)?.name).join(', ')}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={usr.status === 'active' ? 'pass' : 'fail'} label={usr.status} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditDrawer(usr)}
                      className="p-1.5 text-indusia-textMuted hover:text-indusia-primary transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDialog({ isOpen: true, action: 'reset', userId: usr.id })}
                      className="p-1.5 text-indusia-textMuted hover:text-indusia-primary transition-colors"
                      title="Reset Password"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    {usr.status === 'active' ? (
                      <button
                        onClick={() => setConfirmDialog({ isOpen: true, action: 'disable', userId: usr.id })}
                        className="p-1.5 text-indusia-textMuted hover:text-indusia-fail transition-colors"
                        title="Disable"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEnableUser(usr.id)}
                        className="p-1.5 text-indusia-textMuted hover:text-indusia-pass transition-colors"
                        title="Enable"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDialog({ isOpen: true, action: 'delete', userId: usr.id })}
                      className="p-1.5 text-indusia-textMuted hover:text-indusia-fail transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsAddModalOpen(false)} />
          <div className="relative bg-indusia-surface rounded-xl shadow-2xl border border-indusia-border w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-indusia-border flex items-center justify-between sticky top-0 bg-indusia-surface">
              <h3 className="text-lg font-semibold text-indusia-text">Add New User</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-indusia-textMuted hover:text-indusia-text"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-6 space-y-4">
              {submitError && (
                <div className="p-3 rounded-lg bg-indusia-fail/10 border border-indusia-fail text-sm text-indusia-fail">
                  {submitError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                />
                {formErrors.name && <p className="text-xs text-indusia-fail mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="e.g. john.doe@indusia.ai"
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                />
                {formErrors.email && <p className="text-xs text-indusia-fail mt-1">{formErrors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Min. 6 characters"
                    className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-indusia-textMuted hover:text-indusia-text"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {formErrors.password && <p className="text-xs text-indusia-fail mt-1">{formErrors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Role</label>
                <select
                  value={formData.role_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, role_id: e.target.value }))}
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                >
                  <option value="">Select role...</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                {formErrors.role_id && <p className="text-xs text-indusia-fail mt-1">{formErrors.role_id}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Sections</label>
                <div className="space-y-2">
                  {sectionsLoading ? (
                    <p className="text-sm text-indusia-textMuted">Loading sections...</p>
                  ) : sections.length === 0 ? (
                    <p className="text-sm text-indusia-textMuted">No sections available</p>
                  ) : (
                    sections.map(sec => (
                      <label key={sec.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.sections.includes(sec.id)}
                          onChange={() => toggleSection(sec.id)}
                          className="w-4 h-4 text-indusia-primary"
                        />
                        <span className="text-sm text-indusia-text">{sec.name}</span>
                      </label>
                    ))
                  )}
                </div>
                {formErrors.sections && <p className="text-xs text-indusia-fail mt-1">{formErrors.sections}</p>}
              </div>

            </div>

            <div className="px-6 py-4 border-t border-indusia-border flex justify-end gap-3 sticky bottom-0 bg-indusia-surface">
              <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-medium text-indusia-textMuted hover:text-indusia-text">Cancel</button>
              <button onClick={handleAddUser} disabled={submitting} className="px-6 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      <Drawer isOpen={isEditDrawerOpen} onClose={() => setIsEditDrawerOpen(false)} title="Edit User">
        <div className="space-y-4">
          {submitError && (
            <div className="p-3 rounded-lg bg-indusia-fail/10 border border-indusia-fail text-sm text-indusia-fail">
              {submitError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-indusia-text mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. John Doe"
              className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
            />
            {formErrors.name && <p className="text-xs text-indusia-fail mt-1">{formErrors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-indusia-text mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="e.g. john.doe@indusia.ai"
              className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
            />
            {formErrors.email && <p className="text-xs text-indusia-fail mt-1">{formErrors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-indusia-text mb-2">Role</label>
            <select
              value={formData.role_id}
              onChange={(e) => setFormData(prev => ({ ...prev, role_id: e.target.value }))}
              className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
            >
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-indusia-text mb-2">Sections</label>
            <div className="space-y-2">
              {sectionsLoading ? (
                <p className="text-sm text-indusia-textMuted">Loading sections...</p>
              ) : sections.length === 0 ? (
                <p className="text-sm text-indusia-textMuted">No sections available</p>
              ) : (
                sections.map(sec => (
                  <label key={sec.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.sections.includes(sec.id)}
                      onChange={() => toggleSection(sec.id)}
                      className="w-4 h-4 text-indusia-primary"
                    />
                    <span className="text-sm text-indusia-text">{sec.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-indusia-border flex justify-end gap-3">
            <button onClick={() => setIsEditDrawerOpen(false)} className="px-4 py-2 text-sm font-medium text-indusia-textMuted hover:text-indusia-text">Cancel</button>
            <button onClick={handleEditUser} disabled={submitting} className="px-6 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.action === 'reset' ? 'Reset Password' : confirmDialog.action === 'disable' ? 'Disable User' : 'Delete User'}
        message={confirmDialog.action === 'reset' ? 'Generate a temporary password for this user?' : confirmDialog.action === 'disable' ? 'This user will not be able to log in.' : 'This action cannot be undone.'}
        variant={confirmDialog.action === 'delete' ? 'danger' : 'default'}
        confirmText={confirmDialog.action === 'reset' ? 'Reset' : confirmDialog.action === 'disable' ? 'Disable' : 'Delete'}
        onConfirm={() => {
          if (confirmDialog.action === 'reset') handleResetPassword(confirmDialog.userId);
          else if (confirmDialog.action === 'disable') handleDisableUser(confirmDialog.userId);
          else if (confirmDialog.action === 'delete') handleDeleteUser(confirmDialog.userId);
        }}
        onCancel={() => setConfirmDialog({ isOpen: false, action: null, userId: null })}
      />
    </div>
  );
}
