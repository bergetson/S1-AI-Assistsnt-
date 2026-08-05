import type { CivilianCapabilityProfile } from '../civilian/types'
import { effectiveVerification, VERIFICATION_RANK } from '../civilian/types'
import { isCommunityCritical, domainOf } from '../civilian/taxonomy'
import type { ImpactAssessment, ImpactFactor, ImpactLevel, ActivationParameters } from './types'
import { IMPACT_RANK, IMPACT_LIMITATIONS, countyForCity, isRuralCounty } from './types'

// ── Community impact model ────────────────────────────────────────────────────
// Answers "what civilian capability leaves a community if this person
// activates" — deliberately NOT the same calculation as "how useful is this
// person on the mission". A paramedic scores high on both, and conflating them
// would hide exactly the tradeoff a planner needs to see.
//
// Design rule: missing information raises uncertainty, it never lowers risk.

// Calibrated so Critical means "this person is genuinely hard to replace
// locally" rather than "this person has any critical-adjacent attribute". A
// rural paramedic reads High; a rural paramedic who is also the sole local
// provider reads Critical.
const THRESHOLDS = { moderate: 4, high: 9, critical: 16 }

function levelFor(score: number, hasMissingData: boolean): ImpactLevel {
  if (score >= THRESHOLDS.critical) return 'Critical'
  if (score >= THRESHOLDS.high) return 'High'
  if (score >= THRESHOLDS.moderate) return 'Moderate'
  // A quiet score with no civilian data at all is unknown, not low.
  if (hasMissingData && score < THRESHOLDS.moderate) return 'Unknown'
  return 'Low'
}

/**
 * Impact of removing ONE soldier from their community.
 * Callers aggregate with `aggregateImpact` to capture concentration effects that
 * only appear across a group.
 */
