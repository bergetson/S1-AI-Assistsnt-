import type { SoldierProfile, Position, ScoredPosition, MatchLabel, CommuteLimit, CareerCategory } from './types'
import { getCommute } from './data/cities'

const RANK_NUM: Record<string, number> = {
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

function gradeScore(profile: SoldierProfile, pos: Position): number {
  if (pos.careerCategory !== profile.careerCategory) return 0
  const posNum    = RANK_NUM[pos.grade] ?? 0
  const curNum    = RANK_NUM[profile.rank] ?? 0
  const targetNum = RANK_NUM[profile.targetRank] ?? 0
  if (posNum === 0) return 0
  if (posNum === targetNum)     return 35  // sweet spot — target grade
  if (posNum === curNum + 1)    return 28  // natural next step up
  if (posNum === curNum)        return 20  // lateral — same grade
  if (posNum === targetNum + 1) return 12  // one above target — real stretch
  // Promotable soldiers can compete for one grade higher
  if (profile.isPromotable && posNum === curNum + 1) return 28
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
  // Infantry cross-match: 11A/11B/11C are all Infantry branch
  const INF_MOS = new Set(['11A', '11B', '11C', '11Z'])
  if (INF_MOS.has(pos.mos) && INF_MOS.has(profile.mos)) return 20
  return 0
}

function commuteScore(profile: SoldierProfile, pos: Position): number {
  const commute = getCommute(profile.homeCity, pos.city)
  if (!commute) return 5  // unknown — neutral
  const mins  = commute.minutes
  const limit = COMMUTE_LIMIT_MINS[profile.maxCommute]
  if (mins === 0)         return 15
  if (mins <= limit)      return 15
  if (mins <= limit * 1.25) return 8
  if (mins <= limit * 1.5)  return 3
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
    if (pos.positionType === 'Leadership' || pos.isCommandOrKD) return 12
    if (pos.positionType === 'Staff') return 9
    return 7
  }
  if (primaryGoal === 'Pursue Senior Leader Path')
    return pos.positionType === 'Command' ? 15 : pos.isCommandOrKD ? 12 : 7
  if (primaryGoal === 'Switch MOS/Branch')
    return pos.mos === profile.targetMos ? 15 : 8
  if (primaryGoal === 'Broaden Experience')
    return pos.positionType === 'Broadening' || pos.city !== profile.unitCity ? 12 : 7
  // Check desired position type
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
        : 'Requires Officer Candidate School (OCS) commissioning',
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
  if (profile.careerCategory === 'Enlisted') {
    if (!profile.blcComplete) gaps.push('BLC — Required before E5 promotion board')
    if (!profile.alcComplete) gaps.push('ALC — Required before E6 promotion board')
    if (!profile.slcComplete && RANK_NUM[profile.rank] >= 6) gaps.push('SLC — Required for E7 promotion')
    if (!profile.ssd1Complete) gaps.push('SSD1 — Complete before BLC enrollment')
  }
  if (profile.careerCategory === 'Officer') {
    if (!profile.bolcComplete) gaps.push('BOLC — Required within 12 months of commissioning')
    if (!profile.cccComplete && RANK_NUM[profile.rank] >= 17) gaps.push("CCC — Required before MAJ board")
    if (!profile.ileComplete && RANK_NUM[profile.rank] >= 18) gaps.push('ILE — Required for LTC promotion')
  }
  if (profile.careerCategory === 'Warrant') {
    if (!profile.wobcComplete) gaps.push('WOBC — Required within 24 months of appointment')
    if (!profile.woacComplete && RANK_NUM[profile.rank] >= 11) gaps.push('WOAC — Required for CW3 promotion')
  }
  return gaps
}
