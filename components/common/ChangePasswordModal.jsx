'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, KeyRound, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { useToast } from '@/hooks/useToast'

export default function ChangePasswordModal({ isOpen, onClose }) {
  const router = useRouter()
  const { changePassword, logout } = useAuth()
  const { t } = useI18n()
  const { showToast } = useToast()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const resetForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowCurrent(false)
    setShowNew(false)
    setError('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  // Validate password requirements
  const hasUppercase = /[A-Z]/.test(newPassword)
  const hasLowercase = /[a-z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  const hasMinLength = newPassword.length >= 8
  const notSameAsCurrent = newPassword.length > 0 && currentPassword.length > 0 && newPassword !== currentPassword
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0
  const isValid = hasUppercase && hasLowercase && hasNumber && hasMinLength && notSameAsCurrent && passwordsMatch && currentPassword.length > 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid || isSubmitting) return

    setIsSubmitting(true)
    setError('')

    try {
      const result = await changePassword(currentPassword, newPassword)

      if (result.success) {
        showToast(t('password.changeSuccess'))
        handleClose()
        // Logout and redirect to login after successful password change
        logout()
        router.push('/login')
      } else {
        setError(result.error || t('password.changeFailed'))
      }
    } catch (err) {
      setError(t('password.changeFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative bg-indusia-surface rounded-xl shadow-2xl border border-indusia-border w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-indusia-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indusia-primary" />
            <h2 className="text-lg font-semibold text-indusia-text">
              {t('password.changeTitle')}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-indusia-textMuted hover:text-indusia-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <p className="text-sm text-indusia-textMuted">{t('password.changeDescription')}</p>

          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-indusia-textMuted mb-1">
              {t('password.currentPassword')}
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text placeholder-indusia-textMuted/50 focus:outline-none focus:border-indusia-primary"
                placeholder={t('password.currentPasswordPlaceholder')}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-indusia-textMuted hover:text-indusia-text"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-indusia-textMuted mb-1">
              {t('password.newPassword')}
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text placeholder-indusia-textMuted/50 focus:outline-none focus:border-indusia-primary"
                placeholder={t('password.newPasswordPlaceholder')}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-indusia-textMuted hover:text-indusia-text"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password requirements */}
            {newPassword.length > 0 && (
              <div className="mt-2 space-y-1 text-xs">
                <div className={hasMinLength ? 'text-indusia-pass' : 'text-indusia-textMuted'}>
                  {hasMinLength ? '\u2713' : '\u2022'} {t('password.reqMinLength')}
                </div>
                <div className={hasUppercase ? 'text-indusia-pass' : 'text-indusia-textMuted'}>
                  {hasUppercase ? '\u2713' : '\u2022'} {t('password.reqUppercase')}
                </div>
                <div className={hasLowercase ? 'text-indusia-pass' : 'text-indusia-textMuted'}>
                  {hasLowercase ? '\u2713' : '\u2022'} {t('password.reqLowercase')}
                </div>
                <div className={hasNumber ? 'text-indusia-pass' : 'text-indusia-textMuted'}>
                  {hasNumber ? '\u2713' : '\u2022'} {t('password.reqNumber')}
                </div>
                {currentPassword.length > 0 && (
                  <div className={notSameAsCurrent ? 'text-indusia-pass' : 'text-indusia-fail'}>
                    {notSameAsCurrent ? '\u2713' : '\u2022'} {t('password.reqDifferent')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-indusia-textMuted mb-1">
              {t('password.confirmPassword')}
            </label>
            <input
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text placeholder-indusia-textMuted/50 focus:outline-none focus:border-indusia-primary"
              placeholder={t('password.confirmPasswordPlaceholder')}
              autoComplete="new-password"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="mt-1 text-xs text-indusia-fail">{t('password.mismatch')}</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-indusia-fail/10 border border-indusia-fail/30 rounded-lg text-sm text-indusia-fail">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm border border-indusia-border text-indusia-textMuted rounded-lg hover:bg-indusia-surfaceMuted transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="px-4 py-2 text-sm bg-indusia-primary text-white font-medium rounded-lg hover:bg-indusia-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('password.changeButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
