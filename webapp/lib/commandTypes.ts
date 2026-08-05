import type { CareerCategory, ComponentStatus } from './types'

// ── Evaluation ratings ────────────────────────────────────────────────────────
// Officer OER — senior rater box check (DA Form 67-10 series)
export type SrBox = 'MQ' | 'HQ' | 'Q' | 'NQ' | ''
// Officer OER — rater performance evaluation
export type RaterBox = 'EXCELS' | 'PROFICIENT' | 'CAPABLE' | 'UNSATISFACTORY' | ''
// Enlisted NCOER — senior rater / overall potential (DA Form 2166-9 series)
export type NcoerBox =
  | 'Most Qualified'
  | 'Highly Qualified'
  | 'Qualified'
  | 'Not Qualified'
  | ''

export const SR_BOX_LABEL: Record<Exclude<SrBox, ''>, string> = {
  MQ: 'Most Qualified',
  HQ: 'Highly Qualified',
  Q: 'Qualified',
  NQ: 'Not Qualified',
}

// Higher = stronger. Used for sorting and for the deterministic candidate score.
export const SR_BOX_WEIGHT: Record<string, number> = {
  MQ: 100, 'Most Qualified': 100,
  HQ: 70, 'Highly Qualified': 70,
  Q: 40, Qualified: 40,
  NQ: 0, 'Not Qualified': 0,
  '': 35, // unrated — treated as neutral-ish, never rewarded
}

export const RATER_BOX_WEIGHT: Record<string, number> = {
  EXCELS: 100,
  PROFICIENT: 65,
  CAPABLE: 35,
  UNSATISFACTORY: 0,
  '': 30,
}

/** Commanders think in rank names, not pay grades. 'O3' reads as zero-three. */
export const RANK_LABEL: Record<string, string> = {
  E1: 'PVT', E2: 'PV2', E3: 'PFC', E4: 'SPC', E5: 'SGT', E6: 'SSG',
  E7: 'SFC', E8: 'MSG', E9: 'SGM',
  W1: 'WO1', W2: 'CW2', W3: 'CW3', W4: 'CW4', W5: 'CW5',
  O1: '2LT', O2: '1LT', O3: 'CPT', O4: 'MAJ', O5: 'LTC', O6: 'COL',
}

/**
 * Display name for a soldier. The de-identified baseline roster carries a
 * pseudonym in lastName and an empty firstName, so this must not emit a
 * dangling comma.
 */
export function soldierLabel(s: { lastName: string; firstName: string }): string {
  const last = (s.lastName ?? '').trim()
  const first = (s.firstName ?? '').trim()
  if (!first) return last || 'Unknown'
  return `${last}, ${first}`
}

export function rankLabel(grade: string): string {
  return RANK_LABEL[grade] ?? grade
}

// ── Roster soldier ────────────────────────────────────────────────────────────
// One record per person in the commander's formation. Lives ONLY in localStorage.
// `lastName` / `firstName` are never transmitted to an AI provider — see
// lib/commanderAI.ts, which swaps them for `anonId` at the boundary.
export interface RosterSoldier {
  id: string                    // stable local key, e.g. 'r-0142'
  anonId: string                // what the AI sees, e.g. 'S-142'
  lastName: string
  firstName: string

  // Grade & branch
  rank: string                  // 'E5' | 'W2' | 'O3' ...
  careerCategory: CareerCategory
  mos: string
  componentStatus: ComponentStatus   // AGR / M-Day / Technician / ADOS / IRR

  // Assignment
  uic: string                   // join key back into positions.ts
  unitName: string              // display name (resolved, not the raw UIC)
  city: string
  dutyTitle: string
  positionId: number | null     // link to a Position record when known

  // Service clocks (years, decimal)
  yearsOfService: number        // TIS — drives retirement + RCP
  timeInGrade: number           // TIG — drives board eligibility
  timeInPosition: number        // TIP — drives "stale in seat" flags
  commissionedYears: number     // years of commissioned service (officers; 0 otherwise)
  pebd: string                  // ISO date, informational
  ets: string                   // ISO date — drives the attrition forecast

