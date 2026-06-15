'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useProfileStore } from '@/lib/store'
import { getPmeGaps } from '@/lib/scoring'
import type { CareerCategory } from '@/lib/types'

const RANK_NUM: Record<string, number> = {
  E1:1,  E2:2,  E3:3,  E4:4,  E5:5,  E6:6,  E7:7,  E8:8,  E9:9,
  W1:10, W2:11, W3:12, W4:13, W5:14,
  O1:15, O2:16, O3:17, O4:18, O5:19, O6:20,
}

// ── Phase types ───────────────────────────────────────────────────────────────
interface Phase {
  rank: string
  title: string
  years: string
  pme: string
  role: string
  keyActions: string[]
  color: string
}

// ── Hardcoded phase arrays ────────────────────────────────────────────────────
const ENLISTED_PHASES: Phase[] = [
  {
    rank: 'E1-E4',
    title: 'Junior Enlisted',
    years: '0-4 years',
    pme: 'SSD1 / PLDC',
    role: 'Team Member / Driver / Specialist',
    keyActions: [
      'Complete SSD1',
      'Earn first NCOER',
      'Qualify Expert on weapon',
      'Build PT base',
    ],
    color: 'bg-gray-100 border-gray-300',
  },
  {
    rank: 'E5',
    title: 'Staff Sergeant (SGT)',
    years: '3-6 years',
    pme: 'BLC Required',
    role: 'Team Leader / Section NCOIC',
    keyActions: [
      'Complete BLC',
      'Serve as Team Leader',
      'Complete SSD2',
      'Apply for ALC',
    ],
    color: 'bg-blue-50 border-blue-300',
  },
  {
    rank: 'E6',
    title: 'Staff Sergeant (SSG)',
    years: '5-10 years',
    pme: 'ALC Required',
    role: 'Squad Leader / Staff NCOIC',
    keyActions: [
      'Complete ALC',
      'Hold KD Squad Leader position',
      'Pursue AGR opportunity',
      'Apply for SLC',
    ],
    color: 'bg-green-50 border-green-300',
  },
  {
    rank: 'E7',
    title: 'Sergeant First Class (SFC)',
    years: '8-15 years',
    pme: 'SLC Required',
    role: 'Platoon Sergeant / NCOIC',
    keyActions: [
      'Complete SLC',
      'Serve as Platoon Sergeant or staff SGM',
      'Consider AGR or Technician',
      'Mentor junior NCOs',
    ],
    color: 'bg-yellow-50 border-yellow-300',
  },
  {
    rank: 'E8',
    title: 'Master Sergeant / 1SG',
    years: '12-20 years',
    pme: 'SMC (optional)',
    role: '1SG or MSG Staff',
    keyActions: [
      'Compete for 1SG (command track)',
      'Or MSG staff track',
      'Consider SMC',
      'Build senior leader network',
    ],
    color: 'bg-orange-50 border-orange-300',
  },
  {
    rank: 'E9',
    title: 'Sergeant Major / CSM',
    years: '18-30 years',
    pme: 'SMC / ISS',
    role: 'CSM or SGM (State/BN level)',
    keyActions: [
      'CSM or SGM track',
      'State-level HQ',
      'Mentor all NCOs',
      'Legacy and retirement planning',
    ],
    color: 'bg-red-50 border-red-300',
  },
]

const OFFICER_PHASES: Phase[] = [
  {
    rank: 'O1-O2',
    title: '2LT / 1LT',
    years: '0-4 years',
    pme: 'BOLC Required',
    role: 'Platoon Leader / Staff',
    keyActions: [
      'Complete BOLC within 12 months',
      'Serve as PL or XO',
      'Complete OER',
      'Build battalion relationships',
    ],
    color: 'bg-gray-100 border-gray-300',
  },
  {
    rank: 'O3',
    title: 'Captain (CPT)',
    years: '3-8 years',
    pme: 'CCC Required',
    role: 'Company Commander / Staff',
    keyActions: [
      'Complete CCC',
      'Compete for Company Command',
      'KD staff tour (S3/S4/S6)',
      'Build battalion-level network',
    ],
    color: 'bg-blue-50 border-blue-300',
  },
  {
    rank: 'O4',
    title: 'Major (MAJ)',
    years: '8-14 years',
    pme: 'ILE Required',
    role: 'BN XO / Staff / Branch Chief',
    keyActions: [
      'Complete ILE',
      'BN XO or staff position',
      'MTARNG G-staff opportunities',
      'Consider AGR full-time',
    ],
    color: 'bg-green-50 border-green-300',
  },
  {
    rank: 'O5',
    title: 'Lieutenant Colonel (LTC)',
    years: '13-20 years',
    pme: 'SSC (competitive)',
    role: 'BN CDR / G-Staff Director',
    keyActions: [
      'Compete for BN Command',
      'Apply for SSC',
      'MTARNG HQ positions',
      'Flag officer prep',
    ],
    color: 'bg-yellow-50 border-yellow-300',
  },
  {
    rank: 'O6',
    title: 'Colonel (COL)',
    years: '18-30 years',
    pme: 'SSC Complete',
    role: 'BDE CDR / State HQ',
    keyActions: [
      'BDE Command or HQ',
      'MTARNG senior leader',
      'Flag officer selection board',
      'Legacy leadership',
    ],
    color: 'bg-orange-50 border-orange-300',
  },
]

