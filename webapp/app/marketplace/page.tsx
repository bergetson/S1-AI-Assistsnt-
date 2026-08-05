'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useForceData, AS_OF } from '@/components/shared/useForceData'
import { useProfileStore } from '@/lib/store'
import { useMarketplaceStore } from '@/lib/marketplaceStore'
import { buildDemoCycle } from '@/lib/marketplace/demoCycle'
import { applicationsFor } from '@/lib/marketplace/workflow'
import { assessOpportunity } from '@/lib/recommendation'
import { getCommute } from '@/lib/data/cities'
import { rankLabel } from '@/lib/commandTypes'
import {
  EligibilityBadge, ReadinessBadge, NeedBadge, StrengthBadge, GapList,
  PrototypeNotice, DemoPill,
} from '@/components/shared/Badges'
import { cn } from '@/lib/utils'

const GREEN = '#1B4F2A'
const SOLDIER_ID = 'self'

export default function SoldierMarketplacePage() {
  const { positions, roster, isDemo } = useForceData()
  const { profile, profileComplete } = useProfileStore()
  const { cycles, applications, addCycle, express, move, patchApplication, lastError, clearError } = useMarketplaceStore()
  const [expanded, setExpanded] = useState<number | null>(null)
  const [statement, setStatement] = useState('')

  const allUics = useMemo(
    () => [...new Set(positions.map(p => p.uic).filter(Boolean) as string[])], [positions])

  // Seed a demo cycle once so the workflow is walkable without setup.
  useEffect(() => {
    if (cycles.length === 0) {
      addCycle(buildDemoCycle(positions, roster, allUics))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cycle = cycles[0]
  const opportunities = useMemo(() => {
    if (!cycle) return []
    return cycle.vacancyIds
      .map(id => positions.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p != null)
      .filter(p => p.careerCategory === profile.careerCategory)
  }, [cycle, positions, profile.careerCategory])

  const myApps = applicationsFor(applications, { soldierId: SOLDIER_ID })

  if (!profileComplete) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center px-4">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mx-auto mb-5 bg-green-100 text-green-800">🧭</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Build Your Profile First</h2>
        <p className="text-gray-600 mb-6">
          The marketplace shows eligibility and readiness against your rank, MOS, time in grade, and PME.
        </p>
        <Link href="/profile" className="inline-block px-6 py-3 rounded-lg text-white font-semibold"
          style={{ backgroundColor: GREEN }}>Build My Profile →</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-[1200px] mx-auto">
          <h1 className="text-2xl font-bold" style={{ color: GREEN }}>
            Talent Marketplace {isDemo && <DemoPill />}
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Published opportunities you can express interest in. Every listing shows eligibility, readiness,
            organizational need, and exactly what stands between you and the billet.
          </p>
          {cycle && (
            <p className="text-xs text-gray-500 mt-2">
              <strong>{cycle.name}</strong> · {cycle.status} · open {cycle.openDate} to {cycle.closeDate}
              {cycle.reportWindow && ` · report window: ${cycle.reportWindow}`}
            </p>
          )}
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="max-w-[1200px] mx-auto space-y-5">
          {lastError && (
            <div role="alert" className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 flex justify-between">
              <span>{lastError}</span>
              <button onClick={clearError} className="underline">Dismiss</button>
            </div>
          )}

          {myApps.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-2">My applications ({myApps.length})</h2>
              <ul className="space-y-2">
                {myApps.map(a => {
                  const pos = positions.find(p => p.id === a.positionId)
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-3 flex-wrap border-b border-gray-100 pb-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900">{pos?.dutyTitle ?? `Position ${a.positionId}`}</div>
                        <div className="text-xs text-gray-500">
                          {pos?.grade} · {pos?.city} · status history: {a.history.map(h => h.status).join(' → ')}
                        </div>
                        {a.developmentFeedback && (
                          <div className="text-xs text-blue-800 mt-1">Feedback: {a.developmentFeedback}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 font-medium">{a.status}</span>
                        {a.status === 'Interested' && (
                          <button onClick={() => move(a.id, 'Applied', AS_OF)}
                            className="text-xs px-2 py-1 rounded text-white font-medium" style={{ backgroundColor: GREEN }}>
                            Submit application
                          </button>
                        )}
                        {(a.status === 'Interested' || a.status === 'Applied') && (
                          <button onClick={() => move(a.id, 'Withdrawn', AS_OF)}
                            className="text-xs underline text-gray-500 hover:text-red-600">Withdraw</button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <h2 className="text-lg font-bold text-gray-900">
            Published opportunities <span className="text-sm font-normal text-gray-500">({opportunities.length} matching your career category)</span>
          </h2>

          {opportunities.length === 0 ? (
            <p className="text-gray-500">No published opportunities for {profile.careerCategory} soldiers in this cycle.</p>
          ) : (
            <div className="space-y-3">
              {opportunities.map(pos => {
                const a = assessOpportunity(profile, pos)
                const commute = getCommute(profile.homeCity, pos.city)
                const existing = myApps.find(x => x.positionId === pos.id)
                const open = expanded === pos.id
                return (
                  <article key={pos.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900">
                          {pos.dutyTitle} <span className="font-mono text-sm text-gray-500">({rankLabel(pos.grade)})</span>
                        </h3>
                        <p className="text-sm text-gray-600">
                          {pos.mos} · {pos.unit} · {pos.city} · {pos.statusType}
                          {commute ? ` · ${commute.minutes} min from ${profile.homeCity}` : ' · commute unknown'}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <EligibilityBadge value={a.eligibility} />
                          <ReadinessBadge value={a.readiness} />
                          <NeedBadge value={a.organizationalNeed} />
                          <StrengthBadge value={a.militaryQualFit} label="MOS" />
                          <StrengthBadge value={a.preferenceFit} label="Preference" />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {existing ? (
                          <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800 font-medium">
                            {existing.status}
                          </span>
                        ) : (
                          <button
                            onClick={() => { clearError(); express(cycle.id, SOLDIER_ID, pos.id, AS_OF) }}
                            disabled={a.eligibility === 'Not Eligible'}
                            title={a.eligibility === 'Not Eligible' ? 'You have a hard blocker for this billet.' : undefined}
                            className="text-sm px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-40"
                            style={{ backgroundColor: GREEN }}>
                            Express interest
                          </button>
                        )}
                        <button onClick={() => setExpanded(open ? null : pos.id)}
                          className="text-xs text-blue-700 underline">
                          {open ? 'Hide details' : 'What do I need?'}
                        </button>
                      </div>
                    </div>

                    {open && (
                      <div className="mt-4 pt-3 border-t space-y-3">
                        <div>
                          <h4 className="text-xs font-bold text-gray-700 uppercase mb-1.5">Gaps and actions</h4>
                          <GapList gaps={a.gaps} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-gray-700 uppercase mb-1.5">How this was assessed</h4>
                          <div className="space-y-0.5">
                            {a.factors.map((f, i) => (
                              <div key={i} className={cn('text-xs flex justify-between gap-3 border-b border-gray-100 py-1',
                                f.excluded && 'opacity-70')}>
                                <span className="font-medium text-gray-700">{f.label}</span>
                                <span className="text-gray-500 text-right flex-1">{f.detail}</span>
                                <span className="font-bold text-gray-800 w-20 text-right">{f.excluded ? 'excluded' : f.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {existing && (
                          <div>
                            <label className="text-xs font-bold text-gray-700 uppercase" htmlFor={`soi-${pos.id}`}>
                              Statement of interest
                            </label>
                            <textarea id={`soi-${pos.id}`} rows={3} value={statement}
                              onChange={e => setStatement(e.target.value)}
                              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                              placeholder="Why you want this assignment and what you bring to it." />
                            <button onClick={() => patchApplication(existing.id, { statementOfInterest: statement })}
                              className="mt-1 text-xs px-3 py-1 rounded text-white font-medium" style={{ backgroundColor: GREEN }}>
                              Save statement
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}

          <PrototypeNotice scope="This marketplace" />
        </div>
      </div>
    </div>
  )
}
