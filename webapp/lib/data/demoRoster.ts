import type { Position, CareerCategory, ComponentStatus } from '../types'
import type { RosterSoldier, SrBox, RaterBox, NcoerBox } from '../commandTypes'

// ── Demo roster generation ────────────────────────────────────────────────────
// Synthesizes one fictional soldier per FILLED billet so the commander view has
// something to show before real data is imported. Everything here is FAKE — the
// UI labels it loudly and permanently (see components/command/DemoBanner.tsx).
//
// Determinism matters: this runs during a static export AND in the browser, so a
// Math.random() anywhere would produce a server/client mismatch and a hydration
// flash. A seeded PRNG keeps the same 559 people on every render, every build,
// every machine. For the same reason, dates are anchored to a fixed base year
// rather than new Date().

const DEMO_SEED = 0x5713A9
const DEMO_BASE_YEAR = 2026

/** mulberry32 — small, fast, well-distributed 32-bit PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SURNAMES = [
  'Anderson', 'Archuleta', 'Bearcloud', 'Bennett', 'Blackfeather', 'Bradley', 'Brennan',
  'Calderon', 'Camden', 'Carrillo', 'Chavez', 'Colton', 'Crowfoot', 'Dahl', 'Delgado',
  'Donnelly', 'Eastman', 'Ellison', 'Fairbanks', 'Ferrell', 'Fontaine', 'Gallegos',
  'Garrison', 'Grayson', 'Hollis', 'Holloway', 'Ingram', 'Iverson', 'Jessup', 'Kaminski',
  'Keller', 'Kirkland', 'Lambert', 'Larkin', 'Lindstrom', 'Lockhart', 'Maddox', 'Mahoney',
  'Marchetti', 'McAllister', 'Mercado', 'Nakamura', 'Navarro', 'Nordstrom', 'Okafor',
  'Ortega', 'Pemberton', 'Pruitt', 'Quintero', 'Ramsey', 'Redfeather', 'Rhodes', 'Salazar',
  'Sandoval', 'Sheridan', 'Sorenson', 'Stapleton', 'Tallbear', 'Thornton', 'Underwood',
  'Vandermeer', 'Vasquez', 'Whitaker', 'Whitehorse', 'Wolfe', 'Yeager', 'Zamora',
]

const FIRST_NAMES = [
  'Adrian', 'Alexis', 'Amara', 'Benjamin', 'Bianca', 'Caleb', 'Camille', 'Carlos',
  'Cassidy', 'Damon', 'Danielle', 'Derek', 'Elena', 'Elliot', 'Fiona', 'Gabriel',
  'Grace', 'Harrison', 'Imani', 'Isaac', 'Jasmine', 'Jonah', 'Kendra', 'Kyle',
  'Lena', 'Logan', 'Marcus', 'Maya', 'Nathan', 'Nicole', 'Owen', 'Paige',
  'Quentin', 'Rachel', 'Rafael', 'Samantha', 'Sean', 'Tessa', 'Trevor', 'Victoria',
]

/** Realistic TIS bands by grade: [min, max] years of service. */
const TIS_BAND: Record<string, [number, number]> = {
  E1: [0, 2], E2: [0.5, 3], E3: [1, 5], E4: [2, 9],
  E5: [4, 13], E6: [8, 19], E7: [12, 24], E8: [17, 28], E9: [21, 31],
  W1: [7, 16], W2: [9, 20], W3: [13, 24], W4: [17, 28], W5: [21, 31],
  O1: [0, 3], O2: [1, 6], O3: [4, 13], O4: [10, 21], O5: [15, 27], O6: [21, 30],
}

/** Typical TIG ceiling by grade — keeps TIG plausible relative to TIS. */
const TIG_CEIL: Record<string, number> = {
  E1: 1, E2: 1.5, E3: 2, E4: 4, E5: 5, E6: 7, E7: 8, E8: 7, E9: 6,
  W1: 3, W2: 5, W3: 6, W4: 7, W5: 6,
  O1: 2, O2: 2.5, O3: 5, O4: 6, O5: 7, O6: 6,
}

const ENLISTED_PME_LADDER = ['BLC', 'ALC', 'SLC', 'SMC']
const OFFICER_PME_LADDER = ['BOLC', 'CCC', 'ILE', 'SSC']
const WARRANT_PME_LADDER = ['WOBC', 'WOAC', 'WOILE', 'WOSSE']

