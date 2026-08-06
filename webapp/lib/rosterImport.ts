import type { CareerCategory, ComponentStatus } from './types'
import type { RosterSoldier, SrBox, RaterBox, NcoerBox } from './commandTypes'
import { RANK_NUM } from './scoring'
import { asOfDate } from './asOf'

// ── CSV roster import ─────────────────────────────────────────────────────────
// Hand-rolled rather than pulling in a parser dependency. The grammar we need is
// small (RFC-4180 quoting) and adding papaparse for one screen isn't worth the
// bundle in a static export.

/** RFC-4180-ish: handles quoted fields containing commas, newlines, and "" escapes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  // Strip a UTF-8 BOM — Excel adds one and it corrupts the first header.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  while (i < text.length) {
    const c = text[i]

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += c; i++; continue
    }

    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(field); field = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') {
      row.push(field); field = ''
      rows.push(row); row = []
      i++; continue
    }
    field += c; i++
  }
  // Flush the trailing field/row when the file doesn't end in a newline.
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }

  return rows.filter(r => r.some(cell => cell.trim() !== ''))
}

// ── Header mapping ────────────────────────────────────────────────────────────
// Accept a range of header spellings so a commander can export from SIDPERS /
// RCMS / DTMS or hand-build a sheet without renaming everything first.
const HEADER_ALIASES: Record<string, string[]> = {
  lastName: ['last name', 'last_name', 'lastname', 'last', 'surname'],
  firstName: ['first name', 'first_name', 'firstname', 'first', 'given name'],
  rank: ['rank', 'grade', 'pay grade', 'paygrade', 'pmos grade'],
  careerCategory: ['category', 'career category', 'careercategory', 'personnel type', 'type'],
  mos: ['mos', 'pmos', 'aoc', 'mos/aoc', 'primary mos'],
  componentStatus: ['component', 'component status', 'status', 'duty status', 'agr/mday'],
  uic: ['uic', 'unit id', 'unit identification code'],
  unitName: ['unit', 'unit name', 'organization', 'org'],
  city: ['city', 'location', 'duty location', 'duty station'],
  dutyTitle: ['duty title', 'duty_title', 'dutytitle', 'position', 'position title', 'job title'],
  yearsOfService: ['tis', 'years of service', 'yos', 'time in service', 'total service'],
  timeInGrade: ['tig', 'time in grade', 'time_in_grade'],
  timeInPosition: ['tip', 'time in position', 'time_in_position', 'months in position'],
  commissionedYears: ['commissioned years', 'commissioned service', 'tcs', 'years commissioned'],
  pebd: ['pebd', 'basic pay entry date', 'bpd', 'basd', 'pay entry base date'],
  // Personnel systems export dates, not decimals. Without these two the whole
  // app degrades to Unknown, because time in grade and time in service are what
  // every promotion, board, and retirement projection is built on.
  dor: ['dor', 'date of rank', 'date_of_rank', 'grade date', 'rank date'],
  ets: ['ets', 'ets date', 'etsdate', 'expiration term of service'],
  srBox: ['sr box', 'senior rater', 'sr', 'senior rater box', 'sr box check'],
  raterBox: ['rater box', 'rater', 'rater assessment'],
  ncoerBox: ['ncoer', 'ncoer box', 'ncoer rating', 'senior rater potential'],
  evalBullets: ['eval bullets', 'bullets', 'comments', 'evaluation', 'oer comments', 'narrative'],
  pmeComplete: ['pme', 'pme complete', 'schools', 'military education'],
  isPromotable: ['promotable', 'is promotable', 'p status'],
  flagged: ['flagged', 'flag', 'adverse', 'flag status'],
  notes: ['notes', 'remarks', 'comment'],
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ')
}

function mapHeaders(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  headerRow.forEach((raw, idx) => {
    const h = normalizeHeader(raw)
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[field] !== undefined) continue
      if (aliases.includes(h)) { map[field] = idx; break }
    }
  })
  return map
}

// ── Value coercion ────────────────────────────────────────────────────────────
function num(v: string | undefined, fallback = 0): number {
  if (!v) return fallback
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : fallback
}

/**
 * Years between a date and the extract date, or null if the value is not a date
 * we can read. Null matters: it keeps "column absent" distinct from "zero
 * years", which is the distinction the rest of the app is built on.
 */
export function yearsSince(raw: string | undefined, asOf: Date = asOfDate()): number | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  // Accept ISO (2016-06-01), US (06/01/2016), and DD-MON-YYYY (01-JUN-2016).
  const t = Date.parse(/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(s) ? s.replace(/-/g, ' ') : s)
  if (!Number.isFinite(t)) return null
  const years = (asOf.getTime() - t) / (365.25 * 24 * 3600 * 1000)
  // A future date or an implausibly long career is bad data, not a clock.
  if (years < 0 || years > 45) return null
  return Math.round(years * 10) / 10
}

function bool(v: string | undefined): boolean {
  if (!v) return false
  const s = v.trim().toLowerCase()
  return s === 'y' || s === 'yes' || s === 'true' || s === '1' || s === 'p' || s === 'x'
}

