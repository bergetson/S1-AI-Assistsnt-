'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ViewMode = 'soldier' | 'commander' | 'talent'

export const VIEW_MODE_LABEL: Record<ViewMode, string> = {
  soldier: 'Soldier',
  commander: 'Commander',
  talent: 'Talent Manager',
}

export const VIEW_MODE_ICON: Record<ViewMode, string> = {
  soldier: '🎖️', commander: '🛡️', talent: '🧩',
}

/** Landing route for each hat. */
export const VIEW_MODE_HOME: Record<ViewMode, string> = {
  soldier: '/', commander: '/command', talent: '/talent',
}

export const VIEW_MODE_SUBTITLE: Record<ViewMode, string> = {
  soldier: 'S1 Career Manager · MT ARNG',
  commander: 'Force Management · MT ARNG',
  talent: 'Talent Management & State G1 · MT ARNG',
}

/**
 * Which hat a URL belongs to, so deep links always show the right nav.
 *
 * The old /g1-state-view tree still resolves to 'talent' — those routes are
 * redirect stubs now, and during the redirect flash the nav should already be
 * the one the user is about to land in.
 */
export function modeForPath(pathname: string): ViewMode | null {
  if (pathname.startsWith('/command')) return 'commander'
  if (pathname.startsWith('/talent')) return 'talent'
  if (pathname.startsWith('/g1-state-view')) return 'talent'
  return null
}

interface ViewModeStore {
  mode: ViewMode
  setMode: (mode: ViewMode) => void
}

// Which hat the user is wearing. Drives the navbar link set so the contexts stay
// separate — a commander doing force management should not be looking at their
// own promotion timeline in the same nav.
export const useViewModeStore = create<ViewModeStore>()(
  persist(
    (set) => ({
      mode: 'soldier',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'mtarng-viewmode',
      // 'g1' was a fourth hat until the G1 and talent-manager views merged.
      // A returning user's localStorage still holds it, and an unmapped mode
      // indexes the navbar's link table as undefined and crashes on load.
      version: 1,
      migrate: (persisted, from) => {
        const s = persisted as { mode?: string } | undefined
        if (from < 1 && s?.mode === 'g1') return { ...s, mode: 'talent' } as unknown as ViewModeStore
        return s as unknown as ViewModeStore
      },
    }
  )
)
