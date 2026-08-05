'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MarketplaceCycle, MarketplaceApplication, ApplicationStatus, CommanderEndorsement } from './marketplace/types'
import { transition, createApplication, recordEndorsement } from './marketplace/workflow'

interface MarketplaceStore {
  cycles: MarketplaceCycle[]
  applications: MarketplaceApplication[]
  /** Last transition error, surfaced in the UI instead of failing silently. */
  lastError: string

  addCycle: (c: MarketplaceCycle) => void
  updateCycle: (id: string, patch: Partial<MarketplaceCycle>) => void
  express: (cycleId: string, soldierId: string, positionId: number, at: string) => void
  patchApplication: (id: string, patch: Partial<MarketplaceApplication>) => void
  move: (id: string, to: ApplicationStatus, at: string, note?: string) => void
  endorse: (id: string, e: CommanderEndorsement) => void
  clearError: () => void
  resetMarketplace: () => void
}

export const useMarketplaceStore = create<MarketplaceStore>()(
  persist(
    (set, get) => ({
      cycles: [],
      applications: [],
      lastError: '',

      addCycle: (c) => set({ cycles: [...get().cycles, c] }),
      updateCycle: (id, patch) =>
        set({ cycles: get().cycles.map(c => c.id === id ? { ...c, ...patch } : c) }),

      express: (cycleId, soldierId, positionId, at) => {
        const exists = get().applications.some(
          a => a.cycleId === cycleId && a.soldierId === soldierId && a.positionId === positionId)
        if (exists) { set({ lastError: 'You have already expressed interest in this opportunity.' }); return }
        const id = `app-${cycleId}-${positionId}-${soldierId}`
        set({ applications: [...get().applications, createApplication(id, cycleId, soldierId, positionId, at)], lastError: '' })
      },

      patchApplication: (id, patch) =>
        set({ applications: get().applications.map(a => a.id === id ? { ...a, ...patch } : a) }),

      move: (id, to, at, note) => {
        const app = get().applications.find(a => a.id === id)
        if (!app) { set({ lastError: 'Application not found.' }); return }
        const r = transition(app, to, at, { note })
        if (!r.ok) { set({ lastError: r.error ?? 'Transition not allowed.' }); return }
        set({ applications: get().applications.map(a => a.id === id ? r.application : a), lastError: '' })
      },

      endorse: (id, e) =>
        set({
          applications: get().applications.map(a => a.id === id ? recordEndorsement(a, e) : a),
          lastError: '',
        }),

      clearError: () => set({ lastError: '' }),
      resetMarketplace: () => set({ cycles: [], applications: [], lastError: '' }),
    }),
    { name: 'mtarng-marketplace' }
  )
)
