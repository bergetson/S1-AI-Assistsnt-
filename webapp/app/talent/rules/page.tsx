'use client'

import { useMemo, useState } from 'react'
import { allRules, rulesNeedingReview } from '@/lib/rules/registry'
import { needsCaution, ruleCaution, type RuleTopic, type RuleStatus } from '@/lib/rules/types'
import {
  DEFAULT_RANKING, DEFAULT_ASSUMPTIONS, defaultGate, defaultRetention,
  countTuned, tuningWarnings, type RankingWeights, type Assumptions,
} from '@/lib/rules/tuning'
import { useRulesStore } from '@/lib/rulesStore'
import { PROMOTION_GATES } from '@/lib/scoring'
import { RETENTION_LIMITS } from '@/lib/data/retention'
import { AS_OF_ISO } from '@/lib/asOf'
import { PrototypeNotice } from '@/components/shared/Badges'
import { downloadCsv } from '@/lib/exports'
import { cn } from '@/lib/utils'

const GREEN = '#1B4F2A'
const sel = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700'

const STATUS_TONE: Record<RuleStatus, string> = {
  Verified: 'bg-green-100 text-green-800 border-green-200',
  Draft: 'bg-amber-100 text-amber-800 border-amber-200',
  Unverified: 'bg-amber-100 text-amber-800 border-amber-200',
  Outdated: 'bg-red-100 text-red-800 border-red-200',
  Superseded: 'bg-red-100 text-red-800 border-red-200',
  Assumption: 'bg-blue-100 text-blue-800 border-blue-200',
}

type Tab = 'catalog' | 'gates' | 'ranking' | 'assumptions' | 'retention'

const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: 'catalog', label: 'Rule catalog', blurb: 'Every rule, its authority, and its review status.' },
  { id: 'gates', label: 'Promotion gates', blurb: 'Time in grade and time in service required at each grade.' },
  { id: 'ranking', label: 'Candidate ranking', blurb: 'How a succession candidate earns their score out of 100.' },
  { id: 'assumptions', label: 'Planning assumptions', blurb: 'Rates that are estimates, not published policy.' },
  { id: 'retention', label: 'Retention limits', blurb: 'RCP and mandatory removal caps per grade.' },
]

/**
 * Hoisted, and uncontrolled on purpose. A controlled number input rejects the
 * intermediate empty string while someone retypes a value, and a component
 * declared inside render remounts on every keystroke and loses focus.
 * Committing on blur means the engines are retuned once, when the edit is done.
 */
function NumField({
  value, fallback, onCommit, step = 'any', allowNull = false, width = 'w-24',
}: {
  value: number | null
  fallback: number | null
  onCommit: (v: number | null) => void
  step?: string
  allowNull?: boolean
  width?: string
}) {
  const changed = value !== fallback
  return (
    <input
      type="number"
      step={step}
      defaultValue={value ?? ''}
      placeholder={allowNull ? 'none' : String(fallback ?? '')}
      onBlur={e => {
        const raw = e.target.value.trim()
        if (raw === '') { onCommit(allowNull ? null : fallback); return }
        const n = Number(raw)
        onCommit(Number.isFinite(n) ? n : fallback)
      }}
      className={cn(width, 'border rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-700',
        changed ? 'border-green-600 bg-green-50 font-semibold' : 'border-gray-300')}
    />
  )
}

function Was({ value }: { value: number | null }) {
  return <span className="text-[11px] text-gray-400 ml-1.5">was {value ?? 'none'}</span>
}

function SectionNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-600 max-w-3xl mb-3">{children}</p>
}

