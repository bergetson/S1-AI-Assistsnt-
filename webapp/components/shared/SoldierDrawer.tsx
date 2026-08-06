'use client'

import { useEffect, useMemo, useState } from 'react'
import type { RosterSoldier } from '@/lib/commandTypes'
import { rankLabel, soldierLabel } from '@/lib/commandTypes'
import { RANK_NUM } from '@/lib/scoring'
import { boardEligibility, isStaleInPosition, earliestDeparture, TIP_STALE_YEARS } from '@/lib/forceAnalytics'
import { countyForCity } from '@/lib/communityImpact/types'
import { downloadCsv } from '@/lib/exports'
import { exportBanner } from '@/lib/dataSources'
import { useForceData } from './useForceData'
import { cn } from '@/lib/utils'

// Any aggregate in the app can open this: a bar, a tile, a count. The whole
// point is that a number is never a dead end — a commander asking "who are
// those 41 people" gets the list, with the identifiers and clocks that matter.

export interface DrawerRequest {
  title: string
  subtitle?: string
  soldiers: RosterSoldier[]
}

type SortKey = 'rank' | 'name' | 'unit' | 'tip' | 'ets'

/**
 * Hoisted deliberately. A component declared inside render is a fresh type on
 * every keystroke, so React remounts the header and the filter box loses focus.
 */
function Th({
  k, children, right, sortKey, asc, onSort,
}: {
  k?: SortKey
  children: React.ReactNode
  right?: boolean
  sortKey: SortKey
  asc: boolean
  onSort: (k: SortKey) => void
}) {
  return (
    <th
      onClick={k ? () => onSort(k) : undefined}
      className={cn('px-2 py-1.5 text-xs font-bold text-gray-600 whitespace-nowrap',
        right ? 'text-right' : 'text-left',
        k && 'cursor-pointer hover:bg-gray-200 select-none')}
      aria-sort={k && sortKey === k ? (asc ? 'ascending' : 'descending') : undefined}
    >
      {children}{k && sortKey === k && <span className="ml-1">{asc ? '▲' : '▼'}</span>}
    </th>
  )
}

function etsYear(s: RosterSoldier): number {
  const y = Number((s.ets || '').slice(0, 4))
  return Number.isFinite(y) && y > 1900 ? y : 9999
}

