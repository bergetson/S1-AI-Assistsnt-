import type { Position } from '../types'
import type { RosterSoldier } from '../commandTypes'
import { RANK_NUM } from '../scoring'
import { buildUnitNameMap } from '../forceAnalytics'
import type { OrgNode, OrgTree, UnitType } from './types'
import {
  ROOT_FORMATION, JFHQ_CHILDREN, BN_DISPLAY_NAMES, UIC_DESIGNATORS,
  MAPPED_BDES, MAPPED_UICS, type FormationEntry,
} from './commandStructure'

// ── Flat billets → five-level tree ────────────────────────────────────────────
// JFHQ → formation → battalion → company (UIC) → section (MTOE paragraph) → billet.
//
// Two properties are load-bearing and tested:
//   * Nothing is dropped. Every billet lands in exactly one section, and
//     anything the command table does not place appears under "Unmapped
//     formations" rather than vanishing.
//   * Occupancy comes from the ROSTER, not from Position.vacancyStatus, which
//     is a stale snapshot from a different report.

/**
 * A TEMPLET / Standard Excess line — a real soldier who is not against an
 * authorization.
 *
 * Keyed on the `authorized` field, NOT on the 9xx paragraph convention: of the
 * 459 unauthorized billets, 166 sit on ordinary paragraph numbers, so the
 * paragraph is a decent hint and a wrong rule.
 */
function isUnauthorized(p: Position): boolean {
  return p.authorized === false
}

function paraPrefix(paraLine: string | undefined): string {
  const s = (paraLine ?? '').trim()
  const dash = s.indexOf('-')
  return dash > 0 ? s.slice(0, dash) : s || '—'
}

function tidy(s: string): string {
  let out = s
  // Some source names are double-encoded ('&amp;amp;amp;'); decode repeatedly.
  for (let i = 0; i < 4 && out.includes('&amp;'); i++) out = out.replace(/&amp;/g, '&')
  return out.replace(/\s+/g, ' ').trim()
}

/** Title Case for the shouty MTOE strings, leaving acronyms alone. */
function titleCase(s: string): string {
  return s.split(' ').map(w =>
    w.length > 3 && /^[A-Z]+$/.test(w)
      ? w[0] + w.slice(1).toLowerCase()
      : w
  ).join(' ')
}

/**
 * A company's display name, best available.
 * Designator table → the shared unit-name map → the raw UIC.
 */
function companyLabel(uic: string, nameMap: Map<string, string>): string {
  const designator = UIC_DESIGNATORS[uic]
  if (designator) return designator
  const mapped = nameMap.get(uic)
  if (mapped && mapped !== uic) return titleCase(tidy(mapped))
  return uic
}

/**
 * A section's name, inferred from its senior billet — MTOE paragraphs carry no
 * label at all. `inferredLabel` is set on the node so the UI can say so.
 */
function sectionLabel(billets: Position[]): string {
  const senior = [...billets].sort((a, b) =>
    (RANK_NUM[b.grade] ?? 0) - (RANK_NUM[a.grade] ?? 0))[0]
  return senior ? titleCase(tidy(senior.dutyTitle)) : 'Section'
}

function emptyNode(id: string, level: OrgNode['level'], label: string): OrgNode {
  return {
    id, level, label, uics: [], billets: [], children: [],
    authorized: 0, assigned: 0, unauthorizedAssigned: 0, billetCount: 0,
  }
}

/** Sum a node's counts from its children, or from its own billets at a leaf. */
function rollUp(node: OrgNode, occupied: Set<number>): void {
  if (node.children.length === 0) {
    for (const b of node.billets) {
      node.billetCount++
      const filled = occupied.has(b.id)
      if (b.authorized !== false) node.authorized++
      if (filled) {
        node.assigned++
        if (b.authorized === false) node.unauthorizedAssigned++
      }
    }
    return
  }
  for (const c of node.children) {
    rollUp(c, occupied)
    node.authorized += c.authorized
    node.assigned += c.assigned
    node.unauthorizedAssigned += c.unauthorizedAssigned
    node.billetCount += c.billetCount
    for (const u of c.uics) if (!node.uics.includes(u)) node.uics.push(u)
  }
}

