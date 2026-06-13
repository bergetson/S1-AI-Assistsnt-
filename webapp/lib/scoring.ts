import type { SoldierProfile, Position, ScoredPosition, MatchLabel, CommuteLimit, CareerCategory, BoardAlert, PositionGap } from './types'
import { getCommute } from './data/cities'
import { ARNG_BOARDS, getNextBoardDate } from './data/boards'

export const RANK_NUM: Record<string, number> = {
  E1:1, E2:2, E3:3, E4:4, E5:5, E6:6, E7:7, E8:8, E9:9,
  W1:10, W2:11, W3:12, W4:13, W5:14,
  O1:15, O2:16, O3:17, O4:18, O5:19, O6:20,
}

const COMMUTE_LIMIT_MINS: Record<CommuteLimit, number> = {
  '30 Minutes': 30,
  '1 Hour':     60,
  '1.5 Hours':  90,
  '2 Hours':    120,
  '3 Hours':    180,
  'No Limit':   9999,
}

// ── Promotion timeline data (AR 600-8-19 / NGR 600-200 / DA Pam 600-3) ───────
// minTig: minimum TIG (years) before board eligibility
// typicalTig: realistic TIG when soldiers typically compete successfully
// pmeRequired: PME that must be complete before board/promotion (blocks scoring if missing)
// pmeAdvisory: PME that should be underway (reduces readiness if missing but doesn't block)
export interface PromotionGate {
  minTig: number
  typicalTig: number
  minTis: number
  pmeRequired: string[]   // missing any = major reduction
  pmeAdvisory: string[]   // missing = minor reduction
  notes: string
}

export const PROMOTION_GATES: Record<string, PromotionGate> = {
  // Enlisted — NGR 600-200, AR 600-8-19
  E5: { minTig: 0.67, typicalTig: 1.5, minTis: 3,
        pmeRequired: ['blcComplete'], pmeAdvisory: ['ssd1Complete'],
        notes: 'BLC required before/within 1 year of E5 promotion; board-based below zone possible.' },
  E6: { minTig: 1,    typicalTig: 4,   minTis: 6,
        pmeRequired: ['alcComplete'], pmeAdvisory: ['blcComplete'],
        notes: 'ALC must be complete before E6 promotion board eligibility in ARNG.' },
  E7: { minTig: 2,    typicalTig: 6,   minTis: 13,
        pmeRequired: ['slcComplete'], pmeAdvisory: ['alcComplete'],
        notes: 'SLC must be complete before E7 consideration. Very competitive centralized board.' },
  E8: { minTig: 3,    typicalTig: 8,   minTis: 18,
        pmeRequired: ['slcComplete'], pmeAdvisory: [],
        notes: 'Centralized DA selection board. Competitive. SLC required.' },
  E9: { minTig: 3,    typicalTig: 10,  minTis: 22,
        pmeRequired: ['smcComplete'], pmeAdvisory: [],
        notes: 'SGM/CSM: SGM-E (SMC) required for E9. Extremely competitive. <5% selection.' },

  // Officers — DA Pam 600-3, NGB guidance
  O2: { minTig: 1.5,  typicalTig: 1.5, minTis: 1.5,
        pmeRequired: ['bolcComplete'], pmeAdvisory: [],
        notes: 'O1→O2 is time-based at 18 months. Essentially automatic if meeting standards.' },
  O3: { minTig: 2,    typicalTig: 3,   minTis: 4,
        pmeRequired: ['bolcComplete'], pmeAdvisory: [],
        notes: 'O2→O3 (CPT) at ~3-4 years. BOLC required. High selection rate.' },
  O4: { minTig: 3,    typicalTig: 5,   minTis: 10,
        pmeRequired: ['cccComplete'], pmeAdvisory: [],
        notes: 'CPT→MAJ: CCC required before board. Minimum 3yr TIG as CPT; typical 4-6yr. ~80% selection rate in ARNG.' },
  O5: { minTig: 3,    typicalTig: 6,   minTis: 16,
        pmeRequired: ['ileComplete'], pmeAdvisory: ['cccComplete'],
        notes: 'MAJ→LTC: ILE (CGSC) required. ~70% selection. Command time valued heavily.' },
  O6: { minTig: 3,    typicalTig: 7,   minTis: 22,
        pmeRequired: ['ileComplete'], pmeAdvisory: [],
        notes: 'LTC→COL: Very competitive. ILE required, SSC/SSP credit valued.' },

  // Warrant Officers — AR 600-8-29
  W2: { minTig: 2,    typicalTig: 2,   minTis: 6,
        pmeRequired: ['wobcComplete'], pmeAdvisory: [],
        notes: 'WO1 is temporary grade. WOBC required. Promoted to CW2 at 2yr min TIG.' },
  W3: { minTig: 5,    typicalTig: 5,   minTis: 8,
        pmeRequired: ['woacComplete'], pmeAdvisory: ['wobcComplete'],
        notes: 'CW2→CW3: WOAC required. Minimum 5yr TIG as CW2. DA selection board.' },
  W4: { minTig: 3,    typicalTig: 5,   minTis: 13,
        pmeRequired: ['woacComplete'], pmeAdvisory: [],
        notes: 'CW3→CW4: WOILE required for some specialties. DA board. Competitive.' },
  W5: { minTig: 3,    typicalTig: 7,   minTis: 20,
        pmeRequired: [], pmeAdvisory: [],
        notes: 'CW4→CW5: Extremely limited authorizations. Requires SGM-equivalent billet.' },
}

