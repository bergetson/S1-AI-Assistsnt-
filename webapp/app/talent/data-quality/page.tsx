'use client'

import { useMemo, useState } from 'react'
import { useForceData, AS_OF } from '@/components/shared/useForceData'
import { useMarketplaceStore } from '@/lib/marketplaceStore'
import { analyzeDataQuality, type IssueSeverity } from '@/lib/talent/dataQuality'
import { PrototypeNotice } from '@/components/shared/Badges'
import { downloadCsv } from '@/lib/exports'
import { cn } from '@/lib/utils'

const GREEN = '#1B4F2A'
const sel = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700'

export default function DataQualityPage() {
  const { positions, roster, civilianProfiles } = useForceData()
  const { applications } = useMarketplaceStore()
  const [severity, setSeverity] = useState<IssueSeverity | ''>('')
  const [category, setCategory] = useState('')

  const report = useMemo(
    () => analyzeDataQuality(positions, roster, civilianProfiles, applications, AS_OF),
    [positions, roster, civilianProfiles, applications])

  const filtered = useMemo(() => report.issues.filter(i =>
    (!severity || i.severity === severity) && (!category || i.category === category)),
    [report.issues, severity, category])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-6 bg-white border-b">
        <div className="max-w-[1400px] mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GREEN }}>Data Quality</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              What the data cannot currently support. Missing information is treated as a finding, not a
              silent default — every analysis in this prototype degrades to &ldquo;Unknown&rdquo; rather than guessing.
            </p>
          </div>
          <button onClick={() => downloadCsv('data-quality-report.csv',
            ['Severity', 'Category', 'Entity', 'Entity ID', 'Label', 'Detail', 'Recommended action'],
            filtered.map(i => [i.severity, i.category, i.entity, i.entityId, i.label, i.detail, i.recommendedAction]))}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: GREEN }}>
            ⬇ Export report
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="max-w-[1400px] mx-auto space-y-5">
          <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { l: 'Errors', v: report.counts.error, tone: 'text-red-700' },
              { l: 'Warnings', v: report.counts.warning, tone: 'text-amber-600' },
              { l: 'Info', v: report.counts.info, tone: 'text-blue-700' },
              { l: 'Civilian coverage', v: `${report.completeness.civilianCoveragePct}%`, tone: 'text-gray-900' },
              { l: 'Soldiers', v: report.completeness.soldiersTotal, tone: 'text-gray-900' },
            ].map(s => (
              <div key={s.l} className="bg-white rounded-lg px-4 py-3 shadow-sm border text-center">
                <div className="text-xs text-gray-500 mb-1">{s.l}</div>
                <div className={cn('text-2xl font-bold', s.tone)}>{s.v}</div>
              </div>
            ))}
          </section>

          <section className="bg-white rounded-xl border p-4 shadow-sm">
            <h2 className="font-bold text-gray-900 text-sm mb-2">Issues by category</h2>
            <div className="flex flex-wrap gap-2">
              {report.byCategory.map(c => (
                <button key={c.category} onClick={() => setCategory(c.category === category ? '' : c.category)}
                  className={cn('text-xs px-2 py-1 rounded border',
                    category === c.category ? 'bg-green-600 text-white border-green-600' : 'bg-white border-gray-300 hover:bg-gray-50')}>
                  {c.category} <strong>{c.count}</strong>
                </button>
              ))}
            </div>
          </section>

          <div className="flex gap-3 items-center flex-wrap">
            <select className={sel} value={severity} onChange={e => setSeverity(e.target.value as IssueSeverity | '')}
              aria-label="Filter by severity">
              <option value="">All severities</option>
              <option>Error</option><option>Warning</option><option>Info</option>
            </select>
            {(severity || category) && (
              <button onClick={() => { setSeverity(''); setCategory('') }}
                className="text-sm underline text-gray-500 hover:text-red-600">Reset filters</button>
            )}
            <span className="text-sm text-gray-500">Showing {filtered.length} of {report.issues.length}</span>
          </div>

          <section className="bg-white rounded-xl border shadow-sm overflow-x-auto">
            {filtered.length === 0 ? (
              <p className="p-8 text-center text-gray-500">No issues match these filters.</p>
            ) : (
              <table className="w-full text-sm">
                <caption className="sr-only">Data quality issues</caption>
                <thead className="bg-gray-100">
                  <tr>{['Severity', 'Category', 'Entity', 'Item', 'Detail', 'Recommended action'].map(h =>
                    <th key={h} className="text-left px-3 py-2 text-xs font-bold text-gray-600">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 300).map((i, n) => (
                    <tr key={i.id + n} className={n % 2 ? 'bg-gray-50' : ''}>
                      <td className="px-3 py-1.5">
                        <span className={cn('text-xs px-1.5 py-0.5 rounded font-bold',
                          i.severity === 'Error' ? 'bg-red-100 text-red-800'
                            : i.severity === 'Warning' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800')}>
                          {i.severity}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs">{i.category}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-500">{i.entity}</td>
                      <td className="px-3 py-1.5 text-xs font-medium">{i.label}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-600">{i.detail}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-600">{i.recommendedAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {filtered.length > 300 && (
            <p className="text-sm text-gray-500">Showing the first 300. Export for the full list.</p>
          )}
          <PrototypeNotice />
        </div>
      </div>
    </div>
  )
}
