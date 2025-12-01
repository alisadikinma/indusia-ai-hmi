'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { customers as initialCustomers, sections as initialSections, customerSections as initialCustomerSections, lines as initialLines, boards as initialBoards, userProfiles as initialUserProfiles } from '@/data/masterData';
import SectionHeader from '@/components/common/SectionHeader';
import Card from '@/components/common/Card';
import { Edit2, Trash2, Plus, Save, X } from 'lucide-react';

export default function MasterDataPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('customers');

  const [customerList, setCustomerList] = useState([...initialCustomers]);
  const [sectionList, setSectionList] = useState([...initialSections]);
  const [customerSectionList, setCustomerSectionList] = useState([...initialCustomerSections]);
  const [lineList, setLineList] = useState([...initialLines]);
  const [boardList, setBoardList] = useState([...initialBoards]);
  const [userProfileList, setUserProfileList] = useState([...initialUserProfiles]);

  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({ id: '', name: '' });

  const [editingSection, setEditingSection] = useState(null);
  const [sectionForm, setSectionForm] = useState({ id: '', name: '' });

  const [editingLine, setEditingLine] = useState(null);
  const [lineForm, setLineForm] = useState({ id: '', name: '', customerId: '', sectionId: '' });

  const [editingBoard, setEditingBoard] = useState(null);
  const [boardForm, setBoardForm] = useState({ id: '', name: '', customerId: '' });

  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ id: '', name: '', role: 'operator', sections: [] });
  const [userFilter, setUserFilter] = useState('all');

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

  if (!['engineer', 'superadmin'].includes(user.role)) {
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
    { id: 'mapping', label: 'Customer-Section Mapping' },
    { id: 'lines', label: 'Production Lines' },
    { id: 'boards', label: 'Boards / Models' },
    { id: 'users', label: 'Users' },
  ];

  const handleCustomerSave = () => {
    if (!customerForm.name.trim()) return;

    if (editingCustomer) {
      setCustomerList(prev => prev.map(c => c.id === editingCustomer.id ? { ...editingCustomer, ...customerForm } : c));
    } else {
      const newId = customerForm.id || `cust-${Date.now()}`;
      setCustomerList(prev => [...prev, { id: newId, name: customerForm.name }]);
    }

    setCustomerForm({ id: '', name: '' });
    setEditingCustomer(null);
  };

  const handleCustomerDelete = (id) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      setCustomerList(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleSectionSave = () => {
    if (!sectionForm.name.trim()) return;

    if (editingSection) {
      setSectionList(prev => prev.map(s => s.id === editingSection.id ? { ...editingSection, ...sectionForm } : s));
    } else {
      const newId = sectionForm.id || `sec-${Date.now()}`;
      setSectionList(prev => [...prev, { id: newId, name: sectionForm.name }]);
    }

    setSectionForm({ id: '', name: '' });
    setEditingSection(null);
  };

  const handleSectionDelete = (id) => {
    if (confirm('Are you sure you want to delete this section?')) {
      setSectionList(prev => prev.filter(s => s.id !== id));
    }
  };

  const toggleCustomerSection = (customerId, sectionId) => {
    const exists = customerSectionList.some(cs => cs.customerId === customerId && cs.sectionId === sectionId);

    if (exists) {
      setCustomerSectionList(prev => prev.filter(cs => !(cs.customerId === customerId && cs.sectionId === sectionId)));
    } else {
      setCustomerSectionList(prev => [...prev, { customerId, sectionId }]);
    }
  };

  const isCustomerSectionMapped = (customerId, sectionId) => {
    return customerSectionList.some(cs => cs.customerId === customerId && cs.sectionId === sectionId);
  };

  const handleLineSave = () => {
    if (!lineForm.name.trim() || !lineForm.customerId || !lineForm.sectionId) return;

    if (editingLine) {
      setLineList(prev => prev.map(l => l.id === editingLine.id ? { ...editingLine, ...lineForm } : l));
    } else {
      const newId = lineForm.id || `line-${Date.now()}`;
      setLineList(prev => [...prev, { ...lineForm, id: newId }]);
    }

    setLineForm({ id: '', name: '', customerId: '', sectionId: '' });
    setEditingLine(null);
  };

  const handleLineDelete = (id) => {
    if (confirm('Are you sure you want to delete this line?')) {
      setLineList(prev => prev.filter(l => l.id !== id));
    }
  };

  const handleBoardSave = () => {
    if (!boardForm.name.trim() || !boardForm.customerId) return;

    if (editingBoard) {
      setBoardList(prev => prev.map(b => b.id === editingBoard.id ? { ...editingBoard, ...boardForm } : b));
    } else {
      const newId = boardForm.id || `board-${Date.now()}`;
      setBoardList(prev => [...prev, { ...boardForm, id: newId }]);
    }

    setBoardForm({ id: '', name: '', customerId: '' });
    setEditingBoard(null);
  };

  const handleBoardDelete = (id) => {
    if (confirm('Are you sure you want to delete this board?')) {
      setBoardList(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleUserSave = () => {
    if (!userForm.name.trim() || !userForm.role) return;

    if (editingUser) {
      setUserProfileList(prev => prev.map(u => u.id === editingUser.id ? { ...editingUser, ...userForm } : u));
    } else {
      const newId = userForm.id || `user-${Date.now()}`;
      setUserProfileList(prev => [...prev, { ...userForm, id: newId }]);
    }

    setUserForm({ id: '', name: '', role: 'operator', sections: [] });
    setEditingUser(null);
  };

  const handleUserDelete = (id) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setUserProfileList(prev => prev.filter(u => u.id !== id));
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

  const filteredUsers = userProfileList.filter(u => {
    if (userFilter === 'all') return true;
    return u.role === userFilter;
  });

  return (
    <div>
      <SectionHeader
        title="Master Data Console"
        description="Configure customers, sections, lines, boards, and registered users for the HMI."
      />

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

      {activeTab === 'customers' && (
        <div className="grid grid-cols-2 gap-6">
          <Card title="Customers" subtitle={`${customerList.length} customers`}>
            <table className="w-full">
              <thead className="border-b border-indusia-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Customer ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customerList.map(customer => (
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
          </Card>

          <Card title={editingCustomer ? 'Edit Customer' : 'Add Customer'}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Customer Name</label>
                <input type="text" value={customerForm.name} onChange={(e) => setCustomerForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Enter customer name" className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" />
              </div>
              {!editingCustomer && (
                <div>
                  <label className="block text-sm font-medium text-indusia-text mb-2">Customer ID (optional)</label>
                  <input type="text" value={customerForm.id} onChange={(e) => setCustomerForm(prev => ({ ...prev, id: e.target.value }))} placeholder="Auto-generated if empty" className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={handleCustomerSave} className="flex-1 px-4 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> {editingCustomer ? 'Update' : 'Add'}
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

      {activeTab === 'sections' && (
        <div className="grid grid-cols-2 gap-6">
          <Card title="Sections" subtitle={`${sectionList.length} sections`}>
            <table className="w-full">
              <thead className="border-b border-indusia-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Section Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Section ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sectionList.map(section => (
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
          </Card>

          <Card title={editingSection ? 'Edit Section' : 'Add Section'}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Section Name</label>
                <input type="text" value={sectionForm.name} onChange={(e) => setSectionForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Enter section name" className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" />
              </div>
              {!editingSection && (
                <div>
                  <label className="block text-sm font-medium text-indusia-text mb-2">Section ID (optional)</label>
                  <input type="text" value={sectionForm.id} onChange={(e) => setSectionForm(prev => ({ ...prev, id: e.target.value }))} placeholder="Auto-generated if empty" className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={handleSectionSave} className="flex-1 px-4 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> {editingSection ? 'Update' : 'Add'}
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

      {activeTab === 'mapping' && (
        <Card title="Customer-Section Mapping" subtitle="Define which sections are valid for each customer">
          <div className="space-y-4">
            {customerList.map(customer => (
              <div key={customer.id} className="p-4 bg-indusia-surfaceMuted rounded-lg">
                <h4 className="font-semibold text-indusia-text mb-3">{customer.name}</h4>
                <div className="flex flex-wrap gap-3">
                  {sectionList.map(section => (
                    <label key={section.id} className="flex items-center gap-2 px-4 py-2 bg-indusia-surface border border-indusia-border rounded-lg cursor-pointer hover:border-indusia-primary transition-colors">
                      <input type="checkbox" checked={isCustomerSectionMapped(customer.id, section.id)} onChange={() => toggleCustomerSection(customer.id, section.id)} className="w-4 h-4 text-indusia-primary" />
                      <span className="text-sm text-indusia-text">{section.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'lines' && (
        <div className="grid grid-cols-2 gap-6">
          <Card title="Production Lines" subtitle={`${lineList.length} lines`}>
            <table className="w-full">
              <thead className="border-b border-indusia-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Line Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Section</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lineList.map(line => {
                  const customer = customerList.find(c => c.id === line.customerId);
                  const section = sectionList.find(s => s.id === line.sectionId);
                  return (
                    <tr key={line.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted">
                      <td className="px-4 py-3 text-sm text-indusia-text">{line.name}</td>
                      <td className="px-4 py-3 text-sm text-indusia-textMuted">{customer?.name}</td>
                      <td className="px-4 py-3 text-sm text-indusia-textMuted">{section?.name}</td>
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
          </Card>

          <Card title={editingLine ? 'Edit Line' : 'Add Line'}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Line Name</label>
                <input type="text" value={lineForm.name} onChange={(e) => setLineForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Enter line name" className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Customer</label>
                <select value={lineForm.customerId} onChange={(e) => setLineForm(prev => ({ ...prev, customerId: e.target.value }))} className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary">
                  <option value="">Select customer...</option>
                  {customerList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Section</label>
                <select value={lineForm.sectionId} onChange={(e) => setLineForm(prev => ({ ...prev, sectionId: e.target.value }))} className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary">
                  <option value="">Select section...</option>
                  {sectionList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={handleLineSave} className="flex-1 px-4 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> {editingLine ? 'Update' : 'Add'}
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

      {activeTab === 'boards' && (
        <div className="grid grid-cols-2 gap-6">
          <Card title="Boards / Models" subtitle={`${boardList.length} boards`}>
            <table className="w-full">
              <thead className="border-b border-indusia-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Board Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Board ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {boardList.map(board => {
                  const customer = customerList.find(c => c.id === board.customerId);
                  return (
                    <tr key={board.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted">
                      <td className="px-4 py-3 text-sm text-indusia-text">{board.name}</td>
                      <td className="px-4 py-3 text-sm text-indusia-textMuted font-mono">{board.id}</td>
                      <td className="px-4 py-3 text-sm text-indusia-textMuted">{customer?.name}</td>
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
          </Card>

          <Card title={editingBoard ? 'Edit Board' : 'Add Board'}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Board Name</label>
                <input type="text" value={boardForm.name} onChange={(e) => setBoardForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Enter board name" className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Customer</label>
                <select value={boardForm.customerId} onChange={(e) => setBoardForm(prev => ({ ...prev, customerId: e.target.value }))} className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary">
                  <option value="">Select customer...</option>
                  {customerList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {!editingBoard && (
                <div>
                  <label className="block text-sm font-medium text-indusia-text mb-2">Board ID (optional)</label>
                  <input type="text" value={boardForm.id} onChange={(e) => setBoardForm(prev => ({ ...prev, id: e.target.value }))} placeholder="Auto-generated if empty" className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={handleBoardSave} className="flex-1 px-4 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> {editingBoard ? 'Update' : 'Add'}
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

      {activeTab === 'users' && (
        <div className="grid grid-cols-2 gap-6">
          <Card title="Registered Users" subtitle={`${filteredUsers.length} users`}>
            <div className="mb-4 flex gap-2">
              {['all', 'operator', 'manager'].map(filter => (
                <button key={filter} onClick={() => setUserFilter(filter)} className={`px-3 py-1 rounded text-sm font-medium transition-all capitalize ${userFilter === filter ? 'bg-indusia-primary text-white' : 'bg-indusia-surfaceMuted text-indusia-textMuted hover:text-indusia-text'}`}>
                  {filter}
                </button>
              ))}
            </div>
            <table className="w-full">
              <thead className="border-b border-indusia-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Sections</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-indusia-textMuted uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const userSections = user.sections.map(sid => sectionList.find(s => s.id === sid)?.name).filter(Boolean).join(', ');
                  return (
                    <tr key={user.id} className="border-b border-indusia-border hover:bg-indusia-surfaceMuted">
                      <td className="px-4 py-3 text-sm text-indusia-text">{user.name}</td>
                      <td className="px-4 py-3 text-sm text-indusia-textMuted capitalize">{user.role}</td>
                      <td className="px-4 py-3 text-sm text-indusia-textMuted">{userSections || 'None'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingUser(user); setUserForm({ ...user }); }} className="p-1 text-indusia-primary hover:bg-indusia-primary/10 rounded">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleUserDelete(user.id)} className="p-1 text-indusia-fail hover:bg-indusia-fail/10 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <Card title={editingUser ? 'Edit User' : 'Add User'}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Name</label>
                <input type="text" value={userForm.name} onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Enter user name" className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Role</label>
                <select value={userForm.role} onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))} className="w-full px-4 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary">
                  <option value="operator">Operator</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Sections</label>
                <div className="flex flex-wrap gap-2">
                  {sectionList.map(section => (
                    <label key={section.id} className="flex items-center gap-2 px-3 py-2 bg-indusia-surfaceMuted border border-indusia-border rounded-lg cursor-pointer hover:border-indusia-primary transition-colors">
                      <input type="checkbox" checked={userForm.sections.includes(section.id)} onChange={() => toggleUserSection(section.id)} className="w-4 h-4 text-indusia-primary" />
                      <span className="text-sm text-indusia-text">{section.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleUserSave} className="flex-1 px-4 py-2 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> {editingUser ? 'Update' : 'Add'}
                </button>
                {editingUser && (
                  <button onClick={() => { setEditingUser(null); setUserForm({ id: '', name: '', role: 'operator', sections: [] }); }} className="px-4 py-2 bg-indusia-surfaceMuted text-indusia-text rounded-lg font-medium hover:bg-indusia-border flex items-center gap-2">
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
