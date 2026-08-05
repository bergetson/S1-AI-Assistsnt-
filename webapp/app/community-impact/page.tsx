'use client'

import { useMemo, useState } from 'react'
import { useForceData, AS_OF } from '@/components/shared/useForceData'
import { aggregateImpact } from '@/lib/communityImpact/calculateImpact'
import { countyForCity, type ActivationParameters } from '@/lib/communityImpact/types'
import { buildUnitFamilies } from '@/lib/forceAnalytics'
import { isCommunityCritical } from '@/lib/civilian/taxonomy'
import { ImpactBadge, PrototypeNotice, DemoPill, DataSourceBanner } from '@/components/shared/Badges'
import { downloadCsv } from '@/lib/exports'
import { cn } from '@/lib/utils'

const GREEN = '#1B4F2A'
const sel = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700'
const lbl = 'block text-xs font-semibold text-gray-500 uppercase mb-1'

export default function CommunityImpactPage() {
  const { positions, roster, civilianProfiles, rosterIsDemo, civilianIsSynthetic } = useForceData()
  const [selectedBns, setSelectedBns] = useState<string[]>([])
  const [activation, setActivation] = useState<ActivationParameters>({
    durationDays: 30, noticeDays: 30, activationType: 'State Active Duty',
  })

  const families = useMemo(() => buildUnitFamilies(positions, roster), [positions, roster])

  const selectedUics = useMemo(() => {
    const set = new Set<string>()
    for (const fam of families) if (selectedBns.includes(fam.key)) fam.uics.forEach(u => set.add(u))
    return set
  }, [families, selectedBns])

  const members = useMemo(
    () => roster.filter(s => selectedUics.has(s.uic)).map(s => ({
      soldierId: s.id,
      displayName: `${s.lastName}, ${s.firstName}`,
      unit: s.unitName,
      profile: civilianProfiles.get(s.id),
    })),
    [roster, selectedUics, civilianProfiles])

  const summary = useMemo(
    () => aggregateImpact(members, activation, AS_OF),
    [members, activation])

  // Capability that is simultaneously useful ON the mission.
  const missionRelevant = useMemo(() => {
    const m = new Map<string, number>()
    for (const mem of members) {
      for (const s of mem.profile?.skills ?? []) {
        if (isCommunityCritical(s.category, s.subcategory)) {
          m.set(s.subcategory, (m.get(s.subcategory) ?? 0) + 1)
        }
      }
    }
    return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
  }, [members])

  function exportSummary() {
    downloadCsv('community-impact-summary.csv',
      ['Section', 'Item', 'Count'],
      [
        ['Summary', 'Total selected', String(summary.totalSelected)],
        ['Summary', 'With civilian data', String(summary.withCivilianData)],
        ['Summary', 'Missing civilian data', String(summary.missingCivilianData)],
        ['Summary', 'Assessed impact level', summary.level],
        ...summary.byOccupation.map(o => ['Occupation', o.key, String(o.count)]),
        ...summary.byCounty.map(c => ['County', c.key, String(c.count)]),
        ...summary.byEmployer.slice(0, 40).map(e => ['Employer', e.key, String(e.count)]),
        ...summary.criticalRoleCounts.map(r => ['Critical capability', r.key, String(r.count)]),
      ],
      civilianIsSynthetic ? 'DEMO DATA — civilian capability is synthetic. Potential community impact estimate only.' : undefined)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-[1400px] mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GREEN }}>Potential Community Impact</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              Estimates the civilian capability that may leave Montana communities if the selected force
              activates. This is a planning aid, not a recommendation for or against activation.
            </p>
          </div>
          <div className="flex gap-2 no-print">
            <button onClick={exportSummary} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">
              ⬇ Export summary
            </button>
            <button onClick={() => window.print()} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: GREEN }}>
              🖨️ Print brief
            </button>
          </div>
        </div>
      </div>

      {/* Selection */}
      <div className="px-8 py-4 bg-white border-b no-print">
        <div className="max-w-[1400px] mx-auto space-y-3">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className={lbl} htmlFor="dur">Activation duration (days)</label>
              <input id="dur" type="number" min={1} className={sel} value={activation.durationDays}
                onChange={e => setActivation(a => ({ ...a, durationDays: Number(e.target.value) || 1 }))} />
            </div>
            <div>
              <label className={lbl} htmlFor="notice">Notice period (days)</label>
              <input id="notice" type="number" min={0} className={sel} value={activation.noticeDays}
                onChange={e => setActivation(a => ({ ...a, noticeDays: Number(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className={lbl} htmlFor="type">Activation type</label>
              <select id="type" className={sel} value={activation.activationType}
                onChange={e => setActivation(a => ({ ...a, activationType: e.target.value as ActivationParameters['activationType'] }))}>
                <option>State Active Duty</option><option>Title 32</option>
                <option>Title 10</option><option>Training</option><option>Other</option>
              </select>
            </div>
            <button onClick={() => setSelectedBns(families.map(f => f.key))}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">
              Select statewide
            </button>
            <button onClick={() => setSelectedBns([])} className="text-sm text-gray-500 underline hover:text-red-600">
              Clear
            </button>
          </div>

          <fieldset>
            <legend className={lbl}>Formations to activate</legend>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {families.map(fam => (
                <label key={fam.key}
                  className={cn('flex items-start gap-2 rounded-lg border p-2 text-sm cursor-pointer',
                    selectedBns.includes(fam.key) ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:bg-gray-50')}>
                  <input type="checkbox" className="mt-0.5 accent-green-700"
                    checked={selectedBns.includes(fam.key)}
                    onChange={() => setSelectedBns(prev =>
                      prev.includes(fam.key) ? prev.filter(k => k !== fam.key) : [...prev, fam.key])} />
                  <span>
                    <span className="block font-medium text-gray-900">{fam.name}</span>
                    <span className="block text-xs text-gray-500">{fam.assigned} assigned · {fam.uics.length} units</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="max-w-[1400px] mx-auto space-y-5">
          <DataSourceBanner rosterIsDemo={rosterIsDemo} civilianIsSynthetic={civilianIsSynthetic}
            positionCount={positions.length} />

          {members.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-600">
              Select one or more formations above to estimate community impact.
            </div>
          ) : (
            <>
              {/* 1. Activation summary */}
              <section className="rounded-xl border-2 p-5 shadow-sm bg-white"
                style={{ borderColor: summary.level === 'Critical' || summary.level === 'High' ? '#dc2626' : '#e5e7eb' }}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Activation summary</h2>
                    <p className="text-sm text-gray-500">
                      {summary.totalSelected} personnel · {activation.durationDays} days ·{' '}
                      {activation.noticeDays} days notice · {activation.activationType}
                      {civilianIsSynthetic && <> · <DemoPill /></>}
                    </p>
                  </div>
                  <ImpactBadge value={summary.level} />
                </div>
                <div className="grid sm:grid-cols-4 gap-3 mt-4">
                  {[
                    { l: 'Personnel selected', v: summary.totalSelected },
                    { l: 'With civilian data', v: summary.withCivilianData },
                    { l: 'Unknown civilian data', v: summary.missingCivilianData, warn: true },
                    { l: 'Counties affected', v: summary.byCounty.length },
                  ].map(s => (
                    <div key={s.l} className="rounded-lg bg-gray-50 p-3 text-center">
                      <div className="text-xs text-gray-500">{s.l}</div>
                      <div className={cn('text-2xl font-bold', s.warn && s.v > 0 ? 'text-amber-600' : 'text-gray-900')}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 5. Critical role warnings */}
              {summary.concentrationFactors.length > 0 && (
                <section className="rounded-xl border-l-4 border-red-500 border border-gray-200 bg-white p-5 shadow-sm">
                  <h2 className="font-bold text-gray-900 mb-1">Concentration warnings</h2>
                  <p className="text-sm text-gray-500 mb-3">
                    These only appear across a group — the same capability drawn repeatedly from one employer,
                    county, or occupation.
                  </p>
                  <ul className="space-y-2">
                    {summary.concentrationFactors.slice(0, 12).map(f => (
                      <li key={f.id} className="text-sm flex gap-2">
                        <span className="text-red-600 font-bold flex-shrink-0">⚠</span>
                        <span><strong>{f.label}:</strong> {f.detail}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* 2/3/4. Occupations, geography, employers */}
              <section className="grid lg:grid-cols-3 gap-4">
                {[
                  { title: 'Civilian occupations affected', data: summary.byOccupation, empty: 'No occupation data.' },
                  { title: 'Geographic concentration (county)', data: summary.byCounty, empty: 'No county data.' },
                  { title: 'Employer concentration', data: summary.byEmployer, empty: 'No employer data.' },
                ].map(p => (
                  <div key={p.title} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <h2 className="font-bold text-gray-900 text-sm mb-2">{p.title}</h2>
                    {p.data.length === 0 ? <p className="text-xs text-gray-400">{p.empty}</p> : (
                      <ul className="space-y-1 max-h-64 overflow-y-auto">
                        {p.data.slice(0, 20).map(d => (
                          <li key={d.key} className="flex justify-between text-xs border-b border-gray-100 py-1">
                            <span className="text-gray-700 truncate mr-2">{d.key}</span>
                            <span className={cn('font-bold', d.count >= 3 ? 'text-red-700' : 'text-gray-900')}>{d.count}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </section>

              {/* 6. Mission-relevant capability */}
              <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-1">Critical capability in the selected force</h2>
                <p className="text-sm text-gray-500 mb-3">
                  The same people are both a loss to their community and a capability available to the
                  mission. Both readings are shown because the tradeoff is the decision.
                </p>
                {missionRelevant.length === 0 ? (
                  <p className="text-sm text-gray-400">No community-critical capabilities recorded in this selection.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {missionRelevant.map(r => (
                      <span key={r.key} className="text-sm px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900">
                        {r.key} <strong>×{r.count}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {/* 7/8. Limitations and planning questions */}
              <section className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <h2 className="font-bold text-amber-900 text-sm mb-2">Data limitations</h2>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-amber-900">
                    {summary.limitations.map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                  <h2 className="font-bold text-blue-900 text-sm mb-2">Planning questions</h2>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-blue-900">
                    <li>Can any employer identified above backfill for {activation.durationDays} days?</li>
                    <li>Have county emergency managers been consulted where concentration is high?</li>
                    <li>Are there soldiers with the same capability outside the selected formations?</li>
                    <li>Does the {activation.noticeDays}-day notice give employers time to adjust?</li>
                    <li>Which of the {summary.missingCivilianData} soldiers with no civilian data should be asked before the decision?</li>
                  </ul>
                </div>
              </section>

              <PrototypeNotice scope="This estimate" />
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          nav { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  )
}