// Assess how promotion-ready a soldier is for a given target grade (0.0–1.0).
// Returns 1.0 if fully ready, lower if TIG is short or PME gates are missing.
function promotionReadiness(profile: SoldierProfile, targetGrade: string): number {
  const gate = PROMOTION_GATES[targetGrade]
  if (!gate) return 1.0  // no data → assume eligible

  let readiness = 1.0

  // ── TIG factor ────────────────────────────────────────────────────────────
  const tig = profile.timeInGrade
  if (tig < gate.minTig) {
    // Below minimum: steep penalty
    readiness *= 0.2 + 0.4 * (tig / gate.minTig)
  } else if (tig < gate.typicalTig) {
    // Between minimum and typical: linear ramp from 0.6 → 1.0
    const t = (tig - gate.minTig) / (gate.typicalTig - gate.minTig)
    readiness *= 0.6 + 0.4 * t
  }
  // At or past typicalTig → readiness stays 1.0

  // ── PME gates ─────────────────────────────────────────────────────────────
  for (const pmeField of gate.pmeRequired) {
    const done = (profile as unknown as Record<string, boolean>)[pmeField]
    if (!done) readiness *= 0.35  // required PME missing — big hit
  }
  for (const pmeField of gate.pmeAdvisory) {
    const done = (profile as unknown as Record<string, boolean>)[pmeField]
    if (!done) readiness *= 0.85  // advisory PME missing — small hit
  }

  // ── Promotable / on list bonus ────────────────────────────────────────────
  if (profile.isPromotable || profile.onPromotionList) readiness = Math.min(1.0, readiness * 1.2)

  return Math.max(0.05, Math.min(1.0, readiness))
}

function gradeScore(profile: SoldierProfile, pos: Position): number {
  if (pos.careerCategory !== profile.careerCategory) return 0
  const posNum    = RANK_NUM[pos.grade] ?? 0
  const curNum    = RANK_NUM[profile.rank] ?? 0
  const targetNum = RANK_NUM[profile.targetRank] ?? 0
  if (posNum === 0) return 0

  // Below current grade — not useful; small score only if soldier wants lateral/flexibility
  if (posNum < curNum) return 3

  // Lateral — same grade, always eligible
  if (posNum === curNum) return 20

  // One grade above current (natural next step)
  if (posNum === curNum + 1) {
    const r = promotionReadiness(profile, pos.grade)
    return Math.round(28 * r)
  }

  // Exactly the target grade
  if (posNum === targetNum && posNum > curNum) {
    const r = promotionReadiness(profile, pos.grade)
    // If target grade is 2+ steps ahead, readiness must account for multiple promotion steps
    // Rough compounding: each step compounds
    const steps = posNum - curNum
    const compounded = Math.pow(r, steps)
    return Math.round(35 * compounded)
  }

  // Two or more grades above target — real stretch / aspirational
  if (posNum === targetNum + 1 && posNum > curNum + 1) {
    const r = promotionReadiness(profile, pos.grade)
    return Math.round(10 * Math.pow(r, posNum - curNum))
  }

  return 0
}

function mosScore(profile: SoldierProfile, pos: Position): number {
  // "00x" MOS codes = open to multiple MOS within career category — partial credit
  if (!pos.mos || pos.mos.startsWith('00')) return 15
  if (pos.mos === profile.mos || pos.mos === profile.secondaryMos) return 30
  if (profile.wantToSwitchMos === 'Yes' && pos.mos === profile.targetMos) return 25
  if (profile.wantToSwitchMos !== 'No') return 8
  // Related MOS: same first two digits = related career field
  if (pos.mos.slice(0, 2) === profile.mos.slice(0, 2)) return 15
  // Branch cross-match groups: officers filling related branch positions
  const INF_MOS  = new Set(['11A', '11B', '11C', '11Z'])
  const FA_MOS   = new Set(['13A', '13B', '13D', '13F', '13J', '13M', '13P', '13R', '13T', '13Z'])
  const LOG_MOS  = new Set(['90A', '92A', '92F', '92G', '92Y', '92Z', '92L', '92M', '92S', '92W'])
  const INTEL_MOS = new Set(['35F', '35G', '35L', '35M', '35N', '35P', '35S', '35T', '35W', '35X', '35Z'])
  const mgroups = [INF_MOS, FA_MOS, LOG_MOS, INTEL_MOS]
  for (const group of mgroups) {
    if (group.has(pos.mos) && group.has(profile.mos)) return 20
  }
  return 0
}

