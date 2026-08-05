import type { SoldierProfile, Position } from './types'
import { PROMOTION_GATES, RANK_NUM } from './scoring'
import { getCommute } from './data/cities'

// ── Multi-dimensional recommendation ──────────────────────────────────────────
// The 0-100 score is kept for sorting, but it is never the whole answer. A
// blocking gap must stay visible even when the total looks good, and missing
// data must read as Unknown rather than quietly scoring as neutral.

export type Eligibility = 'Eligible' | 'Conditionally Eligible' | 'Not Eligible' | 'Unknown'
export type Readiness =
  | 'Ready Now' | 'Ready in 0-6 Months' | 'Ready in 6-18 Months'
  | 'Developmental Candidate' | 'Not Currently Feasible' | 'Unknown'
export type Strength = 'Strong' | 'Moderate' | 'Weak' | 'Unknown'
export type NeedLevel = 'Critical' | 'High' | 'Moderate' | 'Low' | 'Unknown'
export type QualFit = 'Strong' | 'Moderate' | 'Weak' | 'Blocking Gap' | 'Unknown'
export type CivilianFit = 'Strong' | 'Moderate' | 'Weak' | 'Not Relevant' | 'Unknown'

export interface Factor {
  label: string
  value: string
  detail: string
  /** True when this factor was left out of the score because data was missing. */
  excluded?: boolean
}

export type GapSeverity = 'Hard Blocker' | 'Significant Gap' | 'Development Opportunity' | 'Missing Data'

export interface Gap {
  severity: GapSeverity
  label: string
  detail: string
  recommendedAction: string
  timeline?: string
  responsibleParty?: string
  ruleId?: string
}

export interface Assessment {
  eligibility: Eligibility
  readiness: Readiness
  preferenceFit: Strength
  organizationalNeed: NeedLevel
  militaryQualFit: QualFit
  civilianFit: CivilianFit
  factors: Factor[]
  gaps: Gap[]
  /** Retained for sorting only. */
  sortScore: number
}

function gradeDelta(profile: SoldierProfile, pos: Position): number {
  return (RANK_NUM[pos.grade] ?? 0) - (RANK_NUM[profile.rank] ?? 0)
}

/**
 * Assess a soldier against one position across independent dimensions.
 * Every dimension can independently be Unknown; none of them silently defaults
 * to a favorable value.
 */
