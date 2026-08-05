import type { Position, CareerCategory } from './types'
import type {
  RosterSoldier, FormationUnit, ManningRow, ManningReport,
  AttritionYear, DepartureRisk,
  PromotionNeed, Candidate, CandidateFactor,
} from './commandTypes'
import { SR_BOX_WEIGHT, RATER_BOX_WEIGHT } from './commandTypes'
import { RANK_NUM, PROMOTION_GATES } from './scoring'
import { retentionCapYears, commissionedCap, RETIREMENT_YEARS } from './data/retention'
import { getCommute } from './data/cities'

// ── Unit naming ───────────────────────────────────────────────────────────────
// positions.ts encodes the same organization two different ways: the `filled`
// array sets unit === uic (raw codes like 'WPBQAA'), while `vacant` uses MTOE
// names ('0495 CS HHC    HHC COMBAT SUST'). UIC is the only reliable join key,
// so we build a uic → human-name map preferring whichever form is readable.

function tidyUnitName(raw: string): string {
  let s = raw
  // W903AA's name is double-encoded in the source ('&amp;amp;amp;'), so decode
  // repeatedly rather than once. Bounded to avoid pathological input.
  for (let i = 0; i < 4 && s.includes('&amp;'); i++) s = s.replace(/&amp;/g, '&')
  return s.replace(/\s+/g, ' ').trim()   // MTOE names are space-padded to fixed width
}

/** True when the string looks like a bare UIC rather than a unit name. */
function looksLikeUic(s: string): boolean {
  return /^[A-Z0-9]{6}$/.test(s.trim())
}

export function buildUnitNameMap(positions: Position[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const p of positions) {
    const uic = p.uic
    if (!uic) continue
    const name = tidyUnitName(p.unit)
    const existing = map.get(uic)
    // Prefer a real name over a raw UIC; otherwise keep the first one seen.
    if (!existing || (looksLikeUic(existing) && !looksLikeUic(name))) {
      map.set(uic, name)
    }
  }

  // Two UICs (W903A1, W7Y441) appear only in the `filled` array, where unit === uic,
  // so they have no readable name anywhere. Borrow the parent's name and mark the
  // detachment rather than showing a bare code.
  for (const [uic, name] of map) {
    if (!looksLikeUic(name)) continue
    const parent = map.get(`${uic.slice(0, 4)}AA`) ?? map.get(`${uic.slice(0, 5)}0`)
    const city = positions.find(p => p.uic === uic)?.city
    if (parent && !looksLikeUic(parent)) {
      map.set(uic, `${parent} — DET (${uic})`)
    } else if (city) {
      map.set(uic, `${uic} (${city})`)
    }
  }
  return map
}

export function resolveUnitName(uic: string, nameMap: Map<string, string>): string {
  return nameMap.get(uic) ?? uic
}

/** All selectable units, with authorized/assigned counts. */
export function listFormationUnits(positions: Position[], roster: RosterSoldier[]): FormationUnit[] {
  const nameMap = buildUnitNameMap(positions)
  const byUic = new Map<string, FormationUnit>()

  for (const p of positions) {
    if (!p.uic) continue
    let u = byUic.get(p.uic)
    if (!u) {
      u = { uic: p.uic, name: resolveUnitName(p.uic, nameMap), city: p.city, authorized: 0, assigned: 0 }
      byUic.set(p.uic, u)
    }
    if (p.authorized !== false) u.authorized++
  }
  for (const s of roster) {
    const u = byUic.get(s.uic)
    if (u) u.assigned++
  }
  return [...byUic.values()].sort((a, b) => b.authorized - a.authorized)
}

// ── Unit families ─────────────────────────────────────────────────────────────
// The MTOE extract carries the real chain: BDE NAME → BN NAME → UIC. Grouping on
// the actual battalion beats inferring one from UIC prefixes, so a commander
// selects "1ST BATTALION, 163D INFANTRY REGIMENT" and gets exactly its UICs.

