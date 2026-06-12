'use client'

import { useState, useMemo } from 'react'
import { useProfileStore } from '@/lib/store'
import { positions } from '@/lib/data/positions'
import { scoreAllPositions, matchLabelColor, matchLabelDot } from '@/lib/scoring'
import { cn } from '@/lib/utils'
import type { ScoredPosition, MatchLabel } from '@/lib/types'

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

          {/* Category */}
          <div className="flex flex-col">
            <label className={labelClass}>Category</label>
            <select
              className={selectClass}
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="Enlisted">Enlisted</option>
              <option value="Officer">Officer</option>
              <option value="Warrant">Warrant</option>
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
              <PositionCard key={pos.id} pos={pos} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PositionCard({ pos }: { pos: ScoredPosition }) {
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
    </div>
  )
}
