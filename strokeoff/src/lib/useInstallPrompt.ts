import { useCallback, useEffect, useState } from 'react'

/**
 * The non-standard `beforeinstallprompt` event (Chromium). Captured so the app can
 * offer its own install affordance instead of relying on the browser's UI.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt: () => Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface InstallPrompt {
  /** True when the browser has offered an install and the user hasn't installed yet. */
  canInstall: boolean
  /** Trigger the native install dialog; resolves to whether the user accepted. */
  promptInstall: () => Promise<boolean>
}

/** Phase 10 — capture the install event so we can surface an "Install" action (spec §2). */
export function useInstallPrompt(): InstallPrompt {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // Prevent the mini-infobar so we can present the prompt on our terms.
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setDeferred(null)

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferred) return false
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    // The event can only be used once.
    setDeferred(null)
    return outcome === 'accepted'
  }, [deferred])

  return { canInstall: deferred !== null, promptInstall }
}
