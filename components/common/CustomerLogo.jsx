'use client'

import { cn } from '@/lib/utils'

const SIZES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
}

/**
 * CustomerLogo component
 * Shows customer logo (base64) or initials fallback
 */
export default function CustomerLogo({ customer, size = 'sm', className }) {
  const sizeClass = SIZES[size] || SIZES.sm
  const name = customer?.name || '?'
  const initials = name
    .split(/[\s-]+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Support both camelCase (from masterDataRepo) and snake_case (from WO repo joins)
  const logo = customer?.logoBase64 || customer?.logo_base64

  if (logo) {
    return (
      <img
        src={logo}
        alt={name}
        className={cn(sizeClass, 'rounded object-contain bg-white/5', className)}
      />
    )
  }

  return (
    <div
      className={cn(
        sizeClass,
        'rounded bg-phosphor-teal/10 border border-phosphor-teal/20',
        'flex items-center justify-center font-mono font-bold text-phosphor-teal',
        className
      )}
      title={name}
    >
      {initials}
    </div>
  )
}