export function SoldierDrawer({
  request, onClose, baseYear = 2026,
}: {
  request: DrawerRequest | null
  onClose: () => void
  baseYear?: number
}) {
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [asc, setAsc] = useState(false)
  const [q, setQ] = useState('')
  const { sources } = useForceData()

  // Escape closes, and the body must not scroll behind the panel.
  useEffect(() => {
    if (!request) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [request, onClose])

  const rows = useMemo(() => {
    if (!request) return []
    const needle = q.trim().toLowerCase()
    const list = needle
      ? request.soldiers.filter(s =>
          soldierLabel(s).toLowerCase().includes(needle) ||
          s.mos.toLowerCase().includes(needle) ||
          s.dutyTitle.toLowerCase().includes(needle) ||
          s.unitName.toLowerCase().includes(needle))
      : request.soldiers
    const dir = asc ? 1 : -1
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'name': return dir * soldierLabel(a).localeCompare(soldierLabel(b))
        case 'unit': return dir * a.unitName.localeCompare(b.unitName)
        case 'tip': return dir * (a.timeInPosition - b.timeInPosition)
        case 'ets': return dir * (etsYear(a) - etsYear(b))
        default: return dir * ((RANK_NUM[a.rank] ?? 0) - (RANK_NUM[b.rank] ?? 0))
      }
    })
  }, [request, q, sortKey, asc])

  if (!request) return null

  function sortBy(k: SortKey) {
    if (sortKey === k) setAsc(v => !v)
    else { setSortKey(k); setAsc(false) }
  }

  const th = { sortKey, asc, onSort: sortBy }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true"
      aria-label={request.title}>
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close panel" />

      <aside className="relative bg-white w-full max-w-3xl h-full shadow-2xl flex flex-col">
        <header className="px-5 py-4 border-b flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">{request.title}</h2>
            <p className="text-sm text-gray-500">
              {request.soldiers.length} soldier{request.soldiers.length === 1 ? '' : 's'}
              {request.subtitle ? ` · ${request.subtitle}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => downloadCsv(
                `${request.title.toLowerCase().replace(/\W+/g, '-')}.csv`,
                ['Soldier', 'Grade', 'MOS', 'Component', 'Unit', 'Duty title', 'City', 'County',
                 'TIS', 'TIG', 'TIP', 'ETS', 'MOS qualified'],
                rows.map(s => [
                  soldierLabel(s), s.rank, s.mos, s.componentStatus, s.unitName, s.dutyTitle,
                  s.city, countyForCity(s.city) ?? '',
                  s.yearsOfService ? String(s.yearsOfService) : 'unknown',
                  s.timeInGrade ? String(s.timeInGrade) : 'unknown',
                  String(s.timeInPosition), s.ets, s.flagged ? 'No' : 'Yes',
                ]),
                exportBanner(sources.military,
                  'TIS and TIG read "unknown" where the source extract carried no PEBD or date of rank.'))}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium">
              ⬇ Export
            </button>
            <button onClick={onClose}
              className="text-gray-500 hover:text-gray-900 text-2xl leading-none px-2"
              aria-label="Close">×</button>
          </div>
        </header>

        <div className="px-5 py-3 border-b">
          <input
            type="search" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Filter by name, MOS, duty title, or unit…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
          />
        </div>

        <div className="flex-1 overflow-auto">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-gray-500">No soldiers match that filter.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <Th {...th} k="name">Soldier</Th>
                  <Th {...th} k="rank">Grade</Th>
                  <Th {...th}>MOS</Th>
                  <Th {...th}>Comp</Th>
                  <Th {...th} k="unit">Unit</Th>
                  <Th {...th}>Duty title</Th>
                  <Th {...th} right>TIS</Th>
                  <Th {...th} right>TIG</Th>
                  <Th {...th} k="tip" right>TIP</Th>
                  <Th {...th} k="ets" right>ETS</Th>
                  <Th {...th}>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => {
                  const stale = isStaleInPosition(s)
                  const elig = boardEligibility(s)
                  const dep = earliestDeparture(s, baseYear, 2)
                  return (
                    <tr key={s.id} className={cn(i % 2 ? 'bg-gray-50' : 'bg-white', 'hover:bg-green-50')}>
                      <td className="px-2 py-1.5 font-medium whitespace-nowrap">{soldierLabel(s)}</td>
                      <td className="px-2 py-1.5 font-bold whitespace-nowrap" title={s.rank}>
                        {rankLabel(s.rank)}
                      </td>
                      <td className="px-2 py-1.5">{s.mos}</td>
                      <td className="px-2 py-1.5 text-xs">{s.componentStatus}</td>
                      <td className="px-2 py-1.5 text-xs max-w-[190px] truncate" title={s.unitName}>{s.unitName}</td>
                      <td className="px-2 py-1.5 text-xs max-w-[190px] truncate" title={s.dutyTitle}>{s.dutyTitle}</td>
                      <td className="px-2 py-1.5 text-right" title={s.yearsOfService ? undefined : 'PEBD not in the source data'}>
                        {s.yearsOfService || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right" title={s.timeInGrade ? undefined : 'Date of rank not in the source data'}>
                        {s.timeInGrade || <span className="text-gray-400">—</span>}
                      </td>
                      <td className={cn('px-2 py-1.5 text-right font-medium', stale && 'text-amber-700')}>
                        {s.timeInPosition || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs whitespace-nowrap">{s.ets || '—'}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {elig === 'Eligible' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800">Board</span>
                          )}
                          {stale && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800"
                              title={`${TIP_STALE_YEARS}+ years in position`}>Move</span>
                          )}
                          {dep && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800"
                              title={dep.detail}>{dep.year}</span>
                          )}
                          {s.flagged && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800"
                              title="Not MOS-qualified. This is not an AR 600-8-2 flag.">Not MOSQ</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer className="px-5 py-2 border-t text-xs text-gray-500">
          TIS and TIG show — when the source extract has no PEBD or date of rank.
          Click a column header to sort. Press Esc to close.
        </footer>
      </aside>
    </div>
  )
}

/** Small hook so pages can wire many drill-downs with one line each. */
export function useSoldierDrawer() {
  const [request, setRequest] = useState<DrawerRequest | null>(null)
  return {
    request,
    open: (title: string, soldiers: RosterSoldier[], subtitle?: string) =>
      setRequest({ title, soldiers, subtitle }),
    close: () => setRequest(null),
  }
}
