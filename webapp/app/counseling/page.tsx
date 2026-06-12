'use client'

import { useRef } from 'react'
import { useProfileStore } from '@/lib/store'
import { positions } from '@/lib/data/positions'
import { scoreAllPositions, getPmeGaps } from '@/lib/scoring'
import Link from 'next/link'

const PME_ITEMS = [
  { key: 'blcComplete',  label: 'BLC',  cat: 'Enlisted' },
  { key: 'alcComplete',  label: 'ALC',  cat: 'Enlisted' },
  { key: 'slcComplete',  label: 'SLC',  cat: 'Enlisted' },
  { key: 'smcComplete',  label: 'SMC',  cat: 'Enlisted' },
  { key: 'bolcComplete', label: 'BOLC', cat: 'Officer' },
  { key: 'cccComplete',  label: 'CCC',  cat: 'Officer' },
  { key: 'ileComplete',  label: 'ILE',  cat: 'Officer' },
  { key: 'wobcComplete', label: 'WOBC', cat: 'Warrant' },
  { key: 'woacComplete', label: 'WOAC', cat: 'Warrant' },
  { key: 'woileComplete',label: 'WOILE',cat: 'Warrant' },
] as const

const DISCUSSION_POINTS = [
  'Next promotion board — Is the Soldier on track? What does the senior rater need to see?',
  'Position of interest — Are the matched positions realistic? Is command / KD assignment needed?',
  'AGR opportunity — Is the Soldier interested? Are there open billets to discuss?',
  'PME gaps — When and where will the Soldier attend the next required school?',
  'Commute and geography — Are geographic constraints realistic given stated career goals?',
  'MOS switch or branch transfer — Is this being considered? What steps are required?',
  'Warrant Officer program — Any interest? SIFT score and flight physical status?',
  'Senior rater support — Does the Soldier understand what the SR needs to document?',
  'ETS and retention — Does the Soldier plan to re-enlist? What incentives are available?',
  'Mentorship — Who is the Soldier\'s mentor? Is there a plan for regular touchpoints?',
]

function StatusPill({ value }: { value: boolean }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      {value ? 'YES' : 'NO'}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#2563eb' : score >= 40 ? '#d97706' : score >= 20 ? '#ea580c' : '#dc2626'
  return (
    <div className="flex items-center gap-1">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold" style={{ color }}>{score}</span>
    </div>
  )
}

