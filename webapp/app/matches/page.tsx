'use client'

import { useState, useMemo } from 'react'
import { useProfileStore } from '@/lib/store'
import { positions } from '@/lib/data/positions'
import { scoreAllPositions, scoreAlternatePaths, matchLabelColor, matchLabelDot, getBoardAlert, getPositionActionPlan } from '@/lib/scoring'
import { cn } from '@/lib/utils'
import type { ScoredPosition, MatchLabel, BoardAlert, SoldierProfile } from '@/lib/types'
import Link from 'next/link'

const MATCH_LABELS: MatchLabel[] = [
  'STRONG MATCH',
  'GOOD MATCH',
  'MODERATE / STRETCH',
  'POSSIBLE — GAPS EXIST',
  'NOT RECOMMENDED NOW',
]

function scoreBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-blue-500'
  if (score >= 40) return 'bg-yellow-500'
  return 'bg-red-400'
}

function commuteBadgeColor(mins: number): string {
  if (mins === 0) return 'bg-green-100 text-green-800'
  if (mins <= 60) return 'bg-blue-100 text-blue-800'
  if (mins <= 120) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

function vacancyBadgeColor(status: string): string {
  if (status === 'Vacant') return 'bg-green-100 text-green-800'
  if (status === 'Projected Vacant') return 'bg-amber-100 text-amber-800'
  return 'bg-gray-100 text-gray-500'
}

export default function MatchesPage() {
  const { profile } = useProfileStore()

  const scored = useMemo(() => scoreAllPositions(profile, positions), [profile])
  const alternatePaths = useMemo(() => scoreAlternatePaths(profile, positions), [profile])
  const boardAlert = useMemo(() => getBoardAlert(profile), [profile])
  const [showAlternate, setShowAlternate] = useState(false)

  const [filterCity, setFilterCity] = useState('')
  const [filterLabel, setFilterLabel] = useState('')
  const [filterVacancy, setFilterVacancy] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortBy, setSortBy] = useState('score')

  const cities = useMemo(() => [...new Set(positions.map(p => p.city))].sort(), [])

  const filtered = useMemo(() => {
    let list = [...scored]
    if (filterCity) list = list.filter(p => p.city === filterCity)
    if (filterLabel) list = list.filter(p => p.matchLabel === filterLabel)
    if (filterVacancy === 'Vacant & Projected Only') list = list.filter(p => p.vacancyStatus !== 'Filled')
    if (filterCategory) list = list.filter(p => p.careerCategory === filterCategory)
    if (filterStatus) list = list.filter(p => p.statusType === filterStatus || p.statusType === 'Multiple')
    if (sortBy === 'city') list.sort((a, b) => a.city.localeCompare(b.city))
    else if (sortBy === 'grade') list.sort((a, b) => a.grade.localeCompare(b.grade))
    // score sort is already default from scoreAllPositions
    return list
  }, [scored, filterCity, filterLabel, filterVacancy, filterCategory, filterStatus, sortBy])

  const strongMatches = scored.filter(p => p.matchLabel === 'STRONG MATCH').length
  const goodMatches = scored.filter(p => p.matchLabel === 'GOOD MATCH').length
  const vacantPositions = scored.filter(p => p.vacancyStatus !== 'Filled').length

  function resetFilters() {
    setFilterCity('')
    setFilterLabel('')
    setFilterVacancy('')
    setFilterCategory('')
    setFilterStatus('')
    setSortBy('score')
  }

  const selectClass =
    'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700'
  const labelClass = 'text-xs font-semibold text-gray-500 uppercase mb-1'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* A. Profile summary bar */}
      <div
        className="px-8 py-4 flex flex-wrap gap-6 items-center text-sm text-white"
        style={{ backgroundColor: '#1B4F2A' }}
      >
        <span>
          <span className="font-semibold">Rank:</span> {profile.rank}
        </span>
        <span>
          <span className="font-semibold">MOS:</span> {profile.mos}
        </span>
        <span>
          <span className="font-semibold">Home:</span> {profile.homeCity}
        </span>
        <span>
          <span className="font-semibold">Target:</span> {profile.targetRank}
        </span>
        <span>
          <span className="font-semibold">Goal:</span> {profile.primaryGoal}
        </span>
      </div>

      {/* B. Page header */}
      <div className="px-8 py-6 bg-white border-b">
        <h1 className="text-2xl font-bold" style={{ color: '#1B4F2A' }}>
          Position Matches
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Showing {filtered.length} of {scored.length} positions — sorted by match score
        </p>
      </div>

      {/* B2. Board alert banner */}
      {boardAlert && (
        <BoardAlertBanner alert={boardAlert} />
      )}

      {/* B3. MOS reclass callout */}
      {(profile.wantToSwitchMos === 'Yes' || profile.wantToSwitchMos === 'Considering it') && profile.targetMos && (
        <div className="px-8 py-3 border-b bg-violet-50 border-violet-200 border-l-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-base">🔄</span>
            <span className="text-sm text-violet-800">
              <strong>MOS Switch Goal:</strong> You&apos;re interested in reclassing to{' '}
              <strong>{profile.targetMos}</strong>. Positions in that MOS are highlighted below.
            </span>
            <Link href="/reclassification"
              className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-violet-700 text-white font-semibold whitespace-nowrap">
              Reclass Pathway →
            </Link>
          </div>
        </div>
      )}

      {/* C. Summary stats row */}
      <div className="px-8 py-4 bg-gray-50 border-b">
        <div className="flex flex-wrap gap-4">
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border text-center">
            <div className="text-xs text-gray-500 font-medium mb-1">Total Positions</div>
            <div className="text-2xl font-bold text-gray-900">{scored.length}</div>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border text-center">
            <div className="text-xs text-gray-500 font-medium mb-1">Strong Matches</div>
            <div className="text-2xl font-bold text-green-700">{strongMatches}</div>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border text-center">
            <div className="text-xs text-gray-500 font-medium mb-1">Good Matches</div>
            <div className="text-2xl font-bold text-blue-700">{goodMatches}</div>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border text-center">
            <div className="text-xs text-gray-500 font-medium mb-1">Vacant / Projected</div>
            <div className="text-2xl font-bold text-amber-600">{vacantPositions}</div>
          </div>
        </div>
      </div>

      {/* D. Filter bar */}
      <div className="px-8 py-4 bg-white border-b">
        <div className="flex flex-wrap gap-4 items-end">
          {/* City */}
          <div className="flex flex-col">
            <label className={labelClass}>City</label>
            <select
              className={selectClass}
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
            >
              <option value="">All Cities</option>
              {cities.map(city => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/* Match Level */}
          <div className="flex flex-col">
            <label className={labelClass}>Match Level</label>
            <select
              className={selectClass}
              value={filterLabel}
              onChange={e => setFilterLabel(e.target.value)}
            >
              <option value="">All Levels</option>
              {MATCH_LABELS.map(label => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Vacancy */}
          <div className="flex flex-col">
            <label className={labelClass}>Vacancy</label>
            <select
              className={selectClass}
              value={filterVacancy}
              onChange={e => setFilterVacancy(e.target.value)}
            >
              <option value="">All Positions</option>
              <option value="Vacant & Projected Only">Vacant &amp; Projected Only</option>
            </select>
          </div>



          {/* Status type filter */}
          <div className="flex flex-col">
            <label className={labelClass}>Status Type</label>
            <select
              className={selectClass}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="AGR">AGR Only</option>
              <option value="M-Day">M-Day Only</option>
              <option value="Technician">Technician Only</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex flex-col">
            <label className={labelClass}>Sort By</label>
            <select
              className={selectClass}
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="score">Score (Best First)</option>
              <option value="city">City</option>
              <option value="grade">Grade</option>
            </select>
          </div>

          {/* Reset */}
          <button
            className="text-sm text-gray-500 hover:text-red-600 underline ml-auto self-end pb-2"
            onClick={resetFilters}
            type="button"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* E. Position cards grid */}
      <div className="px-8 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-lg">
            No positions match your current filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(pos => (
              <PositionCard key={pos.id} pos={pos} profile={profile} />
            ))}
          </div>
        )}
      </div>

      {/* F. Alternate career paths (cross-category, only shown when applicable) */}
      {alternatePaths.length > 0 && (
        <div className="px-8 pb-8">
          <button
            type="button"
            onClick={() => setShowAlternate(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-900 font-semibold text-sm hover:bg-amber-100 transition"
          >
            <span>⚠️ Career Path Change Opportunities — {alternatePaths.length} positions require a category change (OCS / WOCS)</span>
            <span>{showAlternate ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showAlternate && (
            <div className="mt-4 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                <strong>These positions are NOT currently eligible for your career category.</strong> They are shown because you have expressed interest in changing your career track. Each requires a separate accession process before you can serve in that role.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {alternatePaths.map(pos => (
                  <PositionCard key={pos.id} pos={pos} profile={profile} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BoardAlertBanner({ alert }: { alert: BoardAlert }) {
  const colors = {
    critical: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', icon: '🚨' },
    warning:  { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', icon: '⚠️' },
    info:     { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', icon: '📋' },
  }[alert.urgencyLevel]

  return (
    <div className={cn('px-8 py-3 border-b', colors.bg, colors.border, 'border-l-4')}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="text-lg flex-shrink-0">{colors.icon}</span>
        <div className="flex-1 min-w-0">
          <span className={cn('font-semibold text-sm', colors.text)}>{alert.boardName} — </span>
          <span className={cn('text-sm', colors.text)}>{alert.message}</span>
          {alert.actions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
              {alert.actions.map((a, i) => (
                <span key={i} className={cn('text-xs px-2 py-0.5 rounded border', colors.bg, colors.border, colors.text)}>
                  → {a}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PositionCard({ pos, profile }: { pos: ScoredPosition; profile: SoldierProfile }) {
  const [showPlan, setShowPlan] = useState(false)
  const plan = useMemo(() => getPositionActionPlan(profile, pos), [profile, pos])
  const blockers = plan.filter(i => !i.done && i.priority === 'required').length
  const urgent = pos.vacancyStatus === 'Vacant'
  return (
    <div className="bg-white rounded-xl shadow border border-gray-200 p-5 hover:shadow-md transition">
      {/* Top row */}
      <div>
        <div className="font-bold text-gray-900 text-base truncate" title={pos.dutyTitle}>
          {pos.dutyTitle}
        </div>
        <div className="text-sm text-gray-600 mt-0.5 truncate" title={pos.unit}>
          {pos.unit}
        </div>
        <div className="text-sm text-gray-500">{pos.city}</div>
      </div>

      {/* Badges row */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded font-bold">
          {pos.grade}
        </span>
        <span className="bg-blue-50 text-blue-800 text-xs px-2 py-0.5 rounded">
          {pos.careerCategory}
        </span>
        {pos.isCommandOrKD && (
          <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded">
            KD/CMD
          </span>
        )}
        <span
          className={cn(
            vacancyBadgeColor(pos.vacancyStatus),
            'text-xs px-2 py-0.5 rounded'
          )}
        >
          {pos.vacancyStatus}
        </span>
      </div>

      {/* Match label */}
      <div className="mt-3">
        <span
          className={cn(
            matchLabelColor(pos.matchLabel),
            'border text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center'
          )}
        >
          <span
            className={cn(
              'w-2 h-2 rounded-full inline-block mr-1',
              matchLabelDot(pos.matchLabel)
            )}
          />
          {pos.matchLabel}
        </span>
      </div>

      {/* Score bar */}
      <div className="mt-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-500">Match Score</span>
          <span className="text-xs font-bold text-gray-800">{pos.totalScore}/100</span>
        </div>
        <div className="bg-gray-100 rounded-full h-2">
          <div
            className={cn('h-2 rounded-full', scoreBarColor(pos.totalScore))}
            style={{ width: `${pos.totalScore}%` }}
          />
        </div>
      </div>

      {/* Score breakdown */}
      <div className="mt-2 grid grid-cols-5 gap-1 text-center text-xs">
        <div>
          <div className="text-gray-500">Grade</div>
          <div className="font-medium text-gray-800">{pos.gradeScore}</div>
        </div>
        <div>
          <div className="text-gray-500">MOS</div>
          <div className="font-medium text-gray-800">{pos.mosScore}</div>
        </div>
        <div>
          <div className="text-gray-500">Commute</div>
          <div className="font-medium text-gray-800">{pos.commuteScore}</div>
        </div>
        <div>
          <div className="text-gray-500">Goal</div>
          <div className="font-medium text-gray-800">{pos.goalScore}</div>
        </div>
        <div>
          <div className="text-gray-500">Status</div>
          <div className="font-medium text-gray-800">{pos.statusScore}</div>
        </div>
      </div>

      {/* Commute row */}
      <div className="mt-3 flex gap-2 items-center text-xs">
        {pos.commuteMins === -1 ? (
          <span className="text-gray-400">🚗 Commute unknown</span>
        ) : (
          <>
            <span
              className={cn(
                commuteBadgeColor(pos.commuteMins),
                'px-2 py-0.5 rounded font-medium'
              )}
            >
              🚗 {pos.commuteMins} min
            </span>
            <span className="text-gray-500">{pos.commuteMiles} mi</span>
          </>
        )}
      </div>

      {/* Notes */}
      {pos.notes && (
        <div className="mt-2 text-xs text-gray-500 italic">
          {pos.notes.length > 80 ? pos.notes.slice(0, 80) + '…' : pos.notes}
        </div>
      )}

      {/* Cross-category path note */}
      {pos.pathNote && (
        <div className="mt-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          ⚠️ {pos.pathNote}
        </div>
      )}

      {/* Action plan toggle */}
      <div className="mt-3 border-t border-gray-100 pt-2">
        <button
          type="button"
          onClick={() => setShowPlan(v => !v)}
          className={cn(
            'text-xs w-full text-left flex items-center gap-1.5 font-medium',
            urgent ? 'text-green-700 hover:text-green-800' :
            blockers > 0 ? 'text-orange-700 hover:text-orange-800' :
            'text-blue-700 hover:text-blue-800'
          )}
        >
          <span>{showPlan ? '▲' : '▼'}</span>
          <span>
            {urgent ? '🟢 Vacant — What do I need to apply?' :
             blockers > 0 ? `⚠ ${blockers} step${blockers > 1 ? 's' : ''} needed — What do I need?` :
             '✓ You qualify — see action plan'}
          </span>
        </button>
        {showPlan && (
          <div className="mt-2 space-y-1.5">
            {plan.map((item, i) => {
              const rowStyle = item.done
                ? 'bg-green-50 border-green-200 text-green-800'
                : item.priority === 'required'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : item.priority === 'recommended'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
              return (
                <div key={i} className={cn('text-xs border rounded px-2 py-1.5', rowStyle)}>
                  <div className="flex items-start gap-1.5">
                    <span className="flex-shrink-0 mt-0.5">{item.done ? '✓' : item.priority === 'required' ? '✗' : '○'}</span>
                    <div>
                      <div className="font-semibold">{item.label}</div>
                      <div className="opacity-80 mt-0.5">{item.detail}</div>
                      {item.timeline && !item.done && (
                        <div className="mt-0.5 opacity-70 italic">Timeline: {item.timeline}</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
