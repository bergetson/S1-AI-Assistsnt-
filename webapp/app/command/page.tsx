'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { positions } from '@/lib/data/positions'
import { useCommandStore } from '@/lib/commandStore'
import {
  buildUnitFamilies, computeManning, summarizeForce, projectAttrition,
  projectPromotions, rosterInFormation, hasServiceDates, isStaleInPosition, TIP_STALE_YEARS,
} from '@/lib/forceAnalytics'
import {
  ARMY_GREEN, CommandHeader, RosterSourceBanner, RosterSourceWatermark, FormationBar,
  CommandPrintStyles, useActiveRoster, useSeedFormation, useHydrated,
} from '@/components/command/CommandShell'
import { ActionFeed } from '@/components/shared/ActionFeed'
import { SoldierDrawer, useSoldierDrawer } from '@/components/shared/SoldierDrawer'
import { buildActions } from '@/lib/actions/build'
import { actionsForRole } from '@/lib/actions/types'
import { useForceData, AS_OF } from '@/components/shared/useForceData'
import { useMarketplaceStore } from '@/lib/marketplaceStore'
import { cn } from '@/lib/utils'
import { BASE_YEAR } from '@/components/shared/useForceData'


function Stat({ label, value, tone = 'default', hint, onClick }: {
  label: string; value: string | number
  tone?: 'default' | 'good' | 'warn' | 'bad'
  hint?: string
  onClick?: () => void
}) {
  const color =
    tone === 'good' ? 'text-green-700' :
    tone === 'warn' ? 'text-amber-600' :
    tone === 'bad' ? 'text-red-700' : 'text-gray-900'
  const body = (
    <>
      <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
    </>
  )
  const cls = 'bg-white rounded-lg px-4 py-3 shadow-sm border text-center w-full'
  return onClick
    ? <button onClick={onClick} className={cn(cls, 'hover:shadow-md hover:border-green-400 transition cursor-pointer')}
        title="See these soldiers">{body}</button>
    : <div className={cls}>{body}</div>
}

/** Authorized-vs-assigned bar. Hand-rolled to match the app's existing ScoreBar. */
function FillBar({ authorized, assigned }: { authorized: number; assigned: number }) {
  const pct = authorized === 0 ? 0 : Math.min(100, (assigned / authorized) * 100)
  const over = assigned > authorized
  const color = over ? '#C8A96E' : pct >= 90 ? '#16a34a' : pct >= 75 ? '#2563eb' : pct >= 60 ? '#d97706' : '#dc2626'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden min-w-[80px]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold w-20 text-right" style={{ color }}>
        {assigned}/{authorized}
      </span>
    </div>
  )
}

