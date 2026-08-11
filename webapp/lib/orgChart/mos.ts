import type { Position } from '../types'
import type { RosterSoldier } from '../commandTypes'
import type { OrgNode } from './types'
import { walk } from './build'

// ── "Show me everywhere this MOS lives" ───────────────────────────────────────
// Clicking a fueler billet should light up every unit in the state that holds
// one. Counts are split filled/vacant because "who has it" and "who needs it"
// are different questions and a commander asks both.

export interface MosCount {
  filled: number
  vacant: number
  total: number
}

export const EMPTY_MOS_COUNT: MosCount = { filled: 0, vacant: 0, total: 0 }

/**
 * Per-node counts of one MOS, rolled up. Computed once per MOS selection and
 * read by every node, rather than each node filtering the whole billet list.
 */
export function mosCountsByNode(
  root: OrgNode, roster: RosterSoldier[], mos: string
): Map<string, MosCount> {
  const occupied = new Set(
    roster.map(s => s.positionId).filter((id): id is number => id != null)
  )
  const out = new Map<string, MosCount>()
  const target = mos.trim().toUpperCase()

  ;(function tally(n: OrgNode): MosCount {
    const acc: MosCount = { filled: 0, vacant: 0, total: 0 }
    for (const b of n.billets) {
      if (b.mos.trim().toUpperCase() !== target) continue
      acc.total++
      if (occupied.has(b.id)) acc.filled++
      else acc.vacant++
    }
    for (const c of n.children) {
      const sub = tally(c)
      acc.filled += sub.filled
      acc.vacant += sub.vacant
      acc.total += sub.total
    }
    out.set(n.id, acc)
    return acc
  })(root)

  return out
}

export interface MosOption {
  mos: string
  total: number
  /** Distinct units holding it — the number that makes an MOS worth spotlighting. */
  units: number
}

/** MOSs present in the tree, most widely held first. Powers the picker. */
export function mosOptions(root: OrgNode): MosOption[] {
  const totals = new Map<string, number>()
  const units = new Map<string, Set<string>>()
  walk(root, n => {
    for (const b of n.billets) {
      const m = b.mos.trim().toUpperCase()
      if (!m) continue
      totals.set(m, (totals.get(m) ?? 0) + 1)
      const set = units.get(m) ?? new Set<string>()
      if (b.uic) set.add(b.uic)
      units.set(m, set)
    }
  })
  return [...totals.entries()]
    .map(([mos, total]) => ({ mos, total, units: units.get(mos)?.size ?? 0 }))
    .sort((a, b) => b.total - a.total || a.mos.localeCompare(b.mos))
}

/** Every billet of one MOS, for the detail panel. */
export function billetsOfMos(root: OrgNode, mos: string): Position[] {
  const target = mos.trim().toUpperCase()
  const out: Position[] = []
  walk(root, n => {
    for (const b of n.billets) if (b.mos.trim().toUpperCase() === target) out.push(b)
  })
  return out
}
