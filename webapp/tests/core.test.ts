import { describe, it, expect } from 'vitest'
import { RANK_NUM, PROMOTION_GATES, scorePosition } from '@/lib/scoring'
import { nextGradeFor, feederGradeFor, earliestDeparture, computeManning,
  rankCandidates, buildUnitNameMap, resolveUnitName, buildUnitFamilies, vacantBillets } from '@/lib/forceAnalytics'
import { assessOpportunity, hardBlockers } from '@/lib/recommendation'
import { transition, createApplication, buildSlate, orphanedApplications } from '@/lib/marketplace/workflow'
import { canTransition } from '@/lib/marketplace/types'
import { analyzeDataQuality } from '@/lib/talent/dataQuality'
import { stateOverview, applyStateFilter } from '@/lib/talent/statewideAnalytics'
import { singlePointsOfFailure, assessBilletSuccession } from '@/lib/talent/succession'
import { anonymizeSoldier, rehydrateNames, buildNameMap } from '@/lib/commanderAI'
import { parseCsv, importRosterCsv, normalizeRank } from '@/lib/rosterImport'
import { allRules, rulesNeedingReview, getRule } from '@/lib/rules/registry'
import { confidenceOf, isStale, demoProvenance } from '@/lib/provenance'
import { AS_OF, soldier, position, profile, civilian } from './fixtures'

const BASE = 2026

describe('rank and career-category boundaries', () => {
  it('never crosses category boundaries when computing the next grade', () => {
    expect(nextGradeFor('E9', 'Enlisted')).toBeNull()
    expect(nextGradeFor('W5', 'Warrant')).toBeNull()
    expect(nextGradeFor('O6', 'Officer')).toBeNull()
    expect(nextGradeFor('E8', 'Enlisted')).toBe('E9')
    // RANK_NUM is contiguous (E9=9, W1=10), so a naive +1 would promote SGM to WO1.
    expect(RANK_NUM.E9 + 1).toBe(RANK_NUM.W1)
    expect(nextGradeFor('E9', 'Enlisted')).not.toBe('W1')
  })

  it('walks feeder grades back down within a category', () => {
    expect(feederGradeFor('E6', 'Enlisted')).toBe('E5')
    expect(feederGradeFor('E4', 'Enlisted')).toBeNull()
    expect(feederGradeFor('O3', 'Officer')).toBe('O2')
  })

  it('includes general-officer grades so they do not sort as rank zero', () => {
    expect(RANK_NUM.O7).toBeGreaterThan(RANK_NUM.O6)
    expect(RANK_NUM.O8).toBeGreaterThan(RANK_NUM.O7)
  })
})

describe('promotion readiness and scoring invariants', () => {
  it('completing a required qualification never lowers the score', () => {
    const pos = position({ grade: 'E6', mos: '92Y' })
    const before = scorePosition(profile({ rank: 'E5', mos: '92Y', alcComplete: false }), pos)
    const after = scorePosition(profile({ rank: 'E5', mos: '92Y', alcComplete: true }), pos)
    expect(after.totalScore).toBeGreaterThanOrEqual(before.totalScore)
  })

  it('increasing commute never improves commute fit', () => {
    const near = scorePosition(profile({ homeCity: 'Billings' }), position({ city: 'Billings' }))
    const far = scorePosition(profile({ homeCity: 'Billings' }), position({ city: 'Kalispell' }))
    expect(far.commuteScore).toBeLessThanOrEqual(near.commuteScore)
  })

  it('more time in grade never lowers readiness', () => {
    const pos = position({ grade: 'E6' })
    const low = assessOpportunity(profile({ rank: 'E5', timeInGrade: 0.2, yearsOfService: 3 }), pos)
    const high = assessOpportunity(profile({ rank: 'E5', timeInGrade: 6, yearsOfService: 12 }), pos)
    const order = ['Not Currently Feasible', 'Unknown', 'Developmental Candidate',
      'Ready in 6-18 Months', 'Ready in 0-6 Months', 'Ready Now']
    expect(order.indexOf(high.readiness)).toBeGreaterThanOrEqual(order.indexOf(low.readiness))
  })
})

