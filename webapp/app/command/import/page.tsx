'use client'

import { soldierLabel } from '@/lib/commandTypes'

import { useState } from 'react'
import Link from 'next/link'
import { useCommandStore } from '@/lib/commandStore'
import { importRosterCsv, buildCsvTemplate, CSV_TEMPLATE_HEADERS, type ImportResult } from '@/lib/rosterImport'
import { downloadFile } from '@/lib/exports'
import {
  ARMY_GREEN, CommandHeader, RosterSourceBanner, CommandPrintStyles, getBaseRoster,
} from '@/components/command/CommandShell'
import { cn } from '@/lib/utils'

const MAX_BYTES = 4_000_000

export default function CommandImportPage() {
  const { setRoster, resetCommand, source, roster } = useCommandStore()
  const [text, setText] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [committed, setCommitted] = useState('')

  function analyze(csv: string) {
    setCommitted('')
    if (!csv.trim()) { setResult(null); return }
    setResult(importRosterCsv(csv))
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    setText(content)
    analyze(content)
  }

  function commit() {
    if (!result || result.soldiers.length === 0) return
    const bytes = JSON.stringify(result.soldiers).length
    if (bytes > MAX_BYTES) {
      setCommitted(`error:This roster is ${(bytes / 1_000_000).toFixed(1)} MB, over the ~4 MB browser storage limit. Import without the eval bullets column, or split the roster by battalion.`)
      return
    }
    setRoster(result.soldiers, 'imported')
    setCommitted(`ok:Imported ${result.soldiers.length} soldiers. The de-identified baseline roster has been replaced.`)
  }

  function downloadTemplate() {
    // Shares the one download helper, which appends the anchor and defers the
    // revoke — a hand-rolled copy here silently failed to download in Firefox.
    downloadFile('mtarng-roster-template.csv', buildCsvTemplate())
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <RosterSourceBanner />
      <CommandHeader
        title="Import Roster"
        subtitle="Load your real force. Data is parsed and stored only in this browser's local storage — it is never uploaded to a server, and it is not visible to anyone else who opens this site."
      />

      <div className="px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Current state. The baseline is the real force, so it is an
              ordinary informational state — styling it red read as an error
              and pushed commanders to "fix" something that was already right. */}
          <div className={cn('rounded-xl border p-4',
            source === 'imported' ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50')}>
            <div className="font-semibold text-sm">
              {source === 'imported'
                ? `Currently showing YOUR IMPORTED ROSTER — ${roster.length} soldiers.`
                : `Currently showing the REAL MTARNG force, de-identified — ${getBaseRoster().length} soldiers. Names are withheld.`}
            </div>
            {source !== 'imported' && (
              <p className="mt-1 text-xs text-blue-900">
                This is real data and nothing is wrong with it. Import your own roster only if you
                need names, or need the date of rank and PEBD that this extract does not carry.
              </p>
            )}
            {source === 'imported' && (
              <button onClick={() => { resetCommand(); setCommitted('ok:Reverted to the de-identified baseline roster.') }}
                className="mt-2 text-xs underline text-gray-600 hover:text-red-700">
                Clear my roster and go back to the de-identified baseline
              </button>
            )}
          </div>

          {/* Privacy */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <h2 className="font-bold mb-1">Before you import real personnel data</h2>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>This site is publicly reachable, but your roster is stored <strong>only in this browser</strong> and is never transmitted to a server.</li>
              <li>Anyone else visiting the site sees the de-identified baseline, not your named roster. Clearing your browser data deletes it.</li>
              <li>When you ask the AI anything, names are stripped first — it only ever sees pseudonyms like <span className="font-mono">S-014</span>.</li>
              <li>Evaluation bullets are free text and are excluded from AI calls unless you explicitly opt in.</li>
              <li>Use a shared or public computer at your own risk, and clear the roster when you are done.</li>
            </ul>
          </div>

          {/* Template */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
              <div>
                <h2 className="font-bold text-gray-900">1. Get your data into the right shape</h2>
                <p className="text-sm text-gray-500">
                  Column order does not matter and extra columns are ignored. Only <strong>rank</strong> and{' '}
                  <strong>uic</strong> are required — UIC is how soldiers join to units.
                </p>
              </div>
              <button onClick={downloadTemplate}
                className="px-4 py-2 rounded-lg text-sm text-white font-medium flex-shrink-0"
                style={{ backgroundColor: ARMY_GREEN }}>
                ⬇ Download CSV template
              </button>
            </div>
            <div className="text-xs text-gray-500">
              <span className="font-semibold">Recognized columns: </span>
              <span className="font-mono">{CSV_TEMPLATE_HEADERS.join(', ')}</span>
              <p className="mt-1.5">
                Ranks accept either form (<span className="font-mono">SSG</span> or <span className="font-mono">E6</span>,{' '}
                <span className="font-mono">CPT</span> or <span className="font-mono">O3</span>). Yes/no columns accept
                Y, YES, TRUE, 1, or X. If your time-in-position column is in months, put &ldquo;months&rdquo; in the header
                and it will be converted.
              </p>
            </div>
          </section>

          {/* Paste / upload */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-1">2. Paste or upload</h2>
            <p className="text-sm text-gray-500 mb-3">
              Pasting works even on machines that block file pickers. Copying straight out of Excel works too.
            </p>
            <textarea
              value={text}
              onChange={e => { setText(e.target.value); analyze(e.target.value) }}
              placeholder="Paste CSV here, including the header row…"
              className="w-full h-40 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-700 resize-none"
            />
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <input type="file" accept=".csv,.txt,text/csv" onChange={onFile}
                className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
              {text && (
                <button onClick={() => { setText(''); setResult(null); setCommitted('') }}
                  className="text-sm text-gray-500 hover:text-red-600 underline">
                  Clear
                </button>
              )}
            </div>
          </section>

          {/* Result */}
          {result && (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-3">3. Review before committing</h2>

              <div className="flex flex-wrap gap-3 mb-4">
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2">
                  <div className="text-2xl font-bold text-green-800">{result.soldiers.length}</div>
                  <div className="text-xs text-green-700">rows accepted</div>
                </div>
                {result.errors.length > 0 && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2">
                    <div className="text-2xl font-bold text-red-800">{result.errors.length}</div>
                    <div className="text-xs text-red-700">errors</div>
                  </div>
                )}
                {result.warnings.length > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2">
                    <div className="text-2xl font-bold text-amber-800">{result.warnings.length}</div>
                    <div className="text-xs text-amber-700">warnings</div>
                  </div>
                )}
              </div>

              {result.missingColumns.length > 0 && (
                <p className="text-xs text-gray-500 mb-3">
                  Not found in your file (optional unless marked required):{' '}
                  <span className="font-mono">{result.missingColumns.join(', ')}</span>
                </p>
              )}

              {(result.errors.length > 0 || result.warnings.length > 0) && (
                <div className="max-h-48 overflow-y-auto mb-4 border border-gray-200 rounded-lg">
                  <table className="w-full text-xs">
                    <tbody>
                      {[...result.errors.map(e => ({ ...e, sev: 'error' as const })),
                        ...result.warnings.map(w => ({ ...w, sev: 'warning' as const }))].map((issue, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0">
                          <td className="px-2 py-1 w-16 text-gray-400">Row {issue.row}</td>
                          <td className="px-2 py-1 w-20">
                            <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold',
                              issue.sev === 'error' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800')}>
                              {issue.sev.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-gray-700">{issue.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.soldiers.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Preview — first 5 rows</div>
                  <div className="overflow-x-auto mb-4 border border-gray-200 rounded-lg">
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-gray-100">
                        <tr>
                          {['Name', 'Grade', 'Cat', 'MOS', 'Comp', 'UIC', 'TIS', 'TIG', 'TIP', 'ETS'].map(h => (
                            <th key={h} className="px-2 py-1 text-left font-bold text-gray-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.soldiers.slice(0, 5).map(s => (
                          <tr key={s.id} className="border-t border-gray-100">
                            <td className="px-2 py-1">{soldierLabel(s)}</td>
                            <td className="px-2 py-1 font-mono font-bold">{s.rank}</td>
                            <td className="px-2 py-1">{s.careerCategory}</td>
                            <td className="px-2 py-1">{s.mos}</td>
                            <td className="px-2 py-1">{s.componentStatus}</td>
                            <td className="px-2 py-1 font-mono">{s.uic}</td>
                            <td className="px-2 py-1 text-center">{s.yearsOfService}</td>
                            <td className="px-2 py-1 text-center">{s.timeInGrade}</td>
                            <td className="px-2 py-1 text-center">{s.timeInPosition}</td>
                            <td className="px-2 py-1">{s.ets}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button onClick={commit}
                    className="px-5 py-2.5 rounded-lg text-white font-semibold"
                    style={{ backgroundColor: ARMY_GREEN }}>
                    Replace roster with these {result.soldiers.length} soldiers
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    This replaces whatever is loaded now, including the demo roster. Nothing is stored until you click.
                  </p>
                </>
              )}
            </section>
          )}

          {committed && (
            <div className={cn('rounded-xl border p-4 text-sm',
              committed.startsWith('ok:')
                ? 'border-green-300 bg-green-50 text-green-900'
                : 'border-red-300 bg-red-50 text-red-900')}>
              {committed.slice(committed.indexOf(':') + 1)}
              {committed.startsWith('ok:') && (
                <Link href="/command" className="ml-2 underline font-semibold">Go to Overview →</Link>
              )}
            </div>
          )}
        </div>
      </div>
      <CommandPrintStyles />
    </div>
  )
}