  // Evaluations
  srBox: SrBox                  // officer senior rater box
  raterBox: RaterBox            // officer rater box
  ncoerBox: NcoerBox            // enlisted senior rater box
  evalBullets: string           // optional free text (sensitive — anonymized, opt-in)

  // Readiness
  pmeComplete: string[]         // ['BLC','ALC'] / ['BOLC','CCC'] / ['WOBC']
  isPromotable: boolean
  flagged: boolean              // adverse action / non-deployable flag
  notes: string
}

// ── Formation (a selectable unit) ─────────────────────────────────────────────
export interface FormationUnit {
  uic: string
  name: string                  // resolved human-readable name
  city: string
  authorized: number            // billets in positions.ts for this UIC
  assigned: number              // roster soldiers matched to this UIC
}

// ── Manning ───────────────────────────────────────────────────────────────────
export interface ManningRow {
  key: string                   // grade or category label
  authorized: number
  assigned: number
  delta: number                 // assigned - authorized (negative = short)
  fillPct: number               // 0-100
}

export interface ManningReport {
  byGrade: ManningRow[]
  byCategory: ManningRow[]
  totalAuthorized: number
  totalAssigned: number
  totalFillPct: number
  unmatchedSoldiers: number     // roster entries whose UIC isn't in the formation
}

// ── Attrition ─────────────────────────────────────────────────────────────────
export type DepartureReason =
  | 'ETS'
  | 'Retirement eligible (20 yr)'
  | 'RCP (AGR)'
  | 'MRD (commissioned service)'

export interface DepartureRisk {
  soldier: RosterSoldier
  year: number                  // calendar year of projected departure
  reason: DepartureReason
  detail: string
  certainty: 'date-certain' | 'projected'
  /**
   * Expected headcount contribution, 0–1. Statutory removals count as a whole
   * person; an ETS is a contract expiring, not a departure — most soldiers
   * reenlist — so it contributes only the historical separation share.
   */
  weight: number
}

export interface AttritionYear {
  year: number
  /** Statutory departures only (RCP, MRD). These are not negotiable. */
  hard: number
  /** Hard losses plus the weighted share of ETS and retirement decisions. */
  expected: number
  /** Everyone with any departure trigger in this year, regardless of weight. */
  atRisk: number
  byCategory: Record<CareerCategory, number>
  byGrade: Record<string, number>
  departures: DepartureRisk[]
}

// ── Promotion forecast ────────────────────────────────────────────────────────
export interface PromotionNeed {
  fromGrade: string
  toGrade: string
  category: CareerCategory
  authorizedAtTarget: number    // billets at the target grade in this formation
  filledAtTarget: number        // currently assigned at target grade
  projectedLosses: number       // target-grade departures within the horizon
  promotionsNeeded: number      // billets to fill = (auth - filled) + losses
  eligibleNow: number           // feeder-grade soldiers already past minTig
  eligibleByHorizon: number     // feeder-grade soldiers past minTig by horizon end
  feederStrength: number        // total soldiers at the feeder grade
  gap: number                   // promotionsNeeded - eligibleByHorizon (>0 = shortfall)
  minTig: number
  typicalTig: number
  /**
   * True when the formation has no billets AND no people at the feeder grade —
   * e.g. an infantry battalion has no 2LT billets, so CPT seats are not grown
   * from inside. Those requirements are met by accession (OCS/ROTC/direct) or
   * lateral transfer, and flagging them as a promotion "shortfall" is noise.
   */
  accessionDriven: boolean
  /**
   * True when the feeder grade carries no time-in-grade or time-in-service, so
   * eligibility cannot be computed. Distinct from "nobody is eligible".
   */
  eligibilityUnknown: boolean
}

// ── Succession / candidate matching ───────────────────────────────────────────
export interface CandidateFactor {
  label: string
  points: number
  max: number
  detail: string
}

export interface Candidate {
  soldier: RosterSoldier
  score: number                 // 0-100
  factors: CandidateFactor[]
  blockers: string[]            // hard problems (grade mismatch, flagged, etc.)
  readiness: 'Ready now' | 'Ready with development' | 'Not ready'
}
