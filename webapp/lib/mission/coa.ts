import type { CivilianCapabilityProfile } from '../civilian/types'
import { VERIFICATION_RANK } from '../civilian/types'
import type { MissionDefinition, CandidateMatch, CourseOfAction, CoaKind } from './types'
import { computeFills } from './matcher'
import { aggregateImpact } from '../communityImpact/calculateImpact'
import { countyForCity, IMPACT_RANK } from '../communityImpact/types'
import type { ImpactLevel } from '../communityImpact/types'

// ── Course-of-action construction ─────────────────────────────────────────────
// Each COA is built by a greedy fill against a different ordering of the same
// candidate pool. Deterministic by construction: identical inputs always yield
// identical COAs, and the ordering rule is stated in the COA description so a
// planner can see exactly what "best technical fit" optimized for.

type Orderer = (a: CandidateMatch, b: CandidateMatch) => number

const IMPACT_ORDER: Record<ImpactLevel, number> = IMPACT_RANK

const ORDERERS: Record<Exclude<CoaKind, 'User Defined'>, { order: Orderer; description: string }> = {
  'Best Technical Fit': {
    description: 'Ranks purely on capability match, proficiency, and verification. Ignores community and geography.',
    order: (a, b) => b.fitScore - a.fitScore || a.soldierId.localeCompare(b.soldierId),
  },
  'Lowest Community Impact': {
    description: 'Prefers soldiers whose activation is least likely to remove critical civilian capability from a community.',
    order: (a, b) =>
      IMPACT_ORDER[a.communityImpact] - IMPACT_ORDER[b.communityImpact] ||
      b.fitScore - a.fitScore || a.soldierId.localeCompare(b.soldierId),
  },
  'Closest Geographic Fit': {
    description: 'Prefers the shortest travel distance to the mission location.',
    order: (a, b) =>
      (a.distanceMiles ?? 99_999) - (b.distanceMiles ?? 99_999) ||
      b.fitScore - a.fitScore || a.soldierId.localeCompare(b.soldierId),
  },
  'Best Balance': {
    description: 'Balances capability against community impact and travel distance.',
    order: (a, b) => {
      const score = (c: CandidateMatch) =>
        c.fitScore - IMPACT_ORDER[c.communityImpact] * 8 -
        Math.min(20, (c.distanceMiles ?? 300) / 25)
      return score(b) - score(a) || a.soldierId.localeCompare(b.soldierId)
    },
  },
  'Lowest Unit Disruption': {
    description: 'Spreads sourcing across units so no single formation loses too many people.',
    order: (a, b) => b.fitScore - a.fitScore || a.soldierId.localeCompare(b.soldierId),
  },
  'Highest Verification Confidence': {
    description: 'Prefers document-verified capability over self-reported claims.',
    order: (a, b) =>
      VERIFICATION_RANK[b.verification] - VERIFICATION_RANK[a.verification] ||
      b.fitScore - a.fitScore || a.soldierId.localeCompare(b.soldierId),
  },
}

/**
 * Greedy fill. Walks requirements by scarcity (hardest to fill first) so a
 * generalist is not consumed by an easy requirement that many others could meet.
 */
function greedyFill(
  mission: MissionDefinition,
  pool: CandidateMatch[],
  order: Orderer,
  spreadUnits: boolean
): CandidateMatch[] {
  const eligible = pool.filter(c => c.blockers.length === 0)
  const byScarcity = [...mission.requirements].sort((r1, r2) => {
    const n1 = eligible.filter(c => c.satisfies.includes(r1.id)).length
    const n2 = eligible.filter(c => c.satisfies.includes(r2.id)).length
    return n1 - n2 || r1.id.localeCompare(r2.id)
  })

  const chosen = new Map<string, CandidateMatch>()
  const perUnit = new Map<string, number>()

  for (const req of byScarcity) {
    if (req.desired) continue
    let taken = [...chosen.values()].filter(c => c.satisfies.includes(req.id)).length
    const cands = eligible
      .filter(c => c.satisfies.includes(req.id) && !chosen.has(c.soldierId))
      .sort((a, b) => {
        if (spreadUnits) {
          const ua = perUnit.get(a.uic) ?? 0
          const ub = perUnit.get(b.uic) ?? 0
          if (ua !== ub) return ua - ub
        }
        return order(a, b)
      })
    for (const c of cands) {
      if (taken >= req.quantity) break
      chosen.set(c.soldierId, c)
      perUnit.set(c.uic, (perUnit.get(c.uic) ?? 0) + 1)
      taken++
    }
  }
  return [...chosen.values()]
}

function avgVerification(sel: CandidateMatch[]): number {
  if (sel.length === 0) return 0
  return sel.reduce((s, c) => s + VERIFICATION_RANK[c.verification], 0) / sel.length
}

