import { asOfDate } from '../asOf'
// ARNG promotion board schedule (approximate — verify with NGB Portal each year)
// Dates represent typical convene months based on historical ARNG patterns.

export interface ArngBoard {
  grade: string          // target promotion grade
  name: string
  typicalMonth: number   // 1-12; approximate convene month
  cutoffOffsetDays: number // days before convene that records must be complete
  notes: string
}

export const ARNG_BOARDS: ArngBoard[] = [
  {
    grade: 'E7', name: 'SFC Promotion Board', typicalMonth: 3, cutoffOffsetDays: 60,
    notes: 'NGB centralized; no points — full record review. SLC completion is a strong discriminator.',
  },
  {
    grade: 'E8', name: 'MSG Promotion Board', typicalMonth: 6, cutoffOffsetDays: 60,
    notes: 'NGB centralized; record-based selection. SLC completion strongly valued.',
  },
  {
    grade: 'E9', name: 'SGM/CSM Promotion Board', typicalMonth: 9, cutoffOffsetDays: 90,
    notes: 'SMC (Fort Bliss, 10 months) is required — not waiverable. <5% selection rate.',
  },
  {
    grade: 'O4', name: 'MAJ Promotion Board', typicalMonth: 9, cutoffOffsetDays: 90,
    notes: 'DA centralized; ~80% ARNG selection. Min 3yr TIG as CPT. CCC is a discriminator (not a gate).',
  },
  {
    grade: 'O5', name: 'LTC Promotion Board', typicalMonth: 11, cutoffOffsetDays: 90,
    notes: 'DA centralized; ILE required (must complete CCC first). Command time as MAJ is critical.',
  },
  {
    grade: 'O6', name: 'COL Promotion Board', typicalMonth: 2, cutoffOffsetDays: 90,
    notes: 'DA centralized; very competitive (~50–60% ARNG). ILE required.',
  },
  {
    grade: 'W3', name: 'CW3 Promotion Board', typicalMonth: 4, cutoffOffsetDays: 60,
    notes: 'DA board; min 4yr TIG as CW2; WOAC required.',
  },
  {
    grade: 'W4', name: 'CW4 Promotion Board', typicalMonth: 10, cutoffOffsetDays: 60,
    notes: 'DA board; min 5yr TIG as CW3; WOILE valued for some specialties.',
  },
]

export function getNextBoardDate(grade: string): {
  convene: Date
  cutoff: Date
  monthsAway: number
} | null {
  const board = ARNG_BOARDS.find(b => b.grade === grade)
  if (!board) return null

  // Counted from the extract date, not from today: a static export renders this
  // into prerendered HTML, so a live clock would disagree with itself after
  // hydration, and board windows are only meaningful against the data's own date.
  const now = asOfDate()
  let convene = new Date(now.getFullYear(), board.typicalMonth - 1, 15)
  if (convene <= now) {
    convene = new Date(now.getFullYear() + 1, board.typicalMonth - 1, 15)
  }

  const cutoff = new Date(convene)
  cutoff.setDate(cutoff.getDate() - board.cutoffOffsetDays)

  const monthsAway =
    (convene.getFullYear() - now.getFullYear()) * 12 +
    (convene.getMonth() - now.getMonth())

  return { convene, cutoff, monthsAway }
}
