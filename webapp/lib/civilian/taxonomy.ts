// ── Civilian skill taxonomy ───────────────────────────────────────────────────
// Structured so imported data with inconsistent labels can be mapped onto a
// stable vocabulary. Aliases carry the messy real-world spellings; synonyms feed
// keyword search. Both are matched case- and punctuation-insensitively.

export interface SkillNode {
  name: string
  /** Alternate spellings seen in source data, used for import mapping. */
  aliases?: string[]
  /** Extra words that should surface this skill in a keyword search. */
  synonyms?: string[]
  /** Marks skills that typically underpin community-critical services. */
  communityCritical?: boolean
}

export interface SkillCategory {
  name: string
  /** Broad grouping used by dashboards and the community-impact model. */
  domain: 'Public Safety' | 'Healthcare' | 'Infrastructure' | 'Technical' | 'Professional' | 'Other'
  subcategories: SkillNode[]
}

export const SKILL_TAXONOMY: SkillCategory[] = [
  {
    name: 'Healthcare', domain: 'Healthcare',
    subcategories: [
      { name: 'Registered Nurse', aliases: ['RN', 'Reg Nurse'], communityCritical: true },
      { name: 'Nurse Practitioner', aliases: ['NP', 'APRN'], communityCritical: true },
      { name: 'Physician', aliases: ['MD', 'DO', 'Doctor'], communityCritical: true },
      { name: 'Physician Assistant', aliases: ['PA', 'PA-C'], communityCritical: true },
      { name: 'Respiratory Therapist', aliases: ['RT'], communityCritical: true },
      { name: 'Pharmacist', aliases: ['RPh', 'PharmD'], communityCritical: true },
      { name: 'Behavioral Health', synonyms: ['counselor', 'psychologist', 'social worker', 'mental health'], communityCritical: true },
      { name: 'ICU', synonyms: ['intensive care', 'critical care'], communityCritical: true },
      { name: 'Emergency Department', aliases: ['ER', 'ED'], communityCritical: true },
      { name: 'Trauma', communityCritical: true },
      { name: 'Pediatrics', communityCritical: true },
      { name: 'Labor and Delivery', aliases: ['L&D', 'OB'], communityCritical: true },
      { name: 'Public Health', synonyms: ['epidemiology', 'health department'] },
      { name: 'Medical Administration', synonyms: ['health administration'] },
      { name: 'Hospital Operations', synonyms: ['hospital management'] },
    ],
  },
  {
    name: 'Emergency Medical Services', domain: 'Public Safety',
    subcategories: [
      { name: 'EMT Basic', aliases: ['EMT-B', 'EMT'], communityCritical: true },
      { name: 'Advanced EMT', aliases: ['AEMT', 'EMT-I'], communityCritical: true },
      { name: 'Paramedic', aliases: ['EMT-P', 'NRP'], communityCritical: true },
      { name: 'Flight Paramedic', communityCritical: true },
      { name: 'Ambulance Operations', synonyms: ['ems operations'], communityCritical: true },
      { name: 'EMS Supervision', synonyms: ['ems officer', 'ems chief'] },
      { name: 'Emergency Dispatch', aliases: ['EMD', '911 dispatch'], communityCritical: true },
    ],
  },
  {
    name: 'Fire and Rescue', domain: 'Public Safety',
    subcategories: [
      { name: 'Structural Firefighter', aliases: ['Firefighter', 'FF'], communityCritical: true },
      { name: 'Wildland Firefighter', aliases: ['Wildland FF'], communityCritical: true },
      { name: 'Fire Officer', synonyms: ['fire captain', 'battalion chief'], communityCritical: true },
      { name: 'Hazmat', aliases: ['HAZMAT', 'Hazardous Materials'], communityCritical: true },
      { name: 'Search and Rescue', aliases: ['SAR'], communityCritical: true },
      { name: 'Rope Rescue', synonyms: ['high angle'] },
      { name: 'Swiftwater Rescue', synonyms: ['water rescue'] },
      { name: 'Incident Command', aliases: ['ICS', 'IC'], synonyms: ['incident management'] },
      { name: 'Fire Investigation', synonyms: ['arson investigation'] },
      { name: 'Emergency Management', aliases: ['EM'], synonyms: ['disaster management', 'DES'] },
    ],
  },
  {
    name: 'Law Enforcement', domain: 'Public Safety',
    subcategories: [
      { name: 'Patrol Officer', aliases: ['Police Officer', 'Deputy'], communityCritical: true },
      { name: 'Sheriff Deputy', communityCritical: true },
      { name: 'Detective', synonyms: ['investigator'] },
      { name: 'Corrections Officer', aliases: ['CO'], communityCritical: true },
      { name: 'Dispatch', synonyms: ['911', 'communications officer'], communityCritical: true },
      { name: 'K9 Handler' },
      { name: 'SWAT or Tactical' },
      { name: 'Highway Patrol', communityCritical: true },
      { name: 'Game Warden', synonyms: ['fish and wildlife'] },
    ],
  },
  {
    name: 'Construction', domain: 'Infrastructure',
    subcategories: [
      { name: 'Carpenter' }, { name: 'General Contractor', synonyms: ['GC'] },
      { name: 'Construction Superintendent', synonyms: ['site superintendent'] },
      { name: 'Estimator', synonyms: ['cost estimator'] },
      { name: 'Concrete', synonyms: ['flatwork', 'formwork'] },
      { name: 'Roofing' }, { name: 'Framing' },
      { name: 'Surveying', aliases: ['Land Surveyor'] },
      { name: 'Building Inspection', aliases: ['Building Inspector'] },
      { name: 'Site Work', synonyms: ['excavation', 'grading'] },
      { name: 'Quality Control', aliases: ['QC'] },
      { name: 'Safety Management', aliases: ['OSHA', 'Safety Officer'] },
    ],
  },
  {
    name: 'Electrical', domain: 'Infrastructure',
    subcategories: [
      { name: 'Apprentice Electrician' },
      { name: 'Journeyman Electrician', aliases: ['Journeyman'], communityCritical: true },
      { name: 'Master Electrician', aliases: ['Master Elec'], communityCritical: true },
      { name: 'Lineman', aliases: ['Line Worker', 'Power Lineman'], communityCritical: true },
      { name: 'Generator Systems', synonyms: ['genset', 'standby power'], communityCritical: true },
      { name: 'Temporary Power', synonyms: ['emergency power'], communityCritical: true },
      { name: 'Industrial Electrical' }, { name: 'Commercial Electrical' },
      { name: 'Residential Electrical' },
      { name: 'Electrical Inspection', aliases: ['Electrical Inspector'] },
    ],
  },
  {
    name: 'Plumbing', domain: 'Infrastructure',
    subcategories: [
      { name: 'Apprentice Plumber' },
      { name: 'Journeyman Plumber' },
      { name: 'Master Plumber', communityCritical: true },
      { name: 'Pipefitter' }, { name: 'Backflow Certification' },
      { name: 'Water Systems', communityCritical: true },
      { name: 'Wastewater Systems', communityCritical: true },
    ],
  },
  {
    name: 'Mechanical and HVAC', domain: 'Infrastructure',
    subcategories: [
      { name: 'HVAC Technician', aliases: ['HVAC'] },
      { name: 'Refrigeration', synonyms: ['cooling'] },
      { name: 'Boiler Operations', communityCritical: true },
      { name: 'Industrial Maintenance' },
      { name: 'Diesel Mechanic', aliases: ['Diesel Tech'] },
      { name: 'Automotive Technician', aliases: ['Auto Mechanic'] },
      { name: 'Welding', aliases: ['Welder'] },
    ],
  },
  {
    name: 'Engineering', domain: 'Technical',
    subcategories: [
      { name: 'Civil Engineer', aliases: ['PE Civil'], communityCritical: true },
      { name: 'Structural Engineer', communityCritical: true },
      { name: 'Mechanical Engineer' }, { name: 'Electrical Engineer' },
      { name: 'Environmental Engineer' }, { name: 'Geotechnical Engineer' },
      { name: 'Water Resources' }, { name: 'Engineering Technician' },
    ],
  },
  {
    name: 'Heavy Equipment', domain: 'Infrastructure',
    subcategories: [
      { name: 'Excavator Operator', aliases: ['Excavator'] },
      { name: 'Dozer Operator', aliases: ['Bulldozer'] },
      { name: 'Grader Operator', aliases: ['Motor Grader'] },
      { name: 'Loader Operator' }, { name: 'Crane Operator', communityCritical: true },
      { name: 'Snow Removal', communityCritical: true },
      { name: 'Equipment Maintenance' },
    ],
  },
  {
    name: 'Utilities', domain: 'Infrastructure',
    subcategories: [
      { name: 'Electric Utility', communityCritical: true },
      { name: 'Natural Gas', communityCritical: true },
      { name: 'Water Treatment', aliases: ['Water Operator'], communityCritical: true },
      { name: 'Wastewater Treatment', communityCritical: true },
      { name: 'Telecommunications Infrastructure', communityCritical: true },
      { name: 'Public Works', communityCritical: true },
      { name: 'Utility Locating' },
    ],
  },
  {
    name: 'Transportation', domain: 'Infrastructure',
    subcategories: [
      { name: 'Commercial Driver', aliases: ['CDL', 'CDL-A', 'Truck Driver'] },
      { name: 'Hazmat Transport', aliases: ['Hazmat Endorsement'] },
      { name: 'Bus Operations', synonyms: ['school bus'] },
      { name: 'Rail Operations' }, { name: 'Fleet Management' },
      { name: 'Dispatch Operations' },
    ],
  },
  {
    name: 'Logistics and Warehousing', domain: 'Professional',
    subcategories: [
      { name: 'Warehouse Management' }, { name: 'Supply Chain' },
      { name: 'Inventory Control' }, { name: 'Distribution' },
      { name: 'Freight Forwarding' }, { name: 'Procurement', synonyms: ['purchasing'] },
      { name: 'Forklift Operations' },
    ],
  },
  {
    name: 'Project Management', domain: 'Professional',
    subcategories: [
      { name: 'Project Manager', aliases: ['PM'] },
      { name: 'Program Manager' },
      { name: 'Scrum Master', aliases: ['Agile'] },
      { name: 'Construction Project Manager' },
      { name: 'PMP', aliases: ['Project Management Professional'] },
      { name: 'Scheduling', synonyms: ['primavera', 'ms project'] },
      { name: 'Cost Estimating' }, { name: 'Risk Management' },
      { name: 'Contract Management', synonyms: ['contracting'] },
      { name: 'Portfolio Management' }, { name: 'Change Management' },
    ],
  },
  {
    name: 'Information Technology', domain: 'Technical',
    subcategories: [
      { name: 'Systems Administration', aliases: ['SysAdmin'] },
      { name: 'Network Engineering', aliases: ['Network Engineer'] },
      { name: 'Software Development', aliases: ['Developer', 'Programmer'] },
      { name: 'Database Administration', aliases: ['DBA'] },
      { name: 'Cloud Infrastructure', synonyms: ['aws', 'azure'] },
      { name: 'Help Desk', synonyms: ['desktop support'] },
      { name: 'GIS', aliases: ['Geographic Information Systems'] },
      { name: 'Data Analysis', synonyms: ['analytics'] },
    ],
  },
  {
    name: 'Cybersecurity', domain: 'Technical',
    subcategories: [
      { name: 'Security Operations', aliases: ['SOC'] },
      { name: 'Incident Response', aliases: ['IR', 'DFIR'] },
      { name: 'Penetration Testing', aliases: ['Pentest', 'Red Team'] },
      { name: 'Security Engineering' },
      { name: 'Governance Risk and Compliance', aliases: ['GRC'] },
      { name: 'Industrial Control Systems', aliases: ['ICS', 'SCADA'], communityCritical: true },
    ],
  },
  {
    name: 'Communications', domain: 'Technical',
    subcategories: [
      { name: 'Radio Systems', synonyms: ['land mobile radio', 'lmr'], communityCritical: true },
      { name: 'Satellite Communications', aliases: ['SATCOM'] },
      { name: 'Public Affairs', synonyms: ['communications officer', 'pao'] },
      { name: 'Broadcasting' }, { name: 'Amateur Radio', aliases: ['HAM'] },
      { name: 'Fiber Optics', communityCritical: true },
    ],
  },
  {
    name: 'Agriculture and Ranching', domain: 'Other',
    subcategories: [
      { name: 'Ranching', aliases: ['Rancher', 'Cattle'], communityCritical: true },
      { name: 'Farming', aliases: ['Farmer', 'Crop Production'], communityCritical: true },
      { name: 'Irrigation' }, { name: 'Agricultural Equipment' },
      { name: 'Veterinary', aliases: ['Vet', 'Veterinarian'], communityCritical: true },
      { name: 'Agronomy' }, { name: 'Livestock Management' },
    ],
  },
  {
    name: 'Education', domain: 'Professional',
    subcategories: [
      { name: 'K-12 Teacher', aliases: ['Teacher', 'Educator'], communityCritical: true },
      { name: 'Special Education', aliases: ['SPED'], communityCritical: true },
      { name: 'School Administration', aliases: ['Principal'], communityCritical: true },
      { name: 'Higher Education', synonyms: ['professor', 'instructor'] },
      { name: 'Vocational Training', synonyms: ['cte', 'trade instructor'] },
      { name: 'Instructional Design' }, { name: 'School Counseling', communityCritical: true },
    ],
  },
  {
    name: 'Public Administration', domain: 'Professional',
    subcategories: [
      { name: 'City Management', aliases: ['City Manager'], communityCritical: true },
      { name: 'County Administration', communityCritical: true },
      { name: 'Emergency Management Coordination', communityCritical: true },
      { name: 'Planning and Zoning' }, { name: 'Public Budgeting' },
      { name: 'Grants Management' }, { name: 'Elections Administration' },
    ],
  },
  {
    name: 'Legal', domain: 'Professional',
    subcategories: [
      { name: 'Attorney', aliases: ['Lawyer', 'JD'] },
      { name: 'Paralegal' }, { name: 'Contract Law' },
      { name: 'Administrative Law' }, { name: 'Prosecution', synonyms: ['county attorney'] },
      { name: 'Public Defense' }, { name: 'Compliance' },
    ],
  },
  {
    name: 'Finance and Accounting', domain: 'Professional',
    subcategories: [
      { name: 'Accountant', aliases: ['CPA'] }, { name: 'Auditor' },
      { name: 'Financial Analysis' }, { name: 'Banking' },
      { name: 'Payroll' }, { name: 'Budget Analysis' }, { name: 'Insurance' },
    ],
  },
  {
    name: 'Human Resources', domain: 'Professional',
    subcategories: [
      { name: 'HR Generalist', aliases: ['HR'] }, { name: 'Recruiting', aliases: ['Talent Acquisition'] },
      { name: 'Benefits Administration' }, { name: 'Labor Relations' },
      { name: 'Training and Development' }, { name: 'Organizational Development' },
    ],
  },
  {
    name: 'Aviation', domain: 'Technical',
    subcategories: [
      { name: 'Fixed Wing Pilot', aliases: ['Pilot'] },
      { name: 'Rotary Wing Pilot', aliases: ['Helicopter Pilot'] },
      { name: 'Airframe and Powerplant', aliases: ['A&P', 'Aircraft Mechanic'] },
      { name: 'Air Traffic Control', aliases: ['ATC'], communityCritical: true },
      { name: 'Unmanned Aircraft Systems', aliases: ['UAS', 'Drone', 'Part 107'] },
      { name: 'Aviation Operations' }, { name: 'Aerial Firefighting', communityCritical: true },
    ],
  },
  {
    name: 'Languages and Cultural Skills', domain: 'Other',
    subcategories: [
      { name: 'Spanish' }, { name: 'German' }, { name: 'French' }, { name: 'Arabic' },
      { name: 'Russian' }, { name: 'Mandarin' }, { name: 'American Sign Language', aliases: ['ASL'] },
      { name: 'Native American Languages', synonyms: ['crow', 'blackfeet', 'salish'] },
      { name: 'Translation and Interpretation', synonyms: ['interpreter', 'translator'] },
      { name: 'Cultural Liaison' },
    ],
  },
  {
    name: 'Environmental and Natural Resources', domain: 'Other',
    subcategories: [
      { name: 'Forestry', aliases: ['Forester'] }, { name: 'Wildlife Management' },
      { name: 'Environmental Compliance' }, { name: 'Hydrology' },
      { name: 'Soil Science' }, { name: 'Conservation' },
      { name: 'Hazardous Waste', aliases: ['HAZWOPER'] },
    ],
  },
  {
    name: 'Manufacturing', domain: 'Other',
    subcategories: [
      { name: 'Machining', aliases: ['Machinist', 'CNC'] },
      { name: 'Fabrication' }, { name: 'Production Supervision' },
      { name: 'Quality Assurance', aliases: ['QA'] },
      { name: 'Lean and Six Sigma', aliases: ['Six Sigma'] },
      { name: 'Industrial Engineering' },
    ],
  },
  {
    name: 'Small Business and Entrepreneurship', domain: 'Other',
    subcategories: [
      { name: 'Business Owner', aliases: ['Owner', 'Proprietor'] },
      { name: 'Operations Management' }, { name: 'Sales' },
      { name: 'Marketing' }, { name: 'Customer Service' },
      { name: 'Retail Management' }, { name: 'Restaurant Management' },
    ],
  },
  {
    name: 'Other', domain: 'Other',
    subcategories: [{ name: 'Other', synonyms: ['unlisted', 'misc'] }],
  },
]

