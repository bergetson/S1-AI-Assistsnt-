'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RosterSoldier } from './commandTypes'

export type RosterSource = 'demo' | 'imported'

interface CommandStore {
  /** The commander's force. Demo data until a real roster is imported. */
  roster: RosterSoldier[]
  /** Which UICs make up the selected formation. Empty = nothing selected yet. */
  selectedUics: string[]
  /** Forecast window in years. */
  horizonYears: number
  /** Drives the persistent DEMO banner — never let real and demo data look alike. */
  source: RosterSource
  /** Opt-in: include free-text eval bullets in AI payloads. Off by default. */
  shareEvalBullets: boolean

  setRoster: (roster: RosterSoldier[], source: RosterSource) => void
  setSelectedUics: (uics: string[]) => void
  toggleUic: (uic: string) => void
  clearFormation: () => void
  setHorizon: (years: number) => void
  setShareEvalBullets: (v: boolean) => void
  resetCommand: () => void
}

export const useCommandStore = create<CommandStore>()(
  persist(
    (set, get) => ({
      roster: [],
      selectedUics: [],
      horizonYears: 5,
      source: 'demo',
      shareEvalBullets: false,

      setRoster: (roster, source) => set({ roster, source }),
      setSelectedUics: (selectedUics) => set({ selectedUics }),
      toggleUic: (uic) => {
        const cur = get().selectedUics
        set({
          selectedUics: cur.includes(uic)
            ? cur.filter(u => u !== uic)
            : [...cur, uic],
        })
      },
      clearFormation: () => set({ selectedUics: [] }),
      setHorizon: (horizonYears) => set({ horizonYears }),
      setShareEvalBullets: (shareEvalBullets) => set({ shareEvalBullets }),
      resetCommand: () => set({ roster: [], selectedUics: [], source: 'demo' }),
    }),
    { name: 'mtarng-command' }
  )
)
