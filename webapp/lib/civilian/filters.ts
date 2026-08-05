import type { RosterSoldier } from '../commandTypes'
import type { CivilianCapabilityProfile, VerificationStatus, SkillProficiency } from './types'
import { VERIFICATION_RANK, PROFICIENCY_RANK, effectiveVerification, isCredentialExpired } from './types'
import { countyForCity } from '../communityImpact/types'

// ── Civilian skill search ─────────────────────────────────────────────────────
// One filter implementation shared by the Skills Explorer, Mission Builder,
// Talent views, and the G1 state view, so a "master electrician" means the same
// thing everywhere.

export interface CivilianFilter {
  query?: string
  category?: string
  subcategory?: string
  occupation?: string
  industry?: string
  credentialName?: string
  minProficiency?: SkillProficiency
  minVerification?: VerificationStatus
  minYearsExperience?: number
  excludeExpiredCredentials?: boolean
  workCounty?: string
  homeCity?: string
  uic?: string
  uics?: string[]
  rank?: string
  careerCategory?: string
  mos?: string
  componentStatus?: string
  willingToUseCivilianSkills?: boolean
  availableStateActiveDuty?: boolean
  willingCrossUnit?: boolean
  minTravelMiles?: number
  essentialCommunityRole?: boolean
  soleProviderOrSpecialist?: boolean
  smallEmployer?: boolean
}

