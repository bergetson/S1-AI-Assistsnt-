'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ViewMode = 'soldier' | 'commander' | 'talent' | 'g1'

export const VIEW_MODE_LABEL: Record<ViewMode, string> = {
  soldier: 'Soldier',
  commander: 'Commander',
  talent: 'Talent Manager',
  g1: 'G1 State',
}

export const VIEW_MODE_ICON: Record<ViewMode, string> = {
  soldier: '🎖️', commander: '🛡️', talent: '🧩', g1: '🗺️',
}

/** Landing route for each hat. */
export const VIEW_MODE_HOME: Record<ViewMode, string> = {
  soldier: '/', commander: '/command', talent: '/talent', g1: '/g1-state-view',
}

export const VIEW_MODE_SUBTITLE: Record<ViewMode, string> = {
  soldier: 'S1 Career Manager · MT ARNG',
  commander: 'Force Management · MT ARNG',
  talent: 'Talent Management · MT ARNG',
  g1: 'State Personnel Analytics · MT ARNG',
}

/** Which hat a URL belongs to, so deep links always show the right nav. */
export function modeForPath(pathname: string): ViewMode | null {
  if (pathname.startsWith('/command')) return 'commander'
  if (pathname.startsWith('/talent')) return 'talent'
  if (pathname.startsWith('/g1-state-view')) return 'g1'
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
    { name: 'mtarng-viewmode' }
  )
)
