'use client'

import { useMemo, useState } from 'react'
import { useForceData, AS_OF } from '@/components/shared/useForceData'
import { findCandidates, computeFills } from '@/lib/mission/matcher'
import { buildCoa, DEFAULT_COA_KINDS } from '@/lib/mission/coa'
import type { MissionDefinition, CapabilityRequirement, CoaKind } from '@/lib/mission/types'
import { categoryNames, subcategoriesOf } from '@/lib/civilian/taxonomy'
import { MT_CITIES } from '@/lib/data/cities'
import { ImpactBadge, VerificationBadge, PrototypeNotice, DemoPill, MissingDataNote, DataSourceBanner } from '@/components/shared/Badges'
import { downloadCsv } from '@/lib/exports'
import { rankLabel } from '@/lib/commandTypes'
import { cn } from '@/lib/utils'

const GREEN = '#1B4F2A'
const sel = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700'
const lbl = 'block text-xs font-semibold text-gray-500 uppercase mb-1'

const STARTER: CapabilityRequirement[] = [
  { id: 'r1', category: 'Electrical', subcategory: 'Master Electrician', label: 'Master electricians', quantity: 4 },
  { id: 'r2', category: 'Project Management', subcategory: 'Project Manager', label: 'Project managers', quantity: 2 },
  { id: 'r3', category: 'Heavy Equipment', subcategory: 'Excavator Operator', label: 'Heavy equipment operators', quantity: 3 },
  { id: 'r4', category: 'Emergency Medical Services', subcategory: 'Paramedic', label: 'EMT-qualified personnel', quantity: 2 },
]

