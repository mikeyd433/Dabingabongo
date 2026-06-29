import { NavLink } from 'react-router-dom'
import { TABS } from '@/navigation/tabs'

/**
 * Persistent bottom tab bar (spec §3). Token-driven: colors come from theme CSS
 * variables, the active tab uses the theme accent. Tap targets are ≥44px for
 * one-handed outdoor use.
 */
export function TabBar() {
  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-10 border-t border-border bg-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-screen-sm">
        {TABS.map(({ path, label, icon: Icon, end }) => (
          <li key={path} className="flex-1">
            <NavLink
              to={path}
              end={end}
              className="flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-label text-muted transition-colors aria-[current=page]:text-accent"
            >
              {({ isActive }) => (
                <>
                  <Icon
                    width={24}
                    height={24}
                    aria-hidden
                    style={{
                      color: isActive
                        ? 'var(--color-accent)'
                        : 'var(--color-muted)',
                    }}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
