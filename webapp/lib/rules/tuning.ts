import { PROMOTION_GATES, type PromotionGate } from '../scoring'
import { RETENTION_LIMITS, type RetentionLimit } from '../data/retention'

// ── Adjustable logic ──────────────────────────────────────────────────────────
// Every number the deterministic engines use to judge a soldier lives here and
// can be changed by an S1 without a code change. Three groups:
//
//   gates       — time in grade / time in service thresholds per grade
//   ranking     — how a succession candidate earns their score out of 100
//   assumptions — planning rates that are estimates, not policy
//   retention   — RCP / MRD caps (the tables most likely to be wrong today)
//
// HOW THE OVERRIDE IS APPLIED, and why it looks like this:
//
// PROMOTION_GATES and RETENTION_LIMITS are read directly at ~25 sites across 10
// modules. Threading a tuning parameter through all of them would be the
// textbook answer, but it would touch every signature for no behavioural gain,
// so instead applyTuning() mutates those two tables in place and every existing
// reader picks the change up unchanged.
//
// That is a deliberate trade, and it is safe only because of two rules:
//
//   1. applyTuning() is called from ONE place — TuningBoot — inside an effect,
//      never during render. This app is a static export: mutating a table
//      during render would make the prerendered HTML disagree with the browser
//      and produce a hydration mismatch.
//   2. Anything that recomputes from these tables must depend on
//      useRulesStore().version, which changes on every apply. Without that a
//      useMemo keyed on [roster, uics] would keep serving pre-tuning results.
//
// resetTuning() restores the shipped defaults exactly, and a test asserts it.

/** The three gate fields an S1 can move. PME lists stay code-owned. */
export type GateOverride = Partial<Pick<PromotionGate, 'minTig' | 'typicalTig' | 'minTis'>>

export type RetentionOverride = Partial<Pick<RetentionLimit, 'rcpAgr' | 'rcpMday' | 'mrdCommissioned'>>

/**
 * Points a succession candidate can earn. These sum to 100 before the geography
 * penalty, which subtracts. Changing one changes who the tool recommends, so
 * every field is surfaced in the editor rather than hidden as a constant.
 */
export interface RankingWeights {
  gradeExact: number
  gradeOneBelow: number
  gradeTwoBelow: number
  gradeDowngrade: number
  mosExact: number
  mosRelated: number
  mosUnrelated: number
  promotionReady: number
  promotionPartial: number
  promotionShort: number
  promotionNoGate: number
  evaluationsMax: number
  availabilityStale: number
  availabilityMid: number
  availabilityRecent: number
  /** Negative numbers. Distance reduces a score; it never adds to one. */
  geoUnder60: number
  geoUnder120: number
  geoOver120: number
  geoUnknown: number
  /** Score at or above which a candidate reads "Ready now". */
  readyNowScore: number
  /** Score at or above which a candidate reads "Ready with development". */
  readyDevelopmentScore: number
}

/** Rates and thresholds that are estimates rather than published policy. */
export interface Assumptions {
  /** Share of expiring contracts modeled as an actual separation. */
  etsSeparationRate: number
  /** Share of soldiers modeled as leaving in the year they hit 20 years. */
  twentyYearDepartRate: number
  /** Years in one seat after which a soldier is "due to move". */
  tipStaleYears: number
  /** Qualifying years for non-regular retirement eligibility. */
  retirementYears: number
  /** Officer/warrant eval blend: senior rater share. Rater takes the remainder. */
  seniorRaterShare: number
}

export interface TuningOverrides {
  gates?: Record<string, GateOverride>
  retention?: Record<string, RetentionOverride>
  ranking?: Partial<RankingWeights>
  assumptions?: Partial<Assumptions>
}

export const DEFAULT_RANKING: RankingWeights = {
  gradeExact: 30,
  gradeOneBelow: 26,
  gradeTwoBelow: 10,
  gradeDowngrade: 6,
  mosExact: 20,
  mosRelated: 12,
  mosUnrelated: 3,
  promotionReady: 20,
  promotionPartial: 10,
  promotionShort: 2,
  promotionNoGate: 12,
  evaluationsMax: 20,
  availabilityStale: 10,
  availabilityMid: 7,
  availabilityRecent: 2,
  geoUnder60: -1,
  geoUnder120: -3,
  geoOver120: -6,
  geoUnknown: -3,
  readyNowScore: 70,
  readyDevelopmentScore: 45,
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  etsSeparationRate: 0.30,
  twentyYearDepartRate: 0.25,
  tipStaleYears: 3,
  retirementYears: 20,
  seniorRaterShare: 0.7,
}