export interface UnitFamily {
  key: string
  name: string
  bde: string
  uics: string[]
  authorized: number
  assigned: number
}

/** Tidy the ALL-CAPS rollup names from the extract into something readable. */
function tidyOrgName(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/\bROLLUP\b/gi, '').trim()
}

export function buildUnitFamilies(positions: Position[], roster: RosterSoldier[]): UnitFamily[] {
  const units = listFormationUnits(positions, roster)
  // uic → battalion, from the billet data itself.
  const bnOf = new Map<string, { bn: string; bde: string }>()
  for (const p of positions) {
    if (p.uic && p.bn && !bnOf.has(p.uic)) {
      bnOf.set(p.uic, { bn: tidyOrgName(p.bn), bde: tidyOrgName(p.bde ?? '') })
    }
  }

  const families = new Map<string, UnitFamily>()
  for (const u of units) {
    const org = bnOf.get(u.uic)
    const key = org?.bn || u.uic
    let fam = families.get(key)
    if (!fam) {
      fam = { key, name: org?.bn || u.name, bde: org?.bde ?? '', uics: [], authorized: 0, assigned: 0 }
      families.set(key, fam)
    }
    fam.uics.push(u.uic)
    fam.authorized += u.authorized
    fam.assigned += u.assigned
  }

  return [...families.values()].sort((a, b) => b.authorized - a.authorized)
}

// ── Formation filters ─────────────────────────────────────────────────────────
export function positionsInFormation(positions: Position[], uics: string[]): Position[] {
  if (uics.length === 0) return []
  const set = new Set(uics)
  return positions.filter(p => p.uic && set.has(p.uic))
}

export function rosterInFormation(roster: RosterSoldier[], uics: string[]): RosterSoldier[] {
  if (uics.length === 0) return []
  const set = new Set(uics)
  return roster.filter(s => set.has(s.uic))
}

/**
 * Billets with nobody assigned to them.
 *
 * Occupancy comes from the ROSTER, not from Position.vacancyStatus. That field is
 * a snapshot from two different source reports and goes stale the moment a real
 * roster is imported — trusting it would let the app offer a commander a billet
 * that one of their own soldiers is currently sitting in.
 */
export function vacantBillets(
  positions: Position[],
  roster: RosterSoldier[],
  uics: string[]
): Position[] {
  const occupied = new Set(
    rosterInFormation(roster, uics).map(s => s.positionId).filter((id): id is number => id != null)
  )
  return positionsInFormation(positions, uics).filter(p => !occupied.has(p.id))
}

// ── Manning ───────────────────────────────────────────────────────────────────
function makeRow(key: string, authorized: number, assigned: number): ManningRow {
  return {
    key,
    authorized,
    assigned,
    delta: assigned - authorized,
    fillPct: authorized === 0 ? (assigned > 0 ? 100 : 0) : Math.round((assigned / authorized) * 100),
  }
}

