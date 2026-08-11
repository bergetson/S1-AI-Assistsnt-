'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LayoutResult } from '@/lib/orgChart/layout'
import { cn } from '@/lib/utils'

// ── Pan and zoom without a library ────────────────────────────────────────────
// One transformed container holds two layers that must stay registered: an SVG
// for the connectors and absolutely-positioned HTML for the node cards. HTML
// nodes rather than SVG ones so each card is a real <button> — focusable,
// labelled, and styleable with the same Tailwind as the rest of the app.

const MIN_SCALE = 0.2
/** Below this the labels stop being legible, so auto-fit will not go under it. */
const READABLE = 0.62
const MAX_SCALE = 1.6
const PAD = 80

export interface Viewport { x: number; y: number; k: number }

export function OrgCanvas({
  layout, children, className, focusId, nodeCenter, resetKey,
}: {
  layout: LayoutResult
  children: React.ReactNode
  className?: string
  /** Changing this recentres the view on that node. */
  focusId?: string | null
  nodeCenter?: (id: string) => { x: number; y: number } | null
  /** Changing this re-fits the view. Expanding a node deliberately does not. */
  resetKey?: string | null
}) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [vp, setVp] = useState<Viewport>({ x: PAD, y: PAD, k: 0.8 })
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const clampScale = (k: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, k))

  /**
   * Fit the tree, but never below READABLE. Scaling a wide tree to fit the
   * viewport produces cards too small to read, which is worse than making the
   * user pan — so past that point we centre at the readable floor instead.
   */
  const fit = useCallback(() => {
    const el = shellRef.current
    if (!el || layout.width === 0) return
    const w = el.clientWidth - PAD * 2
    const h = el.clientHeight - PAD * 2
    const raw = Math.min(w / layout.width, h / layout.height, 1)
    const k = clampScale(Math.max(READABLE, raw))
    setVp({
      // Centre when it fits; otherwise start at the left edge of the tree.
      x: layout.width * k <= w ? (el.clientWidth - layout.width * k) / 2 : PAD,
      y: PAD / 2,
      k,
    })
  }, [layout.width, layout.height])

  // Fit on mount and whenever the chart is re-rooted — but NOT on every
  // expand. Re-fitting as the tree grows yanks the view out from under the
  // node the user just clicked, which makes drilling in feel broken.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => { fit() }, [resetKey])
  /* eslint-enable react-hooks/exhaustive-deps */

  // Centre on a node when the sidebar asks for it.
  useEffect(() => {
    if (!focusId || !nodeCenter) return
    const c = nodeCenter(focusId)
    const el = shellRef.current
    if (!c || !el) return
    setVp(v => ({
      ...v,
      x: el.clientWidth / 2 - c.x * v.k,
      y: Math.max(PAD / 2, el.clientHeight / 3 - c.y * v.k),
    }))
  }, [focusId, nodeCenter])

  function onPointerDown(e: React.PointerEvent) {
    // Let clicks on cards through; only empty canvas starts a drag.
    if ((e.target as HTMLElement).closest('[data-node-card]')) return
    drag.current = { x: e.clientX, y: e.clientY, vx: vp.x, vy: vp.y }
    setDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    setVp(v => ({ ...v, x: d.vx + (e.clientX - d.x), y: d.vy + (e.clientY - d.y) }))
  }

  function endDrag(e: React.PointerEvent) {
    drag.current = null
    setDragging(false)
    if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    }
  }

  function onWheel(e: React.WheelEvent) {
    // Zoom toward the cursor so the point under the pointer stays put.
    const el = shellRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    setVp(v => {
      const k = clampScale(v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12))
      const ratio = k / v.k
      return { k, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio }
    })
  }

  return (
    <div className={cn('relative overflow-hidden bg-gray-50', className)}>
      <div
        ref={shellRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        className={cn('absolute inset-0 touch-none', dragging ? 'cursor-grabbing' : 'cursor-grab')}
        // A faint grid gives the pan something to read against.
        style={{
          backgroundImage: 'radial-gradient(circle, #d9dcd6 1px, transparent 1px)',
          backgroundSize: `${24 * vp.k}px ${24 * vp.k}px`,
          backgroundPosition: `${vp.x}px ${vp.y}px`,
        }}
      >
        <div
          style={{
            transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.k})`,
            transformOrigin: '0 0',
            width: layout.width,
            height: layout.height,
          }}
          className="relative"
        >
          <svg
            width={layout.width}
            height={layout.height}
            className="absolute inset-0 pointer-events-none overflow-visible"
            aria-hidden
          >
            {layout.edges.map(e => {
              // Orthogonal elbow: down, across, down. Reads as a command chart
              // in a way a bezier does not.
              const mid = (e.y1 + e.y2) / 2
              return (
                <path
                  key={e.id}
                  d={`M ${e.x1} ${e.y1} V ${mid} H ${e.x2} V ${e.y2}`}
                  fill="none"
                  stroke={e.synthesized ? '#B9A375' : '#B7BDB4'}
                  strokeWidth={1.5}
                  strokeDasharray={e.synthesized ? '5 4' : undefined}
                  strokeLinecap="round"
                />
              )
            })}
          </svg>
          {children}
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex gap-1.5">
        {([['−', 1 / 1.25], ['+', 1.25]] as const).map(([sym, f]) => (
          <button
            key={sym}
            onClick={() => setVp(v => ({ ...v, k: clampScale(v.k * f) }))}
            className="w-8 h-8 rounded-lg bg-white border border-gray-300 shadow-sm text-gray-700 font-bold hover:bg-gray-50"
            aria-label={f > 1 ? 'Zoom in' : 'Zoom out'}
          >{sym}</button>
        ))}
        <button
          onClick={fit}
          className="h-8 px-3 rounded-lg bg-white border border-gray-300 shadow-sm text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >Fit</button>
      </div>
    </div>
  )
}
