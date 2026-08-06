'use client'

import { useProfileStore } from '@/lib/store'
import { positions } from '@/lib/data/positions'
import { scoreAllPositions } from '@/lib/scoring'
import { commuteCategory, commuteColor } from '@/lib/data/cities'
import { useState, useMemo } from 'react'

const COMMUTE_LIMIT_MINS: Record<string, number> = {
  '30 Minutes': 30,
  '1 Hour': 60,
  '1.5 Hours': 90,
  '2 Hours': 120,
  '3 Hours': 180,
  'No Limit': 9999,
}

type CommuteCategoryValue = 'Same City' | 'Short' | 'Medium' | 'Long' | 'Very Long'
type FilterCategory = '' | CommuteCategoryValue
type FilterWithin = '' | 'Within Max' | 'Exceeds Max'
type FilterCareer = '' | 'Enlisted' | 'Officer' | 'Warrant'
type SortCol = 'commute' | 'city' | 'score'
type SortDir = 'asc' | 'desc'

export default function CommutePage() {
  const { profile } = useProfileStore()

  const scored = useMemo(() => scoreAllPositions(profile, positions), [profile])

  const maxMins = COMMUTE_LIMIT_MINS[profile.maxCommute] ?? 120

  const rows = useMemo(() => scored.map(pos => {
    const cat = pos.commuteMins >= 0 ? commuteCategory(pos.commuteMins) : 'Unknown'
    const withinMax = pos.commuteMins >= 0 && pos.commuteMins <= maxMins
    const roundTrip = pos.commuteMins >= 0 ? pos.commuteMins * 2 : -1
    const drillBurden = pos.commuteMins >= 0 ? pos.commuteMins * 4 : -1
    return { ...pos, cat, withinMax, roundTrip, drillBurden }
  }), [scored, maxMins])

  const [filterCategory, setFilterCategory] = useState<FilterCategory>('')
  const [filterWithin, setFilterWithin] = useState<FilterWithin>('')
  const [filterCareer, setFilterCareer] = useState<FilterCareer>('')
  const [sortCol, setSortCol] = useState<SortCol>('commute')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const filtered = useMemo(() => {
    let list = [...rows]
    if (filterCategory) list = list.filter(r => r.cat === filterCategory)
    if (filterWithin === 'Within Max') list = list.filter(r => r.withinMax)
    if (filterWithin === 'Exceeds Max') list = list.filter(r => !r.withinMax && r.commuteMins >= 0)
    if (filterCareer) list = list.filter(r => r.careerCategory === filterCareer)
    if (sortCol === 'commute') list.sort((a, b) => sortDir === 'asc' ? a.commuteMins - b.commuteMins : b.commuteMins - a.commuteMins)
    else if (sortCol === 'city') list.sort((a, b) => a.city.localeCompare(b.city))
    else if (sortCol === 'score') list.sort((a, b) => b.totalScore - a.totalScore)
    return list
  }, [rows, filterCategory, filterWithin, filterCareer, sortCol, sortDir])

  const withinCount = rows.filter(r => r.withinMax).length
  const positiveMinsRows = rows.filter(r => r.commuteMins > 0)
  const avgCommute = positiveMinsRows.length > 0
    ? Math.round(positiveMinsRows.reduce((sum, r) => sum + r.commuteMins, 0) / positiveMinsRows.length)
    : 0
  const nearestCity = rows
    .filter(r => r.commuteMins >= 0)
    .sort((a, b) => a.commuteMins - b.commuteMins)[0]?.city

  const legendItems: { label: string; cat: CommuteCategoryValue }[] = [
    { label: 'Same City', cat: 'Same City' },
    { label: 'Short ≤30min', cat: 'Short' },
    { label: 'Medium ≤90min', cat: 'Medium' },
    { label: 'Long ≤3hr', cat: 'Long' },
    { label: 'Very Long >3hr', cat: 'Very Long' },
  ]

  function handleSortChange(value: string) {
    if (value === 'commute-asc') { setSortCol('commute'); setSortDir('asc') }
    else if (value === 'commute-desc') { setSortCol('commute'); setSortDir('desc') }
    else if (value === 'city') { setSortCol('city'); setSortDir('asc') }
    else if (value === 'score') { setSortCol('score'); setSortDir('desc') }
  }

  function currentSortValue(): string {
    if (sortCol === 'commute' && sortDir === 'asc') return 'commute-asc'
    if (sortCol === 'commute' && sortDir === 'desc') return 'commute-desc'
    if (sortCol === 'city') return 'city'
    if (sortCol === 'score') return 'score'
    return 'commute-asc'
  }

  return (
    <div className="min-h-screen bg-gray-100">

      {/* A. Profile Bar */}
      <div
        className="flex flex-wrap gap-6 px-8 py-4 text-sm text-white"
        style={{ backgroundColor: '#1B4F2A' }}
      >
        <span><span className="font-semibold">Home City:</span> {profile.homeCity || 'Not set'}</span>
        <span><span className="font-semibold">Max Commute:</span> {profile.maxCommute || 'Not set'}</span>
        <span><span className="font-semibold">Willing to Relocate:</span> {profile.willingToRelocate || 'Not set'}</span>
      </div>

      {/* B. Page Header */}
      <div className="px-8 py-6 bg-white border-b">
        <h1 className="text-2xl font-bold" style={{ color: '#1B4F2A' }}>Commute Analysis</h1>
        <p className="mt-1 text-sm text-gray-500">
          One-way drive times and distances from {profile.homeCity || 'your home city'} to all MTARNG positions
        </p>
      </div>

      {/* C. Legend */}
      <div className="px-8 py-4 bg-gray-50 border-b">
        <p className="text-sm font-semibold text-gray-600 mb-2">Commute Categories</p>
        <div className="flex flex-wrap gap-2">
          {legendItems.map(item => (
            <span
              key={item.cat}
              className={`rounded-full px-3 py-1 text-xs font-medium ${commuteColor(item.cat)}`}
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* D. Summary Stats */}
      <div className="px-8 py-4 bg-white border-b">
        <div className="flex flex-wrap gap-4">
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border text-center min-w-[140px]">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Within My Limit</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{withinCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">of {rows.length} positions</p>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border text-center min-w-[140px]">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Average Commute</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{avgCommute} min</p>
            <p className="text-xs text-gray-400 mt-0.5">one-way</p>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border text-center min-w-[140px]">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Max Commute</p>
            <p className="text-2xl font-bold text-gray-700 mt-1">{profile.maxCommute || '–'}</p>
            <p className="text-xs text-gray-400 mt-0.5">preference</p>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border text-center min-w-[140px]">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Nearest City</p>
            <p className="text-2xl font-bold text-gray-700 mt-1 text-sm leading-tight">{nearestCity || 'N/A'}</p>
            <p className="text-xs text-gray-400 mt-0.5">with positions</p>
          </div>
        </div>
      </div>

      {/* E. Filter Bar */}
      <div className="px-8 py-4 bg-white border-b">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Commute Category
            </label>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as FilterCategory)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="">All</option>
              <option value="Same City">Same City</option>
              <option value="Short">Short</option>
              <option value="Medium">Medium</option>
              <option value="Long">Long</option>
              <option value="Very Long">Very Long</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Within Limit?
            </label>
            <select
              value={filterWithin}
              onChange={e => setFilterWithin(e.target.value as FilterWithin)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="">All</option>
              <option value="Within Max">Within Max</option>
              <option value="Exceeds Max">Exceeds Max</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Career Category
            </label>
            <select
              value={filterCareer}
              onChange={e => setFilterCareer(e.target.value as FilterCareer)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="">All</option>
              <option value="Enlisted">Enlisted</option>
              <option value="Officer">Officer</option>
              <option value="Warrant">Warrant</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Sort By
            </label>
            <select
              value={currentSortValue()}
              onChange={e => handleSortChange(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="commute-asc">Commute Time (asc)</option>
              <option value="commute-desc">Commute Time (desc)</option>
              <option value="city">City A–Z</option>
              <option value="score">Match Score</option>
            </select>
          </div>

          <div className="ml-auto self-center">
            <p className="text-sm text-gray-500">Showing {filtered.length} positions</p>
          </div>
        </div>
      </div>

      {/* F. Table */}
      <div className="px-8 py-6">
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Unit
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  City
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Duty Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Grade
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  One-Way
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Miles
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Round Trip
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Drill WE
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Within Max?
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No positions match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => {
                  const rowBg = r.commuteMins < 0
                    ? 'bg-white'
                    : r.withinMax
                      ? ''
                      : 'bg-red-50/30'

                  return (
                    <tr key={`${r.unit}-${r.dutyTitle}-${idx}`} className={`hover:bg-gray-50 ${rowBg}`}>
                      {/* Unit */}
                      <td className="px-4 py-3">
                        <div className="text-gray-900 font-medium">{r.unit}</div>
                        <div className="text-xs text-gray-500">{r.mos}</div>
                      </td>

                      {/* City */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">{r.city}</span>
                      </td>

                      {/* Duty Title */}
                      <td className="px-4 py-3 text-gray-700">{r.dutyTitle}</td>

                      {/* Grade */}
                      <td className="px-4 py-3">
                        <span className="bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded font-bold">
                          {r.grade}
                        </span>
                      </td>

                      {/* One-Way */}
                      <td className="px-4 py-3 text-gray-700">
                        {r.commuteMins >= 0 ? `${r.commuteMins} min` : '–'}
                      </td>

                      {/* Miles */}
                      <td className="px-4 py-3 text-gray-700">
                        {r.commuteMiles >= 0 ? `${r.commuteMiles} mi` : '–'}
                      </td>

                      {/* Round Trip */}
                      <td className="px-4 py-3 text-gray-700">
                        {r.roundTrip >= 0 ? `${r.roundTrip} min` : '–'}
                      </td>

                      {/* Drill WE */}
                      <td className="px-4 py-3 text-gray-700">
                        {r.drillBurden >= 0 ? (
                          <div>
                            <div>{r.drillBurden} min</div>
                            <div className="text-xs text-gray-500">
                              ({Math.round(r.drillBurden / 60 * 10) / 10} hr)
                            </div>
                          </div>
                        ) : '–'}
                      </td>

                      {/* Within Max? */}
                      <td className="px-4 py-3">
                        {r.commuteMins < 0 ? (
                          <span className="text-gray-400">–</span>
                        ) : r.withinMax ? (
                          <span className="text-green-700 font-semibold">✓ Yes</span>
                        ) : (
                          <span className="text-red-600">✗ No</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        {r.cat !== 'Unknown' ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${commuteColor(r.cat as CommuteCategoryValue)}`}>
                            {r.cat}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Unknown</span>
                        )}
                      </td>

                      {/* Score */}
                      <td className="px-4 py-3 text-gray-700">{r.totalScore}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
