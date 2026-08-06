'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { positions } from '@/lib/data/positions'
import { useCommandStore } from '@/lib/commandStore'
import { realRoster, DEFAULT_FORMATION_UICS, REAL_ROSTER_MISSING_FIELDS } from '@/lib/data/realRoster'
import { buildUnitFamilies, summarizeForce } from '@/lib/forceAnalytics'
import { BASELINE_ROSTER_SOURCE, IMPORTED_ROSTER_SOURCE } from '@/lib/dataSources'
import { cn } from '@/lib/utils'

export const ARMY_GREEN = '#1B4F2A'
export const GOLD = '#C8A96E'

/**
 * The baseline roster is the REAL MTARNG force, de-identified: real grades,
 * MOSs, units, locations, component status, time in position, ETS dates, and
 * MOS qualification, with sequential pseudonyms in place of identity.
 *
 * It is never written to localStorage — that space is reserved for a commander's
 * own imported roster.
 */
export function getBaseRoster() {
  return realRoster
}

export { REAL_ROSTER_MISSING_FIELDS }

/**
 * Resolves the roster actually in play — the commander's own import when there
 * is one, the de-identified real force otherwise, so no page has to branch.
 */
export function useActiveRoster() {
  const { roster, source } = useCommandStore()
  return useMemo(
    () => (source === 'imported' ? roster : getBaseRoster()),
    [roster, source]
  )
}

/**
 * Seeds the opening formation on first visit so the view doesn't land on an empty
 * state. Runs once; a commander who deliberately clears the formation keeps it clear.
 */
export function useSeedFormation() {
  const { selectedUics, setSelectedUics } = useCommandStore()
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    if (selectedUics.length === 0) setSelectedUics(DEFAULT_FORMATION_UICS)
    // Intentionally runs once on mount; re-seeding would fight a deliberate clear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/**
 * Persisted zustand hydrates after first paint, so a commander's own imported
 * roster would briefly render under the baseline-source banner. That is a trust
 * bug rather than a cosmetic one, so the banner and headline counts wait a tick.
 *
 * The mount-effect setState below is the canonical hydration guard — the whole
 * point is to render differently before and after hydration, so the lint rule
 * against synchronous setState in an effect does not apply here.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), [])
  return hydrated
}

/**
 * States what the roster on screen actually is. Deliberately NOT called
 * DemoBanner: the baseline is the real force with identity removed, and a
 * component whose name says "demo" while its text says "real" is exactly the
 * drift that made one screen contradict another. Text comes from the single
 * DataSource model so it cannot diverge from what the AI is told.
 */
