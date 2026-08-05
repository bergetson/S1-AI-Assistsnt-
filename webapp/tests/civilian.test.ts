import { describe, it, expect } from 'vitest'
import {
  resolveSkillLabel, searchTaxonomy, flatTaxonomy, isCommunityCritical,
  subcategoriesOf, categoryNames,
} from '@/lib/civilian/taxonomy'
import {
  isCredentialExpired, isCredentialExpiringSoon, effectiveVerification,
  VERIFICATION_RANK, PROFICIENCY_RANK, yearsSinceUse, profileVerificationLevel,
} from '@/lib/civilian/types'
import { filterCivilian, countByCategory, countByCounty } from '@/lib/civilian/filters'
import { buildCivilianProfile, buildCivilianProfiles } from '@/lib/civilian/demoData'
import { AS_OF, soldier, civilian, credential, skill } from './fixtures'

describe('civilian taxonomy', () => {
  it('covers every required top-level category', () => {
    const required = [
      'Healthcare', 'Emergency Medical Services', 'Fire and Rescue', 'Law Enforcement',
      'Construction', 'Electrical', 'Plumbing', 'Mechanical and HVAC', 'Engineering',
      'Heavy Equipment', 'Utilities', 'Transportation', 'Logistics and Warehousing',
      'Project Management', 'Information Technology', 'Cybersecurity', 'Communications',
      'Agriculture and Ranching', 'Education', 'Public Administration', 'Legal',
      'Finance and Accounting', 'Human Resources', 'Aviation',
      'Languages and Cultural Skills', 'Environmental and Natural Resources',
      'Manufacturing', 'Small Business and Entrepreneurship', 'Other',
    ]
    const names = categoryNames()
    for (const r of required) expect(names, `missing category ${r}`).toContain(r)
  })

  it('resolves messy source labels through aliases', () => {
    expect(resolveSkillLabel('RN')?.subcategory).toBe('Registered Nurse')
    expect(resolveSkillLabel('EMT-P')?.subcategory).toBe('Paramedic')
    expect(resolveSkillLabel('master elec')?.subcategory).toBe('Master Electrician')
    expect(resolveSkillLabel('CDL-A')?.subcategory).toBe('Commercial Driver')
    expect(resolveSkillLabel('PMP')?.subcategory).toBe('PMP')
  })

  it('returns null rather than guessing on nonsense', () => {
    expect(resolveSkillLabel('zzzz')).toBeNull()
    expect(resolveSkillLabel('')).toBeNull()
  })

  it('is case and punctuation insensitive', () => {
    expect(resolveSkillLabel('  Master   Electrician ')?.subcategory).toBe('Master Electrician')
    expect(resolveSkillLabel('emt-b')?.subcategory).toBe('EMT Basic')
  })

  it('finds skills by synonym search', () => {
    expect(searchTaxonomy('interpreter').some(e => e.subcategory === 'Translation and Interpretation')).toBe(true)
    expect(searchTaxonomy('scada').some(e => e.subcategory === 'Industrial Control Systems')).toBe(true)
  })

  it('marks community-critical capabilities', () => {
    expect(isCommunityCritical('Emergency Medical Services', 'Paramedic')).toBe(true)
    expect(isCommunityCritical('Electrical', 'Lineman')).toBe(true)
    expect(isCommunityCritical('Finance and Accounting', 'Accountant')).toBe(false)
  })

  it('has no duplicate subcategories inside a category', () => {
    for (const cat of categoryNames()) {
      const subs = subcategoriesOf(cat)
      expect(new Set(subs).size, `duplicates in ${cat}`).toBe(subs.length)
    }
  })

  it('gives every entry at least one searchable term', () => {
    for (const e of flatTaxonomy()) expect(e.terms.filter(Boolean).length).toBeGreaterThan(0)
  })
})

describe('credential expiration and verification', () => {
  it('treats a past expiration date as expired', () => {
    expect(isCredentialExpired(credential({ expirationDate: '2025-01-01' }), AS_OF)).toBe(true)
    expect(isCredentialExpired(credential({ expirationDate: '2030-01-01' }), AS_OF)).toBe(false)
  })

  it('never reports an expired credential as document verified', () => {
    const c = credential({ expirationDate: '2025-01-01', verificationStatus: 'Document Verified' })
    expect(effectiveVerification(c, AS_OF)).toBe('Expired')
  })

  it('flags credentials expiring inside the window', () => {
    expect(isCredentialExpiringSoon(credential({ expirationDate: '2026-08-01' }), AS_OF)).toBe(true)
    expect(isCredentialExpiringSoon(credential({ expirationDate: '2029-08-01' }), AS_OF)).toBe(false)
  })

  it('ranks verification so verified outranks self-reported', () => {
    expect(VERIFICATION_RANK['Document Verified']).toBeGreaterThan(VERIFICATION_RANK['Leader Reviewed'])
    expect(VERIFICATION_RANK['Leader Reviewed']).toBeGreaterThan(VERIFICATION_RANK['Self Reported'])
    expect(VERIFICATION_RANK['Self Reported']).toBeGreaterThan(VERIFICATION_RANK.Unverified)
    // Expired must not outrank a live self-reported claim.
    expect(VERIFICATION_RANK.Expired).toBeLessThan(VERIFICATION_RANK['Self Reported'])
  })

  it('orders proficiency monotonically', () => {
    expect(PROFICIENCY_RANK['Senior Expert or Instructor'])
      .toBeGreaterThan(PROFICIENCY_RANK['Licensed or Certified'])
    expect(PROFICIENCY_RANK.Familiarity).toBeLessThan(PROFICIENCY_RANK.Professional)
  })

  it('returns null recency when last used year is unknown', () => {
    expect(yearsSinceUse(skill({ lastUsedYear: undefined }), 2026)).toBeNull()
    expect(yearsSinceUse(skill({ lastUsedYear: 2020 }), 2026)).toBe(6)
  })

  it('summarizes profile verification from the strongest evidence', () => {
    const p = civilian({
      skills: [skill({ verificationStatus: 'Self Reported' })],
      credentials: [credential({ verificationStatus: 'Document Verified' })],
    })
    expect(profileVerificationLevel(p, AS_OF)).toBe('Document Verified')
  })
})