/** Normalize 'SGT', 'E-5', 'e5', 'CPT' → 'E5' / 'O3'. */
const RANK_ALIASES: Record<string, string> = {
  pvt: 'E1', pv2: 'E2', pfc: 'E3', spc: 'E4', cpl: 'E4',
  sgt: 'E5', ssg: 'E6', sfc: 'E7', msg: 'E8', '1sg': 'E8', sgm: 'E9', csm: 'E9',
  wo1: 'W1', cw2: 'W2', cw3: 'W3', cw4: 'W4', cw5: 'W5',
  '2lt': 'O1', '1lt': 'O2', cpt: 'O3', maj: 'O4', ltc: 'O5', col: 'O6',
}

export function normalizeRank(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/[-\s]/g, '')
  if (RANK_NUM[s]) return s
  const alias = RANK_ALIASES[raw.trim().toLowerCase().replace(/[-\s]/g, '')]
  return alias ?? s
}

function categoryFor(rank: string, explicit: string | undefined): CareerCategory {
  const e = (explicit ?? '').trim().toLowerCase()
  if (e.startsWith('off')) return 'Officer'
  if (e.startsWith('war') || e.startsWith('wo')) return 'Warrant'
  if (e.startsWith('enl')) return 'Enlisted'
  if (rank.startsWith('O')) return 'Officer'
  if (rank.startsWith('W')) return 'Warrant'
  return 'Enlisted'
}

function componentFor(raw: string | undefined): ComponentStatus {
  const s = (raw ?? '').trim().toLowerCase()
  if (s.includes('agr')) return 'AGR'
  if (s.includes('tech')) return 'Technician'
  if (s.includes('ados')) return 'ADOS'
  if (s.includes('irr')) return 'IRR'
  return 'M-Day'
}

function srBoxFor(raw: string | undefined): SrBox {
  const s = (raw ?? '').trim().toUpperCase()
  if (s.startsWith('MQ') || s.includes('MOST')) return 'MQ'
  if (s.startsWith('HQ') || s.includes('HIGHLY')) return 'HQ'
  if (s.startsWith('NQ') || s.includes('NOT')) return 'NQ'
  if (s.startsWith('Q') || s.includes('QUALIFIED')) return 'Q'
  return ''
}

function raterBoxFor(raw: string | undefined): RaterBox {
  const s = (raw ?? '').trim().toUpperCase()
  if (s.includes('EXCEL')) return 'EXCELS'
  if (s.includes('PROFIC')) return 'PROFICIENT'
  if (s.includes('CAPABLE')) return 'CAPABLE'
  if (s.includes('UNSAT')) return 'UNSATISFACTORY'
  return ''
}

function ncoerBoxFor(raw: string | undefined): NcoerBox {
  const s = (raw ?? '').trim().toUpperCase()
  if (s.includes('MOST')) return 'Most Qualified'
  if (s.includes('HIGHLY')) return 'Highly Qualified'
  if (s.includes('NOT')) return 'Not Qualified'
  if (s.includes('QUALIF')) return 'Qualified'
  return ''
}

// ── Import result ─────────────────────────────────────────────────────────────
export interface ImportIssue {
  row: number
  message: string
}

export interface ImportResult {
  soldiers: RosterSoldier[]
  errors: ImportIssue[]
  warnings: ImportIssue[]
  matchedColumns: string[]
  missingColumns: string[]
}

const REQUIRED = ['rank', 'uic']
// Either the date or the decimal satisfies a clock, so neither is listed alone.
// The dates are what a personnel system exports, so they are named first.
const RECOMMENDED = ['lastName', 'mos', 'pebd', 'dor', 'ets', 'timeInPosition']

