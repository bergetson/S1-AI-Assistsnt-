import type { Position } from '../types'
import type { RosterSoldier } from '../commandTypes'
import { rankLabel } from '../commandTypes'
import type { CivilianCapabilityProfile } from '../civilian/types'
import { isCredentialExpired, isCredentialExpiringSoon } from '../civilian/types'
import type { MarketplaceApplication } from '../marketplace/types'
import {
  rosterInFormation, positionsInFormation, vacantBillets, earliestDeparture,
  isStaleInPosition, hasServiceDates, buildUnitNameMap, resolveUnitName,
  TIP_STALE_YEARS, computeManning,
} from '../forceAnalytics'
import { singlePointsOfFailure } from '../talent/succession'
import { mosGaps } from '../talent/statewideAnalytics'
import type { ActionItem } from './types'
import { sortActions } from './types'

// ── Deriving the priority feed ────────────────────────────────────────────────
// Pure and deterministic. Same roster in, same ranked list out — so two people
// looking at the same formation see the same priorities and can talk about them.

export interface ActionContext {
  positions: Position[]
  roster: RosterSoldier[]
  /** Formation scope. Empty means statewide. */
  uics: string[]
  civilian: Map<string, CivilianCapabilityProfile>
  applications: MarketplaceApplication[]
  baseYear: number
  asOfIso: string
}

function fmtList(items: string[], max = 3): string[] {
  return items.slice(0, max)
}

