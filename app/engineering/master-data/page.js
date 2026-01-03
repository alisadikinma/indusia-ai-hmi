'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useUsers } from '@/hooks/useUsers';
import { useRoles } from '@/hooks/useRoles';
import SectionHeader from '@/components/common/SectionHeader';
import Card from '@/components/common/Card';
import { Edit2, Trash2, Save, X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { authFetch } from '@/lib/utils/authFetch';
import { useToast } from '@/hooks/useToast';

export default function MasterDataPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('customers');

  // Use real data hooks
  const { 
    customers, 
    sections, 
    lines, 
    boards, 
    loading: masterLoading, 
    error: masterError,
    refreshMasterData 
  } = useMasterData();
  
  const { 
    users, 
    loading: usersLoading, 
    error: usersError,
    refreshUsers 
  } = useUsers();
  
  const { roles, loading: rolesLoading } = useRoles();

  // Form states
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({ id: '', name: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [editingSection, setEditingSection] = useState(null);
  const [sectionForm, setSectionForm] = useState({ id: '', name: '' });
  const [savingSection, setSavingSection] = useState(false);

  const [editingLine, setEditingLine] = useState(null);
  const [lineForm, setLineForm] = useState({ id: '', name: '', customerId: '', sectionId: '' });
  const [savingLine, setSavingLine] = useState(false);

  const [editingBoard, setEditingBoard] = useState(null);
  const [boardForm, setBoardForm] = useState({ id: '', name: '', customerId: '' });
  const [savingBoard, setSavingBoard] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ id: '', name: '', email: '', role: 'operator', sections: [] });
  const [savingUser, setSavingUser] = useState(false);
  const [userFilter, setUserFilter] = useState('all');

  // Role check
  const userRole = user?.roleId || user?.role_id || user?.role;

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">You are not logged in</h2>
          <p className="text-sm text-indusia-textMuted mb-6">Please login to access the system.</p>
          <button onClick={() => router.push('/login')} className="px-6 py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!['engineer', 'superadmin'].includes(userRole)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">Access Denied</h2>
          <p className="text-sm text-indusia-textMuted mb-6">Only Process Engineers can access the Master Data Console.</p>
          <button onClick={() => router.back()} className="px-6 py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'customers', label: 'Customers' },
    { id: 'sections', label: 'Sections' },
    { id: 'lines', label: 'Production Lines' },
    { id: 'boards', label: 'Boards / Models' },
    { id: 'users', label: 'Users' },
  ];

  // Customer CRUD
  const handleCustomerSave = async () => {
    if (!customerForm.name.trim()) return;
    setSavingCustomer(true);

    try {
      const endpoint = editingCustomer 
        ? `/api/master-data/customers/${editingCustomer.id}`
        : '/api/master-data/customers';
      
      const res = await authFetch(endpoint, {
        method: editingCustomer ? 'PATCH' : 'POST',
        body: JSON.stringify({ name: customerForm.name })
      });
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save customer');
      
      showToast({ title: `Customer ${editingCustomer ? 'updated' : 'created'}`, variant: 'success' });
      await refreshMasterData();
      setCustomerForm({ id: '', name: '' });
      setEditingCustomer(null);
    } catch (err) {
      showToast({ title: 'Error', description: err.message, variant: 'error' });
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleCustomerDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    try {
      const res = await authFetch(`/api/master-data/customers/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to delete customer');
      
      showToast({ title: 'Customer deleted', variant: 'success' });
      await refreshMasterData();
    } catch (err) {
      showToast({ title: 'Error', description: err.message, variant: 'error' });
    }
  };

  // Section CRUD
  const handleSectionSave = async () => {
    if (!sectionForm.name.trim()) return;
    setSavingSection(true);

    try {
      const endpoint = editingSection 
        ? `/api/master-data/sections/${editingSection.id}`
        : '/api/master-data/sections';
      
      const res = await authFetch(endpoint, {
        method: editingSection ? 'PATCH' : 'POST',
        body: JSON.stringify({ name: sectionForm.name })
      });
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save section');
      
      showToast({ title: `Section ${editingSection ? 'updated' : 'created'}`, variant: 'success' });
      await refreshMasterData();
      setSectionForm({ id: '', name: '' });
      setEditingSection(null);
    } catch (err) {
      showToast({ title: 'Error', description: err.message, variant: 'error' });
    } finally {
      setSavingSection(false);
    }
  };

  const handleSectionDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this section?')) return;

    try {
      const res = await authFetch(`/api/master-data/sections/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to delete section');
      
      showToast({ title: 'Section deleted', variant: 'success' });
      await refreshMasterData();
    } catch (err) {
      showToast({ title: 'Error', description: err.message, variant: 'error' });
    }
  };

  // Line CRUD
  const handleLineSave = async () => {
    if (!lineForm.name.trim() || !lineForm.customerId || !lineForm.sectionId) return;
    setSavingLine(true);

    try {
      const endpoint = editingLine 
        ? `/api/master-data/lines/${editingLine.id}`
        : '/api/master-data/lines';
      
      const res = await authFetch(endpoint, {
        method: editingLine ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: lineForm.name,
          customer_id: lineForm.customerId,
          section_id: lineForm.sectionId
        })
      });
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save line');
      
      showToast({ title: `Line ${editingLine ? 'updated' : 'created'}`, variant: 'success' });
      await refreshMasterData();
      setLineForm({ id: '', name: '', customerId: '', sectionId: '' });
      setEditingLine(null);
    } catch (err) {
      showToast({ title: 'Error', description: err.message, variant: 'error' });
    } finally {
      setSavingLine(false);
    }
  };

  const handleLineDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this line?')) return;

    try {
      const res = await authFetch(`/api/master-data/lines/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to delete line');
      
      showToast({ title: 'Line deleted', variant: 'success' });
      await refreshMasterData();
    } catch (err) {
      showToast({ title: 'Error', description: err.message, variant: 'error' });
    }
  };

  // Board CRUD
  const handleBoardSave = async () => {
    if (!boardForm.name.trim() || !boardForm.customerId) return;
    setSavingBoard(true);

    try {
      const endpoint = editingBoard 
        ? `/api/master-data/boards/${editingBoard.id}`
        : '/api/master-data/boards';
      
      const res = await authFetch(endpoint, {
        method: editingBoard ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: boardForm.name,
          customer_id: boardForm.customerId
        })
      });
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save board');
      
      showToast({ title: `Board ${editingBoard ? 'updated' : 'created'}`, variant: 'success' });
      await refreshMasterData();
      setBoardForm({ id: '', name: '', customerId: '' });
      setEditingBoard(null);
    } catch (err) {
      showToast({ title: 'Error', description: err.message, variant: 'error' });
    } finally {
      setSavingBoard(false);
    }
  };

  const handleBoardDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this board?')) return;

    try {
      const res = await authFetch(`/api/master-data/boards/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to delete board');
      
      showToast({ title: 'Board deleted', variant: 'success' });
      await refreshMasterData();
    } catch (err) {
      showToast({ title: 'Error', description: err.message, variant: 'error' });
    }
  };

  // User CRUD
  const handleUserSave = async () => {
    if (!userForm.name.trim() || !userForm.role) return;
    setSavingUser(true);

    try {
      const endpoint = editingUser 
        ? `/api/users/${editingUser.id}`
        : '/api/users';
      
      const res = await authFetch(endpoint, {
        method: editingUser ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: userForm.name,
          email: userForm.email,
          role_id: userForm.role,
          sections: userForm.sections
        })
      });
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save user');
      
      showToast({ title: `User ${editingUser ? 'updated' : 'created'}`, variant: 'success' });
      await refreshUsers();
      setUserForm({ id: '', name: '', email: '', role: 'operator', sections: [] });
      setEditingUser(null);
    } catch (err) {
      showToast({ title: 'Error', description: err.message, variant: 'error' });
    } finally {
      setSavingUser(false);
    }
  };

  const handleUserDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const res = await authFetch(`/api/users/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to delete user');
      
      showToast({ title: 'User deleted', variant: 'success' });
      await refreshUsers();
    } catch (err) {
      showToast({ title: 'Error', description: err.message, variant: 'error' });
    }
  };

  const toggleUserSection = (sectionId) => {
    setUserForm(prev => ({
      ...prev,
      sections: prev.sections.includes(sectionId)
        ? prev.sections.filter(s => s !== sectionId)
        : [...prev.sections, sectionId]
    }));
  };

  const filteredUsers = users.filter(u => {
    if (userFilter === 'all') return true;
    const role = u.roleId || u.role_id || u.role;
    return role === userFilter;
  });

  const isLoading = masterLoading || usersLoading || rolesLoading;
  const hasError = masterError || usersError;

  return (
    <div>
      <SectionHeader
        title="Master Data Console"
        description="Configure customers, sections, lines, boards, and registered users for the HMI."
      />

      {/* Error Banner */}
      {hasError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-400 flex-1">
            Error loading data: {masterError || usersError}
          </p>
          <button
            onClick={() => { refreshMasterData(); refreshUsers(); }}
            className="text-sm text-red-400 hover:text-red-300 underline flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-indusia-surface rounded-lg border border-indusia-border mb-6">
        <div className="flex items-center gap-2 p-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indusia-primary text-white'
                  : 'bg-transparent text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-surfaceMuted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indusia-primary" />
          <span className="ml-3 text-indusia-textMuted">Loading data...</span>
        </div>
      )}

      {/* Customers Tab */}
      {!isLoading && activeTab === 'customers' && (
        <div className="grid grid-cols-2 gap-6">
          <Card title="Customers" subtitle={`${customers.length} customers`}>
            {customers.length === 0 ? (
              <p className="text-indusia-textMuted text-center py-8">No customers found</p>
            ) : (
              <table className="w-full">
                <thead className="border-b border-indusia-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr key={customer.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted">
                      <td className="px-4 py-3 text-sm text-indusia-text">{customer.name}</td>
                      <td className="px-4 py-3 text-sm text-indusia-textMuted font-mono">{customer.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingCustomer(customer); setCustomerForm({ ...customer }); }} className="p-1 text-indusia-primary hover:bg-indusia-primary/10 rounded">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleCustomerDelete(customer.id)} className="p-1 text-indusia-fail hover:bg-indusia-fail/10 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title={editingCustomer ? 'Edit Customer' : 'Add Customer'}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Customer Name</label>
                <input 
                  type="text" 
                  value={customerForm.name} 
                  onChange={(e) => setCustomerForm(prev => ({ ...prev, name: e.target.value }))} 
                  placeholder="Enter customer name" 
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" 
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleCustomerSave} 
                  disabled={savingCustomer}
                  className="flex-1 px-4 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingCustomer ? 'Update' : 'Add'}
                </button>
                {editingCustomer && (
                  <button onClick={() => { setEditingCustomer(null); setCustomerForm({ id: '', name: '' }); }} className="px-4 py-2 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium hover:bg-indusia-border flex items-center gap-2">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Sections Tab */}
      {!isLoading && activeTab === 'sections' && (
        <div className="grid grid-cols-2 gap-6">
          <Card title="Sections" subtitle={`${sections.length} sections`}>
            {sections.length === 0 ? (
              <p className="text-indusia-textMuted text-center py-8">No sections found</p>
            ) : (
              <table className="w-full">
                <thead className="border-b border-indusia-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map(section => (
                    <tr key={section.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted">
                      <td className="px-4 py-3 text-sm text-indusia-text">{section.name}</td>
                      <td className="px-4 py-3 text-sm text-indusia-textMuted font-mono">{section.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingSection(section); setSectionForm({ ...section }); }} className="p-1 text-indusia-primary hover:bg-indusia-primary/10 rounded">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleSectionDelete(section.id)} className="p-1 text-indusia-fail hover:bg-indusia-fail/10 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title={editingSection ? 'Edit Section' : 'Add Section'}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Section Name</label>
                <input 
                  type="text" 
                  value={sectionForm.name} 
                  onChange={(e) => setSectionForm(prev => ({ ...prev, name: e.target.value }))} 
                  placeholder="Enter section name" 
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" 
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleSectionSave} 
                  disabled={savingSection}
                  className="flex-1 px-4 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingSection ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingSection ? 'Update' : 'Add'}
                </button>
                {editingSection && (
                  <button onClick={() => { setEditingSection(null); setSectionForm({ id: '', name: '' }); }} className="px-4 py-2 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium hover:bg-indusia-border flex items-center gap-2">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Lines Tab */}
      {!isLoading && activeTab === 'lines' && (
        <div className="grid grid-cols-2 gap-6">
          <Card title="Production Lines" subtitle={`${lines.length} lines`}>
            {lines.length === 0 ? (
              <p className="text-indusia-textMuted text-center py-8">No lines found</p>
            ) : (
              <table className="w-full">
                <thead className="border-b border-indusia-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Section</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(line => {
                    const customer = customers.find(c => c.id === line.customerId);
                    const section = sections.find(s => s.id === line.sectionId);
                    return (
                      <tr key={line.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted">
                        <td className="px-4 py-3 text-sm text-indusia-text">{line.name}</td>
                        <td className="px-4 py-3 text-sm text-indusia-textMuted">{customer?.name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-indusia-textMuted">{section?.name || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingLine(line); setLineForm({ ...line }); }} className="p-1 text-indusia-primary hover:bg-indusia-primary/10 rounded">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleLineDelete(line.id)} className="p-1 text-indusia-fail hover:bg-indusia-fail/10 rounded">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          <Card title={editingLine ? 'Edit Line' : 'Add Line'}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Line Name</label>
                <input 
                  type="text" 
                  value={lineForm.name} 
                  onChange={(e) => setLineForm(prev => ({ ...prev, name: e.target.value }))} 
                  placeholder="Enter line name" 
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Customer</label>
                <select 
                  value={lineForm.customerId} 
                  onChange={(e) => setLineForm(prev => ({ ...prev, customerId: e.target.value }))} 
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Section</label>
                <select 
                  value={lineForm.sectionId} 
                  onChange={(e) => setLineForm(prev => ({ ...prev, sectionId: e.target.value }))} 
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                >
                  <option value="">Select section...</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleLineSave} 
                  disabled={savingLine}
                  className="flex-1 px-4 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingLine ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingLine ? 'Update' : 'Add'}
                </button>
                {editingLine && (
                  <button onClick={() => { setEditingLine(null); setLineForm({ id: '', name: '', customerId: '', sectionId: '' }); }} className="px-4 py-2 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium hover:bg-indusia-border flex items-center gap-2">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Boards Tab */}
      {!isLoading && activeTab === 'boards' && (
        <div className="grid grid-cols-2 gap-6">
          <Card title="Boards / Models" subtitle={`${boards.length} boards`}>
            {boards.length === 0 ? (
              <p className="text-indusia-textMuted text-center py-8">No boards found</p>
            ) : (
              <table className="w-full">
                <thead className="border-b border-indusia-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {boards.map(board => {
                    const customer = customers.find(c => c.id === board.customerId);
                    return (
                      <tr key={board.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted">
                        <td className="px-4 py-3 text-sm text-indusia-text">{board.name}</td>
                        <td className="px-4 py-3 text-sm text-indusia-textMuted font-mono">{board.id}</td>
                        <td className="px-4 py-3 text-sm text-indusia-textMuted">{customer?.name || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingBoard(board); setBoardForm({ ...board }); }} className="p-1 text-indusia-primary hover:bg-indusia-primary/10 rounded">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleBoardDelete(board.id)} className="p-1 text-indusia-fail hover:bg-indusia-fail/10 rounded">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          <Card title={editingBoard ? 'Edit Board' : 'Add Board'}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Board Name</label>
                <input 
                  type="text" 
                  value={boardForm.name} 
                  onChange={(e) => setBoardForm(prev => ({ ...prev, name: e.target.value }))} 
                  placeholder="Enter board name" 
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Customer</label>
                <select 
                  value={boardForm.customerId} 
                  onChange={(e) => setBoardForm(prev => ({ ...prev, customerId: e.target.value }))} 
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleBoardSave} 
                  disabled={savingBoard}
                  className="flex-1 px-4 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingBoard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingBoard ? 'Update' : 'Add'}
                </button>
                {editingBoard && (
                  <button onClick={() => { setEditingBoard(null); setBoardForm({ id: '', name: '', customerId: '' }); }} className="px-4 py-2 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium hover:bg-indusia-border flex items-center gap-2">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Users Tab */}
      {!isLoading && activeTab === 'users' && (
        <div className="grid grid-cols-2 gap-6">
          <Card title="Registered Users" subtitle={`${filteredUsers.length} users`}>
            <div className="mb-4 flex gap-2">
              {['all', 'operator', 'manager', 'engineer'].map(filter => (
                <button 
                  key={filter} 
                  onClick={() => setUserFilter(filter)} 
                  className={`px-3 py-1 rounded text-sm font-medium transition-all capitalize ${
                    userFilter === filter 
                      ? 'bg-indusia-primary text-white' 
                      : 'bg-indusia-surfaceMuted text-indusia-textMuted hover:text-indusia-text'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            {filteredUsers.length === 0 ? (
              <p className="text-indusia-textMuted text-center py-8">No users found</p>
            ) : (
              <table className="w-full">
                <thead className="border-b border-indusia-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const role = u.roleId || u.role_id || u.role;
                    return (
                      <tr key={u.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted">
                        <td className="px-4 py-3 text-sm text-indusia-text">{u.name}</td>
                        <td className="px-4 py-3 text-sm text-indusia-textMuted capitalize">{role}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => { 
                              setEditingUser(u); 
                              setUserForm({ 
                                ...u, 
                                role: u.roleId || u.role_id || u.role,
                                sections: u.sections || [] 
                              }); 
                            }} className="p-1 text-indusia-primary hover:bg-indusia-primary/10 rounded">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleUserDelete(u.id)} className="p-1 text-indusia-fail hover:bg-indusia-fail/10 rounded">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          <Card title={editingUser ? 'Edit User' : 'Add User'}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Name</label>
                <input 
                  type="text" 
                  value={userForm.name} 
                  onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))} 
                  placeholder="Enter user name" 
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Email</label>
                <input 
                  type="email" 
                  value={userForm.email} 
                  onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))} 
                  placeholder="Enter email" 
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Role</label>
                <select 
                  value={userForm.role} 
                  onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))} 
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                >
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  {roles.length === 0 && (
                    <>
                      <option value="operator">Operator</option>
                      <option value="manager">Manager</option>
                      <option value="engineer">Engineer</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Sections</label>
                <div className="flex flex-wrap gap-2">
                  {sections.map(section => (
                    <label 
                      key={section.id} 
                      className="flex items-center gap-2 px-3 py-2 bg-indusia-surfaceMuted border border-indusia-border rounded-lg cursor-pointer hover:border-indusia-primary transition-colors"
                    >
                      <input 
                        type="checkbox" 
                        checked={userForm.sections?.includes(section.id)} 
                        onChange={() => toggleUserSection(section.id)} 
                        className="w-4 h-4 text-indusia-primary" 
                      />
                      <span className="text-sm text-indusia-text">{section.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleUserSave} 
                  disabled={savingUser}
                  className="flex-1 px-4 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingUser ? 'Update' : 'Add'}
                </button>
                {editingUser && (
                  <button onClick={() => { setEditingUser(null); setUserForm({ id: '', name: '', email: '', role: 'operator', sections: [] }); }} className="px-4 py-2 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium hover:bg-indusia-border flex items-center gap-2">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