function commuteScore(profile: SoldierProfile, pos: Position): number {
  const commute = getCommute(profile.homeCity, pos.city)
  if (!commute) return 5  // unknown — neutral
  const mins  = commute.minutes
  const limit = COMMUTE_LIMIT_MINS[profile.maxCommute]
  if (mins === 0)            return 15
  if (mins <= limit)         return 15
  if (mins <= limit * 1.25)  return 8
  if (mins <= limit * 1.5)   return 3
  return 0
}

function goalScore(profile: SoldierProfile, pos: Position): number {
  const { primaryGoal, desiredPositionType } = profile
  if (primaryGoal === 'Pursue Command')
    return pos.isCommandOrKD ? 15 : 5
  if (primaryGoal === 'Pursue AGR Full-Time')
    return pos.statusType === 'AGR' ? 15 : pos.statusType === 'Multiple' ? 10 : 3
  if (primaryGoal === 'Move to Staff')
    return pos.positionType === 'Staff' ? 15 : pos.positionType === 'Technical' ? 8 : 4
  if (primaryGoal === 'Promote to Next Grade') {
    // KD/leadership positions are the currency for promotion boards
    if (pos.isCommandOrKD || pos.positionType === 'Command') return 15
    if (pos.positionType === 'Leadership') return 12
    if (pos.positionType === 'Staff') return 9
    return 7
  }
  if (primaryGoal === 'Pursue Senior Leader Path')
    return pos.positionType === 'Command' ? 15 : pos.isCommandOrKD ? 12 : 7
  if (primaryGoal === 'Switch MOS/Branch')
    return pos.mos === profile.targetMos ? 15 : 8
  if (primaryGoal === 'Broaden Experience')
    return pos.positionType === 'Broadening' || pos.city !== profile.unitCity ? 12 : 7
  if (primaryGoal === 'Retire in Current Grade')
    return pos.grade === profile.rank ? 12 : 7
  if (desiredPositionType !== 'Any' && pos.positionType === desiredPositionType) return 12
  return 8
}

function statusScore(profile: SoldierProfile, pos: Position): number {
  const preferred = profile.preferredStatus
  if (preferred === 'Either') return 5
  if (pos.statusType === preferred) return 5
  if (pos.statusType === 'Multiple') return 4
  return 2
}

function matchLabel(score: number): MatchLabel {
  if (score >= 80) return 'STRONG MATCH'
  if (score >= 60) return 'GOOD MATCH'
  if (score >= 40) return 'MODERATE / STRETCH'
  if (score >= 20) return 'POSSIBLE — GAPS EXIST'
  return 'NOT RECOMMENDED NOW'
}

export function scorePosition(profile: SoldierProfile, pos: Position): ScoredPosition {
  const commute = getCommute(profile.homeCity, pos.city)
  const gs  = gradeScore(profile, pos)
  const ms  = mosScore(profile, pos)
  const cs  = commuteScore(profile, pos)
  const gls = goalScore(profile, pos)
  const ss  = statusScore(profile, pos)
  // Vacant positions are immediately actionable — small bonus
  const vacancyBonus = pos.vacancyStatus === 'Vacant' ? 5 : 0
  const raw = gs + ms + cs + gls + ss + vacancyBonus
  const total = Math.min(100, raw)
  return {
    ...pos,
    gradeScore:    gs,
    mosScore:      ms,
    commuteScore:  cs,
    goalScore:     gls,
    statusScore:   ss,
    totalScore:    total,
    matchLabel:    matchLabel(total),
    commuteMins:   commute?.minutes ?? -1,
    commuteMiles:  commute?.miles ?? -1,
  }
}

// Only score positions that match the soldier's career category.
// Officers cannot fill Enlisted or Warrant positions, and vice versa.
export function scoreAllPositions(profile: SoldierProfile, positions: Position[]): ScoredPosition[] {
  return positions
    .filter(p => p.careerCategory === profile.careerCategory)
    .map(p => scorePosition(profile, p))
    .sort((a, b) => b.totalScore - a.totalScore)
}

