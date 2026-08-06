// ── Where every number on screen comes from ───────────────────────────────────
// This app mixes three very different kinds of data and the distinction matters
// more than anything else on the page. Ad-hoc booleans (`isDemo`) drifted until
// one screen claimed data was "imported" while another told the AI it was demo.
// One model, read by every screen and every export.

export type Fidelity =
  /** Real MTARNG source data, exactly as extracted. */
  | 'real'
  /** Real source data with identity removed — real facts, withheld names. */
  | 'real-deidentified'
  /** Loaded by this user from their own file. Real, and named. */
  | 'imported'
  /** Generated. No real-world referent at all. */
  | 'synthetic'

export interface DataSource {
  key: 'billets' | 'roster' | 'civilian'
  label: string
  fidelity: Fidelity
  /** One sentence a commander can read and immediately trust or discount. */
  statement: string
  /** Fields the source genuinely does not contain, so the UI can say so. */
  missingFields?: string[]
}

export const FIDELITY_LABEL: Record<Fidelity, string> = {
  real: 'Real',
  'real-deidentified': 'Real · names withheld',
  imported: 'Your imported data',
  synthetic: 'Demo data',
}

/** Only synthetic data warrants a warning colour. The rest is genuine. */
export function isDemoFidelity(f: Fidelity): boolean {
  return f === 'synthetic'
}

export const BILLET_SOURCE: DataSource = {
  key: 'billets',
  label: 'Force structure',
  fidelity: 'real',
  statement: 'Billets, units, grades, MOSs, and locations come from the current MTARNG MTOE extract.',
}

export const BASELINE_ROSTER_SOURCE: DataSource = {
  key: 'roster',
  label: 'Roster',
  fidelity: 'real-deidentified',
  statement:
    'Real MTARNG assignments — real grades, MOSs, units, component status, time in position, ' +
    'and ETS dates. Date of rank, commissioned service, PME, and civilian education are real for ' +
    'E7 and above, all warrants, and all officers. Names are withheld; soldiers appear as S-nnnn.',
  missingFields: ['PEBD (time in service)', 'Evaluations', 'Date of rank below E7'],
}

export const IMPORTED_ROSTER_SOURCE: DataSource = {
  key: 'roster',
  label: 'Roster',
  fidelity: 'imported',
  statement: 'Loaded from your own file and stored only in this browser.',
}

export const CIVILIAN_SOURCE: DataSource = {
  key: 'civilian',
  label: 'Civilian capability',
  fidelity: 'synthetic',
  statement:
    'Civilian occupations, skills, credentials, and willingness are generated for demonstration. ' +
    'No civilian capability has been collected from soldiers yet.',
}

export function rosterSource(imported: boolean): DataSource {
  return imported ? IMPORTED_ROSTER_SOURCE : BASELINE_ROSTER_SOURCE
}

/**
 * Line prepended to every CSV export so a file that leaves the app still says
 * what it is. Downloaded spreadsheets outlive the screen they came from.
 */
export function exportBanner(sources: DataSource[], extra?: string): string {
  const demo = sources.filter(s => isDemoFidelity(s.fidelity))
  const real = sources.filter(s => !isDemoFidelity(s.fidelity))
  const parts: string[] = []
  if (real.length) parts.push(`REAL: ${real.map(s => s.label.toLowerCase()).join(', ')}`)
  if (demo.length) parts.push(`DEMO/SYNTHETIC: ${demo.map(s => s.label.toLowerCase()).join(', ')}`)
  parts.push('Prototype output — not assignment authority, orders, or an official personnel record.')
  if (extra) parts.push(extra)
  return parts.join(' | ')
}
