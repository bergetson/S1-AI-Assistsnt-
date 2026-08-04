'use client'

import { useMemo, useState } from 'react'
import { positions } from '@/lib/data/positions'
import { useCommandStore } from '@/lib/commandStore'
import { projectAttrition, projectPromotions, rosterInFormation } from '@/lib/forceAnalytics'
import { RETENTION_SOURCES } from '@/lib/data/retention'
import type { CareerCategory } from '@/lib/types'
import { rankLabel } from '@/lib/commandTypes'
import {
  ARMY_GREEN, CommandHeader, DemoBanner, DemoWatermark, FormationBar,
  CommandPrintStyles, NoFormation, useActiveRoster, useSeedFormation,
} from '@/components/command/CommandShell'
import { cn } from '@/lib/utils'

const BASE_YEAR = 2026
const CATEGORY_LABEL: Record<CareerCategory, string> = {
  Officer: 'Officer', Warrant: 'Warrant', Enlisted: 'Enlisted',
}

const REASON_COLOR: Record<string, string> = {
  'ETS': '#2563eb',
  'Retirement eligible (20 yr)': '#16a34a',
  'RCP (AGR)': '#d97706',
  'MRD (commissioned service)': '#7c3aed',
}

export default function CommandForecastPage() {
  useSeedFormation()
  const { selectedUics, horizonYears, setHorizon } = useCommandStore()
  const roster = useActiveRoster()
  const [expandedYear, setExpandedYear] = useState<number | null>(null)

  const people = useMemo(() => rosterInFormation(roster, selectedUics), [roster, selectedUics])
  const attrition = useMemo(
    () => projectAttrition(people, BASE_YEAR, horizonYears),
    [people, horizonYears]
  )
  const promotions = useMemo(
    () => projectPromotions(positions, roster, selectedUics, BASE_YEAR, horizonYears),
    [roster, selectedUics, horizonYears]
  )

  const maxLoss = Math.max(1, ...attrition.map(y => y.atRisk))
  const totalExpected = attrition.reduce((a, y) => a + y.expected, 0)
  const totalHard = attrition.reduce((a, y) => a + y.hard, 0)
  const totalAtRisk = attrition.reduce((a, y) => a + y.atRisk, 0)

  const byCategory = useMemo(() => {
    const cats: CareerCategory[] = ['Officer', 'Warrant', 'Enlisted']
    return cats
      .map(c => ({ category: c, rows: promotions.filter(p => p.category === c) }))
      .filter(g => g.rows.length > 0)
  }, [promotions])

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
        title="Attrition & Promotion Forecast"
        subtitle="Who is projected to leave, and how many promotions you need to generate to keep billets filled. This is the macro planning picture — how many 1LTs you must move to CPT, CPTs to MAJ, and so on."
        actions={
          <button onClick={() => window.print()}
            className="px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ backgroundColor: ARMY_GREEN }}>
            🖨️ Print Brief
          </button>
        }
      />

      {/* Horizon control */}
      <div className="px-8 py-4 bg-white border-b no-print">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold text-gray-600">Planning horizon:</span>
          {[2, 3, 5, 7, 10].map(y => (
            <button key={y} onClick={() => setHorizon(y)}
              className={cn('px-3 py-1.5 rounded-lg border font-medium transition',
                horizonYears === y
                  ? 'border-green-500 bg-green-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50')}>
              {y} yr
            </button>
          ))}
          <span className="text-gray-400 ml-2">
            Through {BASE_YEAR + horizonYears}
          </span>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* ── Attrition ── */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Projected losses</h2>
            <p className="text-sm text-gray-500 mb-4">
              Expect to lose about <strong>{totalExpected}</strong> of {people.length} soldiers by{' '}
              {BASE_YEAR + horizonYears}, of which <strong>{totalHard}</strong>{' '}
              {totalHard === 1 ? 'is' : 'are'} statutory and cannot be retained.
              {' '}{totalAtRisk} soldiers have some departure trigger in the window — an expiring contract is
              not a departure, so those are weighted by historical reenlistment rather than counted whole.
            </p>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-4 mb-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#dc2626' }} />
                  Statutory (RCP / MRD)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#22c55e' }} />
                  Expected (weighted)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm inline-block bg-gray-200" />
                  At risk
                </span>
              </div>
              <div className="flex items-end gap-3 h-44 mb-3">
                {attrition.map(y => {
                  const riskH = (y.atRisk / maxLoss) * 100
                  const expH = (y.expected / maxLoss) * 100
                  const hardH = (y.hard / maxLoss) * 100
                  return (
                    <button key={y.year}
                      onClick={() => setExpandedYear(expandedYear === y.year ? null : y.year)}
                      className="flex-1 flex flex-col items-center justify-end h-full group relative"
                      title={`${y.year}: ${y.expected} expected, ${y.hard} statutory, ${y.atRisk} at risk`}>
                      <span className="text-xs font-bold text-gray-700 mb-1">{y.expected}</span>
                      <div className="w-full relative rounded-t bg-gray-200 transition-all"
                        style={{ height: `${Math.max(2, riskH)}%` }}>
                        <div className="absolute bottom-0 left-0 right-0 rounded-t transition-all"
                          style={{
                            height: `${riskH === 0 ? 0 : (expH / riskH) * 100}%`,
                            backgroundColor: expandedYear === y.year ? '#15803d' : '#22c55e',
                          }} />
                        <div className="absolute bottom-0 left-0 right-0"
                          style={{
                            height: `${riskH === 0 ? 0 : (hardH / riskH) * 100}%`,
                            backgroundColor: '#dc2626',
                          }} />
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-3 border-t pt-2">
                {attrition.map(y => (
                  <div key={y.year} className="flex-1 text-center text-xs font-medium text-gray-500">{y.year}</div>
                ))}
              </div>

              {expandedYear != null && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="font-semibold text-sm text-gray-800 mb-2">
                    {expandedYear} — {attrition.find(y => y.year === expandedYear)?.atRisk ?? 0} soldiers at risk,{' '}
                    {attrition.find(y => y.year === expandedYear)?.expected ?? 0} expected to actually depart
                  </h3>
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-gray-100">
                        <tr>
                          {['Name', 'Grade', 'MOS', 'Comp', 'TIS', 'Trigger', 'Detail', 'Certainty'].map(h => (
                            <th key={h} className="border border-gray-300 px-2 py-1 text-left font-bold text-gray-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(attrition.find(y => y.year === expandedYear)?.departures ?? []).map(d => (
                          <tr key={d.soldier.id}>
                            <td className="border border-gray-200 px-2 py-1">{d.soldier.lastName}, {d.soldier.firstName}</td>
                            <td className="border border-gray-200 px-2 py-1 font-bold" title={d.soldier.rank}>{rankLabel(d.soldier.rank)}</td>
                            <td className="border border-gray-200 px-2 py-1">{d.soldier.mos}</td>
                            <td className="border border-gray-200 px-2 py-1">{d.soldier.componentStatus}</td>
                            <td className="border border-gray-200 px-2 py-1 text-center">{d.soldier.yearsOfService}</td>
                            <td className="border border-gray-200 px-2 py-1">
                              <span className="px-1.5 py-0.5 rounded text-white text-[10px] font-bold whitespace-nowrap"
                                style={{ backgroundColor: REASON_COLOR[d.reason] ?? '#6b7280' }}>
                                {d.reason}
                              </span>
                            </td>
                            <td className="border border-gray-200 px-2 py-1 text-gray-600">{d.detail}</td>
                            <td className="border border-gray-200 px-2 py-1 whitespace-nowrap">
                              <span className={cn('text-[10px] font-semibold',
                                d.certainty === 'date-certain' ? 'text-red-700' : 'text-gray-500')}>
                                {d.certainty === 'date-certain' ? 'DATE CERTAIN' : 'projected'}
                              </span>
                              <span className="text-[10px] text-gray-400 ml-1">
                                ({Math.round(d.weight * 100)}%)
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {expandedYear == null && (
                <p className="mt-3 text-xs text-gray-400 no-print">Click a bar to see who is departing that year.</p>
              )}
            </div>

            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
              <strong>Retention limits are draft values and need S1 verification.</strong> RCP binds AGR and
              Technician soldiers only — it does not apply to M-Day/TPU, who are governed by NGR 600-200
              criteria and the age-60 removal date. Officer removal is date-certain only at LTC (28 yr) and
              COL (30 yr) commissioned service under 10 USC 14507; below that, separation follows failure of
              selection, so it is shown as projected rather than certain.
              <div className="mt-1.5 text-amber-800">
                Basis: {RETENTION_SOURCES.join(' · ')}
              </div>
            </div>
          </section>

          {/* ── Promotion requirement ── */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Promotion requirement</h2>
            <p className="text-sm text-gray-500 mb-4">
              Billets you must fill at each grade through {BASE_YEAR + horizonYears}, against the people who
              will actually be eligible to fill them.
            </p>

            {byCategory.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
                No grade transitions to plan in this formation.
              </div>
            ) : (
              <div className="space-y-6">
                {byCategory.map(group => (
                  <div key={group.category}>
                    <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide mb-2">
                      {CATEGORY_LABEL[group.category]}
                    </h3>
                    <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
                      <table className="w-full text-sm border-collapse">
                        <thead className="bg-gray-100">
                          <tr>
                            {[
                              ['Transition', 'Grade move being planned'],
                              ['Auth', 'Authorized billets at the target grade'],
                              ['Filled', 'Currently assigned at the target grade'],
                              ['Losses', 'Projected departures from the target grade in the window'],
                              ['Need', 'Promotions required = open billets + projected losses'],
                              ['Feeder', 'Soldiers at the grade below'],
                              ['Eligible', 'Feeder soldiers who will meet the TIG/TIS gate by the horizon'],
                              ['Result', ''],
                            ].map(([h, title]) => (
                              <th key={h} title={title}
                                className="border border-gray-300 px-2 py-1.5 text-left font-bold text-gray-600 text-xs">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((p, i) => (
                            <tr key={`${p.fromGrade}-${p.toGrade}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="border border-gray-200 px-2 py-1.5 font-bold whitespace-nowrap">
                                {rankLabel(p.fromGrade)} → {rankLabel(p.toGrade)}
                                <span className="ml-1.5 font-mono text-xs font-normal text-gray-400">
                                  {p.fromGrade}/{p.toGrade}
                                </span>
                              </td>
                              <td className="border border-gray-200 px-2 py-1.5 text-center">{p.authorizedAtTarget}</td>
                              <td className="border border-gray-200 px-2 py-1.5 text-center">{p.filledAtTarget}</td>
                              <td className="border border-gray-200 px-2 py-1.5 text-center text-red-700">{p.projectedLosses}</td>
                              <td className="border border-gray-200 px-2 py-1.5 text-center font-bold">{p.promotionsNeeded}</td>
                              <td className="border border-gray-200 px-2 py-1.5 text-center">{p.feederStrength}</td>
                              <td className="border border-gray-200 px-2 py-1.5 text-center">
                                {p.eligibleByHorizon}
                                {p.eligibleNow !== p.eligibleByHorizon && (
                                  <span className="text-xs text-gray-400"> ({p.eligibleNow} now)</span>
                                )}
                              </td>
                              <td className="border border-gray-200 px-2 py-1.5">
                                {p.promotionsNeeded === 0 ? (
                                  <span className="text-xs text-gray-400">no requirement</span>
                                ) : p.accessionDriven ? (
                                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-800"
                                    title="No billets or people at the feeder grade in this formation — fill by accession or lateral transfer, not internal promotion.">
                                    ACCESSION ×{p.promotionsNeeded}
                                  </span>
                                ) : p.gap > 0 ? (
                                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                                    SHORT {p.gap}
                                  </span>
                                ) : (
                                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-800">
                                    covered
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
              <strong>How to read this:</strong> &ldquo;Need&rdquo; is open billets plus projected losses at the target grade.
              &ldquo;Eligible&rdquo; counts feeder-grade soldiers who will clear the minimum time-in-grade and
              time-in-service gate by {BASE_YEAR + horizonYears}, excluding anyone flagged. A shortfall means you
              cannot fill those billets from inside this formation — the options are lateral transfer from
              another unit, accepting risk in specific billets, or building the feeder grade now through
              recruiting and retention.
            </div>
          </section>
        </div>
      </div>
      <CommandPrintStyles />
    </div>
  )
}