export function computeManning(
  positions: Position[],
  roster: RosterSoldier[],
  uics: string[]
): ManningReport {
  const auth = positionsInFormation(positions, uics)
  const assigned = rosterInFormation(roster, uics)

  const gradeAuth = new Map<string, number>()
  const gradeAsg = new Map<string, number>()
  const catAuth = new Map<string, number>()
  const catAsg = new Map<string, number>()

  for (const p of auth) {
    // TEMPLET / 'Standard Excess' lines are real people but not authorizations.
    // Counting them would hide over-strength by inflating the denominator.
    if (p.authorized === false) continue
    gradeAuth.set(p.grade, (gradeAuth.get(p.grade) ?? 0) + 1)
    catAuth.set(p.careerCategory, (catAuth.get(p.careerCategory) ?? 0) + 1)
  }
  for (const s of assigned) {
    gradeAsg.set(s.rank, (gradeAsg.get(s.rank) ?? 0) + 1)
    catAsg.set(s.careerCategory, (catAsg.get(s.careerCategory) ?? 0) + 1)
  }

  const grades = [...new Set([...gradeAuth.keys(), ...gradeAsg.keys()])]
    .sort((a, b) => (RANK_NUM[a] ?? 0) - (RANK_NUM[b] ?? 0))
  const cats: CareerCategory[] = ['Enlisted', 'Warrant', 'Officer']

  const totalAuthorized = auth.filter(p => p.authorized !== false).length
  const totalAssigned = assigned.length

  return {
    byGrade: grades.map(g => makeRow(g, gradeAuth.get(g) ?? 0, gradeAsg.get(g) ?? 0)),
    byCategory: cats
      .map(c => makeRow(c, catAuth.get(c) ?? 0, catAsg.get(c) ?? 0))
      .filter(r => r.authorized > 0 || r.assigned > 0),
    totalAuthorized,
    totalAssigned,
    totalFillPct: totalAuthorized === 0 ? 0 : Math.round((totalAssigned / totalAuthorized) * 100),
    unmatchedSoldiers: roster.filter(s => !positions.some(p => p.uic === s.uic)).length,
  }
}

// ── Time in grade / time in position flags ────────────────────────────────────
/** Years past which a soldier is considered stale in seat and ready to move. */
export const TIP_STALE_YEARS = 3

export function isBoardEligible(s: RosterSoldier): boolean {
  const nextGrade = nextGradeFor(s.rank, s.careerCategory)
  if (!nextGrade) return false
  const gate = PROMOTION_GATES[nextGrade]
  if (!gate) return false
  return s.timeInGrade >= gate.minTig && s.yearsOfService >= gate.minTis
}

export function isStaleInPosition(s: RosterSoldier): boolean {
  return s.timeInPosition >= TIP_STALE_YEARS
}

// ── Grade ladders ─────────────────────────────────────────────────────────────
const LADDERS: Record<CareerCategory, string[]> = {
  Enlisted: ['E4', 'E5', 'E6', 'E7', 'E8', 'E9'],
  Warrant: ['W1', 'W2', 'W3', 'W4', 'W5'],
  Officer: ['O1', 'O2', 'O3', 'O4', 'O5', 'O6'],
}

export function nextGradeFor(grade: string, category: CareerCategory): string | null {
  const ladder = LADDERS[category]
  const i = ladder.indexOf(grade)
  if (i === -1 || i === ladder.length - 1) return null
  return ladder[i + 1]
}

export function feederGradeFor(grade: string, category: CareerCategory): string | null {
  const ladder = LADDERS[category]
  const i = ladder.indexOf(grade)
  if (i <= 0) return null
  return ladder[i - 1]
}

// ── Attrition ─────────────────────────────────────────────────────────────────
function etsYear(ets: string): number | null {
  if (!ets) return null
  const y = Number(ets.slice(0, 4))
  return Number.isFinite(y) && y > 1900 ? y : null
}

// Planning assumptions. An ETS is a contract expiring, not a departure — the
// majority of soldiers reenlist — and reaching 20 good years makes retirement
// possible, not automatic. Counting either as a whole loss produces the absurd
// result that the entire formation departs within one contract cycle.
export const ETS_SEPARATION_RATE = 0.30    // ~70% reenlist
export const TWENTY_YEAR_DEPART_RATE = 0.25
const HARD_WEIGHT = 1.0

/**
 * The single earliest projected departure for one soldier, or null if none falls
 * inside the horizon. Deliberately returns ONE event — a soldier who both ETSs
 * and hits RCP in the window must not be counted twice in the forecast.
 */
