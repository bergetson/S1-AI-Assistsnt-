import type { OrgNode } from './types'

// ── Tidy-tree layout ──────────────────────────────────────────────────────────
// Two passes, O(n), fully deterministic — same tree plus same expanded set
// always yields identical coordinates, which is what makes it testable.
//
//   1. Bottom-up: a subtree is as wide as its children laid side by side, or as
//      wide as one node, whichever is greater.
//   2. Top-down: children are placed left to right inside the parent's span and
//      the parent is centred over them.
//
// Reingold–Tilford's contour threading buys nothing here: this is a strict tree
// with no cross-links, so sibling subtrees cannot collide under sum-of-widths.

export const NODE_W = 208
export const NODE_H = 108
/** A node showing its billet mosaic is taller. */
export const NODE_H_EXPANDED = 176
export const GAP_X = 26
export const ROW_H = 158

export interface PositionedNode {
  node: OrgNode
  x: number
  y: number
  w: number
  h: number
  depth: number
  /** True when this node's children are being drawn. */
  open: boolean
  /** True when it could open but is not. */
  collapsible: boolean
}

export interface Edge {
  id: string
  /** Parent bottom-centre. */
  x1: number
  y1: number
  /** Child top-centre. */
  x2: number
  y2: number
  /** Drawn dashed: a relationship the MTOE extract does not contain. */
  synthesized?: boolean
}

export interface LayoutResult {
  nodes: PositionedNode[]
  edges: Edge[]
  width: number
  height: number
}

/** Whether a node draws its billet mosaic, which changes its height. */
function heightOf(node: OrgNode, showTiles: boolean): number {
  return showTiles && node.billets.length > 0 ? NODE_H_EXPANDED : NODE_H
}

export function layoutTree(
  root: OrgNode,
  expanded: Set<string>,
  opts: { tilesFor?: (n: OrgNode) => boolean } = {}
): LayoutResult {
  const tilesFor = opts.tilesFor ?? (() => false)
  const widths = new Map<string, number>()

  // Pass 1 — how wide is each subtree.
  ;(function measure(n: OrgNode): number {
    const kids = expanded.has(n.id) ? n.children : []
    if (kids.length === 0) {
      widths.set(n.id, NODE_W)
      return NODE_W
    }
    const total = kids.reduce((sum, k) => sum + measure(k), 0) + GAP_X * (kids.length - 1)
    const w = Math.max(NODE_W, total)
    widths.set(n.id, w)
    return w
  })(root)

  const nodes: PositionedNode[] = []
  const edges: Edge[] = []
  let maxY = 0

  // Pass 2 — place. `left` is the left edge of this subtree's span.
  ;(function place(n: OrgNode, left: number, depth: number) {
    const span = widths.get(n.id) ?? NODE_W
    const y = depth * ROW_H
    const kids = expanded.has(n.id) ? n.children : []
    const h = heightOf(n, tilesFor(n))

    // Centre the parent over its children's centres rather than over its own
    // span. With uneven subtree widths the two differ, and span-centring leaves
    // the parent visibly off its children. Staying between the first and last
    // child centre keeps the node inside its span, so siblings cannot collide.
    let x = left + span / 2 - NODE_W / 2
    if (kids.length > 0) {
      let cur = left
      let firstC = 0
      let lastC = 0
      kids.forEach((k, i) => {
        const kw = widths.get(k.id) ?? NODE_W
        const centre = cur + kw / 2
        if (i === 0) firstC = centre
        lastC = centre
        cur += kw + GAP_X
      })
      x = (firstC + lastC) / 2 - NODE_W / 2
    }

    nodes.push({
      node: n, x, y, w: NODE_W, h, depth,
      open: kids.length > 0,
      collapsible: n.children.length > 0,
    })
    maxY = Math.max(maxY, y + h)

    let cursor = left
    for (const k of kids) {
      const kw = widths.get(k.id) ?? NODE_W
      const kx = cursor + kw / 2 - NODE_W / 2
      edges.push({
        id: `${n.id}->${k.id}`,
        x1: x + NODE_W / 2,
        y1: y + h,
        x2: kx + NODE_W / 2,
        y2: (depth + 1) * ROW_H,
        // JFHQ's children are on the published chart, not in the MTOE.
        synthesized: k.fromPublishedChart,
      })
      place(k, cursor, depth + 1)
      cursor += kw + GAP_X
    }
  })(root, 0, 0)

  return {
    nodes,
    edges,
    width: widths.get(root.id) ?? NODE_W,
    height: maxY,
  }
}

/**
 * Ids that must be open for `target` to be visible — every ancestor, but not
 * the target itself. Used by the sidebar to reveal a searched node.
 */
export function ancestorsOf(
  root: OrgNode, targetId: string
): string[] {
  const path: string[] = []
  let found = false
  ;(function walk(n: OrgNode, trail: string[]) {
    if (found) return
    if (n.id === targetId) { path.push(...trail); found = true; return }
    for (const c of n.children) walk(c, [...trail, n.id])
  })(root, [])
  return path
}

/**
 * The opening view: the root and its immediate formations, and nothing else.
 *
 * Expanding a level further looks thorough and reads as a wall of unreadable
 * postage stamps — 24 cards across 5,900px, which the viewport can only show
 * by zooming out past legibility. Six boxes under JFHQ is exactly the shape of
 * the chart people already know, and every level below is one click away.
 */
export function defaultExpanded(root: OrgNode): Set<string> {
  return new Set<string>([root.id])
}
