'use client'

import { useState, useMemo } from 'react'
import { useProfileStore } from '@/lib/store'
import { MOS_TRANSITIONS, getTransitionTo, MOS_POSITION_COUNTS } from '@/lib/data/mosTransitions'
import type { MosTransition } from '@/lib/types'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-green-100 text-green-800 border-green-300',
  Moderate: 'bg-amber-100 text-amber-800 border-amber-300',
  Hard: 'bg-red-100 text-red-800 border-red-300',
}

function ProcessStep({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
        style={{ backgroundColor: '#1B4F2A' }}>
        {n}
      </div>
      <div className="pt-1">
        <div className="font-semibold text-sm text-gray-800">{title}</div>
        <div className="text-sm text-gray-600 leading-relaxed">{desc}</div>
      </div>
    </div>
  )
}

function TransitionCard({ t, isTarget, posCount }: { t: MosTransition; isTarget: boolean; posCount: number }) {
  const [open, setOpen] = useState(isTarget)
  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', isTarget ? 'border-violet-400 ring-2 ring-violet-300' : 'border-gray-200')}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn('w-full text-left px-4 py-3 flex items-center justify-between gap-3', isTarget ? 'bg-violet-50' : 'bg-white hover:bg-gray-50')}
      >
        <div className="flex items-center gap-3 min-w-0">
          {isTarget && <span className="text-xs font-bold bg-violet-700 text-white px-2 py-0.5 rounded flex-shrink-0">YOUR TARGET</span>}
          <div className="font-bold text-gray-900">{t.toMos}</div>
          <div className="text-sm text-gray-600 truncate">{t.toMosTitle}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn('text-xs px-2 py-0.5 rounded border font-semibold', DIFFICULTY_COLORS[t.difficulty])}>
            {t.difficulty}
          </span>
          <span className="text-xs text-gray-400 hidden sm:block">{posCount} MTARNG slots</span>
          <span className="text-gray-400">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 py-4 bg-white border-t border-gray-100 space-y-4">
          {/* Quick facts grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 uppercase font-semibold mb-1">ASVAB Required</div>
              <div className="text-sm font-bold text-gray-800">{t.asvabReq}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 uppercase font-semibold mb-1">School Length</div>
              <div className="text-sm font-bold text-gray-800">{t.schoolDuration}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Eligible Grades</div>
              <div className="text-sm font-bold text-gray-800">{t.eligibleGrades}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 uppercase font-semibold mb-1">MTARNG Positions</div>
              <div className="text-sm font-bold text-gray-800">{posCount} slots</div>
            </div>
          </div>

          {/* School */}
          <div>
            <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Training Location</div>
            <div className="text-sm text-gray-700">{t.mosqSchool}</div>
          </div>

          {/* Medical/physical */}
          <div>
            <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Physical / Medical Requirements</div>
            <div className="text-sm text-gray-700">{t.medReq}</div>
          </div>

          {/* Notes */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-xs text-blue-700 font-semibold mb-1">MTARNG Context & Notes</div>
            <div className="text-sm text-blue-800 leading-relaxed">{t.notes}</div>
          </div>

          {/* Waiver */}
          <div className="text-xs text-gray-500">
            {t.waiverAvailable
              ? '✓ Waivers available for some requirements — ask your S1'
              : '✗ No waivers available for core requirements'}
          </div>

          {/* CTA */}
          <Link href={`/matches`}
            className="inline-block text-xs px-3 py-1.5 rounded-lg text-white font-semibold"
            style={{ backgroundColor: '#1B4F2A' }}>
            View {t.toMos} Positions in MTARNG →
          </Link>
        </div>
      )}
    </div>
  )
}