export function earliestDeparture(
  s: RosterSoldier,
  baseYear: number,
  horizonYears: number
): DepartureRisk | null {
  const candidates: DepartureRisk[] = []

  // Enlisted RCP — binds AGR/Technician only; M-Day falls through by design.
  const cap = retentionCapYears(s.rank, s.componentStatus)
  if (cap != null) {
    const yearsAway = cap - s.yearsOfService
    candidates.push({
      soldier: s, year: baseYear + Math.max(0, Math.ceil(yearsAway)), reason: 'RCP (AGR)',
      detail: `${s.rank} ${s.componentStatus} retention control point at ${cap} yr TIS`,
      certainty: 'date-certain', weight: HARD_WEIGHT,
    })
  }

  // Officer removal for years of commissioned service.
  const mrd = s.careerCategory === 'Officer' ? commissionedCap(s.rank) : null
  if (mrd) {
    const yearsAway = mrd.years - s.commissionedYears
    candidates.push({
      soldier: s, year: baseYear + Math.max(0, Math.ceil(yearsAway)),
      reason: 'MRD (commissioned service)',
      detail: `${s.rank} removal at ${mrd.years} yr commissioned service (${s.commissionedYears} yr now)`,
      // Only 14507 (LTC/COL) is date-certain; MAJ under 14506 depends on a board.
      certainty: mrd.certain ? 'date-certain' : 'projected',
      weight: mrd.certain ? HARD_WEIGHT : TWENTY_YEAR_DEPART_RATE,
    })
  }

  const ey = etsYear(s.ets)
  if (ey != null) {
    candidates.push({
      soldier: s, year: ey, reason: 'ETS',
      detail: `Contract expires ${s.ets} — most soldiers reenlist`,
      certainty: 'projected', weight: ETS_SEPARATION_RATE,
    })
  }

  // Non-regular retirement eligibility at 20 qualifying years. Eligibility is an
  // option, not a departure, so it carries the historical take-rate.
  if (s.yearsOfService < RETIREMENT_YEARS) {
    const yearsAway = RETIREMENT_YEARS - s.yearsOfService
    candidates.push({
      soldier: s, year: baseYear + Math.ceil(yearsAway), reason: 'Retirement eligible (20 yr)',
      detail: `Reaches 20 good years (currently ${s.yearsOfService} TIS)`,
      certainty: 'projected', weight: TWENTY_YEAR_DEPART_RATE,
    })
  } else {
    candidates.push({
      soldier: s, year: baseYear, reason: 'Retirement eligible (20 yr)',
      detail: `Already retirement eligible (${s.yearsOfService} TIS)`,
      certainty: 'projected', weight: TWENTY_YEAR_DEPART_RATE,
    })
  }

  const inWindow = candidates.filter(c => c.year >= baseYear && c.year <= baseYear + horizonYears)
  if (inWindow.length === 0) return null

  // Heaviest risk wins so a statutory removal is never masked by an earlier ETS;
  // earliest year breaks the tie.
  inWindow.sort((a, b) => b.weight - a.weight || a.year - b.year)
  return inWindow[0]
}

export function projectAttrition(
  roster: RosterSoldier[],
  baseYear: number,
  horizonYears: number
): AttritionYear[] {
  const years: AttritionYear[] = []
  for (let y = baseYear; y <= baseYear + horizonYears; y++) {
    years.push({
      year: y, hard: 0, expected: 0, atRisk: 0,
      byCategory: { Enlisted: 0, Warrant: 0, Officer: 0 },
      byGrade: {},
      departures: [],
    })
  }

  for (const s of roster) {
    const dep = earliestDeparture(s, baseYear, horizonYears)
    if (!dep) continue
    const bucket = years[dep.year - baseYear]
    if (!bucket) continue
    bucket.atRisk++
    bucket.expected += dep.weight
    if (dep.weight >= HARD_WEIGHT) bucket.hard++
    bucket.byCategory[s.careerCategory]++
    bucket.byGrade[s.rank] = (bucket.byGrade[s.rank] ?? 0) + 1
    bucket.departures.push(dep)
  }
  for (const y of years) y.expected = Math.round(y.expected)
  return years
}

