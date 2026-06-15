'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlannerTrack, Pick } from './careerPlanner'

interface PlannerStore {
  // phaseId → ordered list of jobs (position + dwell) planned at that grade
  phasePicks: Record<string, Pick[]>
  // career track: stay current, or commission via OCS / WOCS (enlisted only)
  track: PlannerTrack
  // enlisted grade after which the soldier commissions (e.g. 'E5')
  commissionAfterGrade: string

  setPhasePicks: (phaseId: string, picks: Pick[]) => void
  setTrack: (track: PlannerTrack) => void
  setCommissionAfterGrade: (grade: string) => void
  resetPlan: () => void
}

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set, get) => ({
      phasePicks: {},
      track: 'current',
      commissionAfterGrade: '',

      setPhasePicks: (phaseId, picks) =>
        set({ phasePicks: { ...get().phasePicks, [phaseId]: picks } }),
      setTrack: (track) => set({ track }),
      setCommissionAfterGrade: (grade) => set({ commissionAfterGrade: grade }),
      resetPlan: () => set({ phasePicks: {} }),
    }),
    { name: 'mtarng-planner' }
  )
)
