// ── Browser-native exports ────────────────────────────────────────────────────
// No dependency: a Blob and an anchor click is all a CSV download needs, and it
// keeps the static bundle small.

function escapeCell(v: string): string {
  const s = v ?? ''
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: string[][], banner?: string): string {
  const lines: string[] = []
  // A leading comment line so an exported demo file can never be mistaken for real data.
  if (banner) lines.push(`# ${banner}`)
  lines.push(headers.map(escapeCell).join(','))
  for (const r of rows) lines.push(r.map(escapeCell).join(','))
  return lines.join('\n')
}

/** Ship any already-built text as a download. One place owns the DOM dance. */
export function downloadFile(filename: string, body: string): void {
  if (typeof window === 'undefined') return
  const blob = new Blob(['﻿', body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  // Firefox ignores a click on an anchor that is not in the document, and
  // revoking the URL in the same tick can cancel the download before it starts.
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadCsv(
  filename: string, headers: string[], rows: string[][], banner?: string
): void {
  downloadFile(filename, toCsv(headers, rows, banner))
}

export function downloadJson(filename: string, data: unknown): void {
  if (typeof window === 'undefined') return
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
