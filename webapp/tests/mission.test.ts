import { describe, it, expect } from 'vitest'
import { findCandidates, computeFills } from '@/lib/mission/matcher'
import { buildCoa, buildCoaSet } from '@/lib/mission/coa'
import type { MissionDefinition } from '@/lib/mission/types'
import { AS_OF, soldier, civilian, skill } from './fixtures'
import type { RosterSoldier } from '@/lib/commandTypes'
import type { CivilianCapabilityProfile } from '@/lib/civilian/types'

const mission: MissionDefinition = {
  id: 'm1', name: 'Temporary Power and Shelter Support',
  missionType: 'Domestic Support', location: 'Billings',
  durationDays: 45, noticeDays: 10,
  requirements: [
    { id: 'elec', category: 'Electrical', subcategory: 'Master Electrician', label: 'Master electricians', quantity: 2 },
    { id: 'pm', category: 'Project Management', subcategory: 'Project Manager', label: 'Project managers', quantity: 1 },
    { id: 'emt', category: 'Emergency Medical Services', subcategory: 'Paramedic', label: 'Paramedics', quantity: 1 },
  ],
  constraints: {},
  objectives: { minimizeCommunityImpact: false, minimizeUnitDisruption: false, preserveSuccessionDepth: false },
}

function make(id: string, cat: string, sub: string, city = 'Billings', over: Partial<RosterSoldier> = {}) {
  const s = soldier({ id, city, ...over })
  const p = civilian({
    soldierId: id,
    skills: [skill({ category: cat, subcategory: sub, skillName: sub })],
    employment: {
      occupationTitle: sub, industry: 'X', employerType: 'Private',
      employerName: `${sub} Co`, workCity: city, workCounty: city === 'Malta' ? 'Phillips' : 'Yellowstone',
      essentialCommunityRole: cat === 'Emergency Medical Services',
      soleProviderOrSpecialist: false, smallEmployer: false,
    },
  })
  return { s, p }
}

function pool() {
  const items = [
    make('e1', 'Electrical', 'Master Electrician'),
    make('e2', 'Electrical', 'Master Electrician', 'Malta'),
    make('e3', 'Electrical', 'Master Electrician', 'Helena'),
    make('p1', 'Project Management', 'Project Manager'),
    make('m1', 'Emergency Medical Services', 'Paramedic', 'Malta'),
  ]
  const roster: RosterSoldier[] = items.map(i => i.s)
  const profiles = new Map<string, CivilianCapabilityProfile>(items.map(i => [i.s.id, i.p]))
  return { roster, profiles }
}

describe('mission candidate matching', () => {
  it('finds only soldiers who satisfy at least one requirement', () => {
    const { roster, profiles } = pool()
    const extra = soldier({ id: 'none' })
    const c = findCandidates(mission, [...roster, extra], profiles, AS_OF)
    expect(c.map(x => x.soldierId)).not.toContain('none')
    expect(c.length).toBe(5)
  })

  it('records which requirements each candidate satisfies', () => {
    const { roster, profiles } = pool()
    const c = findCandidates(mission, roster, profiles, AS_OF)
    expect(c.find(x => x.soldierId === 'e1')?.satisfies).toEqual(['elec'])
    expect(c.find(x => x.soldierId === 'm1')?.satisfies).toEqual(['emt'])
  })

  it('is deterministic and independent of roster order', () => {
    const { roster, profiles } = pool()
    const a = findCandidates(mission, roster, profiles, AS_OF).map(x => x.soldierId)
    const b = findCandidates(mission, [...roster].reverse(), profiles, AS_OF).map(x => x.soldierId)
    expect(a).toEqual(b)
  })

  it('changing a soldier name does not change ranking', () => {
    const { roster, profiles } = pool()
    const before = findCandidates(mission, roster, profiles, AS_OF).map(x => x.soldierId)
    const renamed = roster.map(s => ({ ...s, lastName: 'Zzzz', firstName: 'Aaaa' }))
    const after = findCandidates(mission, renamed, profiles, AS_OF).map(x => x.soldierId)
    expect(after).toEqual(before)
  })

  it('blocks flagged soldiers but still surfaces them with a reason', () => {
    const { roster, profiles } = pool()
    const flagged = roster.map(s => s.id === 'e1' ? { ...s, flagged: true } : s)
    const c = findCandidates(mission, flagged, profiles, AS_OF)
    const e1 = c.find(x => x.soldierId === 'e1')
    expect(e1?.blockers.some(b => /flag/i.test(b))).toBe(true)
    // Blocked candidates sort last, never silently disappear.
    expect(c[c.length - 1].soldierId).toBe('e1')
  })

  it('enforces a verified-skills constraint as a blocker', () => {
    const { roster, profiles } = pool()
    const unverified = new Map(profiles)
    unverified.set('e1', civilian({
      soldierId: 'e1',
      skills: [skill({ verificationStatus: 'Self Reported' })],
      credentials: [],
    }))
    const c = findCandidates(
      { ...mission, constraints: { requireVerifiedSkills: true } }, roster, unverified, AS_OF)
    expect(c.find(x => x.soldierId === 'e1')?.blockers.length).toBeGreaterThan(0)
  })

  it('a verified credential outranks an identical unverified claim', () => {
    const base = make('v', 'Electrical', 'Master Electrician')
    const weak = make('u', 'Electrical', 'Master Electrician')
    weak.p.skills = [skill({ verificationStatus: 'Self Reported' })]
    weak.p.credentials = []
    const c = findCandidates(mission, [base.s, weak.s],
      new Map([['v', base.p], ['u', weak.p]]), AS_OF)
    expect(c[0].soldierId).toBe('v')
  })

  it('excludes distance from the score when unknown rather than assuming near', () => {
    const { roster, profiles } = pool()
    const far = findCandidates({ ...mission, location: 'Nowhere' }, roster, profiles, AS_OF)
    const f = far[0].factors.find(x => x.label === 'Proximity')
    expect(f?.points).toBe(0)
    expect(f?.detail).toMatch(/unknown/i)
  })
})