export default function MissionBuilderPage() {
  const { roster, civilianProfiles, rosterIsDemo, civilianIsSynthetic } = useForceData()
  const [name, setName] = useState('Temporary Power and Shelter Support')
  const [location, setLocation] = useState('Great Falls')
  const [durationDays, setDuration] = useState(45)
  const [noticeDays, setNotice] = useState(14)
  const [requireVerified, setRequireVerified] = useState(false)
  const [requireWillingness, setRequireWillingness] = useState(true)
  const [reqs, setReqs] = useState<CapabilityRequirement[]>(STARTER)
  const [manual, setManual] = useState<string[]>([])
  const [activeCoa, setActiveCoa] = useState<CoaKind>('Best Technical Fit')
  const [newCat, setNewCat] = useState(categoryNames()[0])
  const [newSub, setNewSub] = useState(subcategoriesOf(categoryNames()[0])[0] ?? '')
  const [newQty, setNewQty] = useState(1)

  const mission: MissionDefinition = useMemo(() => ({
    id: 'm1', name, missionType: 'Domestic Support', location,
    durationDays, noticeDays, requirements: reqs,
    constraints: { requireVerifiedSkills: requireVerified, requireWillingness },
    objectives: { minimizeCommunityImpact: true, minimizeUnitDisruption: true, preserveSuccessionDepth: false },
  }), [name, location, durationDays, noticeDays, reqs, requireVerified, requireWillingness])

  const candidates = useMemo(
    () => findCandidates(mission, roster, civilianProfiles, AS_OF),
    [mission, roster, civilianProfiles])

  const coas = useMemo(
    () => DEFAULT_COA_KINDS.map(k => buildCoa(k, mission, candidates, civilianProfiles, AS_OF)),
    [mission, candidates, civilianProfiles])

  const manualCoa = useMemo(
    () => manual.length ? buildCoa('User Defined', mission, candidates, civilianProfiles, AS_OF, manual) : null,
    [mission, candidates, civilianProfiles, manual])

  const shownCoa = activeCoa === 'User Defined' ? manualCoa : coas.find(c => c.kind === activeCoa)
  const selectedIds = new Set(shownCoa?.selectedIds ?? [])
  const fills = shownCoa ? shownCoa.requirementFills : computeFills(mission, [])

  function addReq() {
    if (!newSub) return
    setReqs(r => [...r, {
      id: `r${Date.now()}`, category: newCat, subcategory: newSub,
      label: newSub, quantity: newQty,
    }])
  }

  function exportRoster() {
    const sel = candidates.filter(c => selectedIds.has(c.soldierId))
    downloadCsv(`mission-${name.toLowerCase().replace(/\s+/g, '-')}-roster.csv`,
      ['Name', 'Rank', 'MOS', 'Unit', 'Home City', 'Satisfies', 'Fit', 'Verification', 'Willingness', 'Distance mi', 'Community Impact', 'Warnings'],
      sel.map(c => [
        c.displayName, c.rank, c.mos, c.unit, c.city,
        c.satisfies.map(id => reqs.find(r => r.id === id)?.label ?? id).join('; '),
        String(c.fitScore), c.verification, c.willingness,
        c.distanceMiles == null ? 'unknown' : String(c.distanceMiles),
        c.communityImpact, c.warnings.join('; '),
      ]),
      `${civilianIsSynthetic ? 'DEMO DATA — civilian capability is synthetic. ' : ''}Decision support only — not an order or tasking.`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-[1500px] mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GREEN }}>Mission Team Builder</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              Define what a mission needs, then see who in the force can meet it — using both military
              qualifications and civilian expertise. Candidate ranking is deterministic and fully explained.
            </p>
          </div>
          <button onClick={exportRoster} disabled={selectedIds.size === 0}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 no-print"
            style={{ backgroundColor: GREEN }}>
            ⬇ Export selected team ({selectedIds.size})
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="max-w-[1500px] mx-auto grid lg:grid-cols-[380px_1fr] gap-6">

          {/* ── Mission definition ── */}
          <aside className="space-y-4">
            <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
              <h2 className="font-bold text-gray-900">Mission</h2>
              <div>
                <label className={lbl} htmlFor="mname">Name</label>
                <input id="mname" className={cn(sel, 'w-full')} value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl} htmlFor="mloc">Location</label>
                  <select id="mloc" className={cn(sel, 'w-full')} value={location} onChange={e => setLocation(e.target.value)}>
                    {MT_CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl} htmlFor="mdur">Duration (days)</label>
                  <input id="mdur" type="number" min={1} className={cn(sel, 'w-full')} value={durationDays}
                    onChange={e => setDuration(Number(e.target.value) || 1)} />
                </div>
                <div>
                  <label className={lbl} htmlFor="mnot">Notice (days)</label>
                  <input id="mnot" type="number" min={0} className={cn(sel, 'w-full')} value={noticeDays}
                    onChange={e => setNotice(Number(e.target.value) || 0)} />
                </div>
              </div>
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" className="accent-green-700" checked={requireVerified}
                    onChange={e => setRequireVerified(e.target.checked)} />
                  Require verified skills
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" className="accent-green-700" checked={requireWillingness}
                    onChange={e => setRequireWillingness(e.target.checked)} />
                  Exclude soldiers who declined civilian-skill use
                </label>
              </div>
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
              <h2 className="font-bold text-gray-900">Required capabilities</h2>
              <ul className="space-y-2">
                {reqs.map(r => {
                  const fill = fills.find(f => f.requirement.id === r.id)
                  return (
                    <li key={r.id} className={cn('rounded-lg border p-2',
                      fill && fill.unmet > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200')}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{r.label}</div>
                          <div className="text-xs text-gray-500">{r.category} · {r.subcategory}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <input type="number" min={1} value={r.quantity} aria-label={`Quantity for ${r.label}`}
                            onChange={e => setReqs(rs => rs.map(x => x.id === r.id ? { ...x, quantity: Number(e.target.value) || 1 } : x))}
                            className="w-14 border border-gray-300 rounded px-1 py-0.5 text-sm text-center" />
                          <button onClick={() => setReqs(rs => rs.filter(x => x.id !== r.id))}
                            className="text-xs text-gray-400 hover:text-red-600" aria-label={`Remove ${r.label}`}>✕</button>
                        </div>
                      </div>
                      {fill && (
                        <div className="mt-1 text-xs">
                          {fill.unmet > 0
                            ? <span className="text-red-700 font-semibold">Unmet: {fill.unmet} of {fill.needed}</span>
                            : <span className="text-green-700">Filled {fill.filled}/{fill.needed}{fill.over > 0 && ` (+${fill.over} over)`}</span>}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>

              <div className="border-t pt-3 space-y-2">
                <select className={cn(sel, 'w-full')} value={newCat} aria-label="New requirement category"
                  onChange={e => { setNewCat(e.target.value); setNewSub(subcategoriesOf(e.target.value)[0] ?? '') }}>
                  {categoryNames().map(c => <option key={c}>{c}</option>)}
                </select>
                <select className={cn(sel, 'w-full')} value={newSub} aria-label="New requirement skill"
                  onChange={e => setNewSub(e.target.value)}>
                  {subcategoriesOf(newCat).map(s => <option key={s}>{s}</option>)}
                </select>
                <div className="flex gap-2">
                  <input type="number" min={1} value={newQty} aria-label="Quantity needed"
                    onChange={e => setNewQty(Number(e.target.value) || 1)}
                    className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm" />
                  <button onClick={addReq} className="flex-1 px-3 py-2 rounded-lg text-white text-sm font-semibold"
                    style={{ backgroundColor: GREEN }}>+ Add requirement</button>
                </div>
              </div>
            </section>
          </aside>

          {/* ── COAs and candidates ── */}
          <div className="space-y-5">
            <DataSourceBanner rosterIsDemo={rosterIsDemo} civilianIsSynthetic={civilianIsSynthetic} />

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Personnel courses of action</h2>
              <p className="text-sm text-gray-500 mb-3">
                Each COA optimizes for something different. All are built deterministically from the same
                candidate pool, so the differences are the tradeoffs — not randomness.
              </p>
              <div className="grid md:grid-cols-3 gap-3">
                {coas.map(coa => (
                  <button key={coa.id} onClick={() => setActiveCoa(coa.kind)}
                    aria-pressed={activeCoa === coa.kind}
                    className={cn('text-left rounded-xl border-2 p-4 transition bg-white',
                      activeCoa === coa.kind ? 'border-green-500 shadow-md' : 'border-gray-200 hover:border-gray-300')}>
                    <div className="font-bold text-gray-900 text-sm">{coa.kind}</div>
                    <p className="text-xs text-gray-500 mt-1 mb-2">{coa.description}</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className={cn('text-xs px-2 py-0.5 rounded font-medium',
                        coa.requirementsFilledPct === 100 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800')}>
                        {coa.requirementsFilledPct}% filled
                      </span>
                      <ImpactBadge value={coa.communityImpact} />
                    </div>
                    <dl className="text-xs text-gray-600 space-y-0.5">
                      <div className="flex justify-between"><dt>Personnel</dt><dd className="font-semibold">{coa.selectedIds.length}</dd></div>
                      <div className="flex justify-between"><dt>Units affected</dt><dd className="font-semibold">{coa.unitsAffected}</dd></div>
                      <div className="flex justify-between"><dt>Employers affected</dt><dd className="font-semibold">{coa.employersAffected}</dd></div>
                      <div className="flex justify-between"><dt>Counties</dt><dd className="font-semibold">{coa.countiesAffected}</dd></div>
                      <div className="flex justify-between"><dt>Avg distance</dt><dd className="font-semibold">{coa.avgDistanceMiles == null ? 'unknown' : `${coa.avgDistanceMiles} mi`}</dd></div>
                      <div className="flex justify-between"><dt>Verification (0-3)</dt><dd className="font-semibold">{coa.avgVerificationScore}</dd></div>
                    </dl>
                  </button>
                ))}
              </div>
            </section>

            {shownCoa && (
              <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-2">{shownCoa.kind} — tradeoffs</h3>
                <ul className="space-y-1 mb-3">
                  {shownCoa.tradeoffs.map((t, i) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-gray-400">•</span><span>{t}</span>
                    </li>
                  ))}
                </ul>
                {shownCoa.duplicateCoverage.length > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900 mb-2">
                    <strong>Single points of failure:</strong>{' '}
                    {shownCoa.duplicateCoverage.map(d => d.displayName).join(', ')} cover more than one
                    requirement. Losing one creates multiple gaps.
                  </div>
                )}
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer font-medium">Limitations</summary>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    {shownCoa.limitations.map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                </details>
              </section>
            )}

            {/* Candidate pool */}
            <section>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h2 className="text-lg font-bold text-gray-900">
                  Candidate pool <span className="text-sm font-normal text-gray-500">({candidates.length} qualify for at least one requirement)</span>
                </h2>
                {manual.length > 0 && (
                  <button onClick={() => setActiveCoa('User Defined')}
                    className="text-sm underline text-green-700">View my manual selection ({manual.length})</button>
                )}
              </div>

              {candidates.length === 0 ? (
                <MissingDataNote>
                  Nobody in the force matches these requirements. Either the capability is not present, or it
                  has not been recorded in civilian profiles yet.
                </MissingDataNote>
              ) : (
                <div className="space-y-2">
                  {candidates.slice(0, 60).map(c => {
                    const inCoa = selectedIds.has(c.soldierId)
                    const picked = manual.includes(c.soldierId)
                    return (
                      <article key={c.soldierId}
                        className={cn('bg-white rounded-lg border p-3 shadow-sm',
                          c.blockers.length ? 'border-red-200 bg-red-50/40'
                            : inCoa ? 'border-green-400' : 'border-gray-200')}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-gray-900">
                                {rankLabel(c.rank)} {c.displayName}
                              </span>
                              {(rosterIsDemo || civilianIsSynthetic) && <DemoPill />}
                              {inCoa && <span className="text-xs px-2 py-0.5 rounded bg-green-600 text-white font-medium">In this COA</span>}
                              <VerificationBadge value={c.verification} />
                              <ImpactBadge value={c.communityImpact} />
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {c.mos} · {c.unit} · {c.city}
                              {c.distanceMiles != null ? ` · ${c.distanceMiles} mi to ${location}` : ' · distance unknown'}
                              {' · '}Willingness: {c.willingness}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Satisfies: {c.satisfies.map(id => reqs.find(r => r.id === id)?.label ?? id).join(', ')}
                            </div>
                            {c.warnings.map((w, i) => (
                              <div key={i} className="text-xs text-amber-800 mt-1">⚠ {w}</div>
                            ))}
                            {c.blockers.map((b, i) => (
                              <div key={i} className="text-xs text-red-800 font-medium mt-1">✕ {b}</div>
                            ))}
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <div className="text-xl font-bold text-gray-800">{c.fitScore}<span className="text-xs text-gray-400">/100</span></div>
                            <button
                              onClick={() => setManual(m => picked ? m.filter(x => x !== c.soldierId) : [...m, c.soldierId])}
                              className={cn('text-xs px-2 py-1 rounded border font-medium',
                                picked ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 hover:bg-gray-50')}>
                              {picked ? '✓ Selected' : '+ Select'}
                            </button>
                          </div>
                        </div>
                        <details className="mt-2">
                          <summary className="text-xs text-blue-700 cursor-pointer">Why this score?</summary>
                          <div className="mt-1 space-y-0.5">
                            {c.factors.map((f, i) => (
                              <div key={i} className="text-xs flex justify-between gap-2 border-b border-gray-100 py-0.5">
                                <span className="text-gray-600">{f.label}</span>
                                <span className="text-gray-400 flex-1 text-right">{f.detail}</span>
                                <span className="font-bold w-12 text-right">{f.points}/{f.max}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      </article>
                    )
                  })}
                  {candidates.length > 60 && (
                    <p className="text-sm text-gray-500 text-center">Showing 60 of {candidates.length}.</p>
                  )}
                </div>
              )}
            </section>

            <PrototypeNotice scope="This mission plan" />
          </div>
        </div>
      </div>
    </div>
  )
}
