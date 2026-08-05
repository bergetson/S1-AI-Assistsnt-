import { describe, it, expect } from 'vitest'
import { assessSoldierImpact, aggregateImpact } from '@/lib/communityImpact/calculateImpact'
import { DEFAULT_ACTIVATION, IMPACT_RANK, countyForCity, isRuralCounty } from '@/lib/communityImpact/types'
import { AS_OF, civilian, skill, FIXTURES } from './fixtures'

const LONG = { ...DEFAULT_ACTIVATION, durationDays: 200, noticeDays: 5 }

describe('community impact — individual', () => {
  it('returns Unknown, never Low, when there is no civilian data', () => {
    const a = assessSoldierImpact(undefined, DEFAULT_ACTIVATION, AS_OF)
    expect(a.level).toBe('Unknown')
    expect(a.hasMissingData).toBe(true)
    expect(a.limitations.length).toBeGreaterThan(0)
  })

  it('rates a rural sole-provider paramedic as high or critical', () => {
    const a = assessSoldierImpact(FIXTURES.ruralParamedic(), LONG, AS_OF)
    expect(IMPACT_RANK[a.level]).toBeGreaterThanOrEqual(IMPACT_RANK.High)
    expect(a.factors.map(f => f.id)).toContain('soleProvider')
    expect(a.factors.map(f => f.id)).toContain('ruralCounty')
  })

  it('rates an urban accountant lower than a rural paramedic', () => {
    const medic = assessSoldierImpact(FIXTURES.ruralParamedic(), LONG, AS_OF)
    const acct = assessSoldierImpact(FIXTURES.urbanAccountant(), LONG, AS_OF)
    expect(IMPACT_RANK[acct.level]).toBeLessThan(IMPACT_RANK[medic.level])
  })

  it('every factor carries an explanation', () => {
    const a = assessSoldierImpact(FIXTURES.ruralParamedic(), LONG, AS_OF)
    for (const f of a.factors) {
      expect(f.detail.length).toBeGreaterThan(0)
      expect(f.label.length).toBeGreaterThan(0)
    }
  })

  it('never emits a negative-weight factor — nothing reduces community risk', () => {
    const a = assessSoldierImpact(FIXTURES.ruralParamedic(), LONG, AS_OF)
    for (const f of a.factors) expect(f.weight).toBeGreaterThan(0)
  })

  it('raises impact as activation duration grows', () => {
    const p = FIXTURES.ruralParamedic()
    const short = assessSoldierImpact(p, { ...DEFAULT_ACTIVATION, durationDays: 10 }, AS_OF)
    const long = assessSoldierImpact(p, { ...DEFAULT_ACTIVATION, durationDays: 200 }, AS_OF)
    expect(long.score).toBeGreaterThan(short.score)
  })

  it('raises impact when notice is short', () => {
    const p = FIXTURES.ruralParamedic()
    const notice30 = assessSoldierImpact(p, { ...DEFAULT_ACTIVATION, noticeDays: 45 }, AS_OF)
    const notice3 = assessSoldierImpact(p, { ...DEFAULT_ACTIVATION, noticeDays: 3 }, AS_OF)
    expect(notice3.score).toBeGreaterThan(notice30.score)
  })

  it('records a limitation when data is only self-reported', () => {
    const p = civilian({ skills: [skill({ verificationStatus: 'Self Reported' })], credentials: [] })
    const a = assessSoldierImpact(p, DEFAULT_ACTIVATION, AS_OF)
    expect(a.limitations.some(l => /self-reported|unverified/i.test(l))).toBe(true)
  })
})

describe('community impact — group concentration', () => {
  const member = (id: string, employer: string, county: string, city: string) => ({
    soldierId: id, displayName: id, unit: 'U',
    profile: civilian({
      soldierId: id,
      employment: {
        occupationTitle: 'Paramedic', industry: 'EMS', employerType: 'Local Government',
        employerName: employer, workCity: city, workCounty: county,
        essentialCommunityRole: true, soleProviderOrSpecialist: false, smallEmployer: true,
      },
      skills: [skill({ category: 'Emergency Medical Services', subcategory: 'Paramedic', skillName: 'Paramedic' })],
    }),
  })

  it('selecting more people from one employer must not reduce risk', () => {
    const one = aggregateImpact([member('a', 'Phillips County EMS', 'Phillips', 'Malta')], LONG, AS_OF)
    const three = aggregateImpact([
      member('a', 'Phillips County EMS', 'Phillips', 'Malta'),
      member('b', 'Phillips County EMS', 'Phillips', 'Malta'),
      member('c', 'Phillips County EMS', 'Phillips', 'Malta'),
    ], LONG, AS_OF)
    expect(IMPACT_RANK[three.level]).toBeGreaterThanOrEqual(IMPACT_RANK[one.level])
    expect(three.concentrationFactors.some(f => f.id.startsWith('employer:'))).toBe(true)
  })

  it('detects county and occupation concentration', () => {
    const g = aggregateImpact([
      member('a', 'EMS A', 'Phillips', 'Malta'),
      member('b', 'EMS B', 'Phillips', 'Malta'),
      member('c', 'EMS C', 'Phillips', 'Malta'),
    ], LONG, AS_OF)
    expect(g.concentrationFactors.some(f => f.id.startsWith('county:'))).toBe(true)
    expect(g.concentrationFactors.some(f => f.id.startsWith('occupation:'))).toBe(true)
  })

  it('counts and surfaces soldiers with no civilian data', () => {
    const g = aggregateImpact([
      member('a', 'EMS A', 'Phillips', 'Malta'),
      { soldierId: 'z', displayName: 'z', unit: 'U', profile: undefined },
    ], LONG, AS_OF)
    expect(g.missingCivilianData).toBe(1)
    expect(g.withCivilianData).toBe(1)
    expect(g.limitations[0]).toMatch(/no civilian information/i)
  })

  it('is order independent', () => {
    const a = aggregateImpact([
      member('a', 'E1', 'Phillips', 'Malta'), member('b', 'E2', 'Yellowstone', 'Billings')], LONG, AS_OF)
    const b = aggregateImpact([
      member('b', 'E2', 'Yellowstone', 'Billings'), member('a', 'E1', 'Phillips', 'Malta')], LONG, AS_OF)
    expect(a.level).toBe(b.level)
    expect(a.totalSelected).toBe(b.totalSelected)
  })

  it('an empty selection is Unknown, not Low', () => {
    expect(aggregateImpact([], LONG, AS_OF).level).toBe('Unknown')
  })
})

describe('geography helpers', () => {
  it('maps armory cities to counties', () => {
    expect(countyForCity('Malta')).toBe('Phillips')
    expect(countyForCity('Billings')).toBe('Yellowstone')
    expect(countyForCity('Fort Harrison')).toBe('Lewis and Clark')
    expect(countyForCity('Nowhere')).toBeUndefined()
  })

  it('knows which counties are rural', () => {
    expect(isRuralCounty('Phillips')).toBe(true)
    expect(isRuralCounty('Yellowstone')).toBe(false)
    expect(isRuralCounty(undefined)).toBe(false)
  })
})