describe('multi-dimensional recommendation', () => {
  it('keeps a hard blocker visible regardless of other strengths', () => {
    const a = assessOpportunity(
      profile({ rank: 'E5', careerCategory: 'Enlisted', mos: '92Y', homeCity: 'Billings' }),
      position({ careerCategory: 'Officer', grade: 'O3', mos: '92Y', city: 'Billings' }))
    expect(a.eligibility).toBe('Not Eligible')
    expect(hardBlockers(a).length).toBeGreaterThan(0)
  })

  it('marks commute Unknown and excludes it rather than scoring it neutral', () => {
    const a = assessOpportunity(profile({ homeCity: 'Nowhere' }), position({ city: 'Elsewhere' }))
    const f = a.factors.find(x => x.label === 'Commute fit')
    expect(f?.value).toBe('Unknown')
    expect(f?.excluded).toBe(true)
    expect(a.gaps.some(g => g.severity === 'Missing Data')).toBe(true)
  })

  it('reports each dimension independently', () => {
    const a = assessOpportunity(profile({ rank: 'E5', mos: '92Y' }), position({ grade: 'E6', mos: '92Y' }))
    expect(a.eligibility).toBeDefined()
    expect(a.readiness).toBeDefined()
    expect(a.organizationalNeed).toBeDefined()
    expect(a.militaryQualFit).toBe('Strong')
    // Civilian capability is a mission question, not a billet question.
    expect(a.civilianFit).toBe('Not Relevant')
  })

  it('every gap carries a recommended action', () => {
    const a = assessOpportunity(profile({ rank: 'E5', timeInGrade: 0.1, yearsOfService: 1 }), position({ grade: 'E6' }))
    for (const g of a.gaps) expect(g.recommendedAction.length).toBeGreaterThan(0)
  })
})

describe('attrition and manning', () => {
  it('an ETS alone does not produce a whole-person loss', () => {
    const s = soldier({ ets: '2027-05-01', yearsOfService: 8 })
    const d = earliestDeparture(s, BASE, 5)
    expect(d).not.toBeNull()
    expect(d!.weight).toBeLessThan(1)
  })

  it('a statutory removal counts as a whole person', () => {
    const s = soldier({ rank: 'E6', componentStatus: 'AGR', yearsOfService: 23, ets: '2035-01-01' })
    const d = earliestDeparture(s, BASE, 5)
    expect(d?.reason).toBe('RCP (AGR)')
    expect(d?.weight).toBe(1)
  })

  it('RCP does not bind M-Day soldiers', () => {
    const s = soldier({ rank: 'E6', componentStatus: 'M-Day', yearsOfService: 23, ets: '2040-01-01' })
    const d = earliestDeparture(s, BASE, 5)
    expect(d?.reason).not.toBe('RCP (AGR)')
  })

  it('excludes unauthorized templet lines from authorized counts', () => {
    const positions = [
      position({ id: 1, authorized: true, grade: 'E5' }),
      position({ id: 2, authorized: false, grade: 'E5' }),
    ]
    const m = computeManning(positions, [soldier({ uic: 'WTCPT0' })], ['WTCPT0'])
    expect(m.totalAuthorized).toBe(1)
    expect(m.totalAssigned).toBe(1)
  })

  it('statewide totals equal the sum of the parts', () => {
    const positions = [
      position({ id: 1, uic: 'A', bn: 'BN1' }), position({ id: 2, uic: 'B', bn: 'BN2' })]
    const roster = [
      soldier({ id: 's1', uic: 'A' }), soldier({ id: 's2', uic: 'A' }), soldier({ id: 's3', uic: 'B' })]
    const all = stateOverview(positions, roster)
    const bn1 = applyStateFilter(roster, positions, { bn: 'BN1' })
    const bn2 = applyStateFilter(roster, positions, { bn: 'BN2' })
    expect(bn1.length + bn2.length).toBe(all.totalSoldiers)
  })

  it('applying a filter does not modify the underlying records', () => {
    const roster = [soldier({ id: 'x' })]
    const before = JSON.stringify(roster)
    applyStateFilter(roster, [position()], { rank: 'E5' })
    expect(JSON.stringify(roster)).toBe(before)
  })
})

