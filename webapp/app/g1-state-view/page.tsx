'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useForceData, BASE_YEAR } from '@/components/shared/useForceData'
import {
  stateOverview, applyStateFilter, fullTimeSupportByUnit, mosGaps,
  promotionPipeline, geoHeatTable, type StateFilter,
} from '@/lib/talent/statewideAnalytics'
import { singlePointsOfFailure } from '@/lib/talent/succession'
import { buildUnitFamilies } from '@/lib/forceAnalytics'
import { countByCategory, filterCivilian } from '@/lib/civilian/filters'
import { countyForCity } from '@/lib/communityImpact/types'
import { PrototypeNotice, DemoPill } from '@/components/shared/Badges'
import { downloadCsv } from '@/lib/exports'
import { rankLabel } from '@/lib/commandTypes'
import { AS_OF } from '@/components/shared/useForceData'
import { ActionFeed } from '@/components/shared/ActionFeed'
import { buildActions } from '@/lib/actions/build'
import { actionsForRole } from '@/lib/actions/types'
import { useMarketplaceStore } from '@/lib/marketplaceStore'
import { cn } from '@/lib/utils'

const GREEN = '#1B4F2A'
const sel = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700'
const lbl = 'block text-xs font-semibold text-gray-500 uppercase mb-1'

type Tab = 'overview' | 'distribution' | 'fts' | 'gaps' | 'succession' | 'civilian' | 'heatmap'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'State Force Overview' },
  { id: 'distribution', label: 'Force Distribution' },
  { id: 'fts', label: 'AGR vs M-Day' },
  { id: 'gaps', label: 'Talent Hotspots & Gaps' },
  { id: 'succession', label: 'Succession Risk' },
  { id: 'civilian', label: 'Civilian Skills Overlay' },
  { id: 'heatmap', label: 'State Talent Heatmap' },
]

function Bar({ value, max, label, count }: { value: number; max: number; label: string; count: string }) {
  const pct = max ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-40 truncate text-gray-700" title={label}>{label}</span>
      <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
        <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: GREEN }} />
      </div>
      <span className="w-24 text-right font-semibold text-gray-900">{count}</span>
    </div>
  )
}

