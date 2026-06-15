import type { SoldierProfile, Position, ScoredPosition, CareerCategory } from './types'
import { RANK_NUM, PROMOTION_GATES, scorePosition } from './scoring'

// ── Reverse rank lookup (number → grade string) ──────────────────────────────
const RANK_REVERSE: Record<number, string> = {}
for (const [grade, n] of Object.entries(RANK_NUM)) RANK_REVERSE[n] = grade

const CATEGORY_CEILING: Record<CareerCategory, number> = {
  Enlisted: RANK_NUM.E9,
  Warrant:  RANK_NUM.W5,
  Officer:  RANK_NUM.O6,
}

const PME_INFO: Record<string, string> = {
  ssd1Complete: 'SSD1', ssd2Complete: 'SSD2',
  blcComplete: 'BLC', alcComplete: 'ALC', slcComplete: 'SLC', smcComplete: 'SMC',
  bolcComplete: 'BOLC', cccComplete: 'CCC', ileComplete: 'ILE', sscComplete: 'SSC',
  wobcComplete: 'WOBC', woacComplete: 'WOAC', woileComplete: 'WOILE', wosseComplete: 'WOSSE',
}

// Typical role + focus per grade (educational context, formerly the Timeline page)
const ROLE_INFO: Record<string, { name: string; role: string; focus: string }> = {
  E5: { name: 'Sergeant (SGT)', role: 'Team Leader / Section NCOIC', focus: 'Lead a team, complete BLC, master NCO fundamentals.' },
  E6: { name: 'Staff Sergeant (SSG)', role: 'Squad Leader / Staff NCOIC', focus: 'Hold a KD squad leader role; complete ALC; pursue AGR.' },
  E7: { name: 'Sergeant First Class (SFC)', role: 'Platoon Sergeant / NCOIC', focus: 'Serve as PSG; complete SLC; mentor junior NCOs.' },
  E8: { name: 'Master Sergeant / 1SG', role: '1SG (command) or MSG (staff)', focus: 'Compete for 1SG or a senior staff NCOIC role.' },
  E9: { name: 'Sergeant Major / CSM', role: 'CSM or SGM (BN / State HQ)', focus: 'Senior enlisted leader; capstone and legacy.' },
  W1: { name: 'Warrant Officer 1 (WO1)', role: 'Technical Expert / Advisor', focus: 'Complete WOBC; build technical depth.' },
  W2: { name: 'Chief Warrant Officer 2 (CW2)', role: 'Technical Specialist / Section OIC', focus: 'Complete WOAC; section OIC; certifications.' },
  W3: { name: 'Chief Warrant Officer 3 (CW3)', role: 'Senior Technical Advisor', focus: 'BN-level integrator; mentor junior warrants.' },
  W4: { name: 'Chief Warrant Officer 4 (CW4)', role: 'Senior Technical Expert', focus: 'BDE/HQ technical authority; program roles.' },
  W5: { name: 'Chief Warrant Officer 5 (CW5)', role: 'Master Technical Expert', focus: 'State technical authority / proponent.' },
  O1: { name: '2nd Lieutenant (2LT)', role: 'Platoon Leader', focus: 'Complete BOLC; lead a platoon.' },
  O2: { name: '1st Lieutenant (1LT)', role: 'Platoon Leader / XO', focus: 'Company XO or specialty platoon; build OERs.' },
  O3: { name: 'Captain (CPT)', role: 'Company Commander / Primary Staff', focus: 'Company command + KD staff (S3/S4/S1); complete CCC.' },
  O4: { name: 'Major (MAJ)', role: 'BN XO / Brigade Primary Staff', focus: 'BN XO or BDE S-staff (S3/S4/S1); complete ILE.' },
  O5: { name: 'Lieutenant Colonel (LTC)', role: 'Battalion Commander / G-Staff Director', focus: 'Compete for BN command; HQ director roles.' },
  O6: { name: 'Colonel (COL)', role: 'Brigade Commander / State HQ', focus: 'Brigade command or senior state HQ leadership.' },
}

