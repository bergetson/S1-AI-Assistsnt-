// ── Data provenance ───────────────────────────────────────────────────────────
// Every prototype record should be able to say where it came from and whether
// anyone checked it. This is deliberately a small, serializable shape so it can
// survive a migration into an Army-approved backend unchanged.

export type ProvenanceSource =
  | 'Demo'
  | 'Synthetic'
  | 'Self Reported'
  | 'CSV Import'
  | 'Assignment Detail Report'
  | 'Vacancy Report'
  | 'Leader Reviewed'
  | 'Document Verified'
  | 'Manually Entered'

export interface DataProvenance {
  source: ProvenanceSource
  /** When the underlying source data was produced (ISO date). */
  sourceDate?: string
  /** When it entered this prototype (ISO date). */
  importedAt?: string
  verified: boolean
  verifiedBy?: string
  notes?: string
}

/** Ordered weakest → strongest. Used to rank competing claims. */
export const SOURCE_CONFIDENCE: Record<ProvenanceSource, number> = {
  Synthetic: 0,
  Demo: 0,
  'Self Reported': 1,
  'Manually Entered': 1,
  'CSV Import': 2,
  'Vacancy Report': 3,
  'Assignment Detail Report': 3,
  'Leader Reviewed': 4,
  'Document Verified': 5,
}

export function confidenceOf(p: DataProvenance | undefined): number {
  if (!p) return 0
  return SOURCE_CONFIDENCE[p.source] ?? 0
}

/** True when a record is demonstration data rather than anything real. */
export function isDemoData(p: DataProvenance | undefined): boolean {
  return p?.source === 'Demo' || p?.source === 'Synthetic'
}

/**
 * Days since the source date. Returns null when unknown — callers must treat
 * that as "staleness unknown" rather than "fresh".
 */
export function ageInDays(p: DataProvenance | undefined, asOfIso: string): number | null {
  if (!p?.sourceDate) return null
  const from = Date.parse(`${p.sourceDate}T12:00:00Z`)
  const to = Date.parse(`${asOfIso}T12:00:00Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  return Math.floor((to - from) / 86_400_000)
}

export const STALE_AFTER_DAYS = 365

export function isStale(p: DataProvenance | undefined, asOfIso: string): boolean {
  const age = ageInDays(p, asOfIso)
  return age != null && age > STALE_AFTER_DAYS
}

/** Short human label for badges. */
export function provenanceLabel(p: DataProvenance | undefined): string {
  if (!p) return 'Unknown source'
  if (p.verified) return `${p.source} · verified`
  return p.source
}

export function demoProvenance(sourceDate = '2026-01-01'): DataProvenance {
  return { source: 'Synthetic', sourceDate, verified: false, notes: 'Deterministic demonstration data — not real personnel.' }
}