describe('unit naming and occupancy', () => {
  it('prefers a readable name over a bare UIC', () => {
    const map = buildUnitNameMap([
      position({ id: 1, uic: 'WPBQAA', unit: 'WPBQAA' }),
      position({ id: 2, uic: 'WPBQAA', unit: '0495 CS HHC    HHC COMBAT SUST' }),
    ])
    expect(resolveUnitName('WPBQAA', map)).toBe('0495 CS HHC HHC COMBAT SUST')
  })

  it('decodes double-encoded entities', () => {
    const map = buildUnitNameMap([position({ id: 1, uic: 'W903AA', unit: 'W903 MONTANA REC &amp;amp;amp; RET' })])
    expect(resolveUnitName('W903AA', map)).toContain('&')
    expect(resolveUnitName('W903AA', map)).not.toContain('amp;')
  })

  it('groups units by their real battalion', () => {
    const fams = buildUnitFamilies([
      position({ id: 1, uic: 'A', bn: '1ST BATTALION, 163D INFANTRY REGIMENT' }),
      position({ id: 2, uic: 'B', bn: '1ST BATTALION, 163D INFANTRY REGIMENT' }),
      position({ id: 3, uic: 'C', bn: '190TH ROLLUP' }),
    ], [])
    const inf = fams.find(f => f.key.includes('163D'))
    expect(inf?.uics.sort()).toEqual(['A', 'B'])
  })

  it('derives vacancy from the roster, not the source vacancyStatus field', () => {
    const positions = [position({ id: 5, vacancyStatus: 'Vacant', uic: 'U' })]
    const occupied = [soldier({ uic: 'U', positionId: 5 })]
    expect(vacantBillets(positions, occupied, ['U']).length).toBe(0)
    expect(vacantBillets(positions, [], ['U']).length).toBe(1)
  })

  it('never offers a candidate their own billet', () => {
    const pos = position({ id: 7, grade: 'E5', mos: '92Y' })
    const incumbent = soldier({ id: 'in', positionId: 7, rank: 'E5', mos: '92Y' })
    const other = soldier({ id: 'other', rank: 'E5', mos: '92Y' })
    const c = rankCandidates([incumbent, other], pos, 10)
    expect(c.map(x => x.soldier.id)).not.toContain('in')
  })
})

describe('succession', () => {
  it('reports No Internal Successor when nobody qualifies', () => {
    const pos = position({ id: 11, grade: 'O5', careerCategory: 'Officer', mos: '01A' })
    const a = assessBilletSuccession(pos, [soldier({ rank: 'E3', mos: '92Y' })], BASE, 5)
    expect(a.level).toBe('No Internal Successor')
    expect(a.requiresAccession).toBe(true)
  })

  it('flags a billet with only one ready-now successor', () => {
    const pos = position({ id: 12, grade: 'E6', mos: '92Y', isCommandOrKD: true, uic: 'U' })
    const roster = [soldier({ id: 'a', uic: 'U', rank: 'E6', mos: '92Y', timeInPosition: 4 })]
    const { findings } = singlePointsOfFailure([pos], roster, ['U'], BASE, 5)
    expect(findings.some(f => f.kind === 'One successor only' || f.kind === 'No successor')).toBe(true)
  })

  it('detects concentrated senior losses in one year', () => {
    const uic = 'U'
    const positions = [position({ id: 20, uic })]
    const roster = ['a', 'b', 'c'].map(id =>
      soldier({ id, uic, rank: 'E8', componentStatus: 'AGR', yearsOfService: 29, ets: '2040-01-01' }))
    const { findings } = singlePointsOfFailure(positions, roster, [uic], BASE, 5, { keyOnly: false })
    expect(findings.some(f => f.kind === 'Multiple losses same window')).toBe(true)
  })
})

