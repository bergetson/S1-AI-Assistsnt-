export type CareerCategory = 'Enlisted' | 'Officer' | 'Warrant'
export type ComponentStatus = 'M-Day' | 'AGR' | 'Technician' | 'ADOS' | 'IRR'
export type PositionType = 'Leadership' | 'Staff' | 'Command' | 'Technical' | 'Broadening'
export type VacancyStatus = 'Filled' | 'Vacant' | 'Projected Vacant'
export type MatchLabel =
  | 'STRONG MATCH'
  | 'GOOD MATCH'
  | 'MODERATE / STRETCH'
  | 'POSSIBLE — GAPS EXIST'
  | 'NOT RECOMMENDED NOW'

export type PrimaryGoal =
  | 'Promote to Next Grade'
  | 'Switch MOS/Branch'
  | 'Pursue AGR Full-Time'
  | 'Pursue Command'
  | 'Move to Staff'
  | 'Become Warrant Officer'
  | 'Pursue Senior Leader Path'
  | 'Broaden Experience'
  | 'Retire in Current Grade'

export type CommuteLimit =
  | '30 Minutes'
  | '1 Hour'
  | '1.5 Hours'
  | '2 Hours'
  | '3 Hours'
  | 'No Limit'

// ── Soldier Profile ──────────────────────────────────────────────────────────
export interface SoldierProfile {
  // Identity
  fullName: string
  rank: string
  careerCategory: CareerCategory
  mos: string
  secondaryMos: string
  branch: string
  componentStatus: ComponentStatus
  // Assignment
  unitName: string
  dutyTitle: string
  unitCity: string
  homeCity: string
  maxCommute: CommuteLimit
  willingToRelocate: 'Yes' | 'No' | 'Maybe'
  // Service dates
  yearsOfService: number
  timeInGrade: number
  timeInPosition: number
  ets: string
  pebd: string
  // PME — Enlisted
  blcComplete: boolean
  alcComplete: boolean
  slcComplete: boolean
  smcComplete: boolean
  ssd1Complete: boolean
  ssd2Complete: boolean
  // PME — Officer
  bolcComplete: boolean
  cccComplete: boolean
  ileComplete: boolean
  sscComplete: boolean
  // PME — Warrant
  wobcComplete: boolean
  woacComplete: boolean
  woileComplete: boolean
  wosseComplete: boolean
  // Education
  educationLevel: string
  educationField: string
  // Goals
  targetRank: string
  targetTimeline: number
  primaryGoal: PrimaryGoal
  secondaryGoal: string
  preferredStatus: ComponentStatus | 'Either'
  desiredPositionType: PositionType | 'Any'
  openToCommand: 'Yes' | 'No' | 'In a few years'
  wantToSwitchMos: 'Yes' | 'No' | 'Considering it'
  targetMos: string
  warrantInterest: 'Yes - Active interest' | 'No' | 'Considering it'
  longTermGoal: string
  fiveYearGoal: string
  tenYearGoal: string
  // Status
  hasKdPosition: boolean
  isPromotable: boolean
  onPromotionList: boolean
  fitnessStatus: string
  clearanceLevel: string
  deployments: string
  awards: string
  mentorName: string
  mentorRole: string
  seniorRaterName: string
  previousAssignments: string
}