export default function PolicyRulesPage() {
  const [tab, setTab] = useState<Tab>('catalog')
  const [topic, setTopic] = useState<RuleTopic | ''>('')
  const [status, setStatus] = useState<RuleStatus | ''>('')
  const [reviewer, setReviewer] = useState('')

  const {
    overrides, reviews, version,
    setGate, setRetention, setRanking, setAssumptions, setReview, resetAll, resetGroup,
  } = useRulesStore()

  // version is in the deps because the gate/retention tables are mutated in
  // place — nothing else tells React that a rule description is now stale.
  // eslint cannot observe that mutation, so it reads the dep as unnecessary.
  /* eslint-disable react-hooks/exhaustive-deps */
  const rules = useMemo(() => allRules(reviews), [reviews, version])
  const needReview = useMemo(() => rulesNeedingReview(reviews), [reviews, version])
  const warnings = useMemo(() => tuningWarnings(overrides), [overrides, version])
  const changedCount = useMemo(() => countTuned(overrides), [overrides, version])

  const filtered = useMemo(() => rules.filter(r =>
    (!topic || r.topic === topic) && (!status || r.status === status)), [rules, topic, status])

  const grades = useMemo(() => Object.keys(PROMOTION_GATES), [version])
  const retentionGrades = useMemo(() => Object.keys(RETENTION_LIMITS), [version])
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-[1300px] mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GREEN }}>Rules &amp; Logic</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              Every number this tool uses to judge a soldier, in one place, and editable. Change a
              threshold here and the matching, succession ranking, promotion forecast, and the AI
              briefing all move together — the model is told what you changed, so it can never
              reason from the published regulation while the math uses your local numbers.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => downloadCsv('policy-rules.csv',
              ['ID', 'Topic', 'Status', 'Description', 'Authority', 'Citation', 'Applicability', 'Reviewed by', 'Reviewed on', 'Notes'],
              rules.map(r => [r.id, r.topic, r.status, r.description, r.sourceAuthority,
                r.citation ?? '', r.applicability, r.reviewedBy ?? '', r.lastReviewed ?? '', r.notes ?? '']),
              `Effective rule set as configured in this browser. ${changedCount} value(s) changed from the shipped defaults. ` +
              'Rules marked Draft or Unverified need S1 confirmation. Not a substitute for the governing regulation.')}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: GREEN }}>
              ⬇ Export rule set
            </button>
            {changedCount > 0 && (
              <button onClick={resetAll}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">
                ↺ Reset all to defaults
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 bg-white border-b">
        <div className="max-w-[1300px] mx-auto flex gap-1 overflow-x-auto" role="tablist">
          {TABS.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={cn('px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition',
                tab === t.id ? 'border-green-800 text-green-900' : 'border-transparent text-gray-500 hover:text-gray-800')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="max-w-[1300px] mx-auto space-y-5">

          {changedCount > 0 && (
            <div className="rounded-xl bg-green-50 border border-green-300 p-4">
              <h2 className="font-bold text-green-900 text-sm">
                {changedCount} value{changedCount === 1 ? '' : 's'} changed from the shipped defaults
              </h2>
              <p className="text-xs text-green-900 mt-1">
                These are stored in this browser only and are applied to every calculation in the app.
                The AI is told exactly what you changed, so it will name your local setting when a
                recommendation depends on it.
              </p>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-300 p-4">
              <h2 className="font-bold text-amber-900 text-sm">Check these before you rely on the output</h2>
              <ul className="list-disc pl-5 mt-1 space-y-1 text-xs text-amber-900">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
              <p className="text-xs text-amber-800 mt-2">
                Nothing here blocks a save — an unusual formation can justify unusual numbers.
              </p>
            </div>
          )}

          {/* ── Rule catalog ─────────────────────────────────────────────── */}
          {tab === 'catalog' && (
            <>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <h2 className="font-bold text-amber-900 text-sm">
                  {needReview.length} rules still need S1/G1 verification
                </h2>
                <p className="text-xs text-amber-900 mt-1">
                  Retention control points in particular are revised by PPOM and were not confirmed
                  against a current publication. Correct the numbers on the <strong>Retention limits</strong> tab,
                  then sign the rule off below so the AI stops hedging on it.
                </p>
              </div>

              <div className="flex gap-3 flex-wrap items-center">
                <select className={sel} value={topic} onChange={e => setTopic(e.target.value as RuleTopic | '')} aria-label="Filter by topic">
                  <option value="">All topics</option>
                  {['Promotion', 'Retention', 'PME', 'Boards', 'Reclassification', 'Assignment', 'Community Impact'].map(t =>
                    <option key={t}>{t}</option>)}
                </select>
                <select className={sel} value={status} onChange={e => setStatus(e.target.value as RuleStatus | '')} aria-label="Filter by status">
                  <option value="">All statuses</option>
                  {['Verified', 'Draft', 'Unverified', 'Outdated', 'Superseded', 'Assumption'].map(s => <option key={s}>{s}</option>)}
                </select>
                <input value={reviewer} onChange={e => setReviewer(e.target.value)}
                  placeholder="Your name, to sign off rules"
                  className={cn(sel, 'flex-1 min-w-[220px]')} aria-label="Reviewer name" />
                <span className="text-sm text-gray-500">{filtered.length} rules</span>
              </div>

              <div className="space-y-3">
                {filtered.map(r => (
                  <article key={r.id} className={cn('bg-white rounded-xl border p-4 shadow-sm',
                    needsCaution(r) && 'border-l-4 border-l-amber-500')}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{r.id}</code>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{r.topic}</span>
                          <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', STATUS_TONE[r.status])}>
                            {r.status}
                          </span>
                          {r.reviewedBy && (
                            <span className="text-xs text-gray-500">
                              signed off by {r.reviewedBy}{r.lastReviewed ? ` · ${r.lastReviewed}` : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 mt-2">{r.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          <strong>Authority:</strong> {r.sourceAuthority} · <strong>Applies to:</strong> {r.applicability}
                        </p>
                        {r.citation && <p className="text-xs text-gray-500 mt-1">{r.citation}</p>}
                        {r.notes && <p className="text-xs text-gray-600 mt-1 italic">{r.notes}</p>}
                        {ruleCaution(r) && (
                          <p className="text-xs text-amber-800 mt-1 font-medium">{ruleCaution(r)}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <label className="text-[11px] font-semibold text-gray-500 uppercase">Review status</label>
                        <select
                          className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                          value={reviews[r.id]?.status ?? ''}
                          onChange={e => {
                            const v = e.target.value as RuleStatus | ''
                            if (!v) { setReview(r.id, null); return }
                            setReview(r.id, {
                              status: v,
                              reviewedBy: reviewer.trim() || 'unnamed reviewer',
                              lastReviewed: AS_OF_ISO,
                            })
                          }}
                          aria-label={`Set review status for ${r.id}`}
                        >
                          <option value="">— as shipped —</option>
                          {['Verified', 'Draft', 'Unverified', 'Outdated', 'Superseded', 'Assumption'].map(s =>
                            <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {/* ── Promotion gates ──────────────────────────────────────────── */}
          {tab === 'gates' && (
            <section className="bg-white rounded-xl border p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <SectionNote>
                  The minimum time in grade and time in service a soldier must hold before they are
                  counted as board-eligible. These drive board eligibility on the roster, the promotion
                  shortfall on the forecast, promotion readiness on a soldier&apos;s matches, and the
                  candidate slate. <strong>Typical TIG</strong> is what the planner uses to estimate how
                  long a real career actually takes, which is usually longer than the minimum.
                </SectionNote>
                <button onClick={() => resetGroup('gates')}
                  className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 whitespace-nowrap">
                  ↺ Reset gates
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-600">Grade</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">Min TIG (yr)</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">Typical TIG (yr)</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">Min TIS (yr)</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-600">Required PME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((g, i) => {
                      const live = PROMOTION_GATES[g]
                      const base = defaultGate(g)
                      if (!live || !base) return null
                      return (
                        <tr key={g} className={i % 2 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-3 py-1.5 font-semibold">{g}</td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap">
                            <NumField key={`${g}-tig-${version}`} value={live.minTig} fallback={base.minTig}
                              onCommit={v => setGate(g, { minTig: v ?? base.minTig })} />
                            {live.minTig !== base.minTig && <Was value={base.minTig} />}
                          </td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap">
                            <NumField key={`${g}-typ-${version}`} value={live.typicalTig} fallback={base.typicalTig}
                              onCommit={v => setGate(g, { typicalTig: v ?? base.typicalTig })} />
                            {live.typicalTig !== base.typicalTig && <Was value={base.typicalTig} />}
                          </td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap">
                            <NumField key={`${g}-tis-${version}`} value={live.minTis} fallback={base.minTis}
                              onCommit={v => setGate(g, { minTis: v ?? base.minTis })} />
                            {live.minTis !== base.minTis && <Was value={base.minTis} />}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-gray-500">
                            {live.pmeRequired.length ? live.pmeRequired.join(', ').replace(/Complete/g, '') : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Required PME is not editable here because it changes which soldiers are hard-blocked
                rather than how they rank. PPOM 24-014 already suspended BLC/ALC/SLC/MLC as gates — if
                that is rescinded, it needs a code change so the reasoning stays reviewable.
              </p>
            </section>
          )}

          {/* ── Candidate ranking ────────────────────────────────────────── */}
          {tab === 'ranking' && (
            <section className="bg-white rounded-xl border p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <SectionNote>
                  Points a candidate earns when you ask &ldquo;who should fill this billet&rdquo;. The five
                  best-case values sum to 100; geography then subtracts. Raise{' '}
                  <strong>evaluations</strong> to weight performance over fit, or raise{' '}
                  <strong>availability</strong> to favour moving people who have been in a seat too long.
                  Every change is shown to the commander in the score breakdown, not hidden.
                </SectionNote>
                <button onClick={() => resetGroup('ranking')}
                  className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 whitespace-nowrap">
                  ↺ Reset weights
                </button>
              </div>
              {([
                { title: 'Grade fit', keys: ['gradeExact', 'gradeOneBelow', 'gradeTwoBelow', 'gradeDowngrade'] },
                { title: 'MOS fit', keys: ['mosExact', 'mosRelated', 'mosUnrelated'] },
                { title: 'Promotion readiness', keys: ['promotionReady', 'promotionPartial', 'promotionShort', 'promotionNoGate'] },
                { title: 'Evaluations', keys: ['evaluationsMax'] },
                { title: 'Availability (time in current seat)', keys: ['availabilityStale', 'availabilityMid', 'availabilityRecent'] },
                { title: 'Geography (penalties — must be zero or negative)', keys: ['geoUnder60', 'geoUnder120', 'geoOver120', 'geoUnknown'] },
                { title: 'Readiness bands', keys: ['readyNowScore', 'readyDevelopmentScore'] },
              ] as { title: string; keys: (keyof RankingWeights)[] }[]).map(group => (
                <div key={group.title} className="mt-4">
                  <h3 className="text-xs font-bold text-gray-600 uppercase mb-2">{group.title}</h3>
                  <div className="flex flex-wrap gap-4">
                    {group.keys.map(k => (
                      <label key={k} className="flex flex-col gap-1">
                        <span className="text-xs text-gray-600">{LABELS[k] ?? k}</span>
                        <span className="flex items-baseline">
                          <NumField key={`${k}-${version}`}
                            value={overrides.ranking?.[k] ?? DEFAULT_RANKING[k]} fallback={DEFAULT_RANKING[k]}
                            onCommit={v => setRanking({ [k]: v ?? DEFAULT_RANKING[k] })} width="w-20" />
                          {(overrides.ranking?.[k] ?? DEFAULT_RANKING[k]) !== DEFAULT_RANKING[k] &&
                            <Was value={DEFAULT_RANKING[k]} />}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* ── Planning assumptions ─────────────────────────────────────── */}
          {tab === 'assumptions' && (
            <section className="bg-white rounded-xl border p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <SectionNote>
                  These are estimates, not policy, and they are the numbers most worth replacing with
                  Montana&apos;s own experience. An ETS is a contract expiring, not a departure — set the
                  separation rate to your actual reenlistment miss rate and the attrition forecast becomes
                  yours rather than a national guess.
                </SectionNote>
                <button onClick={() => resetGroup('assumptions')}
                  className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 whitespace-nowrap">
                  ↺ Reset assumptions
                </button>
              </div>
              <div className="space-y-4 mt-3">
                {(Object.keys(DEFAULT_ASSUMPTIONS) as (keyof Assumptions)[]).map(k => (
                  <div key={k} className="flex items-start gap-4 flex-wrap border-b border-gray-100 pb-3">
                    <span className="flex items-baseline flex-shrink-0">
                      <NumField key={`${k}-${version}`}
                        value={overrides.assumptions?.[k] ?? DEFAULT_ASSUMPTIONS[k]}
                        fallback={DEFAULT_ASSUMPTIONS[k]}
                        onCommit={v => setAssumptions({ [k]: v ?? DEFAULT_ASSUMPTIONS[k] })} />
                      {(overrides.assumptions?.[k] ?? DEFAULT_ASSUMPTIONS[k]) !== DEFAULT_ASSUMPTIONS[k] &&
                        <Was value={DEFAULT_ASSUMPTIONS[k]} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-800">{LABELS[k] ?? k}</div>
                      <p className="text-xs text-gray-500">{ASSUMPTION_HELP[k]}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Retention limits ─────────────────────────────────────────── */}
          {tab === 'retention' && (
            <section className="bg-white rounded-xl border p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <SectionNote>
                  <strong>These are the values most likely to be wrong today.</strong> RCP tables are revised
                  by PPOM and the shipped numbers were never confirmed against a current publication.
                  Blank means no cap applies at that grade — leaving it blank is correct for M-Day RCP and
                  for officer grades below MAJ, where separation is a board outcome rather than a clock.
                </SectionNote>
                <button onClick={() => resetGroup('retention')}
                  className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 whitespace-nowrap">
                  ↺ Reset limits
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-600">Grade</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">AGR RCP (yr TIS)</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">M-Day RCP (yr TIS)</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">Removal (yr commissioned)</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-600">Basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retentionGrades.map((g, i) => {
                      const live = RETENTION_LIMITS[g]
                      const base = defaultRetention(g)
                      if (!live || !base) return null
                      return (
                        <tr key={g} className={i % 2 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-3 py-1.5 font-semibold">{g}</td>
                          {(['rcpAgr', 'rcpMday', 'mrdCommissioned'] as const).map(f => (
                            <td key={f} className="px-3 py-1.5 text-right whitespace-nowrap">
                              <NumField key={`${g}-${f}-${version}`} value={live[f]} fallback={base[f]} allowNull
                                onCommit={v => setRetention(g, { [f]: v })} />
                              {live[f] !== base[f] && <Was value={base[f]} />}
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-xs text-gray-500 max-w-md">{base.note}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <PrototypeNotice scope="This rule set" />
        </div>
      </div>
    </div>
  )
}

const LABELS: Record<string, string> = {
  gradeExact: 'Already holds the grade',
  gradeOneBelow: 'One grade below',
  gradeTwoBelow: 'Two grades below',
  gradeDowngrade: 'Would be a downgrade',
  mosExact: 'MOS matches exactly',
  mosRelated: 'Same career field',
  mosUnrelated: 'Needs reclassification',
  promotionReady: 'Meets both gates',
  promotionPartial: 'Meets one gate',
  promotionShort: 'Meets neither gate',
  promotionNoGate: 'No published gate',
  evaluationsMax: 'Maximum for a top evaluation',
  availabilityStale: 'Over the stale threshold',
  availabilityMid: '1.5 yr or more in seat',
  availabilityRecent: 'Recently assigned',
  geoUnder60: 'Under 60 min away',
  geoUnder120: '60–120 min away',
  geoOver120: 'Over 120 min away',
  geoUnknown: 'Drive time unknown',
  readyNowScore: '"Ready now" at or above',
  readyDevelopmentScore: '"Ready with development" at or above',
  etsSeparationRate: 'ETS separation rate',
  twentyYearDepartRate: '20-year departure rate',
  tipStaleYears: 'Stale in position after',
  retirementYears: 'Retirement eligibility at',
  seniorRaterShare: 'Senior rater share of the eval score',
}

const ASSUMPTION_HELP: Record<keyof Assumptions, string> = {
  etsSeparationRate:
    'Share of expiring contracts modeled as an actual loss. 0.30 assumes ~70% reenlist. Setting this to 1.0 treats every ETS as certain and makes the whole formation appear to depart within one contract cycle.',
  twentyYearDepartRate:
    'Share of soldiers modeled as leaving in the year they reach 20 good years. Eligibility is an option, not a departure.',
  tipStaleYears:
    'Years in one seat after which a soldier is flagged as due to move. Drives the "stale in position" count and the availability score on a candidate slate.',
  retirementYears:
    'Qualifying years for non-regular retirement eligibility. Change only if policy changes.',
  seniorRaterShare:
    'For officers and warrants, how much of the evaluation score comes from the senior rater box. The rater box takes the remainder.',
}
