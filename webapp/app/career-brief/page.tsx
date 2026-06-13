'use client'

import { useMemo, useRef } from 'react'
import { useProfileStore } from '@/lib/store'
import { positions } from '@/lib/data/positions'
import { scoreAllPositions, getPmeGaps, getPromotionReadiness, getBoardAlert } from '@/lib/scoring'
import Link from 'next/link'

const TODAY = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

export default function CareerBriefPage() {
  const { profile, profileComplete } = useProfileStore()
  const printRef = useRef<HTMLDivElement>(null)

  const scored = useMemo(() => scoreAllPositions(profile, positions), [profile])
  const topMatches = scored.slice(0, 10)
  const pmeGaps = useMemo(() => getPmeGaps(profile), [profile])
  const promoReadiness = useMemo(() => getPromotionReadiness(profile), [profile])
  const boardAlert = useMemo(() => getBoardAlert(profile), [profile])

  if (!profileComplete) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center px-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Profile Required</h2>
        <p className="text-gray-600 mb-6">Complete your Soldier profile to generate a Career Brief.</p>
        <Link href="/profile" className="inline-block px-6 py-3 rounded-lg text-white font-semibold"
          style={{ backgroundColor: '#1B4F2A' }}>
          Build My Profile →
        </Link>
      </div>
    )
  }

  const pmeChecklist: { label: string; done: boolean }[] = []
  if (profile.careerCategory === 'Enlisted') {
    pmeChecklist.push(
      { label: 'BLC (Basic Leader Course)', done: profile.blcComplete },
      { label: 'ALC (Advanced Leader Course)', done: profile.alcComplete },
      { label: 'SLC (Senior Leader Course)', done: profile.slcComplete },
      { label: 'SMC (Sergeants Major Course)', done: profile.smcComplete },
    )
  }
  if (profile.careerCategory === 'Officer') {
    pmeChecklist.push(
      { label: 'BOLC (Basic Officer Leader Course)', done: profile.bolcComplete },
      { label: "CCC (Captain's Career Course)", done: profile.cccComplete },
      { label: 'ILE / CGSC (Intermediate Level Education)', done: profile.ileComplete },
      { label: 'SSC (Senior Service College)', done: profile.sscComplete },
    )
  }
  if (profile.careerCategory === 'Warrant') {
    pmeChecklist.push(
      { label: 'WOBC (Warrant Officer Basic Course)', done: profile.wobcComplete },
      { label: 'WOAC (Warrant Officer Advanced Course)', done: profile.woacComplete },
      { label: 'WOILE (Warrant Officer ILE)', done: profile.woileComplete },
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      {/* Print controls (hidden when printing) */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold text-gray-700">Career Brief</h1>
        <div className="flex gap-3">
          <Link href="/career-path"
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
            ← Career Path
          </Link>
          <button
            onClick={() => window.print()}
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold shadow"
            style={{ backgroundColor: '#1B4F2A' }}
          >
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>

      {/* Print-formatted brief */}
      <div
        ref={printRef}
        className="max-w-4xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden print:shadow-none print:rounded-none"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {/* Header bar */}
        <div className="px-8 py-5 text-white" style={{ backgroundColor: '#1B4F2A' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-green-300 mb-1">
                Montana Army National Guard · S1 Career Brief
              </div>
              <div className="text-2xl font-bold">{profile.fullName || 'Soldier'}</div>
              <div className="text-sm text-green-200 mt-0.5">
                {profile.rank} · {profile.mos}{profile.secondaryMos ? ' / ' + profile.secondaryMos : ''} · {profile.componentStatus}
              </div>
            </div>
            <div className="text-right text-xs text-green-300">
              <div>As of {TODAY}</div>
              <div className="mt-1">{profile.unitName}</div>
              <div>{profile.unitCity}, MT</div>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Section 1: Service Data */}
          <section>
            <SectionHeader>Service Summary</SectionHeader>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
              <DataCell label="Rank" value={profile.rank} />
              <DataCell label="MOS" value={profile.mos + (profile.secondaryMos ? ' / ' + profile.secondaryMos : '')} />
              <DataCell label="Component" value={profile.componentStatus} />
              <DataCell label="Clearance" value={profile.clearanceLevel || 'N/A'} />
              <DataCell label="Years of Service" value={`${profile.yearsOfService} yrs`} />
              <DataCell label="Time in Grade" value={`${profile.timeInGrade} yrs`} />
              <DataCell label="Home City" value={profile.homeCity} />
              <DataCell label="Unit City" value={profile.unitCity} />
            </div>
          </section>

          {/* Section 2: Promotion Readiness */}
          <section>
            <SectionHeader>Promotion Assessment</SectionHeader>
            <div className="mt-3 border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <div className="text-xs text-gray-500 uppercase font-semibold">Target Grade</div>
                  <div className="text-xl font-bold" style={{ color: '#1B4F2A' }}>{promoReadiness.targetGrade}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase font-semibold">Readiness</div>
                  <div className="text-xl font-bold text-gray-800">{promoReadiness.label}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase font-semibold">Score</div>
                  <div className="text-xl font-bold text-gray-800">{Math.round(promoReadiness.readiness * 100)}%</div>
                </div>
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(promoReadiness.readiness * 100)}%`,
                        backgroundColor: promoReadiness.readiness >= 0.85 ? '#16a34a' : promoReadiness.readiness >= 0.6 ? '#2563eb' : '#d97706',
                      }}
                    />
                  </div>
                </div>
              </div>
              {promoReadiness.blockers.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-red-700 mb-1">Blockers / Gaps:</div>
                  <ul className="space-y-0.5">
                    {promoReadiness.blockers.map((b, i) => (
                      <li key={i} className="text-xs text-red-700">⚠ {b}</li>
                    ))}
                  </ul>
                </div>
              )}
              {boardAlert && (
                <div className="mt-3 text-xs text-gray-600 border-t pt-2">
                  <span className="font-semibold">{boardAlert.boardName}:</span> est. convene{' '}
                  {boardAlert.conveneDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}{' '}
                  (~{boardAlert.monthsAway} months away)
                </div>
              )}
            </div>
          </section>

          {/* Section 3: PME Checklist */}
          <section>
            <SectionHeader>PME Checklist</SectionHeader>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {pmeChecklist.map(item => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    item.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {item.done ? '✓' : '○'}
                  </span>
                  <span className={item.done ? 'text-gray-700' : 'text-gray-400'}>{item.label}</span>
                </div>
              ))}
            </div>
            {pmeGaps.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-orange-700 mb-1">PME Gaps Requiring Action:</div>
                <ul className="space-y-0.5">
                  {pmeGaps.map((g, i) => (
                    <li key={i} className="text-xs text-orange-700">→ {g}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Section 4: Top Position Matches */}
          <section>
            <SectionHeader>Top 10 Position Matches</SectionHeader>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-1 pr-3 font-semibold text-gray-600">#</th>
                    <th className="text-left py-1 pr-3 font-semibold text-gray-600">Position / Unit</th>
                    <th className="text-left py-1 pr-3 font-semibold text-gray-600">City</th>
                    <th className="text-left py-1 pr-3 font-semibold text-gray-600">Grade</th>
                    <th className="text-left py-1 pr-3 font-semibold text-gray-600">Score</th>
                    <th className="text-left py-1 pr-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left py-1 font-semibold text-gray-600">Commute</th>
                  </tr>
                </thead>
                <tbody>
                  {topMatches.map((pos, i) => (
                    <tr key={pos.id} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="py-1 pr-3 text-gray-500">{i + 1}</td>
                      <td className="py-1 pr-3">
                        <div className="font-medium text-gray-800">{pos.dutyTitle}</div>
                        <div className="text-gray-500">{pos.unit}</div>
                      </td>
                      <td className="py-1 pr-3 text-gray-700">{pos.city}</td>
                      <td className="py-1 pr-3 font-bold" style={{ color: '#1B4F2A' }}>{pos.grade}</td>
                      <td className="py-1 pr-3 font-bold text-gray-800">{pos.totalScore}/100</td>
                      <td className="py-1 pr-3">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          pos.vacancyStatus === 'Vacant' ? 'bg-green-100 text-green-800' :
                          pos.vacancyStatus === 'Projected Vacant' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-500'
                        }`}>{pos.vacancyStatus}</span>
                      </td>
                      <td className="py-1 text-gray-600">
                        {pos.commuteMins >= 0 ? `${pos.commuteMins} min` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 5: Goals */}
          {(profile.fiveYearGoal || profile.tenYearGoal || profile.longTermGoal) && (
            <section>
              <SectionHeader>Career Goals</SectionHeader>
              <div className="mt-3 space-y-3">
                {profile.fiveYearGoal && (
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase mb-0.5">5-Year Goal</div>
                    <p className="text-sm text-gray-700 leading-relaxed">{profile.fiveYearGoal}</p>
                  </div>
                )}
                {profile.tenYearGoal && (
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase mb-0.5">10-Year Goal</div>
                    <p className="text-sm text-gray-700 leading-relaxed">{profile.tenYearGoal}</p>
                  </div>
                )}
                {profile.longTermGoal && (
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase mb-0.5">Long-Term Vision</div>
                    <p className="text-sm text-gray-700 leading-relaxed">{profile.longTermGoal}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Signature block */}
          <section className="border-t pt-4 mt-6">
            <div className="grid grid-cols-2 gap-8 text-xs text-gray-500">
              <div>
                <div className="border-b border-gray-300 pb-6 mb-1" />
                <div>Soldier Signature / Date</div>
              </div>
              <div>
                <div className="border-b border-gray-300 pb-6 mb-1" />
                <div>Senior Rater Signature / Date{profile.seniorRaterName ? ` (${profile.seniorRaterName})` : ''}</div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-8 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-400 flex justify-between print:bg-white">
          <span>Generated by Ask Steeves · MT ARNG S1 Career Management System</span>
          <span>{TODAY}</span>
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          .print\\:bg-white { background: white !important; }
        }
      `}</style>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1">
      {children}
    </h2>
  )
}

function DataCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400 uppercase font-semibold">{label}</div>
      <div className="text-sm font-medium text-gray-800">{value || '—'}</div>
    </div>
  )
}
