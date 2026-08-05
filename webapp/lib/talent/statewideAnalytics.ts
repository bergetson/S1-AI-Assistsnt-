import type { Position, CareerCategory } from '../types'
import type { RosterSoldier } from '../commandTypes'
import {
  positionsInFormation, rosterInFormation, buildUnitFamilies, buildUnitNameMap,
  resolveUnitName, isBoardEligible, nextGradeFor, earliestDeparture,
} from '../forceAnalytics'
import { PROMOTION_GATES, RANK_NUM } from '../scoring'
import { countyForCity } from '../communityImpact/types'

// ── Statewide talent analytics ────────────────────────────────────────────────
// Aggregation above the formation level. Deliberately reuses the same primitives
// the Commander view uses so state totals reconcile with unit totals rather than
// being computed a second, slightly different way.

export interface StateFilter {
  componentStatus?: string
  careerCategory?: CareerCategory
  uics?: string[]
  bn?: string
  bde?: string
  rank?: string
  mos?: string
  branch?: string
  city?: string
  county?: string
  boardEligibleOnly?: boolean
}

export function applyStateFilter(
  roster: RosterSoldier[], positions: Position[], f: StateFilter
): RosterSoldier[] {
  // Resolve org filters to a UIC set once rather than per soldier.
  let uicSet: Set<string> | null = null
  if (f.bn || f.bde) {
    uicSet = new Set(positions
      .filter(p => (!f.bn || p.bn === f.bn) && (!f.bde || p.bde === f.bde))
      .map(p => p.uic ?? '')
      .filter(Boolean))
  }
  return roster.filter(s => {
    if (f.componentStatus && s.componentStatus !== f.componentStatus) return false
    if (f.careerCategory && s.careerCategory !== f.careerCategory) return false
    if (f.uics?.length && !f.uics.includes(s.uic)) return false
    if (uicSet && !uicSet.has(s.uic)) return false
    if (f.rank && s.rank !== f.rank) return false
    if (f.mos && s.mos !== f.mos) return false
    if (f.city && s.city !== f.city) return false
    if (f.county && countyForCity(s.city) !== f.county) return false
    if (f.boardEligibleOnly && !isBoardEligible(s)) return false
    return true
  })
}

export interface DistributionRow {
  key: string
  count: number
  pct: number
}

