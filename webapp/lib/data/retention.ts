// ── Retention / separation limits ─────────────────────────────────────────────
// Drives the attrition forecast. Structured and cited the same way PROMOTION_GATES
// in lib/scoring.ts is, and like that table it MUST be verified against current
// policy before anyone makes a real personnel decision from it.
//
// Two things make this messier than a single table, and the model reflects both:
//
// 1. Enlisted RCP is component-dependent. The standard Army retention control
//    points bind AGR soldiers, but explicitly do NOT apply to M-Day / TPU
//    soldiers, who are governed by NGR 600-200 separation criteria and the
//    age-60 MRD instead. ARNG AGR additionally carries its own exceptions
//    (SGT and below at 20 yr, SSG at 23 yr) per NGB PPOM 16-028.
//
// 2. Officer removal is only a flat years-of-service rule at the top two grades.
//    10 USC 14507 removes LTC at 28 years and COL at 30 years of commissioned
//    service — date-certain. Below that, separation is driven by failure of
//    selection (10 USC 14505 for 1LT/CPT, 14506 for MAJ), which is a board
//    outcome, not a clock. Those grades are modeled as "no hard limit" rather
//    than given an invented number.

export interface RetentionLimit {
  grade: string
  /** TIS cap (years) for AGR / Title 10 soldiers. null = no RCP at this grade. */
  rcpAgr: number | null
  /** TIS cap (years) for M-Day / TPU soldiers. null = RCP does not apply. */
  rcpMday: number | null
  /** Commissioned-service cap (years) — officers only. null = no flat MRD. */
  mrdCommissioned: number | null
  note: string
}

export const RETENTION_LIMITS: Record<string, RetentionLimit> = {
  // ── Enlisted ────────────────────────────────────────────────────────────────
  // ARNG AGR values reflect the PPOM 16-028 exceptions (SGT and below 20, SSG 23);
  // E7-E9 follow the standard Army RCP ladder.
  E4: { grade: 'E4', rcpAgr: 20, rcpMday: null, mrdCommissioned: null,
        note: 'SPC/CPL. ARNG AGR: SGT and below retained to 20 yr (PPOM 16-028). Standard Army RCP for E4 is 12 yr. M-Day not governed by RCP.' },
  E5: { grade: 'E5', rcpAgr: 20, rcpMday: null, mrdCommissioned: null,
        note: 'SGT. ARNG AGR exception: 20 yr (PPOM 16-028) vs. 13 yr standard Army RCP. M-Day not governed by RCP.' },
  E6: { grade: 'E6', rcpAgr: 23, rcpMday: null, mrdCommissioned: null,
        note: 'SSG. ARNG AGR exception: 23 yr (PPOM 16-028) vs. 20 yr standard Army RCP. M-Day not governed by RCP.' },
  E7: { grade: 'E7', rcpAgr: 26, rcpMday: null, mrdCommissioned: null,
        note: 'SFC. 26 yr RCP (29 yr if promotable). M-Day not governed by RCP.' },
  E8: { grade: 'E8', rcpAgr: 29, rcpMday: null, mrdCommissioned: null,
        note: 'MSG/1SG. 29 yr RCP (32 yr if promotable). M-Day not governed by RCP.' },
  E9: { grade: 'E9', rcpAgr: 32, rcpMday: null, mrdCommissioned: null,
        note: 'SGM/CSM. 32 yr RCP. M-Day not governed by RCP.' },

  // ── Warrant Officers ────────────────────────────────────────────────────────
  // No flat years-of-commissioned-service removal comparable to 14507 for CW2-CW4;
  // governed by NGR 600-101 and the age-60 MRD.
  W1: { grade: 'W1', rcpAgr: null, rcpMday: null, mrdCommissioned: null,
        note: 'WO1. No flat MRD — governed by NGR 600-101 and age-60 MRD.' },
  W2: { grade: 'W2', rcpAgr: null, rcpMday: null, mrdCommissioned: null,
        note: 'CW2. No flat MRD — governed by NGR 600-101 and age-60 MRD.' },
  W3: { grade: 'W3', rcpAgr: null, rcpMday: null, mrdCommissioned: null,
        note: 'CW3. No flat MRD — governed by NGR 600-101 and age-60 MRD.' },
  W4: { grade: 'W4', rcpAgr: null, rcpMday: null, mrdCommissioned: null,
        note: 'CW4. No flat MRD — governed by NGR 600-101 and age-60 MRD.' },
  W5: { grade: 'W5', rcpAgr: null, rcpMday: null, mrdCommissioned: null,
        note: 'CW5. No flat MRD — governed by NGR 600-101 and age-60 MRD.' },

  // ── Commissioned Officers ───────────────────────────────────────────────────
  O1: { grade: 'O1', rcpAgr: null, rcpMday: null, mrdCommissioned: null,
        note: '2LT. Separation by failure of selection (10 USC 14505), not a years-of-service clock.' },
  O2: { grade: 'O2', rcpAgr: null, rcpMday: null, mrdCommissioned: null,
        note: '1LT. Separation by failure of selection (10 USC 14505), not a years-of-service clock.' },
  O3: { grade: 'O3', rcpAgr: null, rcpMday: null, mrdCommissioned: null,
        note: 'CPT. Separation by twice failing selection to MAJ (10 USC 14505). No flat MRD.' },
  O4: { grade: 'O4', rcpAgr: null, rcpMday: null, mrdCommissioned: 20,
        note: 'MAJ. 10 USC 14506: removal at 20 yr commissioned service if twice non-selected for LTC. Modeled as projected, not date-certain.' },
  O5: { grade: 'O5', rcpAgr: null, rcpMday: null, mrdCommissioned: 28,
        note: 'LTC. 10 USC 14507: removed from the reserve active-status list at 28 yr commissioned service. Date-certain.' },
  O6: { grade: 'O6', rcpAgr: null, rcpMday: null, mrdCommissioned: 30,
        note: 'COL. 10 USC 14507: removed from the reserve active-status list at 30 yr commissioned service. Date-certain.' },
}

/** Years of qualifying service for non-regular (reserve) retirement eligibility. */
export const RETIREMENT_YEARS = 20

/** General ARNG mandatory removal age (NGR 635-100). Informational. */
export const MRD_AGE = 60

/**
 * The TIS cap that actually binds this soldier, or null when none applies.
 * RCP is only enforced against AGR (and Technician, treated as full-time here);
 * M-Day and traditional statuses fall through to age/other criteria.
 */
export function retentionCapYears(grade: string, componentStatus: string): number | null {
  const limit = RETENTION_LIMITS[grade]
  if (!limit) return null
  const fullTime = componentStatus === 'AGR' || componentStatus === 'Technician'
  return fullTime ? limit.rcpAgr : limit.rcpMday
}

/**
 * Commissioned-service cap for officers. `certain` distinguishes the date-certain
 * 14507 removals (LTC/COL) from the board-driven 14506 case (MAJ).
 */
export function commissionedCap(grade: string): { years: number; certain: boolean } | null {
  const limit = RETENTION_LIMITS[grade]
  if (!limit || limit.mrdCommissioned == null) return null
  return { years: limit.mrdCommissioned, certain: grade === 'O5' || grade === 'O6' }
}

export const RETENTION_SOURCES = [
  '10 USC 14505 / 14506 / 14507 — reserve officer removal',
  'NGB PPOM 16-028 — ARNG AGR retention control points',
  'AR 140-10 / NGR 600-200 — enlisted retention',
  'NGR 635-100 — mandatory removal age',
]
