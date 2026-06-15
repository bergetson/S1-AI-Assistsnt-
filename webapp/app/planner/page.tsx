'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useProfileStore } from '@/lib/store'
import { usePlannerStore } from '@/lib/plannerStore'
import { positions } from '@/lib/data/positions'
import { RANK_NUM } from '@/lib/scoring'
import {
  buildPlannerPhases,
  computeTimeline,
  getPhasePicks,
  resolvePosition,
  summarizePlan,
  DWELL_CHOICES,
  type PlannerPhase,
  type PlannerTrack,
  type Pick,
  type PhaseTiming,
} from '@/lib/careerPlanner'
import type { ScoredPosition } from '@/lib/types'
import { cn } from '@/lib/utils'

const CURRENT_YEAR = new Date().getFullYear()
const ENLISTED_RANKS = ['E4', 'E5', 'E6', 'E7']

function dwellLabel(y: number): string {
  return y === 1.5 ? '18 mo' : `${y} yr`
}
function statusBadge(s: string): string {
  if (s === 'AGR') return 'bg-emerald-100 text-emerald-800'
  if (s === 'Technician') return 'bg-sky-100 text-sky-800'
  if (s === 'Multiple') return 'bg-violet-100 text-violet-800'
  return 'bg-gray-100 text-gray-700'
}
function vacancyBadge(s: string): string {
  if (s === 'Vacant') return 'bg-green-100 text-green-800'
  if (s === 'Projected Vacant') return 'bg-amber-100 text-amber-800'
  return 'bg-gray-100 text-gray-500'
}
function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-700'
  if (score >= 60) return 'text-blue-700'
  if (score >= 40) return 'text-amber-600'
  return 'text-gray-500'
}