describe('civilian filtering', () => {
  const s1 = soldier({ id: 'a', city: 'Billings', mos: '92Y', rank: 'E5' })
  const s2 = soldier({ id: 'b', city: 'Malta', mos: '11B', rank: 'E6' })
  const profiles = new Map([
    ['a', civilian({ soldierId: 'a' })],
    ['b', civilian({
      soldierId: 'b',
      skills: [skill({ category: 'Emergency Medical Services', subcategory: 'Paramedic', verificationStatus: 'Self Reported' })],
      credentials: [],
      employment: { occupationTitle: 'Paramedic', industry: 'EMS', employerType: 'Local Government', workCity: 'Malta', workCounty: 'Phillips' },
    })],
  ])
  const roster = [s1, s2]

  it('filters by skill subcategory', () => {
    const r = filterCivilian(roster, profiles, { subcategory: 'Master Electrician' }, AS_OF)
    expect(r.map(x => x.soldier.id)).toEqual(['a'])
  })

  it('filters by minimum verification', () => {
    const r = filterCivilian(roster, profiles, { minVerification: 'Document Verified' }, AS_OF)
    expect(r.map(x => x.soldier.id)).toEqual(['a'])
  })

  it('filters by county', () => {
    const r = filterCivilian(roster, profiles, { workCounty: 'Phillips' }, AS_OF)
    expect(r.map(x => x.soldier.id)).toEqual(['b'])
  })

  it('supports free-text search across military and civilian fields', () => {
    expect(filterCivilian(roster, profiles, { query: 'paramedic' }, AS_OF).map(x => x.soldier.id)).toEqual(['b'])
    expect(filterCivilian(roster, profiles, { query: 'big sky' }, AS_OF).map(x => x.soldier.id)).toEqual(['a'])
  })

  it('does not mutate the underlying records', () => {
    const before = JSON.stringify([...profiles.values()])
    filterCivilian(roster, profiles, { query: 'electric', minYearsExperience: 5 }, AS_OF)
    expect(JSON.stringify([...profiles.values()])).toBe(before)
  })

  it('is order-stable and unaffected by input reordering of unrelated records', () => {
    const a = filterCivilian(roster, profiles, {}, AS_OF).map(x => x.soldier.id)
    const b = filterCivilian([...roster].reverse(), profiles, {}, AS_OF).map(x => x.soldier.id)
    expect(new Set(a)).toEqual(new Set(b))
  })

  it('aggregates counts by category and county', () => {
    const rows = filterCivilian(roster, profiles, {}, AS_OF)
    expect(countByCategory(rows).find(c => c.key === 'Electrical')?.count).toBe(1)
    expect(countByCounty(rows).find(c => c.key === 'Phillips')?.count).toBe(1)
  })
})

describe('deterministic civilian demo data', () => {
  it('produces identical output for the same soldier every time', () => {
    const s = soldier({ id: 'r-0042' })
    expect(JSON.stringify(buildCivilianProfile(s))).toBe(JSON.stringify(buildCivilianProfile(s)))
  })

  it('keys generation to soldier id, not roster order', () => {
    const a = soldier({ id: 'r-0100' })
    const b = soldier({ id: 'r-0200' })
    const forward = buildCivilianProfiles([a, b])
    const reversed = buildCivilianProfiles([b, a])
    expect(JSON.stringify(forward.get('r-0100'))).toBe(JSON.stringify(reversed.get('r-0100')))
  })

  it('leaves a realistic share of soldiers without civilian data', () => {
    const roster = Array.from({ length: 300 }, (_, i) => soldier({ id: `r-${i}` }))
    const profiles = buildCivilianProfiles(roster)
    expect(profiles.size).toBeGreaterThan(150)
    expect(profiles.size).toBeLessThan(300)
  })

  it('never emits a skill outside the taxonomy', () => {
    const roster = Array.from({ length: 200 }, (_, i) => soldier({ id: `d-${i}` }))
    const flat = flatTaxonomy()
    for (const p of buildCivilianProfiles(roster).values()) {
      for (const sk of p.skills) {
        expect(
          flat.some(e => e.category === sk.category && e.subcategory === sk.subcategory),
          `${sk.category}/${sk.subcategory} not in taxonomy`
        ).toBe(true)
      }
    }
  })
})
