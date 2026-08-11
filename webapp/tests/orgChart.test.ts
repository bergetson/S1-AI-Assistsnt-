import { describe, it, expect } from 'vitest'
import { positions } from '@/lib/data/positions'
import { realRoster } from '@/lib/data/realRoster'
import { buildOrgTree, walk, pathTo } from '@/lib/orgChart/build'
import { layoutTree, defaultExpanded, ancestorsOf, NODE_W, GAP_X } from '@/lib/orgChart/layout'
import { mosCountsByNode, mosOptions } from '@/lib/orgChart/mos'
import { buildOverlayContext, nodeMetric } from '@/lib/orgChart/overlays'
import { UIC_DESIGNATORS } from '@/lib/orgChart/commandStructure'
import type { OrgNode } from '@/lib/orgChart/types'

const tree = buildOrgTree(positions, realRoster)

function leaves(root: OrgNode): OrgNode[] {
  const out: OrgNode[] = []
  walk(root, n => { if (n.children.length === 0) out.push(n) })
  return out
}

describe('the tree accounts for every billet', () => {
  // The whole chart is worthless if it quietly loses lines, and a flat-to-tree
  // transform is exactly where that happens.
  it('places each billet in exactly one leaf', () => {
    const seen = new Set<number>()
    let total = 0
    for (const leaf of leaves(tree.root)) {
      for (const b of leaf.billets) {
        expect(seen.has(b.id), `billet ${b.id} appears twice`).toBe(false)
        seen.add(b.id)
        total++
      }
    }
    expect(total).toBe(positions.length)
    expect(seen.size).toBe(positions.length)
  })

  it('rolls authorized strength up to the real total', () => {
    expect(tree.root.authorized).toBe(positions.filter(p => p.authorized !== false).length)
    expect(tree.root.billetCount).toBe(positions.length)
  })

  it('counts every assigned soldier exactly once', () => {
    expect(tree.root.assigned).toBe(realRoster.length)
  })

  it('leaves nothing unmapped by the published-chart table', () => {
    // A populated "Unmapped formations" node is the signal that
    // commandStructure.ts has drifted from the extract. It must stay visible
    // rather than being filtered away, so this asserts it is empty, not absent.
    const unmapped = tree.root.children.find(c => c.id === 'fmn:unmapped')
    expect(unmapped?.billetCount ?? 0).toBe(0)
  })
})

describe('the root matches the published MTARNG chart', () => {
  it('puts JFHQ on top', () => {
    expect(tree.root.level).toBe('root')
    expect(tree.root.label).toMatch(/JFHQ/)
  })

  it('hangs the formations the published chart draws under it', () => {
    const labels = tree.root.children.map(c => c.label)
    for (const expected of [
      'HHD JFHQ', 'Army Element', 'JAG',
      '1889th Regional Support Group', '95th Troop Command', 'Training Center',
    ]) {
      expect(labels, `missing ${expected}`).toContain(expected)
    }
  })

  it('marks those edges as coming from the chart, not the MTOE extract', () => {
    // The extract has four disconnected brigade rollups and no root at all, so
    // asserting this relationship silently would be inventing structure.
    for (const c of tree.root.children) {
      if (c.id === 'fmn:unmapped') continue
      expect(c.fromPublishedChart, `${c.label} not marked`).toBe(true)
    }
  })

  it('keeps the two big commands where the extract also puts them', () => {
    const rsg = tree.root.children.find(c => c.label.startsWith('1889th'))!
    expect(rsg.children.map(c => c.label).sort()).toEqual([
      '1-163 Infantry', '1-189 Aviation',
      '495th Combat Sustainment Battalion', 'HHC, 1889th Support Group',
    ])
  })
})

describe('unauthorized lines are separated, never hidden', () => {
  it('buckets TEMPLET billets and keeps them out of authorized strength', () => {
    const buckets = leaves(tree.root).filter(n => n.unauthorizedBucket)
    expect(buckets.length).toBeGreaterThan(0)
    const total = buckets.reduce((s, n) => s + n.billets.length, 0)
    expect(total).toBe(positions.filter(p => p.authorized === false).length)
    for (const b of buckets) expect(b.authorized).toBe(0)
  })

  it('still counts soldiers sitting on them as assigned', () => {
    // Over-strength only surfaces if these people are inside `assigned` while
    // being excluded from `authorized`. Dropping them would understate the
    // force and hide the excess entirely.
    expect(tree.root.unauthorizedAssigned).toBeGreaterThan(0)
    const onAuthorized = tree.root.assigned - tree.root.unauthorizedAssigned
    expect(onAuthorized).toBeLessThan(tree.root.assigned)
    expect(onAuthorized).toBeLessThanOrEqual(tree.root.authorized)
  })
})

