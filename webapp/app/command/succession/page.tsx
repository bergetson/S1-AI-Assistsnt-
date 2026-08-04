'use client'

import { useEffect, useMemo, useState } from 'react'
import { positions } from '@/lib/data/positions'
import { useCommandStore } from '@/lib/commandStore'
import {
  positionsInFormation, rosterInFormation, rankCandidates, vacantBillets,
  computeManning, projectAttrition, projectPromotions, summarizeForce,
  buildUnitNameMap, resolveUnitName, buildUnitFamilies,
} from '@/lib/forceAnalytics'
import {
  buildCommanderPrompt, buildCandidateBlock, buildRosterBlock,
  buildNameMap, rehydrateNames, anonymizeSoldier,
} from '@/lib/commanderAI'
import { queryClaude, getStoredClaudeKey } from '@/lib/claude'
import { queryAskSage, buildFullMessage, getStoredCredentials } from '@/lib/asksage'
import type { Position } from '@/lib/types'
import { rankLabel } from '@/lib/commandTypes'
import {
  ARMY_GREEN, CommandHeader, DemoBanner, DemoWatermark, FormationBar,
  CommandPrintStyles, NoFormation, useActiveRoster, useSeedFormation,
} from '@/components/command/CommandShell'
import { cn } from '@/lib/utils'

const BASE_YEAR = 2026

const selectClass =
  'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700'
const labelClass = 'text-xs font-semibold text-gray-500 uppercase mb-1'

function readinessColor(r: string): string {
  if (r === 'Ready now') return 'bg-green-100 text-green-800'
  if (r === 'Ready with development') return 'bg-amber-100 text-amber-800'
  return 'bg-gray-100 text-gray-600'
}

