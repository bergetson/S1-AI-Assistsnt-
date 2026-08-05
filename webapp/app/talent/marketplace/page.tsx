'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useForceData, AS_OF } from '@/components/shared/useForceData'
import { useMarketplaceStore } from '@/lib/marketplaceStore'
import { buildSlate } from '@/lib/marketplace/workflow'
import type { ApplicationStatus } from '@/lib/marketplace/types'
import { STATUS_FLOW } from '@/lib/marketplace/types'
import { rankCandidates } from '@/lib/forceAnalytics'
import { PrototypeNotice } from '@/components/shared/Badges'
import { downloadCsv } from '@/lib/exports'
import { cn } from '@/lib/utils'

const GREEN = '#1B4F2A'

export default function TalentMarketplacePage() {
  const { positions, roster } = useForceData()
  const { cycles, applications, move, patchApplication, endorse, lastError, clearError } = useMarketplaceStore()
  const [selectedPos, setSelectedPos] = useState<number | null>(null)

  const byPosition = useMemo(() => {
    const m = new Map<number, number>()
    for (const a of applications) if (a.status !== 'Withdrawn') m.set(a.positionId, (m.get(a.positionId) ?? 0) + 1)
    return [...m.entries()].map(([positionId, count]) => ({ positionId, count }))
      .sort((a, b) => b.count - a.count)
  }, [applications])

  const slate = useMemo(
    () => selectedPos == null ? [] : buildSlate(applications, selectedPos),
    [applications, selectedPos])

  const targetPos = positions.find(p => p.id === selectedPos)
  const deterministic = useMemo(
    () => targetPos ? rankCandidates(roster, targetPos, 10) : [],
    [roster, targetPos])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-[1400px] mx-auto">
          <h1 className="text-2xl font-bold" style={{ color: GREEN }}>Marketplace Review</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Review applications, compare candidate slates, and record prototype outcomes. Changing a status
            here does not update any official personnel system.
          </p>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="max-w-[1400px] mx-auto space-y-5">
          {lastError && (
            <div role="alert" className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 flex justify-between">
              <span>{lastError}</span><button onClick={clearError} className="underline">Dismiss</button>
            </div>
          )}

          <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(['Interested', 'Applied', 'Commander Review', 'Talent Manager Review', 'Selected'] as ApplicationStatus[]).map(s => (
              <div key={s} className="bg-white rounded-lg px-4 py-3 shadow-sm border text-center">
                <div className="text-xs text-gray-500 mb-1">{s}</div>
                <div className="text-2xl font-bold text-gray-900">
                  {applications.filter(a => a.status === s).length}
                </div>
              </div>
            ))}
          </section>

          {cycles.length === 0 || applications.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-600">
              No applications yet.{' '}
              <Link href="/marketplace" className="underline text-green-700">
                Open the soldier marketplace
              </Link>{' '}
              and express interest in a billet to walk the workflow end to end.
            </div>
          ) : (
            <section className="grid lg:grid-cols-[320px_1fr] gap-5">
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <h2 className="font-bold text-gray-900 text-sm mb-2">Billets with applicants</h2>
                <ul className="space-y-1">
                  {byPosition.map(({ positionId, count }) => {
                    const p = positions.find(x => x.id === positionId)
                    return (
                      <li key={positionId}>
                        <button onClick={() => setSelectedPos(positionId)}
                          className={cn('w-full text-left rounded-lg border p-2 text-sm transition',
                            selectedPos === positionId ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:bg-gray-50')}>
                          <span className="block font-medium text-gray-900 truncate">{p?.dutyTitle ?? positionId}</span>
                          <span className="block text-xs text-gray-500">
                            {p?.grade} · {p?.city} · {count} applicant{count === 1 ? '' : 's'}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="space-y-4">
                {!targetPos ? (
                  <p className="text-gray-500">Select a billet to review its candidate slate.</p>
                ) : (
                  <>
                    <div className="bg-white rounded-xl border p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <h2 className="font-bold text-gray-900">{targetPos.dutyTitle}</h2>
                          <p className="text-sm text-gray-500">
                            {targetPos.grade} · {targetPos.mos} · {targetPos.unit} · {targetPos.city}
                          </p>
                        </div>
                        <button onClick={() => downloadCsv(`slate-${targetPos.id}.csv`,
                          ['Application', 'Soldier', 'Status', 'Preference rank', 'Endorsed', 'Statement'],
                          slate.map(s => [s.application.id, s.application.soldierId, s.application.status,
                            String(s.preferenceRank ?? ''), s.endorsed ? 'Yes' : 'No',
                            s.application.statementOfInterest ?? '']),
                          'Prototype candidate slate — not a selection authority')}
                          className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">
                          ⬇ Export slate
                        </button>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border p-4 shadow-sm">
                      <h3 className="font-bold text-gray-900 text-sm mb-2">Applicants ({slate.length})</h3>
                      {slate.length === 0 ? <p className="text-sm text-gray-400">No applicants.</p> : (
                        <ul className="space-y-3">
                          {slate.map(s => {
                            const a = s.application
                            const next = STATUS_FLOW[a.status]
                            return (
                              <li key={a.id} className="rounded-lg border border-gray-200 p-3">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                  <div className="min-w-0">
                                    <div className="font-medium text-gray-900 text-sm">
                                      {a.soldierId === 'self' ? 'You (soldier view)' : a.soldierId}
                                      {s.endorsed && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-green-100 text-green-800">Endorsed</span>}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      {a.history.map(h => h.status).join(' → ')}
                                    </div>
                                    {a.statementOfInterest && (
                                      <p className="text-xs text-gray-700 mt-1 italic">&ldquo;{a.statementOfInterest}&rdquo;</p>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 items-center">
                                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">{a.status}</span>
                                    {next.filter(n => n !== 'Withdrawn').map(n => (
                                      <button key={n} onClick={() => move(a.id, n, AS_OF)}
                                        className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50">
                                        → {n}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 items-center">
                                  {!a.endorsement && (
                                    <button onClick={() => endorse(a.id, { decision: 'Endorsed', at: AS_OF, successionImpact: 'Manageable' })}
                                      className="text-xs px-2 py-1 rounded text-white" style={{ backgroundColor: GREEN }}>
                                      Commander: endorse
                                    </button>
                                  )}
                                  {a.status === 'Not Selected' && !a.developmentFeedback && (
                                    <button onClick={() => patchApplication(a.id, {
                                      developmentFeedback: 'Continue building time in grade and complete the next level of PME; reapply next cycle.' })}
                                      className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50">
                                      Add development feedback
                                    </button>
                                  )}
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="bg-white rounded-xl border p-4 shadow-sm">
                      <h3 className="font-bold text-gray-900 text-sm mb-1">Deterministic candidate ranking</h3>
                      <p className="text-xs text-gray-500 mb-2">
                        Computed from the roster independently of who applied — useful for spotting strong
                        candidates who did not put in for the billet.
                      </p>
                      <ul className="space-y-1">
                        {deterministic.slice(0, 6).map((c, i) => (
                          <li key={c.soldier.id} className="flex items-center justify-between text-xs border-b border-gray-100 py-1">
                            <span className="text-gray-700">
                              {i + 1}. {c.soldier.lastName}, {c.soldier.firstName} — {c.soldier.rank} {c.soldier.mos}
                            </span>
                            <span className="font-bold">{c.score}/100 · {c.readiness}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          <PrototypeNotice />
        </div>
      </div>
    </div>
  )
}
