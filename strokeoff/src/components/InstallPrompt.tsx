import { useState } from 'react'
import { Button } from './Button'
import { useInstallPrompt } from '@/lib/useInstallPrompt'

const DISMISS_KEY = 'so-install-dismissed'

function alreadyDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Phase 10 — a dismissible "Add to home screen" banner shown once the browser
 * fires `beforeinstallprompt`. Token-driven; the dismissal is remembered so we
 * don't nag. Renders nothing when install isn't available or was dismissed.
 */
export function InstallPrompt() {
  const { canInstall, promptInstall } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(alreadyDismissed)

  if (!canInstall || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Storage may be unavailable (private mode) — just hide for this session.
    }
  }

  const install = async () => {
    const accepted = await promptInstall()
    if (accepted) dismiss()
  }

  return (
    <div className="border-b border-border bg-surface-alt">
      <div className="mx-auto flex max-w-screen-sm items-center gap-3 px-4 py-2.5">
        <p className="flex-1 font-label text-sm text-text">
          Install Stroke Off for one-tap access and offline scoring.
        </p>
        <Button
          variant="primary"
          className="min-h-[36px] px-3 py-1.5"
          onClick={install}
        >
          Install
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="min-h-[36px] px-2 font-label text-sm text-muted hover:text-text"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
