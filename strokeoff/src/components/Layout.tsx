import { Outlet } from 'react-router-dom'
import { TabBar } from './TabBar'
import { ThemeSwitcher } from './ThemeSwitcher'
import { HealthIndicator } from './HealthIndicator'

/**
 * Base app layout: a themed header (wordmark + connectivity + theme switcher), the
 * scrollable routed content, and the persistent bottom tab bar. Every surface here
 * is token-driven (spec §13).
 */
export function Layout() {
  return (
    <div className="flex h-full flex-col bg-bg text-text">
      <header
        className="sticky top-0 z-10 border-b border-border bg-surface"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-screen-sm items-center justify-between gap-3 px-4 py-3">
          <span className="font-display text-lg font-bold tracking-tight text-text">
            Stroke<span className="text-accent"> Off</span>
          </span>
          <div className="flex items-center gap-3">
            <HealthIndicator />
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-screen-sm flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <TabBar />
    </div>
  )
}