describe('marketplace workflow', () => {
  const app = () => createApplication('a1', 'c1', 's1', 100, '2026-01-01')

  it('allows only legal forward transitions', () => {
    expect(canTransition('Interested', 'Applied')).toBe(true)
    expect(canTransition('Interested', 'Selected')).toBe(false)
    expect(canTransition('Complete', 'Applied')).toBe(false)
  })

  it('appends history on every transition and never mutates the input', () => {
    const a = app()
    const before = JSON.stringify(a)
    const r = transition(a, 'Applied', '2026-01-02')
    expect(r.ok).toBe(true)
    expect(r.application.history.length).toBe(2)
    expect(JSON.stringify(a)).toBe(before)
  })

  it('rejects an illegal transition with a reason', () => {
    const r = transition(app(), 'Selected', '2026-01-02')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/Cannot move/)
  })

  it('refuses to move out of a terminal state', () => {
    let a = app()
    a = transition(a, 'Applied', '1').application
    a = transition(a, 'Commander Review', '2').application
    a = transition(a, 'Talent Manager Review', '3').application
    a = transition(a, 'Selection Pending', '4').application
    a = transition(a, 'Selected', '5').application
    a = transition(a, 'Assignment Action', '6').application
    a = transition(a, 'Complete', '7').application
    expect(transition(a, 'Applied', '8').ok).toBe(false)
  })

  it('orders a slate with endorsed candidates first', () => {
    const a1 = { ...app(), id: 'a1', preferenceRank: 2 }
    const a2 = {
      ...app(), id: 'a2', soldierId: 's2', preferenceRank: 3,
      endorsement: { decision: 'Endorsed' as const, at: '2026-01-03' },
    }
    const slate = buildSlate([a1, a2], 100)
    expect(slate[0].application.id).toBe('a2')
  })

  it('detects orphaned applications', () => {
    const orphans = orphanedApplications([app()], new Set(['other']), new Set([100]))
    expect(orphans.length).toBe(1)
  })
})

describe('data quality', () => {
  it('detects missing UIC, impossible dates, and orphaned assignments', () => {
    const positions = [position({ id: 1, uic: 'U' })]
    const roster = [
      soldier({ id: 'bad', uic: '', timeInGrade: 20, yearsOfService: 5, positionId: 999 }),
    ]
    const r = analyzeDataQuality(positions, roster, new Map(), [], AS_OF)
    const cats = r.issues.map(i => i.category)
    expect(cats).toContain('Missing UIC')
    expect(cats).toContain('Impossible dates')
    expect(cats).toContain('Orphaned assignment')
    expect(r.counts.error).toBeGreaterThan(0)
  })

  it('detects expired credentials', () => {
    const civ = new Map([['s', civilian({
      soldierId: 's',
      credentials: [{ id: 'c', name: 'RN', category: 'Healthcare', expirationDate: '2024-01-01', verificationStatus: 'Document Verified' }],
    })]])
    const r = analyzeDataQuality([position()], [soldier({ id: 's' })], civ, [], AS_OF)
    expect(r.issues.some(i => i.category === 'Expired credential')).toBe(true)
  })

  it('reports civilian coverage completeness', () => {
    const roster = [soldier({ id: 'a' }), soldier({ id: 'b' })]
    const civ = new Map([['a', civilian({ soldierId: 'a' })]])
    const r = analyzeDataQuality([position()], roster, civ, [], AS_OF)
    expect(r.completeness.civilianCoveragePct).toBe(50)
  })

  it('is deterministic under record reordering', () => {
    const positions = [position({ id: 1, uic: 'U' }), position({ id: 2, uic: 'U' })]
    const roster = [soldier({ id: 'a', uic: 'U' }), soldier({ id: 'b', uic: 'Z' })]
    const one = analyzeDataQuality(positions, roster, new Map(), [], AS_OF).issues.map(i => i.id).sort()
    const two = analyzeDataQuality([...positions].reverse(), [...roster].reverse(), new Map(), [], AS_OF)
      .issues.map(i => i.id).sort()
    expect(one).toEqual(two)
  })
})

describe('pseudonymization', () => {
  it('never includes a real name in the anonymized record', () => {
    const s = soldier({ lastName: 'Whitaker', firstName: 'Marcus', anonId: 'S-014' })
    const line = anonymizeSoldier(s, false)
    expect(line).not.toContain('Whitaker')
    expect(line).not.toContain('Marcus')
    expect(line).toContain('S-014')
  })

  it('rehydrates pseudonyms back to names locally', () => {
    const s = soldier({ lastName: 'Whitaker', firstName: 'Marcus', anonId: 'S-014' })
    const out = rehydrateNames('Recommend S-014 for the billet.', buildNameMap([s]))
    expect(out).toContain('Whitaker, Marcus')
  })

  it('leaves unknown pseudonyms untouched rather than inventing a name', () => {
    const out = rehydrateNames('Consider S-999.', buildNameMap([soldier({ anonId: 'S-001' })]))
    expect(out).toContain('S-999')
  })
})