// Cross-category alternate paths — only shown when the soldier has expressed interest.
// Enlisted with Warrant interest → show Warrant positions (requires WOCS).
// Enlisted with OCS interest (switch MOS goal) → show Officer positions (requires OCS).
export function scoreAlternatePaths(profile: SoldierProfile, positions: Position[]): ScoredPosition[] {
  const altCats: CareerCategory[] = []
  if (profile.careerCategory === 'Enlisted') {
    if (profile.warrantInterest !== 'No') altCats.push('Warrant')
    if (profile.primaryGoal === 'Switch MOS/Branch' || profile.primaryGoal === 'Pursue Senior Leader Path') altCats.push('Officer')
  }
  if (altCats.length === 0) return []

  return positions
    .filter(p => altCats.includes(p.careerCategory))
    .map(p => ({
      ...scorePosition(profile, p),
      pathNote: p.careerCategory === 'Warrant'
        ? 'Requires WOCS selection & WO appointment — not a lateral move'
        : 'Requires OCS commissioning — contact MTARNG G1/Recruiting',
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 15)
}

export function matchLabelColor(label: MatchLabel): string {
  switch (label) {
    case 'STRONG MATCH':          return 'bg-green-100 text-green-800 border-green-300'
    case 'GOOD MATCH':            return 'bg-blue-100 text-blue-800 border-blue-300'
    case 'MODERATE / STRETCH':    return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    case 'POSSIBLE — GAPS EXIST': return 'bg-orange-100 text-orange-800 border-orange-300'
    case 'NOT RECOMMENDED NOW':   return 'bg-red-100 text-red-800 border-red-300'
  }
}

export function matchLabelDot(label: MatchLabel): string {
  switch (label) {
    case 'STRONG MATCH':          return 'bg-green-500'
    case 'GOOD MATCH':            return 'bg-blue-500'
    case 'MODERATE / STRETCH':    return 'bg-yellow-500'
    case 'POSSIBLE — GAPS EXIST': return 'bg-orange-500'
    case 'NOT RECOMMENDED NOW':   return 'bg-red-500'
  }
}

export function getPmeGaps(profile: SoldierProfile): string[] {
  const gaps: string[] = []
  const r = RANK_NUM[profile.rank] ?? 0

  if (profile.careerCategory === 'Enlisted') {
    if (!profile.ssd1Complete && r <= 4)
      gaps.push('SSD1 — Complete before BLC enrollment')
    if (!profile.blcComplete && r <= 5)
      gaps.push('BLC — Required before/within 1 year of SGT (E5) promotion')
    if (!profile.alcComplete && r <= 6)
      gaps.push('ALC — Must be complete before SSG (E6) promotion board')
    if (!profile.slcComplete && r >= 6)
      gaps.push('SLC — Required before SFC (E7) promotion board consideration')
    if (!profile.smcComplete && r >= 8)
      gaps.push('SGM-E (SMC) — Required for E9 eligibility')
  }

  if (profile.careerCategory === 'Officer') {
    if (!profile.bolcComplete)
      gaps.push('BOLC — Required within 12 months of commissioning')
    if (!profile.cccComplete && r >= 17)
      gaps.push("CCC (Captain's Career Course) — Required before MAJ (O4) board")
    if (!profile.ileComplete && r >= 18)
      gaps.push('ILE (CGSC or equivalent) — Required for LTC (O5) and COL promotion')
    if (!profile.sscComplete && r >= 19)
      gaps.push('SSC (Senior Service College) — Required for GO track')
  }

  if (profile.careerCategory === 'Warrant') {
    if (!profile.wobcComplete)
      gaps.push('WOBC — Required within 24 months of WO appointment')
    if (!profile.woacComplete && r >= 11)
      gaps.push('WOAC — Required for CW3 (W3) promotion board')
    if (!profile.woileComplete && r >= 12)
      gaps.push('WOILE — Required for CW4 (W4) promotion consideration')
  }

  return gaps
}

// Human-readable promotion readiness for display in the UI / AI context.
// Returns a short status string and the numeric readiness (0-1).
export function getPromotionReadiness(profile: SoldierProfile): {
  targetGrade: string
  readiness: number
  label: string
  blockers: string[]
} {
  const targetGrade = profile.targetRank
  const gate = PROMOTION_GATES[targetGrade]
  if (!gate) return { targetGrade, readiness: 1, label: 'No data', blockers: [] }

  const readiness = promotionReadiness(profile, targetGrade)
  const blockers: string[] = []

  for (const pmeField of gate.pmeRequired) {
    const done = (profile as unknown as Record<string, boolean>)[pmeField]
    if (!done) {
      const labels: Record<string, string> = {
        blcComplete: 'BLC not complete', alcComplete: 'ALC not complete',
        slcComplete: 'SLC not complete', smcComplete: 'SMC not complete',
        bolcComplete: 'BOLC not complete', cccComplete: 'CCC not complete',
        ileComplete: 'ILE not complete', sscComplete: 'SSC not complete',
        wobcComplete: 'WOBC not complete', woacComplete: 'WOAC not complete',
        woileComplete: 'WOILE not complete',
      }
      blockers.push(labels[pmeField] ?? pmeField)
    }
  }

  if (profile.timeInGrade < gate.minTig)
    blockers.push(`TIG ${profile.timeInGrade.toFixed(1)} yr < ${gate.minTig} yr minimum`)
  else if (profile.timeInGrade < gate.typicalTig)
    blockers.push(`TIG ${profile.timeInGrade.toFixed(1)} yr (typical board zone: ${gate.typicalTig} yr)`)

  let label: string
  if (readiness >= 0.85)      label = 'Board-ready'
  else if (readiness >= 0.60) label = 'Close — some gaps'
  else if (readiness >= 0.35) label = 'Work to do'
  else                         label = 'Not eligible yet'

  return { targetGrade, readiness, label, blockers }
}

// ── Board Alert ───────────────────────────────────────────────────────────────
export function getBoardAlert(profile: SoldierProfile): BoardAlert | null {
  const targetGrade = profile.targetRank
  const board = ARNG_BOARDS.find(b => b.grade === targetGrade)
  if (!board) return null

  const next = getNextBoardDate(targetGrade)
  if (!next) return null

  const { label, blockers } = getPromotionReadiness(profile)

  let urgencyLevel: 'critical' | 'warning' | 'info'
  let message: string

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  if (next.monthsAway <= 3) {
    urgencyLevel = 'critical'
    message = `${board.name} convenes in ~${next.monthsAway} month${next.monthsAway === 1 ? '' : 's'} — records cutoff around ${fmt(next.cutoff)}.`
  } else if (next.monthsAway <= 6) {
    urgencyLevel = 'warning'
    message = `${board.name} is ~${next.monthsAway} months away (est. ${fmt(next.convene)}) — record cutoff ~${fmt(next.cutoff)}.`
  } else {
    urgencyLevel = 'info'
    message = `${board.name} typically convenes around ${fmt(next.convene)} (~${next.monthsAway} months). Promotion readiness: ${label}.`
  }

  const actions: string[] = []
  for (const b of blockers) actions.push(b)
  if (!profile.hasKdPosition && ['E7', 'E8', 'E9', 'O4', 'O5'].includes(targetGrade)) {
    actions.push('Pursue a KD/leadership position before the board')
  }

  return {
    grade: targetGrade,
    boardName: board.name,
    conveneDate: next.convene,
    cutoffDate: next.cutoff,
    monthsAway: next.monthsAway,
    urgencyLevel,
    message,
    actions,
  }
}

// ── Position Gap Analysis ─────────────────────────────────────────────────────
export function getPositionGaps(profile: SoldierProfile, pos: Position): PositionGap[] {
  const gaps: PositionGap[] = []
  const posNum = RANK_NUM[pos.grade] ?? 0
  const curNum = RANK_NUM[profile.rank] ?? 0

  if (posNum < curNum) {
    gaps.push({
      category: 'grade', label: 'Below current grade',
      detail: `This ${pos.grade} slot is below your ${profile.rank} — low career development value`,
      severity: 'significant',
    })
  } else if (posNum > curNum + 1) {
    gaps.push({
      category: 'grade', label: 'Multiple grades ahead',
      detail: `Requires ${posNum - curNum} promotion step${posNum - curNum > 1 ? 's' : ''} from your current ${profile.rank}`,
      severity: 'blocking',
    })
  } else if (posNum === curNum + 1) {
    const r = promotionReadiness(profile, pos.grade)
    if (r < 0.4) {
      gaps.push({
        category: 'tig', label: 'Not yet in board zone',
        detail: `TIG or PME requirements for ${pos.grade} are not yet met — check promotion readiness`,
        severity: 'significant',
      })
    }
  }

  if (pos.mos && !pos.mos.startsWith('00') && pos.mos !== profile.mos && pos.mos !== profile.secondaryMos) {
    const isSameField = pos.mos.slice(0, 2) === profile.mos.slice(0, 2)
    gaps.push({
      category: 'mos', label: isSameField ? 'Related but different MOS' : 'MOS mismatch',
      detail: `Position requires ${pos.mos}; your MOS is ${profile.mos}${profile.secondaryMos ? '/' + profile.secondaryMos : ''}`,
      severity: isSameField ? 'minor' : 'significant',
    })
  }

  const commute = getCommute(profile.homeCity, pos.city)
  if (commute) {
    const limits: Record<CommuteLimit, number> = {
      '30 Minutes': 30, '1 Hour': 60, '1.5 Hours': 90,
      '2 Hours': 120, '3 Hours': 180, 'No Limit': 9999,
    }
    const limit = limits[profile.maxCommute]
    if (commute.minutes > limit * 1.5) {
      gaps.push({
        category: 'commute', label: 'Commute exceeds limit',
        detail: `${commute.minutes} min drive is well over your ${profile.maxCommute} preference`,
        severity: 'significant',
      })
    } else if (commute.minutes > limit) {
      gaps.push({
        category: 'commute', label: 'Commute slightly over limit',
        detail: `${commute.minutes} min drive is slightly over your ${profile.maxCommute} preference`,
        severity: 'minor',
      })
    }
  }

  if (profile.primaryGoal === 'Pursue AGR Full-Time' && pos.statusType === 'M-Day') {
    gaps.push({
      category: 'goal', label: 'Status mismatch',
      detail: 'Your goal is AGR full-time but this is an M-Day position',
      severity: 'minor',
    })
  }
  if (profile.primaryGoal === 'Pursue Command' && !pos.isCommandOrKD) {
    gaps.push({
      category: 'goal', label: 'Not a command/KD slot',
      detail: 'Your primary goal is command but this is not a command or KD position',
      severity: 'minor',
    })
  }

  return gaps
}

// ── Career Path Sequencer ─────────────────────────────────────────────────────
import type { CareerStep } from './types'

const RANK_REVERSE: Record<number, string> = {}
for (const [r, n] of Object.entries(RANK_NUM)) RANK_REVERSE[n] = r

const PME_LABELS: Record<string, string> = {
  blcComplete: 'Complete BLC (Basic Leader Course)',
  alcComplete: 'Complete ALC (Advanced Leader Course)',
  slcComplete: 'Complete SLC (Senior Leader Course)',
  smcComplete: 'Complete SMC (Sergeants Major Course, Fort Bliss)',
  bolcComplete: 'Complete BOLC (Basic Officer Leader Course)',
  cccComplete: "Complete CCC (Captain's Career Course)",
  ileComplete: 'Complete ILE / CGSC (Intermediate Level Education)',
  sscComplete: 'Complete SSC (Senior Service College)',
  wobcComplete: 'Complete WOBC (Warrant Officer Basic Course)',
  woacComplete: 'Complete WOAC (Warrant Officer Advanced Course)',
  woileComplete: 'Complete WOILE (Warrant Officer Intermediate Level Education)',
}

export function buildCareerPath(profile: SoldierProfile): CareerStep[] {
  const curNum = RANK_NUM[profile.rank] ?? 0
  const targetNum = RANK_NUM[profile.targetRank] ?? curNum
  const steps: CareerStep[] = []
  let stepYear = 0
  const addedPme = new Set<string>()

  // Current status
  steps.push({
    id: 'current',
    year: 0,
    title: `${profile.rank} — Current Status`,
    type: 'milestone',
    status: 'current',
    description: `${profile.dutyTitle || 'Current position'} · ${profile.unitCity || profile.homeCity} · ${profile.yearsOfService} yrs service, ${profile.timeInGrade} yrs TIG`,
    grade: profile.rank,
  })

  // Walk from current rank up to target
  for (let n = curNum + 1; n <= targetNum; n++) {
    const grade = RANK_REVERSE[n]
    if (!grade) continue
    const gate = PROMOTION_GATES[grade]
    if (!gate) continue

    // How many more years of TIG as the *previous* grade are needed?
    const prevGrade = RANK_REVERSE[n - 1]
    const tigAtPrev = n === curNum + 1 ? profile.timeInGrade : 0
    const yearsToBoard = Math.max(0, gate.typicalTig - tigAtPrev)
    stepYear += yearsToBoard

    // Insert required PME steps before promotion (if not complete, deduplicated)
    const allPme = [...gate.pmeRequired, ...gate.pmeAdvisory]
    for (const pmeField of allPme) {
      if (addedPme.has(pmeField)) continue
      const done = (profile as unknown as Record<string, boolean>)[pmeField]
      if (!done) {
        addedPme.add(pmeField)
        const pmeYear = Math.max(0, stepYear - 1)
        const isRequired = gate.pmeRequired.includes(pmeField)
        steps.push({
          id: `pme-${grade}-${pmeField}`,
          year: pmeYear,
          title: PME_LABELS[pmeField] ?? pmeField,
          type: 'pme',
          status: 'future',
          description: isRequired
            ? `Required before ${grade} promotion — enroll as soon as eligible`
            : `Strongly recommended before ${grade} board — improves record`,
        })
      }
    }

    // Promotion step
    const prevGradeName = prevGrade ? ` from ${prevGrade}` : ''
    steps.push({
      id: `promote-${grade}`,
      year: stepYear,
      title: `Promote to ${grade}`,
      type: 'promotion',
      status: 'future',
      description: `Target ${grade} promotion${prevGradeName}. Typical board zone: ${gate.typicalTig} yr TIG as ${prevGrade ?? 'prior grade'}. ${gate.notes.split('.')[0]}.`,
      grade,
    })

    // After promotion, start fresh TIG clock (for next iteration, tigAtPrev is 0)
    // Add a suggested assignment step between promotions
    if (n < targetNum) {
      const nextGrade = RANK_REVERSE[n + 1]
      const nextGateExists = nextGrade && PROMOTION_GATES[nextGrade]
      if (nextGateExists) {
        steps.push({
          id: `assign-${grade}`,
          year: stepYear + 1,
          title: `Seek KD / Leadership Assignment as ${grade}`,
          type: 'assignment',
          status: 'future',
          description: `Pursue a key developmental or leadership position at ${grade} grade to strengthen board record for ${nextGrade ?? 'next promotion'}.`,
          grade,
        })
      }
    }
  }

  // 20-year retirement check
  const yearsToRetirement = Math.max(0, 20 - profile.yearsOfService)
  if (yearsToRetirement > 0 && yearsToRetirement <= 15) {
    const retYear = new Date().getFullYear() + yearsToRetirement
    steps.push({
      id: 'retirement',
      year: yearsToRetirement,
      title: `20-Year Retirement Eligible (~${retYear})`,
      type: 'milestone',
      status: 'future',
      description: `At ${profile.yearsOfService} years service now — retirement eligibility in approximately ${yearsToRetirement} more years.`,
    })
  }

  // Sort by year then assign status
  steps.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    const order = { current: 0, done: 1, next: 2, future: 3 }
    return order[a.status] - order[b.status]
  })

  // Mark the first future step as 'next'
  let markedNext = false
  for (const s of steps) {
    if (s.status === 'future' && !markedNext) {
      s.status = 'next'
      markedNext = true
    }
  }

  return steps
}

