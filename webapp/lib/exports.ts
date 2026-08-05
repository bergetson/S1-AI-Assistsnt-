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

export function downloadCsv(
  filename: string, headers: string[], rows: string[][], banner?: string
): void {
  if (typeof window === 'undefined') return
  const blob = new Blob([toCsv(headers, rows, banner)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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
