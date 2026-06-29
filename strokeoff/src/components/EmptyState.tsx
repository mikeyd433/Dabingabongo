import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  message: string
  /** Optional primary call-to-action — empty states are invitations, not apologies. */
  action?: ReactNode
  icon?: ReactNode
}

/**
 * Invitation-style empty state (spec §3 "First-run & empty states"). Fully
 * token-driven — every color/font comes from the active theme.
 */
export function EmptyState({ title, message, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon ? <div className="mb-4 text-accent">{icon}</div> : null}
      <h2 className="font-display text-xl font-semibold text-text">{title}</h2>
      <p className="mt-2 max-w-sm font-label text-sm text-muted">{message}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
