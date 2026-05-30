'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useMasterData, notifyMasterDataUpdated } from '@/hooks/useMasterData';
import { useUsers } from '@/hooks/useUsers';
import { useRoles } from '@/hooks/useRoles';
import SectionHeader from '@/components/common/SectionHeader';
import Card from '@/components/common/Card';
import { Edit2, Trash2, Save, X, Loader2, AlertCircle, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { authFetch } from '@/lib/utils/authFetch';
import { useToast } from '@/hooks/useToast';
import { useI18n } from '@/context/I18nContext';
import PageLoading from '@/components/common/PageLoading';
import CustomerLogo from '@/components/common/CustomerLogo';

export default function MasterDataPage() {
  const router = useRouter();
  const { user, hasMenuAccess, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('customers');
  const { t } = useI18n();

  // Read ?tab= query param on mount (avoids useSearchParams Suspense issue)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab) setActiveTab(tab);
  }, []);

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const { 
    customers, 
    sections, 
    lines, 
    boards, 
    loading: masterLoading, 
    error: masterError,
    refreshMasterData: _refreshMasterData
  } = useMasterData();

  // Wrap refresh to also notify other useMasterData instances (e.g., WorkOrderForm)
  const refreshMasterData = async () => {
    await _refreshMasterData();
    notifyMasterDataUpdated();
  };

  // Only fetch users if role has permission (superadmin, manager)
  const canManageUsers = ['superadmin', 'manager'].includes(user?.roleId || user?.role_id || user?.role);
  const {
    users,
    loading: usersLoading,
    error: usersError,
    refreshUsers
  } = useUsers({ enabled: canManageUsers });
  
  const { roles, loading: rolesLoading } = useRoles();

  // Form states
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({ id: '', name: '', logoBase64: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [editingSection, setEditingSection] = useState(null);
  const [sectionForm, setSectionForm] = useState({ id: '', name: '' });
  const [savingSection, setSavingSection] = useState(false);

  const [editingLine, setEditingLine] = useState(null);
  const [lineForm, setLineForm] = useState({ id: '', name: '', customerId: '', sectionId: '' });
  const [savingLine, setSavingLine] = useState(false);

  const [editingBoard, setEditingBoard] = useState(null);
  const [boardForm, setBoardForm] = useState({ id: '', name: '', customerId: '', cavityCount: 1, topFrameCount: 1, bottomFrameCount: 0 });
  const [savingBoard, setSavingBoard] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ id: '', name: '', email: '', role: 'operator', sections: [] });
  const [savingUser, setSavingUser] = useState(false);
  const [userFilter, setUserFilter] = useState('all');

  // False Call Reasons state
  const [falseCallReasons, setFalseCallReasons] = useState([]);
  const [falseCallLoading, setFalseCallLoading] = useState(false);
  const [editingReason, setEditingReason] = useState(null);
  const [reasonForm, setReasonForm] = useState({ code: '', name: '', description: '', is_active: true, display_order: 0 });
  const [savingReason, setSavingReason] = useState(false);

  // Show loading while auth is loading
  if (authLoading) {
    return <PageLoading message={t('common.loading')} compact />;
  }

  // Check access via database permissions
  if (!user || !hasMenuAccess('menu_engineering')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-phosphor-red mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">{t('auth.accessDenied')}</h2>
          <p className="text-text-secondary">{t('auth.noPermission')}</p>
        </div>
      </div>
    );
  }

  // Role check - already handled by hasMenuAccess above
  const userRole = user?.roleId || user?.role_id || user?.role;

  const tabs = [
    { id: 'customers', label: t('masterData.customers') },
    { id: 'sections', label: t('masterData.sections') },
    { id: 'lines', label: t('masterData.productionLines') },
    { id: 'boards', label: t('masterData.boards') },
    { id: 'false-call-reasons', label: t('masterData.falseCallReasons') },
    ...(canManageUsers ? [{ id: 'users', label: t('masterData.users') }] : []),
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
        body: JSON.stringify({
          name: customerForm.name,
          logo_base64: customerForm.logoBase64 || null,
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save customer');

      showToast({ title: `Customer ${editingCustomer ? 'updated' : 'created'}`, variant: 'success' });
      await refreshMasterData();
      setCustomerForm({ id: '', name: '', logoBase64: '' });
      setEditingCustomer(null);
    } catch (err) {
      showToast({ title: 'Error', description: err.message, variant: 'error' });
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleCustomerDelete = async (id) => {
    if (!confirm(t('masterData.confirmDeleteCustomer'))) return;

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
    if (!confirm(t('masterData.confirmDeleteSection'))) return;

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
    if (!confirm(t('masterData.confirmDeleteLine'))) return;

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
          customer_id: boardForm.customerId,
          cavityCount: parseInt(boardForm.cavityCount) || 1,
          topFrameCount: parseInt(boardForm.topFrameCount) || 1,
          bottomFrameCount: parseInt(boardForm.bottomFrameCount) || 0,
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save board');

      showToast({ title: `Board ${editingBoard ? 'updated' : 'created'}`, variant: 'success' });
      await refreshMasterData();
      setBoardForm({ id: '', name: '', customerId: '', cavityCount: 1, topFrameCount: 1, bottomFrameCount: 0 });
      setEditingBoard(null);
    } catch (err) {
      showToast({ title: 'Error', description: err.message, variant: 'error' });
    } finally {
      setSavingBoard(false);
    }
  };

  const handleBoardDelete = async (id) => {
    if (!confirm(t('masterData.confirmDeleteBoard'))) return;

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
    if (!confirm(t('masterData.confirmDeleteUser'))) return;

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

  // False Call Reasons CRUD
  const fetchReasons = async () => {
    setFalseCallLoading(true);
    try {
      const res = await authFetch('/api/master-data/false-call-reasons');
      const data = await res.json();
      if (data.success) setFalseCallReasons(data.data || []);
    } catch (err) {
      console.error('Failed to fetch reasons:', err);
    } finally {
      setFalseCallLoading(false);
    }
  };

  useEffect(() => {
    if (user && activeTab === 'false-call-reasons') fetchReasons();
  }, [user, activeTab]);

  const handleReasonSave = async () => {
    if (!reasonForm.code.trim() || !reasonForm.name.trim()) return;
    setSavingReason(true);
    try {
      const endpoint = editingReason
        ? `/api/master-data/false-call-reasons/${editingReason.id}`
        : '/api/master-data/false-call-reasons';
      const res = await authFetch(endpoint, {
        method: editingReason ? 'PATCH' : 'POST',
        body: JSON.stringify(reasonForm)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save');
      showToast({ title: `Reason ${editingReason ? 'updated' : 'created'}`, variant: 'success' });
      setReasonForm({ code: '', name: '', description: '', is_active: true, display_order: 0 });
      setEditingReason(null);
      fetchReasons();
    } catch (err) {
      showToast({ title: 'Error', description: err.message, variant: 'error' });
    } finally {
      setSavingReason(false);
    }
  };

  const handleReasonDelete = async (id) => {
    if (!confirm(t('masterData.confirmDeleteReason'))) return;
    try {
      const res = await authFetch(`/api/master-data/false-call-reasons/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to delete');
      showToast({ title: 'Reason deleted', variant: 'success' });
      fetchReasons();
    } catch (err) {
      showToast({ title: 'Error', description: err.message, variant: 'error' });
    }
  };

  const toggleReasonActive = async (reason) => {
    try {
      const res = await authFetch(`/api/master-data/false-call-reasons/${reason.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !reason.is_active })
      });
      const data = await res.json();
      if (data.success) fetchReasons();
    } catch (err) {
      showToast({ title: 'Error', description: err.message, variant: 'error' });
    }
  };

  const filteredUsers = users.filter(u => {
    if (userFilter === 'all') return true;
    const role = u.roleId || u.role_id || u.role;
    return role === userFilter;
  });

  const isLoading = masterLoading || (canManageUsers && usersLoading) || rolesLoading;
  const hasError = masterError || (canManageUsers && usersError);

  return (
    <div>
      <SectionHeader
        title={t('masterData.title')}
        description={t('masterData.description')}
      />

      {/* Error Banner */}
      {hasError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-400 flex-1">
            {t('masterData.errorLoading')}: {masterError || (canManageUsers ? usersError : null)}
          </p>
          <button
            onClick={() => { refreshMasterData(); if (canManageUsers) refreshUsers(); }}
            className="text-sm text-red-400 hover:text-red-300 underline flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" /> {t('masterData.retry')}
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
      {masterLoading && (
        <PageLoading message={t('masterData.loading')} compact />
      )}

      {/* Customers Tab */}
      {!masterLoading && activeTab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
          <Card title={t('masterData.customers')} subtitle={`${customers.length} customers`}>
            {customers.length === 0 ? (
              <p className="text-indusia-textMuted text-center py-8">{t('masterData.noCustomers')}</p>
            ) : (
              <table className="w-full">
                <thead className="border-b border-indusia-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">{t('masterData.name')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">{t('masterData.id')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr key={customer.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted">
                      <td className="px-4 py-3 text-sm text-indusia-text">
                        <div className="flex items-center gap-2">
                          <CustomerLogo customer={customer} size="xs" />
                          {customer.name}
                        </div>
                      </td>
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

          <Card title={editingCustomer ? t('masterData.editCustomer') : t('masterData.addCustomer')}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.customerName')}</label>
                <input
                  type="text"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('masterData.enterCustomerName')}
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Company Logo</label>
                <div className="flex items-center gap-3">
                  {customerForm.logoBase64 && (
                    <div className="relative">
                      <img src={customerForm.logoBase64} alt="Logo preview" className="w-12 h-12 rounded object-contain bg-white/5 border border-indusia-border" />
                      <button
                        type="button"
                        onClick={() => setCustomerForm(prev => ({ ...prev, logoBase64: '' }))}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-indusia-fail rounded-full flex items-center justify-center text-white text-[10px]"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 200 * 1024) {
                        showToast({ title: 'Error', description: 'Logo must be under 200KB', variant: 'error' });
                        e.target.value = '';
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setCustomerForm(prev => ({ ...prev, logoBase64: reader.result }));
                      reader.readAsDataURL(file);
                    }}
                    className="text-sm text-indusia-textMuted file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-indusia-primary/20 file:text-indusia-primary hover:file:bg-indusia-primary/30"
                  />
                </div>
                <p className="text-xs text-indusia-textMuted mt-1">PNG, JPG, or SVG. Max 200KB.</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleCustomerSave} 
                  disabled={savingCustomer}
                  className="flex-1 px-4 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingCustomer ? t('buttons.update') : t('buttons.add')}
                </button>
                {editingCustomer && (
                  <button onClick={() => { setEditingCustomer(null); setCustomerForm({ id: '', name: '', logoBase64: '' }); }} className="px-4 py-2 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium hover:bg-indusia-border flex items-center gap-2">
                    <X className="w-4 h-4" /> {t('buttons.cancel')}
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Sections Tab */}
      {!masterLoading && activeTab === 'sections' && (
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
          <Card title={t('masterData.sections')} subtitle={`${sections.length} sections`}>
            {sections.length === 0 ? (
              <p className="text-indusia-textMuted text-center py-8">{t('masterData.noSections')}</p>
            ) : (
              <table className="w-full">
                <thead className="border-b border-indusia-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">{t('masterData.name')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">{t('masterData.id')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">{t('common.actions')}</th>
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

          <Card title={editingSection ? t('masterData.editSection') : t('masterData.addSection')}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.sectionName')}</label>
                <input
                  type="text"
                  value={sectionForm.name}
                  onChange={(e) => setSectionForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('masterData.enterSectionName')}
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
                  {editingSection ? t('buttons.update') : t('buttons.add')}
                </button>
                {editingSection && (
                  <button onClick={() => { setEditingSection(null); setSectionForm({ id: '', name: '' }); }} className="px-4 py-2 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium hover:bg-indusia-border flex items-center gap-2">
                    <X className="w-4 h-4" /> {t('buttons.cancel')}
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Lines Tab */}
      {!masterLoading && activeTab === 'lines' && (
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
          <Card title={t('masterData.productionLines')} subtitle={`${lines.length} lines`}>
            {lines.length === 0 ? (
              <p className="text-indusia-textMuted text-center py-8">{t('masterData.noLines')}</p>
            ) : (
              <table className="w-full">
                <thead className="border-b border-indusia-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">{t('masterData.name')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">{t('masterData.customer')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">{t('masterData.section')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">{t('common.actions')}</th>
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

          <Card title={editingLine ? t('masterData.editLine') : t('masterData.addLine')}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.lineName')}</label>
                <input
                  type="text"
                  value={lineForm.name}
                  onChange={(e) => setLineForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('masterData.enterLineName')}
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.customer')}</label>
                <select
                  value={lineForm.customerId}
                  onChange={(e) => setLineForm(prev => ({ ...prev, customerId: e.target.value }))}
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                >
                  <option value="">{t('masterData.selectCustomer')}</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.section')}</label>
                <select
                  value={lineForm.sectionId}
                  onChange={(e) => setLineForm(prev => ({ ...prev, sectionId: e.target.value }))}
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                >
                  <option value="">{t('masterData.selectSection')}</option>
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
                  {editingLine ? t('buttons.update') : t('buttons.add')}
                </button>
                {editingLine && (
                  <button onClick={() => { setEditingLine(null); setLineForm({ id: '', name: '', customerId: '', sectionId: '' }); }} className="px-4 py-2 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium hover:bg-indusia-border flex items-center gap-2">
                    <X className="w-4 h-4" /> {t('buttons.cancel')}
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Boards Tab */}
      {!masterLoading && activeTab === 'boards' && (
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
          <Card title={t('masterData.boardsModels')} subtitle={`${boards.length} boards`}>
            {boards.length === 0 ? (
              <p className="text-indusia-textMuted text-center py-8">{t('masterData.noBoards')}</p>
            ) : (
              <table className="w-full table-fixed">
                <thead className="border-b border-indusia-border">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-indusia-textMuted uppercase w-[30%]">{t('masterData.name')}</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-indusia-textMuted uppercase w-[25%]">{t('masterData.customer')}</th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-indusia-textMuted uppercase w-[10%]">{t('masterData.cavity')}</th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-indusia-textMuted uppercase w-[12%]">{t('masterData.topFrames')}</th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-indusia-textMuted uppercase w-[12%]">{t('masterData.btmFrames')}</th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-indusia-textMuted uppercase w-[11%]">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {boards.map(board => {
                    const customer = customers.find(c => c.id === board.customerId);
                    return (
                      <tr key={board.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted">
                        <td className="px-3 py-2 text-sm text-indusia-text truncate">{board.name}</td>
                        <td className="px-3 py-2 text-sm text-indusia-textMuted truncate">{customer?.name || '-'}</td>
                        <td className="px-2 py-2 text-sm text-indusia-textMuted font-mono text-center">{board.cavityCount || 1}</td>
                        <td className="px-2 py-2 text-sm text-indusia-textMuted font-mono text-center">{board.topFrameCount || 1}</td>
                        <td className="px-2 py-2 text-sm text-indusia-textMuted font-mono text-center">{board.bottomFrameCount || 0}</td>
                        <td className="px-2 py-2">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => { setEditingBoard(board); setBoardForm({ ...board, cavityCount: board.cavityCount || 1, topFrameCount: board.topFrameCount || 1, bottomFrameCount: board.bottomFrameCount || 0 }); }} className="p-1 text-indusia-primary hover:bg-indusia-primary/10 rounded">
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

          <Card title={editingBoard ? t('masterData.editBoard') : t('masterData.addBoard')}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.boardName')}</label>
                <input
                  type="text"
                  value={boardForm.name}
                  onChange={(e) => setBoardForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('masterData.enterBoardName')}
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.customer')}</label>
                <select
                  value={boardForm.customerId}
                  onChange={(e) => setBoardForm(prev => ({ ...prev, customerId: e.target.value }))}
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                >
                  <option value="">{t('masterData.selectCustomer')}</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.cavityCount')}</label>
                <input
                  type="number"
                  min="1"
                  value={boardForm.cavityCount}
                  onChange={(e) => setBoardForm(prev => ({ ...prev, cavityCount: parseInt(e.target.value) || 1 }))}
                  placeholder="Number of PCBs per panel"
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                />
                <p className="text-xs text-indusia-textMuted mt-1">{t('masterData.cavityCountHelp')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.topFrameCount')}</label>
                  <input
                    type="number"
                    min="1"
                    value={boardForm.topFrameCount}
                    onChange={(e) => setBoardForm(prev => ({ ...prev, topFrameCount: parseInt(e.target.value) || 1 }))}
                    placeholder="Top frames"
                    className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                  />
                  <p className="text-xs text-indusia-textMuted mt-1">{t('masterData.topFrameCountHelp')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.bottomFrameCount')}</label>
                  <input
                    type="number"
                    min="0"
                    value={boardForm.bottomFrameCount}
                    onChange={(e) => setBoardForm(prev => ({ ...prev, bottomFrameCount: parseInt(e.target.value) || 0 }))}
                    placeholder="Bottom frames"
                    className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                  />
                  <p className="text-xs text-indusia-textMuted mt-1">{t('masterData.bottomFrameCountHelp')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBoardSave}
                  disabled={savingBoard}
                  className="flex-1 px-4 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingBoard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingBoard ? t('buttons.update') : t('buttons.add')}
                </button>
                {editingBoard && (
                  <button onClick={() => { setEditingBoard(null); setBoardForm({ id: '', name: '', customerId: '', cavityCount: 1, topFrameCount: 1, bottomFrameCount: 0 }); }} className="px-4 py-2 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium hover:bg-indusia-border flex items-center gap-2">
                    <X className="w-4 h-4" /> {t('buttons.cancel')}
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* False Call Reasons Tab */}
      {!masterLoading && activeTab === 'false-call-reasons' && (
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
          <Card title={t('masterData.falseCallReasons')} subtitle={`${falseCallReasons.length} reasons`}>
            {falseCallLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indusia-primary" />
              </div>
            ) : falseCallReasons.length === 0 ? (
              <p className="text-indusia-textMuted text-center py-8">{t('masterData.noReasons')}</p>
            ) : (
              <table className="w-full table-fixed">
                <thead className="border-b border-indusia-border">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-indusia-textMuted uppercase w-[22%]">{t('masterData.code')}</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-indusia-textMuted uppercase w-[22%]">{t('masterData.name')}</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-indusia-textMuted uppercase">{t('masterData.description')}</th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-indusia-textMuted uppercase w-[13%]">{t('masterData.status')}</th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-indusia-textMuted uppercase w-[11%]">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {falseCallReasons.map(reason => (
                    <tr key={reason.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted">
                      <td className="px-3 py-2">
                        <code className="px-1.5 py-0.5 bg-indusia-bg rounded text-xs text-indusia-primary truncate block">{reason.code}</code>
                      </td>
                      <td className="px-3 py-2 text-sm text-indusia-text truncate">{reason.name}</td>
                      <td className="px-3 py-2 text-sm text-indusia-textMuted truncate">{reason.description || '-'}</td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => toggleReasonActive(reason)}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs whitespace-nowrap ${
                            reason.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {reason.is_active ? <><CheckCircle className="w-3 h-3" /> {t('masterData.active')}</> : <><XCircle className="w-3 h-3" /> {t('masterData.inactive')}</>}
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => { setEditingReason(reason); setReasonForm({ code: reason.code, name: reason.name, description: reason.description || '', is_active: reason.is_active, display_order: reason.display_order || 0 }); }} className="p-1 text-indusia-primary hover:bg-indusia-primary/10 rounded">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleReasonDelete(reason.id)} className="p-1 text-indusia-fail hover:bg-indusia-fail/10 rounded">
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

          <Card title={editingReason ? t('masterData.editReason') : t('masterData.addReason')}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.code')} <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={reasonForm.code}
                  onChange={(e) => setReasonForm(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g. REFLECTION"
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.name')} <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={reasonForm.name}
                  onChange={(e) => setReasonForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Lighting Reflection"
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.description')}</label>
                <input
                  type="text"
                  value={reasonForm.description}
                  onChange={(e) => setReasonForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('masterData.optionalDescription')}
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-indusia-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reasonForm.is_active}
                    onChange={(e) => setReasonForm(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  {t('masterData.active')}
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-indusia-textMuted">{t('masterData.order')}:</label>
                  <input
                    type="number"
                    value={reasonForm.display_order}
                    onChange={(e) => setReasonForm(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                    className="w-16 px-2 py-1 bg-indusia-bg border border-indusia-border rounded text-indusia-text text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReasonSave}
                  disabled={savingReason}
                  className="flex-1 px-4 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingReason ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingReason ? t('buttons.update') : t('buttons.add')}
                </button>
                {editingReason && (
                  <button onClick={() => { setEditingReason(null); setReasonForm({ code: '', name: '', description: '', is_active: true, display_order: 0 }); }} className="px-4 py-2 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium hover:bg-indusia-border flex items-center gap-2">
                    <X className="w-4 h-4" /> {t('buttons.cancel')}
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Users Tab */}
      {!masterLoading && activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
          <Card title={t('masterData.registeredUsers')} subtitle={`${filteredUsers.length} users`}>
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
              <p className="text-indusia-textMuted text-center py-8">{t('masterData.noUsers')}</p>
            ) : (
              <table className="w-full">
                <thead className="border-b border-indusia-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">{t('masterData.name')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">{t('masterData.role')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">{t('common.actions')}</th>
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

          <Card title={editingUser ? t('masterData.editUser') : t('masterData.addUser')}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.name')}</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('masterData.enterUserName')}
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.email')}</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder={t('masterData.enterEmail')}
                  className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.role')}</label>
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
                <label className="block text-sm font-medium text-indusia-text mb-2">{t('masterData.sections')}</label>
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
                  {editingUser ? t('buttons.update') : t('buttons.add')}
                </button>
                {editingUser && (
                  <button onClick={() => { setEditingUser(null); setUserForm({ id: '', name: '', email: '', role: 'operator', sections: [] }); }} className="px-4 py-2 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium hover:bg-indusia-border flex items-center gap-2">
                    <X className="w-4 h-4" /> {t('buttons.cancel')}
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
