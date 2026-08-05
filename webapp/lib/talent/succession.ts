import type { Position } from '../types'
import type { RosterSoldier } from '../commandTypes'
import { rankCandidates, positionsInFormation, rosterInFormation, earliestDeparture, isStaleInPosition } from '../forceAnalytics'

// ── Succession depth ──────────────────────────────────────────────────────────
// Extends the existing deterministic candidate ranking into a depth picture, so
// a leader can see not just "who could fill this" but "what happens if nobody
// can" and "who is load-bearing in more than one place".

export type SuccessionLevel =
  | 'Ready Now'
  | 'Ready Soon'
  | 'Developmental'
  | 'No Internal Successor'
  | 'Unknown Due to Missing Data'

export interface SuccessorSummary {
  soldierId: string
  displayName: string
  rank: string
  unit: string
  score: number
  readiness: string
  blockers: string[]
}

export interface BilletSuccession {
  position: Position
  incumbent: RosterSoldier | null
  incumbentTip: number | null
  projectedDepartureYear: number | null
  criticality: 'Critical' | 'High' | 'Routine'
  level: SuccessionLevel
  readyNow: SuccessorSummary[]
  readySoon: SuccessorSummary[]
  developmental: SuccessorSummary[]
  requiresAccession: boolean
  recommendedActions: string[]
}

function criticalityOf(pos: Position): BilletSuccession['criticality'] {
  if (pos.isCommandOrKD) return 'Critical'
  if (pos.positionType === 'Command' || pos.positionType === 'Leadership') return 'High'
  return 'Routine'
}

export function assessBilletSuccession(
  pos: Position,
  roster: RosterSoldier[],
  baseYear: number,
  horizonYears: number
): BilletSuccession {
  const incumbent = roster.find(s => s.positionId === pos.id) ?? null
  const departure = incumbent ? earliestDeparture(incumbent, baseYear, horizonYears) : null
  const candidates = rankCandidates(roster.filter(s => s.positionId !== pos.id), pos, 25)

  const toSummary = (c: ReturnType<typeof rankCandidates>[number]): SuccessorSummary => ({
    soldierId: c.soldier.id,
    displayName: `${c.soldier.lastName}, ${c.soldier.firstName}`,
    rank: c.soldier.rank,
    unit: c.soldier.unitName,
    score: c.score,
    readiness: c.readiness,
    blockers: c.blockers,
  })

  const clean = candidates.filter(c => c.blockers.length === 0)
  const readyNow = clean.filter(c => c.readiness === 'Ready now').map(toSummary)
  const readySoon = clean.filter(c => c.readiness === 'Ready with development' && c.score >= 55).map(toSummary)
  const developmental = clean
    .filter(c => c.readiness === 'Ready with development' && c.score < 55)
    .map(toSummary)

  let level: SuccessionLevel
  if (roster.length === 0) level = 'Unknown Due to Missing Data'
  else if (readyNow.length > 0) level = 'Ready Now'
  else if (readySoon.length > 0) level = 'Ready Soon'
  else if (developmental.length > 0) level = 'Developmental'
  else level = 'No Internal Successor'

  const recommendedActions: string[] = []
  if (level === 'No Internal Successor') {
    recommendedActions.push('No internal candidate identified — plan for lateral transfer or accession.')
  }
  if (readyNow.length === 1) {
    recommendedActions.push('Only one ready-now successor. Develop a second candidate to remove the single point of failure.')
  }
  if (incumbent && isStaleInPosition(incumbent)) {
    recommendedActions.push(`Incumbent has ${incumbent.timeInPosition} yr in position and is due to move.`)
  }
  if (departure) {
    recommendedActions.push(`Incumbent projected to depart around ${departure.year} (${departure.reason}).`)
  }
  if (developmental.length > 0 && readyNow.length === 0 && readySoon.length === 0) {
    recommendedActions.push('Bench is developmental only — begin targeted PME and KD assignments now.')
  }

  return {
    position: pos,
    incumbent,
    incumbentTip: incumbent?.timeInPosition ?? null,
    projectedDepartureYear: departure?.year ?? null,
    criticality: criticalityOf(pos),
    level,
    readyNow, readySoon, developmental,
    requiresAccession: level === 'No Internal Successor',
    recommendedActions,
  }
}