const MAX_PHASES = 7
const OPTIONS_PER_SLOT = 8
const MIN_DWELL = 1.5

export const DWELL_CHOICES = [1.5, 2, 3, 4, 5, 6, 7, 8]

export type PlannerTrack = 'current' | 'ocs' | 'wocs'

export interface PlannerPme {
  field: string
  name: string
  required: boolean
  alreadyDone: boolean
}

// One job the soldier plans to hold (a position + how long they stay)
export interface Pick {
  positionId: number | null
  dwellYears: number
}

export interface PlannerPhase {
  id: string
  kind: 'grade' | 'commission'
  category: CareerCategory
  grade: string
  gradeName: string
  role: string
  focus: string
  stepIndex: number
  leadYears: number          // time to reach FIRST phase from now (only used on phase 0)
  nextTypicalTig: number     // typical years at THIS grade before the next board (0 if none)
  nextMinTig: number         // minimum years at this grade before next board (0 if none)
  defaultDwellYears: number
  minDwellYears: number
  pme: PlannerPme[]
  options: ScoredPosition[]
  suggestedPositionId: number | null
  commissionType?: 'OCS' | 'WOCS'
  isCurrent?: boolean        // true only for the soldier's current grade phase
}

// ── Builders ──────────────────────────────────────────────────────────────────
function pmeDone(profile: SoldierProfile, field: string): boolean {
  return Boolean((profile as unknown as Record<string, boolean>)[field])
}

function roleInfo(grade: string): { name: string; role: string; focus: string } {
  return ROLE_INFO[grade] ?? { name: grade, role: '', focus: '' }
}

// Score a billet as if the soldier already held this grade/category.
function scoreForGrade(profile: SoldierProfile, pos: Position, category: CareerCategory, grade: string): ScoredPosition {
  const projected: SoldierProfile = { ...profile, careerCategory: category, rank: grade, targetRank: grade }
  return scorePosition(projected, pos)
}

function buildOptions(profile: SoldierProfile, positions: Position[], category: CareerCategory, grade: string): ScoredPosition[] {
  return positions
    .filter(p => p.careerCategory === category && p.grade === grade)
    .map(p => scoreForGrade(profile, p, category, grade))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, OPTIONS_PER_SLOT)
}

function gatePme(profile: SoldierProfile, grade: string): PlannerPme[] {
  const gate = PROMOTION_GATES[grade]
  const pme: PlannerPme[] = []
  if (gate) {
    for (const f of gate.pmeRequired) pme.push({ field: f, name: PME_INFO[f] ?? f, required: true, alreadyDone: pmeDone(profile, f) })
    for (const f of gate.pmeAdvisory) pme.push({ field: f, name: PME_INFO[f] ?? f, required: false, alreadyDone: pmeDone(profile, f) })
  }
  return pme
}

function gradePhase(profile: SoldierProfile, positions: Position[], category: CareerCategory, grade: string, stepIndex: number): PlannerPhase {
  const options = buildOptions(profile, positions, category, grade)
  const info = roleInfo(grade)
  return {
    id: `phase-${category[0]}-${grade}`,
    kind: 'grade',
    category,
    grade,
    gradeName: info.name,
    role: info.role,
    focus: info.focus,
    stepIndex,
    leadYears: 0,
    nextTypicalTig: 0,
    nextMinTig: 0,
    defaultDwellYears: 2,
    minDwellYears: MIN_DWELL,
    pme: gatePme(profile, grade),
    options,
    suggestedPositionId: options[0]?.id ?? null,
  }
}

