'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useProfileStore } from '@/lib/store'
import { usePlannerStore } from '@/lib/plannerStore'
import { positions } from '@/lib/data/positions'
import { RANK_NUM } from '@/lib/scoring'
import {
  buildPlannerSlots,
  computeTimeline,
  getSlotSelection,
  summarizePlan,
  dwellFor,
  DWELL_CHOICES,
  type PlannerSlot,
  type PlannerTrack,
} from '@/lib/careerPlanner'
import type { ScoredPosition } from '@/lib/types'
import { cn } from '@/lib/utils'

const CURRENT_YEAR = new Date().getFullYear()
const ENLISTED_RANKS = ['E4', 'E5', 'E6', 'E7']

function dwellLabel(y: number): string {
  if (y === 1.5) return '18 mo'
  return `${y} yr`
}

function statusBadge(status: string): string {
  if (status === 'AGR') return 'bg-emerald-100 text-emerald-800'
  if (status === 'Technician') return 'bg-sky-100 text-sky-800'
  if (status === 'Multiple') return 'bg-violet-100 text-violet-800'
  return 'bg-gray-100 text-gray-700'
}

function vacancyBadge(status: string): string {
  if (status === 'Vacant') return 'bg-green-100 text-green-800'
  if (status === 'Projected Vacant') return 'bg-amber-100 text-amber-800'
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
    selections, dwell, track, commissionAfterGrade,
    setSelection, setDwell, setTrack, setCommissionAfterGrade, resetPlan,
  } = usePlannerStore()

  const isEnlisted = profile.careerCategory === 'Enlisted'
  const effectiveCommissionGrade = commissionAfterGrade || profile.rank

  const slots = useMemo(
    () => buildPlannerSlots(profile, positions, { track, commissionAfterGrade: effectiveCommissionGrade }),
    [profile, track, effectiveCommissionGrade]
  )
  const timeline = useMemo(() => computeTimeline(profile, slots, dwell), [profile, slots, dwell])
  const summary = useMemo(() => summarizePlan(profile, slots, dwell), [profile, slots, dwell])
  const [openSlot, setOpenSlot] = useState<string | null>(null)

  if (!profileComplete) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center px-4">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mx-auto mb-5 bg-green-100 text-green-800">
          🧭
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Build Your Profile First</h2>
        <p className="text-gray-600 mb-6">
          The Career Planner uses your rank, MOS, TIG, PME status, and home city to suggest
          positions and timing at each step. Complete your profile to start planning.
        </p>
        <Link href="/profile" className="inline-block px-6 py-3 rounded-lg text-white font-semibold"
          style={{ backgroundColor: '#1B4F2A' }}>
          Build My Profile →
        </Link>
      </div>
    )
  }

  const atCeiling = slots.length === 0
  const commissionGradeOptions = ENLISTED_RANKS.filter(r => (RANK_NUM[r] ?? 0) >= (RANK_NUM[profile.rank] ?? 0))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-4xl mx-auto flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1B4F2A' }}>Career Planner</h1>
            <p className="text-sm text-gray-500 mt-1">
              Game-plan your path to 20 years and beyond. Swap real MTARNG positions, set how long you
              stay in each one, and branch into the officer or warrant track if you commission.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { resetPlan(); setOpenSlot(null) }}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 font-medium"
            >
              ↺ Reset Plan
            </button>
            <Link href="/ai-mentor"
              className="px-4 py-2 rounded-lg text-sm text-white font-medium"
              style={{ backgroundColor: '#1B4F2A' }}>
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
          <div className="max-w-4xl mx-auto">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500 uppercase font-semibold mb-2">Career Track</div>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: 'current', label: 'Stay Enlisted', icon: '🎖️' },
                  { key: 'ocs', label: 'Commission via OCS → Officer', icon: '🎓' },
                  { key: 'wocs', label: 'Warrant via WOCS', icon: '🔧' },
                ] as { key: PlannerTrack; label: string; icon: string }[]).map(t => (
                  <button
                    key={t.key}
                    onClick={() => { setTrack(t.key); setOpenSlot(null) }}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium border transition',
                      track === t.key
                        ? 'border-green-500 bg-green-50 text-green-800 ring-1 ring-green-300'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {track !== 'current' && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                  <span>Commission after reaching</span>
                  <select
                    value={effectiveCommissionGrade}
                    onChange={e => { setCommissionAfterGrade(e.target.value); setOpenSlot(null) }}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700"
                  >
                    {commissionGradeOptions.map(r => (
                      <option key={r} value={r}>{r}{r === profile.rank ? ' (now)' : ''}</option>
                    ))}
                  </select>
                  <span className="text-gray-500">
                    — then plan {track === 'ocs' ? 'officer' : 'warrant'} positions from there.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan summary */}
      {!atCeiling && (
        <div className="px-8 pt-5">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex flex-wrap items-center gap-x-8 gap-y-3">
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
                <div className="text-xs text-green-700 uppercase font-semibold">20-Yr Eligible</div>
                <div className="text-lg font-bold text-green-900">~{summary.retirementYear}</div>
              </div>
              <div>
                <div className="text-xs text-green-700 uppercase font-semibold">Schools Left</div>
                <div className="text-lg font-bold text-green-900">
                  {summary.pmeRemaining.length === 0 ? 'None' : summary.pmeRemaining.join(', ')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="px-8 py-6">
        <div className="max-w-4xl mx-auto">
          {atCeiling ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-600">
              You&apos;re at the top of the {profile.careerCategory.toLowerCase()} grade structure ({profile.rank}).
              There&apos;s no higher grade to plan toward — focus on capstone assignments and mentoring.
              Explore lateral moves on the{' '}
              <Link href="/matches" className="underline text-green-700">Matches</Link> page.
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-gray-200" />

              <div className="space-y-4">
                {/* NOW node */}
                <div className="relative flex gap-5 items-start">
                  <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-xl z-10 border-2 border-white shadow bg-green-600">
                    📍
                  </div>
                  <div className="flex-1 rounded-xl border border-green-300 bg-green-50 p-4 shadow-sm">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs px-2 py-0.5 rounded font-semibold bg-green-100 text-green-800">NOW</span>
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono font-bold">{profile.rank}</span>
                    </div>
                    <h3 className="font-bold text-base text-green-900">{profile.dutyTitle || 'Current Position'}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {profile.unitName || 'Current unit'} · {profile.unitCity || profile.homeCity} ·{' '}
                      {profile.yearsOfService} yrs service, {profile.timeInGrade} yrs TIG
                    </p>
                  </div>
                </div>

                {/* Slots */}
                {slots.map(slot => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    enterYear={CURRENT_YEAR + Math.round(timeline[slot.id]?.enterYears ?? 0)}
                    tisYears={Math.round(timeline[slot.id]?.tisYears ?? 0)}
                    dwellYears={dwellFor(slot, dwell)}
                    selected={getSlotSelection(slot, selections)}
                    isOpen={openSlot === slot.id}
                    onToggle={() => setOpenSlot(o => (o === slot.id ? null : slot.id))}
                    onPick={(posId) => setSelection(slot.id, posId)}
                    onDwell={(y) => setDwell(slot.id, y)}
                  />
                ))}

                {/* Horizon */}
                <div className="relative flex gap-5 items-start">
                  <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-xl z-10 border-2 border-white shadow bg-amber-500">
                    🏁
                  </div>
                  <div className="flex-1 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <h3 className="font-bold text-base text-amber-900">20+ Year Horizon</h3>
                    <p className="text-sm text-amber-800 mt-1">
                      Retirement eligibility around <strong>{summary.retirementYear}</strong>.
                      {summary.reaches20
                        ? ' This plan carries you past the 20-year mark — think about capstone assignments and a strong final evaluation.'
                        : ' Add longer dwell times or more steps to carry the plan past the 20-year retirement point.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <strong>How to use this:</strong> Pick the best-fit billet at each step, set how long you&apos;ll
            stay (the timeline shifts as you do), and complete the listed schools before each promotion.
            Enlisted soldiers can branch into the officer or warrant track via OCS/WOCS. Your plan saves
            automatically. Timing is estimated from typical ARNG windows (AR 600-8-19, AR 135-155,
            NGR 600-101) — verify specifics with your S1.
          </div>
        </div>
      </div>
    </div>
  )
}

function SlotCard({
  slot, enterYear, tisYears, dwellYears, selected, isOpen, onToggle, onPick, onDwell,
}: {
  slot: PlannerSlot
  enterYear: number
  tisYears: number
  dwellYears: number
  selected: ScoredPosition | null
  isOpen: boolean
  onToggle: () => void
  onPick: (positionId: number) => void
  onDwell: (years: number) => void
}) {
  const isCommission = slot.kind === 'commission'

  return (
    <div className="relative flex gap-5 items-start">
      {/* Dot */}
      <div className={cn(
        'w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-xl z-10 border-2 border-white shadow',
        isCommission ? 'bg-violet-500' : 'bg-blue-400'
      )}>
        {isCommission ? '🎓' : '⭐'}
      </div>

      {/* Card */}
      <div className={cn('flex-1 rounded-xl border p-4 shadow-sm', isCommission ? 'border-violet-200 bg-violet-50' : 'border-gray-200 bg-white')}>
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className={cn('text-xs px-2 py-0.5 rounded font-semibold', isCommission ? 'bg-violet-100 text-violet-700' : 'bg-blue-50 text-blue-700')}>
            ~{enterYear}
          </span>
          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono font-bold">{slot.grade}</span>
          <span className="text-xs text-gray-400">est. TIS ~{tisYears} yr</span>
          {isCommission && (
            <span className="text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold">
              {slot.commissionType} → {slot.category}
            </span>
          )}
        </div>

        {isCommission && (
          <p className="text-sm text-violet-900 mb-3">
            Commission via <strong>{slot.commissionType}</strong> and pin <strong>{slot.grade}</strong>,
            switching to the {slot.category.toLowerCase()} track. Plan your {slot.category.toLowerCase()} billets
            from here forward.
          </p>
        )}

        {/* PME chips */}
        {slot.pme.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-500 mr-1">Schools:</span>
            {slot.pme.map(p => (
              <span
                key={p.field}
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full border font-medium',
                  p.alreadyDone
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : p.required
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                )}
                title={p.alreadyDone ? 'Complete' : p.required ? 'Required before this step' : 'Recommended before this board'}
              >
                {p.alreadyDone ? '✓ ' : p.required ? '✗ ' : '○ '}{p.name}
              </span>
            ))}
          </div>
        )}

        {/* Time in position selector */}
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Time in this position:</span>
          <div className="flex gap-1">
            {DWELL_CHOICES.map(y => (
              <button
                key={y}
                onClick={() => onDwell(y)}
                className={cn(
                  'text-xs px-2 py-1 rounded border font-medium transition',
                  dwellYears === y
                    ? 'border-green-500 bg-green-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                {dwellLabel(y)}
              </button>
            ))}
          </div>
        </div>

        {/* Selected position */}
        {selected ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 text-sm">{selected.dutyTitle}</div>
                <div className="text-xs text-gray-600">{selected.unit} · {selected.city}</div>
              </div>
              <div className={cn('text-sm font-bold flex-shrink-0', scoreColor(selected.totalScore))}>
                {selected.totalScore}<span className="text-xs text-gray-400">/100</span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={cn('text-xs px-2 py-0.5 rounded', statusBadge(selected.statusType))}>{selected.statusType}</span>
              <span className={cn('text-xs px-2 py-0.5 rounded', vacancyBadge(selected.vacancyStatus))}>{selected.vacancyStatus}</span>
              {selected.isCommandOrKD && (
                <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800">KD/CMD</span>
              )}
              {selected.commuteMins >= 0 && (
                <span className="text-xs text-gray-500">🚗 {selected.commuteMins} min</span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-500">
            No {slot.grade} billets for this career field in the current dataset. Aim for a {slot.grade}{' '}
            leadership or staff role and check the Matches page as new vacancies post.
          </div>
        )}

        {/* Swap options */}
        {slot.options.length > 1 && (
          <>
            <button
              onClick={onToggle}
              className="mt-2 text-xs font-medium text-blue-700 hover:text-blue-800 flex items-center gap-1"
            >
              <span>{isOpen ? '▲' : '▼'}</span>
              <span>{isOpen ? 'Hide options' : `Swap position — ${slot.options.length} options`}</span>
            </button>

            {isOpen && (
              <div className="mt-2 space-y-2">
                {slot.options.map(opt => {
                  const isSelected = selected?.id === opt.id
                  const isSuggested = opt.id === slot.suggestedPositionId
                  return (
                    <button
                      key={opt.id}
                      onClick={() => onPick(opt.id)}
                      className={cn(
                        'w-full text-left rounded-lg border p-3 transition',
                        isSelected
                          ? 'border-green-400 bg-green-50 ring-1 ring-green-300'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{opt.dutyTitle}</span>
                            {isSuggested && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">Suggested</span>
                            )}
                            {isSelected && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-600 text-white font-medium">Selected ✓</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600">{opt.unit} · {opt.city}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className={cn('text-xs px-2 py-0.5 rounded', statusBadge(opt.statusType))}>{opt.statusType}</span>
                            <span className={cn('text-xs px-2 py-0.5 rounded', vacancyBadge(opt.vacancyStatus))}>{opt.vacancyStatus}</span>
                            {opt.isCommandOrKD && (
                              <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800">KD/CMD</span>
                            )}
                            {opt.commuteMins >= 0 && (
                              <span className="text-xs text-gray-500">🚗 {opt.commuteMins} min</span>
                            )}
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
    </div>
  )
}