describe('requirement fills', () => {
  it('reports unmet and overfilled requirements', () => {
    const { roster, profiles } = pool()
    const c = findCandidates(mission, roster, profiles, AS_OF)
    const selected = c.filter(x => x.satisfies.includes('elec'))  // 3 electricians, need 2
    const fills = computeFills(mission, selected)
    const elec = fills.find(f => f.requirement.id === 'elec')!
    expect(elec.filled).toBe(3)
    expect(elec.over).toBe(1)
    const pm = fills.find(f => f.requirement.id === 'pm')!
    expect(pm.unmet).toBe(1)
  })
})

describe('course-of-action comparison', () => {
  it('builds three distinct COAs deterministically', () => {
    const { roster, profiles } = pool()
    const c = findCandidates(mission, roster, profiles, AS_OF)
    const a = buildCoaSet(mission, c, profiles, AS_OF)
    const b = buildCoaSet(mission, c, profiles, AS_OF)
    expect(a.length).toBe(3)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('fills every requirement when the pool allows', () => {
    const { roster, profiles } = pool()
    const c = findCandidates(mission, roster, profiles, AS_OF)
    const coa = buildCoa('Best Technical Fit', mission, c, profiles, AS_OF)
    expect(coa.requirementsFilledPct).toBe(100)
    expect(coa.unmetRequirements).toEqual([])
  })

  it('reports unmet requirements rather than silently under-filling', () => {
    const thin: MissionDefinition = {
      ...mission,
      requirements: [{ id: 'elec', category: 'Electrical', subcategory: 'Master Electrician', label: 'Master electricians', quantity: 9 }],
    }
    const { roster, profiles } = pool()
    const c = findCandidates(thin, roster, profiles, AS_OF)
    const coa = buildCoa('Best Technical Fit', thin, c, profiles, AS_OF)
    expect(coa.requirementsFilledPct).toBeLessThan(100)
    expect(coa.unmetRequirements.length).toBe(1)
  })

  it('lowest-community-impact COA does not exceed the technical COA impact', () => {
    const { roster, profiles } = pool()
    const c = findCandidates(mission, roster, profiles, AS_OF)
    const tech = buildCoa('Best Technical Fit', mission, c, profiles, AS_OF)
    const low = buildCoa('Lowest Community Impact', mission, c, profiles, AS_OF)
    const rank = { Low: 0, Unknown: 1, Moderate: 2, High: 3, Critical: 4 }
    expect(rank[low.communityImpact]).toBeLessThanOrEqual(rank[tech.communityImpact])
  })

  it('always states tradeoffs and limitations', () => {
    const { roster, profiles } = pool()
    const c = findCandidates(mission, roster, profiles, AS_OF)
    for (const coa of buildCoaSet(mission, c, profiles, AS_OF)) {
      expect(coa.tradeoffs.length).toBeGreaterThan(0)
      expect(coa.limitations.some(l => /not an order/i.test(l))).toBe(true)
    }
  })

  it('flags a soldier covering more than one requirement', () => {
    const dual = make('d', 'Electrical', 'Master Electrician')
    dual.p.skills.push(skill({ category: 'Project Management', subcategory: 'Project Manager', skillName: 'Project Manager', id: 'sk2' }))
    const c = findCandidates(mission, [dual.s], new Map([['d', dual.p]]), AS_OF)
    const coa = buildCoa('Best Technical Fit', mission, c, new Map([['d', dual.p]]), AS_OF)
    expect(coa.duplicateCoverage.length).toBe(1)
    expect(coa.tradeoffs.some(t => /more than one requirement/i.test(t))).toBe(true)
  })
})