const WARRANT_PHASES: Phase[] = [
  {
    rank: 'W1',
    title: 'Warrant Officer 1',
    years: '0-2 years',
    pme: 'WOBC Required',
    role: 'Technical Expert / Advisor',
    keyActions: [
      'Complete WOBC within 24 months',
      'Build technical expertise',
      'Mentor relationship with CW3+',
      'Earn first WOER',
    ],
    color: 'bg-gray-100 border-gray-300',
  },
  {
    rank: 'W2',
    title: 'Chief Warrant Officer 2',
    years: '2-6 years',
    pme: 'WOAC Required',
    role: 'Technical Specialist / Section OIC',
    keyActions: [
      'Complete WOAC',
      'Section OIC or advisor',
      'Technical certifications',
      'Apply for CW3 board',
    ],
    color: 'bg-blue-50 border-blue-300',
  },
  {
    rank: 'W3',
    title: 'Chief Warrant Officer 3',
    years: '5-12 years',
    pme: 'WOILE (optional)',
    role: 'Technical Integrator / Staff Advisor',
    keyActions: [
      'Consider WOILE',
      'Battalion-level advisor',
      'Mentor W1/W2 Soldiers',
      'Senior technical role',
    ],
    color: 'bg-green-50 border-green-300',
  },
  {
    rank: 'W4',
    title: 'Chief Warrant Officer 4',
    years: '10-20 years',
    pme: 'WOSSE (optional)',
    role: 'Senior Technical Expert',
    keyActions: [
      'Senior advisor to commanders',
      'WOSSE consideration',
      'MTARNG HQ technical roles',
      'Program manager roles',
    ],
    color: 'bg-yellow-50 border-yellow-300',
  },
  {
    rank: 'W5',
    title: 'Chief Warrant Officer 5',
    years: '18-30 years',
    pme: 'WOSSE',
    role: 'Army Proponent / Master Expert',
    keyActions: [
      'State-level technical authority',
      'Proponent school connections',
      'Final career capstone',
      'Legacy and retirement',
    ],
    color: 'bg-orange-50 border-orange-300',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCurrentPhaseIndex(rank: string, category: CareerCategory): number {
  const n = RANK_NUM[rank] ?? 0

  if (category === 'Enlisted') {
    if (n <= 4) return 0  // E1-E4
    if (n === 5) return 1 // E5
    if (n === 6) return 2 // E6
    if (n === 7) return 3 // E7
    if (n === 8) return 4 // E8
    if (n === 9) return 5 // E9
    return 0
  }

  if (category === 'Officer') {
    if (n <= 16) return 0 // O1-O2
    if (n === 17) return 1 // O3
    if (n === 18) return 2 // O4
    if (n === 19) return 3 // O5
    if (n === 20) return 4 // O6
    return 0
  }

  // Warrant
  if (n === 10) return 0 // W1
  if (n === 11) return 1 // W2
  if (n === 12) return 2 // W3
  if (n === 13) return 3 // W4
  if (n === 14) return 4 // W5
  return 0
}

function getPhasesForCategory(category: CareerCategory): Phase[] {
  if (category === 'Enlisted') return ENLISTED_PHASES
  if (category === 'Officer') return OFFICER_PHASES
  return WARRANT_PHASES
}

function getNextPme(profile: { careerCategory: CareerCategory; rank: string; blcComplete: boolean; alcComplete: boolean; slcComplete: boolean; bolcComplete: boolean; cccComplete: boolean; ileComplete: boolean; wobcComplete: boolean; woacComplete: boolean }): string {
  if (profile.careerCategory === 'Enlisted') {
    if (!profile.blcComplete) return 'BLC'
    if (!profile.alcComplete) return 'ALC'
    if (!profile.slcComplete) return 'SLC'
    return 'SMC'
  }
  if (profile.careerCategory === 'Officer') {
    if (!profile.bolcComplete) return 'BOLC'
    if (!profile.cccComplete) return 'CCC'
    if (!profile.ileComplete) return 'ILE'
    return 'SSC'
  }
  // Warrant
  if (!profile.wobcComplete) return 'WOBC'
  if (!profile.woacComplete) return 'WOAC'
  return 'WOILE'
}

function getNextRole(profile: { careerCategory: CareerCategory; rank: string }): string {
  const n = RANK_NUM[profile.rank] ?? 0
  if (profile.careerCategory === 'Enlisted') {
    if (n <= 4) return 'Team Leader'
    if (n === 5) return 'Squad Leader'
    if (n === 6) return 'Platoon Sergeant'
    if (n === 7) return 'First Sergeant or MSG Staff'
    if (n === 8) return 'CSM or SGM'
    return 'Senior SGM'
  }
  if (profile.careerCategory === 'Officer') {
    if (n <= 16) return 'Platoon Leader / XO'
    if (n === 17) return 'Company Commander'
    if (n === 18) return 'BN XO or Staff'
    if (n === 19) return 'Battalion Commander'
    return 'BDE Commander'
  }
  // Warrant
  if (n === 10) return 'Section OIC / Technical Advisor'
  if (n === 11) return 'Battalion-Level Technical Advisor'
  if (n === 12) return 'Senior Technical Advisor'
  if (n === 13) return 'Program Manager / HQ Advisor'
  return 'State Technical Authority'
}

function getDecisionGates(profile: {
  careerCategory: CareerCategory
  rank: string
  targetRank: string
  seniorRaterName: string
  blcComplete: boolean
  alcComplete: boolean
  slcComplete: boolean
  bolcComplete: boolean
  cccComplete: boolean
  ileComplete: boolean
  wobcComplete: boolean
  woacComplete: boolean
}): string[] {
  const nextPme = getNextPme(profile)
  const nextRole = getNextRole(profile)

  if (profile.careerCategory === 'Enlisted') {
    return [
      `Complete ${nextPme} before applying for next promotion board`,
      `Seek a ${nextRole} position to build leadership credibility`,
      'Talk to your Career Counselor about AGR / Technician openings',
      `Review the Position Matches page for ${profile.targetRank} positions`,
      'Update your ERB and ensure all awards/training are documented',
    ]
  }

  if (profile.careerCategory === 'Officer') {
    const seniorRater = profile.seniorRaterName || 'your Senior Rater'
    return [
      `Complete ${nextPme} before MAJ board`,
      'Compete for Company Command or KD staff assignment',
      'Build relationships with MTARNG G-staff at Helena',
      'Review Officer Personnel Management System (OPMS) guidance',
      `Discuss timeline with your senior rater ${seniorRater}`,
    ]
  }

  // Warrant
  return [
    `Complete ${nextPme} for grade progression`,
    'Seek technical positions at BN/BDE level',
    'Build relationships with proponent branch',
    'Document all technical certifications in ORB',
    'Mentor junior warrant officers in your MOS',
  ]
}

function get20YearMilestones(profile: {
  careerCategory: CareerCategory
  rank: string
  yearsOfService: number
  targetRank: string
  targetTimeline: number
  preferredStatus: string
}): Array<{ year: number; label: string; detail: string; type: 'pme'|'promotion'|'agr'|'milestone' }> {
  const { yearsOfService, targetTimeline, careerCategory } = profile
  const baseYear = new Date().getFullYear()
  const milestones: Array<{ year: number; label: string; detail: string; type: 'pme'|'promotion'|'agr'|'milestone' }> = []

  // 20-year retirement target
  const retirementYear = baseYear + Math.max(0, 20 - yearsOfService)
  milestones.push({ year: retirementYear, label: '20-Year Retirement Eligible', detail: 'Active duty or ARNG retirement with monthly retired pay', type: 'milestone' })

  // Target rank
  if (targetTimeline > 0) {
    milestones.push({ year: baseYear + targetTimeline, label: `Target: ${profile.targetRank}`, detail: 'Goal rank based on your stated timeline', type: 'promotion' })
  }

  // Category-specific milestones
  if (careerCategory === 'Enlisted') {
    if (yearsOfService < 6) milestones.push({ year: baseYear + Math.max(0, 3 - yearsOfService), label: 'E5 Promotion Window', detail: 'Typical TIS 3-6 years. BLC required.', type: 'promotion' })
    if (yearsOfService < 10) milestones.push({ year: baseYear + Math.max(1, 6 - yearsOfService), label: 'E6 Promotion Window', detail: 'Typical TIS 6-10 years. ALC required.', type: 'promotion' })
    if (yearsOfService < 16) milestones.push({ year: baseYear + Math.max(2, 10 - yearsOfService), label: 'E7 Promotion Window', detail: 'Competitive. SLC required.', type: 'promotion' })
    milestones.push({ year: baseYear + 2, label: 'AGR Application Window', detail: 'Research open AGR billets at HRO. Competition is fierce — apply early.', type: 'agr' })
  } else if (careerCategory === 'Officer') {
    milestones.push({ year: baseYear + 1, label: 'Company Command Opportunity', detail: 'CPT command is a career-defining KD assignment. Compete aggressively.', type: 'milestone' })
    milestones.push({ year: baseYear + 4, label: 'MAJ Promotion / ILE', detail: 'ILE completion required for LTC. Plan attendance now.', type: 'pme' })
    milestones.push({ year: baseYear + 2, label: 'AGR/Technician Consideration', detail: 'Full-time positions as O3/O4 open regularly in MTARNG HQ.', type: 'agr' })
  } else {
    milestones.push({ year: baseYear + 1, label: 'WOAC Completion Target', detail: 'Required for CW3 promotion. Schedule through HRC.', type: 'pme' })
    milestones.push({ year: baseYear + 3, label: 'CW3 Promotion Window', detail: 'Technical expertise and WOAC completion are key factors.', type: 'promotion' })
    milestones.push({ year: baseYear + 2, label: 'AGR/Technician Opportunity', detail: 'Warrant AGR positions exist in aviation, intel, and cyber MOSs.', type: 'agr' })
  }

  return milestones.sort((a, b) => a.year - b.year)
}

// ── Page component ────────────────────────────────────────────────────────────
export default function TimelinePage() {
  const { profile } = useProfileStore()
  const [activeTab, setActiveTab] = useState<CareerCategory>(profile.careerCategory)

  const gaps = getPmeGaps(profile)
  const phases = getPhasesForCategory(activeTab)
  const currentPhaseIndex = getCurrentPhaseIndex(profile.rank, activeTab)
  const decisionGates = getDecisionGates(profile)
  const milestones20yr = get20YearMilestones(profile)

  const tabs: CareerCategory[] = ['Enlisted', 'Officer', 'Warrant']

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* A. Profile bar */}
      <div
        className="px-8 py-4 flex flex-wrap gap-6 text-sm text-white font-medium"
        style={{ backgroundColor: '#1B4F2A' }}
      >
        <span>Rank: {profile.rank}</span>
        <span className="text-green-300">|</span>
        <span>Category: {profile.careerCategory}</span>
        <span className="text-green-300">|</span>
        <span>YOS: {profile.yearsOfService} years</span>
        <span className="text-green-300">|</span>
        <span>Target: {profile.targetRank}</span>
      </div>

      {/* B. Page header */}
      <div className="px-8 py-6 bg-white border-b">
        <h1
          className="text-2xl font-bold"
          style={{ color: '#1B4F2A' }}
        >
          Career Timeline
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Your {profile.careerCategory} career path — current position highlighted
        </p>

        {/* Tab buttons */}
        <div className="flex gap-2 mt-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={
                activeTab === tab
                  ? 'px-4 py-2 rounded-lg text-sm font-medium text-white'
                  : 'px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200'
              }
              style={
                activeTab === tab ? { backgroundColor: '#1B4F2A' } : undefined
              }
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* B2. Interactive planner callout */}
      <div className="mx-8 mt-6">
        <Link
          href="/planner"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 hover:bg-emerald-100 transition"
        >
          <span className="text-2xl">🧭</span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-emerald-900">
              New: Build your own path in the interactive Career Planner
            </div>
            <div className="text-sm text-emerald-800">
              Swap real MTARNG positions in and out at each grade, set how long you stay in each one,
              layer in your schools, and branch into the officer or warrant track via OCS/WOCS.
            </div>
          </div>
          <span className="text-emerald-700 font-semibold whitespace-nowrap">Open Planner →</span>
        </Link>
      </div>

      {/* C. PME Gaps section */}
      {gaps.length > 0 && (
        <div className="mx-8 mt-6 p-5 bg-red-50 border border-red-200 rounded-xl">
          <p className="font-bold text-red-800 text-base mb-3">
            ⚠️ PME Action Required
          </p>
          <ul className="space-y-1">
            {gaps.map((gap, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5 flex-shrink-0">•</span>
                <span className="text-red-700 text-sm">{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* D. Timeline */}
      <div className="mx-8 mt-6">
        {phases.map((phase, index) => {
          const isCurrent = index === currentPhaseIndex
          const isPast = index < currentPhaseIndex

          // Circle styles
          let circleClass =
            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 '
          if (isCurrent) {
            circleClass += 'bg-green-700 text-white ring-2 ring-green-400'
          } else if (isPast) {
            circleClass += 'bg-gray-400 text-white'
          } else {
            circleClass += 'bg-gray-200 text-gray-600'
          }

          const isLast = index === phases.length - 1

          return (
            <div key={index} className="relative flex gap-4 mb-4">
              {/* Left: circle + vertical line */}
              <div className="flex flex-col items-center">
                <div className={circleClass}>{index + 1}</div>
                {!isLast && (
                  <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
                )}
              </div>

              {/* Right: card */}
              <div
                className={`${phase.color} border rounded-xl p-5 flex-1 mb-${isLast ? '0' : '2'}`}
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {/* Rank badge */}
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded text-white"
                    style={{ backgroundColor: '#1F3864' }}
                  >
                    {phase.rank}
                  </span>

                  <span className="font-bold text-gray-900 text-base">
                    {phase.title}
                  </span>

                  {/* Years badge */}
                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded ml-auto">
                    {phase.years}
                  </span>

                  {/* You Are Here badge */}
                  {isCurrent && (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded font-bold">
                      ← You Are Here
                    </span>
                  )}
                </div>

                {/* PME row */}
                <div className="mb-1">
                  <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded">
                    PME: {phase.pme}
                  </span>
                </div>

                {/* Role */}
                <p className="text-sm text-gray-600 mt-1 font-medium">
                  Role: {phase.role}
                </p>

                {/* Key Actions */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {phase.keyActions.map((action, ai) => (
                    <div key={ai} className="flex items-start gap-1">
                      <span className="text-green-600 font-bold text-xs mt-0.5 flex-shrink-0">
                        ✓
                      </span>
                      <span className="text-xs text-gray-600">{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* E. Decision Gates */}
      <div className="mx-8 mt-8 p-6 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="font-bold text-blue-900 mb-4">
          🎯 Decision Gates — Actions for Your Next Phase
        </p>
        <ol className="space-y-3">
          {decisionGates.map((gate, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="w-7 h-7 bg-blue-700 text-white rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0">
                {i + 1}
              </div>
              <span className="text-sm text-blue-900">{gate}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* F. 20-Year Career Projection */}
      <div className="mx-8 mt-8 p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
        <p className="font-bold text-gray-900 mb-1 text-base">
          20-Year Career Projection
        </p>
        <p className="text-xs text-gray-500 mb-4">
          Based on {profile.yearsOfService} years of service · 20-yr eligible ~{new Date().getFullYear() + Math.max(0, 20 - profile.yearsOfService)}
        </p>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-4">
            {milestones20yr.map((m, i) => {
              const colors = {
                pme: { dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-800' },
                promotion: { dot: 'bg-green-500', badge: 'bg-green-100 text-green-800' },
                agr: { dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-800' },
                milestone: { dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800' },
              }[m.type]
              return (
                <div key={i} className="flex gap-4 items-start pl-8 relative">
                  <div className={`absolute left-1.5 w-3 h-3 rounded-full ${colors.dot} ring-2 ring-white mt-0.5`} />
                  <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800 text-sm">{m.year}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
                        {m.type === 'pme' ? 'PME' : m.type === 'promotion' ? 'Promotion' : m.type === 'agr' ? 'AGR' : 'Milestone'}
                      </span>
                      <span className="font-semibold text-sm text-gray-700">{m.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{m.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