export default function CommandSuccessionPage() {
  useSeedFormation()
  const { selectedUics, horizonYears, source, shareEvalBullets, setShareEvalBullets } = useCommandStore()
  const roster = useActiveRoster()

  const [billetId, setBilletId] = useState<number | null>(null)
  const [gradeFilter, setGradeFilter] = useState('')
  const [onlyVacant, setOnlyVacant] = useState(true)
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPayload, setShowPayload] = useState(false)
  const [claudeKey, setClaudeKey] = useState('')
  const [creds, setCreds] = useState({ email: '', apiKey: '' })

  // Credentials live in localStorage, which does not exist during the static
  // export, so they can only be read after mount — same pattern as /ai-mentor.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setClaudeKey(getStoredClaudeKey())
    setCreds(getStoredCredentials())
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const hasCreds = Boolean(claudeKey || (creds.email && creds.apiKey))
  const nameMap = useMemo(() => buildUnitNameMap(positions), [])
  const people = useMemo(() => rosterInFormation(roster, selectedUics), [roster, selectedUics])

  const billets = useMemo(() => {
    // Vacancy is derived from who is actually assigned, not from the source
    // report's vacancyStatus field, which goes stale against a real roster.
    let list = onlyVacant
      ? vacantBillets(positions, roster, selectedUics)
      : positionsInFormation(positions, selectedUics)
    if (gradeFilter) list = list.filter(p => p.grade === gradeFilter)
    return list.sort((a, b) => a.grade.localeCompare(b.grade) || a.dutyTitle.localeCompare(b.dutyTitle))
  }, [roster, selectedUics, onlyVacant, gradeFilter])

  /** Who currently sits in the selected billet, if anyone. */
  const incumbent = useMemo(
    () => (billetId == null ? null : people.find(s => s.positionId === billetId) ?? null),
    [people, billetId]
  )

  const grades = useMemo(
    () => [...new Set(positionsInFormation(positions, selectedUics).map(p => p.grade))].sort(),
    [selectedUics]
  )

  const target: Position | null = useMemo(
    () => billets.find(b => b.id === billetId) ?? null,
    [billets, billetId]
  )

  const candidates = useMemo(
    () => (target ? rankCandidates(people, target, 10) : []),
    [people, target]
  )

  // What actually goes over the wire — rendered verbatim in the preview below.
  const aiPayload = useMemo(() => {
    if (!target) return ''
    const families = buildUnitFamilies(positions, roster)
    const formationName = families
      .filter(f => f.uics.some(u => selectedUics.includes(u)))
      .map(f => f.name).slice(0, 4).join(', ') || 'Selected formation'

    const system = buildCommanderPrompt({
      formationName,
      summary: summarizeForce(positions, roster, selectedUics),
      manning: computeManning(positions, roster, selectedUics),
      attrition: projectAttrition(people, BASE_YEAR, horizonYears),
      promotions: projectPromotions(positions, roster, selectedUics, BASE_YEAR, horizonYears),
      baseYear: BASE_YEAR,
      horizonYears,
      isDemo: source === 'demo',
    })
    return system + buildCandidateBlock(target, candidates)
  }, [target, candidates, people, roster, selectedUics, horizonYears, source])

  async function runAnalysis() {
    if (!target || loading) return
    if (!hasCreds) {
      setError('Add a Claude API key or Ask Sage credentials on the Ask Steeves page first.')
      return
    }
    setLoading(true); setError(''); setAnalysis('')
    try {
      const question =
        `Assess this candidate slate for the billet. Who should I select and why? ` +
        `Name the tradeoff — what does moving them cost me elsewhere in the formation? ` +
        `If none are ready, say what I should do instead.`
      let reply: string
      if (claudeKey) {
        reply = await queryClaude(aiPayload, [{ role: 'user', content: question }], claudeKey, { maxTokens: 2000 })
      } else {
        reply = await queryAskSage(
          buildFullMessage(aiPayload, [{ role: 'user', content: question }]),
          creds.email, creds.apiKey)
      }
      // Map "S-014" back to real names locally — names never left the browser.
      setAnalysis(rehydrateNames(reply, buildNameMap(people)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong reaching the AI provider.')
    } finally {
      setLoading(false)
    }
  }

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
        title="Succession Planning"
        subtitle="Pick a billet and see who in your formation is ready to fill it. Candidates are ranked locally from grade, MOS, promotion gates, evaluations, time in seat, and drive time — the AI explains and challenges the list, it does not produce it."
      />

      {/* Billet picker */}
      <div className="px-8 py-4 bg-white border-b no-print">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-4 items-end">
          <div className="flex flex-col">
            <label className={labelClass}>Grade</label>
            <select value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setBilletId(null) }} className={selectClass}>
              <option value="">All grades</option>
              {grades.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex flex-col flex-1 min-w-[280px]">
            <label className={labelClass}>Billet to fill</label>
            <select
              value={billetId ?? ''}
              onChange={e => { setBilletId(e.target.value ? Number(e.target.value) : null); setAnalysis('') }}
              className={cn(selectClass, 'w-full')}
            >
              <option value="">Select a billet…</option>
              {billets.map(b => (
                <option key={b.id} value={b.id}>
                  {b.grade} · {b.dutyTitle} — {resolveUnitName(b.uic ?? '', nameMap)} ({b.city})
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
            <input type="checkbox" checked={onlyVacant}
              onChange={e => { setOnlyVacant(e.target.checked); setBilletId(null) }}
              className="accent-green-700" />
            Vacant billets only
          </label>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {!target ? (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-500">
              Select a billet above to see ranked candidates from your formation.
              <div className="text-sm text-gray-400 mt-2">{billets.length} billets available</div>
            </div>
          ) : (
            <>
              <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Filling</div>
                <h2 className="text-xl font-bold text-gray-900">{target.dutyTitle}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {target.grade} · {target.mos} · {resolveUnitName(target.uic ?? '', nameMap)} · {target.city} ·{' '}
                  {target.statusType} ·{' '}
                  {incumbent ? (
                    <span className="text-amber-700 font-semibold">
                      Currently held by {incumbent.lastName}, {incumbent.firstName} ({incumbent.timeInPosition} yr in seat)
                    </span>
                  ) : (
                    <span className="text-green-700 font-semibold">Vacant</span>
                  )}
                </p>
                {incumbent && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                    This billet is occupied. Anyone you move here displaces the incumbent — plan where they go next.
                  </p>
                )}
              </section>

              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-3">
                  Ranked candidates <span className="text-sm font-normal text-gray-500">({candidates.length} from {people.length} assigned)</span>
                </h2>
                {candidates.length === 0 ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
                    No viable candidates in this formation for this billet. Look at a lateral transfer from
                    another unit, or build the feeder grade first.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {candidates.map((c, i) => (
                      <div key={c.soldier.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-gray-400 font-bold">#{i + 1}</span>
                              <span className="font-bold text-gray-900">
                                {c.soldier.lastName}, {c.soldier.firstName}
                              </span>
                              <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-bold" title={c.soldier.rank}>
                                {rankLabel(c.soldier.rank)}
                              </span>
                              <span className="text-xs text-gray-500">{c.soldier.mos} · {c.soldier.componentStatus}</span>
                              <span className={cn('text-xs px-2 py-0.5 rounded font-medium', readinessColor(c.readiness))}>
                                {c.readiness}
                              </span>
                              <span className="text-xs text-gray-400 font-mono">{c.soldier.anonId}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {c.soldier.dutyTitle} · {resolveUnitName(c.soldier.uic, nameMap)} · {c.soldier.city}
                            </div>
                          </div>
                          <div className="text-2xl font-bold flex-shrink-0"
                            style={{ color: c.score >= 70 ? '#16a34a' : c.score >= 45 ? '#d97706' : '#6b7280' }}>
                            {c.score}<span className="text-sm text-gray-400">/100</span>
                          </div>
                        </div>

                        <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                          {c.factors.map(f => (
                            <div key={f.label} className="text-xs flex justify-between gap-2 border-b border-gray-100 py-0.5">
                              <span className="text-gray-600">{f.label}</span>
                              <span className="text-gray-400 text-right flex-1 truncate" title={f.detail}>{f.detail}</span>
                              <span className={cn('font-bold w-10 text-right',
                                f.points < 0 ? 'text-red-600' : 'text-gray-700')}>
                                {f.points > 0 && f.max > 0 ? `${f.points}/${f.max}` : f.points}
                              </span>
                            </div>
                          ))}
                        </div>

                        {c.blockers.length > 0 && (
                          <div className="mt-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded p-2">
                            <strong>Blockers:</strong> {c.blockers.join(' · ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── AI analysis ── */}
              <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm no-print">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Ask Steeves about this slate</h2>
                    <p className="text-sm text-gray-500">
                      Names never leave your browser — the AI sees pseudonyms like{' '}
                      <span className="font-mono">{candidates[0]?.soldier.anonId ?? 'S-001'}</span> and the reply is
                      mapped back locally.
                    </p>
                  </div>
                  <button
                    onClick={runAnalysis}
                    disabled={loading || candidates.length === 0}
                    className="px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50"
                    style={{ backgroundColor: ARMY_GREEN }}
                  >
                    {loading ? 'Analyzing…' : '💬 Analyze slate'}
                  </button>
                </div>

                <label className="flex items-start gap-2 text-xs text-gray-600 mb-3">
                  <input type="checkbox" checked={shareEvalBullets}
                    onChange={e => setShareEvalBullets(e.target.checked)}
                    className="mt-0.5 accent-green-700" />
                  <span>
                    Include evaluation bullets in what is sent. Off by default — bullets are free text and
                    may contain identifying detail that pseudonymizing grades and dates cannot remove.
                  </span>
                </label>

                {error && (
                  <div className="mb-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded p-3">{error}</div>
                )}

                {analysis && (
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-800"
                    style={{ whiteSpace: 'pre-wrap' }}>
                    {analysis}
                  </div>
                )}

                <button onClick={() => setShowPayload(v => !v)}
                  className="mt-3 text-xs font-medium text-blue-700 hover:text-blue-800">
                  {showPayload ? '▲ Hide' : '▼ Show'} exactly what gets sent
                </button>
                {showPayload && (
                  <pre className="mt-2 max-h-72 overflow-auto text-[11px] bg-gray-900 text-gray-100 rounded-lg p-3 whitespace-pre-wrap">
                    {aiPayload}
                    {shareEvalBullets ? buildRosterBlock(candidates.map(c => c.soldier), true, 10) : ''}
                  </pre>
                )}
              </section>

              {/* Transparency: what a single anonymized record looks like */}
              {candidates[0] && (
                <p className="text-xs text-gray-400 no-print">
                  Example of one transmitted record: <span className="font-mono">{anonymizeSoldier(candidates[0].soldier, false)}</span>
                </p>
              )}
            </>
          )}
        </div>
      </div>
      <CommandPrintStyles />
    </div>
  )
}