export default function PlannerPage() {
  const { profile, profileComplete } = useProfileStore()
  const {
    phasePicks, track, commissionAfterGrade,
    setPhasePicks, setTrack, setCommissionAfterGrade, resetPlan,
  } = usePlannerStore()

  const isEnlisted = profile.careerCategory === 'Enlisted'
  const effectiveCommissionGrade = commissionAfterGrade || profile.rank

  const phases = useMemo(
    () => buildPlannerPhases(profile, positions, { track, commissionAfterGrade: effectiveCommissionGrade }),
    [profile, track, effectiveCommissionGrade]
  )
  const timeline = useMemo(() => computeTimeline(profile, phases, phasePicks), [profile, phases, phasePicks])
  const summary = useMemo(() => summarizePlan(profile, phases, phasePicks), [profile, phases, phasePicks])
  const [openSwap, setOpenSwap] = useState<string | null>(null)

  if (!profileComplete) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center px-4">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mx-auto mb-5 bg-green-100 text-green-800">🧭</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Build Your Profile First</h2>
        <p className="text-gray-600 mb-6">
          The Career Planner uses your rank, MOS, TIG, PME status, and home city to suggest positions and
          timing at each grade. Complete your profile to start planning.
        </p>
        <Link href="/profile" className="inline-block px-6 py-3 rounded-lg text-white font-semibold" style={{ backgroundColor: '#1B4F2A' }}>
          Build My Profile →
        </Link>
      </div>
    )
  }

  // atCeiling = no future (non-current) phases exist (e.g., already at E9/W5/O6)
  const atCeiling = phases.filter(p => !p.isCurrent).length === 0
  const commissionGradeOptionsRaw = ENLISTED_RANKS.filter(r => (RANK_NUM[r] ?? 0) >= (RANK_NUM[profile.rank] ?? 0))
  const commissionGradeOptions = commissionGradeOptionsRaw.length ? commissionGradeOptionsRaw : [profile.rank]

  // Mutation helpers — always operate on the *effective* picks then persist
  function updatePick(phase: PlannerPhase, index: number, patch: Partial<Pick>) {
    const picks = getPhasePicks(phase, phasePicks).map((p, i) => (i === index ? { ...p, ...patch } : p))
    setPhasePicks(phase.id, picks)
  }
  function addPosition(phase: PlannerPhase) {
    const picks = getPhasePicks(phase, phasePicks)
    const usedIds = new Set(picks.map(p => p.positionId))
    const nextOpt = phase.options.find(o => !usedIds.has(o.id)) ?? phase.options[0]
    setOpenSwap(null)
    setPhasePicks(phase.id, [...picks, { positionId: nextOpt?.id ?? null, dwellYears: 2 }])
  }
  function removePosition(phase: PlannerPhase, index: number) {
    const picks = getPhasePicks(phase, phasePicks)
    if (picks.length <= 1) return
    setOpenSwap(null)
    setPhasePicks(phase.id, picks.filter((_, i) => i !== index))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-4xl mx-auto flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1B4F2A' }}>Career Planner</h1>
            <p className="text-sm text-gray-500 mt-1">
              Map your whole career grade by grade. Plan several jobs at each grade, set how long you
              stay in each, layer in your schools, and branch into the officer or warrant track via OCS/WOCS.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { resetPlan(); setOpenSwap(null) }}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 font-medium">
              ↺ Reset Plan
            </button>
            <Link href="/ai-mentor" className="px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ backgroundColor: '#1B4F2A' }}>
              💬 Discuss with Steeves
            </Link>
          </div>
        </div>
      </div>

      {/* Profile context bar */}
      <div className="px-8 py-3 bg-white border-b text-sm text-gray-600">
        <div className="max-w-4xl mx-auto flex flex-wrap gap-6">
          <span><strong>Rank:</strong> {profile.rank}</span>
          <span><strong>TIG:</strong> {profile.timeInGrade} yrs</span>
          <span><strong>MOS:</strong> {profile.mos}</span>
          <span><strong>TIS:</strong> {profile.yearsOfService} yrs</span>
          <span><strong>Home:</strong> {profile.homeCity}</span>
          <span><strong>Target:</strong> {profile.targetRank}</span>
        </div>
      </div>

      {/* Track selector (enlisted only) */}
      {isEnlisted && (
        <div className="px-8 pt-5">
          <div className="max-w-4xl mx-auto rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500 uppercase font-semibold mb-2">Career Track</div>
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'current', label: 'Stay Enlisted', icon: '🎖️' },
                { key: 'ocs', label: 'Commission via OCS → Officer', icon: '🎓' },
                { key: 'wocs', label: 'Warrant via WOCS', icon: '🔧' },
              ] as { key: PlannerTrack; label: string; icon: string }[]).map(t => (
                <button key={t.key} onClick={() => { setTrack(t.key); setOpenSwap(null) }}
                  className={cn('px-3 py-2 rounded-lg text-sm font-medium border transition',
                    track === t.key ? 'border-green-500 bg-green-50 text-green-800 ring-1 ring-green-300' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50')}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {track !== 'current' && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-700 flex-wrap">
                <span>Commission after reaching</span>
                <select value={effectiveCommissionGrade} onChange={e => { setCommissionAfterGrade(e.target.value); setOpenSwap(null) }}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700">
                  {commissionGradeOptions.map(r => (
                    <option key={r} value={r}>{r}{r === profile.rank ? ' (now)' : ''}</option>
                  ))}
                </select>
                <span className="text-gray-500">— then plan {track === 'ocs' ? 'officer' : 'warrant'} positions from there.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plan summary */}
      {!atCeiling && (
        <div className="px-8 pt-5">
          <div className="max-w-4xl mx-auto rounded-xl border border-green-200 bg-green-50 p-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <div className="text-xs text-green-700 uppercase font-semibold">Path</div>
              <div className="text-lg font-bold text-green-900">
                {summary.startGrade} → {summary.endGrade}
                {summary.commissions && <span className="text-xs font-medium text-green-700"> ({summary.endCategory})</span>}
              </div>
            </div>
            <div>
              <div className="text-xs text-green-700 uppercase font-semibold">Span</div>
              <div className="text-lg font-bold text-green-900">~{summary.totalYears} yrs</div>
            </div>
            <div>
              <div className="text-xs text-green-700 uppercase font-semibold">Positions</div>
              <div className="text-lg font-bold text-green-900">{summary.totalPositions}</div>
            </div>
            <div>
              <div className="text-xs text-green-700 uppercase font-semibold">20-Yr Eligible</div>
              <div className="text-lg font-bold text-green-900">~{summary.retirementYear}</div>
            </div>
            <div>
              <div className="text-xs text-green-700 uppercase font-semibold">Schools Left</div>
              <div className="text-lg font-bold text-green-900">{summary.pmeRemaining.length === 0 ? 'None' : summary.pmeRemaining.join(', ')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="px-8 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-4">
              {/* All phases (first is always the current grade) */}
              {phases.map(phase => (
                <PhaseCard
                  key={phase.id}
                  phase={phase}
                  timing={timeline[phase.id]}
                  picks={getPhasePicks(phase, phasePicks)}
                  openSwap={openSwap}
                  setOpenSwap={setOpenSwap}
                  onPick={(i, posId) => updatePick(phase, i, { positionId: posId })}
                  onDwell={(i, y) => updatePick(phase, i, { dwellYears: y })}
                  onAdd={() => addPosition(phase)}
                  onRemove={(i) => removePosition(phase, i)}
                />
              ))}

              {/* Horizon / ceiling node */}
              {atCeiling ? (
                <div className="relative flex gap-5 items-start">
                  <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-xl z-10 border-2 border-white shadow bg-gray-400">🏔</div>
                  <div className="flex-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="font-bold text-base text-gray-800">Top of the Grade Structure</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      You&apos;re at {profile.rank} — the ceiling for {profile.careerCategory.toLowerCase()} soldiers.
                      Focus on capstone assignments and mentoring. Explore lateral moves on the{' '}
                      <Link href="/matches" className="underline text-green-700">Matches</Link> page.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative flex gap-5 items-start">
                  <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-xl z-10 border-2 border-white shadow bg-amber-500">🏁</div>
                  <div className="flex-1 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <h3 className="font-bold text-base text-amber-900">20+ Year Horizon</h3>
                    <p className="text-sm text-amber-800 mt-1">
                      Retirement eligibility around <strong>{summary.retirementYear}</strong>.
                      {summary.reaches20
                        ? ' This plan carries you past the 20-year mark — plan a strong capstone tour and final evaluation.'
                        : ' Add positions or longer dwell times to carry the plan past the 20-year retirement point.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <strong>How to use this:</strong> At each grade you can line up several jobs (for example, as a CPT:
            S4, then S1, then S3 before promoting). Pick the billet, set how long you&apos;ll stay, and add more
            with <em>+ Add another position</em>. Finish the listed schools before each promotion. Enlisted soldiers
            can branch to the officer or warrant track via OCS/WOCS. Your plan saves automatically. Timing is
            estimated from typical ARNG windows (AR 600-8-19, AR 135-155, NGR 600-101) — verify with your S1.
          </div>
        </div>
      </div>
    </div>
  )
}

function PhaseCard({
  phase, timing, picks, openSwap, setOpenSwap, onPick, onDwell, onAdd, onRemove,
}: {
  phase: PlannerPhase
  timing: PhaseTiming | undefined
  picks: Pick[]
  openSwap: string | null
  setOpenSwap: (v: string | null) => void
  onPick: (index: number, positionId: number) => void
  onDwell: (index: number, years: number) => void
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  const isCommission = phase.kind === 'commission'
  const isCurrent = phase.isCurrent === true
  const enterYear = CURRENT_YEAR + Math.round(timing?.enterYears ?? 0)
  const tisYears = Math.round(timing?.tisYears ?? 0)
  const totalDwell = timing?.totalDwell ?? 0
  const belowMin = phase.nextMinTig > 0 && totalDwell < phase.nextMinTig

  return (
    <div className="relative flex gap-5 items-start">
      <div className={cn('w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-xl z-10 border-2 border-white shadow',
        isCurrent ? 'bg-green-600' : isCommission ? 'bg-violet-500' : 'bg-blue-400')}>
        {isCurrent ? '📍' : isCommission ? '🎓' : '⭐'}
      </div>

      <div className={cn('flex-1 rounded-xl border p-4 shadow-sm',
        isCurrent ? 'border-green-300 bg-green-50' : isCommission ? 'border-violet-200 bg-violet-50' : 'border-gray-200 bg-white')}>
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={cn('text-xs px-2 py-0.5 rounded font-semibold',
            isCurrent ? 'bg-green-600 text-white' : isCommission ? 'bg-violet-100 text-violet-700' : 'bg-blue-50 text-blue-700')}>
            {isCurrent ? 'NOW' : `~${enterYear}`}
          </span>
          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono font-bold">{phase.grade}</span>
          <span className={cn('font-bold text-base', isCurrent ? 'text-green-900' : 'text-gray-900')}>{phase.gradeName}</span>
          <span className="text-xs text-gray-400">{isCurrent ? `${tisYears} yrs TIS` : `est. TIS ~${tisYears} yr`}</span>
          {isCommission && <span className="text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold">{phase.commissionType} → {phase.category}</span>}
        </div>

        {/* Role / focus */}
        {phase.role && (
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-700">{phase.role}.</span> {phase.focus}
          </p>
        )}

        {/* PME chips */}
        {phase.pme.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-500 mr-1">Schools:</span>
            {phase.pme.map(p => (
              <span key={p.field}
                className={cn('text-xs px-2 py-0.5 rounded-full border font-medium',
                  p.alreadyDone ? 'bg-green-50 border-green-200 text-green-700'
                    : p.required ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700')}
                title={p.alreadyDone ? 'Complete' : p.required ? 'Required before this step' : 'Recommended before this board'}>
                {p.alreadyDone ? '✓ ' : p.required ? '✗ ' : '○ '}{p.name}
              </span>
            ))}
          </div>
        )}

        {/* Time-at-grade summary */}
        <div className="mt-3 text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-gray-600">
            {isCurrent ? 'Remaining time here: ' : 'Planned at this grade: '}
            <strong>~{totalDwell} yr</strong> across {picks.length} job{picks.length > 1 ? 's' : ''}
          </span>
          {phase.nextTypicalTig > 0 && (
            <span className="text-gray-400">
              {isCurrent ? `~${phase.nextTypicalTig} yr remaining before typical next board` : `typical ~${phase.nextTypicalTig} yr before the next board`}
            </span>
          )}
          {belowMin && (
            <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              ⚠ Less than the ~{phase.nextMinTig} yr minimum time-in-grade needed to be eligible for the next promotion
            </span>
          )}
        </div>

        {/* Job stints */}
        <div className="mt-3 space-y-2">
          {picks.map((pick, i) => {
            const pos = resolvePosition(phase, pick.positionId)
            const swapId = `${phase.id}:${i}`
            const isOpen = openSwap === swapId
            const stintYear = CURRENT_YEAR + Math.round(timing?.stints[i]?.enterYears ?? 0)
            return (
              <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-gray-500">
                    Job {i + 1} · ~{stintYear}
                  </span>
                  {picks.length > 1 && (
                    <button onClick={() => onRemove(i)} className="text-xs text-gray-400 hover:text-red-600" title="Remove this job">✕ remove</button>
                  )}
                </div>

                {pos ? (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 text-sm">{pos.dutyTitle}</div>
                        <div className="text-xs text-gray-600">{pos.unit} · {pos.city}</div>
                      </div>
                      <div className={cn('text-sm font-bold flex-shrink-0', scoreColor(pos.totalScore))}>
                        {pos.totalScore}<span className="text-xs text-gray-400">/100</span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={cn('text-xs px-2 py-0.5 rounded', statusBadge(pos.statusType))}>{pos.statusType}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded', vacancyBadge(pos.vacancyStatus))}>{pos.vacancyStatus}</span>
                      {pos.isCommandOrKD && <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800">KD/CMD</span>}
                      {pos.commuteMins >= 0 && <span className="text-xs text-gray-500">🚗 {pos.commuteMins} min</span>}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    {phase.options.length === 0
                      ? `No ${phase.grade} billets in the dataset — aim for a ${phase.role || 'leadership'} role.`
                      : 'Open billet — choose one below.'}
                  </div>
                )}

                {/* Dwell selector */}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">Time here:</span>
                  <div className="flex gap-1">
                    {DWELL_CHOICES.map(y => (
                      <button key={y} onClick={() => onDwell(i, y)}
                        className={cn('text-xs px-2 py-1 rounded border font-medium transition',
                          pick.dwellYears === y ? 'border-green-500 bg-green-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50')}>
                        {dwellLabel(y)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Swap */}
                {phase.options.length > 0 && (
                  <>
                    <button onClick={() => setOpenSwap(isOpen ? null : swapId)}
                      className="mt-2 text-xs font-medium text-blue-700 hover:text-blue-800 flex items-center gap-1">
                      <span>{isOpen ? '▲' : '▼'}</span>
                      <span>{isOpen ? 'Hide options' : `Choose / swap — ${phase.options.length} options`}</span>
                    </button>
                    {isOpen && (
                      <div className="mt-2 space-y-2">
                        {phase.options.map(opt => {
                          const isSel = pos?.id === opt.id
                          const isSug = opt.id === phase.suggestedPositionId
                          return (
                            <button key={opt.id} onClick={() => { onPick(i, opt.id); setOpenSwap(null) }}
                              className={cn('w-full text-left rounded-lg border p-3 transition',
                                isSel ? 'border-green-400 bg-green-50 ring-1 ring-green-300' : 'border-gray-200 bg-white hover:bg-gray-50')}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-gray-900 text-sm">{opt.dutyTitle}</span>
                                    {isSug && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">Suggested</span>}
                                    {isSel && <span className="text-xs px-1.5 py-0.5 rounded bg-green-600 text-white font-medium">Selected ✓</span>}
                                  </div>
                                  <div className="text-xs text-gray-600">{opt.unit} · {opt.city}</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <span className={cn('text-xs px-2 py-0.5 rounded', statusBadge(opt.statusType))}>{opt.statusType}</span>
                                    <span className={cn('text-xs px-2 py-0.5 rounded', vacancyBadge(opt.vacancyStatus))}>{opt.vacancyStatus}</span>
                                    {opt.isCommandOrKD && <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800">KD/CMD</span>}
                                    {opt.commuteMins >= 0 && <span className="text-xs text-gray-500">🚗 {opt.commuteMins} min</span>}
                                  </div>
                                </div>
                                <div className={cn('text-sm font-bold flex-shrink-0', scoreColor(opt.totalScore))}>
                                  {opt.totalScore}<span className="text-xs text-gray-400">/100</span>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Add another position */}
        {phase.options.length > 0 && (
          <button onClick={onAdd}
            className="mt-3 text-xs font-medium text-green-700 hover:text-green-800 border border-dashed border-green-300 rounded-lg px-3 py-1.5 hover:bg-green-50 transition">
            + Add another {isCurrent ? 'current' : ''} position at {phase.grade}
          </button>
        )}
      </div>
    </div>
  )
}