export const defaultProfile: SoldierProfile = {
  fullName: '',
  rank: 'E5',
  careerCategory: 'Enlisted',
  mos: '92Y',
  secondaryMos: '',
  branch: 'LG',
  componentStatus: 'M-Day',
  unitName: '495th CSSC',
  dutyTitle: 'Unit Supply Specialist',
  unitCity: 'Missoula',
  homeCity: 'Missoula',
  maxCommute: '2 Hours',
  willingToRelocate: 'No',
  yearsOfService: 8,
  timeInGrade: 2,
  timeInPosition: 1.5,
  ets: '2027-08-01',
  pebd: '2018-06-01',
  blcComplete: true,
  alcComplete: false,
  slcComplete: false,
  smcComplete: false,
  ssd1Complete: true,
  ssd2Complete: false,
  bolcComplete: false,
  cccComplete: false,
  ileComplete: false,
  sscComplete: false,
  wobcComplete: false,
  woacComplete: false,
  woileComplete: false,
  wosseComplete: false,
  educationLevel: 'Some College',
  educationField: 'Business Administration',
  targetRank: 'E7',
  targetTimeline: 4,
  primaryGoal: 'Promote to Next Grade',
  secondaryGoal: 'Pursue AGR Full-Time',
  preferredStatus: 'Either',
  desiredPositionType: 'Leadership',
  openToCommand: 'Yes',
  wantToSwitchMos: 'No',
  targetMos: '',
  warrantInterest: 'No',
  longTermGoal: 'Senior NCO / Retention SGM',
  fiveYearGoal: 'I want to promote to SFC within 4 years and complete SLC. I plan to move into a platoon sergeant or staff NCOIC role closer to Helena, ideally AGR.',
  tenYearGoal: 'Long term I want to achieve MSG or pursue a warrant officer program. I want to finish my bachelor\'s degree and remain in Montana.',
  hasKdPosition: false,
  isPromotable: false,
  onPromotionList: false,
  fitnessStatus: 'Passing',
  clearanceLevel: 'Secret',
  deployments: '1 deployment (Afghanistan 2021)',
  awards: 'Army Achievement Medal x2, Army Commendation Medal',
  mentorName: '',
  mentorRole: '',
  seniorRaterName: '',
  previousAssignments: 'SPC 92Y at 495th CSSC; SGT acting supply NCOIC AT 2025',
}

// ── Position ─────────────────────────────────────────────────────────────────
export interface Position {
  id: number
  unit: string
  uic?: string
  city: string
  dutyTitle: string
  grade: string
  careerCategory: CareerCategory
  mos: string
  branch: string
  positionType: PositionType
  isCommandOrKD: boolean
  statusType: ComponentStatus | 'Multiple'
  vacancyStatus: VacancyStatus
  projectedVacancyDate?: string
  secondaryMosOk?: string
  notes: string
}

// ── Scored Position (adds match scoring to Position) ─────────────────────────
export interface ScoredPosition extends Position {
  gradeScore: number
  mosScore: number
  commuteScore: number
  goalScore: number
  statusScore: number
  totalScore: number
  matchLabel: MatchLabel
  commuteMins: number
  commuteMiles: number
  pathNote?: string
}

// ── City pair ────────────────────────────────────────────────────────────────
export interface CityPair {
  from: string
  to: string
  miles: number
  minutes: number
  route: string
}

// ── PME Requirement ──────────────────────────────────────────────────────────
export interface PmeRequirement {
  careerCategory: CareerCategory
  grade: string
  courseName: string
  courseCode: string
  required: boolean
  prerequisite: string
  duration: string
  location: string
  notes: string
}

// ── MOS Transition ───────────────────────────────────────────────────────────
export interface MosTransition {
  fromMos: string
  toMos: string
  toMosTitle: string
  eligibleGrades: string
  asvabReq: string
  mosqSchool: string
  schoolDuration: string
  waiverAvailable: boolean
  medReq: string
  notes: string
  difficulty: 'Easy' | 'Moderate' | 'Hard'
}

// ── Action Item (for "Get This Position" plan) ───────────────────────────────
export interface ActionItem {
  label: string
  detail: string
  done: boolean
  priority: 'required' | 'recommended' | 'info'
  timeline?: string
}

// ── Board Alert ───────────────────────────────────────────────────────────────
export interface BoardAlert {
  grade: string
  boardName: string
  conveneDate: Date
  cutoffDate: Date
  monthsAway: number
  urgencyLevel: 'critical' | 'warning' | 'info'
  message: string
  actions: string[]
}

// ── Position Gap ──────────────────────────────────────────────────────────────
export interface PositionGap {
  category: 'grade' | 'mos' | 'commute' | 'goal' | 'tig'
  label: string
  detail: string
  severity: 'blocking' | 'significant' | 'minor'
}

// ── Career Step ───────────────────────────────────────────────────────────────
export interface CareerStep {
  id: string
  year: number
  title: string
  type: 'promotion' | 'pme' | 'assignment' | 'milestone'
  description: string
  status: 'done' | 'current' | 'next' | 'future'
  grade?: string
}

// ── Promotion Timeline ────────────────────────────────────────────────────────
export interface PromotionRequirement {
  careerCategory: CareerCategory
  promoteTo: string
  minTigMonths: number | null
  typicalTigMonths: number | null
  minTisYears: number | null
  pmeRequired: string
  boardType: string
  promoRate: string
  notes: string
}
