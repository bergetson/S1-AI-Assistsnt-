'use client'

import { useMemo, useState } from 'react'
import { useForceData, AS_OF } from '@/components/shared/useForceData'
import { filterCivilian, countByCategory, countBySubcategory, countByCounty, countByOccupation, type CivilianFilter } from '@/lib/civilian/filters'
import { categoryNames, subcategoriesOf } from '@/lib/civilian/taxonomy'
import { PROFICIENCY_ORDER, type SkillProficiency, type VerificationStatus } from '@/lib/civilian/types'
import { countyForCity } from '@/lib/communityImpact/types'
import { VerificationBadge, DemoPill, PrototypeNotice, MissingDataNote, DataSourceBanner } from '@/components/shared/Badges'
import { downloadCsv } from '@/lib/exports'
import { rankLabel, soldierLabel } from '@/lib/commandTypes'
import { cn } from '@/lib/utils'

const GREEN = '#1B4F2A'
const sel = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700'
const lbl = 'block text-xs font-semibold text-gray-500 uppercase mb-1'

export default function SkillsExplorerPage() {
  const { positions, roster, civilianProfiles, rosterIsDemo, civilianIsSynthetic } = useForceData()
  const [f, setF] = useState<CivilianFilter>({})
  const [showFilters, setShowFilters] = useState(true)

  const rows = useMemo(
    () => filterCivilian(roster, civilianProfiles, f, AS_OF),
    [roster, civilianProfiles, f])

  const byCategory = useMemo(() => countByCategory(rows), [rows])
  const bySub = useMemo(() => countBySubcategory(rows), [rows])
  const byCounty = useMemo(() => countByCounty(rows), [rows])
  const byOccupation = useMemo(() => countByOccupation(rows), [rows])

  const counties = useMemo(
    () => [...new Set(roster.map(s => countyForCity(s.city)).filter(Boolean) as string[])].sort(),
    [roster])
  const units = useMemo(
    () => [...new Set(positions.map(p => p.bn).filter(Boolean) as string[])].sort(),
    [positions])

  const activeFilters = Object.entries(f).filter(([, v]) => v !== undefined && v !== '' && v !== false)

  function set<K extends keyof CivilianFilter>(k: K, v: CivilianFilter[K]) {
    setF(prev => ({ ...prev, [k]: v === '' ? undefined : v }))
  }

  function exportCsv() {
    downloadCsv('civilian-skills.csv',
      ['Name', 'Rank', 'MOS', 'Unit', 'Home City', 'Occupation', 'Employer Type', 'Work County',
       'Skills', 'Credentials', 'Verification', 'Willingness', 'Max Travel Miles', 'Data Source'],
      rows.map(r => [
        `${r.soldier.lastName}, ${r.soldier.firstName}`,
        r.soldier.rank, r.soldier.mos, r.soldier.unitName, r.soldier.city,
        r.profile.employment?.occupationTitle ?? '',
        r.profile.employment?.employerType ?? '',
        r.profile.employment?.workCounty ?? countyForCity(r.profile.employment?.workCity) ?? '',
        r.profile.skills.map(s => s.subcategory).join('; '),
        r.profile.credentials.map(c => c.name).join('; '),
        r.bestVerification,
        r.profile.willingness.useCivilianSkillsOnMission,
        String(r.profile.willingness.maxTravelMiles ?? ''),
        civilianIsSynthetic ? 'SYNTHETIC DEMO DATA' : r.profile.provenance.source,
      ]),
      civilianIsSynthetic ? 'DEMO DATA — civilian capability is synthetic. Billets are real MTARNG force structure.' : undefined)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-[1400px] mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GREEN }}>Civilian Skills Explorer</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              Search the force for civilian capability. Every result shows both the military assignment and
              the civilian capability, with the verification level stated so a self-reported claim is never
              mistaken for a verified one.
            </p>
          </div>
          <button onClick={exportCsv}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium no-print"
            style={{ backgroundColor: GREEN }}>
            ⬇ Export {rows.length} results
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 py-4 bg-white border-b no-print">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setShowFilters(v => !v)}
              className="text-sm font-semibold text-gray-700">
              {showFilters ? '▲ Hide filters' : '▼ Show filters'}
            </button>
            {activeFilters.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">Active:</span>
                {activeFilters.map(([k, v]) => (
                  <span key={k} className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">
                    {k}: {String(v)}
                  </span>
                ))}
                <button onClick={() => setF({})} className="text-xs underline text-gray-500 hover:text-red-600">
                  Reset all
                </button>
              </div>
            )}
          </div>

          {showFilters && (
            <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div>
                <label className={lbl} htmlFor="q">Keyword</label>
                <input id="q" type="search" className={cn(sel, 'w-full')} value={f.query ?? ''}
                  onChange={e => set('query', e.target.value)} placeholder="electrician, nurse, PMP…" />
              </div>
              <div>
                <label className={lbl} htmlFor="cat">Skill category</label>
                <select id="cat" className={cn(sel, 'w-full')} value={f.category ?? ''}
                  onChange={e => { set('category', e.target.value); set('subcategory', undefined) }}>
                  <option value="">All</option>
                  {categoryNames().map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl} htmlFor="sub">Specific skill</label>
                <select id="sub" className={cn(sel, 'w-full')} value={f.subcategory ?? ''}
                  onChange={e => set('subcategory', e.target.value)} disabled={!f.category}>
                  <option value="">All</option>
                  {f.category && subcategoriesOf(f.category).map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl} htmlFor="prof">Min proficiency</label>
                <select id="prof" className={cn(sel, 'w-full')} value={f.minProficiency ?? ''}
                  onChange={e => set('minProficiency', e.target.value as SkillProficiency)}>
                  <option value="">Any</option>
                  {PROFICIENCY_ORDER.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl} htmlFor="ver">Min verification</label>
                <select id="ver" className={cn(sel, 'w-full')} value={f.minVerification ?? ''}
                  onChange={e => set('minVerification', e.target.value as VerificationStatus)}>
                  <option value="">Any</option>
                  <option>Self Reported</option><option>Leader Reviewed</option><option>Document Verified</option>
                </select>
              </div>
              <div>
                <label className={lbl} htmlFor="county">Work county</label>
                <select id="county" className={cn(sel, 'w-full')} value={f.workCounty ?? ''}
                  onChange={e => set('workCounty', e.target.value)}>
                  <option value="">All</option>
                  {counties.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl} htmlFor="bn">Battalion</label>
                <select id="bn" className={cn(sel, 'w-full')} value={f.uics?.length ? 'set' : ''}
                  onChange={e => {
                    const bn = e.target.value
                    if (!bn) { set('uics', undefined); return }
                    const uics = [...new Set(positions.filter(p => p.bn === bn).map(p => p.uic ?? ''))].filter(Boolean)
                    setF(prev => ({ ...prev, uics }))
                  }}>
                  <option value="">All units</option>
                  {units.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl} htmlFor="yrs">Min years experience</label>
                <input id="yrs" type="number" min={0} className={cn(sel, 'w-full')}
                  value={f.minYearsExperience ?? ''}
                  onChange={e => set('minYearsExperience', Number(e.target.value) || undefined)} />
              </div>
              <div>
                <label className={lbl} htmlFor="cat2">Career category</label>
                <select id="cat2" className={cn(sel, 'w-full')} value={f.careerCategory ?? ''}
                  onChange={e => set('careerCategory', e.target.value)}>
                  <option value="">All</option>
                  <option>Officer</option><option>Warrant</option><option>Enlisted</option>
                </select>
              </div>
              <div>
                <label className={lbl} htmlFor="comp">Component</label>
                <select id="comp" className={cn(sel, 'w-full')} value={f.componentStatus ?? ''}
                  onChange={e => set('componentStatus', e.target.value)}>
                  <option value="">All</option>
                  <option>AGR</option><option>M-Day</option><option>Technician</option><option>ADOS</option>
                </select>
              </div>
              <div className="sm:col-span-3 lg:col-span-5 flex flex-wrap gap-4 pt-1">
                {([
                  ['willingToUseCivilianSkills', 'Willing to use civilian skills'],
                  ['availableStateActiveDuty', 'Available for state active duty'],
                  ['willingCrossUnit', 'Will support other units'],
                  ['excludeExpiredCredentials', 'Exclude expired credentials'],
                  ['essentialCommunityRole', 'Essential community role'],
                  ['soleProviderOrSpecialist', 'Sole provider / specialist'],
                  ['smallEmployer', 'Small employer'],
                ] as const).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" className="accent-green-700"
                      checked={Boolean(f[k])} onChange={e => set(k, e.target.checked || undefined)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="max-w-[1400px] mx-auto space-y-5">
          <DataSourceBanner rosterIsDemo={rosterIsDemo} civilianIsSynthetic={civilianIsSynthetic}
            positionCount={positions.length} />

          {/* Aggregates */}
          <section className="grid md:grid-cols-4 gap-3">
            {[
              { label: 'Soldiers matched', value: rows.length },
              { label: 'With verified capability', value: rows.filter(r => r.bestVerification === 'Document Verified' || r.bestVerification === 'Leader Reviewed').length },
              { label: 'Distinct skills', value: bySub.length },
              { label: 'Counties represented', value: byCounty.length },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-lg px-4 py-3 shadow-sm border text-center">
                <div className="text-xs text-gray-500 font-medium mb-1">{s.label}</div>
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              </div>
            ))}
          </section>

          <section className="grid lg:grid-cols-3 gap-4">
            {[
              { title: 'Top capabilities', data: bySub.slice(0, 8) },
              { title: 'By category', data: byCategory.slice(0, 8) },
              { title: 'By civilian occupation', data: byOccupation.slice(0, 8) },
            ].map(panel => (
              <div key={panel.title} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <h2 className="font-bold text-gray-900 text-sm mb-2">{panel.title}</h2>
                {panel.data.length === 0 ? <p className="text-xs text-gray-400">No data.</p> : (
                  <ul className="space-y-1">
                    {panel.data.map(d => (
                      <li key={d.key} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 truncate mr-2">{d.key}</span>
                        <span className="font-semibold text-gray-900 whitespace-nowrap">
                          {d.count}
                          <span className="text-green-700 font-normal"> ({d.verifiedCount} verified)</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>

          {/* Results */}
          {rows.length === 0 ? (
            <MissingDataNote>
              No soldiers match these filters. Either the capability is not present in the force, or it has
              not been recorded yet — this view can only show what soldiers have entered.
            </MissingDataNote>
          ) : (
            <div className="space-y-3">
              {rows.slice(0, 100).map(r => {
                const emp = r.profile.employment
                return (
                  <article key={r.soldier.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900">
                            {rankLabel(r.soldier.rank)} {soldierLabel(r.soldier)}
                          </h3>
                          {civilianIsSynthetic && <DemoPill />}
                          <VerificationBadge value={r.bestVerification} />
                          {r.hasExpiredCredential && (
                            <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                              Has expired credential
                            </span>
                          )}
                        </div>
                        <dl className="mt-1.5 text-sm text-gray-600 space-y-0.5">
                          <div><dt className="inline font-medium text-gray-700">Military: </dt>
                            <dd className="inline">{r.soldier.mos}, {r.soldier.dutyTitle}, {r.soldier.unitName} · {r.soldier.componentStatus}</dd></div>
                          <div><dt className="inline font-medium text-gray-700">Civilian: </dt>
                            <dd className="inline">
                              {emp ? `${emp.occupationTitle} (${emp.employerType})` : 'No employment recorded'}
                              {emp?.workCounty ? ` · ${emp.workCounty} County` : ''}
                            </dd></div>
                          <div><dt className="inline font-medium text-gray-700">Skills: </dt>
                            <dd className="inline">{r.matchedSkills.map(s =>
                              `${s.subcategory} (${s.proficiency}${s.yearsExperience ? `, ${s.yearsExperience} yr` : ''})`).join(' · ') || '—'}</dd></div>
                          {r.profile.credentials.length > 0 && (
                            <div><dt className="inline font-medium text-gray-700">Credentials: </dt>
                              <dd className="inline">{r.profile.credentials.map(c => c.name).join(' · ')}</dd></div>
                          )}
                          <div><dt className="inline font-medium text-gray-700">Availability: </dt>
                            <dd className="inline">
                              Civilian skills: {r.profile.willingness.useCivilianSkillsOnMission} ·
                              SAD: {r.profile.willingness.supportStateActiveDuty} ·
                              Cross-unit: {r.profile.willingness.supportOtherUnits}
                              {r.profile.willingness.maxTravelMiles != null && ` · up to ${r.profile.willingness.maxTravelMiles} mi`}
                            </dd></div>
                        </dl>
                      </div>
                      <div className="text-xs text-gray-400 text-right flex-shrink-0">
                        <div>{r.soldier.city}</div>
                        {emp?.essentialCommunityRole && (
                          <div className="mt-1 text-amber-700 font-medium">Essential community role</div>
                        )}
                        {emp?.soleProviderOrSpecialist && (
                          <div className="text-red-700 font-medium">Sole provider / specialist</div>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
              {rows.length > 100 && (
                <p className="text-sm text-gray-500 text-center">
                  Showing the first 100 of {rows.length}. Narrow the filters or export the full set.
                </p>
              )}
            </div>
          )}

          <PrototypeNotice />
        </div>
      </div>
    </div>
  )
}