function commissionPhase(profile: SoldierProfile, positions: Position[], type: 'OCS' | 'WOCS', stepIndex: number): PlannerPhase {
  const category: CareerCategory = type === 'OCS' ? 'Officer' : 'Warrant'
  const entryGrade = type === 'OCS' ? 'O1' : 'W1'
  const options = buildOptions(profile, positions, category, entryGrade)
  const info = roleInfo(entryGrade)
  const pme: PlannerPme[] = type === 'OCS'
    ? [{ field: 'bolcComplete', name: 'BOLC', required: true, alreadyDone: pmeDone(profile, 'bolcComplete') }]
    : [{ field: 'wobcComplete', name: 'WOBC', required: true, alreadyDone: pmeDone(profile, 'wobcComplete') }]
  return {
    id: `phase-commission-${type}`,
    kind: 'commission',
    commissionType: type,
    category,
    grade: entryGrade,
    gradeName: info.name,
    role: info.role,
    focus: type === 'OCS'
      ? 'Attend OCS, commission, complete BOLC, then lead a platoon.'
      : 'Attend WOCS, appoint as WO1, complete WOBC, build technical depth.',
    stepIndex,
    leadYears: 0,
    nextTypicalTig: 0,
    nextMinTig: 0,
    defaultDwellYears: type === 'OCS' ? 2 : 1.5,
    minDwellYears: MIN_DWELL,
    pme,
    options,
    suggestedPositionId: options[0]?.id ?? null,
  }
}

// Builds the interactive phase for the soldier's current grade (the "NOW" phase).
function buildCurrentPhase(profile: SoldierProfile, positions: Position[]): PlannerPhase {
  const grade = profile.rank
  const category = profile.careerCategory
  const options = buildOptions(profile, positions, category, grade)
  const info = roleInfo(grade)
  const nextGradeNum = (RANK_NUM[grade] ?? 0) + 1
  const nextGrade = RANK_REVERSE[nextGradeNum]
  const nextGate = nextGrade ? PROMOTION_GATES[nextGrade] : undefined
  // Show REMAINING time at this grade (subtract time already served)
  const remainingTypical = nextGate ? Math.max(0, nextGate.typicalTig - profile.timeInGrade) : 3
  const remainingMin = nextGate ? Math.max(0, nextGate.minTig - profile.timeInGrade) : 0
  return {
    id: `phase-current-${grade}`,
    kind: 'grade',
    category,
    grade,
    gradeName: info.name,
    role: info.role,
    focus: info.focus,
    stepIndex: 0,
    leadYears: 0,
    nextTypicalTig: remainingTypical,
    nextMinTig: remainingMin,
    defaultDwellYears: Math.min(8, Math.max(MIN_DWELL, remainingTypical)),
    minDwellYears: MIN_DWELL,
    pme: gatePme(profile, grade),
    options,
    suggestedPositionId: options[0]?.id ?? null,
    isCurrent: true,
  }
}

function finalizeTiming(profile: SoldierProfile, phases: PlannerPhase[]): void {
  if (phases.length === 0) return
  const first = phases[0]
  if (first.isCurrent) {
    first.leadYears = 0  // already at this grade
    // nextTypicalTig/nextMinTig/defaultDwellYears already set in buildCurrentPhase
  } else if (first.kind === 'commission') {
    first.leadYears = 1.0
  } else {
    const tig = PROMOTION_GATES[first.grade]?.typicalTig ?? 2
    first.leadYears = Math.max(0.5, tig - profile.timeInGrade)
  }
  for (let i = 0; i < phases.length; i++) {
    if (phases[i].isCurrent) continue  // already initialized correctly
    const next = phases[i + 1]
    const nextGate = next ? PROMOTION_GATES[next.grade] : undefined
    phases[i].nextTypicalTig = nextGate?.typicalTig ?? 0
    phases[i].nextMinTig = nextGate?.minTig ?? 0
    // Default a single starting job to the realistic time-at-grade (typical TIG to
    // the next board). The user can split this across multiple jobs or shorten it.
    const base = nextGate?.typicalTig ?? (next ? 2 : 3)
    phases[i].defaultDwellYears = Math.min(8, Math.max(MIN_DWELL, base))
  }
}

