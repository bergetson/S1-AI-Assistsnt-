'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlannerTrack } from './careerPlanner'

interface PlannerStore {
  // slotId → chosen position id
  selections: Record<string, number>
  // slotId → chosen time-in-position (years)
  dwell: Record<string, number>
  // career track: stay current, or commission via OCS / WOCS (enlisted only)
  track: PlannerTrack
  // enlisted grade after which the soldier commissions (e.g. 'E5')
  commissionAfterGrade: string

  setSelection: (slotId: string, positionId: number) => void
  setDwell: (slotId: string, years: number) => void
  setTrack: (track: PlannerTrack) => void
  setCommissionAfterGrade: (grade: string) => void
  resetPlan: () => void
}

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set, get) => ({
      selections: {},
      dwell: {},
      track: 'current',
      commissionAfterGrade: '',

      setSelection: (slotId, positionId) =>
        set({ selections: { ...get().selections, [slotId]: positionId } }),
      setDwell: (slotId, years) =>
        set({ dwell: { ...get().dwell, [slotId]: years } }),
      setTrack: (track) => set({ track }),
      setCommissionAfterGrade: (grade) => set({ commissionAfterGrade: grade }),
      resetPlan: () => set({ selections: {}, dwell: {} }),
    }),
    { name: 'mtarng-planner' }
  )
)