describe('CSV parsing and import', () => {
  it('handles quoted fields, embedded commas, and escaped quotes', () => {
    const rows = parseCsv('a,b\n"x,1","he said ""hi"""')
    expect(rows[1]).toEqual(['x,1', 'he said "hi"'])
  })

  it('strips a BOM from the first header', () => {
    expect(parseCsv('﻿rank,uic\nE5,U')[0][0]).toBe('rank')
  })

  it('normalizes rank aliases in both directions', () => {
    expect(normalizeRank('SSG')).toBe('E6')
    expect(normalizeRank('E-6')).toBe('E6')
    expect(normalizeRank('cpt')).toBe('O3')
  })

  it('rejects unusable rows with a row-level error instead of failing the import', () => {
    const r = importRosterCsv('rank,uic\nSSG,WTCPT0\nXYZ,WTCPT0')
    expect(r.soldiers.length).toBe(1)
    expect(r.errors.length).toBe(1)
    expect(r.errors[0].row).toBe(3)
  })

  it('produces stable ids independent of input order', () => {
    const a = importRosterCsv('rank,uic,last_name\nSSG,U1,Alpha\nSGT,U2,Bravo')
    expect(a.soldiers.map(s => s.uic)).toEqual(['U1', 'U2'])
    expect(a.soldiers.every(s => s.anonId.startsWith('S-'))).toBe(true)
  })
})

describe('rules registry', () => {
  it('exposes promotion and retention rules from a single source', () => {
    const rules = allRules()
    expect(rules.some(r => r.topic === 'Promotion')).toBe(true)
    expect(rules.some(r => r.topic === 'Retention')).toBe(true)
  })

  it('carries the same numbers as the deterministic gate table', () => {
    const e6 = getRule('promo.E6')
    expect(e6?.params?.minTig).toBe(PROMOTION_GATES.E6.minTig)
    expect(e6?.params?.minTis).toBe(PROMOTION_GATES.E6.minTis)
  })

  it('surfaces unverified and draft rules for review', () => {
    const review = rulesNeedingReview()
    expect(review.length).toBeGreaterThan(0)
    expect(review.every(r => r.status !== 'Verified')).toBe(true)
  })

  it('gives every rule a source authority', () => {
    for (const r of allRules()) expect(r.sourceAuthority.length).toBeGreaterThan(0)
  })
})

describe('provenance', () => {
  it('ranks document verification above self reporting', () => {
    expect(confidenceOf({ source: 'Document Verified', verified: true }))
      .toBeGreaterThan(confidenceOf({ source: 'Self Reported', verified: false }))
  })

  it('treats unknown source dates as unknown staleness, not fresh', () => {
    expect(isStale({ source: 'CSV Import', verified: false }, AS_OF)).toBe(false)
    expect(isStale({ source: 'CSV Import', verified: false, sourceDate: '2020-01-01' }, AS_OF)).toBe(true)
  })

  it('labels demo data as unverified', () => {
    expect(demoProvenance().verified).toBe(false)
  })
})

describe('MOS position counts are derived from real force structure', () => {
  it('reports counts that match the live positions data', async () => {
    const { positions } = await import('@/lib/data/positions')
    const { mosPositionCount, mosVacancyCount } = await import('@/lib/data/mosTransitions')
    const expected = positions.filter(p => p.mos === '11B' && p.authorized !== false).length
    expect(mosPositionCount('11B')).toBe(expected)
    expect(expected).toBeGreaterThan(100)  // guards against the old hardcoded 91
    expect(mosVacancyCount('11B')).toBeLessThanOrEqual(expected)
  })

  it('returns zero for an MOS with no billets rather than throwing', async () => {
    const { mosPositionCount } = await import('@/lib/data/mosTransitions')
    expect(mosPositionCount('ZZZ')).toBe(0)
  })

  it('excludes unauthorized templet lines from the count', async () => {
    const { positions } = await import('@/lib/data/positions')
    const { mosPositionCount } = await import('@/lib/data/mosTransitions')
    const withTemplet = positions.filter(p => p.mos === '92Y').length
    const authorizedOnly = positions.filter(p => p.mos === '92Y' && p.authorized !== false).length
    expect(mosPositionCount('92Y')).toBe(authorizedOnly)
    if (withTemplet !== authorizedOnly) expect(mosPositionCount('92Y')).toBeLessThan(withTemplet)
  })
})