/** Snapshots taken at module load, before anything can mutate the live tables. */
const DEFAULT_GATES: Record<string, PromotionGate> =
  Object.fromEntries(Object.entries(PROMOTION_GATES).map(([g, v]) => [g, { ...v }]))
const DEFAULT_RETENTION: Record<string, RetentionLimit> =
  Object.fromEntries(Object.entries(RETENTION_LIMITS).map(([g, v]) => [g, { ...v }]))

let ranking: RankingWeights = { ...DEFAULT_RANKING }
let assumptions: Assumptions = { ...DEFAULT_ASSUMPTIONS }
let applied: TuningOverrides = {}

/** Current ranking weights. Call at use time — never cache the object. */
export function activeRanking(): RankingWeights {
  return ranking
}

export function activeAssumptions(): Assumptions {
  return assumptions
}

/** What is currently overridden, for the editor and for the AI briefing. */
export function activeOverrides(): TuningOverrides {
  return applied
}

export function defaultGate(grade: string): PromotionGate | undefined {
  return DEFAULT_GATES[grade]
}

export function defaultRetention(grade: string): RetentionLimit | undefined {
  return DEFAULT_RETENTION[grade]
}

/** A finite number, or the fallback. Guards against an emptied input box. */
function n(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/**
 * Point the engines at a new set of numbers. Call only from an effect — see the
 * header note on hydration. Always applies against the shipped defaults, so
 * calling it twice with different overrides does not compound.
 */
export function applyTuning(overrides: TuningOverrides = {}): void {
  applied = overrides

  for (const [grade, base] of Object.entries(DEFAULT_GATES)) {
    const o = overrides.gates?.[grade]
    PROMOTION_GATES[grade] = {
      ...base,
      minTig: n(o?.minTig, base.minTig),
      typicalTig: n(o?.typicalTig, base.typicalTig),
      minTis: n(o?.minTis, base.minTis),
    }
  }

  for (const [grade, base] of Object.entries(DEFAULT_RETENTION)) {
    const o = overrides.retention?.[grade]
    RETENTION_LIMITS[grade] = {
      ...base,
      // null is meaningful here — "no cap at this grade" — so it must survive
      // as null rather than being coerced to 0, which would retire everyone.
      rcpAgr: o && 'rcpAgr' in o ? o.rcpAgr ?? null : base.rcpAgr,
      rcpMday: o && 'rcpMday' in o ? o.rcpMday ?? null : base.rcpMday,
      mrdCommissioned: o && 'mrdCommissioned' in o ? o.mrdCommissioned ?? null : base.mrdCommissioned,
    }
  }

  ranking = { ...DEFAULT_RANKING }
  for (const k of Object.keys(DEFAULT_RANKING) as (keyof RankingWeights)[]) {
    ranking[k] = n(overrides.ranking?.[k], DEFAULT_RANKING[k])
  }

  assumptions = { ...DEFAULT_ASSUMPTIONS }
  for (const k of Object.keys(DEFAULT_ASSUMPTIONS) as (keyof Assumptions)[]) {
    assumptions[k] = n(overrides.assumptions?.[k], DEFAULT_ASSUMPTIONS[k])
  }
}

/** Restore every shipped default. */
export function resetTuning(): void {
  applyTuning({})
}

/** True when the value in play differs from what shipped. */
export function isTuned(overrides: TuningOverrides): boolean {
  return countTuned(overrides) > 0
}

/** How many individual values a reviewer has changed. */
export function countTuned(overrides: TuningOverrides): number {
  let count = 0
  for (const [grade, o] of Object.entries(overrides.gates ?? {})) {
    const base = DEFAULT_GATES[grade]
    if (!base) continue
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number' && v !== base[k as keyof PromotionGate]) count++
    }
  }
  for (const [grade, o] of Object.entries(overrides.retention ?? {})) {
    const base = DEFAULT_RETENTION[grade]
    if (!base) continue
    for (const [k, v] of Object.entries(o)) {
      if (v !== base[k as keyof RetentionLimit]) count++
    }
  }
  for (const [k, v] of Object.entries(overrides.ranking ?? {})) {
    if (v !== DEFAULT_RANKING[k as keyof RankingWeights]) count++
  }
  for (const [k, v] of Object.entries(overrides.assumptions ?? {})) {
    if (v !== DEFAULT_ASSUMPTIONS[k as keyof Assumptions]) count++
  }
  return count
}

/**
 * Problems a reviewer should see before trusting the output. These are warnings,
 * not validation errors — an unusual formation may justify unusual numbers, so
 * nothing here blocks a save.
 */