export interface CivilianSearchRow {
  soldier: RosterSoldier
  profile: CivilianCapabilityProfile
  /** Skills that actually matched the filter, for "why did this match" display. */
  matchedSkills: CivilianCapabilityProfile['skills']
  bestVerification: VerificationStatus
  hasExpiredCredential: boolean
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function matchesQuery(
  soldier: RosterSoldier, profile: CivilianCapabilityProfile, q: string
): boolean {
  const hay = [
    profile.employment?.occupationTitle,
    profile.employment?.industry,
    profile.employment?.employerName,
    profile.employment?.workCity,
    profile.employment?.workCounty,
    ...profile.skills.flatMap(s => [s.category, s.subcategory, s.skillName, s.notes]),
    ...profile.credentials.map(c => c.name),
    ...profile.languages,
    ...profile.educationFields,
    soldier.mos, soldier.dutyTitle, soldier.unitName, soldier.city,
  ].filter(Boolean).map(v => norm(String(v)))
  return hay.some(h => h.includes(q))
}

/**
 * Filter a roster by civilian capability. Pure: never mutates inputs, and the
 * result order is stable for a given input order.
 */
export function filterCivilian(
  roster: RosterSoldier[],
  profiles: Map<string, CivilianCapabilityProfile>,
  filter: CivilianFilter,
  asOfIso: string
): CivilianSearchRow[] {
  const q = filter.query ? norm(filter.query) : ''
  const rows: CivilianSearchRow[] = []

  for (const soldier of roster) {
    const profile = profiles.get(soldier.id)
    if (!profile) continue

    // ── Military-side filters ────────────────────────────────────────────────
    if (filter.uic && soldier.uic !== filter.uic) continue
    if (filter.uics?.length && !filter.uics.includes(soldier.uic)) continue
    if (filter.rank && soldier.rank !== filter.rank) continue
    if (filter.careerCategory && soldier.careerCategory !== filter.careerCategory) continue
    if (filter.mos && soldier.mos !== filter.mos) continue
    if (filter.componentStatus && soldier.componentStatus !== filter.componentStatus) continue
    if (filter.homeCity && soldier.city !== filter.homeCity) continue

    // ── Employment filters ───────────────────────────────────────────────────
    const emp = profile.employment
    if (filter.occupation && emp?.occupationTitle !== filter.occupation) continue
    if (filter.industry && emp?.industry !== filter.industry) continue
    if (filter.workCounty) {
      const county = emp?.workCounty ?? countyForCity(emp?.workCity)
      if (county !== filter.workCounty) continue
    }
    if (filter.essentialCommunityRole && !emp?.essentialCommunityRole) continue
    if (filter.soleProviderOrSpecialist && !emp?.soleProviderOrSpecialist) continue
    if (filter.smallEmployer && !emp?.smallEmployer) continue

    // ── Willingness ──────────────────────────────────────────────────────────
    const w = profile.willingness
    if (filter.willingToUseCivilianSkills && w.useCivilianSkillsOnMission === 'No') continue
    if (filter.availableStateActiveDuty && w.supportStateActiveDuty === 'No') continue
    if (filter.willingCrossUnit && w.supportOtherUnits === 'No') continue
    if (filter.minTravelMiles != null && (w.maxTravelMiles ?? 0) < filter.minTravelMiles) continue

    // ── Credentials ──────────────────────────────────────────────────────────
    const hasExpired = profile.credentials.some(c => isCredentialExpired(c, asOfIso))
    if (filter.credentialName) {
      const target = norm(filter.credentialName)
      const found = profile.credentials.filter(c => norm(c.name).includes(target))
      if (found.length === 0) continue
      if (filter.excludeExpiredCredentials && found.every(c => isCredentialExpired(c, asOfIso))) continue
    } else if (filter.excludeExpiredCredentials && hasExpired && profile.credentials.length > 0) {
      if (profile.credentials.every(c => isCredentialExpired(c, asOfIso))) continue
    }

    // ── Skill-level filters ──────────────────────────────────────────────────
    let candidateSkills = profile.skills
    if (filter.category) candidateSkills = candidateSkills.filter(s => s.category === filter.category)
    if (filter.subcategory) candidateSkills = candidateSkills.filter(s => s.subcategory === filter.subcategory)
    if (filter.minProficiency) {
      const floor = PROFICIENCY_RANK[filter.minProficiency]
      candidateSkills = candidateSkills.filter(s => PROFICIENCY_RANK[s.proficiency] >= floor)
    }
    if (filter.minVerification) {
      const floor = VERIFICATION_RANK[filter.minVerification]
      candidateSkills = candidateSkills.filter(s => VERIFICATION_RANK[s.verificationStatus] >= floor)
    }
    if (filter.minYearsExperience != null) {
      candidateSkills = candidateSkills.filter(s => (s.yearsExperience ?? 0) >= filter.minYearsExperience!)
    }

    const skillFilterActive = Boolean(
      filter.category || filter.subcategory || filter.minProficiency ||
      filter.minVerification || filter.minYearsExperience != null)
    if (skillFilterActive && candidateSkills.length === 0) continue

    if (q && !matchesQuery(soldier, profile, q)) continue

    const bestVerification = [
      ...profile.skills.map(s => s.verificationStatus),
      ...profile.credentials.map(c => effectiveVerification(c, asOfIso)),
    ].reduce<VerificationStatus>(
      (best, v) => (VERIFICATION_RANK[v] > VERIFICATION_RANK[best] ? v : best), 'Unverified')

    rows.push({
      soldier, profile,
      matchedSkills: skillFilterActive ? candidateSkills : profile.skills,
      bestVerification,
      hasExpiredCredential: hasExpired,
    })
  }

  return rows
}

// ── Aggregations for dashboards ───────────────────────────────────────────────
export interface SkillCount { key: string; count: number; verifiedCount: number }

export function countBy(
  rows: CivilianSearchRow[],
  keyFn: (r: CivilianSearchRow) => string | undefined
): SkillCount[] {
  const m = new Map<string, { count: number; verified: number }>()
  for (const r of rows) {
    const k = keyFn(r)
    if (!k) continue
    const cur = m.get(k) ?? { count: 0, verified: 0 }
    cur.count++
    if (VERIFICATION_RANK[r.bestVerification] >= VERIFICATION_RANK['Leader Reviewed']) cur.verified++
    m.set(k, cur)
  }
  return [...m.entries()]
    .map(([key, v]) => ({ key, count: v.count, verifiedCount: v.verified }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

/**
 * Count rows against a set of keys each row contributes. A soldier holding two
 * skills in one category counts once for that category, not twice.
 */
function countByMulti(
  rows: CivilianSearchRow[],
  keysFn: (r: CivilianSearchRow) => string[]
): SkillCount[] {
  const m = new Map<string, { count: number; verified: number }>()
  for (const r of rows) {
    const isVerified = VERIFICATION_RANK[r.bestVerification] >= VERIFICATION_RANK['Leader Reviewed']
    for (const k of new Set(keysFn(r))) {
      const cur = m.get(k) ?? { count: 0, verified: 0 }
      cur.count++
      if (isVerified) cur.verified++
      m.set(k, cur)
    }
  }
  return [...m.entries()]
    .map(([key, v]) => ({ key, count: v.count, verifiedCount: v.verified }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

export function countByCategory(rows: CivilianSearchRow[]): SkillCount[] {
  return countByMulti(rows, r => r.profile.skills.map(s => s.category))
}

export function countBySubcategory(rows: CivilianSearchRow[]): SkillCount[] {
  return countByMulti(rows, r => r.profile.skills.map(s => s.subcategory))
}

export function countByCounty(rows: CivilianSearchRow[]): SkillCount[] {
  return countBy(rows, r => r.profile.employment?.workCounty ?? countyForCity(r.profile.employment?.workCity))
}

export function countByOccupation(rows: CivilianSearchRow[]): SkillCount[] {
  return countBy(rows, r => r.profile.employment?.occupationTitle)
}
