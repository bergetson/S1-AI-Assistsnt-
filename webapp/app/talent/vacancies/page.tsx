'use client'

import { useMemo, useState } from 'react'
import { useForceData, BASE_YEAR } from '@/components/shared/useForceData'
import { vacantBillets, buildUnitNameMap, resolveUnitName, rankCandidates, earliestDeparture, rosterInFormation } from '@/lib/forceAnalytics'
import { countyForCity } from '@/lib/communityImpact/types'
import { rankLabel, soldierLabel } from '@/lib/commandTypes'
import { PrototypeNotice, DemoPill } from '@/components/shared/Badges'
import { downloadCsv } from '@/lib/exports'
import { cn } from '@/lib/utils'

const GREEN = '#1B4F2A'
const sel = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700'
const lbl = 'block text-xs font-semibold text-gray-500 uppercase mb-1'

/** Prototype workflow states. These never mirror an official personnel system. */
const VACANCY_STATES = ['Draft', 'Validating', 'Published', 'Under Review', 'Selection Pending', 'Filled', 'Cancelled'] as const
type VacancyState = typeof VACANCY_STATES[number]

export default function VacanciesPage() {
  const { positions, roster, isDemo } = useForceData()
  const [grade, setGrade] = useState('')
  const [bn, setBn] = useState('')
  const [criticalOnly, setCriticalOnly] = useState(false)
  const [states, setStates] = useState<Record<number, VacancyState>>({})
  const [expanded, setExpanded] = useState<number | null>(null)

  const nameMap = useMemo(() => buildUnitNameMap(positions), [positions])
  const allUics = useMemo(() => [...new Set(positions.map(p => p.uic).filter(Boolean) as string[])], [positions])

  const vacancies = useMemo(() => {
    let v = vacantBillets(positions, roster, allUics).filter(p => p.authorized !== false)
    if (grade) v = v.filter(p => p.grade === grade)
    if (bn) v = v.filter(p => p.bn === bn)
    if (criticalOnly) v = v.filter(p => p.isCommandOrKD)
    return v.sort((a, b) => Number(b.isCommandOrKD) - Number(a.isCommandOrKD) || a.id - b.id)
  }, [positions, roster, allUics, grade, bn, criticalOnly])

  // Projected vacancies: filled billets whose incumbent is projected to depart.
  const projected = useMemo(() => {
    const out: Array<{ pos: typeof positions[number]; year: number; reason: string }> = []
    for (const s of rosterInFormation(roster, allUics)) {
      if (s.positionId == null) continue
      const d = earliestDeparture(s, BASE_YEAR, 3)
      if (!d) continue
      const pos = positions.find(p => p.id === s.positionId)
      if (pos && pos.authorized !== false) out.push({ pos, year: d.year, reason: d.reason })
    }
    return out.sort((a, b) => a.year - b.year).slice(0, 100)
  }, [roster, positions, allUics])

  const grades = useMemo(() => [...new Set(vacancies.map(v => v.grade))].sort(), [vacancies])
  const bns = useMemo(() => [...new Set(positions.map(p => p.bn).filter(Boolean) as string[])].sort(), [positions])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-[1400px] mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GREEN }}>
              Vacancy Management {isDemo && <DemoPill />}
            </h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              Current and projected vacancies with candidate depth. Vacancy is derived from who is actually
              assigned, not from a stale status field.
            </p>
          </div>
          <button onClick={() => downloadCsv('vacancy-report.csv',
            ['Billet', 'Grade', 'MOS', 'Unit', 'City', 'County', 'Command/KD', 'Prototype status', 'Eligible candidates'],
            vacancies.map(v => [
              v.dutyTitle, v.grade, v.mos, resolveUnitName(v.uic ?? '', nameMap), v.city,
              countyForCity(v.city) ?? '', v.isCommandOrKD ? 'Yes' : 'No',
              states[v.id] ?? 'Draft',
              String(rankCandidates(roster, v, 25).filter(c => c.blockers.length === 0).length),
            ]),
            `${isDemo ? 'DEMO DATA. ' : ''}Prototype statuses do not update any official personnel system.`)}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: GREEN }}>
            ⬇ Export vacancies
          </button>
        </div>
      </div>

      <div className="px-8 py-4 bg-white border-b">
        <div className="max-w-[1400px] mx-auto flex flex-wrap gap-3 items-end">
          <div><label className={lbl} htmlFor="g">Grade</label>
            <select id="g" className={sel} value={grade} onChange={e => setGrade(e.target.value)}>
              <option value="">All</option>{grades.map(g => <option key={g}>{g}</option>)}
            </select></div>
          <div><label className={lbl} htmlFor="b">Battalion</label>
            <select id="b" className={sel} value={bn} onChange={e => setBn(e.target.value)}>
              <option value="">All</option>{bns.map(b => <option key={b}>{b}</option>)}
            </select></div>
          <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
            <input type="checkbox" className="accent-green-700" checked={criticalOnly}
              onChange={e => setCriticalOnly(e.target.checked)} />
            Command / KD only
          </label>
          <span className="text-sm text-gray-500 pb-2 ml-auto">{vacancies.length} open vacancies</span>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="max-w-[1400px] mx-auto space-y-5">
          <section className="space-y-2">
            {vacancies.slice(0, 60).map(v => {
              const candidates = rankCandidates(roster, v, 25)
              const eligible = candidates.filter(c => c.blockers.length === 0)
              const readyNow = eligible.filter(c => c.readiness === 'Ready now')
              const open = expanded === v.id
              return (
                <article key={v.id} className={cn('bg-white rounded-xl border p-4 shadow-sm',
                  v.isCommandOrKD && 'border-l-4 border-l-red-500')}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900">
                        {v.dutyTitle} <span className="text-sm font-normal text-gray-500">({rankLabel(v.grade)} · {v.mos})</span>
                        {v.isCommandOrKD && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-red-100 text-red-800">Command/KD</span>}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {resolveUnitName(v.uic ?? '', nameMap)} · {v.city}
                        {countyForCity(v.city) && ` (${countyForCity(v.city)} County)`} · {v.statusType}
                      </p>
                      <div className="flex gap-3 mt-2 text-xs">
                        <span className={cn('font-semibold', readyNow.length === 0 ? 'text-red-700' : 'text-green-700')}>
                          {readyNow.length} ready now
                        </span>
                        <span className="text-gray-600">{eligible.length} eligible</span>
                        <span className="text-gray-400">{candidates.length} considered</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select value={states[v.id] ?? 'Draft'} aria-label={`Prototype status for ${v.dutyTitle}`}
                        onChange={e => setStates(s => ({ ...s, [v.id]: e.target.value as VacancyState }))}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white">
                        {VACANCY_STATES.map(s => <option key={s}>{s}</option>)}
                      </select>
                      <button onClick={() => setExpanded(open ? null : v.id)}
                        className="text-xs text-blue-700 underline">{open ? 'Hide' : 'Candidates'}</button>
                    </div>
                  </div>

                  {open && (
                    <div className="mt-3 pt-3 border-t">
                      {eligible.length === 0 ? (
                        <p className="text-sm text-red-800">
                          No eligible internal candidates. This billet requires lateral transfer or accession.
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {eligible.slice(0, 8).map((c, i) => (
                            <li key={c.soldier.id} className="flex items-center justify-between text-xs border-b border-gray-100 py-1">
                              <span className="text-gray-700">
                                {i + 1}. {soldierLabel(c.soldier)} — {rankLabel(c.soldier.rank)} {c.soldier.mos} · {c.soldier.unitName}
                              </span>
                              <span className="font-bold whitespace-nowrap ml-2">{c.score}/100 · {c.readiness}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
            {vacancies.length > 60 && (
              <p className="text-sm text-gray-500 text-center">Showing 60 of {vacancies.length}. Export for the full list.</p>
            )}
          </section>

          <section className="bg-white rounded-xl border p-4 shadow-sm">
            <h2 className="font-bold text-gray-900 text-sm mb-2">
              Projected vacancies (next 3 years) — {projected.length}
            </h2>
            <p className="text-xs text-gray-500 mb-2">
              Filled billets whose incumbent has a projected departure. Weighted triggers such as an
              expiring contract are possibilities, not certainties.
            </p>
            <table className="w-full text-xs">
              <thead className="text-gray-500 border-b">
                <tr><th className="text-left py-1">Billet</th><th className="text-left">Unit</th>
                  <th className="text-left">Trigger</th><th className="text-right">Year</th></tr>
              </thead>
              <tbody>
                {projected.slice(0, 25).map((p, i) => (
                  <tr key={`${p.pos.id}-${i}`} className="border-b border-gray-100">
                    <td className="py-1">{p.pos.dutyTitle} ({p.pos.grade})</td>
                    <td className="text-gray-500 truncate max-w-[200px]">{resolveUnitName(p.pos.uic ?? '', nameMap)}</td>
                    <td className="text-gray-600">{p.reason}</td>
                    <td className="text-right font-semibold">{p.year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            Changing a prototype vacancy status here records a demonstration workflow state only. It does not
            create, publish, or modify a requisition in any Army personnel system.
          </p>
          <PrototypeNotice />
        </div>
      </div>
    </div>
  )
}