export function assessSoldierImpact(
  profile: CivilianCapabilityProfile | undefined,
  activation: ActivationParameters,
  asOfIso: string
): ImpactAssessment {
  const factors: ImpactFactor[] = []
  const limitations = [...IMPACT_LIMITATIONS]

  if (!profile || (!profile.employment && profile.skills.length === 0)) {
    return {
      level: 'Unknown',
      score: 0,
      factors: [],
      limitations: ['No civilian capability information on file for this soldier.', ...limitations],
      hasMissingData: true,
    }
  }

  const emp = profile.employment
  let missing = false

  // ── Occupation criticality ──────────────────────────────────────────────────
  const criticalSkills = profile.skills.filter(s => isCommunityCritical(s.category, s.subcategory))
  if (criticalSkills.length > 0) {
    const names = criticalSkills.slice(0, 3).map(s => s.subcategory).join(', ')
    factors.push({
      id: 'criticalSkill',
      label: 'Community-critical civilian skill',
      weight: 3,
      detail: `Holds community-critical capability: ${names}.`,
    })
  }

  if (emp) {
    const domain = profile.skills.length ? domainOf(profile.skills[0].category) : null
    if (domain === 'Public Safety' || domain === 'Healthcare') {
      factors.push({
        id: 'publicSafetyDomain',
        label: 'Public safety or healthcare role',
        weight: 2,
        detail: `Primary civilian capability is in ${domain.toLowerCase()}.`,
      })
    }
    if (emp.essentialCommunityRole) {
      factors.push({
        id: 'essentialRole',
        label: 'Reported essential community role',
        weight: 3,
        detail: `Self-reported as filling an essential role as ${emp.occupationTitle}.`,
      })
    }
    if (emp.soleProviderOrSpecialist) {
      factors.push({
        id: 'soleProvider',
        label: 'Sole provider or specialist',
        weight: 4,
        detail: 'Reports being one of very few people locally able to perform this role.',
      })
    }
    if (emp.smallEmployer) {
      factors.push({
        id: 'smallEmployer',
        label: 'Small employer',
        weight: 2,
        detail: 'Employer is small enough that one absence is materially felt.',
      })
    }
    if (emp.employerType === 'Self Employed') {
      factors.push({
        id: 'selfEmployed',
        label: 'Self-employed or business owner',
        weight: 2,
        detail: 'Activation may suspend the business rather than shift work to a colleague.',
      })
    }
    if (
      emp.employerType === 'Local Government' ||
      emp.employerType === 'State Government'
    ) {
      factors.push({
        id: 'publicEmployer',
        label: 'Public sector employer',
        weight: 1,
        detail: `Works for ${emp.employerType.toLowerCase()}; public services may absorb the loss.`,
      })
    }

    const county = emp.workCounty ?? countyForCity(emp.workCity)
    if (isRuralCounty(county)) {
      factors.push({
        id: 'ruralCounty',
        label: 'Rural or underserved county',
        weight: 2,
        detail: `Civilian work is in ${county} County, which has limited professional depth.`,
      })
    } else if (!county) {
      missing = true
      limitations.push('Civilian work county is unknown, so geographic concentration was not assessed.')
    }
  } else {
    missing = true
    limitations.push('No civilian employment recorded; occupation-based impact was not assessed.')
  }

  // ── Activation shape ────────────────────────────────────────────────────────
  if (activation.durationDays > 180) {
    factors.push({ id: 'durationLong', label: 'Extended activation', weight: 3, detail: `Activation of ${activation.durationDays} days removes the soldier for an extended period.` })
  } else if (activation.durationDays > 30) {
    factors.push({ id: 'durationMedium', label: 'Activation exceeds 30 days', weight: 2, detail: `Activation of ${activation.durationDays} days exceeds what most employers absorb informally.` })
  }
  if (activation.noticeDays < 7) {
    factors.push({ id: 'shortNotice', label: 'Short notice', weight: 2, detail: `Only ${activation.noticeDays} days of notice — little time for the employer to backfill.` })
  } else if (activation.noticeDays < 30) {
    factors.push({ id: 'moderateNotice', label: 'Limited notice', weight: 1, detail: `${activation.noticeDays} days of notice.` })
  }

  // ── Verification quality ────────────────────────────────────────────────────
  const verifications = [
    ...profile.skills.map(s => s.verificationStatus),
    ...profile.credentials.map(c => effectiveVerification(c, asOfIso)),
  ]
  const best = verifications.reduce((m, v) => Math.max(m, VERIFICATION_RANK[v] ?? 0), 0)
  if (verifications.length === 0 || best <= 1) {
    missing = true
    limitations.push('Civilian information is self-reported or unverified; impact may be over- or under-stated.')
  }

  const score = factors.reduce((sum, f) => sum + f.weight, 0)
  return { level: levelFor(score, missing), score, factors, limitations, hasMissingData: missing }
}

export interface GroupImpactMember {
  soldierId: string
  displayName: string
  unit: string
  profile?: CivilianCapabilityProfile
  assessment: ImpactAssessment
}

export interface GroupImpactSummary {
  level: ImpactLevel
  members: GroupImpactMember[]
  totalSelected: number
  withCivilianData: number
  missingCivilianData: number
  /** Concentration factors that only exist at group level. */
  concentrationFactors: ImpactFactor[]
  byOccupation: Array<{ key: string; count: number }>
  byCounty: Array<{ key: string; count: number }>
  byEmployer: Array<{ key: string; count: number }>
  criticalRoleCounts: Array<{ key: string; count: number }>
  limitations: string[]
}

