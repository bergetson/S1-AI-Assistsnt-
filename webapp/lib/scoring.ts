import type { SoldierProfile, Position, ScoredPosition, MatchLabel, CommuteLimit } from './types'
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
  if (posNum === targetNum) return 35   // sweet spot
  if (posNum === curNum)    return 25   // current grade (lateral move)
  if (posNum === targetNum + 1) return 15  // one above target (stretch)
  if (posNum === curNum + 1)    return 20  // one grade up (natural next step)
  return 0
}

function mosScore(profile: SoldierProfile, pos: Position): number {
  if (pos.mos === profile.mos || pos.mos === profile.secondaryMos) return 30
  if (profile.wantToSwitchMos === 'Yes' && pos.mos === profile.targetMos) return 25
  if (profile.wantToSwitchMos !== 'No') return 8
  // Related MOS check (same first two digits = related career field)
  if (pos.mos.slice(0, 2) === profile.mos.slice(0, 2)) return 12
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
  const gs = gradeScore(profile, pos)
  const ms = mosScore(profile, pos)
  const cs = commuteScore(profile, pos)
  const gls = goalScore(profile, pos)
  const ss = statusScore(profile, pos)
  const total = gs + ms + cs + gls + ss
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

export function scoreAllPositions(profile: SoldierProfile, positions: Position[]): ScoredPosition[] {
  return positions
    .map(p => scorePosition(profile, p))
    .sort((a, b) => b.totalScore - a.totalScore)
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
