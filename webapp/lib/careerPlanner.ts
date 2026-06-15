import type { SoldierProfile, Position, ScoredPosition, CareerCategory } from './types'
import { RANK_NUM, PROMOTION_GATES, scorePosition } from './scoring'

// ── Reverse rank lookup (number → grade string) ──────────────────────────────
const RANK_REVERSE: Record<number, string> = {}
for (const [grade, n] of Object.entries(RANK_NUM)) RANK_REVERSE[n] = grade

// Top grade reachable in each career category
const CATEGORY_CEILING: Record<CareerCategory, number> = {
  Enlisted: RANK_NUM.E9,   // 9
  Warrant:  RANK_NUM.W5,   // 14
  Officer:  RANK_NUM.O6,   // 20
}

// PME field → short course name
const PME_INFO: Record<string, string> = {
  ssd1Complete: 'SSD1', ssd2Complete: 'SSD2',
  blcComplete: 'BLC', alcComplete: 'ALC', slcComplete: 'SLC', smcComplete: 'SMC',
  bolcComplete: 'BOLC', cccComplete: 'CCC', ileComplete: 'ILE', sscComplete: 'SSC',
  wobcComplete: 'WOBC', woacComplete: 'WOAC', woileComplete: 'WOILE', wosseComplete: 'WOSSE',
}

const MAX_STEPS = 7            // total forward steps to plan (keeps lists sane)
const OPTIONS_PER_SLOT = 6     // candidate billets surfaced per grade slot
const MIN_DWELL = 1.5          // 18-month floor on time-in-position

// Selectable time-in-position values (years)
export const DWELL_CHOICES = [1.5, 2, 2.5, 3, 4, 5]

export type PlannerTrack = 'current' | 'ocs' | 'wocs'

export interface PlannerPme {
  field: string
  name: string
  required: boolean
  alreadyDone: boolean
}

export interface PlannerSlot {
  id: string                    // stable id
  kind: 'grade' | 'commission'
  category: CareerCategory      // category this slot belongs to
  grade: string                 // grade pinned at this slot (entry grade for commission)
  stepIndex: number
  leadYears: number             // time to reach FIRST slot from now (only used on slot 0)
  defaultDwellYears: number     // default time-in-position before moving on
  minDwellYears: number
  pme: PlannerPme[]
  options: ScoredPosition[]     // candidate billets at this grade (best first)
  suggestedPositionId: number | null
  commissionType?: 'OCS' | 'WOCS'
}

// ── Slot builders ─────────────────────────────────────────────────────────────
function pmeDone(profile: SoldierProfile, field: string): boolean {
  return Boolean((profile as unknown as Record<string, boolean>)[field])
}

function gradeName(grade: string): string {
  const names: Record<string, string> = {
    E5: 'Sergeant', E6: 'Staff Sergeant', E7: 'Sergeant First Class', E8: 'Master Sergeant / 1SG', E9: 'Sergeant Major / CSM',
    W1: 'Warrant Officer 1', W2: 'CW2', W3: 'CW3', W4: 'CW4', W5: 'CW5',
    O1: '2nd Lieutenant', O2: '1st Lieutenant', O3: 'Captain', O4: 'Major', O5: 'Lieutenant Colonel', O6: 'Colonel',
  }
  return names[grade] ?? grade
}

// Score a billet as if the soldier already held this grade/category — answers
// "which billets fit me when I'm a <grade>?" (the planning question).
function scoreForSlot(profile: SoldierProfile, pos: Position, category: CareerCategory, grade: string): ScoredPosition {
  const projected: SoldierProfile = { ...profile, careerCategory: category, rank: grade, targetRank: grade }
  return scorePosition(projected, pos)
}