export default function ReclassificationPage() {
  const { profile } = useProfileStore()
  const [search, setSearch] = useState('')


  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return MOS_TRANSITIONS
    return MOS_TRANSITIONS.filter(t =>
      t.toMos.toLowerCase().includes(q) ||
      t.toMosTitle.toLowerCase().includes(q) ||
      t.notes.toLowerCase().includes(q)
    )
  }, [search])

  // Sort: target first, then by MTARNG position count desc, then difficulty
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.toMos === profile.targetMos) return -1
      if (b.toMos === profile.targetMos) return 1
      const cntA = MOS_POSITION_COUNTS[a.toMos] ?? 0
      const cntB = MOS_POSITION_COUNTS[b.toMos] ?? 0
      return cntB - cntA
    })
  }, [filtered, profile.targetMos])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#1B4F2A' }}>MOS Reclassification Pathways</h1>
              <p className="text-sm text-gray-500 mt-1">
                Requirements, school details, and MTARNG position counts for common reclass targets
              </p>
            </div>
            <Link href="/matches"
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 font-medium">
              ← Back to Matches
            </Link>
          </div>

          {/* Profile context */}
          {profile.mos && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <span className="text-blue-600 font-semibold">Current MOS:</span>{' '}
                <span className="text-blue-900 font-bold">{profile.mos}</span>
              </div>
              {profile.targetMos && (
                <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                  <span className="text-violet-600 font-semibold">Target MOS:</span>{' '}
                  <span className="text-violet-900 font-bold">{profile.targetMos}</span>
                  {!getTransitionTo(profile.targetMos) && (
                    <span className="ml-2 text-xs text-violet-500">(not in our database yet — contact your S1)</span>
                  )}
                </div>
              )}
              {!profile.targetMos && (
                <div className="text-sm text-gray-500 bg-gray-100 rounded-lg px-3 py-2">
                  Set a target MOS in your{' '}
                  <Link href="/profile" className="underline text-blue-600">profile</Link>{' '}
                  to see your specific pathway.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Process overview */}
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-base font-bold text-gray-700 mb-4">How MOS Reclassification Works (ARNG)</h2>
          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-4">
            <ProcessStep n={1} title="Talk to your unit S1 or G1"
              desc="Express your intent to reclass. They initiate the DA Form 4187 and verify your ASVAB scores. Do this first — nothing moves without unit support." />
            <ProcessStep n={2} title="Verify ASVAB line scores"
              desc="Check your ASVAB line scores against the target MOS requirements. If you fall short, schedule a retest (ASVAB can be retaken with a 30-day wait after first retest, 6 months thereafter)." />
            <ProcessStep n={3} title="Reclassification packet approved"
              desc="State G1 reviews and approves the packet. Must align with MTARNG force structure needs — positions must exist in target MOS. Typical approval: 30–90 days." />
            <ProcessStep n={4} title="Attend MOSQ school (AIT/OSUT)"
              desc="Orders for the MOS-qualifying course at the appropriate training center. Duration varies (8–20 weeks). You remain in your current MOS until school is complete." />
            <ProcessStep n={5} title="Award new MOS"
              desc="Upon graduation, your MOS is updated in eMILPO/iPERMS. You&apos;re now qualified and compete for positions in your new MOS." />
            <ProcessStep n={6} title="Compete for MTARNG positions"
              desc="Apply for open positions in your new MOS. Use the Matches page filtered to your new MOS. Vacant positions are actionable immediately." />
          </div>
          <div className="mt-4 text-xs text-gray-500 bg-gray-50 border rounded-lg p-3">
            <strong>Timeline estimate:</strong> Most reclassifications take 6–18 months from initial request to new MOS award, depending on school seat availability and state approval. Priority is given to MOSs with MTARNG shortfalls.
          </div>
        </div>
      </div>

      {/* MOS catalog */}
      <div className="px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <h2 className="text-base font-bold text-gray-700">
              Common MTARNG Reclass Targets ({MOS_TRANSITIONS.length} MOSs)
            </h2>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by MOS or title…"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700 w-56"
            />
          </div>

          {sorted.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No matching MOSs found.</div>
          ) : (
            <div className="space-y-3">
              {sorted.map(t => (
                <TransitionCard
                  key={t.toMos}
                  t={t}
                  isTarget={t.toMos === profile.targetMos}
                  posCount={MOS_POSITION_COUNTS[t.toMos] ?? 0}
                />
              ))}
            </div>
          )}

          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>Disclaimer:</strong> ASVAB requirements, school durations, and grade restrictions change periodically.
            Always verify current requirements with your unit S1 or MTARNG G1 before submitting a reclassification packet.
            DA PAM 611-21 is the authoritative source for ASVAB line score requirements.
          </div>
        </div>
      </div>
    </div>
  )
}
