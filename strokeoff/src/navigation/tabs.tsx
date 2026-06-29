import type { ComponentType, SVGProps } from 'react'
import {
  CommunityIcon,
  HistoryIcon,
  HomeIcon,
  RoundIcon,
  RulesIcon,
} from '@/components/icons'

export interface TabDef {
  /** Route path; the Home tab is the index route. */
  path: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  end?: boolean
}

/**
 * The five static tabs (spec §3). The tab bar never changes — only the content of
 * each route adapts to round state. This array is the single source of truth for
 * both the router and the bottom tab bar.
 */
export const TABS: TabDef[] = [
  { path: '/', label: 'Home', icon: HomeIcon, end: true },
  { path: '/round', label: 'Round', icon: RoundIcon },
  { path: '/rules', label: 'Rules', icon: RulesIcon },
  { path: '/history', label: 'History', icon: HistoryIcon },
  { path: '/community', label: 'Community', icon: CommunityIcon },
]
