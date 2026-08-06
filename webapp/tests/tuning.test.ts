import { describe, it, expect, afterEach } from 'vitest'
import { soldier, position } from './fixtures'
import {
  applyTuning, resetTuning, activeRanking, activeAssumptions,
  DEFAULT_RANKING, DEFAULT_ASSUMPTIONS, defaultGate, defaultRetention,
  countTuned, tuningWarnings, tuningContext,
} from '@/lib/rules/tuning'
import { PROMOTION_GATES } from '@/lib/scoring'
import { RETENTION_LIMITS } from '@/lib/data/retention'
import { rankCandidates, boardEligibility, isStaleInPosition, tipStaleYears } from '@/lib/forceAnalytics'
import { allRules } from '@/lib/rules/registry'
import { rulesContext } from '@/lib/rules/aiContext'

// applyTuning mutates the shared gate and retention tables in place, so every
// test here must hand them back. A leak would silently change other suites.
afterEach(() => resetTuning())

describe('tuning applies and fully reverts', () => {
  it('changes a promotion gate the engines read', () => {
    expect(PROMOTION_GATES.E7.minTig).toBe(3)
    applyTuning({ gates: { E7: { minTig: 5 } } })
    expect(PROMOTION_GATES.E7.minTig).toBe(5)
  })

  it('restores every shipped default on reset', () => {
    applyTuning({
      gates: { E7: { minTig: 5, minTis: 99 } },
      retention: { E6: { rcpAgr: 12 } },
      ranking: { mosExact: 50 },
      assumptions: { etsSeparationRate: 0.9 },
    })
    resetTuning()
    for (const [g, live] of Object.entries(PROMOTION_GATES)) {
      expect(live).toEqual(defaultGate(g))
    }
    for (const [g, live] of Object.entries(RETENTION_LIMITS)) {
      expect(live).toEqual(defaultRetention(g))
    }
    expect(activeRanking()).toEqual(DEFAULT_RANKING)
    expect(activeAssumptions()).toEqual(DEFAULT_ASSUMPTIONS)
  })

  it('does not compound when applied twice', () => {
    applyTuning({ gates: { E7: { minTig: 5 } } })
    applyTuning({ gates: { E7: { minTig: 6 } } })
    expect(PROMOTION_GATES.E7.minTig).toBe(6)
    // A field left out of the second call must return to its default, not keep
    // the first call's value.
    applyTuning({})
    expect(PROMOTION_GATES.E7.minTig).toBe(defaultGate('E7')!.minTig)
  })

  it('preserves a null retention cap instead of coercing it to zero', () => {
    // null means "no cap at this grade". Zero would retire everyone instantly.
    expect(RETENTION_LIMITS.O5.rcpAgr).toBeNull()
    applyTuning({ retention: { O5: { mrdCommissioned: 26 } } })
    expect(RETENTION_LIMITS.O5.rcpAgr).toBeNull()
    expect(RETENTION_LIMITS.O5.mrdCommissioned).toBe(26)
  })

  it('lets a cap be deliberately cleared to null', () => {
    applyTuning({ retention: { E6: { rcpAgr: null } } })
    expect(RETENTION_LIMITS.E6.rcpAgr).toBeNull()
  })

  it('ignores a non-finite value rather than poisoning the table', () => {
    applyTuning({ gates: { E7: { minTig: NaN as number } } })
    expect(PROMOTION_GATES.E7.minTig).toBe(defaultGate('E7')!.minTig)
  })
})

describe('tuning changes what the engines conclude', () => {
  it('moves board eligibility when the gate moves', () => {
    const s = soldier({ rank: 'E6', yearsOfService: 14, timeInGrade: 4 })
    expect(boardEligibility(s)).toBe('Eligible')          // E7 gate is 3 yr TIG
    applyTuning({ gates: { E7: { minTig: 6 } } })
    expect(boardEligibility(s)).toBe('Not Eligible')
  })

  it('still answers Unknown when the clocks are missing, whatever the gate', () => {
    // Tuning must never turn "we don't know" into a confident answer.
    const s = soldier({ rank: 'E6', yearsOfService: 0, timeInGrade: 0 })
    expect(boardEligibility(s)).toBe('Unknown')
    applyTuning({ gates: { E7: { minTig: 0, minTis: 0 } } })
    expect(boardEligibility(s)).toBe('Unknown')
  })

  it('moves the stale-in-position threshold', () => {
    const s = soldier({ timeInPosition: 2.5 })
    expect(isStaleInPosition(s)).toBe(false)
    applyTuning({ assumptions: { tipStaleYears: 2 } })
    expect(tipStaleYears()).toBe(2)
    expect(isStaleInPosition(s)).toBe(true)
  })

  it('reweights a candidate slate', () => {
    const target = position({ id: 99, grade: 'E7', mos: '92Y', careerCategory: 'Enlisted', city: 'Helena' })
    const people = [soldier({ id: 'a', rank: 'E6', mos: '92Y', yearsOfService: 14, timeInGrade: 4, city: 'Helena' })]

    const before = rankCandidates(people, target, 5)[0]
    applyTuning({ ranking: { mosExact: 0 } })
    const after = rankCandidates(people, target, 5)[0]

    expect(after.score).toBe(before.score - DEFAULT_RANKING.mosExact)
    // The breakdown must show the new maximum, not the old one.
    expect(after.factors.find(f => f.label === 'MOS fit')?.max).toBe(0)
  })

  it('moves the readiness band without touching the score', () => {
    const target = position({ id: 99, grade: 'E7', mos: '92Y', careerCategory: 'Enlisted', city: 'Helena' })
    const people = [soldier({ id: 'a', rank: 'E6', mos: '92Y', yearsOfService: 14, timeInGrade: 4, city: 'Helena' })]
    const base = rankCandidates(people, target, 5)[0]

    applyTuning({ ranking: { readyNowScore: base.score + 1 } })
    const after = rankCandidates(people, target, 5)[0]
    expect(after.score).toBe(base.score)
    expect(after.readiness).not.toBe('Ready now')
  })
})