/** Company node with its sections beneath it. */
function buildCompany(
  uic: string, billets: Position[], nameMap: Map<string, string>
): OrgNode {
  const node = emptyNode(`uic:${uic}`, 'company', companyLabel(uic, nameMap))
  node.uic = uic
  node.uics = [uic]

  const cities = new Map<string, number>()
  for (const b of billets) cities.set(b.city, (cities.get(b.city) ?? 0) + 1)
  node.city = [...cities.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  node.sublabel = node.city

  // Group by MTOE paragraph. Unauthorized lines collect into one trailing
  // bucket rather than scattering 9xx paragraphs through the real sections.
  const sections = new Map<string, Position[]>()
  const templet: Position[] = []
  for (const b of billets) {
    if (isUnauthorized(b)) { templet.push(b); continue }
    const key = paraPrefix(b.paraLine)
    const list = sections.get(key)
    if (list) list.push(b)
    else sections.set(key, [b])
  }

  for (const [para, list] of [...sections.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const s = emptyNode(`sec:${uic}:${para}`, 'section', sectionLabel(list))
    s.sublabel = `MTOE ${para}`
    s.uics = [uic]
    s.city = node.city
    s.billets = list
    s.inferredLabel = true
    node.children.push(s)
  }

  if (templet.length) {
    const s = emptyNode(`sec:${uic}:templet`, 'section', 'Unauthorized / TEMPLET')
    s.sublabel = 'Over-strength lines, not authorizations'
    s.uics = [uic]
    s.city = node.city
    s.billets = templet
    s.unauthorizedBucket = true
    node.children.push(s)
  }

  return node
}

/** Battalion node with its companies beneath it. */
function buildBattalion(
  bn: string, billets: Position[], nameMap: Map<string, string>
): OrgNode {
  const label = BN_DISPLAY_NAMES[bn] ?? titleCase(tidy(bn))
  const node = emptyNode(`bn:${bn}`, 'battalion', label)

  const byUic = new Map<string, Position[]>()
  for (const b of billets) {
    const uic = b.uic ?? 'UNKNOWN'
    const list = byUic.get(uic)
    if (list) list.push(b)
    else byUic.set(uic, [b])
  }
  for (const [uic, list] of [...byUic.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    node.children.push(buildCompany(uic, list, nameMap))
  }

  const cities = new Set(node.children.map(c => c.city).filter(Boolean))
  node.sublabel = cities.size === 1 ? [...cities][0] : `${cities.size} locations`
  return node
}

/** Formation node — a published-chart box, holding battalions or bare UICs. */
function buildFormation(
  entry: FormationEntry,
  byBn: Map<string, Position[]>,
  byUic: Map<string, Position[]>,
  bdeOfBn: Map<string, string>,
  nameMap: Map<string, string>
): OrgNode {
  const node = emptyNode(`fmn:${entry.key}`, 'formation', entry.label)
  node.unitType = entry.unitType
  node.sublabel = entry.note
  node.fromPublishedChart = true

  // Named UICs become company nodes directly under the formation.
  for (const uic of entry.uics ?? []) {
    const list = byUic.get(uic)
    if (list?.length) node.children.push(buildCompany(uic, list, nameMap))
  }
  // Whole brigades contribute all of their battalions.
  for (const bde of entry.bdes ?? []) {
    for (const [bn, list] of byBn) {
      if (bdeOfBn.get(bn) === bde && list.length) {
        node.children.push(buildBattalion(bn, list, nameMap))
      }
    }
  }
  for (const bn of entry.bns ?? []) {
    const list = byBn.get(bn)
    if (list?.length) node.children.push(buildBattalion(bn, list, nameMap))
  }
  // Biggest first — the chart reads better when the mass is on the left.
  node.children.sort((a, b) => b.billetCount - a.billetCount || a.label.localeCompare(b.label))

  // A formation wrapping exactly one unit of the same identity is a box drawn
  // around a box. Absorb the child so 'JAG › 3777th Field Trial Defense Team'
  // is one node, not two — while keeping the published chart's name.
  if (node.children.length === 1) {
    const only = node.children[0]
    node.children = only.children
    node.uic = only.uic
    node.city = only.city
    node.sublabel = entry.note ?? only.sublabel
  }
  return node
}

export function buildOrgTree(positions: Position[], roster: RosterSoldier[]): OrgTree {
  const nameMap = buildUnitNameMap(positions)
  const occupied = new Set(
    roster.map(s => s.positionId).filter((id): id is number => id != null)
  )

  const byBn = new Map<string, Position[]>()
  const byUic = new Map<string, Position[]>()
  const bdeOfBn = new Map<string, string>()
  for (const p of positions) {
    const bn = p.bn ?? ''
    const uic = p.uic ?? 'UNKNOWN'
    ;(byBn.get(bn) ?? byBn.set(bn, []).get(bn)!).push(p)
    ;(byUic.get(uic) ?? byUic.set(uic, []).get(uic)!).push(p)
    if (p.bde && bn && !bdeOfBn.has(bn)) bdeOfBn.set(bn, p.bde)
  }

  const root = emptyNode(`fmn:${ROOT_FORMATION.key}`, 'root', ROOT_FORMATION.label)
  root.unitType = ROOT_FORMATION.unitType
  root.sublabel = ROOT_FORMATION.note

  // Billets claimed by a named UIC belong to that box, not to their battalion —
  // otherwise HHD JFHQ would appear twice, once named and once inside the
  // JFHQ staff battalion.
  const claimedUics = new Set(MAPPED_UICS)
  for (const entry of JFHQ_CHILDREN) {
    const node = buildFormation(entry, byBn, byUic, bdeOfBn, nameMap)
    if (node.children.length) root.children.push(node)
  }

  // Anything the command table does not place. Kept visible on purpose: an
  // empty node here means the table is current, and a populated one is the
  // only signal that it has drifted.
  const unmapped: Position[] = []
  for (const p of positions) {
    const uic = p.uic ?? 'UNKNOWN'
    if (claimedUics.has(uic)) continue
    if (p.bde && MAPPED_BDES.has(p.bde)) continue
    unmapped.push(p)
  }
  if (unmapped.length) {
    const node = emptyNode('fmn:unmapped', 'formation', 'Unmapped formations')
    node.unitType = 'support'
    node.sublabel = 'Present in the MTOE extract but not on the published chart'
    const byBn2 = new Map<string, Position[]>()
    for (const p of unmapped) {
      const bn = p.bn ?? '(no battalion)'
      ;(byBn2.get(bn) ?? byBn2.set(bn, []).get(bn)!).push(p)
    }
    for (const [bn, list] of byBn2) node.children.push(buildBattalion(bn, list, nameMap))
    root.children.push(node)
  }

  rollUp(root, occupied)

  const byId = new Map<string, OrgNode>()
  const parentOf = new Map<string, string>()
  ;(function index(n: OrgNode, parent?: string) {
    byId.set(n.id, n)
    if (parent) parentOf.set(n.id, parent)
    for (const c of n.children) index(c, n.id)
  })(root)

  return { root, byId, parentOf }
}

/** Every node from the root down to `id`, for a breadcrumb. */
export function pathTo(tree: OrgTree, id: string): OrgNode[] {
  const out: OrgNode[] = []
  let cur: string | undefined = id
  while (cur) {
    const n = tree.byId.get(cur)
    if (!n) break
    out.unshift(n)
    cur = tree.parentOf.get(cur)
  }
  return out
}

/** Depth-first walk, parents before children. */
export function walk(node: OrgNode, fn: (n: OrgNode) => void): void {
  fn(node)
  for (const c of node.children) walk(c, fn)
}

export type { UnitType }
