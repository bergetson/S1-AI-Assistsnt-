import type { RosterSoldier } from '../commandTypes'
import type {
  CivilianCapabilityProfile, CivilianSkill, CivilianCredential,
  CivilianEmployment, SkillProficiency, VerificationStatus, EmployerType,
} from './types'
import { demoProvenance } from '../provenance'
import { countyForCity } from '../communityImpact/types'

// ── Deterministic civilian demo data ──────────────────────────────────────────
// Same discipline as the demo roster: a seeded PRNG, no Math.random, no
// Date.now. This runs during static export AND in the browser, so any
// nondeterminism becomes a hydration mismatch.

const SEED = 0x9E3779B1
const BASE_YEAR = 2026

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable per-soldier seed so one profile never shifts when the roster reorders. */
function seedFor(id: string): number {
  let h = SEED
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0
  return h
}

interface Archetype {
  occupation: string
  industry: string
  employerType: EmployerType
  category: string
  subcategory: string
  extraSkills?: Array<[string, string]>
  credential?: { name: string; category: string; authority: string }
  essential?: boolean
  weight: number
  /** Employers reused across soldiers so concentration effects appear. */
  employers: string[]
}

// Weighted to give a realistic Guard mix with enough of each critical
// occupation that the demo shows meaningful community-impact concentrations.
const ARCHETYPES: Archetype[] = [
  { occupation: 'Registered Nurse', industry: 'Healthcare', employerType: 'Private', category: 'Healthcare', subcategory: 'Registered Nurse', extraSkills: [['Healthcare', 'Emergency Department']], credential: { name: 'Montana RN License', category: 'Healthcare', authority: 'Montana Board of Nursing' }, essential: true, weight: 6, employers: ['Benefis Health System', 'Billings Clinic', 'St. Peter’s Health', 'Logan Health'] },
  { occupation: 'Nurse Practitioner', industry: 'Healthcare', employerType: 'Private', category: 'Healthcare', subcategory: 'Nurse Practitioner', credential: { name: 'Montana APRN License', category: 'Healthcare', authority: 'Montana Board of Nursing' }, essential: true, weight: 2, employers: ['Community Health Partners', 'Billings Clinic'] },
  { occupation: 'Paramedic', industry: 'Emergency Services', employerType: 'Local Government', category: 'Emergency Medical Services', subcategory: 'Paramedic', extraSkills: [['Fire and Rescue', 'Incident Command']], credential: { name: 'NREMT Paramedic', category: 'EMS', authority: 'NREMT' }, essential: true, weight: 5, employers: ['Phillips County EMS', 'Great Falls Emergency Services', 'Lincoln County Ambulance'] },
  { occupation: 'EMT', industry: 'Emergency Services', employerType: 'Nonprofit', category: 'Emergency Medical Services', subcategory: 'EMT Basic', credential: { name: 'NREMT Basic', category: 'EMS', authority: 'NREMT' }, essential: true, weight: 5, employers: ['Valley County EMS', 'Roosevelt County Ambulance'] },
  { occupation: 'Firefighter', industry: 'Public Safety', employerType: 'Local Government', category: 'Fire and Rescue', subcategory: 'Structural Firefighter', extraSkills: [['Fire and Rescue', 'Hazmat']], essential: true, weight: 5, employers: ['Great Falls Fire Rescue', 'Missoula Fire Department', 'Kalispell Fire'] },
  { occupation: 'Wildland Firefighter', industry: 'Natural Resources', employerType: 'Federal Government', category: 'Fire and Rescue', subcategory: 'Wildland Firefighter', essential: true, weight: 3, employers: ['US Forest Service', 'Montana DNRC'] },
  { occupation: 'Deputy Sheriff', industry: 'Public Safety', employerType: 'Local Government', category: 'Law Enforcement', subcategory: 'Sheriff Deputy', essential: true, weight: 4, employers: ['Yellowstone County Sheriff', 'Phillips County Sheriff', 'Flathead County Sheriff'] },
  { occupation: 'Police Officer', industry: 'Public Safety', employerType: 'Local Government', category: 'Law Enforcement', subcategory: 'Patrol Officer', essential: true, weight: 3, employers: ['Billings Police Department', 'Helena Police Department'] },
  { occupation: 'Master Electrician', industry: 'Construction', employerType: 'Private', category: 'Electrical', subcategory: 'Master Electrician', extraSkills: [['Electrical', 'Generator Systems'], ['Construction', 'Safety Management']], credential: { name: 'Montana Master Electrician', category: 'Trades', authority: 'Montana Dept. of Labor & Industry' }, essential: true, weight: 4, employers: ['Big Sky Electric', 'Treasure State Electric', 'Self'] },
  { occupation: 'Journeyman Electrician', industry: 'Construction', employerType: 'Private', category: 'Electrical', subcategory: 'Journeyman Electrician', credential: { name: 'Montana Journeyman Electrician', category: 'Trades', authority: 'Montana Dept. of Labor & Industry' }, weight: 4, employers: ['Big Sky Electric', 'Rocky Mountain Electric'] },
  { occupation: 'Lineman', industry: 'Utilities', employerType: 'Private', category: 'Electrical', subcategory: 'Lineman', extraSkills: [['Utilities', 'Electric Utility']], essential: true, weight: 3, employers: ['NorthWestern Energy', 'Hill County Electric Co-op', 'Sheridan Electric Co-op'] },
  { occupation: 'Water Treatment Operator', industry: 'Utilities', employerType: 'Local Government', category: 'Utilities', subcategory: 'Water Treatment', essential: true, weight: 2, employers: ['City of Malta Public Works', 'City of Havre Public Works'] },
  { occupation: 'Public Works Supervisor', industry: 'Government', employerType: 'Local Government', category: 'Utilities', subcategory: 'Public Works', extraSkills: [['Heavy Equipment', 'Snow Removal']], essential: true, weight: 2, employers: ['City of Lewistown', 'Custer County Road Dept.'] },
  { occupation: 'Heavy Equipment Operator', industry: 'Construction', employerType: 'Private', category: 'Heavy Equipment', subcategory: 'Excavator Operator', extraSkills: [['Heavy Equipment', 'Dozer Operator']], weight: 5, employers: ['Knife River', 'Schellinger Construction', 'Self'] },
  { occupation: 'Construction Superintendent', industry: 'Construction', employerType: 'Private', category: 'Construction', subcategory: 'Construction Superintendent', extraSkills: [['Project Management', 'Scheduling']], credential: { name: 'OSHA 30', category: 'Safety', authority: 'OSHA' }, weight: 3, employers: ['Dick Anderson Construction', 'Sletten Construction'] },
  { occupation: 'Carpenter', industry: 'Construction', employerType: 'Self Employed', category: 'Construction', subcategory: 'Carpenter', weight: 3, employers: ['Self'] },
  { occupation: 'Project Manager', industry: 'Professional Services', employerType: 'Private', category: 'Project Management', subcategory: 'Project Manager', extraSkills: [['Project Management', 'Cost Estimating']], credential: { name: 'PMP', category: 'Project Management', authority: 'PMI' }, weight: 4, employers: ['Morrison-Maierle', 'Sanderson Stewart'] },
  { occupation: 'Civil Engineer', industry: 'Engineering', employerType: 'Private', category: 'Engineering', subcategory: 'Civil Engineer', credential: { name: 'Montana PE License', category: 'Engineering', authority: 'Montana Board of Professional Engineers' }, essential: true, weight: 2, employers: ['Morrison-Maierle', 'HDR'] },
  { occupation: 'Structural Engineer', industry: 'Engineering', employerType: 'Private', category: 'Engineering', subcategory: 'Structural Engineer', credential: { name: 'Montana PE License', category: 'Engineering', authority: 'Montana Board of Professional Engineers' }, essential: true, weight: 1, employers: ['DCI Engineers'] },
  { occupation: 'Diesel Mechanic', industry: 'Transportation', employerType: 'Private', category: 'Mechanical and HVAC', subcategory: 'Diesel Mechanic', weight: 4, employers: ['Kenworth Sales', 'Tractor & Equipment Co.'] },
  { occupation: 'HVAC Technician', industry: 'Construction', employerType: 'Private', category: 'Mechanical and HVAC', subcategory: 'HVAC Technician', weight: 2, employers: ['Comfort Systems', 'Self'] },
  { occupation: 'Truck Driver', industry: 'Transportation', employerType: 'Private', category: 'Transportation', subcategory: 'Commercial Driver', credential: { name: 'CDL Class A', category: 'Transportation', authority: 'Montana MVD' }, weight: 5, employers: ['Watkins & Shepard', 'Self'] },
  { occupation: 'Teacher', industry: 'Education', employerType: 'Local Government', category: 'Education', subcategory: 'K-12 Teacher', essential: true, weight: 5, employers: ['Billings Public Schools', 'Malta Public Schools', 'Helena Public Schools'] },
  { occupation: 'IT Systems Administrator', industry: 'Information Technology', employerType: 'Private', category: 'Information Technology', subcategory: 'Systems Administration', weight: 3, employers: ['Bridger Technologies', 'State of Montana SITSD'] },
  { occupation: 'Cybersecurity Analyst', industry: 'Information Technology', employerType: 'State Government', category: 'Cybersecurity', subcategory: 'Security Operations', credential: { name: 'CISSP', category: 'Cybersecurity', authority: 'ISC2' }, weight: 2, employers: ['State of Montana SITSD'] },
  { occupation: 'Rancher', industry: 'Agriculture', employerType: 'Self Employed', category: 'Agriculture and Ranching', subcategory: 'Ranching', weight: 5, employers: ['Self'] },
  { occupation: 'Farmer', industry: 'Agriculture', employerType: 'Self Employed', category: 'Agriculture and Ranching', subcategory: 'Farming', weight: 3, employers: ['Self'] },
  { occupation: 'Accountant', industry: 'Finance', employerType: 'Private', category: 'Finance and Accounting', subcategory: 'Accountant', credential: { name: 'Montana CPA', category: 'Finance', authority: 'Montana Board of Public Accountants' }, weight: 2, employers: ['Anderson ZurMuehlen'] },
  { occupation: 'Attorney', industry: 'Legal', employerType: 'Private', category: 'Legal', subcategory: 'Attorney', credential: { name: 'Montana Bar License', category: 'Legal', authority: 'State Bar of Montana' }, weight: 1, employers: ['Crowley Fleck'] },
  { occupation: 'County Administrator', industry: 'Government', employerType: 'Local Government', category: 'Public Administration', subcategory: 'County Administration', essential: true, weight: 1, employers: ['Phillips County', 'Valley County'] },
  { occupation: 'Small Business Owner', industry: 'Retail', employerType: 'Self Employed', category: 'Small Business and Entrepreneurship', subcategory: 'Business Owner', weight: 4, employers: ['Self'] },
  { occupation: 'Logistics Coordinator', industry: 'Logistics', employerType: 'Private', category: 'Logistics and Warehousing', subcategory: 'Supply Chain', weight: 3, employers: ['Watkins & Shepard', 'Ryder'] },
  { occupation: 'Commercial Pilot', industry: 'Aviation', employerType: 'Private', category: 'Aviation', subcategory: 'Fixed Wing Pilot', credential: { name: 'FAA Commercial Pilot', category: 'Aviation', authority: 'FAA' }, weight: 1, employers: ['Cape Air'] },
  { occupation: 'Aircraft Mechanic', industry: 'Aviation', employerType: 'Private', category: 'Aviation', subcategory: 'Airframe and Powerplant', credential: { name: 'FAA A&P', category: 'Aviation', authority: 'FAA' }, weight: 2, employers: ['Edwards Jet Center'] },
  { occupation: 'Forester', industry: 'Natural Resources', employerType: 'State Government', category: 'Environmental and Natural Resources', subcategory: 'Forestry', weight: 2, employers: ['Montana DNRC'] },
  { occupation: 'Welder', industry: 'Manufacturing', employerType: 'Private', category: 'Mechanical and HVAC', subcategory: 'Welding', weight: 3, employers: ['Montana Metal Works', 'Self'] },
]

