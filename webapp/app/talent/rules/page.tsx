'use client'

import { useMemo, useState } from 'react'
import { allRules, rulesNeedingReview } from '@/lib/rules/registry'
import { needsCaution, ruleCaution, type RuleTopic, type RuleStatus } from '@/lib/rules/types'
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

export default function PolicyRulesPage() {
  const [topic, setTopic] = useState<RuleTopic | ''>('')
  const [status, setStatus] = useState<RuleStatus | ''>('')
  const rules = allRules()
  const review = rulesNeedingReview()

  const filtered = useMemo(() => rules.filter(r =>
    (!topic || r.topic === topic) && (!status || r.status === status)), [rules, topic, status])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-[1300px] mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GREEN }}>Policy Rules</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              Every personnel rule the deterministic engines use, with its source authority and review
              status. The AI is briefed from this same registry, so the model can never cite a different
              rule than the math applied.
            </p>
          </div>
          <button onClick={() => downloadCsv('policy-rules.csv',
            ['ID', 'Topic', 'Status', 'Description', 'Authority', 'Citation', 'Applicability', 'Notes'],
            filtered.map(r => [r.id, r.topic, r.status, r.description, r.sourceAuthority,
              r.citation ?? '', r.applicability, r.notes ?? '']),
            'Policy rules used by this prototype. Rules marked Draft are unverified and need S1 confirmation ' +
            'before anyone relies on them. Not a substitute for the governing regulation.')}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: GREEN }}>
            ⬇ Export rules
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="max-w-[1300px] mx-auto space-y-5">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <h2 className="font-bold text-amber-900 text-sm">
              {review.length} rules require S1/G1 verification before operational use
            </h2>
            <p className="text-xs text-amber-900 mt-1">
              Retention control points in particular are revised by PPOM and the values here were not
              confirmed against a current publication. Correct them in{' '}
              <code className="bg-white px-1 rounded">lib/data/retention.ts</code> and{' '}
              <code className="bg-white px-1 rounded">lib/scoring.ts</code> — the UI and AI both read from there.
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
            <span className="text-sm text-gray-500">{filtered.length} rules</span>
          </div>

          <div className="space-y-3">
            {filtered.map(r => (
              <article key={r.id} className={cn('bg-white rounded-xl border p-4 shadow-sm',
                needsCaution(r) && 'border-l-4 border-l-amber-500')}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{r.id}</code>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{r.topic}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', STATUS_TONE[r.status])}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 mt-1.5 font-medium">{r.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      <strong>Authority:</strong> {r.sourceAuthority} · <strong>Applies to:</strong> {r.applicability}
                    </p>
                    {r.citation && <p className="text-xs text-gray-500 mt-1 italic">{r.citation}</p>}
                    {r.notes && <p className="text-xs text-amber-800 mt-1">{r.notes}</p>}
                    {needsCaution(r) && (
                      <p className="text-xs font-semibold text-amber-800 mt-1">⚠ {ruleCaution(r)}</p>
                    )}
                  </div>
                  {r.params && (
                    <dl className="text-xs text-gray-600 flex-shrink-0 bg-gray-50 rounded p-2 min-w-[160px]">
                      {Object.entries(r.params).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3">
                          <dt className="text-gray-500">{k}</dt>
                          <dd className="font-mono font-semibold">{v === null ? '—' : String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </article>
            ))}
          </div>

          <PrototypeNotice scope="These rules" />
        </div>
      </div>
    </div>
  )
}