/** Expected (weighted) losses at one grade within the window. */
function expectedLossesAtGrade(
  people: RosterSoldier[],
  baseYear: number,
  horizonYears: number
): number {
  let sum = 0
  for (const s of people) {
    const dep = earliestDeparture(s, baseYear, horizonYears)
    if (dep) sum += dep.weight
  }
  return Math.round(sum)
}

// ── Promotion forecast ────────────────────────────────────────────────────────
/**
 * The headline macro-planning output: for each grade transition in the formation,
 * how many promotions the commander must generate to keep billets filled, and
 * whether the feeder grade actually holds enough eligible people to do it.
 */
export function projectPromotions(
  positions: Position[],
  roster: RosterSoldier[],
  uics: string[],
  baseYear: number,
  horizonYears: number
): PromotionNeed[] {
  const auth = positionsInFormation(positions, uics)
  const assigned = rosterInFormation(roster, uics)
  const needs: PromotionNeed[] = []

  for (const category of Object.keys(LADDERS) as CareerCategory[]) {
    const ladder = LADDERS[category]
    for (let i = 1; i < ladder.length; i++) {
      const fromGrade = ladder[i - 1]
      const toGrade = ladder[i]

      const authorizedAtTarget = auth.filter(
        p => p.authorized !== false && p.careerCategory === category && p.grade === toGrade).length
      const authorizedAtFeeder = auth.filter(
        p => p.authorized !== false && p.careerCategory === category && p.grade === fromGrade).length
      const atTarget = assigned.filter(s => s.careerCategory === category && s.rank === toGrade)
      const feeder = assigned.filter(s => s.careerCategory === category && s.rank === fromGrade)

      // Nothing to plan if the formation has neither billets nor people here.
      if (authorizedAtTarget === 0 && atTarget.length === 0 && feeder.length === 0) continue

      const projectedLosses = expectedLossesAtGrade(atTarget, baseYear, horizonYears)

      const openNow = Math.max(0, authorizedAtTarget - atTarget.length)
      const promotionsNeeded = openNow + projectedLosses

      const gate = PROMOTION_GATES[toGrade]
      const minTig = gate?.minTig ?? 0
      const typicalTig = gate?.typicalTig ?? 0
      const minTis = gate?.minTis ?? 0

      const eligibleNow = feeder.filter(
        s => s.timeInGrade >= minTig && s.yearsOfService >= minTis && !s.flagged).length
      const eligibleByHorizon = feeder.filter(
        s => s.timeInGrade + horizonYears >= minTig &&
             s.yearsOfService + horizonYears >= minTis &&
             !s.flagged).length

      needs.push({
        fromGrade, toGrade, category,
        authorizedAtTarget,
        filledAtTarget: atTarget.length,
        projectedLosses,
        promotionsNeeded,
        eligibleNow,
        eligibleByHorizon,
        feederStrength: feeder.length,
        gap: promotionsNeeded - eligibleByHorizon,
        minTig, typicalTig,
        accessionDriven: authorizedAtFeeder === 0 && feeder.length === 0,
      })
    }
  }
  return needs
}

// ── Succession / candidate matching ───────────────────────────────────────────
function mosRelated(a: string, b: string): boolean {
  if (!a || !b) return false
  return a.slice(0, 2) === b.slice(0, 2)
}

function evalWeight(s: RosterSoldier): number {
  if (s.careerCategory === 'Enlisted') return SR_BOX_WEIGHT[s.ncoerBox] ?? 35
  // Officers/warrants: senior rater box dominates, rater box modulates.
  const sr = SR_BOX_WEIGHT[s.srBox] ?? 35
  const rater = RATER_BOX_WEIGHT[s.raterBox] ?? 30
  return sr * 0.7 + rater * 0.3
}

/**
 * Rank roster soldiers against one billet. Deterministic and explainable — every
 * point is attributable to a named factor, so a commander can defend the list.
 * The AI layer narrates these results; it does not produce them.
 */