describe('unknown service dates never manufacture a promotion crisis', () => {
  it('reports Unknown board eligibility when TIG and TIS are absent', async () => {
    const { boardEligibility, hasServiceDates } = await import('@/lib/forceAnalytics')
    const noDates = soldier({ rank: 'E5', yearsOfService: 0, timeInGrade: 0 })
    expect(hasServiceDates(noDates)).toBe(false)
    expect(boardEligibility(noDates)).toBe('Unknown')
  })

  it('still answers definitively when the dates are present', async () => {
    const { boardEligibility } = await import('@/lib/forceAnalytics')
    expect(boardEligibility(soldier({ rank: 'E5', yearsOfService: 12, timeInGrade: 5 }))).toBe('Eligible')
    expect(boardEligibility(soldier({ rank: 'E5', yearsOfService: 1, timeInGrade: 0.1 }))).toBe('Not Eligible')
  })

  it('flags the transition Unknown instead of reporting a shortfall', async () => {
    const { projectPromotions } = await import('@/lib/forceAnalytics')
    const positions = [
      position({ id: 1, uic: 'U', grade: 'E6', careerCategory: 'Enlisted' }),
      position({ id: 2, uic: 'U', grade: 'E6', careerCategory: 'Enlisted' }),
      position({ id: 3, uic: 'U', grade: 'E5', careerCategory: 'Enlisted' }),
    ]
    const roster = [
      soldier({ id: 'a', uic: 'U', rank: 'E5', yearsOfService: 0, timeInGrade: 0 }),
      soldier({ id: 'b', uic: 'U', rank: 'E5', yearsOfService: 0, timeInGrade: 0 }),
    ]
    const need = projectPromotions(positions, roster, ['U'], 2026, 5)
      .find(p => p.fromGrade === 'E5' && p.toGrade === 'E6')!
    expect(need.eligibilityUnknown).toBe(true)
    // The gap must be suppressed — a shortfall here would be an artifact.
    expect(need.gap).toBe(0)
  })

  it('computes a real gap once dates exist', async () => {
    const { projectPromotions } = await import('@/lib/forceAnalytics')
    const positions = [
      position({ id: 1, uic: 'U', grade: 'E6', careerCategory: 'Enlisted' }),
      position({ id: 2, uic: 'U', grade: 'E6', careerCategory: 'Enlisted' }),
      position({ id: 3, uic: 'U', grade: 'E5', careerCategory: 'Enlisted' }),
    ]
    const roster = [soldier({ id: 'a', uic: 'U', rank: 'E5', yearsOfService: 2, timeInGrade: 0.2 })]
    const need = projectPromotions(positions, roster, ['U'], 2026, 5)
      .find(p => p.fromGrade === 'E5' && p.toGrade === 'E6')!
    expect(need.eligibilityUnknown).toBe(false)
    expect(need.promotionsNeeded).toBeGreaterThan(0)
  })
})

describe('profile gate', () => {
  it('does not require a name to use the career tools', async () => {
    // Name is only used on the printed counseling sheet; nothing scores on it.
    const { useProfileStore } = await import('@/lib/store')
    useProfileStore.getState().resetProfile()
    useProfileStore.getState().setProfile({ rank: 'E5', mos: '92Y', homeCity: 'Billings' })
    expect(useProfileStore.getState().profileComplete).toBe(true)
  })

  it('still requires the fields the scoring actually depends on', async () => {
    const { useProfileStore } = await import('@/lib/store')
    useProfileStore.getState().resetProfile()
    useProfileStore.getState().setProfile({ rank: 'E5', mos: '', homeCity: 'Billings' })
    expect(useProfileStore.getState().profileComplete).toBe(false)
  })
})