/** How many rungs of the PME ladder a soldier at this grade has typically climbed. */
const PME_DEPTH: Record<string, number> = {
  E1: 0, E2: 0, E3: 0, E4: 1, E5: 1, E6: 2, E7: 3, E8: 3, E9: 4,
  W1: 1, W2: 2, W3: 3, W4: 3, W5: 4,
  O1: 1, O2: 1, O3: 2, O4: 2, O5: 3, O6: 4,
}

function pick<T>(rnd: () => number, arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)]
}

function between(rnd: () => number, lo: number, hi: number): number {
  return lo + rnd() * (hi - lo)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Senior-rater box distribution. Deliberately pyramid-shaped: real senior raters
 * are constrained on top-block, so a roster where everyone is "Most Qualified"
 * would make the succession ranking meaningless.
 */
function rollSrBox(rnd: () => number): SrBox {
  const r = rnd()
  if (r < 0.24) return 'MQ'
  if (r < 0.62) return 'HQ'
  if (r < 0.95) return 'Q'
  if (r < 0.98) return 'NQ'
  return ''
}

function rollRaterBox(rnd: () => number): RaterBox {
  const r = rnd()
  if (r < 0.3) return 'EXCELS'
  if (r < 0.75) return 'PROFICIENT'
  if (r < 0.96) return 'CAPABLE'
  if (r < 0.98) return 'UNSATISFACTORY'
  return ''
}

function rollNcoerBox(rnd: () => number): NcoerBox {
  const r = rnd()
  if (r < 0.22) return 'Most Qualified'
  if (r < 0.6) return 'Highly Qualified'
  if (r < 0.95) return 'Qualified'
  if (r < 0.98) return 'Not Qualified'
  return ''
}

const OFFICER_BULLETS = [
  'Selected to serve as acting XO during the BN commander absence; sustained readiness through AT.',
  'Led the unit through a no-notice CI with zero major findings; strongest planner in the section.',
  'Managed a $2.4M property book without loss; rated top of three lieutenants in the formation.',
  'Solid performer, still developing staff-level planning depth. Would benefit from a BDE staff tour.',
  'Consistently meets standard; needs broadening outside the current warfighting function.',
  'Top 10% of captains I senior rate. Unlimited potential — promote ahead of peers.',
]

const ENLISTED_BULLETS = [
  'Best squad leader in the company; his squad set the standard at annual training.',
  'Ran the unit arms room flawlessly through two inspections; ready for platoon sergeant now.',
  'Technically superb, still building confidence leading soldiers outside the section.',
  'Reliable NCO who meets standard; would grow fastest in a KD leadership seat.',
  'Assumed platoon sergeant duties early and outperformed peers senior to her.',
  'Needs to complete the next level of PME before being competitive at the board.',
]

/**
 * Resolve a billet's statusType into a concrete component for one person.
 *
 * Important: positions.ts contains ZERO AGR billets — statusType is only 'M-Day'
 * (1103) or 'Technician' (81). AGR is therefore a ROSTER-level attribute that has
 * to be synthesized here, and real AGR status can only ever come from an import.
 * Nothing in this module should infer AGR from Position.statusType.
 */
function resolveComponent(rnd: () => number, statusType: string): ComponentStatus {
  if (statusType === 'Technician') return 'Technician'
  const r = rnd()
  if (r < 0.11) return 'AGR'      // ~11% full-time AGR, roughly the ARNG ratio
  if (r < 0.13) return 'ADOS'
  return 'M-Day'
}

/**
 * Deterministic per-unit fill rate. Real units sit somewhere around 75-95% manned,
 * and varying it by UIC is what makes the manning view worth looking at — a flat
 * rate everywhere would make every readiness number identical.
 */
function unitFillRate(uic: string): number {
  let h = 0
  for (let i = 0; i < uic.length; i++) h = (h * 31 + uic.charCodeAt(i)) >>> 0
  return 0.74 + (h % 22) / 100        // 0.74 – 0.95
}

function pmeFor(category: CareerCategory, grade: string, rnd: () => number): string[] {
  const ladder =
    category === 'Officer' ? OFFICER_PME_LADDER
    : category === 'Warrant' ? WARRANT_PME_LADDER
    : ENLISTED_PME_LADDER
  let depth = PME_DEPTH[grade] ?? 1
  // ~25% of soldiers are a rung behind — that's what creates real PME gaps to manage.
  if (rnd() < 0.25 && depth > 0) depth -= 1
  return ladder.slice(0, depth)
}

/**
 * Build the demo roster across ALL billets in positions.ts.
 *
 * Deliberately NOT one-soldier-per-'Filled'-billet. The `filled` array is a
 * partial extract of the assignment detail report: 36 of the 53 UICs have zero
 * filled rows, including all of 1-163 IN (137 authorized, 0 filled). Populating
 * only filled billets would render two thirds of the force at 0% manned, which
 * reads as a broken app rather than a demo. Instead each unit is populated to its
 * own deterministic 74-95% fill rate, leaving realistic vacancies to plan against.
 */
export function buildDemoRoster(positions: Position[]): RosterSoldier[] {
  const rnd = mulberry32(DEMO_SEED)
  const staffed = positions.filter(pos => rnd() < unitFillRate(pos.uic ?? ''))

  return staffed.map((pos, i) => {
    const grade = pos.grade
    const [tisLo, tisHi] = TIS_BAND[grade] ?? [4, 18]
    const yearsOfService = round1(between(rnd, tisLo, tisHi))

    // TIG can never exceed TIS, and is capped to something plausible for the grade.
    const tigCeil = Math.min(TIG_CEIL[grade] ?? 5, yearsOfService)
    const timeInGrade = round1(between(rnd, 0.4, Math.max(0.6, tigCeil)))

    // TIP can never exceed TIG.
    const timeInPosition = round1(between(rnd, 0.3, Math.max(0.5, timeInGrade)))

    // Officers: commissioned service is TIS minus any prior enlisted time.
    const priorEnlisted = pos.careerCategory === 'Officer' && rnd() < 0.35
      ? between(rnd, 2, 8)
      : 0
    const commissionedYears =
      pos.careerCategory === 'Officer'
        ? round1(Math.max(0.5, yearsOfService - priorEnlisted))
        : 0

    const componentStatus = resolveComponent(rnd, pos.statusType)

    // ETS spread across a realistic contract cycle. ARNG enlistment contracts run
    // 3 or 6 years, so spreading over ~8 keeps any one planning window from
    // catching the entire formation at once.
    const etsOffset = Math.floor(between(rnd, 0, 8))
    const etsMonth = 1 + Math.floor(rnd() * 12)
    const ets = `${DEMO_BASE_YEAR + etsOffset}-${String(etsMonth).padStart(2, '0')}-01`

    const pebdYear = DEMO_BASE_YEAR - Math.floor(yearsOfService)
    const pebdMonth = 1 + Math.floor(rnd() * 12)
    const pebd = `${pebdYear}-${String(pebdMonth).padStart(2, '0')}-01`

    const isOfficerish = pos.careerCategory === 'Officer' || pos.careerCategory === 'Warrant'
    const hasBullets = rnd() < 0.45

    return {
      id: `r-${String(i + 1).padStart(4, '0')}`,
      anonId: `S-${String(i + 1).padStart(3, '0')}`,
      lastName: pick(rnd, SURNAMES),
      firstName: pick(rnd, FIRST_NAMES),

      rank: grade,
      careerCategory: pos.careerCategory,
      mos: pos.mos,
      componentStatus,

      uic: pos.uic ?? '',
      unitName: pos.unit,
      city: pos.city,
      dutyTitle: pos.dutyTitle,
      positionId: pos.id,

      yearsOfService,
      timeInGrade,
      timeInPosition,
      commissionedYears,
      pebd,
      ets,

      srBox: isOfficerish ? rollSrBox(rnd) : '',
      raterBox: isOfficerish ? rollRaterBox(rnd) : '',
      ncoerBox: isOfficerish ? '' : rollNcoerBox(rnd),
      evalBullets: hasBullets
        ? pick(rnd, isOfficerish ? OFFICER_BULLETS : ENLISTED_BULLETS)
        : '',

      pmeComplete: pmeFor(pos.careerCategory, grade, rnd),
      isPromotable: rnd() < 0.35,
      flagged: rnd() < 0.05,
      notes: '',
    } satisfies RosterSoldier
  })
}

/**
 * The formation the view opens on: 1-163 Infantry (HHC + 4 companies, 137
 * authorized billets). A real maneuver battalion with company structure, so the
 * first screen looks like a BN commander's actual span of control rather than a
 * statewide dump of 1,000+ rows.
 */
export const DEMO_DEFAULT_UICS = [
  'WTCPT0', 'WTCPA0', 'WTCPB0', 'WTCPC0', 'WTCPD0', 'WTCPA1', 'WTHAAA',
]