export function tuningWarnings(overrides: TuningOverrides): string[] {
  const out: string[] = []
  const r = { ...DEFAULT_RANKING, ...overrides.ranking }
  const a = { ...DEFAULT_ASSUMPTIONS, ...overrides.assumptions }

  const earnable = r.gradeExact + r.mosExact + r.promotionReady + r.evaluationsMax + r.availabilityStale
  if (earnable !== 100) {
    out.push(
      `A perfect candidate now scores ${earnable}, not 100 ` +
      `(grade ${r.gradeExact} + MOS ${r.mosExact} + promotion ${r.promotionReady} + ` +
      `evals ${r.evaluationsMax} + availability ${r.availabilityStale}). ` +
      `Readiness bands are absolute scores, so they shift meaning when the total moves.`
    )
  }
  if (r.readyNowScore <= r.readyDevelopmentScore) {
    out.push('"Ready now" threshold is at or below the "ready with development" threshold, so no candidate can reach the middle band.')
  }
  for (const [k, v] of Object.entries({ geoUnder60: r.geoUnder60, geoUnder120: r.geoUnder120, geoOver120: r.geoOver120, geoUnknown: r.geoUnknown })) {
    if (v > 0) out.push(`${k} is positive (${v}), so distance would raise a candidate's score. Geography penalties must be zero or negative.`)
  }
  if (a.etsSeparationRate < 0 || a.etsSeparationRate > 1) out.push('ETS separation rate must be between 0 and 1.')
  if (a.twentyYearDepartRate < 0 || a.twentyYearDepartRate > 1) out.push('20-year departure rate must be between 0 and 1.')
  if (a.seniorRaterShare < 0 || a.seniorRaterShare > 1) out.push('Senior rater share must be between 0 and 1.')
  if (a.etsSeparationRate === 1) out.push('An ETS separation rate of 1.0 treats every expiring contract as a certain loss — this made the whole formation appear to depart within one contract cycle.')

  for (const [grade, o] of Object.entries(overrides.gates ?? {})) {
    const g = { ...DEFAULT_GATES[grade], ...o }
    if (g.minTig != null && g.typicalTig != null && g.minTig > g.typicalTig) {
      out.push(`${grade}: minimum TIG (${g.minTig}) exceeds typical TIG (${g.typicalTig}).`)
    }
    if (g.minTig != null && g.minTis != null && g.minTig > g.minTis) {
      out.push(`${grade}: minimum TIG (${g.minTig}) exceeds minimum TIS (${g.minTis}) — nobody can satisfy both.`)
    }
  }
  return out
}

/**
 * The tuning, described for the AI. Without this the model would reason from the
 * published regulation while the math used the commander's local numbers.
 */
export function tuningContext(overrides: TuningOverrides): string {
  const changed = countTuned(overrides)
  if (changed === 0) {
    return '== LOCAL TUNING ==\nNone. Every threshold and weight is the shipped default.\n'
  }
  const lines: string[] = []
  for (const [grade, o] of Object.entries(overrides.gates ?? {})) {
    const base = DEFAULT_GATES[grade]
    if (!base) continue
    for (const [k, v] of Object.entries(o)) {
      const was = base[k as keyof PromotionGate]
      if (typeof v === 'number' && v !== was) lines.push(`  - ${grade} ${k}: ${was} → ${v}`)
    }
  }
  for (const [grade, o] of Object.entries(overrides.retention ?? {})) {
    const base = DEFAULT_RETENTION[grade]
    if (!base) continue
    for (const [k, v] of Object.entries(o)) {
      const was = base[k as keyof RetentionLimit]
      if (v !== was) lines.push(`  - ${grade} ${k}: ${was ?? 'none'} → ${v ?? 'none'}`)
    }
  }
  for (const [k, v] of Object.entries(overrides.ranking ?? {})) {
    const was = DEFAULT_RANKING[k as keyof RankingWeights]
    if (v !== was) lines.push(`  - candidate ranking ${k}: ${was} → ${v}`)
  }
  for (const [k, v] of Object.entries(overrides.assumptions ?? {})) {
    const was = DEFAULT_ASSUMPTIONS[k as keyof Assumptions]
    if (v !== was) lines.push(`  - assumption ${k}: ${was} → ${v}`)
  }
  return `== LOCAL TUNING ==
This organization has changed ${changed} value${changed === 1 ? '' : 's'} from the shipped defaults.
The numbers you were given above ALREADY reflect these changes — do not re-apply them.
${lines.join('\n')}
If a recommendation turns on one of these, say which local setting drove it, so the reviewer can challenge the setting rather than the conclusion.
`
}