// ── Main builder ──────────────────────────────────────────────────────────────
export function buildPlannerPhases(
  profile: SoldierProfile,
  positions: Position[],
  opts: { track?: PlannerTrack; commissionAfterGrade?: string } = {}
): PlannerPhase[] {
  const track: PlannerTrack = profile.careerCategory === 'Enlisted' ? (opts.track ?? 'current') : 'current'

  if (track === 'current') return buildSameCategory(profile, positions)

  const type: 'OCS' | 'WOCS' = track === 'ocs' ? 'OCS' : 'WOCS'
  const newCat: CareerCategory = type === 'OCS' ? 'Officer' : 'Warrant'
  const curNum = RANK_NUM[profile.rank] ?? 0
  const commissionAfterNum = RANK_NUM[opts.commissionAfterGrade ?? profile.rank] ?? curNum
  const phases: PlannerPhase[] = [buildCurrentPhase(profile, positions)]
  let step = 1

  const eCeil = CATEGORY_CEILING.Enlisted
  for (let n = curNum + 1; n <= Math.min(commissionAfterNum, eCeil); n++) {
    const g = RANK_REVERSE[n]
    if (!g) continue
    phases.push(gradePhase(profile, positions, 'Enlisted', g, step++))
    if (step >= MAX_PHASES) break
  }

  if (step < MAX_PHASES) phases.push(commissionPhase(profile, positions, type, step++))

  const entryNum = type === 'OCS' ? RANK_NUM.O1 : RANK_NUM.W1
  const newCeil = CATEGORY_CEILING[newCat]
  for (let n = entryNum + 1; n <= newCeil; n++) {
    if (step >= MAX_PHASES) break
    const g = RANK_REVERSE[n]
    if (!g) continue
    phases.push(gradePhase(profile, positions, newCat, g, step++))
  }

  finalizeTiming(profile, phases)
  return phases
}

function buildSameCategory(profile: SoldierProfile, positions: Position[]): PlannerPhase[] {
  const curNum = RANK_NUM[profile.rank] ?? 0
  const targetNum = RANK_NUM[profile.targetRank] ?? curNum
  const ceiling = CATEGORY_CEILING[profile.careerCategory] ?? curNum

  // Always start with the current grade so the soldier can plan positions they'll
  // hold NOW before earning the next promotion.
  const phases: PlannerPhase[] = [buildCurrentPhase(profile, positions)]
  let roughYears = 0
  let step = 1  // current-grade phase takes stepIndex 0

  for (let n = curNum + 1; n <= ceiling; n++) {
    const grade = RANK_REVERSE[n]
    if (!grade) continue
    const tig = PROMOTION_GATES[grade]?.typicalTig ?? 2
    roughYears += step === 1 ? Math.max(0.5, tig - profile.timeInGrade) : tig
    const roughTis = profile.yearsOfService + roughYears

    phases.push(gradePhase(profile, positions, profile.careerCategory, grade, step++))

    if (n >= targetNum && roughTis >= 20) break
    if (step >= MAX_PHASES) break
  }

  finalizeTiming(profile, phases)
  return phases
}

// ── Picks (positions chosen per phase) ────────────────────────────────────────
export function getPhasePicks(phase: PlannerPhase, stored: Record<string, Pick[]>): Pick[] {
  const s = stored[phase.id]
  if (s && s.length > 0) return s
  return [{ positionId: phase.suggestedPositionId, dwellYears: phase.defaultDwellYears }]
}

export function resolvePosition(phase: PlannerPhase, positionId: number | null): ScoredPosition | null {
  if (positionId == null) return null
  return phase.options.find(o => o.id === positionId) ?? null
}

// ── Timeline (responds to picks + dwell) ──────────────────────────────────────
export interface PhaseTiming {
  enterYears: number
  tisYears: number
  totalDwell: number
  stints: { enterYears: number; tisYears: number; dwellYears: number; positionId: number | null }[]
}

