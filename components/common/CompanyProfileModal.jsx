'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Building2, Upload, Trash2, Loader2, Globe, Phone, Mail, MapPin } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useToast } from '@/hooks/useToast'

export default function CompanyProfileModal({ isOpen, onClose }) {
  const { t } = useI18n()
  const { showToast } = useToast()
  const {
    companyName, companyLogo, companyAddress, companyWebsite, companyPhone, companyEmail,
    updateSettings, loading: settingsLoading,
  } = useSystemSettings()

  const [form, setForm] = useState({
    name: '',
    logo: null,
    address: '',
    website: '',
    phone: '',
    email: '',
  })
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const logoInputRef = useRef(null)

  // Sync form from settings when loaded
  useEffect(() => {
    if (!settingsLoading && isOpen) {
      setForm({
        name: companyName,
        logo: companyLogo,
        address: companyAddress,
        website: companyWebsite,
        phone: companyPhone,
        email: companyEmail,
      })
      setDirty(false)
    }
  }, [settingsLoading, isOpen, companyName, companyLogo, companyAddress, companyWebsite, companyPhone, companyEmail])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  const handleLogoUpload = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.size > 200 * 1024) {
      alert(t('profile.fileTooLarge'))
      return
    }
    if (!file.type.startsWith('image/')) {
      alert(t('profile.invalidFormat'))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      updateField('logo', reader.result)
    }
    reader.readAsDataURL(file)
  }, [t])

  const handleRemoveLogo = () => {
    updateField('logo', null)
  }

  const handleSave = async () => {
    setSaving(true)
    const result = await updateSettings({
      company_name: form.name.trim() || 'Company',
      company_logo: form.logo,
      company_address: form.address.trim(),
      company_website: form.website.trim(),
      company_phone: form.phone.trim(),
      company_email: form.email.trim(),
    })
    setSaving(false)

    if (result.success) {
      setDirty(false)
      showToast(t('profile.saved'))
      onClose()
    } else {
      alert(result.error || t('profile.saveFailed'))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-indusia-surface rounded-xl shadow-2xl border border-indusia-border w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-indusia-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indusia-primary" />
            <h2 className="text-lg font-semibold text-indusia-text">
              {t('profile.companyProfile')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-indusia-textMuted hover:text-indusia-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-indusia-textMuted">{t('profile.companyProfileDesc')}</p>

          {/* Logo Section */}
          <div>
            <label className="block text-sm font-medium text-indusia-textMuted mb-2">
              {t('profile.companyLogo')}
            </label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-indusia-border bg-indusia-bg flex items-center justify-center overflow-hidden shrink-0">
                {form.logo ? (
                  <img src={form.logo} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <Building2 className="w-8 h-8 text-indusia-textMuted/40" />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indusia-border text-sm text-indusia-textMuted hover:text-indusia-text hover:bg-indusia-surfaceMuted transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {form.logo ? t('profile.changeLogo') : t('profile.uploadLogo')}
                  </button>
                  {form.logo && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indusia-border text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('profile.removeLogo')}
                    </button>
                  )}
                </div>
                <p className="text-xs text-indusia-textMuted/60">{t('profile.logoHint')}</p>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-indusia-textMuted mb-1">
              {t('profile.companyName')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. PCI Batam"
              maxLength={100}
              className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text placeholder-indusia-textMuted/50 focus:outline-none focus:border-indusia-primary"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-indusia-textMuted mb-1">
              <MapPin className="w-3.5 h-3.5 inline mr-1" />
              {t('profile.companyAddress')}
            </label>
            <textarea
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="Jl. Industrial Estate, Batam, Indonesia"
              rows={2}
              maxLength={300}
              className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text placeholder-indusia-textMuted/50 focus:outline-none focus:border-indusia-primary resize-none"
            />
          </div>

          {/* Website & Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-indusia-textMuted mb-1">
                <Globe className="w-3.5 h-3.5 inline mr-1" />
                {t('profile.companyWebsite')}
              </label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder="https://example.com"
                maxLength={200}
                className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text placeholder-indusia-textMuted/50 focus:outline-none focus:border-indusia-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-indusia-textMuted mb-1">
                <Phone className="w-3.5 h-3.5 inline mr-1" />
                {t('profile.companyPhone')}
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+62 778 123456"
                maxLength={30}
                className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text placeholder-indusia-textMuted/50 focus:outline-none focus:border-indusia-primary"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-indusia-textMuted mb-1">
              <Mail className="w-3.5 h-3.5 inline mr-1" />
              {t('profile.companyEmail')}
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="info@company.com"
              maxLength={200}
              className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-sm text-indusia-text placeholder-indusia-textMuted/50 focus:outline-none focus:border-indusia-primary"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-indusia-border flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-indusia-border text-indusia-textMuted rounded-lg hover:bg-indusia-surfaceMuted transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty || !form.name.trim()}
            className="px-4 py-2 text-sm bg-indusia-primary text-white font-medium rounded-lg hover:bg-indusia-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? t('profile.saving') : t('profile.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  )
}
