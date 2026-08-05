import type { SkillProficiency, VerificationStatus } from '../civilian/types'
import type { ImpactLevel } from '../communityImpact/types'

export interface CapabilityRequirement {
  id: string
  /** Civilian taxonomy category, when this is a civilian capability. */
  category?: string
  subcategory?: string
  /** Military MOS/AOC prefix, when this is a military requirement. */
  mos?: string
  label: string
  quantity: number
  minProficiency?: SkillProficiency
  minVerification?: VerificationStatus
  requiredCredential?: string
  /** Nice to have rather than required — unmet desired items do not block. */
  desired?: boolean
}

export type SourcingPreference = 'Local' | 'Statewide' | 'Unit'

export interface MissionDefinition {
  id: string
  name: string
  description?: string
  missionType: string
  location: string
  startDate?: string
  durationDays: number
  noticeDays: number
  teamSize?: number
  requirements: CapabilityRequirement[]
  /** Constraints applied to the whole candidate pool. */
  constraints: {
    uics?: string[]
    maxTravelMiles?: number
    componentStatus?: string
    requireVerifiedSkills?: boolean
    requireWillingness?: boolean
    minRank?: string
    maxRank?: string
    sourcing?: SourcingPreference
  }
  objectives: {
    minimizeCommunityImpact: boolean
    minimizeUnitDisruption: boolean
    preserveSuccessionDepth: boolean
  }
}

export interface CandidateMatch {
  soldierId: string
  displayName: string
  anonId: string
  rank: string
  mos: string
  unit: string
  uic: string
  city: string
  /** Requirement ids this person can satisfy. */
  satisfies: string[]
  /** 0-100, deterministic. Explains sorting only — never the sole output. */
  fitScore: number
  factors: Array<{ label: string; points: number; max: number; detail: string }>
  verification: VerificationStatus
  willingness: 'Yes' | 'No' | 'Ask Me'
  distanceMiles: number | null
  communityImpact: ImpactLevel
  blockers: string[]
  warnings: string[]
}

export interface RequirementFill {
  requirement: CapabilityRequirement
  filledBy: string[]
  needed: number
  filled: number
  unmet: number
  over: number
}

export type CoaKind =
  | 'Best Technical Fit'
  | 'Lowest Community Impact'
  | 'Closest Geographic Fit'
  | 'Best Balance'
  | 'Lowest Unit Disruption'
  | 'Highest Verification Confidence'
  | 'User Defined'

export interface CourseOfAction {
  id: string
  kind: CoaKind
  description: string
  selectedIds: string[]
  requirementFills: RequirementFill[]
  requirementsFilledPct: number
  unmetRequirements: string[]
  duplicateCoverage: Array<{ soldierId: string; displayName: string; requirementIds: string[] }>
  avgVerificationScore: number
  communityImpact: ImpactLevel
  unitsAffected: number
  employersAffected: number
  countiesAffected: number
  avgDistanceMiles: number | null
  tradeoffs: string[]
  limitations: string[]
}