export function buildActions(ctx: ActionContext): ActionItem[] {
  const { positions, roster, baseYear, asOfIso } = ctx
  const uics = ctx.uics.length
    ? ctx.uics
    : [...new Set(positions.map(p => p.uic).filter(Boolean) as string[])]

  const people = rosterInFormation(roster, uics)
  const nameMap = buildUnitNameMap(positions)
  const out: ActionItem[] = []

  if (people.length === 0) return out

  // ── Succession: the questions a commander actually loses sleep over ─────────
  const spof = singlePointsOfFailure(positions, roster, uics, baseYear, 5, { limit: 120 })

  const noSuccessor = spof.findings.filter(f => f.kind === 'No successor')
  if (noSuccessor.length > 0) {
    out.push({
      id: 'succession.none',
      roles: ['commander', 'talent', 'g1'],
      urgency: 'Act now',
      severity: 'critical',
      headline: `${noSuccessor.length} key billet${noSuccessor.length === 1 ? '' : 's'} ${noSuccessor.length === 1 ? 'has' : 'have'} no one ready to take over`,
      why: 'If the incumbent leaves tomorrow, nobody inside your formation qualifies to replace them.',
      action: 'Identify a developmental candidate now, or plan a lateral transfer or accession.',
      href: '/command/succession',
      linkLabel: 'Review succession',
      count: noSuccessor.length,
      examples: fmtList(noSuccessor.map(f => f.label)),
    })
  }

  const oneDeep = spof.findings.filter(f => f.kind === 'One successor only')
  if (oneDeep.length > 0) {
    out.push({
      id: 'succession.oneDeep',
      roles: ['commander', 'talent'],
      urgency: 'This quarter',
      severity: 'high',
      headline: `${oneDeep.length} key billet${oneDeep.length === 1 ? '' : 's'} depend${oneDeep.length === 1 ? 's' : ''} on a single person`,
      why: 'One ready successor is not a bench. If that person moves, the seat is empty.',
      action: 'Develop a second candidate for each of these billets.',
      href: '/command/succession',
      linkLabel: 'See the bench',
      count: oneDeep.length,
      examples: fmtList(oneDeep.map(f => f.label)),
    })
  }

  const doubleBooked = spof.findings.filter(f => f.kind === 'Successor for multiple critical billets')
  if (doubleBooked.length > 0) {
    out.push({
      id: 'succession.doubleBooked',
      roles: ['commander', 'talent'],
      urgency: 'This quarter',
      severity: 'high',
      headline: `${doubleBooked.length} soldier${doubleBooked.length === 1 ? ' is' : 's are'} the top successor for more than one key billet`,
      why: 'They can only fill one. The other seats have less depth than the numbers suggest.',
      action: 'Decide which billet each person is being groomed for, and build depth behind the rest.',
      href: '/command/succession',
      linkLabel: 'Review overlaps',
      count: doubleBooked.length,
      examples: fmtList(doubleBooked.map(f => f.label)),
    })
  }

  // One item, not one per year — a commander wants "when does the bow wave hit",
  // not a separate card for every year that happens to cluster.
  const clusterLoss = spof.findings
    .filter(f => f.kind === 'Multiple losses same window')
    .map(f => ({ f, year: Number((f.label.match(/\b(20\d{2})\b/) ?? [])[1] ?? 9999) }))
    .sort((a, b) => a.year - b.year)

  if (clusterLoss.length > 0) {
    const soonest = clusterLoss[0]
    const total = clusterLoss.reduce((n, c) => n + c.f.soldierIds.length, 0)
    out.push({
      id: 'losses.cluster',
      roles: ['commander', 'talent', 'g1'],
      urgency: soonest.year <= baseYear + 2 ? 'Act now' : 'This month',
      severity: clusterLoss.some(c => c.f.severity === 'Critical') ? 'critical' : 'high',
      headline: clusterLoss.length === 1
        ? soonest.f.label
        : `Senior leader departures cluster in ${clusterLoss.length} separate years, starting ${soonest.year}`,
      why: `${total} senior leaders reach a departure trigger in bunches rather than spread out, so several key seats open at once.`,
      action: 'Stagger the replacements deliberately instead of backfilling them all in the same cycle.',
      href: '/command/forecast',
      linkLabel: 'Open forecast',
      count: total,
      soldierIds: [...new Set(clusterLoss.flatMap(c => c.f.soldierIds))],
      examples: clusterLoss.slice(0, 4).map(c => `${c.year}: ${c.f.detail}`),
    })
  }

  // ── Vacancies that matter ───────────────────────────────────────────────────
  const openBillets = vacantBillets(positions, roster, uics).filter(p => p.authorized !== false)
  const criticalVacant = openBillets.filter(p => p.isCommandOrKD)
  if (criticalVacant.length > 0) {
    out.push({
      id: 'vacancy.critical',
      roles: ['commander', 'talent'],
      urgency: 'Act now',
      severity: 'critical',
      headline: `${criticalVacant.length} command or key-developmental billet${criticalVacant.length === 1 ? ' is' : 's are'} empty`,
      why: 'These are the positions that carry the formation and build the next generation of leaders.',
      action: 'Fill them first — the candidate list is already ranked for each one.',
      href: '/talent/vacancies',
      linkLabel: 'See candidates',
      count: criticalVacant.length,
      examples: fmtList(criticalVacant.map(p =>
        `${p.dutyTitle} (${rankLabel(p.grade)}) — ${resolveUnitName(p.uic ?? '', nameMap)}`)),
    })
  }

  // ── Manning ─────────────────────────────────────────────────────────────────
  const manning = computeManning(positions, roster, uics)
  if (manning.totalFillPct < 80 && manning.totalAuthorized > 0) {
    const worst = manning.byGrade
      .filter(r => r.authorized >= 5 && r.fillPct < 70)
      .sort((a, b) => a.fillPct - b.fillPct)
    out.push({
      id: 'manning.low',
      roles: ['commander', 'talent', 'g1'],
      urgency: 'This quarter',
      severity: manning.totalFillPct < 70 ? 'high' : 'moderate',
      headline: `Your formation is at ${manning.totalFillPct}% fill`,
      why: `${manning.totalAuthorized - manning.totalAssigned} authorized billets have nobody in them.`,
      action: worst.length
        ? `Focus recruiting and reassignment on ${worst.slice(0, 3).map(w => rankLabel(w.key)).join(', ')} — the thinnest grades.`
        : 'Review which grades are thinnest and prioritize accordingly.',
      href: '/command',
      linkLabel: 'See manning by grade',
      count: manning.totalAuthorized - manning.totalAssigned,
      examples: fmtList(worst.map(w => `${rankLabel(w.key)}: ${w.assigned}/${w.authorized} (${w.fillPct}%)`)),
    })
  }

  // ── Development stalls ──────────────────────────────────────────────────────
  const stale = people.filter(isStaleInPosition)
  if (stale.length > 0) {
    out.push({
      id: 'people.stale',
      roles: ['commander', 'talent'],
      urgency: 'This quarter',
      severity: 'moderate',
      headline: `${stale.length} soldier${stale.length === 1 ? ' has' : 's have'} been in the same seat ${TIP_STALE_YEARS}+ years`,
      why: 'Long time in position stalls development and blocks the people behind them from moving up.',
      action: 'Plan the next assignment for each, or confirm they are deliberately being held in place.',
      href: '/command/roster',
      linkLabel: 'See who',
      count: stale.length,
      soldierIds: stale.map(s => s.id),
      examples: fmtList(stale
        .sort((a, b) => b.timeInPosition - a.timeInPosition)
        .map(s => `${rankLabel(s.rank)} ${s.lastName} — ${s.timeInPosition} yr in ${s.dutyTitle}`)),
    })
  }

  // ── Near-term losses ────────────────────────────────────────────────────────
  const twoYear = people.filter(s => earliestDeparture(s, baseYear, 2) != null)
  if (twoYear.length > 0) {
    const leaders = twoYear.filter(s => ['E7', 'E8', 'E9', 'O4', 'O5', 'O6', 'W4', 'W5'].includes(s.rank))
    out.push({
      id: 'losses.twoYear',
      roles: ['commander', 'talent', 'g1'],
      urgency: 'This month',
      severity: leaders.length >= 5 ? 'high' : 'moderate',
      headline: `${twoYear.length} soldier${twoYear.length === 1 ? '' : 's'} could depart within two years`,
      why: leaders.length
        ? `${leaders.length} of them are senior leaders whose seats take the longest to refill.`
        : 'Contracts expiring and retirement eligibility both land in this window.',
      action: 'Start retention conversations now, while there is still time to change the outcome.',
      href: '/command/forecast',
      linkLabel: 'Open forecast',
      count: twoYear.length,
      soldierIds: twoYear.map(s => s.id),
      caveat: 'An expiring contract is not a departure — most soldiers reenlist. These are risks, not losses.',
    })
  }

  // ── MOS qualification ───────────────────────────────────────────────────────
  const notMosq = people.filter(s => s.flagged)
  if (notMosq.length > 0) {
    const pct = Math.round((notMosq.length / people.length) * 100)
    out.push({
      id: 'readiness.mosq',
      roles: ['commander', 'talent', 'g1'],
      urgency: pct >= 20 ? 'This month' : 'This quarter',
      severity: pct >= 25 ? 'high' : 'moderate',
      headline: `${notMosq.length} soldier${notMosq.length === 1 ? ' is' : 's are'} not MOS-qualified (${pct}% of the formation)`,
      why: 'They occupy a billet they are not yet trained for, which counts against readiness.',
      action: 'Get school seats scheduled, or reassign to a billet matching their qualification.',
      href: '/command/roster',
      linkLabel: 'Filter the roster',
      count: notMosq.length,
      soldierIds: notMosq.map(s => s.id),
    })
  }

  // ── MOS shortages ───────────────────────────────────────────────────────────
  const gaps = mosGaps(positions, roster, uics)
    .filter(g => g.status === 'Shortage' && g.authorized >= 5)
    .slice(0, 5)
  if (gaps.length > 0) {
    out.push({
      id: 'manning.mos',
      roles: ['talent', 'g1'],
      urgency: 'This quarter',
      severity: 'moderate',
      headline: `${gaps.length} MOS${gaps.length === 1 ? '' : 's'} ${gaps.length === 1 ? 'is' : 'are'} meaningfully undermanned`,
      why: 'These specialties cannot cover their authorized billets with the people on hand.',
      action: 'Target recruiting and reclassification at these MOSs specifically.',
      href: '/g1-state-view',
      linkLabel: 'See talent gaps',
      count: gaps.length,
      examples: fmtList(gaps.map(g => `${g.mos}: ${g.assigned}/${g.authorized} (${g.fillPct}%)`)),
    })
  }

  // ── Credentials ─────────────────────────────────────────────────────────────
  let expired = 0
  let expiring = 0
  const expiringNames: string[] = []
  for (const s of people) {
    const prof = ctx.civilian.get(s.id)
    for (const c of prof?.credentials ?? []) {
      if (isCredentialExpired(c, asOfIso)) expired++
      else if (isCredentialExpiringSoon(c, asOfIso)) {
        expiring++
        if (expiringNames.length < 3) expiringNames.push(`${s.lastName} — ${c.name}`)
      }
    }
  }
  if (expired + expiring > 0) {
    out.push({
      id: 'credentials.lapsing',
      roles: ['talent', 'commander'],
      urgency: 'This quarter',
      severity: 'moderate',
      headline: `${expired} civilian credential${expired === 1 ? ' has' : 's have'} expired and ${expiring} expire soon`,
      why: 'A lapsed license means that capability cannot be counted on for a mission that requires it.',
      action: 'Ask those soldiers to renew and re-verify.',
      href: '/talent/data-quality',
      linkLabel: 'See which',
      count: expired + expiring,
      examples: expiringNames,
    })
  }

  // ── Marketplace ─────────────────────────────────────────────────────────────
  const pending = ctx.applications.filter(a =>
    a.status === 'Commander Review' || a.status === 'Talent Manager Review')
  if (pending.length > 0) {
    out.push({
      id: 'marketplace.pending',
      roles: ['commander', 'talent'],
      urgency: 'This month',
      severity: 'moderate',
      headline: `${pending.length} application${pending.length === 1 ? '' : 's'} ${pending.length === 1 ? 'is' : 'are'} waiting on you`,
      why: 'Soldiers who applied are waiting for a decision they cannot move forward without.',
      action: 'Review the slate and record an endorsement or a decision.',
      href: '/talent/marketplace',
      linkLabel: 'Review applications',
      count: pending.length,
    })
  }

  // ── Data gaps that block real analysis ──────────────────────────────────────
  const noDates = !people.some(hasServiceDates)
  if (noDates) {
    out.push({
      id: 'data.serviceDates',
      roles: ['commander', 'talent', 'g1'],
      urgency: 'This month',
      severity: 'high',
      headline: 'Promotion planning is switched off because two columns are missing',
      why: 'Without date of rank and PEBD there is no time in grade or time in service, so board eligibility, the promotion requirement, and retention limits cannot be computed.',
      action: 'Ask for DOR and PEBD on the next personnel extract. Everything else on these pages is already accurate.',
      href: '/talent/data-quality',
      linkLabel: 'See all data gaps',
    })
  }

  const unmatched = manning.unmatchedSoldiers
  if (unmatched > 0) {
    out.push({
      id: 'data.unmatched',
      roles: ['talent', 'g1'],
      urgency: 'This quarter',
      severity: 'moderate',
      headline: `${unmatched} soldier${unmatched === 1 ? ' is' : 's are'} assigned to a unit that is not in the force structure`,
      why: 'They are invisible to every manning and readiness number on these pages.',
      action: 'Correct the UIC on the roster, or update the force structure file.',
      href: '/talent/data-quality',
      linkLabel: 'See details',
      count: unmatched,
    })
  }

  return sortActions(out)
}