export function importRosterCsv(text: string): ImportResult {
  const errors: ImportIssue[] = []
  const warnings: ImportIssue[] = []
  const rows = parseCsv(text)

  if (rows.length === 0) {
    return { soldiers: [], errors: [{ row: 0, message: 'File is empty.' }], warnings: [], matchedColumns: [], missingColumns: [] }
  }

  const cols = mapHeaders(rows[0])
  const matchedColumns = Object.keys(cols)
  const missingRequired = REQUIRED.filter(f => cols[f] === undefined)
  const missingColumns = [...REQUIRED, ...RECOMMENDED].filter(f => cols[f] === undefined)

  if (missingRequired.length > 0) {
    errors.push({
      row: 1,
      message: `Missing required column(s): ${missingRequired.join(', ')}. Found: ${rows[0].join(', ')}`,
    })
    return { soldiers: [], errors, warnings, matchedColumns, missingColumns }
  }

  const get = (r: string[], field: string): string | undefined =>
    cols[field] === undefined ? undefined : r[cols[field]]?.trim()

  const soldiers: RosterSoldier[] = []

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 1

    const rawRank = get(r, 'rank') ?? ''
    const rank = normalizeRank(rawRank)
    if (!RANK_NUM[rank]) {
      errors.push({ row: rowNum, message: `Unrecognized rank "${rawRank}" — skipped.` })
      continue
    }

    const uic = (get(r, 'uic') ?? '').toUpperCase()
    if (!uic) {
      errors.push({ row: rowNum, message: 'Missing UIC — skipped (UIC is how soldiers join to units).' })
      continue
    }

    const careerCategory = categoryFor(rank, get(r, 'careerCategory'))

    // Prefer an explicit decimal column, but fall back to deriving the clock
    // from the date the personnel system actually exports. Before this, a
    // straight SIDPERS extract — which carries PEBD and DOR and no decimals —
    // imported as TIS 0 / TIG 0 for every soldier, and the app then correctly
    // but uselessly reported the entire formation as Unknown.
    const pebdRaw = get(r, 'pebd')
    const dorRaw = get(r, 'dor')
    const tis = num(get(r, 'yearsOfService')) || (yearsSince(pebdRaw) ?? 0)
    const tig = num(get(r, 'timeInGrade')) || (yearsSince(dorRaw) ?? 0)
    let tip = num(get(r, 'timeInPosition'))

    if (tis === 0 && pebdRaw) {
      warnings.push({ row: rowNum, message: `Could not read PEBD "${pebdRaw}" as a date — time in service left Unknown.` })
    }
    if (tig === 0 && dorRaw) {
      warnings.push({ row: rowNum, message: `Could not read date of rank "${dorRaw}" as a date — time in grade left Unknown.` })
    }

    // A "months in position" column is common; convert when the number is implausible as years.
    const tipHeader = cols.timeInPosition !== undefined ? normalizeHeader(rows[0][cols.timeInPosition]) : ''
    if (tipHeader.includes('month') && tip > 0) tip = Math.round((tip / 12) * 10) / 10

    if (tig > tis && tis > 0) {
      warnings.push({ row: rowNum, message: `TIG (${tig}) exceeds TIS (${tis}) — check the data.` })
    }

    const idx = soldiers.length + 1
    soldiers.push({
      id: `r-${String(idx).padStart(4, '0')}`,
      anonId: `S-${String(idx).padStart(3, '0')}`,
      lastName: get(r, 'lastName') ?? '',
      firstName: get(r, 'firstName') ?? '',
      rank,
      careerCategory,
      mos: (get(r, 'mos') ?? '').toUpperCase(),
      componentStatus: componentFor(get(r, 'componentStatus')),
      uic,
      unitName: get(r, 'unitName') ?? uic,
      city: get(r, 'city') ?? '',
      dutyTitle: get(r, 'dutyTitle') ?? '',
      positionId: null,
      yearsOfService: tis,
      timeInGrade: tig,
      timeInPosition: tip,
      commissionedYears: num(get(r, 'commissionedYears'), careerCategory === 'Officer' ? tis : 0),
      pebd: pebdRaw ?? '',
      ets: get(r, 'ets') ?? '',
      srBox: srBoxFor(get(r, 'srBox')),
      raterBox: raterBoxFor(get(r, 'raterBox')),
      ncoerBox: ncoerBoxFor(get(r, 'ncoerBox')),
      evalBullets: get(r, 'evalBullets') ?? '',
      pmeComplete: (get(r, 'pmeComplete') ?? '')
        .split(/[;/|,]/).map(s => s.trim().toUpperCase()).filter(Boolean),
      isPromotable: bool(get(r, 'isPromotable')),
      flagged: bool(get(r, 'flagged')),
      notes: get(r, 'notes') ?? '',
    })
  }

  if (soldiers.length === 0 && errors.length === 0) {
    errors.push({ row: 0, message: 'No usable rows found below the header.' })
  }

  return { soldiers, errors, warnings, matchedColumns, missingColumns }
}

/** The template a commander can download and fill in. */
export const CSV_TEMPLATE_HEADERS = [
  'last_name', 'first_name', 'rank', 'category', 'mos', 'component', 'uic', 'unit',
  'city', 'duty_title', 'pebd', 'dor', 'ets', 'tis', 'tig', 'tip', 'commissioned_years',
  'sr_box', 'rater_box', 'ncoer', 'pme', 'promotable', 'flagged', 'eval_bullets', 'notes',
]

// Row 1 shows the normal case: give the dates and let the app do the arithmetic.
// Row 2 shows precomputed decimals, which still work and win if both are given.
export const CSV_TEMPLATE_SAMPLE = [
  'Whitaker,Marcus,CPT,Officer,42A,AGR,WPBQAA,0495 CS HHC,Kalispell,S1 OIC,2016-06-01,2023-03-15,2028-05-01,,,1.8,,MQ,EXCELS,,BOLC/CCC,Y,N,"Top 10% of captains I senior rate.",',
  'Ramsey,Danielle,SSG,Enlisted,92Y,M-Day,WPBQAA,0495 CS HHC,Kalispell,Supply Sergeant,2015-02-01,2022-01-10,2027-09-01,11.0,4.1,2.5,0,,,Highly Qualified,BLC/ALC,N,N,,',
].join('\n')

export function buildCsvTemplate(): string {
  return `${CSV_TEMPLATE_HEADERS.join(',')}\n${CSV_TEMPLATE_SAMPLE}\n`
}
