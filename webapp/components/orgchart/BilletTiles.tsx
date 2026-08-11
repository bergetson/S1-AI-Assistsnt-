'use client'

import { memo } from 'react'
import type { Position } from '@/lib/types'
import { cn } from '@/lib/utils'

// One square per billet: filled, vacant, or an unauthorized over-strength line.
// A 130-billet company becomes a mosaic you can read in one glance, which is
// the whole point — a number tells you 88/104, the mosaic shows you the shape.

const CAP = 132   // beyond this the mosaic stops being readable anyway

export interface TileState {
  position: Position
  filled: boolean
}

export const BilletTiles = memo(function BilletTiles({
  tiles, highlightMos, onPick, dense,
}: {
  tiles: TileState[]
  /** When set, only this MOS keeps full opacity. */
  highlightMos?: string | null
  onPick?: (p: Position) => void
  dense?: boolean
}) {
  if (tiles.length === 0) return null
  const shown = tiles.slice(0, CAP)
  const hidden = tiles.length - shown.length
  const size = dense ? 'w-2 h-2' : 'w-2.5 h-2.5'

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap gap-[3px]">
        {shown.map(t => {
          const unauth = t.position.authorized === false
          const dim = highlightMos
            ? t.position.mos.trim().toUpperCase() !== highlightMos.trim().toUpperCase()
            : false
          return (
            <button
              key={t.position.id}
              onClick={onPick ? e => { e.stopPropagation(); onPick(t.position) } : undefined}
              title={`${t.position.grade} ${t.position.mos} — ${t.position.dutyTitle}` +
                `${t.filled ? '' : ' — VACANT'}${unauth ? ' — unauthorized line' : ''}`}
              aria-label={`${t.position.grade} ${t.position.dutyTitle}, ${t.filled ? 'filled' : 'vacant'}`}
              className={cn(
                size, 'rounded-[2px] transition-opacity',
                onPick && 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-green-700',
                dim && 'opacity-20',
                unauth
                  ? 'bg-amber-300 border border-amber-500'
                  : t.filled
                    ? 'bg-green-800'
                    : 'bg-white border border-gray-400',
              )}
            />
          )
        })}
      </div>
      {hidden > 0 && (
        <div className="text-[10px] text-gray-500 mt-1">+{hidden} more — open the unit for the full list</div>
      )}
    </div>
  )
})

/** Shared key so the mosaic is never ambiguous. */
export function TileLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-600">
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-[2px] bg-green-800" /> filled
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-[2px] bg-white border border-gray-400" /> vacant
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-[2px] bg-amber-300 border border-amber-500" /> over-strength line
      </span>
    </div>
  )
}