export function assessOpportunity(profile: SoldierProfile, pos: Position): Assessment {
  const factors: Factor[] = []
  const gaps: Gap[] = []
  const delta = gradeDelta(profile, pos)
  const gate = PROMOTION_GATES[pos.grade]

  // ── Eligibility ─────────────────────────────────────────────────────────────
  let eligibility: Eligibility = 'Eligible'
  if (profile.careerCategory !== pos.careerCategory) {
    eligibility = 'Not Eligible'
    gaps.push({
      severity: 'Hard Blocker',
      label: 'Career category mismatch',
      detail: `${profile.careerCategory} soldiers cannot fill a ${pos.careerCategory} billet.`,
      recommendedAction: pos.careerCategory === 'Officer'
        ? 'Explore OCS or direct commission if this track is the goal.'
        : 'Look at billets within your career category.',
      responsibleParty: 'Soldier / S1',
    })
  } else if (delta > 1) {
    eligibility = 'Not Eligible'
    gaps.push({
      severity: 'Hard Blocker',
      label: 'Grade too far below billet',
      detail: `${profile.rank} is ${delta} grades below ${pos.grade}.`,
      recommendedAction: 'Target an intermediate grade first.',
      responsibleParty: 'Soldier',
    })
  } else if (delta === 1 && gate) {
    const tigOk = profile.timeInGrade >= gate.minTig
    const tisOk = profile.yearsOfService >= gate.minTis
    if (!tigOk || !tisOk) {
      eligibility = 'Conditionally Eligible'
      if (!tigOk) {
        gaps.push({
          severity: 'Significant Gap',
          label: 'Time in grade',
          detail: `${profile.timeInGrade} yr TIG against a ${gate.minTig} yr minimum for ${pos.grade}.`,
          recommendedAction: `Continue building TIG; you need about ${Math.max(0, gate.minTig - profile.timeInGrade).toFixed(1)} more years.`,
          timeline: `${Math.ceil(Math.max(0, gate.minTig - profile.timeInGrade))} yr`,
          responsibleParty: 'Time',
          ruleId: `promo.${pos.grade}`,
        })
      }
      if (!tisOk) {
        gaps.push({
          severity: 'Significant Gap',
          label: 'Time in service',
          detail: `${profile.yearsOfService} yr TIS against a ${gate.minTis} yr minimum for ${pos.grade}.`,
          recommendedAction: 'Continue service; this gate closes with time.',
          timeline: `${Math.ceil(Math.max(0, gate.minTis - profile.yearsOfService))} yr`,
          responsibleParty: 'Time',
          ruleId: `promo.${pos.grade}`,
        })
      }
    }
    const missingPme = (gate.pmeRequired ?? []).filter(
      f => !(profile as unknown as Record<string, boolean>)[f])
    for (const f of missingPme) {
      eligibility = 'Not Eligible'
      gaps.push({
        severity: 'Hard Blocker',
        label: `Required PME: ${f.replace('Complete', '').toUpperCase()}`,
        detail: `${pos.grade} requires this course before promotion.`,
        recommendedAction: 'Request a school seat through your S1/training NCO.',
        timeline: 'Next available class',
        responsibleParty: 'Soldier / S3 Training',
        ruleId: `promo.${pos.grade}`,
      })
    }
  }
  factors.push({
    label: 'Eligibility basis',
    value: eligibility,
    detail: gate
      ? `${pos.grade} gate: ${gate.minTig} yr TIG / ${gate.minTis} yr TIS.`
      : `No published promotion gate for ${pos.grade}.`,
    excluded: !gate,
  })

  // ── Readiness ───────────────────────────────────────────────────────────────
  let readiness: Readiness
  if (eligibility === 'Not Eligible') readiness = 'Not Currently Feasible'
  else if (delta <= 0) readiness = 'Ready Now'
  else if (eligibility === 'Eligible') readiness = 'Ready Now'
  else if (gate) {
    const tigShort = Math.max(0, gate.minTig - profile.timeInGrade)
    const tisShort = Math.max(0, gate.minTis - profile.yearsOfService)
    const worst = Math.max(tigShort, tisShort)
    readiness = worst <= 0.5 ? 'Ready in 0-6 Months'
      : worst <= 1.5 ? 'Ready in 6-18 Months'
      : 'Developmental Candidate'
  } else readiness = 'Unknown'

  // ── Military qualification fit ──────────────────────────────────────────────
  let militaryQualFit: QualFit
  if (!profile.mos || !pos.mos) {
    militaryQualFit = 'Unknown'
    gaps.push({
      severity: 'Missing Data',
      label: 'MOS unknown',
      detail: 'MOS is missing on the profile or the billet.',
      recommendedAction: 'Complete the MOS field so qualification fit can be assessed.',
      responsibleParty: 'Soldier / S1',
    })
  } else if (profile.mos === pos.mos) militaryQualFit = 'Strong'
  else if (profile.mos.slice(0, 2) === pos.mos.slice(0, 2)) militaryQualFit = 'Moderate'
  else if (profile.secondaryMos && profile.secondaryMos === pos.mos) militaryQualFit = 'Moderate'
  else {
    militaryQualFit = 'Weak'
    gaps.push({
      severity: 'Development Opportunity',
      label: 'MOS mismatch',
      detail: `${profile.mos} against a ${pos.mos} billet.`,
      recommendedAction: 'Request reclassification counseling if this path is the goal.',
      timeline: '6-18 months',
      responsibleParty: 'Soldier / Retention NCO',
    })
  }
  factors.push({ label: 'Military qualification', value: militaryQualFit,
    detail: `Soldier MOS ${profile.mos || 'unknown'} vs billet ${pos.mos || 'unknown'}.` })

  // ── Preference fit ──────────────────────────────────────────────────────────
  let preferenceFit: Strength = 'Unknown'
  const prefSignals: boolean[] = []
  if (profile.desiredPositionType && profile.desiredPositionType !== 'Any') {
    prefSignals.push(profile.desiredPositionType === pos.positionType)
  }
  if (profile.preferredStatus && profile.preferredStatus !== 'Either') {
    prefSignals.push(profile.preferredStatus === pos.statusType)
  }
  if (profile.openToCommand === 'Yes' && pos.isCommandOrKD) prefSignals.push(true)
  if (prefSignals.length === 0) {
    factors.push({ label: 'Preference fit', value: 'Unknown',
      detail: 'No position-type or status preference recorded.', excluded: true })
  } else {
    const hits = prefSignals.filter(Boolean).length
    preferenceFit = hits === prefSignals.length ? 'Strong' : hits > 0 ? 'Moderate' : 'Weak'
    factors.push({ label: 'Preference fit', value: preferenceFit,
      detail: `${hits} of ${prefSignals.length} stated preferences matched.` })
  }

  // ── Organizational need ─────────────────────────────────────────────────────
  let organizationalNeed: NeedLevel
  if (pos.vacancyStatus === 'Vacant') {
    organizationalNeed = pos.isCommandOrKD ? 'Critical' : 'High'
  } else if (pos.vacancyStatus === 'Projected Vacant') organizationalNeed = 'Moderate'
  else organizationalNeed = 'Low'
  factors.push({ label: 'Organizational need', value: organizationalNeed,
    detail: `Billet is ${pos.vacancyStatus}${pos.isCommandOrKD ? ' and is a command/KD position' : ''}.` })

  // ── Commute — explicitly excluded when unknown ──────────────────────────────
  const commute = getCommute(profile.homeCity, pos.city)
  if (!commute) {
    factors.push({
      label: 'Commute fit', value: 'Unknown',
      detail: `No route information between ${profile.homeCity || 'home'} and ${pos.city}. Excluded from the recommendation calculation.`,
      excluded: true,
    })
    gaps.push({
      severity: 'Missing Data',
      label: 'Commute unknown',
      detail: `No drive-time data for ${profile.homeCity || 'home'} → ${pos.city}.`,
      recommendedAction: 'Confirm the drive yourself before committing to this billet.',
      responsibleParty: 'Soldier',
    })
  } else {
    factors.push({ label: 'Commute fit',
      value: commute.minutes <= 60 ? 'Strong' : commute.minutes <= 120 ? 'Moderate' : 'Weak',
      detail: `${commute.minutes} min / ${commute.miles} mi via ${commute.route}.` })
  }

  // Civilian capability is not part of billet matching — that is a mission
  // question, not an assignment question.
  const civilianFit: CivilianFit = 'Not Relevant'

  // ── Sort score ──────────────────────────────────────────────────────────────
  const eligPts = { Eligible: 40, 'Conditionally Eligible': 25, Unknown: 10, 'Not Eligible': 0 }[eligibility]
  const qualPts = { Strong: 25, Moderate: 15, Weak: 5, Unknown: 0, 'Blocking Gap': 0 }[militaryQualFit]
  const needPts = { Critical: 20, High: 15, Moderate: 10, Low: 5, Unknown: 0 }[organizationalNeed]
  const prefPts = { Strong: 10, Moderate: 6, Weak: 2, Unknown: 0 }[preferenceFit]
  const commutePts = commute ? (commute.minutes <= 60 ? 5 : commute.minutes <= 120 ? 3 : 1) : 0
  const sortScore = Math.max(0, Math.min(100, eligPts + qualPts + needPts + prefPts + commutePts))

  return {
    eligibility, readiness, preferenceFit, organizationalNeed,
    militaryQualFit, civilianFit, factors, gaps, sortScore,
  }
}

export function hardBlockers(a: Assessment): Gap[] {
  return a.gaps.filter(g => g.severity === 'Hard Blocker')
}

export function missingDataGaps(a: Assessment): Gap[] {
  return a.gaps.filter(g => g.severity === 'Missing Data')
}