function buildOptions(profile: SoldierProfile, positions: Position[], category: CareerCategory, grade: string): ScoredPosition[] {
  return positions
    .filter(p => p.careerCategory === category && p.grade === grade)
    .map(p => scoreForSlot(profile, p, category, grade))
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

function gradeSlot(profile: SoldierProfile, positions: Position[], category: CareerCategory, grade: string, stepIndex: number): PlannerSlot {
  const options = buildOptions(profile, positions, category, grade)
  return {
    id: `slot-${category[0]}-${grade}`,
    kind: 'grade',
    category,
    grade,
    stepIndex,
    leadYears: 0,
    defaultDwellYears: 2,
    minDwellYears: MIN_DWELL,
    pme: gatePme(profile, grade),
    options,
    suggestedPositionId: options[0]?.id ?? null,
  }
}

function commissionSlot(profile: SoldierProfile, positions: Position[], type: 'OCS' | 'WOCS', stepIndex: number): PlannerSlot {
  const category: CareerCategory = type === 'OCS' ? 'Officer' : 'Warrant'
  const entryGrade = type === 'OCS' ? 'O1' : 'W1'
  const options = buildOptions(profile, positions, category, entryGrade)
  const pme: PlannerPme[] = type === 'OCS'
    ? [{ field: 'bolcComplete', name: 'BOLC', required: true, alreadyDone: pmeDone(profile, 'bolcComplete') }]
    : [{ field: 'wobcComplete', name: 'WOBC', required: true, alreadyDone: pmeDone(profile, 'wobcComplete') }]
  return {
    id: `slot-commission-${type}`,
    kind: 'commission',
    commissionType: type,
    category,
    grade: entryGrade,
    stepIndex,
    leadYears: 0,
    defaultDwellYears: type === 'OCS' ? 2 : 1.5,
    minDwellYears: MIN_DWELL,
    pme,
    options,
    suggestedPositionId: options[0]?.id ?? null,
  }
}

// Set slot[0] lead time and default dwell per slot (lookahead at next grade's TIG)
function finalizeTiming(profile: SoldierProfile, slots: PlannerSlot[]): void {
  if (slots.length === 0) return
  const first = slots[0]
  if (first.kind === 'commission') {
    first.leadYears = 1.0 // packet + school before commissioning
  } else {
    const tig = PROMOTION_GATES[first.grade]?.typicalTig ?? 2
    first.leadYears = Math.max(0.5, tig - profile.timeInGrade)
  }
  for (let i = 0; i < slots.length; i++) {
    const next = slots[i + 1]
    const lookTig = next ? (PROMOTION_GATES[next.grade]?.typicalTig ?? 3) : 3
    slots[i].defaultDwellYears = Math.min(6, Math.max(MIN_DWELL, lookTig))
  }
}

// ── Main builder ──────────────────────────────────────────────────────────────
export function buildPlannerSlots(
  profile: SoldierProfile,
  positions: Position[],
  opts: { track?: PlannerTrack; commissionAfterGrade?: string } = {}
): PlannerSlot[] {
  const track: PlannerTrack = profile.careerCategory === 'Enlisted' ? (opts.track ?? 'current') : 'current'

  if (track === 'current') {
    return buildSameCategory(profile, positions)
  }

  // OCS / WOCS branch: enlisted progression → commission → new category
  const type: 'OCS' | 'WOCS' = track === 'ocs' ? 'OCS' : 'WOCS'
  const newCat: CareerCategory = type === 'OCS' ? 'Officer' : 'Warrant'
  const curNum = RANK_NUM[profile.rank] ?? 0
  const commissionAfterNum = RANK_NUM[opts.commissionAfterGrade ?? profile.rank] ?? curNum
  const slots: PlannerSlot[] = []
  let step = 0

  // Enlisted grades pursued before commissioning
  const eCeil = CATEGORY_CEILING.Enlisted
  for (let n = curNum + 1; n <= Math.min(commissionAfterNum, eCeil); n++) {
    const g = RANK_REVERSE[n]
    if (!g) continue
    slots.push(gradeSlot(profile, positions, 'Enlisted', g, step++))
    if (step >= MAX_STEPS) break
  }

  // Commissioning step
  if (step < MAX_STEPS) slots.push(commissionSlot(profile, positions, type, step++))

  // New-category grades after entry grade
  const entryNum = type === 'OCS' ? RANK_NUM.O1 : RANK_NUM.W1
  const newCeil = CATEGORY_CEILING[newCat]
  for (let n = entryNum + 1; n <= newCeil; n++) {
    if (step >= MAX_STEPS) break
    const g = RANK_REVERSE[n]
    if (!g) continue
    slots.push(gradeSlot(profile, positions, newCat, g, step++))
  }

  finalizeTiming(profile, slots)
  return slots
}

function buildSameCategory(profile: SoldierProfile, positions: Position[]): PlannerSlot[] {
  const curNum = RANK_NUM[profile.rank] ?? 0
  const targetNum = RANK_NUM[profile.targetRank] ?? curNum
  const ceiling = CATEGORY_CEILING[profile.careerCategory] ?? curNum

  const slots: PlannerSlot[] = []
  let roughYears = 0
  let step = 0

  for (let n = curNum + 1; n <= ceiling; n++) {
    const grade = RANK_REVERSE[n]
    if (!grade) continue
    const tig = PROMOTION_GATES[grade]?.typicalTig ?? 2
    roughYears += step === 0 ? Math.max(0.5, tig - profile.timeInGrade) : tig
    const roughTis = profile.yearsOfService + roughYears

    slots.push(gradeSlot(profile, positions, profile.careerCategory, grade, step++))

    if (n >= targetNum && roughTis >= 20) break
    if (step >= MAX_STEPS) break
  }

  finalizeTiming(profile, slots)
  return slots
}

// ── Timeline computation (responds to user-chosen dwell times) ────────────────
export function computeTimeline(
  profile: SoldierProfile,
  slots: PlannerSlot[],
  dwell: Record<string, number>
): Record<string, { enterYears: number; tisYears: number }> {
  const res: Record<string, { enterYears: number; tisYears: number }> = {}
  if (slots.length === 0) return res
  const r1 = (x: number) => Math.round(x * 10) / 10
  let acc = slots[0].leadYears
  for (let i = 0; i < slots.length; i++) {
    if (i > 0) {
      const prev = slots[i - 1]
      acc += dwell[prev.id] ?? prev.defaultDwellYears
    }
    res[slots[i].id] = { enterYears: r1(acc), tisYears: r1(profile.yearsOfService + acc) }
  }
  return res
}

export function dwellFor(slot: PlannerSlot, dwell: Record<string, number>): number {
  return dwell[slot.id] ?? slot.defaultDwellYears
}

// Resolve the position chosen for a slot (or the suggested default)
export function getSlotSelection(slot: PlannerSlot, selections: Record<string, number>): ScoredPosition | null {
  const chosenId = selections[slot.id]
  if (chosenId != null) {
    const found = slot.options.find(o => o.id === chosenId)
    if (found) return found
  }
  return slot.options.find(o => o.id === slot.suggestedPositionId) ?? slot.options[0] ?? null
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
}

export function summarizePlan(
  profile: SoldierProfile,
  slots: PlannerSlot[],
  dwell: Record<string, number>
): PlanSummary {
  const currentYear = new Date().getFullYear()
  const timeline = computeTimeline(profile, slots, dwell)
  const last = slots[slots.length - 1]
  const pmeRemaining = new Set<string>()
  let commissions = false
  for (const slot of slots) {
    if (slot.kind === 'commission') commissions = true
    for (const p of slot.pme) if (!p.alreadyDone) pmeRemaining.add(p.name)
  }
  const lastTl = last ? timeline[last.id] : undefined
  const tisAtEnd = lastTl ? lastTl.tisYears + dwellFor(last, dwell) : profile.yearsOfService
  return {
    startGrade: profile.rank,
    endGrade: last?.grade ?? profile.rank,
    endCategory: last?.category ?? profile.careerCategory,
    totalYears: lastTl?.enterYears ?? 0,
    retirementYear: currentYear + Math.max(0, 20 - profile.yearsOfService),
    pmeRemaining: [...pmeRemaining],
    reaches20: tisAtEnd >= 20,
    commissions,
  }
}

// Compact text summary of the soldier's self-built plan for the AI context
export function summarizePlanForAI(
  profile: SoldierProfile,
  slots: PlannerSlot[],
  selections: Record<string, number>,
  dwell: Record<string, number>
): string {
  if (slots.length === 0) return ''
  const currentYear = new Date().getFullYear()
  const timeline = computeTimeline(profile, slots, dwell)
  const lines: string[] = []
  lines.push(`Now: ${profile.rank} (${profile.yearsOfService} yrs service, ${profile.timeInGrade} yrs TIG)`)
  for (const slot of slots) {
    const tl = timeline[slot.id]
    const estYear = currentYear + Math.round(tl?.enterYears ?? 0)
    const tis = Math.round(tl?.tisYears ?? 0)
    const yearsInPos = dwellFor(slot, dwell)
    const pmeNeeded = slot.pme.filter(p => !p.alreadyDone).map(p => p.name)
    const pmeStr = pmeNeeded.length ? ` | complete first: ${pmeNeeded.join(', ')}` : ''
    if (slot.kind === 'commission') {
      lines.push(`~${estYear} (TIS ~${tis}yr): COMMISSION via ${slot.commissionType} → ${slot.category} track, pin ${slot.grade}${pmeStr}`)
    }
    const sel = getSlotSelection(slot, selections)
    const posStr = sel
      ? `${sel.dutyTitle} @ ${sel.unit}, ${sel.city} (${sel.statusType}, fit ${sel.totalScore}/100${sel.commuteMins >= 0 ? `, ${sel.commuteMins}min` : ''})`
      : 'no specific billet chosen'
    const label = slot.kind === 'commission' ? `serve as ${slot.grade}` : `${slot.grade}`
    lines.push(`~${estYear} (TIS ~${tis}yr, plan to stay ~${yearsInPos}yr): ${label} — ${posStr}${slot.kind === 'grade' ? pmeStr : ''}`)
  }
  return lines.join('\n')
}