export default function CounselingPage() {
  const { profile, profileComplete } = useProfileStore()
  const printRef = useRef<HTMLDivElement>(null)
  const scored = scoreAllPositions(profile, positions)
  const top5 = scored.slice(0, 5)
  const pmeGaps = getPmeGaps(profile)
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  function handlePrint() {
    window.print()
  }

  if (!profileComplete) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center px-4">
        <div className="text-6xl mb-4">📋</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Complete Your Profile First</h2>
        <p className="text-gray-600 mb-6">The counseling sheet pulls from your career profile.</p>
        <Link href="/profile" className="inline-block px-6 py-3 rounded-lg text-white font-semibold" style={{ backgroundColor: '#1B4F2A' }}>
          Go to My Profile →
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Print button — hidden on print */}
      <div className="no-print flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Counseling Sheet</h1>
          <p className="text-sm text-gray-500">Print-ready one-page career counseling summary</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-semibold shadow"
          style={{ backgroundColor: '#1B4F2A' }}
        >
          🖨️ Print / Save as PDF
        </button>
      </div>

      {/* Printable content */}
      <div ref={printRef} className="bg-white border border-gray-300 rounded-lg shadow-sm">

        {/* ── HEADER ── */}
        <div className="text-white px-6 py-4" style={{ backgroundColor: '#1B4F2A' }}>
          <div className="text-center">
            <div className="text-xs font-bold tracking-widest opacity-80 mb-1">MONTANA ARMY NATIONAL GUARD</div>
            <div className="text-xl font-bold">SOLDIER CAREER COUNSELING SHEET</div>
            <div className="text-xs opacity-80 mt-1">As of {today} · {profile.fullName || 'Soldier Name'} · {profile.rank} · {profile.mos}</div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">

          {/* ── SECTION 1: Snapshot ── */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-white px-3 py-1 rounded mb-2" style={{ backgroundColor: '#C8A96E', color: '#1a1a1a' }}>
              Section 1 — Current Snapshot
            </h2>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                ['Rank / Grade', profile.rank],
                ['Career Category', profile.careerCategory],
                ['MOS / AOC', profile.mos],
                ['Component', profile.componentStatus],
                ['Unit', profile.unitName],
                ['Unit City', profile.unitCity],
                ['Current Duty Title', profile.dutyTitle],
                ['Years of Service', String(profile.yearsOfService)],
                ['Time in Grade', `${profile.timeInGrade} yrs`],
                ['Security Clearance', profile.clearanceLevel],
                ['Fitness Status', profile.fitessStatus],
                ['ETS', profile.ets],
              ].map(([label, val]) => (
                <div key={label} className="border border-gray-200 rounded px-2 py-1">
                  <div className="text-gray-500 text-xs">{label}</div>
                  <div className="font-semibold text-gray-800">{val || '—'}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── SECTION 2: PME ── */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide px-3 py-1 rounded mb-2" style={{ backgroundColor: '#1F3864', color: 'white' }}>
              Section 2 — PME Status
            </h2>
            <div className="flex flex-wrap gap-2">
              {PME_ITEMS.filter(item => {
                if (item.cat === 'Enlisted' && profile.careerCategory !== 'Enlisted') return false
                if (item.cat === 'Officer' && profile.careerCategory !== 'Officer') return false
                if (item.cat === 'Warrant' && profile.careerCategory !== 'Warrant') return false
                return true
              }).map(item => (
                <div key={item.key} className="border border-gray-200 rounded px-3 py-1 text-xs text-center min-w-[60px]">
                  <div className="font-bold text-gray-700">{item.label}</div>
                  <StatusPill value={!!profile[item.key]} />
                </div>
              ))}
            </div>
          </section>

          {/* ── SECTION 3: Goals ── */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide px-3 py-1 rounded mb-2" style={{ backgroundColor: '#1B4F2A', color: 'white' }}>
              Section 3 — Career Goals
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['Target Rank', profile.targetRank],
                ['Timeline', `${profile.targetTimeline} years`],
                ['Primary Goal', profile.primaryGoal],
                ['Preferred Status', profile.preferredStatus],
                ['Open to Command', profile.openToCommand],
                ['Max Commute', profile.maxCommute],
                ['Switch MOS?', profile.wantToSwitchMos],
                ['WO Interest?', profile.warrantInterest],
              ].map(([label, val]) => (
                <div key={label} className="border border-gray-200 rounded px-2 py-1">
                  <div className="text-gray-500">{label}</div>
                  <div className="font-semibold text-gray-800">{val || '—'}</div>
                </div>
              ))}
            </div>
            {profile.fiveYearGoal && (
              <div className="mt-2 border border-gray-200 rounded px-3 py-2 text-xs">
                <div className="text-gray-500 mb-0.5">5-Year Goal Statement</div>
                <div className="text-gray-800 italic">{profile.fiveYearGoal}</div>
              </div>
            )}
          </section>

          {/* ── SECTION 4: Top Matches ── */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide px-3 py-1 rounded mb-2" style={{ backgroundColor: '#1F3864', color: 'white' }}>
              Section 4 — Top Position Matches (from {positions.length} statewide positions)
            </h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  {['Grade','Unit','City','Duty Title','Status','Commute','Score','Match'].map(h => (
                    <th key={h} className="border border-gray-300 px-2 py-1 text-left font-bold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {top5.map((pos, i) => (
                  <tr key={pos.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-2 py-1 font-bold">{pos.grade}</td>
                    <td className="border border-gray-300 px-2 py-1">{pos.unit}</td>
                    <td className="border border-gray-300 px-2 py-1">{pos.city}</td>
                    <td className="border border-gray-300 px-2 py-1 font-medium">{pos.dutyTitle}</td>
                    <td className="border border-gray-300 px-2 py-1">{pos.statusType}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      {pos.commuteMins >= 0 ? `${pos.commuteMins} min` : 'N/A'}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      <ScoreBar score={pos.totalScore} />
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                        pos.matchLabel === 'STRONG MATCH' ? 'bg-green-100 text-green-700' :
                        pos.matchLabel === 'GOOD MATCH' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {pos.matchLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ── SECTION 5: PME Gaps ── */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide px-3 py-1 rounded mb-2" style={{ backgroundColor: '#92400e', color: 'white' }}>
              Section 5 — Gaps to Close
            </h2>
            {pmeGaps.length === 0 ? (
              <p className="text-xs text-green-700 font-medium">✓ No critical PME gaps identified for current career category and grade.</p>
            ) : (
              <ul className="space-y-1">
                {pmeGaps.map((gap, i) => (
                  <li key={i} className="text-xs flex items-start gap-2">
                    <span className="text-orange-500 font-bold flex-shrink-0">⚠</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── SECTION 6: 3-Step Pathway ── */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide px-3 py-1 rounded mb-2" style={{ backgroundColor: '#1B4F2A', color: 'white' }}>
              Section 6 — Suggested Near-Term Career Pathway
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'NOW (0–2 yrs)', color: '#1B4F2A', text: `Continue in ${profile.dutyTitle}. Complete PME gaps. Build NCOER/OER support file. Establish relationship with senior rater.` },
                { label: 'MID (2–4 yrs)', color: '#1F3864', text: `Move to position aligned with ${profile.primaryGoal}. Attend next PME school. Target grade ${profile.targetRank} board.` },
                { label: `GOAL (${profile.targetTimeline}+ yrs)`, color: '#92400e', text: profile.fiveYearGoal || `Achieve ${profile.targetRank}. Pursue ${profile.primaryGoal} opportunity. Assess long-term trajectory.` },
              ].map(step => (
                <div key={step.label} className="rounded border-l-4 pl-3 py-2 border-gray-200" style={{ borderLeftColor: step.color }}>
                  <div className="text-xs font-bold mb-1" style={{ color: step.color }}>{step.label}</div>
                  <div className="text-xs text-gray-700 leading-relaxed">{step.text}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── SECTION 7: Discussion Points ── */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide px-3 py-1 rounded mb-2" style={{ backgroundColor: '#1F3864', color: 'white' }}>
              Section 7 — Counseling Discussion Points
            </h2>
            <ol className="space-y-1">
              {DISCUSSION_POINTS.map((pt, i) => (
                <li key={i} className="text-xs flex gap-2">
                  <span className="font-bold text-gray-500 flex-shrink-0">{i + 1}.</span>
                  <span className="text-gray-700">{pt}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* ── SIGNATURES ── */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide px-3 py-1 rounded mb-3" style={{ backgroundColor: '#C8A96E', color: '#1a1a1a' }}>
              Section 8 — Signatures
            </h2>
            <div className="grid grid-cols-3 gap-6">
              {['Soldier', 'Mentor / Rater', 'Senior Rater'].map(role => (
                <div key={role}>
                  <div className="border-b-2 border-gray-400 mb-1 h-8" />
                  <div className="text-xs text-gray-500">{role} Signature / Date</div>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-3 text-center text-xs text-gray-400">
            MT ARNG Career Planner v1.0 · DEMO DATA — Replace with real MTARNG position data before operational use
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          nav { display: none !important; }
          body { background: white; }
          .shadow-sm { box-shadow: none; }
          .rounded-lg { border-radius: 0; }
        }
      `}</style>
    </div>
  )
}
