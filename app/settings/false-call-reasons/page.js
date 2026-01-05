'use client';

/**
 * False Call Reasons Management Page
 * Accessible by: Engineer, Super Admin
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/lib/utils/authFetch';
import { 
  AlertTriangle, Plus, Edit2, Trash2, Save, X, 
  Loader2, CheckCircle, XCircle, GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FalseCallReasonsPage() {
  const { user, hasMenuAccess, isLoading: authLoading } = useAuth();
  
  // State
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [toast, setToast] = useState({ show: false, type: '', message: '' });
  
  // Form state
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    is_active: true,
    display_order: 0
  });

  // Fetch reasons
  const fetchReasons = async () => {
    try {
      const res = await authFetch('/api/master-data/false-call-reasons');
      const data = await res.json();
      if (data.success) {
        setReasons(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch reasons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchReasons();
  }, [user]);

  // Show toast
  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: '', message: '' }), 3000);
  };

  // Reset form
  const resetForm = () => {
    setForm({ code: '', name: '', description: '', is_active: true, display_order: 0 });
    setEditingId(null);
    setShowAddForm(false);
  };

  // Handle save (create or update)
  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      showToast('error', 'Code and Name are required');
      return;
    }

    setSaving(true);
    try {
      const endpoint = editingId 
        ? `/api/master-data/false-call-reasons/${editingId}`
        : '/api/master-data/false-call-reasons';
      
      const res = await authFetch(endpoint, {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(form)
      });
      
      const data = await res.json();
      if (data.success) {
        showToast('success', `Reason ${editingId ? 'updated' : 'created'}`);
        resetForm();
        fetchReasons();
      } else {
        showToast('error', data.error || 'Failed to save');
      }
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  // Handle edit
  const handleEdit = (reason) => {
    setForm({
      code: reason.code,
      name: reason.name,
      description: reason.description || '',
      is_active: reason.is_active,
      display_order: reason.display_order || 0
    });
    setEditingId(reason.id);
    setShowAddForm(true);
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!confirm('Delete this reason?')) return;
    
    try {
      const res = await authFetch(`/api/master-data/false-call-reasons/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      
      if (data.success) {
        showToast('success', 'Reason deleted');
        fetchReasons();
      } else {
        showToast('error', data.error || 'Failed to delete');
      }
    } catch (err) {
      showToast('error', err.message);
    }
  };

  // Toggle active status
  const toggleActive = async (reason) => {
    try {
      const res = await authFetch(`/api/master-data/false-call-reasons/${reason.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !reason.is_active })
      });
      const data = await res.json();
      
      if (data.success) {
        fetchReasons();
      }
    } catch (err) {
      showToast('error', err.message);
    }
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-indusia-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indusia-primary" />
      </div>
    );
  }

  // Access check - Engineer or Super Admin
  const hasAccess = user && (hasMenuAccess('menu_engineering') || hasMenuAccess('menu_super_admin'));
  
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-indusia-bg flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-indusia-text mb-2">Access Denied</h2>
          <p className="text-indusia-textMuted">Engineers and Super Admins only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indusia-bg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-indusia-text">
            False Call Reasons
          </h1>
          <p className="text-sm text-indusia-textMuted mt-1">
            Manage reasons for operator false call reports
          </p>
        </div>
        
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indusia-primary text-white rounded-lg hover:bg-indusia-primary/90"
          >
            <Plus className="w-4 h-4" />
            Add Reason
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-indusia-surface border border-indusia-border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-indusia-text">
              {editingId ? 'Edit Reason' : 'Add New Reason'}
            </h3>
            <button onClick={resetForm} className="text-indusia-textMuted hover:text-indusia-text">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-indusia-textMuted mb-1">
                Code <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. REFLECTION"
                className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm text-indusia-textMuted mb-1">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Lighting Reflection"
                className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text text-sm"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm text-indusia-textMuted mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
                className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text text-sm"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-indusia-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                Active
              </label>
              
              <div className="flex items-center gap-2">
                <label className="text-sm text-indusia-textMuted">Display Order:</label>
                <input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                  className="w-16 px-2 py-1 bg-indusia-bg border border-indusia-border rounded text-indusia-text text-sm"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={resetForm}
              className="px-4 py-2 border border-indusia-border rounded-lg text-indusia-textMuted hover:text-indusia-text"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indusia-primary text-white rounded-lg hover:bg-indusia-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Reasons Table */}
      <div className="bg-indusia-surface border border-indusia-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-indusia-bg/50 border-b border-indusia-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-indusia-textMuted uppercase">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-indusia-textMuted uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-indusia-textMuted uppercase hidden md:table-cell">Description</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-indusia-textMuted uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-indusia-textMuted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indusia-border">
            {reasons.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-indusia-textMuted">
                  No false call reasons defined yet
                </td>
              </tr>
            ) : (
              reasons.map((reason) => (
                <tr key={reason.id} className="hover:bg-indusia-bg/30">
                  <td className="px-4 py-3">
                    <code className="px-2 py-1 bg-indusia-bg rounded text-xs text-indusia-primary">
                      {reason.code}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-indusia-text">{reason.name}</td>
                  <td className="px-4 py-3 text-indusia-textMuted text-sm hidden md:table-cell">
                    {reason.description || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(reason)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded text-xs",
                        reason.is_active 
                          ? "bg-green-500/20 text-green-400" 
                          : "bg-gray-500/20 text-gray-400"
                      )}
                    >
                      {reason.is_active ? (
                        <><CheckCircle className="w-3 h-3" /> Active</>
                      ) : (
                        <><XCircle className="w-3 h-3" /> Inactive</>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(reason)}
                        className="p-1.5 text-indusia-textMuted hover:text-indusia-primary"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(reason.id)}
                        className="p-1.5 text-indusia-textMuted hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Toast */}
      {toast.show && (
        <div className={cn(
          "fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2",
          toast.type === 'success' ? "bg-green-500 text-white" : "bg-red-500 text-white"
        )}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
