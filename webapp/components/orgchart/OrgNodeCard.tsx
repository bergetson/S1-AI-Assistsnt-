'use client'

import { memo } from 'react'
import type { OrgNode } from '@/lib/orgChart/types'
import type { PositionedNode } from '@/lib/orgChart/layout'
import { NODE_W } from '@/lib/orgChart/layout'
import {
  UNIT_TYPE_COLOR, rampColor, type OverlayMetric, type MetricResult,
} from '@/lib/orgChart/overlays'
import type { MosCount } from '@/lib/orgChart/mos'
import { BilletTiles, type TileState } from './BilletTiles'
import { cn } from '@/lib/utils'

// Hoisted and memoized deliberately. A component declared inside the canvas's
// render would be a new type on every pan frame, remounting all ~60 cards.

const NEUTRAL = { bg: '#F4F4F1', ring: '#D8D8D0', text: '#1C1F1A' }

export interface NodeCardProps {
  placed: PositionedNode
  metric: OverlayMetric
  result: MetricResult
  mosCount?: MosCount
  /** Set while a MOS is selected and this node holds none of it. */
  dimmed?: boolean
  selected?: boolean
  /** Gold ring — a billet on the soldier's own career plan lives here. */
  onPlan?: boolean
  tiles?: TileState[]
  highlightMos?: string | null
  onToggle: (id: string) => void
  onOpen: (id: string) => void
  onSelect: (node: OrgNode) => void
  onPickBillet?: (id: number) => void
}

export const OrgNodeCard = memo(function OrgNodeCard({
  placed, metric, result, mosCount, dimmed, selected, onPlan,
  tiles, highlightMos, onToggle, onOpen, onSelect, onPickBillet,
}: NodeCardProps) {
  const { node, x, y, h } = placed
  const categorical = metric === 'unitType'
  const palette = categorical
    ? (node.unitType ? UNIT_TYPE_COLOR[node.unitType] : NEUTRAL)
    : NEUTRAL
  const accent = categorical ? palette.ring : rampColor(result.intensity)

  // Many children reads better as a drill-through than as a 12,000px row.
  const preferOpen = node.children.length > 8

  return (
    <div
      style={{ left: x, top: y, width: NODE_W, height: h }}
      className={cn(
        'absolute rounded-xl border bg-white shadow-sm transition-all duration-150',
        'flex flex-col overflow-hidden',
        dimmed && 'opacity-20',
        selected && 'ring-2 ring-offset-2 ring-green-800',
        onPlan && !selected && 'ring-2 ring-offset-1 ring-amber-400',
      )}
    >
      {/* Accent edge carries the overlay meaning without a decorative stripe. */}
      <div style={{ backgroundColor: accent }} className="h-1 w-full flex-shrink-0" />

      <button
        onClick={() => onSelect(node)}
        className="flex-1 text-left px-3 pt-2 pb-1.5 min-w-0 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-1.5">
          <span className="font-bold text-[13px] leading-tight text-gray-900 line-clamp-2">
            {node.label}
          </span>
          {mosCount && mosCount.total > 0 && (
            <span className="flex-shrink-0 text-[10px] font-bold rounded px-1 py-0.5 bg-green-800 text-white whitespace-nowrap">
              {mosCount.filled}●{mosCount.vacant > 0 && ` ${mosCount.vacant}○`}
            </span>
          )}
        </div>

        {node.sublabel && (
          <div className="text-[10.5px] text-gray-500 truncate mt-0.5">{node.sublabel}</div>
        )}

        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-[15px] font-bold tabular-nums" style={{ color: accent }}>
            {node.assigned}
          </span>
          <span className="text-[11px] text-gray-500 tabular-nums">
            / {node.authorized || '—'}
          </span>
          {!categorical && result.value !== null && (
            <span className="ml-auto text-[10px] text-gray-600 truncate">{result.label}</span>
          )}
        </div>

        {/* Manning bar, always present — it is the one number every role reads. */}
        {node.authorized > 0 && (
          <div className="mt-1 h-1 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.round((node.assigned / node.authorized) * 100))}%`,
                backgroundColor: accent,
              }}
            />
          </div>
        )}

      </button>

      {/* Sibling of the header button, never a child of it: each tile is its
          own button, and a button inside a button is invalid HTML that fails
          hydration outright. */}
      {tiles && tiles.length > 0 && (
        <div className="px-3 pb-1.5 -mt-0.5">
          <BilletTiles
            tiles={tiles}
            highlightMos={highlightMos}
            dense
            onPick={onPickBillet ? p => onPickBillet(p.id) : undefined}
          />
        </div>
      )}

      {placed.collapsible && (
        <button
          onClick={() => (preferOpen ? onOpen(node.id) : onToggle(node.id))}
          className="flex-shrink-0 border-t text-[10.5px] font-semibold text-gray-600 hover:bg-gray-100 py-1 transition-colors"
          aria-expanded={placed.open}
        >
          {preferOpen
            ? `Open · ${node.children.length} units ›`
            : placed.open
              ? '▲ Collapse'
              : `▼ ${node.children.length} ${node.children.length === 1 ? 'unit' : 'units'}`}
        </button>
      )}
    </div>
  )
})