// ── Lookup and matching ───────────────────────────────────────────────────────
function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export interface TaxonomyEntry {
  category: string
  domain: SkillCategory['domain']
  subcategory: string
  communityCritical: boolean
  /** Everything that should match this entry: name, aliases, synonyms. */
  terms: string[]
}

let flatCache: TaxonomyEntry[] | null = null

export function flatTaxonomy(): TaxonomyEntry[] {
  if (flatCache) return flatCache
  flatCache = SKILL_TAXONOMY.flatMap(cat =>
    cat.subcategories.map(sub => ({
      category: cat.name,
      domain: cat.domain,
      subcategory: sub.name,
      communityCritical: sub.communityCritical === true,
      terms: [
        normalizeToken(sub.name),
        ...(sub.aliases ?? []).map(normalizeToken),
        ...(sub.synonyms ?? []).map(normalizeToken),
      ],
    }))
  )
  return flatCache
}

export function categoryNames(): string[] {
  return SKILL_TAXONOMY.map(c => c.name)
}

export function subcategoriesOf(category: string): string[] {
  return SKILL_TAXONOMY.find(c => c.name === category)?.subcategories.map(s => s.name) ?? []
}

export function domainOf(category: string): SkillCategory['domain'] {
  return SKILL_TAXONOMY.find(c => c.name === category)?.domain ?? 'Other'
}

/** True when this category/subcategory typically underpins a community service. */
export function isCommunityCritical(category: string, subcategory: string): boolean {
  return flatTaxonomy().some(
    e => e.category === category && e.subcategory === subcategory && e.communityCritical)
}

/**
 * Map an arbitrary source label onto the taxonomy. Used by imports where the
 * incoming data says "Master Elec." or "EMT-P" rather than a canonical name.
 * Exact term match first, then containment, then null — never a wild guess.
 */
export function resolveSkillLabel(raw: string): TaxonomyEntry | null {
  const q = normalizeToken(raw)
  if (!q) return null
  const flat = flatTaxonomy()
  const exact = flat.find(e => e.terms.includes(q))
  if (exact) return exact
  const contained = flat.find(e => e.terms.some(t => t.length > 3 && (q.includes(t) || t.includes(q))))
  return contained ?? null
}

/** Keyword search across names, aliases, and synonyms. */
export function searchTaxonomy(query: string): TaxonomyEntry[] {
  const q = normalizeToken(query)
  if (!q) return []
  return flatTaxonomy().filter(e =>
    e.category.toLowerCase().includes(q) || e.terms.some(t => t.includes(q)))
}
