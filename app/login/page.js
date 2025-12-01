'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { customers, sections, customerSections, lines, userProfiles } from '@/data/masterData';
import { LogIn, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithProfile } = useAuth();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedLineId, setSelectedLineId] = useState('');

  const allowedSections = useMemo(() => {
    if (!selectedProfile || selectedProfile.role !== 'operator') return [];
    return sections.filter(s => selectedProfile.sections.includes(s.id));
  }, [selectedProfile]);

  const allowedCustomers = useMemo(() => {
    if (!selectedSectionId) return [];
    const customerIdsForSection = customerSections
      .filter(cs => cs.sectionId === selectedSectionId)
      .map(cs => cs.customerId);
    return customers.filter(c => customerIdsForSection.includes(c.id));
  }, [selectedSectionId]);

  const allowedLines = useMemo(() => {
    if (!selectedCustomerId || !selectedSectionId) return [];
    return lines.filter(l => l.customerId === selectedCustomerId && l.sectionId === selectedSectionId);
  }, [selectedCustomerId, selectedSectionId]);

  const handleUserChange = (e) => {
    const id = e.target.value;
    const profile = userProfiles.find(u => u.id === id) || null;

    setSelectedUserId(id);
    setSelectedProfile(profile);
    setPassword('');
    setPasswordError('');
    setSelectedSectionId('');
    setSelectedCustomerId('');
    setSelectedLineId('');
  };

  const handleSectionChange = (sectionId) => {
    setSelectedSectionId(sectionId);
    setSelectedCustomerId('');
    setSelectedLineId('');
  };

  const handleCustomerChange = (customerId) => {
    setSelectedCustomerId(customerId);
    setSelectedLineId('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setPasswordError('');

    if (!selectedProfile) {
      setPasswordError('Please select a user.');
      return;
    }

    if (!password) {
      setPasswordError('Please enter password.');
      return;
    }

    if (password !== selectedProfile.password) {
      setPasswordError('Incorrect password.');
      return;
    }

    if (selectedProfile.role === 'operator') {
      if (!selectedSectionId || !selectedCustomerId || !selectedLineId) {
        setPasswordError('Please select Section, Customer, and Line.');
        return;
      }

      loginWithProfile(selectedProfile, {
        sectionId: selectedSectionId,
        customerId: selectedCustomerId,
        lineId: selectedLineId,
      });

      router.push('/inspection/result/current');
      return;
    }

    loginWithProfile(selectedProfile);

    if (selectedProfile.role === 'manager') {
      router.push('/inspection/overrides');
    } else if (selectedProfile.role === 'engineer') {
      router.push('/engineering/master-data');
    } else if (selectedProfile.role === 'superadmin') {
      router.push('/engineering/master-data');
    }
  };

  return (
    <div className="min-h-screen bg-indusia-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-indusia-surface rounded-xl shadow-2xl border border-indusia-border overflow-hidden">
          <div className="bg-gradient-to-r from-indusia-primary to-indusia-primary/80 px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <LogIn className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">INDUSIA AI</h1>
                <p className="text-white/80 text-sm">Login</p>
              </div>
            </div>
          </div>

          <div className="px-8 py-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-indusia-text mb-2">
                {selectedProfile?.role === 'operator' ? 'Operator Login' : 'User Login'}
              </h2>
              <p className="text-sm text-indusia-textMuted">
                {selectedProfile?.role === 'operator'
                  ? 'Select your profile, workstation context, and enter credentials.'
                  : 'Select your profile and enter your password.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">Username</label>
                <select
                  value={selectedUserId}
                  onChange={handleUserChange}
                  className="w-full px-4 py-3 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary focus:border-transparent"
                >
                  <option value="">Select username...</option>
                  {userProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} ({profile.role})
                    </option>
                  ))}
                </select>
              </div>

              {selectedProfile && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-indusia-text mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full px-4 py-3 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary focus:border-transparent pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-indusia-textMuted hover:text-indusia-text transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {selectedProfile.role === 'operator' && (
                    <>
                      <div className="pt-2 border-t border-indusia-border">
                        <p className="text-xs font-semibold text-indusia-textMuted uppercase mb-3">
                          Workstation Context
                        </p>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-indusia-text mb-2">Section</label>
                            <select
                              value={selectedSectionId}
                              onChange={(e) => handleSectionChange(e.target.value)}
                              className="w-full px-4 py-3 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary focus:border-transparent"
                            >
                              <option value="">Select section...</option>
                              {allowedSections.map((section) => (
                                <option key={section.id} value={section.id}>
                                  {section.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {selectedSectionId && (
                            <div>
                              <label className="block text-sm font-medium text-indusia-text mb-2">Customer</label>
                              <select
                                value={selectedCustomerId}
                                onChange={(e) => handleCustomerChange(e.target.value)}
                                className="w-full px-4 py-3 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary focus:border-transparent"
                              >
                                <option value="">Select customer...</option>
                                {allowedCustomers.map((customer) => (
                                  <option key={customer.id} value={customer.id}>
                                    {customer.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {selectedCustomerId && (
                            <div>
                              <label className="block text-sm font-medium text-indusia-text mb-2">
                                Production Line
                              </label>
                              <select
                                value={selectedLineId}
                                onChange={(e) => setSelectedLineId(e.target.value)}
                                className="w-full px-4 py-3 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary focus:border-transparent"
                              >
                                <option value="">Select line...</option>
                                {allowedLines.map((line) => (
                                  <option key={line.id} value={line.id}>
                                    {line.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {passwordError && (
                <div className="bg-indusia-fail/10 border border-indusia-fail rounded-lg px-4 py-3">
                  <p className="text-indusia-fail text-sm">{passwordError}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full px-6 py-4 bg-indusia-primary text-white rounded-lg font-semibold text-base hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <LogIn className="w-5 h-5" />
                Login
              </button>
            </form>
          </div>

          <div className="px-8 py-4 bg-indusia-surfaceMuted border-t border-indusia-border">
            <p className="text-xs text-indusia-textMuted text-center">
              INDUSIA AI Visual Inspection System v1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
