'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Position } from '@/lib/types'
import type { RosterSoldier } from '@/lib/commandTypes'
import type { OrgNode } from '@/lib/orgChart/types'
import { soldierLabel } from '@/lib/commandTypes'
import { rankCandidates } from '@/lib/forceAnalytics'
import { assessOpportunity } from '@/lib/recommendation'
import { getCommute } from '@/lib/data/cities'
import type { SoldierProfile } from '@/lib/types'
import { EligibilityBadge, ReadinessBadge, GapList, MissingDataNote } from '@/components/shared/Badges'
import { TileLegend } from './BilletTiles'
import { cn } from '@/lib/utils'

// Slide-over, matching SoldierDrawer's mechanics exactly so the app has one
// modal behaviour. Leads with the armory town — the published chart's whole
// promise is "click any unit for their address".

export interface DetailTarget {
  node: OrgNode
  /** Set when a specific billet was clicked rather than the unit. */
  billet?: Position | null
}

export function OrgDetailPanel({
  target, roster, mode, profile, onClose, onPickMos, onPickBillet,
}: {
  target: DetailTarget | null
  roster: RosterSoldier[]
  mode: 'manager' | 'soldier'
  profile?: SoldierProfile | null
  onClose: () => void
  onPickMos: (mos: string) => void
  onPickBillet: (p: Position) => void
}) {
  const [tab, setTab] = useState<'billets' | 'people'>('billets')

  useEffect(() => {
    if (!target) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [target, onClose])

  const occupied = useMemo(() => {
    const m = new Map<number, RosterSoldier>()
    for (const s of roster) if (s.positionId != null) m.set(s.positionId, s)
    return m
  }, [roster])

  const billets = useMemo(() => {
    if (!target) return []
    const out: Position[] = []
    ;(function collect(n: OrgNode) {
      out.push(...n.billets)
      n.children.forEach(collect)
    })(target.node)
    return out.sort((a, b) =>
      (a.paraLine ?? '').localeCompare(b.paraLine ?? '') || a.dutyTitle.localeCompare(b.dutyTitle))
  }, [target])

  const people = useMemo(
    () => (target ? roster.filter(s => target.node.uics.includes(s.uic)) : []),
    [target, roster]
  )

  // Manager: who could fill this vacancy. Same ranker Succession uses, so the
  // two screens can never disagree about a candidate.
  const candidates = useMemo(() => {
    if (!target?.billet || mode !== 'manager') return []
    if (occupied.has(target.billet.id)) return []
    return rankCandidates(roster, target.billet, 8)
  }, [target, roster, mode, occupied])

  // Soldier: could I fill this? Reuses the assessment the matches page renders.
  const assessment = useMemo(() => {
    if (!target?.billet || mode !== 'soldier' || !profile) return null
    return assessOpportunity(profile, target.billet)
  }, [target, mode, profile])

  if (!target) return null
  const { node, billet } = target
  const incumbent = billet ? occupied.get(billet.id) : undefined
  const commute = billet && profile?.homeCity ? getCommute(profile.homeCity, billet.city) : null

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true"
      aria-label={billet ? billet.dutyTitle : node.label}>
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close panel" />

      <aside className="relative bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col">
        <header className="px-5 py-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">{billet ? billet.dutyTitle : node.label}</h2>
              {/* Location first, deliberately. */}
              <p className="text-sm text-gray-600 mt-0.5">
                {billet
                  ? `${billet.grade} · ${billet.mos} · ${billet.city}`
                  : [node.city, node.uic].filter(Boolean).join(' · ') || node.sublabel}
              </p>
            </div>
            <button onClick={onClose}
              className="text-gray-500 hover:text-gray-900 text-2xl leading-none px-2 flex-shrink-0"
              aria-label="Close">×</button>
          </div>

          {!billet && (
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span><strong className="text-gray-900">{node.assigned}</strong>
                <span className="text-gray-500"> assigned</span></span>
              <span><strong className="text-gray-900">{node.authorized || '—'}</strong>
                <span className="text-gray-500"> authorized</span></span>
              {node.unauthorizedAssigned > 0 && (
                <span className="text-amber-700">{node.unauthorizedAssigned} over-strength</span>
              )}
              {node.uics.length > 1 && (
                <span className="text-gray-500">{node.uics.length} UICs</span>
              )}
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          {billet ? (
            <div className="p-5 space-y-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-500">Unit</dt><dd className="text-gray-900">{node.label}</dd>
                <dt className="text-gray-500">MTOE line</dt>
                <dd className="text-gray-900 font-mono text-xs">{billet.paraLine ?? '—'}</dd>
                <dt className="text-gray-500">Type</dt><dd className="text-gray-900">{billet.positionType}</dd>
                <dt className="text-gray-500">Status</dt><dd className="text-gray-900">{billet.statusType}</dd>
                <dt className="text-gray-500">Authorization</dt>
                <dd className={billet.authorized === false ? 'text-amber-700' : 'text-gray-900'}>
                  {billet.authorized === false ? 'TEMPLET / over-strength line' : 'Authorized billet'}
                </dd>
                <dt className="text-gray-500">Occupancy</dt>
                <dd className={incumbent ? 'text-gray-900' : 'text-green-800 font-semibold'}>
                  {incumbent ? `${soldierLabel(incumbent)} · ${incumbent.rank}` : 'VACANT'}
                </dd>
              </dl>

              <button
                onClick={() => onPickMos(billet.mos)}
                className="text-sm px-3 py-1.5 rounded-lg bg-green-800 text-white font-medium hover:bg-green-900"
              >
                Show every unit with {billet.mos} →
              </button>

              {mode === 'manager' && !incumbent && (
                <section>
                  <h3 className="font-bold text-gray-900 text-sm mb-2">Who could fill it</h3>
                  {candidates.length === 0 ? (
                    <p className="text-sm text-gray-500">No candidate in the roster clears the gates for this billet.</p>
                  ) : (
                    <ol className="space-y-2">
                      {candidates.map((c, i) => (
                        <li key={c.soldier.id} className="border rounded-lg p-2.5 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-gray-900">
                              {i + 1}. {soldierLabel(c.soldier)} · {c.soldier.rank} {c.soldier.mos}
                            </span>
                            <span className="flex items-center gap-2 flex-shrink-0">
                              <span className="tabular-nums font-bold text-gray-700">{c.score}</span>
                              <ReadinessBadge value={c.readiness as never} />
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {c.soldier.unitName} · {c.soldier.city}
                          </div>
                          {c.blockers.length > 0 && (
                            <div className="text-xs text-amber-700 mt-1">{c.blockers.join('; ')}</div>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                  <p className="text-[11px] text-gray-500 mt-2">
                    Ranked locally from grade, MOS, promotion gates, time in seat, and drive time —
                    the same calculation the Succession page uses.
                  </p>
                </section>
              )}

              {mode === 'soldier' && (
                <section>
                  <h3 className="font-bold text-gray-900 text-sm mb-2">Could you fill it?</h3>
                  {!profile ? (
                    <MissingDataNote>
                      Build your profile first and this will show whether you qualify today and what
                      is in the way.
                    </MissingDataNote>
                  ) : assessment ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <EligibilityBadge value={assessment.eligibility} />
                        <ReadinessBadge value={assessment.readiness} />
                        {commute && (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                            {commute.minutes} min from {profile.homeCity}
                          </span>
                        )}
                      </div>
                      <GapList gaps={assessment.gaps} />
                    </div>
                  ) : null}
                </section>
              )}
            </div>
          ) : (
            <>
              <div className="px-5 pt-3 flex gap-1 border-b">
                {([['billets', `Billets (${billets.length})`], ['people', `Assigned (${people.length})`]] as const)
                  .map(([id, label]) => (
                    <button key={id} onClick={() => setTab(id)}
                      className={cn('px-3 py-2 text-sm font-medium border-b-2 -mb-px',
                        tab === id ? 'border-green-800 text-green-900' : 'border-transparent text-gray-500')}>
                      {label}
                    </button>
                  ))}
              </div>

              {tab === 'billets' ? (
                <div className="p-5">
                  <TileLegend />
                  <table className="w-full text-sm mt-3">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left px-2 py-1.5 text-xs font-bold text-gray-600">Line</th>
                        <th className="text-left px-2 py-1.5 text-xs font-bold text-gray-600">Grade</th>
                        <th className="text-left px-2 py-1.5 text-xs font-bold text-gray-600">MOS</th>
                        <th className="text-left px-2 py-1.5 text-xs font-bold text-gray-600">Duty title</th>
                        <th className="text-left px-2 py-1.5 text-xs font-bold text-gray-600">Who</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billets.slice(0, 250).map((b, i) => {
                        const who = occupied.get(b.id)
                        return (
                          <tr key={b.id}
                            onClick={() => onPickBillet(b)}
                            className={cn('cursor-pointer hover:bg-green-50',
                              i % 2 ? 'bg-gray-50' : 'bg-white')}>
                            <td className="px-2 py-1 font-mono text-[11px] text-gray-500">{b.paraLine}</td>
                            <td className="px-2 py-1">{b.grade}</td>
                            <td className="px-2 py-1">
                              <button onClick={e => { e.stopPropagation(); onPickMos(b.mos) }}
                                className="underline decoration-dotted hover:text-green-800">{b.mos}</button>
                            </td>
                            <td className="px-2 py-1 text-gray-800">{b.dutyTitle}</td>
                            <td className={cn('px-2 py-1', who ? 'text-gray-700' : 'text-green-800 font-semibold')}>
                              {who ? soldierLabel(who) : 'VACANT'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {billets.length > 250 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Showing the first 250 of {billets.length}. Open a subordinate unit for the rest.
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-5">
                  {people.length === 0 ? (
                    <p className="text-sm text-gray-500">Nobody assigned here.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left px-2 py-1.5 text-xs font-bold text-gray-600">Soldier</th>
                          <th className="text-left px-2 py-1.5 text-xs font-bold text-gray-600">Grade</th>
                          <th className="text-left px-2 py-1.5 text-xs font-bold text-gray-600">MOS</th>
                          <th className="text-right px-2 py-1.5 text-xs font-bold text-gray-600">TIG</th>
                          <th className="text-right px-2 py-1.5 text-xs font-bold text-gray-600">TIP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {people.slice(0, 250).map((s, i) => (
                          <tr key={s.id} className={i % 2 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="px-2 py-1">{soldierLabel(s)}</td>
                            <td className="px-2 py-1">{s.rank}</td>
                            <td className="px-2 py-1">{s.mos}</td>
                            <td className="px-2 py-1 text-right tabular-nums">
                              {s.timeInGrade > 0 ? `${s.timeInGrade}y` : <span className="text-gray-400">unknown</span>}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums">{s.timeInPosition}y</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