export default function CommandOverviewPage() {
  useSeedFormation()
  const hydrated = useHydrated()
  const { selectedUics, setSelectedUics, toggleUic, clearFormation, horizonYears, source } = useCommandStore()
  const roster = useActiveRoster()
  const [search, setSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const drawer = useSoldierDrawer()

  const families = useMemo(() => buildUnitFamilies(positions, roster), [roster])
  const summary = useMemo(() => summarizeForce(positions, roster, selectedUics), [roster, selectedUics])
  const manning = useMemo(() => computeManning(positions, roster, selectedUics), [roster, selectedUics])
  const inFormation = useMemo(() => rosterInFormation(roster, selectedUics), [roster, selectedUics])
  const attrition = useMemo(
    () => projectAttrition(inFormation, BASE_YEAR, horizonYears),
    [inFormation, horizonYears]
  )
  const promotions = useMemo(
    () => projectPromotions(positions, roster, selectedUics, BASE_YEAR, horizonYears),
    [roster, selectedUics, horizonYears]
  )

  const { civilianProfiles } = useForceData()
  const { applications } = useMarketplaceStore()
  const actions = useMemo(
    () => actionsForRole(buildActions({
      positions, roster, uics: selectedUics, civilian: civilianProfiles,
      applications, baseYear: BASE_YEAR, asOfIso: AS_OF,
    }), 'commander'),
    [roster, selectedUics, civilianProfiles, applications]
  )

  const filteredFamilies = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return families
    return families.filter(f =>
      f.name.toLowerCase().includes(q) || f.uics.some(u => u.toLowerCase().includes(q)))
  }, [families, search])

  const totalDepartures = attrition.reduce((a, y) => a + y.expected, 0)
  const hardDepartures = attrition.reduce((a, y) => a + y.hard, 0)
  // Accession-driven rows aren't promotion shortfalls — there's no feeder grade
  // in the formation to promote from, so surfacing them here is a false alarm.
  const shortfalls = promotions.filter(p => p.gap > 0 && !p.accessionDriven && !p.eligibilityUnknown)
  // When nobody in the formation has DOR/PEBD, promotion eligibility cannot be
  // computed at all. Saying "0 eligible" would invent a crisis from a missing column.
  const serviceDatesMissing = inFormation.length > 0 && !inFormation.some(hasServiceDates)
  const accessionNeeds = promotions.filter(p => p.accessionDriven && p.promotionsNeeded > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <RosterSourceWatermark />
      <RosterSourceBanner />
      <FormationBar />
      <CommandHeader
        title="Commander View"
        subtitle="Force management for your formation — manning, time in grade and position, projected losses, promotion requirements, and succession planning."
        actions={
          <>
            <Link href="/command/forecast" className="px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ backgroundColor: ARMY_GREEN }}>
              View Forecast →
            </Link>
          </>
        }
      />

      <div className="px-8 py-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* ── Unit selection ── */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <button
              onClick={() => setShowPicker(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <div>
                <h2 className="font-bold text-gray-900">Your Formation</h2>
                <p className="text-sm text-gray-500">
                  {selectedUics.length === 0
                    ? 'No units selected'
                    : `${selectedUics.length} unit${selectedUics.length === 1 ? '' : 's'} · ${summary.authorized} authorized billets`}
                </p>
              </div>
              <span className="text-gray-400 text-sm">{showPicker ? '▲ Hide' : '▼ Change units'}</span>
            </button>

            {showPicker && (
              <div className="px-5 pb-5 border-t pt-4">
                <div className="flex flex-wrap gap-3 items-center mb-4">
                  <input
                    type="search" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search units or UIC…"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700 w-64"
                  />
                  <button
                    onClick={() => setSelectedUics(families.flatMap(f => f.uics))}
                    className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium"
                  >
                    Select all (statewide)
                  </button>
                  <button
                    onClick={clearFormation}
                    className="text-sm text-gray-500 hover:text-red-600 underline"
                  >
                    Clear
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                  {filteredFamilies.map(fam => {
                    const allSelected = fam.uics.every(u => selectedUics.includes(u))
                    const someSelected = fam.uics.some(u => selectedUics.includes(u))
                    return (
                      <div
                        key={fam.key}
                        className={cn('rounded-lg border p-3 transition',
                          allSelected ? 'border-green-400 bg-green-50'
                          : someSelected ? 'border-green-200 bg-green-50/40'
                          : 'border-gray-200 bg-white hover:bg-gray-50')}
                      >
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                            onChange={() => {
                              if (allSelected) setSelectedUics(selectedUics.filter(u => !fam.uics.includes(u)))
                              else setSelectedUics([...new Set([...selectedUics, ...fam.uics])])
                            }}
                            className="mt-0.5 accent-green-700"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold text-sm text-gray-900">{fam.name}</span>
                            <span className="block text-xs text-gray-500">
                              {fam.uics.length} unit{fam.uics.length === 1 ? '' : 's'} · {fam.authorized} authorized · {fam.assigned} assigned
                            </span>
                          </span>
                        </label>
                        {fam.uics.length > 1 && (
                          <div className="mt-2 pl-6 flex flex-wrap gap-1.5">
                            {fam.uics.map(u => (
                              <button
                                key={u}
                                onClick={() => toggleUic(u)}
                                className={cn('text-xs px-2 py-0.5 rounded border font-mono',
                                  selectedUics.includes(u)
                                    ? 'border-green-500 bg-green-600 text-white'
                                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-100')}
                              >
                                {u}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          {selectedUics.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-600">
              Select at least one unit above to see your force.
            </div>
          ) : (
            <>
              {/* Answers first. The numbers below are supporting detail. */}
              {hydrated && (
                <ActionFeed
                  items={actions}
                  onShowSoldiers={item => {
                    const ids = new Set(item.soldierIds ?? [])
                    drawer.open(item.headline, inFormation.filter(s => ids.has(s.id)))
                  }}
                />
              )}

              {/* ── Headline stats ── */}
              <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <Stat label="Assigned" value={hydrated ? summary.assigned : '—'} />
                <Stat label="Authorized" value={summary.authorized} />
                <Stat
                  label="Fill Rate" value={`${summary.fillPct}%`}
                  tone={summary.fillPct >= 90 ? 'good' : summary.fillPct >= 75 ? 'default' : 'warn'}
                />
                <Stat label="Officers" value={summary.officers} hint={`${summary.warrants} warrant`}
                  onClick={() => drawer.open('Officers', inFormation.filter(s => s.careerCategory === 'Officer'))} />
                <Stat label="Enlisted" value={summary.enlisted}
                  onClick={() => drawer.open('Enlisted', inFormation.filter(s => s.careerCategory === 'Enlisted'))} />
                <Stat label="AGR" value={summary.agr} hint={`${summary.mday} M-Day`}
                  onClick={() => drawer.open('AGR soldiers', inFormation.filter(s => s.componentStatus === 'AGR'))} />
                <Stat
                  label="Not MOS-qualified" value={summary.flagged}
                  onClick={() => drawer.open('Not MOS-qualified', inFormation.filter(s => s.flagged))}
                  tone={summary.flagged > 0 ? 'warn' : 'good'}
                />
              </section>

              {/* ── Attention items ── */}
              <section className="grid md:grid-cols-3 gap-4">
                <Link href="/command/roster" className="rounded-xl border border-blue-200 bg-blue-50 p-4 hover:shadow-md transition block">
                  <div className="text-3xl font-bold text-blue-800">
                    {serviceDatesMissing ? 'Unknown' : summary.boardEligible}
                  </div>
                  <div className="font-semibold text-blue-900 text-sm mt-1">Board eligible now</div>
                  <p className="text-xs text-blue-700 mt-1">
                    {serviceDatesMissing
                      ? 'Cannot be computed — this roster has no date of rank or PEBD. Add those two columns and this fills in.'
                      : 'Meet minimum TIG and TIS for their next grade. Review packets and senior rater support.'}
                  </p>
                </Link>
                <button onClick={() => drawer.open(
                  `${TIP_STALE_YEARS}+ years in position`,
                  inFormation.filter(isStaleInPosition),
                  'Due for a move')}
                  className="rounded-xl border border-amber-200 bg-amber-50 p-4 hover:shadow-md transition block text-left w-full">
                  <div className="text-3xl font-bold text-amber-700">{summary.staleInPosition}</div>
                  <div className="font-semibold text-amber-900 text-sm mt-1">3+ years in position</div>
                  <p className="text-xs text-amber-800 mt-1">
                    Due for a move. Stale assignments limit development and stall the whole bench behind them.
                  </p>
                </button>
                <Link href="/command/forecast" className="rounded-xl border border-red-200 bg-red-50 p-4 hover:shadow-md transition block">
                  <div className="text-3xl font-bold text-red-700">{totalDepartures}</div>
                  <div className="font-semibold text-red-900 text-sm mt-1">
                    Expected losses by {BASE_YEAR + horizonYears}
                  </div>
                  <p className="text-xs text-red-800 mt-1">
                    {hardDepartures} statutory (RCP / MRD) and cannot be retained. The rest weights expiring
                    contracts and retirement eligibility by historical take-rates.
                  </p>
                </Link>
              </section>

              {/* ── Promotion shortfalls ── */}
              {serviceDatesMissing && (
                <section className="rounded-xl border-l-4 border-blue-500 bg-white border border-gray-200 p-5 shadow-sm">
                  <h2 className="font-bold text-gray-900 mb-1">Promotion planning needs two more columns</h2>
                  <p className="text-sm text-gray-600">
                    This roster has no <strong>date of rank</strong> and no <strong>PEBD</strong>, so time in
                    grade and time in service are unknown. Board eligibility, the promotion requirement, and
                    retention control points all depend on them and are shown as <em>Unknown</em> rather than
                    guessed.
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Everything else on this page — manning, assignments, time in position, expected losses
                    from expiring contracts — is computed from real data and is accurate.
                  </p>
                </section>
              )}

              {shortfalls.length > 0 && (
                <section className="rounded-xl border-l-4 border-red-500 bg-white border border-gray-200 p-5 shadow-sm">
                  <h2 className="font-bold text-gray-900 mb-1">Promotion shortfalls in the next {horizonYears} years</h2>
                  <p className="text-sm text-gray-500 mb-3">
                    Billets you need to fill exceed the people who will be eligible to fill them.
                  </p>
                  <div className="space-y-2">
                    {shortfalls.slice(0, 5).map(p => (
                      <div key={`${p.category}-${p.fromGrade}`} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-mono font-bold bg-gray-100 px-2 py-0.5 rounded">
                          {p.fromGrade}→{p.toGrade}
                        </span>
                        <span className="text-gray-700">
                          need <strong>{p.promotionsNeeded}</strong>, only <strong>{p.eligibleByHorizon}</strong> eligible
                        </span>
                        <span className="text-red-700 font-bold">short {p.gap}</span>
                      </div>
                    ))}
                  </div>
                  <Link href="/command/forecast" className="inline-block mt-3 text-sm underline text-green-700 font-medium">
                    See the full forecast →
                  </Link>
                </section>
              )}

              {accessionNeeds.length > 0 && (
                <section className="rounded-xl border-l-4 border-violet-500 bg-white border border-gray-200 p-5 shadow-sm">
                  <h2 className="font-bold text-gray-900 mb-1">Fill by accession or lateral transfer</h2>
                  <p className="text-sm text-gray-500 mb-3">
                    These grades have no feeder pool inside your formation — you cannot promote into them
                    from within. They are filled by OCS/ROTC accession, direct appointment, or moving someone
                    in from another unit.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {accessionNeeds.map(p => (
                      <span key={`${p.category}-${p.toGrade}`}
                        className="text-sm px-2.5 py-1 rounded bg-violet-50 border border-violet-200 text-violet-900">
                        <strong>{p.promotionsNeeded}</strong> × {p.toGrade}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Manning by grade ── */}
              <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-bold text-gray-900 mb-3">Manning by grade</h2>
                {manning.byGrade.length === 0 ? (
                  <p className="text-sm text-gray-400">No billets in this formation.</p>
                ) : (
                  <div className="space-y-1.5">
                    {manning.byGrade.map(row => (
                      <button
                        key={row.key}
                        onClick={() => drawer.open(
                          `${row.key} in your formation`,
                          inFormation.filter(s => s.rank === row.key),
                          `${row.assigned} assigned against ${row.authorized} authorized`)}
                        className="w-full flex items-center gap-3 text-sm hover:bg-gray-50 rounded px-1 py-0.5 text-left"
                        title={`See the ${row.assigned} soldiers at ${row.key}`}
                      >
                        <span className="font-mono font-bold text-gray-700 w-10">{row.key}</span>
                        <div className="flex-1"><FillBar authorized={row.authorized} assigned={row.assigned} /></div>
                        <span className={cn('text-xs font-medium w-24 text-right',
                          row.delta < 0 ? 'text-red-600' : row.delta > 0 ? 'text-amber-600' : 'text-gray-400')}>
                          {row.delta === 0 ? 'on strength' : row.delta < 0 ? `short ${-row.delta}` : `over ${row.delta}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {manning.unmatchedSoldiers > 0 && source === 'imported' && (
                  <p className="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                    ⚠ {manning.unmatchedSoldiers} imported soldier{manning.unmatchedSoldiers === 1 ? ' has a UIC' : 's have UICs'} not
                    found in the MTARNG force structure file — they are excluded from all manning math.
                  </p>
                )}
              </section>

              <p className="text-xs text-gray-400">
                Timing estimates use AR 600-8-19, AR 135-155, and NGR 600-101 promotion gates and draft retention
                limits. Verify against current policy with your S1 before making personnel decisions.
              </p>
            </>
          )}
        </div>
      </div>
      <CommandPrintStyles />
      <SoldierDrawer request={drawer.request} onClose={drawer.close} baseYear={BASE_YEAR} />
    </div>
  )
}
