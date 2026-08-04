'use client'

import { useMemo, useState } from 'react'
import { positions } from '@/lib/data/positions'
import { useCommandStore } from '@/lib/commandStore'
import {
  rosterInFormation, isBoardEligible, isStaleInPosition, nextGradeFor,
  buildUnitNameMap, resolveUnitName, TIP_STALE_YEARS,
} from '@/lib/forceAnalytics'
import { PROMOTION_GATES, RANK_NUM } from '@/lib/scoring'
import { rankLabel, type RosterSoldier } from '@/lib/commandTypes'
import {
  ARMY_GREEN, CommandHeader, DemoBanner, DemoWatermark, FormationBar,
  CommandPrintStyles, NoFormation, useActiveRoster, useSeedFormation,
} from '@/components/command/CommandShell'
import { cn } from '@/lib/utils'

type SortKey = 'name' | 'rank' | 'unit' | 'tis' | 'tig' | 'tip' | 'eval'

const selectClass =
  'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700'
const labelClass = 'text-xs font-semibold text-gray-500 uppercase mb-1'

function evalLabel(s: RosterSoldier): string {
  if (s.careerCategory === 'Enlisted') return s.ncoerBox || '—'
  if (!s.srBox) return '—'
  return { MQ: 'Most Qualified', HQ: 'Highly Qualified', Q: 'Qualified', NQ: 'Not Qualified' }[s.srBox]
}

function evalRank(s: RosterSoldier): number {
  const v = s.careerCategory === 'Enlisted' ? s.ncoerBox : s.srBox
  const order: Record<string, number> = {
    MQ: 4, 'Most Qualified': 4, HQ: 3, 'Highly Qualified': 3,
    Q: 2, Qualified: 2, NQ: 1, 'Not Qualified': 1, '': 0,
  }
  return order[v] ?? 0
}

/**
 * Hoisted out of the page component on purpose: a component defined inside render
 * is a brand-new type every render, so React unmounts and remounts the whole
 * header — which drops focus out of the search box on every keystroke.
 */
function Th({
  k, children, className, sortKey, sortAsc, onSort,
}: {
  k?: SortKey
  children: React.ReactNode
  className?: string
  sortKey: SortKey
  sortAsc: boolean
  onSort: (k: SortKey) => void
}) {
  return (
    <th
      onClick={k ? () => onSort(k) : undefined}
      className={cn('border border-gray-300 px-2 py-1.5 text-left font-bold text-gray-600 text-xs',
        k && 'cursor-pointer hover:bg-gray-200 select-none', className)}
    >
      {children}{k && sortKey === k && <span className="ml-1">{sortAsc ? '▲' : '▼'}</span>}
    </th>
  )
}

function evalColor(s: RosterSoldier): string {
  const r = evalRank(s)
  if (r === 4) return 'bg-green-100 text-green-800'
  if (r === 3) return 'bg-blue-100 text-blue-800'
  if (r === 2) return 'bg-gray-100 text-gray-700'
  if (r === 1) return 'bg-red-100 text-red-800'
  return 'bg-gray-50 text-gray-400'
}