function tally(pairs: Array<string | undefined>): Array<{ key: string; count: number }> {
  const m = new Map<string, number>()
  for (const p of pairs) {
    if (!p) continue
    m.set(p, (m.get(p) ?? 0) + 1)
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
}

/**
 * Group impact. Concentration is the whole point: five electricians from five
 * towns is a very different proposition from five from one rural co-op.
 */
export function aggregateImpact(
  members: Array<{ soldierId: string; displayName: string; unit: string; profile?: CivilianCapabilityProfile }>,
  activation: ActivationParameters,
  asOfIso: string
): GroupImpactSummary {
  const assessed: GroupImpactMember[] = members.map(m => ({
    ...m,
    assessment: assessSoldierImpact(m.profile, activation, asOfIso),
  }))

  const withData = assessed.filter(m => m.profile?.employment || (m.profile?.skills.length ?? 0) > 0)
  const byOccupation = tally(withData.map(m => m.profile?.employment?.occupationTitle))
  const byCounty = tally(withData.map(m =>
    m.profile?.employment?.workCounty ?? countyForCity(m.profile?.employment?.workCity)))
  const byEmployer = tally(withData.map(m => m.profile?.employment?.employerName))
  const criticalRoleCounts = tally(
    withData.flatMap(m => (m.profile?.skills ?? [])
      .filter(s => isCommunityCritical(s.category, s.subcategory))
      .map(s => s.subcategory)))

  const concentrationFactors: ImpactFactor[] = []
  for (const e of byEmployer) {
    if (e.count >= 2) {
      concentrationFactors.push({
        id: `employer:${e.key}`,
        label: 'Employer concentration',
        weight: 2 * e.count,
        detail: `${e.count} selected soldiers work for ${e.key}.`,
      })
    }
  }
  for (const c of byCounty) {
    if (c.count >= 3) {
      concentrationFactors.push({
        id: `county:${c.key}`,
        label: 'County concentration',
        weight: isRuralCounty(c.key) ? 2 * c.count : c.count,
        detail: `${c.count} selected soldiers work in ${c.key} County${isRuralCounty(c.key) ? ' (rural)' : ''}.`,
      })
    }
  }
  for (const o of byOccupation) {
    if (o.count >= 3) {
      concentrationFactors.push({
        id: `occupation:${o.key}`,
        label: 'Occupation concentration',
        weight: o.count,
        detail: `${o.count} selected soldiers share the civilian occupation "${o.key}".`,
      })
    }
  }
  for (const r of criticalRoleCounts) {
    if (r.count >= 2) {
      concentrationFactors.push({
        id: `criticalRole:${r.key}`,
        label: 'Critical capability concentration',
        weight: 2 * r.count,
        detail: `${r.count} selected soldiers hold the community-critical capability "${r.key}".`,
      })
    }
  }

  // Group level is the worst individual level, escalated by concentration.
  let worst: ImpactLevel = assessed.reduce<ImpactLevel>(
    (acc, m) => (IMPACT_RANK[m.assessment.level] > IMPACT_RANK[acc] ? m.assessment.level : acc),
    'Low')
  // Bands are deliberately wide. Escalating to Critical on any concentration at
  // all would make every multi-person team read Critical, and a level that never
  // varies tells a planner nothing.
  const concentrationScore = concentrationFactors.reduce((s, f) => s + f.weight, 0)
  if (concentrationScore >= 24 && IMPACT_RANK[worst] < IMPACT_RANK.Critical) worst = 'Critical'
  else if (concentrationScore >= 10 && IMPACT_RANK[worst] < IMPACT_RANK.High) worst = 'High'
  else if (concentrationScore >= 4 && IMPACT_RANK[worst] < IMPACT_RANK.Moderate) worst = 'Moderate'

  const missing = assessed.length - withData.length
  const limitations = [...IMPACT_LIMITATIONS]
  if (missing > 0) {
    limitations.unshift(
      `${missing} of ${assessed.length} selected soldiers have no civilian information on file, so the true impact may be larger than shown.`)
  }

  return {
    level: assessed.length === 0 ? 'Unknown' : worst,
    members: assessed,
    totalSelected: assessed.length,
    withCivilianData: withData.length,
    missingCivilianData: missing,
    concentrationFactors: concentrationFactors.sort((a, b) => b.weight - a.weight),
    byOccupation, byCounty, byEmployer, criticalRoleCounts,
    limitations,
  }
}
