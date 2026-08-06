'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TuningOverrides, GateOverride, RetentionOverride, RankingWeights, Assumptions } from './rules/tuning'
import type { RuleStatus } from './rules/types'

/** A reviewer's sign-off on one rule. Separate from the number itself. */
export interface RuleReview {
  status: RuleStatus
  reviewedBy: string
  lastReviewed: string
  note?: string
}

interface RulesState {
  overrides: TuningOverrides
  reviews: Record<string, RuleReview>
  /**
   * Bumped on every change. Views must include this in their useMemo deps —
   * the analytics tables are mutated in place, so nothing else tells React
   * that a result computed from [roster, uics] is now stale.
   */
  version: number

  setGate: (grade: string, patch: GateOverride) => void
  setRetention: (grade: string, patch: RetentionOverride) => void
  setRanking: (patch: Partial<RankingWeights>) => void
  setAssumptions: (patch: Partial<Assumptions>) => void
  setReview: (ruleId: string, review: RuleReview | null) => void
  resetAll: () => void
  resetGroup: (group: 'gates' | 'retention' | 'ranking' | 'assumptions') => void
}

export const useRulesStore = create<RulesState>()(
  persist(
    (set) => ({
      overrides: {},
      reviews: {},
      version: 0,

      setGate: (grade, patch) => set(s => ({
        version: s.version + 1,
        overrides: {
          ...s.overrides,
          gates: { ...s.overrides.gates, [grade]: { ...s.overrides.gates?.[grade], ...patch } },
        },
      })),

      setRetention: (grade, patch) => set(s => ({
        version: s.version + 1,
        overrides: {
          ...s.overrides,
          retention: { ...s.overrides.retention, [grade]: { ...s.overrides.retention?.[grade], ...patch } },
        },
      })),

      setRanking: (patch) => set(s => ({
        version: s.version + 1,
        overrides: { ...s.overrides, ranking: { ...s.overrides.ranking, ...patch } },
      })),

      setAssumptions: (patch) => set(s => ({
        version: s.version + 1,
        overrides: { ...s.overrides, assumptions: { ...s.overrides.assumptions, ...patch } },
      })),

      setReview: (ruleId, review) => set(s => {
        const reviews = { ...s.reviews }
        if (review) reviews[ruleId] = review
        else delete reviews[ruleId]
        return { reviews, version: s.version + 1 }
      }),

      resetGroup: (group) => set(s => {
        const overrides = { ...s.overrides }
        delete overrides[group]
        return { overrides, version: s.version + 1 }
      }),

      resetAll: () => set(s => ({ overrides: {}, reviews: {}, version: s.version + 1 })),
    }),
    { name: 'mtarng-rules' }
  )
)
