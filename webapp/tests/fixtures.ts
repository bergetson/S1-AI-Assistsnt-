import type { RosterSoldier } from '@/lib/commandTypes'
import type { Position, SoldierProfile } from '@/lib/types'
import { defaultProfile } from '@/lib/types'
import type { CivilianCapabilityProfile, CivilianSkill, CivilianCredential } from '@/lib/civilian/types'
import { demoProvenance } from '@/lib/provenance'

export const AS_OF = '2026-06-01'

let seq = 0
export function soldier(over: Partial<RosterSoldier> = {}): RosterSoldier {
  seq++
  return {
    id: over.id ?? `r-${String(seq).padStart(4, '0')}`,
    anonId: over.anonId ?? `S-${String(seq).padStart(3, '0')}`,
    lastName: 'Doe', firstName: 'Jane',
    rank: 'E5', careerCategory: 'Enlisted', mos: '92Y', componentStatus: 'M-Day',
    uic: 'WTCPT0', unitName: '1-163 IN HHC', city: 'Billings', dutyTitle: 'Supply Sergeant',
    positionId: null,
    yearsOfService: 8, timeInGrade: 3, timeInPosition: 2, commissionedYears: 0,
    pebd: '2018-01-01', ets: '2029-01-01',
    srBox: '', raterBox: '', ncoerBox: 'Highly Qualified', evalBullets: '',
    pmeComplete: ['BLC'], isPromotable: false, flagged: false, notes: '',
    ...over,
  }
}

export function position(over: Partial<Position> = {}): Position {
  return {
    id: over.id ?? 9000,
    unit: '1-163 IN HHC', uic: 'WTCPT0', bde: '1889TH SUPPORT GROUP',
    bn: '1ST BATTALION, 163D INFANTRY REGIMENT', paraLine: '001-01',
    city: 'Billings', dutyTitle: 'Supply Sergeant', grade: 'E6',
    careerCategory: 'Enlisted', mos: '92Y', branch: 'QM',
    positionType: 'Technical', isCommandOrKD: false,
    statusType: 'M-Day', vacancyStatus: 'Vacant', authorized: true, notes: '',
    ...over,
  }
}

export function profile(over: Partial<SoldierProfile> = {}): SoldierProfile {
  return { ...defaultProfile, ...over }
}

export function skill(over: Partial<CivilianSkill> = {}): CivilianSkill {
  return {
    id: 'sk1', category: 'Electrical', subcategory: 'Master Electrician',
    skillName: 'Master Electrician', proficiency: 'Licensed or Certified',
    yearsExperience: 11, lastUsedYear: 2025, verificationStatus: 'Document Verified',
    ...over,
  }
}

export function credential(over: Partial<CivilianCredential> = {}): CivilianCredential {
  return {
    id: 'cr1', name: 'Montana Master Electrician', category: 'Trades',
    issuingAuthority: 'Montana DLI', expirationDate: '2028-01-01',
    verificationStatus: 'Document Verified',
    ...over,
  }
}

export function civilian(over: Partial<CivilianCapabilityProfile> = {}): CivilianCapabilityProfile {
  return {
    soldierId: 'r-0001',
    employment: {
      occupationTitle: 'Master Electrician', industry: 'Construction',
      employerType: 'Private', employerName: 'Big Sky Electric',
      workCity: 'Billings', workCounty: 'Yellowstone', yearsInOccupation: 11,
      supervisoryLevel: 'Supervisor', personnelSupervised: 6,
      essentialCommunityRole: false, soleProviderOrSpecialist: false, smallEmployer: false,
    },
    skills: [skill()],
    credentials: [credential()],
    educationFields: [], languages: [],
    willingness: {
      useCivilianSkillsOnMission: 'Yes', supportStateActiveDuty: 'Yes',
      supportOtherUnits: 'Yes', mentorOthers: 'Yes', maxTravelMiles: 400,
    },
    provenance: demoProvenance(),
    ...over,
  }
}

// ── Named archetypes used across regression tests ────────────────────────────
export const FIXTURES = {
  ruralParamedic: () => civilian({
    soldierId: 'r-med',
    employment: {
      occupationTitle: 'Paramedic', industry: 'Emergency Services',
      employerType: 'Local Government', employerName: 'Phillips County EMS',
      workCity: 'Malta', workCounty: 'Phillips', yearsInOccupation: 9,
      essentialCommunityRole: true, soleProviderOrSpecialist: true, smallEmployer: true,
    },
    skills: [skill({ category: 'Emergency Medical Services', subcategory: 'Paramedic', skillName: 'Paramedic' })],
    credentials: [credential({ name: 'NREMT Paramedic', category: 'EMS' })],
  }),
  urbanAccountant: () => civilian({
    soldierId: 'r-acct',
    employment: {
      occupationTitle: 'Accountant', industry: 'Finance',
      employerType: 'Private', employerName: 'Anderson ZurMuehlen',
      workCity: 'Billings', workCounty: 'Yellowstone', yearsInOccupation: 6,
      essentialCommunityRole: false, soleProviderOrSpecialist: false, smallEmployer: false,
    },
    skills: [skill({ category: 'Finance and Accounting', subcategory: 'Accountant', skillName: 'Accountant', verificationStatus: 'Self Reported' })],
    credentials: [],
  }),
  expiredNurse: () => civilian({
    soldierId: 'r-rn',
    employment: {
      occupationTitle: 'Registered Nurse', industry: 'Healthcare',
      employerType: 'Private', employerName: 'Billings Clinic',
      workCity: 'Billings', workCounty: 'Yellowstone',
      essentialCommunityRole: true, soleProviderOrSpecialist: false, smallEmployer: false,
    },
    skills: [skill({ category: 'Healthcare', subcategory: 'Registered Nurse', skillName: 'Registered Nurse' })],
    credentials: [credential({ name: 'Montana RN License', category: 'Healthcare', expirationDate: '2025-01-01' })],
  }),
  noCivilianData: () => undefined,
}