describe('every node is readable', () => {
  it('never shows a bare UIC as a label', () => {
    const bare: string[] = []
    walk(tree.root, n => {
      if (n.uic && n.label === n.uic) bare.push(n.uic)
    })
    expect(bare).toEqual([])
  })

  it('names the two orphan UICs that have no readable name in the source', () => {
    // W903A1 and W7Y441 carry unit === uic in the extract.
    for (const uic of ['W903A1', 'W7Y441']) {
      expect(UIC_DESIGNATORS[uic], `${uic} needs a name`).toBeTruthy()
    }
  })

  it('marks inferred section labels as inferred', () => {
    // MTOE paragraphs have no name at all; the label is guessed from the
    // group's senior billet and must say so.
    const sections = leaves(tree.root).filter(n => n.level === 'section' && !n.unauthorizedBucket)
    expect(sections.length).toBeGreaterThan(100)
    for (const s of sections) expect(s.inferredLabel).toBe(true)
  })

  it('keeps repeated MTOE lines as distinct billets', () => {
    // (uic, paraLine) is not unique — WTCPB0 stacks nine 203-01 lines — so
    // grouping must not collapse them.
    const b = tree.byId.get('uic:WTCPB0')
    expect(b).toBeTruthy()
    const all = b!.children.flatMap(c => c.billets)
    const dupes = all.filter(p => p.paraLine === '203-01')
    expect(dupes.length).toBeGreaterThan(1)
    expect(new Set(dupes.map(p => p.id)).size).toBe(dupes.length)
  })
})

describe('layout is deterministic and non-overlapping', () => {
  const expanded = defaultExpanded(tree.root)

  it('produces identical coordinates for identical input', () => {
    const a = layoutTree(tree.root, expanded)
    const b = layoutTree(tree.root, expanded)
    expect(a.nodes.map(n => [n.node.id, n.x, n.y]))
      .toEqual(b.nodes.map(n => [n.node.id, n.x, n.y]))
  })

  it('never overlaps two nodes on the same row', () => {
    const { nodes } = layoutTree(tree.root, expanded)
    const rows = new Map<number, number[]>()
    for (const n of nodes) rows.set(n.y, [...(rows.get(n.y) ?? []), n.x])
    for (const [, xs] of rows) {
      const sorted = [...xs].sort((p, q) => p - q)
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(NODE_W + GAP_X - 0.01)
      }
    }
  })

  it('centres a parent over its children', () => {
    const { nodes } = layoutTree(tree.root, expanded)
    const root = nodes.find(n => n.node.id === tree.root.id)!
    const kids = nodes.filter(n => n.depth === 1)
    const span = (Math.min(...kids.map(k => k.x)) + Math.max(...kids.map(k => k.x))) / 2
    expect(Math.abs(root.x - span)).toBeLessThan(1)
  })

  it('lays out only what is expanded', () => {
    const collapsed = layoutTree(tree.root, new Set([tree.root.id]))
    expect(collapsed.nodes.length).toBe(1 + tree.root.children.length)
  })

  it('reports the ancestors needed to reveal a node', () => {
    const deep = leaves(tree.root)[0]
    const path = ancestorsOf(tree.root, deep.id)
    expect(path[0]).toBe(tree.root.id)
    expect(path).not.toContain(deep.id)
    const shown = layoutTree(tree.root, new Set([...path, deep.id]))
    expect(shown.nodes.some(n => n.node.id === deep.id)).toBe(true)
  })
})

describe('MOS highlight', () => {
  it('sums per-node counts to the statewide total for that MOS', () => {
    const counts = mosCountsByNode(tree.root, realRoster, '92F')
    const actual = positions.filter(p => p.mos.toUpperCase() === '92F').length
    expect(counts.get(tree.root.id)?.total).toBe(actual)
  })

  it('splits filled from vacant using the roster, not vacancyStatus', () => {
    const occupied = new Set(realRoster.map(s => s.positionId))
    const counts = mosCountsByNode(tree.root, realRoster, '11B')!
    const c = counts.get(tree.root.id)!
    const real = positions.filter(p => p.mos.toUpperCase() === '11B')
    expect(c.filled).toBe(real.filter(p => occupied.has(p.id)).length)
    expect(c.filled + c.vacant).toBe(c.total)
  })

  it('offers the MOSs that actually exist, most widely held first', () => {
    const opts = mosOptions(tree.root)
    expect(opts[0].mos).toBe('11B')
    expect(opts[0].units).toBeGreaterThan(1)
  })
})

describe('overlays never invent a number', () => {
  const ctx = buildOverlayContext(realRoster, 2026)

  it('reports no fill percentage where there are no authorizations', () => {
    // A node of purely unauthorized lines has no denominator. 0% would read as
    // "unmanned" when the truth is "there is nothing to man".
    const bucket = leaves(tree.root).find(n => n.unauthorizedBucket)!
    const r = nodeMetric(bucket, 'fill', ctx)
    expect(r.value).toBeNull()
    expect(r.label).toMatch(/no authorizations/)
  })

  it('computes fill against authorized strength at the root', () => {
    const r = nodeMetric(tree.root, 'fill', ctx)
    expect(r.value).toBe(Math.round((tree.root.assigned / tree.root.authorized) * 100))
  })
})

describe('breadcrumbs', () => {
  it('walks from the root down to any node', () => {
    const deep = leaves(tree.root).find(n => n.level === 'section')!
    const path = pathTo(tree, deep.id)
    expect(path[0].id).toBe(tree.root.id)
    expect(path[path.length - 1].id).toBe(deep.id)
    expect(path.length).toBeGreaterThanOrEqual(3)
  })
})
