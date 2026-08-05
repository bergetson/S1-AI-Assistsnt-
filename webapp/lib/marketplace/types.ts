// ── Talent marketplace ────────────────────────────────────────────────────────
// Prototype workflow only. Statuses here describe movement through a
// demonstration process; they never mirror or update an official personnel
// system, and the UI must say so wherever a status is shown.

export type CycleStatus = 'Draft' | 'Open' | 'Closed' | 'Under Review' | 'Decision' | 'Complete'

export interface MarketplaceCycle {
  id: string
  name: string
  description?: string
  status: CycleStatus
  openDate: string
  closeDate: string
  reportWindow?: string
  /** Position ids from lib/data/positions.ts. */
  vacancyIds: number[]
  createdBy?: string
}

export type ApplicationStatus =
  | 'Published'
  | 'Interested'
  | 'Applied'
  | 'Commander Review'
  | 'Talent Manager Review'
  | 'Selection Pending'
  | 'Selected'
  | 'Not Selected'
  | 'Assignment Action'
  | 'Complete'
  | 'Withdrawn'

/** Legal forward transitions. Anything else is rejected by `canTransition`. */
export const STATUS_FLOW: Record<ApplicationStatus, ApplicationStatus[]> = {
  Published: ['Interested', 'Withdrawn'],
  Interested: ['Applied', 'Withdrawn'],
  Applied: ['Commander Review', 'Withdrawn'],
  'Commander Review': ['Talent Manager Review', 'Not Selected', 'Withdrawn'],
  'Talent Manager Review': ['Selection Pending', 'Not Selected', 'Withdrawn'],
  'Selection Pending': ['Selected', 'Not Selected'],
  Selected: ['Assignment Action'],
  'Not Selected': ['Complete'],
  'Assignment Action': ['Complete'],
  Complete: [],
  Withdrawn: [],
}

export interface StatusHistoryEntry {
  status: ApplicationStatus
  at: string
  by?: string
  note?: string
}

export interface CommanderEndorsement {
  decision: 'Endorsed' | 'Endorsed with Comment' | 'Not Endorsed'
  comment?: string
  successionImpact?: 'None' | 'Manageable' | 'Significant' | 'Critical'
  replacementNeeded?: boolean
  at: string
  by?: string
}

export interface MarketplaceApplication {
  id: string
  cycleId: string
  soldierId: string
  positionId: number
  status: ApplicationStatus
  /** Soldier's ranked preference among their own applications; 1 is highest. */
  preferenceRank?: number
  statementOfInterest?: string
  willingToRelocate?: boolean
  desiredReportWindow?: string
  endorsement?: CommanderEndorsement
  talentManagerNote?: string
  developmentFeedback?: string
  history: StatusHistoryEntry[]
  createdAt: string
  updatedAt: string
}

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return STATUS_FLOW[from]?.includes(to) ?? false
}

/** Terminal states — nothing moves out of these. */
export function isTerminal(status: ApplicationStatus): boolean {
  return STATUS_FLOW[status].length === 0
}