export function buildCoa(
  kind: CoaKind,
  mission: MissionDefinition,
  pool: CandidateMatch[],
  profiles: Map<string, CivilianCapabilityProfile>,
  asOfIso: string,
  explicitSelection?: string[]
): CourseOfAction {
  const spec = kind === 'User Defined' ? null : ORDERERS[kind]
  const selected = explicitSelection
    ? pool.filter(c => explicitSelection.includes(c.soldierId))
    : greedyFill(mission, pool, spec!.order, kind === 'Lowest Unit Disruption')

  const fills = computeFills(mission, selected)
  const required = fills.filter(f => !f.requirement.desired)
  const totalNeeded = required.reduce((s, f) => s + f.needed, 0)
  const totalFilled = required.reduce((s, f) => s + Math.min(f.filled, f.needed), 0)

  const impact = aggregateImpact(
    selected.map(c => ({
      soldierId: c.soldierId, displayName: c.displayName, unit: c.unit,
      profile: profiles.get(c.soldierId),
    })),
    { durationDays: mission.durationDays, noticeDays: mission.noticeDays, activationType: 'State Active Duty' },
    asOfIso)

  const units = new Set(selected.map(c => c.uic))
  const employers = new Set(
    selected.map(c => profiles.get(c.soldierId)?.employment?.employerName).filter(Boolean) as string[])
  const counties = new Set(
    selected.map(c => {
      const e = profiles.get(c.soldierId)?.employment
      return e?.workCounty ?? countyForCity(e?.workCity)
    }).filter(Boolean) as string[])

  const withDistance = selected.filter(c => c.distanceMiles != null)
  const avgDistance = withDistance.length
    ? Math.round(withDistance.reduce((s, c) => s + (c.distanceMiles ?? 0), 0) / withDistance.length)
    : null

  const duplicateCoverage = selected
    .filter(c => c.satisfies.filter(id => required.some(f => f.requirement.id === id)).length > 1)
    .map(c => ({ soldierId: c.soldierId, displayName: c.displayName, requirementIds: c.satisfies }))

  const unmet = required.filter(f => f.unmet > 0)
    .map(f => `${f.unmet} of ${f.needed} ${f.requirement.label}`)

  // ── Tradeoffs, stated plainly ────────────────────────────────────────────────
  const tradeoffs: string[] = []
  if (unmet.length) tradeoffs.push(`Does not fill: ${unmet.join('; ')}.`)
  else tradeoffs.push('Fills every required capability.')
  if (impact.level === 'High' || impact.level === 'Critical') {
    tradeoffs.push(`Community impact is ${impact.level.toLowerCase()} — review the concentration warnings before committing.`)
  }
  if (units.size > 4) tradeoffs.push(`Draws from ${units.size} units, which spreads readiness impact but complicates coordination.`)
  if (employers.size > 0 && selected.length > employers.size) {
    tradeoffs.push(`${selected.length - employers.size} selected soldiers share a civilian employer with someone else on the team.`)
  }
  if (duplicateCoverage.length) {
    tradeoffs.push(`${duplicateCoverage.length} soldier(s) are covering more than one requirement — losing one creates two gaps.`)
  }
  const av = avgVerification(selected)
  if (av < 1.5) tradeoffs.push('Average verification confidence is low; most capability claims are self-reported.')

  const limitations = [
    'Deterministic decision support only. This is not an order, tasking, or assignment authority.',
    ...impact.limitations,
  ]

  return {
    id: `coa-${kind.toLowerCase().replace(/\s+/g, '-')}`,
    kind,
    description: spec?.description ?? 'Manually selected team.',
    selectedIds: selected.map(c => c.soldierId),
    requirementFills: fills,
    requirementsFilledPct: totalNeeded === 0 ? 100 : Math.round((totalFilled / totalNeeded) * 100),
    unmetRequirements: unmet,
    duplicateCoverage,
    avgVerificationScore: Math.round(av * 100) / 100,
    communityImpact: impact.level,
    unitsAffected: units.size,
    employersAffected: employers.size,
    countiesAffected: counties.size,
    avgDistanceMiles: avgDistance,
    tradeoffs, limitations,
  }
}

export const DEFAULT_COA_KINDS: CoaKind[] = [
  'Best Technical Fit', 'Lowest Community Impact', 'Best Balance',
]

export function buildCoaSet(
  mission: MissionDefinition,
  pool: CandidateMatch[],
  profiles: Map<string, CivilianCapabilityProfile>,
  asOfIso: string,
  kinds: CoaKind[] = DEFAULT_COA_KINDS
): CourseOfAction[] {
  return kinds.map(k => buildCoa(k, mission, pool, profiles, asOfIso))
}