export function rankCandidates(
  roster: RosterSoldier[],
  target: Position,
  limit = 10
): Candidate[] {
  const targetNum = RANK_NUM[target.grade] ?? 0
  const gate = PROMOTION_GATES[target.grade]

  // Never offer the commander someone who already holds the billet.
  const pool = roster.filter(s => s.positionId !== target.id)

  const scored = pool.map<Candidate>(s => {
    const factors: CandidateFactor[] = []
    const blockers: string[] = []
    const soldierNum = RANK_NUM[s.rank] ?? 0
    const delta = targetNum - soldierNum

    // ── Grade fit (30) ────────────────────────────────────────────────────────
    let gradePts = 0
    let gradeDetail = ''
    if (s.careerCategory !== target.careerCategory) {
      blockers.push(`${s.careerCategory} soldier cannot fill a ${target.careerCategory} billet`)
      gradeDetail = 'Wrong career category'
    } else if (delta === 0) {
      gradePts = 30; gradeDetail = `Already ${s.rank} — lateral move`
    } else if (delta === 1) {
      gradePts = 26; gradeDetail = `${s.rank} promotable into ${target.grade}`
    } else if (delta === 2) {
      gradePts = 10; gradeDetail = `${s.rank} is two grades below ${target.grade}`
      blockers.push(`Two grades below the billet (${s.rank} → ${target.grade})`)
    } else if (delta < 0) {
      gradePts = 6; gradeDetail = `${s.rank} would be a downgrade into ${target.grade}`
    } else {
      gradeDetail = `${s.rank} is too junior for ${target.grade}`
      blockers.push(`More than two grades below the billet`)
    }
    factors.push({ label: 'Grade fit', points: gradePts, max: 30, detail: gradeDetail })

    // ── MOS fit (20) ──────────────────────────────────────────────────────────
    let mosPts = 0
    let mosDetail = ''
    if (s.mos === target.mos) { mosPts = 20; mosDetail = `MOS ${s.mos} matches exactly` }
    else if (mosRelated(s.mos, target.mos)) { mosPts = 12; mosDetail = `${s.mos} is in the same field as ${target.mos}` }
    else { mosPts = 3; mosDetail = `${s.mos} → ${target.mos} would require reclassification` }
    factors.push({ label: 'MOS fit', points: mosPts, max: 20, detail: mosDetail })

    // ── Promotion readiness (20) ──────────────────────────────────────────────
    let tigPts = 0
    let tigDetail = ''
    if (delta <= 0) {
      tigPts = 20; tigDetail = 'Already holds the grade — no gate to clear'
    } else if (gate) {
      const tigOk = s.timeInGrade >= gate.minTig
      const tisOk = s.yearsOfService >= gate.minTis
      if (tigOk && tisOk) { tigPts = 20; tigDetail = `Meets ${target.grade} gates (${s.timeInGrade} yr TIG, ${s.yearsOfService} yr TIS)` }
      else if (tigOk || tisOk) { tigPts = 10; tigDetail = `Partially eligible — needs ${tigOk ? `${gate.minTis} yr TIS` : `${gate.minTig} yr TIG`}` }
      else { tigPts = 2; tigDetail = `Short of both TIG (${gate.minTig} yr) and TIS (${gate.minTis} yr) gates` }
    } else {
      tigPts = 12; tigDetail = 'No published gate for this grade'
    }
    factors.push({ label: 'Promotion readiness', points: tigPts, max: 20, detail: tigDetail })

    // ── Evaluations (20) ──────────────────────────────────────────────────────
    const evalRaw = evalWeight(s)
    const evalPts = Math.round((evalRaw / 100) * 20)
    const evalLabel = s.careerCategory === 'Enlisted'
      ? (s.ncoerBox || 'unrated')
      : `${s.srBox || 'unrated'}${s.raterBox ? ` / ${s.raterBox}` : ''}`
    factors.push({ label: 'Evaluations', points: evalPts, max: 20, detail: `Latest: ${evalLabel}` })

    // ── Availability: time in current seat (10) ───────────────────────────────
    let tipPts = 0
    let tipDetail = ''
    if (s.timeInPosition >= TIP_STALE_YEARS) { tipPts = 10; tipDetail = `${s.timeInPosition} yr in current seat — due to move` }
    else if (s.timeInPosition >= 1.5) { tipPts = 7; tipDetail = `${s.timeInPosition} yr in current seat` }
    else { tipPts = 2; tipDetail = `Only ${s.timeInPosition} yr in current seat — recently assigned` }
    factors.push({ label: 'Availability', points: tipPts, max: 10, detail: tipDetail })

    // ── Geography (bonus, folded into the 100) ────────────────────────────────
    const commute = getCommute(s.city, target.city)
    const sameCity = s.city === target.city
    const mins = commute?.minutes ?? -1
    let geoPts = 0
    let geoDetail = ''
    if (sameCity) { geoPts = 0; geoDetail = `Already in ${target.city}` }
    else if (mins >= 0 && mins <= 60) { geoPts = -1; geoDetail = `${mins} min from ${target.city}` }
    else if (mins >= 0 && mins <= 120) { geoPts = -3; geoDetail = `${mins} min from ${target.city}` }
    else if (mins >= 0) { geoPts = -6; geoDetail = `${mins} min from ${target.city} — significant move` }
    else { geoPts = -3; geoDetail = `${s.city} → ${target.city}, drive time unknown` }
    factors.push({ label: 'Geography', points: geoPts, max: 0, detail: geoDetail })

    if (s.flagged) blockers.push('Flagged — not eligible for favorable actions')

    const raw = factors.reduce((sum, f) => sum + f.points, 0)
    const score = Math.max(0, Math.min(100, raw))

    const readiness: Candidate['readiness'] =
      blockers.length > 0 ? 'Not ready'
      : score >= 70 ? 'Ready now'
      : score >= 45 ? 'Ready with development'
      : 'Not ready'

    return { soldier: s, score, factors, blockers, readiness }
  })

  return scored
    .filter(c => c.blockers.length === 0 || c.score >= 40)
    .sort((a, b) =>
      (a.blockers.length - b.blockers.length) || (b.score - a.score))
    .slice(0, limit)
}