describe('tuning warnings', () => {
  it('flags a weight set that no longer totals 100', () => {
    // mosExact ships at 20, so 40 pushes a perfect candidate to 120.
    expect(tuningWarnings({ ranking: { mosExact: 40 } })[0]).toMatch(/scores 120, not 100/)
  })

  it('says nothing when the defaults are untouched', () => {
    expect(tuningWarnings({})).toEqual([])
  })

  it('rejects a positive geography weight', () => {
    expect(tuningWarnings({ ranking: { geoOver120: 5 } }).some(w => /must be zero or negative/.test(w))).toBe(true)
  })

  it('flags overlapping readiness bands', () => {
    expect(tuningWarnings({ ranking: { readyNowScore: 40, readyDevelopmentScore: 45 } })
      .some(w => /no candidate can reach the middle band/.test(w))).toBe(true)
  })

  it('flags a gate whose minimum TIG exceeds its minimum TIS', () => {
    expect(tuningWarnings({ gates: { E7: { minTig: 20 } } })
      .some(w => /nobody can satisfy both/.test(w))).toBe(true)
  })

  it('calls out the ETS rate that made the whole force appear to leave', () => {
    expect(tuningWarnings({ assumptions: { etsSeparationRate: 1 } })
      .some(w => /certain loss/.test(w))).toBe(true)
  })
})

describe('counting and describing changes', () => {
  it('counts only values that actually differ from the default', () => {
    expect(countTuned({})).toBe(0)
    expect(countTuned({ gates: { E7: { minTig: defaultGate('E7')!.minTig } } })).toBe(0)
    expect(countTuned({ gates: { E7: { minTig: 5 } }, ranking: { mosExact: 25 } })).toBe(2)
  })

  it('tells the AI what changed, and that the numbers already reflect it', () => {
    const ctx = tuningContext({ gates: { E7: { minTig: 5 } }, assumptions: { etsSeparationRate: 0.5 } })
    expect(ctx).toMatch(/E7 minTig: 3 → 5/)
    expect(ctx).toMatch(/etsSeparationRate: 0\.3 → 0\.5/)
    expect(ctx).toMatch(/ALREADY reflect these changes/)
  })

  it('says plainly when nothing is tuned', () => {
    expect(tuningContext({})).toMatch(/None\. Every threshold and weight is the shipped default/)
  })
})

describe('the rule registry follows the tuning', () => {
  it('describes the tuned number, not the shipped one', () => {
    // The registry used to cache on first call, so a retune left both the UI
    // and the AI briefing describing the old gate.
    applyTuning({ gates: { E7: { minTig: 5 } } })
    const rule = allRules().find(r => r.id === 'promo.E7')
    expect(rule?.description).toMatch(/minimum 5 yr time in grade/)
    expect(rule?.params?.minTig).toBe(5)
  })

  it('honours a reviewer sign-off over the shipped status', () => {
    const reviews = {
      'retention.E6': { status: 'Verified' as const, reviewedBy: 'SFC Adams', lastReviewed: '2026-06-01' },
    }
    const rule = allRules(reviews).find(r => r.id === 'retention.E6')
    expect(rule?.status).toBe('Verified')
    expect(rule?.reviewedBy).toBe('SFC Adams')
    // Untouched rules keep the status they shipped with.
    expect(allRules(reviews).find(r => r.id === 'retention.E7')?.status).toBe('Draft')
  })

  it('carries the sign-off and the local tuning into the AI briefing', () => {
    const ctx = rulesContext({
      reviews: { 'retention.E6': { status: 'Verified', reviewedBy: 'SFC Adams', lastReviewed: '2026-06-01' } },
      overrides: { gates: { E7: { minTig: 5 } } },
    })
    expect(ctx).toMatch(/reviewed by SFC Adams on 2026-06-01/)
    expect(ctx).toMatch(/E7 minTig: 3 → 5/)
  })

  it('still accepts the old positional topics argument', () => {
    expect(rulesContext(['Promotion'])).toMatch(/POLICY RULES/)
  })
})