// ── Position Action Plan ──────────────────────────────────────────────────────
import type { ActionItem } from './types'

export function getPositionActionPlan(profile: SoldierProfile, pos: Position): ActionItem[] {
  const items: ActionItem[] = []
  const posNum = RANK_NUM[pos.grade] ?? 0
  const curNum = RANK_NUM[profile.rank] ?? 0

  // ── Grade / eligibility ───────────────────────────────────────────────────
  if (posNum < curNum) {
    items.push({
      label: 'Grade: below your current rank',
      detail: `This ${pos.grade} position is below your ${profile.rank} — limited development value`,
      done: false, priority: 'info',
    })
  } else if (posNum === curNum) {
    items.push({
      label: 'Grade: lateral move — eligible now',
      detail: `Your ${profile.rank} rank qualifies you directly for this position`,
      done: true, priority: 'required',
    })
  } else if (posNum === curNum + 1) {
    const gate = PROMOTION_GATES[pos.grade]
    const r = gate ? promotionReadiness(profile, pos.grade) : 1

    // TIG check
    if (gate) {
      const tigOk = profile.timeInGrade >= gate.minTig
      const tigToTypical = Math.max(0, gate.typicalTig - profile.timeInGrade)
      items.push({
        label: tigOk ? `TIG: minimum met (${profile.timeInGrade} yr ≥ ${gate.minTig} yr)` : `TIG: ${(gate.minTig - profile.timeInGrade).toFixed(1)} more years needed as ${profile.rank}`,
        detail: tigOk
          ? (tigToTypical > 0 ? `Eligible for board; competitive zone at ${gate.typicalTig} yr TIG (${tigToTypical.toFixed(1)} yr to go)` : 'In the competitive board zone')
          : `Minimum TIG for ${pos.grade} is ${gate.minTig} yr — not yet board-eligible`,
        done: tigOk, priority: 'required',
        timeline: tigOk ? undefined : `~${Math.ceil((gate.minTig - profile.timeInGrade) * 12)} months`,
      })

      // Required PME
      for (const pmeField of gate.pmeRequired) {
        const done = (profile as unknown as Record<string, boolean>)[pmeField]
        const pmeLabels: Record<string, string> = {
          bolcComplete: 'BOLC', cccComplete: 'CCC', ileComplete: 'ILE', sscComplete: 'SSC',
          blcComplete: 'BLC', alcComplete: 'ALC', slcComplete: 'SLC', smcComplete: 'SMC',
          wobcComplete: 'WOBC', woacComplete: 'WOAC', woileComplete: 'WOILE',
        }
        const pmeName = pmeLabels[pmeField] ?? pmeField
        items.push({
          label: done ? `${pmeName}: complete ✓` : `${pmeName}: required — not yet complete`,
          detail: done
            ? `${pmeName} is complete — satisfies the requirement for ${pos.grade}`
            : `${pmeName} must be complete before ${pos.grade} promotion — enroll as soon as eligible`,
          done, priority: 'required',
          timeline: done ? undefined : '3–12 months depending on course availability',
        })
      }

      // Advisory PME
      for (const pmeField of gate.pmeAdvisory) {
        const done = (profile as unknown as Record<string, boolean>)[pmeField]
        const pmeLabels: Record<string, string> = {
          bolcComplete: 'BOLC', cccComplete: 'CCC', ileComplete: 'ILE', sscComplete: 'SSC',
          blcComplete: 'BLC', alcComplete: 'ALC', slcComplete: 'SLC', smcComplete: 'SMC',
          wobcComplete: 'WOBC', woacComplete: 'WOAC', woileComplete: 'WOILE',
        }
        const pmeName = pmeLabels[pmeField] ?? pmeField
        items.push({
          label: done ? `${pmeName}: complete ✓` : `${pmeName}: strongly recommended`,
          detail: done
            ? `${pmeName} complete — strengthens your board record`
            : `${pmeName} is not a hard gate (PPOM 24-014) but boards notice incomplete PME — complete ASAP`,
          done, priority: 'recommended',
          timeline: done ? undefined : '3–12 months',
        })
      }

      // KD position
      if (['E7','E8','E9','O4','O5'].includes(pos.grade)) {
        items.push({
          label: profile.hasKdPosition ? 'KD position: on record ✓' : 'KD/leadership position needed',
          detail: profile.hasKdPosition
            ? 'Key developmental position on your record — this is a significant advantage'
            : `A KD or leadership position before the ${pos.grade} board significantly improves selection odds`,
          done: profile.hasKdPosition, priority: 'recommended',
          timeline: profile.hasKdPosition ? undefined : '6–24 months (seek PSG/SL/CDR role)',
        })
      }

      // Promotable status
      if (profile.isPromotable || profile.onPromotionList) {
        items.push({
          label: 'Promotable / on list: yes ✓',
          detail: 'Promotable status or being on the promotion list gives you a readiness advantage',
          done: true, priority: 'info',
        })
      } else if (r < 0.7) {
        items.push({
          label: 'Overall readiness: work to do',
          detail: `Current promotion readiness for ${pos.grade} is ${Math.round(r * 100)}% — address PME and TIG gaps first`,
          done: false, priority: 'recommended',
        })
      }
    }
  } else {
    items.push({
      label: `Grade: requires ${posNum - curNum} promotion step${posNum - curNum > 1 ? 's' : ''}`,
      detail: `You need to promote through ${posNum - curNum} grade${posNum - curNum > 1 ? 's' : ''} before this position is in range`,
      done: false, priority: 'required',
    })
  }

  // ── MOS ───────────────────────────────────────────────────────────────────
  if (!pos.mos || pos.mos.startsWith('00')) {
    items.push({
      label: 'MOS: open to multiple — you qualify',
      detail: 'This position accepts various MOSs within its career category',
      done: true, priority: 'required',
    })
  } else if (pos.mos === profile.mos || pos.mos === profile.secondaryMos) {
    items.push({
      label: `MOS: exact match (${pos.mos}) ✓`,
      detail: 'Your MOS directly qualifies you for this position',
      done: true, priority: 'required',
    })
  } else if (profile.wantToSwitchMos === 'Yes' && pos.mos === profile.targetMos) {
    items.push({
      label: `MOS: your reclass target (${pos.mos})`,
      detail: `This position uses your target MOS — complete MOS reclassification first via your unit S1`,
      done: false, priority: 'required',
      timeline: 'MOS reclass: 6–18 months',
    })
  } else {
    const sameField = pos.mos.slice(0, 2) === profile.mos.slice(0, 2)
    items.push({
      label: sameField ? `MOS: related field (${pos.mos} vs your ${profile.mos})` : `MOS: mismatch (${pos.mos} required)`,
      detail: sameField
        ? `Related MOS — partial credit. A commander waiver or MOS reclassification may be possible`
        : `Position requires ${pos.mos}. Requires MOS reclassification — talk to your S1 about the process`,
      done: false, priority: sameField ? 'recommended' : 'required',
      timeline: 'MOS reclass: 6–18 months if needed',
    })
  }

  // ── Vacancy urgency ───────────────────────────────────────────────────────
  if (pos.vacancyStatus === 'Vacant') {
    items.push({
      label: 'Vacancy: OPEN NOW — act this month',
      detail: 'This position is currently vacant. Contact the unit S1 directly to express interest',
      done: false, priority: 'required',
      timeline: 'This month',
    })
  } else if (pos.vacancyStatus === 'Projected Vacant') {
    items.push({
      label: 'Vacancy: projected to open — establish contact now',
      detail: `Position projected to become vacant${pos.projectedVacancyDate ? ' ' + pos.projectedVacancyDate : ' soon'}. Build a relationship with the unit before it opens`,
      done: false, priority: 'recommended',
      timeline: pos.projectedVacancyDate ?? '1–6 months',
    })
  } else {
    items.push({
      label: 'Vacancy: filled — monitor for future opening',
      detail: 'Position is currently filled. Add it to your watchlist and check back quarterly',
      done: false, priority: 'info',
    })
  }

  // ── Commute ───────────────────────────────────────────────────────────────
  const commute = getCommute(profile.homeCity, pos.city)
  if (commute) {
    const limits: Record<CommuteLimit, number> = {
      '30 Minutes': 30, '1 Hour': 60, '1.5 Hours': 90,
      '2 Hours': 120, '3 Hours': 180, 'No Limit': 9999,
    }
    const limit = limits[profile.maxCommute]
    const withinLimit = commute.minutes <= limit
    items.push({
      label: withinLimit
        ? `Commute: ${commute.minutes} min — within your preference ✓`
        : `Commute: ${commute.minutes} min — over your ${profile.maxCommute} preference`,
      detail: withinLimit
        ? `${commute.miles} mi from ${profile.homeCity} — fits your commute preference`
        : `${commute.miles} mi from ${profile.homeCity}. Consider adjusting your commute preference or relocating`,
      done: withinLimit, priority: 'info',
    })
  }

  return items
}