export function computeTimeline(
  profile: SoldierProfile,
  phases: PlannerPhase[],
  stored: Record<string, Pick[]>
): Record<string, PhaseTiming> {
  const res: Record<string, PhaseTiming> = {}
  if (phases.length === 0) return res
  const r1 = (x: number) => Math.round(x * 10) / 10
  let clock = phases[0].leadYears
  for (const phase of phases) {
    const phaseEnter = clock
    const picks = getPhasePicks(phase, stored)
    const stints: PhaseTiming['stints'] = []
    let total = 0
    for (const pick of picks) {
      stints.push({ enterYears: r1(clock), tisYears: r1(profile.yearsOfService + clock), dwellYears: pick.dwellYears, positionId: pick.positionId })
      clock += pick.dwellYears
      total += pick.dwellYears
    }
    res[phase.id] = {
      enterYears: r1(phaseEnter),
      tisYears: r1(profile.yearsOfService + phaseEnter),
      totalDwell: r1(total),
      stints,
    }
  }
  return res
}

// ── Summaries ─────────────────────────────────────────────────────────────────
export interface PlanSummary {
  startGrade: string
  endGrade: string
  endCategory: CareerCategory
  totalYears: number
  retirementYear: number
  pmeRemaining: string[]
  reaches20: boolean
  commissions: boolean
  totalPositions: number
}

export function summarizePlan(
  profile: SoldierProfile,
  phases: PlannerPhase[],
  stored: Record<string, Pick[]>
): PlanSummary {
  const currentYear = new Date().getFullYear()
  const timeline = computeTimeline(profile, phases, stored)
  const last = phases[phases.length - 1]
  const pmeRemaining = new Set<string>()
  let commissions = false
  let totalPositions = 0
  for (const phase of phases) {
    if (phase.kind === 'commission') commissions = true
    for (const p of phase.pme) if (!p.alreadyDone) pmeRemaining.add(p.name)
    totalPositions += getPhasePicks(phase, stored).filter(p => p.positionId != null).length
  }
  const lastTl = last ? timeline[last.id] : undefined
  const finalClock = lastTl ? lastTl.enterYears + lastTl.totalDwell : 0
  return {
    startGrade: profile.rank,
    endGrade: last?.grade ?? profile.rank,
    endCategory: last?.category ?? profile.careerCategory,
    totalYears: Math.round(finalClock * 10) / 10,
    retirementYear: currentYear + Math.max(0, 20 - profile.yearsOfService),
    pmeRemaining: [...pmeRemaining],
    reaches20: profile.yearsOfService + finalClock >= 20,
    commissions,
    totalPositions,
  }
}

export function summarizePlanForAI(
  profile: SoldierProfile,
  phases: PlannerPhase[],
  stored: Record<string, Pick[]>
): string {
  if (phases.length === 0) return ''
  const currentYear = new Date().getFullYear()
  const timeline = computeTimeline(profile, phases, stored)
  const lines: string[] = []
  lines.push(`Now: ${profile.rank} (${profile.yearsOfService} yrs service, ${profile.timeInGrade} yrs TIG)`)
  for (const phase of phases) {
    const tl = timeline[phase.id]
    const enterYear = currentYear + Math.round(tl?.enterYears ?? 0)
    const tis = Math.round(tl?.tisYears ?? 0)
    if (phase.kind === 'commission') {
      lines.push(`~${enterYear} (TIS ~${tis}yr): COMMISSION via ${phase.commissionType} → ${phase.category} track, pin ${phase.grade}`)
    }
    const pmeNeeded = phase.pme.filter(p => !p.alreadyDone).map(p => p.name)
    const pmeStr = pmeNeeded.length ? ` [complete first: ${pmeNeeded.join(', ')}]` : ''
    lines.push(`${phase.grade} — ${phase.gradeName}${pmeStr}:`)
    const picks = getPhasePicks(phase, stored)
    picks.forEach((pick, i) => {
      const pos = resolvePosition(phase, pick.positionId)
      const yr = currentYear + Math.round(tl?.stints[i]?.enterYears ?? 0)
      const posStr = pos
        ? `${pos.dutyTitle} @ ${pos.unit}, ${pos.city} (${pos.statusType}, fit ${pos.totalScore}/100${pos.commuteMins >= 0 ? `, ${pos.commuteMins}min` : ''})`
        : 'open billet (TBD)'
      lines.push(`   ~${yr}: ${posStr} — stay ~${pick.dwellYears}yr`)
    })
  }
  return lines.join('\n')
}
