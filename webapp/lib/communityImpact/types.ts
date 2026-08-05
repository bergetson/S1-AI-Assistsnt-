export type ImpactLevel = 'Low' | 'Moderate' | 'High' | 'Critical' | 'Unknown'

/** Ordered so aggregates can take a maximum. Unknown is deliberately NOT lowest. */
export const IMPACT_RANK: Record<ImpactLevel, number> = {
  Low: 0, Unknown: 1, Moderate: 2, High: 3, Critical: 4,
}

export interface ImpactFactor {
  id: string
  label: string
  /** Positive raises concern. Never negative — nothing "reduces" community risk. */
  weight: number
  detail: string
}

export interface ImpactAssessment {
  level: ImpactLevel
  score: number
  factors: ImpactFactor[]
  limitations: string[]
  /** True when key civilian data is absent, which forces Unknown rather than Low. */
  hasMissingData: boolean
}

export interface ActivationParameters {
  /** Days of activation. Longer activations displace civilian work further. */
  durationDays: number
  /** Days of warning before report date. Short notice compounds impact. */
  noticeDays: number
  activationType: 'State Active Duty' | 'Title 32' | 'Title 10' | 'Training' | 'Other'
  startDate?: string
}

export const DEFAULT_ACTIVATION: ActivationParameters = {
  durationDays: 30,
  noticeDays: 30,
  activationType: 'State Active Duty',
}

/** Counties with thin professional depth — losing one specialist matters more. */
export const RURAL_COUNTIES = new Set([
  'Phillips', 'Valley', 'Roosevelt', 'Daniels', 'Sheridan', 'Garfield', 'Petroleum',
  'Wibaux', 'Treasure', 'Golden Valley', 'Judith Basin', 'Meagher', 'Powder River',
  'Carter', 'Prairie', 'McCone', 'Liberty', 'Toole', 'Pondera', 'Teton', 'Chouteau',
  'Blaine', 'Fergus', 'Musselshell', 'Wheatland', 'Broadwater', 'Jefferson',
  'Madison', 'Beaverhead', 'Granite', 'Powell', 'Deer Lodge', 'Sanders', 'Lincoln',
  'Mineral', 'Rosebud', 'Custer', 'Fallon', 'Dawson', 'Richland',
])

/** Rough city → county map for the towns that host MTARNG billets. */
export const CITY_COUNTY: Record<string, string> = {
  Billings: 'Yellowstone',
  Bozeman: 'Gallatin',
  Belgrade: 'Gallatin',
  Butte: 'Silver Bow',
  Helena: 'Lewis and Clark',
  'Fort Harrison': 'Lewis and Clark',
  'Great Falls': 'Cascade',
  Kalispell: 'Flathead',
  Missoula: 'Missoula',
  'Miles City': 'Custer',
  Dillon: 'Beaverhead',
  Havre: 'Hill',
  Lewistown: 'Fergus',
  Livingston: 'Park',
  Glendive: 'Dawson',
  Glasgow: 'Valley',
  'Wolf Point': 'Roosevelt',
  Whitefish: 'Flathead',
  Anaconda: 'Deer Lodge',
  Shelby: 'Toole',
  Malta: 'Phillips',
  Libby: 'Lincoln',
  Culbertson: 'Roosevelt',
}

export function countyForCity(city: string | undefined): string | undefined {
  if (!city) return undefined
  return CITY_COUNTY[city]
}

export function isRuralCounty(county: string | undefined): boolean {
  return county != null && RURAL_COUNTIES.has(county)
}

export const IMPACT_LIMITATIONS = [
  'Based on self-reported, reviewed, synthetic, or imported civilian data.',
  'Employer staffing levels and replacement capacity have not been independently verified.',
  'Does not represent a recommendation for or against activation.',
  'Does not represent an official determination of community criticality.',
  'Requires leader validation before use in planning.',
]
