import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

/**
 * Token-driven button primitive. Primary uses the theme accent; secondary is a
 * bordered surface. No hardcoded colors — restyles automatically with the theme.
 */
export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex min-h-[44px] items-center justify-center rounded-card px-5 py-2.5 font-label text-sm font-semibold transition-opacity disabled:opacity-50'
  const styles =
    variant === 'primary'
      ? 'bg-accent text-accent-contrast hover:opacity-90'
      : 'border border-border bg-surface text-text hover:opacity-90'

  return <button className={`${base} ${styles} ${className}`} {...props} />
}