const WEIGHTED: Archetype[] = ARCHETYPES.flatMap(a => Array<Archetype>(a.weight).fill(a))

const PROFICIENCIES: SkillProficiency[] = [
  'Working Experience', 'Professional', 'Licensed or Certified', 'Senior Expert or Instructor',
]

function pickVerification(rnd: () => number, hasCredential: boolean): VerificationStatus {
  const r = rnd()
  if (hasCredential) {
    if (r < 0.45) return 'Document Verified'
    if (r < 0.75) return 'Leader Reviewed'
    return 'Self Reported'
  }
  if (r < 0.12) return 'Document Verified'
  if (r < 0.4) return 'Leader Reviewed'
  if (r < 0.92) return 'Self Reported'
  return 'Unverified'
}

/**
 * Build a civilian profile for one soldier. ~22% get no civilian data at all —
 * that gap is realistic and it is what exercises the "Unknown" paths in the
 * community-impact model.
 */
export function buildCivilianProfile(soldier: RosterSoldier): CivilianCapabilityProfile | null {
  const rnd = mulberry32(seedFor(soldier.id))
  if (rnd() < 0.22) return null

  const arch = WEIGHTED[Math.floor(rnd() * WEIGHTED.length)]
  const employer = arch.employers[Math.floor(rnd() * arch.employers.length)]
  const workCity = soldier.city
  const workCounty = countyForCity(workCity)
  const years = 2 + Math.floor(rnd() * 18)

  const hasCred = arch.credential != null && rnd() < 0.78
  const verification = pickVerification(rnd, hasCred)

  const skills: CivilianSkill[] = [{
    id: `${soldier.id}-s0`,
    category: arch.category,
    subcategory: arch.subcategory,
    skillName: arch.subcategory,
    proficiency: PROFICIENCIES[Math.min(PROFICIENCIES.length - 1, Math.floor(rnd() * PROFICIENCIES.length))],
    yearsExperience: years,
    lastUsedYear: BASE_YEAR - Math.floor(rnd() * 3),
    verificationStatus: verification,
  }]

  for (const [cat, sub] of arch.extraSkills ?? []) {
    if (rnd() < 0.75) {
      skills.push({
        id: `${soldier.id}-s${skills.length}`,
        category: cat, subcategory: sub, skillName: sub,
        proficiency: PROFICIENCIES[Math.floor(rnd() * 3)],
        yearsExperience: 1 + Math.floor(rnd() * 10),
        lastUsedYear: BASE_YEAR - Math.floor(rnd() * 6),
        verificationStatus: pickVerification(rnd, false),
      })
    }
  }

  const credentials: CivilianCredential[] = []
  if (hasCred && arch.credential) {
    // ~14% expired so the data-quality and verification paths have something to find.
    const expired = rnd() < 0.14
    const expYear = expired ? BASE_YEAR - 1 - Math.floor(rnd() * 2) : BASE_YEAR + 1 + Math.floor(rnd() * 4)
    credentials.push({
      id: `${soldier.id}-c0`,
      name: arch.credential.name,
      category: arch.credential.category,
      issuingAuthority: arch.credential.authority,
      expirationDate: `${expYear}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-01`,
      verificationStatus: expired ? 'Expired' : verification,
    })
  }

  const supervises = rnd() < 0.3
  const employment: CivilianEmployment = {
    occupationTitle: arch.occupation,
    industry: arch.industry,
    employerType: arch.employerType,
    employerName: employer === 'Self' ? `${arch.occupation} (self-employed)` : employer,
    workCity, workCounty,
    yearsInOccupation: years,
    supervisoryLevel: arch.employerType === 'Self Employed'
      ? 'Owner'
      : supervises ? (rnd() < 0.5 ? 'Supervisor' : 'Team Lead') : 'None',
    personnelSupervised: supervises ? 2 + Math.floor(rnd() * 20) : 0,
    essentialCommunityRole: arch.essential === true,
    soleProviderOrSpecialist: arch.essential === true && rnd() < 0.3,
    smallEmployer: arch.employerType === 'Self Employed' || rnd() < 0.35,
  }

  const pmExp = arch.category === 'Project Management' || rnd() < 0.2

  return {
    soldierId: soldier.id,
    employment,
    skills,
    credentials,
    educationFields: rnd() < 0.5 ? ['Business Administration'] : [],
    languages: rnd() < 0.12 ? ['Spanish'] : [],
    projectManagementExperience: pmExp
      ? {
          hasExperience: true,
          largestTeam: 3 + Math.floor(rnd() * 40),
          largestBudget: 50_000 * (1 + Math.floor(rnd() * 40)),
          yearsExperience: 1 + Math.floor(rnd() * 12),
        }
      : { hasExperience: false },
    willingness: {
      useCivilianSkillsOnMission: rnd() < 0.68 ? 'Yes' : rnd() < 0.7 ? 'Ask Me' : 'No',
      supportStateActiveDuty: rnd() < 0.72 ? 'Yes' : rnd() < 0.6 ? 'Maybe' : 'No',
      supportOtherUnits: rnd() < 0.55 ? 'Yes' : rnd() < 0.6 ? 'Maybe' : 'No',
      mentorOthers: rnd() < 0.45 ? 'Yes' : 'No',
      maxTravelMiles: [50, 100, 200, 400, 9999][Math.floor(rnd() * 5)],
    },
    provenance: demoProvenance('2026-01-01'),
    lastUpdated: '2026-01-01',
  }
}

/** Deterministic map of soldierId → civilian profile for a whole roster. */
export function buildCivilianProfiles(roster: RosterSoldier[]): Map<string, CivilianCapabilityProfile> {
  const map = new Map<string, CivilianCapabilityProfile>()
  for (const s of roster) {
    const p = buildCivilianProfile(s)
    if (p) map.set(s.id, p)
  }
  return map
}