export default function CommandRosterPage() {
  useSeedFormation()
  const { selectedUics, source } = useCommandStore()
  const roster = useActiveRoster()

  const [category, setCategory] = useState('')
  const [grade, setGrade] = useState('')
  const [component, setComponent] = useState('')
  const [flag, setFlag] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortAsc, setSortAsc] = useState(false)

  const nameMap = useMemo(() => buildUnitNameMap(positions), [])
  const people = useMemo(() => rosterInFormation(roster, selectedUics), [roster, selectedUics])

  const grades = useMemo(
    () => [...new Set(people.map(s => s.rank))].sort((a, b) => (RANK_NUM[a] ?? 0) - (RANK_NUM[b] ?? 0)),
    [people]
  )

  const filtered = useMemo(() => {
    let list = people
    if (category) list = list.filter(s => s.careerCategory === category)
    if (grade) list = list.filter(s => s.rank === grade)
    if (component) list = list.filter(s => s.componentStatus === component)
    if (flag === 'board') list = list.filter(isBoardEligible)
    if (flag === 'stale') list = list.filter(isStaleInPosition)
    if (flag === 'flagged') list = list.filter(s => s.flagged)
    if (flag === 'promotable') list = list.filter(s => s.isPromotable)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(s =>
        `${s.lastName} ${s.firstName}`.toLowerCase().includes(q) ||
        s.mos.toLowerCase().includes(q) ||
        s.dutyTitle.toLowerCase().includes(q))
    }

    const dir = sortAsc ? 1 : -1
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'name': return dir * a.lastName.localeCompare(b.lastName)
        case 'unit': return dir * a.uic.localeCompare(b.uic)
        case 'tis': return dir * (a.yearsOfService - b.yearsOfService)
        case 'tig': return dir * (a.timeInGrade - b.timeInGrade)
        case 'tip': return dir * (a.timeInPosition - b.timeInPosition)
        case 'eval': return dir * (evalRank(a) - evalRank(b))
        default: return dir * ((RANK_NUM[a.rank] ?? 0) - (RANK_NUM[b.rank] ?? 0))
      }
    })
  }, [people, category, grade, component, flag, search, sortKey, sortAsc])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const th = { sortKey, sortAsc, onSort: toggleSort }

  if (selectedUics.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DemoBanner /><FormationBar /><NoFormation /><CommandPrintStyles />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DemoWatermark />
      <DemoBanner />
      <FormationBar />
      <CommandHeader
        title="Force Roster"
        subtitle="Every soldier in your formation with time in grade, time in position, evaluations, and board eligibility. Sort any column to find who is ready, who is stalled, and who is due to move."
        actions={
          <button onClick={() => window.print()}
            className="px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ backgroundColor: ARMY_GREEN }}>
            🖨️ Print Roster
          </button>
        }
      />

      {/* Filters */}
      <div className="px-8 py-4 bg-white border-b no-print">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-4 items-end">
          <div className="flex flex-col">
            <label className={labelClass}>Search</label>
            <input type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Name, MOS, or duty title…" className={cn(selectClass, 'w-56')} />
          </div>
          <div className="flex flex-col">
            <label className={labelClass}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={selectClass}>
              <option value="">All</option>
              <option>Officer</option><option>Warrant</option><option>Enlisted</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className={labelClass}>Grade</label>
            <select value={grade} onChange={e => setGrade(e.target.value)} className={selectClass}>
              <option value="">All</option>
              {grades.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className={labelClass}>Component</label>
            <select value={component} onChange={e => setComponent(e.target.value)} className={selectClass}>
              <option value="">All</option>
              <option>AGR</option><option>M-Day</option><option>Technician</option><option>ADOS</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className={labelClass}>Show only</label>
            <select value={flag} onChange={e => setFlag(e.target.value)} className={selectClass}>
              <option value="">Everyone</option>
              <option value="board">Board eligible</option>
              <option value="promotable">Promotable</option>
              <option value="stale">{TIP_STALE_YEARS}+ yrs in position</option>
              <option value="flagged">Flagged</option>
            </select>
          </div>
          <button
            onClick={() => { setCategory(''); setGrade(''); setComponent(''); setFlag(''); setSearch('') }}
            className="text-sm text-gray-500 hover:text-red-600 underline ml-auto self-end pb-2"
          >
            Reset filters
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm text-gray-500 mb-3">
            Showing <strong>{filtered.length}</strong> of {people.length} assigned
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-lg">No soldiers match these filters.</div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <Th {...th} k="name">Name</Th>
                    <Th {...th} k="rank">Grade</Th>
                    <Th {...th}>MOS</Th>
                    <Th {...th}>Comp</Th>
                    <Th {...th} k="unit">Unit</Th>
                    <Th {...th}>Duty Title</Th>
                    <Th {...th} k="tis">TIS</Th>
                    <Th {...th} k="tig">TIG</Th>
                    <Th {...th} k="tip">TIP</Th>
                    <Th {...th} k="eval">Latest Eval</Th>
                    <Th {...th}>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => {
                    const next = nextGradeFor(s.rank, s.careerCategory)
                    const gate = next ? PROMOTION_GATES[next] : undefined
                    const eligible = isBoardEligible(s)
                    const stale = isStaleInPosition(s)
                    return (
                      <tr key={s.id} className={cn(i % 2 === 0 ? 'bg-white' : 'bg-gray-50', 'hover:bg-green-50')}>
                        <td className="border border-gray-200 px-2 py-1.5 font-medium whitespace-nowrap">
                          {s.lastName}, {s.firstName}
                          {source === 'demo' && (
                            <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-700 font-bold align-middle">DEMO</span>
                          )}
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5 font-bold whitespace-nowrap" title={s.rank}>
                          {rankLabel(s.rank)}
                          <span className="ml-1 font-mono text-[10px] font-normal text-gray-400">{s.rank}</span>
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5">{s.mos}</td>
                        <td className="border border-gray-200 px-2 py-1.5 text-xs">{s.componentStatus}</td>
                        <td className="border border-gray-200 px-2 py-1.5 text-xs" title={resolveUnitName(s.uic, nameMap)}>
                          {resolveUnitName(s.uic, nameMap).slice(0, 26)}
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5 text-xs" title={s.dutyTitle}>
                          {s.dutyTitle.slice(0, 30)}
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5 text-center">{s.yearsOfService}</td>
                        <td className={cn('border border-gray-200 px-2 py-1.5 text-center font-medium',
                          eligible && 'text-green-700')}
                          title={gate ? `${next} needs ${gate.minTig} yr TIG / ${gate.minTis} yr TIS` : ''}>
                          {s.timeInGrade}
                        </td>
                        <td className={cn('border border-gray-200 px-2 py-1.5 text-center font-medium',
                          stale && 'text-amber-700 font-bold')}>
                          {s.timeInPosition}
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5">
                          <span className={cn('text-xs px-1.5 py-0.5 rounded whitespace-nowrap', evalColor(s))}>
                            {evalLabel(s)}
                          </span>
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {eligible && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-800">Board</span>}
                            {stale && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Move</span>}
                            {s.flagged && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-800">Flag</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 text-xs text-gray-500 space-y-1">
            <p><strong>Board</strong> = meets the minimum time in grade and time in service gate for the next grade (AR 600-8-19 / AR 135-155 / NGR 600-101).</p>
            <p><strong>Move</strong> = {TIP_STALE_YEARS}+ years in the current position.</p>
          </div>
        </div>
      </div>
      <CommandPrintStyles />
    </div>
  )
}