export default function G1StateViewPage() {
  const { positions, roster, civilianProfiles, isDemo } = useForceData()
  const [tab, setTab] = useState<Tab>('overview')
  const [f, setF] = useState<StateFilter>({})

  const filtered = useMemo(() => applyStateFilter(roster, positions, f), [roster, positions, f])
  const overview = useMemo(() => stateOverview(positions, roster, f), [positions, roster, f])
  const families = useMemo(() => buildUnitFamilies(positions, roster), [positions, roster])
  const bns = useMemo(() => [...new Set(positions.map(p => p.bn).filter(Boolean) as string[])].sort(), [positions])

  const fts = useMemo(() => fullTimeSupportByUnit(positions, filtered), [positions, filtered])
  const gaps = useMemo(() => mosGaps(positions, filtered), [positions, filtered])
  const pipeline = useMemo(() => promotionPipeline(positions, filtered), [positions, filtered])
  const heat = useMemo(() => geoHeatTable(filtered, BASE_YEAR, 5), [filtered])

  const spof = useMemo(() => {
    const uics = [...new Set(filtered.map(s => s.uic))]
    return singlePointsOfFailure(positions, filtered, uics, BASE_YEAR, 5, { limit: 150 })
  }, [positions, filtered])

  const { applications } = useMarketplaceStore()
  const actions = useMemo(
    () => actionsForRole(buildActions({
      positions, roster: filtered, uics: [...new Set(filtered.map(s => s.uic))],
      civilian: civilianProfiles, applications, baseYear: BASE_YEAR, asOfIso: AS_OF,
    }), 'g1'),
    [positions, filtered, civilianProfiles, applications]
  )

  const civRows = useMemo(
    () => filterCivilian(filtered, civilianProfiles, {}, AS_OF), [filtered, civilianProfiles])
  const civByCategory = useMemo(() => countByCategory(civRows), [civRows])

  function set<K extends keyof StateFilter>(k: K, v: StateFilter[K]) {
    setF(prev => ({ ...prev, [k]: (v as unknown) === '' ? undefined : v }))
  }

  function exportState() {
    downloadCsv('g1-state-force-summary.csv',
      ['Section', 'Key', 'Count', 'Percent'],
      [
        ...overview.byCategory.map(r => ['Personnel category', r.key, String(r.count), `${r.pct}%`]),
        ...overview.byComponent.map(r => ['Component', r.key, String(r.count), `${r.pct}%`]),
        ...overview.byRank.map(r => ['Grade', r.key, String(r.count), `${r.pct}%`]),
        ...overview.byBattalion.map(r => ['Battalion', r.key, String(r.count), `${r.pct}%`]),
        ...overview.byCounty.map(r => ['County', r.key, String(r.count), `${r.pct}%`]),
      ],
      `${isDemo ? 'DEMO DATA — synthetic. ' : ''}Statewide planning summary. Not assignment authority.`)
  }

  const maxCat = Math.max(1, ...overview.byCategory.map(r => r.count))
  const maxBn = Math.max(1, ...overview.byBattalion.map(r => r.count))
  const maxRank = Math.max(1, ...overview.byRank.map(r => r.count))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-[1500px] mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GREEN }}>
              G1 State View {isDemo && <DemoPill />}
            </h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              Statewide personnel and talent analytics above the formation level. Drill from state to
              battalion to unit to soldier.
            </p>
          </div>
          <button onClick={exportState} className="px-4 py-2 rounded-lg text-white text-sm font-medium no-print"
            style={{ backgroundColor: GREEN }}>
            ⬇ Export state summary
          </button>
        </div>
      </div>

      <div className="bg-red-50 border-y border-red-200 px-8 py-2">
        <p className="max-w-[1500px] mx-auto text-xs font-semibold text-red-900">
          This view represents statewide personnel data for planning purposes only. It does not represent
          assignment authority, official orders, or an authoritative personnel record.
        </p>
      </div>

      {/* Filters persist across tabs */}
      <div className="px-8 py-4 bg-white border-b no-print">
        <div className="max-w-[1500px] mx-auto grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className={lbl} htmlFor="bn">Formation</label>
            <select id="bn" className={cn(sel, 'w-full')} value={f.bn ?? ''} onChange={e => set('bn', e.target.value)}>
              <option value="">Statewide</option>
              {bns.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl} htmlFor="comp">Component</label>
            <select id="comp" className={cn(sel, 'w-full')} value={f.componentStatus ?? ''} onChange={e => set('componentStatus', e.target.value)}>
              <option value="">All</option>
              <option>AGR</option><option>M-Day</option><option>Technician</option><option>ADOS</option>
            </select>
          </div>
          <div>
            <label className={lbl} htmlFor="cat">Personnel category</label>
            <select id="cat" className={cn(sel, 'w-full')} value={f.careerCategory ?? ''}
              onChange={e => set('careerCategory', e.target.value as StateFilter['careerCategory'])}>
              <option value="">All</option>
              <option>Officer</option><option>Warrant</option><option>Enlisted</option>
            </select>
          </div>
          <div>
            <label className={lbl} htmlFor="rk">Grade</label>
            <select id="rk" className={cn(sel, 'w-full')} value={f.rank ?? ''} onChange={e => set('rank', e.target.value)}>
              <option value="">All</option>
              {overview.byRank.map(r => <option key={r.key}>{r.key}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl} htmlFor="cty">County</label>
            <select id="cty" className={cn(sel, 'w-full')} value={f.county ?? ''} onChange={e => set('county', e.target.value)}>
              <option value="">All</option>
              {heat.map(h => <option key={h.county}>{h.county}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-700 pb-2">
              <input type="checkbox" className="accent-green-700" checked={Boolean(f.boardEligibleOnly)}
                onChange={e => set('boardEligibleOnly', e.target.checked || undefined)} />
              Board eligible only
            </label>
            <button onClick={() => setF({})} className="text-xs underline text-gray-500 hover:text-red-600 pb-2">Reset</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 bg-white border-b overflow-x-auto no-print">
        <div className="max-w-[1500px] mx-auto flex gap-1" role="tablist">
          {TABS.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={cn('px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition',
                tab === t.id ? 'border-green-700 text-green-800' : 'border-transparent text-gray-500 hover:text-gray-800')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="max-w-[1500px] mx-auto space-y-5">
          <p className="text-xs text-gray-500">
            Scope: <strong>{f.bn ?? 'Statewide'}</strong> · {filtered.length} soldiers ·{' '}
            {overview.totalAuthorized} authorized · {overview.fillPct}% fill ·{' '}
            Data is {isDemo ? 'synthetic demonstration data' : 'imported'} and aggregated
          </p>

          {tab === 'overview' && (
            <>
              <ActionFeed items={actions} title="Statewide priorities" limit={4} />

              <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { l: 'Total soldiers', v: overview.totalSoldiers },
                  { l: 'Authorized', v: overview.totalAuthorized },
                  { l: 'Fill rate', v: `${overview.fillPct}%` },
                  { l: 'Battalions', v: overview.byBattalion.length },
                  { l: 'Counties', v: overview.byCounty.length },
                ].map(s => (
                  <div key={s.l} className="bg-white rounded-lg px-4 py-3 shadow-sm border text-center">
                    <div className="text-xs text-gray-500 mb-1">{s.l}</div>
                    <div className="text-2xl font-bold text-gray-900">{s.v}</div>
                  </div>
                ))}
              </section>
              <section className="grid lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border p-4 shadow-sm space-y-1.5">
                  <h2 className="font-bold text-gray-900 text-sm mb-2">Personnel category</h2>
                  {overview.byCategory.map(r => (
                    <Bar key={r.key} label={r.key} value={r.count} max={maxCat} count={`${r.count} (${r.pct}%)`} />
                  ))}
                </div>
                <div className="bg-white rounded-xl border p-4 shadow-sm space-y-1.5">
                  <h2 className="font-bold text-gray-900 text-sm mb-2">Component</h2>
                  {overview.byComponent.map(r => (
                    <Bar key={r.key} label={r.key} value={r.count} max={maxCat} count={`${r.count} (${r.pct}%)`} />
                  ))}
                </div>
              </section>
              <section className="bg-white rounded-xl border p-4 shadow-sm space-y-1.5">
                <h2 className="font-bold text-gray-900 text-sm mb-2">By battalion (click to drill down)</h2>
                {overview.byBattalion.map(r => (
                  <button key={r.key} onClick={() => set('bn', r.key)} className="w-full text-left">
                    <Bar label={r.key} value={r.count} max={maxBn} count={`${r.count} (${r.pct}%)`} />
                  </button>
                ))}
              </section>
            </>
          )}

          {tab === 'distribution' && (
            <section className="grid lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border p-4 shadow-sm space-y-1.5">
                <h2 className="font-bold text-gray-900 text-sm mb-2">By grade</h2>
                {overview.byRank.map(r => (
                  <Bar key={r.key} label={`${rankLabel(r.key)} (${r.key})`} value={r.count} max={maxRank} count={`${r.count}`} />
                ))}
              </div>
              <div className="bg-white rounded-xl border p-4 shadow-sm space-y-1.5">
                <h2 className="font-bold text-gray-900 text-sm mb-2">Top MOS</h2>
                {overview.byMos.slice(0, 18).map(r => (
                  <Bar key={r.key} label={r.key} value={r.count} max={overview.byMos[0]?.count ?? 1} count={`${r.count}`} />
                ))}
              </div>
            </section>
          )}

          {tab === 'fts' && (
            <section className="bg-white rounded-xl border shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Full-time support distribution by unit</caption>
                <thead className="bg-gray-100">
                  <tr>{['Unit', 'Battalion', 'Assigned', 'AGR', 'Tech', 'M-Day', 'Full-time %'].map(h =>
                    <th key={h} className="text-left px-3 py-2 text-xs font-bold text-gray-600">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {fts.slice(0, 60).map((r, i) => (
                    <tr key={r.uic} className={i % 2 ? 'bg-gray-50' : ''}>
                      <td className="px-3 py-1.5 text-xs">{r.unitName}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-500 truncate max-w-[220px]">{r.battalion}</td>
                      <td className="px-3 py-1.5 text-xs text-right">{r.assigned}</td>
                      <td className="px-3 py-1.5 text-xs text-right">{r.agr}</td>
                      <td className="px-3 py-1.5 text-xs text-right">{r.technician}</td>
                      <td className="px-3 py-1.5 text-xs text-right">{r.mday}</td>
                      <td className={cn('px-3 py-1.5 text-xs text-right font-bold',
                        r.fullTimePct < 5 ? 'text-amber-600' : 'text-gray-800')}>{r.fullTimePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-500 p-3 border-t">
                Low full-time percentages are shown without judgement — no validated staffing threshold is
                encoded in this prototype.
              </p>
            </section>
          )}

          {tab === 'gaps' && (
            <section className="grid lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <h2 className="font-bold text-gray-900 text-sm mb-2">MOS shortages</h2>
                <table className="w-full text-xs">
                  <thead className="text-gray-500 border-b"><tr>
                    <th className="text-left py-1">MOS</th><th className="text-right">Auth</th>
                    <th className="text-right">Asgn</th><th className="text-right">Fill</th></tr></thead>
                  <tbody>
                    {gaps.filter(g => g.status === 'Shortage' && g.authorized >= 3).slice(0, 20).map(g => (
                      <tr key={g.mos} className="border-b border-gray-100">
                        <td className="py-1 font-mono">{g.mos}</td><td className="text-right">{g.authorized}</td>
                        <td className="text-right">{g.assigned}</td>
                        <td className="text-right font-bold text-red-700">{g.fillPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <h2 className="font-bold text-gray-900 text-sm mb-2">Promotion pipeline</h2>
                <table className="w-full text-xs">
                  <thead className="text-gray-500 border-b"><tr>
                    <th className="text-left py-1">Transition</th><th className="text-right">Open</th>
                    <th className="text-right">Eligible</th><th className="text-right">Status</th></tr></thead>
                  <tbody>
                    {pipeline.filter(p => p.openAtTarget > 0 || p.status !== 'Healthy').slice(0, 20).map(p => (
                      <tr key={`${p.careerCategory}-${p.fromGrade}-${p.toGrade}`} className="border-b border-gray-100">
                        <td className="py-1">{rankLabel(p.fromGrade)}→{rankLabel(p.toGrade)}</td>
                        <td className="text-right">{p.openAtTarget}</td>
                        <td className="text-right">{p.eligibleNow}</td>
                        <td className={cn('text-right font-bold',
                          p.status === 'Critical' || p.status === 'No Feeder' ? 'text-red-700'
                            : p.status === 'Thin' ? 'text-amber-600' : 'text-green-700')}>{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'succession' && (
            <section className="bg-white rounded-xl border p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-1">Single points of failure</h2>
              <p className="text-sm text-gray-500 mb-3">
                Key billets with thin or no succession depth, and people the force depends on more than once.
              </p>
              {spof.findings.length === 0 ? (
                <p className="text-sm text-gray-400">No single points of failure detected in this scope.</p>
              ) : (
                <ul className="space-y-2">
                  {spof.findings.slice(0, 30).map((s, i) => (
                    <li key={i} className={cn('rounded border p-2 text-sm',
                      s.severity === 'Critical' ? 'border-red-300 bg-red-50'
                        : s.severity === 'High' ? 'border-amber-300 bg-amber-50' : 'border-gray-200')}>
                      <div className="font-semibold text-gray-900">
                        <span className="text-xs uppercase mr-2 opacity-70">{s.severity}</span>{s.label}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">{s.kind} — {s.detail}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === 'civilian' && (
            <section className="space-y-4">
              <div className="bg-white rounded-xl border p-4 shadow-sm">
                <h2 className="font-bold text-gray-900 text-sm mb-2">
                  Civilian capability distribution ({civRows.length} of {filtered.length} soldiers have data)
                </h2>
                <div className="space-y-1.5">
                  {civByCategory.slice(0, 20).map(c => (
                    <Bar key={c.key} label={c.key} value={c.count}
                      max={civByCategory[0]?.count ?? 1}
                      count={`${c.count} (${c.verifiedCount} verified)`} />
                  ))}
                </div>
              </div>
              <Link href="/skills" className="inline-block text-sm underline text-green-700 font-medium">
                Open the full Civilian Skills Explorer →
              </Link>
            </section>
          )}

          {tab === 'heatmap' && (
            <section className="bg-white rounded-xl border shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="text-left text-sm font-bold text-gray-900 p-3">
                  Geographic distribution by county
                  <span className="block text-xs font-normal text-gray-500">
                    A printable, accessible alternative to a map. Shading reflects soldier density.
                  </span>
                </caption>
                <thead className="bg-gray-100">
                  <tr>{['County', 'Cities', 'Soldiers', 'Officer', 'Warrant', 'Enlisted', 'AGR', 'Projected losses (5 yr)'].map(h =>
                    <th key={h} className="text-left px-3 py-2 text-xs font-bold text-gray-600">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {heat.map(r => {
                    const intensity = Math.min(1, r.soldiers / (heat[0]?.soldiers || 1))
                    return (
                      <tr key={r.county} style={{ backgroundColor: `rgba(27,79,42,${(intensity * 0.18).toFixed(3)})` }}>
                        <td className="px-3 py-1.5 text-xs font-semibold">{r.county}</td>
                        <td className="px-3 py-1.5 text-xs text-gray-500">{r.cities.join(', ')}</td>
                        <td className="px-3 py-1.5 text-xs text-right font-bold">{r.soldiers}</td>
                        <td className="px-3 py-1.5 text-xs text-right">{r.officers}</td>
                        <td className="px-3 py-1.5 text-xs text-right">{r.warrants}</td>
                        <td className="px-3 py-1.5 text-xs text-right">{r.enlisted}</td>
                        <td className="px-3 py-1.5 text-xs text-right">{r.agr}</td>
                        <td className="px-3 py-1.5 text-xs text-right text-red-700">{r.projectedLosses}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          )}

          <PrototypeNotice scope="This statewide view" />
        </div>
      </div>
    </div>
  )
}