export function RosterSourceBanner() {
  const { source } = useCommandStore()
  const hydrated = useHydrated()
  if (!hydrated) return null

  if (source === 'imported') {
    return (
      <div className="bg-emerald-50 border-y border-emerald-300 text-emerald-900 px-8 py-2 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="px-2 py-0.5 rounded bg-emerald-700 text-white text-xs font-bold tracking-wide">
          YOUR IMPORTED ROSTER
        </span>
        <span>{IMPORTED_ROSTER_SOURCE.statement}</span>
        <Link href="/command/import" className="underline font-semibold ml-auto whitespace-nowrap">
          Manage import →
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-blue-50 border-y border-blue-300 text-blue-900 px-8 py-2 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="px-2 py-0.5 rounded bg-blue-700 text-white text-xs font-bold tracking-wide">
        REAL FORCE · DE-IDENTIFIED
      </span>
      <span>
        {BASELINE_ROSTER_SOURCE.statement}{' '}
        Not in the extract: {BASELINE_ROSTER_SOURCE.missingFields?.join(', ')} — these read as Unknown.
      </span>
      <Link href="/command/import" className="underline font-semibold ml-auto whitespace-nowrap">
        Import a named roster →
      </Link>
    </div>
  )
}

/** Print-only watermark noting the identity boundary. */
export function RosterSourceWatermark() {
  const { source } = useCommandStore()
  const hydrated = useHydrated()
  if (!hydrated || source === 'imported') return null
  return <div className="demo-watermark" aria-hidden>DE-IDENTIFIED — NAMES WITHHELD</div>
}

export function CommandHeader({
  title, subtitle, actions,
}: {
  title: string
  subtitle: string
  actions?: React.ReactNode
}) {
  return (
    <div className="px-8 py-6 bg-white border-b">
      <div className="max-w-6xl mx-auto flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: ARMY_GREEN }}>{title}</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">{subtitle}</p>
        </div>
        {actions && <div className="flex gap-3 no-print">{actions}</div>}
      </div>
    </div>
  )
}

/** Green band showing what the selected formation actually is. */
export function FormationBar() {
  const { selectedUics } = useCommandStore()
  const roster = useActiveRoster()
  const hydrated = useHydrated()

  const summary = useMemo(
    () => summarizeForce(positions, roster, selectedUics),
    [roster, selectedUics]
  )
  const families = useMemo(() => buildUnitFamilies(positions, roster), [roster])
  const selectedNames = useMemo(() => {
    const names = families
      .filter(f => f.uics.some(u => selectedUics.includes(u)))
      .map(f => f.name)
    return names
  }, [families, selectedUics])

  return (
    <div className="px-8 py-4 text-white text-sm" style={{ backgroundColor: ARMY_GREEN }}>
      <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="font-bold" style={{ color: GOLD }}>FORMATION:</span>
        {selectedUics.length === 0 ? (
          <span className="text-green-200">None selected — choose your units below.</span>
        ) : (
          <>
            <span className="font-semibold">
              {selectedNames.slice(0, 3).join(' · ')}
              {selectedNames.length > 3 && ` +${selectedNames.length - 3} more`}
            </span>
            <span className="opacity-60">|</span>
            <span>{selectedUics.length} unit{selectedUics.length === 1 ? '' : 's'}</span>
            <span className="opacity-60">|</span>
            <span>
              <strong>{hydrated ? summary.assigned : '—'}</strong> assigned /{' '}
              <strong>{summary.authorized}</strong> authorized
            </span>
            <span className="opacity-60">|</span>
            <span className={cn('font-bold', summary.fillPct < 80 ? 'text-amber-300' : 'text-green-200')}>
              {summary.fillPct}% fill
            </span>
          </>
        )}
        <Link href="/command" className="ml-auto underline text-amber-200 font-semibold no-print">
          Change formation
        </Link>
      </div>
    </div>
  )
}

/** Empty state shown by every commander page when no units are selected. */
export function NoFormation() {
  return (
    <div className="max-w-2xl mx-auto mt-16 text-center px-4">
      <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mx-auto mb-5 bg-green-100 text-green-800">
        🛡️
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-3">Select Your Formation</h2>
      <p className="text-gray-600 mb-6">
        Choose the units you command. Everything on these pages — manning, attrition,
        promotion requirements, and succession — is computed for that selection only.
      </p>
      <Link
        href="/command"
        className="inline-block px-6 py-3 rounded-lg text-white font-semibold"
        style={{ backgroundColor: ARMY_GREEN }}
      >
        Choose Units →
      </Link>
    </div>
  )
}

/** Print rules. Mirrors the counseling page, plus the demo watermark. */
export function CommandPrintStyles() {
  return (
    <style jsx global>{`
      .demo-watermark { display: none; }
      @media print {
        .no-print { display: none !important; }
        nav { display: none !important; }
        body { background: white; }
        .shadow-sm, .shadow { box-shadow: none !important; }
        .demo-watermark {
          display: block !important;
          position: fixed;
          top: 45%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-28deg);
          font-size: 42px;
          font-weight: 800;
          color: rgba(220, 38, 38, 0.16);
          letter-spacing: 3px;
          pointer-events: none;
          z-index: 9999;
          white-space: nowrap;
        }
      }
    `}</style>
  )
}