function distribute(values: Array<string | undefined>): DistributionRow[] {
  const m = new Map<string, number>()
  let total = 0
  for (const v of values) {
    if (!v) continue
    m.set(v, (m.get(v) ?? 0) + 1)
    total++
  }
  return [...m.entries()]
    .map(([key, count]) => ({ key, count, pct: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

export interface StateForceOverview {
  totalSoldiers: number
  totalAuthorized: number
  fillPct: number
  byCategory: DistributionRow[]
  byComponent: DistributionRow[]
  byRank: DistributionRow[]
  byMos: DistributionRow[]
  byCity: DistributionRow[]
  byCounty: DistributionRow[]
  byBattalion: DistributionRow[]
}

export function stateOverview(
  positions: Position[], roster: RosterSoldier[], filter: StateFilter = {}
): StateForceOverview {
  const people = applyStateFilter(roster, positions, filter)
  const uicsInPlay = new Set(people.map(s => s.uic))
  const authorized = positions.filter(
    p => p.authorized !== false && (uicsInPlay.size === 0 || (p.uic && uicsInPlay.has(p.uic))))

  const bnByUic = new Map<string, string>()
  for (const p of positions) if (p.uic && p.bn && !bnByUic.has(p.uic)) bnByUic.set(p.uic, p.bn)

  return {
    totalSoldiers: people.length,
    totalAuthorized: authorized.length,
    fillPct: authorized.length ? Math.round((people.length / authorized.length) * 100) : 0,
    byCategory: distribute(people.map(s => s.careerCategory)),
    byComponent: distribute(people.map(s => s.componentStatus)),
    byRank: distribute(people.map(s => s.rank))
      .sort((a, b) => (RANK_NUM[b.key] ?? 0) - (RANK_NUM[a.key] ?? 0)),
    byMos: distribute(people.map(s => s.mos)),
    byCity: distribute(people.map(s => s.city)),
    byCounty: distribute(people.map(s => countyForCity(s.city))),
    byBattalion: distribute(people.map(s => bnByUic.get(s.uic))),
  }
}

// ── Full-time support balance ─────────────────────────────────────────────────
export interface FullTimeSupportRow {
  uic: string
  unitName: string
  battalion: string
  assigned: number
  agr: number
  technician: number
  mday: number
  fullTimePct: number
}

export function fullTimeSupportByUnit(
  positions: Position[], roster: RosterSoldier[]
): FullTimeSupportRow[] {
  const nameMap = buildUnitNameMap(positions)
  const bnByUic = new Map<string, string>()
  for (const p of positions) if (p.uic && p.bn && !bnByUic.has(p.uic)) bnByUic.set(p.uic, p.bn)

  const byUic = new Map<string, RosterSoldier[]>()
  for (const s of roster) {
    const arr = byUic.get(s.uic) ?? []
    arr.push(s)
    byUic.set(s.uic, arr)
  }

  return [...byUic.entries()].map(([uic, people]) => {
    const agr = people.filter(s => s.componentStatus === 'AGR').length
    const tech = people.filter(s => s.componentStatus === 'Technician').length
    const mday = people.filter(s => s.componentStatus === 'M-Day').length
    return {
      uic,
      unitName: resolveUnitName(uic, nameMap),
      battalion: bnByUic.get(uic) ?? '',
      assigned: people.length,
      agr, technician: tech, mday,
      fullTimePct: people.length ? Math.round(((agr + tech) / people.length) * 100) : 0,
    }
  }).sort((a, b) => b.assigned - a.assigned)
}

// ── Talent hotspots and gaps ──────────────────────────────────────────────────
export interface MosGap {
  mos: string
  careerCategory: CareerCategory
  authorized: number
  assigned: number
  delta: number
  fillPct: number
  status: 'Shortage' | 'Overstrength' | 'Balanced'
}

export function mosGaps(
  positions: Position[], roster: RosterSoldier[], uics?: string[]
): MosGap[] {
  const auth = (uics?.length ? positionsInFormation(positions, uics) : positions)
    .filter(p => p.authorized !== false)
  const people = uics?.length ? rosterInFormation(roster, uics) : roster

  const authByMos = new Map<string, { n: number; cat: CareerCategory }>()
  for (const p of auth) {
    if (!p.mos) continue
    const cur = authByMos.get(p.mos) ?? { n: 0, cat: p.careerCategory }
    cur.n++
    authByMos.set(p.mos, cur)
  }
  const asgByMos = new Map<string, number>()
  for (const s of people) if (s.mos) asgByMos.set(s.mos, (asgByMos.get(s.mos) ?? 0) + 1)

  const keys = new Set([...authByMos.keys(), ...asgByMos.keys()])
  return [...keys].map<MosGap>(mos => {
    const a = authByMos.get(mos)?.n ?? 0
    const g = asgByMos.get(mos) ?? 0
    const fill = a ? Math.round((g / a) * 100) : (g > 0 ? 100 : 0)
    return {
      mos,
      careerCategory: authByMos.get(mos)?.cat ?? 'Enlisted',
      authorized: a, assigned: g, delta: g - a, fillPct: fill,
      status: a > 0 && fill < 80 ? 'Shortage' : a > 0 && fill > 115 ? 'Overstrength' : 'Balanced',
    }
  }).sort((x, y) => x.delta - y.delta)
}

// ── Promotion pipeline across the state ───────────────────────────────────────
export interface PipelineRow {
  fromGrade: string
  toGrade: string
  careerCategory: CareerCategory
  feederStrength: number
  eligibleNow: number
  authorizedAtTarget: number
  assignedAtTarget: number
  openAtTarget: number
  ratio: number | null
  status: 'Healthy' | 'Thin' | 'Critical' | 'No Feeder'
}

export function promotionPipeline(
  positions: Position[], roster: RosterSoldier[], uics?: string[]
): PipelineRow[] {
  const auth = (uics?.length ? positionsInFormation(positions, uics) : positions)
    .filter(p => p.authorized !== false)
  const people = uics?.length ? rosterInFormation(roster, uics) : roster
  const cats: CareerCategory[] = ['Enlisted', 'Warrant', 'Officer']
  const rows: PipelineRow[] = []

  for (const cat of cats) {
    const grades = [...new Set(auth.filter(p => p.careerCategory === cat).map(p => p.grade))]
      .sort((a, b) => (RANK_NUM[a] ?? 0) - (RANK_NUM[b] ?? 0))
    for (const toGrade of grades) {
      const fromGrade = [...grades].reverse().find(g => (RANK_NUM[g] ?? 0) < (RANK_NUM[toGrade] ?? 0))
      if (!fromGrade) continue
      const gate = PROMOTION_GATES[toGrade]
      const feeder = people.filter(s => s.careerCategory === cat && s.rank === fromGrade)
      const eligible = gate
        ? feeder.filter(s => s.timeInGrade >= gate.minTig && s.yearsOfService >= gate.minTis && !s.flagged)
        : feeder.filter(s => !s.flagged)
      const authAt = auth.filter(p => p.careerCategory === cat && p.grade === toGrade).length
      const asgAt = people.filter(s => s.careerCategory === cat && s.rank === toGrade).length
      const open = Math.max(0, authAt - asgAt)
      const ratio = open > 0 ? Math.round((eligible.length / open) * 100) / 100 : null

      rows.push({
        fromGrade, toGrade, careerCategory: cat,
        feederStrength: feeder.length,
        eligibleNow: eligible.length,
        authorizedAtTarget: authAt,
        assignedAtTarget: asgAt,
        openAtTarget: open,
        ratio,
        status: feeder.length === 0 ? 'No Feeder'
          : ratio == null ? 'Healthy'
          : ratio < 0.5 ? 'Critical'
          : ratio < 1 ? 'Thin' : 'Healthy',
      })
    }
  }
  return rows
}

// ── Geographic heat table ─────────────────────────────────────────────────────
export interface GeoHeatRow {
  county: string
  cities: string[]
  soldiers: number
  officers: number
  enlisted: number
  warrants: number
  agr: number
  projectedLosses: number
}

export function geoHeatTable(
  roster: RosterSoldier[], baseYear: number, horizonYears: number
): GeoHeatRow[] {
  const byCounty = new Map<string, RosterSoldier[]>()
  for (const s of roster) {
    const c = countyForCity(s.city) ?? 'Unknown'
    const arr = byCounty.get(c) ?? []
    arr.push(s)
    byCounty.set(c, arr)
  }
  return [...byCounty.entries()].map(([county, people]) => ({
    county,
    cities: [...new Set(people.map(s => s.city))].sort(),
    soldiers: people.length,
    officers: people.filter(s => s.careerCategory === 'Officer').length,
    enlisted: people.filter(s => s.careerCategory === 'Enlisted').length,
    warrants: people.filter(s => s.careerCategory === 'Warrant').length,
    agr: people.filter(s => s.componentStatus === 'AGR').length,
    projectedLosses: people.filter(s => earliestDeparture(s, baseYear, horizonYears) != null).length,
  })).sort((a, b) => b.soldiers - a.soldiers)
}

export { buildUnitFamilies, nextGradeFor }