export interface SinglePointOfFailure {
  kind:
    | 'No successor'
    | 'One successor only'
    | 'Successor for multiple critical billets'
    | 'Successor is themselves critical'
    | 'Multiple losses same window'
  label: string
  detail: string
  positionIds: number[]
  soldierIds: string[]
  severity: 'Critical' | 'High' | 'Moderate'
}

/**
 * Cross-billet risk. The interesting failures are not single billets but
 * dependencies: one person who is the only answer for three key jobs, or a
 * battalion losing four leaders in the same year.
 */
export function singlePointsOfFailure(
  positions: Position[],
  roster: RosterSoldier[],
  uics: string[],
  baseYear: number,
  horizonYears: number,
  opts: { keyOnly?: boolean; limit?: number } = {}
): { findings: SinglePointOfFailure[]; assessed: BilletSuccession[] } {
  const inScope = positionsInFormation(positions, uics)
    .filter(p => p.authorized !== false)
    .filter(p => (opts.keyOnly === false ? true : p.isCommandOrKD || p.positionType === 'Command' || p.positionType === 'Leadership'))
    .slice(0, opts.limit ?? 120)
  const people = rosterInFormation(roster, uics)

  const assessed = inScope.map(p => assessBilletSuccession(p, people, baseYear, horizonYears))
  const findings: SinglePointOfFailure[] = []

  for (const a of assessed) {
    if (a.level === 'No Internal Successor') {
      findings.push({
        kind: 'No successor',
        label: `${a.position.dutyTitle} (${a.position.grade})`,
        detail: `No internal candidate meets the requirements for this ${a.criticality.toLowerCase()} billet.`,
        positionIds: [a.position.id],
        soldierIds: [],
        severity: a.criticality === 'Critical' ? 'Critical' : 'High',
      })
    } else if (a.readyNow.length === 1 && a.readySoon.length === 0) {
      findings.push({
        kind: 'One successor only',
        label: `${a.position.dutyTitle} (${a.position.grade})`,
        detail: `${a.readyNow[0].displayName} is the only ready-now successor.`,
        positionIds: [a.position.id],
        soldierIds: [a.readyNow[0].soldierId],
        severity: a.criticality === 'Critical' ? 'High' : 'Moderate',
      })
    }
  }

  // One person named as sole/top successor across several critical billets.
  const soleFor = new Map<string, number[]>()
  for (const a of assessed) {
    if (a.criticality === 'Routine') continue
    for (const s of a.readyNow.slice(0, 1)) {
      const arr = soleFor.get(s.soldierId) ?? []
      arr.push(a.position.id)
      soleFor.set(s.soldierId, arr)
    }
  }
  for (const [soldierId, posIds] of soleFor) {
    if (posIds.length >= 2) {
      const person = people.find(p => p.id === soldierId)
      findings.push({
        kind: 'Successor for multiple critical billets',
        label: person ? `${person.lastName}, ${person.firstName}` : soldierId,
        detail: `Top ready-now successor for ${posIds.length} key billets — cannot fill more than one.`,
        positionIds: posIds,
        soldierIds: [soldierId],
        severity: 'High',
      })
    }
  }

  // Concentrated departures inside one year.
  const byYear = new Map<number, RosterSoldier[]>()
  for (const s of people) {
    const d = earliestDeparture(s, baseYear, horizonYears)
    if (!d) continue
    const arr = byYear.get(d.year) ?? []
    arr.push(s)
    byYear.set(d.year, arr)
  }
  for (const [year, group] of byYear) {
    const leaders = group.filter(s => ['E7', 'E8', 'E9', 'O4', 'O5', 'O6', 'W4', 'W5'].includes(s.rank))
    if (leaders.length >= 3) {
      findings.push({
        kind: 'Multiple losses same window',
        label: `${leaders.length} senior leaders projected to depart in ${year}`,
        detail: leaders.slice(0, 6).map(s => `${s.rank} ${s.lastName}`).join(', ') +
          (leaders.length > 6 ? ` +${leaders.length - 6} more` : ''),
        positionIds: [],
        soldierIds: leaders.map(s => s.id),
        severity: leaders.length >= 5 ? 'Critical' : 'High',
      })
    }
  }

  const order = { Critical: 0, High: 1, Moderate: 2 }
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.label.localeCompare(b.label))
  return { findings, assessed }
}
