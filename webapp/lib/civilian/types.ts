import type { DataProvenance } from '../provenance'

// ── Civilian capability model ─────────────────────────────────────────────────
// Kept in its own structure rather than bolted onto SoldierProfile: civilian
// capability answers different questions, has a different verification lifecycle,
// and carries different privacy weight than military assignment data.
//
// Two questions this model must answer SEPARATELY:
//   1. What civilian expertise could help accomplish a mission?
//   2. What civilian capability leaves a community if these soldiers activate?
// They are never combined into a single score.

export type VerificationStatus =
  | 'Self Reported'
  | 'Leader Reviewed'
  | 'Document Verified'
  | 'Expired'
  | 'Unverified'

/** Ordered weakest → strongest for ranking competing claims. */
export const VERIFICATION_RANK: Record<VerificationStatus, number> = {
  Unverified: 0,
  Expired: 0,
  'Self Reported': 1,
  'Leader Reviewed': 2,
  'Document Verified': 3,
}

export type SkillProficiency =
  | 'Familiarity'
  | 'Working Experience'
  | 'Professional'
  | 'Licensed or Certified'
  | 'Senior Expert or Instructor'

export const PROFICIENCY_RANK: Record<SkillProficiency, number> = {
  Familiarity: 1,
  'Working Experience': 2,
  Professional: 3,
  'Licensed or Certified': 4,
  'Senior Expert or Instructor': 5,
}

export const PROFICIENCY_ORDER: SkillProficiency[] = [
  'Familiarity', 'Working Experience', 'Professional',
  'Licensed or Certified', 'Senior Expert or Instructor',
]

export interface CivilianSkill {
  id: string
  category: string
  subcategory: string
  skillName: string
  proficiency: SkillProficiency
  yearsExperience?: number
  lastUsedYear?: number
  verificationStatus: VerificationStatus
  notes?: string
}

export interface CivilianCredential {
  id: string
  name: string
  category: string
  issuingAuthority?: string
  /** ISO date. Absent means "no expiration recorded", which is not the same as current. */
  expirationDate?: string
  verificationStatus: VerificationStatus
  notes?: string
}

export type EmployerType =
  | 'Private' | 'Federal Government' | 'State Government' | 'Local Government'
  | 'Nonprofit' | 'Self Employed' | 'Other'

export type SupervisoryLevel =
  | 'None' | 'Team Lead' | 'Supervisor' | 'Manager' | 'Executive' | 'Owner'

export interface CivilianEmployment {
  occupationTitle: string
  standardizedOccupation?: string
  industry: string
  employerType: EmployerType
  employerName?: string
  workCity?: string
  workCounty?: string
  yearsInOccupation?: number
  supervisoryLevel?: SupervisoryLevel
  personnelSupervised?: number
  /** Self-reported: the role is essential to the community (EMS, utilities, etc.). */
  essentialCommunityRole?: boolean
  /** Self-reported: few or no local substitutes for this person's role. */
  soleProviderOrSpecialist?: boolean
  /** Self-reported: employer is small enough that losing one person hurts. */
  smallEmployer?: boolean
}

export type Willingness = 'Yes' | 'No' | 'Maybe'

export interface CivilianCapabilityProfile {
  soldierId: string
  employment?: CivilianEmployment
  skills: CivilianSkill[]
  credentials: CivilianCredential[]
  educationFields: string[]
  languages: string[]
  projectManagementExperience?: {
    hasExperience: boolean
    largestTeam?: number
    largestBudget?: number
    yearsExperience?: number
  }
  willingness: {
    useCivilianSkillsOnMission: 'Yes' | 'No' | 'Ask Me'
    supportStateActiveDuty: Willingness
    supportOtherUnits: Willingness
    mentorOthers: 'Yes' | 'No'
    maxTravelMiles?: number
  }
  provenance: DataProvenance
  /** ISO date the soldier last touched the profile. */
  lastUpdated?: string
}

// ── Derived helpers ───────────────────────────────────────────────────────────

export function isCredentialExpired(c: CivilianCredential, asOfIso: string): boolean {
  if (c.verificationStatus === 'Expired') return true
  if (!c.expirationDate) return false
  return c.expirationDate < asOfIso
}

/** Expiring inside the window but not yet expired. */
export function isCredentialExpiringSoon(
  c: CivilianCredential, asOfIso: string, days = 180
): boolean {
  if (!c.expirationDate || isCredentialExpired(c, asOfIso)) return false
  const exp = Date.parse(`${c.expirationDate}T12:00:00Z`)
  const now = Date.parse(`${asOfIso}T12:00:00Z`)
  if (!Number.isFinite(exp) || !Number.isFinite(now)) return false
  return exp - now <= days * 86_400_000
}

/**
 * Effective verification for a credential, downgrading to Expired once the date
 * has passed. A lapsed license must never read as Document Verified.
 */
export function effectiveVerification(
  c: CivilianCredential, asOfIso: string
): VerificationStatus {
  return isCredentialExpired(c, asOfIso) ? 'Expired' : c.verificationStatus
}

/** Years since a skill was last used. null when unknown — never treat as recent. */
export function yearsSinceUse(skill: CivilianSkill, asOfYear: number): number | null {
  if (skill.lastUsedYear == null) return null
  return Math.max(0, asOfYear - skill.lastUsedYear)
}

export function isSkillCurrent(skill: CivilianSkill, asOfYear: number, staleAfter = 5): boolean {
  const since = yearsSinceUse(skill, asOfYear)
  return since != null && since <= staleAfter
}

/** Highest verification present on the profile, for a quick badge. */
export function profileVerificationLevel(
  p: CivilianCapabilityProfile, asOfIso: string
): VerificationStatus {
  const all: VerificationStatus[] = [
    ...p.skills.map(s => s.verificationStatus),
    ...p.credentials.map(c => effectiveVerification(c, asOfIso)),
  ]
  if (all.length === 0) return 'Unverified'
  return all.reduce((best, v) =>
    VERIFICATION_RANK[v] > VERIFICATION_RANK[best] ? v : best, 'Unverified' as VerificationStatus)
}

export function emptyCivilianProfile(soldierId: string, provenance: DataProvenance): CivilianCapabilityProfile {
  return {
    soldierId,
    skills: [],
    credentials: [],
    educationFields: [],
    languages: [],
    willingness: {
      useCivilianSkillsOnMission: 'Ask Me',
      supportStateActiveDuty: 'Maybe',
      supportOtherUnits: 'Maybe',
      mentorOthers: 'No',
    },
    provenance,
  }
}