// ── Summary stats for the overview dashboard ──────────────────────────────────
export interface ForceSummary {
  assigned: number
  authorized: number
  fillPct: number
  officers: number
  warrants: number
  enlisted: number
  agr: number
  mday: number
  boardEligible: number
  staleInPosition: number
  flagged: number
  retirementEligible: number
  avgTig: number
  avgTip: number
}

export function summarizeForce(
  positions: Position[],
  roster: RosterSoldier[],
  uics: string[]
): ForceSummary {
  const auth = positionsInFormation(positions, uics).filter(p => p.authorized !== false)
  const people = rosterInFormation(roster, uics)
  const n = people.length || 1

  return {
    assigned: people.length,
    authorized: auth.length,
    fillPct: auth.length === 0 ? 0 : Math.round((people.length / auth.length) * 100),
    officers: people.filter(s => s.careerCategory === 'Officer').length,
    warrants: people.filter(s => s.careerCategory === 'Warrant').length,
    enlisted: people.filter(s => s.careerCategory === 'Enlisted').length,
    agr: people.filter(s => s.componentStatus === 'AGR').length,
    mday: people.filter(s => s.componentStatus === 'M-Day').length,
    boardEligible: people.filter(isBoardEligible).length,
    staleInPosition: people.filter(isStaleInPosition).length,
    flagged: people.filter(s => s.flagged).length,
    retirementEligible: people.filter(s => s.yearsOfService >= RETIREMENT_YEARS).length,
    avgTig: Math.round((people.reduce((a, s) => a + s.timeInGrade, 0) / n) * 10) / 10,
    avgTip: Math.round((people.reduce((a, s) => a + s.timeInPosition, 0) / n) * 10) / 10,
  }
}
