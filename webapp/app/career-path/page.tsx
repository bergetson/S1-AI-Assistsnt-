'use client'

import { useMemo } from 'react'
import { useProfileStore } from '@/lib/store'
import { buildCareerPath } from '@/lib/scoring'
import { cn } from '@/lib/utils'
import type { CareerStep } from '@/lib/types'
import Link from 'next/link'

const CURRENT_YEAR = new Date().getFullYear()

function stepTypeIcon(type: CareerStep['type']): string {
  switch (type) {
    case 'promotion':  return '⭐'
    case 'pme':        return '📚'
    case 'assignment': return '📌'
    case 'milestone':  return '🏁'
  }
}

function stepColors(status: CareerStep['status']) {
  switch (status) {
    case 'done':    return { dot: 'bg-gray-400', card: 'bg-gray-50 border-gray-200', text: 'text-gray-500', badge: 'bg-gray-100 text-gray-500' }
    case 'current': return { dot: 'bg-green-600', card: 'bg-green-50 border-green-300', text: 'text-green-800', badge: 'bg-green-100 text-green-800' }
    case 'next':    return { dot: 'bg-amber-500', card: 'bg-amber-50 border-amber-300', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-800' }
    case 'future':  return { dot: 'bg-blue-400', card: 'bg-white border-gray-200', text: 'text-gray-700', badge: 'bg-blue-50 text-blue-700' }
  }
}

function stepTypeLabel(type: CareerStep['type']): string {
  switch (type) {
    case 'promotion':  return 'Promotion'
    case 'pme':        return 'PME School'
    case 'assignment': return 'Assignment'
    case 'milestone':  return 'Milestone'
  }
}

export default function CareerPathPage() {
  const { profile, profileComplete } = useProfileStore()
  const steps = useMemo(() => buildCareerPath(profile), [profile])

  if (!profileComplete) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center px-4">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mx-auto mb-5 bg-green-100 text-green-800">
          🗺️
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Build Your Profile First</h2>
        <p className="text-gray-600 mb-6">
          Your career path is generated from your rank, MOS, TIG, PME status, and goals.
          Complete your profile to see your personalized roadmap.
        </p>
        <Link href="/profile" className="inline-block px-6 py-3 rounded-lg text-white font-semibold"
          style={{ backgroundColor: '#1B4F2A' }}>
          Build My Profile →
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-4xl mx-auto flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1B4F2A' }}>Career Path Sequencer</h1>
            <p className="text-sm text-gray-500 mt-1">
              Personalized roadmap from {profile.rank} → {profile.targetRank} based on your profile, TIG, and PME status
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/career-brief"
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 font-medium">
              🖨️ Career Brief
            </Link>
            <Link href="/planner"
              className="px-4 py-2 rounded-lg text-sm text-white font-medium"
              style={{ backgroundColor: '#1B4F2A' }}>
              🧭 Customize in Planner
            </Link>
          </div>
        </div>
      </div>

      {/* Profile context bar */}
      <div className="px-8 py-3 bg-white border-b text-sm text-gray-600 flex flex-wrap gap-4">
        <div className="max-w-4xl mx-auto flex flex-wrap gap-6 w-full">
          <span><strong>Rank:</strong> {profile.rank}</span>
          <span><strong>TIG:</strong> {profile.timeInGrade} yrs</span>
          <span><strong>MOS:</strong> {profile.mos}</span>
          <span><strong>TIS:</strong> {profile.yearsOfService} yrs</span>
          <span><strong>Target:</strong> {profile.targetRank} in {profile.targetTimeline} yrs</span>
          <span><strong>Goal:</strong> {profile.primaryGoal}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="px-8 pt-5 pb-2">
        <div className="max-w-4xl mx-auto flex flex-wrap gap-4 text-xs">
          {(['current', 'next', 'future'] as const).map(s => {
            const c = stepColors(s)
            const labels = { current: 'Current Status', next: 'Next Step', future: 'Upcoming' }
            return (
              <div key={s} className="flex items-center gap-1.5">
                <div className={cn('w-3 h-3 rounded-full', c.dot)} />
                <span className="text-gray-600">{labels[s]}</span>
              </div>
            )
          })}
          <div className="flex items-center gap-1.5 ml-4">
            <span>⭐ Promotion</span>
            <span className="ml-2">📚 PME</span>
            <span className="ml-2">📌 Assignment</span>
            <span className="ml-2">🏁 Milestone</span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-8 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-gray-200" />

            <div className="space-y-4">
              {steps.map((step, idx) => {
                const c = stepColors(step.status)
                const estYear = CURRENT_YEAR + step.year
                return (
                  <div key={step.id} className="relative flex gap-5 items-start">
                    {/* Dot */}
                    <div className={cn(
                      'w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-xl z-10 border-2 border-white shadow',
                      c.dot
                    )}>
                      <span>{stepTypeIcon(step.type)}</span>
                    </div>

                    {/* Card */}
                    <div className={cn('flex-1 rounded-xl border p-4 shadow-sm', c.card)}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={cn('text-xs px-2 py-0.5 rounded font-semibold', c.badge)}>
                              {step.status === 'current' ? 'NOW' : step.status === 'next' ? 'NEXT' : `~${estYear}`}
                            </span>
                            <span className="text-xs text-gray-400">{stepTypeLabel(step.type)}</span>
                            {step.grade && (
                              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono font-bold">
                                {step.grade}
                              </span>
                            )}
                          </div>
                          <h3 className={cn('font-bold text-base', c.text)}>{step.title}</h3>
                          <p className="text-sm text-gray-600 mt-1 leading-relaxed">{step.description}</p>
                        </div>

                        {step.status === 'next' && (
                          <Link href="/matches"
                            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg text-white font-semibold whitespace-nowrap"
                            style={{ backgroundColor: '#1B4F2A' }}>
                            Find Positions →
                          </Link>
                        )}
                        {step.type === 'pme' && step.status !== 'done' && (
                          <Link href="/timeline"
                            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-blue-300 text-blue-700 font-semibold whitespace-nowrap">
                            PME Details →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom note */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <strong>Note:</strong> Years are estimates based on typical ARNG promotion timelines (AR 600-8-19, AR 135-155, NGR 600-101).
            Actual timelines depend on vacancy, board selection, and individual circumstances.
            Consult your S1 or unit retention NCO for your specific situation.
          </div>
        </div>
      </div>
    </div>
  )
}
