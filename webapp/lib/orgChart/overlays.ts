import type { RosterSoldier } from '../commandTypes'
import { earliestDeparture, isStaleInPosition } from '../forceAnalytics'
import { commissionedCap } from '../data/retention'
import type { OrgNode, UnitType } from './types'

// ── What the colour of a box means ────────────────────────────────────────────
// Default is `unitType`, the categorical scheme the published MTARNG chart
// already uses, so the tool opens looking like the chart people know. The
// quantitative overlays are one click away.

export type OverlayMetric =
  | 'unitType' | 'fill' | 'vacancies' | 'overStrength' | 'notMosq' | 'seniorLosses'

export const OVERLAYS: { id: OverlayMetric; label: string; hint: string }[] = [
  { id: 'unitType', label: 'Unit type', hint: 'Command, training, staff, support' },
  { id: 'fill', label: 'Fill %', hint: 'Assigned against authorized' },
  { id: 'vacancies', label: 'Vacancies', hint: 'Authorized billets with nobody in them' },
  { id: 'overStrength', label: 'Over-strength', hint: 'Assigned against unauthorized TEMPLET lines' },
  { id: 'notMosq', label: 'Not MOS-qualified', hint: 'Assigned soldiers without their MOS qualification' },
  { id: 'seniorLosses', label: 'Losses in 3 yr', hint: 'Projected departures, weighted' },
]

/** Categorical palette, matching the published chart's green/blue/gold. */
export const UNIT_TYPE_COLOR: Record<UnitType, { bg: string; ring: string; text: string }> = {
  command:  { bg: '#DCE7F0', ring: '#5B7C99', text: '#20364A' },
  training: { bg: '#DFEBCF', ring: '#7D9A4E', text: '#33471C' },
  staff:    { bg: '#F0E4C8', ring: '#C8A96E', text: '#4A3A17' },
  support:  { bg: '#E7E4DC', ring: '#9A9384', text: '#3D3A32' },
}

export interface MetricResult {
  /** The number shown on the node face. Null when the metric does not apply. */
  value: number | null
  label: string
  /** 0–1, drives the colour ramp. */
  intensity: number
  tone: 'good' | 'ok' | 'warn' | 'bad' | 'neutral'
}

export interface OverlayContext {
  /** Soldiers keyed by the UIC they sit in. */
  byUic: Map<string, RosterSoldier[]>
  baseYear: number
}

export function buildOverlayContext(roster: RosterSoldier[], baseYear: number): OverlayContext {
  const byUic = new Map<string, RosterSoldier[]>()
  for (const s of roster) {
    const list = byUic.get(s.uic)
    if (list) list.push(s)
    else byUic.set(s.uic, [s])
  }
  return { byUic, baseYear }
}

function soldiersUnder(node: OrgNode, ctx: OverlayContext): RosterSoldier[] {
  const out: RosterSoldier[] = []
  for (const u of node.uics) {
    const list = ctx.byUic.get(u)
    if (list) out.push(...list)
  }
  return out
}

export function nodeMetric(
  node: OrgNode, metric: OverlayMetric, ctx: OverlayContext
): MetricResult {
  switch (metric) {
    case 'unitType':
      return { value: null, label: node.unitType ?? '', intensity: 0, tone: 'neutral' }

    case 'fill': {
      if (node.authorized === 0) {
        // No authorizations at all — a fill percentage would be a lie, not a 0.
        return { value: null, label: 'no authorizations', intensity: 0, tone: 'neutral' }
      }
      const pct = Math.round((node.assigned / node.authorized) * 100)
      return {
        value: pct,
        label: `${node.assigned}/${node.authorized} · ${pct}%`,
        // Ramp over the band that actually varies; below 50% everything is red.
        intensity: Math.min(1, Math.max(0, (100 - pct) / 50)),
        tone: pct >= 90 ? 'good' : pct >= 75 ? 'ok' : pct >= 60 ? 'warn' : 'bad',
      }
    }

    case 'vacancies': {
      const vacant = Math.max(0, node.authorized - (node.assigned - node.unauthorizedAssigned))
      return {
        value: vacant,
        label: vacant === 1 ? '1 vacancy' : `${vacant} vacancies`,
        intensity: Math.min(1, vacant / 60),
        tone: vacant === 0 ? 'good' : vacant < 10 ? 'ok' : vacant < 30 ? 'warn' : 'bad',
      }
    }

    case 'overStrength': {
      const n = node.unauthorizedAssigned
      return {
        value: n,
        label: n === 0 ? 'none' : `${n} over authorization`,
        intensity: Math.min(1, n / 25),
        tone: n === 0 ? 'good' : n < 5 ? 'ok' : 'warn',
      }
    }

    case 'notMosq': {
      const people = soldiersUnder(node, ctx)
      const n = people.filter(s => s.flagged).length
      return {
        value: n,
        label: n === 0 ? 'all qualified' : `${n} not MOS-qualified`,
        intensity: people.length ? Math.min(1, n / (people.length * 0.35)) : 0,
        tone: n === 0 ? 'good' : n < 5 ? 'ok' : 'warn',
      }
    }

    case 'seniorLosses': {
      const people = soldiersUnder(node, ctx)
      let n = 0
      for (const s of people) {
        if (earliestDeparture(s, ctx.baseYear, 3)) { n++; continue }
        // Officer statutory removal is date-certain and not covered by the
        // contract-driven path above.
        const cap = commissionedCap(s.rank)
        if (cap && s.commissionedYears > 0 && s.commissionedYears >= cap.years - 3) n++
      }
      return {
        value: n,
        label: n === 1 ? '1 projected loss' : `${n} projected losses`,
        intensity: people.length ? Math.min(1, n / (people.length * 0.4)) : 0,
        tone: n === 0 ? 'good' : n < 10 ? 'ok' : n < 30 ? 'warn' : 'bad',
      }
    }
  }
}

/** Extra signals worth a small marker on the node face. */
export function nodeFlags(node: OrgNode, ctx: OverlayContext): string[] {
  const people = soldiersUnder(node, ctx)
  const out: string[] = []
  const stale = people.filter(isStaleInPosition).length
  if (stale > 0) out.push(`${stale} due to move`)
  return out
}

/** Green→amber→red ramp for the quantitative overlays. */
export function rampColor(intensity: number): string {
  const t = Math.min(1, Math.max(0, intensity))
  // Army green at 0 → gold at 0.5 → clay at 1. Interpolated in sRGB, which is
  // fine over this short a range and avoids pulling in a colour library.
  const stops: [number, number, number][] = [[27, 79, 42], [200, 169, 110], [166, 61, 47]]
  const seg = t < 0.5 ? 0 : 1
  const local = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5
  const a = stops[seg]
  const b = stops[seg + 1]
  const mix = a.map((v, i) => Math.round(v + (b[i] - v) * local))
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`
}
