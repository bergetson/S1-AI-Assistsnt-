'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ViewMode = 'soldier' | 'commander'

interface ViewModeStore {
  mode: ViewMode
  setMode: (mode: ViewMode) => void
  toggleMode: () => void
}

// Which hat the user is wearing. Drives the navbar link set so the two contexts
// stay separate — a commander doing force management shouldn't be looking at
// their own promotion timeline in the same nav.
export const useViewModeStore = create<ViewModeStore>()(
  persist(
    (set, get) => ({
      mode: 'soldier',
      setMode: (mode) => set({ mode }),
      toggleMode: () => set({ mode: get().mode === 'soldier' ? 'commander' : 'soldier' }),
    }),
    { name: 'mtarng-viewmode' }
  )
)
